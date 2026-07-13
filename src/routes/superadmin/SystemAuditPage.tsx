import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileEdit,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

type AuditDetails = Record<string, unknown>;

type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: AuditDetails | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

type AuditLogRow = Omit<AuditLog, "profiles">;

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type AuditActionCategory = "all" | "create" | "update" | "delete" | "auth" | "other";

const pageSizeOptions = [20, 50, 100];

const actionCategories: Array<{ value: AuditActionCategory; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "create", label: "Tambah" },
  { value: "update", label: "Ubah" },
  { value: "delete", label: "Hapus" },
  { value: "auth", label: "Akses" },
  { value: "other", label: "Lainnya" },
];

const actionCategoryTerms: Record<Exclude<AuditActionCategory, "all" | "other">, string[]> = {
  create: ["create", "insert", "add"],
  update: ["update", "edit", "modify"],
  delete: ["delete", "remove"],
  auth: ["login", "logout", "auth", "role"],
};

function getActionCategory(action: string): Exclude<AuditActionCategory, "all"> {
  const lower = action.toLowerCase();
  if (lower.includes("create") || lower.includes("insert") || lower.includes("add")) return "create";
  if (lower.includes("update") || lower.includes("edit") || lower.includes("modify")) return "update";
  if (lower.includes("delete") || lower.includes("remove")) return "delete";
  if (lower.includes("login") || lower.includes("logout") || lower.includes("auth") || lower.includes("role")) return "auth";
  return "other";
}

function getActionBadge(action: string) {
  const category = getActionCategory(action);
  if (category === "create") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"><Plus className="h-3 w-3" />{action}</Badge>;
  }
  if (category === "update") {
    return <Badge className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50"><FileEdit className="h-3 w-3" />{action}</Badge>;
  }
  if (category === "delete") {
    return <Badge className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50"><Trash2 className="h-3 w-3" />{action}</Badge>;
  }
  if (category === "auth") {
    return <Badge className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50"><UserRound className="h-3 w-3" />{action}</Badge>;
  }
  return <Badge variant="outline">{action}</Badge>;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeDetails(details: AuditDetails | null) {
  if (!details) return "-";
  const keys = Object.keys(details);
  if (keys.length === 0) return "Tidak ada payload detail.";
  return keys.slice(0, 4).join(", ") + (keys.length > 4 ? ` +${keys.length - 4} field` : "");
}

export function SystemAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterCategory, setFilterCategory] = useState<AuditActionCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [entityOptions, setEntityOptions] = useState<string[]>([]);

  const activeFilterCount = [
    filterAction !== "all",
    filterEntity !== "all",
    filterCategory !== "all",
    searchQuery.trim().length > 0,
    dateFrom.length > 0,
    dateTo.length > 0,
  ].filter(Boolean).length;

  const loadFilters = useCallback(async () => {
    const [{ data: actionRows, error: actionError }, { data: entityRows, error: entityError }] = await Promise.all([
      supabase.from("audit_logs").select("action").order("action"),
      supabase.from("audit_logs").select("entity_type").order("entity_type"),
    ]);

    if (actionError || entityError) {
      setErrorMessage(actionError?.message ?? entityError?.message ?? "Gagal memuat opsi filter audit.");
      return;
    }

    setActionOptions([...new Set((actionRows ?? []).map((row) => String(row.action)).filter(Boolean))].sort());
    setEntityOptions([...new Set((entityRows ?? []).map((row) => String(row.entity_type)).filter(Boolean))].sort());
  }, []);

  const loadLogs = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    let query = supabase
      .from("audit_logs")
      .select("id, user_id, action, entity_type, entity_id, details, created_at", { count: "exact" });

    if (filterAction !== "all") query = query.eq("action", filterAction);
    if (filterEntity !== "all") query = query.eq("entity_type", filterEntity);
    if (filterCategory !== "all" && filterCategory !== "other") {
      query = query.or(actionCategoryTerms[filterCategory].map((term) => `action.ilike.%${term}%`).join(","));
    }
    if (filterCategory === "other") {
      Object.values(actionCategoryTerms).flat().forEach((term) => {
        query = query.not("action", "ilike", `%${term}%`);
      });
    }
    if (dateFrom) query = query.gte("created_at", new Date(`${dateFrom}T00:00:00`).toISOString());
    if (dateTo) query = query.lte("created_at", new Date(`${dateTo}T23:59:59`).toISOString());

    const trimmedSearch = searchQuery.trim();
    const safeSearch = trimmedSearch.replace(/[,%()]/g, " ").trim();
    if (safeSearch) {
      query = query.or(`action.ilike.%${safeSearch}%,entity_type.ilike.%${safeSearch}%,entity_id.ilike.%${safeSearch}%`);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      setLogs([]);
      setTotalCount(0);
      setErrorMessage(error.message);
    } else {
      const rows = (data ?? []) as AuditLogRow[];
      const userIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
      let profileMap = new Map<string, ProfileRow>();

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        if (profileError) {
          setErrorMessage(profileError.message);
        } else {
          profileMap = new Map((profileRows ?? []).map((profile) => [profile.id, profile as ProfileRow]));
        }
      }

      setLogs(rows.map((row) => ({
        ...row,
        profiles: row.user_id ? profileMap.get(row.user_id) ?? null : null,
      })));
      setTotalCount(count ?? 0);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, [dateFrom, dateTo, filterAction, filterCategory, filterEntity, page, pageSize, searchQuery]);

  useEffect(() => {
    void loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, filterAction, filterCategory, filterEntity, pageSize, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, totalCount);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageStats = useMemo(() => {
    return {
      create: logs.filter((log) => getActionCategory(log.action) === "create").length,
      update: logs.filter((log) => getActionCategory(log.action) === "update").length,
      delete: logs.filter((log) => getActionCategory(log.action) === "delete").length,
      auth: logs.filter((log) => getActionCategory(log.action) === "auth").length,
    };
  }, [logs]);

  const resetFilters = () => {
    setFilterAction("all");
    setFilterEntity("all");
    setFilterCategory("all");
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const exportToCSV = () => {
    const rows = [["Waktu", "Pengguna", "Email", "Aksi", "Kategori", "Entitas", "ID Entitas", "Detail"]];
    logs.forEach((log) => {
      rows.push([
        formatDateTime(log.created_at),
        log.profiles?.full_name ?? "Sistem / Anonim",
        log.profiles?.email ?? "-",
        log.action,
        getActionCategory(log.action),
        log.entity_type,
        log.entity_id ?? "-",
        log.details ? JSON.stringify(log.details) : "-",
      ]);
    });

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-system-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack pb-12">
      <section className="page-hero">
        <Badge className="relative z-10 bg-white/15 text-white hover:bg-white/20">Keamanan Sistem</Badge>
        <div className="relative z-10 mt-4 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2>Audit Sistem</h2>
            <p>Telusuri aktivitas penting LMS, validasi perubahan data, dan tindak lanjuti kejadian berisiko dari satu halaman.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadLogs(true)}
              disabled={isRefreshing}
              className="h-10 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Muat Ulang
            </Button>
            <Button onClick={exportToCSV} disabled={logs.length === 0} className="h-10 bg-white !text-primary hover:bg-white/90">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </section>

      {errorMessage && (
        <Alert className="border-red-500 bg-red-50 text-red-900">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <AuditMetricCard title="Total Log" value={totalCount} description="sesuai filter aktif" icon={Activity} />
        <AuditMetricCard title="Halaman" value={safePage} description={`dari ${totalPages} halaman`} icon={Clock} />
        <AuditMetricCard title="Filter" value={activeFilterCount} description="kondisi aktif" icon={Filter} />
        <AuditMetricCard title="Tambah" value={pageStats.create} description="di halaman ini" icon={Plus} />
        <AuditMetricCard title="Ubah" value={pageStats.update} description="di halaman ini" icon={FileEdit} />
        <AuditMetricCard title="Hapus" value={pageStats.delete} description="di halaman ini" icon={Trash2} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Audit</CardTitle>
          <CardDescription>Prioritaskan log yang paling berisiko terlebih dulu, lalu persempit berdasarkan entitas atau rentang waktu.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <AuditWorkflowItem
            done={pageStats.delete === 0}
            title="Review aksi hapus"
            description={`${pageStats.delete} aksi hapus terlihat di halaman ini. Cek detail payload dan pengguna pelaku.`}
            action="Filter Hapus"
            onClick={() => setFilterCategory("delete")}
          />
          <AuditWorkflowItem
            done={pageStats.auth === 0}
            title="Pantau akses dan role"
            description={`${pageStats.auth} aktivitas akses/role terlihat di halaman ini. Cocok untuk audit hak akses.`}
            action="Filter Akses"
            onClick={() => setFilterCategory("auth")}
          />
          <AuditWorkflowItem
            done={activeFilterCount > 0}
            title="Persempit investigasi"
            description="Gunakan pencarian, entitas, aksi, dan tanggal agar audit tidak melebar saat log sudah besar."
            action="Reset Filter"
            onClick={resetFilters}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle>Riwayat Aktivitas</CardTitle>
              <CardDescription>Menampilkan {logs.length} baris di halaman ini dari {totalCount} catatan audit.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {actionCategories.map((category) => (
                <Button
                  key={category.value}
                  type="button"
                  variant={filterCategory === category.value ? "default" : "outline"}
                  className="h-9 rounded-full px-4"
                  onClick={() => setFilterCategory(category.value)}
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9"
                placeholder="Cari aksi, entitas, atau ID entitas..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <select className="field-control h-11 w-full bg-white sm:w-48" value={filterAction} onChange={(event) => setFilterAction(event.target.value)}>
                <option value="all">Semua Aksi</option>
                {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
              </select>
              <select className="field-control h-11 w-full bg-white sm:w-48" value={filterEntity} onChange={(event) => setFilterEntity(event.target.value)}>
                <option value="all">Semua Entitas</option>
                {entityOptions.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input className="h-10 w-full bg-white sm:w-44" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <span className="hidden text-sm text-muted-foreground sm:inline">sampai</span>
            <Input className="h-10 w-full bg-white sm:w-44" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <select className="field-control h-10 w-full bg-white sm:w-40" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {pageSizeOptions.map((option) => <option key={option} value={option}>{option} / halaman</option>)}
            </select>
            <Button type="button" variant="outline" className="h-10" onClick={resetFilters} disabled={activeFilterCount === 0}>
              <X className="h-4 w-4" />
              Reset
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="border-b bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Waktu</th>
                    <th className="px-6 py-4 font-semibold">Pengguna</th>
                    <th className="px-6 py-4 font-semibold">Aksi</th>
                    <th className="px-6 py-4 font-semibold">Entitas</th>
                    <th className="px-6 py-4 font-semibold">Ringkasan Detail</th>
                    <th className="px-6 py-4 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                          <p className="font-medium">Memuat data audit...</p>
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-500">
                        <ShieldAlert className="mx-auto mb-4 h-16 w-16 text-slate-200" />
                        <p className="text-lg font-medium text-slate-600">Tidak ada data audit</p>
                        <p className="text-sm">Coba reset filter atau perluas rentang tanggal.</p>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-primary/5">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {formatDateTime(log.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex min-w-0 flex-col">
                            <span className="font-medium text-slate-800">{log.profiles?.full_name || "Sistem / Anonim"}</span>
                            <span className="max-w-[220px] truncate text-xs text-muted-foreground">{log.profiles?.email || "-"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">{getActionBadge(log.action)}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium capitalize text-slate-700">{log.entity_type}</span>
                            {log.entity_id && <span className="max-w-[180px] truncate font-mono text-[10px] text-muted-foreground">{log.entity_id}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{summarizeDetails(log.details)}</td>
                        <td className="px-6 py-4 text-right">
                          <Button type="button" variant="outline" size="sm" className="h-9 whitespace-nowrap" onClick={() => setSelectedLog(log)}>
                            <Eye className="h-4 w-4" />
                            Detail
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalCount > 0 && (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Menampilkan <span className="font-medium">{pageStart}</span> hingga <span className="font-medium">{pageEnd}</span> dari <span className="font-medium">{totalCount}</span> log
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-9">
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </Button>
                <Badge variant="outline" className="h-9 px-3">Halaman {safePage} / {totalPages}</Badge>
                <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-9">
                  Selanjutnya
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-hidden shadow-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
              <div>
                <CardTitle>Detail Audit</CardTitle>
                <CardDescription>{formatDateTime(selectedLog.created_at)} - {selectedLog.entity_type}</CardDescription>
              </div>
              <Button variant="ghost" className="h-9 w-9 p-0" onClick={() => setSelectedLog(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              <div className="grid gap-3 md:grid-cols-2">
                <DetailField label="Aksi" value={selectedLog.action} />
                <DetailField label="Kategori" value={getActionCategory(selectedLog.action)} />
                <DetailField label="Pengguna" value={selectedLog.profiles?.full_name ?? "Sistem / Anonim"} />
                <DetailField label="Email" value={selectedLog.profiles?.email ?? "-"} />
                <DetailField label="Entitas" value={selectedLog.entity_type} />
                <DetailField label="ID Entitas" value={selectedLog.entity_id ?? "-"} />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Payload Detail</p>
                <pre className="max-h-[360px] overflow-auto rounded-lg border bg-slate-950 p-4 text-xs text-slate-100">
                  {selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : "Tidak ada payload detail."}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function AuditMetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof Activity;
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

function AuditWorkflowItem({
  done,
  title,
  description,
  action,
  onClick,
}: {
  done: boolean;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start gap-3">
        {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />}
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <Button type="button" variant={done ? "outline" : "default"} size="sm" className="mt-3 h-9 whitespace-nowrap" onClick={onClick}>
            <Filter className="h-4 w-4" />
            {action}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
