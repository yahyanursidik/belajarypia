import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "../ui/dialog";
import { WizardSteps } from "../ui/wizard-steps";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { supabase } from "../../lib/supabase";
import {
  mvpFeatureFlagLabels,
  type MvpFeatureFlagKey,
  type Program,
  type ProgramStatus,
  type Unit,
} from "../../lib/organization";
import {
  normalizeProgramFlags,
  programModelLabel,
  programStatusLabels,
} from "../../lib/programWorkspace";
import type { StaffProfile } from "../../lib/academic";

// Offer switches that have an implemented consumer; preserve other stored flags.
const featureGroups: { title: string; keys: MvpFeatureFlagKey[] }[] = [
  {
    title: "Pendaftaran",
    keys: ["use_direct_enrollment", "use_custom_enrollment_number"],
  },
  { title: "Hasil belajar", keys: ["use_certificate"] },
];
export function ProgramFormDialog({
  program,
  onClose,
  onSaved,
}: {
  program?: Program | null;
  onClose: () => void;
  onSaved: (program: Program) => void;
}) {
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState<Unit[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [metadataError, setMetadataError] = useState("");
  const [form, setForm] = useState({
    unit_id: program?.unit_id ?? "",
    name: program?.name ?? "",
    code: program?.code ?? "",
    description: program?.description ?? "",
    program_type: program?.program_type ?? "general",
    curriculum_model: program?.curriculum_model ?? "mandiri",
    delivery_mode: program?.delivery_mode ?? "online",
    status: program?.status ?? ("draft" as ProgramStatus),
    teacher_user_id: program?.teacher_user_id ?? "",
    feature_flags: normalizeProgramFlags(program?.feature_flags),
  });
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      supabase
        .from("units")
        .select("id,name,code,status")
        .order("name")
        .abortSignal(controller.signal),
      supabase
        .from("profiles")
        .select("id,full_name,email,user_roles!inner(roles!inner(code))")
        .eq("status", "active")
        .in("user_roles.roles.code", [
          "teacher",
          "mentor",
          "admin",
          "super_admin",
        ])
        .order("full_name")
        .abortSignal(controller.signal),
    ]).then(([unitResult, staffResult]) => {
      if (controller.signal.aborted) return;
      if (unitResult.error || staffResult.error)
        setMetadataError(
          "Pilihan unit atau pengampu belum tersedia. Tutup dan coba lagi.",
        );
      const available = (unitResult.data ?? []) as Unit[];
      setUnits(
        available.filter(
          (unit) => unit.status === "active" || unit.id === program?.unit_id,
        ),
      );
      setStaff((staffResult.data ?? []) as StaffProfile[]);
      if (!program?.unit_id)
        setForm((current) => ({
          ...current,
          unit_id: available.find((unit) => unit.status === "active")?.id ?? "",
        }));
      setLoading(false);
    });
    return () => controller.abort();
  }, [program?.unit_id]);
  const field = (
    key:
      | "name"
      | "code"
      | "description"
      | "unit_id"
      | "curriculum_model"
      | "delivery_mode"
      | "teacher_user_id",
  ) => ({
    value: form[key],
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => setForm((current) => ({ ...current, [key]: event.target.value })),
  });
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (step === 0 && (!form.name.trim() || !form.code.trim())) {
      setError("Nama dan kode program wajib diisi.");
      return;
    }
    if (
      step === 2 &&
      form.feature_flags.payment_type === "spp" &&
      (!Number.isFinite(form.feature_flags.payment_amount) ||
        Number(form.feature_flags.payment_amount) <= 0)
    ) {
      setError("Isi nominal SPP lebih dari 0.");
      return;
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    if (!units.some((unit) => unit.id === form.unit_id)) {
      setError("Pilih unit program yang tersedia.");
      setStep(0);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        teacher_user_id: form.teacher_user_id || null,
        feature_flags: normalizeProgramFlags(form.feature_flags),
        status: program ? form.status : "draft",
      };
      const request = program
        ? supabase.from("programs").update(payload).eq("id", program.id)
        : supabase.from("programs").insert(payload);
      const { data, error } = await request
        .select("*,units(code,name)")
        .single();
      if (error) throw error;
      if (!data?.id)
        throw new Error("Server belum mengonfirmasi program tersimpan.");
      onSaved(data as Program);
    } catch (error) {
      setError(
        (error as { message?: string })?.message ??
          "Program belum tersimpan. Coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={program ? "Pengaturan program" : "Buat program"}
      busy={busy}
      onClose={onClose}
    >
      <WizardSteps
        steps={["Identitas", "Pembelajaran", "Fitur & biaya", "Tinjau"]}
        current={step}
      />
      {(error || metadataError) && (
        <p className="program-error" role="alert">
          {error || metadataError}
        </p>
      )}
      {loading ? (
        <p role="status">Memuat pilihan…</p>
      ) : (
        <form
          onSubmit={(event) => void save(event)}
          className="program-setup-form"
        >
          <fieldset
            hidden={step !== 0}
            disabled={step !== 0 || busy}
            className="program-form-grid"
          >
            <label className="program-form-wide">
              Unit
              <select className="field-control" required {...field("unit_id")}>
                <option value="">Pilih unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nama program
              <Input
                required
                autoFocus
                {...field("name")}
                placeholder="Contoh: Tahsin Dasar"
              />
            </label>
            <label>
              Kode
              <Input
                required
                {...field("code")}
                placeholder="THS-01"
                className="uppercase"
              />
            </label>
            <label className="program-form-wide">
              Deskripsi
              <textarea
                className="field-control min-h-24"
                {...field("description")}
                placeholder="Apa yang akan dipelajari peserta?"
              />
            </label>
          </fieldset>
          <fieldset
            hidden={step !== 1}
            disabled={step !== 1 || busy}
            className="program-form-grid"
          >
            <label>
              Model belajar
              <select className="field-control" {...field("curriculum_model")}>
                <option value="mandiri">Mandiri</option>
                <option value="angkatan">Terjadwal / angkatan</option>
              </select>
            </label>
            <label>
              Pertemuan
              <select className="field-control" {...field("delivery_mode")}>
                <option value="online">Daring</option>
                <option value="offline">Tatap muka</option>
                <option value="hybrid">Gabungan</option>
              </select>
            </label>
            <label className="program-form-wide">
              Pengampu
              <select className="field-control" {...field("teacher_user_id")}>
                <option value="">Tentukan nanti</option>
                {form.teacher_user_id &&
                  !staff.some(
                    (person) => person.id === form.teacher_user_id,
                  ) && (
                    <option value={form.teacher_user_id}>
                      Pengampu saat ini
                    </option>
                  )}
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name || person.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="program-form-wide program-choice-summary">
              {form.curriculum_model === "angkatan"
                ? "Angkatan → kelas → halaqah"
                : "Mata pelajaran → materi → evaluasi"}
            </div>
          </fieldset>
          <fieldset
            hidden={step !== 2}
            disabled={step !== 2 || busy}
            className="space-y-4"
          >
            <div className="program-form-grid">
              <label>
                Biaya
                <select
                  className="field-control"
                  value={form.feature_flags.payment_type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      feature_flags: normalizeProgramFlags({
                        ...current.feature_flags,
                        payment_type: event.target.value as "free" | "spp",
                      }),
                    }))
                  }
                >
                  <option value="free">Gratis</option>
                  <option value="spp">SPP</option>
                </select>
              </label>
              {form.feature_flags.payment_type === "spp" && (
                <label>
                  Nominal SPP (Rp)
                  <Input
                    required
                    type="number"
                    min={1}
                    value={form.feature_flags.payment_amount || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        feature_flags: {
                          ...current.feature_flags,
                          payment_amount: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </label>
              )}
            </div>
            {featureGroups.map((group) => (
              <section key={group.title}>
                <h3 className="text-sm font-semibold mb-2">{group.title}</h3>
                <div className="program-feature-options">
                  {group.keys.map((key) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={form.feature_flags[key]}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            feature_flags: {
                              ...current.feature_flags,
                              [key]: event.target.checked,
                            },
                          }))
                        }
                      />
                      {mvpFeatureFlagLabels[key]}
                    </label>
                  ))}
                </div>
              </section>
            ))}
            {program && (
              <label className="block space-y-2">
                Status
                <select
                  className="field-control"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as ProgramStatus,
                    }))
                  }
                >
                  <option value="draft">Draf</option>
                  <option value="active">Aktif</option>
                  <option value="archived">Diarsipkan</option>
                </select>
              </label>
            )}
          </fieldset>
          {step === 3 && (
            <section className="program-review">
              <h3>Periksa program</h3>
              <dl>
                {[
                  ["Nama", form.name],
                  ["Kode", form.code.trim().toUpperCase()],
                  [
                    "Unit",
                    units.find((unit) => unit.id === form.unit_id)?.name,
                  ],
                  ["Model", programModelLabel(form.curriculum_model)],
                  [
                    "Biaya",
                    form.feature_flags.payment_type === "spp"
                      ? `Rp ${Number(form.feature_flags.payment_amount).toLocaleString("id-ID")}`
                      : "Gratis",
                  ],
                  [
                    "Status",
                    program ? programStatusLabels[form.status] : "Draf",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {program && form.status !== program.status && (
                <p className="program-notice">
                  {form.status === "active"
                    ? "Program aktif dapat diakses peserta sesuai enrollment."
                    : "Program yang tidak aktif tidak dapat digunakan untuk belajar."}
                </p>
              )}
              {program &&
                form.curriculum_model !== program.curriculum_model && (
                  <p className="program-notice">
                    Model belajar berubah. Data kelas dan materi lama tetap
                    tersimpan.
                  </p>
                )}
            </section>
          )}
          <div className="wizard-footer">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => (step ? setStep(step - 1) : onClose())}
            >
              {step ? "Kembali" : "Batal"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {step + 1} dari 4
            </span>
            <Button type="submit" disabled={busy || Boolean(metadataError)}>
              {busy
                ? "Menyimpan…"
                : step < 3
                  ? "Lanjut"
                  : program
                    ? "Simpan perubahan"
                    : "Simpan draf"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
