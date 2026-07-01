import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Users, ArrowRight, GraduationCap, Clock, CalendarDays, Search } from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = async () => {
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

      setPrograms(progRes.data as unknown as AssignedProgram[]);
      setClasses(classRes.data as unknown as AssignedClass[]);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memuat data kelas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filteredPrograms = useMemo(() => {
    if (!searchTerm) return programs;
    return programs.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [programs, searchTerm]);

  const filteredClasses = useMemo(() => {
    if (!searchTerm) return classes;
    return classes.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [classes, searchTerm]);

  const renderSkeletons = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="flex flex-col h-[280px]">
          <Skeleton className="h-1.5 w-full rounded-t-xl" />
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start mb-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
            <Skeleton className="h-6 w-3/4 mt-2" />
            <Skeleton className="h-4 w-full mt-3" />
            <Skeleton className="h-4 w-2/3 mt-1" />
          </CardHeader>
          <CardContent className="mt-auto pb-4">
            <Skeleton className="h-10 w-full rounded-xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="page-stack max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Kelas Saya</h2>
          <p className="text-muted-foreground mt-1">Kelola program dan ruang kelas Anda secara profesional.</p>
        </div>
        
        {/* Search Bar */}
        {(!isLoading || programs.length > 0 || classes.length > 0) && (
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Cari program / kelas..." 
              className="pl-9 h-11 bg-white border-slate-200 shadow-sm rounded-full focus-visible:ring-blue-500/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {errorMessage && (
        <Alert className="animate-in fade-in slide-in-from-top-2 border-red-500 bg-red-50 text-red-900 mb-6">
          <AlertTitle>Gagal Memuat Data</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
          <Button variant="outline" size="sm" onClick={loadData} className="mt-3 bg-white text-red-700 hover:bg-red-50">
            Coba Lagi
          </Button>
        </Alert>
      )}

      {isLoading && !errorMessage ? (
        <div className="mt-8 space-y-6 animate-in fade-in">
          <div className="flex gap-2 mb-6">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
          {renderSkeletons()}
        </div>
      ) : (!isLoading && programs.length === 0 && classes.length === 0 && !errorMessage) ? (
        <EmptyState
          title="Belum Ada Penugasan"
          description="Anda belum ditugaskan sebagai pengampu program atau pengajar kelas saat ini. Hubungi tim administrasi untuk pengaturan lebih lanjut."
          className="mt-10 py-16"
        />
      ) : (!isLoading) && (
        <Tabs defaultValue={programs.length > 0 ? "program" : "kelas"} className="mt-6">
          <TabsList className="bg-slate-100 p-1 mb-6 rounded-lg">
            {programs.length > 0 && (
              <TabsTrigger value="program" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
                <BookOpen className="mr-2 h-4 w-4" /> Program ({filteredPrograms.length})
              </TabsTrigger>
            )}
            {classes.length > 0 && (
              <TabsTrigger value="kelas" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
                <GraduationCap className="h-5 w-5 text-primary" /> Kelas ({filteredClasses.length})
              </TabsTrigger>
            )}
          </TabsList>

          {programs.length > 0 && (
            <TabsContent value="program" className="m-0 animate-in fade-in">
              {filteredPrograms.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed">
                  Program tidak ditemukan.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPrograms.map((prog) => (
                    <Card key={prog.id} className="flex flex-col overflow-hidden border-border/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 group bg-white hover:-translate-y-1">
                      <div className="h-1.5 bg-primary/80 w-full transition-all group-hover:bg-primary" />
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                            {prog.code}
                          </Badge>
                          <Badge variant={prog.status === "active" ? "default" : "secondary"} className="capitalize text-[10px] h-5 shadow-sm">
                            {prog.status}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl leading-tight group-hover:text-primary transition-colors">
                          {prog.name}
                        </CardTitle>
                        <p className="text-sm text-slate-500 line-clamp-2 mt-2 h-10">
                          {prog.description || "Tidak ada deskripsi."}
                        </p>
                      </CardHeader>
                      <CardContent className="pb-4 flex-1">
                        <div className="space-y-2 mt-2">
                          <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2">
                              {prog.curriculum_model === "mandiri" ? <Clock className="h-4 w-4 text-slate-400" /> : <CalendarDays className="h-4 w-4 text-slate-400" />}
                              <span>Sistem Belajar</span>
                            </div>
                            <span className="font-medium capitalize">{prog.curriculum_model}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" />
                              <span>Total Peserta</span>
                            </div>
                            <span className="font-medium">{prog.enrollments?.length || 0}</span>
                          </div>
                        </div>
                      </CardContent>
                      <div className="pt-0 pb-4 px-4 mt-auto">
                        <Button variant="default" className="w-full rounded-xl shadow-sm hover:shadow-md transition-all p-0">
                          <Link to={`/teacher/kelas/program/${prog.id}`} className="flex items-center justify-center w-full h-full text-white hover:text-white">
                            Kelola Program <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {classes.length > 0 && (
            <TabsContent value="kelas" className="m-0 animate-in fade-in">
              {filteredClasses.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed">
                  Kelas tidak ditemukan.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClasses.map((cls) => (
                    <Card key={cls.id} className="flex flex-col overflow-hidden border-border/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 group bg-white hover:-translate-y-1">
                      <div className="h-1.5 bg-primary/80 w-full transition-all group-hover:bg-primary" />
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                            {cls.code}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl leading-tight group-hover:text-primary transition-colors">
                          {cls.name}
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-2 font-medium">
                          Bagian dari: <span className="text-slate-700">{cls.programs?.name || "Program tidak diketahui"}</span>
                        </p>
                      </CardHeader>
                      <CardContent className="pb-4 flex-1">
                        <div className="space-y-2 mt-2">
                          <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" />
                              <span>Kapasitas</span>
                            </div>
                            <span className="font-medium">{cls.capacity ? `${cls.capacity} Peserta` : "Tanpa Batas"}</span>
                          </div>
                        </div>
                      </CardContent>
                      <div className="pt-0 pb-4 px-4 mt-auto">
                        <Button variant="default" className="w-full rounded-xl shadow-sm hover:shadow-md transition-all p-0">
                          <Link to={`/teacher/kelas/${cls.id}`} className="flex items-center justify-center w-full h-full text-white hover:text-white">
                            Kelola Kelas <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

        </Tabs>
      )}
    </div>
  );
}
