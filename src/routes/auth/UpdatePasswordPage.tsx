import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSystemSettings } from "../../lib/useSystemSettings";

const portalLoginPath = {
  admin: "/admin/login",
  teacher: "/teacher/login",
  mentor: "/musyrif/login",
  learner: "/learner/login",
};

function getPortalLoginPath(portal: string | null) {
  if (portal && portal in portalLoginPath) {
    return portalLoginPath[portal as keyof typeof portalLoginPath];
  }

  return "/learner/login";
}

function getPasswordUpdateErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const code = "code" in error && typeof error.code === "string" ? error.code : "";

    if (code === "weak_password") {
      return "Kata sandi belum memenuhi ketentuan keamanan.";
    }

    if (code === "session_not_found" || code === "refresh_token_not_found") {
      return "Tautan reset sudah kedaluwarsa. Silakan minta tautan baru.";
    }
  }

  return "Kata sandi belum bisa diperbarui. Silakan coba lagi atau minta tautan reset baru.";
}

export function UpdatePasswordPage() {
  const [searchParams] = useSearchParams();
  const { isLoading, session, signOut, updatePassword } = useAuthSession();
  const { settings } = useSystemSettings();
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const loginPath = getPortalLoginPath(searchParams.get("portal"));
  const loginLogo = settings?.login_logo_url || settings?.logo_url;

  return (
    <div className="portal-login portal-login--learner">
      <div className="portal-login__watermark" aria-hidden="true">
        <KeyRound />
      </div>

      <div className="portal-login__shell portal-login__shell--single">
        <main className="portal-login__card" aria-label="Atur kata sandi baru">
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
              <KeyRound className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="portal-login__eyebrow">Ahlan wa Sahlan</span>
              <h1>Atur Kata Sandi Baru</h1>
              <p>Gunakan kata sandi baru untuk melanjutkan akses ke LMS.</p>
            </div>
          </header>

          {errorMessage ? (
            <Alert className="border-red-200 bg-red-50 text-red-700">
              <AlertTitle>Reset gagal</AlertTitle>
              <AlertDescription className="text-red-700/80">{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
              <AlertTitle>Kata sandi diperbarui</AlertTitle>
              <AlertDescription className="text-emerald-800/80">{successMessage}</AlertDescription>
            </Alert>
          ) : null}

          {!successMessage ? (
            <form
              className="portal-login__form"
              onSubmit={async (event) => {
                event.preventDefault();
                setErrorMessage(null);

                if (password.length < 8) {
                  setErrorMessage("Kata sandi minimal 8 karakter.");
                  return;
                }

                if (password !== passwordConfirmation) {
                  setErrorMessage("Konfirmasi kata sandi belum sama.");
                  return;
                }

                setIsSubmitting(true);
                try {
                  await updatePassword(password);
                  await signOut();
                  setPassword("");
                  setPasswordConfirmation("");
                  setSuccessMessage("Silakan masuk kembali memakai kata sandi baru.");
                } catch (error: unknown) {
                  setErrorMessage(getPasswordUpdateErrorMessage(error));
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isLoading ? (
                <div className="turnstile-panel">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p>Memeriksa tautan reset...</p>
                </div>
              ) : !session ? (
                <div className="turnstile-panel turnstile-panel--error" role="alert">
                  <strong>Tautan reset tidak aktif.</strong>
                  <p>Minta tautan reset baru dari halaman login portal Anda.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label htmlFor="new-password">Kata Sandi Baru</label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        autoComplete="new-password"
                        className="h-12 bg-background pr-11"
                        disabled={isSubmitting}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="********"
                        required
                        type={showPassword ? "text" : "password"}
                        value={password}
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

                  <div className="space-y-2">
                    <label htmlFor="new-password-confirmation">Ulangi Kata Sandi Baru</label>
                    <Input
                      id="new-password-confirmation"
                      autoComplete="new-password"
                      className="h-12 bg-background"
                      disabled={isSubmitting}
                      onChange={(event) => setPasswordConfirmation(event.target.value)}
                      placeholder="********"
                      required
                      type={showPassword ? "text" : "password"}
                      value={passwordConfirmation}
                    />
                  </div>

                  <Button
                    disabled={isSubmitting}
                    type="submit"
                    className="portal-login__submit h-12 w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      "Simpan Kata Sandi"
                    )}
                  </Button>
                </>
              )}
            </form>
          ) : null}

          <Link className="portal-login__link-action portal-login__link-action--standalone" to={loginPath}>
            Kembali ke login
          </Link>
        </main>
      </div>
    </div>
  );
}
