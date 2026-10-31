import { useEffect, useState, type ReactNode } from "react";
import { Banknote, Copy, QrCode } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { financeDocumentUrl } from "../../lib/financeData";
import {
  financeStatus,
  financeError,
  safeFinanceUrl,
  type PaymentChannel,
} from "../../lib/financeWorkspace";
export function FinanceBadge({ status }: { status: string }) {
  const meta = financeStatus[status] ?? { label: status, tone: "slate" };
  return (
    <span className={`admission-badge admission-tone-${meta.tone}`}>
      {meta.label}
    </span>
  );
}
export function FinancePagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="certificate-pagination">
      <Button
        variant="outline"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Sebelumnya
      </Button>
      <span>
        {page} / {pages}
      </span>
      <Button
        variant="outline"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Berikutnya
      </Button>
    </div>
  );
}
export function FinanceConfirm({
  title,
  children,
  onClose,
  onConfirm,
  label = "Simpan",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (problem) {
      setError(financeError(problem));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
      {children}
      {error && (
        <p role="alert" className="program-error mt-4">
          {error}
        </p>
      )}
      <div className="workspace-dialog__footer">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Periksa lagi
        </Button>
        <Button disabled={busy} onClick={() => void submit()}>
          {busy ? "Menyimpan…" : label}
        </Button>
      </div>
    </Dialog>
  );
}
export function PaymentChannelDisplay({
  channel,
}: {
  channel: PaymentChannel;
}) {
  const [url, setUrl] = useState<string | null>(
    safeFinanceUrl(channel.qris_image_url),
  );
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setUrl(safeFinanceUrl(channel.qris_image_url));
    if (channel.qr_document_id)
      void financeDocumentUrl(channel.qr_document_id)
        .then((value) => {
          if (active) setUrl(value);
        })
        .catch(() => {
          if (active) setError("QR belum dapat ditampilkan. Coba lagi.");
        });
    return () => {
      active = false;
    };
  }, [channel.qr_document_id, channel.qris_image_url, retry]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(channel.account_number ?? "");
      setCopied(true);
    } catch {
      setError("Salin nomor rekening secara manual.");
    }
  }
  return (
    <div className="finance-channel-instructions">
      <div className="flex items-center gap-2 font-semibold">
        {channel.channel_type === "qris" ? (
          <QrCode size={19} />
        ) : (
          <Banknote size={19} />
        )}{" "}
        {channel.name}
      </div>
      {channel.channel_type === "bank" && (
        <>
          <p className="text-sm">{channel.bank_name}</p>
          <div className="flex items-center flex-wrap gap-3">
            <strong className="text-xl tracking-wide">
              {channel.account_number}
            </strong>
            <Button variant="outline" size="sm" onClick={() => void copy()}>
              <Copy size={14} />
              {copied ? "Tersalin" : "Salin"}
            </Button>
          </div>
        </>
      )}
      {channel.account_holder && (
        <p className="text-sm">
          Atas nama: <strong>{channel.account_holder}</strong>
        </p>
      )}
      {channel.channel_type === "qris" &&
        (url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <img
              className="finance-qr-image"
              src={url}
              alt={`QR pembayaran ${channel.account_holder ?? channel.name}`}
              referrerPolicy="no-referrer"
              onError={() => {
                setUrl(null);
                setError("QR belum dapat dibuka.");
              }}
            />
          </a>
        ) : !error ? (
          <p role="status" className="text-sm">
            Memuat QR…
          </p>
        ) : null)}
      {channel.channel_type === "external" &&
        safeFinanceUrl(channel.external_url) && (
          <a
            href={safeFinanceUrl(channel.external_url)!}
            rel="noopener noreferrer"
            target="_blank"
          >
            Buka tautan pembayaran ↗
          </a>
        )}
      {channel.instructions && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
          {channel.instructions}
        </p>
      )}
      {error && (
        <p role="alert" className="program-error">
          {error}
          {channel.channel_type === "qris" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRetry((n) => n + 1)}
            >
              Coba lagi
            </Button>
          )}
        </p>
      )}
    </div>
  );
}
export function FinanceWizardFrame({
  title,
  steps,
  step,
  onClose,
  onBack,
  onNext,
  onSubmit,
  busy,
  error,
  dirty,
  children,
  submitLabel = "Simpan",
}: {
  title: string;
  steps: string[];
  step: number;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  busy: boolean;
  error: string;
  dirty: boolean;
  children: ReactNode;
  submitLabel?: string;
}) {
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <Dialog
      title={title}
      onClose={() => (dirty ? setDiscard(true) : onClose())}
      busy={busy}
      className="finance-wizard-dialog"
    >
      <ol className="finance-wizard-steps" aria-label="Langkah formulir">
        {steps.map((label, index) => (
          <li key={label} aria-current={index === step ? "step" : undefined}>
            <span>{index < step ? "✓" : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="program-error">
          {error}
        </p>
      )}
      {children}
      <footer className="workspace-dialog__footer">
        <Button
          variant="outline"
          disabled={busy}
          onClick={step ? onBack : () => (dirty ? setDiscard(true) : onClose())}
        >
          {step ? "Kembali" : "Tutup"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {step + 1}/{steps.length}
        </span>
        <Button
          disabled={busy}
          onClick={step < steps.length - 1 ? onNext : onSubmit}
        >
          {busy
            ? "Menyimpan…"
            : step < steps.length - 1
              ? "Lanjut"
              : submitLabel}
        </Button>
      </footer>
      {discard && (
        <Dialog title="Tutup formulir?" onClose={() => setDiscard(false)}>
          <p>Isian yang belum disimpan akan dibuang.</p>
          <div className="workspace-dialog__footer">
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Lanjut mengisi
            </Button>
            <Button onClick={onClose}>Tutup formulir</Button>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}
