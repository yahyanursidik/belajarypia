import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertCircle,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  ExternalLink,
  Layers3,
  Save,
  Users,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Program, ProgramStatus } from "../../lib/organization";
import { supabase } from "../../lib/supabase";

type ProgramSummary = {
  modules: number;
  lessons: number;
  classes: number;
  batches: number;
  participants?: number;
};

type ProgramDetailSectionProps = {
  program: Program;
  summary: ProgramSummary;
  onNavigate: (section: "silabus" | "kurikulum" | "angkatan" | "kelulusan") => void;
  onProgramUpdated: (program: Program) => void;
};

type ProgramDraft = {
  code: string;
  name: string;
  description: string;
  curriculum_model: string;
  delivery_mode: string;
  status: ProgramStatus;
};

const statusMeta: Record<ProgramStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-amber-200 bg-amber-50 text-amber-700" },
  active: { label: "Aktif", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  archived: { label: "Diarsipkan", className: "border-slate-200 bg-slate-100 text-slate-700" },
};

function createDraft(program: Program): ProgramDraft {
  return {
    code: program.code,
    name: program.name,
    description: program.description ?? "",
    curriculum_model: program.curriculum_model,
    delivery_mode: program.delivery_mode,
    status: program.status,
  };
}

function Metric({ icon: Icon, label, value, helper }: { icon: ComponentType<{ className?: string }>; label: string; value: number; helper: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-background p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold text-foreground">{value}</span>
        <span className="block truncate text-xs font-semibold text-foreground">{label}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{helper}</span>
      </span>
    </div>
  );
}

export function ProgramDetailSection({ program, summary, onNavigate, onProgramUpdated }: ProgramDetailSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<ProgramDraft>(() => createDraft(program));
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setDraft(createDraft(program));
  }, [program]);

  const readinessItems = useMemo(() => [
    { label: "Deskripsi program", done: Boolean(program.description?.trim()), section: "detail" as const },
    { label: "Silabus", done: Boolean(program.syllabus?.trim()), section: "silabus" as const },
    { label: "Struktur kurikulum", done: summary.modules > 0, section: "kurikulum" as const },
    { label: "Materi pembelajaran", done: summary.lessons > 0, section: "kurikulum" as const },
    ...(program.curriculum_model === "angkatan"
      ? [{ label: "Angkatan dan kelas", done: summary.classes > 0, section: "angkatan" as const }]
      : []),
    { label: "Kriteria kelulusan", done: Boolean(program.grading_rubric?.length), section: "kelulusan" as const },
  ], [program, summary]);
  const readyCount = readinessItems.filter((item) => item.done).length;
  const readinessPercent = Math.round((readyCount / readinessItems.length) * 100);
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(createDraft(program));

  const cancelEdit = () => {
    setDraft(createDraft(program));
    setFeedback(null);
    setIsEditing(false);
  };

  const saveProgram = async () => {
    if (!draft.name.trim() || !draft.code.trim()) {
      setFeedback({ type: "error", message: "Nama dan kode program wajib diisi." });
      return;
    }
    if (draft.status === "active" && readinessPercent < 100) {
      const shouldContinue = window.confirm("Program belum memenuhi seluruh checklist kesiapan. Tetap aktifkan program?");
      if (!shouldContinue) return;
    }

    setIsSaving(true);
    setFeedback(null);
    const payload = {
      name: draft.name.trim(),
      code: draft.code.trim().toUpperCase(),
      description: draft.description.trim() || null,
      curriculum_model: draft.curriculum_model,
      delivery_mode: draft.delivery_mode,
      status: draft.status,
    };
    const { data, error } = await supabase.from("programs").update(payload).eq("id", program.id).select("*").single();

    if (error || !data) {
      setFeedback({ type: "error", message: `Detail program gagal disimpan: ${error?.message ?? "data tidak ditemukan"}` });
    } else {
      onProgramUpdated(data as Program);
      setFeedback({ type: "success", message: "Detail program berhasil disimpan dan dikonfirmasi dari database." });
      setIsEditing(false);
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Layers3} label="Mata Pelajaran" value={summary.modules} helper="struktur kurikulum" />
        <Metric icon={BookOpenCheck} label="Materi" value={summary.lessons} helper="pertemuan dan evaluasi" />
        <Metric icon={CalendarDays} label="Kelas" value={summary.classes} helper={program.curriculum_model === "angkatan" ? "kelas terjadwal" : "program mandiri"} />
        <Metric icon={Users} label="Angkatan" value={summary.batches} helper="periode pembelajaran" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
            <div>
              <CardTitle className="text-lg">Profil Program</CardTitle>
              <CardDescription>Identitas dan model operasional program.</CardDescription>
            </div>
            {!isEditing ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit3 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            {isEditing ? (
              <>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Nama Program</label>
                    <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Kode</label>
                    <Input className="font-mono uppercase" value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Deskripsi Singkat</label>
                  <textarea className="field-control min-h-28" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                  <p className="text-xs text-muted-foreground">Teks ini dipakai pada katalog, daftar program, dan ringkasan portal.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Sistem Belajar</label>
                    <select className="field-control h-10" value={draft.curriculum_model} onChange={(event) => setDraft((current) => ({ ...current, curriculum_model: event.target.value }))}>
                      <option value="mandiri">Mandiri (Evergreen)</option>
                      <option value="angkatan">Terjadwal (Angkatan)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Moda</label>
                    <select className="field-control h-10" value={draft.delivery_mode} onChange={(event) => setDraft((current) => ({ ...current, delivery_mode: event.target.value }))}>
                      <option value="online">Online</option>
                      <option value="offline">Tatap Muka</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Status Publikasi</label>
                    <select className="field-control h-10" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ProgramStatus }))}>
                      <option value="draft">Draft</option>
                      <option value="active">Aktif</option>
                      <option value="archived">Diarsipkan</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button type="button" variant="outline" onClick={cancelEdit} disabled={isSaving}>
                    <X className="mr-2 h-4 w-4" />
                    Batal
                  </Button>
                  <Button type="button" onClick={() => void saveProgram()} disabled={isSaving || !hasChanges}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? "Menyimpan..." : "Simpan Detail"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-foreground">{program.name}</h3>
                    <Badge variant="outline" className={statusMeta[program.status].className}>{statusMeta[program.status].label}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{program.description || "Deskripsi program belum diisi."}</p>
                </div>
                <dl className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Kode", program.code],
                    ["Tipe", program.program_type],
                    ["Sistem", program.curriculum_model === "angkatan" ? "Terjadwal" : "Mandiri"],
                    ["Moda", program.delivery_mode],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                      <dd className="mt-1 text-sm font-medium capitalize text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Kesiapan Publikasi</CardTitle>
                <CardDescription>{readyCount} dari {readinessItems.length} komponen siap.</CardDescription>
              </div>
              <span className="text-2xl font-bold text-primary">{readinessPercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${readinessPercent}%` }} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {readinessItems.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.section === "detail"}
                onClick={() => item.section !== "detail" && onNavigate(item.section)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-muted disabled:cursor-default"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  {item.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />}
                  <span className="truncate">{item.label}</span>
                </span>
                {!item.done && item.section !== "detail" ? <span className="text-xs font-semibold text-primary">Lengkapi</span> : null}
              </button>
            ))}
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
              <Button asChild variant="outline" size="sm">
                <a href={`/katalog/${program.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Katalog
                </a>
              </Button>
              <Button type="button" size="sm" onClick={() => onNavigate("silabus")}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Silabus
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {program.status === "active" && readinessPercent < 100 ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <BarChart3 className="h-4 w-4" />
          <AlertTitle>Program aktif belum sepenuhnya siap</AlertTitle>
          <AlertDescription>Lengkapi komponen yang ditandai agar pengalaman pendaftaran dan pembelajaran peserta tetap konsisten.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
