import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, RotateCcw, XCircle } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { WizardSteps } from "../ui/wizard-steps";
import { Button } from "../ui/button";
import {
  applicantStatusLabels,
  type ApplicantStatus,
} from "../../lib/admission";
import {
  admissionMutationError,
  applicationStatus,
  confirmedAdmissionResult,
  type ApplicationRow,
} from "../../lib/admissionWorkspace";
import type { Batch, ClassGroup, Halaqah } from "../../lib/enrollment";
import { supabase } from "../../lib/supabase";
const actions = [
  {
    value: "under_review",
    label: "Mulai review",
    icon: Clock3,
    tone: "violet",
  },
  {
    value: "revision_requested",
    label: "Perlu revisi",
    icon: RotateCcw,
    tone: "amber",
  },
  {
    value: "accepted",
    label: "Terima & daftarkan",
    icon: CheckCircle2,
    tone: "emerald",
  },
  {
    value: "rejected",
    label: "Tolak pendaftaran",
    icon: XCircle,
    tone: "rose",
  },
] as const;
export function AdmissionDecisionDialog({
  row,
  initialNotes,
  onClose,
  onSaved,
}: {
  row: ApplicationRow;
  initialNotes: string;
  onClose: () => void;
  onSaved: (
    result: ReturnType<typeof confirmedAdmissionResult>,
    message: string,
    savedNotes: string,
  ) => void;
}) {
  const [step, setStep] = useState(0);
  const [action, setAction] = useState<ApplicantStatus>("under_review");
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [placementError, setPlacementError] = useState("");
  const [retry, setRetry] = useState(0);
  const [groups, setGroups] = useState<{
    batches: Batch[];
    classes: ClassGroup[];
    halaqahs: Halaqah[];
  }>({ batches: [], classes: [], halaqahs: [] });
  const [placement, setPlacement] = useState({
    batch: "",
    classId: "",
    halaqah: "",
  });
  const scheduled = row.programs?.curriculum_model === "angkatan";
  const accepting = action === "accepted";
  const withPlacement = accepting && scheduled;
  const steps = withPlacement
    ? ["Keputusan", "Penempatan", "Tinjau"]
    : ["Keputusan", "Tinjau"];
  useEffect(() => {
    if (!withPlacement) return;
    const controller = new AbortController();
    setLoading(true);
    setPlacementError("");
    void (async () => {
      try {
        const [batches, classes, halaqahs] = await Promise.all([
          supabase
            .from("batches")
            .select("id,program_id,code,name,status")
            .eq("program_id", row.program_id)
            .eq("status", "active")
            .order("name")
            .abortSignal(controller.signal),
          supabase
            .from("classes")
            .select("id,program_id,batch_id,code,name,status")
            .eq("program_id", row.program_id)
            .eq("status", "active")
            .order("name")
            .abortSignal(controller.signal),
          supabase
            .from("halaqahs")
            .select("id,class_id,code,name,status,classes!inner(program_id)")
            .eq("classes.program_id", row.program_id)
            .eq("status", "active")
            .order("name")
            .abortSignal(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        if (batches.error || classes.error || halaqahs.error) throw new Error();
        setGroups({
          batches: batches.data ?? [],
          classes: classes.data ?? [],
          halaqahs: halaqahs.data ?? [],
        });
      } catch {
        if (!controller.signal.aborted)
          setPlacementError("Pilihan kelas belum dapat dimuat. Coba lagi.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [withPlacement, row.program_id, retry]);
  const previous = applicationStatus(row);
  const canAccept =
    ["submitted", "under_review", "revision_requested"].includes(previous) &&
    row.programs?.status === "active";
  function next() {
    setError("");
    if (["revision_requested", "rejected"].includes(action) && !notes.trim()) {
      setError("Catatan keputusan wajib diisi.");
      return;
    }
    if (withPlacement && step === 1 && (loading || placementError)) return;
    setStep((value) => value + 1);
  }
  async function save() {
    setError("");
    setBusy(true);
    try {
      const common = {
        p_choice_id: row.id,
        p_notes: notes,
        p_expected_status: previous,
        p_expected_updated_at: row.review_updated_at ?? null,
      };
      const { data, error } = await (accepting
        ? supabase.rpc("admin_accept_application", {
            ...common,
            p_batch_id: placement.batch || null,
            p_class_id: placement.classId || null,
            p_halaqah_id: placement.halaqah || null,
          })
        : supabase.rpc("admin_review_application", {
            ...common,
            p_status: action,
          }));
      if (error) throw error;
      const result = confirmedAdmissionResult(data, accepting);
      if (result.choice_id !== row.id || result.status !== action)
        throw new Error("Server belum mengonfirmasi keputusan yang dipilih.");
      const linked = (data as { account_linked?: boolean }).account_linked;
      onSaved(
        result,
        accepting
          ? `Pendaftaran diterima. ${result.enrollment_action === "unchanged" ? "Enrollment lama dan penempatannya dipertahankan." : "Peserta terdaftar di program."}${linked === false ? " Profil peserta belum terhubung ke akun login." : ""}`
          : `Keputusan tersimpan: ${applicantStatusLabels[action]}.`,
        notes,
      );
    } catch (error) {
      setError(admissionMutationError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Proses pendaftaran"
      busy={busy}
      onClose={onClose}
      className="admission-decision-dialog"
    >
      <WizardSteps steps={steps} current={step} />
      <p className="admission-choice-summary">
        {row.applicants.full_name}
        <span>{row.programs?.name}</span>
      </p>
      {error && (
        <p className="program-error" role="alert">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="admission-wizard-content">
        {step === 0 && (
          <div className="space-y-4">
            <div
              className="admission-decision-options"
              role="radiogroup"
              aria-label="Keputusan pendaftaran"
            >
              {actions.map((item) => (
                <label
                  className={`admission-decision-option admission-tone-${item.tone}`}
                  key={item.value}
                >
                  <input
                    type="radio"
                    name="admission-decision"
                    checked={action === item.value}
                    disabled={
                      (previous === "rejected" &&
                        item.value !== "under_review") ||
                      (item.value === "accepted" && !canAccept)
                    }
                    onChange={() => setAction(item.value)}
                  />
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            {row.programs?.status !== "active" && (
              <p className="program-notice">
                Program belum aktif. Aktifkan program sebelum menerima peserta.
              </p>
            )}
            <label className="grid gap-2 text-sm font-medium">
              Catatan keputusan{" "}
              {["rejected", "revision_requested"].includes(action)
                ? "(wajib)"
                : "(opsional)"}
              <textarea
                className="field-control min-h-24"
                maxLength={4000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Catatan internal untuk pengelola…"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Perubahan status dapat dilihat melalui Cek Status. Catatan tetap
              internal.
            </p>
          </div>
        )}
        {withPlacement && step === 1 && (
          <div className="space-y-4">
            {loading ? (
              <p role="status">Memuat pilihan kelas…</p>
            ) : placementError ? (
              <div className="program-error" role="alert">
                {placementError}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  Coba lagi
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Penempatan opsional untuk enrollment baru.
                </p>
                <label className="grid gap-2 text-sm font-medium">
                  Angkatan
                  <select
                    className="field-control"
                    value={placement.batch}
                    onChange={(event) =>
                      setPlacement({
                        batch: event.target.value,
                        classId: "",
                        halaqah: "",
                      })
                    }
                  >
                    <option value="">Tentukan nanti</option>
                    {groups.batches.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Kelas
                  <select
                    className="field-control"
                    value={placement.classId}
                    onChange={(event) =>
                      setPlacement((current) => ({
                        ...current,
                        classId: event.target.value,
                        halaqah: "",
                      }))
                    }
                  >
                    <option value="">Tentukan nanti</option>
                    {groups.classes
                      .filter(
                        (group) => (group.batch_id ?? "") === placement.batch,
                      )
                      .map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Halaqah
                  <select
                    className="field-control"
                    disabled={!placement.classId}
                    value={placement.halaqah}
                    onChange={(event) =>
                      setPlacement((current) => ({
                        ...current,
                        halaqah: event.target.value,
                      }))
                    }
                  >
                    <option value="">Tanpa halaqah</option>
                    {groups.halaqahs
                      .filter((group) => group.class_id === placement.classId)
                      .map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
          </div>
        )}
        {step === steps.length - 1 && (
          <section className="program-review">
            <h3>Tinjau keputusan</h3>
            <dl>
              <div>
                <dt>Keputusan</dt>
                <dd>{applicantStatusLabels[action]}</dd>
              </div>
              {withPlacement && (
                <>
                  <div>
                    <dt>Angkatan</dt>
                    <dd>
                      {groups.batches.find(
                        (group) => group.id === placement.batch,
                      )?.name ?? "Tentukan nanti"}
                    </dd>
                  </div>
                  <div>
                    <dt>Kelas</dt>
                    <dd>
                      {groups.classes.find(
                        (group) => group.id === placement.classId,
                      )?.name ?? "Tentukan nanti"}
                    </dd>
                  </div>
                  <div>
                    <dt>Halaqah</dt>
                    <dd>
                      {groups.halaqahs.find(
                        (group) => group.id === placement.halaqah,
                      )?.name ?? "Tanpa halaqah"}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt>Catatan internal</dt>
                <dd>{notes || "Tanpa catatan"}</dd>
              </div>
            </dl>
            {accepting && (
              <p className="program-notice mt-3">
                Enrollment yang sudah ada tetap mempertahankan status, kelas,
                dan progresnya.
              </p>
            )}
          </section>
        )}
        <div className="wizard-footer">
          <Button
            variant="outline"
            onClick={() => (step ? setStep((value) => value - 1) : onClose())}
          >
            {step ? "Kembali" : "Batal"}
          </Button>
          <Button
            disabled={
              withPlacement && step === 1 && (loading || !!placementError)
            }
            onClick={() => (step === steps.length - 1 ? void save() : next())}
          >
            {busy
              ? "Menyimpan…"
              : step === steps.length - 1
                ? "Simpan keputusan"
                : "Lanjut"}
          </Button>
        </div>
      </fieldset>
    </Dialog>
  );
}
