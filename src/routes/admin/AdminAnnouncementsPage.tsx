import { useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react";
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Clock3,
  Eye,
  FileEdit,
  LayoutDashboard,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Target,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { supabase } from "../../lib/supabase";

type AnnouncementStatus = "draft" | "published";
type AnnouncementTargetRole = "all" | "participant" | "teacher" | "admin";
type AnnouncementTab = "overview" | "manage" | "compose";

type ProgramOption = {
  id: string;
  name: string;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  target_role: AnnouncementTargetRole | string;
  target_program_id: string | null;
  status: AnnouncementStatus | string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  programs?: Pick<ProgramOption, "name"> | null;
  profiles?: { full_name: string | null } | null;
};

type AnnouncementForm = {
  title: string;
  content: string;
  target_role: AnnouncementTargetRole;
  target_program_id: string;
  status: AnnouncementStatus;
};

const emptyForm: AnnouncementForm = {
  title: "",
  content: "",
  target_role: "all",
  target_program_id: "",
  status: "published",
};

const announcementTabs: Array<{
  key: AnnouncementTab;
  label: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "overview", label: "Ringkasan", desc: "Kesehatan kanal & workflow", icon: LayoutDashboard },
  { key: "manage", label: "Daftar & Moderasi", desc: "Cari, preview, publish/draft", icon: BellRing },
  { key: "compose", label: "Komposer", desc: "Tulis dan segmentasikan pesan", icon: FileEdit },
];

const targetRoleLabel: Record<AnnouncementTargetRole | string, string> = {
  all: "Semua Pengguna",
  participant: "Peserta",
  teacher: "Pengajar",
  admin: "Admin",
};

const targetRoleDescription: Record<AnnouncementTargetRole, string> = {
  all: "Tampil untuk semua pengguna yang login.",
  participant: "Masuk ke dashboard peserta sesuai cakupan program.",
  teacher: "Disiapkan untuk komunikasi ke pengajar/asatidzah.",
  admin: "Untuk pengelola sistem dan operasional.",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan sistem.";
}

export function AdminAnnouncementsPage() {
  const { profile } = useAuthSession();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<AnnouncementTab>("overview");
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    targetRole: "all",
    programId: "all",
  });

  const selectedAnnouncement = useMemo(
    () => announcements.find((announcement) => announcement.id === selectedAnnouncementId) ?? announcements[0] ?? null,
    [announcements, selectedAnnouncementId],
  );

  const stats = useMemo(() => {
    return announcements.reduce(
      (current, announcement) => {
        current.total += 1;
        if (announcement.status === "published") current.published += 1;
        if (announcement.status === "draft") current.draft += 1;
        if (announcement.target_role === "all") current.broadcast += 1;
        if (announcement.target_program_id) current.programScoped += 1;
        return current;
      },
      { total: 0, published: 0, draft: 0, broadcast: 0, programScoped: 0 },
    );
  }, [announcements]);

  const filteredAnnouncements = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return announcements.filter((announcement) => {
      const matchesSearch =
        !normalizedSearch ||
        announcement.title.toLowerCase().includes(normalizedSearch) ||
        announcement.content.toLowerCase().includes(normalizedSearch);
      const matchesStatus = filters.status === "all" || announcement.status === filters.status;
      const matchesRole = filters.targetRole === "all" || announcement.target_role === filters.targetRole;
      const matchesProgram = filters.programId === "all" || announcement.target_program_id === filters.programId;

      return matchesSearch && matchesStatus && matchesRole && matchesProgram;
    });
  }, [announcements, filters]);

  const loadData = async () => {
    setIsLoading(true);

    const [{ data: annData, error: annError }, { data: progData, error: progError }] = await Promise.all([
      supabase
        .from("announcements")
        .select("*, programs(name), profiles(full_name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("programs")
        .select("id, name")
        .order("name"),
    ]);

    if (annError || progError) {
      setFeedback({
        message: annError?.message || progError?.message || "Gagal memuat data pengumuman.",
        type: "error",
      });
    }

    const nextAnnouncements = (annData ?? []) as unknown as Announcement[];
    setAnnouncements(nextAnnouncements);
    setPrograms((progData ?? []) as ProgramOption[]);
    setSelectedAnnouncementId((current) => current ?? nextAnnouncements[0]?.id ?? null);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!feedback) return;

    const timer = setTimeout(() => setFeedback(null), 4500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const resetComposer = () => {
    setForm(emptyForm);
  };

  const handleCreateAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) {
      setFeedback({ message: "Sesi admin tidak ditemukan. Silakan login ulang.", type: "error" });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const { error } = await supabase.from("announcements").insert({
        title: form.title.trim(),
        content: form.content.trim(),
        target_role: form.target_role,
        target_program_id: form.target_program_id || null,
        status: form.status,
        created_by: profile.id,
      });

      if (error) throw error;

      setFeedback({
        message: form.status === "published" ? "Pengumuman berhasil disiarkan." : "Draf pengumuman berhasil disimpan.",
        type: "success",
      });
      resetComposer();
      setActiveTab("manage");
      await loadData();
    } catch (error) {
      setFeedback({ message: `Gagal menyimpan pengumuman: ${getErrorMessage(error)}`, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateAnnouncementStatus = async (announcement: Announcement, status: AnnouncementStatus) => {
    setFeedback(null);

    const { error } = await supabase
      .from("announcements")
      .update({ status })
      .eq("id", announcement.id);

    if (error) {
      setFeedback({ message: `Gagal mengubah status: ${error.message}`, type: "error" });
      return;
    }

    setFeedback({
      message: status === "published" ? "Pengumuman sudah dipublikasikan." : "Pengumuman dipindahkan ke draf.",
      type: "success",
    });
    await loadData();
  };

  const handleDelete = async (announcement: Announcement) => {
    if (!confirm(`Hapus pengumuman "${announcement.title}"?`)) return;

    const { error } = await supabase.from("announcements").delete().eq("id", announcement.id);
    if (error) {
      setFeedback({ message: `Gagal menghapus: ${error.message}`, type: "error" });
      return;
    }

    setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
    setSelectedAnnouncementId((current) => (current === announcement.id ? null : current));
    setFeedback({ message: "Pengumuman telah dihapus.", type: "success" });
  };

  const openCompose = (status: AnnouncementStatus = "published") => {
    setFeedback(null);
    setForm((current) => ({ ...current, status }));
    setActiveTab("compose");
  };

  const statusClass = (status: string) =>
    status === "published"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <div className="page-stack space-y-6 pb-12">
      <section className="page-hero">
        <Badge>Komunikasi</Badge>
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="hidden h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner backdrop-blur-xl md:flex">
            <Megaphone className="h-10 w-10 text-white drop-shadow-md" />
          </div>
          <div>
            <h2>Pusat Pengumuman</h2>
            <p>
              Kelola pesan siaran LMS dari perencanaan, segmentasi audiens,
              publikasi, sampai moderasi konten yang sudah tayang.
            </p>
          </div>
          <div className="md:ml-auto flex flex-wrap gap-2">
            <Button onClick={() => void loadData()} variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => openCompose("published")} className="bg-white text-primary hover:bg-white/90">
              <Plus className="h-4 w-4" />
              Buat Pengumuman
            </Button>
          </div>
        </div>
      </section>

      {feedback && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 shadow-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
          )}
          <div className="flex-1">
            <h4 className="text-sm font-semibold">{feedback.type === "success" ? "Berhasil" : "Terdapat Kesalahan"}</h4>
            <p className="mt-0.5 text-sm opacity-90">{feedback.message}</p>
          </div>
          <button className="opacity-70 transition-opacity hover:opacity-100" onClick={() => setFeedback(null)} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-3 rounded-xl border bg-white p-2 shadow-sm md:grid-cols-3">
        {announcementTabs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;

          return (
            <button
              className={`flex items-start gap-3 rounded-lg p-4 text-left transition-colors ${
                isActive ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              type="button"
            >
              <Icon className={`mt-0.5 h-5 w-5 ${isActive ? "text-white" : "text-primary"}`} />
              <span>
                <span className="block text-sm font-bold">{item.label}</span>
                <span className={`mt-0.5 block text-xs ${isActive ? "text-white/75" : "text-slate-500"}`}>{item.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Pengumuman", value: stats.total, icon: Megaphone, tone: "bg-slate-100 text-slate-700" },
              { label: "Sedang Tayang", value: stats.published, icon: Send, tone: "bg-emerald-50 text-emerald-700" },
              { label: "Draf", value: stats.draft, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
              { label: "Target Program", value: stats.programScoped, icon: Target, tone: "bg-sky-50 text-sky-700" },
            ].map((metric) => {
              const Icon = metric.icon;

              return (
                <Card className="border-slate-200 shadow-sm" key={metric.label}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className={`grid h-12 w-12 place-items-center rounded-lg ${metric.tone}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{metric.label}</p>
                      <p className="text-3xl font-bold">{isLoading ? "-" : metric.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Workflow Pengumuman</CardTitle>
                  <CardDescription>Alur kerja komunikasi agar pesan tidak tercecer dan targetnya jelas.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => openCompose("draft")}>
                  Simpan Draf Baru
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { title: "Rencanakan", value: stats.draft, desc: "Draf yang belum tayang", color: "border-amber-200 bg-amber-50 text-amber-800" },
                    { title: "Segmentasikan", value: stats.broadcast + stats.programScoped, desc: "Target role dan program", color: "border-sky-200 bg-sky-50 text-sky-800" },
                    { title: "Publikasikan", value: stats.published, desc: "Pesan aktif di portal", color: "border-emerald-200 bg-emerald-50 text-emerald-800" },
                  ].map((step) => (
                    <div className={`rounded-lg border p-4 ${step.color}`} key={step.title}>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="mt-2 text-3xl font-bold">{isLoading ? "-" : step.value}</p>
                      <p className="mt-2 text-xs opacity-80">{step.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">Rekomendasi workflow</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Buat draf untuk pengumuman penting, cek target audiens dan program, lalu publish ketika pesan sudah final.
                    Pengumuman program akan tetap tampil hanya untuk peserta yang relevan.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Pengumuman Terbaru</CardTitle>
                <CardDescription>Cuplikan pesan yang paling baru dibuat.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {announcements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>
                ) : (
                  announcements.slice(0, 5).map((announcement) => (
                    <button
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                      key={announcement.id}
                      onClick={() => {
                        setSelectedAnnouncementId(announcement.id);
                        setActiveTab("manage");
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{announcement.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{announcement.content}</p>
                        </div>
                        <Badge className={statusClass(announcement.status)} variant="outline">
                          {announcement.status === "published" ? "Tayang" : "Draf"}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "manage" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Daftar & Moderasi</CardTitle>
                  <CardDescription>Cari pengumuman, cek target, lalu ubah status publikasinya.</CardDescription>
                </div>
                <Button onClick={() => openCompose("published")} size="sm">
                  <Plus className="h-4 w-4" />
                  Buat Baru
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_160px_170px_190px]">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Cari judul atau isi..."
                    value={filters.search}
                  />
                </div>
                <select
                  className="field-control text-sm"
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                  value={filters.status}
                >
                  <option value="all">Semua Status</option>
                  <option value="published">Tayang</option>
                  <option value="draft">Draf</option>
                </select>
                <select
                  className="field-control text-sm"
                  onChange={(event) => setFilters((current) => ({ ...current, targetRole: event.target.value }))}
                  value={filters.targetRole}
                >
                  <option value="all">Semua Audiens</option>
                  <option value="participant">Peserta</option>
                  <option value="teacher">Pengajar</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  className="field-control text-sm"
                  onChange={(event) => setFilters((current) => ({ ...current, programId: event.target.value }))}
                  value={filters.programId}
                >
                  <option value="all">Semua Program</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>{program.name}</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-y border-border/50 bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Pengumuman</th>
                      <th className="px-6 py-4 font-semibold">Target</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td className="px-6 py-16 text-center text-slate-500" colSpan={4}>
                          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                          Memuat data pengumuman...
                        </td>
                      </tr>
                    ) : filteredAnnouncements.length === 0 ? (
                      <tr>
                        <td className="px-6 py-16 text-center text-slate-500" colSpan={4}>
                          <Megaphone className="mx-auto mb-4 h-14 w-14 text-slate-200" />
                          <p className="font-medium text-slate-700">Tidak ada pengumuman yang cocok.</p>
                          <p className="mt-1 text-sm">Ubah filter atau buat pengumuman baru.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredAnnouncements.map((announcement) => (
                        <tr
                          className={`cursor-pointer transition-colors ${
                            selectedAnnouncement?.id === announcement.id ? "bg-primary/5" : "hover:bg-slate-50"
                          }`}
                          key={announcement.id}
                          onClick={() => setSelectedAnnouncementId(announcement.id)}
                        >
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800">{announcement.title}</p>
                            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{announcement.content}</p>
                            <p className="mt-1 text-[11px] text-slate-400">Dibuat {formatDateTime(announcement.created_at)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <Badge variant="secondary">{targetRoleLabel[announcement.target_role] ?? announcement.target_role}</Badge>
                              {announcement.programs?.name && (
                                <p className="w-fit rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {announcement.programs.name}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge className={statusClass(announcement.status)} variant="outline">
                              {announcement.status === "published" ? "Tayang" : "Draf"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                              <Button
                                onClick={() => setSelectedAnnouncementId(announcement.id)}
                                size="sm"
                                variant="ghost"
                                title="Preview"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={() => void updateAnnouncementStatus(announcement, announcement.status === "published" ? "draft" : "published")}
                                size="sm"
                                variant="ghost"
                                title={announcement.status === "published" ? "Jadikan draf" : "Publish"}
                              >
                                {announcement.status === "published" ? <Clock3 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                              </Button>
                              <Button
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => void handleDelete(announcement)}
                                size="sm"
                                variant="ghost"
                                title="Hapus"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Preview Pengumuman</CardTitle>
              <CardDescription>Tampilan isi dan cakupan pesan yang dipilih.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedAnnouncement ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  Pilih pengumuman untuk melihat preview.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
                    <Megaphone className="mb-3 h-5 w-5 text-indigo-600" />
                    <h3 className="font-bold text-indigo-950">{selectedAnnouncement.title}</h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-indigo-900/80">{selectedAnnouncement.content}</p>
                  </div>
                  <dl className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3 border-b pb-3">
                      <dt className="text-muted-foreground">Audiens</dt>
                      <dd className="text-right font-medium">{targetRoleLabel[selectedAnnouncement.target_role] ?? selectedAnnouncement.target_role}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 border-b pb-3">
                      <dt className="text-muted-foreground">Program</dt>
                      <dd className="text-right font-medium">{selectedAnnouncement.programs?.name ?? "Semua Program"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 border-b pb-3">
                      <dt className="text-muted-foreground">Penulis</dt>
                      <dd className="text-right font-medium">{selectedAnnouncement.profiles?.full_name ?? "Admin"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">Update</dt>
                      <dd className="text-right font-medium">{formatDateTime(selectedAnnouncement.updated_at)}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "compose" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Komposer Pengumuman</CardTitle>
              <CardDescription>Tulis pesan, pilih audiens, lalu simpan sebagai draf atau siarkan langsung.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleCreateAnnouncement}>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="announcement-title">
                    Judul Pengumuman
                  </label>
                  <Input
                    id="announcement-title"
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Contoh: Jadwal orientasi peserta baru"
                    required
                    value={form.title}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="announcement-content">
                    Isi Pengumuman
                  </label>
                  <textarea
                    className="min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    id="announcement-content"
                    onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                    placeholder="Tulis pesan lengkap di sini..."
                    required
                    value={form.content}
                  />
                </div>

                <div className="grid gap-5 rounded-xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-700" htmlFor="announcement-target-role">
                      Target Audiens
                    </label>
                    <select
                      className="field-control text-sm"
                      id="announcement-target-role"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, target_role: event.target.value as AnnouncementTargetRole }))
                      }
                      value={form.target_role}
                    >
                      <option value="all">Semua Pengguna</option>
                      <option value="participant">Peserta</option>
                      <option value="teacher">Pengajar</option>
                      <option value="admin">Admin</option>
                    </select>
                    <p className="text-xs text-muted-foreground">{targetRoleDescription[form.target_role]}</p>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-700" htmlFor="announcement-program">
                      Target Program
                    </label>
                    <select
                      className="field-control text-sm"
                      id="announcement-program"
                      onChange={(event) => setForm((current) => ({ ...current, target_program_id: event.target.value }))}
                      value={form.target_program_id}
                    >
                      <option value="">Semua Program</option>
                      {programs.map((program) => (
                        <option key={program.id} value={program.id}>{program.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">Pilih program jika pesan hanya relevan untuk satu program.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <select
                    className="field-control text-sm sm:w-[220px]"
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as AnnouncementStatus }))}
                    value={form.status}
                  >
                    <option value="published">Siarkan langsung</option>
                    <option value="draft">Simpan sebagai draf</option>
                  </select>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button onClick={resetComposer} type="button" variant="outline">
                      Reset
                    </Button>
                    <Button disabled={isSaving} type="submit">
                      {isSaving ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          {form.status === "published" ? "Simpan & Siarkan" : "Simpan Draf"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Preview Pesan</CardTitle>
              <CardDescription>Periksa tampilan sebelum disimpan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
                <Megaphone className="mb-3 h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-indigo-950">{form.title || "Judul pengumuman"}</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-indigo-900/80">
                  {form.content || "Isi pengumuman akan tampil di sini."}
                </p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <UsersRound className="h-4 w-4 text-primary" />
                    {targetRoleLabel[form.target_role]}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{targetRoleDescription[form.target_role]}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Target className="h-4 w-4 text-primary" />
                    {programs.find((program) => program.id === form.target_program_id)?.name ?? "Semua Program"}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Cakupan program untuk penerima pengumuman.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
