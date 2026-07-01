import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronDown, ChevronRight, Circle, FileText, PlayCircle } from "lucide-react";
import type { Enrollment } from "../../lib/enrollment";
import type { ProgramModule, Lesson } from "../../lib/academic";
import { SyahadahSection } from "./SyahadahSection";

export function LearnerProgramDetailPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  
  const [program, setProgram] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [modules, setModules] = useState<ProgramModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadSyllabus() {
      if (!user || !programId) return;

      setIsLoading(true);
      setErrorMessage(null);

      // 1. Get participant
      const { data: participantRow } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!participantRow) {
        setErrorMessage("Anda tidak terdaftar sebagai peserta.");
        setIsLoading(false);
        return;
      }

      // 2. Check enrollment for this program
      const { data: enrollmentRow, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("id, program_id, enrollment_status, programs(id, code, name)")
        .eq("participant_id", participantRow.id)
        .eq("program_id", programId)
        .eq("enrollment_status", "active")
        .maybeSingle();

      if (enrollmentError || !enrollmentRow) {
        setErrorMessage("Anda belum terdaftar aktif pada program ini.");
        setIsLoading(false);
        return;
      }

      setEnrollment(enrollmentRow as unknown as Enrollment);
      setProgram(enrollmentRow.programs);

      // 3. Load Modules
      const { data: moduleRows, error: moduleError } = await supabase
        .from("program_modules")
        .select("id, program_id, code, title, module_type, order_no, levels(name)")
        .eq("program_id", programId)
        .order("order_no", { ascending: true });

      if (moduleError) {
        setErrorMessage(moduleError.message);
        setIsLoading(false);
        return;
      }

      const nextModules = (moduleRows ?? []) as unknown as ProgramModule[];
      setModules(nextModules);

      // 4. Load Lessons for those modules
      const moduleIds = nextModules.map(m => m.id);
      if (moduleIds.length > 0) {
        const { data: lessonRows, error: lessonError } = await supabase
          .from("lessons")
          .select("id, module_id, code, title, lesson_type, order_no, release_at")
          .in("module_id", moduleIds)
          .or(`release_at.lte.${new Date().toISOString()},release_at.is.null`)
          .order("order_no", { ascending: true });

        if (!lessonError) {
          setLessons((lessonRows ?? []) as Lesson[]);
        }
        
        // Auto-expand first module
        if (nextModules.length > 0) {
          setExpandedModules({ [nextModules[0].id]: true });
        }
      }

      setIsLoading(false);
    }

    void loadSyllabus();
  }, [user, programId]);

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAll = () => {
    const allIds = modules.reduce((acc, m) => ({ ...acc, [m.id]: true }), {});
    setExpandedModules(allIds);
  };

  const collapseAll = () => {
    setExpandedModules({});
  };

  if (isLoading) {
    return <FullPageLoader message="Memuat silabus program..." />;
  }

  if (errorMessage) {
    return (
      <div className="page-stack max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/learner/program-saya")} className="w-fit mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Program Saya
        </Button>
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>Tidak dapat memuat program</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "video": return <PlayCircle className="w-4 h-4 text-primary" />;
      case "quiz": return <CheckCircle2 className="w-4 h-4 text-orange-500" />;
      default: return <FileText className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="page-stack w-full">
      <Button variant="ghost" onClick={() => navigate("/learner/program-saya")} className="w-fit">
        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
      </Button>

      <section className="page-hero bg-primary rounded-xl p-8 mb-8 text-white">
        <Badge className="bg-white/20 hover:bg-white/30 text-white border-none mb-4">{program?.code}</Badge>
        <h1 className="text-3xl font-bold text-white mb-2">{program?.name}</h1>
        <p className="text-white/90 mb-6 max-w-2xl">
          Pelajari modul-modul di bawah ini secara berurutan. Klik pada salah satu materi untuk mulai belajar.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate(`/learner/transkrip/${enrollment?.id}`)} variant="outline" className="bg-white text-primary hover:bg-slate-100 border-none">
            Lihat Transkrip Nilai
          </Button>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <h3 className="text-lg font-bold">Struktur Kurikulum</h3>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={expandAll} className="flex-1 sm:flex-none text-xs">
            Buka Semua
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} className="flex-1 sm:flex-none text-xs">
            Tutup Semua
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {modules.length === 0 ? (
          <div className="text-center p-12 border border-dashed rounded-lg text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Belum ada silabus / modul untuk program ini.</p>
          </div>
        ) : (
          modules.map((module) => {
            const moduleLessons = lessons.filter(l => l.module_id === module.id);
            const isExpanded = !!expandedModules[module.id];

            return (
              <Card key={module.id} className="overflow-hidden shadow-sm border-slate-200">
                <div 
                  className="bg-slate-50 p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-between"
                  onClick={() => toggleModule(module.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        {module.code} - {module.title}
                      </h4>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {module.levels?.name ?? "Modul Umum"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-white hidden sm:flex">
                    {moduleLessons.length} Materi
                  </Badge>
                </div>
                
                {isExpanded && (
                  <CardContent className="p-0">
                    {moduleLessons.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500 italic">
                        Belum ada materi dirilis untuk modul ini.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100 bg-white">
                        {moduleLessons.map((lesson) => (
                          <li key={lesson.id}>
                            <Link 
                              to={`/learner/lesson/${lesson.id}`}
                              className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                  {getLessonIcon(lesson.lesson_type)}
                                </div>
                                <div>
                                  <h4 className="font-medium text-slate-700 group-hover:text-primary transition-colors">
                                    {lesson.title}
                                  </h4>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                    <span className="capitalize">{lesson.lesson_type.replace('_', ' ')}</span>
                                    {lesson.release_at && (
                                      <>
                                        <Circle className="w-1 h-1 fill-slate-300" />
                                        <span>Dirilis {new Date(lesson.release_at).toLocaleDateString('id-ID')}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10 hover:text-primary">
                                Mulai
                              </Button>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      {enrollment && (
        <div className="mt-12 border-t pt-8">
          <h3 className="font-semibold text-lg mb-4">Sertifikat / Syahadah</h3>
          <SyahadahSection enrollmentId={enrollment.id} />
        </div>
      )}
    </div>
  );
}
