import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Megaphone, Plus, Trash2, X, Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";

export function AdminAnnouncementsPage() {
  const { profile } = useAuthSession();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Feedback State
  const [feedback, setFeedback] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Form State
  const [form, setForm] = useState({
    title: "",
    content: "",
    target_role: "all",
    target_program_id: "",
    status: "published"
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    // Fetch Announcements
    const { data: annData } = await supabase
      .from('announcements')
      .select('*, programs(name), profiles(full_name)')
      .order('created_at', { ascending: false });
      
    // Fetch Programs for filtering/targeting
    const { data: progData } = await supabase
      .from('programs')
      .select('id, name')
      .order('name');
      
    if (annData) setAnnouncements(annData);
    if (progData) setPrograms(progData);
    
    setIsLoading(false);
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setIsSaving(true);
    
    try {
      const payload = {
        title: form.title,
        content: form.content,
        target_role: form.target_role,
        target_program_id: form.target_program_id || null,
        status: form.status,
        created_by: profile.id
      };
      
      const { error } = await supabase.from('announcements').insert(payload);
      
      if (error) throw error;
      
      setIsModalOpen(false);
      setForm({ title: "", content: "", target_role: "all", target_program_id: "", status: "published" });
      setFeedback({ message: "Pengumuman berhasil disiarkan!", type: "success" });
      await loadData();
      
      // Auto-hide feedback after 4 seconds
      setTimeout(() => setFeedback(null), 4000);
      
    } catch (error: any) {
      console.error(error);
      setFeedback({ message: "Gagal memproses pengumuman: " + error.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus pengumuman ini?")) return;
    
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      
      setAnnouncements(announcements.filter(a => a.id !== id));
      setFeedback({ message: "Pengumuman telah dihapus.", type: "success" });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ message: "Gagal menghapus: " + err.message, type: "error" });
    }
  };

  return (
    <div className="page-stack space-y-6 pb-12">
      <section className="page-hero">
        <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30 backdrop-blur-sm shadow-sm">
          PUSAT INFORMASI
        </Badge>
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="hidden md:flex h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-xl items-center justify-center border border-white/20 shadow-inner">
            <Megaphone className="h-10 w-10 text-white drop-shadow-md" />
          </div>
          <div>
            <h2 className="text-white text-3xl font-bold tracking-tight">Kelola Pengumuman</h2>
            <p className="text-white/80 max-w-xl text-sm leading-relaxed mt-1">
              Buat dan sebarkan informasi massal ke berbagai target pengguna di seluruh ekosistem LMS YPIA.
            </p>
          </div>
          <div className="md:ml-auto">
            <Button 
              onClick={() => {
                setFeedback(null);
                setIsModalOpen(true);
              }}
              className="bg-white text-primary hover:bg-white/90 shadow-lg rounded-full font-semibold px-6"
            >
              <Plus className="w-4 h-4 mr-2" /> Buat Pengumuman
            </Button>
          </div>
        </div>
      </section>

      {/* Pesan Feedback UI */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-sm">
              {feedback.type === 'success' ? 'Berhasil' : 'Terdapat Kesalahan'}
            </h4>
            <p className="text-sm mt-0.5 opacity-90">{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 transition-opacity">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Card className="border-border/40 shadow-sm relative overflow-hidden">
        <CardHeader className="bg-white border-b pb-4">
          <CardTitle>Riwayat Pengumuman</CardTitle>
          <CardDescription>Semua pesan siaran yang pernah dikirim tercatat di sini.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 border-b border-border/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Judul Pengumuman</th>
                  <th className="px-6 py-4 font-semibold">Target Audiens</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="font-medium">Memuat data pengumuman...</p>
                      </div>
                    </td>
                  </tr>
                ) : announcements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-slate-500">
                      <Megaphone className="h-16 w-16 mx-auto mb-4 text-slate-200" />
                      <p className="font-medium text-lg text-slate-600">Belum Ada Pengumuman</p>
                      <p className="text-sm">Klik tombol 'Buat Pengumuman' untuk memulai siaran pertama Anda.</p>
                    </td>
                  </tr>
                ) : (
                  announcements.map((a) => (
                    <tr key={a.id} className="hover:bg-primary/5 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{a.title}</p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{a.content}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Ditulis oleh: {a.profiles?.full_name || 'Admin'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                            {a.target_role === 'all' ? 'Semua Pengguna' : 
                             a.target_role === 'participant' ? 'Semua Peserta' : 
                             a.target_role === 'teacher' ? 'Semua Guru' : a.target_role}
                          </span>
                          {a.programs?.name && (
                            <div className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 w-fit">
                              Program: {a.programs.name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          a.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {a.status === 'published' ? (
                            <><Send className="h-3 w-3" /> Siaran Aktif</>
                          ) : 'Draf Disimpan'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(a.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Buat Pengumuman */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl shadow-2xl overflow-hidden border-none animate-in zoom-in-95 duration-200">
            <div className="bg-primary p-6 text-primary-foreground flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl mb-1 text-white">Tulis Pengumuman</CardTitle>
                <CardDescription className="text-white/80">Siarkan informasi ke beranda target audiens Anda.</CardDescription>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <CardContent className="p-6 bg-white max-h-[85vh] overflow-y-auto">
              {feedback?.type === 'error' && (
                <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>{feedback.message}</p>
                </div>
              )}
              
              <form onSubmit={handleCreateAnnouncement} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Judul Pengumuman <span className="text-red-500">*</span></label>
                  <Input 
                    required 
                    placeholder="Contoh: Libur Nasional Pendaftaran" 
                    className="h-10"
                    value={form.title} 
                    onChange={e => setForm({...form, title: e.target.value})} 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Isi Pengumuman <span className="text-red-500">*</span></label>
                  <textarea 
                    required
                    rows={4}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Tulis pesan lengkap di sini..."
                    value={form.content}
                    onChange={e => setForm({...form, content: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Target Audiens (Peran)</label>
                    <select 
                      className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={form.target_role}
                      onChange={e => setForm({...form, target_role: e.target.value})}
                    >
                      <option value="all">🌐 Semua Pengguna (Publik)</option>
                      <option value="participant">🎓 Semua Peserta Siswa</option>
                      <option value="teacher">👨‍🏫 Semua Guru / Asatidzah</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Target Program (Opsional)</label>
                    <select 
                      className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={form.target_program_id}
                      onChange={e => setForm({...form, target_program_id: e.target.value})}
                    >
                      <option value="">-- Semua Program Tersedia --</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground leading-tight">Biarkan kosong jika pengumuman ini berlaku untuk seluruh program.</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-end pt-4 border-t mt-6">
                  <select
                    className="h-10 rounded-md border border-input bg-white px-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.status}
                    onChange={e => setForm({...form, status: e.target.value})}
                  >
                    <option value="published">Siarkan Langsung (Published)</option>
                    <option value="draft">Simpan sebagai Draf (Draft)</option>
                  </select>
                  <Button type="submit" disabled={isSaving} className="min-w-[120px]">
                    {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Proses...</> : <><Send className="h-4 w-4 mr-2" /> Simpan</>}
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
