import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileQuestion,
  Filter,
  GraduationCap,
  RefreshCw,
  Search,
  UserCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Input } from "@/components/ui/input";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";

type TeacherProgram = {
  id: string;
  name: string;
  code: string | null;
};

type TeacherModule = {
  id: string;
  program_id: string;
  title: string;
  code: string | null;
};

type TeacherLesson = {
  id: string;
  module_id: string;
  title: string;
  code: string | null;
  lesson_type: string;
  passing_grade: number | null;
};

type EnrollmentRow = {
  id: string;
  participant_id: string;
  program_id: string;
  enrollment_number: string | null;
};

type ParticipantRow = {
  id: string;
  display_name: string | null;
  global_participant_number: string | null;
};

type QuizAttemptRow = {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  attempt_number: number;
  score: number | null;
  status: "ongoing" | "submitted" | "abandoned";
  submitted_at: string | null;
  started_at: string;
};

type LessonProgressRow = {
  id: string;
  enrollment_id: string;
  participant_id: string;
  lesson_id: string;
  status: "started" | "completed";
  score: number | null;
  completed_at: string | null;
  started_at: string;
};

type ReviewItem = {
  id: string;
  source: "quiz_attempt" | "assignment_progress";
  lesson: TeacherLesson | null;
  module: TeacherModule | null;
  program: TeacherProgram | null;
  enrollment: EnrollmentRow | null;
  participant: ParticipantRow | null;
  score: number | null;
  submittedAt: string | null;
  status: "pending_review" | "passed" | "needs_attention";
  attemptNumber?: number;
};

type ReviewFilter = "all" | "pending_review" | "needs_attention" | "quiz" | "assignment";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function lessonTypeLabel(type: string) {
  const labels: Record<string, string> = {
    quiz: "Kuis",
    exam: "Ujian",
    assignment: "Tugas",
  };
  return labels[type] ?? type;
}

function reviewBadge(status: ReviewItem["status"]) {
  if (status === "passed") {
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Tuntas</Badge>;
  }
  if (status === "needs_attention") {
    return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Perlu Perhatian</Badge>;
  }
  return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Perlu Review</Badge>;
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) return "Terjadi kendala saat memuat data review.";
  return String((error as { message?: string }).message ?? "Terjadi kendala saat memuat data review.");
}

export function TeacherReviewPage() {
  const { user } = useAuthSession();
  const [programs, setPrograms] = useState<TeacherProgram[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");

  const loadReviewData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { data: programRows, error: programError } = await supabase
      .from("programs")
      .select("id, name, code")
      .eq("teacher_user_id", user.id)
      .order("name");

    if (programError) {
      setErrorMessage(programError.message);
      setIsLoading(false);
      return;
    }

    const nextPrograms = (programRows ?? []) as TeacherProgram[];
    setPrograms(nextPrograms);

    const programIds = nextPrograms.map((program) => program.id);
    if (programIds.length === 0) {
      setReviewItems([]);
      setIsLoading(false);
      return;
    }

    const { data: moduleRows, error: moduleError } = await supabase
      .from("program_modules")
      .select("id, program_id, title, code")
      .in("program_id", programIds);

    if (moduleError) {
      setErrorMessage(moduleError.message);
      setIsLoading(false);
      return;
    }

    const nextModules = (moduleRows ?? []) as TeacherModule[];
    const moduleIds = nextModules.map((module) => module.id);
    if (moduleIds.length === 0) {
      setReviewItems([]);
      setIsLoading(false);
      return;
    }

    const { data: lessonRows, error: lessonError } = await supabase
      .from("lessons")
      .select("id, module_id, title, code, lesson_type, passing_grade")
      .in("module_id", moduleIds)
      .in("lesson_type", ["quiz", "exam", "assignment"]);

    if (lessonError) {
      setErrorMessage(lessonError.message);
      setIsLoading(false);
      return;
    }

    const nextLessons = (lessonRows ?? []) as TeacherLesson[];
    const lessonIds = nextLessons.map((lesson) => lesson.id);
    if (lessonIds.length === 0) {
      setReviewItems([]);
      setIsLoading(false);
      return;
    }

    const [attemptRes, progressRes] = await Promise.all([
      supabase
        .from("quiz_attempts")
        .select("id, enrollment_id, lesson_id, attempt_number, score, status, submitted_at, started_at")
        .in("lesson_id", lessonIds)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false }),
      supabase
        .from("lesson_progresses")
        .select("id, enrollment_id, participant_id, lesson_id, status, score, completed_at, started_at")
        .in("lesson_id", lessonIds)
        .eq("status", "completed")
        .order("completed_at", { ascending: false }),
    ]);

    if (attemptRes.error || progressRes.error) {
      setErrorMessage(getErrorMessage(attemptRes.error ?? progressRes.error));
      setIsLoading(false);
      return;
    }

    const attemptRows = (attemptRes.data ?? []) as QuizAttemptRow[];
    const progressRows = (progressRes.data ?? []) as LessonProgressRow[];
    const enrollmentIds = Array.from(new Set([...attemptRows.map((row) => row.enrollment_id), ...progressRows.map((row) => row.enrollment_id)]));

    let enrollmentRows: EnrollmentRow[] = [];
    let participantRows: ParticipantRow[] = [];
    if (enrollmentIds.length > 0) {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, participant_id, program_id, enrollment_number")
        .in("id", enrollmentIds);

      enrollmentRows = (enrollments ?? []) as EnrollmentRow[];
      const participantIds = Array.from(new Set(enrollmentRows.map((enrollment) => enrollment.participant_id)));
      if (participantIds.length > 0) {
        const { data: participants } = await supabase
          .from("participants")
          .select("id, display_name, global_participant_number")
          .in("id", participantIds);
        participantRows = (participants ?? []) as ParticipantRow[];
      }
    }

    const programMap = new Map(nextPrograms.map((program) => [program.id, program]));
    const moduleMap = new Map(nextModules.map((module) => [module.id, module]));
    const lessonMap = new Map(nextLessons.map((lesson) => [lesson.id, lesson]));
    const enrollmentMap = new Map(enrollmentRows.map((enrollment) => [enrollment.id, enrollment]));
    const participantMap = new Map(participantRows.map((participant) => [participant.id, participant]));

    const attemptItems = attemptRows.map((attempt): ReviewItem => {
      const lesson = lessonMap.get(attempt.lesson_id) ?? null;
      const module = lesson ? moduleMap.get(lesson.module_id) ?? null : null;
      const enrollment = enrollmentMap.get(attempt.enrollment_id) ?? null;
      const participant = enrollment ? participantMap.get(enrollment.participant_id) ?? null : null;
      const passingGrade = lesson?.passing_grade ?? 70;
      const status: ReviewItem["status"] =
        attempt.score === null ? "pending_review" : attempt.score >= passingGrade ? "passed" : "needs_attention";

      return {
        id: attempt.id,
        source: "quiz_attempt",
        lesson,
        module,
        program: module ? programMap.get(module.program_id) ?? null : null,
        enrollment,
        participant,
        score: attempt.score,
        submittedAt: attempt.submitted_at ?? attempt.started_at,
        status,
        attemptNumber: attempt.attempt_number,
      };
    });

    const assignmentItems = progressRows
      .filter((progress) => lessonMap.get(progress.lesson_id)?.lesson_type === "assignment")
      .map((progress): ReviewItem => {
        const lesson = lessonMap.get(progress.lesson_id) ?? null;
        const module = lesson ? moduleMap.get(lesson.module_id) ?? null : null;
        const enrollment = enrollmentMap.get(progress.enrollment_id) ?? null;
        const participant = participantMap.get(progress.participant_id) ?? (enrollment ? participantMap.get(enrollment.participant_id) ?? null : null);
        return {
          id: progress.id,
          source: "assignment_progress",
          lesson,
          module,
          program: module ? programMap.get(module.program_id) ?? null : null,
          enrollment,
          participant,
          score: progress.score,
          submittedAt: progress.completed_at ?? progress.started_at,
          status: progress.score === null ? "pending_review" : progress.score >= 70 ? "passed" : "needs_attention",
        };
      });

    setReviewItems([...attemptItems, ...assignmentItems].sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime()));
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void loadReviewData();
  }, [loadReviewData]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return reviewItems.filter((item) => {
      const matchesSearch =
        !query ||
        (item.participant?.display_name ?? "").toLowerCase().includes(query) ||
        (item.participant?.global_participant_number ?? "").toLowerCase().includes(query) ||
        (item.lesson?.title ?? "").toLowerCase().includes(query) ||
        (item.program?.name ?? "").toLowerCase().includes(query);
      const matchesFilter =
        filter === "all" ||
        item.status === filter ||
        (filter === "quiz" && ["quiz", "exam"].includes(item.lesson?.lesson_type ?? "")) ||
        (filter === "assignment" && item.lesson?.lesson_type === "assignment");
      return matchesSearch && matchesFilter;
    });
  }, [filter, reviewItems, searchQuery]);

  const pendingCount = reviewItems.filter((item) => item.status === "pending_review").length;
  const attentionCount = reviewItems.filter((item) => item.status === "needs_attention").length;
  const scoredItems = reviewItems.filter((item) => typeof item.score === "number");
  const averageScore = scoredItems.length ? Math.round(scoredItems.reduce((sum, item) => sum + Number(item.score), 0) / scoredItems.length) : 0;

  if (isLoading) return <FullPageLoader message="Memuat antrean review..." />;

  return (
    <div className="page-stack pb-12">
      <section className="page-hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3 border-white/30 bg-white/20 text-white">TUGAS & REVIEW</Badge>
            <h1 className="text-3xl font-bold text-white">Antrean Penilaian</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
              Pantau hasil kuis, ujian, dan tugas peserta dari program yang Anda ampu.
            </p>
          </div>
          <Button type="button" variant="secondary" className="bg-white !text-primary hover:bg-white/90" onClick={() => void loadReviewData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Muat Ulang
          </Button>
        </div>
      </section>

      {errorMessage && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Review belum bisa dimuat</AlertTitle>
          <AlertDescription>
            {errorMessage}. Jika ini terkait permission, jalankan migrasi 202607140007_teacher_learning_review_rls.sql.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Item Review", value: reviewItems.length, desc: "Kuis, ujian, dan tugas terkumpul.", icon: ClipboardCheck, tone: "bg-sky-50 text-sky-700 border-sky-200" },
          { label: "Perlu Review", value: pendingCount, desc: "Belum memiliki skor final.", icon: FileQuestion, tone: "bg-amber-50 text-amber-700 border-amber-200" },
          { label: "Perlu Perhatian", value: attentionCount, desc: "Skor di bawah batas lulus.", icon: AlertCircle, tone: "bg-red-50 text-red-700 border-red-200" },
          { label: "Rata-rata Skor", value: averageScore, desc: "Dari item yang sudah memiliki skor.", icon: BarChart3, tone: "bg-primary/10 text-primary border-primary/20" },
        ].map((item) => (
          <Card key={item.label} className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{item.value.toLocaleString("id-ID")}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
                <div className={cn("rounded-xl border p-2", item.tone)}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Daftar Review Peserta</CardTitle>
            <CardDescription>Cari peserta, filter status, dan buka materi untuk tindak lanjut.</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari peserta, materi, program..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-background px-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select className="h-10 bg-transparent text-sm outline-none" value={filter} onChange={(event) => setFilter(event.target.value as ReviewFilter)}>
                <option value="all">Semua</option>
                <option value="pending_review">Perlu Review</option>
                <option value="needs_attention">Perlu Perhatian</option>
                <option value="quiz">Kuis/Ujian</option>
                <option value="assignment">Tugas</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Belum ada program diampu</p>
              <p className="mt-1 text-sm text-muted-foreground">Hubungi admin untuk penugasan program atau kelas.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary/70" />
              <p className="mt-3 font-medium">Antrean review kosong</p>
              <p className="mt-1 text-sm text-muted-foreground">Tidak ada item yang cocok dengan filter saat ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Peserta</th>
                    <th className="px-4 py-3 font-semibold">Materi</th>
                    <th className="px-4 py-3 font-semibold">Program</th>
                    <th className="px-4 py-3 font-semibold">Skor</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.map((item) => (
                    <tr key={`${item.source}-${item.id}`} className="hover:bg-muted/30">
                      <td className="min-w-56 px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <UserCheck className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{item.participant?.display_name ?? "Peserta"}</p>
                            <p className="text-xs text-muted-foreground">{item.participant?.global_participant_number ?? item.enrollment?.enrollment_number ?? "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="min-w-60 px-4 py-4">
                        <p className="font-medium text-foreground">{item.lesson?.title ?? "-"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {lessonTypeLabel(item.lesson?.lesson_type ?? "")}
                          {item.attemptNumber ? ` - Percobaan ${item.attemptNumber}` : ""}
                        </p>
                      </td>
                      <td className="min-w-52 px-4 py-4">
                        <p className="font-medium text-foreground">{item.program?.name ?? "-"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.module?.title ?? "-"} - {formatDate(item.submittedAt)}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-semibold">
                        {item.score === null ? "-" : item.score.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-4">{reviewBadge(item.status)}</td>
                      <td className="px-4 py-4 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/teacher/kelas/program/${item.program?.id}/peserta`}>
                            Buka Peserta
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Workflow Review</CardTitle>
          <CardDescription>Gunakan alur ini untuk menjaga tindak lanjut akademik tetap rapi.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          {[
            { title: "1. Cek Antrean", desc: "Filter item yang belum punya skor atau perlu perhatian.", icon: ClipboardCheck },
            { title: "2. Buka Peserta", desc: "Lihat konteks peserta, program, dan transkrip bila perlu.", icon: UserCheck },
            { title: "3. Beri Tindak Lanjut", desc: "Catat arahan remedial, pengulangan, atau penguatan materi.", icon: FileQuestion },
            { title: "4. Pantau Tren", desc: "Gunakan rata-rata skor untuk mengevaluasi materi dan soal.", icon: BarChart3 },
          ].map((step) => (
            <div key={step.title} className="rounded-lg border border-border/60 p-4">
              <step.icon className="h-5 w-5 text-primary" />
              <p className="mt-2 font-semibold text-foreground">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
