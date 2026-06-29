import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Activity, User, BookOpen, AlertCircle, ChevronLeft, Loader2, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { supabase } from "../../lib/supabase";
import { applicantStatusLabels } from "../../lib/admission";
import { useAuthSession } from "../../app/providers/authSessionContext";

function StatusSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-32 bg-slate-200 rounded"></div>
      <div className="space-y-3">
        <div className="h-24 bg-slate-100 rounded-xl"></div>
        <div className="h-24 bg-slate-100 rounded-xl"></div>
      </div>
    </div>
  );
}

export function AdmissionStatusPage() {
  const navigate = useNavigate();
  const { session } = useAuthSession();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [applicantsList, setApplicantsList] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLearnerPortal = window.location.pathname.startsWith('/learner');

  // Load profile details and auto-search if logged in
  useEffect(() => {
    if (session?.user?.id) {
      autoFillAndSearch();
    }
  }, [session?.user?.id]);

  const autoFillAndSearch = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, phone")
        .eq("id", session!.user.id)
        .maybeSingle();

      if (profile) {
        setEmail(profile.email || session!.user.email || "");
        setPhone(profile.phone || "");

        if (profile.email || session!.user.email) {
          const { data, error } = await supabase.rpc("check_applicant_status", {
            p_email: profile.email || session!.user.email,
            p_phone: profile.phone || ""
          });

          if (error) throw error;
          setApplicantsList(data || []);
          setSearched(true);
        }
      }
    } catch (err) {
      console.error("Auto-search status error:", err);
      setErrorMsg("Gagal memuat status pendaftaran otomatis.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSearched(false);
    setApplicantsList([]);

    try {
      const { data, error } = await supabase.rpc("check_applicant_status", {
        p_email: email.trim(),
        p_phone: phone.trim()
      });

      if (error) throw error;

      setApplicantsList(data || []);
      setSearched(true);
    } catch (err: any) {
      console.error("Status lookup error:", err);
      setErrorMsg("Terjadi kesalahan sistem saat mencari pendaftaran. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'accepted': 
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: <CheckCircle className="h-5 w-5 text-emerald-600" />,
          title: 'Selamat! Pendaftaran Anda Diterima',
          desc: 'Pendaftaran Anda telah disetujui. Tim admin akan segera menghubungi Anda untuk petunjuk pembagian kelas dan perkuliahan.'
        };
      case 'rejected': 
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          badge: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: <XCircle className="h-5 w-5 text-rose-600" />,
          title: 'Mohon Maaf, Pendaftaran Belum Diterima',
          desc: 'Pendaftaran Anda belum dapat disetujui pada periode ini. Tetap semangat dan silakan ikuti pendaftaran di gelombang berikutnya.'
        };
      case 'revision_requested': 
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: <AlertCircle className="h-5 w-5 text-amber-600 animate-pulse" />,
          title: 'Perlu Revisi Dokumen / Data',
          desc: 'Terdapat berkas atau data yang perlu Anda perbaiki. Silakan periksa pesan/email dari admin untuk instruksi detail.'
        };
      default: 
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          badge: 'bg-primary/10 text-primary border-primary/20',
          icon: <Clock className="h-5 w-5 text-primary" />,
          title: 'Pendaftaran Sedang Ditinjau',
          desc: 'Berkas pendaftaran Anda telah kami terima dan sedang dalam antrean verifikasi oleh tim penerimaan mahasiswa baru.'
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Navigation Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <Button 
            onClick={() => navigate(isLearnerPortal ? "/learner" : "/")} 
            variant="ghost" 
            size="sm" 
            className="text-slate-600 hover:text-slate-900 transition-colors font-medium flex items-center gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" /> Kembali
          </Button>
          {session && (
            <span className="text-xs text-primary font-semibold uppercase tracking-wider bg-primary/10 px-2.5 py-1 rounded">Portal Peserta</span>
          )}
        </div>

        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 text-primary mb-6 shadow-inner">
            <Activity className="h-8 w-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Cek Status Pendaftaran</h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            {session 
              ? "Status pendaftaran Anda saat ini terdeteksi dari akun terhubung." 
              : "Pantau perkembangan status penerimaan Anda cukup dengan Email dan Nomor WhatsApp yang didaftarkan."
            }
          </p>
        </div>

        <Card className="shadow-xl border-slate-200 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary to-emerald-500"></div>
          <CardContent className="p-6 sm:p-8">
            
            {/* Display search form if not logged in */}
            {!session && (
              <form onSubmit={handleSearch} className="space-y-5 mb-8">
                {errorMsg && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm font-medium flex gap-3 items-start animate-in shake">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p>{errorMsg}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Terdaftar</label>
                  <Input required type="email" placeholder="Misal: fulan@contoh.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor WhatsApp Terdaftar</label>
                  <Input required type="tel" placeholder="Misal: 0812xxxxxx" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-white font-bold transition-colors">
                  {isLoading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" /> Mencari data...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 justify-center">
                      <Search className="h-4 w-4"/> Cari Pendaftaran
                    </span>
                  )}
                </Button>
              </form>
            )}

            {/* Error banner for logged-in search */}
            {session && errorMsg && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm font-medium flex gap-3 items-start mb-6 animate-in shake">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            {/* Loading skeletons for auto search */}
            {isLoading && session && (
              <StatusSkeleton />
            )}

            {/* Results display */}
            {searched && (
              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                <div className="border-b pb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Hasil Pencarian</h3>
                  <span className="text-xs bg-slate-100 px-2.5 py-1 rounded text-slate-600 font-semibold">{applicantsList.length} Ditemukan</span>
                </div>

                {applicantsList.length > 0 ? (
                  <div className="space-y-6">
                    
                    {/* User identity card */}
                    <div className="flex items-center gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                        {applicantsList[0].full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{applicantsList[0].full_name}</p>
                        <p className="text-xs text-slate-500">{email}</p>
                      </div>
                    </div>

                    {/* Applications List */}
                    <div className="space-y-4">
                      {applicantsList.map((app) => {
                        const config = getStatusConfig(app.status);
                        return (
                          <div key={app.id} className="border border-slate-150 rounded-xl overflow-hidden shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
                            {/* Card header */}
                            <div className="bg-slate-50/30 px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4.5 w-4.5 text-slate-400" />
                                <span className="font-bold text-slate-800 text-sm">{app.program_name}</span>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wide w-fit ${config.badge}`}>
                                {(applicantStatusLabels as any)[app.status] || app.status}
                              </span>
                            </div>

                            {/* Card body */}
                            <div className="p-5">
                              <div className={`p-4 rounded-xl border flex gap-3.5 items-start ${config.bg}`}>
                                <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                  {config.icon}
                                </div>
                                <div className="space-y-1">
                                  <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug">{config.title}</p>
                                  <p className="text-xs sm:text-sm leading-relaxed opacity-90">{config.desc}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                ) : (
                  <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-350 rounded-xl">
                    <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-700 text-base">Pendaftaran Tidak Ditemukan</p>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                      Belum ada pendaftaran aktif yang terdeteksi. Silakan pastikan data pencarian sudah benar atau daftar program baru terlebih dahulu.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
