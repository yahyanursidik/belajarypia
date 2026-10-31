import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import {
  financeDocumentUrl,
  financeRpc,
  uploadFinanceDocument,
} from "../../lib/financeData";
import {
  financeError,
  invoiceBalance,
  rupiah,
  transactionLabels,
  validateFinanceFile,
  type FinanceData,
  type FinanceTransaction,
} from "../../lib/financeWorkspace";
import {
  FinanceBadge,
  FinanceConfirm,
  PaymentChannelDisplay,
} from "./FinanceShared";
export function FinanceTransactionDialog({
  transaction: tx,
  data,
  staff,
  base = "/system",
  onClose,
  onSaved,
  onInvoice,
}: {
  transaction: FinanceTransaction;
  data: FinanceData;
  staff: boolean;
  base?: string;
  onClose: () => void;
  onSaved: () => void;
  onInvoice?: (id: string) => void;
}) {
  const [action, setAction] = useState<"verified" | "rejected" | "void" | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [activate, setActivate] = useState(false);
  const [documentUrl, setDocumentUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [allocate, setAllocate] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  const person = data.participants.find((p) => p.id === tx.participant_id);
  const invoice = data.invoices.find((i) => i.id === tx.invoice_id);
  const enrollment = data.enrollments.find(
    (e) => e.id === invoice?.enrollment_id,
  );
  const channel =
    tx.channel_snapshot ??
    data.channels.find((c) => c.id === tx.payment_channel_id);
  const journal = data.journals.find((j) => j.transaction_id === tx.id);
  const candidates = data.invoices.filter(
    (i) =>
      i.status !== "cancelled" &&
      i.participant_id === tx.participant_id &&
      i.program_id === tx.program_id &&
      invoiceBalance(i, data.transactions).available >= Number(tx.amount),
  );
  async function viewProof() {
    setBusy(true);
    setError("");
    try {
      setDocumentUrl(await financeDocumentUrl(tx.proof_document_id!));
    } catch (problem) {
      setError(financeError(problem));
    } finally {
      setBusy(false);
    }
  }
  async function attach() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (uploaded.current?.file !== file)
        uploaded.current = {
          file,
          id: await uploadFinanceDocument(file, "proof"),
        };
      const result = await financeRpc<{ transaction_id: string }>(
        "finance_attach_proof",
        {
          p_id: tx.id,
          p_document_id: uploaded.current.id,
          p_expected_updated_at: tx.updated_at,
        },
      );
      if (!result.transaction_id) throw new Error("Bukti belum terkonfirmasi.");
      onSaved();
    } catch (problem) {
      setError(financeError(problem));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Detail pembayaran"
      onClose={onClose}
      busy={busy}
      className="finance-detail-dialog"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <strong className="text-2xl">{rupiah(tx.amount)}</strong>
        <FinanceBadge status={tx.status} />
      </div>
      <dl className="certificate-summary my-5">
        <div>
          <dt>Pembayar</dt>
          <dd>
            {tx.payer_name ||
              person?.display_name ||
              data.donors.find((d) => d.id === tx.donor_id)?.full_name ||
              "Belum tercatat"}
          </dd>
        </div>
        <div>
          <dt>Jenis</dt>
          <dd>{transactionLabels[tx.transaction_type]}</dd>
        </div>
        <div>
          <dt>Program</dt>
          <dd>
            {data.programs.find((p) => p.id === tx.program_id)?.name ??
              "Donasi umum"}
          </dd>
        </div>
        <div>
          <dt>Tanggal bayar</dt>
          <dd>{tx.paid_at ?? tx.created_at.slice(0, 10)}</dd>
        </div>
        <div>
          <dt>Referensi</dt>
          <dd>{tx.reference_number || "Tidak dicantumkan"}</dd>
        </div>
        <div>
          <dt>Tagihan</dt>
          <dd>
            {invoice ? (
              <button
                className="finance-text-link"
                onClick={() => onInvoice?.(invoice.id)}
              >
                {invoice.title}
              </button>
            ) : (
              "Belum terhubung"
            )}
          </dd>
        </div>
        {tx.notes && (
          <div>
            <dt>Catatan</dt>
            <dd className="whitespace-pre-wrap">{tx.notes}</dd>
          </div>
        )}
        {tx.review_notes && (
          <div>
            <dt>Hasil pemeriksaan</dt>
            <dd className="whitespace-pre-wrap">{tx.review_notes}</dd>
          </div>
        )}
        {journal && (
          <div>
            <dt>Jurnal</dt>
            <dd>
              <Link
                className="finance-text-link"
                to={`${base}/keuangan?tab=accounting&journal=${journal.id}`}
              >
                {journal.entry_number}
              </Link>
            </dd>
          </div>
        )}
      </dl>
      {person && staff && (
        <Button asChild variant="outline" size="sm">
          <Link to={`${base}/peserta/${person.id}?tab=academic`}>
            Profil & enrollment peserta ↗
          </Link>
        </Button>
      )}
      {channel && (
        <details className="program-disclosure my-4">
          <summary>Rekening / QR penerima saat pembayaran</summary>
          <div className="p-4">
            <PaymentChannelDisplay channel={channel} />
          </div>
        </details>
      )}
      <section className="finance-panel my-4">
        <h3>Bukti pembayaran</h3>
        {tx.proof_document_id ? (
          <>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => void viewProof()}
            >
              {busy ? "Memuat…" : "Buka bukti"}
            </Button>
            {documentUrl && (
              <a
                className="finance-text-link block mt-3"
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Lihat dokumen di tab baru ↗
              </a>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Belum ada dokumen bukti.
            </p>
            {tx.status === "pending" && (
              <div className="space-y-3 mt-3">
                <input
                  aria-label="Tambahkan bukti pembayaran"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    const next = e.target.files?.[0] ?? null;
                    const message = next
                      ? validateFinanceFile(next, "proof")
                      : "";
                    setError(message);
                    setFile(message ? null : next);
                    if (message) e.currentTarget.value = "";
                  }}
                />
                <Button
                  disabled={!file || busy}
                  variant="outline"
                  onClick={() => void attach()}
                >
                  {busy ? "Mengunggah…" : "Tambahkan bukti"}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
      {error && (
        <p role="alert" className="program-error">
          {error}
        </p>
      )}
      {staff && (
        <>
          <div className="flex flex-wrap gap-2 mt-5">
            {tx.status === "pending" && (
              <>
                <Button
                  onClick={() => {
                    setAction("verified");
                    setNotes("");
                    setActivate(false);
                  }}
                >
                  Verifikasi
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAction("rejected");
                    setNotes("");
                  }}
                >
                  Tolak
                </Button>
              </>
            )}
            {tx.status !== "void" && (
              <Button
                variant="outline"
                onClick={() => {
                  setAction("void");
                  setNotes("");
                }}
              >
                Batalkan pencatatan
              </Button>
            )}
          </div>
          {!tx.invoice_id &&
            ["spp", "registration", "education_infaq"].includes(
              tx.transaction_type,
            ) &&
            ["pending", "verified"].includes(tx.status) && (
              <section className="finance-panel mt-5">
                <h3>Hubungkan pembayaran lama</h3>
                <label className="certificate-field">
                  Tagihan peserta
                  <select
                    aria-label="Alokasi tagihan"
                    className="field-control"
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                  >
                    <option value="">Pilih tagihan yang sesuai</option>
                    {candidates.map((i) => (
                      <option value={i.id} key={i.id}>
                        {i.title} ·{" "}
                        {rupiah(invoiceBalance(i, data.transactions).available)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="outline"
                  className="mt-3"
                  disabled={!invoiceId}
                  onClick={() => setAllocate(true)}
                >
                  Tinjau penghubungan
                </Button>
              </section>
            )}
        </>
      )}
      {action && (
        <FinanceConfirm
          title={
            action === "verified"
              ? "Verifikasi pembayaran?"
              : action === "rejected"
                ? "Tolak pembayaran?"
                : "Batalkan pencatatan?"
          }
          label={
            action === "verified"
              ? "Ya, verifikasi"
              : action === "rejected"
                ? "Tolak pembayaran"
                : "Batalkan pencatatan"
          }
          onClose={() => setAction(null)}
          onConfirm={async () => {
            if (
              (action !== "verified" ||
                (!tx.proof_document_id && channel?.channel_type !== "cash")) &&
              !notes.trim()
            )
              throw new Error("Isi alasan pemeriksaan.");
            const result = await financeRpc<{ transaction_id: string }>(
              "finance_review_transaction",
              {
                p_id: tx.id,
                p_status: action,
                p_notes: notes.trim(),
                p_expected_updated_at: tx.updated_at,
                p_activate: action === "verified" && activate,
              },
            );
            if (!result.transaction_id)
              throw new Error("Status belum terkonfirmasi.");
            onSaved();
          }}
        >
          <p className="font-semibold">
            {rupiah(tx.amount)} ·{" "}
            {tx.payer_name || person?.display_name || "Pembayar"}
          </p>
          <p className="text-sm text-muted-foreground my-3">
            {action === "verified"
              ? "Tagihan dan jurnal akan diperbarui bersama."
              : action === "void"
                ? "Jurnal pembalik dibuat untuk pembayaran terverifikasi. Ini tidak mengirim pengembalian uang."
                : "Tagihan tetap belum lunas. Peserta dapat mengirim konfirmasi baru."}
          </p>
          <label className="certificate-field">
            {action !== "verified" ? "Alasan (wajib)" : "Catatan pemeriksaan"}
            <textarea
              aria-label="Catatan pemeriksaan"
              className="field-control min-h-24"
              value={notes}
              maxLength={4000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {action === "verified" &&
            enrollment &&
            ["hold", "pending"].includes(enrollment.enrollment_status) && (
              <label className="flex items-start gap-2 text-sm mt-4">
                <input
                  type="checkbox"
                  checked={activate}
                  onChange={(e) => setActivate(e.target.checked)}
                />
                Aktifkan enrollment ini bila seluruh tagihannya sudah lunas.
              </label>
            )}
        </FinanceConfirm>
      )}
      {allocate && (
        <FinanceConfirm
          title="Hubungkan ke tagihan?"
          label="Hubungkan"
          onClose={() => setAllocate(false)}
          onConfirm={async () => {
            const r = await financeRpc<{ transaction_id: string }>(
              "finance_allocate_transaction",
              {
                p_id: tx.id,
                p_invoice_id: invoiceId,
                p_expected_updated_at: tx.updated_at,
              },
            );
            if (!r.transaction_id)
              throw new Error("Penghubungan belum terkonfirmasi.");
            onSaved();
          }}
        >
          <p>
            {rupiah(tx.amount)} →{" "}
            {data.invoices.find((i) => i.id === invoiceId)?.title}
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            Penerimaan yang sama tidak dibukukan dua kali.
          </p>
        </FinanceConfirm>
      )}
    </Dialog>
  );
}
