import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Users, Calendar, ClipboardCheck } from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function TeacherClassDashboardPage() {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useAuthSession();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [classData, setClassData] = useState<any>(null);

  useEffect(() => {
    if (!user || !classId) return;
    
    let isMounted = true;
    async function loadData() {
      try {
        const { data, error } = await supabase
          .from("classes")
          .select("id, name, code, capacity, programs(id, name)")
          .eq("id", classId)
          .eq("teacher_user_id", user!.id)
          .single();

        if (error) throw error;
        if (isMounted) setClassData(data);
      } catch (err: any) {
        if (isMounted) setErrorMessage("Kelas tidak ditemukan atau Anda tidak memiliki akses ke kelas ini.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    
    loadData();
    return () => { isMounted = false; };
  }, [classId, user]);

  if (isLoading) return <FullPageLoader message="Memuat ruang kelas..." />;

  if (errorMessage || !classData) {
    return (
      <div className="page-stack max-w-4xl mx-auto mt-10">
        <Alert className="border-red-500 bg-red-50 text-red-900">
          <AlertTitle>Gagal Memuat Kelas</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/teacher/kelas"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Kelas</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="page-stack max-w-6xl mx-auto">
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild className="-ml-3 text-slate-500 hover:text-slate-900 mb-2">
          <Link to="/teacher/kelas"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link>
        </Button>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">{classData.name} ({classData.code})</h2>
        <p className="text-muted-foreground mt-1">Bagian dari program: <span className="font-medium text-slate-700">{classData.programs?.name}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-2">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-lg text-slate-900">Daftar Peserta</h3>
            <p className="text-sm text-slate-500">Kelola dan lihat perkembangan murid di kelas ini.</p>
            <Button variant="outline" className="w-full mt-4" disabled>Segera Hadir</Button>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-lg text-slate-900">Penilaian</h3>
            <p className="text-sm text-slate-500">Berikan nilai untuk tugas, kuis, atau setoran.</p>
            <Button variant="outline" className="w-full mt-4" disabled>Segera Hadir</Button>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-2">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-lg text-slate-900">Jadwal & Presensi</h3>
            <p className="text-sm text-slate-500">Kelola jadwal pertemuan (halaqah) dan absensi.</p>
            <Button variant="outline" className="w-full mt-4" disabled>Segera Hadir</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
