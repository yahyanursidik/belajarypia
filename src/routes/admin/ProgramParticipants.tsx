import Papa from "papaparse";
import { ProgramDialog } from "../../components/programs/ProgramDialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { supabase } from "../../lib/supabase";

type Feedback = { type: "success" | "error" | "info"; message: string } | null;
type EnrollStep = 1 | 2 | 3;

type AvailableParticipantRow = {
  id: string;
  display_name: string;
  global_participant_number: string;
  city: string | null;
  profiles?: {
    email: string | null;
    phone?: string | null;
  } | null;
  isEnrolled?: boolean;
};

type ProgramParticipantRow = {
  id: string;
  enrollment_number: string;
  enrollment_status: string;
  classes?:{name:string}|null;
  halaqahs?:{name:string}|null;
  batches?:{name:string}|null;
  created_at: string | null;
  participants: {
    id: string;
    display_name: string;
    global_participant_number: string;
    city: string | null;
    gender: string | null;
    education_level: string | null;
    status: string;
    profiles?: {
      email: string | null;
      phone: string | null;
    } | null;
  };
};

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "Aktif Belajar", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  pending: { label: "Menunggu", className: "border-amber-200 bg-amber-50 text-amber-700" },
  hold: { label: "Ditahan", className: "border-orange-200 bg-orange-50 text-orange-700" },
  completed: { label: "Selesai", className: "border-blue-200 bg-blue-50 text-blue-700" },
  cancelled: { label: "Dibatalkan", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

function getInitial(name: string) {
  return (name.trim().charAt(0) || "P").toUpperCase();
}

function getStatusInfo(status: string) {
  return statusLabels[status] || { label: status || "-", className: "border-slate-200 bg-slate-100 text-slate-700" };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function ProgramParticipants({ programId,onPlace,reloadToken=0 }: { programId: string;onPlace?:(enrollmentId:string)=>void;reloadToken?:number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const requestedParticipant = new URLSearchParams(location.search).get("addParticipant") ?? "";
  const basePath = location.pathname.startsWith("/system") ? "/system" : "/admin";

  const [rows, setRows] = useState<ProgramParticipantRow[]>([]);
  const [loadError,setLoadError]=useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [availableParticipants, setAvailableParticipants] = useState<AvailableParticipantRow[]>([]);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(new Set());
  const [isFetchingAvailable, setIsFetchingAvailable] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollStep, setEnrollStep] = useState<EnrollStep>(1);
  const [enrollStats, setEnrollStats] = useState({ success: 0, unchanged: 0, fail: 0, processed: 0, total: 0 });

  const notify = useCallback((message: string, type: NonNullable<Feedback>["type"] = "success") => {
    setFeedback({ message, type });
  }, []);

  const fetchParticipants = useCallback(
    async (silent = false) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setLoadError(false);
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          id, enrollment_number, enrollment_status, created_at, classes(name),halaqahs(name),batches(name),
          participants!inner (
            id, display_name, global_participant_number, city, gender, education_level, status,
            profiles ( email, phone )
          )
        `)
        .eq("program_id", programId)
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(true);
        notify(`Gagal memuat peserta program: ${error.message}`, "error");
      } else {
        setRows((data ?? []) as unknown as ProgramParticipantRow[]);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [notify, programId],
  );

  useEffect(() => {
    void fetchParticipants(reloadToken>0);
  }, [fetchParticipants,reloadToken]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), feedback.type === "error" ? 7000 : 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.enrollment_status === "active").length;
    const pending = rows.filter((row) => row.enrollment_status === "pending").length;
    const completed = rows.filter((row) => row.enrollment_status === "completed").length;
    const missingPhone = rows.filter((row) => !row.participants.profiles?.phone).length;
    const missingCity = rows.filter((row) => !row.participants.city).length;

    return {
      total: rows.length,
      active,
      pending,
      completed,
      missingPhone,
      missingCity,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const participant = row.participants;
      const matchesStatus = statusFilter === "all" || row.enrollment_status === statusFilter;
      const matchesSearch =
        !query ||
        participant.display_name.toLowerCase().includes(query) ||
        row.enrollment_number.toLowerCase().includes(query) ||
        participant.global_participant_number.toLowerCase().includes(query) ||
        (participant.profiles?.email || "").toLowerCase().includes(query) ||
        (participant.profiles?.phone || "").toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [rows, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = filteredRows.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredRows.length);
  const paginatedRows = filteredRows.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const availableFiltered = useMemo(() => {
    const query = addSearchQuery.trim().toLowerCase();

    return availableParticipants.filter((participant) => {
      if (!query) return true;
      return (
        participant.display_name.toLowerCase().includes(query) ||
        participant.global_participant_number.toLowerCase().includes(query) ||
        (participant.profiles?.email || "").toLowerCase().includes(query) ||
        (participant.profiles?.phone || "").toLowerCase().includes(query)
      );
    });
  }, [addSearchQuery, availableParticipants]);

  const selectableAvailable = availableFiltered.filter((participant) => !participant.isEnrolled);
  const allSelectableChecked = selectableAvailable.length > 0 && selectedParticipantIds.size === selectableAvailable.length;

  const fetchAvailableParticipants = async () => {
    setIsFetchingAvailable(true);
    const enrolledIds = new Set(rows.map((row) => row.participants.id));

    const { data, error } = await supabase
      .from("participants")
      .select(`
        id, display_name, global_participant_number, city,
        profiles ( email, phone )
      `)
      .eq("status", "active");

    if (error) {
      notify(`Gagal memuat direktori peserta: ${error.message}`, "error");
      setAvailableParticipants([]);
    } else {
      const mapped = ((data ?? []) as unknown as AvailableParticipantRow[])
        .map((participant) => ({ ...participant, isEnrolled: enrolledIds.has(participant.id) }))
        .sort((a, b) => {
          if (a.isEnrolled && !b.isEnrolled) return 1;
          if (!a.isEnrolled && b.isEnrolled) return -1;
          return a.display_name.localeCompare(b.display_name);
        });
      setAvailableParticipants(mapped);
    }

    setIsFetchingAvailable(false);
  };

  const openAddModal = () => {
    setIsAddModalOpen(true);
    setEnrollStep(1);
    setEnrollStats({ success: 0, unchanged: 0, fail: 0, processed: 0, total: 0 });
    setAddSearchQuery("");
    setSelectedParticipantIds(new Set());
    void fetchAvailableParticipants();
  };

  const toggleSelection = (id: string) => {
    setSelectedParticipantIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      setSelectedParticipantIds(new Set());
    } else {
      setSelectedParticipantIds(new Set(selectableAvailable.map((participant) => participant.id)));
    }
  };

  const handleEnrollSelected = async () => {
    if (selectedParticipantIds.size === 0) {
      notify("Pilih minimal satu peserta terlebih dahulu.", "error");
      return;
    }

    setIsEnrolling(true);
    setEnrollStep(2);
    setEnrollStats({ success: 0, unchanged: 0, fail: 0, processed: 0, total: selectedParticipantIds.size });

    const idsToEnroll = Array.from(selectedParticipantIds);
    let successCount = 0;
    let unchangedCount = 0;
    let failCount = 0;
    let processed = 0;

    for (const participantId of idsToEnroll) {
      try {
        const { data, error } = await supabase.rpc("direct_enroll_participant", {
          target_participant_id: participantId,
          target_program_id: programId,
        });
        if (error || !data?.enrollment_id) failCount += 1;
        else if (data.enrollment_action === "unchanged") unchangedCount += 1;
        else successCount += 1;
      } catch {
        failCount += 1;
      }
      processed += 1;
      setEnrollStats((current) => ({ ...current, processed, success: successCount, unchanged: unchangedCount, fail: failCount }));
    }

    setEnrollStep(3);
    setIsEnrolling(false);
    await fetchParticipants(true);
  };

  const exportToCSV = () => {
    const csvRows = [
      ["NIS", "No. Enrollment", "Nama", "Email", "No. HP", "Kota", "Pendidikan", "Gender", "Status Enrollment", "Tanggal Daftar"],
    ];

    for (const row of filteredRows) {
      const participant = row.participants;
      csvRows.push([
        participant.global_participant_number,
        row.enrollment_number,
        participant.display_name,
        participant.profiles?.email || "",
        participant.profiles?.phone || "",
        participant.city || "",
        participant.education_level || "",
        participant.gender || "",
        row.enrollment_status,
        formatDate(row.created_at),
      ]);
    }

    const csvString = Papa.unparse(csvRows, { escapeFormulae: true });
    const blob = new Blob([`\uFEFF${csvString}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `peserta-program-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {requestedParticipant && <div className="participant-result"><span>Lanjutkan pendaftaran peserta: {requestedParticipant}</span><Button variant="outline" onClick={()=>{openAddModal();setAddSearchQuery(requestedParticipant);}}>Pilih peserta</Button></div>}
      {feedback && (
        <Alert
          className={
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : feedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-blue-200 bg-blue-50 text-blue-900"
          }
        >
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription className="font-medium">{feedback.message}</AlertDescription>
        </Alert>
      )}

      <div className="program-metrics">{[
        {label:'Semua peserta',value:stats.total,tone:'blue',status:'all',icon:Users},
        {label:'Aktif belajar',value:stats.active,tone:'emerald',status:'active',icon:UserCheck},
        {label:'Menunggu',value:stats.pending,tone:'amber',status:'pending',icon:ClipboardList},
        {label:'Selesai',value:stats.completed,tone:'violet',status:'completed',icon:GraduationCap},
      ].map(({label,value,tone,status,icon:Icon})=><button key={label} className={`admin-stat admin-tone-${tone}`} onClick={()=>setStatusFilter(status)}><span className="admin-stat__icon"><Icon size={18}/></span><span><span className="admin-stat__label">{label}</span><strong>{isLoading||loadError?'—':value}</strong></span></button>)}</div>

      <Card className="w-full max-w-none overflow-hidden">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Direktori Peserta Program</CardTitle>

          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              onClick={() => void fetchParticipants(true)}
              disabled={isRefreshing || isLoading}
              className="h-10 whitespace-nowrap !text-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Muat Ulang
            </Button>
            <Button variant="outline" onClick={exportToCSV} disabled={filteredRows.length === 0} className="h-10 whitespace-nowrap !text-foreground">
              <Download className="h-4 w-4" />
              Ekspor hasil
            </Button>
            <Button onClick={openAddModal} className="h-10 whitespace-nowrap bg-primary !text-white hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Tambah Peserta
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 overflow-hidden">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari nama, NIS, enrollment, email, atau telepon"
                className="h-11 pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {["all", "active", "pending", "completed", "hold", "cancelled"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`h-9 rounded-full border px-3 text-sm font-medium transition ${
                    statusFilter === status ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {status === "all" ? "Semua" : getStatusInfo(status).label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-muted-foreground">
              Menampilkan <span className="font-semibold text-foreground">{filteredRows.length === 0 ? 0 : pageStartIndex + 1}-{pageEndIndex}</span> dari{" "}
              <span className="font-semibold text-foreground">{filteredRows.length}</span> hasil
              {filteredRows.length !== rows.length ? `, total ${rows.length} peserta` : ""}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="program-participant-page-size">Baris</label>
              <select
                id="program-participant-page-size"
                className="field-control h-9 w-24 text-sm"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-xl border">
            <div className="w-full overflow-x-auto">
              <table className="min-w-[1140px] w-full table-fixed text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-[310px] px-5 py-4 font-semibold">Peserta</th>
                    <th className="w-[360px] px-5 py-4 font-semibold">Kontak</th>
                    <th className="w-[190px] px-5 py-4 font-semibold">{onPlace?'Penempatan':'Pendaftaran'}</th>
                    <th className="w-[150px] px-5 py-4 text-center font-semibold">Status</th>
                    <th className="sticky right-0 z-10 w-[130px] border-l bg-muted/40 px-4 py-4 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                        <p className="font-medium">Memuat peserta program...</p>
                      </td>
                    </tr>
                  ) : loadError ? <tr><td colSpan={5} className="p-6 text-center"><p className="program-error" role="alert">Peserta belum dapat dimuat.</p><Button variant="outline" onClick={()=>void fetchParticipants()}>Coba lagi</Button></td></tr> : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center text-muted-foreground">
                        <User className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                        <p className="font-semibold text-foreground">Tidak ada peserta ditemukan</p>
                        <p className="mt-1 text-sm">Ubah filter pencarian atau tambahkan peserta dari direktori.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      const participant = row.participants;
                      const statusInfo = getStatusInfo(row.enrollment_status);

                      return (
                        <tr key={row.id} className="group hover:bg-muted/30">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                                {getInitial(participant.display_name)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground">{participant.display_name}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span className="rounded border bg-muted px-1.5 py-0.5 font-mono">{participant.global_participant_number}</span>
                                  <span className="rounded border bg-background px-1.5 py-0.5 font-mono">{row.enrollment_number}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5" />
                                {participant.profiles?.email || "-"}
                              </p>
                              <p className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5" />
                                {participant.profiles?.phone || "Nomor belum diisi"}
                              </p>
                              <p className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5" />
                                {participant.city || "Kota belum diisi"}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4"><div className="space-y-1 text-sm">{onPlace?<><p className="font-medium">{row.classes?.name??'Belum ditempatkan'}</p>{row.halaqahs?.name&&<p>{row.halaqahs.name}</p>}<p className="text-xs text-muted-foreground">{row.batches?.name??'Tanpa angkatan'}</p></>:<p className="text-xs text-muted-foreground">Terdaftar {formatDate(row.created_at)}</p>}</div></td>
                          <td className="px-5 py-4 text-center align-middle">
                            <Badge variant="outline" className={`min-w-[96px] justify-center whitespace-nowrap ${statusInfo.className}`}>
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="sticky right-0 z-10 border-l bg-background px-4 py-4 align-middle group-hover:bg-muted/30">
                            <div className="flex items-center justify-center gap-2">
                              {onPlace&&['active','pending','hold'].includes(row.enrollment_status)&&<Button variant="outline" size="sm" onClick={()=>onPlace(row.id)}>Atur kelas</Button>}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 !text-foreground"
                                onClick={() => navigate(`${basePath}/peserta/${participant.id}`)}
                                aria-label={`Lihat detail ${participant.display_name}`}
                                title="Detail"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 border-primary/30 p-0 !text-primary hover:bg-primary/5"
                                onClick={() => navigate(`${basePath}/peserta/${participant.id}/transkrip/${row.id}`)}
                                aria-label={`Buka transkrip ${participant.display_name}`}
                                title="Transkrip"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t bg-muted/30 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 !text-foreground"
                  disabled={safeCurrentPage <= 1 || filteredRows.length === 0}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </Button>
                <span className="min-w-[110px] text-center text-xs font-medium text-muted-foreground">
                  Halaman {filteredRows.length === 0 ? 0 : safeCurrentPage} / {filteredRows.length === 0 ? 0 : totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 !text-foreground"
                  disabled={safeCurrentPage >= totalPages || filteredRows.length === 0}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                >
                  Berikutnya
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAddModalOpen && (
        <ProgramDialog title="Tambah peserta ke program" busy={isEnrolling} error={feedback?.type==='error'?feedback.message:null} wide onClose={()=>setIsAddModalOpen(false)}>

            {enrollStep === 1 && (
              <>
                <div className="border-b bg-muted/30 p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={addSearchQuery}
                      onChange={(event) => setAddSearchQuery(event.target.value)}
                      placeholder="Cari nama, NIS, email, atau telepon"
                      className="h-11 pl-9"
                    />
                  </div>
                </div>

                <div className="min-h-[380px] flex-1 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b bg-background text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="w-14 px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary"
                            checked={allSelectableChecked}
                            onChange={toggleSelectAll}
                            disabled={isFetchingAvailable || selectableAvailable.length === 0}
                          />
                        </th>
                        <th className="px-5 py-3 font-semibold">Peserta</th>
                        <th className="px-5 py-3 font-semibold">Kontak</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {isFetchingAvailable ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-16 text-center text-muted-foreground">
                            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                            <p className="font-medium">Memuat direktori peserta...</p>
                          </td>
                        </tr>
                      ) : availableFiltered.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-16 text-center text-muted-foreground">
                            <Database className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                            <p className="font-semibold text-foreground">Tidak ada peserta yang cocok</p>
                            <p className="mt-1 text-sm">Semua peserta mungkin sudah terdaftar atau pencarian terlalu spesifik.</p>
                          </td>
                        </tr>
                      ) : (
                        availableFiltered.map((participant) => {
                          const isSelected = selectedParticipantIds.has(participant.id);
                          const isEnrolled = Boolean(participant.isEnrolled);

                          return (
                            <tr
                              key={participant.id}
                              className={`transition ${isEnrolled ? "bg-muted/40 opacity-70" : "cursor-pointer hover:bg-primary/5"} ${isSelected ? "bg-primary/5" : ""}`}
                              onClick={() => {
                                if (!isEnrolled) toggleSelection(participant.id);
                              }}
                            >
                              <td className="px-4 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                  checked={isSelected || isEnrolled}
                                  disabled={isEnrolled}
                                  onChange={() => toggleSelection(participant.id)}
                                />
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                                    {getInitial(participant.display_name)}
                                  </div>
                                  <div>
                                    <p className="font-semibold">{participant.display_name}</p>
                                    <p className="mt-1 font-mono text-xs text-muted-foreground">{participant.global_participant_number}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-sm text-muted-foreground">
                                <p>{participant.profiles?.email || "-"}</p>
                                <p className="mt-1 text-xs">{participant.profiles?.phone || participant.city || "Kontak belum lengkap"}</p>
                              </td>
                              <td className="px-5 py-3">
                                {isEnrolled ? (
                                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                    Sudah Terdaftar
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Bisa Ditambahkan</Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">
                    <span className="text-lg font-bold text-primary">{selectedParticipantIds.size}</span> peserta dipilih
                  </span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={() => setIsAddModalOpen(false)} disabled={isEnrolling} className="h-10 whitespace-nowrap !text-foreground">
                      Batal
                    </Button>
                    <Button
                      onClick={() => void handleEnrollSelected()}
                      disabled={selectedParticipantIds.size === 0 || isEnrolling}
                      className="h-10 min-w-[220px] whitespace-nowrap bg-primary !text-white hover:bg-primary/90 disabled:!text-white"
                    >
                      <UserPlus className="h-4 w-4" />
                      Tambahkan {selectedParticipantIds.size} Terpilih
                    </Button>
                  </div>
                </div>
              </>
            )}

            {enrollStep === 2 && (
              <div className="flex flex-col items-center justify-center space-y-6 bg-background p-10">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <div className="text-center">
                  <h3 className="text-2xl font-bold">Mendaftarkan Peserta</h3>
                  <p className="mt-2 text-muted-foreground">
                    Memproses {enrollStats.processed} dari {enrollStats.total} peserta.
                  </p>
                </div>
                <div className="h-3 w-full max-w-md overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(enrollStats.processed / Math.max(1, enrollStats.total)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {enrollStep === 3 && (
              <div className="flex flex-col items-center justify-center space-y-6 bg-background p-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold">Pendaftaran Selesai</h3>
                  <p className="mt-2 text-muted-foreground">Hasil proses pendaftaran massal ke program.</p>
                </div>
                <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-700">{enrollStats.success}</p>
                    <p className="text-xs font-semibold uppercase text-emerald-700">Ditambahkan</p>
                  </div>
                  {enrollStats.unchanged > 0 && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-center"><p className="text-3xl font-bold text-sky-700">{enrollStats.unchanged}</p><p className="text-xs font-semibold text-sky-700">Sudah terdaftar</p></div>}
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                    <p className="text-3xl font-bold text-red-700">{enrollStats.fail}</p>
                    <p className="text-xs font-semibold uppercase text-red-700">Gagal</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    notify(`${enrollStats.success} ditambahkan · ${enrollStats.unchanged} sudah terdaftar · ${enrollStats.fail} gagal.`, enrollStats.fail ? "info" : "success");
                  }}
                  className="h-11 w-full max-w-sm whitespace-nowrap bg-primary !text-white hover:bg-primary/90"
                >
                  Tutup & Lihat Data Terbaru
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </ProgramDialog>
      )}
    </div>
  );
}
