import { type ComponentType, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  programs?: { code: string | null; name: string | null } | null;
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

  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [participant, setParticipant] = useState<ParticipantDetail | null>(null);
  const [guardianRels, setGuardianRels] = useState<GuardianRelation[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

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
  const hasClassPlacement = enrollments.some((item) => Boolean(item.class_id || item.classes?.name));

  const completionItems = useMemo(
    () => [
      { label: "Akun login", done: Boolean(participant?.user_id), icon: ShieldCheck },
      { label: "Email kontak", done: Boolean(profileData?.email), icon: Mail },
      { label: "Nomor telepon", done: Boolean(profileData?.phone || participant?.phone), icon: Phone },
      { label: "Domisili", done: Boolean(participant?.city), icon: MapPin },
      { label: "Wali utama", done: Boolean(primaryGuardian), icon: Users },
      { label: "Program aktif", done: activeEnrollments > 0, icon: BookOpen },
      { label: "Penempatan kelas", done: hasClassPlacement, icon: GraduationCap },
    ],
    [activeEnrollments, hasClassPlacement, participant, primaryGuardian, profileData],
  );

  const completionPercent = Math.round((completionItems.filter((item) => item.done).length / completionItems.length) * 100);

  const workflowItems = [
    {
      title: "Validasi akun peserta",
      description: participant?.user_id ? "Peserta sudah terhubung dengan akun login." : "Tautkan peserta ke akun login agar dapat mengakses portal.",
      done: Boolean(participant?.user_id),
      action: "Kelola akun",
      onClick: () => navigate(`${basePath}/pengguna`),
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
  ];

  const availableProfiles = useMemo(() => {
    const linkedIds = new Set(guardianRels.map((rel) => rel.guardians?.user_id).filter(Boolean));
    const query = profileSearch.trim().toLowerCase();

    return profiles.filter((profile) => {
      if (profile.id === participant?.user_id || linkedIds.has(profile.id)) return false;
      if (!query) return true;
      return [profile.full_name, profile.email, profile.phone].some((value) => value?.toLowerCase().includes(query));
    });
  }, [guardianRels, participant?.user_id, profileSearch, profiles]);

  const notify = useCallback((message: string, type: NonNullable<Feedback>["type"] = "success") => {
    setFeedback({ message, type });
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!participantId) return;

    if (silent) {
      setIsRefreshing(true);
    } else {
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
          .select("*, programs(code, name), batches(code, name), classes(name, teacher_user_id, profiles(full_name)), halaqahs(name, mentor_user_id)")
          .eq("participant_id", participantId)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_participant_login_activity", { p_participant_ids: [participantId] }),
      ]);

      if (participantResult.error) throw participantResult.error;
      if (guardiansResult.error) throw guardiansResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;

      setParticipant((participantResult.data as ParticipantDetail | null) ?? null);
      setGuardianRels((guardiansResult.data ?? []) as GuardianRelation[]);
      setEnrollments((enrollmentsResult.data ?? []) as EnrollmentRow[]);
      if (loginActivityResult.error) {
        console.warn("Gagal memuat login terakhir peserta:", loginActivityResult.error.message);
        setLastLoginAt(null);
      } else {
        const activity = (loginActivityResult.data ?? []) as ParticipantLoginActivity[];
        setLastLoginAt(activity[0]?.last_login_at ?? null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat detail peserta.";
      notify(`Gagal memuat detail peserta: ${message}`, "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [notify, participantId]);

  useEffect(() => {
    void fetchData();
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
      const { data: existingGuardian, error: existingError } = await supabase
        .from("guardians")
        .select("id")
        .eq("user_id", selectedProfileId)
        .maybeSingle();

      if (existingError) throw existingError;

      let guardianId = existingGuardian?.id as string | undefined;

      if (!guardianId) {
        const { data: newGuardian, error: guardianError } = await supabase
          .from("guardians")
          .insert([{ user_id: selectedProfileId }])
          .select("id")
          .single();

        if (guardianError) throw guardianError;
        guardianId = newGuardian.id as string;
      }

      const { error: linkError } = await supabase.from("guardian_participants").insert([
        {
          guardian_id: guardianId,
          participant_id: participantId,
          is_primary: guardianRels.length === 0,
        },
      ]);

      if (linkError) throw linkError;

      notify("Wali berhasil ditautkan.");
      setIsGuardianModalOpen(false);
      await fetchData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Wali sudah tertaut atau terjadi kesalahan.";
      notify(`Gagal menautkan wali: ${message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPrimaryGuardian = async (relationId: string) => {
    if (!participantId) return;
    setIsSubmitting(true);

    try {
      const { error: resetError } = await supabase
        .from("guardian_participants")
        .update({ is_primary: false })
        .eq("participant_id", participantId);

      if (resetError) throw resetError;

      const { error: primaryError } = await supabase
        .from("guardian_participants")
        .update({ is_primary: true })
        .eq("id", relationId);

      if (primaryError) throw primaryError;

      notify("Wali utama berhasil diperbarui.");
      await fetchData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengubah wali utama.";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveGuardian = async (relationId: string) => {
    if (!window.confirm("Hapus tautan wali dari peserta ini?")) return;

    setIsSubmitting(true);
    const { error } = await supabase.from("guardian_participants").delete().eq("id", relationId);

    if (error) {
      notify(`Gagal menghapus wali: ${error.message}`, "error");
    } else {
      notify("Tautan wali berhasil dihapus.");
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
        <Button variant="outline" onClick={() => navigate(`${basePath}/peserta`)} className="h-10 whitespace-nowrap !text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Direktori Peserta
        </Button>
      </div>
    );
  }

  return (
    <div className="page-stack max-w-7xl pb-12">
      <div className="page-hero flex flex-col gap-6 overflow-hidden lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white text-4xl font-bold text-primary shadow-sm">
            {getInitial(participant.display_name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Detail Peserta</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-white">{participant.display_name}</h1>
            <div className="mt-3 flex flex-wrap gap-2 leading-none">
              <Badge variant="outline" className="border-white/30 bg-white/15 font-mono text-white">
                {participant.global_participant_number}
              </Badge>
              <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                {getParticipantTypeLabel(participant.participant_type)}
              </Badge>
              <Badge variant="outline" className={statusInfo.className}>
                {statusInfo.label}
              </Badge>
              {activeEnrollments > 0 && (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  {activeEnrollments} Program Aktif
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
            onClick={() => navigate(`${basePath}/peserta`)}
            className="h-10 min-w-[120px] whitespace-nowrap border-white/35 bg-white/15 !text-white hover:bg-white/25 hover:!text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Direktori
          </Button>
          <Button
            variant="outline"
            onClick={() => void fetchData(true)}
            disabled={isRefreshing}
            className="h-10 min-w-[130px] whitespace-nowrap border-white/35 bg-white/15 !text-white hover:bg-white/25 hover:!text-white disabled:!text-white"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Muat Ulang
          </Button>
          <Button
            onClick={() => setActiveTab("academic")}
            className="h-10 min-w-[140px] whitespace-nowrap bg-white !text-primary shadow-lg hover:bg-white/90"
          >
            <FileText className="h-4 w-4" />
            Cek Transkrip
          </Button>
        </div>
      </div>

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

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Menu Detail</CardTitle>
              <CardDescription>Navigasi subfitur peserta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {detailTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                const count = tab.key === "guardians" ? guardianRels.length : tab.key === "academic" ? enrollments.length : undefined;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`min-h-[76px] w-full rounded-lg border p-3 text-left transition ${
                      isActive ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold leading-tight">
                        <Icon className="h-4 w-4 shrink-0" />
                        {tab.label}
                      </span>
                      {typeof count === "number" && (
                        <span className={`min-w-6 rounded-full px-2 py-0.5 text-center text-xs ${isActive ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>{count}</span>
                      )}
                    </span>
                    <span className={`mt-1 block text-xs leading-snug ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{tab.desc}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Kelengkapan Data</CardTitle>
              <CardDescription>{completionPercent}% siap operasional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${completionPercent}%` }} />
              </div>
              {completionItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </span>
                    {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>

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
                    <p className="text-sm font-bold leading-snug">{formatDateTime(lastLoginAt)}</p>
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
                  <CardTitle>Workflow Tindak Lanjut</CardTitle>
                  <CardDescription>Prioritas operasional agar peserta siap belajar dan terdokumentasi dengan baik.</CardDescription>
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
                  <CardTitle>Snapshot Peserta</CardTitle>
                  <CardDescription>Informasi cepat untuk admin sebelum melakukan tindakan.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <InfoRow icon={Mail} label="Email" value={profileData?.email} />
                  <InfoRow icon={Phone} label="Telepon / WhatsApp" value={profileData?.phone || participant.phone} />
                  <InfoRow icon={MapPin} label="Domisili" value={participant.city} />
                  <InfoRow icon={GraduationCap} label="Pendidikan" value={participant.education_level} />
                  <InfoRow icon={Calendar} label="Tanggal Bergabung" value={formatDate(participant.joined_at, { day: "numeric", month: "long", year: "numeric" })} />
                  <InfoRow icon={Clock3} label="Login Terakhir" value={formatDateTime(lastLoginAt)} />
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
                  <InfoRow icon={Clock3} label="Login Terakhir" value={formatDateTime(lastLoginAt)} />
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
                      <Button variant="outline" className="h-10 w-full whitespace-nowrap !text-foreground" onClick={() => navigate(`${basePath}/pengguna`)}>
                        <KeyRound className="h-4 w-4" />
                        Kelola Akun & Akses
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed bg-background p-6 text-center">
                      <User className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                      <p className="font-semibold">Belum Ada Akun Login</p>
                      <p className="mt-1 text-sm text-muted-foreground">Peserta belum dapat masuk ke portal learner.</p>
                      <Button className="mt-4 h-10 w-full whitespace-nowrap bg-primary !text-white hover:bg-primary/90" onClick={() => navigate(`${basePath}/pengguna`)}>
                        Kelola Pengguna
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
                              onClick={() => void handleRemoveGuardian(rel.id)}
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
                <CardTitle>Riwayat Pendaftaran & Akademik</CardTitle>
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
                                    <p className="font-bold">{enrollment.programs?.name || "Program tanpa nama"}</p>
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
                                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                    Belum ditempatkan
                                  </Badge>
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
                                  onClick={() => navigate(`${basePath}/peserta/${participantId}/transkrip/${enrollment.id}`)}
                                >
                                  <FileText className="h-4 w-4" />
                                  Transkrip
                                </Button>
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

      {isGuardianModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="border-b">
              <CardTitle>Tautkan Wali / Orang Tua</CardTitle>
              <CardDescription>Pilih profil pengguna yang akan menjadi wali peserta.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
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
            </CardContent>
          </Card>
        </div>
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
