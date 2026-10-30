import { LearningCards } from "../../components/learner/LearningCards";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Megaphone, CalendarClock, ClipboardCheck, ArrowRight } from "lucide-react";
import type { Enrollment, OnboardingProgress, Participant } from "../../lib/enrollment";
import {
  formatRegistrationDateTime,
  getRegistrationWindowState,
  type RegistrationForm,
  type RegistrationWindowState,
} from "../../lib/admission";
import { supabase } from "../../lib/supabase";

type AvailableProgram = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  feature_flags?: {
    use_direct_enrollment?: boolean;
  } | null;
};

export function LearnerDashboardPage() {
  const { user } = useAuthSession();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingProgress[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<AvailableProgram[]>([]);
  const [registrationFormsByProgramId, setRegistrationFormsByProgramId] = useState<Record<string, RegistrationForm>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState<string | null>(null);

  useEffect(() => {
    async function loadLearnerData() {
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
          "id, participant_id, program_id, batch_id, class_id, halaqah_id, enrollment_number, enrollment_status, payment_status, programs(id, name, code, feature_flags), batches(name, code), classes(name, code), halaqahs(name, code)",
        )
        .eq("participant_id", currentParticipant.id)
        .order("created_at", { ascending: false });

      if (enrollmentError) {
        setErrorMessage(enrollmentError.message);
        setIsLoading(false);
        return;
      }

      const nextEnrollments = (enrollmentRows ?? []) as unknown as Enrollment[];
      setEnrollments(nextEnrollments);

      const enrollmentIds = nextEnrollments.map((enrollment) => enrollment.id);
      if (enrollmentIds.length > 0) {
        const { data: onboardingRows } = await supabase
          .from("onboarding_progresses")
          .select("id, enrollment_id, status")
          .in("enrollment_id", enrollmentIds);

        setOnboarding((onboardingRows ?? []) as OnboardingProgress[]);
      }

      // Fetch Announcements
      const { data: annRows } = await supabase
        .from("announcements")
        .select("*")
        .eq("status", "published")
        .in("target_role", ["all", "participant"])
        .order("created_at", { ascending: false });

      if (annRows) {
        const enrolledProgramIds = nextEnrollments.map(e => e.program_id);
        const filteredAnns = annRows.filter(a => {
           if (!a.target_program_id) return true;
           return enrolledProgramIds.includes(a.target_program_id);
        });
        setAnnouncements(filteredAnns);
      }


      const { data: allProgramsData } = await supabase
        .from("programs")
        .select("id, name, code, description, feature_flags")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (allProgramsData) {
        const enrolledProgramIds = nextEnrollments.map((e) => e.program_id);
        const available = allProgramsData
          .filter((p) => !enrolledProgramIds.includes(p.id))
          .sort((a, b) => {
            const aActive = a.feature_flags?.use_direct_enrollment === true;
            const bActive = b.feature_flags?.use_direct_enrollment === true;
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            return 0;
          });
        setAvailablePrograms(available as AvailableProgram[]);

        const availableProgramIds = available.map((program) => program.id);
        if (availableProgramIds.length > 0) {
          const formResult = await supabase
            .from("registration_forms")
            .select("id, program_id, title, description, status, registration_open_at, registration_close_at, group_settings")
            .in("program_id", availableProgramIds)
            .eq("status", "active")
            .order("created_at", { ascending: false });

          let formRows: unknown[] | null = formResult.data;

          if (
            formResult.error?.message.includes("registration_open_at") ||
            formResult.error?.message.includes("registration_close_at")
          ) {
            const fallback = await supabase
              .from("registration_forms")
              .select("id, program_id, title, description, status, group_settings")
              .in("program_id", availableProgramIds)
              .eq("status", "active")
              .order("created_at", { ascending: false });

            formRows = fallback.data;
          }

          const formMap: Record<string, RegistrationForm> = {};
          for (const form of (formRows ?? []) as RegistrationForm[]) {
            if (form.program_id && !formMap[form.program_id]) {
              formMap[form.program_id] = form as RegistrationForm;
            }
          }
          setRegistrationFormsByProgramId(formMap);
        } else {
          setRegistrationFormsByProgramId({});
        }
      }

      setIsLoading(false);
    }

    void loadLearnerData();
  }, [user]);

  useEffect(() => {
    const enrolledProgramIds = new Set(enrollments.map((enrollment) => enrollment.program_id));
    const channel = supabase
      .channel("learner-learning-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (payload) => {
          const announcement = payload.new as Record<string, unknown>;
          const targetRole = String(announcement.target_role || "");
          const targetProgramId = typeof announcement.target_program_id === "string" ? announcement.target_program_id : null;
          const isEligible = (targetRole === "all" || targetRole === "participant")
            && (!targetProgramId || enrolledProgramIds.has(targetProgramId));

          if (!isEligible) return;
          setAnnouncements((current) => current.some((item) => item.id === announcement.id) ? current : [announcement, ...current]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enrollments]);

  const handleDirectEnroll = async (programId: string) => {
    
    if (!participant) {
      console.warn("handleDirectEnroll ABORTED: participant is null!");
      setEnrollmentError("Tidak dapat mendaftar: Sesi peserta tidak valid. Silakan muat ulang halaman.");
      return;
    }
    
    setIsEnrolling(programId);
    setEnrollmentError(null); // Clear previous errors
    setSuccessMessage(null);
    
    try {
      console.log("Calling supabase.rpc direct_enroll_participant...");
      const { error } = await supabase.rpc("direct_enroll_participant", {
        target_participant_id: participant.id,
        target_program_id: programId,
      });
      if (error) throw error;
      


      // Update local state without reloading
      setAvailablePrograms(prev => prev.filter(p => p.id !== programId));
      
      // Fetch the new enrollment to add it to the active list
      const { data: newEnrollments } = await supabase
        .from("enrollments")
        .select("*, programs(*)")
        .eq("participant_id", participant.id)
        .eq("program_id", programId);
        
      if (newEnrollments && newEnrollments.length > 0) {
        setEnrollments(prev => [...prev, ...newEnrollments]);
      }
      
      // Visual feedback instead of alert
      setSuccessMessage("Pendaftaran Langsung Berhasil! Anda kini terdaftar di program tersebut.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setEnrollmentError("Gagal mendaftar: " + (err.message || "Terjadi kesalahan sistem."));
      // Also restore the program to the list if it was optimistically removed
      setAvailablePrograms(prev => [...prev]); // force re-render, though actually we only removed it if error was false
    } finally {
      setIsEnrolling(null);
    }
  };

  const activeEnrollments = enrollments.filter(
    (enrollment) => enrollment.enrollment_status === "active",
  );
  const registrationStateLabel: Record<RegistrationWindowState, string> = {
    draft: "Belum Aktif",
    upcoming: "Terjadwal",
    open: "Dibuka",
    closed: "Ditutup",
    archived: "Diarsipkan",
  };
  const registrationStateClass: Record<RegistrationWindowState, string> = {
    draft: "bg-slate-100 text-slate-600 border-slate-200",
    upcoming: "bg-sky-50 text-sky-700 border-sky-200",
    open: "bg-emerald-50 text-emerald-700 border-emerald-200",
    closed: "bg-rose-50 text-rose-700 border-rose-200",
    archived: "bg-slate-100 text-slate-600 border-slate-200",
  };

  if (isLoading) {
    return <FullPageLoader message="Memuat dashboard peserta..." />;
  }

  if (errorMessage) {
    return (
      <Alert>
        <AlertTitle>Gagal memuat dashboard</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  if (!participant) {
    return (
      <Alert>
        <AlertTitle>Belum terhubung sebagai peserta</AlertTitle>
        <AlertDescription>
          Akun Anda belum terhubung dengan data peserta. Periksa pendaftaran atau hubungi bantuan.
        </AlertDescription>
        <div className="mt-4 flex flex-wrap gap-3"><Button asChild><Link to="/learner/cek-status">Cek pendaftaran</Link></Button><Button asChild variant="outline"><Link to="/learner/bantuan">Hubungi bantuan</Link></Button></div>
      </Alert>
    );
  }

  return (
    <div className="page-stack">
      <header className="learner-home-header"><div><p>Assalamu’alaikum,</p><h1>{participant.display_name}</h1></div><Link className="learner-text-link" to="/learner/profil">Akun saya</Link></header>
      <section aria-labelledby="continue-heading" className="learner-section"><div className="learner-section-heading"><h2 id="continue-heading">Belajar hari ini</h2><Link className="learner-text-link" to="/learner/program-saya">Semua program</Link></div><LearningCards enrollments={activeEnrollments} /></section>
      {onboarding.some((item) => item.status !== "completed") && <p className="learner-notice">Persiapan belajar belum lengkap. <Link to="/learner/program-saya">Buka program Anda</Link></p>}
      {announcements.length > 0 && <section className="learner-section" aria-labelledby="updates-heading"><h2 id="updates-heading">Pengumuman terbaru</h2><div className="learner-announcements">{announcements.slice(0, 3).map((item) => <details key={item.id}><summary><Megaphone size={17} /><span>{item.title}</span><time>{new Date(item.created_at).toLocaleDateString("id-ID")}</time></summary><p>{item.content}</p></details>)}</div>{announcements.length > 3 && <details className="learner-more-updates"><summary>{announcements.length - 3} pengumuman lainnya</summary>{announcements.slice(3).map((item) => <details key={item.id}><summary>{item.title}</summary><p>{item.content}</p></details>)}</details>}</section>}
      <details className="learner-catalog"><summary>Temukan program baru <span>{availablePrograms.length} program</span></summary>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Katalog Program</CardTitle>
              <p className="text-sm text-muted-foreground">Program yang tersedia untuk Anda ikuti.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to="/learner/cek-status">
                <ClipboardCheck className="h-4 w-4" />
                Cek Status Pendaftaran
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <Alert className="mb-4 bg-emerald-50 border-emerald-200">
              <AlertTitle className="text-emerald-800">Berhasil</AlertTitle>
              <AlertDescription className="text-emerald-700">{successMessage}</AlertDescription>
            </Alert>
          )}
          {enrollmentError && (
            <Alert className="border-red-200 bg-red-50 text-red-900 mb-8">
              <AlertTitle>Pendaftaran Gagal</AlertTitle>
              <AlertDescription>{enrollmentError}</AlertDescription>
            </Alert>
          )}

          {availablePrograms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Saat ini tidak ada program baru yang tersedia.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availablePrograms.map((program) => {
                const isDirectEnroll = program.feature_flags?.use_direct_enrollment === true;
                const registrationForm = registrationFormsByProgramId[program.id];
                const registrationState = isDirectEnroll
                  ? "open"
                  : getRegistrationWindowState(registrationForm);
                const canSubmitForm = registrationState === "open";

                return (
                  <div className="rounded-lg border bg-white p-4 flex flex-col justify-between shadow-sm hover:border-primary/30 hover:shadow-md transition-all" key={program.id}>
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{program.code}</Badge>
                        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${registrationStateClass[registrationState]}`}>
                          {isDirectEnroll ? "Daftar Langsung" : registrationStateLabel[registrationState]}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg leading-tight">{program.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{program.description || "Tidak ada deskripsi."}</p>
                      {!isDirectEnroll && (
                        <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                          <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
                            <CalendarClock className="h-4 w-4 text-primary" />
                            Periode Pendaftaran
                          </div>
                          <p>{formatRegistrationDateTime(registrationForm?.registration_open_at)} - {formatRegistrationDateTime(registrationForm?.registration_close_at)}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      {isDirectEnroll ? (
                        <Button 
                          className="w-full" 
                          onClick={() => handleDirectEnroll(program.id)}
                          disabled={isEnrolling === program.id}
                        >
                          {isEnrolling === program.id ? "Mendaftar..." : "Daftar Langsung"}
                        </Button>
                      ) : (
                        <Button 
                          className="w-full" 
                          variant={canSubmitForm ? "default" : "outline"} 
                          asChild
                        >
                          <Link to={`/learner/pendaftaran/${program.id}`}>
                            {canSubmitForm ? "Isi Form Pendaftaran" : "Lihat Jadwal"}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </details>
    </div>
  );
}
