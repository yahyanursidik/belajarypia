import { useEffect, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { BadgeDollarSign, Search, Filter, Plus, Calendar, CheckCircle2, MoreVertical, Loader2, Ban, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "../../lib/supabase";

type Transaction = {
  id: string;
  amount: number;
  transaction_type: string;
  status: string;
  billing_month: string;
  created_at: string;
  notes: string;
  participants?: {
    display_name: string;
    global_participant_number: string;
  };
  programs?: {
    name: string;
  };
};

export function AdminFinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State for Manual Entry
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  
  const [form, setForm] = useState({
    participant_id: "",
    program_id: "",
    amount: 0,
    transaction_type: "spp",
    billing_month: format(new Date(), "yyyy-MM-01"),
    notes: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*, participants(display_name, global_participant_number), programs(name)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTransactions(data as any);
    }
    
    // Load dropdowns for form
    const [pRes, progRes] = await Promise.all([
      supabase.from("participants").select("id, display_name").eq("status", "active"),
      supabase.from("programs").select("id, name").eq("status", "active")
    ]);
    
    if (pRes.data) setParticipants(pRes.data);
    if (progRes.data) setPrograms(progRes.data);
    
    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await supabase.from("transactions").insert({
      participant_id: form.participant_id,
      program_id: form.program_id,
      amount: form.amount,
      transaction_type: form.transaction_type,
      billing_month: form.billing_month,
      notes: form.notes,
      status: "verified" // Manual entries are verified by default
    });

    if (error) {
      alert("Gagal menyimpan transaksi: " + error.message);
    } else {
      setIsModalOpen(false);
      await loadData();
    }
    setIsSubmitting(false);
  };

  const handleVoidTransaction = async (transactionId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin membatalkan transaksi ini? Transaksi yang dibatalkan tidak akan dihitung dalam laporan keuangan.")) return;
    
    setIsLoading(true);
    const { error } = await supabase
      .from("transactions")
      .update({ status: "void" })
      .eq("id", transactionId);

    if (error) {
      alert("Gagal membatalkan transaksi: " + error.message);
      setIsLoading(false);
    } else {
      await loadData();
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.participants?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.programs?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || t.transaction_type === filterType;
    const matchesStatus = filterStatus === "all" || t.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalSppThisMonth = transactions
    .filter(t => t.transaction_type === "spp" && t.status === "verified" && new Date(t.created_at).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalPendaftaranThisMonth = transactions
    .filter(t => t.transaction_type === "registration" && t.status === "verified" && new Date(t.created_at).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30 backdrop-blur-sm shadow-sm">KEUANGAN & SPP</Badge>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-white/10 items-center justify-center border border-white/20 backdrop-blur-sm shadow-inner">
              <BadgeDollarSign className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-white text-3xl font-bold tracking-tight">Buku Kas Digital</h2>
              <p className="text-white/80 max-w-xl text-sm md:text-base mt-1">
                Pusat pencatatan keuangan, SPP bulanan, dan pemasukan program YPIA.
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-primary hover:bg-white/90 shrink-0 shadow-lg rounded-full font-semibold px-6"
          >
            <Plus className="w-4 h-4 mr-2" /> Tambah Transaksi
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card className="bg-primary/5 border-primary/20 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-primary text-sm flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4" /> Pemasukan SPP (Bulan Ini)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">Rp {totalSppThisMonth.toLocaleString("id-ID")}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-primary text-sm flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4" /> Pemasukan Pendaftaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">Rp {totalPendaftaranThisMonth.toLocaleString("id-ID")}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" /> Total Aktivitas Kas (Bulan Ini)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {transactions.filter(t => new Date(t.created_at).getMonth() === new Date().getMonth()).length}
              <span className="text-sm font-normal text-muted-foreground ml-2">Transaksi</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <CardTitle>Riwayat Transaksi</CardTitle>
            <CardDescription>Daftar seluruh pembayaran yang tercatat di sistem.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama peserta / program..."
                className="pl-9 h-10 bg-muted/30 border-muted/50 focus:bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-lg border border-muted/40 h-10">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <select 
                className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer text-slate-700"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">Semua Tipe</option>
                <option value="spp">SPP Bulanan</option>
                <option value="registration">Pendaftaran</option>
                <option value="other">Lainnya</option>
              </select>
              <div className="w-px h-4 bg-border mx-1"></div>
              <select 
                className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer text-slate-700"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="verified">Terverifikasi</option>
                <option value="pending">Tertunda</option>
                <option value="void">Dibatalkan (Void)</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" /> Memuat data transaksi...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <BadgeDollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Belum ada transaksi tercatat.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/80 border-b border-border/50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Tanggal</th>
                    <th className="px-6 py-4 font-semibold">Peserta</th>
                    <th className="px-6 py-4 font-semibold">Program & Tipe</th>
                    <th className="px-6 py-4 font-semibold">Bulan Tagihan</th>
                    <th className="px-6 py-4 font-semibold text-right">Nominal</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className={`transition-colors group ${t.status === 'void' ? 'bg-muted/10 opacity-70' : 'hover:bg-primary/5'}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {format(new Date(t.created_at), "dd MMM yyyy, HH:mm", { locale: id })}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        <span className="text-slate-800">{t.participants?.display_name || "Unknown"}</span>
                        <p className="text-xs text-muted-foreground font-normal">{t.participants?.global_participant_number}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-700">{t.programs?.name}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.transaction_type === 'spp' ? 'SPP Bulanan' : t.transaction_type === 'registration' ? 'Pendaftaran' : 'Lainnya'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {t.transaction_type === 'spp' && t.billing_month ? format(new Date(t.billing_month), "MMMM yyyy", { locale: id }) : "-"}
                      </td>
                      <td className={`px-6 py-4 text-right font-semibold ${t.status === 'void' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        Rp {t.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {t.status === 'verified' && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 shadow-sm"><CheckCircle2 className="w-3 h-3 mr-1" /> Terverifikasi</Badge>}
                        {t.status === 'pending' && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shadow-sm"><Clock className="w-3 h-3 mr-1" /> Tertunda</Badge>}
                        {t.status === 'void' && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 shadow-sm"><Ban className="w-3 h-3 mr-1" /> Dibatalkan</Badge>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {t.status !== 'void' && (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleVoidTransaction(t.id)} title="Batalkan (Void)">
                              <Ban className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Manual Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl shadow-2xl overflow-hidden border-none">
            <div className="bg-primary p-6 text-primary-foreground">
              <CardTitle className="text-2xl mb-1 text-white">Catat Transaksi Manual</CardTitle>
              <CardDescription className="text-white/80">Masukkan data pembayaran SPP atau pembayaran lainnya dari peserta.</CardDescription>
            </div>
            <CardContent className="p-6 bg-white">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Peserta</label>
                    <select 
                      className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                      required 
                      value={form.participant_id} 
                      onChange={e => setForm({...form, participant_id: e.target.value})}
                    >
                      <option value="">Pilih Peserta...</option>
                      {participants.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Program Tujuan</label>
                    <select 
                      className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                      required 
                      value={form.program_id} 
                      onChange={e => setForm({...form, program_id: e.target.value})}
                    >
                      <option value="">Pilih Program...</option>
                      {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Tipe Transaksi</label>
                    <select 
                      className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                      value={form.transaction_type}
                      onChange={e => setForm({...form, transaction_type: e.target.value})}
                    >
                      <option value="spp">SPP Bulanan</option>
                      <option value="registration">Pendaftaran</option>
                      <option value="other">Lainnya</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Bulan Tagihan <span className="text-muted-foreground font-normal">(Opsional)</span></label>
                    <Input 
                      type="month" 
                      className="h-10" 
                      value={form.billing_month ? form.billing_month.substring(0, 7) : ""} 
                      onChange={e => setForm({...form, billing_month: e.target.value ? `${e.target.value}-01` : ""})}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 mt-2 border-t border-border/50">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Nominal (Rp)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                      <Input 
                        type="number" 
                        min="0" 
                        required 
                        className="h-10 pl-9 font-medium" 
                        placeholder="Contoh: 150000"
                        value={form.amount || ""}
                        onChange={e => setForm({...form, amount: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Catatan <span className="text-muted-foreground font-normal">(Opsional)</span></label>
                    <Input 
                      placeholder="Contoh: Transfer via BCA" 
                      className="h-10"
                      value={form.notes}
                      onChange={e => setForm({...form, notes: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-6 mt-4">
                  <Button type="button" variant="outline" className="px-6" onClick={() => setIsModalOpen(false)}>Batal</Button>
                  <Button type="submit" className="px-6 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                    {isSubmitting ? "Menyimpan..." : "Simpan Transaksi"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
