import { useEffect, useState } from "react";
import { Save, Building2, ImageIcon, Settings, Info, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fetchSystemSettings, updateSystemSettings, type SystemSettings } from "../../lib/settings";
import { requestSystemSignedUploadUrl } from "../../lib/documents";
import { useRef } from "react";

export function GlobalSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [formData, setFormData] = useState<Partial<SystemSettings>>({});
  const [activeTab, setActiveTab] = useState<"identitas" | "branding">("identitas");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputLogoRef = useRef<HTMLInputElement>(null);
  const fileInputLoginLogoRef = useRef<HTMLInputElement>(null);
  const fileInputFaviconRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof SystemSettings) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(field);
    setErrorMessage(null);

    try {
      const { signedUrl, publicUrl } = await requestSystemSignedUploadUrl({ file });
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" }
      });

      if (!uploadRes.ok) {
        throw new Error("Gagal mengunggah file ke server.");
      }

      setFormData(prev => ({ ...prev, [field]: publicUrl }));
      setMessage(`Berhasil mengunggah ${file.name}`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat mengunggah file.");
    } finally {
      setUploadingField(null);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    const data = await fetchSystemSettings();
    if (data) {
      setSettings(data);
      setFormData(data);
    }
    setIsLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings?.id) return;

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    const { error, data } = await updateSystemSettings(settings.id, formData);
    
    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
      setSettings(data);
      setFormData(data);
      setMessage("Pengaturan berhasil disimpan.");
      setTimeout(() => setMessage(null), 3000);
    }
    
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="page-stack flex items-center justify-center min-h-[40vh]">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent mx-auto" />
          <p className="text-muted-foreground text-sm">Memuat pengaturan sistem...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="page-stack">
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>Konfigurasi Tidak Ditemukan</AlertTitle>
          <AlertDescription>
            Tabel system_settings belum terinisialisasi di database. Pastikan migrasi database telah dijalankan.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-stack max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Pengaturan Global
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Konfigurasi identitas lembaga, tampilan aplikasi, dan preferensi sistem secara menyeluruh.
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b pb-4 mb-6 overflow-x-auto">
        <Button
          variant={activeTab === "identitas" ? "default" : "outline"}
          onClick={() => setActiveTab("identitas")}
          className="rounded-full whitespace-nowrap"
        >
          <Building2 className="w-4 h-4 mr-2" /> Identitas & Profil
        </Button>
        <Button
          variant={activeTab === "branding" ? "default" : "outline"}
          onClick={() => setActiveTab("branding")}
          className="rounded-full whitespace-nowrap"
        >
          <ImageIcon className="w-4 h-4 mr-2" /> Branding & Visual
        </Button>
      </div>

      {message && (
        <Alert className="mb-6 bg-emerald-50 text-emerald-900 border-emerald-200">
          <AlertDescription className="flex items-center gap-2 font-medium">
            ✅ {message}
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert className="mb-6 border-red-200 bg-red-50 text-red-900">
          <AlertDescription className="font-medium">
            ❌ {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {activeTab === "identitas" && (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Informasi Dasar Lembaga</CardTitle>
                <CardDescription>Nama dan profil yang akan ditampilkan di berbagai area aplikasi.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Nama Lembaga <span className="text-red-500">*</span></label>
                  <Input 
                    required
                    value={formData.institution_name || ""} 
                    onChange={e => setFormData(p => ({ ...p, institution_name: e.target.value }))}
                    placeholder="Contoh: YPIA Academy"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Profil / Deskripsi Singkat</label>
                  <textarea 
                    className="field-control min-h-[100px]"
                    value={formData.institution_profile || ""} 
                    onChange={e => setFormData(p => ({ ...p, institution_profile: e.target.value }))}
                    placeholder="Jelaskan secara singkat mengenai lembaga ini..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informasi Kontak</CardTitle>
                <CardDescription>Kontak utama yang dapat dihubungi oleh pengguna.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Email Kontak</label>
                    <Input 
                      type="email"
                      value={formData.contact_email || ""} 
                      onChange={e => setFormData(p => ({ ...p, contact_email: e.target.value }))}
                      placeholder="info@lembaga.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Nomor Telepon / WhatsApp</label>
                    <Input 
                      value={formData.contact_phone || ""} 
                      onChange={e => setFormData(p => ({ ...p, contact_phone: e.target.value }))}
                      placeholder="+62 812..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Alamat Lengkap</label>
                  <textarea 
                    className="field-control min-h-[80px]"
                    value={formData.address || ""} 
                    onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                    placeholder="Alamat kantor atau pusat kegiatan..."
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "branding" && (
          <div className="grid gap-6">
            <Alert className="bg-blue-50 text-blue-900 border-blue-200">
              <Info className="h-4 w-4" />
              <AlertTitle className="font-bold">Informasi</AlertTitle>
              <AlertDescription>
                Unggah gambar langsung dari perangkat Anda. Gambar akan otomatis tersimpan di S3 storage.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Logo Utama Aplikasi</CardTitle>
                <CardDescription>Ditampilkan pada navigasi sidebar dan dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input ref={fileInputLogoRef} type="file" className="hidden" accept="image/*" onChange={e => void handleFileUpload(e, "logo_url")} />
                {formData.logo_url ? (
                  <div className="space-y-3">
                    <div className="p-4 border rounded-lg bg-muted/30 flex justify-center items-center h-32 relative group">
                      <img src={formData.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg backdrop-blur-sm">
                        <Button type="button" variant="secondary" onClick={() => fileInputLogoRef.current?.click()} disabled={uploadingField === "logo_url"}>
                          {uploadingField === "logo_url" ? "Mengunggah..." : "Ubah Gambar"}
                        </Button>
                      </div>
                    </div>
                    <Input value={formData.logo_url || ""} onChange={e => setFormData(p => ({ ...p, logo_url: e.target.value }))} placeholder="URL akan otomatis terisi..." className="text-xs text-muted-foreground" />
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => fileInputLogoRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium">{uploadingField === "logo_url" ? "Mengunggah..." : "Klik untuk memilih gambar logo"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Format PNG/JPG/SVG transparan disarankan</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Logo Halaman Login</CardTitle>
                <CardDescription>Logo khusus yang lebih besar untuk halaman login portal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input ref={fileInputLoginLogoRef} type="file" className="hidden" accept="image/*" onChange={e => void handleFileUpload(e, "login_logo_url")} />
                {formData.login_logo_url ? (
                  <div className="space-y-3">
                    <div className="p-4 border rounded-lg bg-muted/30 flex justify-center items-center h-40 relative group">
                      <img src={formData.login_logo_url} alt="Login Logo" className="max-h-full max-w-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg backdrop-blur-sm">
                        <Button type="button" variant="secondary" onClick={() => fileInputLoginLogoRef.current?.click()} disabled={uploadingField === "login_logo_url"}>
                          {uploadingField === "login_logo_url" ? "Mengunggah..." : "Ubah Gambar"}
                        </Button>
                      </div>
                    </div>
                    <Input value={formData.login_logo_url || ""} onChange={e => setFormData(p => ({ ...p, login_logo_url: e.target.value }))} placeholder="URL otomatis..." className="text-xs text-muted-foreground" />
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => fileInputLoginLogoRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium">{uploadingField === "login_logo_url" ? "Mengunggah..." : "Klik untuk memilih logo login"}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Favicon Browser</CardTitle>
                <CardDescription>Ikon kecil yang muncul pada tab browser (32x32 atau 64x64).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input ref={fileInputFaviconRef} type="file" className="hidden" accept="image/*,.ico" onChange={e => void handleFileUpload(e, "favicon_url")} />
                {formData.favicon_url ? (
                  <div className="space-y-3">
                    <div className="p-4 border rounded-lg bg-muted/30 flex justify-center items-center h-24 relative group">
                      <img src={formData.favicon_url} alt="Favicon" className="h-10 w-10 object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg backdrop-blur-sm">
                        <Button type="button" variant="secondary" onClick={() => fileInputFaviconRef.current?.click()} disabled={uploadingField === "favicon_url"}>
                          {uploadingField === "favicon_url" ? "Mengunggah..." : "Ubah Gambar"}
                        </Button>
                      </div>
                    </div>
                    <Input value={formData.favicon_url || ""} onChange={e => setFormData(p => ({ ...p, favicon_url: e.target.value }))} placeholder="URL otomatis..." className="text-xs text-muted-foreground" />
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => fileInputFaviconRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium">{uploadingField === "favicon_url" ? "Mengunggah..." : "Klik untuk memilih favicon"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Floating Save Button */}
        <div className="sticky bottom-6 flex justify-end z-40">
          <Button 
            disabled={isSubmitting} 
            type="submit" 
            size="lg" 
            className="shadow-2xl rounded-full px-8 flex items-center gap-2 bg-primary hover:bg-primary/90 transition-all hover:scale-105"
          >
            <Save className="h-5 w-5" />
            {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
