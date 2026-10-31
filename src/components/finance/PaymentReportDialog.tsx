import { useRef, useState } from "react";
import { Input } from "../ui/input";
import { useAuthSession } from "../../app/providers/authSessionContext";
import {
  financeRpc,
  uploadFinanceDocument,
  useFinanceRequestKey,
} from "../../lib/financeData";
import {
  channelsForPurpose,
  financeDate,
  financeError,
  invoiceBalance,
  rupiah,
  transactionLabels,
  validMoney,
  validateFinanceFile,
  type FinanceData,
  type TransactionType,
} from "../../lib/financeWorkspace";
import { FinanceWizardFrame, PaymentChannelDisplay } from "./FinanceShared";
export function PaymentReportDialog({
  data,
  staff,
  globalAccess = false,
  initialInvoiceId = "",
  initialMode = "class",
  initialProgram = "",
  initialCommitmentId = "",
  onClose,
  onSaved,
}: {
  data: FinanceData;
  staff: boolean;
  globalAccess?: boolean;
  initialInvoiceId?: string;
  initialMode?: "class" | "donation";
  initialProgram?: string;
  initialCommitmentId?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { profile } = useAuthSession();
  const commitment = data.commitments.find((c) => c.id === initialCommitmentId);
  const donor = data.donors.find((d) => d.id === commitment?.donor_id);
  const [mode, setMode] = useState(initialMode);
  const initial = {
    invoice_id: initialInvoiceId,
    program_id:
      commitment?.program_id ??
      (initialProgram === "all" ? "" : initialProgram),
    transaction_type: (initialMode === "donation" &&
    commitment?.commitment_type === "wakaf"
      ? "wakaf"
      : "donation") as TransactionType,
    amount: initialInvoiceId
      ? String(
          data.invoices.some((i) => i.id === initialInvoiceId)
            ? invoiceBalance(
                data.invoices.find((i) => i.id === initialInvoiceId)!,
                data.transactions,
              ).available
            : 0,
        )
      : commitment && commitment.amount > 0
        ? String(commitment.amount)
        : "",
    payer_name: donor?.full_name ?? (staff ? "" : (profile?.full_name ?? "")),
    payment_channel_id: commitment?.channel_id ?? "",
    paid_at: financeDate(),
    reference_number: "",
    notes: "",
  };
  const [form, setForm] = useState(initial);
  const baseline = useRef(JSON.stringify(initial));
  const [file, setFile] = useState<File | null>(null);
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useFinanceRequestKey();
  const invoice = data.invoices.find((i) => i.id === form.invoice_id);
  const program =
    mode === "class" ? invoice?.program_id : form.program_id || null;
  const channels = channelsForPurpose(
    data.channels,
    mode === "class" ? "class" : "donation",
    program,
  ).filter((c) => staff || c.channel_type !== "cash");
  const channel = channels.find((c) => c.id === form.payment_channel_id);
  const balance = invoice ? invoiceBalance(invoice, data.transactions) : null;
  const openInvoices = data.invoices.filter(
    (i) =>
      i.status === "open" && invoiceBalance(i, data.transactions).available > 0,
  );
  const validatePurpose = () =>
    mode === "class" && !invoice
      ? "Pilih tagihan kelas."
      : !validMoney(form.amount)
        ? "Isi nominal pembayaran yang benar."
        : mode === "class" && Number(form.amount) > (balance?.available ?? 0)
          ? "Nominal melebihi sisa tagihan yang belum dilaporkan."
          : mode === "donation" && staff && !globalAccess && !program
            ? "Pilih program donasi sesuai cakupan Anda."
            : "";
  const validateProof = () =>
    !form.payer_name.trim()
      ? "Isi nama pembayar."
      : !form.paid_at || form.paid_at > financeDate()
        ? "Pilih tanggal pembayaran yang benar."
        : !file && !(staff && channel?.channel_type === "cash")
          ? "Pilih bukti pembayaran."
          : file
            ? validateFinanceFile(file, "proof")
            : "";
  function next() {
    const problem =
      step === 0
        ? validatePurpose()
        : step === 1
          ? !channel
            ? "Pilih rekening atau QR yang sesuai."
            : ""
          : validateProof();
    if (problem) setError(problem);
    else {
      setError("");
      setStep(step + 1);
    }
  }
  async function save() {
    const message =
      validatePurpose() ||
      (!channel ? "Pilih kanal pembayaran." : "") ||
      validateProof();
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      let documentId: null | string = null;
      if (file) {
        if (uploaded.current?.file !== file)
          uploaded.current = {
            file,
            id: await uploadFinanceDocument(file, "proof"),
          };
        documentId = uploaded.current.id;
      }
      const payload = {
        invoice_id: mode === "class" ? invoice!.id : null,
        program_id: program,
        transaction_type:
          mode === "class" ? invoice!.invoice_type : form.transaction_type,
        amount: Number(form.amount),
        payment_channel_id: channel!.id,
        channel_updated_at: channel!.updated_at,
        payer_name: form.payer_name.trim(),
        paid_at: form.paid_at,
        reference_number: form.reference_number.trim() || null,
        notes: form.notes.trim() || null,
        proof_document_id: documentId,
        donor_id: staff ? (commitment?.donor_id ?? null) : null,
        donor_commitment_id: staff ? (commitment?.id ?? null) : null,
      };
      const result = await financeRpc<{
        transaction_id: string;
        status: string;
      }>("finance_create_transaction", {
        p_payload: payload,
        p_request_key: requestKey(payload),
      });
      if (!result.transaction_id)
        throw new Error(
          "Konfirmasi belum tersimpan. Coba lagi dengan isian yang sama.",
        );
      onSaved(result.transaction_id);
    } catch (problem) {
      setError(financeError(problem));
    } finally {
      setBusy(false);
    }
  }
  return (
    <FinanceWizardFrame
      title={staff ? "Catat pembayaran / donasi" : "Konfirmasi pembayaran"}
      steps={["Tujuan", "Rekening / QR", "Bukti bayar", "Tinjau"]}
      step={step}
      onClose={onClose}
      onBack={() => {
        setStep(step - 1);
        setError("");
      }}
      onNext={next}
      onSubmit={() => void save()}
      busy={busy}
      error={error}
      dirty={!!file || JSON.stringify(form) !== baseline.current}
      submitLabel="Kirim konfirmasi"
    >
      {step === 0 ? (
        <div className="space-y-4">
          {!initialInvoiceId && !initialCommitmentId && (
            <label className="certificate-field">
              Tujuan
              <select
                aria-label="Tujuan pembayaran"
                className="field-control"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as "class" | "donation");
                  setForm({
                    ...form,
                    invoice_id: "",
                    payment_channel_id: "",
                    amount: "",
                  });
                }}
              >
                <option value="class">Biaya kelas</option>
                <option value="donation">Donasi / wakaf</option>
              </select>
            </label>
          )}
          {mode === "class" ? (
            <>
              <label className="certificate-field">
                Tagihan
                <select
                  aria-label="Tagihan pembayaran"
                  className="field-control"
                  value={form.invoice_id}
                  disabled={!!initialInvoiceId}
                  onChange={(e) => {
                    const next = data.invoices.find(
                      (i) => i.id === e.target.value,
                    );
                    setForm({
                      ...form,
                      invoice_id: e.target.value,
                      amount: next
                        ? String(
                            invoiceBalance(next, data.transactions).available,
                          )
                        : "",
                      payment_channel_id: "",
                    });
                  }}
                >
                  <option value="">Pilih tagihan</option>
                  {openInvoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title} ·{" "}
                      {
                        data.participants.find((p) => p.id === i.participant_id)
                          ?.display_name
                      }{" "}
                      · {rupiah(invoiceBalance(i, data.transactions).available)}
                    </option>
                  ))}
                </select>
              </label>
              {invoice && (
                <p className="text-sm text-muted-foreground">
                  {data.programs.find((p) => p.id === invoice.program_id)?.name}{" "}
                  · Sisa {rupiah(balance?.remaining)}
                  {(balance?.pending ?? 0) > 0
                    ? ` · ${rupiah(balance?.pending)} menunggu verifikasi`
                    : ""}
                </p>
              )}
            </>
          ) : (
            <>
              <label className="certificate-field">
                Jenis
                <select
                  aria-label="Jenis donasi"
                  className="field-control"
                  value={form.transaction_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      transaction_type: e.target.value as TransactionType,
                    })
                  }
                >
                  <option value="donation">Donasi</option>
                  <option value="wakaf">Wakaf uang</option>
                  {staff && <option value="other">Penerimaan lainnya</option>}
                </select>
              </label>
              <label className="certificate-field">
                Program
                <select
                  aria-label="Program donasi"
                  className="field-control"
                  value={form.program_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      program_id: e.target.value,
                      payment_channel_id: "",
                    })
                  }
                >
                  <option value="">
                    {!staff || globalAccess ? "Donasi umum" : "Pilih program"}
                  </option>
                  {data.programs
                    .filter((p) => p.status !== "archived")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          <label className="certificate-field">
            Nominal (Rp)
            <Input
              aria-label="Nominal pembayaran"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>
        </div>
      ) : step === 1 ? (
        <div className="space-y-4">
          <label className="certificate-field">
            Rekening / QR Code
            <select
              aria-label="Kanal pembayaran"
              className="field-control"
              value={channel?.id ?? ""}
              onChange={(e) =>
                setForm({ ...form, payment_channel_id: e.target.value })
              }
            >
              <option value="">Pilih metode</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ·{" "}
                  {c.channel_type === "qris"
                    ? "QR Code"
                    : (c.bank_name ?? c.channel_type)}
                </option>
              ))}
            </select>
          </label>
          {channel && <PaymentChannelDisplay channel={channel} />}{" "}
          {!channels.length && (
            <p className="program-notice">
              Belum ada rekening/QR yang siap untuk pembayaran ini. Hubungi
              pengelola keuangan.
            </p>
          )}
        </div>
      ) : step === 2 ? (
        <div className="space-y-4">
          <label className="certificate-field">
            Nama pembayar
            <Input
              maxLength={160}
              value={form.payer_name}
              onChange={(e) => setForm({ ...form, payer_name: e.target.value })}
            />
          </label>
          <label className="certificate-field">
            Tanggal pembayaran
            <Input
              type="date"
              value={form.paid_at}
              max={financeDate()}
              onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
            />
          </label>
          <label className="certificate-field">
            Nomor referensi (opsional)
            <Input
              maxLength={120}
              value={form.reference_number}
              onChange={(e) =>
                setForm({ ...form, reference_number: e.target.value })
              }
            />
          </label>
          <label className="certificate-field">
            Bukti pembayaran
            {staff && channel?.channel_type === "cash"
              ? " (opsional untuk tunai)"
              : ""}
            <input
              aria-label="Bukti pembayaran"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                if (next) {
                  const problem = validateFinanceFile(next, "proof");
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
            {file && <small>{file.name}</small>}
            <small className="text-muted-foreground">
              PDF, JPG, PNG, atau WebP · Maks. 5 MB
            </small>
          </label>
          <label className="certificate-field">
            Catatan (opsional)
            <textarea
              className="field-control min-h-24"
              maxLength={2000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="certificate-summary">
            <div>
              <dt>Tujuan</dt>
              <dd>
                {mode === "class"
                  ? invoice?.title
                  : transactionLabels[form.transaction_type]}
              </dd>
            </div>
            <div>
              <dt>Program</dt>
              <dd>
                {data.programs.find((p) => p.id === program)?.name ??
                  "Donasi umum"}
              </dd>
            </div>
            <div>
              <dt>Nominal</dt>
              <dd>
                <strong>{rupiah(form.amount)}</strong>
              </dd>
            </div>
            <div>
              <dt>Pembayar</dt>
              <dd>{form.payer_name}</dd>
            </div>
            <div>
              <dt>Penerima</dt>
              <dd>
                {channel?.name} · {channel?.account_holder}
                {channel?.channel_type === "bank"
                  ? ` · ${channel.account_number}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Tanggal</dt>
              <dd>{form.paid_at}</dd>
            </div>
            <div>
              <dt>Bukti</dt>
              <dd>{file?.name ?? "Pencatatan tunai"}</dd>
            </div>
          </dl>
          <p className="program-notice">
            Konfirmasi masuk ke antrean verifikasi. Tagihan diperbarui setelah
            pembayaran diperiksa.
          </p>
        </div>
      )}
    </FinanceWizardFrame>
  );
}
