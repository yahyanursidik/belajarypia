import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  Filter,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
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
  status: string | null;
};

type TeacherModule = {
  id: string;
  program_id: string;
  code: string | null;
  title: string;
};

type TeacherLesson = {
  id: string;
  module_id: string;
  code: string | null;
  title: string;
  lesson_type: string;
  visibility_status: "draft" | "published" | "locked" | "archived";
  release_at: string | null;
  due_at: string | null;
  order_no: number;
};

type ContentRow = TeacherLesson & {
  program: TeacherProgram | null;
  module: TeacherModule | null;
  documentCount: number;
  questionCount: number;
};

type ContentFilter = "all" | "published" | "draft" | "locked" | "assessment";

function visibilityBadge(status: TeacherLesson["visibility_status"]) {
  if (status === "published") {
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Published</Badge>;
  }
  if (status === "draft") {
    return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Draft</Badge>;
  }
  if (status === "locked") {
    return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Locked</Badge>;
  }
  return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Archived</Badge>;
}

function lessonTypeLabel(type: string) {
  const labels: Record<string, string> = {
    content: "Materi",
    video: "Video",
    quiz: "Kuis",
    exam: "Ujian",
    assignment: "Tugas",
  };
  return labels[type] ?? type;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function TeacherContentPage() {
  const { user, primaryRole } = useAuthSession();
  const isMentor = primaryRole === "mentor";
  const [programs, setPrograms] = useState<TeacherProgram[]>([]);
  const [lessons, setLessons] = useState<ContentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ContentFilter>("all");

  const loadContent = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { data: programRows, error: programError } = await supabase
      .from("programs")
      .select("id, name, code, status")
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
      setLessons([]);
      setIsLoading(false);
      return;
    }

    const { data: moduleRows, error: moduleError } = await supabase
      .from("program_modules")
      .select("id, program_id, code, title")
      .in("program_id", programIds)
      .order("order_no", { ascending: true });

    if (moduleError) {
      setErrorMessage(moduleError.message);
      setIsLoading(false);
      return;
    }

    const nextModules = (moduleRows ?? []) as TeacherModule[];

    const moduleIds = nextModules.map((module) => module.id);
    if (moduleIds.length === 0) {
      setLessons([]);
      setIsLoading(false);
      return;
    }

    const lessonRes = await supabase
      .from("lessons")
      .select("id, module_id, code, title, lesson_type, visibility_status, release_at, due_at, order_no")
      .in("module_id", moduleIds)
      .order("order_no", { ascending: true });

    if (lessonRes.error) {
      setErrorMessage(lessonRes.error.message);
      setIsLoading(false);
      return;
    }

    const lessonRows = (lessonRes.data ?? []) as TeacherLesson[];
    const lessonIds = lessonRows.map((lesson) => lesson.id);

    let documentRows: Array<{ id: string; lesson_id: string }> = [];
    let questionRows: Array<{ id: string; lesson_id: string }> = [];
    if (lessonIds.length > 0) {
      const [documents, questions] = await Promise.all([
        supabase.from("document_files").select("id, lesson_id").in("lesson_id", lessonIds),
        supabase.from("quiz_questions").select("id, lesson_id").in("lesson_id", lessonIds),
      ]);
      documentRows = (documents.data ?? []) as Array<{ id: string; lesson_id: string }>;
      questionRows = (questions.data ?? []) as Array<{ id: string; lesson_id: string }>;
    }

    const programMap = new Map(nextPrograms.map((program) => [program.id, program]));
    const moduleMap = new Map(nextModules.map((module) => [module.id, module]));
    const documentCountByLesson = documentRows.reduce<Record<string, number>>((acc, document) => {
      acc[document.lesson_id] = (acc[document.lesson_id] ?? 0) + 1;
      return acc;
    }, {});
    const questionCountByLesson = questionRows.reduce<Record<string, number>>((acc, question) => {
      acc[question.lesson_id] = (acc[question.lesson_id] ?? 0) + 1;
      return acc;
    }, {});

    setLessons(
      lessonRows.map((lesson) => {
        const module = moduleMap.get(lesson.module_id) ?? null;
        return {
          ...lesson,
          module,
          program: module ? programMap.get(module.program_id) ?? null : null,
          documentCount: documentCountByLesson[lesson.id] ?? 0,
          questionCount: questionCountByLesson[lesson.id] ?? 0,
        };
      }),
    );
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const filteredLessons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return lessons.filter((lesson) => {
      const matchesSearch =
        !query ||
        lesson.title.toLowerCase().includes(query) ||
        (lesson.code ?? "").toLowerCase().includes(query) ||
        (lesson.program?.name ?? "").toLowerCase().includes(query) ||
        (lesson.module?.title ?? "").toLowerCase().includes(query);
      const matchesFilter =
        filter === "all" ||
        lesson.visibility_status === filter ||
        (filter === "assessment" && ["quiz", "exam", "assignment"].includes(lesson.lesson_type));
      return matchesSearch && matchesFilter;
    });
  }, [filter, lessons, searchQuery]);

  const publishedCount = lessons.filter((lesson) => lesson.visibility_status === "published").length;
  const draftCount = lessons.filter((lesson) => lesson.visibility_status === "draft").length;
  const assessmentCount = lessons.filter((lesson) => ["quiz", "exam", "assignment"].includes(lesson.lesson_type)).length;

  if (isLoading) return <FullPageLoader message={isMentor ? "Memuat konten pendampingan..." : "Memuat konten pengajar..."} />;

  return (
    <div className="page-stack pb-12">
      <section className="page-hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3 border-white/30 bg-white/20 text-white">{isMentor ? "KONTEN PENDAMPINGAN" : "KONTEN PENGAJAR"}</Badge>
            <h1 className="text-3xl font-bold text-white">Materi, Kuis & Ujian</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
              Pantau kesiapan materi, dokumen, bank soal, jadwal rilis, dan status publikasi dari program yang Anda ampu.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="bg-white !text-primary hover:bg-white/90" onClick={() => void loadContent()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Muat Ulang
            </Button>
            <Button asChild variant="secondary" className="bg-white/15 text-white hover:bg-white/25">
              <Link to="/teacher/kelas">
                <Plus className="mr-2 h-4 w-4" />
                Kelola Program
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {errorMessage && (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Gagal memuat konten</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Program Diampu", value: programs.length, desc: isMentor ? "Program dari halaqah yang dibina." : "Program dengan penugasan pengajar.", icon: BookOpen, tone: "bg-sky-50 text-sky-700 border-sky-200" },
          { label: "Materi Published", value: publishedCount, desc: "Materi yang sudah bisa diakses peserta.", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { label: "Draft", value: draftCount, desc: "Materi yang perlu dirapikan sebelum rilis.", icon: FileText, tone: "bg-amber-50 text-amber-700 border-amber-200" },
          { label: "Kuis/Ujian/Tugas", value: assessmentCount, desc: "Aktivitas evaluasi belajar.", icon: ClipboardList, tone: "bg-primary/10 text-primary border-primary/20" },
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
            <CardTitle>Inventaris Konten</CardTitle>
            <CardDescription>Cari materi, cek status publikasi, dan buka builder program untuk penyuntingan.</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari materi, modul, program..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-background px-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select className="h-10 bg-transparent text-sm outline-none" value={filter} onChange={(event) => setFilter(event.target.value as ContentFilter)}>
                <option value="all">Semua</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="locked">Locked</option>
                <option value="assessment">Evaluasi</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Belum ada program diampu</p>
              <p className="mt-1 text-sm text-muted-foreground">Hubungi admin untuk penugasan program atau kelas.</p>
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Konten tidak ditemukan</p>
              <p className="mt-1 text-sm text-muted-foreground">Ubah pencarian atau filter konten.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Materi</th>
                    <th className="px-4 py-3 font-semibold">Program/Modul</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Aset</th>
                    <th className="px-4 py-3 font-semibold">Jadwal</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLessons.map((lesson) => (
                    <tr key={lesson.id} className="hover:bg-muted/30">
                      <td className="min-w-64 px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                            {lesson.visibility_status === "locked" ? <Lock className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{lesson.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{lesson.code || "Tanpa kode"} - {lessonTypeLabel(lesson.lesson_type)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="min-w-56 px-4 py-4">
                        <p className="font-medium text-foreground">{lesson.program?.name ?? "-"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{lesson.module?.code ?? ""} {lesson.module?.title ?? "-"}</p>
                      </td>
                      <td className="px-4 py-4">{visibilityBadge(lesson.visibility_status)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                        <p>{lesson.documentCount} dokumen</p>
                        <p className="text-xs">{lesson.questionCount} soal</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                        <p>Rilis: {formatDate(lesson.release_at)}</p>
                        <p className="text-xs">Deadline: {formatDate(lesson.due_at)}</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/teacher/kelas/program/${lesson.program?.id}/kurikulum`}>
                            Buka Builder
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
          <CardTitle>Workflow Konten</CardTitle>
          <CardDescription>Urutan kerja yang disarankan sebelum materi dipakai peserta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          {[
            { title: "1. Susun Modul", desc: "Pastikan level, modul, dan urutan materi sudah rapi.", icon: Layers },
            { title: "2. Lengkapi Aset", desc: "Tambahkan dokumen, video, link, atau instruksi tugas.", icon: FileText },
            { title: "3. Siapkan Evaluasi", desc: "Cek jumlah soal, passing grade, dan batas percobaan.", icon: ClipboardList },
            { title: "4. Publish", desc: "Rilis materi setelah jadwal, prasyarat, dan preview siap.", icon: CheckCircle2 },
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
