import { useRef, useState } from "react";
import { Input } from "../ui/input";
import { financeRpc, useFinanceRequestKey } from "../../lib/financeData";
import {
  financeDate,
  financeError,
  rupiah,
  validMoney,
  type DonorCommitment,
  type FinanceData,
} from "../../lib/financeWorkspace";
import { FinanceWizardFrame } from "./FinanceShared";
export function DonorCommitmentDialog({
  data,
  commitment,
  globalAccess,
  initialProgram,
  onClose,
  onSaved,
}: {
  data: FinanceData;
  commitment?: DonorCommitment;
  globalAccess: boolean;
  initialProgram: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const donor = data.donors.find((d) => d.id === commitment?.donor_id);
  const initial = {
    source: donor?.participant_id
      ? "participant"
      : donor
        ? "existing"
        : "external",
    donor_id: donor?.id ?? "",
    participant_id: donor?.participant_id ?? "",
    donor_name: "",
    donor_phone: "",
    donor_email: "",
    program_id:
      commitment?.program_id ??
      (initialProgram === "all" ? "" : initialProgram),
    channel_id: commitment?.channel_id ?? "",
    commitment_type: commitment?.commitment_type ?? "donation",
    amount: commitment ? String(commitment.amount) : "",
    frequency: commitment?.frequency ?? "monthly",
    reminder_day_of_month: String(
      commitment?.reminder_day_of_month ??
        Math.min(28, Number(financeDate().slice(-2))),
    ),
    next_reminder_at: commitment?.next_reminder_at ?? financeDate(),
    status: commitment?.status ?? "active",
    contact_preference: commitment?.contact_preference ?? "whatsapp",
    reminder_notes: commitment?.reminder_notes ?? "",
    wakaf_asset: commitment?.wakaf_asset ?? "",
    wakaf_asset_value:
      commitment?.wakaf_asset_value === null
        ? ""
        : String(commitment?.wakaf_asset_value ?? ""),
    wakaf_purpose: commitment?.wakaf_purpose ?? "",
    wakaf_external_url: commitment?.wakaf_external_url ?? "",
    wakaf_contact_admin: commitment?.wakaf_contact_admin ?? true,
  };
  const [form, setForm] = useState(initial);
  const baseline = useRef(JSON.stringify(initial));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useFinanceRequestKey();
  const selectedDonor = data.donors.find((d) => d.id === form.donor_id);
  const participant = data.participants.find(
    (p) => p.id === form.participant_id,
  );
  const donorName = commitment
    ? donor?.full_name
    : form.source === "participant"
      ? participant?.display_name
      : form.source === "existing"
        ? selectedDonor?.full_name
        : form.donor_name;
  const identityError = () =>
    !donorName?.trim()
      ? "Pilih atau isi nama donatur."
      : !globalAccess && !form.program_id
        ? "Pilih program sesuai cakupan Anda."
        : "";
  const validate = () =>
    identityError() ||
    (!validMoney(form.amount) &&
    !(
      form.commitment_type === "wakaf" &&
      form.wakaf_asset.trim() &&
      Number(form.amount) === 0
    )
      ? "Isi nominal komitmen yang benar."
      : "") ||
    (!Number.isInteger(Number(form.reminder_day_of_month)) ||
    Number(form.reminder_day_of_month) < 1 ||
    Number(form.reminder_day_of_month) > 28
      ? "Tanggal pengingat harus 1 sampai 28."
      : "");
  async function save() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      ...form,
      id: commitment?.id ?? null,
      expected_updated_at: commitment?.updated_at ?? null,
      program_id: form.program_id || null,
      channel_id: form.channel_id || null,
      donor_id: commitment
        ? commitment.donor_id
        : form.source === "existing"
          ? form.donor_id
          : null,
      participant_id:
        !commitment && form.source === "participant"
          ? form.participant_id
          : null,
      amount: Number(form.amount),
      reminder_day_of_month: Number(form.reminder_day_of_month),
      next_reminder_at: form.next_reminder_at || null,
      wakaf_asset_value: form.wakaf_asset_value
        ? Number(form.wakaf_asset_value)
        : null,
    };
    try {
      const result = await financeRpc<{ id: string }>(
        "finance_save_commitment",
        { p_payload: payload, p_request_key: requestKey(payload) },
      );
      if (!result.id) throw new Error("Komitmen belum terkonfirmasi.");
      onSaved();
    } catch (problem) {
      setError(financeError(problem));
    } finally {
      setBusy(false);
    }
  }
  return (
    <FinanceWizardFrame
      title={commitment ? "Edit komitmen donatur" : "Tambah donatur rutin"}
      steps={["Donatur", "Komitmen", "Tinjau"]}
      step={step}
      onClose={onClose}
      onBack={() => {
        setStep(step - 1);
        setError("");
      }}
      onNext={() => {
        const message = step === 0 ? identityError() : validate();
        if (message) setError(message);
        else {
          setError("");
          setStep(step + 1);
        }
      }}
      onSubmit={() => void save()}
      busy={busy}
      error={error}
      dirty={JSON.stringify(form) !== baseline.current}
      submitLabel="Simpan komitmen"
    >
      {step === 0 ? (
        <div className="space-y-4">
          {commitment ? (
            <p className="font-semibold">{donor?.full_name}</p>
          ) : (
            <>
              <label className="certificate-field">
                Sumber donatur
                <select
                  aria-label="Sumber donatur"
                  className="field-control"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                >
                  <option value="external">Donatur baru</option>
                  <option value="participant">Peserta LMS</option>
                  <option value="existing">Donatur tersimpan</option>
                </select>
              </label>
              {form.source === "participant" ? (
                <label className="certificate-field">
                  Peserta
                  <select
                    aria-label="Peserta donatur"
                    className="field-control"
                    value={form.participant_id}
                    onChange={(e) =>
                      setForm({ ...form, participant_id: e.target.value })
                    }
                  >
                    <option value="">Pilih peserta</option>
                    {data.participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} · {p.global_participant_number}
                      </option>
                    ))}
                  </select>
                </label>
              ) : form.source === "existing" ? (
                <label className="certificate-field">
                  Donatur
                  <select
                    aria-label="Donatur tersimpan"
                    className="field-control"
                    value={form.donor_id}
                    onChange={(e) =>
                      setForm({ ...form, donor_id: e.target.value })
                    }
                  >
                    <option value="">Pilih donatur</option>
                    {data.donors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} · {d.phone || d.email || "Tanpa kontak"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="certificate-field">
                    Nama donatur
                    <Input
                      value={form.donor_name}
                      maxLength={160}
                      onChange={(e) =>
                        setForm({ ...form, donor_name: e.target.value })
                      }
                    />
                  </label>
                  <label className="certificate-field">
                    Nomor telepon (opsional)
                    <Input
                      inputMode="tel"
                      value={form.donor_phone}
                      onChange={(e) =>
                        setForm({ ...form, donor_phone: e.target.value })
                      }
                    />
                  </label>
                  <label className="certificate-field">
                    Email (opsional)
                    <Input
                      type="email"
                      value={form.donor_email}
                      onChange={(e) =>
                        setForm({ ...form, donor_email: e.target.value })
                      }
                    />
                  </label>
                </>
              )}
            </>
          )}
          <label className="certificate-field">
            Program
            <select
              aria-label="Program komitmen"
              className="field-control"
              value={form.program_id}
              onChange={(e) =>
                setForm({ ...form, program_id: e.target.value, channel_id: "" })
              }
            >
              <option value="">
                {globalAccess ? "Donasi umum" : "Pilih program"}
              </option>
              {data.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : step === 1 ? (
        <div className="space-y-4">
          <div className="finance-form-grid">
            <label className="certificate-field">
              Jenis
              <select
                aria-label="Jenis komitmen"
                className="field-control"
                value={form.commitment_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    commitment_type: e.target
                      .value as DonorCommitment["commitment_type"],
                  })
                }
              >
                <option value="donation">Donasi</option>
                <option value="wakaf">Wakaf</option>
                <option value="education_infaq">Infaq pendidikan</option>
              </select>
            </label>
            <label className="certificate-field">
              Nominal (Rp)
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </label>
            <label className="certificate-field">
              Frekuensi
              <select
                className="field-control"
                value={form.frequency}
                onChange={(e) =>
                  setForm({
                    ...form,
                    frequency: e.target.value as DonorCommitment["frequency"],
                  })
                }
              >
                <option value="once">Sekali</option>
                <option value="monthly">Bulanan</option>
                <option value="quarterly">Tiga bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </label>
            <label className="certificate-field">
              Tanggal pengingat
              <Input
                aria-label="Tanggal pengingat"
                type="number"
                min="1"
                max="28"
                value={form.reminder_day_of_month}
                onChange={(e) =>
                  setForm({ ...form, reminder_day_of_month: e.target.value })
                }
              />
            </label>
            <label className="certificate-field">
              Tindak lanjut berikutnya
              <Input
                type="date"
                value={form.next_reminder_at}
                onChange={(e) =>
                  setForm({ ...form, next_reminder_at: e.target.value })
                }
              />
            </label>
            <label className="certificate-field">
              Status
              <select
                className="field-control"
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as DonorCommitment["status"],
                  })
                }
              >
                <option value="active">Aktif</option>
                <option value="paused">Dijeda</option>
                <option value="completed">Selesai</option>
              </select>
            </label>
          </div>
          <label className="certificate-field">
            Kanal pilihan (opsional)
            <select
              className="field-control"
              value={form.channel_id}
              onChange={(e) => setForm({ ...form, channel_id: e.target.value })}
            >
              <option value="">Belum ditentukan</option>
              {data.channels
                .filter(
                  (c) =>
                    c.is_active &&
                    (!c.program_id || c.program_id === form.program_id),
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="certificate-field">
            Catatan
            <textarea
              className="field-control min-h-24"
              value={form.reminder_notes}
              onChange={(e) =>
                setForm({ ...form, reminder_notes: e.target.value })
              }
            />
          </label>
          {form.commitment_type === "wakaf" && (
            <details className="program-disclosure">
              <summary>Detail wakaf</summary>
              <div className="p-4 space-y-3">
                <label className="certificate-field">
                  Aset wakaf (opsional)
                  <Input
                    value={form.wakaf_asset}
                    onChange={(e) =>
                      setForm({ ...form, wakaf_asset: e.target.value })
                    }
                  />
                </label>
                <label className="certificate-field">
                  Nilai aset (opsional)
                  <Input
                    type="number"
                    min="0"
                    value={form.wakaf_asset_value}
                    onChange={(e) =>
                      setForm({ ...form, wakaf_asset_value: e.target.value })
                    }
                  />
                </label>
                <label className="certificate-field">
                  Peruntukan
                  <Input
                    value={form.wakaf_purpose}
                    onChange={(e) =>
                      setForm({ ...form, wakaf_purpose: e.target.value })
                    }
                  />
                </label>
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="certificate-summary">
            <div>
              <dt>Donatur</dt>
              <dd>{donorName}</dd>
            </div>
            <div>
              <dt>Program</dt>
              <dd>
                {data.programs.find((p) => p.id === form.program_id)?.name ??
                  "Donasi umum"}
              </dd>
            </div>
            <div>
              <dt>Komitmen</dt>
              <dd>
                {rupiah(form.amount)} ·{" "}
                {form.frequency === "monthly"
                  ? "Bulanan"
                  : form.frequency === "quarterly"
                    ? "Tiga bulanan"
                    : form.frequency === "yearly"
                      ? "Tahunan"
                      : "Sekali"}
              </dd>
            </div>
            <div>
              <dt>Berikutnya</dt>
              <dd>{form.next_reminder_at || "Belum dijadwalkan"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {form.status === "active"
                  ? "Aktif"
                  : form.status === "paused"
                    ? "Dijeda"
                    : "Selesai"}
              </dd>
            </div>
          </dl>
          <p className="program-notice">
            Komitmen bukan penerimaan uang. Pembayaran dicatat dan diverifikasi
            terpisah.
          </p>
        </div>
      )}
    </FinanceWizardFrame>
  );
}
