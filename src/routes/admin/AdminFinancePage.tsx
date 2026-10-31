import { useEffect, useState } from "react";
import { inWibDateRange } from "../../lib/dateRange";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  HeartHandshake,
  Plus,
  ReceiptText,
  RefreshCw,
  Scale,
} from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { PageHeader } from "../../components/admin/PageHeader";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog } from "../../components/ui/dialog";
import {
  FinanceBadge,
  FinanceConfirm,
  FinancePagination,
  PaymentChannelDisplay,
} from "../../components/finance/FinanceShared";
import { InvoiceCreateDialog } from "../../components/finance/InvoiceCreateDialog";
import { PaymentChannelDialog } from "../../components/finance/PaymentChannelDialog";
import { PaymentReportDialog } from "../../components/finance/PaymentReportDialog";
import { DonorCommitmentDialog } from "../../components/finance/DonorCommitmentDialog";
import { FinanceTransactionDialog } from "../../components/finance/FinanceTransactionDialog";
import { financeCsv, financeRpc, useFinanceData } from "../../lib/financeData";
import {
  financeDate,
  financePage,
  financeTabs,
  invoiceBalance,
  nextFinanceReminder,
  paymentChannelReady,
  rupiah,
  transactionLabels,
  type DonorCommitment,
  type FinanceTab,
  type PaymentChannel,
} from "../../lib/financeWorkspace";
export function AdminFinancePage() {
  const { roles } = useAuthSession();
  const { pathname } = useLocation();
  const base = pathname.startsWith("/system") ? "/system" : "/admin";
  const [params, setParams] = useSearchParams();
  const { data, loading, error, load } = useFinanceData();
  const globalAccess = roles.some((r) =>
    ["super_admin", "finance"].includes(r.code),
  );
  const program = params.get("program") || "all";
  const participant = params.get("participant") || "";
  const q = params.get("q") || "";
  const status = params.get("status") || "all";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const tab = (
    financeTabs.some((t) => t.key === params.get("tab"))
      ? params.get("tab")
      : "overview"
  ) as FinanceTab;
  const [form, setForm] = useState<
    "invoice" | "payment" | "channel" | "commitment" | null
  >(null);
  useEffect(() => {
    if (params.get("action") !== "invoice") return;
    setForm("invoice");
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("action");
      return next;
    }, { replace: true });
  }, [params, setParams]);
  const [editChannel, setEditChannel] = useState<PaymentChannel>();
  const [editCommitment, setEditCommitment] = useState<DonorCommitment>();
  const [payInvoice, setPayInvoice] = useState("");
  const [payCommitment, setPayCommitment] = useState("");
  const [payMode, setPayMode] = useState<"class" | "donation">("class");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<"cancel" | "post" | null>(null);
  const [reason, setReason] = useState("");
  const [followup, setFollowup] = useState<DonorCommitment | null>(null);
  const [nextDate, setNextDate] = useState("");
  const [followupNote, setFollowupNote] = useState("");
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
  function go(next: FinanceTab, values: Record<string, string | null> = {}) {
    update({
      tab: next,
      status: null,
      q: null,
      page: null,
      invoice: null,
      transaction: null,
      journal: null,
      kind: null,
      invoiceFilter: null,
      commitmentFilter: null,
      ...values,
    });
  }
  function saved(message: string) {
    setForm(null);
    setEditChannel(undefined);
    setEditCommitment(undefined);
    setNotice(message);
    void load();
  }
  function payment(invoice = "", commitment = "") {
    setPayInvoice(invoice);
    setPayCommitment(commitment);
    setPayMode(
      invoice
        ? "class"
        : commitment
          ? "donation"
          : tab === "recurring"
            ? "donation"
            : "class",
    );
    setForm("payment");
  }
  const people = new Map(data.participants.map((p) => [p.id, p]));
  const programs = new Map(data.programs.map((p) => [p.id, p]));
  const donors = new Map(data.donors.map((d) => [d.id, d]));
  const manageProgram = (id: string | null | undefined) =>
    globalAccess ||
    (!!id &&
      roles.some(
        (r) =>
          r.code === "admin" &&
          (!r.scopeId ||
            (r.scopeType === "unit"
              ? programs.get(id)?.unit_id === r.scopeId
              : r.scopeId === id)),
      ));
  const managedData = {
    ...data,
    programs: data.programs.filter((p) => manageProgram(p.id)),
    enrollments: data.enrollments.filter((e) => manageProgram(e.program_id)),
  };
  const inProgram = (id: string | null | undefined) =>
    program === "all" || id === program;
  const inDate = (date: string) => inWibDateRange(date, from, to);
  const matches = (...values: unknown[]) =>
    !q || values.join(" ").toLowerCase().includes(q.toLowerCase());
  const scopedInvoices = data.invoices.filter(
    (i) =>
      inProgram(i.program_id) &&
      (!participant || i.participant_id === participant),
  );
  const scopedTx = data.transactions.filter(
    (t) =>
      inProgram(t.program_id) &&
      (!participant || t.participant_id === participant),
  );
  const rangeTx = scopedTx.filter((t) => inDate(t.paid_at ?? t.created_at));
  const invoices = scopedInvoices
    .filter(
      (i) =>
        (status === "all" || status === "overdue"
          ? status !== "overdue" ||
            (i.status === "open" && !!i.due_date && i.due_date < financeDate())
          : i.status === status) &&
        inDate(i.created_at) &&
        matches(
          i.title,
          i.invoice_number,
          people.get(i.participant_id)?.display_name,
          people.get(i.participant_id)?.global_participant_number,
          i.billing_month,
        ),
    )
    .sort(
      (a, b) =>
        a.status.localeCompare(b.status) ||
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
    );
  const transactions = rangeTx
    .filter(
      (t) =>
        (status === "all" || t.status === status) &&
        (!params.get("kind") ||
          (params.get("kind") === "donation"
            ? ["donation", "wakaf"].includes(t.transaction_type)
            : ["spp", "registration", "education_infaq"].includes(
                t.transaction_type,
              ))) &&
        (!params.get("commitmentFilter") ||
          t.donor_commitment_id === params.get("commitmentFilter")) &&
        (!params.get("invoiceFilter") ||
          t.invoice_id === params.get("invoiceFilter") ||
          params.get("kind") ||
          params.get("commitmentFilter")) &&
        matches(
          t.payer_name,
          people.get(t.participant_id ?? "")?.display_name,
          donors.get(t.donor_id ?? "")?.full_name,
          t.reference_number,
          transactionLabels[t.transaction_type],
        ),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const channels = data.channels
    .filter(
      (c) =>
        (!c.program_id || inProgram(c.program_id)) &&
        (status === "all" ||
          (status === "ready"
            ? paymentChannelReady(c)
            : !paymentChannelReady(c))) &&
        matches(c.name, c.bank_name, c.account_holder),
    )
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
  const commitments = data.commitments
    .filter(
      (c) =>
        inProgram(c.program_id) &&
        (status === "all" || status === "due"
          ? status !== "due" ||
            (c.status === "active" &&
              !!c.next_reminder_at &&
              c.next_reminder_at <= financeDate())
          : c.status === status) &&
        matches(
          donors.get(c.donor_id)?.full_name,
          donors.get(c.donor_id)?.phone,
          c.wakaf_asset,
        ),
    )
    .sort((a, b) =>
      (a.next_reminder_at ?? "9999").localeCompare(
        b.next_reminder_at ?? "9999",
      ),
    );
  const originalById = new Map(data.journals.map((j) => [j.id, j]));
  const journalTx = (j: (typeof data.journals)[number]) =>
    data.transactions.find(
      (t) =>
        t.id ===
        (j.transaction_id ??
          originalById.get(j.reverses_entry_id ?? "")?.transaction_id),
    );
  const journals = data.journals
    .filter((j) => {
      const tx = journalTx(j);
      return (
        !!tx &&
        inProgram(tx.program_id) &&
        (!participant || tx.participant_id === participant) &&
        inDate(j.entry_date) &&
        (status === "all" || j.status === status) &&
        matches(j.entry_number, j.description)
      );
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const lines = data.lines.filter((l) =>
    journals.some((j) => j.id === l.journal_entry_id && j.status === "posted"),
  );
  const debit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit), 0);
  const needsPost = scopedTx.filter((t) => {
    const j = data.journals.find((j) => j.transaction_id === t.id);
    if (t.status === "void")
      return (
        j?.status === "posted" &&
        !data.journals.some((r) => r.reverses_entry_id === j.id)
      );
    if (t.status !== "verified") return false;
    if (!j) return true;
    const ls = data.lines.filter((l) => l.journal_entry_id === j.id);
    return (
      j.status !== "posted" ||
      ls.length < 2 ||
      Math.abs(ls.reduce((s, l) => s + Number(l.debit), 0) - Number(t.amount)) >
        0.001 ||
      Math.abs(
        ls.reduce((s, l) => s + Number(l.credit), 0) - Number(t.amount),
      ) > 0.001
    );
  });
  const overdue = scopedInvoices.filter(
    (i) => i.status === "open" && i.due_date && i.due_date < financeDate(),
  );
  const dueCommitments = data.commitments.filter(
    (c) =>
      inProgram(c.program_id) &&
      c.status === "active" &&
      c.next_reminder_at &&
      c.next_reminder_at <= financeDate(),
  );
  const readyChannels = data.channels.filter(
    (c) => (!c.program_id || inProgram(c.program_id)) && paymentChannelReady(c),
  );
  const list =
    tab === "invoices"
      ? invoices
      : tab === "transactions"
        ? transactions
        : tab === "channels"
          ? channels
          : tab === "recurring"
            ? commitments
            : journals;
  const pages = Math.max(1, Math.ceil(list.length / 12));
  const page = Math.min(financePage(params.get("page")), pages);
  const start = (page - 1) * 12;
  const detailInvoice = data.invoices.find(
    (i) => i.id === params.get("invoice"),
  );
  const detailTx = data.transactions.find(
    (t) => t.id === params.get("transaction"),
  );
  const detailJournal = data.journals.find(
    (j) => j.id === params.get("journal"),
  );
  function exportRows() {
    if (tab === "invoices")
      financeCsv("tagihan", [
        [
          "Nomor",
          "Peserta",
          "Program",
          "Tagihan",
          "Periode",
          "Jatuh tempo",
          "Nominal",
          "Dibayar",
          "Menunggu",
          "Sisa",
          "Status",
        ],
        ...invoices.map((i) => {
          const b = invoiceBalance(i, data.transactions);
          return [
            i.invoice_number,
            people.get(i.participant_id)?.display_name ?? "",
            programs.get(i.program_id)?.name ?? "",
            i.title,
            i.billing_month ?? "",
            i.due_date ?? "",
            Number(i.amount),
            b.paid,
            b.pending,
            b.remaining,
            i.status,
          ];
        }),
      ]);
    else if (tab === "accounting")
      financeCsv("jurnal", [
        ["Jurnal", "Tanggal", "Akun", "Nama akun", "Debit", "Kredit", "Status"],
        ...journals.flatMap((j) =>
          data.lines
            .filter((l) => l.journal_entry_id === j.id)
            .map((l) => [
              j.entry_number,
              j.entry_date,
              data.accounts.find((a) => a.id === l.account_id)?.code ?? "",
              data.accounts.find((a) => a.id === l.account_id)?.name ?? "",
              Number(l.debit),
              Number(l.credit),
              j.status,
            ]),
        ),
      ]);
    else if (tab === "recurring")
      financeCsv("donatur", [
        [
          "Donatur",
          "Program",
          "Jenis",
          "Nominal",
          "Frekuensi",
          "Tindak lanjut",
          "Status",
        ],
        ...commitments.map((c) => [
          donors.get(c.donor_id)?.full_name ?? "",
          programs.get(c.program_id ?? "")?.name ?? "Umum",
          transactionLabels[c.commitment_type],
          Number(c.amount),
          c.frequency,
          c.next_reminder_at ?? "",
          c.status,
        ]),
      ]);
    else
      financeCsv("transaksi", [
        [
          "Tanggal",
          "Pembayar",
          "Program",
          "Jenis",
          "Nominal",
          "Status",
          "Referensi",
        ],
        ...transactions.map((t) => [
          t.paid_at ?? t.created_at.slice(0, 10),
          t.payer_name ||
            people.get(t.participant_id ?? "")?.display_name ||
            donors.get(t.donor_id ?? "")?.full_name ||
            "",
          programs.get(t.program_id ?? "")?.name ?? "Umum",
          transactionLabels[t.transaction_type],
          Number(t.amount),
          t.status,
          t.reference_number ?? "",
        ]),
      ]);
  }
  return (
    <div className="page-stack finance-workspace">
      <PageHeader
        title="Keuangan"
        eyebrow="Biaya kelas & donasi"
        actions={
          <>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void load()}
              aria-label="Muat ulang keuangan"
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              variant="outline"
              disabled={loading || !!error}
              onClick={() => {
                setPayMode("donation");
                setPayInvoice("");
                setPayCommitment("");
                setForm("payment");
              }}
            >
              <HeartHandshake size={16} />
              Catat donasi
            </Button>
            <Button
              disabled={loading || !!error}
              onClick={() => setForm("invoice")}
            >
              <Plus size={16} />
              Buat tagihan
            </Button>
          </>
        }
      />
      <nav className="finance-nav" aria-label="Menu keuangan">
        {financeTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => go(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {notice && (
        <div
          role="status"
          className="program-notice flex justify-between gap-3"
        >
          {notice}
          <button
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      <div className="finance-filters">
        <label className="certificate-field">
          Program
          <select
            aria-label="Filter program keuangan"
            className="field-control"
            value={program}
            onChange={(e) =>
              update({
                program: e.target.value,
                participant: null,
                invoice: null,
                transaction: null,
                journal: null,
              })
            }
          >
            <option value="all">Semua program</option>
            {data.programs.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {participant && (
          <Button
            variant="outline"
            onClick={() => update({ participant: null })}
          >
            {people.get(participant)?.display_name ?? "Peserta"} ×
          </Button>
        )}
        {tab !== "channels" && tab !== "recurring" && (
          <>
            <label className="certificate-field">
              Dari
              <Input
                type="date"
                aria-label="Dari tanggal"
                value={from}
                onChange={(e) => update({ from: e.target.value })}
              />
            </label>
            <label className="certificate-field">
              Sampai
              <Input
                type="date"
                aria-label="Sampai tanggal"
                min={from}
                value={to}
                onChange={(e) => update({ to: e.target.value })}
              />
            </label>
          </>
        )}
        {(program !== "all" ||
          participant ||
          q ||
          status !== "all" ||
          from ||
          to ||
          params.get("invoiceFilter") ||
          params.get("kind") ||
          params.get("commitmentFilter")) && (
          <Button
            variant="ghost"
            onClick={() =>
              update({
                program: null,
                participant: null,
                q: null,
                status: null,
                from: null,
                to: null,
                invoiceFilter: null,
                kind: null,
                commitmentFilter: null,
              })
            }
          >
            Reset filter
          </Button>
        )}
      </div>
      {error ? (
        <section role="alert" className="finance-panel">
          <h2>Keuangan belum dapat dimuat</h2>
          <p className="program-error">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Coba lagi
          </Button>
        </section>
      ) : loading ? (
        <p role="status" className="certificate-empty">
          Memuat keuangan…
        </p>
      ) : (
        <>
          {tab === "overview" ? (
            <>
              <div className="finance-metrics">
                {[
                  {
                    label: "Penerimaan terverifikasi",
                    value: rupiah(
                      rangeTx
                        .filter((t) => t.status === "verified")
                        .reduce((s, t) => s + Number(t.amount), 0),
                    ),
                    icon: CheckCircle2,
                    tone: "emerald",
                    target: "transactions",
                    status: "verified",
                  },
                  {
                    label: "Menunggu verifikasi",
                    value: rangeTx.filter((t) => t.status === "pending").length,
                    icon: Clock3,
                    tone: "amber",
                    target: "transactions",
                    status: "pending",
                  },
                  {
                    label: "Sisa tagihan",
                    value: rupiah(
                      scopedInvoices
                        .filter((i) => i.status === "open")
                        .reduce(
                          (s, i) =>
                            s + invoiceBalance(i, data.transactions).remaining,
                          0,
                        ),
                    ),
                    icon: ReceiptText,
                    tone: "sky",
                    target: "invoices",
                    status: "open",
                  },
                  {
                    label: "Donasi & wakaf diterima",
                    value: rupiah(
                      rangeTx
                        .filter(
                          (t) =>
                            t.status === "verified" &&
                            ["donation", "wakaf"].includes(t.transaction_type),
                        )
                        .reduce((s, t) => s + Number(t.amount), 0),
                    ),
                    icon: HeartHandshake,
                    tone: "violet",
                    target: "transactions",
                    status: "verified",
                  },
                ].map((m) => (
                  <button
                    key={m.label}
                    className={`finance-metric finance-tone-${m.tone}`}
                    onClick={() =>
                      go(m.target as FinanceTab, {
                        status: m.status,
                        kind: m.tone === "violet" ? "donation" : null,
                        ...(m.target === "invoices"
                          ? { from: null, to: null }
                          : {}),
                      })
                    }
                  >
                    <m.icon size={22} />
                    <span>{m.label}</span>
                    <strong>{m.value}</strong>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
              <div className="finance-columns">
                <section className="finance-panel">
                  <h2>Perlu ditindaklanjuti</h2>
                  <div className="finance-actions-list">
                    <button
                      onClick={() => go("transactions", { status: "pending" })}
                    >
                      <span className="finance-action-icon finance-tone-amber">
                        <Clock3 />
                      </span>
                      <span>
                        <strong>Periksa bukti pembayaran</strong>
                        <small>
                          {rangeTx.filter((t) => t.status === "pending").length}{" "}
                          konfirmasi menunggu
                        </small>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                    <button
                      onClick={() =>
                        go("invoices", {
                          status: "overdue",
                          from: null,
                          to: null,
                        })
                      }
                    >
                      <span className="finance-action-icon finance-tone-rose">
                        <ReceiptText />
                      </span>
                      <span>
                        <strong>Tagihan jatuh tempo</strong>
                        <small>{overdue.length} tagihan belum lunas</small>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                    <button onClick={() => go("recurring", { status: "due" })}>
                      <span className="finance-action-icon finance-tone-violet">
                        <HeartHandshake />
                      </span>
                      <span>
                        <strong>Tindak lanjut donatur</strong>
                        <small>
                          {dueCommitments.length} jadwal hari ini / terlewat
                        </small>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                    <button onClick={() => go("accounting")}>
                      <span className="finance-action-icon finance-tone-sky">
                        <Scale />
                      </span>
                      <span>
                        <strong>Periksa pembukuan lama</strong>
                        <small>
                          {needsPost.length} transaksi perlu rekonsiliasi
                        </small>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </section>
                <section className="finance-panel">
                  <h2>Akses cepat</h2>
                  <div className="finance-quick-links">
                    <Button variant="outline" onClick={() => payment()}>
                      <Banknote size={17} />
                      Catat pembayaran kelas
                    </Button>
                    <Button variant="outline" onClick={() => go("channels")}>
                      <BookOpen size={17} />
                      Atur rekening & QR{" "}
                      <span className="ml-auto">
                        {readyChannels.length} siap
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditCommitment(undefined);
                        setForm("commitment");
                      }}
                    >
                      <HeartHandshake size={17} />
                      Tambah donatur rutin
                    </Button>
                    {program !== "all" && (
                      <Button asChild variant="outline">
                        <Link to={`${base}/program/${program}/peserta`}>
                          Peserta program ↗
                        </Link>
                      </Button>
                    )}
                  </div>
                </section>
              </div>
              <section className="finance-panel">
                <div className="finance-section-heading">
                  <h2>Konfirmasi terbaru</h2>
                  <Button variant="ghost" onClick={() => go("transactions")}>
                    Lihat semua <ArrowRight size={15} />
                  </Button>
                </div>
                <div className="finance-record-list">
                  {rangeTx
                    .slice()
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .slice(0, 5)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => update({ transaction: t.id })}
                      >
                        <span>
                          <strong>
                            {t.payer_name ||
                              people.get(t.participant_id ?? "")
                                ?.display_name ||
                              donors.get(t.donor_id ?? "")?.full_name ||
                              transactionLabels[t.transaction_type]}
                          </strong>
                          <small>
                            {transactionLabels[t.transaction_type]} ·{" "}
                            {t.paid_at ?? t.created_at.slice(0, 10)}
                          </small>
                        </span>
                        <FinanceBadge status={t.status} />
                        <strong>{rupiah(t.amount)}</strong>
                      </button>
                    ))}
                  {!rangeTx.length && (
                    <p className="certificate-empty">
                      Belum ada transaksi pada filter ini.
                    </p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <>
              <div className="finance-section-heading">
                <h2>
                  {financeTabs.find((t) => t.key === tab)?.label}{" "}
                  <small className="text-muted-foreground font-normal">
                    ({list.length})
                  </small>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {tab === "channels" ? (
                    <Button
                      onClick={() => {
                        setEditChannel(undefined);
                        setForm("channel");
                      }}
                    >
                      <Plus size={16} />
                      Tambah rekening / QR
                    </Button>
                  ) : tab === "recurring" ? (
                    <Button
                      onClick={() => {
                        setEditCommitment(undefined);
                        setForm("commitment");
                      }}
                    >
                      <Plus size={16} />
                      Tambah donatur
                    </Button>
                  ) : tab === "transactions" ? (
                    <Button onClick={() => payment()}>
                      <Plus size={16} />
                      Catat pembayaran
                    </Button>
                  ) : null}
                  {tab !== "channels" && (
                    <Button
                      variant="outline"
                      onClick={exportRows}
                      disabled={!list.length}
                    >
                      <Download size={16} />
                      CSV
                    </Button>
                  )}
                </div>
              </div>
              <div className="finance-list-filters">
                <Input
                  aria-label="Cari data keuangan"
                  placeholder={
                    tab === "invoices"
                      ? "Cari peserta, tagihan, atau periode…"
                      : tab === "recurring"
                        ? "Cari donatur…"
                        : "Cari nama atau referensi…"
                  }
                  value={q}
                  onChange={(e) => update({ q: e.target.value })}
                />
                {tab === "transactions" && (
                  <select
                    aria-label="Jenis penerimaan"
                    className="field-control"
                    value={params.get("kind") ?? "all"}
                    onChange={(e) => update({ kind: e.target.value })}
                  >
                    <option value="all">Semua penerimaan</option>
                    <option value="class">Biaya kelas</option>
                    <option value="donation">Donasi & wakaf</option>
                  </select>
                )}
                <select
                  aria-label="Filter status keuangan"
                  className="field-control"
                  value={status}
                  onChange={(e) => update({ status: e.target.value })}
                >
                  <option value="all">Semua status</option>
                  {(tab === "invoices"
                    ? [
                        ["open", "Belum lunas"],
                        ["overdue", "Lewat jatuh tempo"],
                        ["paid", "Lunas"],
                        ["cancelled", "Dibatalkan"],
                      ]
                    : tab === "channels"
                      ? [
                          ["ready", "Siap digunakan"],
                          ["incomplete", "Belum siap / nonaktif"],
                        ]
                      : tab === "recurring"
                        ? [
                            ["active", "Aktif"],
                            ["due", "Perlu tindak lanjut"],
                            ["paused", "Dijeda"],
                            ["completed", "Selesai"],
                          ]
                        : tab === "accounting"
                          ? [
                              ["posted", "Dibukukan"],
                              ["draft", "Draf"],
                              ["void", "Dibatalkan"],
                            ]
                          : [
                              ["pending", "Menunggu verifikasi"],
                              ["verified", "Terverifikasi"],
                              ["rejected", "Ditolak"],
                              ["void", "Dibatalkan"],
                            ]
                  ).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {tab === "invoices" && (
                <div className="finance-card-list">
                  {invoices.slice(start, start + 12).map((i) => {
                    const balance = invoiceBalance(i, data.transactions);
                    return (
                      <article key={i.id} className="finance-invoice-card">
                        <div>
                          <span className="finance-mini-label">
                            {programs.get(i.program_id)?.name}
                          </span>
                          <h3>
                            <button onClick={() => update({ invoice: i.id })}>
                              {i.title}
                            </button>
                          </h3>
                          <Link
                            className="finance-text-link"
                            to={`${base}/peserta/${i.participant_id}?tab=academic`}
                          >
                            {people.get(i.participant_id)?.display_name ??
                              "Peserta"}{" "}
                            ↗
                          </Link>
                          <p className="text-xs text-muted-foreground mt-2">
                            {i.billing_month?.slice(0, 7)}
                            {i.due_date ? ` · Jatuh tempo ${i.due_date}` : ""}
                          </p>
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
                          <small>
                            {balance.paid > 0
                              ? `Dibayar ${rupiah(balance.paid)}`
                              : `Total ${rupiah(i.amount)}`}
                            {balance.pending > 0
                              ? ` · Menunggu ${rupiah(balance.pending)}`
                              : ""}
                          </small>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => update({ invoice: i.id })}
                          >
                            Lihat tagihan
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {tab === "transactions" && (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Pembayar / jenis</th>
                        <th>Program / tanggal</th>
                        <th>Nominal</th>
                        <th>Status</th>
                        <th>
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(start, start + 12).map((t) => (
                        <tr key={t.id}>
                          <td>
                            <button
                              className="finance-text-link"
                              onClick={() => update({ transaction: t.id })}
                            >
                              {t.payer_name ||
                                people.get(t.participant_id ?? "")
                                  ?.display_name ||
                                donors.get(t.donor_id ?? "")?.full_name ||
                                "Pembayar"}
                            </button>
                            <small>
                              {transactionLabels[t.transaction_type]}
                              {t.reference_number
                                ? ` · ${t.reference_number}`
                                : ""}
                            </small>
                          </td>
                          <td>
                            {programs.get(t.program_id ?? "")?.name ??
                              "Donasi umum"}
                            <small>
                              {t.paid_at ?? t.created_at.slice(0, 10)}
                            </small>
                          </td>
                          <td className="font-semibold whitespace-nowrap">
                            {rupiah(t.amount)}
                          </td>
                          <td>
                            <FinanceBadge status={t.status} />
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => update({ transaction: t.id })}
                            >
                              {t.status === "pending" ? "Periksa" : "Detail"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === "channels" && (
                <div className="finance-channel-grid">
                  {channels.slice(start, start + 12).map((c) => (
                    <article key={c.id} className="finance-panel">
                      <div className="finance-section-heading">
                        <span
                          className={`admission-badge admission-tone-${paymentChannelReady(c) ? "emerald" : "amber"}`}
                        >
                          {paymentChannelReady(c)
                            ? "Siap digunakan"
                            : c.is_active
                              ? "Data belum lengkap"
                              : "Nonaktif"}
                        </span>
                        {manageProgram(c.program_id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditChannel(c);
                              setForm("channel");
                            }}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                      <PaymentChannelDisplay channel={c} />
                      <p className="text-xs text-muted-foreground mt-3">
                        {programs.get(c.program_id ?? "")?.name ??
                          "Semua program"}{" "}
                        ·{" "}
                        {c.purpose === "class"
                          ? "Biaya kelas"
                          : c.purpose === "donation"
                            ? "Donasi"
                            : "Kelas & donasi"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
              {tab === "recurring" && (
                <div className="finance-card-list">
                  {commitments.slice(start, start + 12).map((c) => {
                    const donor = donors.get(c.donor_id);
                    const received = data.transactions
                      .filter(
                        (t) =>
                          t.donor_commitment_id === c.id &&
                          t.status === "verified",
                      )
                      .reduce((s, t) => s + Number(t.amount), 0);
                    return (
                      <article key={c.id} className="finance-panel">
                        <div className="finance-section-heading">
                          <div>
                            <h3>{donor?.full_name ?? "Donatur"}</h3>
                            <p className="text-xs text-muted-foreground">
                              {donor?.phone ||
                                donor?.email ||
                                "Belum ada kontak"}{" "}
                              ·{" "}
                              {programs.get(c.program_id ?? "")?.name ??
                                "Donasi umum"}
                            </p>
                          </div>
                          <FinanceBadge status={c.status} />
                        </div>
                        <div className="finance-commitment-summary">
                          <span>
                            <strong>{rupiah(c.amount)}</strong>
                            <small>
                              {transactionLabels[c.commitment_type]} ·{" "}
                              {c.frequency === "monthly"
                                ? "Bulanan"
                                : c.frequency === "quarterly"
                                  ? "Tiga bulanan"
                                  : c.frequency === "yearly"
                                    ? "Tahunan"
                                    : "Sekali"}
                            </small>
                          </span>
                          <span>
                            <small>Tindak lanjut</small>
                            <strong>
                              {c.next_reminder_at ?? "Belum dijadwalkan"}
                            </strong>
                          </span>
                          <span>
                            <small>Diterima</small>
                            <strong>{rupiah(received)}</strong>
                          </span>
                        </div>
                        {c.wakaf_asset && (
                          <p className="text-sm mb-3">Aset: {c.wakaf_asset}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => payment("", c.id)}
                          >
                            Catat pembayaran
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              go("transactions", {
                                commitmentFilter: c.id,
                                from: null,
                                to: null,
                              })
                            }
                          >
                            Riwayat donasi
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFollowup(c);
                              setFollowupNote("");
                              setNextDate(
                                nextFinanceReminder(
                                  financeDate(),
                                  c.frequency,
                                  c.reminder_day_of_month ?? 1,
                                ) ?? "",
                              );
                            }}
                          >
                            Catat tindak lanjut
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditCommitment(c);
                              setForm("commitment");
                            }}
                          >
                            Edit komitmen
                          </Button>
                          {donor?.participant_id && (
                            <Button asChild variant="ghost" size="sm">
                              <Link
                                to={`${base}/peserta/${donor.participant_id}`}
                              >
                                Profil peserta ↗
                              </Link>
                            </Button>
                          )}
                        </div>
                        {c.reminder_notes && (
                          <details className="mt-3 text-sm">
                            <summary>Catatan tindak lanjut</summary>
                            <p className="whitespace-pre-wrap mt-2 text-muted-foreground">
                              {c.reminder_notes}
                            </p>
                          </details>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              {tab === "accounting" && (
                <>
                  <div className="finance-accounting-summary">
                    <span>
                      Debit <strong>{rupiah(debit)}</strong>
                    </span>
                    <span>
                      Kredit <strong>{rupiah(credit)}</strong>
                    </span>
                    <span
                      className={
                        Math.abs(debit - credit) < 0.001
                          ? "text-emerald-700"
                          : "text-red-700"
                      }
                    >
                      {Math.abs(debit - credit) < 0.001
                        ? "Seimbang"
                        : `Selisih ${rupiah(debit - credit)}`}
                    </span>
                  </div>
                  {needsPost.length > 0 && (
                    <div className="program-notice flex justify-between flex-wrap gap-3">
                      <span>
                        {needsPost.length} transaksi lama perlu diperiksa /
                        dibukukan.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirm("post")}
                      >
                        Tinjau rekonsiliasi
                      </Button>
                    </div>
                  )}
                  <div className="finance-table-wrap">
                    <table className="finance-table">
                      <thead>
                        <tr>
                          <th>Jurnal</th>
                          <th>Tanggal</th>
                          <th>Debit</th>
                          <th>Kredit</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journals.slice(start, start + 12).map((j) => {
                          const ls = data.lines.filter(
                            (l) => l.journal_entry_id === j.id,
                          );
                          return (
                            <tr key={j.id}>
                              <td>
                                <button
                                  className="finance-text-link"
                                  onClick={() => update({ journal: j.id })}
                                >
                                  {j.entry_number}
                                </button>
                                <small>{j.description}</small>
                              </td>
                              <td>{j.entry_date}</td>
                              <td>
                                {rupiah(
                                  ls.reduce((s, l) => s + Number(l.debit), 0),
                                )}
                              </td>
                              <td>
                                {rupiah(
                                  ls.reduce((s, l) => s + Number(l.credit), 0),
                                )}
                              </td>
                              <td>
                                <FinanceBadge status={j.status} />
                                {ls.length < 2 && (
                                  <small className="text-amber-700">
                                    Rincian belum lengkap
                                  </small>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <details className="program-disclosure mt-4">
                    <summary>Bagan akun & saldo pada filter ini</summary>
                    <div className="finance-table-wrap">
                      <table className="finance-table">
                        <thead>
                          <tr>
                            <th>Kode</th>
                            <th>Akun</th>
                            <th>Debit</th>
                            <th>Kredit</th>
                            <th>Saldo normal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.accounts.map((a) => {
                            const ls = lines.filter(
                              (l) => l.account_id === a.id,
                            );
                            const d = ls.reduce(
                                (s, l) => s + Number(l.debit),
                                0,
                              ),
                              c = ls.reduce((s, l) => s + Number(l.credit), 0);
                            return (
                              <tr key={a.id}>
                                <td>{a.code}</td>
                                <td>
                                  {a.name}
                                  {!a.is_active ? " (nonaktif)" : ""}
                                </td>
                                <td>{rupiah(d)}</td>
                                <td>{rupiah(c)}</td>
                                <td>
                                  {rupiah(
                                    a.normal_balance === "debit"
                                      ? d - c
                                      : c - d,
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
              {!list.length && (
                <div className="certificate-empty">
                  Tidak ada data pada filter ini.
                  {tab === "channels" && (
                    <p>Tambahkan rekening atau unggah QR pembayaran resmi.</p>
                  )}
                </div>
              )}
              <FinancePagination
                page={page}
                pages={pages}
                onChange={(n) => update({ page: String(n) })}
              />
            </>
          )}
        </>
      )}
      {form === "invoice" && (
        <InvoiceCreateDialog
          data={managedData}
          initialProgram={program}
          onClose={() => setForm(null)}
          onSaved={(ids) => {
            saved(`${ids.length} tagihan dibuat.`);
            go("invoices");
          }}
        />
      )}
      {form === "channel" && (
        <PaymentChannelDialog
          data={managedData}
          channel={editChannel}
          globalAccess={globalAccess}
          initialProgram={program}
          onClose={() => setForm(null)}
          onSaved={() => saved("Rekening / QR tersimpan.")}
        />
      )}
      {form === "payment" && (
        <PaymentReportDialog
          data={managedData}
          staff
          globalAccess={globalAccess}
          initialProgram={program}
          initialInvoiceId={payInvoice}
          initialMode={payMode}
          initialCommitmentId={payCommitment}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            saved("Konfirmasi masuk ke antrean verifikasi.");
            go("transactions", { transaction: id });
          }}
        />
      )}
      {form === "commitment" && (
        <DonorCommitmentDialog
          data={managedData}
          commitment={editCommitment}
          globalAccess={globalAccess}
          initialProgram={program}
          onClose={() => setForm(null)}
          onSaved={() => saved("Komitmen donatur tersimpan.")}
        />
      )}
      {detailTx && (
        <FinanceTransactionDialog
          transaction={detailTx}
          data={data}
          staff={manageProgram(detailTx.program_id)}
          base={base}
          onClose={() => update({ transaction: null })}
          onSaved={() => {
            setNotice("Pembayaran diperbarui.");
            update({ transaction: null });
            void load();
          }}
          onInvoice={(id) => update({ transaction: null, invoice: id })}
        />
      )}
      {detailInvoice && (
        <Dialog
          title={detailInvoice.title}
          onClose={() => update({ invoice: null })}
        >
          <div className="flex justify-between items-center">
            <strong className="text-2xl">{rupiah(detailInvoice.amount)}</strong>
            <FinanceBadge status={detailInvoice.status} />
          </div>
          <dl className="certificate-summary my-5">
            <div>
              <dt>Peserta</dt>
              <dd>
                <Link
                  className="finance-text-link"
                  to={`${base}/peserta/${detailInvoice.participant_id}?tab=academic`}
                >
                  {people.get(detailInvoice.participant_id)?.display_name} ↗
                </Link>
              </dd>
            </div>
            <div>
              <dt>Program</dt>
              <dd>
                <Link
                  className="finance-text-link"
                  to={`${base}/program/${detailInvoice.program_id}/peserta`}
                >
                  {programs.get(detailInvoice.program_id)?.name} ↗
                </Link>
              </dd>
            </div>
            <div>
              <dt>Jatuh tempo</dt>
              <dd>{detailInvoice.due_date ?? "Tidak ditentukan"}</dd>
            </div>
            <div>
              <dt>Dibayar</dt>
              <dd>
                {rupiah(invoiceBalance(detailInvoice, data.transactions).paid)}
              </dd>
            </div>
            <div>
              <dt>Menunggu verifikasi</dt>
              <dd>
                {rupiah(
                  invoiceBalance(detailInvoice, data.transactions).pending,
                )}
              </dd>
            </div>
            <div>
              <dt>Sisa tagihan</dt>
              <dd>
                {rupiah(
                  invoiceBalance(detailInvoice, data.transactions).remaining,
                )}
              </dd>
            </div>
          </dl>
          <div className="finance-record-list">
            {data.transactions
              .filter((t) => t.invoice_id === detailInvoice.id)
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
          <div className="flex flex-wrap gap-2 mt-5">
            {detailInvoice.status === "open" &&
              invoiceBalance(detailInvoice, data.transactions).available >
                0 && (
                <Button
                  onClick={() => {
                    const iid = detailInvoice.id;
                    update({ invoice: null });
                    payment(iid);
                  }}
                >
                  Catat pembayaran
                </Button>
              )}
            <Button
              variant="outline"
              onClick={() =>
                go("transactions", { invoiceFilter: detailInvoice.id })
              }
            >
              Riwayat pembayaran
            </Button>
            {manageProgram(detailInvoice.program_id) &&
              detailInvoice.status === "open" &&
              invoiceBalance(detailInvoice, data.transactions).paid +
                invoiceBalance(detailInvoice, data.transactions).pending ===
                0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setReason("");
                    setConfirm("cancel");
                  }}
                >
                  Batalkan tagihan
                </Button>
              )}
          </div>
        </Dialog>
      )}
      {detailJournal && (
        <Dialog
          title="Rincian jurnal"
          onClose={() => update({ journal: null })}
        >
          <p className="font-semibold break-all">
            {detailJournal.entry_number}
          </p>
          <p className="text-sm text-muted-foreground my-3">
            {detailJournal.description} · {detailJournal.entry_date}
          </p>
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Akun</th>
                  <th>Debit</th>
                  <th>Kredit</th>
                </tr>
              </thead>
              <tbody>
                {data.lines
                  .filter((l) => l.journal_entry_id === detailJournal.id)
                  .map((l) => (
                    <tr key={l.id}>
                      <td>
                        {data.accounts.find((a) => a.id === l.account_id)
                          ?.name ?? "Akun"}
                      </td>
                      <td>{rupiah(l.debit)}</td>
                      <td>{rupiah(l.credit)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {journalTx(detailJournal) && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() =>
                update({
                  journal: null,
                  transaction: journalTx(detailJournal)!.id,
                })
              }
            >
              Buka transaksi asal
            </Button>
          )}
        </Dialog>
      )}
      {confirm === "cancel" && detailInvoice && (
        <FinanceConfirm
          title="Batalkan tagihan?"
          label="Batalkan tagihan"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            if (!reason.trim()) throw new Error("Isi alasan pembatalan.");
            await financeRpc("finance_cancel_invoice", {
              p_id: detailInvoice.id,
              p_notes: reason,
              p_expected_updated_at: detailInvoice.updated_at,
            });
            setNotice("Tagihan dibatalkan.");
            update({ invoice: null });
            void load();
          }}
        >
          <p>
            {detailInvoice.title} · {rupiah(detailInvoice.amount)}
          </p>
          <label className="certificate-field mt-4">
            Alasan
            <textarea
              aria-label="Alasan pembatalan tagihan"
              className="field-control min-h-24"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </FinanceConfirm>
      )}
      {confirm === "post" && (
        <FinanceConfirm
          title="Rekonsiliasi pembukuan lama?"
          label="Bukukan transaksi"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const eligible = needsPost
              .filter((t) => manageProgram(t.program_id))
              .slice(0, 200);
            if (!eligible.length)
              throw new Error("Tidak ada transaksi dalam cakupan Anda.");
            const r = await financeRpc<{ processed: number }>(
              "finance_post_transactions",
              { p_ids: eligible.map((t) => t.id) },
            );
            if (r.processed !== eligible.length)
              throw new Error("Hasil belum terkonfirmasi. Muat ulang.");
            setNotice(`${r.processed} transaksi direkonsiliasi.`);
            void load();
          }}
        >
          <p className="text-sm">
            Maksimal 200 transaksi pada cakupan program dan peserta ini. Jurnal
            tidak digandakan; rincian lama yang tidak sesuai nominal harus
            diperiksa sebelum dapat dibukukan.
          </p>
          <div className="finance-roster mt-4">
            {needsPost.slice(0, 200).map((t) => (
              <p key={t.id} className="text-sm p-2">
                {t.payer_name ||
                  people.get(t.participant_id ?? "")?.display_name ||
                  transactionLabels[t.transaction_type]}{" "}
                · {rupiah(t.amount)} · <FinanceBadge status={t.status} />
              </p>
            ))}
          </div>
        </FinanceConfirm>
      )}
      {followup && (
        <FinanceConfirm
          title="Catat tindak lanjut donatur"
          label="Simpan catatan"
          onClose={() => setFollowup(null)}
          onConfirm={async () => {
            if (!followupNote.trim())
              throw new Error("Isi catatan tindak lanjut.");
            await financeRpc("finance_record_followup", {
              p_id: followup.id,
              p_next_date: nextDate || null,
              p_notes: followupNote,
              p_expected_updated_at: followup.updated_at,
            });
            setNotice("Tindak lanjut dicatat.");
            void load();
          }}
        >
          <p className="font-semibold">
            {donors.get(followup.donor_id)?.full_name}
          </p>
          <label className="certificate-field my-4">
            Catatan
            <textarea
              aria-label="Catatan tindak lanjut"
              className="field-control min-h-24"
              value={followupNote}
              maxLength={2000}
              onChange={(e) => setFollowupNote(e.target.value)}
            />
          </label>
          <label className="certificate-field">
            Jadwal berikutnya (opsional)
            <Input
              aria-label="Jadwal tindak lanjut berikutnya"
              type="date"
              value={nextDate}
              min={financeDate()}
              onChange={(e) => setNextDate(e.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground mt-3">
            Catatan internal; pesan WhatsApp atau email dikirim oleh admin
            secara terpisah.
          </p>
        </FinanceConfirm>
      )}
    </div>
  );
}
