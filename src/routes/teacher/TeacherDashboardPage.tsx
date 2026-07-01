import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Users, ClipboardCheck, ArrowRight, BookMarked, User } from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";

interface DashboardMetrics {
  totalPrograms: number;
  totalClasses: number;
}

export function TeacherDashboardPage() {
  const { user, profile } = useAuthSession();
  const [metrics, setMetrics] = useState<DashboardMetrics>({ totalPrograms: 0, totalClasses: 0 });
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    
    async function fetchDashboardData() {
      try {
        // Fetch Programs Count
        const { count: programsCount } = await supabase
          .from("programs")
          .select("*", { count: "exact", head: true })
          .eq("teacher_user_id", user!.id);
          
        // Fetch Classes Count
        const { count: classesCount } = await supabase
          .from("classes")
          .select("*", { count: "exact", head: true })
          .eq("teacher_user_id", user!.id);
          
        // Fetch Recent Classes
        const { data: recentClassesData } = await supabase
          .from("classes")
          .select("id, name, code, created_at, programs(name)")
          .eq("teacher_user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(3);

        // Fetch Recent Programs
        const { data: recentProgramsData, error: progErr } = await supabase
          .from("programs")
          .select("id, name, code, curriculum_model, created_at")
          .eq("teacher_user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(3);

        if (progErr) console.error("Error fetching recent programs:", progErr);

        if (isMounted) {
          setMetrics({
            totalPrograms: programsCount || 0,
            totalClasses: classesCount || 0
          });
          
          // Combine and sort
          const combined = [
            ...(recentClassesData || []).map(c => ({ ...c, itemType: 'class' })),
            ...(recentProgramsData || []).map(p => ({ ...p, itemType: 'program' }))
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3);
          
          setRecentItems(combined);
        }
      } catch (error) {
        console.error("Error fetching teacher dashboard data:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    
    fetchDashboardData();
    
    return () => { isMounted = false; };
  }, [user]);

  // Extract first name for a friendly greeting
  const firstName = profile?.full_name?.split(' ')[0] || "Ustadz/ah";

  return (
    <div className="page-stack space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-primary text-white p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Ahlan wa Sahlan, {firstName}!</h1>
            <p className="text-primary-foreground/90 max-w-xl text-lg mt-2">
              Semoga Allah senantiasa memberikan kemudahan dalam setiap langkah pengabdian Anda dalam mendidik generasi umat.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center min-w-[150px]">
            <p className="text-sm font-medium text-white/80">Tanggal</p>
            <p className="text-xl font-bold mt-1">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 opacity-10 pointer-events-none">
          <BookOpen className="w-96 h-96" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Column: Metrics & Recent Classes */}
        <div className="md:col-span-8 space-y-6">
          
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 rounded-xl bg-blue-50 text-blue-600">
                  <BookMarked className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Program Diampu</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <h3 className="text-3xl font-bold text-slate-900">{metrics.totalPrograms}</h3>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600">
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Kelas Aktif</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <h3 className="text-3xl font-bold text-slate-900">{metrics.totalClasses}</h3>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Items Table */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Program & Kelas Terbaru</CardTitle>
                <CardDescription>Akses cepat ke amanah yang Anda kelola.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="hidden sm:flex text-primary">
                <Link to="/teacher/kelas">Lihat Semua</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3 mt-4">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : recentItems.length > 0 ? (
                <div className="space-y-3 mt-4">
                  {recentItems.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-md border border-slate-200 text-slate-500 hidden sm:block">
                          {item.itemType === 'class' ? <Users className="w-5 h-5" /> : <BookMarked className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 leading-none mb-1.5">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.itemType === 'class' 
                              ? `${item.code} • ${item.programs?.name || "Program Reguler"}`
                              : `${item.code || "Program"} • ${item.curriculum_model === 'cohort' ? 'Angkatan (Cohort)' : 'Mandiri (Self-paced)'}`}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild className="shrink-0 bg-white hover:bg-primary hover:text-white">
                        <Link to={item.itemType === 'class' ? `/teacher/kelas/${item.id}` : `/teacher/kelas/program/${item.id}`}>
                          {item.itemType === 'class' ? 'Buka Kelas' : 'Kelola Program'}
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 mt-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="font-medium text-slate-900">Belum Ada Amanah</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                    Anda belum ditugaskan untuk mengampu program atau kelas apapun saat ini. Hubungi admin jika ini merupakan sebuah kesalahan.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Quick Actions */}
        <div className="md:col-span-4 space-y-6">
          <Card className="bg-white border-slate-200 shadow-sm sticky top-6">
            <CardHeader>
              <CardTitle>Akses Cepat</CardTitle>
              <CardDescription>Pintasan ke fitur-fitur penting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              
              <Link to="/teacher/kelas" className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 group-hover:text-primary transition-colors">Kelas Saya</p>
                  <p className="text-xs text-slate-500">Kelola kurikulum & peserta</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
              </Link>
              
              <Link to="/teacher/review" className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-amber-500/30 hover:bg-amber-50 transition-all group">
                <div className="p-2.5 rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 group-hover:text-amber-700 transition-colors">Penilaian</p>
                  <p className="text-xs text-slate-500">Review tugas murid</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
              </Link>

              <Link to="/teacher/profil" className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group mt-2">
                <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900 transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Profil Akun</p>
                  <p className="text-xs text-slate-500">Ubah info & kata sandi</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
              </Link>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
