import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "../../components/admin/PageHeader";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog } from "../../components/ui/dialog";
import { WizardSteps } from "../../components/ui/wizard-steps";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import {
  requestQuizAnswerDownloadUrl,
  type QuizAttemptAnswerFile,
} from "../../lib/quizAnswerFiles";
import {
  assessmentDirectory,
  finiteScore,
  reviewGradePayload,
  reviewScorePreview,
  type AssessmentEnrollment,
  type AssessmentLesson,
  type GradeDraft,
  type ReviewAnswer,
  type ReviewQuestion,
} from "../../lib/assessmentWorkspace";
import { formatRegistrationDateTime } from "../../lib/admission";
type Attempt = {
  id: string;
  lesson_id: string;
  enrollment_id: string;
  status: string;
  score: number | null;
  grader_feedback: string | null;
  attempt_number: number;
  submitted_at: string | null;
  updated_at: string;
  lessons: AssessmentLesson;
  enrollments: AssessmentEnrollment;
};
export function QuizEssayReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuthSession();
  const location = useLocation();
  const [params] = useSearchParams();
  const root = location.pathname.startsWith("/system")
    ? "/system"
    : location.pathname.startsWith("/admin")
      ? "/admin"
      : "/teacher";
  const home = root === "/teacher" ? "/teacher/review" : `${root}/penilaian`;
  const returnTo = assessmentDirectory(home, params.get("returnTo"));
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [answers, setAnswers] = useState<ReviewAnswer[]>([]);
  const [files, setFiles] = useState<QuizAttemptAnswerFile[]>([]);
  const [grades, setGrades] = useState<GradeDraft>({});
  const [feedback, setFeedback] = useState("");
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [retry, setRetry] = useState(0);
  const [openingFile, setOpeningFile] = useState("");
  const key = `ypia:review-draft:${user?.id ?? "unknown"}:${attemptId}`;
  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setLoadError("");
    setError("");
    setAttempt(null);
    setNotice("");
    void (async () => {
      try {
        const [attemptResult, answerResult, fileResult] = await Promise.all([
          supabase
            .from("quiz_attempts")
            .select(
              "*,lessons!inner(id,title,module_id,lesson_type,passing_grade,program_modules!inner(id,title,program_id,programs!inner(id,name,code))),enrollments!inner(id,participant_id,program_id,enrollment_number,participants!inner(id,display_name,global_participant_number))",
            )
            .eq("id", attemptId)
            .abortSignal(request.signal)
            .single(),
          supabase
            .from("quiz_attempt_answers")
            .select(
              "id,question_id,selected_option,essay_answer,points_earned,grader_feedback,graded_at",
              { count: "exact" },
            )
            .eq("quiz_attempt_id", attemptId)
            .abortSignal(request.signal),
          supabase
            .from("quiz_attempt_answer_files")
            .select(
              "id,quiz_attempt_id,question_id,display_name,mime_type,file_size_bytes,created_at",
              { count: "exact" },
            )
            .eq("quiz_attempt_id", attemptId)
            .order("created_at")
            .abortSignal(request.signal),
        ]);
        if (request.signal.aborted) return;
        if (attemptResult.error || answerResult.error || fileResult.error)
          throw new Error();
        const current = attemptResult.data as Attempt;
        const nextAnswers = (answerResult.data ?? []) as ReviewAnswer[];
        if (
          answerResult.count !== null &&
          answerResult.count !== nextAnswers.length
        )
          throw new Error("Jawaban belum lengkap dimuat.");
        if (
          fileResult.count !== null &&
          fileResult.count !== (fileResult.data ?? []).length
        )
          throw new Error("Lampiran belum lengkap dimuat.");
        if (!nextAnswers.length)
          throw new Error("Percobaan ini belum memiliki jawaban.");
        const questionResult = await supabase
          .from("quiz_questions")
          .select(
            "id,lesson_id,question_type,question_text,correct_answer,grading_guide,points,order_no",
          )
          .in(
            "id",
            nextAnswers.map((answer) => answer.question_id),
          )
          .eq("lesson_id", current.lesson_id)
          .order("order_no")
          .order("id")
          .abortSignal(request.signal);
        if (request.signal.aborted) return;
        const nextQuestions = (questionResult.data ?? []) as ReviewQuestion[];
        if (
          questionResult.error ||
          nextQuestions.length !== nextAnswers.length ||
          nextQuestions.some(
            (question) =>
              !Number.isFinite(Number(question.points)) ||
              Number(question.points) <= 0,
          )
        )
          throw new Error(
            "Data soal atau bobot belum lengkap. Periksa materi ujian di Program.",
          );
        if (
          current.enrollments.program_id !==
          current.lessons.program_modules.program_id
        )
          throw new Error("Program dan enrollment ujian tidak sesuai.");
        const nextGrades: GradeDraft = Object.fromEntries(
          nextAnswers.map((answer) => [
            answer.id,
            {
              points:
                answer.graded_at || current.status === "graded"
                  ? String(answer.points_earned ?? 0)
                  : "",
              feedback: answer.grader_feedback ?? "",
            },
          ]),
        );
        const serverFeedback = current.grader_feedback ?? "";
        setBaseline(
          JSON.stringify({ grades: nextGrades, feedback: serverFeedback }),
        );
        let saved: { grades: GradeDraft; feedback: string } | null = null;
        if (current.status !== "graded") {
          try {
            const cache = JSON.parse(sessionStorage.getItem(key) || "null");
            if (
              cache &&
              typeof cache.feedback === "string" &&
              cache.grades &&
              Object.values(cache.grades).every(
                (value) =>
                  value &&
                  typeof (value as { points?: unknown }).points === "string" &&
                  typeof (value as { feedback?: unknown }).feedback ===
                    "string",
              )
            )
              saved = cache;
          } catch {
            /* Use server data if a cached draft is damaged. */
          }
        } else {
          try {
            sessionStorage.removeItem(key);
          } catch {
            /* Optional local cache. */
          }
        }
        setAttempt(current);
        setQuestions(nextQuestions);
        setAnswers(nextAnswers);
        setFiles((fileResult.data ?? []) as QuizAttemptAnswerFile[]);
        setGrades(saved?.grades ?? nextGrades);
        setFeedback(saved?.feedback ?? serverFeedback);
        if (saved) setNotice("Draf penilaian dipulihkan.");
        setIndex(0);
      } catch (problem) {
        if (!request.signal.aborted)
          setLoadError(
            problem instanceof Error && problem.message
              ? problem.message
              : "Penilaian belum dapat dimuat. Coba lagi.",
          );
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    })();
    return () => request.abort();
  }, [attemptId, key, retry]);
  const final = attempt?.status === "graded";
  const editable = attempt && ["pending_review"].includes(attempt.status);
  const dirty = !!editable && JSON.stringify({ grades, feedback }) !== baseline;
  useEffect(() => {
    if (loading || !editable) return;
    try {
      if (dirty)
        sessionStorage.setItem(key, JSON.stringify({ grades, feedback }));
      else sessionStorage.removeItem(key);
    } catch {
      /* Keep the in-memory draft if browser storage is unavailable. */
    }
  }, [grades, feedback, dirty, editable, key, loading]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const answerMap = useMemo(
    () => new Map(answers.map((answer) => [answer.question_id, answer])),
    [answers],
  );
  const essays = questions.filter(
    (question) => question.question_type === "essay",
  );
  const selected = essays[Math.min(index, Math.max(0, essays.length - 1))];
  const selectedAnswer = selected ? answerMap.get(selected.id) : undefined;
  const preview = reviewScorePreview(questions, answers, grades);
  const selectedFiles = selected
    ? files.filter((file) => file.question_id === selected.id)
    : [];
  function updateGrade(
    answerId: string,
    patch: Partial<{ points: string; feedback: string }>,
  ) {
    setGrades((current) => ({
      ...current,
      [answerId]: {
        ...(current[answerId] ?? { points: "", feedback: "" }),
        ...patch,
      },
    }));
    setError("");
  }
  function nextStep() {
    setError("");
    if (step === 0) {
      try {
        reviewGradePayload(questions, answers, grades);
      } catch (problem) {
        setError((problem as Error).message);
        const incomplete = essays.findIndex((question) => {
          const answer = answerMap.get(question.id);
          const text = answer ? grades[answer.id]?.points : "";
          return (
            !text?.trim() ||
            !Number.isFinite(Number(text)) ||
            Number(text) < 0 ||
            Number(text) > Number(question.points)
          );
        });
        if (incomplete >= 0) setIndex(incomplete);
        return;
      }
    }
    setStep((current) => current + 1);
  }
  async function finalize() {
    if (!attemptId || !editable || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = reviewGradePayload(questions, answers, grades);
      const { data, error } = await supabase.rpc("grade_quiz_attempt", {
        p_attempt_id: attemptId,
        p_grades: payload,
        p_feedback: feedback.trim() || null,
      });
      if (error) throw error;
      const score = finiteScore(data);
      if (score === null)
        throw new Error(
          "Server belum mengonfirmasi nilai akhir. Muat ulang sebelum mengulang.",
        );
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Optional cache. */
      }
      setConfirm(false);
      setAttempt((current) =>
        current
          ? { ...current, status: "graded", score, grader_feedback: feedback }
          : current,
      );
      setNotice(`Nilai final ${score.toLocaleString("id-ID")} tersimpan.`);
      setBaseline(JSON.stringify({ grades, feedback }));
    } catch (problem) {
      setError(
        (problem as { message?: string }).message ??
          "Penilaian belum tersimpan. Coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openFile(file: QuizAttemptAnswerFile) {
    setOpeningFile(file.id);
    setError("");
    try {
      const result = await requestQuizAnswerDownloadUrl(file.id);
      if (!result.signedUrl) throw new Error();
      const a = document.createElement("a");
      a.href = result.signedUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    } catch {
      setError("Lampiran belum dapat dibuka. Coba lagi.");
    } finally {
      setOpeningFile("");
    }
  }
  if (loading)
    return (
      <p role="status" className="program-loading">
        Memuat jawaban ujian…
      </p>
    );
  if (loadError || !attempt)
    return (
      <div className="page-stack">
        <p role="alert" className="program-error">
          {loadError || "Percobaan tidak tersedia."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={returnTo}>Kembali ke antrean</Link>
          </Button>
          <Button onClick={() => setRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      </div>
    );
  const programmeId = attempt.lessons.program_modules.program_id;
  const programmeBase = root === "/teacher" ? "/teacher/kelas" : root;
  const participantPath =
    root === "/teacher"
      ? `${programmeBase}/program/${programmeId}/peserta`
      : `${root}/peserta/${attempt.enrollments.participant_id}?tab=academic`;
  return (
    <div className="page-stack assessment-review">
      <nav className="admin-breadcrumb" aria-label="Jejak penilaian">
        <Link to={returnTo}>Penilaian</Link>
        <span>/</span>
        <span>{attempt.enrollments.participants.display_name}</span>
      </nav>
      <PageHeader
        title={attempt.lessons.title}
        eyebrow={`${attempt.lessons.program_modules.programs.name} · Percobaan ${attempt.attempt_number}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={returnTo}>
                <ArrowLeft size={15} />
                Antrean
              </Link>
            </Button>
            <Button
              variant="outline"
              aria-label="Muat ulang jawaban"
              disabled={busy}
              onClick={() => setRetry((value) => value + 1)}
            >
              <RefreshCw size={15} />
            </Button>
          </>
        }
      />
      <div className="assessment-context">
        <div>
          <strong>{attempt.enrollments.participants.display_name}</strong>
          <span>
            {attempt.enrollments.participants.global_participant_number} ·{" "}
            {formatRegistrationDateTime(attempt.submitted_at)}
          </span>
        </div>
        <span
          className={`admission-badge admission-tone-${final ? "emerald" : "amber"}`}
        >
          {final
            ? "Nilai final"
            : editable
              ? "Perlu dinilai"
              : "Belum siap dinilai"}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link to={participantPath}>
            Profil akademik
            <ArrowRight size={14} />
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link
            to={
              root === "/teacher"
                ? `${programmeBase}/program/${programmeId}/kurikulum`
                : `${root}/program/${programmeId}/report`
            }
          >
            {root === "/teacher" ? "Materi program" : "Laporan program"}
          </Link>
        </Button>
      </div>
      {notice && (
        <p role="status" className="admission-notice">
          {notice}
        </p>
      )}
      {error && !confirm && (
        <p role="alert" className="program-error">
          {error}
        </p>
      )}
      {!final && !editable && (
        <p role="status" className="program-notice">
          Ujian ini belum masuk antrean koreksi. Jawaban ditampilkan untuk
          dibaca.
        </p>
      )}
      {final ? (
        <section className="assessment-final-card">
          <CheckCircle2 size={26} />
          <div>
            <span>Nilai akhir</span>
            <strong>{finiteScore(attempt.score) ?? "—"}</strong>
            <p>
              Nilai sudah final. Halaman ini menampilkan hasil yang tersimpan.
            </p>
          </div>
          {root !== "/teacher" && (
            <Button asChild variant="outline">
              <Link
                to={`${root}/peserta/${attempt.enrollments.participant_id}/transkrip/${attempt.enrollment_id}`}
              >
                Buka transkrip
                <ArrowRight size={15} />
              </Link>
            </Button>
          )}
        </section>
      ) : editable ? (
        <>
          <WizardSteps
            steps={["Nilai esai", "Umpan balik", "Tinjau & finalisasi"]}
            current={step}
          />
          <div className="assessment-progress">
            <span>
              {preview.reviewed} / {preview.essays} esai dinilai
              {dirty ? " · Draf tersimpan di browser" : ""}
            </span>
            <strong>
              {preview.score === null
                ? "Nilai belum lengkap"
                : `Pratinjau nilai ${preview.score.toLocaleString("id-ID")}`}
            </strong>
          </div>
        </>
      ) : null}
      {(step === 0 || final) && essays.length > 0 && (
        <div className="assessment-grading-layout">
          <nav className="assessment-question-nav" aria-label="Navigasi esai">
            {essays.map((question, i) => {
              const answer = answerMap.get(question.id);
              const text = answer ? grades[answer.id]?.points : "";
              const done =
                text?.trim() &&
                Number.isFinite(Number(text)) &&
                Number(text) >= 0 &&
                Number(text) <= Number(question.points);
              return (
                <button
                  key={question.id}
                  aria-current={i === index ? "step" : undefined}
                  onClick={() => setIndex(i)}
                >
                  <span>{i + 1}</span>Esai {i + 1}
                  {done && <Check size={14} />}
                </button>
              );
            })}
          </nav>
          <article className="program-panel assessment-question">
            <header>
              <span className="admission-eyebrow">
                Esai {index + 1} dari {essays.length}
              </span>
              <strong>Maksimal {selected.points} poin</strong>
            </header>
            <h2>{selected.question_text}</h2>
            {selected.grading_guide && (
              <details className="program-disclosure">
                <summary>Panduan penilaian</summary>
                <p className="p-4 whitespace-pre-wrap text-sm">
                  {selected.grading_guide}
                </p>
              </details>
            )}
            <section className="assessment-answer">
              <h3>Jawaban peserta</h3>
              <p>{selectedAnswer?.essay_answer || "Tidak ada jawaban teks."}</p>
              {selectedFiles.map((file) => (
                <Button
                  variant="outline"
                  size="sm"
                  key={file.id}
                  disabled={!!openingFile}
                  onClick={() => void openFile(file)}
                >
                  <Download size={14} />
                  {openingFile === file.id ? "Menyiapkan…" : file.display_name}
                </Button>
              ))}
            </section>
            {selectedAnswer && (
              <fieldset
                disabled={!editable || busy}
                className="assessment-grade-fields"
              >
                <label>
                  Poin esai {index + 1}
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Poin esai ${index + 1}`}
                      type="number"
                      min={0}
                      max={selected.points}
                      step="0.01"
                      placeholder="Belum dinilai"
                      value={grades[selectedAnswer.id]?.points ?? ""}
                      onChange={(event) =>
                        updateGrade(selectedAnswer.id, {
                          points: event.target.value,
                        })
                      }
                    />
                    <span>/ {selected.points}</span>
                    {editable && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateGrade(selectedAnswer.id, { points: "0" })
                        }
                      >
                        0 poin
                      </Button>
                    )}
                  </div>
                </label>
                <label>
                  Umpan balik esai {index + 1}
                  <textarea
                    className="field-control min-h-24"
                    maxLength={4000}
                    value={grades[selectedAnswer.id]?.feedback ?? ""}
                    onChange={(event) =>
                      updateGrade(selectedAnswer.id, {
                        feedback: event.target.value,
                      })
                    }
                    placeholder="Arahan singkat untuk peserta…"
                  />
                </label>
              </fieldset>
            )}
            <div className="admission-pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={index === 0}
                onClick={() => setIndex((value) => value - 1)}
              >
                Esai sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={index === essays.length - 1}
                onClick={() => setIndex((value) => value + 1)}
              >
                Esai berikutnya
              </Button>
            </div>
          </article>
        </div>
      )}
      {(step === 1 || final) && (
        <section className="program-panel space-y-3">
          <h2>Umpan balik akhir</h2>
          <textarea
            aria-label="Umpan balik akhir"
            className="field-control min-h-32"
            maxLength={6000}
            disabled={!editable || busy}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Capaian dan langkah belajar berikutnya…"
          />
          {editable && (
            <p className="text-xs text-muted-foreground">
              Umpan balik ini akan tampil bersama hasil ujian peserta.
            </p>
          )}
        </section>
      )}
      {step === 2 && !final && (
        <section className="program-panel space-y-4">
          <div className="program-section-heading">
            <h2>Tinjau nilai</h2>
            <strong className="text-3xl">
              {preview.score ?? "—"}{" "}
              <small className="text-sm text-muted-foreground">/ 100</small>
            </strong>
          </div>
          <p className="text-sm text-muted-foreground">
            {preview.earned} / {preview.total} poin · {preview.reviewed} esai
            dinilai
          </p>
          <div className="assessment-review-lines">
            {questions.map((question, i) => {
              const answer = answerMap.get(question.id);
              return (
                <div key={question.id}>
                  <span>
                    Soal {i + 1} ·{" "}
                    {question.question_type === "essay"
                      ? "Esai"
                      : "Pilihan ganda"}
                  </span>
                  <strong>
                    {answer
                      ? question.question_type === "essay"
                        ? grades[answer.id]?.points
                        : answer.points_earned
                      : "—"}{" "}
                    / {question.points}
                  </strong>
                </div>
              );
            })}
          </div>
          <div className="space-y-1">
            <h3 className="font-medium">Umpan balik akhir</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {feedback.trim() || "Tanpa umpan balik akhir."}
            </p>
          </div>
          <p className="program-notice">
            Hasil belajar mengikuti percobaan final terbaru. Nilai final tidak
            dapat ditimpa melalui halaman ini.
          </p>
        </section>
      )}
      <details className="program-disclosure">
        <summary>
          <FileText size={15} />
          Hasil pilihan ganda ·{" "}
          {
            questions.filter(
              (question) => question.question_type === "multiple_choice",
            ).length
          }{" "}
          soal
        </summary>
        <div className="p-4 space-y-4">
          {questions
            .filter((question) => question.question_type === "multiple_choice")
            .map((question) => {
              const answer = answerMap.get(question.id);
              return (
                <article key={question.id}>
                  <h3 className="font-semibold text-sm">
                    {question.question_text}
                  </h3>
                  <p className="text-sm mt-2">
                    Jawaban: {answer?.selected_option || "Tidak dijawab"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Kunci: {question.correct_answer || "Belum tersedia"} ·{" "}
                    {answer?.points_earned ?? 0} / {question.points} poin
                  </p>
                </article>
              );
            })}
        </div>
      </details>
      {editable && (
        <div className="assessment-footer">
          <Button
            variant="outline"
            disabled={busy || step === 0}
            onClick={() => {
              setStep((value) => value - 1);
              setError("");
            }}
          >
            Kembali
          </Button>
          <span>{step + 1} / 3</span>
          <Button
            disabled={!editable || busy || !essays.length}
            onClick={() => (step === 2 ? setConfirm(true) : nextStep())}
          >
            {step === 2 ? "Finalisasi nilai" : "Lanjut"}
            <ArrowRight size={15} />
          </Button>
        </div>
      )}
      {confirm && (
        <Dialog
          title="Finalisasi penilaian?"
          busy={busy}
          onClose={() => setConfirm(false)}
        >
          <p className="font-semibold">
            {attempt.enrollments.participants.display_name}
          </p>
          <p className="mt-2 text-sm">
            {attempt.lessons.title} · Nilai {preview.score ?? "—"}
          </p>
          {error && (
            <p className="program-error mt-3" role="alert">
              {error}
            </p>
          )}
          <div className="wizard-footer">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Periksa lagi
            </Button>
            <Button disabled={busy} onClick={() => void finalize()}>
              {busy ? "Menyimpan…" : "Tetapkan nilai final"}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
