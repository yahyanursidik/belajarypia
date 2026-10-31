import { useState } from "react";
import { Button } from "../ui/button";
import { WizardSteps } from "../ui/wizard-steps";
import { assignmentRpc } from "../../lib/assignmentData";
import {
  type AssignmentDetail,
  assignmentError,
  type AssignmentList,
  responseLabels,
} from "../../lib/assignments";
const localDate = (v: string | null | undefined) =>
  v
    ? new Date(new Date(v).getTime() + 7 * 3600000).toISOString().slice(0, 16)
    : "";
export function AssignmentConfigForm(
  { modules, initial, onSaved, onCancel }: {
    modules: AssignmentList["modules"];
    initial?: AssignmentDetail;
    onSaved: (id: string) => void;
    onCancel: () => void;
  },
) {
  const [module, setModule] = useState(
      initial?.lesson.module_id ?? modules[0]?.id ?? "",
    ),
    [title, setTitle] = useState(initial?.lesson.title ?? ""),
    [instructions, setInstructions] = useState(
      initial?.config?.instructions ?? "",
    ),
    [kind, setKind] = useState(initial?.config?.response_kind ?? "text"),
    [checks, setChecks] = useState(initial?.config?.checklist.join("\n") ?? ""),
    [late, setLate] = useState(initial?.config?.allow_late ?? false),
    [release, setRelease] = useState(localDate(initial?.lesson.release_at)),
    [due, setDue] = useState(localDate(initial?.lesson.due_at)),
    [publish, setPublish] = useState(
      initial?.lesson.visibility_status === "published",
    ),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const checklist = kind === "checklist"
    ? checks.split("\n").map((x) => x.trim()).filter(Boolean)
    : [];
  const validate = () => {
    if (!module || !title.trim() || !instructions.trim()) {
      throw new Error("Pilih mata pelajaran, judul, dan instruksi.");
    }
    if (
      kind === "checklist" &&
      (!checklist.length || checklist.length > 30 ||
        new Set(checklist).size !== checklist.length)
    ) throw new Error("Isi 1–30 butir checklist yang berbeda.");
    if (release && due && due < release) {
      throw new Error("Tenggat harus setelah waktu rilis.");
    }
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      validate();
      const id = await assignmentRpc<string>("assignment_configure", {
        p_lesson: initial?.lesson.id ?? null,
        p_module: module,
        p_revision: initial?.config?.revision ?? null,
        p_title: title,
        p_publish: publish,
        p_config: {
          instructions,
          response_kind: kind,
          checklist,
          allow_late: late,
          release_at: release ? release + ":00+07:00" : null,
          due_at: due ? due + ":00+07:00" : null,
        },
      });
      onSaved(id);
    } catch (e) {
      setError(assignmentError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="assignment-panel">
      <h2>{initial ? "Atur tugas" : "Buat tugas"}</h2>
      <WizardSteps steps={["Instruksi & aturan", "Tinjau"]} current={step} />
      {error && <p role="alert" className="assignment-error">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 0) {
            try {
              validate();
              setError("");
              setStep(1);
            } catch (e) {
              setError(assignmentError(e));
            }
          } else void save();
        }}
      >
        <fieldset disabled={busy} className="assignment-form">
          {step === 0
            ? (
              <>
                <label>
                  Mata pelajaran<select
                    value={module}
                    disabled={!!initial}
                    onChange={(e) => setModule(e.target.value)}
                    required
                  >
                    <option value="">Pilih mata pelajaran</option>
                    {modules.map((m) => (
                      <option value={m.id} key={m.id}>{m.title}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Judul<input
                    required
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Instruksi<textarea
                    required
                    rows={5}
                    maxLength={20000}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </label>
                <label>
                  Jawaban wajib<select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    {Object.entries(responseLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
                {kind === "checklist" && (
                  <label>
                    Butir checklist · satu per baris<textarea
                      rows={5}
                      value={checks}
                      onChange={(e) => setChecks(e.target.value)}
                    />
                  </label>
                )}
                <div className="assignment-columns">
                  <label>
                    Rilis (WIB)<input
                      type="datetime-local"
                      value={release}
                      onChange={(e) => setRelease(e.target.value)}
                    />
                  </label>
                  <label>
                    Tenggat (WIB)<input
                      type="datetime-local"
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </label>
                </div>
                <label className="assignment-check">
                  <input
                    type="checkbox"
                    checked={late}
                    onChange={(e) => setLate(e.target.checked)}
                  />Izinkan pengumpulan pertama setelah tenggat
                </label>
                <label className="assignment-check">
                  <input
                    type="checkbox"
                    checked={publish}
                    onChange={(e) => setPublish(e.target.checked)}
                  />Terbitkan untuk peserta
                </label>
              </>
            )
            : (
              <div className="assignment-preview">
                <h3>{title}</h3>
                <p>
                  {responseLabels[kind]} ·{" "}
                  {publish ? "Diterbitkan" : "Disimpan sebagai draf"}
                </p>
                <p className="whitespace-pre-wrap">{instructions}</p>
                {checklist.map((c) => <p key={c}>□ {c}</p>)}
                <p>
                  Tenggat:{" "}
                  {due ? due.replace("T", " ") + " WIB" : "Tidak dibatasi"}
                </p>
                <p>
                  Pengaturan terkunci setelah peserta mulai. Revisi yang diminta
                  penilai tetap dapat dikirim setelah tenggat.
                </p>
              </div>
            )}
          <div className="assignment-actions">
            <Button type="button" variant="outline" onClick={onCancel}>
              Batal
            </Button>
            {step === 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(0)}
              >
                Kembali
              </Button>
            )}
            <Button type="submit">
              {busy
                ? "Menyimpan…"
                : step === 0
                ? "Tinjau tugas"
                : "Simpan tugas"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
