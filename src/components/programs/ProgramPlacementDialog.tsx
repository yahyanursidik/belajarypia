import { useEffect, useState } from "react";
import { ProgramDialog } from "./ProgramDialog";
import { WizardSteps } from "../ui/wizard-steps";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import type {
  AcademicBatch,
  AcademicClass,
  AcademicHalaqah,
} from "../../lib/academic";
import { supabase } from "../../lib/supabase";

type EnrollmentOption = {
  id: string;
  batch_id: string | null;
  class_id: string | null;
  halaqah_id: string | null;
  participants: {
    display_name: string;
    global_participant_number: string;
    status: string;
  };
};
export function ProgramPlacementDialog({
  programId,
  batches,
  classes,
  halaqahs,
  enrollmentId,
  initialClassId,
  onClose,
  onSaved,
}: {
  programId: string;
  batches: AcademicBatch[];
  classes: AcademicClass[];
  halaqahs: AcademicHalaqah[];
  enrollmentId?: string;
  initialClassId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<EnrollmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("");
  const [classId, setClassId] = useState("");
  const [halaqah, setHalaqah] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void supabase
      .from("enrollments")
      .select(
        "id,batch_id,class_id,halaqah_id,participants!inner(display_name,global_participant_number,status)",
      )
      .eq("program_id", programId)
      .in("enrollment_status", ["active", "pending", "hold"])
      .eq("participants.status", "active")
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        if (error) setError("Daftar peserta belum dapat dimuat.");
        else {
          const options = (data ?? []) as unknown as EnrollmentOption[];
          setRows(options);
          const current = options.find((row) => row.id === enrollmentId);
          if (current) {
            setSelected(current.id);
            setBatch(current.batch_id ?? "");
            setClassId(current.class_id ?? "");
            setHalaqah(current.halaqah_id ?? "");
            setStep(1);
          }
        }
        setLoading(false);
      });
    return () => controller.abort();
  }, [programId, enrollmentId]);
  const participant = rows.find((row) => row.id === selected);
  const available = rows.filter((row) =>
    [row.participants.display_name, row.participants.global_participant_number]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const batchOptions = batches.filter((row) => row.status === "active");
  const classOptions = classes.filter(
    (row) => row.status === "active" && (row.batch_id ?? "") === batch,
  );
  const halaqahOptions = halaqahs.filter(
    (row) => row.status === "active" && row.class_id === classId,
  );
  function choose(id: string) {
    setSelected(id);
    const row = rows.find((row) => row.id === id);
    const preferred = classes.find((group) => group.id === initialClassId);
    setBatch(preferred?.batch_id ?? row?.batch_id ?? "");
    setClassId(preferred?.id ?? row?.class_id ?? "");
    setHalaqah(preferred ? "" : (row?.halaqah_id ?? ""));
  }
  async function save() {
    if (!participant || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.rpc(
        "admin_update_enrollment_placement",
        {
          target_enrollment_id: selected,
          target_batch_id: batch || null,
          target_class_id: classId || null,
          target_halaqah_id: halaqah || null,
        },
      );
      if (error) throw error;
      if (!data?.enrollment_id)
        throw new Error("Server belum mengonfirmasi penempatan.");
      onSaved();
    } catch (error) {
      const problem = error as { code?: string; message?: string };
      setError(
        problem.code === "PGRST202"
          ? "Fitur penempatan belum diterapkan di server."
          : (problem.message ?? "Penempatan belum tersimpan."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProgramDialog
      title="Penempatan peserta"
      busy={busy}
      error={error}
      onClose={onClose}
    >
      <WizardSteps steps={["Peserta", "Kelas", "Tinjau"]} current={step} />
      {loading ? (
        <p role="status">Memuat peserta…</p>
      ) : (
        <div className="space-y-5">
          {step === 0 && (
            <div className="space-y-3">
              <Input
                aria-label="Cari peserta untuk penempatan"
                placeholder="Cari nama atau nomor induk…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <label className="block space-y-2">
                Peserta terdaftar
                <select
                  className="field-control"
                  size={Math.min(6, Math.max(2, available.length + 1))}
                  value={selected}
                  onChange={(event) => choose(event.target.value)}
                >
                  <option value="">Pilih peserta</option>
                  {available.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.participants.display_name} ·{" "}
                      {row.participants.global_participant_number}
                    </option>
                  ))}
                </select>
              </label>
              {!rows.length && (
                <p>Belum ada enrollment berjalan yang dapat ditempatkan.</p>
              )}
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <p className="program-choice-summary">
                {participant?.participants.display_name}
              </p>
              <label className="block space-y-2">
                Angkatan
                <select
                  className="field-control"
                  value={batch}
                  onChange={(event) => {
                    setBatch(event.target.value);
                    setClassId("");
                    setHalaqah("");
                  }}
                >
                  <option value="">Tanpa angkatan</option>
                  {batch && !batchOptions.some((row) => row.id === batch) && (
                    <option value={batch} disabled>
                      Angkatan saat ini tidak aktif — pilih kembali
                    </option>
                  )}
                  {batchOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                Kelas
                <select
                  className="field-control"
                  value={classId}
                  onChange={(event) => {
                    setClassId(event.target.value);
                    setHalaqah("");
                  }}
                >
                  <option value="">Belum ditempatkan</option>
                  {classId &&
                    !classOptions.some((row) => row.id === classId) && (
                      <option value={classId} disabled>
                        Kelas saat ini tidak aktif — pilih kembali
                      </option>
                    )}
                  {classOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                      {row.capacity ? ` · kapasitas ${row.capacity}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                Halaqah
                <select
                  className="field-control"
                  value={halaqah}
                  disabled={!classId}
                  onChange={(event) => setHalaqah(event.target.value)}
                >
                  <option value="">Tanpa halaqah</option>
                  {halaqah &&
                    !halaqahOptions.some((row) => row.id === halaqah) && (
                      <option value={halaqah} disabled>
                        Halaqah saat ini tidak aktif — pilih kembali
                      </option>
                    )}
                  {halaqahOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {step === 2 && (
            <section className="program-review">
              <h3>{participant?.participants.display_name}</h3>
              <dl>
                {[
                  [
                    "Angkatan",
                    batches.find((row) => row.id === batch)?.name ??
                      "Tanpa angkatan",
                  ],
                  [
                    "Kelas",
                    classes.find((row) => row.id === classId)?.name ??
                      "Belum ditempatkan",
                  ],
                  [
                    "Halaqah",
                    halaqahs.find((row) => row.id === halaqah)?.name ??
                      "Tanpa halaqah",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground mt-4">
                Status enrollment dan progres belajar tetap dipertahankan.
              </p>
            </section>
          )}
          <div className="wizard-footer">
            <Button
              variant="outline"
              onClick={() => (step ? setStep(step - 1) : onClose())}
            >
              {step ? "Kembali" : "Batal"}
            </Button>
            <Button
              disabled={
                !selected ||
                (step > 0 &&
                  ((!!batch && !batchOptions.some((row) => row.id === batch)) ||
                    (!!classId &&
                      !classOptions.some((row) => row.id === classId)) ||
                    (!!halaqah &&
                      !halaqahOptions.some((row) => row.id === halaqah))))
              }
              onClick={() => (step < 2 ? setStep(step + 1) : void save())}
            >
              {busy ? "Menyimpan…" : step < 2 ? "Lanjut" : "Simpan penempatan"}
            </Button>
          </div>
        </div>
      )}
    </ProgramDialog>
  );
}
