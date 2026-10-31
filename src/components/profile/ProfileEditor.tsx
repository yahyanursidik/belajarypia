import { useEffect, useRef, useState } from "react";
import {
  Save,
  ArrowRight,
  ArrowLeft,
  UserRound,
  Phone,
  CheckCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Dialog } from "../ui/dialog";
import { supabase } from "../../lib/supabase";
import {
  profileDraft,
  profilePatch,
  profileValidation,
  profileError,
  profileFieldLabel,
  type ProfileWorkspace,
} from "../../lib/profileWorkspace";
export function ProfileEditor({
  data,
  disabled,
  onDirty,
  onBusy,
  onSaved,
  onReload,
}: {
  data: ProfileWorkspace;
  disabled: boolean;
  onDirty: (value: boolean) => void;
  onBusy: (value: boolean) => void;
  onSaved: (data: ProfileWorkspace) => void;
  onReload: () => void;
}) {
  const [base, setBase] = useState(data),
    [draft, setDraft] = useState(() => profileDraft(data)),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const request = useRef<AbortController | null>(null),
    patch = profilePatch(base, draft),
    dirty = Object.keys(patch).length > 0,
    validation = profileValidation(patch);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => () => request.current?.abort(), []);
  function edit(key: "full_name" | "phone", value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSuccess("");
    setError("");
  }
  async function save() {
    if (busy) return;
    const c = new AbortController();
    request.current = c;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const r = await supabase
        .rpc("my_profile_update", {
          p_revision: base.revision,
          p_changes: patch,
        })
        .abortSignal(c.signal);
      if (r.error) throw r.error;
      const next = r.data as ProfileWorkspace;
      if (
        next?.profile?.id !== base.profile.id ||
        !next.revision ||
        !next.login ||
        !Array.isArray(next.assignments) ||
        !Array.isArray(next.history)
      )
        throw new Error(
          "Hasil simpan belum lengkap. Muat ulang untuk memeriksa profil.",
        );
      if (c.signal.aborted) return;
      setBase(next);
      setDraft(profileDraft(next));
      setReview(false);
      setSuccess(
        next.saved === false
          ? "Profil sudah sesuai. Tidak ada perubahan baru."
          : "Profil tersimpan.",
      );
      onSaved(next);
    } catch (e) {
      if (!c.signal.aborted) setError(profileError(e));
    } finally {
      if (!c.signal.aborted) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  return (
    <section className="profile-panel" aria-label="Informasi profil">
      <header>
        <span className="profile-section-icon profile-icon-blue">
          <UserRound size={19} />
        </span>
        <div>
          <h2>Informasi profil</h2>
          <p>Nama dan kontak yang tampil di LMS.</p>
        </div>
        {dirty && <span className="profile-draft-tag">Belum disimpan</span>}
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSuccess("");
          if (validation) {
            setError(validation);
            return;
          }
          setError("");
          setReview(true);
        }}
      >
        <div className="profile-form-fields">
          <label htmlFor="profile-full-name">
            Nama lengkap<span aria-hidden="true"> *</span>
            <Input
              id="profile-full-name"
              autoComplete="name"
              value={draft.full_name}
              maxLength={160}
              required
              disabled={disabled || busy}
              onChange={(e) => edit("full_name", e.target.value)}
            />
          </label>
          <label htmlFor="profile-phone">
            Nomor telepon
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={draft.phone}
              maxLength={32}
              placeholder="Contoh: +62 812 3456 7890"
              disabled={disabled || busy}
              onChange={(e) => edit("phone", e.target.value)}
            />
            <small>
              <Phone size={12} />
              Opsional, untuk kontak administrasi.
            </small>
          </label>
        </div>
        {validation && dirty && (
          <p className="profile-field-error" role="status">
            {validation}
          </p>
        )}
        {error && !review && (
          <div className="profile-inline-error" role="alert">
            <p>{error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onReload}
            >
              Muat data terbaru
            </Button>
          </div>
        )}
        {success && (
          <p role="status" className="profile-success">
            <CheckCheck size={16} />
            {success}
          </p>
        )}
        <footer className="profile-form-footer">
          <Button
            variant="ghost"
            type="button"
            disabled={!dirty || busy || disabled}
            onClick={() => {
              setDraft(profileDraft(base));
              setError("");
              setSuccess("");
            }}
          >
            Batalkan perubahan
          </Button>
          <Button
            type="submit"
            disabled={!dirty || !!validation || disabled || busy}
          >
            Tinjau perubahan
            <ArrowRight size={16} />
          </Button>
        </footer>
      </form>
      {review && (
        <Dialog
          title="Tinjau perubahan profil"
          onClose={() => {
            if (!busy) setReview(false);
          }}
          busy={busy}
          className="profile-review-dialog"
        >
          <ol className="profile-steps" aria-label="Langkah perubahan profil">
            <li>1. Isi profil</li>
            <li aria-current="step">2. Tinjau & simpan</li>
          </ol>
          <div className="profile-review-changes">
            {Object.entries(patch).map(([key, value]) => (
              <section key={key}>
                <h3>{profileFieldLabel(key)}</h3>
                <div>
                  <span>
                    <small>Sebelumnya</small>
                    {base.profile[key as "full_name" | "phone"] ||
                      "Belum diisi"}
                  </span>
                  <ArrowRight size={16} />
                  <span>
                    <small>Sesudahnya</small>
                    {value || "Dikosongkan"}
                  </span>
                </div>
              </section>
            ))}
          </div>
          {error && (
            <div className="profile-inline-error" role="alert">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReview(false);
                  onReload();
                }}
              >
                Muat data terbaru
              </Button>
            </div>
          )}
          <footer className="profile-dialog-footer">
            <Button
              variant="outline"
              onClick={() => setReview(false)}
              disabled={busy}
            >
              <ArrowLeft size={16} />
              Kembali
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? (
                "Menyimpan…"
              ) : (
                <>
                  <Save size={16} />
                  Simpan profil
                </>
              )}
            </Button>
          </footer>
        </Dialog>
      )}
    </section>
  );
}
