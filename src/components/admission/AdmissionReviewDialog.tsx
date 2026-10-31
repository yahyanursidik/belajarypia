import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Download,
  FileText,
  Mail,
  MapPin,
  Phone,
  UserCheck,
} from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import {
  defaultRegistrationFields,
  applicantStatusLabels,
  formatRegistrationDateTime,
  type ApplicantAnswer,
} from "../../lib/admission";
import {
  admissionStatusTone,
  applicationStatus,
  admissionMutationError,
  confirmedAdmissionResult,
  type ApplicationRow,
} from "../../lib/admissionWorkspace";
import { supabase } from "../../lib/supabase";
import { AdmissionDecisionDialog } from "./AdmissionDecisionDialog";
type Answer = ApplicantAnswer & { label: string };
export function AdmissionReviewDialog({
  row,
  basePath,
  onClose,
  onSaved,
}: {
  row: ApplicationRow;
  basePath: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [decision, setDecision] = useState(false);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [downloadId, setDownloadId] = useState("");
  const status = applicationStatus(row);
  const [saved, setSaved] = useState<ReturnType<
    typeof confirmedAdmissionResult
  > | null>(null);
  const currentStatus = saved?.status === "accepted" ? "accepted" : status;
  const participantId = saved?.participant_id || row.participant_id;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setLoading(true);
    setAnswers([]);
    void (async () => {
      try {
        const [answerResult, fieldsResult] = await Promise.all([
          supabase
            .from("applicant_answers")
            .select("id,applicant_id,form_field_key,value_text,value_json")
            .eq("applicant_id", row.applicant_id)
            .order("created_at")
            .abortSignal(controller.signal),
          supabase
            .from("registration_form_fields")
            .select("field_key,label,registration_forms!inner(program_id)")
            .eq("registration_forms.program_id", row.program_id)
            .abortSignal(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        if (answerResult.error || fieldsResult.error)
          throw new Error("Jawaban belum dapat dimuat.");
        const labels = new Map(
          (fieldsResult.data ?? []).map((field) => [
            field.field_key,
            field.label,
          ]),
        );
        setAnswers(
          (answerResult.data ?? []).map((answer) => ({
            ...answer,
            label:
              labels.get(answer.form_field_key) ??
              defaultRegistrationFields.find(
                (field) => field.field_key === answer.form_field_key,
              )?.label ??
              (/^q_[a-f0-9]{32}$/.test(answer.form_field_key)
                ? "Pertanyaan arsip"
                : answer.form_field_key.replace(/[_-]/g, " ")),
          })),
        );
      } catch {
        if (!controller.signal.aborted)
          setError("Jawaban pendaftaran belum dapat dimuat. Coba lagi.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [row.applicant_id, row.program_id, reload]);
  async function saveNotes() {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.rpc("admin_review_application", {
        p_choice_id: row.id,
        p_status: status,
        p_notes: notes,
        p_expected_status: status,
        p_expected_updated_at: row.review_updated_at ?? null,
      });
      if (error) throw error;
      if (confirmedAdmissionResult(data).choice_id !== row.id)
        throw new Error("Server mengembalikan pendaftaran yang berbeda.");
      onSaved("Catatan internal tersimpan.");
    } catch (error) {
      setError(admissionMutationError(error));
    } finally {
      setBusy(false);
    }
  }
  async function download(answer: Answer) {
    if (!answer.value_text || downloadId) return;
    setDownloadId(answer.id);
    setError("");
    try {
      const { data, error } = await supabase.storage
        .from("admission_documents")
        .createSignedUrl(answer.value_text, 60, { download: true });
      if (error || !data?.signedUrl)
        throw new Error("Lampiran belum dapat diunduh.");
      const anchor = document.createElement("a");
      anchor.href = data.signedUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    } catch {
      setError("Lampiran belum dapat diunduh. Coba lagi.");
    } finally {
      setDownloadId("");
    }
  }
  return (
    <Dialog
      title="Detail pendaftaran"
      onClose={onClose}
      busy={busy}
      className="admission-detail-dialog"
    >
      <div className="admission-applicant-heading">
        <span className="admission-avatar">
          {row.applicants.full_name.trim().slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h3>{row.applicants.full_name}</h3>
          <span
            className={`admission-badge admission-tone-${admissionStatusTone[currentStatus]}`}
          >
            {applicantStatusLabels[currentStatus]}
          </span>
        </div>
      </div>
      <div className="admission-detail-meta">
        <p>
          <Mail size={15} />
          {row.applicants.email}
        </p>
        <p>
          <Phone size={15} />
          {row.applicants.phone || "WhatsApp belum diisi"}
        </p>
        <p>
          <MapPin size={15} />
          {row.applicants.city || "Kota belum diisi"}
        </p>
      </div>
      <section className="admission-context">
        <div>
          <span className="admission-eyebrow">Program yang ditinjau</span>
          <h4>{row.programs?.name ?? "Program tidak tersedia"}</h4>
          <p>
            {row.programs?.code} ·{" "}
            {formatRegistrationDateTime(
              row.applicants.submitted_at || row.created_at,
            )}
          </p>
          {row.preferred_schedule && (
            <p>Jadwal pilihan: {row.preferred_schedule}</p>
          )}
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to={`${basePath}/program/${row.program_id}/peserta`}>
            Buka program
            <ArrowRight size={14} />
          </Link>
        </Button>
      </section>
      {currentStatus === "accepted" && (
        <div className="admission-accepted">
          <UserCheck size={20} />
          <div>
            <strong>Pendaftaran diterima</strong>
            <p>Kelola penempatan dan progres melalui profil peserta.</p>
            {saved?.account_linked === false && (
              <p>Profil peserta belum terhubung ke akun login.</p>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link
                to={
                  participantId
                    ? `${basePath}/peserta/${participantId}?tab=academic`
                    : `${basePath}/peserta?q=${encodeURIComponent(row.applicants.email)}`
                }
              >
                Buka peserta
                <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
        </div>
      )}
      {error && (
        <div className="program-error" role="alert">
          {error}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReload((value) => value + 1)}
          >
            Muat ulang jawaban
          </Button>
        </div>
      )}
      <section className="space-y-3">
        <h4 className="admission-section-title">
          <FileText size={16} />
          Jawaban formulir
        </h4>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Memuat jawaban…
          </p>
        ) : !answers.length ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada jawaban tambahan.
          </p>
        ) : (
          answers.map((answer) => (
            <article key={answer.id} className="admission-answer">
              <h5>{answer.label}</h5>
              {answer.value_text?.startsWith("applicants/") ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!downloadId}
                  onClick={() => void download(answer)}
                >
                  <Download size={14} />
                  {downloadId === answer.id ? "Menyiapkan…" : "Unduh lampiran"}
                </Button>
              ) : (
                <p>
                  {answer.value_text ??
                    (answer.value_json !== null
                      ? typeof answer.value_json === "string"
                        ? answer.value_json
                        : JSON.stringify(answer.value_json)
                      : "Belum diisi")}
                </p>
              )}
            </article>
          ))
        )}
      </section>
      <section className="space-y-3">
        <label className="admission-section-title" htmlFor="admission-notes">
          Catatan internal
        </label>
        <textarea
          id="admission-notes"
          className="field-control min-h-24"
          maxLength={4000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Catatan pemeriksaan untuk pengelola…"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {notes.length}/4.000 · Tidak dikirim ke pendaftar
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || notes === (row.notes ?? "")}
            onClick={() => void saveNotes()}
          >
            {busy ? "Menyimpan…" : "Simpan catatan"}
          </Button>
        </div>
      </section>
      <div className="wizard-footer">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Tutup
        </Button>
        {currentStatus !== "accepted" && (
          <Button
            disabled={loading || !!error || !row.programs}
            onClick={() => setDecision(true)}
          >
            {status === "rejected"
              ? "Buka kembali review"
              : "Proses pendaftaran"}
            <ArrowRight size={15} />
          </Button>
        )}
      </div>
      {decision && (
        <AdmissionDecisionDialog
          row={row}
          initialNotes={notes}
          onClose={() => setDecision(false)}
          onSaved={(result, message, savedNotes) => {
            setSaved(result);
            setNotes(savedNotes);
            setDecision(false);
            onSaved(message);
          }}
        />
      )}
    </Dialog>
  );
}
