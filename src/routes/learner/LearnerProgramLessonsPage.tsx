import { LearningCards } from "../../components/learner/LearningCards";
import { useEffect, useState, useMemo } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Input } from "@/components/ui/input";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Search } from "lucide-react";
import type { Enrollment, Participant } from "../../lib/enrollment";
import { supabase } from "../../lib/supabase";

export function LearnerProgramLessonsPage() {

  const { user } = useAuthSession();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // UI States

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

  return <div className="page-stack learner-program-directory">
    <header className="learner-section-heading"><h1>Program saya</h1></header>
    <label className="learner-program-search"><Search size={18} /><Input aria-label="Cari program" placeholder="Cari program…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label>
    {filteredPrograms.length === 0 && searchQuery ? <p role="status">Program tidak ditemukan. Coba kata lain.</p> : <LearningCards enrollments={filteredPrograms.map((item) => item.enrollment)} />}
  </div>;
}
