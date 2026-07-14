import { useCallback, useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  AlertCircle,
  BadgeDollarSign,
  Ban,
  Banknote,
  Calculator,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  HandCoins,
  HeartHandshake,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Scale,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "../../lib/supabase";

type FinanceTab = "overview" | "transactions" | "channels" | "recurring" | "accounting";

type TransactionType = "spp" | "registration" | "education_infaq" | "donation" | "wakaf" | "other";
type TransactionStatus = "pending" | "verified" | "rejected" | "void";
type ChannelType = "bank" | "qris" | "external" | "cash";
type CommitmentType = "donation" | "wakaf" | "education_infaq";
type CommitmentFrequency = "once" | "monthly" | "quarterly" | "yearly";
type CommitmentStatus = "active" | "paused" | "completed";
type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
type NormalBalance = "debit" | "credit";
type JournalStatus = "draft" | "posted" | "void";

type Participant = {
  id: string;
  display_name: string | null;
  global_participant_number: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  status?: string | null;
};

type Program = {
  id: string;
  name: string | null;
  code?: string | null;
  status?: string | null;
};

type PaymentChannel = {
  id: string;
  name: string;
  channel_type: ChannelType;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  qris_image_url: string | null;
  external_url: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number | null;
};

type DonorProfile = {
  id: string;
  participant_id?: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
};

type DonorCommitment = {
  id: string;
  donor_id: string;
  program_id: string | null;
  channel_id: string | null;
  commitment_type: CommitmentType;
  amount: number;
  frequency: CommitmentFrequency;
  reminder_day_of_month: number | null;
  next_reminder_at: string | null;
  status: CommitmentStatus;
  contact_preference: "whatsapp" | "email" | "phone";
  reminder_notes: string | null;
  wakaf_asset: string | null;
  wakaf_asset_value: number | null;
  wakaf_purpose: string | null;
  wakaf_external_url: string | null;
  wakaf_contact_admin: boolean | null;
  created_at: string;
};

type FinanceAccount = {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  is_active: boolean;
  sort_order: number | null;
};

type JournalEntry = {
  id: string;
  entry_number: string;
  transaction_id: string | null;
  entry_date: string;
  description: string;
  status: JournalStatus;
  created_at: string;
};

type JournalLine = {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  memo: string | null;
};

type TransactionRow = {
  id: string;
  participant_id: string | null;
  program_id: string | null;
  donor_id?: string | null;
  donor_commitment_id?: string | null;
  payment_channel_id?: string | null;
  amount: number;
  transaction_type: TransactionType;
  status: TransactionStatus;
  billing_month: string | null;
  created_at: string;
  notes: string | null;
};

type TransactionView = TransactionRow & {
  participantName: string;
  participantNumber: string;
  programName: string;
  donorName: string;
  channelName: string;
};

type TransactionForm = {
  participant_id: string;
  program_id: string;
  donor_id: string;
  donor_name: string;
  donor_phone: string;
  payment_channel_id: string;
  amount: number;
  transaction_type: TransactionType;
  status: TransactionStatus;
  billing_month: string;
  notes: string;
};

type ChannelForm = {
  name: string;
  channel_type: ChannelType;
  bank_name: string;
  account_number: string;
  account_holder: string;
  qris_image_url: string;
  external_url: string;
  instructions: string;
  is_active: boolean;
};

type CommitmentForm = {
  source_type: "participant" | "external";
  participant_id: string;
  donor_id: string;
  donor_name: string;
  donor_phone: string;
  donor_email: string;
  program_id: string;
  channel_id: string;
  commitment_type: CommitmentType;
  amount: number;
  frequency: CommitmentFrequency;
  reminder_day_of_month: number;
  next_reminder_at: string;
  contact_preference: "whatsapp" | "email" | "phone";
  reminder_notes: string;
  wakaf_asset: string;
  wakaf_asset_value: number;
  wakaf_purpose: string;
  wakaf_external_url: string;
  wakaf_contact_admin: boolean;
};

type MetricCard = {
  label: string;
  value: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
};

const tabs: Array<{ value: FinanceTab; label: string; description: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "overview", label: "Ringkasan", description: "Kas dan prioritas", icon: ClipboardList },
  { value: "transactions", label: "Transaksi", description: "SPP, infaq, wakaf", icon: BadgeDollarSign },
  { value: "channels", label: "Kanal Pembayaran", description: "Bank, QRIS, tautan", icon: WalletCards },
  { value: "recurring", label: "Donatur Rutin", description: "Reminder dan komitmen", icon: CalendarClock },
  { value: "accounting", label: "Akuntansi", description: "COA, jurnal, laporan", icon: Calculator },
];

const initialTransactionForm: TransactionForm = {
  participant_id: "",
  program_id: "",
  donor_id: "",
  donor_name: "",
  donor_phone: "",
  payment_channel_id: "",
  amount: 0,
  transaction_type: "spp",
  status: "verified",
  billing_month: format(new Date(), "yyyy-MM-01"),
  notes: "",
};

const initialChannelForm: ChannelForm = {
  name: "",
  channel_type: "bank",
  bank_name: "",
  account_number: "",
  account_holder: "",
  qris_image_url: "",
  external_url: "",
  instructions: "",
  is_active: true,
};

const initialCommitmentForm: CommitmentForm = {
  source_type: "participant",
  participant_id: "",
  donor_id: "",
  donor_name: "",
  donor_phone: "",
  donor_email: "",
  program_id: "",
  channel_id: "",
  commitment_type: "donation",
  amount: 0,
  frequency: "monthly",
  reminder_day_of_month: Number(format(new Date(), "d")),
  next_reminder_at: format(new Date(), "yyyy-MM-dd"),
  contact_preference: "whatsapp",
  reminder_notes: "",
  wakaf_asset: "",
  wakaf_asset_value: 0,
  wakaf_purpose: "",
  wakaf_external_url: "",
  wakaf_contact_admin: true,
};

const LEGACY_INSTITUTION_NAMES = ["Yayasan Pendidikan Islam Al Atsari"];
const OFFICIAL_INSTITUTION_NAME = "Yayasan Pendidikan Ihsanul Adab";

function normalizeInstitutionText(value: string | null): string | null {
  if (!value) return value;
  return LEGACY_INSTITUTION_NAMES.reduce(
    (current, legacyName) => current.replaceAll(legacyName, OFFICIAL_INSTITUTION_NAME),
    value,
  );
}

function normalizePaymentChannel(channel: PaymentChannel): PaymentChannel {
  return {
    ...channel,
    account_holder: normalizeInstitutionText(channel.account_holder),
    instructions: normalizeInstitutionText(channel.instructions),
  };
}

function currency(value: number): string {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function normalizeDate(value: string | null): string {
  if (!value) return "-";
  return format(new Date(value), "dd MMM yyyy", { locale: id });
}

function transactionTypeLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    spp: "Infaq Bulanan",
    registration: "Pendaftaran",
    education_infaq: "Sumbangan Pendidikan",
    donation: "Donasi",
    wakaf: "Wakaf",
    other: "Lainnya",
  };
  return labels[type] ?? type;
}

function commitmentTypeLabel(type: CommitmentType): string {
  const labels: Record<CommitmentType, string> = {
    donation: "Donasi",
    wakaf: "Wakaf",
    education_infaq: "Sumbangan Pendidikan",
  };
  return labels[type] ?? type;
}

function channelTypeLabel(type: ChannelType): string {
  const labels: Record<ChannelType, string> = {
    bank: "Transfer Bank",
    qris: "QRIS",
    external: "Tautan Eksternal",
    cash: "Tunai",
  };
  return labels[type] ?? type;
}

function accountTypeLabel(type: AccountType): string {
  const labels: Record<AccountType, string> = {
    asset: "Aset",
    liability: "Kewajiban",
    equity: "Ekuitas",
    revenue: "Pendapatan",
    expense: "Beban",
  };
  return labels[type] ?? type;
}

function revenueAccountCode(type: TransactionType): string {
  const codes: Record<TransactionType, string> = {
    spp: "4100",
    education_infaq: "4100",
    donation: "4200",
    wakaf: "4300",
    registration: "4400",
    other: "4900",
  };
  return codes[type] ?? "4900";
}

function statusBadge(status: TransactionStatus | CommitmentStatus) {
  if (status === "verified" || status === "active") {
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Aktif</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Menunggu</Badge>;
  }
  if (status === "void" || status === "paused") {
    return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Ditahan</Badge>;
  }
  if (status === "completed") {
    return <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Selesai</Badge>;
  }
  return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Ditolak</Badge>;
}

function addReminderInterval(date: string | null, frequency: CommitmentFrequency, reminderDay?: number | null): string {
  const baseDate = date ? new Date(date) : new Date();
  const nextDate = new Date(baseDate);
  if (frequency === "quarterly") nextDate.setMonth(nextDate.getMonth() + 3);
  else if (frequency === "yearly") nextDate.setFullYear(nextDate.getFullYear() + 1);
  else if (frequency === "once") nextDate.setMonth(nextDate.getMonth() + 1);
  else nextDate.setMonth(nextDate.getMonth() + 1);
  if (reminderDay) nextDate.setDate(Math.min(Math.max(reminderDay, 1), 28));
  return format(nextDate, "yyyy-MM-dd");
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object" || !("message" in error)) return "Terjadi kendala saat memuat data keuangan.";
  return String((error as { message?: string }).message ?? "Terjadi kendala saat memuat data keuangan.");
}

function isMissingTable(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find");
}

export function AdminFinancePage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = searchParams.get("tab");
  const activeTab = tabs.some((tab) => tab.value === activeTabParam) ? (activeTabParam as FinanceTab) : "overview";
  const basePrefix = location.pathname.startsWith("/system") ? "/system" : "/admin";
  const [transactions, setTransactions] = useState<TransactionView[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [donors, setDonors] = useState<DonorProfile[]>([]);
  const [commitments, setCommitments] = useState<DonorCommitment[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLines, setJournalLines] = useState<JournalLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPostingJournals, setIsPostingJournals] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [donationSchemaReady, setDonationSchemaReady] = useState(true);
  const [accountingSchemaReady, setAccountingSchemaReady] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<TransactionType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | "all">("all");
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isCommitmentModalOpen, setIsCommitmentModalOpen] = useState(false);
  const [transactionForm, setTransactionForm] = useState<TransactionForm>(initialTransactionForm);
  const [channelForm, setChannelForm] = useState<ChannelForm>(initialChannelForm);
  const [commitmentForm, setCommitmentForm] = useState<CommitmentForm>(initialCommitmentForm);

  const changeTab = (tab: FinanceTab) => {
    setSearchParams(tab === "overview" ? {} : { tab });
  };

  const mapTransactions = useCallback(
    (rows: TransactionRow[], participantRows: Participant[], programRows: Program[], donorRows: DonorProfile[], channelRows: PaymentChannel[]) => {
      const participantMap = new Map(participantRows.map((participant) => [participant.id, participant]));
      const programMap = new Map(programRows.map((program) => [program.id, program]));
      const donorMap = new Map(donorRows.map((donor) => [donor.id, donor]));
      const channelMap = new Map(channelRows.map((channel) => [channel.id, channel]));

      return rows.map((transaction) => {
        const participant = transaction.participant_id ? participantMap.get(transaction.participant_id) : null;
        const program = transaction.program_id ? programMap.get(transaction.program_id) : null;
        const donor = transaction.donor_id ? donorMap.get(transaction.donor_id) : null;
        const channel = transaction.payment_channel_id ? channelMap.get(transaction.payment_channel_id) : null;

        return {
          ...transaction,
          participantName: participant?.display_name ?? "-",
          participantNumber: participant?.global_participant_number ?? "",
          programName: program?.name ?? "-",
          donorName: donor?.full_name ?? "-",
          channelName: channel?.name ?? "-",
        };
      });
    },
    [],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const [transactionRes, participantRes, programRes, channelRes, donorRes, commitmentRes, accountRes, journalEntryRes, journalLineRes] = await Promise.all([
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("participants").select("id,display_name,global_participant_number,phone,city,status").order("display_name"),
      supabase.from("programs").select("id,name,code,status").order("name"),
      supabase.from("donation_payment_channels").select("*").order("sort_order", { ascending: true }),
      supabase.from("donor_profiles").select("*").order("full_name"),
      supabase.from("donor_commitments").select("*").order("next_reminder_at", { ascending: true }),
      supabase.from("finance_accounts").select("*").order("sort_order", { ascending: true }),
      supabase.from("finance_journal_entries").select("*").order("entry_date", { ascending: false }).limit(100),
      supabase.from("finance_journal_lines").select("*"),
    ]);

    if (transactionRes.error) setErrorMessage(getErrorMessage(transactionRes.error));
    if (participantRes.error) setErrorMessage(getErrorMessage(participantRes.error));
    if (programRes.error) setErrorMessage(getErrorMessage(programRes.error));

    const donationErrors = [channelRes.error, donorRes.error, commitmentRes.error].filter(Boolean);
    if (donationErrors.length > 0) {
      setDonationSchemaReady(!donationErrors.some((error) => isMissingTable(error)));
      setErrorMessage(getErrorMessage(donationErrors[0]));
    } else {
      setDonationSchemaReady(true);
    }

    const accountingErrors = [accountRes.error, journalEntryRes.error, journalLineRes.error].filter(Boolean);
    if (accountingErrors.length > 0) {
      setAccountingSchemaReady(!accountingErrors.some((error) => isMissingTable(error)));
      if (!accountingErrors.some((error) => isMissingTable(error))) setErrorMessage(getErrorMessage(accountingErrors[0]));
    } else {
      setAccountingSchemaReady(true);
    }

    const participantRows = (participantRes.data ?? []) as Participant[];
    const programRows = (programRes.data ?? []) as Program[];
    const channelRows = ((channelRes.data ?? []) as PaymentChannel[]).map(normalizePaymentChannel);
    const donorRows = (donorRes.data ?? []) as DonorProfile[];
    const transactionRows = (transactionRes.data ?? []) as TransactionRow[];

    setParticipants(participantRows);
    setPrograms(programRows);
    setChannels(channelRows);
    setDonors(donorRows);
    setCommitments((commitmentRes.data ?? []) as DonorCommitment[]);
    setAccounts((accountRes.data ?? []) as FinanceAccount[]);
    setJournalEntries((journalEntryRes.data ?? []) as JournalEntry[]);
    setJournalLines((journalLineRes.data ?? []) as JournalLine[]);
    setTransactions(mapTransactions(transactionRows, participantRows, programRows, donorRows, channelRows));
    setIsLoading(false);
  }, [mapTransactions]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activePrograms = useMemo(() => programs.filter((program) => program.status !== "archived"), [programs]);
  const activeChannels = useMemo(() => channels.filter((channel) => channel.is_active), [channels]);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesSearch =
        !query ||
        transaction.participantName.toLowerCase().includes(query) ||
        transaction.programName.toLowerCase().includes(query) ||
        transaction.donorName.toLowerCase().includes(query) ||
        transaction.channelName.toLowerCase().includes(query) ||
        (transaction.notes ?? "").toLowerCase().includes(query);
      const matchesType = filterType === "all" || transaction.transaction_type === filterType;
      const matchesStatus = filterStatus === "all" || transaction.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [filterStatus, filterType, searchQuery, transactions]);

  const monthTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((transaction) => {
      const createdAt = new Date(transaction.created_at);
      return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear() && transaction.status === "verified";
    });
  }, [transactions]);

  const totalMonthlyInfaq = monthTransactions
    .filter((transaction) => transaction.transaction_type === "spp" || transaction.transaction_type === "education_infaq")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalDonation = monthTransactions
    .filter((transaction) => transaction.transaction_type === "donation" || transaction.transaction_type === "wakaf")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const pendingTotal = transactions
    .filter((transaction) => transaction.status === "pending")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const reminderDue = commitments.filter((commitment) => {
    if (commitment.status !== "active" || !commitment.next_reminder_at) return false;
    return new Date(commitment.next_reminder_at) <= new Date();
  });

  const donorMap = useMemo(() => new Map(donors.map((donor) => [donor.id, donor])), [donors]);
  const participantMap = useMemo(() => new Map(participants.map((participant) => [participant.id, participant])), [participants]);
  const programMap = useMemo(() => new Map(programs.map((program) => [program.id, program])), [programs]);
  const channelMap = useMemo(() => new Map(channels.map((channel) => [channel.id, channel])), [channels]);
  const participantDonorIds = useMemo(
    () => new Set(donors.filter((donor) => donor.participant_id).map((donor) => donor.id)),
    [donors],
  );
  const participantCommitments = useMemo(
    () => commitments.filter((commitment) => participantDonorIds.has(commitment.donor_id)),
    [commitments, participantDonorIds],
  );
  const activeParticipantDonorIds = useMemo(
    () => new Set(participantCommitments.filter((commitment) => commitment.status === "active").map((commitment) => commitment.donor_id)),
    [participantCommitments],
  );
  const participantProspects = useMemo(
    () =>
      participants
        .filter((participant) => participant.status !== "archived")
        .filter((participant) => {
          const donor = donors.find((item) => item.participant_id === participant.id);
          return !donor || !activeParticipantDonorIds.has(donor.id);
        })
        .slice(0, 6),
    [activeParticipantDonorIds, donors, participants],
  );
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const journaledTransactionIds = useMemo(
    () => new Set(journalEntries.map((entry) => entry.transaction_id).filter((transactionId): transactionId is string => Boolean(transactionId))),
    [journalEntries],
  );
  const unjournaledVerifiedTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.status === "verified" &&
          transaction.amount > 0 &&
          !journaledTransactionIds.has(transaction.id),
      ),
    [journaledTransactionIds, transactions],
  );
  const accountingDebitTotal = journalLines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const accountingCreditTotal = journalLines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const accountingDifference = accountingDebitTotal - accountingCreditTotal;
  const revenueLines = useMemo(
    () =>
      journalLines
        .map((line) => ({ ...line, account: accountMap.get(line.account_id) }))
        .filter((line) => line.account?.account_type === "revenue" && line.credit > 0),
    [accountMap, journalLines],
  );
  const revenueByAccount = useMemo(() => {
    const grouped = new Map<string, { account: FinanceAccount; amount: number }>();
    revenueLines.forEach((line) => {
      if (!line.account) return;
      const current = grouped.get(line.account.id);
      grouped.set(line.account.id, {
        account: line.account,
        amount: (current?.amount ?? 0) + Number(line.credit || 0),
      });
    });
    return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
  }, [revenueLines]);

  const metrics: MetricCard[] = [
    {
      label: "Infaq Pendidikan Bulan Ini",
      value: currency(totalMonthlyInfaq),
      description: "Gabungan infaq bulanan kelas/program dan sumbangan pendidikan.",
      icon: HandCoins,
      tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      label: "Donasi & Wakaf Bulan Ini",
      value: currency(totalDonation),
      description: "Pemasukan donasi umum dan wakaf yang sudah diverifikasi.",
      icon: HeartHandshake,
      tone: "bg-sky-50 text-sky-700 border-sky-200",
    },
    {
      label: "Menunggu Konfirmasi",
      value: currency(pendingTotal),
      description: `${transactions.filter((transaction) => transaction.status === "pending").length} transaksi perlu dicek.`,
      icon: CalendarClock,
      tone: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      label: "Reminder Donatur",
      value: reminderDue.length.toLocaleString("id-ID"),
      description: `${commitments.filter((commitment) => commitment.status === "active").length} komitmen rutin aktif.`,
      icon: Send,
      tone: "bg-violet-50 text-violet-700 border-violet-200",
    },
  ];

  const ensureDonationSchema = () => {
    if (!donationSchemaReady) {
      alert("Tabel donasi/wakaf belum tersedia. Jalankan migrasi 202607140001_finance_donation_wakaf.sql terlebih dahulu.");
      return false;
    }
    return true;
  };

  const ensureAccountingSchema = () => {
    if (!accountingSchemaReady) {
      alert("Tabel akuntansi belum tersedia. Jalankan migrasi 202607140006_finance_accounting.sql terlebih dahulu.");
      return false;
    }
    return true;
  };

  const createDonorIfNeeded = async (
    name: string,
    phone: string,
    email = "",
    participantId: string | null = null,
    city = "",
  ): Promise<string | null> => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const { data, error } = await supabase
      .from("donor_profiles")
      .insert({
        participant_id: participantId,
        full_name: trimmedName,
        phone: phone.trim() || null,
        email: email.trim() || null,
        city: city.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data?.id ?? null;
  };

  const resolveParticipantDonor = async (participantId: string): Promise<string> => {
    const participant = participants.find((item) => item.id === participantId);
    if (!participant) throw new Error("Peserta LMS belum dipilih.");

    const existingDonor = donors.find((donor) => donor.participant_id === participantId);
    if (existingDonor) return existingDonor.id;

    const donorId = await createDonorIfNeeded(
      participant.display_name ?? "Peserta LMS",
      participant.phone ?? "",
      participant.email ?? "",
      participantId,
      participant.city ?? "",
    );
    if (!donorId) throw new Error("Profil donatur dari peserta belum bisa dibuat.");
    return donorId;
  };

  const handleTransactionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (["donation", "wakaf"].includes(transactionForm.transaction_type) && !ensureDonationSchema()) return;
    setIsSubmitting(true);
    try {
      let donorId = transactionForm.donor_id || null;
      if (!donorId && transactionForm.donor_name.trim()) {
        donorId = await createDonorIfNeeded(transactionForm.donor_name, transactionForm.donor_phone);
      }

      const payload = {
        participant_id: transactionForm.participant_id || null,
        program_id: transactionForm.program_id || null,
        donor_id: donorId,
        payment_channel_id: transactionForm.payment_channel_id || null,
        amount: transactionForm.amount,
        transaction_type: transactionForm.transaction_type,
        billing_month: transactionForm.billing_month || null,
        notes: transactionForm.notes.trim() || null,
        status: transactionForm.status,
      };

      const { error } = await supabase.from("transactions").insert(payload);
      if (error) throw new Error(error.message);

      setIsTransactionModalOpen(false);
      setTransactionForm(initialTransactionForm);
      await loadData();
    } catch (error) {
      alert(`Gagal menyimpan transaksi: ${getErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChannelSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ensureDonationSchema()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("donation_payment_channels").insert({
        name: channelForm.name.trim(),
        channel_type: channelForm.channel_type,
        bank_name: channelForm.bank_name.trim() || null,
        account_number: channelForm.account_number.trim() || null,
        account_holder: channelForm.account_holder.trim() || null,
        qris_image_url: channelForm.qris_image_url.trim() || null,
        external_url: channelForm.external_url.trim() || null,
        instructions: channelForm.instructions.trim() || null,
        is_active: channelForm.is_active,
        sort_order: channels.length * 10 + 10,
      });
      if (error) throw new Error(error.message);
      setIsChannelModalOpen(false);
      setChannelForm(initialChannelForm);
      await loadData();
    } catch (error) {
      alert(`Gagal menyimpan kanal pembayaran: ${getErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommitmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ensureDonationSchema()) return;
    setIsSubmitting(true);
    try {
      let donorId = commitmentForm.donor_id || null;
      if (commitmentForm.source_type === "participant") {
        donorId = await resolveParticipantDonor(commitmentForm.participant_id);
      } else if (!donorId) {
        donorId = await createDonorIfNeeded(commitmentForm.donor_name, commitmentForm.donor_phone, commitmentForm.donor_email);
      }
      if (!donorId) throw new Error("Nama donatur wajib diisi.");

      const { error } = await supabase.from("donor_commitments").insert({
        donor_id: donorId,
        program_id: commitmentForm.program_id || null,
        channel_id: commitmentForm.channel_id || null,
        commitment_type: commitmentForm.commitment_type,
        amount: commitmentForm.amount,
        frequency: commitmentForm.frequency,
        reminder_day_of_month: commitmentForm.reminder_day_of_month || null,
        next_reminder_at: commitmentForm.next_reminder_at || null,
        status: "active",
        contact_preference: commitmentForm.contact_preference,
        reminder_notes: commitmentForm.reminder_notes.trim() || null,
        wakaf_asset: commitmentForm.commitment_type === "wakaf" ? commitmentForm.wakaf_asset.trim() || null : null,
        wakaf_asset_value: commitmentForm.commitment_type === "wakaf" ? commitmentForm.wakaf_asset_value || null : null,
        wakaf_purpose: commitmentForm.commitment_type === "wakaf" ? commitmentForm.wakaf_purpose.trim() || null : null,
        wakaf_external_url: commitmentForm.commitment_type === "wakaf" ? commitmentForm.wakaf_external_url.trim() || null : null,
        wakaf_contact_admin: commitmentForm.commitment_type === "wakaf" ? commitmentForm.wakaf_contact_admin : true,
      });
      if (error) throw new Error(error.message);
      setIsCommitmentModalOpen(false);
      setCommitmentForm(initialCommitmentForm);
      await loadData();
    } catch (error) {
      alert(`Gagal menyimpan donatur rutin: ${getErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoidTransaction = async (transactionId: string) => {
    if (!window.confirm("Batalkan transaksi ini? Transaksi void tidak dihitung dalam laporan.")) return;
    setIsSubmitting(true);
    const { error } = await supabase.from("transactions").update({ status: "void" }).eq("id", transactionId);
    if (error) alert(`Gagal membatalkan transaksi: ${error.message}`);
    await loadData();
    setIsSubmitting(false);
  };

  const handleToggleChannel = async (channel: PaymentChannel) => {
    if (!ensureDonationSchema()) return;
    const { error } = await supabase.from("donation_payment_channels").update({ is_active: !channel.is_active }).eq("id", channel.id);
    if (error) alert(`Gagal mengubah status kanal: ${error.message}`);
    await loadData();
  };

  const handleReminderSent = async (commitment: DonorCommitment) => {
    if (!ensureDonationSchema()) return;
    const nextReminder = addReminderInterval(commitment.next_reminder_at, commitment.frequency, commitment.reminder_day_of_month);
    const notes = [
      commitment.reminder_notes,
      `Reminder dikirim ${format(new Date(), "dd MMM yyyy", { locale: id })}. Berikutnya ${normalizeDate(nextReminder)}.`,
    ].filter(Boolean).join("\n");
    const { error } = await supabase
      .from("donor_commitments")
      .update({ next_reminder_at: nextReminder, reminder_notes: notes })
      .eq("id", commitment.id);
    if (error) alert(`Gagal memperbarui reminder: ${error.message}`);
    await loadData();
  };

  const handleGenerateJournals = async () => {
    if (!ensureAccountingSchema()) return;
    if (unjournaledVerifiedTransactions.length === 0) {
      alert("Semua transaksi terverifikasi sudah memiliki jurnal.");
      return;
    }

    const cashAccount = accounts.find((account) => account.code === "1010" && account.is_active);
    if (!cashAccount) {
      alert("Akun kas 1010 belum tersedia atau tidak aktif. Jalankan seed akun pada migrasi akuntansi.");
      return;
    }

    setIsPostingJournals(true);
    try {
      for (const transaction of unjournaledVerifiedTransactions) {
        const revenueAccount = accounts.find((account) => account.code === revenueAccountCode(transaction.transaction_type) && account.is_active);
        if (!revenueAccount) throw new Error(`Akun pendapatan untuk ${transactionTypeLabel(transaction.transaction_type)} belum tersedia.`);

        const { data: entryData, error: entryError } = await supabase
          .from("finance_journal_entries")
          .insert({
            entry_number: `JRN-${format(new Date(), "yyyyMMddHHmmss")}-${transaction.id.slice(0, 6)}`,
            transaction_id: transaction.id,
            entry_date: format(new Date(transaction.created_at), "yyyy-MM-dd"),
            description: `Pencatatan ${transactionTypeLabel(transaction.transaction_type)} - ${
              transaction.donorName !== "-" ? transaction.donorName : transaction.participantName
            }`,
            status: "posted",
          })
          .select("id")
          .single();

        if (entryError) throw entryError;
        if (!entryData?.id) throw new Error("Jurnal berhasil dibuat tetapi ID jurnal tidak terbaca.");

        const { error: lineError } = await supabase.from("finance_journal_lines").insert([
          {
            journal_entry_id: entryData.id,
            account_id: cashAccount.id,
            debit: transaction.amount,
            credit: 0,
            memo: transaction.channelName !== "-" ? transaction.channelName : null,
          },
          {
            journal_entry_id: entryData.id,
            account_id: revenueAccount.id,
            debit: 0,
            credit: transaction.amount,
            memo: transaction.programName !== "-" ? transaction.programName : transactionTypeLabel(transaction.transaction_type),
          },
        ]);

        if (lineError) throw lineError;
      }

      await loadData();
    } catch (error) {
      alert(`Gagal membuat jurnal otomatis: ${getErrorMessage(error)}`);
    } finally {
      setIsPostingJournals(false);
    }
  };

  const copyText = async (value: string | null) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  const openCommitmentModal = (participant?: Participant) => {
    setCommitmentForm({
      ...initialCommitmentForm,
      source_type: participant ? "participant" : "participant",
      participant_id: participant?.id ?? "",
      donor_name: participant?.display_name ?? "",
      donor_phone: participant?.phone ?? "",
      donor_email: participant?.email ?? "",
    });
    setIsCommitmentModalOpen(true);
  };

  const renderChannelIcon = (type: ChannelType) => {
    if (type === "qris") return <QrCode className="h-5 w-5" />;
    if (type === "external") return <ExternalLink className="h-5 w-5" />;
    if (type === "cash") return <Banknote className="h-5 w-5" />;
    return <WalletCards className="h-5 w-5" />;
  };

  return (
    <div className="page-stack pb-12">
      <section className="page-hero">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="hidden h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner backdrop-blur-sm sm:flex">
              <HeartHandshake className="h-8 w-8 text-white" />
            </div>
            <div>
              <Badge variant="secondary" className="mb-3 border-white/30 bg-white/20 text-white shadow-sm backdrop-blur-sm">
                KEUANGAN & AKUNTANSI
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight text-white">Buku Kas, Donasi & Akuntansi</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
                Kelola infaq bulanan program, donasi, wakaf, kanal pembayaran, reminder donatur rutin, dan jurnal akuntansi dari satu alur kerja.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="bg-white !text-primary hover:bg-white/90" onClick={() => void loadData()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Muat Ulang
            </Button>
            <Button type="button" variant="secondary" className="bg-white/15 text-white hover:bg-white/25" onClick={() => setIsChannelModalOpen(true)}>
              <WalletCards className="mr-2 h-4 w-4" />
              Kanal
            </Button>
            <Button type="button" variant="secondary" className="bg-white/15 text-white hover:bg-white/25" onClick={() => setIsTransactionModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Transaksi
            </Button>
          </div>
        </div>
      </section>

      {errorMessage && (
        <Alert className={cn("mt-6", donationSchemaReady ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900")}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{donationSchemaReady ? "Sebagian data belum termuat" : "Migrasi donasi belum tersedia"}</AlertTitle>
          <AlertDescription>
            {donationSchemaReady ? errorMessage : "Jalankan migrasi 202607140001_finance_donation_wakaf.sql, 202607140004_link_donor_profiles_to_participants.sql, dan 202607140005_wakaf_commitment_details_and_reminder_day.sql agar kanal pembayaran, donatur rutin, relasi peserta LMS, dan detail wakaf bisa digunakan."}
          </AlertDescription>
        </Alert>
      )}

      {!accountingSchemaReady && (
        <Alert className="mt-6 border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Migrasi akuntansi belum tersedia</AlertTitle>
          <AlertDescription>
            Jalankan migrasi 202607140006_finance_accounting.sql agar tab Akuntansi, bagan akun, jurnal otomatis, dan ringkasan debit/kredit bisa digunakan.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{isLoading ? "-" : metric.value}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{metric.description}</p>
                </div>
                <div className={cn("rounded-xl border p-2", metric.tone)}>
                  <metric.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => changeTab(tab.value)}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors",
              activeTab === tab.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card hover:bg-muted/50",
            )}
          >
            <div className="flex items-center gap-2">
              <tab.icon className="h-4 w-4" />
              <span className="font-semibold">{tab.label}</span>
            </div>
            <p className={cn("mt-1 text-xs", activeTab === tab.value ? "text-primary-foreground/80" : "text-muted-foreground")}>{tab.description}</p>
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Workflow Keuangan & Donasi</CardTitle>
              <CardDescription>Alur standar agar pencatatan infaq, donasi, dan wakaf tertib.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {[
                { title: "1. Siapkan kanal", desc: "Aktifkan rekening bank, QRIS, atau tautan eksternal resmi.", icon: WalletCards },
                { title: "2. Catat transaksi", desc: "Masukkan SPP/infaq pendidikan, donasi umum, wakaf, atau pendaftaran.", icon: BadgeDollarSign },
                { title: "3. Verifikasi mutasi", desc: "Gunakan status pending sebelum bukti transfer valid.", icon: CheckCircle2 },
                { title: "4. Follow up rutin", desc: "Kelola donatur bulanan dengan tanggal reminder berikutnya.", icon: CalendarClock },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Reminder Terdekat</CardTitle>
              <CardDescription>Donatur rutin yang perlu dihubungi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reminderDue.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-primary/70" />
                  <p className="mt-2 text-sm font-medium">Tidak ada reminder jatuh tempo</p>
                  <p className="mt-1 text-xs text-muted-foreground">Semua komitmen rutin masih sesuai jadwal.</p>
                </div>
              ) : (
                reminderDue.slice(0, 5).map((commitment) => {
                  const donor = donorMap.get(commitment.donor_id);
                  return (
                    <div key={commitment.id} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{donor?.full_name ?? "Donatur"}</p>
                          <p className="text-xs text-muted-foreground">
                            {commitmentTypeLabel(commitment.commitment_type)} - {currency(commitment.amount)}
                          </p>
                          <p className="mt-1 text-xs text-amber-700">Jadwal: {normalizeDate(commitment.next_reminder_at)}</p>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleReminderSent(commitment)}>
                          <Send className="mr-2 h-3.5 w-3.5" />
                          Terkirim
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm xl:col-span-2">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Kanal Donasi Aktif</CardTitle>
                <CardDescription>Informasi yang bisa dibagikan ke calon donatur atau wali peserta.</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => changeTab("channels")}>Kelola Kanal</Button>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {activeChannels.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center md:col-span-3">
                  <WalletCards className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Belum ada kanal aktif</p>
                  <Button type="button" className="mt-4" onClick={() => setIsChannelModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Kanal
                  </Button>
                </div>
              ) : (
                activeChannels.slice(0, 6).map((channel) => (
                  <div key={channel.id} className="rounded-lg border border-border/60 p-4">
                    <div className="mb-3 flex items-center gap-2 text-primary">
                      {renderChannelIcon(channel.channel_type)}
                      <span className="font-semibold text-foreground">{channel.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{channelTypeLabel(channel.channel_type)}</p>
                    {channel.bank_name && <p className="mt-2 text-sm font-medium">{channel.bank_name}</p>}
                    {channel.account_number && (
                      <button type="button" className="mt-1 flex items-center gap-2 text-sm text-primary" onClick={() => void copyText(channel.account_number)}>
                        {channel.account_number}
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {channel.external_url && (
                      <a className="mt-2 inline-flex items-center gap-1 text-sm text-primary" href={channel.external_url} target="_blank" rel="noreferrer">
                        Buka tautan
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle>Fitur Terkait</CardTitle>
              <CardDescription>Dampak modul keuangan pada workflow pendaftaran, peserta, layanan, sertifikat, dan akuntansi.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-5">
              {[
                { title: "Pendaftaran", desc: "Biaya daftar dan bukti bayar calon peserta.", href: `${basePrefix}/pendaftaran`, icon: ClipboardList },
                { title: "Peserta", desc: "Infaq pendidikan dan status administrasi peserta.", href: `${basePrefix}/peserta`, icon: Users },
                { title: "Helpdesk", desc: "Tiket pembayaran, donasi, dan wakaf.", href: `${basePrefix}/helpdesk`, icon: AlertCircle },
                { title: "Sertifikat", desc: "Validasi administrasi sebelum syahadah.", href: `${basePrefix}/sertifikat`, icon: CheckCircle2 },
                { title: "Akuntansi", desc: "Jurnal otomatis dan laporan debit/kredit.", href: `${basePrefix}/keuangan?tab=accounting`, icon: Calculator },
              ].map((item) => (
                <Link key={item.title} to={item.href} className="rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5">
                  <item.icon className="h-5 w-5 text-primary" />
                  <p className="mt-2 font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "transactions" && (
        <Card className="mt-6 border-border/60 shadow-sm">
          <CardHeader className="flex flex-col gap-4 border-b md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Riwayat Transaksi</CardTitle>
              <CardDescription>SPP/infaq bulanan, pendaftaran, sumbangan pendidikan, donasi, dan wakaf.</CardDescription>
            </div>
            <Button type="button" onClick={() => setIsTransactionModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Transaksi
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Cari peserta, program, donatur, kanal..." className="pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex h-10 items-center gap-2 rounded-md border bg-background px-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <select className="bg-transparent text-sm outline-none" value={filterType} onChange={(event) => setFilterType(event.target.value as TransactionType | "all")}>
                    <option value="all">Semua Tipe</option>
                    <option value="spp">Infaq Bulanan</option>
                    <option value="education_infaq">Sumbangan Pendidikan</option>
                    <option value="donation">Donasi</option>
                    <option value="wakaf">Wakaf</option>
                    <option value="registration">Pendaftaran</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
                <div className="flex h-10 items-center rounded-md border bg-background px-3">
                  <select className="bg-transparent text-sm outline-none" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as TransactionStatus | "all")}>
                    <option value="all">Semua Status</option>
                    <option value="verified">Terverifikasi</option>
                    <option value="pending">Menunggu</option>
                    <option value="rejected">Ditolak</option>
                    <option value="void">Void</option>
                  </select>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                Memuat data transaksi...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <BadgeDollarSign className="mx-auto mb-3 h-12 w-12 opacity-20" />
                <p>Belum ada transaksi sesuai filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Tanggal</th>
                      <th className="px-5 py-3 font-semibold">Sumber</th>
                      <th className="px-5 py-3 font-semibold">Program/Kanal</th>
                      <th className="px-5 py-3 font-semibold">Tipe</th>
                      <th className="px-5 py-3 text-right font-semibold">Nominal</th>
                      <th className="px-5 py-3 text-center font-semibold">Status</th>
                      <th className="px-5 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className={cn("transition-colors hover:bg-muted/40", transaction.status === "void" && "opacity-60")}>
                        <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                          {format(new Date(transaction.created_at), "dd MMM yyyy, HH:mm", { locale: id })}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-foreground">
                            {transaction.donorName !== "-" ? transaction.donorName : transaction.participantName}
                          </p>
                          <p className="text-xs text-muted-foreground">{transaction.participantNumber || transaction.notes || "-"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-foreground">{transaction.programName}</p>
                          <p className="text-xs text-muted-foreground">{transaction.channelName}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium">{transactionTypeLabel(transaction.transaction_type)}</p>
                          <p className="text-xs text-muted-foreground">{transaction.billing_month ? format(new Date(transaction.billing_month), "MMMM yyyy", { locale: id }) : "-"}</p>
                        </td>
                        <td className={cn("px-5 py-4 text-right font-semibold", transaction.status === "void" && "line-through")}>{currency(transaction.amount)}</td>
                        <td className="px-5 py-4 text-center">{statusBadge(transaction.status)}</td>
                        <td className="px-5 py-4 text-right">
                          {transaction.status !== "void" && (
                            <Button type="button" size="sm" variant="ghost" className="text-muted-foreground hover:bg-red-50 hover:text-red-700" disabled={isSubmitting} onClick={() => void handleVoidTransaction(transaction.id)}>
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "channels" && (
        <Card className="mt-6 border-border/60 shadow-sm">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Kanal Pembayaran Donasi/Wakaf</CardTitle>
              <CardDescription>Kelola rekening bank, QRIS, tunai, atau tautan eksternal resmi.</CardDescription>
            </div>
            <Button type="button" onClick={() => setIsChannelModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Kanal
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {channels.map((channel) => (
              <Card key={channel.id} className="border-border/60 shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-primary/10 p-2 text-primary">{renderChannelIcon(channel.channel_type)}</div>
                      <div>
                        <h3 className="font-semibold text-foreground">{channel.name}</h3>
                        <p className="text-xs text-muted-foreground">{channelTypeLabel(channel.channel_type)}</p>
                      </div>
                    </div>
                    {channel.is_active ? (
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700">Aktif</Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-200 text-slate-600">Nonaktif</Badge>
                    )}
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    {channel.bank_name && <p><span className="text-muted-foreground">Bank:</span> {channel.bank_name}</p>}
                    {channel.account_holder && <p><span className="text-muted-foreground">Atas nama:</span> {channel.account_holder}</p>}
                    {channel.account_number && (
                      <button type="button" className="flex items-center gap-2 text-primary" onClick={() => void copyText(channel.account_number)}>
                        {channel.account_number}
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {channel.qris_image_url && <p className="break-all text-xs text-muted-foreground">QRIS: {channel.qris_image_url}</p>}
                    {channel.external_url && (
                      <a href={channel.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                        Buka tautan pembayaran
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {channel.instructions && <p className="rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">{channel.instructions}</p>}
                  </div>
                  <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => void handleToggleChannel(channel)}>
                    {channel.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "recurring" && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Komitmen Aktif", value: commitments.filter((item) => item.status === "active").length, icon: HeartHandshake, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { label: "Dari Peserta LMS", value: participantCommitments.length, icon: Users, tone: "bg-sky-50 text-sky-700 border-sky-200" },
              { label: "Reminder Jatuh Tempo", value: reminderDue.length, icon: CalendarClock, tone: "bg-amber-50 text-amber-700 border-amber-200" },
              { label: "Prospek Peserta", value: participantProspects.length, icon: UserPlus, tone: "bg-violet-50 text-violet-700 border-violet-200" },
            ].map((item) => (
              <Card key={item.label} className="border-border/60 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="mt-2 text-2xl font-bold">{item.value.toLocaleString("id-ID")}</p>
                    </div>
                    <div className={cn("rounded-xl border p-2", item.tone)}>
                      <item.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Donatur Rutin & Reminder</CardTitle>
              <CardDescription>Kelola komitmen donasi/wakaf/infaq rutin dan tanggal follow up berikutnya.</CardDescription>
            </div>
            <Button type="button" onClick={() => openCommitmentModal()}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Donatur Rutin
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { title: "Pilih sumber", desc: "Ambil dari peserta LMS atau input donatur eksternal.", icon: Users },
                { title: "Tetapkan komitmen", desc: "Jenis, nominal, frekuensi, program tujuan, dan kanal.", icon: HandCoins },
                { title: "Follow up", desc: "Tandai reminder terkirim agar jadwal berikutnya otomatis maju.", icon: Send },
              ].map((step) => (
                <div key={step.title} className="rounded-lg border border-border/60 p-3">
                  <step.icon className="h-5 w-5 text-primary" />
                  <p className="mt-2 font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>

            {commitments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 font-medium">Belum ada donatur rutin</p>
                <p className="mt-1 text-sm text-muted-foreground">Tambahkan komitmen agar reminder bisa dikelola.</p>
              </div>
            ) : (
              commitments.map((commitment) => {
                const donor = donorMap.get(commitment.donor_id);
                const linkedParticipant = donor?.participant_id ? participantMap.get(donor.participant_id) : null;
                const program = commitment.program_id ? programMap.get(commitment.program_id) : null;
                const channel = commitment.channel_id ? channelMap.get(commitment.channel_id) : null;
                const due = commitment.status === "active" && commitment.next_reminder_at && new Date(commitment.next_reminder_at) <= new Date();

                return (
                  <div key={commitment.id} className={cn("rounded-lg border p-4", due ? "border-amber-200 bg-amber-50/40" : "border-border/60")}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{donor?.full_name ?? "Donatur"}</h3>
                          {linkedParticipant && <Badge variant="outline" className="border-sky-200 text-sky-700">Peserta LMS</Badge>}
                          {statusBadge(commitment.status)}
                          {due && <Badge variant="outline" className="border-amber-200 text-amber-700">Perlu reminder</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {commitmentTypeLabel(commitment.commitment_type)} - {currency(commitment.amount)} - {commitment.frequency}
                        </p>
                        {commitment.reminder_day_of_month && (
                          <p className="mt-1 text-xs text-primary">
                            Reminder rutin setiap tanggal {commitment.reminder_day_of_month}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[program?.name ?? "Tanpa program khusus", channel?.name ?? "Kanal belum dipilih", donor?.phone ?? donor?.email ?? "Kontak belum diisi"].join(" - ")}
                        </p>
                        {commitment.commitment_type === "wakaf" && (
                          <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
                            <p className="font-semibold text-foreground">Detail Wakaf</p>
                            <p className="mt-1">Objek: {commitment.wakaf_asset || "Belum diisi"}</p>
                            <p>Nilai estimasi: {commitment.wakaf_asset_value ? currency(commitment.wakaf_asset_value) : "Belum diisi"}</p>
                            <p>Peruntukan: {commitment.wakaf_purpose || "Belum diisi"}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {commitment.wakaf_external_url && (
                                <a href={commitment.wakaf_external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                                  Link wakaf
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {commitment.wakaf_contact_admin && <Badge variant="outline" className="border-primary/20 text-primary">Hubungi admin</Badge>}
                            </div>
                          </div>
                        )}
                        {linkedParticipant && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            No. peserta: {linkedParticipant.global_participant_number || "-"} - {linkedParticipant.status || "status belum ada"}
                          </p>
                        )}
                        <p className="hidden">
                          {program?.name ?? "Tanpa program khusus"} · {channel?.name ?? "Kanal belum dipilih"} · {donor?.phone ?? donor?.email ?? "Kontak belum diisi"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-md border bg-background px-3 py-2 text-sm">
                          Reminder: <span className="font-medium">{normalizeDate(commitment.next_reminder_at)}</span>
                        </div>
                        <Button type="button" variant="outline" onClick={() => void handleReminderSent(commitment)}>
                          <Send className="mr-2 h-4 w-4" />
                          Tandai Terkirim
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Peserta LMS Potensial</CardTitle>
            <CardDescription>Peserta yang bisa ditambahkan sebagai donatur rutin pendidikan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {participantProspects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                Semua peserta aktif sudah memiliki komitmen aktif atau belum ada peserta yang tersedia.
              </div>
            ) : (
              participantProspects.map((participant) => (
                <div key={participant.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{participant.display_name || "Peserta"}</p>
                      <p className="text-xs text-muted-foreground">{participant.global_participant_number || "Nomor peserta belum ada"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{participant.phone || participant.email || "Kontak belum diisi"}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => openCommitmentModal(participant)}>
                      <UserPlus className="mr-2 h-3.5 w-3.5" />
                      Tambah
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {activeTab === "accounting" && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Debit", value: currency(accountingDebitTotal), icon: Scale, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { label: "Total Kredit", value: currency(accountingCreditTotal), icon: Scale, tone: "bg-sky-50 text-sky-700 border-sky-200" },
              { label: "Selisih", value: currency(Math.abs(accountingDifference)), icon: AlertCircle, tone: Math.abs(accountingDifference) < 0.01 ? "bg-primary/10 text-primary border-primary/20" : "bg-red-50 text-red-700 border-red-200" },
              { label: "Belum Dijurnal", value: unjournaledVerifiedTransactions.length.toLocaleString("id-ID"), icon: FileSpreadsheet, tone: "bg-amber-50 text-amber-700 border-amber-200" },
            ].map((item) => (
              <Card key={item.label} className="border-border/60 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="mt-2 text-2xl font-bold">{item.value}</p>
                    </div>
                    <div className={cn("rounded-xl border p-2", item.tone)}>
                      <item.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Workflow Akuntansi Keuangan</CardTitle>
                <CardDescription>Bagan akun, jurnal otomatis, dan laporan ringkas untuk pemasukan LMS, donasi, serta wakaf.</CardDescription>
              </div>
              <Button type="button" onClick={() => void handleGenerateJournals()} disabled={!accountingSchemaReady || isPostingJournals || unjournaledVerifiedTransactions.length === 0}>
                {isPostingJournals ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                Buat Jurnal Otomatis
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  { title: "1. Verifikasi", desc: "Transaksi masuk dicek bukti bayar dan statusnya dibuat verified.", icon: CheckCircle2 },
                  { title: "2. Posting", desc: "Sistem membuat jurnal debit kas dan kredit pendapatan.", icon: FileSpreadsheet },
                  { title: "3. Rekonsiliasi", desc: "Debit dan kredit dipantau agar selalu seimbang.", icon: Scale },
                  { title: "4. Laporan", desc: "Pendapatan dipisah per akun: infaq, donasi, wakaf, pendaftaran.", icon: Calculator },
                ].map((step) => (
                  <div key={step.title} className="rounded-lg border border-border/60 p-3">
                    <step.icon className="h-5 w-5 text-primary" />
                    <p className="mt-2 font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                ))}
              </div>

              {!accountingSchemaReady && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Akuntansi belum aktif</AlertTitle>
                  <AlertDescription>Jalankan migrasi akuntansi terlebih dahulu, lalu muat ulang halaman.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>Bagan Akun</CardTitle>
                <CardDescription>Akun dasar untuk kas, piutang, ekuitas, pendapatan, wakaf, dan beban.</CardDescription>
              </CardHeader>
              <CardContent>
                {accounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Belum ada akun. Jalankan migrasi akuntansi untuk membuat bagan akun awal.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border/60">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Kode</th>
                          <th className="px-4 py-3 font-semibold">Nama Akun</th>
                          <th className="px-4 py-3 font-semibold">Tipe</th>
                          <th className="px-4 py-3 font-semibold">Normal</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {accounts.map((account) => (
                          <tr key={account.id} className="hover:bg-muted/30">
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{account.code}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{account.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{accountTypeLabel(account.account_type)}</td>
                            <td className="px-4 py-3 capitalize text-muted-foreground">{account.normal_balance}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={account.is_active ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500"}>
                                {account.is_active ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>Laporan Pendapatan</CardTitle>
                <CardDescription>Ringkasan kredit pada akun pendapatan dari jurnal yang sudah dibuat.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {revenueByAccount.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Belum ada pendapatan terjurnal.
                  </div>
                ) : (
                  revenueByAccount.map((item) => (
                    <div key={item.account.id} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{item.account.name}</p>
                          <p className="text-xs text-muted-foreground">{item.account.code} - {accountTypeLabel(item.account.account_type)}</p>
                        </div>
                        <p className="whitespace-nowrap font-semibold text-primary">{currency(item.amount)}</p>
                      </div>
                    </div>
                  ))
                )}
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  Status neraca: <span className={cn("font-semibold", Math.abs(accountingDifference) < 0.01 ? "text-primary" : "text-red-700")}>
                    {Math.abs(accountingDifference) < 0.01 ? "Seimbang" : "Perlu rekonsiliasi"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Jurnal Terbaru</CardTitle>
              <CardDescription>Riwayat jurnal yang diposting dari transaksi keuangan.</CardDescription>
            </CardHeader>
            <CardContent>
              {journalEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center">
                  <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 font-medium">Belum ada jurnal</p>
                  <p className="mt-1 text-sm text-muted-foreground">Posting transaksi terverifikasi untuk mulai membentuk laporan.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {journalEntries.map((entry) => {
                    const entryLines = journalLines.filter((line) => line.journal_entry_id === entry.id);
                    const debit = entryLines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
                    const credit = entryLines.reduce((sum, line) => sum + Number(line.credit || 0), 0);

                    return (
                      <div key={entry.id} className="rounded-lg border border-border/60 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-foreground">{entry.entry_number}</p>
                              <Badge variant="outline" className="border-primary/20 text-primary">{entry.status}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{normalizeDate(entry.entry_date)}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm md:min-w-64">
                            <div className="rounded-md border bg-background p-2">
                              <p className="text-xs text-muted-foreground">Debit</p>
                              <p className="font-semibold">{currency(debit)}</p>
                            </div>
                            <div className="rounded-md border bg-background p-2">
                              <p className="text-xs text-muted-foreground">Kredit</p>
                              <p className="font-semibold">{currency(credit)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {entryLines.map((line) => {
                            const account = accountMap.get(line.account_id);
                            return (
                              <div key={line.id} className="rounded-md bg-muted/40 p-3 text-sm">
                                <p className="font-medium text-foreground">{account ? `${account.code} - ${account.name}` : "Akun tidak ditemukan"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Debit {currency(Number(line.debit || 0))} - Kredit {currency(Number(line.credit || 0))}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border-none shadow-2xl">
            <CardHeader className="bg-primary text-primary-foreground">
              <CardTitle className="text-white">Catat Transaksi</CardTitle>
              <CardDescription className="text-white/80">Gunakan untuk infaq bulanan, donasi, wakaf, pendaftaran, atau sumbangan pendidikan.</CardDescription>
            </CardHeader>
            <CardContent className="bg-white p-6">
              <form onSubmit={handleTransactionSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    Tipe Transaksi
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={transactionForm.transaction_type} onChange={(event) => setTransactionForm({ ...transactionForm, transaction_type: event.target.value as TransactionType })}>
                      <option value="spp">Infaq Bulanan Kelas/Program</option>
                      <option value="education_infaq">Sumbangan Pendidikan</option>
                      <option value="donation">Donasi</option>
                      <option value="wakaf">Wakaf</option>
                      <option value="registration">Pendaftaran</option>
                      <option value="other">Lainnya</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Status
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={transactionForm.status} onChange={(event) => setTransactionForm({ ...transactionForm, status: event.target.value as TransactionStatus })}>
                      <option value="verified">Terverifikasi</option>
                      <option value="pending">Menunggu</option>
                      <option value="rejected">Ditolak</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Peserta
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={transactionForm.participant_id} onChange={(event) => setTransactionForm({ ...transactionForm, participant_id: event.target.value })}>
                      <option value="">Tidak terkait peserta</option>
                      {participants.map((participant) => (
                        <option key={participant.id} value={participant.id}>{participant.display_name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Program/Kelas
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={transactionForm.program_id} onChange={(event) => setTransactionForm({ ...transactionForm, program_id: event.target.value })}>
                      <option value="">Tidak terkait program</option>
                      {activePrograms.map((program) => (
                        <option key={program.id} value={program.id}>{program.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Donatur Terdaftar
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={transactionForm.donor_id} onChange={(event) => setTransactionForm({ ...transactionForm, donor_id: event.target.value })}>
                      <option value="">Donatur baru / tidak ada</option>
                      {donors.map((donor) => (
                        <option key={donor.id} value={donor.id}>{donor.full_name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Kanal Pembayaran
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={transactionForm.payment_channel_id} onChange={(event) => setTransactionForm({ ...transactionForm, payment_channel_id: event.target.value })}>
                      <option value="">Belum dipilih</option>
                      {activeChannels.map((channel) => (
                        <option key={channel.id} value={channel.id}>{channel.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Nama Donatur Baru
                    <Input value={transactionForm.donor_name} onChange={(event) => setTransactionForm({ ...transactionForm, donor_name: event.target.value })} placeholder="Opsional bila belum terdaftar" />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Kontak Donatur
                    <Input value={transactionForm.donor_phone} onChange={(event) => setTransactionForm({ ...transactionForm, donor_phone: event.target.value })} placeholder="WhatsApp/telepon opsional" />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Bulan Tagihan
                    <Input type="month" value={transactionForm.billing_month ? transactionForm.billing_month.substring(0, 7) : ""} onChange={(event) => setTransactionForm({ ...transactionForm, billing_month: event.target.value ? `${event.target.value}-01` : "" })} />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Nominal
                    <Input type="number" min="0" required value={transactionForm.amount || ""} onChange={(event) => setTransactionForm({ ...transactionForm, amount: Number(event.target.value) })} placeholder="150000" />
                  </label>
                </div>
                <label className="space-y-2 text-sm font-medium">
                  Catatan
                  <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={transactionForm.notes} onChange={(event) => setTransactionForm({ ...transactionForm, notes: event.target.value })} placeholder="Contoh: transfer BSI, bukti WA, periode Juli 2026" />
                </label>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsTransactionModalOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Transaksi"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {isChannelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl border-none shadow-2xl">
            <CardHeader className="bg-primary text-primary-foreground">
              <CardTitle className="text-white">Tambah Kanal Pembayaran</CardTitle>
              <CardDescription className="text-white/80">Rekening bank, QRIS, tautan eksternal, atau kanal tunai resmi.</CardDescription>
            </CardHeader>
            <CardContent className="bg-white p-6">
              <form onSubmit={handleChannelSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    Nama Kanal
                    <Input required value={channelForm.name} onChange={(event) => setChannelForm({ ...channelForm, name: event.target.value })} placeholder="Rekening Infaq Pendidikan" />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Jenis
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={channelForm.channel_type} onChange={(event) => setChannelForm({ ...channelForm, channel_type: event.target.value as ChannelType })}>
                      <option value="bank">Transfer Bank</option>
                      <option value="qris">QRIS</option>
                      <option value="external">Tautan Eksternal</option>
                      <option value="cash">Tunai</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Nama Bank
                    <Input value={channelForm.bank_name} onChange={(event) => setChannelForm({ ...channelForm, bank_name: event.target.value })} placeholder="BSI/BCA/Mandiri" />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Nomor Rekening
                    <Input value={channelForm.account_number} onChange={(event) => setChannelForm({ ...channelForm, account_number: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Atas Nama
                    <Input value={channelForm.account_holder} onChange={(event) => setChannelForm({ ...channelForm, account_holder: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    URL QRIS / Gambar
                    <Input value={channelForm.qris_image_url} onChange={(event) => setChannelForm({ ...channelForm, qris_image_url: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-sm font-medium md:col-span-2">
                    Tautan Eksternal
                    <Input value={channelForm.external_url} onChange={(event) => setChannelForm({ ...channelForm, external_url: event.target.value })} placeholder="https://..." />
                  </label>
                </div>
                <label className="space-y-2 text-sm font-medium">
                  Instruksi
                  <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={channelForm.instructions} onChange={(event) => setChannelForm({ ...channelForm, instructions: event.target.value })} />
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={channelForm.is_active} onChange={(event) => setChannelForm({ ...channelForm, is_active: event.target.checked })} />
                  Kanal aktif dan boleh ditampilkan
                </label>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsChannelModalOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Kanal"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {isCommitmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border-none shadow-2xl">
            <CardHeader className="bg-primary text-primary-foreground">
              <CardTitle className="text-white">Tambah Donatur Rutin</CardTitle>
              <CardDescription className="text-white/80">Buat komitmen donasi/wakaf/infaq rutin beserta reminder.</CardDescription>
            </CardHeader>
            <CardContent className="bg-white p-6">
              <form onSubmit={handleCommitmentSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium">Sumber Donatur</span>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { value: "participant", label: "Peserta LMS", desc: "Ambil nama dan kontak dari data peserta." },
                        { value: "external", label: "Donatur Eksternal", desc: "Input manual untuk donatur luar LMS." },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setCommitmentForm({
                              ...commitmentForm,
                              source_type: option.value as "participant" | "external",
                              participant_id: option.value === "participant" ? commitmentForm.participant_id : "",
                              donor_id: "",
                            })
                          }
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors",
                            commitmentForm.source_type === option.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/50",
                          )}
                        >
                          <span className="block font-semibold">{option.label}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{option.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {commitmentForm.source_type === "participant" ? (
                    <label className="space-y-2 text-sm font-medium md:col-span-2">
                      Peserta LMS
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        required
                        value={commitmentForm.participant_id}
                        onChange={(event) => {
                          const participant = participants.find((item) => item.id === event.target.value);
                          setCommitmentForm({
                            ...commitmentForm,
                            participant_id: event.target.value,
                            donor_name: participant?.display_name ?? "",
                            donor_phone: participant?.phone ?? "",
                            donor_email: participant?.email ?? "",
                          });
                        }}
                      >
                        <option value="">Pilih peserta...</option>
                        {participants.map((participant) => (
                          <option key={participant.id} value={participant.id}>
                            {participant.display_name} {participant.global_participant_number ? `- ${participant.global_participant_number}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      <label className="space-y-2 text-sm font-medium">
                        Donatur Terdaftar
                        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={commitmentForm.donor_id} onChange={(event) => setCommitmentForm({ ...commitmentForm, donor_id: event.target.value })}>
                          <option value="">Buat donatur baru</option>
                          {donors.filter((donor) => !donor.participant_id).map((donor) => (
                            <option key={donor.id} value={donor.id}>{donor.full_name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 text-sm font-medium">
                        Nama Donatur Baru
                        <Input value={commitmentForm.donor_name} onChange={(event) => setCommitmentForm({ ...commitmentForm, donor_name: event.target.value })} />
                      </label>
                      <label className="space-y-2 text-sm font-medium">
                        WhatsApp
                        <Input value={commitmentForm.donor_phone} onChange={(event) => setCommitmentForm({ ...commitmentForm, donor_phone: event.target.value })} />
                      </label>
                      <label className="space-y-2 text-sm font-medium">
                        Email
                        <Input type="email" value={commitmentForm.donor_email} onChange={(event) => setCommitmentForm({ ...commitmentForm, donor_email: event.target.value })} />
                      </label>
                    </>
                  )}
                  <label className="space-y-2 text-sm font-medium">
                    Jenis Komitmen
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={commitmentForm.commitment_type} onChange={(event) => setCommitmentForm({ ...commitmentForm, commitment_type: event.target.value as CommitmentType })}>
                      <option value="donation">Donasi</option>
                      <option value="wakaf">Wakaf</option>
                      <option value="education_infaq">Sumbangan Pendidikan</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Tanggal Reminder Rutin
                    <Input
                      type="number"
                      min="1"
                      max="28"
                      value={commitmentForm.reminder_day_of_month || ""}
                      onChange={(event) =>
                        setCommitmentForm({
                          ...commitmentForm,
                          reminder_day_of_month: Number(event.target.value),
                        })
                      }
                      placeholder="Contoh: 5"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Nominal Komitmen
                    <Input type="number" min="0" required value={commitmentForm.amount || ""} onChange={(event) => setCommitmentForm({ ...commitmentForm, amount: Number(event.target.value) })} />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Frekuensi
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={commitmentForm.frequency} onChange={(event) => setCommitmentForm({ ...commitmentForm, frequency: event.target.value as CommitmentFrequency })}>
                      <option value="monthly">Bulanan</option>
                      <option value="quarterly">Triwulan</option>
                      <option value="yearly">Tahunan</option>
                      <option value="once">Sekali</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Reminder Berikutnya
                    <Input type="date" value={commitmentForm.next_reminder_at} onChange={(event) => setCommitmentForm({ ...commitmentForm, next_reminder_at: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Program Tujuan
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={commitmentForm.program_id} onChange={(event) => setCommitmentForm({ ...commitmentForm, program_id: event.target.value })}>
                      <option value="">Umum</option>
                      {activePrograms.map((program) => (
                        <option key={program.id} value={program.id}>{program.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Kanal Pembayaran
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={commitmentForm.channel_id} onChange={(event) => setCommitmentForm({ ...commitmentForm, channel_id: event.target.value })}>
                      <option value="">Belum dipilih</option>
                      {activeChannels.map((channel) => (
                        <option key={channel.id} value={channel.id}>{channel.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {commitmentForm.commitment_type === "wakaf" && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="mb-4">
                      <h3 className="font-semibold text-foreground">Detail Wakaf</h3>
                      <p className="text-sm text-muted-foreground">
                        Isi objek wakaf, nilai, peruntukan, dan cara tindak lanjutnya.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm font-medium">
                        Wakaf Apa
                        <Input
                          value={commitmentForm.wakaf_asset}
                          onChange={(event) => setCommitmentForm({ ...commitmentForm, wakaf_asset: event.target.value })}
                          placeholder="Contoh: Mushaf, tanah, perangkat kelas, beasiswa"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium">
                        Nilai Wakaf / Estimasi
                        <Input
                          type="number"
                          min="0"
                          value={commitmentForm.wakaf_asset_value || ""}
                          onChange={(event) => setCommitmentForm({ ...commitmentForm, wakaf_asset_value: Number(event.target.value) })}
                          placeholder="Contoh: 5000000"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium md:col-span-2">
                        Peruntukan Wakaf
                        <Input
                          value={commitmentForm.wakaf_purpose}
                          onChange={(event) => setCommitmentForm({ ...commitmentForm, wakaf_purpose: event.target.value })}
                          placeholder="Contoh: Pengadaan kitab kelas tahsin / pembangunan ruang belajar"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium md:col-span-2">
                        Link Wakaf
                        <Input
                          value={commitmentForm.wakaf_external_url}
                          onChange={(event) => setCommitmentForm({ ...commitmentForm, wakaf_external_url: event.target.value })}
                          placeholder="https://..."
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
                        <input
                          type="checkbox"
                          checked={commitmentForm.wakaf_contact_admin}
                          onChange={(event) => setCommitmentForm({ ...commitmentForm, wakaf_contact_admin: event.target.checked })}
                        />
                        Jika tidak ada link wakaf, arahkan calon wakif untuk langsung hubungi admin.
                      </label>
                    </div>
                  </div>
                )}
                <label className="space-y-2 text-sm font-medium">
                  Catatan Reminder
                  <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={commitmentForm.reminder_notes} onChange={(event) => setCommitmentForm({ ...commitmentForm, reminder_notes: event.target.value })} />
                </label>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsCommitmentModalOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Donatur Rutin"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
