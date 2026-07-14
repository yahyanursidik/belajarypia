import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  HandCoins,
  HelpCircle,
  ReceiptText,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";

type TransactionType = "spp" | "registration" | "education_infaq" | "donation" | "wakaf" | "other";
type TransactionStatus = "pending" | "verified" | "rejected" | "void";
type ChannelType = "bank" | "qris" | "external" | "cash";

type Participant = {
  id: string;
  display_name: string | null;
  global_participant_number: string | null;
};

type TransactionRow = {
  id: string;
  program_id: string | null;
  payment_channel_id?: string | null;
  amount: number;
  transaction_type: TransactionType;
  status: TransactionStatus;
  billing_month: string | null;
  created_at: string;
  notes: string | null;
  programs?: {
    name: string | null;
    code: string | null;
  } | null;
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
};

function currency(value: number): string {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
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

function statusBadge(status: TransactionStatus) {
  if (status === "verified") {
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Terverifikasi</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Menunggu</Badge>;
  }
  if (status === "void") {
    return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Void</Badge>;
  }
  return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Ditolak</Badge>;
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object" || !("message" in error)) return "Terjadi kendala saat memuat data.";
  return String((error as { message?: string }).message ?? "Terjadi kendala saat memuat data.");
}

function isMissingTable(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find");
}

export function LearnerFinancePage() {
  const { user } = useAuthSession();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [channelSchemaReady, setChannelSchemaReady] = useState(true);

  const loadFinanceData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { data: participantRow, error: participantError } = await supabase
      .from("participants")
      .select("id, display_name, global_participant_number")
      .eq("user_id", user.id)
      .maybeSingle();

    if (participantError) {
      setErrorMessage(participantError.message);
      setIsLoading(false);
      return;
    }

    const currentParticipant = (participantRow as Participant | null) ?? null;
    setParticipant(currentParticipant);

    if (!currentParticipant) {
      setIsLoading(false);
      return;
    }

    const [transactionRes, channelRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, program_id, payment_channel_id, amount, transaction_type, status, billing_month, created_at, notes, programs(name, code)")
        .eq("participant_id", currentParticipant.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("donation_payment_channels")
        .select("id, name, channel_type, bank_name, account_number, account_holder, qris_image_url, external_url, instructions, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    if (transactionRes.error) setErrorMessage(transactionRes.error.message);

    if (channelRes.error) {
      setChannelSchemaReady(!isMissingTable(channelRes.error));
      if (!isMissingTable(channelRes.error)) setErrorMessage(channelRes.error.message);
    } else {
      setChannelSchemaReady(true);
    }

    setTransactions((transactionRes.data ?? []) as unknown as TransactionRow[]);
    setChannels((channelRes.data ?? []) as PaymentChannel[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void loadFinanceData();
  }, [loadFinanceData]);

  const verifiedTotal = transactions
    .filter((transaction) => transaction.status === "verified")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  const pendingTotal = transactions
    .filter((transaction) => transaction.status === "pending")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  const monthlyInfaqTotal = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((transaction) => {
        const createdAt = new Date(transaction.created_at);
        return (
          transaction.status === "verified" &&
          (transaction.transaction_type === "spp" || transaction.transaction_type === "education_infaq") &&
          createdAt.getMonth() === now.getMonth() &&
          createdAt.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }, [transactions]);

  const nextPendingTransaction = transactions.find((transaction) => transaction.status === "pending");

  const copyText = async (value: string | null) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  if (isLoading) return <FullPageLoader message="Memuat keuangan peserta..." />;

  if (errorMessage) {
    return (
      <Alert className="border-red-200 bg-red-50 text-red-900">
        <AlertTitle>Gagal memuat keuangan</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  if (!participant) {
    return (
      <Alert>
        <AlertTitle>Belum terhubung sebagai peserta</AlertTitle>
        <AlertDescription>Akun ini belum memiliki profil peserta aktif.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="page-stack pb-12">
      <section className="page-hero">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3 border-white/30 bg-white/20 text-white">
              KEUANGAN PESERTA
            </Badge>
            <h1 className="text-3xl font-bold text-white">Pembayaran, Infaq & Donasi</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
              Pantau riwayat transaksi, status verifikasi, dan kanal pembayaran resmi yang bisa digunakan.
            </p>
          </div>
          <Button type="button" variant="secondary" className="bg-white !text-primary hover:bg-white/90" onClick={() => void loadFinanceData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Muat Ulang
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Terverifikasi", value: currency(verifiedTotal), desc: "Semua pembayaran yang sudah diterima.", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { label: "Menunggu Verifikasi", value: currency(pendingTotal), desc: `${transactions.filter((item) => item.status === "pending").length} transaksi sedang dicek.`, icon: Clock, tone: "bg-amber-50 text-amber-700 border-amber-200" },
          { label: "Infaq Bulan Ini", value: currency(monthlyInfaqTotal), desc: "Infaq pendidikan yang sudah verified bulan ini.", icon: HandCoins, tone: "bg-sky-50 text-sky-700 border-sky-200" },
          { label: "Kanal Aktif", value: channels.length.toLocaleString("id-ID"), desc: "Rekening, QRIS, atau tautan resmi.", icon: WalletCards, tone: "bg-primary/10 text-primary border-primary/20" },
        ].map((item) => (
          <Card key={item.label} className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{item.value}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
                <div className={cn("rounded-xl border p-2", item.tone)}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Workflow Administrasi</CardTitle>
            <CardDescription>Alur sederhana agar pembayaran dan konfirmasi lebih mudah dipantau.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {[
              { title: "1. Pilih kanal", desc: "Gunakan rekening, QRIS, atau tautan resmi yang aktif.", icon: WalletCards },
              { title: "2. Transfer", desc: "Sesuaikan nominal, program, dan periode pembayaran.", icon: Banknote },
              { title: "3. Konfirmasi", desc: "Simpan bukti dan hubungi admin bila belum tercatat.", icon: ReceiptText },
              { title: "4. Pantau status", desc: "Transaksi berubah verified setelah dicek admin.", icon: CheckCircle2 },
            ].map((step) => (
              <div key={step.title} className="rounded-lg border border-border/60 p-3">
                <step.icon className="h-5 w-5 text-primary" />
                <p className="mt-2 font-semibold text-foreground">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Butuh Bantuan?</CardTitle>
            <CardDescription>Gunakan kategori Pembayaran, Donasi & Keuangan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextPendingTransaction ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Ada transaksi menunggu</p>
                <p className="mt-1 text-xs leading-relaxed">
                  {transactionTypeLabel(nextPendingTransaction.transaction_type)} sebesar {currency(nextPendingTransaction.amount)} sedang dicek.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-semibold">Tidak ada transaksi pending</p>
                <p className="mt-1 text-xs leading-relaxed">Riwayat Anda saat ini tidak memiliki pembayaran yang menunggu verifikasi.</p>
              </div>
            )}
            <Button asChild className="w-full">
              <Link to="/learner/bantuan">
                <HelpCircle className="mr-2 h-4 w-4" />
                Buka Bantuan
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Riwayat Transaksi</CardTitle>
            <CardDescription>Daftar pembayaran, infaq, donasi, wakaf, dan pendaftaran yang tercatat.</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <ReceiptText className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 font-medium">Belum ada transaksi tercatat</p>
                <p className="mt-1 text-sm text-muted-foreground">Transaksi akan muncul setelah admin mencatat atau memverifikasi pembayaran.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Tanggal</th>
                      <th className="px-4 py-3 font-semibold">Jenis</th>
                      <th className="px-4 py-3 font-semibold">Program</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {format(new Date(transaction.created_at), "dd MMM yyyy", { locale: id })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{transactionTypeLabel(transaction.transaction_type)}</p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.billing_month ? format(new Date(transaction.billing_month), "MMMM yyyy", { locale: id }) : transaction.notes ?? "-"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{transaction.programs?.name ?? "-"}</td>
                        <td className="px-4 py-3">{statusBadge(transaction.status)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{currency(transaction.amount)}</td>
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
            <CardTitle>Kanal Pembayaran Resmi</CardTitle>
            <CardDescription>Gunakan hanya kanal aktif berikut untuk menghindari salah transfer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!channelSchemaReady && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Kanal belum tersedia</AlertTitle>
                <AlertDescription>Admin perlu menjalankan migrasi kanal donasi/wakaf.</AlertDescription>
              </Alert>
            )}
            {channels.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Belum ada kanal pembayaran aktif.
              </div>
            ) : (
              channels.map((channel) => (
                <div key={channel.id} className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{channel.name}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{channel.channel_type}</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-200 text-emerald-700">Aktif</Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {channel.bank_name && <p>Bank: <span className="font-medium text-foreground">{channel.bank_name}</span></p>}
                    {channel.account_holder && <p>Atas nama: <span className="font-medium text-foreground">{channel.account_holder}</span></p>}
                    {channel.account_number && (
                      <button type="button" className="inline-flex items-center gap-2 font-semibold text-primary" onClick={() => void copyText(channel.account_number)}>
                        {channel.account_number}
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {channel.instructions && <p className="rounded-md bg-muted/50 p-2 text-xs leading-relaxed">{channel.instructions}</p>}
                    {channel.external_url && (
                      <a href={channel.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary">
                        Buka tautan pembayaran
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
