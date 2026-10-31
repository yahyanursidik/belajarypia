import { useRef, useState } from "react";
import { Eye, EyeOff, ArrowRight, ArrowLeft, KeyRound } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { supabase } from "../../lib/supabase";
import {
  profilePasswordValidation,
  profilePasswordError,
} from "../../lib/profileWorkspace";
export function ProfilePasswordDialog({
  email,
  onClose,
  onSaved,
}: {
  email: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [visible, setVisible] = useState(false),
    [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  const validation = profilePasswordValidation(password, confirmation);
  async function save() {
    if (pending.current || validation) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await supabase.auth.updateUser({ password });
      if (r.error) throw r.error;
      setPassword("");
      setConfirmation("");
      onSaved();
    } catch (e) {
      setError(profilePasswordError(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Ubah kata sandi"
      onClose={onClose}
      busy={busy}
      className="profile-password-dialog"
    >
      <ol className="profile-steps" aria-label="Langkah ubah sandi">
        <li aria-current={step === 1 ? "step" : undefined}>1. Sandi baru</li>
        <li aria-current={step === 2 ? "step" : undefined}>2. Konfirmasi</li>
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 1) {
            setError(validation);
            if (!validation) {
              setVisible(false);
              setStep(2);
            }
          } else void save();
        }}
      >
        {step === 1 ? (
          <div className="profile-password-fields">
            <label htmlFor="profile-new-password">
              Kata sandi baru
              <div>
                <Input
                  id="profile-new-password"
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={
                    visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                  }
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </Button>
              </div>
              <small>Minimal 8 karakter.</small>
            </label>
            <label htmlFor="profile-confirm-password">
              Ulangi kata sandi
              <Input
                id="profile-confirm-password"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={confirmation}
                onChange={(e) => {
                  setConfirmation(e.target.value);
                  setError("");
                }}
              />
            </label>
          </div>
        ) : (
          <div className="profile-password-summary">
            <span className="profile-section-icon profile-icon-violet">
              <KeyRound size={22} />
            </span>
            <strong>{email}</strong>
            <p>Sandi baru siap disimpan untuk akun ini.</p>
          </div>
        )}
        {error && (
          <p className="profile-inline-error" role="alert">
            {error}
          </p>
        )}
        <footer className="profile-dialog-footer">
          {step === 1 ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setStep(1);
                setError("");
              }}
            >
              <ArrowLeft size={16} />
              Kembali
            </Button>
          )}
          <Button type="submit" disabled={busy || (step === 1 && !!validation)}>
            {busy ? (
              "Menyimpan…"
            ) : step === 1 ? (
              <>
                Tinjau
                <ArrowRight size={16} />
              </>
            ) : (
              "Simpan kata sandi"
            )}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
