import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  ListTree,
  Printer,
  Search,
  Target,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuthSession } from "../../app/providers/authSessionContext";
import type { Lesson, ProgramModule } from "../../lib/academic";
import type { Enrollment } from "../../lib/enrollment";
import type { Program } from "../../lib/organization";
import { supabase } from "../../lib/supabase";
import { LearnerProgramNav } from "./LearnerProgramNav";

type SyllabusSection = {
  id: string;
  title: string;
  content: string;
};

type LessonProgressRow = {
  lesson_id: string;
  status: "started" | "completed";
};

function slugify(value: string, index: number) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return slug || `bagian-${index + 1}`;
}

function parseSyllabus(value: string | null | undefined): SyllabusSection[] {
  const lines = (value ?? "").split(/\r?\n/);
  const sections: SyllabusSection[] = [];
  let title = "Gambaran Umum";
  let body: string[] = [];

  const pushSection = () => {
    const content = body.join("\n").trim();
    if (content || sections.length === 0) {
      sections.push({ id: slugify(title, sections.length), title, content });
    }
    body = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading = trimmed.length >= 4 && trimmed.length <= 80 && /^[A-Z0-9][A-Z0-9\s/&().,-]+$/.test(trimmed);
    if (isHeading) {
      if (body.some((item) => item.trim()) || sections.length > 0) pushSection();
      title = trimmed.replace(/\s+/g, " ");
    } else {
      body.push(line);
    }
  }
  pushSection();

  return sections.filter((section) => section.content || section.title !== "Gambaran Umum");
}

export function LearnerProgramSyllabusPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const [program, setProgram] = useState<Program | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [modules, setModules] = useState<ProgramModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progressRows, setProgressRows] = useState<LessonProgressRow[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSyllabus() {
      if (!user || !programId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (participantError || !participant) {
        setErrorMessage(participantError?.message ?? "Akun belum terhubung dengan data peserta.");
        setIsLoading(false);
        return;
      }

      let enrollmentResult = await supabase
        .from("enrollments")
        .select("id, participant_id, program_id, batch_id, class_id, halaqah_id, enrollment_number, enrollment_status, payment_status, programs(id, unit_id, code, name, description, syllabus, program_type, curriculum_model, delivery_mode, status, feature_flags, grading_rubric, graduation_settings)")
        .eq("participant_id", participant.id)
        .eq("program_id", programId)
        .eq("enrollment_status", "active")
        .maybeSingle();

      if (enrollmentResult.error?.message.includes("graduation_settings")) {
        enrollmentResult = await supabase
          .from("enrollments")
          .select("id, participant_id, program_id, batch_id, class_id, halaqah_id, enrollment_number, enrollment_status, payment_status, programs(id, unit_id, code, name, description, syllabus, program_type, curriculum_model, delivery_mode, status, feature_flags, grading_rubric)")
          .eq("participant_id", participant.id)
          .eq("program_id", programId)
          .eq("enrollment_status", "active")
          .maybeSingle();
      }

      const { data: enrollmentRow, error: enrollmentError } = enrollmentResult;

      if (enrollmentError || !enrollmentRow) {
        setErrorMessage(enrollmentError?.message ?? "Anda belum terdaftar aktif pada program ini.");
        setIsLoading(false);
        return;
      }

      const activeEnrollment = enrollmentRow as unknown as Enrollment;
      const enrolledProgram = enrollmentRow.programs as unknown as Program | null;
      setEnrollment(activeEnrollment);
      setProgram(enrolledProgram);

      const { data: moduleRows, error: moduleError } = await supabase
        .from("program_modules")
        .select("id, program_id, parent_module_id, level_id, code, title, module_type, order_no, is_required, levels(name, code)")
        .eq("program_id", programId)
        .order("order_no");

      if (moduleError) {
        setErrorMessage(moduleError.message);
        setIsLoading(false);
        return;
      }

      const nextModules = (moduleRows ?? []) as unknown as ProgramModule[];
      setModules(nextModules);
      const moduleIds = nextModules.map((module) => module.id);
      if (moduleIds.length > 0) {
        const [lessonResult, progressResult] = await Promise.all([
          supabase
            .from("lessons")
            .select("id, module_id, code, title, lesson_type, order_no, release_at, due_at, visibility_status, duration_minutes")
            .in("module_id", moduleIds)
            .eq("visibility_status", "published")
            .or(`release_at.lte.${new Date().toISOString()},release_at.is.null`)
            .order("order_no"),
          supabase
            .from("lesson_progresses")
            .select("lesson_id, status")
            .eq("enrollment_id", activeEnrollment.id),
        ]);

        if (lessonResult.error) setErrorMessage(lessonResult.error.message);
        setLessons((lessonResult.data ?? []) as Lesson[]);
        setProgressRows((progressResult.data ?? []) as LessonProgressRow[]);
      }

      setIsLoading(false);
    }

    void loadSyllabus();
  }, [programId, user]);

  const sections = useMemo(() => parseSyllabus(program?.syllabus), [program?.syllabus]);
  const visibleSections = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return sections;
    return sections.filter((section) => `${section.title} ${section.content}`.toLowerCase().includes(keyword));
  }, [query, sections]);
  const completedIds = useMemo(() => {
    const publishedIds = new Set(lessons.map((lesson) => lesson.id));
    return new Set(progressRows.filter((row) => row.status === "completed" && publishedIds.has(row.lesson_id)).map((row) => row.lesson_id));
  }, [lessons, progressRows]);
  const completion = lessons.length ? Math.round((completedIds.size / lessons.length) * 100) : 0;
  const duration = lessons.reduce((total, lesson) => total + (lesson.duration_minutes ?? 0), 0);
  const graduation = program?.graduation_settings;

  if (isLoading) return <FullPageLoader message="Memuat silabus program..." />;

  if (errorMessage || !program || !enrollment || !programId) {
    return (
      <div className="page-stack mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/learner/program-saya")} className="w-fit">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Program Saya
        </Button>
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>Silabus tidak dapat dimuat</AlertTitle>
          <AlertDescription>{errorMessage ?? "Data program tidak ditemukan."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-stack w-full print:bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" asChild>
          <Link to="/learner/program-saya"><ArrowLeft className="h-4 w-4" /> Program Saya</Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Cetak Silabus
        </Button>
      </div>

      <section className="rounded-lg border bg-background p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <Badge variant="outline">{program.code}</Badge>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{program.name}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{program.description || "Dokumen akademik, struktur pembelajaran, dan ketentuan kelulusan program."}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center lg:min-w-[360px]">
            <div className="rounded-md border p-3"><p className="text-xl font-bold">{modules.length}</p><p className="text-xs text-muted-foreground">Modul</p></div>
            <div className="rounded-md border p-3"><p className="text-xl font-bold">{lessons.length}</p><p className="text-xs text-muted-foreground">Materi</p></div>
            <div className="rounded-md border p-3"><p className="text-xl font-bold">{duration || "-"}</p><p className="text-xs text-muted-foreground">Menit</p></div>
          </div>
        </div>
      </section>

      <div className="print:hidden"><LearnerProgramNav programId={programId} enrollmentId={enrollment.id} /></div>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4 print:hidden">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Daftar Isi</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {sections.length ? sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="block rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">{section.title}</a>
              )) : <p className="text-sm text-muted-foreground">Belum ada bagian silabus.</p>}
              <a href="#struktur-kurikulum" className="block rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Struktur Kurikulum</a>
              <a href="#kelulusan" className="block rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Kriteria Kelulusan</a>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-sm"><span>Progres Anda</span><strong>{completion}%</strong></div>
              <Progress value={completion} className="h-2" />
              <p className="text-xs text-muted-foreground">{completedIds.size} dari {lessons.length} materi selesai</p>
              <Button asChild className="w-full"><Link to={`/learner/program/${programId}`}>Lanjut Belajar</Link></Button>
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 space-y-6">
          {sections.length ? (
            <>
              <div className="relative print:hidden">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari tujuan, materi, metode, atau ketentuan..." className="pl-9" />
              </div>
              {visibleSections.length ? visibleSections.map((section, index) => (
                <Card key={section.id} id={section.id} className="scroll-mt-24 break-inside-avoid">
                  <CardHeader className="border-b bg-muted/20">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">{index + 1}</span>
                      <CardTitle className="pt-1 text-lg capitalize">{section.title.toLowerCase()}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="whitespace-pre-wrap p-5 text-sm leading-7 sm:p-6">{section.content}</CardContent>
                </Card>
              )) : (
                <Alert><Search className="h-4 w-4" /><AlertTitle>Bagian tidak ditemukan</AlertTitle><AlertDescription>Coba gunakan kata kunci lain atau hapus pencarian.</AlertDescription></Alert>
              )}
            </>
          ) : (
            <Alert><FileText className="h-4 w-4" /><AlertTitle>Silabus naratif belum diterbitkan</AlertTitle><AlertDescription>Struktur modul tetap dapat dipelajari di bawah ini. Silabus lengkap akan muncul setelah diperbarui pengelola program.</AlertDescription></Alert>
          )}

          <Card id="struktur-kurikulum" className="scroll-mt-24 break-inside-avoid">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ListTree className="h-5 w-5 text-primary" /> Struktur Kurikulum</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {modules.length ? modules.map((module, index) => {
                const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);
                const done = moduleLessons.filter((lesson) => completedIds.has(lesson.id)).length;
                return (
                  <div key={module.id} className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold">{index + 1}</span>
                      <div className="min-w-0"><p className="font-semibold">{module.code} - {module.title}</p><p className="text-xs text-muted-foreground">{module.levels?.name ?? "Tahap umum"} · {moduleLessons.length} materi</p></div>
                    </div>
                    <Badge variant={done === moduleLessons.length && moduleLessons.length ? "secondary" : "outline"}>{done}/{moduleLessons.length} selesai</Badge>
                  </div>
                );
              }) : <p className="text-sm text-muted-foreground">Struktur modul belum tersedia.</p>}
            </CardContent>
          </Card>

          <Card id="kelulusan" className="scroll-mt-24 break-inside-avoid">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><GraduationCap className="h-5 w-5 text-primary" /> Kriteria Kelulusan</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-md border p-4"><Target className="h-5 w-5 text-primary" /><div><p className="font-semibold">Nilai akhir minimum</p><p className="text-sm text-muted-foreground">{graduation?.minimum_final_score ?? 70} dari 100</p></div></div>
              <div className="flex gap-3 rounded-md border p-4"><CheckCircle2 className="h-5 w-5 text-primary" /><div><p className="font-semibold">Penyelesaian materi</p><p className="text-sm text-muted-foreground">Minimal {graduation?.minimum_completion_percent ?? 100}%</p></div></div>
              <div className="flex gap-3 rounded-md border p-4"><BookOpen className="h-5 w-5 text-primary" /><div><p className="font-semibold">Asesmen wajib</p><p className="text-sm text-muted-foreground">{graduation?.require_all_assessments_passed === false ? "Mengikuti ketentuan pengajar" : "Semua asesmen wajib lulus"}</p></div></div>
              <div className="flex gap-3 rounded-md border p-4"><Clock3 className="h-5 w-5 text-primary" /><div><p className="font-semibold">Administrasi</p><p className="text-sm text-muted-foreground">{graduation?.require_payment_clearance ? "Pembayaran harus dinyatakan lunas" : "Tidak menjadi syarat kelulusan"}</p></div></div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
