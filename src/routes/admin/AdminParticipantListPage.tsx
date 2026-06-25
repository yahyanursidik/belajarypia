import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, User, Filter, MapPin, GraduationCap, Phone } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { supabase } from "../../lib/supabase";
import type { Participant } from "../../lib/participant";
import type { Program } from "../../lib/organization";

const toast = { success: alert, error: alert };

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
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    global_participant_number: "",
    display_name: "",
    gender: "Laki-laki",
    participant_type: "adult",
    city: "",
    education_level: ""
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    
    // Fetch programs for filter
    const { data: progData } = await supabase.from("programs").select("id, name").order("name");
    if (progData) setPrograms(progData as Program[]);

    // Fetch participants with profile and enrollments
    const { data: partData, error } = await supabase
      .from("participants")
      .select("*, profiles(full_name, email, phone), enrollments(program_id)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Gagal memuat data peserta");
    } else {
      setParticipants(partData as ParticipantRow[]);
    }
    setIsLoading(false);
  };

  const handleCreateParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const nis = form.global_participant_number.trim() || `NIS-${Date.now().toString().slice(-6)}`;

    const { error } = await supabase.from("participants").insert([
      {
        global_participant_number: nis,
        display_name: form.display_name,
        gender: form.gender,
        participant_type: form.participant_type,
        city: form.city,
        education_level: form.education_level,
        status: "active"
      }
    ]).select().single();

    if (error) {
      if (error.code === '23505') {
        toast.error("Nomor Induk sudah terdaftar.");
      } else {
        toast.error("Gagal menambahkan peserta: " + error.message);
      }
    } else {
      toast.success("Peserta berhasil ditambahkan");
      setIsModalOpen(false);
      setForm({ global_participant_number: "", display_name: "", gender: "Laki-laki", participant_type: "adult", city: "", education_level: "" });
      fetchInitialData();
    }
    setIsSubmitting(false);
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = 
      p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.global_participant_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesProgram = programFilter === "all" || p.enrollments?.some(e => e.program_id === programFilter);
    return matchesSearch && matchesStatus && matchesProgram;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            Direktori Peserta
          </h1>
          <p className="text-slate-500 mt-1 text-sm ml-12">Kelola data seluruh peserta dari berbagai program.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="shadow-md bg-indigo-600 hover:bg-indigo-700">
          <Plus className="mr-2 h-4 w-4" />
          Peserta Baru
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          {/* Top Filter Bar */}
          <div className="flex flex-col lg:flex-row gap-4 p-4 border-b bg-slate-50/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Cari nama, NIS..." 
                className="pl-9 bg-white border-slate-200 focus-visible:ring-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select 
                  className="w-full pl-9 h-10 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                >
                  <option value="all">Semua Program ({participants.length})</option>
                  {programs.map(prog => (
                    <option key={prog.id} value={prog.id}>{prog.name}</option>
                  ))}
                </select>
              </div>

              <select 
                className="w-full sm:w-40 h-10 rounded-md border border-slate-200 bg-white text-sm px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Status: Semua</option>
                <option value="active">Status: Aktif</option>
                <option value="inactive">Status: Tidak Aktif</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
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
                        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="font-medium">Memuat direktori...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                      <User className="h-16 w-16 mx-auto mb-4 text-slate-200" />
                      <p className="font-medium text-lg text-slate-600">Tidak ada peserta</p>
                      <p className="text-sm">Coba sesuaikan filter pencarian atau program Anda.</p>
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-bold text-lg shrink-0 shadow-inner">
                            {p.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{p.display_name}</p>
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
                          {p.profiles?.phone && (
                            <div className="flex items-center gap-2 text-slate-600">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-xs">{p.profiles.phone}</span>
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
                        <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-50 text-indigo-700 font-bold text-sm ring-4 ring-white shadow-sm">
                          {p.enrollments?.length || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="hover:bg-indigo-50 hover:text-indigo-600"
                          onClick={() => navigate(`/system/peserta/${p.id}`)}
                        >
                          Lihat Detail
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

      {/* Modal Tambah Peserta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl border-0 animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b bg-slate-50/50 py-4 px-6">
              <CardTitle className="text-xl text-slate-800">Tambah Peserta Baru</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleCreateParticipant} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block text-slate-700">Nomor Induk (NIS) <span className="text-slate-400 font-normal text-xs ml-1">(Kosongkan untuk otomatis)</span></label>
                  <Input 
                    placeholder="Contoh: NIS-2026001" 
                    value={form.global_participant_number} 
                    onChange={e => setForm({...form, global_participant_number: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block text-slate-700">Nama Lengkap <span className="text-red-500">*</span></label>
                  <Input 
                    required 
                    placeholder="Masukkan nama lengkap peserta" 
                    value={form.display_name} 
                    onChange={e => setForm({...form, display_name: e.target.value})} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block text-slate-700">Jenis Kelamin</label>
                    <select 
                      className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      value={form.gender} 
                      onChange={e => setForm({...form, gender: e.target.value})}
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block text-slate-700">Pendidikan Terakhir</label>
                    <select 
                      className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
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
                <div>
                  <label className="text-sm font-semibold mb-1.5 block text-slate-700">Kota / Domisili</label>
                  <Input 
                    placeholder="Contoh: Jakarta Selatan" 
                    value={form.city} 
                    onChange={e => setForm({...form, city: e.target.value})} 
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                    {isSubmitting ? "Menyimpan..." : "Simpan Peserta"}
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
