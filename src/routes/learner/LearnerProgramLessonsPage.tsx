import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { BookOpen, LayoutGrid, List, Search } from "lucide-react";
import type { Enrollment, Participant } from "../../lib/enrollment";
import { supabase } from "../../lib/supabase";

export function LearnerProgramLessonsPage() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // UI States
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadPrograms() {
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
      } else {
        setEnrollments((enrollmentRows ?? []) as unknown as Enrollment[]);
      }

      setIsLoading(false);
    }

    void loadPrograms();
  }, [user]);

  // Deduplicate programs and apply search filter
  const filteredPrograms = useMemo(() => {
    const unique = Array.from(
      new Map(enrollments.map((e) => [e.program_id, { id: e.program_id, code: e.programs?.code || "", name: e.programs?.name || "", enrollment: e }])).values()
    );
    
    if (!searchQuery) return unique;
    
    const lowerQuery = searchQuery.toLowerCase();
    return unique.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      p.code.toLowerCase().includes(lowerQuery) ||
      p.enrollment.enrollment_number.toLowerCase().includes(lowerQuery)
    );
  }, [enrollments, searchQuery]);

  if (isLoading) {
    return <FullPageLoader message="Memuat program Anda..." />;
  }

  if (errorMessage) {
    return (
      <div className="p-4">
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>Gagal memuat program</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="p-4">
        <Alert>
          <AlertTitle>Belum terhubung sebagai peserta</AlertTitle>
          <AlertDescription>
            Akun ini belum memiliki profil peserta aktif.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-stack w-full">
      <section className="page-hero mb-8">
        <Badge className="mb-2">Program Saya</Badge>
        <h2>Direktori Program</h2>
        <p>
          Pilih program di bawah ini untuk melihat silabus, modul materi, serta sertifikat/syahadah Anda.
        </p>
      </section>

      {/* Toolbar: Search and View Mode */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cari nama program, kode, atau ID pendaftaran..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm w-full sm:w-auto shrink-0 justify-center">
          <Button 
            variant={viewMode === "grid" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setViewMode("grid")}
            className="h-8 px-3"
          >
            <LayoutGrid className="w-4 h-4 mr-2" /> Grid
          </Button>
          <Button 
            variant={viewMode === "list" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setViewMode("list")}
            className="h-8 px-3"
          >
            <List className="w-4 h-4 mr-2" /> List
          </Button>
        </div>
      </div>

      {enrollments.length === 0 ? (
        <Alert>
          <AlertTitle>Belum ada program aktif</AlertTitle>
          <AlertDescription>
            Anda belum terdaftar di program mana pun. Silakan mendaftar melalui Katalog Program.
          </AlertDescription>
        </Alert>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center p-12 text-slate-500 border border-dashed rounded-lg bg-slate-50/50">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Tidak ada program yang cocok dengan pencarian "{searchQuery}".</p>
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-4"}>
          {filteredPrograms.map((program) => 
            viewMode === "grid" ? (
              <Card key={program.id} className="flex flex-col h-full hover:shadow-md transition-shadow overflow-hidden border-slate-200">
                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                  <Badge variant="outline" className="w-fit mb-2 bg-white">{program.code}</Badge>
                  <CardTitle className="text-xl leading-tight">
                    {program.name}
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-2 font-mono bg-slate-100 px-2 py-1 rounded w-fit">
                    ID: {program.enrollment.enrollment_number}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center p-6 pt-6">
                  <Button size="lg" className="w-full mt-auto" onClick={() => navigate(`/learner/program/${program.id}`)}>
                    <BookOpen className="h-5 w-5 mr-2" />
                    Masuk ke Kelas
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card key={program.id} className="flex flex-row items-center justify-between p-4 sm:p-5 hover:shadow-md transition-shadow border-slate-200 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="outline" className="bg-slate-50">{program.code}</Badge>
                    <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                      ID: {program.enrollment.enrollment_number}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base sm:text-lg text-slate-900 leading-tight">
                    {program.name}
                  </h3>
                </div>
                <Button size="sm" className="shrink-0 hidden sm:flex" onClick={() => navigate(`/learner/program/${program.id}`)}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Masuk
                </Button>
                <Button size="icon" className="shrink-0 sm:hidden h-9 w-9" onClick={() => navigate(`/learner/program/${program.id}`)}>
                  <BookOpen className="h-4 w-4" />
                </Button>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
