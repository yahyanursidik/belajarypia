import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Progress } from "@/components/ui/progress";
import { useAuthSession } from "../../app/providers/authSessionContext";
import type { Lesson, ProgramModule } from "../../lib/academic";
import type { Enrollment } from "../../lib/enrollment";
import type { Program } from "../../lib/organization";
import { supabase } from "../../lib/supabase";
import { LearnerProgramNav } from "./LearnerProgramNav";
import { SyahadahSection } from "./SyahadahSection";

type LessonProgressRow = {
  lesson_id: string;
  status: "started" | "completed";
  score: number | null;
};

function lessonIcon(type: string, isCompleted: boolean) {
  if (isCompleted) return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (type === "video") return <PlayCircle className="h-4 w-4 text-primary" />;
  if (type === "quiz" || type === "exam") return <CheckCircle2 className="h-4 w-4 text-amber-600" />;
  return <FileText className="h-4 w-4 text-primary" />;
}

export function LearnerProgramDetailPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const [program, setProgram] = useState<Program | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [modules, setModules] = useState<ProgramModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progressRows, setProgressRows] = useState<LessonProgressRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadProgram() {
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
      setEnrollment(activeEnrollment);
      setProgram(enrollmentRow.programs as unknown as Program | null);

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
            .select("id, module_id, code, title, lesson_type, order_no, release_at, due_at, visibility_status, duration_minutes, passing_grade")
            .in("module_id", moduleIds)
            .eq("visibility_status", "published")
            .or(`release_at.lte.${new Date().toISOString()},release_at.is.null`)
            .order("order_no"),
          supabase
            .from("lesson_progresses")
            .select("lesson_id, status, score")
            .eq("enrollment_id", activeEnrollment.id),
        ]);

        if (lessonResult.error) {
          setErrorMessage(lessonResult.error.message);
        } else {
          const nextLessons = (lessonResult.data ?? []) as Lesson[];
          setLessons(nextLessons);
          const firstIncompleteModule = nextModules.find((module) => nextLessons.some((lesson) => lesson.module_id === module.id));
          if (firstIncompleteModule) setExpandedModules({ [firstIncompleteModule.id]: true });
        }
        setProgressRows((progressResult.data ?? []) as LessonProgressRow[]);
      }

      setIsLoading(false);
    }

    void loadProgram();
  }, [programId, user]);

  const progressByLesson = useMemo(() => new Map(progressRows.map((row) => [row.lesson_id, row])), [progressRows]);
  const completedCount = progressRows.filter((row) => row.status === "completed" && lessons.some((lesson) => lesson.id === row.lesson_id)).length;
  const completion = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;
  const nextLesson = lessons.find((lesson) => progressByLesson.get(lesson.id)?.status !== "completed") ?? lessons[0];
  const duration = lessons.reduce((total, lesson) => total + (lesson.duration_minutes ?? 0), 0);

  const toggleModule = (id: string) => setExpandedModules((current) => ({ ...current, [id]: !current[id] }));
  const expandAll = () => setExpandedModules(Object.fromEntries(modules.map((module) => [module.id, true])));

  if (isLoading) return <FullPageLoader message="Memuat materi dan progres..." />;

  if (errorMessage || !program || !enrollment || !programId) {
    return (
      <div className="page-stack mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/learner/program-saya")} className="w-fit">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Program Saya
        </Button>
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>Program tidak dapat dimuat</AlertTitle>
          <AlertDescription>{errorMessage ?? "Data program tidak ditemukan."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-stack w-full">
      <Button variant="ghost" asChild className="w-fit">
        <Link to="/learner/program-saya"><ArrowLeft className="h-4 w-4" /> Program Saya</Link>
      </Button>

      <section className="rounded-lg border bg-background p-5 sm:p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <Badge variant="outline">{program.code}</Badge>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{program.name}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{program.description || "Lanjutkan pembelajaran sesuai urutan modul yang tersedia."}</p>
          </div>
          <div className="w-full rounded-lg border bg-muted/20 p-4 xl:max-w-md">
            <div className="flex items-center justify-between"><span className="text-sm font-medium">Progres program</span><strong>{completion}%</strong></div>
            <Progress value={completion} className="mt-3 h-2.5" />
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{completedCount} dari {lessons.length} materi selesai</span><span>{duration ? `${duration} menit materi` : `${modules.length} modul`}</span></div>
            {nextLesson ? (
              <Button asChild className="mt-4 w-full">
                <Link to={`/learner/lesson/${nextLesson.id}`}>{completion ? "Lanjutkan Belajar" : "Mulai Belajar"}<ChevronRight className="h-4 w-4" /></Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <LearnerProgramNav programId={programId} enrollmentId={enrollment.id} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-4"><p className="text-xs font-semibold text-muted-foreground">Modul</p><p className="mt-1 text-2xl font-bold">{modules.length}</p></div>
        <div className="rounded-lg border bg-background p-4"><p className="text-xs font-semibold text-muted-foreground">Materi Terbit</p><p className="mt-1 text-2xl font-bold">{lessons.length}</p></div>
        <div className="rounded-lg border bg-background p-4"><p className="text-xs font-semibold text-muted-foreground">Status Belajar</p><p className="mt-1 text-base font-bold">{completion === 100 ? "Semua selesai" : completion > 0 ? "Sedang berjalan" : "Belum dimulai"}</p></div>
      </div>

      <section aria-labelledby="curriculum-heading">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 id="curriculum-heading" className="text-xl font-bold">Materi Pembelajaran</h2><p className="text-sm text-muted-foreground">Buka modul dan lanjutkan materi sesuai progres Anda.</p></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>Buka Semua</Button>
            <Button variant="outline" size="sm" onClick={() => setExpandedModules({})}>Tutup Semua</Button>
          </div>
        </div>

        <div className="space-y-3">
          {modules.length === 0 ? (
            <Alert><BookOpen className="h-4 w-4" /><AlertTitle>Materi belum tersedia</AlertTitle><AlertDescription>Pengelola program belum menerbitkan modul pembelajaran.</AlertDescription></Alert>
          ) : modules.map((module) => {
            const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);
            const moduleCompleted = moduleLessons.filter((lesson) => progressByLesson.get(lesson.id)?.status === "completed").length;
            const isExpanded = Boolean(expandedModules[module.id]);
            return (
              <Card key={module.id} className="overflow-hidden">
                <button type="button" onClick={() => toggleModule(module.id)} aria-expanded={isExpanded} className="flex w-full items-center justify-between gap-4 bg-muted/20 p-4 text-left transition-colors hover:bg-muted/40">
                  <div className="flex min-w-0 items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-5 w-5 shrink-0 text-primary" /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0"><h3 className="font-semibold">{module.code} - {module.title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{module.levels?.name ?? "Tahap umum"} · {moduleCompleted}/{moduleLessons.length} selesai</p></div>
                  </div>
                  <Badge variant={moduleCompleted === moduleLessons.length && moduleLessons.length ? "secondary" : "outline"} className="shrink-0">{moduleLessons.length} materi</Badge>
                </button>

                {isExpanded ? (
                  <CardContent className="p-0">
                    {moduleLessons.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Belum ada materi yang diterbitkan pada modul ini.</p> : (
                      <ol className="divide-y">
                        {moduleLessons.map((lesson, index) => {
                          const progress = progressByLesson.get(lesson.id);
                          const isCompleted = progress?.status === "completed";
                          return (
                            <li key={lesson.id}>
                              <Link to={`/learner/lesson/${lesson.id}`} className="group flex items-center gap-3 p-4 transition-colors hover:bg-primary/5">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">{lessonIcon(lesson.lesson_type, isCompleted)}</span>
                                <div className="min-w-0 flex-1"><p className="font-medium group-hover:text-primary">{index + 1}. {lesson.title}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="capitalize">{lesson.lesson_type.replaceAll("_", " ")}</span>{lesson.duration_minutes ? <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {lesson.duration_minutes} menit</span> : null}{progress?.score != null ? <span>Nilai {Number(progress.score).toLocaleString("id-ID")}</span> : null}</div></div>
                                <Badge variant={isCompleted ? "secondary" : "outline"} className="hidden shrink-0 sm:inline-flex">{isCompleted ? "Selesai" : progress ? "Dilanjutkan" : "Belum mulai"}</Badge>
                                {progress && !isCompleted ? <RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                              </Link>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-t pt-6">
        <h2 className="text-lg font-semibold">Sertifikat / Syahadah</h2>
        <p className="mb-4 text-sm text-muted-foreground">Status penerbitan dokumen kelulusan untuk program ini.</p>
        <SyahadahSection enrollmentId={enrollment.id} />
      </section>
    </div>
  );
}
