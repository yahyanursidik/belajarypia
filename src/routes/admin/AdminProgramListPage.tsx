import { PageHeader } from "../../components/admin/PageHeader";
import { Dialog } from "../../components/ui/dialog";
import { WizardSteps } from "../../components/ui/wizard-steps";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  Archive,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Edit2,
  Filter,
  GraduationCap,
  LayoutGrid,
  Layers,
  Library,
  List,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trophy,
  Users,
  UserCheck,
} from "lucide-react";
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
  created_at?: string | null;
};

type ProgramSection = "detail-program" | "silabus" | "kurikulum" | "angkatan-kelas" | "bank-soal" | "peserta" | "kelulusan";

const statusOptions: Array<{ value: "all" | ProgramStatus; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Arsip" },
];

const statusMeta: Record<ProgramStatus, { label: string; className: string; bar: string }> = {
  active: { label: "Aktif", className: "border-emerald-200 bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  draft: { label: "Draft", className: "border-amber-200 bg-amber-50 text-amber-700", bar: "bg-amber-400" },
  archived: { label: "Diarsipkan", className: "border-slate-200 bg-slate-100 text-slate-700", bar: "bg-slate-300" },
};

const programSections: Array<{ section: ProgramSection; label: string; icon: typeof Settings }> = [
  { section: "detail-program", label: "Detail", icon: Settings },
  { section: "silabus", label: "Silabus", icon: ClipboardList },
  { section: "kurikulum", label: "Kurikulum", icon: Layers },
  { section: "angkatan-kelas", label: "Angkatan", icon: CalendarDays },
  { section: "peserta", label: "Peserta", icon: Users },
  { section: "bank-soal", label: "Bank Soal", icon: Library },
  { section: "kelulusan", label: "Kelulusan", icon: Trophy },
];

const getCurriculumLabel = (model: string) => (model === "angkatan" ? "Terjadwal (Angkatan)" : "Mandiri (Evergreen)");

const getVisibleProgramSections = (program: ProgramWithEnrollments) =>
  programSections.filter((item) => item.section !== "angkatan-kelas" || program.curriculum_model === "angkatan");

export function AdminProgramListPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const basePath = location.pathname.startsWith("/system") ? "/system" : "/admin";
  const getProgramSectionPath = (programId: string, section: ProgramSection) => `${basePath}/program/${programId}/${section}`;
  const [wizardStep, setWizardStep] = useState(0);
  const [units, setUnits] = useState<Unit[]>([]);
  const [programs, setPrograms] = useState<ProgramWithEnrollments[]>([]);
  const [staff, setStaff] = useState<Array<{id: string, full_name: string | null, email: string}>>([]);
  const [form, setForm] = useState<ProgramFormState>(initialProgramForm);

  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const requestedStatus = searchParams.get("status");
  const filterStatus = statusOptions.some((option) => option.value === requestedStatus) ? requestedStatus! : "all";
  const setFilterStatus = (status: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    if (status === "all") next.delete("status"); else next.set("status", status);
    return next;
  });
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [sortBy, setSortBy] = useState("name-asc");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    const [{ data: unitRows, error: unitError }, { data: programRows, error: programError }, { data: staffRows, error: staffError }] =
      await Promise.all([
        supabase.from("units").select("id, organization_id, code, name, description, status").order("name"),
        supabase.from("programs").select("id, unit_id, code, name, description, program_type, curriculum_model, delivery_mode, status, feature_flags, teacher_user_id, created_at, units(code, name), enrollments(id)").order("name"),
        supabase.from("profiles").select("id, full_name, email")
      ]);

    if (unitError || programError || staffError) {
      setErrorMessage(unitError?.message ?? programError?.message ?? staffError?.message ?? "Gagal memuat data.");
    } else {
      setUnits((unitRows ?? []) as Unit[]);
      setPrograms((programRows ?? []) as unknown as ProgramWithEnrollments[]);
      setStaff((staffRows ?? []) as Array<{id: string, full_name: string | null, email: string}>);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const stats = useMemo(() => {
    const totalParticipants = programs.reduce((sum, program) => sum + (program.enrollments?.length ?? 0), 0);
    return {
      total: programs.length,
      active: programs.filter((program) => program.status === "active").length,
      draft: programs.filter((program) => program.status === "draft").length,
      archived: programs.filter((program) => program.status === "archived").length,
      scheduled: programs.filter((program) => program.curriculum_model === "angkatan").length,
      totalParticipants,
    };
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return programs.filter((program) => {
      const nameMatch = (program.name || "").toLowerCase().includes(query);
      const codeMatch = (program.code || "").toLowerCase().includes(query);
      const descriptionMatch = (program.description || "").toLowerCase().includes(query);
      const matchesSearch = query.length === 0 || nameMatch || codeMatch || descriptionMatch;
      const matchesType = filterType === "all" || program.curriculum_model === filterType;
      const matchesStatus = filterStatus === "all" || program.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === "name-asc") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "name-desc") return (b.name || "").localeCompare(a.name || "");
      if (sortBy === "participants") return (b.enrollments?.length ?? 0) - (a.enrollments?.length ?? 0);
      if (sortBy === "newest") {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === "oldest") {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      }
      return 0;
    });
  }, [filterStatus, filterType, programs, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredPrograms.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = filteredPrograms.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const pageEndIndex = Math.min(safeCurrentPage * pageSize, filteredPrograms.length);
  const currentPrograms = filteredPrograms.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterStatus, sortBy, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openCreateModal = () => {
    setForm(initialProgramForm);
    setEditingProgramId(null);
    setWizardStep(0);
    setErrorMessage(null);
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
    setWizardStep(0);
    setErrorMessage(null);
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

  const exportProgramsToCSV = () => {
    const rows = [["Kode", "Nama Program", "Model", "Status", "Peserta", "Pengampu", "Dibuat"]];
    filteredPrograms.forEach((program) => {
      const teacher = staff.find((item) => item.id === program.teacher_user_id);
      rows.push([
        program.code,
        program.name,
        getCurriculumLabel(program.curriculum_model),
        statusMeta[program.status]?.label ?? program.status,
        String(program.enrollments?.length ?? 0),
        teacher?.full_name ?? teacher?.email ?? "-",
        program.created_at ? new Date(program.created_at).toLocaleDateString("id-ID") : "-",
      ]);
    });

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `program-lms-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack pb-12">
      <PageHeader title="Program" actions={<>
        <Button type="button" variant="outline" disabled={isRefreshing} onClick={() => void loadData(true)} aria-label="Muat ulang program"><RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} /></Button>
        <Button type="button" variant="outline" onClick={exportProgramsToCSV} disabled={filteredPrograms.length === 0}><Download className="h-4 w-4" />Ekspor</Button>
        <Button onClick={openCreateModal}><Plus className="h-4 w-4" />Buat program</Button>
      </>} />

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

      <div className="grid gap-4 md:grid-cols-3">
        <ProgramMetricCard title="Aktif" value={stats.active} description="terlihat peserta" icon={CheckCircle2} />
        <ProgramMetricCard title="Draft" value={stats.draft} description="perlu dilengkapi" icon={ClipboardList} />
        <ProgramMetricCard title="Arsip" value={stats.archived} description="tidak aktif" icon={Archive} />
      </div>



      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle>Direktori Program</CardTitle>

            </div>
            <div className="flex border border-muted/40 rounded-lg overflow-hidden bg-white shrink-0 p-0.5 shadow-sm">
              <button
                type="button"
                className={`p-2 rounded-md transition-colors ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => setViewMode("grid")}
                title="Tampilan Grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`p-2 rounded-md transition-colors ${viewMode === "table" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => setViewMode("table")}
                title="Tampilan Tabel"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-center">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, kode, atau deskripsi program..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={filterStatus === option.value ? "default" : "outline"}
                  className="h-10 rounded-full px-4"
                  onClick={() => setFilterStatus(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              className="field-control h-10 w-full bg-white sm:w-52"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Semua Model</option>
              <option value="mandiri">Mandiri</option>
              <option value="angkatan">Terjadwal / Angkatan</option>
            </select>
            <select
              className="field-control h-10 w-full bg-white sm:w-44"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name-asc">Nama A-Z</option>
              <option value="name-desc">Nama Z-A</option>
              <option value="participants">Peserta terbanyak</option>
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
            <select
              className="field-control h-10 w-full bg-white sm:w-36"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={9}>9 / halaman</option>
              <option value={12}>12 / halaman</option>
              <option value={24}>24 / halaman</option>
              <option value={48}>48 / halaman</option>
            </select>
            <p className="ml-auto text-sm text-muted-foreground">
              {filteredPrograms.length} dari {programs.length} program
            </p>
          </div>
        </CardContent>
      </Card>

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
                  <div className={`h-1.5 w-full ${statusMeta[program.status]?.bar ?? statusMeta.draft.bar}`} />
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-semibold tracking-wider text-[10px]">
                        {program.code}
                      </Badge>
                      <div className="flex items-center gap-1 bg-muted/20 rounded-full p-1 border border-muted/40 transition-opacity opacity-80 group-hover:opacity-100">
                        <Link to={`${basePath}/program/${program.id}/report`} title="Laporan">
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
                        <Badge variant="outline" className={`h-5 text-[10px] shadow-sm ${statusMeta[program.status]?.className ?? statusMeta.draft.className}`}>
                          {statusMeta[program.status]?.label ?? program.status}
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
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {getVisibleProgramSections(program).map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link key={item.section} to={getProgramSectionPath(program.id, item.section)}>
                              <Button variant="outline" className="h-9 w-full justify-start gap-2 px-3 text-xs">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                                <span className="truncate">{item.label}</span>
                              </Button>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                  <div className="p-4 pt-0 mt-auto">
                    <Link to={getProgramSectionPath(program.id, "detail-program")} className="block">
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
                <table className="w-full min-w-[1080px] text-sm text-left">
                  <thead className="bg-slate-50/80 border-b border-border/50 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Program</th>
                      <th className="px-6 py-4 font-semibold">Model</th>
                      <th className="px-6 py-4 font-semibold">Peserta</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Submenu Cepat</th>
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
                          <Badge variant="outline" className={statusMeta[program.status]?.className ?? statusMeta.draft.className}>
                            {statusMeta[program.status]?.label ?? program.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {getVisibleProgramSections(program).map((item) => {
                              const Icon = item.icon;
                              return (
                                <Link key={item.section} to={getProgramSectionPath(program.id, item.section)} title={item.label}>
                                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                    <Icon className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Link to={getProgramSectionPath(program.id, "detail-program")}>
                              <Button variant="default" size="sm" className="h-8 min-w-[84px] text-xs px-4 rounded-full shadow-sm bg-primary/90 hover:bg-primary">Kelola</Button>
                            </Link>
                            <div className="w-px h-5 bg-border mx-1"></div>
                            <Link to={`${basePath}/program/${program.id}/report`} title="Laporan">
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
          {filteredPrograms.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between pt-2 pb-8 gap-4">
              <p className="text-sm text-slate-500">
                Menampilkan <span className="font-medium">{pageStartIndex}</span> hingga <span className="font-medium">{pageEndIndex}</span> dari <span className="font-medium">{filteredPrograms.length}</span> program
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="h-9 min-w-9 px-3"
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
                  .map((page, i, arr) => (
                    <div key={page} className="flex items-center">
                      {i > 0 && arr[i - 1] !== page - 1 && <span className="px-2 text-slate-400">...</span>}
                      <Button
                        variant={safeCurrentPage === page ? "default" : "outline"}
                        size="sm"
                        className={`h-9 min-w-9 px-3 ${safeCurrentPage === page ? "pointer-events-none" : ""}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="h-9 min-w-9 px-3"
                  title="Halaman berikutnya"
                >
                  <span className="hidden sm:inline">Selanjutnya</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Creation Modal */}
      {isModalOpen && (
        <Dialog title={editingProgramId ? "Edit program" : "Buat program"} busy={isSubmitting} onClose={() => setIsModalOpen(false)}>
          <WizardSteps steps={["Identitas", "Pembelajaran", "Pengaturan", "Tinjau"]} current={wizardStep} />
          {errorMessage && <Alert className="mb-4 border-red-200 text-red-700"><AlertTitle>Belum dapat disimpan</AlertTitle><AlertDescription>{errorMessage}</AlertDescription></Alert>}
              <form
                className="space-y-6"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setErrorMessage(null);
                  if (wizardStep < 3) { setWizardStep((step) => step + 1); return; }
                  if (!form.name.trim() || !form.code.trim()) {
                    setErrorMessage("Nama dan kode program wajib diisi."); setWizardStep(0); return;
                  }
                  if (!(form.unit_id || units[0]?.id)) {
                    setErrorMessage("Unit program belum tersedia. Hubungi pengelola unit."); return;
                  }
                  if (form.feature_flags.payment_type === "spp" && (!Number.isFinite(form.feature_flags.payment_amount) || Number(form.feature_flags.payment_amount) <= 0)) {
                    setErrorMessage("Isi nominal SPP lebih dari 0."); setWizardStep(2); return;
                  }
                  setIsSubmitting(true);
                  setMessage(null);

                  const payload = {
                    unit_id: form.unit_id || (units.length > 0 ? units[0].id : ""),
                    code: form.code.trim(),
                    name: form.name.trim(),
                    description: form.description.trim() || null,
                    program_type: form.program_type.trim() || "general",
                    curriculum_model: form.curriculum_model.trim() || "mandiri",
                    delivery_mode: form.delivery_mode.trim() || "online",
                    status: editingProgramId ? form.status : "draft",
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
                <fieldset hidden={wizardStep !== 0} disabled={isSubmitting || wizardStep !== 0} className="space-y-5">
                  {units.length > 1 && <label className="block space-y-2"><span className="text-sm font-semibold">Unit</span><select className="field-control" value={form.unit_id || units[0]?.id || ""} onChange={(event) => setForm((current) => ({ ...current, unit_id: event.target.value }))}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="program-name" className="text-sm font-semibold">Nama Program <span className="text-red-500">*</span></label>
                    <Input id="program-name"
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Contoh: Tahsin Lanjutan"
                      required
                      onInvalid={(event) => event.currentTarget.setCustomValidity("Isi nama program.")}
                      onInput={(event) => event.currentTarget.setCustomValidity("")}
                      value={form.name}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="program-code" className="text-sm font-semibold">Kode Program <span className="text-red-500">*</span></label>
                    <Input id="program-code"
                      onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                      placeholder="Contoh: THL-02"
                      required
                      onInvalid={(event) => event.currentTarget.setCustomValidity("Isi kode program.")}
                      onInput={(event) => event.currentTarget.setCustomValidity("")}
                      value={form.code}
                      className="h-10 uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="program-description" className="text-sm font-semibold">Deskripsi Singkat</label>
                  <textarea id="program-description"
                    className="field-control min-h-[80px]"
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Jelaskan secara singkat apa yang dipelajari di program ini..."
                    value={form.description}
                  />
                </div>

                </fieldset>
                <fieldset hidden={wizardStep !== 1} disabled={isSubmitting || wizardStep !== 1} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-2">
                    <label htmlFor="program-model" className="text-sm font-semibold flex items-center gap-2">
                      <Settings className="h-4 w-4 text-slate-500" /> Sistem Pembelajaran
                    </label>
                    <select id="program-model"
                      className="field-control bg-white h-10 shadow-sm"
                      onChange={(event) => setForm((current) => ({ ...current, curriculum_model: event.target.value }))}
                      value={form.curriculum_model}
                    >
                      <option value="mandiri">Mandiri (Evergreen)</option>
                      <option value="angkatan">Terjadwal (Angkatan)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="program-status" className="text-sm font-semibold">Status Awal</label>
                    <select id="program-status"
                      className="field-control bg-white h-10 shadow-sm"
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProgramStatus }))}
                      value={form.status}
                    >
                      <option value="draft">Draf (belum ditampilkan)</option>
                      {editingProgramId && <option value="active">Aktif (terlihat peserta)</option>}
                      {form.status === "archived" && <option value="archived">Diarsipkan</option>}
                    </select>
                  </div>
                </div>

                <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100 mt-4">
                  <div className="space-y-3">
                    <label htmlFor="program-teacher" className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-blue-600" /> Pengampu Program
                    </label>
                    <p className="text-xs text-blue-700/80 leading-relaxed max-w-full">
                      Opsional. Bisa ditentukan per kelas nanti.
                    </p>
                    <select id="program-teacher"
                      className="field-control bg-white h-11 border-blue-200 focus:border-blue-400 focus:ring-blue-400/20 text-slate-700 font-medium w-full shadow-sm"
                      onChange={(event) => setForm((current) => ({ ...current, teacher_user_id: event.target.value }))}
                      value={form.teacher_user_id}
                    >
                      <option value="">-- Tanpa Pengampu Utama (Opsional) --</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>)}
                    </select>
                  </div>
                </div>

                </fieldset>
                <fieldset hidden={wizardStep !== 2} disabled={isSubmitting || wizardStep !== 2} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 p-4 bg-amber-50/50 rounded-xl border border-amber-100 mt-4">
                  <div className="space-y-2">
                    <label htmlFor="program-payment" className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                      Sistem Pembayaran / SPP
                    </label>
                    <select id="program-payment"
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
                      <label htmlFor="program-amount" className="text-sm font-semibold text-amber-900">Nominal SPP (Rp)</label>
                      <Input id="program-amount"
                        type="number"
                        required
                        min="1"
                        onInvalid={(event) => event.currentTarget.setCustomValidity("Isi nominal SPP lebih dari 0.")}
                        onInput={(event) => event.currentTarget.setCustomValidity("")}
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
                    <span>Fitur program</span>
                    <span className="text-xs text-muted-foreground font-normal">Pilih fitur yang ingin diaktifkan</span>
                  </label>
                  <div className="grid gap-3 md:grid-cols-2 max-h-[200px] overflow-y-auto pr-2 rounded-xl p-2 bg-muted/20 border border-muted-foreground/10">
                    {allowedMvpFeatureFlags.filter((flag) => flag.startsWith("use_") && !["use_ai_assist", "use_audio_submission", "use_video_submission"].includes(flag)).map((flag) => {
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

                </fieldset>
                {wizardStep === 3 && <section className="program-review" aria-label="Ringkasan program">
                  <h3>Siap disimpan?</h3>
                  <dl>
                    <div><dt>Nama</dt><dd>{form.name}</dd></div>
                    <div><dt>Kode</dt><dd>{form.code}</dd></div>
                    <div><dt>Model belajar</dt><dd>{getCurriculumLabel(form.curriculum_model)}</dd></div>
                    <div><dt>Pengampu</dt><dd>{staff.find((item) => item.id === form.teacher_user_id)?.full_name || "Ditentukan nanti"}</dd></div>
                    <div><dt>Biaya</dt><dd>{form.feature_flags.payment_type === "spp" ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(form.feature_flags.payment_amount)) : "Gratis"}</dd></div>
                    <div><dt>Status</dt><dd>{editingProgramId ? statusMeta[form.status].label : "Draf"}</dd></div>
                  </dl>
                </section>}
                <div className="wizard-footer">
                  <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => wizardStep > 0 ? setWizardStep((step) => step - 1) : setIsModalOpen(false)}>
                    {wizardStep > 0 ? "Kembali" : "Batal"}
                  </Button>
                  <span className="text-xs text-muted-foreground">{wizardStep + 1} dari 4</span>
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Menyimpan…" : wizardStep < 3 ? "Lanjut" : editingProgramId ? "Simpan perubahan" : "Simpan draf"}
                  </Button>
                </div>
              </form>
        </Dialog>
      )}
    </div>
  );
}

function ProgramMetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof BookOpen;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
