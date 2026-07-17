import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Save, Search, Target, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Input } from "@/components/ui/input";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import type { MentorEnrollment, MentorHalaqah } from "./mentorTypes";

type QuranSubmission = {
  id: string;
  halaqah_id: string;
  enrollment_id: string;
  assessment_date: string;
  submission_type: "hafalan" | "murajaah" | "tilawah";
  surah_name: string;
  ayah_from: number | null;
  ayah_to: number | null;
  fluency_score: number | null;
  tajwid_score: number | null;
  memorization_score: number | null;
  notes: string | null;
  next_target: string | null;
};

type SubmissionDraft = {
  enrollmentId: string;
  assessmentDate: string;
  submissionType: QuranSubmission["submission_type"];
  surahName: string;
  ayahFrom: string;
  ayahTo: string;
  fluencyScore: string;
  tajwidScore: string;
  memorizationScore: string;
  notes: string;
  nextTarget: string;
};

const pageSize = 10;
const today = () => new Date().toISOString().slice(0, 10);
const emptyDraft = (): SubmissionDraft => ({ enrollmentId: "", assessmentDate: today(), submissionType: "hafalan", surahName: "", ayahFrom: "", ayahTo: "", fluencyScore: "", tajwidScore: "", memorizationScore: "", notes: "", nextTarget: "" });

function nullableNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

export function MentorQuranPage() {
  const { user } = useAuthSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [halaqahs, setHalaqahs] = useState<MentorHalaqah[]>([]);
  const [enrollments, setEnrollments] = useState<MentorEnrollment[]>([]);
  const [submissions, setSubmissions] = useState<QuranSubmission[]>([]);
  const [draft, setDraft] = useState<SubmissionDraft>(emptyDraft);
  const [historyQuery, setHistoryQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selectedHalaqahId = searchParams.get("halaqah") || halaqahs[0]?.id || "";

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
      .eq("status", "active")
      .order("name");
    if (halaqahError) {
      setErrorMessage(halaqahError.message);
      setIsLoading(false);
      return;
    }
    const nextHalaqahs = (halaqahRows ?? []) as unknown as MentorHalaqah[];
    setHalaqahs(nextHalaqahs);
    const halaqahId = searchParams.get("halaqah") || nextHalaqahs[0]?.id;
    if (!halaqahId) {
      setIsLoading(false);
      return;
    }
    if (!searchParams.get("halaqah")) setSearchParams({ halaqah: halaqahId }, { replace: true });
    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id, halaqah_id, program_id, enrollment_number, enrollment_status, participants(id, display_name, global_participant_number, city)")
      .eq("halaqah_id", halaqahId)
      .eq("enrollment_status", "active")
      .order("created_at");
    if (enrollmentError) {
      setErrorMessage(`${enrollmentError.message}. Jalankan migration 202607170003_mentor_workspace.sql bila akses peserta belum tersedia.`);
      setIsLoading(false);
      return;
    }
    const nextEnrollments = (enrollmentRows ?? []) as unknown as MentorEnrollment[];
    setEnrollments(nextEnrollments);
    const requestedEnrollment = searchParams.get("enrollment");
    setDraft((current) => ({ ...current, enrollmentId: requestedEnrollment && nextEnrollments.some((item) => item.id === requestedEnrollment) ? requestedEnrollment : current.enrollmentId && nextEnrollments.some((item) => item.id === current.enrollmentId) ? current.enrollmentId : nextEnrollments[0]?.id ?? "" }));
    const { data: submissionRows, error: submissionError } = await supabase
      .from("quran_submissions")
      .select("id, halaqah_id, enrollment_id, assessment_date, submission_type, surah_name, ayah_from, ayah_to, fluency_score, tajwid_score, memorization_score, notes, next_target")
      .eq("halaqah_id", halaqahId)
      .order("assessment_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (submissionError) {
      setErrorMessage(`Riwayat setoran belum tersedia: ${submissionError.message}. Jalankan migration 202607170003_mentor_workspace.sql.`);
      setSubmissions([]);
    } else {
      setSubmissions((submissionRows ?? []) as QuranSubmission[]);
    }
    setIsLoading(false);
  }, [searchParams, setSearchParams, user]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { setPage(1); }, [historyQuery, selectedHalaqahId]);

  const participantByEnrollment = useMemo(() => new Map(enrollments.map((item) => [item.id, item.participants])), [enrollments]);
  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return submissions;
    return submissions.filter((item) => `${item.surah_name} ${item.submission_type} ${participantByEnrollment.get(item.enrollment_id)?.display_name ?? ""}`.toLowerCase().includes(query));
  }, [historyQuery, participantByEnrollment, submissions]);
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const pagedHistory = filteredHistory.slice((page - 1) * pageSize, page * pageSize);
  const todayCount = submissions.filter((item) => item.assessment_date === today()).length;
  const scoreValues = submissions.flatMap((item) => [item.fluency_score, item.tajwid_score, item.memorization_score]).filter((score): score is number => score != null);
  const averageScore = scoreValues.length ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length) : 0;

  const selectHalaqah = (id: string) => {
    setSearchParams({ halaqah: id });
    setDraft(emptyDraft());
    setFeedback(null);
  };

  const saveSubmission = async () => {
    if (!selectedHalaqahId || !draft.enrollmentId || !draft.surahName.trim()) {
      setFeedback({ type: "error", message: "Pilih peserta dan isi nama surat sebelum menyimpan." });
      return;
    }
    const ayahFrom = nullableNumber(draft.ayahFrom);
    const ayahTo = nullableNumber(draft.ayahTo);
    if (ayahFrom != null && ayahTo != null && ayahTo < ayahFrom) {
      setFeedback({ type: "error", message: "Ayat akhir tidak boleh lebih kecil dari ayat awal." });
      return;
    }
    const scores = [draft.fluencyScore, draft.tajwidScore, draft.memorizationScore].filter(Boolean).map(Number);
    if (scores.some((score) => score < 0 || score > 100)) {
      setFeedback({ type: "error", message: "Nilai kelancaran, tajwid, dan hafalan harus berada pada rentang 0-100." });
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    const { error } = await supabase.from("quran_submissions").insert({
      halaqah_id: selectedHalaqahId,
      enrollment_id: draft.enrollmentId,
      assessment_date: draft.assessmentDate,
      submission_type: draft.submissionType,
      surah_name: draft.surahName.trim(),
      ayah_from: ayahFrom,
      ayah_to: ayahTo,
      fluency_score: nullableNumber(draft.fluencyScore),
      tajwid_score: nullableNumber(draft.tajwidScore),
      memorization_score: nullableNumber(draft.memorizationScore),
      notes: draft.notes.trim() || null,
      next_target: draft.nextTarget.trim() || null,
      recorded_by: user?.id,
    });
    if (error) {
      setFeedback({ type: "error", message: `Setoran gagal disimpan: ${error.message}. Pastikan migration 202607170003_mentor_workspace.sql sudah dijalankan.` });
    } else {
      const enrollmentId = draft.enrollmentId;
      setDraft({ ...emptyDraft(), enrollmentId });
      await loadData();
      setFeedback({ type: "success", message: "Setoran berhasil dicatat dan riwayat peserta telah diperbarui." });
    }
    setIsSaving(false);
  };

  if (isLoading) return <FullPageLoader message="Memuat setoran Qur'an..." />;

  return (
    <div className="page-stack pb-12">
      <section className="rounded-lg border bg-background p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><Badge variant="outline">SETORAN QUR'AN</Badge><h1 className="mt-3 text-2xl font-bold sm:text-3xl">Catatan & Progres Setoran</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Catat capaian bacaan atau hafalan, berikan penilaian, dan tetapkan target berikutnya.</p></div><div className="flex gap-2"><Button variant="outline" asChild><Link to="/teacher/halaqah"><Users className="h-4 w-4" /> Halaqah</Link></Button><Button variant="outline" onClick={() => void loadData()}><RefreshCw className="h-4 w-4" /> Muat Ulang</Button></div></div></section>
      {errorMessage ? <Alert className="border-amber-200 bg-amber-50 text-amber-900"><AlertCircle className="h-4 w-4" /><AlertTitle>Perlu konfigurasi database</AlertTitle><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
      {feedback ? <Alert className={feedback.type === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}>{feedback.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}<AlertDescription>{feedback.message}</AlertDescription></Alert> : null}
      {!halaqahs.length ? <Alert><Users className="h-4 w-4" /><AlertTitle>Belum ada halaqah aktif</AlertTitle><AlertDescription>Form setoran akan aktif setelah Anda mendapatkan penugasan halaqah.</AlertDescription></Alert> : <>
        <div className="flex gap-2 overflow-x-auto pb-1">{halaqahs.map((item) => <button key={item.id} type="button" onClick={() => selectHalaqah(item.id)} className={`min-w-[210px] rounded-md border p-3 text-left ${selectedHalaqahId === item.id ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"}`}><span className="text-xs font-semibold text-primary">{item.code}</span><p className="mt-2 font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.classes?.programs?.name}</p></button>)}</div>
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Peserta Binaan</p><p className="mt-1 text-2xl font-bold">{enrollments.length}</p></div><div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Setoran Hari Ini</p><p className="mt-1 text-2xl font-bold">{todayCount}</p></div><div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Rata-rata Penilaian</p><p className="mt-1 text-2xl font-bold">{averageScore || "-"}</p></div></div>
        <Card><CardHeader className="border-b"><CardTitle className="flex items-center gap-2 text-lg"><BookOpen className="h-5 w-5 text-primary" /> Form Setoran</CardTitle></CardHeader><CardContent className="space-y-4 p-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="text-sm font-medium">Peserta<select className="field-control mt-2" value={draft.enrollmentId} onChange={(event) => setDraft((current) => ({ ...current, enrollmentId: event.target.value }))}><option value="">Pilih peserta</option>{enrollments.map((item) => <option key={item.id} value={item.id}>{item.participants?.display_name} · {item.participants?.global_participant_number}</option>)}</select></label><label className="text-sm font-medium">Tanggal<Input type="date" className="mt-2" value={draft.assessmentDate} onChange={(event) => setDraft((current) => ({ ...current, assessmentDate: event.target.value }))} /></label><label className="text-sm font-medium">Jenis Setoran<select className="field-control mt-2" value={draft.submissionType} onChange={(event) => setDraft((current) => ({ ...current, submissionType: event.target.value as QuranSubmission["submission_type"] }))}><option value="hafalan">Hafalan Baru</option><option value="murajaah">Murajaah</option><option value="tilawah">Tilawah</option></select></label><label className="text-sm font-medium">Surat<Input className="mt-2" value={draft.surahName} onChange={(event) => setDraft((current) => ({ ...current, surahName: event.target.value }))} placeholder="Contoh: Al-Baqarah" /></label></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><label className="text-sm font-medium">Ayat Awal<Input type="number" min="1" className="mt-2" value={draft.ayahFrom} onChange={(event) => setDraft((current) => ({ ...current, ayahFrom: event.target.value }))} /></label><label className="text-sm font-medium">Ayat Akhir<Input type="number" min="1" className="mt-2" value={draft.ayahTo} onChange={(event) => setDraft((current) => ({ ...current, ayahTo: event.target.value }))} /></label><label className="text-sm font-medium">Kelancaran<Input type="number" min="0" max="100" className="mt-2" value={draft.fluencyScore} onChange={(event) => setDraft((current) => ({ ...current, fluencyScore: event.target.value }))} placeholder="0-100" /></label><label className="text-sm font-medium">Tajwid<Input type="number" min="0" max="100" className="mt-2" value={draft.tajwidScore} onChange={(event) => setDraft((current) => ({ ...current, tajwidScore: event.target.value }))} placeholder="0-100" /></label><label className="text-sm font-medium">Hafalan<Input type="number" min="0" max="100" className="mt-2" value={draft.memorizationScore} onChange={(event) => setDraft((current) => ({ ...current, memorizationScore: event.target.value }))} placeholder="0-100" /></label></div><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Catatan<textarea className="field-control mt-2 min-h-24 resize-y" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Catatan koreksi dan apresiasi..." /></label><label className="text-sm font-medium">Target Berikutnya<textarea className="field-control mt-2 min-h-24 resize-y" value={draft.nextTarget} onChange={(event) => setDraft((current) => ({ ...current, nextTarget: event.target.value }))} placeholder="Surat, ayat, atau fokus perbaikan berikutnya..." /></label></div><div className="flex justify-end"><Button onClick={() => void saveSubmission()} disabled={isSaving || !enrollments.length}><Save className="h-4 w-4" /> {isSaving ? "Menyimpan..." : "Simpan Setoran"}</Button></div></CardContent></Card>
        <Card><CardHeader className="border-b"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-lg">Riwayat Setoran</CardTitle><p className="mt-1 text-sm text-muted-foreground">Riwayat terbaru seluruh peserta pada halaqah terpilih.</p></div><div className="relative sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Cari peserta atau surat..." className="pl-9" /></div></div></CardHeader><CardContent className="p-0">{!pagedHistory.length ? <div className="p-10 text-center text-sm text-muted-foreground">Belum ada riwayat setoran.</div> : <div className="divide-y">{pagedHistory.map((item) => { const participant = participantByEnrollment.get(item.enrollment_id); const scores = [item.fluency_score, item.tajwid_score, item.memorization_score].filter((score): score is number => score != null); const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null; return <div key={item.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(180px,1fr)_minmax(220px,1.2fr)_minmax(220px,1.3fr)_auto] lg:items-center"><div><p className="font-semibold">{participant?.display_name ?? "Peserta"}</p><p className="text-xs text-muted-foreground">{new Date(`${item.assessment_date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p></div><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="capitalize">{item.submission_type}</Badge><strong>{item.surah_name}</strong></div><p className="mt-1 text-xs text-muted-foreground">Ayat {item.ayah_from ?? "-"} sampai {item.ayah_to ?? "-"}</p></div><div><p className="text-sm"><Target className="mr-1 inline h-4 w-4 text-primary" /> {item.next_target || "Target berikutnya belum dicatat"}</p><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.notes || "Tidak ada catatan"}</p></div><Badge variant={average != null && average >= 75 ? "secondary" : "outline"}>{average != null ? `Nilai ${average}` : "Belum dinilai"}</Badge></div>; })}</div>}<div className="flex items-center justify-between border-t p-4"><p className="text-xs text-muted-foreground">{filteredHistory.length} catatan</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" /><span className="sr-only">Sebelumnya</span></Button><span className="min-w-16 text-center text-sm">{page}/{totalPages}</span><Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /><span className="sr-only">Berikutnya</span></Button></div></div></CardContent></Card>
      </>}
    </div>
  );
}
