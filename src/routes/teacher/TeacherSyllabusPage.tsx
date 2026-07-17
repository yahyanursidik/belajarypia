import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  Layers3,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Target,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuthSession } from "../../app/providers/authSessionContext";
import type { Program } from "../../lib/organization";
import { supabase } from "../../lib/supabase";

type TeacherProgram = Program & { teacher_user_id?: string | null };

type CurriculumMetrics = {
  modules: number;
  lessons: number;
  published: number;
  assessments: number;
};

const emptyMetrics: CurriculumMetrics = { modules: 0, lessons: 0, published: 0, assessments: 0 };

const syllabusTemplate = `RINGKASAN PROGRAM
Jelaskan gambaran umum dan sasaran peserta.

TUJUAN PEMBELAJARAN
1. Peserta mampu ...
2. Peserta memahami ...

CAPAIAN PEMBELAJARAN
- Pengetahuan: ...
- Keterampilan: ...
- Sikap: ...

STRUKTUR MATERI
1. Modul pertama
2. Modul kedua

METODE PEMBELAJARAN
Jelaskan metode penyampaian, diskusi, praktik, dan pendampingan.

EVALUASI DAN KELULUSAN
Jelaskan bentuk asesmen, bobot nilai, dan ketentuan kelulusan.

TATA TERTIB
1. ...
2. ...

REFERENSI
- ...`;

const quickSections = [
  { label: "Tujuan", icon: Target, content: "TUJUAN PEMBELAJARAN\n1. Peserta mampu ...\n2. Peserta memahami ..." },
  { label: "Capaian", icon: ListChecks, content: "CAPAIAN PEMBELAJARAN\n- Pengetahuan: ...\n- Keterampilan: ...\n- Sikap: ..." },
  { label: "Materi", icon: Layers3, content: "STRUKTUR MATERI\n1. Modul pertama\n2. Modul kedua" },
  { label: "Evaluasi", icon: CheckCircle2, content: "EVALUASI DAN KELULUSAN\nJelaskan bentuk asesmen, bobot nilai, dan ketentuan kelulusan." },
];

function sectionCount(value: string) {
  return value.split(/\r?\n/).filter((line) => /^[A-Z0-9][A-Z0-9\s/&().,-]{3,}$/.test(line.trim())).length;
}

export function TeacherSyllabusPage() {
  const { programId } = useParams<{ programId?: string }>();
  const navigate = useNavigate();
  const { user, primaryRole } = useAuthSession();
  const isMentor = primaryRole === "mentor";
  const [programs, setPrograms] = useState<TeacherProgram[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(programId ?? null);
  const [draft, setDraft] = useState("");
  const [metrics, setMetrics] = useState<CurriculumMetrics>(emptyMetrics);
  const [programQuery, setProgramQuery] = useState("");
  const [viewMode, setViewMode] = useState<"editor" | "preview">("editor");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selectedProgram = programs.find((program) => program.id === selectedId) ?? null;
  const savedSyllabus = selectedProgram?.syllabus ?? "";
  const hasChanges = Boolean(selectedProgram) && draft !== savedSyllabus;
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const sections = sectionCount(draft);

  const loadPrograms = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const { data, error } = await supabase
      .from("programs")
      .select("id, unit_id, code, name, description, syllabus, program_type, curriculum_model, delivery_mode, status, feature_flags, grading_rubric, teacher_user_id")
      .order("name");

    if (error) {
      setErrorMessage(error.message);
      setPrograms([]);
      setIsLoading(false);
      return;
    }

    const nextPrograms = (data ?? []) as TeacherProgram[];
    setPrograms(nextPrograms);
    const requestedProgram = programId ? nextPrograms.find((program) => program.id === programId) : null;
    const nextSelectedId = requestedProgram?.id ?? nextPrograms[0]?.id ?? null;
    setSelectedId(nextSelectedId);
    setDraft(nextPrograms.find((program) => program.id === nextSelectedId)?.syllabus ?? "");
    if (programId && !requestedProgram) setErrorMessage("Program tidak ditemukan atau tidak termasuk dalam penugasan Anda.");
    setIsLoading(false);
  }, [programId, user]);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  useEffect(() => {
    async function loadCurriculum() {
      if (!selectedId) {
        setMetrics(emptyMetrics);
        return;
      }
      setIsLoadingCurriculum(true);
      const { data: modules, error: moduleError } = await supabase
        .from("program_modules")
        .select("id")
        .eq("program_id", selectedId);
      if (moduleError) {
        setFeedback({ type: "error", message: `Ringkasan kurikulum gagal dimuat: ${moduleError.message}` });
        setIsLoadingCurriculum(false);
        return;
      }
      const moduleIds = (modules ?? []).map((module) => module.id);
      if (!moduleIds.length) {
        setMetrics(emptyMetrics);
        setIsLoadingCurriculum(false);
        return;
      }
      const { data: lessons, error: lessonError } = await supabase
        .from("lessons")
        .select("id, lesson_type, visibility_status")
        .in("module_id", moduleIds);
      if (lessonError) {
        setFeedback({ type: "error", message: `Ringkasan materi gagal dimuat: ${lessonError.message}` });
      }
      const rows = lessons ?? [];
      setMetrics({
        modules: moduleIds.length,
        lessons: rows.length,
        published: rows.filter((lesson) => lesson.visibility_status === "published").length,
        assessments: rows.filter((lesson) => ["quiz", "exam", "assignment"].includes(lesson.lesson_type)).length,
      });
      setIsLoadingCurriculum(false);
    }
    void loadCurriculum();
  }, [selectedId]);

  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges]);

  const filteredPrograms = useMemo(() => {
    const query = programQuery.trim().toLowerCase();
    if (!query) return programs;
    return programs.filter((program) => `${program.code} ${program.name} ${program.status}`.toLowerCase().includes(query));
  }, [programQuery, programs]);

  const readinessChecks = useMemo(() => [
    { label: "Ringkasan program", ready: Boolean(selectedProgram?.description?.trim()) },
    { label: "Silabus minimal 100 kata", ready: words >= 100 },
    { label: "Minimal 4 bagian silabus", ready: sections >= 4 },
    { label: "Struktur modul tersedia", ready: metrics.modules > 0 },
    { label: "Materi sudah diterbitkan", ready: metrics.published > 0 },
  ], [metrics.modules, metrics.published, sections, selectedProgram?.description, words]);
  const readiness = Math.round((readinessChecks.filter((item) => item.ready).length / readinessChecks.length) * 100);

  const selectProgram = (id: string) => {
    if (id === selectedId) return;
    if (hasChanges && !window.confirm("Perubahan silabus belum disimpan. Pindah program dan abaikan perubahan?")) return;
    const nextProgram = programs.find((program) => program.id === id);
    setSelectedId(id);
    setDraft(nextProgram?.syllabus ?? "");
    setFeedback(null);
    if (programId) navigate(`/teacher/kelas/program/${id}/silabus`, { replace: true });
  };

  const insertSection = (content: string) => {
    setDraft((current) => `${current.trim()}${current.trim() ? "\n\n" : ""}${content}`);
    setViewMode("editor");
    setFeedback(null);
  };

  const saveSyllabus = async () => {
    if (!selectedProgram) return;
    if (draft.trim().length < 40) {
      setFeedback({ type: "error", message: "Silabus terlalu singkat. Tambahkan tujuan, cakupan materi, metode, dan evaluasi." });
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    const normalized = draft.trim();
    const { data, error } = await supabase.rpc("update_teacher_program_syllabus", {
      target_program_id: selectedProgram.id,
      target_syllabus: normalized,
    });
    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      const migrationHint = error?.message.includes("update_teacher_program_syllabus") ? " Jalankan migration 202607170002_teacher_syllabus_workflow.sql." : "";
      setFeedback({ type: "error", message: `Silabus gagal disimpan: ${error?.message ?? "data tidak ditemukan"}.${migrationHint}` });
    } else {
      const updated = (Array.isArray(data) ? data[0] : data) as TeacherProgram;
      setPrograms((current) => current.map((program) => program.id === updated.id ? { ...program, syllabus: updated.syllabus } : program));
      setDraft(updated.syllabus ?? normalized);
      setFeedback({ type: "success", message: "Silabus berhasil disimpan dan langsung tersedia bagi peserta program." });
    }
    setIsSaving(false);
  };

  if (isLoading) return <FullPageLoader message="Memuat ruang kerja silabus..." />;

  return (
    <div className="page-stack pb-24">
      <section className="rounded-lg border bg-background p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><Badge variant="outline">{isMentor ? "SILABUS PENDAMPINGAN" : "SILABUS PENGAJARAN"}</Badge><h1 className="mt-3 text-2xl font-bold sm:text-3xl">{isMentor ? "Rencana Pendampingan Program" : "Rencana Pembelajaran Program"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{isMentor ? "Tinjau dan susun tujuan, capaian, materi, metode pendampingan, serta evaluasi peserta binaan." : "Susun tujuan, capaian, struktur materi, metode, dan evaluasi yang akan dibaca peserta."}</p></div>
          <Button variant="outline" onClick={() => void loadPrograms()}><RefreshCw className="h-4 w-4" /> Muat Ulang</Button>
        </div>
      </section>

      {errorMessage ? <Alert className="border-red-200 bg-red-50 text-red-900"><AlertCircle className="h-4 w-4" /><AlertTitle>{isMentor ? "Data pendampingan tidak dapat dimuat" : "Data pengajaran tidak dapat dimuat"}</AlertTitle><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
      {feedback ? <Alert className={feedback.type === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}>{feedback.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}<AlertDescription>{feedback.message}</AlertDescription></Alert> : null}

      {!programs.length ? (
        <Alert><BookOpen className="h-4 w-4" /><AlertTitle>Belum ada program yang diampu</AlertTitle><AlertDescription>Program akan tampil setelah Anda ditugaskan sebagai pengajar program, kelas, atau mentor.</AlertDescription></Alert>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={programQuery} onChange={(event) => setProgramQuery(event.target.value)} placeholder="Cari program..." className="pl-9" /></div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {filteredPrograms.map((program) => (
                <button key={program.id} type="button" onClick={() => selectProgram(program.id)} className={`w-full rounded-md border p-3 text-left transition-colors ${selectedId === program.id ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/50"}`}>
                  <div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold text-primary">{program.code}</span><Badge variant="outline" className="capitalize">{program.status}</Badge></div>
                  <p className="mt-2 text-sm font-semibold leading-5">{program.name}</p><p className="mt-1 text-xs text-muted-foreground">{program.syllabus?.trim() ? "Silabus tersedia" : "Belum ada silabus"}</p>
                </button>
              ))}
              {!filteredPrograms.length ? <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Program tidak ditemukan.</p> : null}
            </div>
          </aside>

          {selectedProgram ? (
            <main className="min-w-0 space-y-5">
              <div className="rounded-lg border bg-background p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{selectedProgram.code}</Badge><Badge variant="secondary" className="capitalize">{selectedProgram.curriculum_model}</Badge></div><h2 className="mt-3 text-xl font-bold">{selectedProgram.name}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedProgram.description || "Deskripsi program belum dilengkapi."}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link to={`/teacher/kelas/program/${selectedProgram.id}/kurikulum`}><Layers3 className="h-4 w-4" /> Kurikulum</Link></Button><Button variant="outline" asChild><Link to="/teacher/konten"><BookOpen className="h-4 w-4" /> Konten</Link></Button></div></div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Kesiapan</p><p className="mt-1 text-xl font-bold">{readiness}%</p><Progress value={readiness} className="mt-2 h-1.5" /></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Modul</p><p className="mt-1 text-xl font-bold">{isLoadingCurriculum ? "..." : metrics.modules}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Materi Terbit</p><p className="mt-1 text-xl font-bold">{isLoadingCurriculum ? "..." : `${metrics.published}/${metrics.lessons}`}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Asesmen</p><p className="mt-1 text-xl font-bold">{isLoadingCurriculum ? "..." : metrics.assessments}</p></div>
              </div>

              <Card>
                <CardHeader className="border-b"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-primary" /> Dokumen Silabus</CardTitle><CardDescription className="mt-1">Perubahan akan ditampilkan pada portal peserta setelah disimpan.</CardDescription></div><div className="flex rounded-md border bg-muted/30 p-1"><Button size="sm" variant={viewMode === "editor" ? "default" : "ghost"} onClick={() => setViewMode("editor")}><FileText className="h-4 w-4" /> Editor</Button><Button size="sm" variant={viewMode === "preview" ? "default" : "ghost"} onClick={() => setViewMode("preview")}><Eye className="h-4 w-4" /> Preview</Button></div></div></CardHeader>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted-foreground">Tambahkan:</span>{quickSections.map((section) => { const Icon = section.icon; return <Button key={section.label} variant="outline" size="sm" onClick={() => insertSection(section.content)}><Icon className="h-3.5 w-3.5" /> {section.label}</Button>; })}<Button variant="outline" size="sm" onClick={() => { if (!draft.trim() || window.confirm("Ganti isi editor dengan template lengkap?")) setDraft(syllabusTemplate); }}><FileText className="h-3.5 w-3.5" /> Template Lengkap</Button></div>
                  {viewMode === "editor" ? <div><textarea className="field-control min-h-[480px] resize-y font-mono text-sm leading-6" value={draft} onChange={(event) => { setDraft(event.target.value); setFeedback(null); }} placeholder="Tuliskan silabus atau gunakan template lengkap..." /><div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{words} kata · {sections} bagian</span><span>{draft.length.toLocaleString("id-ID")} karakter</span></div></div> : <article className="min-h-[480px] whitespace-pre-wrap rounded-md border bg-muted/10 p-5 text-sm leading-7">{draft.trim() || <span className="text-muted-foreground">Silabus belum memiliki isi.</span>}</article>}
                </CardContent>
              </Card>

              <div className="rounded-lg border bg-background p-4"><h3 className="font-semibold">Checklist Kesiapan</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{readinessChecks.map((item) => <div key={item.label} className="flex items-center gap-2 text-sm">{item.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}<span>{item.label}</span></div>)}</div></div>
            </main>
          ) : null}
        </div>
      )}

      {selectedProgram ? <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-lg backdrop-blur sm:left-auto sm:right-5 sm:bottom-5 sm:w-[540px] sm:rounded-lg sm:border"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm">{hasChanges ? <AlertCircle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}<div><p className="font-semibold">{hasChanges ? "Perubahan belum disimpan" : "Silabus tersinkron"}</p><p className="text-xs text-muted-foreground">{words < 100 ? "Disarankan minimal 100 kata." : "Dokumen cukup informatif."}</p></div></div><div className="flex gap-2">{hasChanges ? <Button variant="outline" onClick={() => setDraft(savedSyllabus)} disabled={isSaving}><RotateCcw className="h-4 w-4" /> Batalkan</Button> : null}<Button onClick={() => void saveSyllabus()} disabled={isSaving || !hasChanges}><Save className="h-4 w-4" /> {isSaving ? "Menyimpan..." : "Simpan"}</Button></div></div></div> : null}
    </div>
  );
}
