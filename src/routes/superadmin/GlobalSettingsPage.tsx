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
  Settings,
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

const DEFAULT_THEMES: PortalThemeConfig = { admin: "indigo", learner: "emerald", teacher: "rose", public: "amber" };
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
  teacher: { label: "Portal Pengajar", description: "Guru, mentor, dan penguji" },
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
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [formData, setFormData] = useState<Partial<SystemSettings>>(emptySettings);
  const [activeTab, setActiveTab] = useState<SettingsTab>("overview");
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

  const completionItems = [
    { label: "Nama lembaga", completed: Boolean(formData.institution_name?.trim()), icon: Building2 },
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
      setActiveTab("identity");
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
      if (isSettingsColumnError(error, ["portal_themes", "login_logo_url", "favicon_url"])) {
        showFeedback({
          type: "error",
          message:
            "Struktur tabel system_settings belum lengkap. Jalankan migration branding/portal theme terbaru, terutama 20260626144957_phase_18_portal_themes.sql.",
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
    <div className="page-stack max-w-6xl">
      <div className="page-hero">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">System Settings</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
            <Settings className="h-8 w-8 text-primary" />
            Pengaturan Global
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Kelola identitas lembaga, aset visual, tema portal, dan konsistensi pengalaman pengguna dari satu pusat
            konfigurasi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadSettings()}
            disabled={isLoading || isSubmitting}
            className="border-white/35 bg-white/15 !text-white hover:bg-white/25 hover:!text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Muat Ulang
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleResetDraft}
            disabled={!hasUnsavedChanges || isSubmitting}
            className="border-white/35 bg-white/15 !text-white hover:bg-white/25 hover:!text-white disabled:!text-white"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Draft
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
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          <AlertDescription className="font-medium">{feedback.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Menu Pengaturan</CardTitle>
              <CardDescription>Pilih area konfigurasi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isActive ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </span>
                    <span className={`mt-1 block text-xs ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {tab.description}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Kelengkapan</CardTitle>
              <CardDescription>{completionCount} dari {completionItems.length} item terisi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${completionPercent}%` }} />
              </div>
              <div className="space-y-2">
                {completionItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </span>
                      {item.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </aside>

        <form onSubmit={handleSave} className="min-w-0 space-y-6">
          {activeTab === "overview" && (
            <div className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Identitas</CardTitle>
                    <CardDescription>Nama, profil, dan kontak.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{completionPercent}%</p>
                    <p className="text-xs text-muted-foreground">kelengkapan data global</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Branding</CardTitle>
                    <CardDescription>Logo utama, login, favicon.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{[formData.logo_url, formData.login_logo_url, formData.favicon_url].filter(Boolean).length}/3</p>
                    <p className="text-xs text-muted-foreground">aset visual tersambung</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Tema</CardTitle>
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
                  <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                    <div className="rounded-xl border bg-muted/20 p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-background p-2">
                          {formData.logo_url ? (
                            <img src={formData.logo_url} alt="Logo lembaga" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Building2 className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-xl font-bold">{formData.institution_name || emptySettings.institution_name}</h2>
                          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                            {formData.institution_profile || "Profil singkat lembaga belum diisi."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {formData.contact_email || "Email belum diisi"}
                        </span>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {formData.contact_phone || "Nomor belum diisi"}
                        </span>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {formData.address || "Alamat belum diisi"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-background p-4">
                      <p className="mb-3 text-sm font-semibold">Tema Aktif</p>
                      <div className="space-y-2">
                        {(Object.keys(portalLabels) as Array<keyof PortalThemeConfig>).map((portal) => (
                          <div key={portal} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                            <span>{portalLabels[portal].label}</span>
                            <span className="font-medium">{getThemeName(mergedThemes[portal])}</span>
                          </div>
                        ))}
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
                      <label className="text-sm font-semibold">Email Kontak</label>
                      <Input
                        type="email"
                        value={formData.contact_email || ""}
                        onChange={(event) => setFormData((prev) => ({ ...prev, contact_email: event.target.value }))}
                        placeholder="info@lembaga.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Nomor Telepon / WhatsApp</label>
                      <Input
                        value={formData.contact_phone || ""}
                        onChange={(event) => setFormData((prev) => ({ ...prev, contact_phone: event.target.value }))}
                        placeholder="+62 812..."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Alamat Lengkap</label>
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

          <div className="sticky bottom-6 z-40 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur">
            <p className="text-sm text-muted-foreground">
              {hasUnsavedChanges ? "Ada perubahan yang belum disimpan." : "Semua perubahan sudah tersimpan."}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetDraft}
                disabled={!hasUnsavedChanges || isSubmitting}
                className="!text-foreground"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                disabled={isSubmitting || !hasUnsavedChanges}
                type="submit"
                size="lg"
                className="bg-primary !text-white shadow-lg hover:bg-primary/90 disabled:!text-white"
              >
                <Save className="mr-2 h-5 w-5" />
                {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
