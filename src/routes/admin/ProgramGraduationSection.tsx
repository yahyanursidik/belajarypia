import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Lesson } from "../../lib/academic";
import type { GradingRubricItem, GraduationSettings, Program } from "../../lib/organization";
import { supabase } from "../../lib/supabase";

type ProgramGraduationSectionProps = {
  program: Program;
  lessons: Lesson[];
  onProgramUpdated: (program: Program) => void;
};

type EnrollmentRow = {
  id: string;
  enrollment_number: string;
  enrollment_status: string;
  payment_status: string;
  participant_id: string;
  participants: {
    id: string;
    display_name: string;
    global_participant_number: string;
    profiles?: { email: string | null } | null;
  };
};

type ProgressRow = {
  enrollment_id: string;
  lesson_id: string;
  status: string;
  score: number | null;
};

type GraduationResultRow = {
  enrollment_id: string;
  final_score: number | null;
  completion_percent: number;
  predicate: string | null;
  status: "eligible" | "graduated" | "revision";
  decided_at: string | null;
};

type Candidate = EnrollmentRow & {
  completionPercent: number;
  finalScore: number;
  allAssessmentsPassed: boolean;
  paymentCleared: boolean;
  eligible: boolean;
  graduated: boolean;
  predicate: string;
  result?: GraduationResultRow;
};

const defaultSettings: GraduationSettings = {
  minimum_final_score: 65,
  minimum_completion_percent: 100,
  require_all_assessments_passed: true,
  require_payment_clearance: false,
};

const defaultRubric: GradingRubricItem[] = [
  { min_score: 90, max_score: 100, label: "Mumtaz (Istimewa)" },
  { min_score: 80, max_score: 89.99, label: "Jayyid Jiddan (Baik Sekali)" },
  { min_score: 65, max_score: 79.99, label: "Jayyid (Baik)" },
  { min_score: 40, max_score: 64.99, label: "Maqbul (Cukup)" },
  { min_score: 0, max_score: 39.99, label: "Rasib (Perlu Mengulang)" },
];

function isMissingGraduationSchema(message?: string | null) {
  const value = message?.toLowerCase() ?? "";
  return value.includes("program_graduation_results") || value.includes("graduation_settings") || value.includes("finalize_program_graduation") || value.includes("schema cache");
}

function rubricErrors(rubric: GradingRubricItem[]) {
  const errors: string[] = [];
  if (rubric.length === 0) return ["Tambahkan minimal satu rentang predikat."];
  const sorted = [...rubric].sort((first, second) => first.min_score - second.min_score);
  sorted.forEach((item, index) => {
    if (!item.label.trim()) errors.push(`Predikat baris ${index + 1} belum diberi nama.`);
    if (item.min_score < 0 || item.max_score > 100 || item.min_score > item.max_score) errors.push(`Rentang baris ${index + 1} harus berada antara 0-100 dan nilai minimum tidak boleh melebihi maksimum.`);
    const previous = sorted[index - 1];
    if (previous && item.min_score <= previous.max_score) errors.push(`Rentang ${previous.label || index} dan ${item.label || index + 1} saling tumpang tindih.`);
    if (previous && item.min_score - previous.max_score > 0.11) errors.push(`Ada celah nilai antara ${previous.max_score} dan ${item.min_score}.`);
  });
  if (sorted[0]?.min_score !== 0) errors.push("Rubrik harus dimulai dari nilai 0.");
  if (sorted.at(-1)?.max_score !== 100) errors.push("Rubrik harus berakhir pada nilai 100.");
  return [...new Set(errors)];
}

function getPredicate(score: number, rubric: GradingRubricItem[]) {
  return rubric.find((item) => score >= item.min_score && score <= item.max_score)?.label ?? "Belum terpetakan";
}

function percentage(value: number) {
  return `${Math.round(value)}%`;
}

export function ProgramGraduationSection({ program, lessons, onProgramUpdated }: ProgramGraduationSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/system") ? "/system" : "/admin";
  const [settings, setSettings] = useState<GraduationSettings>({ ...defaultSettings, ...(program.graduation_settings ?? {}) });
  const [rubric, setRubric] = useState<GradingRubricItem[]>(program.grading_rubric?.length ? program.grading_rubric : defaultRubric);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [results, setResults] = useState<GraduationResultRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [processingEnrollmentId, setProcessingEnrollmentId] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "eligible" | "review" | "graduated">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setSettings({ ...defaultSettings, ...(program.graduation_settings ?? {}) });
    setRubric(program.grading_rubric?.length ? program.grading_rubric : defaultRubric);
  }, [program]);

  const loadCandidates = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    const enrollmentResult = await supabase
      .from("enrollments")
      .select(`
        id, enrollment_number, enrollment_status, payment_status, participant_id,
        participants!inner (id, display_name, global_participant_number, profiles(email))
      `)
      .eq("program_id", program.id)
      .neq("enrollment_status", "cancelled")
      .order("created_at", { ascending: false });

    if (enrollmentResult.error) {
      setFeedback({ type: "error", message: `Peserta kelulusan gagal dimuat: ${enrollmentResult.error.message}` });
      setIsLoading(false);
      return;
    }

    const rows = (enrollmentResult.data ?? []) as unknown as EnrollmentRow[];
    setEnrollments(rows);
    if (rows.length === 0) {
      setProgressRows([]);
      setResults([]);
      setIsLoading(false);
      return;
    }

    const enrollmentIds = rows.map((row) => row.id);
    const [progressResult, graduationResult] = await Promise.all([
      supabase.from("lesson_progresses").select("enrollment_id, lesson_id, status, score").in("enrollment_id", enrollmentIds),
      supabase.from("program_graduation_results").select("enrollment_id, final_score, completion_percent, predicate, status, decided_at").eq("program_id", program.id),
    ]);

    if (progressResult.error) {
      setFeedback({ type: "error", message: `Progres peserta gagal dimuat: ${progressResult.error.message}` });
    } else {
      setProgressRows((progressResult.data ?? []) as ProgressRow[]);
    }

    if (graduationResult.error) {
      if (isMissingGraduationSchema(graduationResult.error.message)) {
        setSchemaReady(false);
        setResults([]);
      } else {
        setFeedback({ type: "error", message: `Hasil kelulusan gagal dimuat: ${graduationResult.error.message}` });
      }
    } else {
      setSchemaReady(true);
      setResults((graduationResult.data ?? []) as GraduationResultRow[]);
    }
    setIsLoading(false);
  }, [program.id]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const validationErrors = useMemo(() => rubricErrors(rubric), [rubric]);
  const savedSettings = useMemo(() => JSON.stringify({ settings: { ...defaultSettings, ...(program.graduation_settings ?? {}) }, rubric: program.grading_rubric?.length ? program.grading_rubric : defaultRubric }), [program]);
  const draftSettings = useMemo(() => JSON.stringify({ settings, rubric }), [rubric, settings]);
  const hasChanges = savedSettings !== draftSettings;

  const candidates = useMemo<Candidate[]>(() => {
    const resultMap = new Map(results.map((result) => [result.enrollment_id, result]));
    const assessmentLessons = lessons.filter((lesson) => lesson.lesson_type === "quiz" || lesson.lesson_type === "exam");
    return enrollments.map((enrollment) => {
      const enrollmentProgress = progressRows.filter((row) => row.enrollment_id === enrollment.id);
      const completedLessons = new Set(enrollmentProgress.filter((row) => row.status === "completed").map((row) => row.lesson_id));
      const completionPercent = lessons.length > 0 ? (completedLessons.size / lessons.length) * 100 : 0;
      const scores = enrollmentProgress.map((row) => row.score).filter((score): score is number => score !== null && Number.isFinite(Number(score))).map(Number);
      const finalScore = scores.length > 0 ? scores.reduce((total, score) => total + score, 0) / scores.length : completionPercent;
      const allAssessmentsPassed = assessmentLessons.every((lesson) => {
        const progress = enrollmentProgress.find((row) => row.lesson_id === lesson.id && row.status === "completed");
        return Boolean(progress && Number(progress.score ?? 0) >= Number(lesson.passing_grade ?? settings.minimum_final_score));
      });
      const paymentCleared = ["not_required", "paid", "verified", "completed"].includes(enrollment.payment_status);
      const result = resultMap.get(enrollment.id);
      const graduated = result?.status === "graduated" || enrollment.enrollment_status === "completed";
      const eligible = !graduated
        && completionPercent >= settings.minimum_completion_percent
        && finalScore >= settings.minimum_final_score
        && (!settings.require_all_assessments_passed || allAssessmentsPassed)
        && (!settings.require_payment_clearance || paymentCleared);

      return {
        ...enrollment,
        completionPercent,
        finalScore,
        allAssessmentsPassed,
        paymentCleared,
        eligible,
        graduated,
        predicate: result?.predicate ?? getPredicate(finalScore, rubric),
        result,
      };
    });
  }, [enrollments, lessons, progressRows, results, rubric, settings]);

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return candidates.filter((candidate) => {
      const matchesQuery = !query || [candidate.participants.display_name, candidate.participants.global_participant_number, candidate.enrollment_number, candidate.participants.profiles?.email].filter(Boolean).join(" ").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "eligible" && candidate.eligible)
        || (statusFilter === "graduated" && candidate.graduated)
        || (statusFilter === "review" && !candidate.eligible && !candidate.graduated);
      return matchesQuery && matchesStatus;
    });
  }, [candidates, searchQuery, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const pagedCandidates = filteredCandidates.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [searchQuery, statusFilter]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const stats = useMemo(() => ({
    total: candidates.length,
    eligible: candidates.filter((candidate) => candidate.eligible).length,
    review: candidates.filter((candidate) => !candidate.eligible && !candidate.graduated).length,
    graduated: candidates.filter((candidate) => candidate.graduated).length,
  }), [candidates]);

  const saveCriteria = async () => {
    if (validationErrors.length > 0) {
      setFeedback({ type: "error", message: validationErrors[0] });
      return;
    }
    if (settings.minimum_final_score < 0 || settings.minimum_final_score > 100 || settings.minimum_completion_percent < 0 || settings.minimum_completion_percent > 100) {
      setFeedback({ type: "error", message: "Nilai minimum dan progres minimum harus berada pada rentang 0-100." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    const normalizedRubric = [...rubric].sort((first, second) => second.min_score - first.min_score);
    const { data, error } = await supabase
      .from("programs")
      .update({ grading_rubric: normalizedRubric, graduation_settings: settings })
      .eq("id", program.id)
      .select("*")
      .single();
    if (error || !data) {
      const migrationHint = isMissingGraduationSchema(error?.message) ? " Jalankan migration 202607170001_program_graduation_workflow.sql." : "";
      setFeedback({ type: "error", message: `Kriteria kelulusan gagal disimpan: ${error?.message ?? "data tidak ditemukan"}.${migrationHint}` });
    } else {
      onProgramUpdated(data as Program);
      setRubric(normalizedRubric);
      setSchemaReady(true);
      setFeedback({ type: "success", message: "Kriteria dan rubrik kelulusan berhasil disimpan." });
    }
    setIsSaving(false);
  };

  const finalizeGraduation = async (candidate: Candidate) => {
    if (!candidate.eligible || !schemaReady) return;
    const confirmed = window.confirm(`Tetapkan ${candidate.participants.display_name} sebagai lulus dengan predikat ${candidate.predicate}?`);
    if (!confirmed) return;
    setProcessingEnrollmentId(candidate.id);
    setFeedback(null);
    const { error } = await supabase.rpc("finalize_program_graduation", {
      target_enrollment_id: candidate.id,
      target_final_score: Number(candidate.finalScore.toFixed(2)),
      target_completion_percent: Number(candidate.completionPercent.toFixed(2)),
      target_predicate: candidate.predicate,
      target_notes: "Ditetapkan dari halaman kelulusan program",
    });
    if (error) {
      const migrationHint = isMissingGraduationSchema(error.message) ? " Jalankan migration 202607170001_program_graduation_workflow.sql." : "";
      setFeedback({ type: "error", message: `Kelulusan gagal ditetapkan: ${error.message}.${migrationHint}` });
    } else {
      await loadCandidates();
      setFeedback({ type: "success", message: `${candidate.participants.display_name} berhasil ditetapkan lulus.` });
    }
    setProcessingEnrollmentId(null);
  };

  const updateRubric = (index: number, field: keyof GradingRubricItem, value: string) => {
    setRubric((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, [field]: field === "label" ? value : Number(value) }
      : item));
  };

  return (
    <div className="space-y-6">
      {!schemaReady ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Workflow kelulusan belum diaktifkan di database</AlertTitle>
          <AlertDescription>Jalankan migration <strong>202607170001_program_graduation_workflow.sql</strong>. Perhitungan kesiapan tetap dapat dilihat, tetapi penetapan lulus dinonaktifkan.</AlertDescription>
        </Alert>
      ) : null}
      {feedback ? (
        <Alert className={feedback.type === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}>
          {feedback.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Peserta Dinilai", value: stats.total, icon: Users, className: "text-primary bg-primary/10" },
          { label: "Siap Diluluskan", value: stats.eligible, icon: ShieldCheck, className: "text-emerald-700 bg-emerald-50" },
          { label: "Perlu Tinjauan", value: stats.review, icon: AlertCircle, className: "text-amber-700 bg-amber-50" },
          { label: "Sudah Lulus", value: stats.graduated, icon: GraduationCap, className: "text-blue-700 bg-blue-50" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3 rounded-lg border bg-background p-4">
              <span className={`grid h-10 w-10 place-items-center rounded-md ${item.className}`}><Icon className="h-5 w-5" /></span>
              <span><strong className="block text-xl">{item.value}</strong><small className="text-muted-foreground">{item.label}</small></span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Kriteria Kelayakan</CardTitle>
            <CardDescription>Syarat minimum sebelum peserta dapat ditetapkan lulus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Nilai Akhir Minimum</label>
              <Input type="number" min="0" max="100" value={settings.minimum_final_score} onChange={(event) => setSettings((current) => ({ ...current, minimum_final_score: Number(event.target.value) }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Progres Materi Minimum (%)</label>
              <Input type="number" min="0" max="100" value={settings.minimum_completion_percent} onChange={(event) => setSettings((current) => ({ ...current, minimum_completion_percent: Number(event.target.value) }))} />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <input type="checkbox" className="mt-1" checked={settings.require_all_assessments_passed} onChange={(event) => setSettings((current) => ({ ...current, require_all_assessments_passed: event.target.checked }))} />
              <span><strong className="block text-sm">Semua evaluasi wajib lulus</strong><small className="text-muted-foreground">Passing grade setiap kuis/ujian ikut diperiksa.</small></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <input type="checkbox" className="mt-1" checked={settings.require_payment_clearance} onChange={(event) => setSettings((current) => ({ ...current, require_payment_clearance: event.target.checked }))} />
              <span><strong className="block text-sm">Administrasi harus tuntas</strong><small className="text-muted-foreground">Status pembayaran menjadi syarat kelayakan.</small></span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Rubrik Predikat</CardTitle>
                <CardDescription>Rentang harus menutup nilai 0-100 tanpa tumpang tindih.</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setRubric((current) => [...current, { min_score: 0, max_score: 0, label: "" }])}>
                <Plus className="mr-2 h-4 w-4" />
                Rentang
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {rubric.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-lg border bg-muted/15 p-3 sm:grid-cols-[100px_100px_minmax(0,1fr)_36px] sm:items-end">
                <div className="space-y-1"><label className="text-xs font-semibold">Minimum</label><Input type="number" min="0" max="100" step="0.01" value={item.min_score} onChange={(event) => updateRubric(index, "min_score", event.target.value)} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold">Maksimum</label><Input type="number" min="0" max="100" step="0.01" value={item.max_score} onChange={(event) => updateRubric(index, "max_score", event.target.value)} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold">Predikat</label><Input value={item.label} onChange={(event) => updateRubric(index, "label", event.target.value)} placeholder="Contoh: Mumtaz" /></div>
                <Button type="button" variant="ghost" className="h-9 w-9 p-0 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setRubric((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Hapus rentang ${index + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {validationErrors.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {validationErrors.slice(0, 3).map((error) => <p key={error}>- {error}</p>)}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Rubrik valid dan mencakup seluruh nilai.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void saveCriteria()} disabled={isSaving || !hasChanges || validationErrors.length > 0}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Menyimpan..." : "Simpan Kriteria Kelulusan"}
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><Award className="h-5 w-5 text-primary" /> Antrean Penetapan Kelulusan</CardTitle>
              <CardDescription>Progres dan nilai dihitung dari aktivitas pembelajaran terbaru.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadCandidates()} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Muat Ulang
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari nama, nomor peserta, atau email" />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "eligible", "review", "graduated"] as const).map((status) => (
                <Button key={status} type="button" size="sm" variant={statusFilter === status ? "default" : "outline"} onClick={() => setStatusFilter(status)}>
                  {{ all: "Semua", eligible: "Siap Lulus", review: "Perlu Tinjauan", graduated: "Lulus" }[status]}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr><th className="px-4 py-3">Peserta</th><th className="px-4 py-3">Progres</th><th className="px-4 py-3">Nilai & Predikat</th><th className="px-4 py-3">Kelayakan</th><th className="px-4 py-3 text-right">Aksi</th></tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Memuat antrean kelulusan...</td></tr>
                ) : pagedCandidates.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Tidak ada peserta sesuai pencarian dan filter.</td></tr>
                ) : pagedCandidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-muted/25">
                    <td className="px-4 py-4"><p className="font-semibold text-foreground">{candidate.participants.display_name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{candidate.enrollment_number}</p></td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, candidate.completionPercent)}%` }} /></div><span className="font-semibold">{percentage(candidate.completionPercent)}</span></div><p className="mt-1 text-xs text-muted-foreground">materi selesai</p></td>
                    <td className="px-4 py-4"><p className="font-semibold">{candidate.finalScore.toFixed(1)}</p><p className="text-xs text-muted-foreground">{candidate.predicate}</p></td>
                    <td className="px-4 py-4">{candidate.graduated ? <Badge className="bg-blue-600">Lulus</Badge> : candidate.eligible ? <Badge className="bg-emerald-600">Siap Diluluskan</Badge> : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Perlu Tinjauan</Badge>}</td>
                    <td className="px-4 py-4"><div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => navigate(`${basePath}/peserta/${candidate.participants.id}`)} aria-label={`Detail ${candidate.participants.display_name}`}><Eye className="h-4 w-4" /></Button>{candidate.eligible ? <Button type="button" size="sm" onClick={() => void finalizeGraduation(candidate)} disabled={!schemaReady || processingEnrollmentId === candidate.id}>{processingEnrollmentId === candidate.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />}Tetapkan Lulus</Button> : null}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Menampilkan {pagedCandidates.length} dari {filteredCandidates.length} peserta.</p>
            <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-20 text-center text-xs font-semibold">{page} / {totalPages}</span><Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></Button></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
