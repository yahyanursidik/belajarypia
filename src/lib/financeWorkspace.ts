export type FinanceProgram = {
  unit_id?: string | null;
  id: string;
  name: string;
  code: string;
  status: string;
  feature_flags: Record<string, unknown>;
};
export type FinanceParticipant = {
  id: string;
  display_name: string;
  global_participant_number: string;
  phone: string | null;
  status: string;
};
export type FinanceEnrollment = {
  id: string;
  participant_id: string;
  program_id: string;
  batch_id: string | null;
  class_id: string | null;
  enrollment_number: string;
  enrollment_status: string;
  payment_status: string;
};
export type PaymentChannel = {
  id: string;
  name: string;
  channel_type: "bank" | "qris" | "external" | "cash";
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  qris_image_url: string | null;
  qr_document_id?: string | null;
  external_url: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
  purpose?: "both" | "class" | "donation";
  program_id?: string | null;
  asset_account_id?: string | null;
  updated_at: string;
};
export type FinanceInvoice = {
  id: string;
  invoice_number: string;
  enrollment_id: string;
  participant_id: string;
  program_id: string;
  title: string;
  amount: number;
  invoice_type: "spp" | "registration" | "education_infaq";
  billing_month: string | null;
  due_date: string | null;
  status: "open" | "paid" | "cancelled";
  created_at: string;
  updated_at: string;
};
export type FinanceTransaction = {
  id: string;
  participant_id: string | null;
  program_id: string | null;
  enrollment_id?: string | null;
  invoice_id?: string | null;
  donor_id: string | null;
  donor_commitment_id: string | null;
  payment_channel_id: string | null;
  amount: number;
  transaction_type: TransactionType;
  status: "pending" | "verified" | "rejected" | "void";
  billing_month: string | null;
  notes: string | null;
  payer_name?: string | null;
  reference_number?: string | null;
  paid_at?: string | null;
  proof_document_id?: string | null;
  review_notes?: string | null;
  channel_snapshot?: PaymentChannel | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
};
export type TransactionType =
  "spp" | "registration" | "education_infaq" | "donation" | "wakaf" | "other";
export type FinanceDonor = {
  id: string;
  participant_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
};
export type DonorCommitment = {
  id: string;
  donor_id: string;
  program_id: string | null;
  channel_id: string | null;
  commitment_type: "donation" | "wakaf" | "education_infaq";
  amount: number;
  frequency: "once" | "monthly" | "quarterly" | "yearly";
  reminder_day_of_month: number | null;
  next_reminder_at: string | null;
  status: "active" | "paused" | "completed";
  contact_preference: "whatsapp" | "email" | "phone";
  reminder_notes: string | null;
  wakaf_asset: string | null;
  wakaf_asset_value: number | null;
  wakaf_purpose: string | null;
  wakaf_external_url: string | null;
  wakaf_contact_admin: boolean;
  created_at: string;
  updated_at: string;
};
export type FinanceAccount = {
  id: string;
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
  normal_balance: "debit" | "credit";
  is_active: boolean;
};
export type FinanceJournal = {
  id: string;
  entry_number: string;
  transaction_id: string | null;
  reverses_entry_id?: string | null;
  entry_date: string;
  description: string;
  status: "draft" | "posted" | "void";
  created_at: string;
};
export type FinanceLine = {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  memo: string | null;
};
export type FinanceData = {
  programs: FinanceProgram[];
  participants: FinanceParticipant[];
  enrollments: FinanceEnrollment[];
  channels: PaymentChannel[];
  invoices: FinanceInvoice[];
  transactions: FinanceTransaction[];
  donors: FinanceDonor[];
  commitments: DonorCommitment[];
  accounts: FinanceAccount[];
  journals: FinanceJournal[];
  lines: FinanceLine[];
};
export const financeTabs = [
  { key: "overview", label: "Ringkasan" },
  { key: "invoices", label: "Tagihan kelas" },
  { key: "transactions", label: "Transaksi" },
  { key: "channels", label: "Rekening & QR" },
  { key: "recurring", label: "Donatur rutin" },
  { key: "accounting", label: "Jurnal & laporan" },
] as const;
export type FinanceTab = (typeof financeTabs)[number]["key"];
export const transactionLabels: Record<TransactionType, string> = {
  spp: "Biaya bulanan",
  registration: "Pendaftaran",
  education_infaq: "Biaya kelas",
  donation: "Donasi",
  wakaf: "Wakaf",
  other: "Lainnya",
};
export const financeStatus: Record<string, { label: string; tone: string }> = {
  pending: { label: "Menunggu verifikasi", tone: "amber" },
  verified: { label: "Terverifikasi", tone: "emerald" },
  rejected: { label: "Ditolak", tone: "rose" },
  void: { label: "Dibatalkan", tone: "slate" },
  open: { label: "Belum lunas", tone: "amber" },
  paid: { label: "Lunas", tone: "emerald" },
  cancelled: { label: "Dibatalkan", tone: "slate" },
  active: { label: "Aktif", tone: "emerald" },
  paused: { label: "Dijeda", tone: "amber" },
  completed: { label: "Selesai", tone: "slate" },
  posted: { label: "Dibukukan", tone: "emerald" },
  draft: { label: "Draf", tone: "slate" },
};
export function rupiah(value: unknown) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}
export function validMoney(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    String(value).trim() === ""
  )
    return false;
  const n = Number(value);
  return (
    Number.isFinite(n) &&
    n > 0 &&
    n <= 9999999999.99 &&
    Math.abs(n * 100 - Math.round(n * 100)) < 0.0001
  );
}
export function financeDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function invoiceBalance(
  invoice: FinanceInvoice,
  transactions: FinanceTransaction[],
) {
  const own = transactions.filter((t) => t.invoice_id === invoice.id);
  const cents = (value: unknown) => Math.round(Number(value) * 100);
  const paid = own
    .filter((t) => t.status === "verified")
    .reduce((sum, t) => sum + cents(t.amount), 0);
  const pending = own
    .filter((t) => t.status === "pending")
    .reduce((sum, t) => sum + cents(t.amount), 0);
  const total = cents(invoice.amount);
  return {
    paid: paid / 100,
    pending: pending / 100,
    remaining: Math.max(0, total - paid) / 100,
    available: Math.max(0, total - paid - pending) / 100,
  };
}
export function safeFinanceUrl(value: string | null | undefined) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
export function paymentChannelReady(channel: PaymentChannel) {
  if (!channel.is_active) return false;
  if (channel.channel_type === "bank")
    return (
      !!channel.bank_name?.trim() &&
      !!channel.account_holder?.trim() &&
      /^(?!0+$)\d{6,30}$/.test(
        (channel.account_number ?? "").replace(/[\s-]/g, ""),
      )
    );
  if (channel.channel_type === "qris")
    return (
      !!channel.account_holder?.trim() &&
      !!(channel.qr_document_id || safeFinanceUrl(channel.qris_image_url))
    );
  if (channel.channel_type === "external")
    return !!safeFinanceUrl(channel.external_url);
  return channel.channel_type === "cash";
}
export function channelsForPurpose(
  channels: PaymentChannel[],
  purpose: "class" | "donation",
  program?: string | null,
) {
  return channels.filter(
    (c) =>
      paymentChannelReady(c) &&
      (!c.program_id || c.program_id === program) &&
      (!c.purpose || c.purpose === "both" || c.purpose === purpose),
  );
}
export function financeError(
  error: unknown,
  fallback = "Perubahan belum tersimpan. Coba lagi.",
) {
  const e = error as { code?: string; message?: string };
  if (
    e?.code === "PGRST202" ||
    /schema cache|does not exist|could not find/i.test(e?.message ?? "")
  )
    return "Layanan keuangan belum siap. Hubungi pengelola sistem.";
  return e?.message || fallback;
}
export function financePage(value: string | null) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
}
export function validateFinanceFile(
  file: Pick<File, "name" | "type" | "size">,
  purpose: "proof" | "qr",
) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  if (
    !ext ||
    !types[ext] ||
    (purpose === "qr" && ext === "pdf") ||
    /^(audio|video)\//.test(file.type) ||
    (file.type && file.type !== types[ext])
  )
    return (
      "Gunakan JPG, PNG, WebP" + (purpose === "proof" ? " atau PDF." : ".")
    );
  if (file.size < 1 || file.size > 5 * 1024 * 1024)
    return "Ukuran dokumen maksimal 5 MB.";
  return "";
}
export function nextFinanceReminder(
  date: string,
  frequency: string,
  day: number,
) {
  const [y, m, d] = date.split("-").map(Number);
  if (!Number.isInteger(day) || day < 1 || day > 28 || !y || !m || !d)
    throw new Error("Tanggal pengingat belum valid.");
  if (frequency === "once") return null;
  const months =
    frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  const next = new Date(Date.UTC(y, m - 1 + months, day));
  return next.toISOString().slice(0, 10);
}
export function financeTotals(
  data: Pick<FinanceData, "transactions" | "journals" | "lines">,
) {
  const posted = new Set(
    data.journals.filter((j) => j.status === "posted").map((j) => j.id),
  );
  const lines = data.lines.filter((l) => posted.has(l.journal_entry_id));
  return {
    verified: data.transactions
      .filter((t) => t.status === "verified")
      .reduce((s, t) => s + Number(t.amount), 0),
    pending: data.transactions
      .filter((t) => t.status === "pending")
      .reduce((s, t) => s + Number(t.amount), 0),
    debit: lines.reduce((s, l) => s + Number(l.debit), 0),
    credit: lines.reduce((s, l) => s + Number(l.credit), 0),
  };
}
