import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { ArrowLeft, Clock, CheckCircle2, AlertTriangle, BookOpen, Trophy, XCircle, ChevronRight, LayoutGrid, AlertCircle } from "lucide-react";
import type { Lesson, QuizQuestion } from "../../lib/academic";

export function LearnerQuizPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthSession();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quizAttemptId, setQuizAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [showReview, setShowReview] = useState(false);
  
  // Ref for scrolling to questions
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const initializedLessonIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function loadQuiz() {
      if (!user?.id || !lessonId) return;
      
      // Prevent double execution caused by React Strict Mode or auth context changes
      if (initializedLessonIdRef.current === lessonId) return;
      initializedLessonIdRef.current = lessonId;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        // 1. Get Lesson
        const { data: lessonData, error: lessonError } = await supabase
          .from("lessons")
          .select("*, program_modules(program_id)")
          .eq("id", lessonId)
          .single();

        if (lessonError || !lessonData) throw new Error("Materi tidak ditemukan.");
        setLesson(lessonData as any);

        const programId = (lessonData.program_modules as any).program_id;

        // 2. Get Participant & Enrollment
        const { data: participantRow } = await supabase
          .from("participants")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!participantRow) throw new Error("Anda tidak terdaftar sebagai peserta.");

        const { data: enrollData, error: enrollError } = await supabase
          .from("enrollments")
          .select("id")
          .eq("participant_id", participantRow.id)
          .eq("program_id", programId)
          .eq("enrollment_status", "active")
          .maybeSingle();

        if (enrollError || !enrollData) throw new Error("Anda tidak terdaftar di program ini.");

        // 3. Check Attempts
        const { data: attemptData } = await supabase
          .from("quiz_attempts")
          .select("id, status, score, started_at")
          .eq("enrollment_id", enrollData.id)
          .eq("lesson_id", lessonId)
          .order("created_at", { ascending: false });

        const submittedAttempts = attemptData?.filter(a => a.status === 'submitted') || [];
        const ongoingAttempt = attemptData?.find(a => a.status === 'ongoing');
        const isMaxAttemptsReached = lessonData.max_attempts && submittedAttempts.length >= lessonData.max_attempts;

        // 4. Get Questions
        const { data: qData, error: qError } = await supabase
          .from("quiz_questions")
          .select("*")
          .eq("lesson_id", lessonId);

        if (qError) throw new Error("Gagal memuat soal.");
        
        let loadedQuestions = qData || [];
        
        // If finished/max attempts reached, load past answers for review
        if (isMaxAttemptsReached) {
          const lastAttemptId = submittedAttempts[0].id;
          
          const { data: pastAnswers } = await supabase
            .from("quiz_attempt_answers")
            .select("question_id, selected_option")
            .eq("quiz_attempt_id", lastAttemptId);
            
          if (pastAnswers) {
            const reconstructedAnswers: Record<string, string> = {};
            pastAnswers.forEach(pa => {
              if (pa.selected_option) reconstructedAnswers[pa.question_id] = pa.selected_option;
            });
            setAnswers(reconstructedAnswers);
          }
          
          setQuestions(loadedQuestions.sort((a, b) => a.order_no - b.order_no) as any);
          setIsFinished(true);
          setFinalScore(submittedAttempts[0].score);
          setIsLoading(false);
          return;
        }

        // 5. Handle ongoing attempt or create a new one
        let currentAttemptId = ongoingAttempt?.id;
        let startedAt = ongoingAttempt?.started_at ? new Date(ongoingAttempt.started_at) : new Date();

        if (!currentAttemptId) {
          const { data: newAttempt, error: attemptInsertError } = await supabase
            .from("quiz_attempts")
            .insert({
              enrollment_id: enrollData.id,
              lesson_id: lessonId,
              attempt_number: submittedAttempts.length + 1,
              status: "ongoing"
            })
            .select("id, started_at")
            .single();

          if (attemptInsertError) throw new Error("Gagal memulai kuis: " + attemptInsertError.message);
          currentAttemptId = newAttempt.id;
          startedAt = new Date(newAttempt.started_at);
        }
        
        setQuizAttemptId(currentAttemptId);

        // Randomize questions deterministically based on Attempt ID so refreshes yield the exact same 30 questions
        const hashString = (str: string) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
          }
          return hash;
        };

        if (lessonData.randomized_questions_count && loadedQuestions.length > lessonData.randomized_questions_count) {
          loadedQuestions = loadedQuestions.sort((a, b) => {
            const hashA = hashString(a.id + currentAttemptId);
            const hashB = hashString(b.id + currentAttemptId);
            return hashA - hashB;
          }).slice(0, lessonData.randomized_questions_count);
        } else {
          loadedQuestions = loadedQuestions.sort((a, b) => a.order_no - b.order_no);
        }
        
        setQuestions(loadedQuestions as any);

        // Set Timer correctly accounting for time elapsed if it's an ongoing attempt
        if (lessonData.duration_minutes) {
          const elapsedSeconds = Math.floor((new Date().getTime() - startedAt.getTime()) / 1000);
          const totalSeconds = lessonData.duration_minutes * 60;
          const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
          setTimeLeft(remainingSeconds);
        }

      } catch (err: any) {
        setErrorMessage(err.message);
        initializedLessonIdRef.current = null; // allow retry
      } finally {
        setIsLoading(false);
      }
    }

    void loadQuiz();
  }, [user?.id, lessonId]);

  // Timer Effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isFinished || isSubmitting) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev !== null && prev <= 1) {
          clearInterval(timer);
          void handleSubmitQuiz(); // Auto submit when time is up
          return 0;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isFinished, isSubmitting]);

  const handleOptionSelect = (questionId: string, option: string) => {
    if (isFinished || isSubmitting) return;
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const scrollToQuestion = (id: string) => {
    const el = questionRefs.current[id];
    if (el) {
      // Offset for sticky header
      const y = el.getBoundingClientRect().top + window.scrollY - 150;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleSubmitQuiz = async () => {
    if (!quizAttemptId || isSubmitting || isFinished) return;
    
    // Check if all answered
    const unansweredCount = questions.length - questions.filter(q => !!answers[q.id]).length;
    if (timeLeft !== 0 && unansweredCount > 0) {
      const confirmSubmit = window.confirm(`Masih ada ${unansweredCount} soal yang belum dijawab. Yakin ingin mengumpulkan?`);
      if (!confirmSubmit) return;
    }

    setIsSubmitting(true);

    try {
      // Calculate Score
      let correctCount = 0;
      let totalPoints = 0;
      let earnedPoints = 0;

      const answersToInsert = questions.map(q => {
        const isCorrect = answers[q.id] === q.correct_answer;
        if (isCorrect) {
          correctCount++;
          earnedPoints += (q.points || 10);
        }
        totalPoints += (q.points || 10);

        return {
          quiz_attempt_id: quizAttemptId,
          question_id: q.id,
          selected_option: answers[q.id] || null,
          is_correct: isCorrect,
          points_earned: isCorrect ? (q.points || 10) : 0
        };
      });

      const finalCalcScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

      // Update attempt
      const { error: updateError } = await supabase
        .from("quiz_attempts")
        .update({
          status: "submitted",
          score: finalCalcScore,
          submitted_at: new Date().toISOString()
        })
        .eq("id", quizAttemptId);

      if (updateError) throw new Error("Gagal menyimpan nilai ujian.");

      // Insert answers
      if (answersToInsert.length > 0) {
        const { error: ansError } = await supabase
          .from("quiz_attempt_answers")
          .insert(answersToInsert);
          
        if (ansError) console.error("Failed to insert answers", ansError); // non-blocking
      }

      setFinalScore(finalCalcScore);
      setIsFinished(true);
      setShowReview(false);

      // Scroll to top to see results
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="page-stack max-w-4xl mx-auto py-24 flex flex-col items-center justify-center space-y-6">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-muted-foreground font-medium animate-pulse text-lg">Menyiapkan Lembar Ujian...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="page-stack max-w-4xl mx-auto py-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="w-fit mb-6 text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Materi
        </Button>
        <Card className="border-red-200 shadow-md max-w-xl mx-auto">
          <CardHeader className="bg-red-50 text-center border-b border-red-100 pb-8 pt-10 rounded-t-xl">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-red-900">Gagal Memuat Ujian</CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center text-red-800">
            {errorMessage}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate Progress safely using questions array to prevent out-of-bounds keys
  const answeredCount = questions.filter(q => !!answers[q.id]).length;
  const progressPercentage = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const hasPassed = lesson?.passing_grade ? (finalScore !== null && finalScore >= lesson.passing_grade) : true;

  if (isFinished && !showReview) {
    return (
      <div className="page-stack max-w-3xl mx-auto py-12">
        <Card className={`shadow-xl border-t-8 ${hasPassed ? 'border-emerald-500' : 'border-red-500'}`}>
          <CardHeader className={`text-center border-b pb-10 pt-12 rounded-t-xl ${hasPassed ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
            {hasPassed ? (
              <Trophy className="w-20 h-20 text-emerald-500 mx-auto mb-6 drop-shadow-sm" />
            ) : (
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6 drop-shadow-sm" />
            )}
            
            <CardTitle className={`text-3xl font-bold ${hasPassed ? 'text-emerald-900' : 'text-red-900'}`}>
              Ujian Selesai!
            </CardTitle>
            <p className="text-slate-600 mt-2 text-lg">Anda telah menyelesaikan <span className="font-semibold">{lesson?.title}</span></p>
          </CardHeader>
          
          <CardContent className="p-10 text-center">
            <p className="text-sm text-slate-500 mb-3 uppercase tracking-widest font-bold">Nilai Akhir Anda</p>
            <div className={`text-8xl font-black mb-6 tracking-tighter ${hasPassed ? 'text-emerald-600' : 'text-red-600'}`}>
              {finalScore}
            </div>
            
            {lesson?.passing_grade && (
              <div className="mt-6 flex justify-center">
                {hasPassed ? (
                  <div className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-base shadow-sm border border-emerald-200">
                    <CheckCircle2 className="w-5 h-5" />
                    Lulus (KKM: {lesson.passing_grade})
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-100 text-red-800 rounded-full font-semibold text-base shadow-sm border border-red-200">
                    <AlertTriangle className="w-5 h-5" />
                    Tidak Lulus (KKM: {lesson.passing_grade})
                  </div>
                )}
              </div>
            )}
          </CardContent>
          
          <div className="bg-slate-50 p-6 flex flex-col sm:flex-row justify-center gap-4 border-t rounded-b-xl">
            <Button size="lg" variant="outline" className="px-8 bg-white" onClick={() => navigate(`/learner/lesson/${lessonId}`)}>
              <ArrowLeft className="w-5 h-5 mr-2" /> Kembali
            </Button>
            <Button size="lg" className="px-8" onClick={() => setShowReview(true)}>
              <BookOpen className="w-5 h-5 mr-2" /> Lihat Pembahasan
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-stack max-w-6xl mx-auto pb-32 pt-4 px-4 flex flex-col lg:flex-row gap-8">
      
      {/* Main Content (Questions) */}
      <div className="flex-1 min-w-0">
        {/* Sticky Header */}
        <div className="sticky top-4 z-30 bg-white/95 backdrop-blur-md border border-slate-200 p-5 mb-8 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1 w-full">
            <h1 className="text-xl font-bold text-slate-900 mb-2">{lesson?.title}</h1>
            
            {/* Progress Bar & Stats */}
            {!showReview && (
              <div className="flex items-center gap-4 text-sm w-full">
                <div className="flex-1 max-w-xs">
                  <div className="flex justify-between text-slate-500 mb-1.5 text-xs font-semibold">
                    <span>Progres Jawaban</span>
                    <span>{answeredCount} / {questions.length}</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>
                {lesson?.passing_grade && (
                  <div className="hidden md:flex items-center gap-2 text-slate-500 border-l pl-4 font-medium">
                    KKM: <span className="font-bold text-slate-700">{lesson.passing_grade}</span>
                  </div>
                )}
              </div>
            )}

            {showReview && (
              <div className="flex items-center gap-2 text-primary font-semibold">
                <BookOpen className="w-4 h-4" /> Mode Pembahasan & Review
              </div>
            )}
          </div>
          
          {timeLeft !== null && !isFinished && (
            <div className={`flex items-center gap-2 font-mono font-bold text-xl px-5 py-2.5 rounded-xl transition-all shadow-inner ${timeLeft < 60 ? 'bg-red-50 text-red-600 ring-1 ring-red-500 animate-pulse' : 'bg-slate-50 text-slate-700 border'}`}>
              <Clock className="w-6 h-6" />
              {formatTime(timeLeft)}
            </div>
          )}
          
          {showReview && finalScore !== null && (
            <div className={`flex items-center gap-3 px-5 py-2.5 rounded-xl border font-bold text-lg ${hasPassed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              Nilai: {finalScore}
            </div>
          )}
        </div>

        {questions.length === 0 ? (
          <Card className="border-slate-200 shadow-sm py-16 text-center">
            <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-700 mb-2">Soal Belum Tersedia</h3>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">Ujian ini belum memiliki soal yang dapat dikerjakan. Hubungi administrator atau instruktur Anda.</p>
            <Button variant="outline" size="lg" onClick={() => navigate(-1)}>Kembali ke Materi</Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {questions.map((q, idx) => {
              const userAnswer = answers[q.id];
              const isCorrect = q.correct_answer === userAnswer;
              const hasAnswered = !!userAnswer;
              
              return (
                <Card 
                  key={q.id} 
                  ref={el => questionRefs.current[q.id] = el}
                  className={`border-slate-200 shadow-sm overflow-hidden transition-all duration-300 ${!showReview && hasAnswered ? 'border-primary/20 bg-slate-50/30' : ''}`}
                >
                  <div className={`px-6 py-4 border-b flex items-center justify-between ${showReview ? (isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100') : 'bg-slate-50/80 border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-700 text-sm tracking-wide uppercase">Soal {idx + 1}</span>
                      {showReview && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {isCorrect ? 'Benar' : 'Salah'}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-medium bg-white px-3 py-1 rounded-full border shadow-sm">{q.points || 10} Poin</span>
                  </div>
                  
                  <CardContent className="p-6 sm:p-8">
                    <div className="text-slate-800 font-medium text-lg mb-8 leading-relaxed">
                      {q.question_text.includes('<') && q.question_text.includes('>') ? (
                          <div dangerouslySetInnerHTML={{ __html: q.question_text }} className="prose prose-slate max-w-none" />
                        ) : (
                          <div className="whitespace-pre-wrap">{q.question_text}</div>
                        )}
                    </div>
                    
                    <div className="space-y-4">
                      {((q.options as string[]) || []).map((opt, oIdx) => {
                        const isSelected = userAnswer === opt;
                        const isActualCorrectAnswer = showReview && q.correct_answer === opt;
                        
                        // Styling logic for Review Mode vs Active Mode
                        let labelStyle = 'border-slate-100 hover:border-primary/40 hover:bg-slate-50 text-slate-700';
                        let ringStyle = '';
                        
                        if (showReview) {
                          if (isActualCorrectAnswer) {
                            labelStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold shadow-sm';
                            ringStyle = 'ring-2 ring-emerald-500/20';
                          } else if (isSelected && !isCorrect) {
                            labelStyle = 'border-red-300 bg-red-50 text-red-800 line-through decoration-red-300';
                          } else {
                            labelStyle = 'border-slate-100 text-slate-400 opacity-60';
                          }
                        } else if (isSelected) {
                          labelStyle = 'border-primary bg-primary/5 text-primary font-semibold shadow-sm';
                          ringStyle = 'ring-1 ring-primary/20';
                        }
                        
                        return (
                          <label 
                            key={oIdx} 
                            className={`flex items-start gap-4 p-5 rounded-xl border-2 transition-all ${labelStyle} ${ringStyle} ${!showReview ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className="pt-0.5 shrink-0 flex items-center justify-center">
                              {showReview ? (
                                isActualCorrectAnswer ? (
                                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                ) : isSelected ? (
                                  <XCircle className="w-6 h-6 text-red-400" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-slate-200"></div>
                                )
                              ) : (
                                <input 
                                  type="radio" 
                                  name={`question-${q.id}`} 
                                  value={opt} 
                                  checked={isSelected}
                                  onChange={() => handleOptionSelect(q.id, opt)}
                                  className="w-5 h-5 accent-primary cursor-pointer transition-all"
                                  disabled={showReview}
                                />
                              )}
                            </div>
                            <div className="flex-1">
                              {opt}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Sidebar Nav (Desktop only for now) */}
      {questions.length > 0 && (
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b pb-4 pt-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-slate-500" /> Navigasi Soal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => {
                    const hasAnswered = !!answers[q.id];
                    const isCorrect = showReview ? answers[q.id] === q.correct_answer : false;
                    
                    let btnStyle = 'bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary';
                    if (showReview) {
                      if (hasAnswered) {
                        btnStyle = isCorrect ? 'bg-emerald-100 border-emerald-200 text-emerald-800' : 'bg-red-100 border-red-200 text-red-800';
                      } else {
                        btnStyle = 'bg-slate-100 border-slate-200 text-slate-400';
                      }
                    } else if (hasAnswered) {
                      btnStyle = 'bg-primary text-white border-primary shadow-sm';
                    }

                    return (
                      <button
                        key={q.id}
                        onClick={() => scrollToQuestion(q.id)}
                        className={`h-10 w-full rounded-md border font-semibold text-sm transition-all flex items-center justify-center ${btnStyle}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                {!showReview && (
                  <div className="mt-6 space-y-3 text-xs text-slate-500 font-medium border-t pt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-primary"></div> Terjawab
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-white border border-slate-300"></div> Belum Terjawab
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Floating Submit Action */}
      {!showReview && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] z-40 flex justify-center">
          <div className="w-full max-w-6xl flex items-center justify-between px-2">
            <Button variant="ghost" className="text-slate-500 font-semibold" onClick={() => navigate(-1)} disabled={isSubmitting}>
              Batalkan
            </Button>
            <div className="flex items-center gap-4">
              {answeredCount < questions.length && (
                <div className="hidden sm:flex items-center gap-2 text-sm text-amber-600 font-semibold bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                  <AlertCircle className="w-4 h-4" /> {questions.length - answeredCount} belum dijawab
                </div>
              )}
              <Button 
                size="lg" 
                className="px-8 sm:px-12 h-14 text-base font-bold bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all" 
                onClick={handleSubmitQuiz}
                disabled={isSubmitting || questions.length === 0}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Memproses...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Selesai & Kumpulkan <ChevronRight className="w-5 h-5" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action for Review Mode */}
      {showReview && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] z-40 flex justify-center">
          <div className="w-full max-w-6xl flex items-center justify-between px-2">
            <div className="font-semibold text-slate-700 hidden sm:block">
              Selesai mereview jawaban?
            </div>
            <Button 
              size="lg" 
              className="px-12 h-14 text-base font-bold bg-slate-900 text-white shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 transition-all w-full sm:w-auto" 
              onClick={() => {
                setShowReview(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Kembali ke Halaman Hasil
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
