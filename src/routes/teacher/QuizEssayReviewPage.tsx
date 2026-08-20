import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardCheck, Download, FileText, LoaderCircle, Save, UserCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { supabase } from "../../lib/supabase";
import { requestQuizAnswerDownloadUrl, type QuizAttemptAnswerFile } from "../../lib/quizAnswerFiles";

type AttemptRow = {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  attempt_number: number;
  status: string;
  score: number | null;
  grader_feedback: string | null;
  submitted_at: string | null;
};

type AnswerRow = {
  id: string;
  question_id: string;
  selected_option: string | null;
  essay_answer: string | null;
  points_earned: number;
  grader_feedback: string | null;
};

type QuestionRow = {
  id: string;
  question_type: "multiple_choice" | "essay";
  question_text: string;
  correct_answer: string | null;
  grading_guide: string | null;
  points: number;
  order_no: number;
};

type ReviewContext = {
  lessonTitle: string;
  programName: string;
  participantName: string;
  participantNumber: string | null;
};

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Terjadi kendala saat memuat penilaian.";
}

export function QuizEssayReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [answerFiles, setAnswerFiles] = useState<Record<string, QuizAttemptAnswerFile[]>>({});
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [context, setContext] = useState<ReviewContext | null>(null);
  const [grades, setGrades] = useState<Record<string, { points: string; feedback: string }>>({});
  const [overallFeedback, setOverallFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);

  const reviewHome = location.pathname.startsWith("/admin")
    ? "/admin/penilaian"
    : location.pathname.startsWith("/system") ? "/system/penilaian" : "/teacher/review";

  const loadReview = useCallback(async () => {
    if (!attemptId) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data: attemptRow, error: attemptError } = await supabase
        .from("quiz_attempts")
        .select("id, enrollment_id, lesson_id, attempt_number, status, score, grader_feedback, submitted_at")
        .eq("id", attemptId)
        .single();
      if (attemptError) throw attemptError;

      const [{ data: lessonRow, error: lessonError }, { data: enrollmentRow, error: enrollmentError }, { data: answerRows, error: answerError }, { data: fileRows, error: fileError }] = await Promise.all([
        supabase.from("lessons").select("id, title, module_id").eq("id", attemptRow.lesson_id).single(),
        supabase.from("enrollments").select("id, participant_id").eq("id", attemptRow.enrollment_id).single(),
        supabase.from("quiz_attempt_answers").select("id, question_id, selected_option, essay_answer, points_earned, grader_feedback").eq("quiz_attempt_id", attemptId),
        supabase.from("quiz_attempt_answer_files").select("id, quiz_attempt_id, question_id, display_name, mime_type, file_size_bytes, created_at").eq("quiz_attempt_id", attemptId).order("created_at"),
      ]);
      if (lessonError || enrollmentError || answerError || fileError) throw lessonError || enrollmentError || answerError || fileError;

      const questionIds = (answerRows ?? []).map(row => row.question_id);
      const [{ data: moduleRow, error: moduleError }, { data: participantRow, error: participantError }, questionResult] = await Promise.all([
        supabase.from("program_modules").select("id, program_id").eq("id", lessonRow.module_id).single(),
        supabase.from("participants").select("id, display_name, global_participant_number").eq("id", enrollmentRow.participant_id).single(),
        questionIds.length
          ? supabase.from("quiz_questions").select("id, question_type, question_text, correct_answer, grading_guide, points, order_no").in("id", questionIds).order("order_no")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (moduleError || participantError || questionResult.error) throw moduleError || participantError || questionResult.error;

      const { data: programRow, error: programError } = await supabase.from("programs").select("name").eq("id", moduleRow.program_id).single();
      if (programError) throw programError;

      const nextAnswers = (answerRows ?? []) as AnswerRow[];
      const nextAnswerFiles = (fileRows ?? []).reduce<Record<string, QuizAttemptAnswerFile[]>>((current, file) => {
        const questionFiles = current[file.question_id] ?? [];
        questionFiles.push(file as QuizAttemptAnswerFile);
        current[file.question_id] = questionFiles;
        return current;
      }, {});
      setAttempt(attemptRow as AttemptRow);
      setAnswers(nextAnswers);
      setAnswerFiles(nextAnswerFiles);
      setQuestions((questionResult.data ?? []) as QuestionRow[]);
      setContext({
        lessonTitle: lessonRow.title,
        programName: programRow.name,
        participantName: participantRow.display_name || "Peserta",
        participantNumber: participantRow.global_participant_number,
      });
      setGrades(Object.fromEntries(nextAnswers.map(answer => [answer.id, {
        points: String(answer.points_earned ?? 0),
        feedback: answer.grader_feedback ?? "",
      }])));
      setOverallFeedback(attemptRow.grader_feedback ?? "");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [attemptId]);

  useEffect(() => { void loadReview(); }, [loadReview]);

  const answerMap = useMemo(() => new Map(answers.map(answer => [answer.question_id, answer])), [answers]);
  const essayQuestions = questions.filter(question => question.question_type === "essay");
  const essayPoints = essayQuestions.reduce((sum, question) => {
    const answer = answerMap.get(question.id);
    return sum + Number(answer ? grades[answer.id]?.points || 0 : 0);
  }, 0);
  const essayMaxPoints = essayQuestions.reduce((sum, question) => sum + Number(question.points || 0), 0);

  const saveGrades = async () => {
    if (!attemptId) return;
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const payload = essayQuestions.map(question => {
        const answer = answerMap.get(question.id);
        const points = Number(answer ? grades[answer.id]?.points : Number.NaN);
        if (!answer || !Number.isFinite(points) || points < 0 || points > question.points) {
          throw new Error(`Nilai untuk soal "${question.question_text}" harus antara 0 dan ${question.points}.`);
        }
        return { answer_id: answer.id, points, feedback: grades[answer.id]?.feedback || "" };
      });

      const { data, error: gradeError } = await supabase.rpc("grade_quiz_attempt", {
        p_attempt_id: attemptId,
        p_grades: payload,
        p_feedback: overallFeedback || null,
      });
      if (gradeError) throw gradeError;
      setSuccess(`Penilaian berhasil disimpan. Nilai akhir peserta: ${Number(data).toLocaleString("id-ID")}.`);
      await loadReview();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const openAnswerFile = async (file: QuizAttemptAnswerFile) => {
    setOpeningFileId(file.id);
    try {
      const { signedUrl } = await requestQuizAnswerDownloadUrl(file.id);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (openError) {
      setError(errorMessage(openError));
    } finally {
      setOpeningFileId(null);
    }
  };

  if (isLoading) return <FullPageLoader message="Memuat jawaban ujian..." />;

  if (!attempt || !context) {
    return <Alert className="border-red-200 bg-red-50 text-red-900"><AlertCircle className="h-4 w-4" /><AlertTitle>Penilaian tidak tersedia</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  }

  return (
    <div className="page-stack pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost"><Link to={reviewHome}><ArrowLeft className="mr-2 h-4 w-4" />Antrean Penilaian</Link></Button>
        <Badge variant={attempt.status === "graded" ? "secondary" : "outline"}>{attempt.status === "graded" ? "Sudah Dinilai" : "Menunggu Penilaian"}</Badge>
      </div>

      <section className="page-hero">
        <Badge variant="secondary" className="mb-3 border-white/30 bg-white/20 text-white">PENILAIAN ESAI</Badge>
        <h1 className="text-3xl font-bold text-white">{context.lessonTitle}</h1>
        <p className="mt-2 text-white/80">{context.programName} · Percobaan {attempt.attempt_number}</p>
      </section>

      {error && <Alert className="border-red-200 bg-red-50 text-red-900"><AlertCircle className="h-4 w-4" /><AlertTitle>Penilaian belum tersimpan</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><CheckCircle2 className="h-4 w-4" /><AlertTitle>Berhasil</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}

      <Card>
        <CardContent className="grid gap-5 p-5 sm:grid-cols-3">
          <div className="flex items-center gap-3"><UserCheck className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Peserta</p><p className="font-semibold">{context.participantName}</p><p className="text-xs text-muted-foreground">{context.participantNumber || "-"}</p></div></div>
          <div><p className="text-xs text-muted-foreground">Poin esai sementara</p><p className="mt-1 text-2xl font-bold">{essayPoints} / {essayMaxPoints}</p></div>
          <div><p className="text-xs text-muted-foreground">Nilai akhir</p><p className="mt-1 text-2xl font-bold">{attempt.score ?? "Belum final"}</p></div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {questions.map((question, index) => {
          const answer = answerMap.get(question.id);
          if (!answer) return null;
          const isEssay = question.question_type === "essay";
          const files = answerFiles[question.id] ?? [];
          return (
            <Card key={question.id} className={isEssay ? "border-amber-200" : "border-border/60"}>
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Soal {index + 1}</CardTitle>
                  <div className="flex gap-2"><Badge variant="outline">{isEssay ? "Esai" : "Pilihan Ganda"}</Badge><Badge variant="secondary">Maks. {question.points} poin</Badge></div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{question.question_text}</p>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div><p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Jawaban Peserta</p><div className="rounded-lg border bg-background p-4 text-sm whitespace-pre-wrap">{answer.essay_answer || answer.selected_option || (files.length > 0 ? "Peserta mengirim jawaban dalam lampiran." : "Tidak dijawab")}</div></div>
                {isEssay && files.length > 0 && <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-sky-950"><FileText className="h-4 w-4" /> Lampiran jawaban ({files.length})</p><div className="mt-3 flex flex-wrap gap-2">{files.map(file => <Button key={file.id} type="button" size="sm" variant="outline" className="bg-white" onClick={() => void openAnswerFile(file)} disabled={openingFileId === file.id}>{openingFileId === file.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{file.display_name}</Button>)}</div></div>}
                {isEssay ? <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Panduan penilaian</p><p className="mt-1 whitespace-pre-wrap">{question.grading_guide || "Belum ada panduan khusus."}</p></div>
                  <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                    <div><label className="mb-1 block text-sm font-semibold">Poin</label><Input type="number" min={0} max={question.points} step="0.01" value={grades[answer.id]?.points ?? ""} onChange={event => setGrades(current => ({ ...current, [answer.id]: { ...current[answer.id], points: event.target.value } }))} /></div>
                    <div><label className="mb-1 block text-sm font-semibold">Umpan Balik</label><textarea className="field-control min-h-[88px]" placeholder="Berikan arahan yang jelas dan membangun..." value={grades[answer.id]?.feedback ?? ""} onChange={event => setGrades(current => ({ ...current, [answer.id]: { ...current[answer.id], feedback: event.target.value } }))} /></div>
                  </div>
                </> : <div className={`rounded-lg border p-3 text-sm ${answer.selected_option === question.correct_answer ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}><span className="font-semibold">Kunci:</span> {question.correct_answer || "-"} · <span className="font-semibold">Poin otomatis:</span> {answer.points_earned}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Catatan Akhir</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <textarea className="field-control min-h-[120px]" placeholder="Ringkasan capaian dan saran untuk peserta..." value={overallFeedback} onChange={event => setOverallFeedback(event.target.value)} />
          <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => navigate(reviewHome)}>Batal</Button><Button disabled={isSaving || essayQuestions.length === 0} onClick={() => void saveGrades()}><Save className="mr-2 h-4 w-4" />{isSaving ? "Menyimpan..." : "Simpan Nilai Final"}</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
