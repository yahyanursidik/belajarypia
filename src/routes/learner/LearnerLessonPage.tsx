import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { ArrowLeft, BookOpen, Download, ExternalLink, FileText, CheckCircle2, PlayCircle, Clock, AlertTriangle, ListChecks, Trophy } from "lucide-react";
import type { DocumentFile } from "../../lib/academic";

export function LearnerLessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  
  const [lesson, setLesson] = useState<any>(null);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [prerequisites, setPrerequisites] = useState<any[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<any[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadLessonContent() {
      if (!user || !lessonId) return;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        // Load Lesson and Program context (including quiz fields)
        const { data: lessonRow, error: lessonError } = await supabase
          .from("lessons")
          .select(`
            id, module_id, code, title, lesson_type, content_body, external_url, release_at, 
            duration_minutes, passing_grade, max_attempts, randomized_questions_count,
            program_modules(id, program_id, programs(id, name))
          `)
          .eq("id", lessonId)
          .maybeSingle();

        if (lessonError || !lessonRow) {
          throw new Error(lessonError?.message || "Materi tidak ditemukan.");
        }

        setLesson(lessonRow);
        const programId = (lessonRow.program_modules as any)?.program_id;

        // Load Documents
        const { data: docRows } = await supabase
          .from("document_files")
          .select("id, display_name, external_url, file_size_bytes, mime_type, file_category, object_key, bucket_name, source_type")
          .eq("lesson_id", lessonId)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        setDocuments((docRows ?? []) as DocumentFile[]);

        // Load Prerequisites
        const { data: prereqRows } = await supabase
          .from("lesson_prerequisites")
          .select("id, prerequisite_lesson_id, lessons!lesson_prerequisites_prerequisite_lesson_id_fkey(code, title)")
          .eq("lesson_id", lessonId);

        setPrerequisites(prereqRows ?? []);

        // If it's a quiz or exam, load attempts and questions count
        if (lessonRow.lesson_type === 'quiz' || lessonRow.lesson_type === 'exam') {
          // Questions count
          const { count } = await supabase
            .from("quiz_questions")
            .select("id", { count: "exact", head: true })
            .eq("lesson_id", lessonId);
            
          setQuestionCount(count || 0);

          // Get Enrollment to fetch attempts
          if (programId) {
            const { data: participantRow } = await supabase
              .from("participants")
              .select("id")
              .eq("user_id", user.id)
              .maybeSingle();

            if (participantRow) {
              const { data: enrollData } = await supabase
                .from("enrollments")
                .select("id")
                .eq("participant_id", participantRow.id)
                .eq("program_id", programId)
                .eq("enrollment_status", "active")
                .maybeSingle();

            if (enrollData) {
              const { data: attemptRows } = await supabase
                .from("quiz_attempts")
                .select("id, status, score, created_at, attempt_number")
                .eq("enrollment_id", enrollData.id)
                .eq("lesson_id", lessonId)
                .order("attempt_number", { ascending: false });
              
              setQuizAttempts(attemptRows || []);
            }
            }
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadLessonContent();
  }, [user, lessonId]);

  if (isLoading) {
    return (
      <div className="page-stack w-full pb-20 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded mb-8"></div>
        <div className="flex gap-4 items-start mb-8">
          <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
          <div className="flex-1 space-y-4">
            <div className="h-4 w-24 bg-slate-200 rounded"></div>
            <div className="h-8 w-2/3 bg-slate-200 rounded"></div>
          </div>
        </div>
        <div className="h-64 bg-slate-100 rounded-xl"></div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="page-stack max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="w-fit mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
        </Button>
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>Gagal memuat materi</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const programId = lesson?.program_modules?.program_id;
  
  const handleDownload = async (doc: DocumentFile) => {
    if (doc.source_type === "external_link" && doc.external_url) {
      window.open(doc.external_url, "_blank");
      return;
    }
    
    if (doc.bucket_name && doc.object_key) {
      try {
        const { data, error } = await supabase.storage
          .from(doc.bucket_name)
          .createSignedUrl(doc.object_key, 60 * 60); // 1 hour expiry
          
        if (error) throw error;
        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank");
        }
      } catch (err: any) {
        alert("Gagal mengunduh dokumen: " + err.message);
      }
    }
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "video": return <PlayCircle className="w-6 h-6 text-primary" />;
      case "quiz":
      case "exam": return <CheckCircle2 className="w-6 h-6 text-orange-500" />;
      default: return <FileText className="w-6 h-6 text-emerald-500" />;
    }
  };

  const isQuiz = lesson?.lesson_type === 'quiz' || lesson?.lesson_type === 'exam';
  const submittedAttempts = quizAttempts.filter(a => a.status === 'submitted');
  const maxAttemptsReached = lesson?.max_attempts && submittedAttempts.length >= lesson.max_attempts;

  return (
    <div className="page-stack w-full pb-20">
      <div className="flex items-center justify-between mb-2">
        <Button 
          variant="ghost" 
          onClick={() => programId ? navigate(`/learner/program/${programId}`) : navigate(-1)} 
          className="text-slate-600 hover:text-slate-900 -ml-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Silabus
        </Button>
        {lesson?.program_modules?.programs && (
          <Badge variant="outline" className="text-xs text-slate-500 hidden sm:inline-flex">
            {lesson.program_modules.programs.name}
          </Badge>
        )}
      </div>

      <header className="mb-8 flex gap-4 items-start border-b border-slate-200 pb-8">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          {getLessonIcon(lesson?.lesson_type)}
        </div>
        <div>
          <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none mb-3">
            {lesson?.code}
          </Badge>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight">
            {lesson?.title}
          </h1>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="capitalize font-medium flex items-center gap-1.5">
              Tipe: {lesson?.lesson_type.replace('_', ' ')}
            </span>
            {lesson?.release_at && (
              <span>Dirilis: {new Date(lesson.release_at).toLocaleDateString("id-ID")}</span>
            )}
          </div>
        </div>
      </header>

      {prerequisites.length > 0 && (
        <Alert className="mb-8 bg-amber-50 border-amber-200 text-amber-800">
          <BookOpen className="w-4 h-4 text-amber-600" />
          <AlertTitle className="text-amber-800 font-semibold">Persyaratan Materi (Prerequisite)</AlertTitle>
          <AlertDescription>
            Anda disarankan untuk menyelesaikan materi berikut sebelum mempelajari materi ini:
            <ul className="list-disc ml-5 mt-2 space-y-1">
              {prerequisites.map(p => (
                <li key={p.id}>{p.lessons?.code} - {p.lessons?.title}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Conditional Content Viewer */}
      {isQuiz ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="md:col-span-2 border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" /> Informasi Ujian
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Durasi</p>
                    <p className="font-semibold text-slate-900">{lesson.duration_minutes ? `${lesson.duration_minutes} Menit` : 'Tidak Dibatasi'}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex items-start gap-3">
                  <Trophy className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Nilai Kelulusan</p>
                    <p className="font-semibold text-slate-900">{lesson.passing_grade ? `${lesson.passing_grade} / 100` : 'Tidak Ada'}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex items-start gap-3">
                  <ListChecks className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Jumlah Soal</p>
                    <p className="font-semibold text-slate-900">
                      {lesson.randomized_questions_count 
                        ? `${lesson.randomized_questions_count} Soal (Diacak dari ${questionCount})` 
                        : `${questionCount} Soal`}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-purple-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Batas Percobaan</p>
                    <p className="font-semibold text-slate-900">
                      {lesson.max_attempts ? `${submittedAttempts.length} / ${lesson.max_attempts} Kali` : `${submittedAttempts.length} Kali (Tak Terbatas)`}
                    </p>
                  </div>
                </div>
              </div>

              {lesson.content_body && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Petunjuk Ujian:</h4>
                  <div className="text-sm text-blue-800 prose prose-sm max-w-none">
                    {lesson.content_body.includes('<') && lesson.content_body.includes('>') ? (
                      <div dangerouslySetInnerHTML={{ __html: lesson.content_body }} />
                    ) : (
                      <div className="whitespace-pre-wrap">{lesson.content_body}</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right column: Attempts History */}
          <Card className="border-slate-200 shadow-sm h-fit">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-base">Riwayat Percobaan</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {quizAttempts.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  Belum ada percobaan ujian.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {quizAttempts.map((attempt) => (
                    <li key={attempt.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Percobaan ke-{attempt.attempt_number}</p>
                        <p className="text-xs text-slate-500">{new Date(attempt.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div>
                        {attempt.status === 'submitted' ? (
                          <Badge variant={attempt.score >= (lesson.passing_grade || 0) ? "default" : "secondary"} className={`px-2 ${attempt.score >= (lesson.passing_grade || 0) ? "" : "bg-red-100 text-red-700"}`}>
                            {attempt.score}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500 border-slate-200">
                            Sedang Berjalan
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          {/* External Content Embed / Link */}
          {lesson?.external_url && (
            <div className="border-b border-slate-200">
              {(() => {
                const url = lesson.external_url;
                const lower = url.toLowerCase();
                let embedType = 'other';
                let ytId = '';

                if (lower.includes('youtube.com/watch') || lower.includes('youtu.be/')) {
                  embedType = 'youtube';
                  try {
                    if (lower.includes('youtu.be/')) ytId = url.split('youtu.be/')[1]?.split('?')[0] || '';
                    else ytId = new URLSearchParams(new URL(url).search).get('v') || '';
                  } catch (e) { /* ignore */ }
                } else if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg') || lower.includes('.mp4?')) {
                  embedType = 'video';
                } else if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a') || lower.includes('.mp3?')) {
                  embedType = 'audio';
                } else if (lower.includes('drive.google.com/file/d/')) {
                  embedType = 'gdrive';
                } else if (lower.endsWith('.pdf') || lower.includes('.pdf?')) {
                  embedType = 'pdf';
                }

                if (embedType === 'youtube' && ytId) {
                  return (
                    <div className="aspect-video w-full bg-black relative">
                      <iframe 
                        src={`https://www.youtube.com/embed/${ytId}`} 
                        className="w-full h-full" 
                        allowFullScreen 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  );
                }
                if (embedType === 'video') {
                  return (
                    <div className="bg-black w-full flex justify-center">
                      <video src={url} controls className="w-full max-h-[70vh]" />
                    </div>
                  );
                }
                if (embedType === 'audio') {
                  return (
                    <div className="bg-slate-50 p-8 flex flex-col items-center justify-center">
                      <FileText className="w-12 h-12 text-slate-400 mb-4" />
                      <audio src={url} controls className="w-full max-w-md" />
                    </div>
                  );
                }
                if (embedType === 'pdf' || embedType === 'gdrive') {
                  let embedUrl = url;
                  if (embedType === 'gdrive') {
                    // Pastikan link gdrive diubah dari /view ke /preview agar bisa di-embed
                    embedUrl = url.replace(/\/view.*$/, '/preview');
                    if (!embedUrl.includes('/preview')) {
                      embedUrl = embedUrl + '/preview';
                    }
                  }
                  
                  return (
                    <div className="w-full flex flex-col">
                      <div className="w-full h-[60vh] sm:h-[80vh] bg-slate-100">
                        <iframe src={embedUrl} className="w-full h-full border-none" title="Dokumen Viewer" allow="autoplay" />
                      </div>
                      <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">Penampil Dokumen</span>
                        <Button size="sm" variant="outline" onClick={() => window.open(url, "_blank")} className="w-full sm:w-auto">
                          Buka di Tab Baru <ExternalLink className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  );
                }
                
                // Fallback
                return (
                  <div className="bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                      <ExternalLink className="w-8 h-8" />
                    </div>
                    <h3 className="font-semibold text-lg text-slate-800 mb-2">Materi / Link Eksternal</h3>
                    <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
                      Materi ini dialihkan ke tautan eksternal (misal: Google Form, atau platform lain).
                    </p>
                    <Button size="lg" onClick={() => window.open(url, "_blank")}>
                      Buka Tautan Eksternal <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Text Content */}
          {lesson?.content_body ? (
            <div className="p-8 prose prose-slate max-w-none prose-headings:text-slate-800 prose-a:text-primary hover:prose-a:text-primary/90">
              {/* Fallback rendering for now. If it's HTML, we'll dangerously set it */}
              {lesson.content_body.includes('<') && lesson.content_body.includes('>') ? (
                <div dangerouslySetInnerHTML={{ __html: lesson.content_body }} />
              ) : (
                <div className="whitespace-pre-wrap">{lesson.content_body}</div>
              )}
            </div>
          ) : (
            !lesson?.external_url && (
              <div className="p-12 text-center text-slate-400 italic">
                Tidak ada konten teks untuk materi ini.
              </div>
            )
          )}
        </div>
      )}

      {/* Document Attachments */}
      {documents.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-500" /> Lampiran Dokumen ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <li key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/5 text-primary rounded-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">{doc.display_name}</p>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">
                        {doc.file_category} • {doc.source_type === 'external_link' ? 'Link Eksternal' : 'File Internal'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDownload(doc)}
                    className="shrink-0"
                  >
                    <Download className="w-4 h-4 mr-2" /> Unduh
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="mt-12 flex flex-col sm:flex-row justify-end gap-3">
        {isQuiz ? (
          <Button 
            size="lg" 
            onClick={() => navigate(`/learner/lesson/${lessonId}/quiz`)}
            className="bg-orange-600 hover:bg-orange-700 shadow-sm w-full sm:w-auto"
            disabled={maxAttemptsReached}
          >
            {maxAttemptsReached ? (
              <>Batas Percobaan Habis</>
            ) : (
              <><BookOpen className="w-5 h-5 mr-2 text-white" /> Mulai Kerjakan Ujian</>
            )}
          </Button>
        ) : (
          <Button 
            size="lg" 
            onClick={() => programId ? navigate(`/learner/program/${programId}`) : navigate(-1)}
            className="bg-emerald-600 hover:bg-emerald-700 shadow-sm w-full sm:w-auto"
          >
            <CheckCircle2 className="w-5 h-5 mr-2 text-white" /> Selesai & Kembali
          </Button>
        )}
      </div>
    </div>
  );
}
