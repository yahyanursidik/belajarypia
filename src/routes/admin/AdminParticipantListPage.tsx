import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, User, Filter, MapPin, GraduationCap, Phone, Upload, Download, Users, UserCheck, PieChart, BadgeCheck, Clock, Ban, Settings, Key, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { supabase } from "../../lib/supabase";
import type { Participant } from "../../lib/participant";
import type { Program } from "../../lib/organization";
import { fetchSystemSettings, updateSystemSettings, emptySettings } from "../../lib/settings";
import type { SystemSettings } from "../../lib/settings";


const toast = { 
  success: (msg: string) => window.alert(msg), 
  error: (msg: string) => window.alert(msg) 
};

// Extended type to include enrollments
type ParticipantRow = Participant & {
  enrollments?: Array<{ program_id: string }>;
  profiles?: { full_name: string; email: string; phone: string } | null;
};

export function AdminParticipantListPage() {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  
  // Pagination & Debounce
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [stats, setStats] = useState({ total: 0, active: 0, male: 0, female: 0 });

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMassUploadOpen, setIsMassUploadOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [massUploadProgress, setMassUploadProgress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reset Password State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetParticipant, setResetParticipant] = useState<ParticipantRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [form, setForm] = useState({
    global_participant_number: "",
    display_name: "",
    gender: "Laki-laki",
    participant_type: "adult",
    city: "",
    education_level: "",
    phone: "",
    birth_date: ""
  });

  // Debounce search query
  const [isTranscriptConfigOpen, setIsTranscriptConfigOpen] = useState(false);
  const [transcriptSettings, setTranscriptSettings] = useState<SystemSettings>(emptySettings);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [transcriptErrorMsg, setTranscriptErrorMsg] = useState("");
  const [isSuccessState, setIsSuccessState] = useState(false);

  // Load settings when modal opens
  useEffect(() => {
    if (isTranscriptConfigOpen) {
      setIsSuccessState(false);
      fetchSystemSettings().then(data => {
         if (data) setTranscriptSettings(data);
      });
    }
  }, [isTranscriptConfigOpen]);

  const handleSaveTranscriptSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTranscript(true);
    setTranscriptErrorMsg("");
    
    try {
      let signatureUrl = transcriptSettings.transcript_signature_url;

      if (signatureFile) {
        const fileExt = signatureFile.name.split('.').pop();
        const fileName = `transcript_signature_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("system_assets")
          .upload(fileName, signatureFile, { upsert: true });

        if (uploadError) {
          throw new Error("Gagal mengunggah tanda tangan: " + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("system_assets")
          .getPublicUrl(fileName);

        signatureUrl = publicUrlData.publicUrl;
      }

      const { error } = await updateSystemSettings(transcriptSettings.id, {
        transcript_header_text: transcriptSettings.transcript_header_text,
        transcript_place_date_text: transcriptSettings.transcript_place_date_text,
        transcript_official_name: transcriptSettings.transcript_official_name,
        transcript_official_title: transcriptSettings.transcript_official_title,
        transcript_signature_url: signatureUrl,
      });

      if (error) {
        setTranscriptErrorMsg("Gagal menyimpan ke database: " + error.message);
      } else {
        setIsSuccessState(true);
        setTimeout(() => {
          setIsSuccessState(false);
          setIsTranscriptConfigOpen(false);
          setSignatureFile(null);
        }, 2000);
      }
    } catch (err: any) {
      setTranscriptErrorMsg(err.message || "Terjadi kesalahan saat menyimpan");
    } finally {
      setIsSavingTranscript(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetParticipant || resetPassword.length < 6) return;
    
    setIsResetting(true);
    setResetFeedback(null);
    
    try {
      const { error } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: resetParticipant.user_id,
        new_password: resetPassword
      });
      
      if (error) throw error;
      
      setResetFeedback({ message: "Kata sandi berhasil diubah secara paksa!", type: "success" });
      setResetPassword("");
      
      // Auto close after 2.5 seconds
      setTimeout(() => {
        setIsResetModalOpen(false);
      }, 2500);
      
    } catch (err: any) {
      setResetFeedback({ message: "Gagal mereset sandi: " + err.message, type: "error" });
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, statusFilter, programFilter]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchParticipants();
  }, [page, debouncedSearchQuery, statusFilter, programFilter]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    const { data: progData } = await supabase.from("programs").select("id, name").order("name");
    if (progData) setPrograms(progData as Program[]);

    const [
      { count: total },
      { count: active },
      { count: male },
      { count: female }
    ] = await Promise.all([
      supabase.from("participants").select('*', { count: 'exact', head: true }),
      supabase.from("participants").select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from("participants").select('*', { count: 'exact', head: true }).eq('gender', 'Laki-laki'),
      supabase.from("participants").select('*', { count: 'exact', head: true }).eq('gender', 'Perempuan')
    ]);
    
    setStats({
      total: total || 0,
      active: active || 0,
      male: male || 0,
      female: female || 0
    });
  };

  const fetchParticipants = async () => {
    setIsLoading(true);
    let query = supabase
      .from("participants")
      .select("*, profiles(full_name, email, phone), enrollments(program_id)", { count: 'exact' });

    if (programFilter !== "all") {
      query = supabase
        .from("participants")
        .select(`*, profiles(full_name, email, phone), enrollments!inner(program_id)`, { count: 'exact' })
        .eq('enrollments.program_id', programFilter);
    }

    if (debouncedSearchQuery) {
      query = query.or(`display_name.ilike.%${debouncedSearchQuery}%,global_participant_number.ilike.%${debouncedSearchQuery}%`);
    }
    if (statusFilter !== "all") {
      query = query.eq('status', statusFilter);
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast.error("Gagal memuat data peserta");
    } else {
      setParticipants(data as ParticipantRow[]);
      if (count !== null) setTotalCount(count);
    }
    setIsLoading(false);
  };

  const handleCreateParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const nis = form.global_participant_number.trim() || `NIS-${Date.now().toString().slice(-6)}`;

    const payload: any = {
      global_participant_number: nis,
      display_name: form.display_name,
      gender: form.gender,
      participant_type: form.participant_type,
      city: form.city,
      education_level: form.education_level,
      status: "active"
    };

    if (form.phone) payload.phone = form.phone;
    if (form.birth_date) payload.birth_date = form.birth_date;

    const { error } = await supabase.from("participants").insert([payload]).select().single();

    if (error) {
      if (error.code === '23505') {
        toast.error("Nomor Induk sudah terdaftar.");
      } else {
        toast.error("Gagal menambahkan peserta: " + error.message);
      }
    } else {
      toast.success("Peserta berhasil ditambahkan");
      setIsModalOpen(false);
      setForm({ global_participant_number: "", display_name: "", gender: "Laki-laki", participant_type: "adult", city: "", education_level: "", phone: "", birth_date: "" });
      fetchInitialData();
    }
    setIsSubmitting(false);
  };

  const handleDownloadTemplate = () => {
    const csvContent = "Nama Lengkap,Nomor Induk,Jenis Kelamin,Tipe Peserta,Kota,Pendidikan,No WhatsApp\nJohn Doe,,Laki-laki,adult,Jakarta,S1,081234567890";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Template_Upload_Peserta.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMassUpload = async () => {
    if (!csvFile) return toast.error("Pilih file CSV terlebih dahulu");
    setIsSubmitting(true);
    setMassUploadProgress("Membaca file...");

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          setMassUploadProgress(`Memproses data ${i + 1} dari ${rows.length}...`);
          
          if (!row["Nama Lengkap"]) {
            failCount++;
            continue;
          }
          
          const nis = (row["Nomor Induk"]?.trim()) || `NIS-${Date.now().toString().slice(-4)}${i}`;
          
          const { error } = await supabase.from("participants").insert({
            global_participant_number: nis,
            display_name: row["Nama Lengkap"],
            gender: row["Jenis Kelamin"] || "Laki-laki",
            participant_type: row["Tipe Peserta"] || "adult",
            city: row["Kota"] || "",
            education_level: row["Pendidikan"] || "",
            status: "active"
          });
          
          if (error) {
            failCount++;
          } else {
            successCount++;
          }
        }
        
        setIsSubmitting(false);
        toast.success(`Selesai! Berhasil: ${successCount}, Gagal: ${failCount}`);
        setIsMassUploadOpen(false);
        setCsvFile(null);
        setMassUploadProgress("");
        fetchInitialData();
        fetchParticipants();
      },
      error: (err) => {
        toast.error("Gagal membaca file: " + err.message);
        setIsSubmitting(false);
        setMassUploadProgress("");
      }
    });
  };

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-10">
      <section className="page-hero">
        <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30 backdrop-blur-sm shadow-sm">PESERTA & PROFIL</Badge>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-white/10 items-center justify-center border border-white/20 backdrop-blur-sm shadow-inner">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-white text-3xl font-bold tracking-tight">Direktori Peserta</h2>
              <p className="text-white/80 max-w-xl text-sm md:text-base mt-1">
                Pusat manajemen profil, kontak, dan riwayat pendaftaran peserta.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => setIsTranscriptConfigOpen(true)}
              className="bg-white/20 text-white hover:bg-white/30 border border-white/20 shadow-sm rounded-full px-6"
            >
              <Settings className="w-4 h-4 mr-2" /> Konfigurasi Transkrip
            </Button>
            <Button 
              onClick={() => setIsMassUploadOpen(true)}
              className="bg-white/20 text-white hover:bg-white/30 border border-white/20 shadow-sm rounded-full px-6"
            >
              <Upload className="w-4 h-4 mr-2" /> Upload Massal
            </Button>
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-primary hover:bg-white/90 shadow-lg rounded-full font-semibold px-6"
            >
              <Plus className="w-4 h-4 mr-2" /> Peserta Baru
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card className="bg-primary/5 border-primary/20 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-primary text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Total Peserta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm relative overflow-hidden group">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm flex items-center gap-2">
              <UserCheck className="w-4 h-4" /> Peserta Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4" /> Demografi Gender
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xl font-bold text-slate-700">{stats.male}</p>
                <p className="text-xs text-muted-foreground">Laki-laki</p>
              </div>
              <div className="w-px h-8 bg-border"></div>
              <div>
                <p className="text-xl font-bold text-slate-700">{stats.female}</p>
                <p className="text-xs text-muted-foreground">Perempuan</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 shadow-sm border-slate-200 overflow-hidden">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 bg-white">
          <div>
            <CardTitle>Daftar Profil Peserta</CardTitle>
            <CardDescription>Menampilkan hasil pencarian ({totalCount} data).</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NIS..."
                className="pl-9 h-10 bg-muted/30 border-muted/50 focus:bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-lg border border-muted/40 h-10">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <select 
                className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer text-slate-700"
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
              >
                <option value="all">Semua Program</option>
                {programs.map(prog => (
                  <option key={prog.id} value={prog.id}>{prog.name}</option>
                ))}
              </select>
              <div className="w-px h-4 bg-border mx-1"></div>
              <select 
                className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer text-slate-700"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 border-b border-border/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Profil Peserta</th>
                  <th className="px-6 py-4 font-semibold">Kontak & Domisili</th>
                  <th className="px-6 py-4 font-semibold">Pendidikan</th>
                  <th className="px-6 py-4 font-semibold text-center">Program Aktif</th>
                  <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="font-medium">Memuat direktori...</p>
                      </div>
                    </td>
                  </tr>
                ) : participants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                      <User className="h-16 w-16 mx-auto mb-4 text-slate-200" />
                      <p className="font-medium text-lg text-slate-600">Tidak ada peserta</p>
                      <p className="text-sm">Coba sesuaikan filter pencarian atau program Anda.</p>
                    </td>
                  </tr>
                ) : (
                  participants.map((p) => (
                    <tr key={p.id} className="hover:bg-primary/5 transition-colors group border-b border-slate-100 last:border-0">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 shadow-inner">
                            {p.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{p.display_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{p.global_participant_number}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {p.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          {(p.profiles?.phone || p.phone) && (
                            <div className="flex items-center gap-2 text-slate-600">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-xs">{p.profiles?.phone || p.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-slate-600">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs">{p.city || "Belum diatur"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-700">
                          <GraduationCap className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-medium">{p.education_level || "-"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm ring-4 ring-white shadow-sm">
                          {p.enrollments?.length || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-full shadow-sm border border-transparent hover:border-amber-200"
                            onClick={() => {
                              setResetParticipant(p);
                              setResetPassword("");
                              setResetFeedback(null);
                              setIsResetModalOpen(true);
                            }}
                            title="Ubah Sandi"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="hover:bg-primary/10 hover:text-primary rounded-full shadow-sm"
                            onClick={() => navigate(`/system/peserta/${p.id}`)}
                          >
                            Lihat Detail
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t bg-slate-50/50">
              <span className="text-sm text-slate-500">
                Menampilkan <span className="font-medium text-slate-700">{(page - 1) * perPage + 1}</span> hingga <span className="font-medium text-slate-700">{Math.min(page * perPage, totalCount)}</span> dari <span className="font-medium text-slate-700">{totalCount}</span> peserta
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="bg-white"
                >
                  Sebelumnya
                </Button>
                <div className="flex items-center justify-center px-4 text-sm font-medium border rounded-md bg-white text-slate-700 min-w-[3rem]">
                  {page} / {totalPages}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="bg-white"
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah Peserta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl shadow-2xl overflow-hidden border-none animate-in zoom-in-95 duration-200">
            <div className="bg-primary p-6 text-primary-foreground">
              <CardTitle className="text-2xl mb-1 text-white">Tambah Peserta Baru</CardTitle>
              <CardDescription className="text-white/80">Daftarkan profil peserta baru ke dalam sistem direktori.</CardDescription>
            </div>
            <CardContent className="p-6 bg-white">
              <form onSubmit={handleCreateParticipant} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Nomor Induk (NIS) <span className="text-muted-foreground font-normal text-xs ml-1">(Kosongkan untuk otomatis)</span></label>
                    <Input 
                      placeholder="Contoh: NIS-2026001" 
                      className="h-10"
                      value={form.global_participant_number} 
                      onChange={e => setForm({...form, global_participant_number: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Nama Lengkap <span className="text-red-500">*</span></label>
                    <Input 
                      required 
                      placeholder="Masukkan nama lengkap peserta" 
                      className="h-10"
                      value={form.display_name} 
                      onChange={e => setForm({...form, display_name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Jenis Kelamin</label>
                    <select 
                      className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                      value={form.gender} 
                      onChange={e => setForm({...form, gender: e.target.value})}
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Tanggal Lahir</label>
                    <Input 
                      type="date"
                      className="h-10"
                      value={form.birth_date} 
                      onChange={e => setForm({...form, birth_date: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">No. WhatsApp</label>
                    <Input 
                      type="tel"
                      placeholder="Contoh: 08123456789"
                      className="h-10"
                      value={form.phone} 
                      onChange={e => setForm({...form, phone: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Pendidikan Terakhir</label>
                    <select 
                      className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                      value={form.education_level} 
                      onChange={e => setForm({...form, education_level: e.target.value})}
                    >
                      <option value="">- Pilih -</option>
                      <option value="SD">SD Sederajat</option>
                      <option value="SMP">SMP Sederajat</option>
                      <option value="SMA">SMA Sederajat</option>
                      <option value="D3">Diploma 3</option>
                      <option value="S1">S1 (Sarjana)</option>
                      <option value="S2">S2 (Magister)</option>
                      <option value="S3">S3 (Doktor)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Kota / Domisili</label>
                  <Input 
                    placeholder="Contoh: Jakarta Selatan" 
                    className="h-10"
                    value={form.city} 
                    onChange={e => setForm({...form, city: e.target.value})} 
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-border/50 mt-6">
                  <Button type="button" variant="outline" className="px-6" onClick={() => setIsModalOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6">
                    {isSubmitting ? "Menyimpan..." : "Simpan Peserta"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Mass Upload */}
      {isMassUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-primary p-6 text-primary-foreground">
              <CardTitle className="text-2xl mb-1 text-white">Upload Massal Peserta</CardTitle>
              <CardDescription className="text-white/80">Impor banyak data peserta sekaligus menggunakan file CSV.</CardDescription>
            </div>
            <CardContent className="p-6 bg-white">
              <div className="space-y-5">
                <div className="bg-primary/5 text-primary p-4 rounded-lg text-sm border border-primary/20 shadow-sm">
                  <p className="font-semibold mb-2 flex items-center gap-2"><BadgeCheck className="w-4 h-4" /> Panduan Import:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 ml-1">
                    <li>Gunakan format CSV yang dipisahkan dengan koma (,).</li>
                    <li>Baris pertama harus berisi judul kolom (Header).</li>
                    <li>Kolom <strong>Nama Lengkap</strong> wajib diisi.</li>
                  </ul>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto text-primary font-bold mt-3 hover:text-primary/80"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="w-4 h-4 mr-1 inline" /> Unduh Template CSV
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold block text-slate-700">Pilih File CSV</label>
                  <Input 
                    type="file" 
                    accept=".csv" 
                    className="h-10 cursor-pointer"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    disabled={isSubmitting}
                  />
                  {massUploadProgress && (
                    <p className="text-xs text-primary mt-2 font-medium animate-pulse">{massUploadProgress}</p>
                  )}
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-border/50 mt-6">
                  <Button type="button" variant="outline" className="px-6" onClick={() => setIsMassUploadOpen(false)} disabled={isSubmitting}>Batal</Button>
                  <Button onClick={handleMassUpload} disabled={isSubmitting || !csvFile} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6">
                    {isSubmitting ? "Memproses..." : "Mulai Upload"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Transcript Config */}
      {isTranscriptConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl shadow-2xl overflow-hidden border-none animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto relative">
            {isSuccessState ? (
              <div className="flex flex-col items-center justify-center p-16 h-[400px] bg-white animate-in zoom-in-50 duration-300">
                <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Berhasil!</h3>
                <p className="text-slate-500 mt-2 text-center">Konfigurasi transkrip telah tersimpan dengan aman.</p>
              </div>
            ) : (
              <>
                <div className="bg-primary p-6 text-primary-foreground sticky top-0 z-10">
                  <CardTitle className="text-2xl mb-1 text-white">Konfigurasi Transkrip</CardTitle>
                  <CardDescription className="text-white/80">Atur header, pejabat penandatangan, dan tanda tangan untuk semua transkrip nilai.</CardDescription>
                </div>
                <CardContent className="p-6 bg-white">
                  <form onSubmit={handleSaveTranscriptSettings} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Teks Header Kop Surat</label>
                  <textarea 
                    placeholder="Contoh: YAYASAN PENDIDIKAN IHSANUL ADAB (YPIA)" 
                    className="w-full h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={transcriptSettings.transcript_header_text || ""} 
                    onChange={e => setTranscriptSettings({...transcriptSettings, transcript_header_text: e.target.value})} 
                  />
                  <p className="text-xs text-muted-foreground">Logo akan menggunakan logo sistem secara default.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Awalan Tempat & Tanggal</label>
                    <Input 
                      placeholder="Contoh: Yogyakarta, " 
                      className="h-10"
                      value={transcriptSettings.transcript_place_date_text || ""} 
                      onChange={e => setTranscriptSettings({...transcriptSettings, transcript_place_date_text: e.target.value})} 
                    />
                    <p className="text-xs text-muted-foreground">Tanggal cetak akan ditambahkan otomatis di belakangnya.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Tanda Tangan (Opsional)</label>
                    <Input 
                      type="file"
                      accept="image/*"
                      className="h-10 cursor-pointer"
                      onChange={e => setSignatureFile(e.target.files?.[0] || null)} 
                    />
                    {transcriptSettings.transcript_signature_url && !signatureFile && (
                      <p className="text-xs text-emerald-600 font-medium">✓ Tanda tangan sudah diunggah sebelumnya</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Nama Pejabat Penandatangan</label>
                    <Input 
                      placeholder="Contoh: Ustadz Fulan, Lc., M.A." 
                      className="h-10"
                      value={transcriptSettings.transcript_official_name || ""} 
                      onChange={e => setTranscriptSettings({...transcriptSettings, transcript_official_name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Jabatan Penandatangan</label>
                    <Input 
                      placeholder="Contoh: Direktur Pendidikan" 
                      className="h-10"
                      value={transcriptSettings.transcript_official_title || ""} 
                      onChange={e => setTranscriptSettings({...transcriptSettings, transcript_official_title: e.target.value})} 
                    />
                  </div>
                </div>

                {transcriptErrorMsg && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium border border-red-200">
                    {transcriptErrorMsg}
                  </div>
                )}

                <div className="pt-4 flex justify-end gap-3 border-t border-border/50 mt-6">
                  <Button type="button" variant="outline" className="px-6" onClick={() => setIsTranscriptConfigOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isSavingTranscript} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6">
                    {isSavingTranscript ? "Menyimpan..." : "Simpan Konfigurasi"}
                  </Button>
                </div>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Modal Reset Password */}
      {isResetModalOpen && resetParticipant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl overflow-hidden border-none animate-in zoom-in-95 duration-200">
            <div className="bg-amber-500 p-5 text-white flex justify-between items-start">
              <div>
                <CardTitle className="text-xl mb-1 text-white flex items-center gap-2">
                  <Key className="h-5 w-5" /> Ganti Kata Sandi
                </CardTitle>
                <CardDescription className="text-white/90">Ubah sandi untuk {resetParticipant.display_name}</CardDescription>
                {resetParticipant.profiles?.email && (
                  <div className="mt-2 text-xs font-medium bg-black/20 py-1 px-2 rounded inline-block">
                    📧 {resetParticipant.profiles.email}
                  </div>
                )}
              </div>
              <button onClick={() => setIsResetModalOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <CardContent className="p-6 bg-white">
              {resetFeedback && (
                <div className={`mb-6 p-3 rounded-lg border text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2 ${
                  resetFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {resetFeedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                  <p>{resetFeedback.message}</p>
                </div>
              )}
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Sandi Baru <span className="text-red-500">*</span></label>
                  <Input 
                    required 
                    type="text"
                    placeholder="Minimal 6 karakter" 
                    className="h-10 text-lg tracking-wider font-mono"
                    value={resetPassword} 
                    onChange={e => setResetPassword(e.target.value)} 
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                    Sandi ini akan langsung menimpa sandi lama. Pastikan Anda menginformasikan kata sandi baru ini kepada peserta yang bersangkutan.
                  </p>
                </div>
                
                <div className="flex items-center gap-3 justify-end pt-4 border-t mt-6">
                  <Button type="button" variant="ghost" onClick={() => setIsResetModalOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isResetting || resetPassword.length < 6} className="bg-amber-500 hover:bg-amber-600 min-w-[120px]">
                    {isResetting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Proses...</> : 'Simpan Sandi'}
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
