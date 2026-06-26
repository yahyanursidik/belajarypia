import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Search, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "../../lib/supabase";

type ReportData = {
  enrollment_id: string;
  participant_id: string;
  full_name: string;
  email: string;
  progress_percent: number;
  average_score: number;
  predicate: string;
  completed_lessons: number;
  total_lessons: number;
};

export function AdminProgramReportPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  
  const [programName, setProgramName] = useState("");
  const [reports, setReports] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchReportData() {
      if (!programId) return;
      setIsLoading(true);

      // Fetch Program Info & Rubric
      const { data: prog } = await supabase.from("programs").select("name, grading_rubric").eq("id", programId).single();
      let rubric: any[] = [];
      if (prog) {
        setProgramName(prog.name);
        rubric = prog.grading_rubric || [];
      }

      // Fetch enrollments and participants
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, participant_id, participants(profiles(full_name, email))")
        .eq("program_id", programId);

      // Fetch total lessons for this program via 2-step fetch:
      const { data: modules } = await supabase.from("program_modules").select("id").eq("program_id", programId);
      const moduleIds = (modules || []).map(m => m.id);
      
      let totalLessons = 0;
      if (moduleIds.length > 0) {
        const { count } = await supabase.from("lessons").select("*", { count: "exact", head: true }).in("module_id", moduleIds);
        totalLessons = count || 0;
      }

      // Fetch progress for these enrollments
      const enrollmentIds = (enrollments || []).map(e => e.id);
      let progresses: any[] = [];
      if (enrollmentIds.length > 0) {
        const { data: pData } = await supabase.from("lesson_progresses").select("*").in("enrollment_id", enrollmentIds);
        progresses = pData || [];
      }

      // Map data
      const mappedData: ReportData[] = (enrollments || []).map(en => {
        const profile = (en.participants as any)?.profiles;
        const enProgresses = progresses.filter(p => p.enrollment_id === en.id);
        const completed = enProgresses.filter(p => p.status === "completed");
        const scores = enProgresses.filter(p => p.score !== null).map(p => p.score);
        
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const progressPercent = totalLessons > 0 ? Math.round((completed.length / totalLessons) * 100) : 0;
        
        let predicate = "-";
        if (scores.length > 0 && rubric.length > 0) {
          const matched = rubric.find(r => avgScore >= r.min_score && avgScore <= r.max_score);
          if (matched) predicate = matched.label;
        }

        return {
          enrollment_id: en.id,
          participant_id: en.participant_id,
          full_name: profile?.full_name || "Tanpa Nama",
          email: profile?.email || "-",
          progress_percent: progressPercent,
          average_score: Math.round(avgScore),
          predicate,
          completed_lessons: completed.length,
          total_lessons: totalLessons,
        };
      });

      setReports(mappedData);
      setIsLoading(false);
    }

    void fetchReportData();
  }, [programId]);

  const filteredReports = reports.filter(r => 
    r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-stack">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" className="h-10 w-10 p-0 rounded-full shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold truncate">Laporan Akademik</h2>
          <p className="text-muted-foreground">{programName}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Progres Peserta</CardTitle>
          <div className="flex gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari peserta..."
                className="pl-9"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline"><Download className="h-4 w-4 mr-2"/> Export CSV</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground animate-pulse">Memuat laporan...</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Peserta</th>
                    <th>Penyelesaian Materi</th>
                    <th>Rata-rata Kuis</th>
                    <th>Predikat</th>
                    <th>Status Progres</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Tidak ada data.</td></tr>
                  ) : (
                    filteredReports.map(r => (
                      <tr key={r.enrollment_id}>
                        <td>
                          <p className="font-medium">{r.full_name}</p>
                          <p className="text-xs text-muted-foreground">{r.email}</p>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-muted rounded-full h-2.5 w-24 overflow-hidden">
                              <div className="bg-primary h-2.5 rounded-full" style={{ width: `${r.progress_percent}%` }}></div>
                            </div>
                            <span className="text-sm font-medium">{r.progress_percent}%</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{r.completed_lessons} dari {r.total_lessons} Selesai</p>
                        </td>
                        <td>
                          <span className={`font-semibold ${r.average_score >= 70 ? 'text-emerald-600' : r.average_score > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                            {r.average_score > 0 ? r.average_score : "-"}
                          </span>
                        </td>
                        <td>
                          <span className="font-medium text-sm">{r.predicate}</span>
                        </td>
                        <td>
                          {r.progress_percent === 100 ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle className="h-3 w-3 mr-1"/> Selesai</Badge>
                          ) : r.progress_percent > 0 ? (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50"><Clock className="h-3 w-3 mr-1"/> Berjalan</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Belum Mulai</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
