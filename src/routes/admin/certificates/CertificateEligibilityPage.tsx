import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, CheckCircle2, ClipboardCheck, Download, FileText, Filter, RefreshCw, Search, Send, Users, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { CertificateModuleHeader } from "./CertificateModuleNav";

type ProgramOption = { id: string; name: string; code?: string | null };
type BatchOption = { id: string; name: string };
type TemplateOption = { id: string; name: string; status?: string };

type EligibleEnrollment = {
  id: string;
  participant_id: string;
  enrollment_status: string;
  participants?: {
    display_name?: string | null;
    global_participant_number?: string | null;
  } | null;
};

type NotEligibleEnrollment = EligibleEnrollment & {
  reason?: string;
};

type EligibilityResponse = {
  eligible?: EligibleEnrollment[];
  notEligible?: NotEligibleEnrollment[];
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message: unknown }).message);
  return "Terjadi kesalahan yang tidak diketahui.";
}

export function CertificateEligibilityPage() {
  const location = useLocation();
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [eligible, setEligible] = useState<EligibleEnrollment[]>([]);
  const [notEligible, setNotEligible] = useState<NotEligibleEnrollment[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resultSearch, setResultSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<"all" | "eligible" | "not_eligible">("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [selectedEligibleIds, setSelectedEligibleIds] = useState<Set<string>>(new Set());

  const selectedProgram = programs.find((program) => program.id === programId);
  const basePrefix = location.pathname.startsWith("/system") ? "/system" : "/admin";

  const loadPrograms = useCallback(async () => {
    setLoadingPrograms(true);
    setErrorMsg(null);
    const { data, error } = await supabase.from("programs").select("id, name, code").order("name");
    if (error) {
      setErrorMsg(error.message);
    } else {
      setPrograms((data ?? []) as ProgramOption[]);
    }
    setLoadingPrograms(false);
  }, []);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  useEffect(() => {
    async function loadBatchesAndTemplates() {
      if (!programId) {
        setBatches([]);
        setTemplates([]);
        setBatchId("");
        setTemplateId("");
        return;
      }
      setLoadingOptions(true);
      setErrorMsg(null);
      const [{ data: batchRows, error: batchError }, { data: templateRows, error: templateError }] = await Promise.all([
        supabase.from("batches").select("id, name").eq("program_id", programId).order("name"),
        supabase.from("certificate_templates").select("id, name, status").eq("program_id", programId).eq("status", "active").order("name"),
      ]);
      if (batchError || templateError) {
        setErrorMsg(batchError?.message ?? templateError?.message ?? "Gagal memuat opsi program.");
      } else {
        setBatches((batchRows ?? []) as BatchOption[]);
        const activeTemplates = (templateRows ?? []) as TemplateOption[];
        setTemplates(activeTemplates);
        setTemplateId(activeTemplates[0]?.id ?? "");
      }
      setBatchId("");
      setEligible([]);
      setNotEligible([]);
      setLoadingOptions(false);
    }
    void loadBatchesAndTemplates();
  }, [programId]);

  const stats = useMemo(() => ({
    eligible: eligible.length,
    notEligible: notEligible.length,
    totalChecked: eligible.length + notEligible.length,
    templates: templates.length,
    selected: selectedEligibleIds.size,
  }), [eligible.length, notEligible.length, selectedEligibleIds.size, templates.length]);

  const reasonSummary = useMemo(() => {
    const summary = new Map<string, number>();
    notEligible.forEach((item) => {
      const reason = item.reason || "Belum memenuhi syarat";
      summary.set(reason, (summary.get(reason) ?? 0) + 1);
    });
    return Array.from(summary.entries()).sort((a, b) => b[1] - a[1]);
  }, [notEligible]);

  const filteredEligible = useMemo(() => {
    const query = resultSearch.trim().toLowerCase();
    if (resultFilter === "not_eligible") return [];
    return eligible.filter((item) => {
      const name = item.participants?.display_name ?? "";
      const number = item.participants?.global_participant_number ?? "";
      const matchesSearch = !query
        || name.toLowerCase().includes(query)
        || number.toLowerCase().includes(query)
        || item.enrollment_status.toLowerCase().includes(query);
      return matchesSearch;
    });
  }, [eligible, resultFilter, resultSearch]);

  const filteredNotEligible = useMemo(() => {
    const query = resultSearch.trim().toLowerCase();
    if (resultFilter === "eligible") return [];
    return notEligible.filter((item) => {
      const name = item.participants?.display_name ?? "";
      const number = item.participants?.global_participant_number ?? "";
      const reason = item.reason || "Belum memenuhi syarat";
      const matchesSearch = !query
        || name.toLowerCase().includes(query)
        || number.toLowerCase().includes(query)
        || reason.toLowerCase().includes(query);
      const matchesReason = reasonFilter === "all" || reason === reasonFilter;
      return matchesSearch && matchesReason;
    });
  }, [notEligible, reasonFilter, resultFilter, resultSearch]);

  const selectedEligibleRows = useMemo(
    () => eligible.filter((enrollment) => selectedEligibleIds.has(enrollment.id)),
    [eligible, selectedEligibleIds],
  );

  const checkEligibility = async () => {
    if (!programId) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-certificate-eligibility", {
        body: { program_id: programId, batch_id: batchId || null },
      });
      if (error) throw error;
      const result = (data ?? {}) as EligibilityResponse;
      const eligibleRows = result.eligible ?? [];
      setEligible(eligibleRows);
      setNotEligible(result.notEligible ?? []);
      setSelectedEligibleIds(new Set(eligibleRows.map((enrollment) => enrollment.id)));
      setResultSearch("");
      setResultFilter("all");
      setReasonFilter("all");
    } catch (error) {
      setErrorMsg(getErrorMessage(error));
    }
    setLoading(false);
  };

  const createBatch = async () => {
    if (!programId || !templateId || selectedEligibleRows.length === 0) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.functions.invoke("create-certificate-issuance-batch", {
        body: {
          program_id: programId,
          batch_id: batchId || null,
          template_id: templateId,
          enrollments: selectedEligibleRows.map((enrollment) => ({
            enrollment_id: enrollment.id,
            participant_id: enrollment.participant_id,
          })),
        },
      });
      if (error) throw error;
      setSuccessMsg("Antrean berhasil dibuat. Pantau prosesnya di halaman Antrean Penerbitan.");
      setEligible([]);
      setNotEligible([]);
      setSelectedEligibleIds(new Set());
    } catch (error) {
      setErrorMsg(getErrorMessage(error));
    }
    setLoading(false);
  };

  const toggleEligibleSelection = (enrollmentId: string) => {
    setSelectedEligibleIds((current) => {
      const next = new Set(current);
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId);
      } else {
        next.add(enrollmentId);
      }
      return next;
    });
  };

  const toggleAllVisibleEligible = () => {
    setSelectedEligibleIds((current) => {
      const next = new Set(current);
      const allVisibleSelected = filteredEligible.length > 0 && filteredEligible.every((row) => next.has(row.id));
      filteredEligible.forEach((row) => {
        if (allVisibleSelected) {
          next.delete(row.id);
        } else {
          next.add(row.id);
        }
      });
      return next;
    });
  };

  const exportResultsToCSV = () => {
    const rows = [["Status", "Nama Peserta", "Nomor", "Enrollment", "Alasan"]];
    eligible.forEach((item) => {
      rows.push([
        "Layak",
        item.participants?.display_name ?? "-",
        item.participants?.global_participant_number ?? "-",
        item.enrollment_status,
        "-",
      ]);
    });
    notEligible.forEach((item) => {
      rows.push([
        "Belum Layak",
        item.participants?.display_name ?? "-",
        item.participants?.global_participant_number ?? "-",
        item.enrollment_status,
        item.reason ?? "Belum memenuhi syarat",
      ]);
    });

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hasil-kelayakan-syahadah-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack pb-12">
      <CertificateModuleHeader
        active="eligibility"
        title="Cek Kelayakan Syahadah"
        description="Validasi peserta yang sudah memenuhi syarat sebelum membuat antrean penerbitan syahadah."
        actions={(
          <>
            <Button
              type="button"
              onClick={() => void loadPrograms()}
              disabled={loadingPrograms}
              variant="outline"
              className="h-10 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loadingPrograms ? "animate-spin" : ""}`} />
              Muat Ulang
            </Button>
            <Button asChild className="h-10 bg-white !text-primary hover:bg-white/90">
              <Link to={`${basePrefix}/sertifikat`}>
                <FileText className="h-4 w-4" />
                Template
              </Link>
            </Button>
            <Button asChild className="h-10 bg-amber-400 text-slate-950 hover:bg-amber-300">
              <Link to={`${basePrefix}/sertifikat/antrean`}>
                <Send className="h-4 w-4" />
                Antrean
              </Link>
            </Button>
          </>
        )}
      />

      {errorMsg && (
        <Alert className="border-red-500 bg-red-50 text-red-900">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}
      {successMsg && (
        <Alert className="border-emerald-500 bg-emerald-50 text-emerald-900">
          <AlertTitle>Berhasil</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{successMsg}</span>
            <Button asChild size="sm" className="w-fit bg-emerald-700 hover:bg-emerald-800">
              <Link to={`${basePrefix}/sertifikat/antrean`}>Buka Antrean</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Dicek" value={stats.totalChecked} description="peserta dianalisis" icon={Users} />
        <MetricCard title="Layak" value={stats.eligible} description="siap diterbitkan" icon={CheckCircle2} />
        <MetricCard title="Belum Layak" value={stats.notEligible} description="perlu tindak lanjut" icon={XCircle} />
        <MetricCard title="Dipilih" value={stats.selected} description="masuk antrean" icon={FileText} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Penerbitan</CardTitle>
          <CardDescription>Pilih program, cek kelayakan peserta, pilih template aktif, lalu buat antrean syahadah.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <WorkflowItem done={Boolean(programId)} title="Pilih program" description={selectedProgram?.name ?? "Tentukan program yang akan dicek kelayakannya."} />
          <WorkflowItem done={stats.eligible > 0 || stats.notEligible > 0} title="Cek kelayakan" description={`${stats.totalChecked} peserta sudah dianalisis pada sesi ini.`} />
          <WorkflowItem done={Boolean(templateId)} title="Siapkan template" description={templateId ? `${templates.length} template aktif tersedia untuk program ini.` : "Program ini perlu template aktif sebelum antrean dibuat."} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filter Peserta</CardTitle>
          <CardDescription>Batch bersifat opsional. Kosongkan untuk mengecek seluruh peserta di program.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Program</label>
              <select className="field-control h-11 bg-white" value={programId} onChange={(event) => setProgramId(event.target.value)} disabled={loadingPrograms || loading}>
                <option value="">Pilih Program</option>
                {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Batch / Angkatan</label>
              <select className="field-control h-11 bg-white" value={batchId} onChange={(event) => setBatchId(event.target.value)} disabled={!programId || loading || loadingOptions}>
                <option value="">Semua Batch</option>
                {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
              </select>
            </div>
            <Button onClick={checkEligibility} disabled={!programId || loading} className="h-11 min-w-[160px]">
              <ClipboardCheck className="h-4 w-4" />
              {loading ? "Memproses..." : "Cek Kelayakan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {stats.totalChecked > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle>Hasil Pemeriksaan</CardTitle>
                <CardDescription>Cari peserta, filter status kelayakan, pilih peserta yang akan masuk antrean, lalu export hasil bila perlu.</CardDescription>
              </div>
              <Button type="button" variant="outline" className="h-10" onClick={exportResultsToCSV}>
                <Download className="h-4 w-4" />
                Export Hasil
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9"
                  placeholder="Cari nama peserta, nomor, status, atau alasan..."
                  value={resultSearch}
                  onChange={(event) => setResultSearch(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <select className="field-control h-11 w-full bg-white sm:w-44" value={resultFilter} onChange={(event) => setResultFilter(event.target.value as "all" | "eligible" | "not_eligible")}>
                  <option value="all">Semua Hasil</option>
                  <option value="eligible">Layak</option>
                  <option value="not_eligible">Belum Layak</option>
                </select>
                <select className="field-control h-11 w-full bg-white sm:w-64" value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value)} disabled={resultFilter === "eligible" || reasonSummary.length === 0}>
                  <option value="all">Semua Alasan</option>
                  {reasonSummary.map(([reason, count]) => <option key={reason} value={reason}>{reason} ({count})</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border bg-emerald-50/50 p-4">
                <p className="text-sm font-semibold text-emerald-800">Siap antrean</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{selectedEligibleIds.size}</p>
                <p className="text-xs text-emerald-700">dari {eligible.length} peserta layak dipilih</p>
              </div>
              <div className="rounded-xl border bg-red-50/50 p-4">
                <p className="text-sm font-semibold text-red-800">Perlu tindak lanjut</p>
                <p className="mt-1 text-2xl font-bold text-red-900">{notEligible.length}</p>
                <p className="text-xs text-red-700">peserta belum memenuhi syarat</p>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Alasan terbanyak</p>
                <p className="mt-1 truncate text-base font-bold text-slate-900">{reasonSummary[0]?.[0] ?? "-"}</p>
                <p className="text-xs text-muted-foreground">{reasonSummary[0]?.[1] ?? 0} peserta</p>
              </div>
            </div>

            {reasonSummary.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Filter className="mt-1 h-4 w-4 text-muted-foreground" />
                {reasonSummary.slice(0, 6).map(([reason, count]) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setResultFilter("not_eligible");
                      setReasonFilter(reason);
                    }}
                    className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-muted"
                  >
                    {reason} <span className="text-muted-foreground">({count})</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {eligible.length > 0 && (
        <Card className="border-emerald-200">
          <CardHeader className="border-b bg-emerald-50/50">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle className="h-5 w-5" />
                  Peserta Layak ({filteredEligible.length}/{eligible.length})
                </CardTitle>
                <CardDescription>Pilih peserta yang akan dimasukkan ke antrean syahadah.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-3">
                <select className="field-control h-10 w-full bg-white sm:w-72" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                  <option value="">Pilih Template</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
                <Button onClick={createBatch} disabled={!templateId || loading || selectedEligibleRows.length === 0} className="h-10 bg-emerald-600 hover:bg-emerald-700">
                  <Send className="h-4 w-4" />
                  Buat Antrean ({selectedEligibleRows.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <ParticipantTable
            rows={filteredEligible}
            selectedIds={selectedEligibleIds}
            onToggle={toggleEligibleSelection}
            onToggleAll={toggleAllVisibleEligible}
          />
        </Card>
      )}

      {notEligible.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="border-b bg-red-50/50">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <XCircle className="h-5 w-5" />
              Belum Layak ({filteredNotEligible.length}/{notEligible.length})
            </CardTitle>
            <CardDescription>Gunakan alasan ini sebagai daftar tindak lanjut akademik atau administrasi.</CardDescription>
          </CardHeader>
          <div className="max-h-[420px] overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-3 font-semibold">Nama Peserta</th>
                  <th className="px-6 py-3 font-semibold">Nomor</th>
                  <th className="px-6 py-3 font-semibold">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {filteredNotEligible.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium">{enrollment.participants?.display_name ?? "-"}</td>
                    <td className="px-6 py-3 font-mono text-xs">{enrollment.participants?.global_participant_number ?? "-"}</td>
                    <td className="px-6 py-3"><Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{enrollment.reason ?? "Belum memenuhi syarat"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ParticipantTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  rows: EligibleEnrollment[];
  selectedIds: Set<string>;
  onToggle: (enrollmentId: string) => void;
  onToggleAll: () => void;
}) {
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  return (
    <div className="max-h-[420px] overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="sticky top-0 border-b bg-slate-50">
          <tr>
            <th className="w-12 px-6 py-3 font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={allVisibleSelected}
                onChange={onToggleAll}
                aria-label="Pilih semua peserta yang terlihat"
              />
            </th>
            <th className="px-6 py-3 font-semibold">Nama Peserta</th>
            <th className="px-6 py-3 font-semibold">Nomor</th>
            <th className="px-6 py-3 font-semibold">Status Enrollment</th>
          </tr>
        </thead>
        <tbody className="divide-y bg-white">
          {rows.map((enrollment) => (
            <tr key={enrollment.id} className="hover:bg-slate-50">
              <td className="px-6 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={selectedIds.has(enrollment.id)}
                  onChange={() => onToggle(enrollment.id)}
                  aria-label={`Pilih ${enrollment.participants?.display_name ?? "peserta"}`}
                />
              </td>
              <td className="px-6 py-3 font-medium">{enrollment.participants?.display_name ?? "-"}</td>
              <td className="px-6 py-3 font-mono text-xs">{enrollment.participants?.global_participant_number ?? "-"}</td>
              <td className="px-6 py-3"><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{enrollment.enrollment_status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({ title, value, description, icon: Icon }: { title: string; value: number; description: string; icon: typeof Users }) {
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

function WorkflowItem({ done, title, description }: { done: boolean; title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start gap-3">
        {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />}
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
