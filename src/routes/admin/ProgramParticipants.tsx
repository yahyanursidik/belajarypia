import { useEffect, useState, useMemo } from "react";
import { Search, User, MapPin, GraduationCap, Download, Plus, X, Loader2, CheckCircle2, Database, UserPlus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { supabase } from "../../lib/supabase";

type AvailableParticipantRow = {
  id: string;
  display_name: string;
  global_participant_number: string;
  city: string | null;
  profiles?: {
    email: string;
  } | null;
  isEnrolled?: boolean;
};

type ProgramParticipantRow = {
  id: string;
  enrollment_number: string;
  enrollment_status: string;
  participants: {
    id: string;
    display_name: string;
    global_participant_number: string;
    city: string | null;
    gender: string | null;
    education_level: string | null;
    status: string;
    profiles?: {
      email: string;
      phone: string | null;
    } | null;
  };
};

export function ProgramParticipants({ programId }: { programId: string }) {
  const [rows, setRows] = useState<ProgramParticipantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Add Participant State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [availableParticipants, setAvailableParticipants] = useState<AvailableParticipantRow[]>([]);
  const [filteredAvailable, setFilteredAvailable] = useState<AvailableParticipantRow[]>([]);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(new Set());
  const [isFetchingAvailable, setIsFetchingAvailable] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollStep, setEnrollStep] = useState<1 | 2 | 3>(1);
  const [enrollStats, setEnrollStats] = useState({ success: 0, fail: 0, processed: 0, total: 0 });

  useEffect(() => {
    fetchParticipants();
  }, [programId]);

  const fetchParticipants = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id, enrollment_number, enrollment_status,
        participants!inner (
          id, display_name, global_participant_number, city, gender, education_level, status,
          profiles ( email, phone )
        )
      `)
      .eq("program_id", programId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRows(data as unknown as ProgramParticipantRow[]);
    }
    setIsLoading(false);
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (!searchQuery) return true;
      const lowerQ = searchQuery.toLowerCase();
      const p = r.participants;
      return (
        p.display_name.toLowerCase().includes(lowerQ) ||
        r.enrollment_number.toLowerCase().includes(lowerQ) ||
        p.global_participant_number.toLowerCase().includes(lowerQ) ||
        (p.profiles?.email || "").toLowerCase().includes(lowerQ)
      );
    });
  }, [rows, searchQuery]);

  const openAddModal = () => {
    setIsAddModalOpen(true);
    setEnrollStep(1);
    setEnrollStats({ success: 0, fail: 0, processed: 0, total: 0 });
    setAddSearchQuery("");
    setSelectedParticipantIds(new Set());
    fetchAvailableParticipants();
  };

  const fetchAvailableParticipants = async () => {
    setIsFetchingAvailable(true);
    
    // Get currently enrolled participant IDs
    const enrolledIds = rows.map(r => r.participants.id);
    
    // Fetch all participants
    const { data, error } = await supabase
      .from("participants")
      .select(`
        id, display_name, global_participant_number, city,
        profiles ( email )
      `)
      .eq("status", "active");
      
    if (!error && data) {
      // Map to add isEnrolled flag instead of filtering them out completely
      const available = (data as unknown as AvailableParticipantRow[])
        .map(p => ({
          ...p,
          isEnrolled: enrolledIds.includes(p.id)
        }))
        .sort((a, b) => {
          // Sort enrolled participants to the bottom, then by name
          if (a.isEnrolled && !b.isEnrolled) return 1;
          if (!a.isEnrolled && b.isEnrolled) return -1;
          return a.display_name.localeCompare(b.display_name);
        });
        
      setAvailableParticipants(available);
      setFilteredAvailable(available);
    }
    setIsFetchingAvailable(false);
  };

  useEffect(() => {
    if (!addSearchQuery.trim()) {
      setFilteredAvailable(availableParticipants);
      return;
    }
    const lowerQ = addSearchQuery.toLowerCase();
    const filtered = availableParticipants.filter(p => 
      p.display_name.toLowerCase().includes(lowerQ) ||
      p.global_participant_number.toLowerCase().includes(lowerQ) ||
      (p.profiles?.email || "").toLowerCase().includes(lowerQ)
    );
    setFilteredAvailable(filtered);
  }, [addSearchQuery, availableParticipants]);

  const toggleSelection = (id: string) => {
    setSelectedParticipantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    // Only select those who are not already enrolled
    const selectable = filteredAvailable.filter(p => !p.isEnrolled);
    
    if (selectedParticipantIds.size === selectable.length && selectable.length > 0) {
      setSelectedParticipantIds(new Set());
    } else {
      setSelectedParticipantIds(new Set(selectable.map(p => p.id)));
    }
  };

  const handleEnrollSelected = async () => {
    if (selectedParticipantIds.size === 0) return;
    setIsEnrolling(true);
    setEnrollStep(2);
    setEnrollStats({ success: 0, fail: 0, processed: 0, total: selectedParticipantIds.size });
    
    const idsToEnroll = Array.from(selectedParticipantIds);
    let successCount = 0;
    let failCount = 0;
    let processed = 0;
    
    for (const pId of idsToEnroll) {
      processed++;
      setEnrollStats(prev => ({ ...prev, processed }));

      const { error } = await supabase.rpc("direct_enroll_participant", {
        target_participant_id: pId,
        target_program_id: programId
      });
      if (!error) successCount++;
      else failCount++;
    }
    
    setEnrollStats(prev => ({ ...prev, success: successCount, fail: failCount }));
    setEnrollStep(3);
    setIsEnrolling(false);
  };

  const exportToCSV = () => {
    const csvRows = [
      ["NIS", "No. Pendaftaran", "Nama", "Email", "No. HP", "Kota", "Pendidikan", "Gender", "Status Enrollment", "Last Login"]
    ];
    for (const row of filteredRows) {
      const p = row.participants;
      csvRows.push([
        `"${p.global_participant_number}"`,
        `"${row.enrollment_number}"`,
        `"${p.display_name}"`,
        `"${p.profiles?.email || ""}"`,
        `"${p.profiles?.phone || ""}"`,
        `"${p.city || ""}"`,
        `"${p.education_level || ""}"`,
        `"${p.gender || ""}"`,
        `"${row.enrollment_status}"`,
        `"-"` // Mocking last login
      ]);
    }
    const csvString = csvRows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Data_Peserta_Program_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-100">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari nama, NIS, atau email peserta..." 
            className="w-full pl-9 pr-4 py-2 text-sm border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={exportToCSV} className="w-full sm:w-auto flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={openAddModal} className="w-full sm:w-auto flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Tambah dari Database
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Profil Peserta</th>
                <th className="px-6 py-4 font-semibold">Kontak & Domisili</th>
                <th className="px-6 py-4 font-semibold">Pendidikan & Gender</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <p className="font-medium">Memuat data peserta...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    <User className="h-16 w-16 mx-auto mb-4 text-slate-200" />
                    <p className="font-medium text-lg text-slate-600">Tidak ada peserta</p>
                    <p className="text-sm">Belum ada peserta di program ini atau pencarian tidak ditemukan.</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                          {row.participants.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                            {row.participants.display_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                              {row.participants.global_participant_number}
                            </span>
                            <span>•</span>
                            <span>{row.enrollment_number}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <p className="text-slate-600 flex items-center gap-2">
                          <User className="h-3.5 w-3.5 opacity-70" />
                          {row.participants.profiles?.email || "-"}
                        </p>
                        <p className="text-slate-600 flex items-center gap-2 text-xs">
                          <MapPin className="h-3.5 w-3.5 opacity-70" />
                          {row.participants.city || "Kota belum diisi"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <p className="text-slate-600 flex items-center gap-2">
                          <GraduationCap className="h-3.5 w-3.5 opacity-70" />
                          {row.participants.education_level || "-"}
                        </p>
                        <p className="text-slate-500 text-xs pl-5">
                          {row.participants.gender || "-"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={row.enrollment_status === 'active' ? 'default' : 'secondary'}>
                        {row.enrollment_status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400 font-mono text-xs">
                      -
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
          <span>Total: {filteredRows.length} peserta</span>
          <span>*Last login info is currently unavailable</span>
        </div>
      </Card>

      {/* Modal Add Participant */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className={`w-full ${enrollStep === 1 ? 'max-w-4xl' : 'max-w-lg'} shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}>
            <div className="bg-primary p-5 text-primary-foreground flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white">Tambah Peserta ke Program</h3>
                <p className="text-white/80 text-sm mt-1">Pilih peserta dari direktori untuk didaftarkan ke program ini.</p>
              </div>
              {enrollStep !== 2 && (
                <button onClick={() => setIsAddModalOpen(false)} className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {enrollStep === 1 && (
              <>
                <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari nama, NIS, atau email..." 
                      className="w-full pl-9 pr-4 py-2.5 text-sm border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-all"
                      value={addSearchQuery}
                      onChange={(e) => setAddSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-0 bg-white min-h-[400px]">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 w-14 text-center border-r border-slate-100">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                            checked={
                              filteredAvailable.filter(p => !p.isEnrolled).length > 0 && 
                              selectedParticipantIds.size === filteredAvailable.filter(p => !p.isEnrolled).length
                            }
                            onChange={toggleSelectAll}
                            disabled={isFetchingAvailable || filteredAvailable.filter(p => !p.isEnrolled).length === 0}
                          />
                        </th>
                        <th className="px-6 py-3 font-semibold">Nama Peserta</th>
                        <th className="px-6 py-3 font-semibold">NIS</th>
                        <th className="px-6 py-3 font-semibold">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isFetchingAvailable ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-20 text-center text-slate-500">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary/50" />
                            <p className="font-medium">Memuat database peserta...</p>
                          </td>
                        </tr>
                      ) : filteredAvailable.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-20 text-center text-slate-500">
                            <Database className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium text-lg text-slate-700">Tidak ada peserta yang tersedia</p>
                            <p className="text-sm mt-1 max-w-sm mx-auto">Semua peserta aktif di direktori mungkin sudah terdaftar pada program ini, atau pencarian Anda tidak membuahkan hasil.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredAvailable.map((p) => {
                          const isSelected = selectedParticipantIds.has(p.id);
                          const isEnrolled = p.isEnrolled;
                          
                          return (
                            <tr 
                              key={p.id} 
                              className={`
                                transition-colors group
                                ${isEnrolled ? 'bg-slate-50 opacity-60' : 'hover:bg-primary/5 cursor-pointer'} 
                                ${isSelected ? 'bg-primary/5' : ''}
                              `} 
                              onClick={() => { if (!isEnrolled) toggleSelection(p.id); }}
                            >
                              <td className={`px-4 py-3 text-center border-r border-slate-100 ${!isEnrolled ? 'group-hover:bg-primary/10 transition-colors' : ''}`} onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  checked={isSelected || isEnrolled}
                                  disabled={isEnrolled}
                                  onChange={() => toggleSelection(p.id)}
                                />
                              </td>
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors 
                                    ${isEnrolled ? 'bg-slate-200 text-slate-400' : 
                                      isSelected ? 'bg-primary text-white shadow-md' : 'bg-slate-100 text-slate-600 group-hover:bg-primary/20 group-hover:text-primary'}
                                  `}>
                                    {p.display_name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={`font-medium transition-colors ${isSelected ? 'text-primary' : isEnrolled ? 'text-slate-500' : 'text-slate-900 group-hover:text-primary'}`}>{p.display_name}</span>
                                    {isEnrolled && (
                                      <span className="text-[10px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Sudah Terdaftar
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-3 text-slate-600 font-mono text-xs"><Badge variant="outline" className={`${isSelected ? 'border-primary/30 text-primary' : ''} bg-transparent`}>{p.global_participant_number}</Badge></td>
                              <td className="px-6 py-3 text-slate-600">{p.profiles?.email || "-"}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                  <span className="text-sm font-medium text-slate-600">
                    <span className="font-bold text-primary text-lg">{selectedParticipantIds.size}</span> peserta dipilih
                  </span>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setIsAddModalOpen(false)} disabled={isEnrolling} className="px-6">Batal</Button>
                    <Button 
                      onClick={handleEnrollSelected} 
                      disabled={selectedParticipantIds.size === 0 || isEnrolling}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[220px] shadow-lg shadow-primary/20 transition-all active:scale-95"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Tambahkan {selectedParticipantIds.size} Terpilih
                    </Button>
                  </div>
                </div>
              </>
            )}

            {enrollStep === 2 && (
              <div className="flex flex-col items-center justify-center p-12 bg-white space-y-6 animate-in fade-in duration-300 min-h-[400px]">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <UserPlus className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-slate-800">Mendaftarkan Peserta...</h3>
                  <p className="text-slate-500 mt-2">Mohon tunggu, sedang memproses data <span className="font-semibold text-primary">{enrollStats.processed}</span> dari {enrollStats.total} peserta.</p>
                </div>
                <div className="w-full max-w-md bg-slate-100 h-3 rounded-full overflow-hidden mt-4 shadow-inner">
                  <div 
                    className="bg-primary h-full transition-all duration-300 ease-out relative" 
                    style={{ width: `${(enrollStats.processed / Math.max(1, enrollStats.total)) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_1s_infinite]"></div>
                  </div>
                </div>
              </div>
            )}

            {enrollStep === 3 && (
              <div className="flex flex-col items-center justify-center p-10 bg-white space-y-6 animate-in zoom-in-95 duration-300 min-h-[400px]">
                <div className="w-28 h-28 bg-emerald-100 rounded-full flex items-center justify-center mb-2 shadow-inner ring-8 ring-emerald-50">
                  <CheckCircle2 className="w-14 h-14 text-emerald-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-slate-800">Pendaftaran Selesai!</h3>
                  <p className="text-slate-500 mt-3 text-lg">Proses pendaftaran massal ke program telah selesai dijalankan.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-6 w-full max-w-md mt-6">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center shadow-sm">
                    <p className="text-5xl font-bold text-emerald-600">{enrollStats.success}</p>
                    <p className="text-sm font-semibold text-emerald-800 mt-2 uppercase tracking-wider">Berhasil</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center shadow-sm">
                    <p className="text-5xl font-bold text-red-600">{enrollStats.fail}</p>
                    <p className="text-sm font-semibold text-red-800 mt-2 uppercase tracking-wider">Gagal</p>
                  </div>
                </div>

                <div className="pt-10 w-full max-w-md">
                  <Button 
                    onClick={() => {
                      setIsAddModalOpen(false);
                      fetchParticipants();
                    }} 
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white h-14 text-lg shadow-xl shadow-slate-900/20 rounded-xl"
                  >
                    Tutup & Lihat Data Terbaru
                  </Button>
                </div>
              </div>
            )}

          </Card>
        </div>
      )}
    </div>
  );
}
