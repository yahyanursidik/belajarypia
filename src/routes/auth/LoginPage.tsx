import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Eye,
  EyeOff,
  CalendarDays,
  Check,
  ShieldCheck,
  KeyRound,
  Loader2,
  MailCheck,
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
import { canAccessPath, getDashboardPathForRole } from "../../lib/auth";
import { getAuthRedirectUrl } from "../../lib/authRedirects";
import { getThemeStyles } from "../../lib/theme";
import { useSystemSettings } from "../../lib/useSystemSettings";

export type PortalType = "admin" | "teacher" | "mentor" | "learner";

type LoginPageProps = {
  portal: PortalType;
};

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
const isLocalDevelopment = import.meta.env.DEV &&
  ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
const isTurnstileDisabled = isLocalDevelopment &&
  import.meta.env.VITE_DISABLE_TURNSTILE === "true";

function getAuthErrorMessage(error: unknown, context: "login" | "register" | "forgot" = "login") {
  if (error instanceof Error && error.message.includes("tidak memiliki akses")) {
    return error.message;
  }

  if (error instanceof Error && /captcha|turnstile/i.test(error.message)) {
    return "Verifikasi keamanan gagal atau kedaluwarsa. Silakan ulangi verifikasi.";
  }

  const fallbackMessage =
    context === "register"
      ? "Pendaftaran belum berhasil. Silakan coba kembali atau hubungi administrator."
      : context === "forgot"
        ? "Permintaan reset sandi belum berhasil. Silakan coba kembali atau hubungi administrator."
        : "Login gagal. Silakan coba kembali atau hubungi administrator.";

  if (error && typeof error === "object") {
    const code = "code" in error && typeof error.code === "string" ? error.code : "";
    const message = "message" in error && typeof error.message === "string" ? error.message : "";

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

    if (/ensure_learner_identity|function .* does not exist|schema cache/i.test(message)) {
      return "Pendaftaran berhasil membuat akun Auth, tetapi profil peserta belum bisa disiapkan. Jalankan migration learner self-signup lalu coba login kembali.";
    }

    if (/Role participant belum tersedia/i.test(message)) {
      return "Pendaftaran berhasil membuat akun Auth, tetapi role peserta belum tersedia di database. Hubungi administrator.";
    }

    if (/Akun staf tidak dapat didaftarkan/i.test(message)) {
      return "Email ini sudah terdaftar sebagai akun staf. Silakan masuk menggunakan akun Anda.";
    }

    if (/already registered|already exists|duplicate key/i.test(message)) {
      return "Email sudah terdaftar. Gunakan mode Masuk atau pilih akun Google yang sesuai.";
    }

    if (/Database error saving new user/i.test(message)) {
      return "Akun Auth belum bisa dibuat karena trigger database gagal. Periksa migration profil/role di Supabase.";
    }

    if (/captcha|turnstile/i.test(message)) {
      return "Verifikasi keamanan gagal. Pastikan domain aplikasi sudah terdaftar di Cloudflare Turnstile dan ulangi verifikasi.";
    }

    if (/Email not confirmed/i.test(message)) {
      return "Email akun belum dikonfirmasi. Jika konfirmasi email sudah dimatikan, cek kembali status user di Supabase Auth.";
    }

    if (message) {
      return `${fallbackMessage} Detail: ${message}`;
    }
  }

  if (error instanceof Error && error.message.toLowerCase().includes("already registered")) {
    return "Email sudah terdaftar. Gunakan mode Masuk atau pilih akun Google yang sesuai.";
  }

  return fallbackMessage;
}

export function LoginPage({ portal }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const {
    isLoading,
    session,
    primaryRole,
    roles,
    requestPasswordReset,
    signIn,
    signInLearnerWithGoogle,
    signUpLearner,
  } = useAuthSession();
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login");
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
  const from = location.state as { from?: string } | null;
  const requestedPath = from?.from;
  const dashboardPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") &&
    !requestedPath.startsWith("/auth") && canAccessPath(requestedPath, roles)
    ? requestedPath
    : getDashboardPathForRole(primaryRole);
  const Icon = BookOpenCheck;
  const isLearnerPortal = true;
  const isLearnerRegistration = isLearnerPortal && authMode === "register";
  const isPasswordRecovery = authMode === "forgot";
  const hasCompletionState = Boolean(successMessage);
  const turnstileAction = isLearnerRegistration
    ? "learner_signup"
    : isPasswordRecovery
      ? `${portal}_password_reset`
      : `${portal}_login`;
  const pageTitle = hasCompletionState
    ? isPasswordRecovery
      ? "Email Reset Dikirim"
      : "Pendaftaran Berhasil"
    : isLearnerRegistration
    ? "Daftar Peserta"
    : isPasswordRecovery
      ? "Lupa Kata Sandi"
      : "Masuk ke ruang belajar";
  const welcomeMessage = hasCompletionState
    ? isPasswordRecovery
      ? "Periksa inbox email Anda untuk melanjutkan reset sandi."
      : "Periksa inbox email Anda untuk aktivasi akun."
    : isLearnerRegistration
    ? "Mulai perjalanan belajar bersama YPIA."
    : isPasswordRecovery
      ? "Masukkan email akun untuk menerima tautan reset sandi."
      : "Lanjutkan belajar, mengajar, dan bertumbuh bersama YPIA.";
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

  if (!isLoading && session && !isLearnerRegistrationInProgress) {
    return <Navigate to={dashboardPath} replace />;
  }

  return (
    <div className="portal-login portal-login--unified">
      <div className="portal-login__shell">
        <section className="learning-intro" aria-label="Tentang ruang belajar YPIA">
          <div className="learning-intro__brand">
            <span className="learning-intro__brand-mark">{loginLogo ? <img src={loginLogo} alt="" /> : <BookOpenCheck />}</span>
            <div><strong>{settings?.institution_name || "YPIA"}</strong><span>Ruang belajar bersama</span></div>
          </div>
          <div className="learning-intro__story">
            <span className="learning-intro__eyebrow">ILMU • ADAB • AMAL</span>
            <h2>Menuntut ilmu.<br />Menumbuhkan adab.<br /><em>Melangkah bersama.</em></h2>
            <p>Dari bacaan pertama hingga pemahaman yang lebih dalam. Satu ruang untuk belajar Al-Qur’an, mendalami ilmu, dan mendampingi tumbuhnya keluarga.</p>
          </div>
          <div className="learning-journey" aria-label="Alur belajar di YPIA">
            <div className="learning-journey__heading"><span>PERJALANAN BELAJAR</span><BookOpenCheck size={20} /></div>
            <div className="learning-journey__step"><span className="learning-journey__number"><BookOpenCheck size={19} /></span><div><strong>Ilmu yang terarah</strong><p>Materi dan kelas sesuai program Anda.</p></div></div>
            <div className="learning-journey__step"><span className="learning-journey__number"><CalendarDays size={19} /></span><div><strong>Belajar dengan pendampingan</strong><p>Jadwal, halaqah, tugas, dan umpan balik.</p></div></div>
            <div className="learning-journey__step"><span className="learning-journey__number"><Check size={19} /></span><div><strong>Setiap langkah berarti</strong><p>Pantau progres dan hasil belajar Anda.</p></div></div>
          </div>
          <p className="learning-intro__footer">Yayasan Pendidikan Ihsanul Adab</p>
        </section>
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
              {hasCompletionState ? (
                <MailCheck className="h-6 w-6" />
              ) : authMode === "register" && isLearnerPortal ? (
                <UserPlus className="h-6 w-6" />
              ) : isPasswordRecovery ? (
                <KeyRound className="h-6 w-6" />
              ) : (
                <Icon className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0">
              <span className="portal-login__eyebrow">Ahlan wa Sahlan</span>
              <h1>{pageTitle}</h1>
              <p>{welcomeMessage}</p>
            </div>
          </header>

          {errorMessage ? (
            <Alert className="border-red-200 bg-red-50 text-red-700">
              <AlertTitle>{authMode === "register" && isLearnerPortal ? "Pendaftaran gagal" : "Gagal Masuk"}</AlertTitle>
              <AlertDescription className="text-red-700/80">{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {successMessage ? (
            <section className="portal-login__completion" aria-live="polite">
              <div className="portal-login__completion-icon" aria-hidden="true">
                <MailCheck className="h-7 w-7" />
              </div>
              <div>
                <h2>{isPasswordRecovery ? "Email reset dikirim" : "Pendaftaran berhasil"}</h2>
                <p>{successMessage}</p>
              </div>
              {email ? (
                <div className="portal-login__completion-email">
                  <span>Email tujuan</span>
                  <strong>{email.trim().toLowerCase()}</strong>
                </div>
              ) : null}
              <Button
                type="button"
                className="portal-login__submit h-12 w-full"
                onClick={() => {
                  setAuthMode("login");
                  setCaptchaToken(null);
                  turnstileRef.current?.reset();
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setPassword("");
                  setPasswordConfirmation("");
                }}
              >
                <span>{isLearnerPortal ? "Kembali ke login" : "Kembali ke login"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </section>
          ) : (

          <form
            className="portal-login__form"
            data-turnstile-status={isTurnstileDisabled ? "disabled-local" : turnstileSiteKey ? "enabled" : "missing-site-key"}
            onSubmit={async (event) => {
            event.preventDefault();
            setErrorMessage(null);
            setSuccessMessage(null);
            setIsSubmitting(true);

            try {
              const normalizedEmail = email.trim().toLowerCase();

              if (!isTurnstileDisabled && !turnstileSiteKey) {
                throw new Error("Turnstile belum dikonfigurasi. Autentikasi sementara dinonaktifkan.");
              }

              if (!isTurnstileDisabled && !captchaToken) {
                throw new Error(
                  isLearnerRegistration
                    ? "Selesaikan verifikasi keamanan sebelum mendaftar."
                    : isPasswordRecovery
                      ? "Selesaikan verifikasi keamanan sebelum meminta reset sandi."
                      : "Selesaikan verifikasi keamanan sebelum masuk.",
                );
              }

              if (isPasswordRecovery) {
                try {
                  await requestPasswordReset(
                    normalizedEmail,
                    getAuthRedirectUrl(`/auth/update-password?portal=${portal}`),
                    isTurnstileDisabled ? undefined : captchaToken ?? undefined,
                  );
                } finally {
                  setCaptchaToken(null);
                  turnstileRef.current?.reset();
                }

                setSuccessMessage(
                  "Tautan reset kata sandi sudah dikirim jika email tersebut terdaftar. Periksa inbox dan folder spam.",
                );
                setPassword("");
                return;
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
                    isTurnstileDisabled ? undefined : captchaToken ?? undefined,
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
                nextState = await signIn(normalizedEmail, password, isTurnstileDisabled ? undefined : captchaToken ?? undefined);
              } finally {
                setCaptchaToken(null);
                turnstileRef.current?.reset();
              }

              const from = location.state as { from?: string } | null;
              const requestedPath = from?.from;
              const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") &&
                !requestedPath.startsWith("/auth") && canAccessPath(requestedPath, nextState.roles)
                ? requestedPath
                : getDashboardPathForRole(nextState.primaryRole);
              navigate(destination, { replace: true });
            } catch (error: unknown) {
              console.error("Login gagal:", error);
              setErrorMessage(
                error instanceof Error && (
                  error.message.includes("minimal 8 karakter") ||
                  error.message.includes("Konfirmasi kata sandi") ||
                  error.message.includes("verifikasi keamanan")
                )
                  ? error.message
                  : getAuthErrorMessage(
                    error,
                    isLearnerRegistration ? "register" : isPasswordRecovery ? "forgot" : "login",
                  ),
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

          {!isPasswordRecovery ? (
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
                  disabled={isSubmitting}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          ) : null}

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

          {isTurnstileDisabled ? null : turnstileSiteKey ? (
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
            disabled={isSubmitting || (!isTurnstileDisabled && (!turnstileSiteKey || !captchaToken))}
            type="submit"
            className="portal-login__submit h-12 w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              isLearnerRegistration
                ? "Daftar dan Masuk"
                : isPasswordRecovery
                  ? "Kirim Tautan Reset"
                  : "Masuk"
            )}
          </Button>

          {authMode === "login" ? (
            <button
              type="button"
              className="portal-login__link-action"
              onClick={() => {
                setAuthMode("forgot");
                setCaptchaToken(null);
                turnstileRef.current?.reset();
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              <KeyRound className="h-4 w-4" />
              <span>Lupa kata sandi?</span>
            </button>
          ) : null}

          {isPasswordRecovery ? (
            <button
              type="button"
              className="portal-login__link-action"
              onClick={() => {
                setAuthMode("login");
                setCaptchaToken(null);
                turnstileRef.current?.reset();
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              Kembali ke login
            </button>
          ) : null}

          {isLearnerPortal && !isPasswordRecovery ? (
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
                    setErrorMessage(getAuthErrorMessage(error, authMode === "register" ? "register" : "login"));
                    setIsSubmitting(false);
                  }
                }}
              >
                <span className="portal-login__google-mark" aria-hidden="true">G</span>
                {authMode === "register" ? "Daftar dengan Google" : "Masuk dengan Google (peserta)"}
              </Button>
            </>
          ) : null}
          </form>
          )}
          {!hasCompletionState && !isPasswordRecovery ? (
            <p className="learning-signup">
              {authMode === "register" ? "Sudah memiliki akun? " : "Baru di YPIA? "}
              <button type="button" disabled={isSubmitting} onClick={() => {
                setAuthMode(authMode === "register" ? "login" : "register");
                setCaptchaToken(null);
                turnstileRef.current?.reset();
                setErrorMessage(null);
                setPassword("");
                setPasswordConfirmation("");
              }}>{authMode === "register" ? "Masuk di sini" : "Daftar sebagai peserta"}</button>
            </p>
          ) : null}
          <p className="learning-access"><ShieldCheck size={16} aria-hidden="true" />Satu pintu untuk peserta, wali, pengajar, musyrif, dan pengelola. Akses menyesuaikan peran akun Anda.</p>
        </main>
      </div>
    </div>
  );
}
