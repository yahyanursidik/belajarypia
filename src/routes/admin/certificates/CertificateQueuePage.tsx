import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Award, CheckCircle2, Clock, Download, ListChecks, RefreshCw, Search, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "../../../lib/supabase";
import { CertificateModuleHeader } from "./CertificateModuleNav";

type BatchStatus = "pending" | "processing" | "completed" | "failed";

type CertificateBatchRow = {
  id: string;
  program_id: string;
  batch_id: string | null;
  template_id: string;
  created_by: string | null;
  status: BatchStatus;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  created_at: string;
  completed_at: string | null;
};

type ProgramOption = { id: string; name: string };
type TemplateOption = { id: string; name: string };

const statusOptions: Array<{ value: "all" | BatchStatus; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "pending", label: "Menunggu" },
  { value: "processing", label: "Memproses" },
  { value: "completed", label: "Selesai" },
  { value: "failed", label: "Gagal" },
];

const statusMeta: Record<BatchStatus, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "border-amber-200 bg-amber-50 text-amber-700" },
  processing: { label: "Memproses", className: "border-sky-200 bg-sky-50 text-sky-700" },
  completed: { label: "Selesai", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  failed: { label: "Gagal", className: "border-red-200 bg-red-50 text-red-700" },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CertificateQueuePage() {
  const [batches, setBatches] = useState<CertificateBatchRow[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | BatchStatus>("all");
  const [filterProgram, setFilterProgram] = useState("all");

  const loadData = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    const [{ data: batchRows, error: batchError }, { data: programRows, error: programError }, { data: templateRows, error: templateError }] = await Promise.all([
      supabase
        .from("certificate_issuance_batches")
        .select("id, program_id, batch_id, template_id, created_by, status, total_jobs, completed_jobs, failed_jobs, created_at, completed_at")
        .order("created_at", { ascending: false }),
      supabase.from("programs").select("id, name").order("name"),
      supabase.from("certificate_templates").select("id, name").order("name"),
    ]);

    if (batchError || programError || templateError) {
      setErrorMessage(batchError?.message ?? programError?.message ?? templateError?.message ?? "Gagal memuat antrean sertifikat.");
    } else {
      setBatches((batchRows ?? []) as CertificateBatchRow[]);
      setPrograms((programRows ?? []) as ProgramOption[]);
      setTemplates((templateRows ?? []) as TemplateOption[]);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const programMap = useMemo(() => new Map(programs.map((program) => [program.id, program.name])), [programs]);
  const templateMap = useMemo(() => new Map(templates.map((template) => [template.id, template.name])), [templates]);

  const stats = useMemo(() => ({
    total: batches.length,
    pending: batches.filter((batch) => batch.status === "pending").length,
    processing: batches.filter((batch) => batch.status === "processing").length,
    completed: batches.filter((batch) => batch.status === "completed").length,
    failed: batches.filter((batch) => batch.status === "failed").length,
    jobs: batches.reduce((sum, batch) => sum + batch.total_jobs, 0),
  }), [batches]);

  const filteredBatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return batches.filter((batch) => {
      const programName = programMap.get(batch.program_id) ?? "";
      const templateName = templateMap.get(batch.template_id) ?? "";
      const matchesSearch = !query
        || programName.toLowerCase().includes(query)
        || templateName.toLowerCase().includes(query)
        || batch.id.toLowerCase().includes(query);
      const matchesStatus = filterStatus === "all" || batch.status === filterStatus;
      const matchesProgram = filterProgram === "all" || batch.program_id === filterProgram;
      return matchesSearch && matchesStatus && matchesProgram;
    });
  }, [batches, filterProgram, filterStatus, programMap, searchQuery, templateMap]);

  const exportToCSV = () => {
    const rows = [["Tanggal", "Program", "Template", "Total", "Selesai", "Gagal", "Status"]];
    filteredBatches.forEach((batch) => {
      rows.push([
        formatDate(batch.created_at),
        programMap.get(batch.program_id) ?? "-",
        templateMap.get(batch.template_id) ?? "-",
        String(batch.total_jobs),
        String(batch.completed_jobs),
        String(batch.failed_jobs),
        statusMeta[batch.status].label,
      ]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `antrean-syahadah-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack pb-12">
      <CertificateModuleHeader
        active="queue"
        title="Antrean Penerbitan Syahadah"
        description="Pantau progres pembuatan syahadah, cek batch yang gagal, dan ekspor daftar proses untuk audit operasional."
        actions={(
          <>
            <Button
              type="button"
              onClick={() => void loadData(true)}
              disabled={isRefreshing}
              variant="outline"
              className="h-10 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Muat Ulang
            </Button>
            <Button onClick={exportToCSV} disabled={filteredBatches.length === 0} className="h-10 bg-white !text-primary hover:bg-white/90">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </>
        )}
      />

      {errorMessage && (
        <Alert className="border-red-500 bg-red-50 text-red-900">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <QueueMetricCard title="Total Batch" value={stats.total} description="semua antrean" icon={ListChecks} />
        <QueueMetricCard title="Menunggu" value={stats.pending} description="belum diproses" icon={Clock} />
        <QueueMetricCard title="Memproses" value={stats.processing} description="sedang berjalan" icon={RefreshCw} />
        <QueueMetricCard title="Selesai" value={stats.completed} description="berhasil terbit" icon={CheckCircle2} />
        <QueueMetricCard title="Gagal" value={stats.failed} description="perlu dicek" icon={XCircle} />
        <QueueMetricCard title="Total Job" value={stats.jobs} description="sertifikat diproses" icon={Award} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Antrean</CardTitle>
          <CardDescription>Mulai investigasi dari status gagal dan proses yang belum selesai.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <WorkflowItem done={stats.failed === 0} title="Cek batch gagal" description={`${stats.failed} batch gagal perlu ditindaklanjuti.`} action="Filter Gagal" onClick={() => setFilterStatus("failed")} />
          <WorkflowItem done={stats.processing === 0} title="Pantau proses berjalan" description={`${stats.processing} batch masih dalam proses.`} action="Filter Proses" onClick={() => setFilterStatus("processing")} />
          <WorkflowItem done={stats.pending === 0} title="Pantau antrean tertunda" description={`${stats.pending} batch masih menunggu worker.`} action="Filter Menunggu" onClick={() => setFilterStatus("pending")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Direktori Antrean</CardTitle>
          <CardDescription>Gunakan filter untuk membaca antrean berdasarkan program, status, atau template.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9"
                placeholder="Cari program, template, atau ID batch..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <select className="field-control h-11 w-full bg-white sm:w-56" value={filterProgram} onChange={(event) => setFilterProgram(event.target.value)}>
                <option value="all">Semua Program</option>
                {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
              </select>
              <select className="field-control h-11 w-full bg-white sm:w-44" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as "all" | BatchStatus)}>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed bg-muted/10 p-16 text-center">
              <ListChecks className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold text-foreground">Antrean kosong</h3>
              <p className="mt-2 text-muted-foreground">Belum ada antrean yang cocok dengan filter.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="border-b bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Tanggal</th>
                      <th className="px-6 py-4 font-semibold">Program</th>
                      <th className="px-6 py-4 font-semibold">Template</th>
                      <th className="px-6 py-4 text-center font-semibold">Total</th>
                      <th className="px-6 py-4 text-center font-semibold">Selesai</th>
                      <th className="px-6 py-4 text-center font-semibold">Gagal</th>
                      <th className="px-6 py-4 font-semibold">Progress</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {filteredBatches.map((batch) => {
                      const progress = batch.total_jobs > 0 ? Math.round((batch.completed_jobs / batch.total_jobs) * 100) : 0;
                      return (
                        <tr key={batch.id} className="hover:bg-primary/5">
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500">{formatDate(batch.created_at)}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">{programMap.get(batch.program_id) ?? "-"}</td>
                          <td className="px-6 py-4 text-slate-600">{templateMap.get(batch.template_id) ?? "-"}</td>
                          <td className="px-6 py-4 text-center font-semibold">{batch.total_jobs}</td>
                          <td className="px-6 py-4 text-center font-semibold text-emerald-600">{batch.completed_jobs}</td>
                          <td className="px-6 py-4 text-center font-semibold text-red-600">{batch.failed_jobs}</td>
                          <td className="px-6 py-4">
                            <div className="flex min-w-[140px] items-center gap-3">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="w-10 text-xs font-semibold text-slate-600">{progress}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={statusMeta[batch.status].className}>{statusMeta[batch.status].label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QueueMetricCard({ title, value, description, icon: Icon }: { title: string; value: number; description: string; icon: typeof ListChecks }) {
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

function WorkflowItem({ done, title, description, action, onClick }: { done: boolean; title: string; description: string; action: string; onClick: () => void }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start gap-3">
        {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />}
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <Button type="button" variant={done ? "outline" : "default"} size="sm" className="mt-3 h-9" onClick={onClick}>
            {action}
          </Button>
        </div>
      </div>
    </div>
  );
}
