import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Users, BookOpen, Plus, ShieldCheck, Mail, Calendar, MapPin, Trash2, GraduationCap, Phone, FileText } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { supabase } from "../../lib/supabase";
import type { Participant, Enrollment } from "../../lib/participant";

const toast = { success: alert, error: alert };

export function AdminParticipantDetailPage() {
  const { participantId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"profile" | "guardians" | "enrollments">("profile");
  
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [guardianRels, setGuardianRels] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (participantId) {
      fetchData();
    }
  }, [participantId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Participant
      const { data: pData } = await supabase
        .from("participants")
        .select("*, profiles(full_name, email, phone)")
        .eq("id", participantId)
        .single();
      
      if (pData) setParticipant(pData);

      // 2. Fetch Guardians
      const { data: gData } = await supabase
        .from("guardian_participants")
        .select("*, guardians(*, profiles(full_name, email, phone))")
        .eq("participant_id", participantId);
      
      if (gData) setGuardianRels(gData);

      // 3. Fetch Enrollments
      const { data: eData } = await supabase
        .from("enrollments")
        .select("*, programs(code, name), batches(code, name), classes(name, teacher_user_id, profiles(full_name)), halaqahs(name, mentor_user_id)")
        .eq("participant_id", participantId)
        .order("created_at", { ascending: false });
      
      if (eData) setEnrollments(eData as any[]);
    } catch (err) {
      toast.error("Gagal memuat detail peserta");
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfilesForGuardian = async () => {
    setIsGuardianModalOpen(true);
    const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
    if (data) setProfiles(data);
  };

  const handleAddGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileId) return toast.error("Pilih akun wali terlebih dahulu");
    
    setIsSubmitting(true);
    
    // Check if user is already a guardian
    let { data: existingGuardian } = await supabase.from("guardians").select("id").eq("user_id", selectedProfileId).single();
    let guardianId = existingGuardian?.id;

    if (!guardianId) {
      const { data: newGuardian, error: gError } = await supabase.from("guardians").insert([{ user_id: selectedProfileId }]).select().single();
      if (gError) {
        toast.error("Gagal membuat data wali");
        setIsSubmitting(false);
        return;
      }
      guardianId = newGuardian.id;
    }

    // Link Guardian to Participant
    const { error: linkError } = await supabase.from("guardian_participants").insert([{
      guardian_id: guardianId,
      participant_id: participantId,
      is_primary: guardianRels.length === 0 // first one is primary
    }]);

    if (linkError) {
      toast.error("Wali sudah tertaut atau terjadi kesalahan");
    } else {
      toast.success("Wali berhasil ditambahkan");
      setIsGuardianModalOpen(false);
      fetchData();
    }
    setIsSubmitting(false);
  };

  const handleRemoveGuardian = async (gpId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus tautan wali ini?")) return;
    const { error } = await supabase.from("guardian_participants").delete().eq("id", gpId);
    if (!error) {
      toast.success("Tautan wali dihapus");
      fetchData();
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-slate-500 font-medium">Memuat profil peserta...</p>
    </div>
  );
  if (!participant) return <div className="p-12 text-center text-red-500">Peserta tidak ditemukan</div>;

  const profileData = participant.profiles as any;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 max-w-7xl mx-auto">
      {/* Header Profile Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-primary to-primary/70" />
        <div className="px-6 pb-6 relative">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="-mt-16 h-32 w-32 rounded-2xl bg-white p-1.5 shadow-md border border-slate-100 shrink-0">
              <div className="h-full w-full rounded-xl bg-primary/10 flex items-center justify-center text-4xl text-primary font-bold">
                {participant.display_name.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="flex-1 mt-2 text-center md:text-left">
              <h1 className="text-2xl font-bold text-slate-900">{participant.display_name}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                <span className="font-mono text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-md border border-primary/20">
                  {participant.global_participant_number}
                </span>
                <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md uppercase tracking-wide">
                  {participant.participant_type}
                </span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-md uppercase tracking-wide ${
                  participant.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                }`}>
                  {participant.status}
                </span>
              </div>
            </div>
            <div className="mt-4 md:mt-2">
              <Button variant="outline" onClick={() => navigate("/system/peserta")} className="shadow-sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-slate-200 bg-white/50 px-2 pt-2 sticky top-0 z-10 backdrop-blur-sm">
        <button 
          onClick={() => setActiveTab("profile")} 
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === "profile" ? "border-primary text-primary bg-primary/5" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
        >
          <div className="flex items-center gap-2"><User className="h-4 w-4" /> Profil & Biodata</div>
        </button>
        <button 
          onClick={() => setActiveTab("guardians")} 
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === "guardians" ? "border-primary text-primary bg-primary/5" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
        >
          <div className="flex items-center gap-2"><Users className="h-4 w-4" /> Relasi Wali <span className="bg-slate-100 text-slate-600 px-1.5 rounded-full text-xs ml-1">{guardianRels.length}</span></div>
        </button>
        <button 
          onClick={() => setActiveTab("enrollments")} 
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === "enrollments" ? "border-primary text-primary bg-primary/5" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
        >
          <div className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Riwayat Program <span className="bg-slate-100 text-slate-600 px-1.5 rounded-full text-xs ml-1">{enrollments.length}</span></div>
        </button>
      </div>

      {/* Tab Content: Profile */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Main Info Card */}
          <Card className="md:col-span-2 shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Informasi Pribadi & Kontak
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Nama Tampilan</p>
                  <p className="font-semibold text-slate-900">{participant.display_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Jenis Kelamin</p>
                  <p className="font-medium text-slate-800">{participant.gender || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <p className="font-medium text-slate-800 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400"/> 
                    {profileData?.email || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">WhatsApp / Telepon</p>
                  <p className="font-medium text-slate-800 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400"/> 
                    {profileData?.phone || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Kota / Domisili</p>
                  <p className="font-medium text-slate-800 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400"/> 
                    {participant.city || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Pendidikan Terakhir</p>
                  <p className="font-medium text-slate-800 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-slate-400"/> 
                    {participant.education_level || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Tanggal Bergabung</p>
                  <p className="font-medium text-slate-800 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400"/> 
                    {participant.joined_at ? new Date(participant.joined_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connected Account Card */}
          <Card className="shadow-sm border-primary/20 bg-gradient-to-b from-primary/5 to-white h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-5 w-5 text-primary" /> Akun Sistem
              </CardTitle>
              <CardDescription className="text-xs">Akun login (Profiles) yang terhubung dengan data direktori peserta ini.</CardDescription>
            </CardHeader>
            <CardContent>
              {profileData ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-primary/20 shadow-sm text-center">
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl ring-4 ring-white shadow-sm">
                      {profileData.full_name?.charAt(0) || "U"}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{profileData.full_name}</p>
                      <p className="text-sm text-slate-500 flex items-center justify-center gap-1 mt-1 break-all">
                        <Mail className="h-3.5 w-3.5"/> {profileData.email}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full text-xs h-8 border-primary/30 text-primary hover:bg-primary/5">
                    Reset Password
                  </Button>
                </div>
              ) : (
                <div className="text-center p-6 bg-white rounded-xl border border-dashed border-slate-300">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <User className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium mb-1">Belum Ada Akun</p>
                  <p className="text-xs text-slate-400 mb-4">Peserta ini belum ditautkan dengan akun login sistem.</p>
                  <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">Tautkan Akun</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab Content: Guardians */}
      {activeTab === "guardians" && (
        <Card className="shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b">
            <div>
              <CardTitle className="text-lg text-slate-800">Relasi Wali (Guardian)</CardTitle>
              <CardDescription>Kelola akun wali atau orang tua dari peserta ini.</CardDescription>
            </div>
            <Button onClick={loadProfilesForGuardian} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" /> Tautkan Wali
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            {guardianRels.length === 0 ? (
              <div className="text-center py-16 px-4 border rounded-xl border-dashed border-slate-300 bg-slate-50/50">
                <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 font-medium">Belum ada wali yang terhubung.</p>
                <p className="text-sm text-slate-400 mt-1">Anda dapat menautkan akun wali agar mereka dapat memantau perkembangan peserta.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {guardianRels.map(rel => (
                  <div key={rel.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-primary/30 transition-colors bg-white shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 flex items-center justify-center font-bold text-lg shrink-0">
                        {rel.guardians?.profiles?.full_name?.charAt(0) || "W"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold text-slate-900">{rel.guardians?.profiles?.full_name}</p>
                          {rel.is_primary && <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] uppercase font-bold rounded-md">Utama</span>}
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                          {rel.guardians?.profiles?.phone && (
                            <p className="text-xs text-slate-500 flex items-center gap-1.5"><Phone className="h-3 w-3"/> {rel.guardians?.profiles?.phone}</p>
                          )}
                          <p className="text-xs text-slate-500 flex items-center gap-1.5"><Mail className="h-3 w-3"/> {rel.guardians?.profiles?.email || "-"}</p>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-full shrink-0" onClick={() => handleRemoveGuardian(rel.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab Content: Enrollments */}
      {activeTab === "enrollments" && (
        <Card className="shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 border-slate-200 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-lg text-slate-800">Riwayat Pendaftaran & Akademik</CardTitle>
            <CardDescription>Daftar seluruh program yang diikuti oleh peserta ini.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {enrollments.length === 0 ? (
              <div className="text-center py-16 px-4">
                <BookOpen className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 font-medium">Belum ada riwayat program.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Detail Program</th>
                      <th className="px-6 py-4 font-semibold">Penempatan Kelas</th>
                      <th className="px-6 py-4 font-semibold">Status Pendaftaran</th>
                      <th className="px-6 py-4 font-semibold">Tgl. Daftar</th>
                      <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-slate-50/20">
                    {enrollments.map(en => (
                      <tr key={en.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{(en as any).programs?.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                  {en.enrollment_number}
                                </span>
                                <span className="text-xs text-slate-500 font-medium">
                                  {(en as any).batches?.name || "Angkatan Belum Diatur"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {!(en as any).classes?.name ? (
                            <span className="text-xs text-slate-400 italic">Belum ditempatkan</span>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-medium text-slate-800 text-sm">{(en as any).classes?.name}</p>
                              {(en as any).halaqahs?.name && (
                                <p className="text-xs text-slate-500 flex items-center gap-1.5"><Users className="h-3 w-3 text-slate-400"/> {(en as any).halaqahs?.name}</p>
                              )}
                              {(en as any).classes?.profiles?.full_name && (
                                <p className="text-xs text-primary flex items-center gap-1.5 font-medium"><User className="h-3 w-3"/> {(en as any).classes?.profiles?.full_name}</p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            en.enrollment_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                            en.enrollment_status === 'completed' ? 'bg-blue-100 text-blue-700' :
                            en.enrollment_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {en.enrollment_status === 'active' ? 'Aktif Belajar' : en.enrollment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-medium text-xs">
                          {en.created_at ? new Date(en.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : "-"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs text-primary border-primary/30 hover:bg-primary/5"
                            onClick={() => navigate(`/system/peserta/${participantId}/transkrip/${en.id}`)}
                          >
                            <FileText className="h-3 w-3 mr-1.5" />
                            Transkrip
                          </Button>
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

      {/* Modal Tambah Wali */}
      {isGuardianModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl border-0 animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b bg-slate-50/50 py-4 px-6">
              <CardTitle className="text-xl text-slate-800">Tautkan Wali / Orang Tua</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddGuardian} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block text-slate-700">Pilih Akun Wali <span className="text-red-500">*</span></label>
                  <select 
                    required
                    className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
                    value={selectedProfileId} 
                    onChange={e => setSelectedProfileId(e.target.value)}
                  >
                    <option value="" disabled>-- Pilih Pengguna Terdaftar --</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1.5">Wali harus sudah memiliki akun profil di dalam sistem terlebih dahulu.</p>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsGuardianModalOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {isSubmitting ? "Menyimpan..." : "Tautkan Wali"}
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
