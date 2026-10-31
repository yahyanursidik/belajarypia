import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import {
  financeRpc,
  uploadFinanceDocument,
  useFinanceRequestKey,
} from "../../lib/financeData";
import {
  financeError,
  validateFinanceFile,
  type FinanceData,
  type PaymentChannel,
} from "../../lib/financeWorkspace";
import { FinanceWizardFrame } from "./FinanceShared";
export function PaymentChannelDialog({
  data,
  channel,
  globalAccess,
  initialProgram,
  onClose,
  onSaved,
}: {
  data: FinanceData;
  channel?: PaymentChannel;
  globalAccess: boolean;
  initialProgram: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = {
    name: channel?.name ?? "",
    channel_type: channel?.channel_type ?? "bank",
    program_id:
      channel?.program_id ??
      (globalAccess ? "" : initialProgram === "all" ? "" : initialProgram),
    purpose: channel?.purpose ?? "both",
    bank_name: channel?.bank_name ?? "",
    account_number: channel?.account_number ?? "",
    account_holder: channel?.account_holder ?? "",
    instructions: channel?.instructions ?? "",
    is_active: channel?.is_active ?? false,
    asset_account_id:
      channel?.asset_account_id ??
      data.accounts.find((a) => a.code === "1010")?.id ??
      "",
  };
  const [form, setForm] = useState(initial);
  const baseline = useRef(JSON.stringify(initial));
  const [file, setFile] = useState<File | null>(null);
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  const [preview, setPreview] = useState("");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useFinanceRequestKey();
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const value = URL.createObjectURL(file);
    setPreview(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  const validate = () =>
    !form.name.trim() || (!globalAccess && !form.program_id)
      ? "Isi nama kanal dan pilih program."
      : form.is_active &&
          form.channel_type === "bank" &&
          (!form.bank_name.trim() ||
            !form.account_holder.trim() ||
            !/^(?!0+$)\d{6,30}$/.test(
              form.account_number.replace(/[\s-]/g, ""),
            ))
        ? "Lengkapi bank, nomor rekening yang benar, dan atas nama."
        : form.is_active &&
            form.channel_type === "qris" &&
            (!form.account_holder.trim() ||
              (!file && !channel?.qr_document_id && !channel?.qris_image_url))
          ? "Isi atas nama dan unggah QR Code resmi."
          : file
            ? validateFinanceFile(file, "qr")
            : "";
  async function save() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      let documentId = channel?.qr_document_id ?? null;
      if (form.channel_type === "qris" && file) {
        if (uploaded.current?.file !== file)
          uploaded.current = {
            file,
            id: await uploadFinanceDocument(file, "qr"),
          };
        documentId = uploaded.current.id;
      }
      const payload = {
        ...form,
        id: channel?.id ?? null,
        expected_updated_at: channel?.updated_at ?? null,
        program_id: form.program_id || null,
        qr_document_id: form.channel_type === "qris" ? documentId : null,
        qris_image_url: channel?.qris_image_url ?? null,
        external_url: channel?.external_url ?? null,
      };
      const result = await financeRpc<{ id: string }>("finance_save_channel", {
        p_payload: payload,
        p_request_key: requestKey(payload),
      });
      if (!result.id) throw new Error("Kanal belum terkonfirmasi. Coba lagi.");
      onSaved();
    } catch (problem) {
      setError(financeError(problem));
    } finally {
      setBusy(false);
    }
  }
  return (
    <FinanceWizardFrame
      title={channel ? "Edit rekening / QR" : "Tambah rekening / QR"}
      steps={["Tujuan", "Data penerimaan", "Tinjau"]}
      step={step}
      onClose={onClose}
      onBack={() => {
        setStep(step - 1);
        setError("");
      }}
      onNext={() => {
        const message =
          step === 0
            ? !form.name.trim() || (!globalAccess && !form.program_id)
              ? "Isi nama kanal dan pilih program."
              : ""
            : file
              ? validateFinanceFile(file, "qr")
              : "";
        if (message) setError(message);
        else {
          setError("");
          setStep(step + 1);
        }
      }}
      onSubmit={() => void save()}
      busy={busy}
      error={error}
      dirty={!!file || JSON.stringify(form) !== baseline.current}
      submitLabel="Simpan kanal"
    >
      {step === 0 ? (
        <div className="space-y-4">
          <label className="certificate-field">
            Nama kanal
            <Input
              value={form.name}
              maxLength={160}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Rekening biaya kelas"
            />
          </label>
          <label className="certificate-field">
            Jenis
            <select
              aria-label="Jenis kanal pembayaran"
              className="field-control"
              value={form.channel_type}
              onChange={(e) => {
                setForm({
                  ...form,
                  channel_type: e.target
                    .value as PaymentChannel["channel_type"],
                });
                setFile(null);
              }}
            >
              <option value="bank">Rekening bank</option>
              <option value="qris">QR Code</option>
              {channel?.channel_type === "cash" && (
                <option value="cash">Tunai</option>
              )}
              {channel?.channel_type === "external" && (
                <option value="external">Tautan lama</option>
              )}
            </select>
          </label>
          <label className="certificate-field">
            Digunakan untuk
            <select
              aria-label="Tujuan kanal"
              className="field-control"
              value={form.purpose}
              onChange={(e) =>
                setForm({
                  ...form,
                  purpose: e.target.value as "class" | "donation" | "both",
                })
              }
            >
              <option value="both">Biaya kelas & donasi</option>
              <option value="class">Biaya kelas</option>
              <option value="donation">Donasi</option>
            </select>
          </label>
          <label className="certificate-field">
            Program
            <select
              aria-label="Program kanal pembayaran"
              className="field-control"
              value={form.program_id}
              onChange={(e) => setForm({ ...form, program_id: e.target.value })}
            >
              <option value="">
                {globalAccess ? "Semua program" : "Pilih program"}
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
          {form.channel_type === "bank" && (
            <>
              <label className="certificate-field">
                Nama bank
                <Input
                  value={form.bank_name}
                  onChange={(e) =>
                    setForm({ ...form, bank_name: e.target.value })
                  }
                />
              </label>
              <label className="certificate-field">
                Nomor rekening
                <Input
                  inputMode="numeric"
                  value={form.account_number}
                  onChange={(e) =>
                    setForm({ ...form, account_number: e.target.value })
                  }
                />
              </label>
            </>
          )}
          <label className="certificate-field">
            Atas nama / nama penerima
            <Input
              value={form.account_holder}
              onChange={(e) =>
                setForm({ ...form, account_holder: e.target.value })
              }
            />
          </label>
          {form.channel_type === "qris" && (
            <label className="certificate-field">
              Gambar QR Code
              <input
                aria-label="Gambar QR Code"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  if (next) {
                    const problem = validateFinanceFile(next, "qr");
                    if (problem) {
                      setError(problem);
                      setFile(null);
                      e.currentTarget.value = "";
                      return;
                    }
                  }
                  setError("");
                  setFile(next);
                }}
              />
              {preview && (
                <img
                  className="finance-qr-image"
                  src={preview}
                  alt="Pratinjau QR yang dipilih"
                />
              )}
              {!file && channel?.qr_document_id && (
                <span className="text-xs text-muted-foreground">
                  QR tersimpan tetap digunakan.
                </span>
              )}
            </label>
          )}
          <label className="certificate-field">
            Petunjuk pembayaran (opsional)
            <textarea
              className="field-control min-h-24"
              value={form.instructions}
              onChange={(e) =>
                setForm({ ...form, instructions: e.target.value })
              }
            />
          </label>
          <label className="certificate-field">
            Akun kas / bank
            <select
              aria-label="Akun kas kanal"
              className="field-control"
              value={form.asset_account_id}
              onChange={(e) =>
                setForm({ ...form, asset_account_id: e.target.value })
              }
            >
              {data.accounts
                .filter((a) => a.is_active && a.account_type === "asset")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="certificate-summary">
            <div>
              <dt>Kanal</dt>
              <dd>{form.name}</dd>
            </div>
            <div>
              <dt>Penerima</dt>
              <dd>{form.account_holder}</dd>
            </div>
            {form.channel_type === "bank" && (
              <div>
                <dt>Rekening</dt>
                <dd>
                  {form.bank_name} · <strong>{form.account_number}</strong>
                </dd>
              </div>
            )}
            <div>
              <dt>Program</dt>
              <dd>
                {data.programs.find((p) => p.id === form.program_id)?.name ??
                  "Semua program"}
              </dd>
            </div>
            <div>
              <dt>Tujuan</dt>
              <dd>
                {form.purpose === "both"
                  ? "Biaya kelas & donasi"
                  : form.purpose === "class"
                    ? "Biaya kelas"
                    : "Donasi"}
              </dd>
            </div>
            {file && (
              <div>
                <dt>QR Code</dt>
                <dd>{file.name}</dd>
              </div>
            )}
          </dl>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm({ ...form, is_active: e.target.checked })
              }
            />
            Aktifkan untuk pembayaran setelah data penerima diperiksa.
          </label>
        </div>
      )}
    </FinanceWizardFrame>
  );
}
