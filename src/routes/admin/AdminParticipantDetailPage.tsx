import { PageHeader } from "../../components/admin/PageHeader";
import { SectionNav } from "../../components/admin/SectionNav";
import { Dialog } from "../../components/ui/dialog";
import { ParticipantAccessDialog } from "../../components/participants/ParticipantAccessDialog";
import { ParticipantProgramPicker } from "../../components/participants/ParticipantProgramPicker";
import { type ComponentType, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ParticipantContactCard } from "../../components/participants/ParticipantContactCard";
import { supabase } from "../../lib/supabase";
import type { Enrollment, EnrollmentStatus, GuardianParticipant, Participant, ParticipantStatus } from "../../lib/participant";

type DetailTab = "overview" | "profile" | "guardians" | "academic";
type Feedback = { type: "success" | "error" | "info"; message: string } | null;

type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  status?: string | null;
};

type ParticipantDetail = Participant & {
  profiles?: ProfileLite | null;
};

type GuardianRelation = GuardianParticipant & {
  guardians?: {
    id: string;
    user_id: string | null;
    relation_type: string | null;
    notes: string | null;
    created_at: string;
    profiles?: ProfileLite | null;
  } | null;
};

type EnrollmentRow = Enrollment & {
  programs?: { code: string | null; name: string | null; curriculum_model?: string } | null;
  batches?: { code: string | null; name: string | null } | null;
  classes?: { name: string | null; teacher_user_id: string | null; profiles?: { full_name: string | null } | null } | null;
  halaqahs?: { name: string | null; mentor_user_id: string | null } | null;
};

type ParticipantLoginActivity = {
  participant_id: string;
  last_login_at: string | null;
};

const detailTabs: Array<{
  key: DetailTab;
  label: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "overview", label: "Ringkasan", desc: "Status, kelengkapan, dan tindak lanjut", icon: ClipboardList },
  { key: "profile", label: "Biodata", desc: "Identitas peserta dan akun sistem", icon: User },
  { key: "guardians", label: "Wali", desc: "Relasi orang tua atau wali", icon: Users },
  { key: "academic", label: "Akademik", desc: "Program, kelas, dan transkrip", icon: BookOpen },
];

const participantStatusLabels: Record<ParticipantStatus, { label: string; className: string }> = {
  active: { label: "Aktif", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  inactive: { label: "Nonaktif", className: "border-amber-200 bg-amber-50 text-amber-700" },
  archived: { label: "Diarsipkan", className: "border-slate-200 bg-slate-100 text-slate-700" },
};

const enrollmentStatusLabels: Record<EnrollmentStatus, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "border-amber-200 bg-amber-50 text-amber-700" },
  active: { label: "Aktif Belajar", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  hold: { label: "Ditahan", className: "border-orange-200 bg-orange-50 text-orange-700" },
  completed: { label: "Selesai", className: "border-blue-200 bg-blue-50 text-blue-700" },
  cancelled: { label: "Dibatalkan", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

function formatDate(value?: string | null, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", options);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Belum pernah login";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitial(name?: string | null) {
  return (name?.trim().charAt(0) || "P").toUpperCase();
}

function getParticipantTypeLabel(value?: string | null) {
  if (!value) return "-";
  const labels: Record<string, string> = {
    adult: "Dewasa",
    child: "Anak",
    student: "Pelajar",
  };
  return labels[value] || value;
}

export function AdminParticipantDetailPage() {
  const { participantId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/system") ? "/system" : "/admin";

  const [searchParams,setSearchParams] = useSearchParams();
  const activeTab: DetailTab = detailTabs.some((tab) => tab.key === searchParams.get("tab")) ? searchParams.get("tab") as DetailTab : "overview";
  const setActiveTab = (tab: DetailTab) => setSearchParams((current) => { const next=new URLSearchParams(current);next.set("tab",tab);return next; });
  const [isAccessOpen,setIsAccessOpen] = useState(false);
  const [isProgramPickerOpen,setIsProgramPickerOpen] = useState(false);
  const requestedReturn = searchParams.get("returnTo") ?? "";
  const directoryPath = requestedReturn === `${basePath}/peserta` || requestedReturn.startsWith(`${basePath}/peserta?`) ? requestedReturn : `${basePath}/peserta`;
  const openAccount = () => participant?.user_id ? setIsAccessOpen(true) : navigate(basePath === "/system" ? "/system/pengguna" : "/admin/helpdesk");
  const [participant, setParticipant] = useState<ParticipantDetail | null>(null);
  const [guardianRels, setGuardianRels] = useState<GuardianRelation[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [loginActivityAvailable,setLoginActivityAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [guardianToRemove, setGuardianToRemove] = useState<string | null>(null);
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [profileSearch, setProfileSearch] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const profileData = participant?.profiles ?? null;
  const statusInfo = participant ? participantStatusLabels[participant.status] : participantStatusLabels.inactive;
  const activeEnrollments = enrollments.filter((item) => item.enrollment_status === "active").length;
  const completedEnrollments = enrollments.filter((item) => item.enrollment_status === "completed").length;
  const pendingEnrollments = enrollments.filter((item) => item.enrollment_status === "pending").length;
  const primaryGuardian = guardianRels.find((item) => item.is_primary);
  const scheduled = enrollments.filter((item) => item.enrollment_status === "active" && item.programs?.curriculum_model === "angkatan");
  const hasClassPlacement = scheduled.length > 0 && scheduled.every((item) => Boolean(item.class_id || item.halaqah_id));
  const needsGuardian = participant?.participant_type === "child";
  const needsPlacement = scheduled.length > 0;

  const completionItems = useMemo(
    () => [
      { label: "Akun login", done: Boolean(participant?.user_id), icon: ShieldCheck },
      { label: "Email kontak", done: Boolean(profileData?.email), icon: Mail },
      { label: "Nomor telepon", done: Boolean(profileData?.phone || participant?.phone), icon: Phone },
      { label: "Domisili", done: Boolean(participant?.city), icon: MapPin },
      ...(needsGuardian ? [{ label: "Wali utama", done: Boolean(primaryGuardian), icon: Users }] : []),
      { label: "Program aktif", done: activeEnrollments > 0, icon: BookOpen },
      ...(needsPlacement ? [{ label: "Penempatan kelas", done: hasClassPlacement, icon: GraduationCap }] : []),
    ],
    [activeEnrollments, hasClassPlacement, participant, primaryGuardian, profileData, needsGuardian, needsPlacement],
  );

  const completionPercent = Math.round((completionItems.filter((item) => item.done).length / completionItems.length) * 100);

  const workflowItems = [
    {
      title: "Validasi akun peserta",
      description: participant?.user_id ? "Peserta sudah terhubung dengan akun login." : "Tautkan peserta ke akun login agar dapat mengakses portal.",
      done: Boolean(participant?.user_id),
      action: participant?.user_id ? "Kelola akses" : basePath === "/system" ? "Kelola pengguna" : "Bantuan akun",
      onClick: () => openAccount(),
    },
    {
      title: "Program belajar",
      description: activeEnrollments > 0 ? "Peserta memiliki program aktif." : "Pilih program untuk mulai belajar.",
      done: activeEnrollments > 0,
      action: activeEnrollments > 0 ? "Lihat akademik" : "Pilih program",
      onClick: () => activeEnrollments > 0 ? setActiveTab("academic") : participant?.status === "active" ? setIsProgramPickerOpen(true) : notify("Peserta harus aktif sebelum ditambahkan ke program.", "info"),
    },
    {
      title: "Pastikan wali utama",
      description: primaryGuardian ? "Wali utama sudah ditentukan." : "Tambahkan atau tandai satu wali sebagai kontak utama.",
      done: Boolean(primaryGuardian),
      action: "Kelola wali",
      onClick: () => setActiveTab("guardians"),
    },
    {
      title: "Cek penempatan belajar",
      description: hasClassPlacement ? "Minimal satu program sudah memiliki kelas atau halaqah." : "Peserta belum ditempatkan ke kelas/halaqah.",
      done: hasClassPlacement,
      action: "Lihat akademik",
      onClick: () => setActiveTab("academic"),
    },
  ].filter((item) => item.title !== "Pastikan wali utama" || needsGuardian).filter((item) => item.title !== "Cek penempatan belajar" || needsPlacement);

  const availableProfiles = useMemo(() => {
    const linkedIds = new Set(guardianRels.map((rel) => rel.guardians?.user_id).filter(Boolean));
    const query = profileSearch.trim().toLowerCase();

    return profiles.filter((profile) => {
      if (profile.status !== "active" || profile.id === participant?.user_id || linkedIds.has(profile.id)) return false;
      if (!query) return true;
      return [profile.full_name, profile.email, profile.phone].some((value) => value?.toLowerCase().includes(query));
    });
  }, [guardianRels, participant?.user_id, profileSearch, profiles]);

  const notify = useCallback((message: string, type: NonNullable<Feedback>["type"] = "success") => {
    setFeedback({ message, type });
  }, []);

  const fetchRevision = useRef(0);
  const fetchData = useCallback(async (silent = false) => {
    if (!participantId) return;
    const revision = ++fetchRevision.current;

    if (silent) {
      setIsRefreshing(true);
    } else {
      setParticipant(null);
      setIsLoading(true);
    }

    try {
      const [participantResult, guardiansResult, enrollmentsResult, loginActivityResult] = await Promise.all([
        supabase
          .from("participants")
          .select("*, profiles(full_name, email, phone, status)")
          .eq("id", participantId)
          .maybeSingle(),
        supabase
          .from("guardian_participants")
          .select("*, guardians(*, profiles(full_name, email, phone, status))")
          .eq("participant_id", participantId)
          .order("is_primary", { ascending: false }),
        supabase
          .from("enrollments")
          .select("*, programs(code, name, curriculum_model), batches(code, name), classes(name, teacher_user_id, profiles(full_name)), halaqahs(name, mentor_user_id)")
          .eq("participant_id", participantId)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_participant_login_activity", { p_participant_ids: [participantId] }),
      ]);

      if (revision !== fetchRevision.current) return;
      if (participantResult.error) throw participantResult.error;
      if (guardiansResult.error) throw guardiansResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;

      setParticipant((participantResult.data as ParticipantDetail | null) ?? null);
      setGuardianRels((guardiansResult.data ?? []) as GuardianRelation[]);
      setEnrollments((enrollmentsResult.data ?? []) as EnrollmentRow[]);
      setLoginActivityAvailable(!loginActivityResult.error);
      if (loginActivityResult.error) {
        console.warn("Gagal memuat login terakhir peserta:", loginActivityResult.error.message);
        setLastLoginAt(null);
      } else {
        const activity = (loginActivityResult.data ?? []) as ParticipantLoginActivity[];
        setLastLoginAt(activity[0]?.last_login_at ?? null);
      }
    } catch (err: unknown) {
      if (revision !== fetchRevision.current) return;
      const message = err instanceof Error ? err.message : "Gagal memuat detail peserta.";
      notify(`Gagal memuat detail peserta: ${message}`, "error");
    } finally {
      if (revision === fetchRevision.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [notify, participantId]);

  useEffect(() => {
    void fetchData();
    return () => { fetchRevision.current += 1; };
  }, [fetchData]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), feedback.type === "error" ? 7000 : 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const loadProfilesForGuardian = async () => {
    setIsGuardianModalOpen(true);
    setSelectedProfileId("");
    setProfileSearch("");
    setProfiles([]);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, status")
      .order("full_name");

    if (error) {
      notify(`Gagal memuat daftar profil wali: ${error.message}`, "error");
      return;
    }

    setProfiles((data ?? []) as ProfileLite[]);
  };

  const handleAddGuardian = async (event: FormEvent) => {
    event.preventDefault();
    if (!participantId) return;
    if (!selectedProfileId) {
      notify("Pilih akun wali terlebih dahulu.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.rpc("admin_manage_participant_guardian", {
        p_participant_id: participantId,
        p_action: "attach",
        p_profile_id: selectedProfileId,
      });
      if (error) throw error;

      notify("Wali berhasil ditautkan.");
      setIsGuardianModalOpen(false);
      await fetchData(true);
    } catch (err: unknown) {
      const message = (err as {message?: string})?.message || "Wali belum dapat ditautkan.";
      notify(`Gagal menautkan wali: ${message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPrimaryGuardian = async (relationId: string) => {
    if (!participantId) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.rpc("admin_manage_participant_guardian", {
        p_participant_id: participantId,
        p_action: "primary",
        p_relation_id: relationId,
      });
      if (error) throw error;

      notify("Wali utama berhasil diperbarui.");
      await fetchData(true);
    } catch (err: unknown) {
      const message = (err as {message?: string})?.message || "Gagal mengubah wali utama.";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveGuardian = async (relationId: string) => {
    if (!participantId || isSubmitting) return;

    setIsSubmitting(true);
    const { error } = await supabase.rpc("admin_manage_participant_guardian", {
      p_participant_id: participantId,
      p_action: "detach",
      p_relation_id: relationId,
    });

    if (error) {
      notify(`Gagal menghapus wali: ${error.message}`, "error");
    } else {
      setGuardianToRemove(null);
      notify("Tautan wali dilepas. Wali utama diperbarui jika diperlukan.");
      await fetchData(true);
    }

    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="page-stack flex min-h-[45vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm font-medium text-muted-foreground">Memuat detail peserta...</p>
        </div>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="page-stack max-w-4xl">
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium">
            Peserta tidak ditemukan atau tidak dapat diakses. Pastikan data peserta belum dihapus dan ID URL valid.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate(directoryPath)} className="h-10 whitespace-nowrap !text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Direktori Peserta
        </Button>
      </div>
    );
  }

  return (
    <div className="page-stack max-w-7xl pb-12">
      <nav className="admin-breadcrumb" aria-label="Jejak navigasi"><button onClick={()=>navigate(directoryPath)}>Peserta</button><span>/</span><span>{participant.global_participant_number}</span></nav>
      <PageHeader title={participant.display_name} eyebrow={`${participant.global_participant_number} · ${getParticipantTypeLabel(participant.participant_type)} · ${statusInfo.label}`} actions={<><Button variant="outline" onClick={()=>navigate(directoryPath)}><ArrowLeft size={16}/>Kembali</Button><Button variant="outline" disabled={isRefreshing} onClick={()=>void fetchData(true)}><RefreshCw className={isRefreshing?"h-4 w-4 animate-spin":"h-4 w-4"}/>Muat ulang</Button><Button onClick={()=>setActiveTab("academic")}><FileText size={16}/>Akademik & transkrip</Button></>} />

      {feedback && (
        <Alert
          className={
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : feedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-blue-200 bg-blue-50 text-blue-900"
          }
        >
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription className="font-medium">{feedback.message}</AlertDescription>
        </Alert>
      )}

      <SectionNav items={detailTabs} value={activeTab} onChange={setActiveTab} label="Bagian detail peserta" />
      <details className="participant-completeness"><summary>Kelengkapan data <strong>{completionPercent}%</strong></summary><div>{completionItems.map((item)=><span key={item.label} className={item.done?"text-emerald-700":"text-amber-700"}>{item.done?"✓":"○"} {item.label}</span>)}</div></details>
      <div>
        <main className="min-w-0 space-y-6">
          {activeTab === "overview" && (
            <div className="grid gap-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Program Aktif</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{activeEnrollments}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Login Terakhir</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-bold leading-snug">{!participant.user_id ? "Belum ada akun" : loginActivityAvailable ? formatDateTime(lastLoginAt) : "Belum tersedia"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Selesai</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{completedEnrollments}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Menunggu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{pendingEnrollments}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Wali</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{guardianRels.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Tindak lanjut</CardTitle>

                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  {workflowItems.map((item) => (
                    <div key={item.title} className="rounded-xl border bg-background p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        {item.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />}
                      </div>
                      <Button
                        type="button"
                        variant={item.done ? "outline" : "default"}
                        size="sm"
                        onClick={item.onClick}
                        className={item.done ? "!text-foreground" : "bg-primary !text-white hover:bg-primary/90"}
                      >
                        {item.action}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Kontak & identitas</CardTitle>

                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <InfoRow icon={Mail} label="Email" value={profileData?.email} />
                  <InfoRow icon={Phone} label="Telepon / WhatsApp" value={profileData?.phone || participant.phone} />
                  <InfoRow icon={MapPin} label="Domisili" value={participant.city} />
                  <InfoRow icon={GraduationCap} label="Pendidikan" value={participant.education_level} />
                  <InfoRow icon={Calendar} label="Tanggal Bergabung" value={formatDate(participant.joined_at, { day: "numeric", month: "long", year: "numeric" })} />
                  <InfoRow icon={Clock3} label="Login Terakhir" value={!participant.user_id ? "Belum ada akun" : loginActivityAvailable ? formatDateTime(lastLoginAt) : "Belum tersedia"} />
                  <InfoRow icon={Users} label="Wali Utama" value={primaryGuardian?.guardians?.profiles?.full_name} />
                </CardContent>
              </Card>

              <ParticipantContactCard
                participantName={participant.display_name}
                phone={profileData?.phone || participant.phone}
                email={profileData?.email}
                programName={enrollments.find((item) => item.enrollment_status === "active")?.programs?.name}
              />
            </div>
          )}

          {activeTab === "profile" && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Card>
                <CardHeader>
                  <CardTitle>Informasi Pribadi & Kontak</CardTitle>
                  <CardDescription>Biodata utama peserta yang dipakai di direktori dan dokumen akademik.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <InfoRow icon={User} label="Nama Tampilan" value={participant.display_name} />
                  <InfoRow icon={BadgeCheck} label="Nomor Peserta" value={participant.global_participant_number} mono />
                  <InfoRow icon={UserCheck} label="Jenis Peserta" value={getParticipantTypeLabel(participant.participant_type)} />
                  <InfoRow icon={User} label="Jenis Kelamin" value={participant.gender} />
                  <InfoRow icon={Mail} label="Email" value={profileData?.email} />
                  <InfoRow icon={Phone} label="WhatsApp / Telepon" value={profileData?.phone || participant.phone} />
                  <InfoRow icon={MapPin} label="Kota / Domisili" value={participant.city} />
                  <InfoRow icon={GraduationCap} label="Pendidikan Terakhir" value={participant.education_level} />
                  <InfoRow icon={Calendar} label="Tanggal Bergabung" value={formatDate(participant.joined_at, { day: "numeric", month: "long", year: "numeric" })} />
                  <InfoRow icon={Clock3} label="Login Terakhir" value={!participant.user_id ? "Belum ada akun" : loginActivityAvailable ? formatDateTime(lastLoginAt) : "Belum tersedia"} />
                </CardContent>
              </Card>

              <Card className="h-fit border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Akun Sistem
                  </CardTitle>
                  <CardDescription>Akun login yang terhubung ke peserta ini.</CardDescription>
                </CardHeader>
                <CardContent>
                  {profileData ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border bg-background p-4 text-center shadow-sm">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                          {getInitial(profileData.full_name)}
                        </div>
                        <p className="mt-3 font-bold">{profileData.full_name || participant.display_name}</p>
                        <p className="mt-1 break-all text-sm text-muted-foreground">{profileData.email || "-"}</p>
                        <Badge variant="outline" className="mt-3">
                          {profileData.status || "active"}
                        </Badge>
                      </div>
                      <Button variant="outline" className="h-10 w-full whitespace-nowrap !text-foreground" onClick={() => openAccount()}>
                        <KeyRound className="h-4 w-4" />
                        Kelola Akun & Akses
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed bg-background p-6 text-center">
                      <User className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                      <p className="font-semibold">Belum Ada Akun Login</p>
                      <p className="mt-1 text-sm text-muted-foreground">Peserta belum dapat masuk ke portal learner.</p>
                      <Button className="mt-4 h-10 w-full whitespace-nowrap bg-primary !text-white hover:bg-primary/90" onClick={() => openAccount()}>
                        {basePath === "/system" ? "Kelola pengguna" : "Bantuan akun"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "guardians" && (
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Relasi Wali</CardTitle>
                  <CardDescription>Kelola wali, kontak utama, dan akses pendamping peserta.</CardDescription>
                </div>
                <Button onClick={() => void loadProfilesForGuardian()} className="h-10 whitespace-nowrap bg-primary !text-white hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  Tautkan Wali
                </Button>
              </CardHeader>
              <CardContent>
                {guardianRels.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-14 text-center">
                    <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                    <p className="font-semibold">Belum ada wali yang terhubung.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Tambahkan wali agar komunikasi dan pemantauan belajar lebih rapi.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {guardianRels.map((rel) => {
                      const guardianProfile = rel.guardians?.profiles;
                      return (
                        <div key={rel.id} className="rounded-xl border bg-background p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
                                {getInitial(guardianProfile?.full_name)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-bold">{guardianProfile?.full_name || "Wali tanpa nama"}</p>
                                  {rel.is_primary && (
                                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                                      Utama
                                    </Badge>
                                  )}
                                </div>
                                <p className="mt-1 break-all text-xs text-muted-foreground">{guardianProfile?.email || "-"}</p>
                                {guardianProfile?.phone && <p className="mt-1 text-xs text-muted-foreground">{guardianProfile.phone}</p>}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => setGuardianToRemove(rel.id)}
                              disabled={isSubmitting}
                              aria-label="Hapus tautan wali"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={rel.is_primary ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => void handleSetPrimaryGuardian(rel.id)}
                              disabled={rel.is_primary || isSubmitting}
                              className="h-9 whitespace-nowrap !text-foreground"
                            >
                              <ShieldCheck className="h-4 w-4" />
                              {rel.is_primary ? "Wali Utama" : "Jadikan Utama"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "academic" && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Program & transkrip</CardTitle>
                <Button className="w-fit" disabled={participant.status !== "active"} title={participant.status !== "active" ? "Peserta harus berstatus aktif" : undefined} onClick={()=>setIsProgramPickerOpen(true)}><Plus size={16}/>Pilih program baru</Button>
                <CardDescription>Program yang diikuti peserta, status belajar, penempatan kelas, dan akses transkrip.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {enrollments.length === 0 ? (
                  <div className="px-4 py-14 text-center">
                    <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                    <p className="font-semibold">Belum ada riwayat program.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Peserta belum terdaftar pada program mana pun.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-y bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Program</th>
                          <th className="px-6 py-4 font-semibold">Penempatan</th>
                          <th className="px-6 py-4 font-semibold">Status</th>
                          <th className="px-6 py-4 font-semibold">Tanggal</th>
                          <th className="px-6 py-4 text-right font-semibold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {enrollments.map((enrollment) => {
                          const enrollmentInfo = enrollmentStatusLabels[enrollment.enrollment_status] ?? enrollmentStatusLabels.pending;
                          return (
                            <tr key={enrollment.id} className="hover:bg-muted/30">
                              <td className="px-6 py-4">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <BookOpen className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <button className="participant-name" onClick={()=>navigate(`${basePath}/program/${enrollment.program_id}/peserta`)}>{enrollment.programs?.name || "Buka program"}</button>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                      <span className="font-mono">{enrollment.enrollment_number}</span>
                                      <span>{enrollment.batches?.name || "Angkatan belum diatur"}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {enrollment.classes?.name || enrollment.halaqahs?.name ? (
                                  <div className="space-y-1">
                                    <p className="font-medium">{enrollment.classes?.name || "Kelas belum diatur"}</p>
                                    {enrollment.halaqahs?.name && <p className="text-xs text-muted-foreground">{enrollment.halaqahs.name}</p>}
                                    {enrollment.classes?.profiles?.full_name && (
                                      <p className="text-xs font-medium text-primary">{enrollment.classes.profiles.full_name}</p>
                                    )}
                                  </div>
                                ) : (
                                  enrollment.programs?.curriculum_model === "angkatan" ? <Button variant="outline" size="sm" onClick={()=>navigate(`${basePath}/program/${enrollment.program_id}/angkatan-kelas?placeEnrollment=${enrollment.id}`)}>Atur kelas / halaqah</Button> : <span className="text-muted-foreground">Tidak memerlukan kelas</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <Badge variant="outline" className={enrollmentInfo.className}>
                                  {enrollmentInfo.label}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-xs text-muted-foreground">
                                <div>Daftar: {formatDate(enrollment.created_at)}</div>
                                {enrollment.started_at && <div>Mulai: {formatDate(enrollment.started_at)}</div>}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 whitespace-nowrap border-primary/30 !text-primary hover:bg-primary/5"
                                  onClick={() => navigate(`${basePath}/peserta/${participantId}/transkrip/${enrollment.id}?directory=${encodeURIComponent(directoryPath)}`)}
                                >
                                  <FileText className="h-4 w-4" />
                                  Transkrip
                                </Button>
                                <Button variant="ghost" size="sm" className="mt-2" onClick={()=>navigate(`${basePath}/keuangan?tab=invoices&program=${enrollment.program_id}&participant=${participantId}`)}>Tagihan & pembayaran</Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {isAccessOpen && <ParticipantAccessDialog participant={participant} onClose={()=>setIsAccessOpen(false)}/>}
      {isProgramPickerOpen && <ParticipantProgramPicker basePath={basePath} participantNumber={participant.global_participant_number} existingIds={enrollments.map((item)=>item.program_id)} onClose={()=>setIsProgramPickerOpen(false)}/>}
      {guardianToRemove && <Dialog title="Lepas tautan wali?" busy={isSubmitting} onClose={()=>setGuardianToRemove(null)}>
        <p className="text-sm text-muted-foreground">Akun wali tetap tersedia. Jika wali utama dilepas, wali lain akan menjadi utama.</p>
        <div className="wizard-footer"><Button variant="outline" disabled={isSubmitting} onClick={()=>setGuardianToRemove(null)}>Batal</Button><Button variant="outline" className="border-red-200 text-red-700" disabled={isSubmitting} onClick={()=>void handleRemoveGuardian(guardianToRemove)}>{isSubmitting ? "Melepas…" : "Lepas tautan"}</Button></div>
      </Dialog>}
      {isGuardianModalOpen && (
        <Dialog title="Tautkan wali" busy={isSubmitting} onClose={()=>setIsGuardianModalOpen(false)}>
              <form onSubmit={handleAddGuardian} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Cari Profil</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={profileSearch}
                      onChange={(event) => setProfileSearch(event.target.value)}
                      placeholder="Cari nama, email, atau nomor telepon"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    Pilih Akun Wali <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={selectedProfileId}
                    onChange={(event) => setSelectedProfileId(event.target.value)}
                  >
                    <option value="" disabled>
                      {availableProfiles.length ? "Pilih pengguna terdaftar" : "Tidak ada profil yang cocok"}
                    </option>
                    {availableProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name || "Tanpa nama"} ({profile.email || "tanpa email"})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Profil peserta dan wali yang sudah tertaut otomatis disembunyikan dari pilihan.</p>
                </div>

                <div className="flex justify-end gap-3 border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsGuardianModalOpen(false)} className="h-10 whitespace-nowrap !text-foreground">
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !selectedProfileId}
                    className="h-10 whitespace-nowrap bg-primary !text-white hover:bg-primary/90 disabled:!text-white"
                  >
                    {isSubmitting ? "Menyimpan..." : "Tautkan Wali"}
                  </Button>
                </div>
              </form>
        </Dialog>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className={`mt-2 break-words text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value || "-"}</p>
    </div>
  );
}
