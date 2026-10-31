import { useState } from "react";
import { Dialog } from "../ui/dialog";
import { WizardSteps } from "../ui/wizard-steps";
import { Button } from "../ui/button";
import { supabase } from "../../lib/supabase";
import {
  contentDecisionError,
  contentError,
  contentStatuses,
  contentTime,
  type ContentDetail,
  type ContentStatus,
} from "../../lib/contentReviewWorkspace";
export function ContentDecisionDialog({
  data,
  onClose,
  onSaved,
  onReload,
}: {
  data: ContentDetail;
  onClose: () => void;
  onSaved: (next: ContentDetail) => void;
  onReload: () => void;
}) {
  const [status, setStatus] = useState<ContentStatus>(
    data.lesson.visibility_status === "archived" ||
      data.lesson.visibility_status === "published"
      ? "draft"
      : "published",
  );
  const [notes, setNotes] = useState(""),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const valid = () =>
    contentDecisionError(
      status,
      notes,
      data.lesson.visibility_status,
      data.checks.ready,
    );
  const choices: ContentStatus[] =
    data.lesson.visibility_status === "archived"
      ? ["draft"]
      : ["published", "draft", "locked", "archived"];
  async function save() {
    const problem = valid();
    if (problem) {
      setError(problem);
      setStep(0);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("system_content_review_decide", {
        p_lesson: data.lesson.id,
        p_revision: data.revision,
        p_status: status,
        p_notes: notes.trim() || null,
      });
      if (r.error) throw r.error;
      if (r.data?.lesson?.id !== data.lesson.id || !r.data?.revision)
        throw new Error("Keputusan belum terkonfirmasi. Muat ulang materi.");
      onSaved(r.data as ContentDetail);
    } catch (e) {
      setError(contentError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Keputusan konten"
      onClose={onClose}
      busy={busy}
      className="content-decision-dialog"
    >
      <WizardSteps steps={["Pilih keputusan", "Konfirmasi"]} current={step} />
      <div className="content-decision-title">
        <strong>{data.lesson.title}</strong>
        <small>
          {data.context.program_name} · {data.context.module_title}
        </small>
      </div>
      {step === 0 ? (
        <>
          <label className="content-form-field">
            Status tujuan
            <select
              className="field-control"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ContentStatus);
                setError("");
              }}
            >
              {choices
                .filter((s) => s !== data.lesson.visibility_status)
                .map((s) => (
                  <option
                    key={s}
                    value={s}
                    disabled={s === "published" && !data.checks.ready}
                  >
                    {contentStatuses[s]}
                  </option>
                ))}
            </select>
          </label>
          {!data.checks.ready && (
            <p className="content-warning">
              Penerbitan menunggu {data.checks.issues.length} perbaikan.
            </p>
          )}
          <label className="content-form-field">
            Catatan {status === "published" ? "(opsional)" : "(wajib)"}
            <textarea
              className="field-control"
              rows={3}
              maxLength={1500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan singkat untuk pengelola materi"
            />
          </label>
        </>
      ) : (
        <div className="content-decision-confirm">
          <div>
            <span>{contentStatuses[data.lesson.visibility_status]}</span>
            <b>→</b>
            <strong>{contentStatuses[status]}</strong>
          </div>
          <p>
            {status === "published"
              ? data.lesson.release_at &&
                new Date(data.lesson.release_at) > new Date()
                ? `Tersedia mulai ${contentTime(data.lesson.release_at)}.`
                : "Materi dapat dibuka peserta dengan akses program yang sesuai."
              : "Materi tidak dapat dibuka peserta pada status ini."}
          </p>
          {["content", "quiz", "exam"].includes(data.lesson.lesson_type) && (
            <p>Pengumuman materi mengikuti status dan jadwal rilis.</p>
          )}
          {notes && <blockquote>{notes}</blockquote>}
          <small>Progres dan hasil belajar tersimpan.</small>
        </div>
      )}
      {error && (
        <div>
          <p role="alert" className="program-error">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onReload}
          >
            Muat ulang materi
          </Button>
        </div>
      )}
      <footer className="workspace-dialog__footer">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => (step === 0 ? onClose() : setStep(0))}
        >
          {step === 0 ? "Batal" : "Kembali"}
        </Button>
        {step === 0 ? (
          <Button
            onClick={() => {
              const problem = valid();
              setError(problem);
              if (!problem) setStep(1);
            }}
          >
            Lanjut
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void save()}>
            {busy
              ? "Menyimpan…"
              : status === "published"
                ? "Terbitkan materi"
                : "Simpan keputusan"}
          </Button>
        )}
      </footer>
    </Dialog>
  );
}
