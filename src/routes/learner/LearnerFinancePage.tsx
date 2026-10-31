import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  HeartHandshake,
  HelpCircle,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog } from "../../components/ui/dialog";
import {
  FinanceBadge,
  FinancePagination,
} from "../../components/finance/FinanceShared";
import { PaymentReportDialog } from "../../components/finance/PaymentReportDialog";
import { FinanceTransactionDialog } from "../../components/finance/FinanceTransactionDialog";
import { useFinanceData } from "../../lib/financeData";
import {
  financePage,
  invoiceBalance,
  rupiah,
  transactionLabels,
} from "../../lib/financeWorkspace";
export function LearnerFinancePage() {
  const { data, loading, error, load } = useFinanceData(true);
  const [params, setParams] = useSearchParams();
  const [report, setReport] = useState<{
    mode: "class" | "donation";
    invoice: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const view = params.get("view") === "history" ? "history" : "invoices";
  const q = params.get("q") || "";
  const status = params.get("status") || "all";
  const program = params.get("program") || "all";
  function update(values: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [k, v] of Object.entries(values)) {
          if (v && v !== "all") next.set(k, v);
          else next.delete(k);
        }
        if (!("page" in values)) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  const invoices = data.invoices
    .filter(
      (i) =>
        (program === "all" || program === i.program_id) &&
        (status === "all" || i.status === status) &&
        (!q ||
          `${i.title} ${data.programs.find((p) => p.id === i.program_id)?.name} ${i.billing_month}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    )
    .sort(
      (a, b) =>
        a.status.localeCompare(b.status) ||
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
    );
  const transactions = data.transactions
    .filter(
      (t) =>
        (program === "all" || program === t.program_id) &&
        (status === "all" || t.status === status) &&
        (!q ||
          `${transactionLabels[t.transaction_type]} ${t.payer_name} ${t.reference_number}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pages = Math.max(
    1,
    Math.ceil((view === "invoices" ? invoices : transactions).length / 10),
  );
  const page = Math.min(financePage(params.get("page")), pages);
  const start = (page - 1) * 10;
  const detail = data.transactions.find(
    (t) => t.id === params.get("transaction"),
  );
  const invoice = data.invoices.find((i) => i.id === params.get("invoice"));
  const open = data.invoices.filter((i) => i.status === "open");
  return (
    <div className="page-stack finance-workspace finance-learner">
      <header className="finance-learner-header">
        <div>
          <p className="admin-page-eyebrow">Administrasi belajar</p>
          <h1>Pembayaran</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={loading}
            aria-label="Muat ulang pembayaran"
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
          </Button>
          <Button
            variant="outline"
            disabled={loading || !!error}
            onClick={() => setReport({ mode: "donation", invoice: "" })}
          >
            <HeartHandshake size={16} />
            Donasi
          </Button>
        </div>
      </header>
      {notice && (
        <p role="status" className="program-notice">
          {notice}
        </p>
      )}
      {error ? (
        <section role="alert" className="finance-panel">
          <h2>Pembayaran belum dapat dimuat</h2>
          <p className="program-error">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Coba lagi
          </Button>
        </section>
      ) : loading ? (
        <p role="status" className="certificate-empty">
          Memuat pembayaran…
        </p>
      ) : (
        <>
          <div className="finance-metrics finance-learner-metrics">
            <button
              className="finance-metric finance-tone-sky"
              onClick={() =>
                update({ view: "invoices", status: "open", q: null })
              }
            >
              <ReceiptText size={23} />
              <span>Sisa tagihan</span>
              <strong>
                {rupiah(
                  open.reduce(
                    (s, i) =>
                      s + invoiceBalance(i, data.transactions).remaining,
                    0,
                  ),
                )}
              </strong>
            </button>
            <button
              className="finance-metric finance-tone-amber"
              onClick={() =>
                update({ view: "history", status: "pending", q: null })
              }
            >
              <ReceiptText size={23} />
              <span>Menunggu verifikasi</span>
              <strong>
                {data.transactions.filter((t) => t.status === "pending").length}{" "}
                pembayaran
              </strong>
            </button>
          </div>
          <nav className="finance-nav" aria-label="Menu pembayaran">
            <button
              aria-current={view === "invoices" ? "page" : undefined}
              onClick={() =>
                update({ view: "invoices", status: null, q: null })
              }
            >
              Tagihan kelas
            </button>
            <button
              aria-current={view === "history" ? "page" : undefined}
              onClick={() => update({ view: "history", status: null, q: null })}
            >
              Riwayat pembayaran
            </button>
          </nav>
          <div className="finance-list-filters">
            <Input
              aria-label="Cari pembayaran"
              placeholder="Cari tagihan atau pembayaran…"
              value={q}
              onChange={(e) => update({ q: e.target.value })}
            />
            <select
              className="field-control"
              aria-label="Status pembayaran"
              value={status}
              onChange={(e) => update({ status: e.target.value })}
            >
              <option value="all">Semua status</option>
              {(view === "invoices"
                ? [
                    ["open", "Belum lunas"],
                    ["paid", "Lunas"],
                    ["cancelled", "Dibatalkan"],
                  ]
                : [
                    ["pending", "Menunggu verifikasi"],
                    ["verified", "Terverifikasi"],
                    ["rejected", "Ditolak"],
                    ["void", "Dibatalkan"],
                  ]
              ).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="field-control"
              aria-label="Program pembayaran"
              value={program}
              onChange={(e) => update({ program: e.target.value })}
            >
              <option value="all">Semua program</option>
              {data.programs
                .filter((p) =>
                  data.enrollments.some((e) => e.program_id === p.id),
                )
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          {view === "invoices" ? (
            <div className="finance-card-list">
              {invoices.slice(start, start + 10).map((i) => {
                const balance = invoiceBalance(i, data.transactions);
                return (
                  <article key={i.id} className="finance-invoice-card">
                    <div>
                      <span className="finance-mini-label">
                        {data.programs.find((p) => p.id === i.program_id)?.name}
                      </span>
                      <h2>
                        <button onClick={() => update({ invoice: i.id })}>
                          {i.title}
                        </button>
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {i.billing_month?.slice(0, 7)}
                        {i.due_date ? ` · Jatuh tempo ${i.due_date}` : ""}
                      </p>
                      <Link
                        className="finance-text-link text-sm mt-3 inline-flex items-center gap-1"
                        to={`/learner/program/${i.program_id}`}
                      >
                        Buka kelas <ArrowRight size={14} />
                      </Link>
                    </div>
                    <div className="finance-invoice-amount">
                      <FinanceBadge status={i.status} />
                      <strong>
                        {rupiah(
                          i.status === "cancelled"
                            ? i.amount
                            : balance.remaining,
                        )}
                      </strong>
                      {balance.pending > 0 && (
                        <small>
                          {rupiah(balance.pending)} sedang diperiksa
                        </small>
                      )}
                      <Button
                        variant={i.status === "open" ? "default" : "outline"}
                        disabled={
                          i.status === "open" && balance.available === 0
                        }
                        onClick={() =>
                          i.status === "open"
                            ? setReport({ mode: "class", invoice: i.id })
                            : update({ invoice: i.id })
                        }
                      >
                        {i.status === "open"
                          ? balance.available > 0
                            ? "Bayar / konfirmasi"
                            : "Menunggu verifikasi"
                          : "Lihat rincian"}
                      </Button>
                      <Button asChild variant="ghost" size="sm"><Link to={`/learner/bantuan?category=billing&contextProgram=${i.program_id}&contextEnrollment=${i.enrollment_id}&contextInvoice=${i.id}`}><HelpCircle size={15}/>Bantuan tagihan</Link></Button>
                    </div>
                  </article>
                );
              })}
              {!invoices.length && (
                <div className="finance-panel certificate-empty">
                  {q || status !== "all"
                    ? "Tidak ada tagihan yang cocok."
                    : "Belum ada tagihan kelas."}
                  <Link
                    className="finance-text-link block mt-3"
                    to="/learner/program-saya"
                  >
                    Lihat program saya ↗
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="finance-record-list finance-panel">
              {transactions.slice(start, start + 10).map((t) => (
                <button
                  key={t.id}
                  onClick={() => update({ transaction: t.id })}
                >
                  <span>
                    <strong>{transactionLabels[t.transaction_type]}</strong>
                    <small>
                      {data.programs.find((p) => p.id === t.program_id)?.name ??
                        "Donasi umum"}{" "}
                      · {t.paid_at ?? t.created_at.slice(0, 10)}
                    </small>
                  </span>
                  <FinanceBadge status={t.status} />
                  <strong>{rupiah(t.amount)}</strong>
                  <ArrowRight size={16} />
                </button>
              ))}
              {!transactions.length && (
                <p className="certificate-empty">
                  Belum ada pembayaran pada filter ini.
                </p>
              )}
            </div>
          )}
          <FinancePagination
            page={page}
            pages={pages}
            onChange={(n) => update({ page: String(n) })}
          />
          <div className="finance-help-link">
            <HelpCircle size={18} />
            <span>Perlu bantuan pembayaran?</span>
            <Link className="finance-text-link" to="/learner/bantuan?category=billing">
              Hubungi admin ↗
            </Link>
          </div>
        </>
      )}
      {report && (
        <PaymentReportDialog
          data={data}
          staff={false}
          initialMode={report.mode}
          initialInvoiceId={report.invoice}
          onClose={() => setReport(null)}
          onSaved={(id) => {
            setReport(null);
            setNotice(
              "Konfirmasi terkirim. Admin akan memeriksa bukti pembayaran Anda.",
            );
            update({ view: "history", status: null, q: null, transaction: id });
            void load();
          }}
        />
      )}
      {detail && (
        <FinanceTransactionDialog
          transaction={detail}
          data={data}
          staff={false}
          onClose={() => update({ transaction: null })}
          onSaved={() => {
            update({ transaction: null });
            setNotice("Bukti pembayaran ditambahkan.");
            void load();
          }}
          onInvoice={(id) => update({ transaction: null, invoice: id })}
        />
      )}
      {invoice && (
        <Dialog title={invoice.title} onClose={() => update({ invoice: null })}>
          <FinanceBadge status={invoice.status} />
          <dl className="certificate-summary my-5">
            <div>
              <dt>Total tagihan</dt>
              <dd>{rupiah(invoice.amount)}</dd>
            </div>
            <div>
              <dt>Dibayar</dt>
              <dd>{rupiah(invoiceBalance(invoice, data.transactions).paid)}</dd>
            </div>
            <div>
              <dt>Menunggu verifikasi</dt>
              <dd>
                {rupiah(invoiceBalance(invoice, data.transactions).pending)}
              </dd>
            </div>
            <div>
              <dt>Sisa tagihan</dt>
              <dd>
                {rupiah(invoiceBalance(invoice, data.transactions).remaining)}
              </dd>
            </div>
            <div>
              <dt>Jatuh tempo</dt>
              <dd>{invoice.due_date ?? "Tidak ditentukan"}</dd>
            </div>
          </dl>
          <div className="finance-record-list">
            {data.transactions
              .filter((t) => t.invoice_id === invoice.id)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => update({ invoice: null, transaction: t.id })}
                >
                  <span>{t.paid_at ?? t.created_at.slice(0, 10)}</span>
                  <FinanceBadge status={t.status} />
                  <strong>{rupiah(t.amount)}</strong>
                </button>
              ))}
          </div>
          {invoice.status === "open" &&
            invoiceBalance(invoice, data.transactions).available > 0 && (
              <Button
                className="mt-4"
                onClick={() => {
                  const id = invoice.id;
                  update({ invoice: null });
                  setReport({ mode: "class", invoice: id });
                }}
              >
                Bayar / konfirmasi
              </Button>
            )}
        </Dialog>
      )}
    </div>
  );
}
