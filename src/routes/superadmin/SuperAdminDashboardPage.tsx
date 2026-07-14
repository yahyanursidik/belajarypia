import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeDollarSign,
  BellRing,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  FileCheck,
  FileText,
  GraduationCap,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  RefreshCw,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  UserCog,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { supabase } from "../../lib/supabase";
import { useSystemSettings } from "../../lib/useSystemSettings";
import { cn } from "../../lib/utils";

type DashboardMetrics = {
  users: number;
  programs: number;
  activePrograms: number;
  draftPrograms: number;
  participants: number;
  units: number;
  applicants: number;
  activeForms: number;
  failedCertificateBatches: number;
  openTickets: number;
};

type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string | null;
  entity_type: string | null;
  created_at: string | null;
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type AuditLogItem = AuditLogRow & {
  actorName: string;
};

type IconType = ComponentType<{ className?: string }>;

type ModuleLink = {
  label: string;
  href: string;
};

type ModuleCard = {
  title: string;
  description: string;
  href: string;
  icon: IconType;
  tone: string;
  links: ModuleLink[];
};

const initialMetrics: DashboardMetrics = {
  users: 0,
  programs: 0,
  activePrograms: 0,
  draftPrograms: 0,
  participants: 0,
  units: 0,
  applicants: 0,
  activeForms: 0,
  failedCertificateBatches: 0,
  openTickets: 0,
};

function countFrom(response: { count: number | null }): number {
  return response.count ?? 0;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Terjadi kendala saat memuat data beranda system.";
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildErrorSummary(errors: Array<unknown>): string | null {
  const message = errors
    .map((error) => {
      if (!error || typeof error !== "object" || !("message" in error)) return null;
      return String((error as { message?: string }).message ?? "");
    })
    .filter(Boolean)
    .at(0);

  return message ? `Sebagian data belum berhasil dimuat: ${message}` : null;
}

export function SuperAdminDashboardPage() {
  const { settings } = useSystemSettings();
  const dashboardTitle = settings?.system_header_title || "Pusat Kendali Sistem";
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);
  const [recentLogs, setRecentLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboardData = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const [
        usersRes,
        programsRes,
        activeProgramsRes,
        draftProgramsRes,
        participantsRes,
        unitsRes,
        applicantsRes,
        activeFormsRes,
        failedCertificateBatchesRes,
        openTicketsRes,
        logsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("programs").select("id", { count: "exact", head: true }),
        supabase.from("programs").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("programs").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("participants").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id", { count: "exact", head: true }),
        supabase.from("applicants").select("id", { count: "exact", head: true }),
        supabase.from("registration_forms").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("certificate_issuance_batches").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("helpdesk_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
        supabase
          .from("audit_logs")
          .select("id,user_id,action,entity_type,created_at")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const possibleErrors = [
        usersRes.error,
        programsRes.error,
        activeProgramsRes.error,
        draftProgramsRes.error,
        participantsRes.error,
        unitsRes.error,
        applicantsRes.error,
        activeFormsRes.error,
        failedCertificateBatchesRes.error,
        openTicketsRes.error,
        logsRes.error,
      ];
      setErrorMessage(buildErrorSummary(possibleErrors));

      setMetrics({
        users: countFrom(usersRes),
        programs: countFrom(programsRes),
        activePrograms: countFrom(activeProgramsRes),
        draftPrograms: countFrom(draftProgramsRes),
        participants: countFrom(participantsRes),
        units: countFrom(unitsRes),
        applicants: countFrom(applicantsRes),
        activeForms: countFrom(activeFormsRes),
        failedCertificateBatches: countFrom(failedCertificateBatchesRes),
        openTickets: countFrom(openTicketsRes),
      });

      const rawLogs = (logsRes.data ?? []) as AuditLogRow[];
      const userIds = Array.from(new Set(rawLogs.map((log) => log.user_id).filter((id): id is string => Boolean(id))));
      const profilesRes = userIds.length
        ? await supabase.from("profiles").select("id,full_name,email").in("id", userIds)
        : { data: [] as ProfileLite[], error: null };

      if (profilesRes.error) setErrorMessage(buildErrorSummary([profilesRes.error]));

      const profileMap = new Map(
        ((profilesRes.data ?? []) as ProfileLite[]).map((profile) => [
          profile.id,
          profile.full_name || profile.email || "Pengguna",
        ]),
      );

      setRecentLogs(
        rawLogs.map((log) => ({
          ...log,
          actorName: log.user_id ? profileMap.get(log.user_id) ?? "Pengguna" : "Sistem",
        })),
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const priorityItems = useMemo(
    () => [
      {
        label: "Form pendaftaran aktif",
        value: metrics.activeForms,
        description: "Pastikan jadwal buka/tutup dan link undangan tetap relevan.",
        href: "/system/pendaftaran",
        icon: ClipboardList,
        tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      {
        label: "Program draft",
        value: metrics.draftPrograms,
        description: "Lengkapi detail, silabus, kurikulum, kelas, bank soal, dan kelulusan.",
        href: "/system/program",
        icon: BookOpen,
        tone: "bg-amber-50 text-amber-700 border-amber-200",
      },
      {
        label: "Tiket layanan terbuka",
        value: metrics.openTickets,
        description: "Tindak lanjuti kendala peserta, pengajar, dan admin unit.",
        href: "/system/helpdesk",
        icon: HelpCircle,
        tone: "bg-sky-50 text-sky-700 border-sky-200",
      },
      {
        label: "Batch sertifikat gagal",
        value: metrics.failedCertificateBatches,
        description: "Periksa antrean penerbitan syahadah dan jalankan ulang bila perlu.",
        href: "/system/sertifikat/antrean",
        icon: FileCheck,
        tone: "bg-rose-50 text-rose-700 border-rose-200",
      },
    ],
    [metrics.activeForms, metrics.draftPrograms, metrics.failedCertificateBatches, metrics.openTickets],
  );

  const moduleGroups = useMemo(
    () => [
      {
        title: "Operasional Akademik",
        description: "Kelola alur belajar dari admisi sampai kelulusan.",
        modules: [
          {
            title: "Admisi & Pendaftaran",
            description: "Form, jadwal pendaftaran, undangan grup, dan data pendaftar.",
            href: "/system/pendaftaran",
            icon: ClipboardList,
            tone: "bg-emerald-50 text-emerald-700",
            links: [
              { label: "Form & Undangan", href: "/system/pendaftaran" },
              { label: "Pendaftar", href: "/system/pendaftaran?tab=pendaftar" },
              { label: "Workflow", href: "/system/pendaftaran?tab=workflow" },
            ],
          },
          {
            title: "Peserta & Akademik",
            description: "Direktori peserta, detail profil, transkrip, dan progres belajar.",
            href: "/system/peserta",
            icon: Users,
            tone: "bg-teal-50 text-teal-700",
            links: [
              { label: "Direktori", href: "/system/peserta" },
              { label: "Konfigurasi Transkrip", href: "/system/peserta?tab=transkrip" },
              { label: "Detail Peserta", href: "/system/peserta" },
            ],
          },
          {
            title: "Program",
            description: "Detail program, silabus, kurikulum, kelas, bank soal, dan kelulusan.",
            href: "/system/program",
            icon: GraduationCap,
            tone: "bg-indigo-50 text-indigo-700",
            links: [
              { label: "Katalog", href: "/system/program" },
              { label: "Kurikulum", href: "/system/program" },
              { label: "Bank Soal", href: "/system/program" },
            ],
          },
          {
            title: "Syahadah & Sertifikat",
            description: "Template, cek kelayakan, antrean penerbitan, dan audit output.",
            href: "/system/sertifikat",
            icon: Trophy,
            tone: "bg-amber-50 text-amber-700",
            links: [
              { label: "Template", href: "/system/sertifikat" },
              { label: "Cek Kelayakan", href: "/system/sertifikat/kelayakan" },
              { label: "Antrean", href: "/system/sertifikat/antrean" },
            ],
          },
        ] satisfies ModuleCard[],
      },
      {
        title: "Komunikasi & Layanan",
        description: "Publikasi informasi, pembayaran, dan dukungan pengguna.",
        modules: [
          {
            title: "Pengumuman",
            description: "Broadcast informasi ke role, program, dan kanal peserta.",
            href: "/system/pengumuman",
            icon: Megaphone,
            tone: "bg-cyan-50 text-cyan-700",
            links: [
              { label: "Semua Pengumuman", href: "/system/pengumuman" },
              { label: "Buat Baru", href: "/system/pengumuman" },
            ],
          },
          {
            title: "Keuangan & Akuntansi",
            description: "Pantau transaksi, infaq, donasi, wakaf, kanal pembayaran, reminder donatur, dan jurnal akuntansi.",
            href: "/system/keuangan",
            icon: BadgeDollarSign,
            tone: "bg-lime-50 text-lime-700",
            links: [
              { label: "Ringkasan", href: "/system/keuangan" },
              { label: "Transaksi", href: "/system/keuangan?tab=transactions" },
              { label: "Donatur Rutin", href: "/system/keuangan?tab=recurring" },
              { label: "Akuntansi", href: "/system/keuangan?tab=accounting" },
            ],
          },
          {
            title: "Helpdesk",
            description: "Triage tiket, eskalasi kendala, dan pantau SLA layanan.",
            href: "/system/helpdesk",
            icon: HelpCircle,
            tone: "bg-sky-50 text-sky-700",
            links: [
              { label: "Tiket Aktif", href: "/system/helpdesk" },
              { label: "Riwayat", href: "/system/helpdesk" },
            ],
          },
        ] satisfies ModuleCard[],
      },
      {
        title: "Tata Kelola Sistem",
        description: "Akses, konfigurasi global, dan jejak aktivitas kritis.",
        modules: [
          {
            title: "Akses & Pengguna",
            description: "Role, akun admin, pengajar, peserta, dan kebijakan akses.",
            href: "/system/pengguna",
            icon: UserCog,
            tone: "bg-violet-50 text-violet-700",
            links: [
              { label: "Pengguna", href: "/system/pengguna" },
              { label: "Role", href: "/system/pengguna" },
            ],
          },
          {
            title: "Audit Sistem",
            description: "Telusuri aktivitas, perubahan data, dan kejadian penting.",
            href: "/system/audit",
            icon: ShieldAlert,
            tone: "bg-rose-50 text-rose-700",
            links: [
              { label: "Log Aktivitas", href: "/system/audit" },
              { label: "Filter Risiko", href: "/system/audit" },
            ],
          },
          {
            title: "Pengaturan Global",
            description: "Konfigurasi identitas, fitur, portal, dan aturan LMS.",
            href: "/system/pengaturan",
            icon: Settings,
            tone: "bg-slate-100 text-slate-700",
            links: [
              { label: "Konfigurasi", href: "/system/pengaturan" },
              { label: "Portal", href: "/system/pengaturan" },
            ],
          },
        ] satisfies ModuleCard[],
      },
    ],
    [],
  );

  const metricCards = [
    {
      label: "Pengguna",
      value: metrics.users.toLocaleString("id-ID"),
      description: "Akun lintas role",
      icon: Users,
      href: "/system/pengguna",
    },
    {
      label: "Program",
      value: metrics.programs.toLocaleString("id-ID"),
      description: `${metrics.activePrograms} aktif, ${metrics.draftPrograms} draft`,
      icon: GraduationCap,
      href: "/system/program",
    },
    {
      label: "Peserta",
      value: metrics.participants.toLocaleString("id-ID"),
      description: "Profil akademik",
      icon: BookOpen,
      href: "/system/peserta",
    },
    {
      label: "Pendaftar",
      value: metrics.applicants.toLocaleString("id-ID"),
      description: `${metrics.activeForms} form aktif`,
      icon: FileText,
      href: "/system/pendaftaran",
    },
    {
      label: "Unit",
      value: metrics.units.toLocaleString("id-ID"),
      description: "Unit operasional",
      icon: Building2,
      href: "/system/pengaturan",
    },
  ];

  return (
    <div className="page-stack space-y-6 pb-12">
      <section className="page-hero">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="hidden h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner backdrop-blur-xl sm:flex">
              <LayoutDashboard className="h-8 w-8 text-white" />
            </div>
            <div>
              <Badge variant="secondary" className="mb-3 border-white/30 bg-white/20 text-white shadow-sm backdrop-blur-sm">
                BERANDA SYSTEM
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight text-white">{dashboardTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
                Pantau prioritas operasional, masuk ke modul penting, dan cek kesehatan LMS dari satu halaman kerja.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="bg-white !text-primary hover:bg-white/90"
              onClick={() => void loadDashboardData(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
              Muat Ulang
            </Button>
            <Button asChild variant="secondary" className="bg-white/15 text-white hover:bg-white/25">
              <Link to="/system/program">
                <GraduationCap className="mr-2 h-4 w-4" />
                Kelola Program
              </Link>
            </Button>
            <Button asChild variant="secondary" className="bg-white/15 text-white hover:bg-white/25">
              <Link to="/system/pengaturan">
                <Settings className="mr-2 h-4 w-4" />
                Pengaturan
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {errorMessage && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Data belum lengkap</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((metric) => (
          <Card key={metric.label} className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                    {isLoading ? "-" : metric.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.description}</p>
                </div>
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <metric.icon className="h-5 w-5" />
                </div>
              </div>
              <Button asChild variant="ghost" className="mt-4 h-auto p-0 text-primary hover:bg-transparent hover:text-primary">
                <Link to={metric.href}>
                  Buka modul
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Menu & Workflow System</CardTitle>
                  <CardDescription>
                    Sub menu dikelompokkan berdasarkan pekerjaan agar admin bisa bergerak tanpa menumpuk halaman.
                  </CardDescription>
                </div>
                <Button asChild variant="outline">
                  <Link to="/system/audit">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Audit
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {moduleGroups.map((group) => (
                <section key={group.title} className="space-y-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{group.title}</h2>
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {group.modules.map((module) => (
                      <Card key={module.title} className="border-border/60 shadow-none">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={cn("rounded-xl p-2", module.tone)}>
                              <module.icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="font-semibold leading-tight text-foreground">{module.title}</h3>
                                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{module.description}</p>
                                </div>
                                <Button asChild size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                                  <Link to={module.href} aria-label={`Buka ${module.title}`}>
                                    <ArrowRight className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {module.links.map((link) => (
                                  <Button key={`${module.title}-${link.label}`} asChild size="sm" variant="outline" className="h-8">
                                    <Link to={link.href}>{link.label}</Link>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-primary" />
                Prioritas Hari Ini
              </CardTitle>
              <CardDescription>Hal yang paling perlu dipantau dari beranda system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {priorityItems.map((item) => (
                <Link key={item.label} to={item.href} className="block rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/50">
                  <div className="flex items-start gap-3">
                    <div className={cn("rounded-lg border p-2", item.tone)}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-foreground">{item.label}</p>
                        <Badge variant="secondary">{isLoading ? "-" : item.value.toLocaleString("id-ID")}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Kesehatan System
              </CardTitle>
              <CardDescription>Ringkasan status layanan inti LMS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Database", desc: "Query dashboard berhasil dijalankan.", icon: Database, ok: !errorMessage },
                { label: "Audit Log", desc: "Aktivitas terakhir dapat ditelusuri.", icon: ShieldCheck, ok: !errorMessage },
                { label: "Portal", desc: "Navigasi utama siap digunakan.", icon: Server, ok: true },
                { label: "Akses", desc: "Menu super admin tersedia.", icon: KeyRound, ok: true },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={item.ok ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"}
                  >
                    {item.ok ? "Normal" : "Perlu cek"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Aktivitas Terbaru
                  </CardTitle>
                  <CardDescription>Log terbaru tanpa join schema cache.</CardDescription>
                </div>
                <Button asChild size="icon" variant="ghost">
                  <Link to="/system/audit" aria-label="Buka audit sistem">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentLogs.length ? (
                <div className="space-y-4">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Activity className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{log.actorName}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
                            {log.action ?? "activity"}
                          </Badge>
                          <span>{log.entity_type ?? "system"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/system/audit">Lihat Semua Aktivitas</Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-primary/70" />
                  <p className="mt-2 text-sm font-medium text-foreground">Belum ada aktivitas terbaru</p>
                  <p className="mt-1 text-xs text-muted-foreground">Data akan muncul setelah ada aksi admin di system.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
