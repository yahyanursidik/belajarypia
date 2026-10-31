import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  ListChecks,
  RotateCcw,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Program } from "../../lib/organization";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Dialog } from "../../components/ui/dialog";
import { supabase } from "../../lib/supabase";

type ProgramSyllabusSectionProps = {
  program: Program;
  onProgramUpdated: (program: Program) => void;
};

const syllabusTemplate = `RINGKASAN PROGRAM
Jelaskan gambaran umum, sasaran peserta, dan manfaat program.

TUJUAN PEMBELAJARAN
1. Peserta mampu ...
2. Peserta memahami ...
3. Peserta dapat menerapkan ...

CAPAIAN PEMBELAJARAN
- Pengetahuan: ...
- Keterampilan: ...
- Sikap: ...

STRUKTUR MATERI
1. Tahap / modul pertama
2. Tahap / modul kedua
3. Tahap / modul ketiga

METODE PEMBELAJARAN
Jelaskan metode tatap muka, pembelajaran mandiri, diskusi, praktik, atau pendampingan.

EVALUASI DAN KELULUSAN
Jelaskan bentuk evaluasi, bobot penilaian, dan kriteria kelulusan.

TATA TERTIB
1. ...
2. ...

REFERENSI
- ...`;

const quickSections = [
  { label: "Tujuan", icon: Target, content: "TUJUAN PEMBELAJARAN\n1. Peserta mampu ...\n2. Peserta memahami ..." },
  { label: "Capaian", icon: ListChecks, content: "CAPAIAN PEMBELAJARAN\n- Pengetahuan: ...\n- Keterampilan: ...\n- Sikap: ..." },
  { label: "Materi", icon: BookOpen, content: "STRUKTUR MATERI\n1. Modul pertama\n2. Modul kedua\n3. Modul ketiga" },
  { label: "Evaluasi", icon: ClipboardList, content: "EVALUASI DAN KELULUSAN\nJelaskan bentuk evaluasi, bobot nilai, dan syarat kelulusan." },
];

export function ProgramSyllabusSection({ program, onProgramUpdated }: ProgramSyllabusSectionProps) {
  const {user}=useAuthSession();
  const draftKey=`ypia:syllabus:${user?.id??'unknown'}:${program.id}`;
  const [draft,setDraft]=useState(()=>{try{return sessionStorage.getItem(draftKey)??program.syllabus??'';}catch{return program.syllabus??'';}});
  const savedRef=useRef(program.syllabus??'');
  const [confirmTemplate,setConfirmTemplate]=useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"editor" | "preview">("editor");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if(savedRef.current!==(program.syllabus??'')){savedRef.current=program.syllabus??'';setDraft(program.syllabus??'');}
  }, [program.syllabus]);
  useEffect(()=>{try{if(draft===(program.syllabus??''))sessionStorage.removeItem(draftKey);else sessionStorage.setItem(draftKey,draft);}catch{/* Editing still works when browser storage is unavailable. */}},[draft,draftKey,program.syllabus]);

  const savedValue = program.syllabus ?? "";
  const hasChanges = draft !== savedValue;
  const words = useMemo(() => draft.trim() ? draft.trim().split(/\s+/).length : 0, [draft]);

  useEffect(() => {
    if (!hasChanges) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasChanges]);

  const insertSection = (content: string) => {
    setDraft((current) => `${current.trim()}${current.trim() ? "\n\n" : ""}${content}`);
    setViewMode("editor");
    setFeedback(null);
  };

  const saveSyllabus = async () => {
    if (!draft.trim()) {
      setFeedback({ type: "error", message: "Isi silabus sebelum menyimpan." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    const normalized = draft.trim();
    const { data, error } = await supabase.from("programs").update({ syllabus: normalized }).eq("id", program.id).select("*").single();
    if (error || !data) {
      setFeedback({ type: "error", message: `Silabus gagal disimpan: ${error?.message ?? "data tidak ditemukan"}` });
    } else {
      onProgramUpdated(data as Program);
      setDraft(normalized);
      setFeedback({ type: "success", message: "Silabus berhasil disimpan dan siap ditampilkan pada katalog program." });
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {feedback ? (
        <Alert className={feedback.type === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}>
          {feedback.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      {confirmTemplate&&<Dialog title="Ganti isi dengan template?" onClose={()=>setConfirmTemplate(false)}><p className="text-sm text-muted-foreground">Isi editor akan diganti. Salin bagian yang masih diperlukan sebelum melanjutkan.</p><div className="wizard-footer"><Button variant="outline" onClick={()=>setConfirmTemplate(false)}>Batal</Button><Button onClick={()=>{setDraft(syllabusTemplate);setConfirmTemplate(false);}}>Ganti isi</Button></div></Dialog>}
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Dokumen Silabus
              </CardTitle>
              <CardDescription className="mt-1">Susun informasi akademik yang dibaca calon peserta dan peserta aktif.</CardDescription>
            </div>
            <div className="flex rounded-md border bg-muted/40 p-1">
              <Button type="button" size="sm" variant={viewMode === "editor" ? "default" : "ghost"} onClick={() => setViewMode("editor")}>
                <FileText className="mr-2 h-4 w-4" />
                Editor
              </Button>
              <Button type="button" size="sm" variant={viewMode === "preview" ? "default" : "ghost"} onClick={() => setViewMode("preview")}>
                <Eye className="mr-2 h-4 w-4" />
                Pratinjau
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-muted-foreground">Tambahkan bagian:</span>
            {quickSections.map((section) => {
              const Icon = section.icon;
              return (
                <Button key={section.label} type="button" variant="outline" size="sm" onClick={() => insertSection(section.content)}>
                  <Icon className="mr-2 h-3.5 w-3.5" />
                  {section.label}
                </Button>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => draft.trim()?setConfirmTemplate(true):setDraft(syllabusTemplate)}>
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Gunakan Template Lengkap
            </Button>
          </div>

          {viewMode === "editor" ? (
            <div>
              <textarea
                aria-label="Isi silabus" className="field-control min-h-[360px] resize-y text-sm leading-6"
                placeholder="Tuliskan silabus atau gunakan template lengkap..."
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setFeedback(null);
                }}
              />
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>Gunakan judul dengan huruf kapital agar struktur mudah dipindai.</span>
                <span>{draft.length.toLocaleString("id-ID")} karakter</span>
              </div>
            </div>
          ) : (
            <article className="min-h-[360px] whitespace-pre-wrap rounded-lg border bg-muted/15 p-6 text-sm leading-7 text-foreground">
              {draft.trim() || <span className="text-muted-foreground">Silabus belum memiliki isi.</span>}
            </article>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-30 flex flex-col gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          {hasChanges ? <AlertCircle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          <span>
            <span className="block font-semibold">{hasChanges ? "Perubahan belum disimpan" : "Silabus tersimpan"}</span>
            <span className="block text-xs text-muted-foreground">{`${words} kata`}</span>
          </span>
        </div>
        <div className="flex gap-2">
          {hasChanges ? (
            <Button type="button" variant="outline" onClick={() => setDraft(savedValue)} disabled={isSaving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Batalkan
            </Button>
          ) : null}
          <Button type="button" onClick={() => void saveSyllabus()} disabled={isSaving || !hasChanges}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Menyimpan..." : "Simpan Silabus"}
          </Button>
        </div>
      </div>
    </div>
  );
}
