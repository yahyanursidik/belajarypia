import { useEffect, useState } from "react";
import { BookOpen, Users, ArrowRight, GraduationCap, Clock, CalendarDays, BookMarked } from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";

type AssignedProgram = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  curriculum_model: string;
  status: string;
  enrollments?: Array<{ id: string }>;
};

type AssignedClass = {
  id: string;
  name: string;
  code: string;
  capacity: number | null;
  programs: {
    id: string;
    name: string;
  } | null;
};

export function TeacherClassPage() {
  const { user } = useAuthSession();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [programs, setPrograms] = useState<AssignedProgram[]>([]);
  const [classes, setClasses] = useState<AssignedClass[]>([]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [progRes, classRes] = await Promise.all([
          supabase
            .from("programs")
            .select("id, name, code, description, curriculum_model, status, enrollments(id)")
            .eq("teacher_user_id", user!.id),
          supabase
            .from("classes")
            .select("id, name, code, capacity, programs(id, name)")
            .eq("teacher_user_id", user!.id)
        ]);

        if (progRes.error) throw progRes.error;
        if (classRes.error) throw classRes.error;

        if (isMounted) {
          setPrograms(progRes.data as unknown as AssignedProgram[]);
          setClasses(classRes.data as unknown as AssignedClass[]);
        }
      } catch (err: any) {
        if (isMounted) setErrorMessage(err.message || "Gagal memuat data kelas.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (isLoading) {
    return <FullPageLoader message="Memuat kelas Anda..." />;
  }

  const hasData = programs.length > 0 || classes.length > 0;

  return (
    <div className="page-stack max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Kelas Saya</h2>
          <p className="text-muted-foreground mt-1">Daftar program dan kelas yang berada di bawah tanggung jawab Anda.</p>
        </div>
      </div>

      {errorMessage && (
        <Alert className="animate-in fade-in slide-in-from-top-2 border-red-500 bg-red-50 text-red-900 mb-6">
          <AlertTitle>Gagal Memuat Data</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {!hasData && !errorMessage ? (
        <EmptyState
          title="Belum Ada Kelas"
          description="Anda belum ditugaskan sebagai pengampu program atau pengajar kelas saat ini. Silakan hubungi Administrator jika ini sebuah kesalahan."
          className="mt-10"
        />
      ) : (
        <div className="space-y-10">
          
          {/* BAGIAN PROGRAM */}
          {programs.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h3 className="text-xl font-bold text-slate-800">Program yang Anda Ampu</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {programs.map((prog) => (
                  <Card key={prog.id} className="flex flex-col overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 group bg-white">
                    <div className="h-2 bg-blue-500 w-full" />
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {prog.code}
                        </Badge>
                        <Badge variant={prog.status === "active" ? "default" : "secondary"} className="capitalize text-[10px] h-5 shadow-sm">
                          {prog.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl leading-tight group-hover:text-blue-700 transition-colors">
                        {prog.name}
                      </CardTitle>
                      <p className="text-sm text-slate-500 line-clamp-2 mt-2 h-10">
                        {prog.description || "Tidak ada deskripsi."}
                      </p>
                    </CardHeader>
                    <CardContent className="pb-4 flex-1">
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2">
                            {prog.curriculum_model === "mandiri" ? <Clock className="h-4 w-4 text-slate-400" /> : <CalendarDays className="h-4 w-4 text-slate-400" />}
                            <span>Sistem Belajar</span>
                          </div>
                          <span className="font-medium capitalize">{prog.curriculum_model}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-400" />
                            <span>Total Peserta</span>
                          </div>
                          <span className="font-medium">{prog.enrollments?.length || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                    <div className="pt-0 pb-4 px-4 mt-auto">
                      <Button variant="default" className="w-full rounded-xl shadow-sm bg-blue-600 hover:bg-blue-700 text-white" disabled>
                        Kelola Program <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* BAGIAN KELAS */}
          {classes.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <GraduationCap className="h-5 w-5 text-emerald-600" />
                <h3 className="text-xl font-bold text-slate-800">Kelas yang Anda Ajar</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map((cls) => (
                  <Card key={cls.id} className="flex flex-col overflow-hidden border-border/50 hover:shadow-lg transition-all duration-300 group bg-white">
                    <div className="h-2 bg-emerald-500 w-full" />
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {cls.code}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl leading-tight group-hover:text-emerald-700 transition-colors">
                        {cls.name}
                      </CardTitle>
                      <p className="text-sm text-slate-500 mt-2 font-medium">
                        Bagian dari: {cls.programs?.name || "Program tidak diketahui"}
                      </p>
                    </CardHeader>
                    <CardContent className="pb-4 flex-1">
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-400" />
                            <span>Kapasitas</span>
                          </div>
                          <span className="font-medium">{cls.capacity ? `${cls.capacity} Peserta` : "Tidak Dibatasi"}</span>
                        </div>
                      </div>
                    </CardContent>
                    <div className="pt-0 pb-4 px-4 mt-auto">
                      <Button variant="default" className="w-full rounded-xl shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white" disabled>
                        Kelola Kelas <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
