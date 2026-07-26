import {
  type ChangeEvent,
  type ComponentType,
  type FormEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  Globe2,
  ImageIcon,
  Info,
  Mail,
  MapPin,
  Monitor,
  Palette,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { emptySettings, fetchSystemSettings, updateSystemSettings, type SystemSettings } from "../../lib/settings";
import { THEME_OPTIONS, type PortalThemeConfig, type ThemeKey } from "../../lib/theme";
import { supabase } from "../../lib/supabase";

type SettingsTab = "overview" | "identity" | "branding" | "themes";
type AssetField = "logo_url" | "login_logo_url" | "favicon_url";
type Feedback = { type: "success" | "error" | "info"; message: string } | null;

const DEFAULT_THEMES: PortalThemeConfig = {
  admin: "slate",
  learner: "emerald",
  teacher: "indigo",
  mentor: "rose",
  public: "amber",
};
const MAX_ASSET_SIZE = 2 * 1024 * 1024;

const settingsTabs: Array<{
  id: SettingsTab;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Ringkasan", description: "Status konfigurasi dan preview cepat", icon: Monitor },
  { id: "identity", label: "Identitas & Kontak", description: "Profil lembaga dan kanal bantuan", icon: Building2 },
  { id: "branding", label: "Branding Visual", description: "Logo, login logo, dan favicon", icon: ImageIcon },
  { id: "themes", label: "Tema Portal", description: "Warna per portal pengguna", icon: Palette },
];

const portalLabels: Record<keyof PortalThemeConfig, { label: string; description: string }> = {
  admin: { label: "Pusat Kendali", description: "Super admin dan admin lembaga" },
  learner: { label: "Portal Peserta", description: "Peserta belajar dan wali" },
  teacher: { label: "Portal Pengajar", description: "Guru, ustadz, trainer, dan penguji" },
  mentor: { label: "Portal Musyrif", description: "Pendamping halaqah dan peserta binaan" },
  public: { label: "Portal Publik", description: "Landing, login, dan pendaftaran" },
};

function isSettingsColumnError(error: Error | null, columns: string[]) {
  const message = error?.message?.toLowerCase() || "";
  return columns.some((column) => message.includes(column.toLowerCase())) && message.includes("column");
}

function getDisplayTheme(portalThemes?: PortalThemeConfig | null): PortalThemeConfig {
  return {
    ...DEFAULT_THEMES,
    ...(portalThemes || {}),
  };
}

function getThemeName(themeId?: string | null) {
  return THEME_OPTIONS.find((theme) => theme.id === themeId)?.name || "Belum dipilih";
}

function buildSettingsPayload(formData: Partial<SystemSettings>): Partial<SystemSettings> {
  return {
    institution_name: formData.institution_name?.trim() || emptySettings.institution_name,
    institution_profile: formData.institution_profile || null,
    app_sidebar_title: formData.app_sidebar_title?.trim() || emptySettings.app_sidebar_title,
    app_sidebar_subtitle: formData.app_sidebar_subtitle?.trim() || emptySettings.app_sidebar_subtitle,
    system_header_title: formData.system_header_title?.trim() || emptySettings.system_header_title,
    system_header_subtitle: formData.system_header_subtitle?.trim() || emptySettings.system_header_subtitle,
    contact_email: formData.contact_email || null,
    contact_phone: formData.contact_phone || null,
    address: formData.address || null,
    logo_url: formData.logo_url || null,
    login_logo_url: formData.login_logo_url || null,
    favicon_url: formData.favicon_url || null,
    portal_themes: getDisplayTheme(formData.portal_themes),
  };
}

function payloadSignature(formData: Partial<SystemSettings>) {
  return JSON.stringify(buildSettingsPayload(formData));
}

export function GlobalSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [formData, setFormData] = useState<Partial<SystemSettings>>(emptySettings);
  const activeTabParam = searchParams.get("tab");
  const activeTab = settingsTabs.some((tab) => tab.id === activeTabParam) ? activeTabParam as SettingsTab : "overview";
  const changeTab = (tab: SettingsTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (tab === "overview") next.delete("tab");
      else next.set("tab", tab);
      return next;
    }, { replace: true });
  };
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingSettings, setIsCreatingSettings] = useState(false);
  const [uploadingField, setUploadingField] = useState<AssetField | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const fileInputLogoRef = useRef<HTMLInputElement>(null);
  const fileInputLoginLogoRef = useRef<HTMLInputElement>(null);
  const fileInputFaviconRef = useRef<HTMLInputElement>(null);

  const mergedThemes = getDisplayTheme(formData.portal_themes);
  const savedPayload = useMemo(() => (settings ? payloadSignature(settings) : ""), [settings]);
  const draftPayload = useMemo(() => payloadSignature(formData), [formData]);
  const hasUnsavedChanges = useMemo(() => {
    if (!settings) return false;
    return draftPayload !== savedPayload;
  }, [draftPayload, savedPayload, settings]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  const completionItems = [
    { label: "Nama lembaga", completed: Boolean(formData.institution_name?.trim()), icon: Building2 },
    { label: "Teks tampilan", completed: Boolean(formData.app_sidebar_title?.trim() && formData.system_header_title?.trim()), icon: Monitor },
    { label: "Email kontak", completed: Boolean(formData.contact_email?.trim()), icon: Mail },
    { label: "Nomor bantuan", completed: Boolean(formData.contact_phone?.trim()), icon: Phone },
    { label: "Alamat", completed: Boolean(formData.address?.trim()), icon: MapPin },
    { label: "Logo utama", completed: Boolean(formData.logo_url), icon: ImageIcon },
    { label: "Tema portal", completed: Boolean(formData.portal_themes), icon: Palette },
  ];
  const completionCount = completionItems.filter((item) => item.completed).length;
  const completionPercent = Math.round((completionCount / completionItems.length) * 100);

  const showFeedback = (nextFeedback: NonNullable<Feedback>) => {
    setFeedback(nextFeedback);
    window.setTimeout(() => setFeedback(null), nextFeedback.type === "error" ? 7000 : 4000);
  };

  const loadSettings = async () => {
    setIsLoading(true);
    setFeedback(null);
    const data = await fetchSystemSettings();
    if (data) {
      const normalized = { ...emptySettings, ...data, portal_themes: getDisplayTheme(data.portal_themes) };
      setSettings(normalized);
      setFormData(normalized);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>, field: AssetField) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isFavicon = field === "favicon_url";
    const isIconFile = file.name.toLowerCase().endsWith(".ico");
    const isImage = file.type.startsWith("image/");

    if (!isImage && !(isFavicon && isIconFile)) {
      showFeedback({ type: "error", message: "File harus berupa gambar. Favicon boleh memakai format .ico." });
      event.target.value = "";
      return;
    }

    if (file.size > MAX_ASSET_SIZE) {
      showFeedback({ type: "error", message: "Ukuran file maksimal 2 MB agar portal tetap cepat dimuat." });
      event.target.value = "";
      return;
    }

    setUploadingField(field);
    setFeedback(null);

    try {
      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${field}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("system_assets")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw new Error(`Gagal mengunggah file ke storage system_assets: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from("system_assets").getPublicUrl(fileName);
      setFormData((prev) => ({ ...prev, [field]: publicUrlData.publicUrl }));
      showFeedback({ type: "success", message: `${file.name} berhasil diunggah. Jangan lupa simpan pengaturan.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat mengunggah file.";
      showFeedback({ type: "error", message });
    } finally {
      setUploadingField(null);
      event.target.value = "";
    }
  };

  const handleCreateInitialSettings = async () => {
    setIsCreatingSettings(true);
    setFeedback(null);

    const { data, error } = await supabase
      .from("system_settings")
      .insert({
        institution_name: emptySettings.institution_name,
        institution_profile: emptySettings.institution_profile,
        app_sidebar_title: emptySettings.app_sidebar_title,
        app_sidebar_subtitle: emptySettings.app_sidebar_subtitle,
        system_header_title: emptySettings.system_header_title,
        system_header_subtitle: emptySettings.system_header_subtitle,
        contact_email: emptySettings.contact_email,
        contact_phone: emptySettings.contact_phone,
        address: emptySettings.address,
        logo_url: emptySettings.logo_url,
      })
      .select()
      .single();

    if (error) {
      showFeedback({
        type: "error",
        message: `Konfigurasi awal belum bisa dibuat: ${error.message}. Pastikan migration phase_7_system_settings sudah berjalan dan akun memiliki akses super_admin.`,
      });
    } else if (data) {
      const normalized = { ...emptySettings, ...(data as SystemSettings), portal_themes: DEFAULT_THEMES };
      setSettings(normalized);
      setFormData(normalized);
      changeTab("identity");
      showFeedback({ type: "success", message: "Konfigurasi awal berhasil dibuat. Lengkapi identitas lembaga berikutnya." });
    }

    setIsCreatingSettings(false);
  };

  const handleResetDraft = () => {
    if (!settings) return;
    setFormData({ ...settings, portal_themes: getDisplayTheme(settings.portal_themes) });
    showFeedback({ type: "info", message: "Draft dikembalikan ke konfigurasi terakhir yang tersimpan." });
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings?.id) {
      showFeedback({ type: "error", message: "Konfigurasi belum memiliki ID. Buat konfigurasi awal terlebih dahulu." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const payload = buildSettingsPayload(formData);
    const { error, data } = await updateSystemSettings(settings.id, payload);

    if (error) {
      if (
        isSettingsColumnError(error, [
          "portal_themes",
          "login_logo_url",
          "favicon_url",
          "app_sidebar_title",
          "app_sidebar_subtitle",
          "system_header_title",
          "system_header_subtitle",
        ])
      ) {
        showFeedback({
          type: "error",
          message:
            "Struktur tabel system_settings belum lengkap. Jalankan migration branding/portal theme dan migration 202607140002_system_display_text_settings.sql.",
        });
      } else {
        showFeedback({ type: "error", message: error.message });
      }
    } else if (data) {
      const latest = await fetchSystemSettings();
      const normalized = { ...emptySettings, ...(latest ?? data), portal_themes: getDisplayTheme((latest ?? data).portal_themes) };
      const savedSignature = payloadSignature(normalized);
      const requestedSignature = payloadSignature(payload);

      setSettings(normalized);
      setFormData(normalized);

      if (savedSignature !== requestedSignature) {
        showFeedback({
          type: "error",
          message:
            "Data sudah dikirim, tetapi hasil baca ulang dari database belum sama dengan perubahan draft. Cek policy RLS, trigger, atau migration system_settings.",
        });
      } else {
        showFeedback({ type: "success", message: "Pengaturan berhasil disimpan dan sudah dikonfirmasi dari database." });
      }
    }

    setIsSubmitting(false);
  };

  const handleThemeChange = (portal: keyof PortalThemeConfig, themeId: string) => {
    setFormData((prev) => ({
      ...prev,
      portal_themes: {
        ...getDisplayTheme(prev.portal_themes),
        [portal]: themeId as ThemeKey,
      },
    }));
  };

  const renderAssetCard = ({
    field,
    title,
    description,
    helper,
    inputRef,
    previewClassName,
  }: {
    field: AssetField;
    title: string;
    description: string;
    helper: string;
    inputRef: RefObject<HTMLInputElement | null>;
    previewClassName: string;
  }) => {
    const value = formData[field];
    const isUploading = uploadingField === field;

    return (
      <Card key={field} className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={field === "favicon_url" ? "image/*,.ico" : "image/*"}
            onChange={(event) => void handleFileUpload(event, field)}
          />

          {value ? (
            <div className="space-y-3">
              <div className="relative flex min-h-28 items-center justify-center rounded-lg border bg-muted/30 p-4">
                <img src={value} alt={title} className={previewClassName} />
                <Button
                  type="button"
                  variant="secondary"
                  className="absolute right-3 top-3 !text-foreground shadow-sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploading ? "Mengunggah..." : "Ganti"}
                </Button>
              </div>
              <Input
                value={value}
                onChange={(event) => setFormData((prev) => ({ ...prev, [field]: event.target.value }))}
                placeholder="URL aset"
                className="text-xs text-muted-foreground"
              />
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center text-foreground transition hover:border-primary/50 hover:bg-primary/5"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
              <span className="font-medium">{isUploading ? "Mengunggah..." : "Klik untuk memilih gambar"}</span>
              <span className="mt-1 text-xs text-muted-foreground">{helper}</span>
            </button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="page-stack flex min-h-[40vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="text-sm text-muted-foreground">Memuat pengaturan sistem...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="page-stack max-w-5xl">
        <div className="page-hero">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">System Settings</p>
            <h1 className="mt-2 text-3xl font-bold">Pengaturan Global</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Konfigurasi awal belum ditemukan. Buat data dasar agar identitas lembaga, branding, dan tema portal bisa
              dikelola dari halaman ini.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void handleCreateInitialSettings()}
            disabled={isCreatingSettings}
            className="bg-white !text-primary shadow-lg hover:bg-white/90"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {isCreatingSettings ? "Membuat..." : "Buat Konfigurasi Awal"}
          </Button>
        </div>

        {feedback && (
          <Alert className={feedback.type === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-blue-200 bg-blue-50 text-blue-900"}>
            <AlertDescription className="font-medium">{feedback.message}</AlertDescription>
          </Alert>
        )}

        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Konfigurasi Tidak Ditemukan</AlertTitle>
          <AlertDescription>
            Jika tombol di atas gagal, jalankan migration <span className="font-semibold">202606240007_phase_7_system_settings.sql</span>
            dan pastikan akun yang digunakan memiliki peran <span className="font-semibold">super_admin</span>.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-primary">Konfigurasi Sistem</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Pengaturan Global</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Kelola identitas lembaga, teks antarmuka, aset visual, dan tema seluruh portal LMS.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${
            hasUnsavedChanges
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}>
            {hasUnsavedChanges ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {hasUnsavedChanges ? "Perubahan belum disimpan" : "Konfigurasi tersimpan"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadSettings()}
            disabled={isLoading || isSubmitting || hasUnsavedChanges}
            className="h-9 w-9 p-0"
            aria-label="Muat ulang konfigurasi"
            title={hasUnsavedChanges ? "Simpan atau batalkan perubahan sebelum memuat ulang" : "Muat ulang konfigurasi"}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </section>

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
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          <AlertDescription className="font-medium">{feedback.message}</AlertDescription>
        </Alert>
      )}

      <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Bagian pengaturan global">
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeTab(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/60"
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${
                isActive ? "bg-white/15" : "bg-primary/10 text-primary"
              }`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{tab.label}</span>
                <span className={`mt-0.5 block truncate text-xs ${isActive ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                  {tab.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            {completionPercent === 100 ? <CheckCircle2 className="h-5 w-5" /> : <Info className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Kelengkapan konfigurasi {completionPercent}%</p>
            <p className="truncate text-xs text-muted-foreground">
              {completionCount} dari {completionItems.length} komponen utama telah diisi.
            </p>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted sm:w-56" aria-label={`Kelengkapan ${completionPercent}%`}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionPercent}%` }} />
        </div>
      </section>

      <form onSubmit={handleSave} className="min-w-0 space-y-6">
          {activeTab === "overview" && (
            <div className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4 text-primary" />
                      Identitas
                    </CardTitle>
                    <CardDescription>Nama, profil, dan kontak.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{completionPercent}%</p>
                    <p className="text-xs text-muted-foreground">kelengkapan data global</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      Branding
                    </CardTitle>
                    <CardDescription>Logo utama, login, favicon.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{[formData.logo_url, formData.login_logo_url, formData.favicon_url].filter(Boolean).length}/3</p>
                    <p className="text-xs text-muted-foreground">aset visual tersambung</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Palette className="h-4 w-4 text-primary" />
                      Tema
                    </CardTitle>
                    <CardDescription>Warna untuk tiap portal.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">4</p>
                    <p className="text-xs text-muted-foreground">portal memakai tema terpisah</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    Preview Identitas Portal
                  </CardTitle>
                  <CardDescription>Tampilan ringkas yang akan terlihat di area publik dan login.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-background p-2">
                          {formData.logo_url ? (
                            <img src={formData.logo_url} alt="Logo lembaga" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Building2 className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h2 className="break-words text-lg font-bold text-foreground">{formData.institution_name || emptySettings.institution_name}</h2>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {formData.institution_profile || "Profil singkat lembaga belum diisi."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          { label: "Email", value: formData.contact_email || "Belum diisi", icon: Mail },
                          { label: "Telepon / WhatsApp", value: formData.contact_phone || "Belum diisi", icon: Phone },
                          { label: "Alamat", value: formData.address || "Belum diisi", icon: MapPin },
                        ].map((contact) => {
                          const ContactIcon = contact.icon;
                          return (
                            <div key={contact.label} className="flex min-w-0 items-start gap-2 rounded-md border border-border/70 bg-background px-3 py-2.5">
                              <ContactIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <span className="min-w-0">
                                <span className="block text-[10px] font-bold uppercase text-muted-foreground">{contact.label}</span>
                                <span className="mt-0.5 block break-words text-xs leading-relaxed text-foreground">{contact.value}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-background p-3">
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Palette className="h-4 w-4 text-primary" />
                        Tema Aktif
                      </p>
                      <div className="space-y-2">
                        {(Object.keys(portalLabels) as Array<keyof PortalThemeConfig>).map((portal) => {
                          const theme = THEME_OPTIONS.find((option) => option.id === mergedThemes[portal]);
                          return (
                            <div key={portal} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-muted/45 px-2.5 py-2 text-xs">
                              <span className="truncate text-muted-foreground">{portalLabels[portal].label}</span>
                              <span className="flex items-center gap-2 font-semibold text-foreground">
                                <span className={`h-3 w-3 shrink-0 rounded-sm ${theme?.color ?? "bg-primary"}`} />
                                <span className="max-w-24 truncate">{getThemeName(mergedThemes[portal])}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "identity" && (
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Teks Tampilan Aplikasi</CardTitle>
                  <CardDescription>
                    Atur teks yang tampil di sidebar dan header system. Gunakan teks pendek agar layout tetap rapi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Judul Sidebar</label>
                      <Input
                        value={formData.app_sidebar_title || ""}
                        onChange={(event) => setFormData((prev) => ({ ...prev, app_sidebar_title: event.target.value }))}
                        placeholder="Contoh: YPIA"
                      />
                      <p className="text-xs text-muted-foreground">Disarankan 1-3 kata.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Subjudul Sidebar</label>
                      <Input
                        value={formData.app_sidebar_subtitle || ""}
                        onChange={(event) => setFormData((prev) => ({ ...prev, app_sidebar_subtitle: event.target.value }))}
                        placeholder="Contoh: Portal Pembelajaran"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Judul Header System</label>
                      <Input
                        value={formData.system_header_title || ""}
                        onChange={(event) => setFormData((prev) => ({ ...prev, system_header_title: event.target.value }))}
                        placeholder="Contoh: Pusat Kendali Sistem"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Subjudul Header System</label>
                      <Input
                        value={formData.system_header_subtitle || ""}
                        onChange={(event) => setFormData((prev) => ({ ...prev, system_header_subtitle: event.target.value }))}
                        placeholder="Contoh: Tata Kelola & Pemantauan LMS"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[240px_minmax(0,1fr)]">
                    <div className="rounded-lg border bg-primary p-4 text-primary-foreground">
                      <p className="text-lg font-bold">{formData.app_sidebar_title || emptySettings.app_sidebar_title}</p>
                      <p className="mt-1 text-sm text-primary-foreground/80">
                        {formData.app_sidebar_subtitle || emptySettings.app_sidebar_subtitle}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-lg font-bold text-foreground">
                        {formData.system_header_title || emptySettings.system_header_title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formData.system_header_subtitle || emptySettings.system_header_subtitle}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Informasi Dasar Lembaga</CardTitle>
                  <CardDescription>Nama dan profil dipakai di dashboard, portal publik, login, dan dokumen.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">
                      Nama Lembaga <span className="text-red-500">*</span>
                    </label>
                    <Input
                      required
                      value={formData.institution_name || ""}
                      onChange={(event) => setFormData((prev) => ({ ...prev, institution_name: event.target.value }))}
                      placeholder="Contoh: YPIA Academy"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Profil / Deskripsi Singkat</label>
                    <textarea
                      className="field-control min-h-[120px]"
                      value={formData.institution_profile || ""}
                      onChange={(event) => setFormData((prev) => ({ ...prev, institution_profile: event.target.value }))}
                      placeholder="Tuliskan deskripsi singkat lembaga untuk halaman publik dan login."
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Kontak Bantuan</CardTitle>
                  <CardDescription>Pastikan kontak mudah dikenali calon peserta, peserta aktif, dan pengajar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <Mail className="h-4 w-4 text-primary" />
                        Email Kontak
                      </label>
                      <Input
                        type="email"
                        value={formData.contact_email || ""}
                        onChange={(event) => setFormData((prev) => ({ ...prev, contact_email: event.target.value }))}
                        placeholder="info@lembaga.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <Phone className="h-4 w-4 text-primary" />
                        Nomor Telepon / WhatsApp
                      </label>
                      <Input
                        value={formData.contact_phone || ""}
                        onChange={(event) => setFormData((prev) => ({ ...prev, contact_phone: event.target.value }))}
                        placeholder="+62 812..."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <MapPin className="h-4 w-4 text-primary" />
                      Alamat Lengkap
                    </label>
                    <textarea
                      className="field-control min-h-[90px]"
                      value={formData.address || ""}
                      onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
                      placeholder="Alamat kantor atau pusat kegiatan."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "branding" && (
            <div className="grid gap-6">
              <Alert className="border-blue-200 bg-blue-50 text-blue-900">
                <Info className="h-4 w-4" />
                <AlertTitle>Standar Aset Visual</AlertTitle>
                <AlertDescription>
                  Gunakan gambar yang jelas, maksimal 2 MB. Logo transparan disarankan agar tampil rapi di sidebar,
                  login, dan halaman publik.
                </AlertDescription>
              </Alert>

              {renderAssetCard({
                field: "logo_url",
                title: "Logo Utama Aplikasi",
                description: "Ditampilkan pada sidebar, header dashboard, dan beberapa dokumen internal.",
                helper: "PNG/JPG/SVG, transparan lebih baik.",
                inputRef: fileInputLogoRef,
                previewClassName: "max-h-24 max-w-full object-contain",
              })}

              {renderAssetCard({
                field: "login_logo_url",
                title: "Logo Halaman Login",
                description: "Versi yang lebih besar untuk halaman login portal pengguna.",
                helper: "Gunakan rasio horizontal atau square.",
                inputRef: fileInputLoginLogoRef,
                previewClassName: "max-h-32 max-w-full object-contain",
              })}

              {renderAssetCard({
                field: "favicon_url",
                title: "Favicon Browser",
                description: "Ikon kecil pada tab browser. Ukuran 32x32 atau 64x64 disarankan.",
                helper: "PNG, SVG, JPG, atau ICO.",
                inputRef: fileInputFaviconRef,
                previewClassName: "h-12 w-12 object-contain",
              })}
            </div>
          )}

          {activeTab === "themes" && (
            <div className="grid gap-6">
              <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                <Globe2 className="h-4 w-4" />
                <AlertTitle>Tema Warna Terpisah</AlertTitle>
                <AlertDescription>
                  Warna per portal membantu pengguna mengenali konteks kerja: admin, peserta, pengajar, dan publik.
                </AlertDescription>
              </Alert>

              {(Object.keys(portalLabels) as Array<keyof PortalThemeConfig>).map((portal) => {
                const currentTheme = mergedThemes[portal];
                return (
                  <Card key={portal}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{portalLabels[portal].label}</CardTitle>
                      <CardDescription>{portalLabels[portal].description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        {THEME_OPTIONS.map((theme) => {
                          const isSelected = currentTheme === theme.id;
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() => handleThemeChange(portal, theme.id)}
                              className={`rounded-xl border-2 p-3 text-left transition ${
                                isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                              }`}
                            >
                              <span className={`mb-2 flex h-12 w-full items-center justify-center rounded-md ${theme.color}`}>
                                {isSelected && <CheckCircle2 className="h-5 w-5 text-white" />}
                              </span>
                              <span className="block text-center text-xs font-medium">{theme.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="sticky bottom-3 z-40 flex flex-col gap-3 rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {hasUnsavedChanges ? (
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {hasUnsavedChanges ? "Perubahan belum disimpan" : "Konfigurasi sudah tersimpan"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {hasUnsavedChanges ? "Simpan agar perubahan diterapkan ke seluruh portal." : "Ubah salah satu nilai untuk mengaktifkan tombol simpan."}
                </span>
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              {hasUnsavedChanges ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetDraft}
                  disabled={isSubmitting}
                  className="!text-foreground"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Batalkan
                </Button>
              ) : null}
              <Button
                disabled={isSubmitting || !hasUnsavedChanges}
                type="submit"
                className={hasUnsavedChanges
                  ? "bg-primary !text-primary-foreground hover:bg-primary/90 disabled:!text-primary-foreground"
                  : "border border-emerald-200 bg-emerald-50 !text-emerald-700 disabled:cursor-default disabled:opacity-100"
                }
              >
                {hasUnsavedChanges ? <Save className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Menyimpan..." : hasUnsavedChanges ? "Simpan Perubahan" : "Sudah Tersimpan"}
              </Button>
            </div>
          </div>
        </form>
    </div>
  );
}
