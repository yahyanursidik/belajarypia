import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  GraduationCap,
  HeartHandshake,
  Loader2,
  UserPlus,
} from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";
import { getDashboardPathForRole, type RoleCode } from "../../lib/auth";
import { getThemeStyles } from "../../lib/theme";
import { useSystemSettings } from "../../lib/useSystemSettings";

export type PortalType = "admin" | "teacher" | "mentor" | "learner";

type LoginPageProps = {
  portal: PortalType;
};

const portalConfig = {
  admin: {
    title: "Login Admin",
    welcome: "Selamat datang di pusat operasional YPIA.",
    Icon: BriefcaseBusiness,
    allowedRoles: ["super_admin", "admin", "finance", "helpdesk", "content_reviewer"] as RoleCode[],
  },
  teacher: {
    title: "Login Pengajar",
    welcome: "Selamat datang di ruang pengajaran.",
    Icon: BookOpenCheck,
    allowedRoles: ["teacher"] as RoleCode[],
  },
  mentor: {
    title: "Login Musyrif",
    welcome: "Selamat datang di ruang pendampingan.",
    Icon: HeartHandshake,
    allowedRoles: ["mentor"] as RoleCode[],
  },
  learner: {
    title: "Login Peserta",
    welcome: "Selamat datang kembali di ruang belajar.",
    Icon: GraduationCap,
    allowedRoles: ["participant", "guardian"] as RoleCode[],
  },
};

const portalNavigation = [
  { portal: "admin", label: "Admin", href: "/admin/login", Icon: BriefcaseBusiness },
  { portal: "teacher", label: "Pengajar", href: "/teacher/login", Icon: BookOpenCheck },
  { portal: "mentor", label: "Musyrif", href: "/musyrif/login", Icon: HeartHandshake },
  { portal: "learner", label: "Peserta", href: "/learner/login", Icon: GraduationCap },
] as const;

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";

function getLoginErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes("tidak memiliki akses")) {
    return error.message;
  }

  if (error instanceof Error && /captcha|turnstile/i.test(error.message)) {
    return "Verifikasi keamanan gagal atau kedaluwarsa. Silakan ulangi verifikasi.";
  }

  if (error && typeof error === "object") {
    const code = "code" in error && typeof error.code === "string" ? error.code : "";

    if (code === "invalid_credentials") {
      return "Email atau kata sandi tidak sesuai. Periksa kembali data yang dimasukkan.";
    }

    if (code === "email_not_confirmed") {
      return "Email akun belum dikonfirmasi. Silakan konfirmasi email atau hubungi administrator.";
    }

    if (code === "user_already_exists") {
      return "Email sudah terdaftar. Gunakan mode Masuk atau pilih akun Google yang sesuai.";
    }

    if (code === "weak_password") {
      return "Kata sandi belum memenuhi ketentuan keamanan.";
    }

    if (code === "over_request_rate_limit") {
      return "Terlalu banyak percobaan masuk. Tunggu beberapa saat lalu coba kembali.";
    }

    if (code === "captcha_failed") {
      return "Verifikasi keamanan gagal atau kedaluwarsa. Silakan ulangi verifikasi.";
    }
  }

  if (error instanceof Error && error.message.toLowerCase().includes("already registered")) {
    return "Email sudah terdaftar. Gunakan mode Masuk atau pilih akun Google yang sesuai.";
  }

  return "Login gagal. Silakan coba kembali atau hubungi administrator.";
}

export function LoginPage({ portal }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const {
    isLoading,
    session,
    primaryRole,
    signIn,
    signInLearnerWithGoogle,
    signOut,
    signUpLearner,
  } = useAuthSession();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { settings } = useSystemSettings();
  const dashboardPath = getDashboardPathForRole(primaryRole);
  const config = portalConfig[portal];
  const Icon = config.Icon;
  const isLearnerPortal = portal === "learner";
  const isLearnerRegistration = isLearnerPortal && authMode === "register";
  const turnstileAction = isLearnerRegistration ? "learner_signup" : `${portal}_login`;
  const pageTitle = isLearnerPortal && authMode === "register" ? "Daftar Peserta" : config.title;
  const welcomeMessage = isLearnerPortal && authMode === "register"
    ? "Mulai perjalanan belajar bersama YPIA."
    : config.welcome;
  const isLearnerRegistrationInProgress =
    isLearnerPortal && authMode === "register" && isSubmitting;
  const loginLogo = settings?.login_logo_url || settings?.logo_url;
  const themeKey = settings?.portal_themes?.[portal] ?? (portal === "mentor" ? "rose" : undefined);
  const themeStyles = getThemeStyles(themeKey);

  useEffect(() => {
    if (Object.keys(themeStyles).length === 0) return;
    const root = document.documentElement;
    Object.entries(themeStyles).forEach(([key, value]) => {
      root.style.setProperty(key, value as string);
    });

    return () => {
      Object.keys(themeStyles).forEach((key) => {
        root.style.removeProperty(key);
      });
    };
  }, [themeStyles]);

  useEffect(() => {
    if (!isLoading && session && !isLearnerRegistrationInProgress) {
      navigate(dashboardPath, { replace: true });
    }
  }, [dashboardPath, isLearnerRegistrationInProgress, isLoading, navigate, session]);

  if (!isLoading && session && !isLearnerRegistrationInProgress) {
    return <Navigate to={dashboardPath} replace />;
  }

  return (
    <div className={`portal-login portal-login--${portal}`}>
      <div className="portal-login__watermark" aria-hidden="true">
        <Icon />
      </div>

      <div className="portal-login__shell">
        <nav className="portal-login__navigation" aria-label="Pilih portal login">
          {portalNavigation.map((item) => {
            const NavigationIcon = item.Icon;
            const isActive = item.portal === portal;

            return (
              <Link
                key={item.portal}
                to={item.href}
                className={isActive ? "is-active" : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <NavigationIcon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <main className="portal-login__card" aria-label={pageTitle}>
          <div className="portal-login__institution">
            {loginLogo ? (
              <img src={loginLogo} alt="" />
            ) : (
              <span className="portal-login__institution-mark">Y</span>
            )}
            <span>{settings?.institution_name || "YPIA"}</span>
          </div>

          <header className="portal-login__header">
            <div className="portal-login__icon" aria-hidden="true">
              {authMode === "register" && isLearnerPortal
                ? <UserPlus className="h-6 w-6" />
                : <Icon className="h-6 w-6" />}
            </div>
            <div className="min-w-0">
              <span className="portal-login__eyebrow">Ahlan wa Sahlan</span>
              <h1>{pageTitle}</h1>
              <p>{welcomeMessage}</p>
            </div>
          </header>

          {isLearnerPortal ? (
            <div className="portal-login__mode" aria-label="Pilih masuk atau daftar">
              <button
                type="button"
                className={authMode === "login" ? "is-active" : undefined}
                onClick={() => {
                  setAuthMode("login");
                  setCaptchaToken(null);
                  turnstileRef.current?.reset();
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
              >
                Masuk
              </button>
              <button
                type="button"
                className={authMode === "register" ? "is-active" : undefined}
                onClick={() => {
                  setAuthMode("register");
                  setCaptchaToken(null);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
              >
                Daftar
              </button>
            </div>
          ) : null}

          {errorMessage ? (
            <Alert className="border-red-200 bg-red-50 text-red-700">
              <AlertTitle>{authMode === "register" && isLearnerPortal ? "Pendaftaran gagal" : "Gagal Masuk"}</AlertTitle>
              <AlertDescription className="text-red-700/80">{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
              <AlertTitle>Pendaftaran berhasil</AlertTitle>
              <AlertDescription className="text-emerald-800/80">{successMessage}</AlertDescription>
            </Alert>
          ) : null}

          <form
            className="portal-login__form"
            data-turnstile-status={turnstileSiteKey ? "enabled" : "missing-site-key"}
            onSubmit={async (event) => {
            event.preventDefault();
            setErrorMessage(null);
            setSuccessMessage(null);
            setIsSubmitting(true);

            try {
              const normalizedEmail = email.trim().toLowerCase();

              if (!turnstileSiteKey) {
                throw new Error("Turnstile belum dikonfigurasi. Autentikasi sementara dinonaktifkan.");
              }

              if (!captchaToken) {
                throw new Error(
                  isLearnerRegistration
                    ? "Selesaikan verifikasi keamanan sebelum mendaftar."
                    : "Selesaikan verifikasi keamanan sebelum masuk.",
                );
              }

              if (isLearnerPortal && authMode === "register") {
                if (password.length < 8) {
                  throw new Error("Kata sandi minimal 8 karakter.");
                }

                if (password !== passwordConfirmation) {
                  throw new Error("Konfirmasi kata sandi belum sama.");
                }

                let result: Awaited<ReturnType<typeof signUpLearner>>;
                try {
                  result = await signUpLearner(
                    fullName,
                    normalizedEmail,
                    password,
                    captchaToken ?? undefined,
                  );
                } finally {
                  if (turnstileSiteKey) {
                    setCaptchaToken(null);
                    turnstileRef.current?.reset();
                  }
                }

                if (result.requiresEmailConfirmation) {
                  setSuccessMessage(
                    "Periksa inbox email Anda dan buka tautan konfirmasi untuk melanjutkan ke dashboard peserta. Periksa folder spam jika belum terlihat.",
                  );
                  return;
                }

                navigate("/learner", { replace: true });
                return;
              }

              let nextState: Awaited<ReturnType<typeof signIn>>;
              try {
                nextState = await signIn(normalizedEmail, password, captchaToken);
              } finally {
                setCaptchaToken(null);
                turnstileRef.current?.reset();
              }

              const userRoles = nextState.roles.map((role) => role.code);
              const hasAccessToPortal = config.allowedRoles.some((role) => userRoles.includes(role));

              if (!hasAccessToPortal) {
                await signOut();
                throw new Error(`Akun Anda tidak memiliki akses ke ${config.title}. Gunakan halaman login sesuai peran akun.`);
              }

              const from = location.state as { from?: string } | null;
              navigate(from?.from ?? getDashboardPathForRole(nextState.primaryRole), {
                replace: true,
              });
            } catch (error: unknown) {
              console.error("Login gagal:", error);
              setErrorMessage(
                error instanceof Error && (
                  error.message.includes("minimal 8 karakter") ||
                  error.message.includes("Konfirmasi kata sandi") ||
                  error.message.includes("verifikasi keamanan")
                )
                  ? error.message
                  : getLoginErrorMessage(error),
              );
            } finally {
              setIsSubmitting(false);
            }
            }}
          >
          {isLearnerPortal && authMode === "register" ? (
            <div className="space-y-2">
              <label htmlFor="learner-full-name">Nama Lengkap</label>
              <Input
                id="learner-full-name"
                autoComplete="name"
                disabled={isSubmitting}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nama lengkap"
                required
                type="text"
                value={fullName}
                className="h-12 bg-background"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor={`${portal}-email`}>Email</label>
            <Input
              id={`${portal}-email`}
              autoComplete="email"
              autoCapitalize="none"
              disabled={isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setEmail((currentEmail) => currentEmail.trim().toLowerCase())}
              placeholder="nama@email.com"
              required
              spellCheck={false}
              type="email"
              value={email}
              className="h-12 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={`${portal}-password`}>Kata Sandi</label>
            <div className="relative">
              <Input
                id={`${portal}-password`}
                autoComplete={authMode === "register" && isLearnerPortal ? "new-password" : "current-password"}
                disabled={isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                required
                type={showPassword ? "text" : "password"}
                value={password}
                className="h-12 bg-background pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="portal-login__password-toggle"
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {isLearnerPortal && authMode === "register" ? (
            <div className="space-y-2">
              <label htmlFor="learner-password-confirmation">Ulangi Kata Sandi</label>
              <Input
                id="learner-password-confirmation"
                autoComplete="new-password"
                disabled={isSubmitting}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                placeholder="********"
                required
                type={showPassword ? "text" : "password"}
                value={passwordConfirmation}
                className="h-12 bg-background"
              />
            </div>
          ) : null}

          {turnstileSiteKey ? (
            <TurnstileWidget
              key={`${turnstileSiteKey}-${turnstileAction}`}
              ref={turnstileRef}
              action={turnstileAction}
              siteKey={turnstileSiteKey}
              onTokenChange={setCaptchaToken}
            />
          ) : (
            <div className="turnstile-panel turnstile-panel--error" role="alert">
              <strong>Verifikasi keamanan belum aktif.</strong>
              <p>Login dan pendaftaran dinonaktifkan sampai site key Turnstile tersedia.</p>
            </div>
          )}

          <Button
            disabled={isSubmitting || !turnstileSiteKey || !captchaToken}
            type="submit"
            className="portal-login__submit h-12 w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              authMode === "register" && isLearnerPortal ? "Daftar dan Masuk" : "Masuk"
            )}
          </Button>

          {isLearnerPortal ? (
            <>
              <div className="portal-login__separator"><span>atau</span></div>
              <Button
                type="button"
                variant="outline"
                className="portal-login__google h-12 w-full"
                disabled={isSubmitting}
                onClick={async () => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setIsSubmitting(true);
                  try {
                    await signInLearnerWithGoogle();
                  } catch (error: unknown) {
                    setErrorMessage(getLoginErrorMessage(error));
                    setIsSubmitting(false);
                  }
                }}
              >
                <span className="portal-login__google-mark" aria-hidden="true">G</span>
                {authMode === "register" ? "Daftar dengan Google" : "Masuk dengan Google"}
              </Button>
            </>
          ) : null}
          </form>
        </main>
      </div>
    </div>
  );
}
