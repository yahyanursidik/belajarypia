import { useRef, useEffect, useState, useCallback } from "react";
import { useBeforeUnload } from "react-router-dom";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { supabase } from "../../lib/supabase";
import {
  learnerProfileDraft,
  learnerProfilePatch,
  learnerProfileValidation,
  learnerProfileLabels,
  learnerProfileValue,
  type LearnerProfileData,
  type LearnerProfileDraft,
} from "../../lib/learnerProfile";
import { learnerError } from "../../lib/learnerWorkspace";
export function LearnerProfileWizard({
  data,
  onClose,
  onSaved,
  onReload,
}: {
  data: LearnerProfileData;
  onClose: () => void;
  onSaved: (next: LearnerProfileData) => void;
  onReload: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(() => learnerProfileDraft(data)),
    [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [discard, setDiscard] = useState(false),
    request = useRef<AbortController | null>(null),
    patch = learnerProfilePatch(data, draft),
    dirty = Object.keys(patch).length > 0;
  useEffect(() => () => request.current?.abort(), []);
  useBeforeUnload(
    useCallback(
      (e: BeforeUnloadEvent) => {
        if (dirty || busy) {
          e.preventDefault();
          e.returnValue = "";
        }
      },
      [dirty, busy],
    ),
  );
  function edit(key: keyof LearnerProfileDraft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
  }
  function next() {
    const message = learnerProfileValidation(draft, step, !!data.participant);
    setError(message);
    if (!message) setStep((v) => v + 1);
  }
  async function save() {
    if (busy) return;
    const message = learnerProfileValidation(draft, 3, !!data.participant);
    if (message) {
      setError(message);
      return;
    }
    const c = new AbortController();
    request.current = c;
    setBusy(true);
    setError("");
    try {
      const r = await supabase
        .rpc("learner_profile_update", {
          p_revision: data.revision,
          p_changes: patch,
        })
        .abortSignal(c.signal);
      if (r.error) throw r.error;
      if (
        r.data?.account?.profile?.id !== data.account.profile.id ||
        !r.data.revision
      )
        throw new Error("Hasil simpan belum lengkap. Muat ulang profil.");
      if (!c.signal.aborted) onSaved(r.data);
    } catch (e) {
      if (!c.signal.aborted) setError(learnerError(e));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <Dialog
      title="Profil belajar"
      busy={busy}
      onClose={onClose}
      className="student-profile-wizard"
    >
      <ol className="student-wizard-steps" aria-label="Langkah profil">
        {["Identitas", "Kontak", "Tinjau"].map((label, i) => (
          <li aria-current={step === i + 1 ? "step" : undefined} key={label}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      <p className="student-wizard-account">
        {data.account.login.email}
        {data.participant
          ? " · " + data.participant.global_participant_number
          : ""}
      </p>
      {step === 1 ? (
        <div className="student-wizard-fields">
          <label>
            Nama lengkap
            <Input
              autoComplete="name"
              value={draft.full_name}
              maxLength={160}
              required
              onChange={(e) => edit("full_name", e.target.value)}
            />
          </label>
          {data.participant && (
            <label>
              Nama tampilan
              <Input
                value={draft.display_name}
                maxLength={160}
                required
                onChange={(e) => edit("display_name", e.target.value)}
              />
              <small>Nama yang terlihat dalam pembelajaran.</small>
            </label>
          )}
        </div>
      ) : step === 2 ? (
        <div className="student-wizard-fields">
          <label>
            Nomor telepon <small>Opsional</small>
            <Input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={draft.phone}
              maxLength={32}
              onChange={(e) => edit("phone", e.target.value)}
            />
          </label>
          {data.participant && (
            <>
              <label>
                Kota domisili <small>Opsional</small>
                <Input
                  autoComplete="address-level2"
                  value={draft.city}
                  maxLength={120}
                  onChange={(e) => edit("city", e.target.value)}
                />
              </label>
              <details>
                <summary>Data tambahan (opsional)</summary>
                <div className="student-wizard-fields">
                  <label>
                    Jenis kelamin
                    <select
                      value={draft.gender}
                      onChange={(e) => edit("gender", e.target.value)}
                    >
                      <option value="">Belum diisi</option>
                      <option value="male">Laki-laki</option>
                      <option value="female">Perempuan</option>
                      {draft.gender &&
                        !["male", "female"].includes(draft.gender) && (
                          <option value={draft.gender}>{draft.gender}</option>
                        )}
                    </select>
                  </label>
                  <label>
                    Tanggal lahir
                    <Input
                      type="date"
                      value={draft.birth_date}
                      onChange={(e) => edit("birth_date", e.target.value)}
                    />
                  </label>
                  <label>
                    Pendidikan
                    <Input
                      value={draft.education_level}
                      list="learner-education-options"
                      maxLength={80}
                      onChange={(e) => edit("education_level", e.target.value)}
                    />
                    <datalist id="learner-education-options">
                      {[
                        "SD",
                        "SMP",
                        "SMA",
                        "D3",
                        "D4",
                        "S1",
                        "S2",
                        "S3",
                        "Pesantren",
                      ].map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </label>
                </div>
              </details>
            </>
          )}
        </div>
      ) : (
        <div className="student-profile-review">
          {dirty ? (
            Object.entries(patch).map(([key, value]) => (
              <section key={key}>
                <h3>
                  {learnerProfileLabels[key as keyof LearnerProfileDraft]}
                </h3>
                <div>
                  <span>
                    <small>Sebelumnya</small>
                    {learnerProfileValue(
                      key,
                      learnerProfileDraft(data)[
                        key as keyof LearnerProfileDraft
                      ],
                    )}
                  </span>
                  <ArrowRight size={14} />
                  <span>
                    <small>Sesudahnya</small>
                    {value ? learnerProfileValue(key, value) : "Dikosongkan"}
                  </span>
                </div>
              </section>
            ))
          ) : (
            <p className="student-muted">Belum ada perubahan.</p>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className="student-error">
          <p>{error}</p>
          {step === 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiscard(true)}
            >
              Muat versi terbaru
            </Button>
          )}
        </div>
      )}
      <footer className="student-dialog-footer">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (step === 1) onClose();
            else {
              setStep((v) => v - 1);
              setError("");
            }
          }}
        >
          {step === 1 ? (
            "Batal"
          ) : (
            <>
              <ArrowLeft size={15} />
              Kembali
            </>
          )}
        </Button>
        {step < 3 ? (
          <Button onClick={next}>
            Lanjut
            <ArrowRight size={15} />
          </Button>
        ) : (
          <Button onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? (
              "Menyimpan…"
            ) : (
              <>
                <Save size={15} />
                Simpan profil
              </>
            )}
          </Button>
        )}
      </footer>
      {discard && (
        <Dialog
          title="Muat versi profil terbaru?"
          busy={busy}
          onClose={() => setDiscard(false)}
        >
          <p className="student-muted">
            Draf saat ini akan ditutup setelah data terbaru berhasil dimuat.
          </p>
          <footer className="student-dialog-footer">
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Lanjut mengedit
            </Button>
            <Button
              onClick={async () => {
                if (await onReload()) onClose();
                else setDiscard(false);
              }}
            >
              Muat data terbaru
            </Button>
          </footer>
        </Dialog>
      )}
    </Dialog>
  );
}
