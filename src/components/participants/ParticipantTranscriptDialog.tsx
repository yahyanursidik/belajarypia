import { useEffect, useState, type ComponentType } from "react";
import { SectionNav } from "../admin/SectionNav";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { AlertCircle, Building2, CheckCircle2, Eye, ImageIcon, Loader2, PenLine, RotateCcw, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { fetchSystemSettings, updateSystemSettings, emptySettings, type SystemSettings } from "../../lib/settings";
type TranscriptConfigTab = "identity" | "signature" | "preview";

const transcriptConfigTabs: Array<{
  key: TranscriptConfigTab;
  label: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "identity", label: "Identitas Dokumen", desc: "Kop dan tempat tanggal", icon: Building2 },
  { key: "signature", label: "Penandatangan", desc: "Nama, jabatan, tanda tangan", icon: PenLine },
  { key: "preview", label: "Pratinjau", desc: "Simulasi tampilan transkrip", icon: Eye },
];

function isTranscriptColumnError(message: string | null | undefined) {
  return Boolean(
    message?.includes("transcript_header_text") ||
      message?.includes("transcript_place_date_text") ||
      message?.includes("transcript_official_name") ||
      message?.includes("transcript_official_title") ||
      message?.includes("transcript_signature_url"),
  );
}


export function ParticipantTranscriptDialog({ onClose }: { onClose: () => void }) {
  const setIsTranscriptConfigOpen = (open: boolean) => { if (!open) onClose(); };
  const [transcriptConfigTab, setTranscriptConfigTab] = useState<TranscriptConfigTab>("identity");
  const [transcriptSettings, setTranscriptSettings] = useState<SystemSettings>(emptySettings);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [transcriptErrorMsg, setTranscriptErrorMsg] = useState("");
  const [isSuccessState, setIsSuccessState] = useState(false);
  useEffect(() => {
    const controller = { active: true };
    void fetchSystemSettings().then((data) => {
      if (!controller.active) return;
      if (data) setTranscriptSettings(data); else setTranscriptErrorMsg("Template belum tersedia. Lengkapi pengaturan global terlebih dahulu.");
    }).catch(() => { if (controller.active) setTranscriptErrorMsg("Template belum dapat dimuat."); });
    return () => { controller.active = false; };
  }, []);
  useEffect(() => {
    if (!signatureFile) { setSignaturePreviewUrl(null); return; }
    const url = URL.createObjectURL(signatureFile); setSignaturePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [signatureFile]);
  const resetTranscriptDraft = () => {
    setSignatureFile(null);
    setTranscriptSettings((current) => ({
      ...current,
      transcript_header_text: "",
      transcript_place_date_text: "Jakarta, ",
      transcript_official_name: "",
      transcript_official_title: "",
      transcript_signature_url: null,
    }));
  };

  const handleSaveTranscriptSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTranscript(true);
    setTranscriptErrorMsg("");

    try {
      if (!transcriptSettings.id) {
        throw new Error("Pengaturan institusi belum tersedia. Lengkapi Pengaturan Global terlebih dahulu.");
      }

      if (signatureFile) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(signatureFile.type)) {
          throw new Error("Gunakan PNG, JPG, atau WebP untuk tanda tangan.");
        }

        if (signatureFile.size > 1_500_000) {
          throw new Error("Ukuran tanda tangan maksimal 1.5 MB.");
        }
      }

      let signatureUrl = transcriptSettings.transcript_signature_url;

      if (signatureFile) {
        const fileExt = signatureFile.name.split('.').pop();
        const fileName = `transcript_signature_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("system_assets")
          .upload(fileName, signatureFile, { upsert: true });

        if (uploadError) {
          throw new Error("Gagal mengunggah tanda tangan: " + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("system_assets")
          .getPublicUrl(fileName);

        signatureUrl = publicUrlData.publicUrl;
      }

      const { error } = await updateSystemSettings(transcriptSettings.id, {
        transcript_header_text: transcriptSettings.transcript_header_text,
        transcript_place_date_text: transcriptSettings.transcript_place_date_text,
        transcript_official_name: transcriptSettings.transcript_official_name,
        transcript_official_title: transcriptSettings.transcript_official_title,
        transcript_signature_url: signatureUrl,
      },transcriptSettings.updated_at);

      if (error) {
        setTranscriptErrorMsg(
          isTranscriptColumnError(error.message)
            ? "Template belum dapat disimpan. Hubungi pengelola untuk memperbarui sistem."
            : "Gagal menyimpan ke database: " + error.message,
        );
      } else {
        setIsSuccessState(true);

      }
    } catch (err: any) {
      setTranscriptErrorMsg(err.message || "Terjadi kesalahan saat menyimpan");
    } finally {
      setIsSavingTranscript(false);
    }
  };


  return <Dialog title="Template transkrip" busy={isSavingTranscript} onClose={onClose}>

            {isSuccessState ? (
              <div className="flex h-[400px] flex-col items-center justify-center bg-white p-16 animate-in zoom-in-50 duration-300">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Berhasil!</h3>
                <p className="mt-2 text-center text-slate-500">Template transkrip tersimpan.</p><Button className="mt-5" onClick={onClose}>Selesai</Button>
              </div>
            ) : (
              <form onSubmit={handleSaveTranscriptSettings} className="space-y-5">
                <div className="space-y-4">
                  <SectionNav items={transcriptConfigTabs} value={transcriptConfigTab} onChange={setTranscriptConfigTab} label="Bagian template transkrip" />


                  <CardContent className="p-0">
                    {transcriptErrorMsg && (
                      <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                        <p className="text-sm">{transcriptErrorMsg}</p>
                      </div>
                    )}

                    {transcriptConfigTab === "identity" && (
                      <div className="space-y-5">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Identitas Dokumen</h3>
                          <p className="mt-1 text-sm text-slate-500">Atur teks kop dan format tempat tanggal yang muncul di seluruh transkrip.</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start gap-3">
                            <Building2 className="mt-0.5 h-5 w-5 text-primary" />
                            <div>
                              <p className="text-sm font-semibold text-slate-800">Logo mengikuti pengaturan global</p>
                              <p className="mt-1 text-sm text-slate-500">
                                Ubah logo melalui Pengaturan Global.
                              </p>
                            </div>
                          </div>
                        </div>

                        <label className="grid gap-2 text-sm font-semibold text-slate-700">
                          Teks Header Kop Surat
                          <textarea
                            className="min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onChange={e => setTranscriptSettings({ ...transcriptSettings, transcript_header_text: e.target.value })}
                            placeholder="Contoh: YAYASAN PENDIDIKAN IHSANUL ADAB (YPIA)"
                            value={transcriptSettings.transcript_header_text || ""}
                          />
                          <span className="text-xs font-normal text-muted-foreground">Bisa diisi beberapa baris. Jika kosong, nama institusi akan dipakai.</span>
                        </label>

                        <label className="grid gap-2 text-sm font-semibold text-slate-700">
                          Awalan Tempat & Tanggal
                          <Input
                            className="h-10"
                            onChange={e => setTranscriptSettings({ ...transcriptSettings, transcript_place_date_text: e.target.value })}
                            placeholder="Contoh: Yogyakarta, "
                            value={transcriptSettings.transcript_place_date_text || ""}
                          />
                          <span className="text-xs font-normal text-muted-foreground">Tanggal cetak akan ditambahkan otomatis di belakangnya.</span>
                        </label>
                      </div>
                    )}

                    {transcriptConfigTab === "signature" && (
                      <div className="space-y-5">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Pejabat Penandatangan</h3>
                          <p className="mt-1 text-sm text-slate-500">Atur nama, jabatan, dan gambar tanda tangan yang tampil di bagian akhir transkrip.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <label className="grid gap-2 text-sm font-semibold text-slate-700">
                            Nama Pejabat Penandatangan
                            <Input
                              className="h-10"
                              onChange={e => setTranscriptSettings({ ...transcriptSettings, transcript_official_name: e.target.value })}
                              placeholder="Contoh: Ustadz Fulan, Lc., M.A."
                              value={transcriptSettings.transcript_official_name || ""}
                            />
                          </label>
                          <label className="grid gap-2 text-sm font-semibold text-slate-700">
                            Jabatan Penandatangan
                            <Input
                              className="h-10"
                              onChange={e => setTranscriptSettings({ ...transcriptSettings, transcript_official_title: e.target.value })}
                              placeholder="Contoh: Direktur Pendidikan"
                              value={transcriptSettings.transcript_official_title || ""}
                            />
                          </label>
                        </div>

                        <div className="grid gap-5 md:grid-cols-[1fr_260px]">
                          <label className="grid gap-2 text-sm font-semibold text-slate-700">
                            Upload Tanda Tangan
                            <Input
                              accept="image/png,image/jpeg,image/webp"
                              className="h-10 cursor-pointer"
                              onChange={e => setSignatureFile(e.target.files?.[0] || null)}
                              type="file"
                            />
                            <span className="text-xs font-normal text-muted-foreground">Gunakan PNG transparan bila memungkinkan. Maksimal 1.5 MB.</span>
                            {transcriptSettings.transcript_signature_url && !signatureFile && (
                              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Tanda tangan sudah diunggah sebelumnya
                              </span>
                            )}
                          </label>

                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                              <ImageIcon className="h-4 w-4 text-primary" />
                              Preview Tanda Tangan
                            </p>
                            {signaturePreviewUrl || transcriptSettings.transcript_signature_url ? (
                              <div className="grid h-32 place-items-center rounded-lg border bg-white p-3">
                                <img
                                  alt="Preview tanda tangan"
                                  className="max-h-full max-w-full object-contain"
                                  src={signaturePreviewUrl || transcriptSettings.transcript_signature_url || ""}
                                />
                              </div>
                            ) : (
                              <div className="grid h-32 place-items-center rounded-lg border border-dashed bg-white text-center text-xs text-slate-400">
                                Belum ada tanda tangan
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {transcriptConfigTab === "preview" && (
                      <div className="space-y-5">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Pratinjau transkrip</h3>
                          <p className="mt-1 text-sm text-slate-500">Simulasi tampilan kop dan tanda tangan. Nilai asli tetap mengikuti data akademik peserta.</p>
                        </div>

                        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                          <div className="border-b-2 border-slate-800 pb-6 text-center">
                            {transcriptSettings.logo_url && (
                              <img alt="Logo" className="mx-auto mb-4 h-16 w-auto object-contain" src={transcriptSettings.logo_url} />
                            )}
                            <h3 className="font-serif text-2xl font-bold uppercase tracking-widest text-slate-900">Transkrip Akademik</h3>
                            <p className="mt-3 whitespace-pre-line text-sm font-medium text-slate-700">
                              {transcriptSettings.transcript_header_text || transcriptSettings.institution_name || "YPIA"}
                            </p>
                          </div>

                          <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
                            <div className="space-y-2">
                              <p><span className="font-semibold">Nama Peserta</span>: Contoh Peserta</p>
                              <p><span className="font-semibold">Nomor Induk</span>: NIS-2026-001</p>
                            </div>
                            <div className="space-y-2">
                              <p><span className="font-semibold">Program</span>: Tahsin Dasar</p>
                              <p><span className="font-semibold">Kelas</span>: Kelas A</p>
                            </div>
                          </div>

                          <div className="mt-8 flex justify-end">
                            <div className="w-64 text-center text-sm">
                              <p className="text-slate-600">
                                {transcriptSettings.transcript_place_date_text || "Yogyakarta, "}
                                {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                              </p>
                              <div className="my-3 grid h-24 place-items-center">
                                {signaturePreviewUrl || transcriptSettings.transcript_signature_url ? (
                                  <img
                                    alt="Preview tanda tangan"
                                    className="max-h-full max-w-[180px] object-contain"
                                    src={signaturePreviewUrl || transcriptSettings.transcript_signature_url || ""}
                                  />
                                ) : null}
                              </div>
                              <p className="font-bold text-slate-900 underline underline-offset-4">
                                {transcriptSettings.transcript_official_name || "Kepala Bagian Akademik"}
                              </p>
                              <p className="mt-1 text-slate-700">{transcriptSettings.transcript_official_title || "LMS YPIA"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </div>

                <div className="flex flex-col gap-3 border-t bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="outline" className="bg-white !text-slate-700" onClick={resetTranscriptDraft}>
                    <RotateCcw className="h-4 w-4" />
                    Kosongkan draf
                  </Button>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" className="bg-white !text-slate-700" onClick={() => setIsTranscriptConfigOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={isSavingTranscript || !transcriptSettings.id} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6">
                      {isSavingTranscript ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Simpan Konfigurasi
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            )}

  </Dialog>;
}
