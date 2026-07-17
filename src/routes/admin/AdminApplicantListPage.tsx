import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  RefreshCw,
  UserCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  X,
  LayoutDashboard,
  ClipboardList,
  FileCog,
  CalendarClock,
  UsersRound,
  Clock3,
  UserCheck,
  FileText,
  ArrowRight,
  LinkIcon,
  BookOpen,
  Filter,
  SlidersHorizontal,
} from "lucide-react";
import {
  applicantStatusLabels,
  formatRegistrationDateTime,
  getRegistrationWindowState,
  type Applicant,
  type ApplicantAnswer,
  type ApplicantProgramChoice,
  type ApplicantStatus,
  type RegistrationForm,
  type RegistrationWindowState,
} from "../../lib/admission";
import type { Batch, ClassGroup, Halaqah } from "../../lib/enrollment";
import { supabase } from "../../lib/supabase";
import { ProgramAdmissionBuilder } from "./ProgramAdmissionBuilder";

type ApplicantListRow = ApplicantProgramChoice & {
  applicants: Applicant;
};

type ProgramOption = {
  id: string;
  name: string;
  code: string;
  status: string;
};

type RegistrationFormSummary = RegistrationForm & {
  programs?: Pick<ProgramOption, "id" | "name" | "code" | "status"> | null;
};

type AdmissionStats = {
  total: number;
  draft: number;
  submitted: number;
  under_review: number;
  revision_requested: number;
  accepted: number;
  rejected: number;
  openForms: number;
  groupClaims: number;
};

type AdmissionTab = "overview" | "review" | "settings";

const admissionTabs: Array<{
  key: AdmissionTab;
  label: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "overview", label: "Ringkasan", desc: "Funnel, jadwal, dan kesiapan", icon: LayoutDashboard },
  { key: "review", label: "Review Pendaftar", desc: "Seleksi, catatan, placement", icon: ClipboardList },
  { key: "settings", label: "Form & Undangan", desc: "Form, jadwal, link grup", icon: FileCog },
];

const registrationStateLabel: Record<RegistrationWindowState, string> = {
  draft: "Draft",
  upcoming: "Terjadwal",
  open: "Dibuka",
  closed: "Ditutup",
  archived: "Arsip",
};

const registrationStateClass: Record<RegistrationWindowState, string> = {
  draft: "bg-slate-50 text-slate-600 border-slate-200",
  upcoming: "bg-sky-50 text-sky-700 border-sky-200",
  open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-rose-50 text-rose-700 border-rose-200",
  archived: "bg-slate-50 text-slate-600 border-slate-200",
};

function isMissingRegistrationWindowColumn(message: string | null | undefined) {
  return Boolean(
    message?.includes("registration_forms.registration_open_at") ||
      message?.includes("registration_forms.registration_close_at") ||
      message?.includes("registration_open_at") ||
      message?.includes("registration_close_at"),
  );
}

export function AdminApplicantListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<ApplicantListRow[]>([]);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ApplicantAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [halaqahs, setHalaqahs] = useState<Halaqah[]>([]);
  const [assignment, setAssignment] = useState({
    batch_id: "",
    class_id: "",
    halaqah_id: "",
  });
  
  const activeTabParam = searchParams.get("tab");
  const activeTab = admissionTabs.some((tab) => tab.key === activeTabParam) ? activeTabParam as AdmissionTab : "overview";
  const changeTab = (tab: AdmissionTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (tab === "overview") next.delete("tab");
      else next.set("tab", tab);
      return next;
    }, { replace: true });
  };
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [selectedProgramIdForSettings, setSelectedProgramIdForSettings] = useState<string | null>(null);
  const [programSearch, setProgramSearch] = useState("");
  const [programStatusFilter, setProgramStatusFilter] = useState("all");
  const [programFormFilter, setProgramFormFilter] = useState("all");
  const [overviewRows, setOverviewRows] = useState<ApplicantListRow[]>([]);
  const [registrationForms, setRegistrationForms] = useState<RegistrationFormSummary[]>([]);
  const [stats, setStats] = useState<AdmissionStats>({
    total: 0,
    draft: 0,
    submitted: 0,
    under_review: 0,
    revision_requested: 0,
    accepted: 0,
    rejected: 0,
    openForms: 0,
    groupClaims: 0,
  });
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const pageSize = 10;
  
  const [filterProgram, setFilterProgram] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");

  useEffect(() => {
    if (message || errorMessage) {
      const timer = setTimeout(() => {
        setMessage(null);
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, errorMessage]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.applicant_id === selectedApplicantId) ?? null,
    [rows, selectedApplicantId],
  );

  const registrationFormsByProgramId = useMemo(() => {
    const formMap = new Map<string, RegistrationFormSummary>();

    for (const form of registrationForms) {
      if (form.program_id && !formMap.has(form.program_id)) {
        formMap.set(form.program_id, form);
      }
    }

    return formMap;
  }, [registrationForms]);

  const selectedProgramForSettings = useMemo(
    () => programs.find((program) => program.id === selectedProgramIdForSettings) ?? null,
    [programs, selectedProgramIdForSettings],
  );

  const programStatusOptions = useMemo(
    () => Array.from(new Set(programs.map((program) => program.status).filter(Boolean))).sort(),
    [programs],
  );

  const filteredProgramsForSettings = useMemo(() => {
    const normalizedSearch = programSearch.trim().toLowerCase();

    return programs.filter((program) => {
      const form = registrationFormsByProgramId.get(program.id);
      const windowState = form ? getRegistrationWindowState(form) : "draft";
      const matchesSearch =
        !normalizedSearch ||
        program.name.toLowerCase().includes(normalizedSearch) ||
        program.code.toLowerCase().includes(normalizedSearch);
      const matchesStatus = programStatusFilter === "all" || program.status === programStatusFilter;
      const matchesForm =
        programFormFilter === "all" ||
        (programFormFilter === "configured" && Boolean(form)) ||
        (programFormFilter === "unconfigured" && !form) ||
        windowState === programFormFilter;

      return matchesSearch && matchesStatus && matchesForm;
    });
  }, [programFormFilter, programSearch, programStatusFilter, programs, registrationFormsByProgramId]);

  const visibleProgramsForSettings = filteredProgramsForSettings.slice(0, 80);

  const programPickerStats = useMemo(() => {
    return programs.reduce(
      (current, program) => {
        const form = registrationFormsByProgramId.get(program.id);
        const windowState = form ? getRegistrationWindowState(form) : "draft";

        current.total += 1;
        if (program.status === "active") current.active += 1;
        if (form) current.configured += 1;
        if (windowState === "open") current.open += 1;
        return current;
      },
      { total: 0, active: 0, configured: 0, open: 0 },
    );
  }, [programs, registrationFormsByProgramId]);

  useEffect(() => {
    if (selectedRow) {
      setAdminNotes(selectedRow.notes || "");
    }
  }, [selectedRow]);

  const loadApplicants = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    let query = supabase
      .from("applicant_program_choices")
      .select(
        "id, applicant_id, program_id, preferred_schedule, notes, applicants!inner(id, full_name, email, phone, city, gender, birth_date, source_channel, status, submitted_at, created_at), programs(id, code, name, status)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (filterProgram !== "all") {
      query = query.eq("program_id", filterProgram);
    }
    
    if (filterStatus !== "all") {
      query = query.eq("applicants.status", filterStatus);
    }

    if (searchQuery) {
      query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`, { foreignTable: "applicants" });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      setErrorMessage(error.message);
    } else {
      setRows((data ?? []) as unknown as ApplicantListRow[]);
      setTotalRows(count ?? 0);
    }

    setIsLoading(false);
  };

  const loadAnswers = async (applicantId: string) => {
    setIsDetailLoading(true);
    setAnswers([]);

    const { data, error } = await supabase
      .from("applicant_answers")
      .select("id, applicant_id, form_field_key, value_text, value_json")
      .eq("applicant_id", applicantId)
      .order("created_at");

    if (error) {
      setErrorMessage(error.message);
    } else {
      setAnswers((data ?? []) as ApplicantAnswer[]);
    }

    setIsDetailLoading(false);
  };

  const loadPlacementOptions = async (programId: string) => {
    const [{ data: batchRows }, { data: classRows }] = await Promise.all([
      supabase
        .from("batches")
        .select("id, program_id, code, name, status")
        .eq("program_id", programId)
        .order("name"),
      supabase
        .from("classes")
        .select("id, program_id, batch_id, code, name, status")
        .eq("program_id", programId)
        .order("name"),
    ]);

    setBatches((batchRows ?? []) as Batch[]);
    setClasses((classRows ?? []) as ClassGroup[]);
    setHalaqahs([]);
    setAssignment({ batch_id: "", class_id: "", halaqah_id: "" });
  };

  const loadHalaqahs = async (classId: string) => {
    if (!classId) {
      setHalaqahs([]);
      return;
    }

    const { data } = await supabase
      .from("halaqahs")
      .select("id, class_id, code, name, status")
      .eq("class_id", classId)
      .order("name");

    setHalaqahs((data ?? []) as Halaqah[]);
  };

  const loadPrograms = async () => {
    const { data } = await supabase.from("programs").select("id, name, code, status").order("created_at", { ascending: false });
    if (data) setPrograms(data as ProgramOption[]);
  };

  const loadOverview = async () => {
    setIsOverviewLoading(true);

    const [choiceResult, formResult, claimResult] = await Promise.all([
      supabase
        .from("applicant_program_choices")
        .select(
          "id, applicant_id, program_id, preferred_schedule, notes, applicants!inner(id, full_name, email, phone, city, gender, birth_date, source_channel, status, submitted_at, created_at), programs(id, code, name, status)"
        )
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("registration_forms")
        .select("id, program_id, title, description, status, registration_open_at, registration_close_at, group_settings, programs(id, code, name, status)")
        .order("created_at", { ascending: false }),
      supabase
        .from("registration_group_link_claims")
        .select("id"),
    ]);

    let formRows: unknown[] | null = formResult.data;
    let formError = formResult.error;

    if (isMissingRegistrationWindowColumn(formError?.message)) {
      const fallback = await supabase
        .from("registration_forms")
        .select("id, program_id, title, description, status, group_settings, programs(id, code, name, status)")
        .order("created_at", { ascending: false });

      formRows = fallback.data;
      formError = fallback.error;
    }

    const nextRows = (choiceResult.data ?? []) as unknown as ApplicantListRow[];
    const nextForms = (formRows ?? []) as unknown as RegistrationFormSummary[];
    const nextStats: AdmissionStats = {
      total: nextRows.length,
      draft: 0,
      submitted: 0,
      under_review: 0,
      revision_requested: 0,
      accepted: 0,
      rejected: 0,
      openForms: nextForms.filter((form) => getRegistrationWindowState(form) === "open").length,
      groupClaims: claimResult.data?.length ?? 0,
    };

    if (choiceResult.error || formError) {
      setErrorMessage(choiceResult.error?.message || formError?.message || "Gagal memuat ringkasan pendaftaran.");
    }

    for (const row of nextRows) {
      nextStats[row.applicants.status] += 1;
    }

    setOverviewRows(nextRows);
    setRegistrationForms(nextForms);
    setStats(nextStats);
    setIsOverviewLoading(false);
  };

  useEffect(() => {
    void loadApplicants();
  }, [page, filterProgram, filterStatus, searchQuery]);

  useEffect(() => {
    void loadPrograms();
    void loadOverview();
  }, []);

  const refreshAll = async () => {
    await Promise.all([loadApplicants(), loadOverview(), loadPrograms()]);
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(1);
  };

  const exportToCSV = async () => {
    let query = supabase
      .from("applicant_program_choices")
      .select(
        "id, applicant_id, program_id, preferred_schedule, notes, applicants!inner(id, full_name, email, phone, city, gender, birth_date, source_channel, status, submitted_at, created_at), programs(id, code, name, status)"
      )
      .order("created_at", { ascending: false });

    if (filterProgram !== "all") query = query.eq("program_id", filterProgram);
    if (filterStatus !== "all") query = query.eq("applicants.status", filterStatus);
    if (searchQuery) query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`, { foreignTable: "applicants" });

    const { data, error } = await query;
    if (error) {
      alert("Gagal export CSV: " + error.message);
      return;
    }

    const csvRows = [
      ["Nama", "Email", "No. HP", "Kota", "Program", "Status", "Tanggal Daftar"]
    ];
    for (const row of (data as unknown as ApplicantListRow[])) {
      csvRows.push([
        `"${row.applicants.full_name}"`,
        `"${row.applicants.email}"`,
        `"${row.applicants.phone || ""}"`,
        `"${row.applicants.city || ""}"`,
        `"${row.programs?.name || ""}"`,
        `"${applicantStatusLabels[row.applicants.status] || ""}"`,
        `"${new Date(row.applicants.submitted_at || row.applicants.created_at).toLocaleString('id-ID')}"`
      ]);
    }
    const csvString = csvRows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Data_Pendaftar_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateStatus = async (status: ApplicantStatus) => {
    if (!selectedRow) {
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);
    setMessage(null);

    const { error: applicantError } = await supabase
      .from("applicants")
      .update({ status })
      .eq("id", selectedRow.applicant_id);
      
    const { error: notesError } = await supabase
      .from("applicant_program_choices")
      .update({ notes: adminNotes })
      .eq("id", selectedRow.id);

    if (applicantError || notesError) {
      setErrorMessage(applicantError?.message || notesError?.message || "Terjadi kesalahan.");
    } else {
      setMessage(`Status pendaftaran berubah menjadi ${applicantStatusLabels[status]}.`);
      await refreshAll();
    }

    setIsUpdating(false);
  };

  const approveAndEnroll = async () => {
    if (!selectedRow) {
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);
    setMessage(null);

    const { error } = await supabase.rpc("approve_applicant", {
      target_applicant_id: selectedRow.applicant_id,
      target_program_id: selectedRow.program_id,
      target_batch_id: assignment.batch_id || null,
      target_class_id: assignment.class_id || null,
      target_halaqah_id: assignment.halaqah_id || null,
    });

    if (!error) {
       await supabase.from("applicant_program_choices").update({ notes: adminNotes }).eq("id", selectedRow.id);
    }

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage("Applicant diterima, participant dan enrollment berhasil dibuat.");
      await refreshAll();
    }

    setIsUpdating(false);
  };

  return (
    <div className="page-stack">
      <section className="page-hero">
        <Badge>Admisi</Badge>
        <h2>Pendaftaran</h2>
        <p>
          Kelola funnel pendaftaran dari publikasi form, seleksi calon peserta,
          placement awal, sampai peserta resmi masuk kelas.
        </p>
      </section>

      <div className="fixed top-24 right-8 z-50 flex flex-col gap-2 max-w-sm w-full">
        {errorMessage && (
          <div className="bg-red-50 text-red-900 border border-red-200 p-4 rounded-lg shadow-lg flex items-start justify-between animate-in slide-in-from-right-8 fade-in">
            <div>
              <h4 className="font-bold text-sm">Gagal</h4>
              <p className="text-sm mt-1">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {message && (
          <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-4 rounded-lg shadow-lg flex items-start justify-between animate-in slide-in-from-right-8 fade-in">
            <div>
              <h4 className="font-bold text-sm">Berhasil</h4>
              <p className="text-sm mt-1">{message}</p>
            </div>
            <button onClick={() => setMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded-xl border bg-white p-2 shadow-sm md:grid-cols-3">
        {admissionTabs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;

          return (
            <button
              key={item.key}
              className={`flex items-start gap-3 rounded-lg p-4 text-left transition-colors ${
                isActive ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => changeTab(item.key)}
              type="button"
            >
              <Icon className={`mt-0.5 h-5 w-5 ${isActive ? "text-white" : "text-primary"}`} />
              <span>
                <span className="block text-sm font-bold">{item.label}</span>
                <span className={`mt-0.5 block text-xs ${isActive ? "text-white/75" : "text-slate-500"}`}>{item.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Pendaftar", value: stats.total, icon: UsersRound, tone: "text-slate-700 bg-slate-100" },
              { label: "Perlu Review", value: stats.submitted + stats.under_review + stats.revision_requested, icon: Clock3, tone: "text-amber-700 bg-amber-50" },
              { label: "Diterima", value: stats.accepted, icon: UserCheck, tone: "text-emerald-700 bg-emerald-50" },
              { label: "Form Dibuka", value: stats.openForms, icon: CalendarClock, tone: "text-sky-700 bg-sky-50" },
            ].map((metric) => {
              const Icon = metric.icon;

              return (
                <Card key={metric.label} className="border-slate-200 shadow-sm">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className={`grid h-12 w-12 place-items-center rounded-lg ${metric.tone}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{metric.label}</p>
                      <p className="text-3xl font-bold">{isOverviewLoading ? "-" : metric.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Workflow Admisi</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Pantau bottleneck utama dari data masuk sampai enrollment.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void refreshAll()}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { title: "Masuk", value: stats.submitted, desc: "Baru submit dan belum diproses", color: "border-sky-200 bg-sky-50 text-sky-800" },
                    { title: "Direview", value: stats.under_review + stats.revision_requested, desc: "Sedang dicek atau menunggu revisi", color: "border-amber-200 bg-amber-50 text-amber-800" },
                    { title: "Selesai", value: stats.accepted + stats.rejected, desc: "Diterima atau ditolak", color: "border-emerald-200 bg-emerald-50 text-emerald-800" },
                  ].map((step) => (
                    <div className={`rounded-lg border p-4 ${step.color}`} key={step.title}>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="mt-2 text-3xl font-bold">{isOverviewLoading ? "-" : step.value}</p>
                      <p className="mt-2 text-xs opacity-80">{step.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Klaim tautan grup</p>
                      <p className="text-xs text-slate-500">Jumlah pendaftar yang sudah membuka tautan grup dari sistem rotasi.</p>
                    </div>
                    <div className="flex items-center gap-2 text-primary">
                      <LinkIcon className="h-4 w-4" />
                      <span className="text-2xl font-bold">{isOverviewLoading ? "-" : stats.groupClaims}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Jadwal Form Aktif</CardTitle>
                <p className="text-sm text-muted-foreground">Kesiapan form pendaftaran per program.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {registrationForms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada form pendaftaran.</p>
                ) : (
                  registrationForms.slice(0, 6).map((form) => {
                    const state = getRegistrationWindowState(form);

                    return (
                      <button
                        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                        key={form.id}
                        onClick={() => {
                          if (form.program_id) {
                            setSelectedProgramIdForSettings(form.program_id);
                            changeTab("settings");
                          }
                        }}
                        type="button"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{form.programs?.name ?? form.title}</p>
                            <p className="text-xs text-slate-500">{form.programs?.code ?? "Global"} / {form.title}</p>
                          </div>
                          <Badge variant="outline" className={registrationStateClass[state]}>{registrationStateLabel[state]}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {formatRegistrationDateTime(form.registration_open_at)} - {formatRegistrationDateTime(form.registration_close_at)}
                        </p>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pendaftar Terbaru</CardTitle>
                <p className="text-sm text-muted-foreground">Klik untuk masuk ke mode review.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => changeTab("review")}>
                Buka Review
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {overviewRows.slice(0, 6).map((row) => (
                  <button
                    className="rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                    key={row.id}
                    onClick={() => {
                      changeTab("review");
                      setSelectedApplicantId(row.applicant_id);
                      void loadAnswers(row.applicant_id);
                      void loadPlacementOptions(row.program_id);
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{row.applicants.full_name}</p>
                        <p className="truncate text-xs text-slate-500">{row.applicants.email}</p>
                      </div>
                      <Badge variant={row.applicants.status === "accepted" ? "default" : "secondary"}>
                        {applicantStatusLabels[row.applicants.status]}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <FileText className="h-4 w-4" />
                      <span>{row.programs?.name ?? "Program"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "review" && (
        <div className="space-y-6">
          <Card className="border-indigo-100 shadow-sm bg-slate-50/50">
            <CardContent className="p-4 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Cari Pendaftar</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Nama atau email..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="field-control w-full pl-9 text-sm"
                    />
                  </div>
                  <Button size="sm" onClick={handleSearch}>Cari</Button>
                </div>
              </div>
              <div className="w-full sm:w-[200px]">
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Filter Program</label>
                <select 
                  className="field-control text-sm w-full"
                  value={filterProgram}
                  onChange={(e) => { setFilterProgram(e.target.value); setPage(1); }}
                >
                  <option value="all">Semua Program</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-[200px]">
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Filter Status</label>
                <select 
                  className="field-control text-sm w-full"
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                >
                  <option value="all">Semua Status</option>
                  {Object.entries(applicantStatusLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={loadApplicants} className="text-slate-600 border-slate-300" disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
                <Button size="sm" variant="outline" onClick={exportToCSV} className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200">
                  <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="split-panel">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Daftar Pendaftar <span className="text-sm font-normal text-muted-foreground ml-2">({totalRows} total)</span></CardTitle>
              </CardHeader>
              <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat pendaftar...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada pendaftar untuk program dalam scope Anda.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Program</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr 
                        key={row.id}
                        className={`transition-colors cursor-pointer ${selectedApplicantId === row.applicant_id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-slate-50 border-l-2 border-transparent'}`}
                        onClick={() => {
                          setSelectedApplicantId(row.applicant_id);
                          void loadAnswers(row.applicant_id);
                          void loadPlacementOptions(row.program_id);
                        }}
                      >
                        <td>
                          <span className="font-medium">{row.applicants.full_name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.applicants.email}
                          </span>
                        </td>
                        <td>{row.programs?.name ?? "-"}</td>
                        <td>
                          <Badge variant={row.applicants.status === "accepted" ? "default" : "secondary"}>
                            {applicantStatusLabels[row.applicants.status]}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant={selectedApplicantId === row.applicant_id ? "default" : "outline"}
                            className="pointer-events-none"
                          >
                            Detail
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {totalRows > pageSize && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Menampilkan {Math.min((page - 1) * pageSize + 1, totalRows)} - {Math.min(page * pageSize, totalRows)} dari {totalRows}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Sebelumnya</Button>
                  <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= totalRows}>Selanjutnya</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="detail-drawer">
          <CardHeader>
            <CardTitle>Detail Pendaftar</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRow ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                <UserCircle className="h-16 w-16 text-slate-300 mb-4" />
                <p className="text-sm">Pilih pendaftar dari tabel di sebelah kiri untuk melihat detail dan melakukan review.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <dl className="detail-grid">
                  <div>
                    <dt>Nama</dt>
                    <dd>{selectedRow.applicants.full_name}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{selectedRow.applicants.email}</dd>
                  </div>
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>{selectedRow.applicants.phone}</dd>
                  </div>
                  <div>
                    <dt>Kota</dt>
                    <dd>{selectedRow.applicants.city ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Program</dt>
                    <dd>{selectedRow.programs?.name ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{applicantStatusLabels[selectedRow.applicants.status]}</dd>
                  </div>
                </dl>

                <div>
                  <h3 className="mb-3 text-sm font-semibold">Jawaban Form</h3>
                  {isDetailLoading ? (
                    <p className="text-sm text-muted-foreground">Memuat jawaban...</p>
                  ) : answers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada jawaban tambahan.</p>
                  ) : (
                    <div className="space-y-3">
                      {answers.map((answer) => {
                        const isFile = answer.value_text?.startsWith("applicants/");
                        const publicUrl = isFile ? supabase.storage.from("admission_documents").getPublicUrl(answer.value_text!).data.publicUrl : "";
                        
                        return (
                          <div className="rounded-lg border p-3" key={answer.id}>
                            <p className="text-xs font-semibold uppercase text-muted-foreground">
                              {answer.form_field_key}
                            </p>
                            {isFile ? (
                              <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 text-sm text-indigo-600 hover:underline flex items-center gap-1">
                                <Download className="h-4 w-4" />
                                Unduh File Lampiran
                              </a>
                            ) : (
                              <p className="mt-1 text-sm">{answer.value_text || "-"}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Alert>
                  <AlertTitle>Approval membuat participant</AlertTitle>
                  <AlertDescription>
                    Approve & Enrollment akan membuat participant, nomor induk
                    unik, enrollment aktif, checklist onboarding, dan log welcome.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3 rounded-lg border p-3">
                  <h3 className="text-sm font-semibold">Placement Awal</h3>
                  <label className="grid gap-2 text-sm font-medium">
                    Batch
                    <select
                      className="field-control"
                      onChange={(event) =>
                        setAssignment((current) => ({
                          ...current,
                          batch_id: event.target.value,
                        }))
                      }
                      value={assignment.batch_id}
                    >
                      <option value="">Tanpa batch</option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.code} - {batch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Kelas
                    <select
                      className="field-control"
                      onChange={(event) => {
                        setAssignment((current) => ({
                          ...current,
                          class_id: event.target.value,
                          halaqah_id: "",
                        }));
                        void loadHalaqahs(event.target.value);
                      }}
                      value={assignment.class_id}
                    >
                      <option value="">Tanpa kelas</option>
                      {classes.map((classGroup) => (
                        <option key={classGroup.id} value={classGroup.id}>
                          {classGroup.code} - {classGroup.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Halaqah
                    <select
                      className="field-control"
                      onChange={(event) =>
                        setAssignment((current) => ({
                          ...current,
                          halaqah_id: event.target.value,
                        }))
                      }
                      value={assignment.halaqah_id}
                    >
                      <option value="">Tanpa halaqah</option>
                      {halaqahs.map((halaqah) => (
                        <option key={halaqah.id} value={halaqah.id}>
                          {halaqah.code} - {halaqah.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="space-y-3 rounded-lg border p-3 mt-4">
                  <h3 className="text-sm font-semibold">Catatan Admin</h3>
                  <textarea
                    className="w-full min-h-[80px] p-3 rounded-md border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    placeholder="Tuliskan catatan mengapa pendaftar ditolak atau perlu revisi..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Catatan akan disimpan saat Anda menekan salah satu tombol aksi di bawah.</p>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t mt-4">
                  <Button
                    disabled={isUpdating || selectedRow.applicants.status === "accepted"}
                    onClick={() => void approveAndEnroll()}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Approve & Enrollment
                  </Button>
                  
                  <Button
                    disabled={isUpdating}
                    onClick={() => void updateStatus("under_review")}
                    size="sm"
                    variant="outline"
                  >
                    Mulai Review
                  </Button>

                  <Button
                    disabled={isUpdating}
                    onClick={() => void updateStatus("revision_requested")}
                    size="sm"
                    variant="secondary"
                    className="bg-amber-100 text-amber-800 hover:bg-amber-200"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" /> Minta Revisi
                  </Button>

                  <Button
                    disabled={isUpdating}
                    onClick={() => void updateStatus("rejected")}
                    size="sm"
                    variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Program", value: programPickerStats.total, icon: BookOpen, tone: "bg-slate-100 text-slate-700" },
              { label: "Program Aktif", value: programPickerStats.active, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
              { label: "Form Tersedia", value: programPickerStats.configured, icon: FileText, tone: "bg-indigo-50 text-indigo-700" },
              { label: "Sedang Dibuka", value: programPickerStats.open, icon: CalendarClock, tone: "bg-sky-50 text-sky-700" },
            ].map((metric) => {
              const Icon = metric.icon;

              return (
                <Card className="border-slate-200 shadow-sm" key={metric.label}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className={`grid h-12 w-12 place-items-center rounded-lg ${metric.tone}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{metric.label}</p>
                      <p className="text-3xl font-bold">{metric.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
            <Card className="border-slate-200 shadow-sm xl:sticky xl:top-6 xl:self-start">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Pilih Program</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cari dan filter program sebelum mengatur form, jadwal, dan undangan grup.
                    </p>
                  </div>
                  <Button size="icon" variant="outline" onClick={() => void refreshAll()} title="Refresh program">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    className="field-control w-full pl-9 text-sm"
                    onChange={(event) => setProgramSearch(event.target.value)}
                    placeholder="Cari kode atau nama program..."
                    value={programSearch}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Filter className="h-3.5 w-3.5" />
                      Status
                    </span>
                    <select
                      className="field-control text-sm"
                      onChange={(event) => setProgramStatusFilter(event.target.value)}
                      value={programStatusFilter}
                    >
                      <option value="all">Semua</option>
                      {programStatusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Form
                    </span>
                    <select
                      className="field-control text-sm"
                      onChange={(event) => setProgramFormFilter(event.target.value)}
                      value={programFormFilter}
                    >
                      <option value="all">Semua</option>
                      <option value="configured">Sudah Ada Form</option>
                      <option value="unconfigured">Belum Ada Form</option>
                      <option value="open">Dibuka</option>
                      <option value="upcoming">Terjadwal</option>
                      <option value="closed">Ditutup</option>
                      <option value="draft">Draft</option>
                    </select>
                  </label>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span>{filteredProgramsForSettings.length} program cocok</span>
                  {filteredProgramsForSettings.length > visibleProgramsForSettings.length && (
                    <span>Tampilkan 80 teratas</span>
                  )}
                </div>

                <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {visibleProgramsForSettings.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      Tidak ada program yang cocok dengan filter.
                    </div>
                  ) : (
                    visibleProgramsForSettings.map((program) => {
                      const form = registrationFormsByProgramId.get(program.id);
                      const windowState = form ? getRegistrationWindowState(form) : "draft";
                      const isSelected = selectedProgramIdForSettings === program.id;

                      return (
                        <button
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-slate-200 bg-white hover:border-primary/30 hover:bg-primary/5"
                          }`}
                          key={program.id}
                          onClick={() => setSelectedProgramIdForSettings(program.id)}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">{program.name}</p>
                              <p className="mt-0.5 text-xs font-semibold uppercase text-slate-400">{program.code}</p>
                            </div>
                            <Badge variant={program.status === "active" ? "default" : "secondary"}>{program.status}</Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="outline" className={registrationStateClass[windowState]}>
                              {form ? registrationStateLabel[windowState] : "Belum Ada Form"}
                            </Badge>
                            {form?.registration_open_at || form?.registration_close_at ? (
                              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                                {formatRegistrationDateTime(form.registration_open_at)} - {formatRegistrationDateTime(form.registration_close_at)}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-4">
              {selectedProgramForSettings ? (
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Program dipilih</p>
                      <h3 className="truncate text-xl font-bold text-slate-900">{selectedProgramForSettings.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedProgramForSettings.code} / status {selectedProgramForSettings.status}
                      </p>
                    </div>
                    {(() => {
                      const selectedForm = registrationFormsByProgramId.get(selectedProgramForSettings.id);
                      const selectedState = selectedForm ? getRegistrationWindowState(selectedForm) : "draft";

                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={registrationStateClass[selectedState]}>
                            {selectedForm ? registrationStateLabel[selectedState] : "Form akan dibuat"}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => setSelectedProgramIdForSettings(null)}>
                            Ganti Program
                          </Button>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              ) : null}

              {selectedProgramIdForSettings ? (
                <ProgramAdmissionBuilder programId={selectedProgramIdForSettings} />
              ) : (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-muted-foreground">
                  <BookOpen className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <p className="font-semibold text-slate-700">Pilih satu program dari panel kiri.</p>
                  <p className="mt-1 text-sm">Setelah dipilih, pengaturan form, jadwal buka/tutup, dan undangan grup akan tampil di sini.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
