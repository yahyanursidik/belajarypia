import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DocumentFile, Lesson, ProgramModule } from "../../lib/academic";
import { requestSignedDownloadUrl } from "../../lib/documents";
import type { Enrollment, Participant } from "../../lib/enrollment";
import { supabase } from "../../lib/supabase";

type EnrolledProgram = {
  id: string;
  code: string;
  name: string;
};

type LessonPrerequisiteRow = {
  lesson_id: string;
  prerequisite_lesson_id: string;
  lessons?: Pick<Lesson, "code" | "title"> | null;
};

export function LearnerProgramLessonsPage() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [modules, setModules] = useState<ProgramModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [documentFiles, setDocumentFiles] = useState<DocumentFile[]>([]);
  const [prerequisites, setPrerequisites] = useState<LessonPrerequisiteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadLessons() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const { data: participantRow, error: participantError } = await supabase
        .from("participants")
        .select("id, user_id, global_participant_number, display_name, status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (participantError) {
        setErrorMessage(participantError.message);
        setIsLoading(false);
        return;
      }

      const currentParticipant = (participantRow as Participant | null) ?? null;
      setParticipant(currentParticipant);

      if (!currentParticipant) {
        setIsLoading(false);
        return;
      }

      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from("enrollments")
        .select(
          "id, participant_id, program_id, batch_id, class_id, halaqah_id, enrollment_number, enrollment_status, payment_status, programs(id, code, name, feature_flags)",
        )
        .eq("participant_id", currentParticipant.id)
        .eq("enrollment_status", "active")
        .order("created_at", { ascending: false });

      if (enrollmentError) {
        setErrorMessage(enrollmentError.message);
        setIsLoading(false);
        return;
      }

      const nextEnrollments = (enrollmentRows ?? []) as unknown as Enrollment[];
      setEnrollments(nextEnrollments);

      const programIds = Array.from(new Set(nextEnrollments.map((item) => item.program_id)));

      if (programIds.length === 0) {
        setModules([]);
        setLessons([]);
        setDocumentFiles([]);
        setPrerequisites([]);
        setIsLoading(false);
        return;
      }

      const { data: moduleRows, error: moduleError } = await supabase
        .from("program_modules")
        .select("id, program_id, parent_module_id, level_id, code, title, module_type, order_no, is_required, levels(code, name)")
        .in("program_id", programIds)
        .order("order_no");

      if (moduleError) {
        setErrorMessage(moduleError.message);
        setIsLoading(false);
        return;
      }

      const nextModules = (moduleRows ?? []) as unknown as ProgramModule[];
      setModules(nextModules);

      const moduleIds = nextModules.map((module) => module.id);

      if (moduleIds.length === 0) {
        setLessons([]);
        setDocumentFiles([]);
        setPrerequisites([]);
        setIsLoading(false);
        return;
      }

      const { data: lessonRows, error: lessonError } = await supabase
        .from("lessons")
        .select("id, module_id, code, title, lesson_type, content_format, content_body, external_url, order_no, release_at, due_at, visibility_status")
        .in("module_id", moduleIds)
        .order("order_no");

      if (lessonError) {
        setErrorMessage(lessonError.message);
        setIsLoading(false);
        return;
      }

      const nextLessons = (lessonRows ?? []) as Lesson[];
      setLessons(nextLessons);

      const lessonIds = nextLessons.map((lesson) => lesson.id);
      if (lessonIds.length > 0) {
        const [{ data: prerequisiteRows }, { data: documentRows }] = await Promise.all([
          supabase
          .from("lesson_prerequisites")
          .select("lesson_id, prerequisite_lesson_id, lessons!lesson_prerequisites_prerequisite_lesson_id_fkey(code, title)")
            .in("lesson_id", lessonIds),
          supabase
            .from("document_files")
            .select("id, lesson_id, source_type, storage_provider, bucket_name, object_key, external_url, display_name, description, mime_type, file_size_bytes, file_category, access_level, status, uploaded_by, created_at")
            .in("lesson_id", lessonIds)
            .eq("status", "active")
            .order("created_at", { ascending: false }),
        ]);

        setPrerequisites((prerequisiteRows ?? []) as unknown as LessonPrerequisiteRow[]);
        setDocumentFiles((documentRows ?? []) as DocumentFile[]);
      }

      setIsLoading(false);
    }

    void loadLessons();
  }, [user]);

  const enrolledPrograms = useMemo(() => {
    const byId = new Map<string, EnrolledProgram>();

    enrollments.forEach((enrollment) => {
      if (enrollment.programs) {
        byId.set(enrollment.program_id, {
          id: enrollment.program_id,
          code: enrollment.programs.code,
          name: enrollment.programs.name,
        });
      }
    });

    return Array.from(byId.values());
  }, [enrollments]);

  const lessonsByModule = useMemo(() => {
    const grouped = new Map<string, Lesson[]>();

    lessons.forEach((lesson) => {
      const current = grouped.get(lesson.module_id) ?? [];
      grouped.set(lesson.module_id, [...current, lesson].sort((a, b) => a.order_no - b.order_no));
    });

    return grouped;
  }, [lessons]);

  const prerequisitesByLesson = useMemo(() => {
    const grouped = new Map<string, LessonPrerequisiteRow[]>();

    prerequisites.forEach((item) => {
      const current = grouped.get(item.lesson_id) ?? [];
      grouped.set(item.lesson_id, [...current, item]);
    });

    return grouped;
  }, [prerequisites]);

  const documentsByLesson = useMemo(() => {
    const grouped = new Map<string, DocumentFile[]>();

    documentFiles.forEach((documentFile) => {
      const current = grouped.get(documentFile.lesson_id) ?? [];
      grouped.set(documentFile.lesson_id, [...current, documentFile]);
    });

    return grouped;
  }, [documentFiles]);

  const openDocumentFile = async (fileId: string) => {
    try {
      const { signedUrl } = await requestSignedDownloadUrl(fileId);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal membuka file.");
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Memuat lesson program...</p>;
  }

  if (errorMessage) {
    return (
      <Alert>
        <AlertTitle>Gagal memuat lesson</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  if (!participant) {
    return (
      <Alert>
        <AlertTitle>Belum terhubung sebagai peserta</AlertTitle>
        <AlertDescription>
          Akun ini belum memiliki participant aktif, jadi lesson program belum bisa ditampilkan.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="page-stack">
      <section className="page-hero">
        <Badge>Program Saya</Badge>
        <h2>Lesson Program</h2>
        <p>
          Daftar lesson yang tampil di sini mengikuti enrollment aktif dan RLS.
          Lesson draft, locked, archived, atau belum waktunya rilis tidak akan
          terlihat oleh peserta.
        </p>
      </section>

      {enrolledPrograms.length === 0 ? (
        <Alert>
          <AlertTitle>Belum ada enrollment aktif</AlertTitle>
          <AlertDescription>
            Setelah enrollment aktif dibuat, modul dan lesson program akan muncul di sini.
          </AlertDescription>
        </Alert>
      ) : (
        enrolledPrograms.map((program) => {
          const programModules = modules
            .filter((module) => module.program_id === program.id)
            .sort((a, b) => a.order_no - b.order_no);

          return (
            <Card key={program.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {program.code} - {program.name}
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  onClick={() => {
                    const enrollment = enrollments.find(e => e.program_id === program.id);
                    if (enrollment) navigate(`/learner/transkrip/${enrollment.id}`);
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Lihat Transkrip
                </Button>
              </CardHeader>
              <CardContent>
                {programModules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada modul yang tersedia untuk program ini.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {programModules.map((module) => {
                      const moduleLessons = lessonsByModule.get(module.id) ?? [];

                      return (
                        <div className="rounded-lg border p-4" key={module.id}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">
                                {module.code} - {module.title}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {module.levels?.name ?? "Tanpa level"} / Urutan {module.order_no}
                              </p>
                            </div>
                            <Badge variant="outline">{moduleLessons.length} lesson</Badge>
                          </div>

                          <div className="mt-3 space-y-2">
                            {moduleLessons.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Belum ada lesson publish untuk modul ini.
                              </p>
                            ) : (
                              moduleLessons.map((lesson) => {
                                const lessonPrerequisites =
                                  prerequisitesByLesson.get(lesson.id) ?? [];
                                const lessonDocuments = documentsByLesson.get(lesson.id) ?? [];

                                return (
                                  <div
                                    className="rounded-md bg-muted px-3 py-2"
                                    key={lesson.id}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-sm font-medium">
                                        {lesson.code} - {lesson.title}
                                      </span>
                                      <Badge>{lesson.lesson_type}</Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Rilis:{" "}
                                      {lesson.release_at
                                        ? new Date(lesson.release_at).toLocaleString("id-ID")
                                        : "langsung tersedia"}
                                    </p>
                                    {lesson.content_body ? (
                                      <p className="mt-2 whitespace-pre-wrap text-sm">
                                        {lesson.content_body}
                                      </p>
                                    ) : null}
                                    {lesson.external_url ? (
                                      <Button asChild className="mt-2" size="sm" variant="outline">
                                        <a href={lesson.external_url} rel="noreferrer" target="_blank">
                                          Buka Link Utama
                                        </a>
                                      </Button>
                                    ) : null}
                                    {lessonPrerequisites.length > 0 ? (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Prerequisite:{" "}
                                        {lessonPrerequisites
                                          .map((item) =>
                                            item.lessons
                                              ? `${item.lessons.code} - ${item.lessons.title}`
                                              : item.prerequisite_lesson_id,
                                          )
                                          .join(", ")}
                                      </p>
                                    ) : null}
                                    {lessonDocuments.length > 0 ? (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {lessonDocuments.map((documentFile) => (
                                          <Button
                                            key={documentFile.id}
                                            onClick={() => void openDocumentFile(documentFile.id)}
                                            size="sm"
                                            variant="outline"
                                          >
                                            {documentFile.display_name}
                                          </Button>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
