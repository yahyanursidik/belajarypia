import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, BookOpen, Clock, Settings, X, ArrowRight, Filter, GraduationCap, Edit2, Archive, LayoutGrid, List, Users, UserCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  allowedMvpFeatureFlags,
  defaultMvpFeatureFlags,
  mergeWithDefaultFeatureFlags,
  mvpFeatureFlagLabels,
  type MvpFeatureFlags,
  type MvpFeatureFlagKey,
  type Program,
  type ProgramStatus,
  type Unit,
} from "../../lib/organization";
import { supabase } from "../../lib/supabase";

type ProgramFormState = {
  unit_id: string;
  code: string;
  name: string;
  description: string;
  program_type: string;
  curriculum_model: string;
  delivery_mode: string;
  status: ProgramStatus;
  feature_flags: MvpFeatureFlags;
  teacher_user_id: string;
};

const initialProgramForm: ProgramFormState = {
  unit_id: "",
  code: "",
  name: "",
  description: "",
  program_type: "general",
  curriculum_model: "mandiri",
  delivery_mode: "online",
  status: "draft",
  feature_flags: defaultMvpFeatureFlags,
  teacher_user_id: "",
};

type ProgramWithEnrollments = Program & {
  enrollments?: Array<{ id: string }>;
};

export function AdminProgramListPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [programs, setPrograms] = useState<ProgramWithEnrollments[]>([]);
  const [staff, setStaff] = useState<Array<{id: string, full_name: string | null, email: string}>>([]);
  const [form, setForm] = useState<ProgramFormState>(initialProgramForm);
  
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [sortBy, setSortBy] = useState("name-asc");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const [{ data: unitRows, error: unitError }, { data: programRows, error: programError }, { data: staffRows }] =
      await Promise.all([
        supabase.from("units").select("id, organization_id, code, name, description, status").order("name"),
        supabase.from("programs").select("id, unit_id, code, name, description, program_type, curriculum_model, delivery_mode, status, feature_flags, teacher_user_id, created_at, units(code, name), enrollments(id)").order("name"),
        supabase.from("profiles").select("id, full_name, email")
      ]);

    if (unitError || programError) {
      setErrorMessage(unitError?.message ?? programError?.message ?? "Gagal memuat data.");
    } else {
      setUnits((unitRows ?? []) as Unit[]);
      setPrograms((programRows ?? []) as unknown as ProgramWithEnrollments[]);
      setStaff((staffRows ?? []) as Array<{id: string, full_name: string | null, email: string}>);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const setFlag = (key: MvpFeatureFlagKey, value: boolean) => {
    if (key === "use_ai_assist" || key === "use_audio_submission" || key === "use_video_submission") {
      return;
    }
    setForm((current) => ({
      ...current,
      feature_flags: {
        ...current.feature_flags,
        [key]: value,
      },
    }));
  };

  const filteredPrograms = programs.filter((p) => {
    const nameMatch = (p.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const codeMatch = (p.code || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || codeMatch;
    const matchesType = filterType === "all" || p.curriculum_model === filterType;
    const matchesStatus = filterStatus === "all" || p.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === "name-asc") return (a.name || "").localeCompare(b.name || "");
    if (sortBy === "name-desc") return (b.name || "").localeCompare(a.name || "");
    if (sortBy === "newest") {
      const dateA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
      const dateB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
      return dateB - dateA;
    }
    if (sortBy === "oldest") {
      const dateA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
      const dateB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
      return dateA - dateB;
    }
    return 0;
  });

  const totalPages = Math.ceil(filteredPrograms.length / itemsPerPage);
  const currentPrograms = filteredPrograms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterStatus, sortBy]);

  const openCreateModal = () => {
    setForm(initialProgramForm);
    setEditingProgramId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Program) => {
    setForm({
      unit_id: p.unit_id,
      code: p.code,
      name: p.name,
      description: p.description || "",
      program_type: p.program_type,
      curriculum_model: p.curriculum_model,
      delivery_mode: p.delivery_mode,
      status: p.status,
      feature_flags: p.feature_flags,
      teacher_user_id: p.teacher_user_id || "",
    });
    setEditingProgramId(p.id);
    setIsModalOpen(true);
  };

  const archiveProgram = async (id: string, currentStatus: string) => {
    const action = currentStatus === "archived" ? "mengaktifkan kembali" : "mengarsipkan";
    const newStatus = currentStatus === "archived" ? "draft" : "archived";
    if (!window.confirm(`Apakah Anda yakin ingin ${action} program ini?`)) return;
    
    setIsLoading(true);
    const { error } = await supabase.from("programs").update({ status: newStatus }).eq("id", id);
    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
    } else {
      setMessage(`Program berhasil di-${currentStatus === "archived" ? "aktifkan (draft)" : "arsipkan"}.`);
      await loadData();
    }
  };

  return (
    <div className="page-stack">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Katalog Program</h2>
          <p className="text-muted-foreground mt-1">Kelola dan kembangkan program pembelajaran Anda.</p>
        </div>
        <Button onClick={openCreateModal} className="rounded-full shadow-md hover:shadow-lg transition-all" size="lg">
          <Plus className="mr-2 h-5 w-5" /> Buat Program Baru
        </Button>
      </div>

      {errorMessage && (
        <Alert className="animate-in fade-in slide-in-from-top-2 border-red-500 bg-red-50 text-red-900">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="animate-in fade-in border-emerald-500 text-emerald-700 bg-emerald-50">
          <AlertTitle>Berhasil</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white/80 backdrop-blur-md border border-muted/60 shadow-sm rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama atau kode program..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/50 focus:bg-white border-muted/40 h-11 rounded-lg transition-all shadow-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-lg border border-muted/40">
            <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <select 
              className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer text-slate-700"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Semua Tipe</option>
              <option value="mandiri">Mandiri</option>
              <option value="angkatan">Terjadwal</option>
            </select>
            <div className="w-px h-4 bg-border mx-1"></div>
            <select 
              className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer text-slate-700"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="draft">Draft</option>
              <option value="archived">Diarsipkan</option>
            </select>
            <div className="w-px h-4 bg-border mx-1"></div>
            <select 
              className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer text-slate-700"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name-asc">A-Z</option>
              <option value="name-desc">Z-A</option>
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          </div>
          <div className="flex border border-muted/40 rounded-lg overflow-hidden bg-white shrink-0 p-0.5 shadow-sm">
            <button 
              className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
              onClick={() => setViewMode('grid')}
              title="Tampilan Grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button 
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
              onClick={() => setViewMode('table')}
              title="Tampilan Tabel"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Program Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center p-16 border-2 border-dashed rounded-xl bg-muted/10">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Tidak ada program ditemukan</h3>
          <p className="text-muted-foreground mt-2">Belum ada program yang sesuai dengan filter Anda.</p>
          {programs.length === 0 && (
            <Button onClick={openCreateModal} variant="outline" className="mt-4 rounded-full">
              Buat Program Pertama Anda
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === 'grid' ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {currentPrograms.map((program) => (
                <Card key={program.id} className="overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/40 group flex flex-col bg-white">
                  <div className={`h-1.5 w-full ${program.status === 'active' ? 'bg-primary' : program.status === 'draft' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-semibold tracking-wider text-[10px]">
                        {program.code}
                      </Badge>
                      <div className="flex items-center gap-1 bg-muted/20 rounded-full p-1 border border-muted/40 transition-opacity opacity-80 group-hover:opacity-100">
                        <Link to={`/system/program/${program.id}/report`} title="Laporan">
                          <Button variant="ghost" className="h-7 w-7 p-0 rounded-full text-slate-500 hover:text-primary hover:bg-primary/10">
                            <BookOpen className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button variant="ghost" title="Edit Program" className="h-7 w-7 p-0 rounded-full text-slate-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEditModal(program)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" title={program.status === 'archived' ? 'Aktifkan' : 'Arsipkan'} className={`h-7 w-7 p-0 rounded-full text-slate-500 ${program.status === 'archived' ? 'hover:text-emerald-700 hover:bg-emerald-50' : 'hover:text-amber-700 hover:bg-amber-50'}`} onClick={() => archiveProgram(program.id, program.status)}>
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-xl leading-tight group-hover:text-primary transition-colors">
                      {program.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2 h-10">
                      {program.description || "Belum ada deskripsi untuk program ini."}
                    </p>
                  </CardHeader>
                  <CardContent className="pb-4 flex-1">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm text-muted-foreground bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                          {program.curriculum_model === "mandiri" ? (
                            <><Clock className="h-4 w-4 text-blue-500" /> <span className="font-medium text-slate-700">Mandiri</span></>
                          ) : (
                            <><GraduationCap className="h-4 w-4 text-primary" /> <span className="font-medium text-slate-700">Angkatan</span></>
                          )}
                        </div>
                        <Badge variant={program.status === "active" ? "default" : "secondary"} className="capitalize text-[10px] h-5 shadow-sm">
                          {program.status}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100/50">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-600" />
                          <span className="font-semibold text-slate-700">Total Peserta</span>
                        </div>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-xs h-5 px-2">
                          {program.enrollments?.length || 0}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                  <div className="p-4 pt-0 mt-auto">
                    <Link to={`/system/program/${program.id}`} className="block">
                      <Button variant="default" className="w-full rounded-xl shadow-md group-hover:shadow-lg transition-all bg-primary hover:bg-primary/90 text-primary-foreground h-11">
                        Kelola Program <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border/50 shadow-sm overflow-hidden bg-white rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/80 border-b border-border/50 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Program</th>
                      <th className="px-6 py-4 font-semibold">Tipe</th>
                      <th className="px-6 py-4 font-semibold">Peserta</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 bg-white">
                    {currentPrograms.map((program) => (
                      <tr key={program.id} className="hover:bg-primary/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-base group-hover:text-primary transition-colors">{program.name}</span>
                            <span className="font-mono text-xs text-slate-500 mt-1">{program.code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full inline-flex border border-slate-100">
                            {program.curriculum_model === "mandiri" ? (
                              <><Clock className="h-3.5 w-3.5 text-blue-500" /> <span className="text-xs font-medium">Mandiri</span></>
                            ) : (
                              <><GraduationCap className="h-3.5 w-3.5 text-primary" /> <span className="text-xs font-medium">Angkatan</span></>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700 bg-emerald-50/50 px-2.5 py-1 rounded-full border border-emerald-100/80 w-fit text-xs">
                            <Users className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{program.enrollments?.length || 0}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={program.status === "active" ? "default" : "secondary"} className="capitalize">
                            {program.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Link to={`/system/program/${program.id}`}>
                              <Button variant="default" size="sm" className="h-8 text-xs px-4 rounded-full shadow-sm bg-primary/90 hover:bg-primary">Kelola</Button>
                            </Link>
                            <div className="w-px h-5 bg-border mx-1"></div>
                            <Link to={`/system/program/${program.id}/report`} title="Laporan">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-primary hover:bg-primary/10"><BookOpen className="h-4 w-4" /></Button>
                            </Link>
                            <Button variant="ghost" title="Edit" className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEditModal(program)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" title="Arsip" className={`h-8 w-8 p-0 rounded-full text-slate-400 ${program.status === 'archived' ? 'hover:text-emerald-600 hover:bg-emerald-50' : 'hover:text-amber-600 hover:bg-amber-50'}`} onClick={() => archiveProgram(program.id, program.status)}>
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between pt-2 pb-8 gap-4">
              <p className="text-sm text-slate-500">
                Menampilkan <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> hingga <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredPrograms.length)}</span> dari <span className="font-medium">{filteredPrograms.length}</span> program
              </p>
              <div className="flex flex-wrap justify-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="hidden sm:inline-flex"
                >
                  Sebelumnya
                </Button>
                
                {/* Simple pagination numbers - could be optimized for many pages, but good enough for now */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((page, i, arr) => (
                    <div key={page} className="flex items-center">
                      {i > 0 && arr[i - 1] !== page - 1 && <span className="px-2 text-slate-400">...</span>}
                      <Button
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className={currentPage === page ? "pointer-events-none" : ""}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    </div>
                ))}

                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="hidden sm:inline-flex"
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-2xl">{editingProgramId ? "Edit Program" : "Buat Program Baru"}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Konfigurasi dasar untuk program pembelajaran.</p>
              </div>
              <Button variant="ghost" className="h-10 w-10 p-0 rounded-full" onClick={() => setIsModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form
                className="space-y-6"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setIsSubmitting(true);
                  setErrorMessage(null);
                  setMessage(null);

                  const payload = {
                    unit_id: form.unit_id || (units.length > 0 ? units[0].id : ""),
                    code: form.code.trim(),
                    name: form.name.trim(),
                    description: form.description.trim() || null,
                    program_type: form.program_type.trim() || "general",
                    curriculum_model: form.curriculum_model.trim() || "mandiri",
                    delivery_mode: form.delivery_mode.trim() || "online",
                    status: form.status,
                    feature_flags: mergeWithDefaultFeatureFlags(form.feature_flags),
                    teacher_user_id: form.teacher_user_id || null,
                  };

                  const request = editingProgramId 
                    ? supabase.from("programs").update(payload).eq("id", editingProgramId)
                    : supabase.from("programs").insert(payload);

                  const { error } = await request;

                  if (error) {
                    setErrorMessage(error.message);
                  } else {
                    setForm(initialProgramForm);
                    setEditingProgramId(null);
                    setMessage(`Program berhasil ${editingProgramId ? "diperbarui" : "dibuat"}.`);
                    setIsModalOpen(false);
                    await loadData();
                  }

                  setIsSubmitting(false);
                }}
              >
                {/* Hidden Unit Field */}
                <input type="hidden" value={form.unit_id || (units.length > 0 ? units[0].id : "")} />
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Nama Program <span className="text-red-500">*</span></label>
                    <Input
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Contoh: Tahsin Lanjutan"
                      required
                      value={form.name}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Kode Program <span className="text-red-500">*</span></label>
                    <Input
                      onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                      placeholder="Contoh: THL-02"
                      required
                      value={form.code}
                      className="h-10 uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Deskripsi Singkat</label>
                  <textarea
                    className="field-control min-h-[80px]"
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Jelaskan secara singkat apa yang dipelajari di program ini..."
                    value={form.description}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Settings className="h-4 w-4 text-slate-500" /> Sistem Pembelajaran
                    </label>
                    <select
                      className="field-control bg-white h-10 shadow-sm"
                      onChange={(event) => setForm((current) => ({ ...current, curriculum_model: event.target.value }))}
                      value={form.curriculum_model}
                    >
                      <option value="mandiri">Mandiri (Evergreen)</option>
                      <option value="angkatan">Terjadwal (Angkatan)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Status Awal</label>
                    <select
                      className="field-control bg-white h-10 shadow-sm"
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProgramStatus }))}
                      value={form.status}
                    >
                      <option value="draft">Draft (Disembunyikan)</option>
                      <option value="active">Active (Terlihat)</option>
                    </select>
                  </div>
                </div>

                <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100 mt-4">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-blue-600" /> Pengampu Program
                    </label>
                    <p className="text-xs text-blue-700/80 leading-relaxed max-w-full">
                      Pilih staf pengajar yang bertanggung jawab secara penuh pada program ini. Anda bisa mengosongkannya jika pengajar ditugaskan secara terpisah di setiap Kelas.
                    </p>
                    <select
                      className="field-control bg-white h-11 border-blue-200 focus:border-blue-400 focus:ring-blue-400/20 text-slate-700 font-medium w-full shadow-sm"
                      onChange={(event) => setForm((current) => ({ ...current, teacher_user_id: event.target.value }))}
                      value={form.teacher_user_id}
                    >
                      <option value="">-- Tanpa Pengampu Utama (Opsional) --</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 p-4 bg-amber-50/50 rounded-xl border border-amber-100 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                      Sistem Pembayaran / SPP
                    </label>
                    <select
                      className="field-control bg-white h-10 border-amber-200 focus:border-amber-400 focus:ring-amber-400/20"
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        feature_flags: {
                          ...current.feature_flags,
                          payment_type: event.target.value as "free" | "spp"
                        }
                      }))}
                      value={form.feature_flags.payment_type || "free"}
                    >
                      <option value="free">Gratis (Tanpa SPP)</option>
                      <option value="spp">Berbayar (Sumbangan Pembinaan Pendidikan)</option>
                    </select>
                  </div>
                  {form.feature_flags.payment_type === "spp" && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-amber-900">Nominal SPP (Rp)</label>
                      <Input
                        type="number"
                        min="0"
                        className="h-10 border-amber-200 focus:border-amber-400 focus:ring-amber-400/20"
                        placeholder="Contoh: 150000"
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          feature_flags: {
                            ...current.feature_flags,
                            payment_amount: Number(event.target.value)
                          }
                        }))}
                        value={form.feature_flags.payment_amount || ""}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-6 border-t mt-6">
                  <label className="text-sm font-semibold flex items-center justify-between pb-2">
                    <span>Fitur Tambahan (MVP)</span>
                    <span className="text-xs text-muted-foreground font-normal">Pilih fitur yang ingin diaktifkan</span>
                  </label>
                  <div className="grid gap-3 md:grid-cols-2 max-h-[200px] overflow-y-auto pr-2 rounded-xl p-2 bg-muted/20 border border-muted-foreground/10">
                    {allowedMvpFeatureFlags.map((flag) => {
                      const isForbidden = flag === "use_ai_assist" || flag === "use_audio_submission" || flag === "use_video_submission";
                      return (
                        <label key={flag} className={`flex items-start gap-3 p-3 rounded-lg border ${isForbidden ? 'opacity-50 bg-muted' : 'hover:bg-muted/50 cursor-pointer transition-colors'}`}>
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={form.feature_flags[flag]}
                            disabled={isForbidden}
                            onChange={(event) => setFlag(flag, event.target.checked)}
                          />
                          <div>
                            <p className="text-sm font-medium">{mvpFeatureFlagLabels[flag]}</p>
                            {isForbidden && <p className="text-[10px] text-muted-foreground mt-0.5">Dinonaktifkan di versi ini</p>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-background py-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Batal
                  </Button>
                  <Button disabled={isSubmitting} type="submit" className="px-8 shadow-md">
                    {isSubmitting ? "Menyimpan..." : editingProgramId ? "Simpan Perubahan" : "Buat Program"}
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
