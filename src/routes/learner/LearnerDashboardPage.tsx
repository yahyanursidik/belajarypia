import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Award, IdCard, GraduationCap, Wallet, Megaphone } from "lucide-react";
import type { Enrollment, OnboardingProgress, Participant, WhatsappGroup } from "../../lib/enrollment";
import { mergeWithDefaultFeatureFlags } from "../../lib/organization";
import { supabase } from "../../lib/supabase";

export function LearnerDashboardPage() {
  const { user } = useAuthSession();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingProgress[]>([]);
  const [whatsappGroups, setWhatsappGroups] = useState<WhatsappGroup[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<any[]>([]);
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

      let currentParticipant = (participantRow as Participant | null) ?? null;
      
      // Inject Mock Participant for Admin Testing
      if (!currentParticipant && user) {
        currentParticipant = {
          id: 'test-admin',
          user_id: user.id,
          global_participant_number: 'SIMULASI-ADMIN',
          display_name: user.user_metadata?.full_name || 'Admin Tester',
          status: 'active'
        } as unknown as Participant;
      }
      
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

      const eligibleScopes = nextEnrollments
        .filter((enrollment) => {
          const flags = mergeWithDefaultFeatureFlags(enrollment.programs?.feature_flags);
          return enrollment.enrollment_status === "active" && flags.use_whatsapp_group;
        })
        .flatMap((enrollment) => [
          { scope_type: "program", scope_id: enrollment.program_id },
          { scope_type: "batch", scope_id: enrollment.batch_id },
          { scope_type: "class", scope_id: enrollment.class_id },
          { scope_type: "halaqah", scope_id: enrollment.halaqah_id },
        ])
        .filter((scope): scope is { scope_type: string; scope_id: string } => Boolean(scope.scope_id));

      if (eligibleScopes.length > 0) {
        const filters = eligibleScopes
          .map((scope) => `and(scope_type.eq.${scope.scope_type},scope_id.eq.${scope.scope_id})`)
          .join(",");

        const { data: waRows } = await supabase
          .from("whatsapp_groups")
          .select("id, scope_type, scope_id, group_name, invite_link, is_active")
          .eq("is_active", true)
          .or(filters);

        setWhatsappGroups((waRows ?? []) as WhatsappGroup[]);
      }

      const { data: allProgramsData } = await supabase
        .from("programs")
        .select("id, name, code, description, feature_flags")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (allProgramsData) {
        const enrolledProgramIds = nextEnrollments.map((e) => e.program_id);
        const available = allProgramsData.filter((p) => !enrolledProgramIds.includes(p.id));
        setAvailablePrograms(available);
      }

      setIsLoading(false);
    }

    void loadLearnerData();
  }, [user]);

  const handleDirectEnroll = async (programId: string) => {
    console.log("handleDirectEnroll TRIGGERED for program:", programId);
    console.log("Current participant state:", participant);
    
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
      const { data, error } = await supabase.rpc("direct_enroll_participant", {
        target_participant_id: participant.id,
        target_program_id: programId,
      });
      if (error) throw error;
      
      console.log("RPC Result:", data, "Error:", error);

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
  const onboardingByEnrollment = useMemo(
    () => new Map(onboarding.map((item) => [item.enrollment_id, item])),
    [onboarding],
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Memuat dashboard peserta...</p>;
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
          Akun login ini belum memiliki participant aktif. Pastikan applicant
          sudah di-approve dan email Auth sama dengan email pendaftaran.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="page-stack">
      <section className="page-hero">
        <Badge variant="secondary" className="mb-4 bg-white/20 hover:bg-white/30 text-white border-white/10 backdrop-blur-sm">
          {participant.status.toUpperCase()}
        </Badge>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md items-center justify-center border border-white/20">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-sm font-medium mb-1">Assalamu'alaikum, Peserta 👋</p>
            <h2>Selamat Datang, {participant.display_name}!</h2>
            <p>
              Selamat datang di portal pembelajaran Anda. Lanjutkan proses belajar Anda dan pantau perkembangan program yang Anda ikuti.
            </p>
          </div>
        </div>
      </section>

      {/* Papan Pengumuman */}
      {announcements.length > 0 && (
        <div className="space-y-3 mb-6 animate-in slide-in-from-bottom-4 duration-500">
          <h3 className="font-bold flex items-center gap-2 text-slate-800">
            <Megaphone className="h-5 w-5 text-indigo-500"/> Papan Pengumuman
          </h3>
          <div className="grid gap-3">
            {announcements.map(ann => (
              <Alert key={ann.id} className="bg-indigo-50/50 border-indigo-200/60 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                 <Megaphone className="h-4 w-4 text-indigo-600 mt-1" />
                 <AlertTitle className="text-indigo-900 font-bold text-base">{ann.title}</AlertTitle>
                 <AlertDescription className="text-indigo-800/80 mt-1.5 whitespace-pre-wrap leading-relaxed">
                   {ann.content}
                 </AlertDescription>
                 <p className="text-[10px] text-indigo-400 mt-3 font-medium">
                   Disiarkan pada: {new Date(ann.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                 </p>
              </Alert>
            ))}
          </div>
        </div>
      )}

      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm shrink-0 w-[240px] sm:w-auto snap-center">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Program Aktif</CardTitle>
            <BookOpen className="h-4 w-4 text-primary opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeEnrollments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Sedang dipelajari</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm shrink-0 w-[240px] sm:w-auto snap-center">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nomor Induk</CardTitle>
            <IdCard className="h-4 w-4 text-primary opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground truncate">{participant.global_participant_number}</div>
            <p className="text-xs text-muted-foreground mt-1">ID Global Peserta</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm shrink-0 w-[240px] sm:w-auto snap-center">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Onboarding</CardTitle>
            <Award className="h-4 w-4 text-primary opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {onboarding.filter((item) => item.status === "completed").length}/
              {onboarding.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tugas selesai</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Program Saya</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada enrollment aktif.</p>
          ) : (
            <div className="space-y-4">
              {enrollments.map((enrollment) => {
                const currentOnboarding = onboardingByEnrollment.get(enrollment.id);
                const flags = mergeWithDefaultFeatureFlags(enrollment.programs?.feature_flags);
                const isSpp = flags.payment_type === "spp";
                
                const relatedGroups = whatsappGroups.filter((group) =>
                  [
                    enrollment.program_id,
                    enrollment.batch_id,
                    enrollment.class_id,
                    enrollment.halaqah_id,
                  ].includes(group.scope_id),
                );

                return (
                  <div className="rounded-lg border p-4" key={enrollment.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{enrollment.programs?.name ?? "Program"}</h3>
                        <p className="text-sm text-muted-foreground">
                          Enrollment {enrollment.enrollment_number}
                        </p>
                      </div>
                      <Badge variant={enrollment.enrollment_status === "active" ? "default" : "secondary"}>
                        {enrollment.enrollment_status}
                      </Badge>
                    </div>
                    <dl className="detail-grid mt-4">
                      <div>
                        <dt>Batch</dt>
                        <dd>{enrollment.batches?.name ?? "-"}</dd>
                      </div>
                      <div>
                        <dt>Kelas</dt>
                        <dd>{enrollment.classes?.name ?? "-"}</dd>
                      </div>
                      <div>
                        <dt>Halaqah</dt>
                        <dd>{enrollment.halaqahs?.name ?? "-"}</dd>
                      </div>
                      <div>
                        <dt>Onboarding</dt>
                        <dd>{currentOnboarding?.status ?? "not_started"}</dd>
                      </div>
                    </dl>

                    {isSpp && (
                      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900 flex items-start gap-3">
                        <Wallet className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="w-full">
                          <h4 className="font-semibold text-sm">Pengingat SPP Bulanan</h4>
                          <p className="text-xs mt-1 text-amber-800 leading-relaxed">
                            Program ini menggunakan sistem Sumbangan Pembinaan Pendidikan (SPP) bulanan 
                            sebesar <strong>Rp {(flags.payment_amount || 0).toLocaleString("id-ID")}</strong>. 
                            Mohon siapkan infak SPP Anda agar kegiatan belajar mengajar berjalan lancar.
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-3 bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 w-full sm:w-auto"
                            onClick={() => window.open(`https://wa.me/6281234567890?text=Assalamu'alaikum, saya ${participant?.display_name || "Peserta"} (NIM: ${participant?.global_participant_number || "-"}) ingin mengkonfirmasi pembayaran SPP untuk program ${enrollment.programs?.name}.`, "_blank")}
                          >
                            Konfirmasi Pembayaran via WhatsApp
                          </Button>
                        </div>
                      </div>
                    )}

                    {relatedGroups.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {relatedGroups.map((group) => (
                          <Button asChild key={group.id} size="sm" variant="outline">
                            <a href={group.invite_link} rel="noreferrer" target="_blank">
                              Gabung {group.group_name}
                            </a>
                          </Button>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-6">
                      <Button asChild className="w-full" size="lg">
                        <Link to={`/learner/program/${enrollment.program_id}`}>
                          Mulai Belajar / Lihat Materi
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Katalog Program</CardTitle>
          <p className="text-sm text-muted-foreground">Program yang tersedia untuk Anda ikuti.</p>
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
                return (
                  <div className="rounded-lg border p-4 flex flex-col justify-between" key={program.id}>
                    <div>
                      <h3 className="font-semibold text-lg">{program.name}</h3>
                      <Badge variant="outline" className="mb-2">{program.code}</Badge>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{program.description || "Tidak ada deskripsi."}</p>
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
                          variant="outline" 
                          asChild
                        >
                          <Link to={`/learner/pendaftaran/${program.id}`}>Lihat Form Pendaftaran</Link>
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
    </div>
  );
}
