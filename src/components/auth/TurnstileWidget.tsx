import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ShieldCheck } from "lucide-react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      action: string;
      appearance: "always";
      callback: (token: string) => void;
      "error-callback": (errorCode: string) => boolean;
      "expired-callback": () => void;
      language: string;
      sitekey: string;
      size: "flexible";
      theme: "light";
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileWidgetHandle = {
  reset: () => void;
};

type TurnstileWidgetProps = {
  onTokenChange: (token: string | null) => void;
  siteKey: string;
};

const turnstileScriptId = "cloudflare-turnstile-script";
let turnstileLoader: Promise<TurnstileApi> | null = null;

function loadTurnstile() {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (turnstileLoader) {
    return turnstileLoader;
  }

  turnstileLoader = new Promise<TurnstileApi>((resolve, reject) => {
    const existingScript = document.getElementById(turnstileScriptId) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    const handleLoad = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }

      reject(new Error("Turnstile tidak tersedia setelah script dimuat."));
    };

    const handleError = () => {
      reject(new Error("Script Turnstile gagal dimuat."));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existingScript) {
      script.id = turnstileScriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    turnstileLoader = null;
    throw error;
  });

  return turnstileLoader;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ onTokenChange, siteKey }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const apiRef = useRef<TurnstileApi | null>(null);
    const onTokenChangeRef = useRef(onTokenChange);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "verified" | "expired" | "error">(
      "loading",
    );

    useEffect(() => {
      onTokenChangeRef.current = onTokenChange;
    }, [onTokenChange]);

    useImperativeHandle(ref, () => ({
      reset: () => {
        const api = apiRef.current;
        const widgetId = widgetIdRef.current;

        onTokenChangeRef.current(null);
        setErrorCode(null);
        setStatus("ready");

        if (api && widgetId) {
          api.reset(widgetId);
        }
      },
    }), []);

    useEffect(() => {
      let isDisposed = false;

      void loadTurnstile()
        .then((api) => {
          if (isDisposed || !containerRef.current) {
            return;
          }

          apiRef.current = api;
          widgetIdRef.current = api.render(containerRef.current, {
            action: "learner_signup",
            appearance: "always",
            callback: (token) => {
              setErrorCode(null);
              setStatus("verified");
              onTokenChangeRef.current(token);
            },
            "error-callback": (code) => {
              setErrorCode(code);
              setStatus("error");
              onTokenChangeRef.current(null);
              return true;
            },
            "expired-callback": () => {
              setErrorCode(null);
              setStatus("expired");
              onTokenChangeRef.current(null);
            },
            language: "id",
            sitekey: siteKey,
            size: "flexible",
            theme: "light",
          });
          setStatus("ready");
        })
        .catch(() => {
          if (!isDisposed) {
            setErrorCode("script-load");
            setStatus("error");
            onTokenChangeRef.current(null);
          }
        });

      return () => {
        isDisposed = true;

        if (apiRef.current && widgetIdRef.current) {
          apiRef.current.remove(widgetIdRef.current);
        }

        widgetIdRef.current = null;
        apiRef.current = null;
      };
    }, [siteKey]);

    const statusText = {
      loading: "Memuat verifikasi keamanan...",
      ready: "Selesaikan verifikasi sebelum mendaftar.",
      verified: "Verifikasi keamanan berhasil.",
      expired: "Verifikasi kedaluwarsa. Silakan ulangi.",
      error: `Verifikasi keamanan gagal dimuat. Periksa koneksi lalu muat ulang halaman.${errorCode ? ` Kode: ${errorCode}.` : ""}`,
    }[status];

    return (
      <div
        className={`turnstile-panel turnstile-panel--${status}`}
        data-turnstile-error-code={errorCode ?? undefined}
      >
        <div className="turnstile-panel__heading">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          <span>Verifikasi keamanan</span>
        </div>
        <div ref={containerRef} className="turnstile-panel__widget" />
        <p aria-live="polite">{statusText}</p>
      </div>
    );
  },
);
