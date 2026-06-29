import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Activity, Filter, ChevronLeft, ChevronRight, Clock, FileEdit, Trash2, Plus } from "lucide-react";

type AuditLog = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
};

function getActionBadge(action: string) {
  const lower = action.toLowerCase();
  if (lower.includes("create") || lower.includes("insert") || lower.includes("add")) {
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px]"><Plus className="h-2.5 w-2.5 mr-1" />{action}</Badge>;
  }
  if (lower.includes("update") || lower.includes("edit") || lower.includes("modify")) {
    return <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 text-[10px]"><FileEdit className="h-2.5 w-2.5 mr-1" />{action}</Badge>;
  }
  if (lower.includes("delete") || lower.includes("remove")) {
    return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px]"><Trash2 className="h-2.5 w-2.5 mr-1" />{action}</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">{action}</Badge>;
}

export function SystemAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
    const pageSize = 20;

  // Distinct values for filters
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [entityOptions, setEntityOptions] = useState<string[]>([]);

  useEffect(() => {
    async function fetchFilters() {
      const { data: actionData } = await supabase.from("audit_logs").select("action");
      const { data: entityData } = await supabase.from("audit_logs").select("entity_type");
      if (actionData) setActionOptions([...new Set(actionData.map((r: any) => r.action))].sort());
      if (entityData) setEntityOptions([...new Set(entityData.map((r: any) => r.entity_type))].sort());
    }
    fetchFilters();
  }, []);

  useEffect(() => {
    async function fetchLogs() {
      setIsLoading(true);
      try {
        let query = supabase
          .from("audit_logs")
          .select("*, profiles(full_name, email)", { count: "exact" })
          .order("created_at", { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1);

        if (filterAction !== "all") query = query.eq("action", filterAction);
        if (filterEntity !== "all") query = query.eq("entity_type", filterEntity);
        
        const { data, error, count } = await query;
        if (error) throw error;
        setLogs(data as any);
        setTotalCount(count ?? 0);
      } catch (err) {
        console.error("Gagal memuat audit log:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, [page, filterAction, filterEntity]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-10">
      {/* Hero */}
      <section className="page-hero">
        <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30 backdrop-blur-sm shadow-sm">KEAMANAN SISTEM</Badge>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-white/10 items-center justify-center border border-white/20 backdrop-blur-sm shadow-inner">
              <ShieldAlert className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-white text-3xl font-bold tracking-tight">Audit Sistem</h2>
              <p className="text-white/80 max-w-xl text-sm md:text-base mt-1">
                Riwayat seluruh aktivitas dan perubahan dalam sistem LMS.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-primary text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Total Log</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{totalCount}</p></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Halaman</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{page} / {totalPages || 1}</p></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm flex items-center gap-2"><Filter className="w-4 h-4" /> Filter Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {[filterAction !== "all" ? 1 : 0, filterEntity !== "all" ? 1 : 0].reduce((a, b) => a + b, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 bg-white">
          <div>
            <CardTitle>Riwayat Aktivitas</CardTitle>
            <CardDescription>Menampilkan {logs.length} dari {totalCount} catatan audit.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-lg border border-muted/40 h-10">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <select className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer text-slate-700" value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}>
                <option value="all">Semua Aksi</option>
                {actionOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <div className="w-px h-4 bg-border mx-1"></div>
              <select className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer text-slate-700" value={filterEntity} onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}>
                <option value="all">Semua Entitas</option>
                {entityOptions.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 border-b border-border/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Waktu</th>
                  <th className="px-6 py-4 font-semibold">Pengguna</th>
                  <th className="px-6 py-4 font-semibold">Aksi</th>
                  <th className="px-6 py-4 font-semibold">Entitas</th>
                  <th className="px-6 py-4 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="font-medium">Memuat data audit...</p>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                      <ShieldAlert className="h-16 w-16 mx-auto mb-4 text-slate-200" />
                      <p className="font-medium text-lg text-slate-600">Belum ada data audit</p>
                      <p className="text-sm">Coba sesuaikan filter yang Anda gunakan.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {new Date(log.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">{log.profiles?.full_name || "Sistem / Anonim"}</span>
                          <span className="text-xs text-muted-foreground">{log.profiles?.email || "-"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getActionBadge(log.action)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="capitalize font-medium text-slate-700">{log.entity_type}</span>
                          {log.entity_id && (
                            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{log.entity_id}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {log.details ? (
                          <pre className="text-xs bg-slate-100 p-2 rounded-md max-w-xs overflow-x-auto whitespace-pre-wrap text-slate-600">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-slate-50/50">
              <p className="text-sm text-muted-foreground">
                Menampilkan {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} dari {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 px-3">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Sebelumnya
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-8 px-3">
                  Selanjutnya <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
