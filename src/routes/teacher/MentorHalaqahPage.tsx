import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  RefreshCw,
  Search,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import type { MentorEnrollment, MentorHalaqah, MentorProgress } from "./mentorTypes";

type ParticipantFilter = "all" | "not_started" | "in_progress" | "completed";

const pageSize = 10;

export function MentorHalaqahPage() {
  const { user } = useAuthSession();
  const [halaqahs, setHalaqahs] = useState<MentorHalaqah[]>([]);
  const [enrollments, setEnrollments] = useState<MentorEnrollment[]>([]);
  const [progressRows, setProgressRows] = useState<MentorProgress[]>([]);
  const [lessonTotals, setLessonTotals] = useState<Record<string, number>>({});
  const [selectedHalaqahId, setSelectedHalaqahId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ParticipantFilter>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    const { data: halaqahRows, error: halaqahError } = await supabase
      .from("halaqahs")
      .select("id, code, name, capacity, status, classes(id, code, name, program_id, programs(id, code, name, syllabus))")
      .eq("mentor_user_id", user.id)
      .order("name");

    if (halaqahError) {
      setErrorMessage(halaqahError.message);
      setIsLoading(false);
      return;
    }

    const nextHalaqahs = (halaqahRows ?? []) as unknown as MentorHalaqah[];
    setHalaqahs(nextHalaqahs);
    setSelectedHalaqahId((current) => current && nextHalaqahs.some((item) => item.id === current) ? current : nextHalaqahs[0]?.id ?? null);
    const halaqahIds = nextHalaqahs.map((item) => item.id);
    if (!halaqahIds.length) {
      setEnrollments([]);
      setProgressRows([]);
      setLessonTotals({});
      setIsLoading(false);
      return;
    }

    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id, halaqah_id, program_id, enrollment_number, enrollment_status, participants(id, display_name, global_participant_number, city)")
      .in("halaqah_id", halaqahIds)
      .eq("enrollment_status", "active")
      .order("created_at");

    if (enrollmentError) {
      const hint = enrollmentError.message.includes("row-level security") ? " Jalankan migration 202607170003_mentor_workspace.sql." : "";
      setErrorMessage(`${enrollmentError.message}.${hint}`);
      setIsLoading(false);
      return;
    }

    const nextEnrollments = (enrollmentRows ?? []) as unknown as MentorEnrollment[];
    setEnrollments(nextEnrollments);
    const enrollmentIds = nextEnrollments.map((item) => item.id);
    if (enrollmentIds.length) {
      const { data: progress } = await supabase
        .from("lesson_progresses")
        .select("enrollment_id, lesson_id, status")
        .in("enrollment_id", enrollmentIds);
      setProgressRows((progress ?? []) as MentorProgress[]);
    }

    const programIds = Array.from(new Set(nextHalaqahs.map((item) => item.classes?.program_id).filter((id): id is string => Boolean(id))));
    if (programIds.length) {
      const { data: moduleRows } = await supabase.from("program_modules").select("id, program_id").in("program_id", programIds);
      const moduleIds = (moduleRows ?? []).map((module) => module.id);
      if (moduleIds.length) {
        const { data: lessonRows } = await supabase.from("lessons").select("id, module_id").in("module_id", moduleIds).eq("visibility_status", "published");
        const moduleProgram = new Map((moduleRows ?? []).map((module) => [module.id, module.program_id]));
        const totals: Record<string, number> = {};
        for (const lesson of lessonRows ?? []) {
          const program = moduleProgram.get(lesson.module_id);
          if (program) totals[program] = (totals[program] ?? 0) + 1;
        }
        setLessonTotals(totals);
      }
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { setPage(1); }, [filter, searchQuery, selectedHalaqahId]);

  const selectedHalaqah = halaqahs.find((item) => item.id === selectedHalaqahId) ?? null;
  const progressByEnrollment = useMemo(() => {
    const map = new Map<string, { started: number; completed: number }>();
    for (const row of progressRows) {
      const current = map.get(row.enrollment_id) ?? { started: 0, completed: 0 };
      if (row.status === "completed") current.completed += 1;
      else current.started += 1;
      map.set(row.enrollment_id, current);
    }
    return map;
  }, [progressRows]);

  const participantRows = useMemo(() => enrollments
    .filter((item) => item.halaqah_id === selectedHalaqahId)
    .map((item) => {
      const progress = progressByEnrollment.get(item.id) ?? { started: 0, completed: 0 };
      const total = lessonTotals[item.program_id] ?? 0;
      const percent = total ? Math.min(100, Math.round((progress.completed / total) * 100)) : 0;
      const learningStatus: Exclude<ParticipantFilter, "all"> = percent === 100 && total > 0 ? "completed" : progress.started + progress.completed > 0 ? "in_progress" : "not_started";
      return { ...item, completedLessons: progress.completed, totalLessons: total, percent, learningStatus };
    }), [enrollments, lessonTotals, progressByEnrollment, selectedHalaqahId]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return participantRows.filter((row) => {
      const participant = row.participants;
      const matchesSearch = !query || `${participant?.display_name} ${participant?.global_participant_number} ${row.enrollment_number}`.toLowerCase().includes(query);
      return matchesSearch && (filter === "all" || row.learningStatus === filter);
    });
  }, [filter, participantRows, searchQuery]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const averageProgress = participantRows.length ? Math.round(participantRows.reduce((sum, row) => sum + row.percent, 0) / participantRows.length) : 0;

  if (isLoading) return <FullPageLoader message="Memuat halaqah dan peserta binaan..." />;

  return (
    <div className="page-stack pb-12">
      <section className="rounded-lg border bg-background p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><Badge variant="outline">PENDAMPINGAN MUSYRIF</Badge><h1 className="mt-3 text-2xl font-bold sm:text-3xl">Halaqah & Peserta Binaan</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Pantau kelompok, progres pembelajaran, silabus, penilaian, dan tindak lanjut peserta.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void loadData()}><RefreshCw className="h-4 w-4" /> Muat Ulang</Button><Button asChild><Link to="/teacher/quran"><BookOpen className="h-4 w-4" /> Catat Setoran</Link></Button></div></div>
      </section>

      {errorMessage ? <Alert className="border-red-200 bg-red-50 text-red-900"><AlertCircle className="h-4 w-4" /><AlertTitle>Data halaqah tidak dapat dimuat</AlertTitle><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
      {!halaqahs.length ? <Alert><Users className="h-4 w-4" /><AlertTitle>Belum ada halaqah yang ditugaskan</AlertTitle><AlertDescription>Hubungi admin akademik untuk menetapkan Anda sebagai musyrif pada halaqah aktif.</AlertDescription></Alert> : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex gap-2 overflow-x-auto pb-1">{halaqahs.map((item) => <button key={item.id} type="button" onClick={() => setSelectedHalaqahId(item.id)} className={`min-w-[210px] rounded-md border p-3 text-left ${item.id === selectedHalaqahId ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-primary">{item.code}</span><Badge variant="outline">{enrollments.filter((row) => row.halaqah_id === item.id).length} peserta</Badge></div><p className="mt-2 font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.classes?.name ?? "Kelas belum tersedia"}</p></button>)}</div>
            {selectedHalaqah?.classes?.program_id ? <div className="flex gap-2"><Button variant="outline" asChild><Link to={`/teacher/kelas/program/${selectedHalaqah.classes.program_id}/silabus`}><FileText className="h-4 w-4" /> Silabus</Link></Button><Button variant="outline" asChild><Link to="/teacher/review"><ClipboardCheck className="h-4 w-4" /> Review</Link></Button></div> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border bg-background p-4"><p className="text-xs text-muted-foreground">Peserta Binaan</p><p className="mt-1 text-2xl font-bold">{participantRows.length}</p><p className="text-xs text-muted-foreground">Kapasitas {selectedHalaqah?.capacity ?? "tidak dibatasi"}</p></div>
            <div className="rounded-md border bg-background p-4"><p className="text-xs text-muted-foreground">Rata-rata Progres</p><p className="mt-1 text-2xl font-bold">{averageProgress}%</p><Progress value={averageProgress} className="mt-2 h-1.5" /></div>
            <div className="rounded-md border bg-background p-4"><p className="text-xs text-muted-foreground">Aktif Belajar</p><p className="mt-1 text-2xl font-bold">{participantRows.filter((row) => row.learningStatus === "in_progress").length}</p></div>
            <div className="rounded-md border bg-background p-4"><p className="text-xs text-muted-foreground">Belum Mulai</p><p className="mt-1 text-2xl font-bold">{participantRows.filter((row) => row.learningStatus === "not_started").length}</p></div>
          </div>

          <Card>
            <CardHeader className="border-b"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><CardTitle className="text-lg">Direktori Peserta Binaan</CardTitle><p className="mt-1 text-sm text-muted-foreground">Cari peserta, pantau progres, lalu buka setoran atau penilaian.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative min-w-[260px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari nama, NIS, atau enrollment..." className="pl-9" /></div><select className="field-control h-10 sm:w-[180px]" value={filter} onChange={(event) => setFilter(event.target.value as ParticipantFilter)}><option value="all">Semua status</option><option value="not_started">Belum mulai</option><option value="in_progress">Sedang belajar</option><option value="completed">Selesai</option></select></div></div></CardHeader>
            <CardContent className="p-0">
              {!pagedRows.length ? <div className="p-10 text-center text-sm text-muted-foreground">Tidak ada peserta yang sesuai dengan filter.</div> : <div className="divide-y">{pagedRows.map((row) => { const participant = row.participants; return <div key={row.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_auto] lg:items-center"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{participant?.display_name?.charAt(0).toUpperCase() ?? "P"}</span><div className="min-w-0"><p className="truncate font-semibold">{participant?.display_name ?? "Peserta"}</p><p className="text-xs text-muted-foreground">{participant?.global_participant_number} · {row.enrollment_number}</p></div></div><div><div className="flex items-center justify-between text-xs"><span>Progres materi</span><strong>{row.percent}%</strong></div><Progress value={row.percent} className="mt-2 h-1.5" /><p className="mt-1 text-xs text-muted-foreground">{row.completedLessons}/{row.totalLessons} materi selesai</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><Link to={`/teacher/quran?halaqah=${row.halaqah_id}&enrollment=${row.id}`}><BookOpen className="h-4 w-4" /> Setoran</Link></Button><Button variant="outline" size="sm" asChild><Link to="/teacher/review"><UserRoundCheck className="h-4 w-4" /> Review</Link></Button></div></div>; })}</div>}
              <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Menampilkan {filteredRows.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, filteredRows.length)} dari {filteredRows.length} peserta</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" /><span className="sr-only">Halaman sebelumnya</span></Button><span className="min-w-20 text-center text-sm">{page} / {totalPages}</span><Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /><span className="sr-only">Halaman berikutnya</span></Button></div></div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
