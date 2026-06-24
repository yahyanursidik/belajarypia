import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Presentation, FileText, Video, PlayCircle, ChevronDown, ChevronRight, Edit2, Trash2, X, Plus, Upload, Link2, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthSession } from "../../app/providers/authSessionContext";
import type {
  AcademicBatch,
  AcademicClass,
  AcademicHalaqah,
  DocumentFile,
  Level,
  Lesson,
  LessonVisibilityStatus,
  ProgramModule,
  StaffProfile,
} from "../../lib/academic";
import { inferFileCategory, requestSignedUploadUrl, requestSignedDownloadUrl } from "../../lib/documents";
import type { Program } from "../../lib/organization";
import { supabase } from "../../lib/supabase";

/* ───────────────── Empty Form Templates ───────────────── */

const emptyBatch = { code: "", name: "", start_date: "", end_date: "", status: "draft" as const };
const emptyClass = { batch_id: "", code: "", name: "", capacity: "", teacher_user_id: "" };
const emptyHalaqah = { class_id: "", code: "", name: "", capacity: "", mentor_user_id: "" };
const emptyLevel = { parent_level_id: "", code: "", name: "", order_no: "" };
const emptyModule = { parent_module_id: "", level_id: "", code: "", title: "", order_no: "" };
const emptyLesson = {
  module_id: "",
  code: "",
  title: "",
  lesson_type: "content",
  order_no: "",
  release_at: "",
  visibility_status: "draft" as LessonVisibilityStatus,
  content_body: "",
  external_url: "",
};

/* ───────────────── Component ───────────────── */

export function ProgramBuilderPage() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthSession();

  /* ── Data State ── */
  const [program, setProgram] = useState<Program | null>(null);
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [halaqahs, setHalaqahs] = useState<AcademicHalaqah[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [modules, setModules] = useState<ProgramModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [documentFiles, setDocumentFiles] = useState<DocumentFile[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);

  /* ── Form State ── */
  const [batchForm, setBatchForm] = useState(emptyBatch);
  const [classForm, setClassForm] = useState(emptyClass);
  const [halaqahForm, setHalaqahForm] = useState(emptyHalaqah);
  const [levelForm, setLevelForm] = useState(emptyLevel);
  const [moduleForm, setModuleForm] = useState(emptyModule);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  /* ── UI State ── */
  const [activeTab, setActiveTab] = useState<"info" | "kurikulum" | "angkatan">("info");
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [uploadSource, setUploadSource] = useState<"url" | "upload">("url");
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [existingUploadedDoc, setExistingUploadedDoc] = useState<DocumentFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* ── Toast auto-dismiss ── */
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(null), 6000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  /* ── File preview effect ── */
  useEffect(() => {
    if (selectedUploadFile) {
      const url = URL.createObjectURL(selectedUploadFile);
      setUploadPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (!existingUploadedDoc) setUploadPreviewUrl(null);
  }, [selectedUploadFile, existingUploadedDoc]);

  /* ── Data Loading ── */
  const loadData = async () => {
    if (!programId) return;
    setIsLoading(true);
    setErrorMessage(null);

    const [
      { data: prog },
      { data: batchRows },
      { data: classRows },
      { data: halaqahRows },
      { data: levelRows },
      { data: moduleRows },
      { data: lessonRows },
      { data: docRows },
      { data: staffRows },
    ] = await Promise.all([
      supabase.from("programs").select("*").eq("id", programId).single(),
      supabase.from("batches").select("*").eq("program_id", programId).order("created_at"),
      supabase.from("classes").select("*").eq("program_id", programId).order("created_at"),
      supabase.from("halaqahs").select("*, classes!inner(program_id)").eq("classes.program_id", programId),
      supabase.from("levels").select("*").eq("program_id", programId).order("order_no"),
      supabase.from("program_modules").select("*, levels(name, code)").eq("program_id", programId).order("order_no"),
      supabase.from("lessons").select("*, program_modules!inner(program_id)").eq("program_modules.program_id", programId).order("order_no"),
      supabase.from("document_files").select("*"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

    if (prog) setProgram(prog as unknown as Program);
    setBatches((batchRows ?? []) as AcademicBatch[]);
    setClasses((classRows ?? []) as AcademicClass[]);
    setHalaqahs((halaqahRows ?? []) as unknown as AcademicHalaqah[]);
    setLevels((levelRows ?? []) as Level[]);
    setModules((moduleRows ?? []) as unknown as ProgramModule[]);
    setLessons((lessonRows ?? []) as unknown as Lesson[]);
    setDocumentFiles((docRows ?? []) as unknown as DocumentFile[]);
    setStaff((staffRows ?? []) as StaffProfile[]);
    setIsLoading(false);
  };

  useEffect(() => { void loadData(); }, [programId]);

  /* ── Derived data ── */
  const classScopedHalaqahs = halaqahs;
  const moduleTree = useMemo(
    () => modules.map((m) => ({
      module: m,
      lessons: lessons.filter((l) => l.module_id === m.id).sort((a, b) => a.order_no - b.order_no),
    })),
    [lessons, modules],
  );

  /* ── Generic submit helper ── */
  const submit = async (
    callback: () => PromiseLike<{ error: { message: string } | null }>,
    success: string,
  ) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setMessage(null);
    const { error } = await callback();
    if (error) setErrorMessage(error.message);
    else { setMessage(success); await loadData(); }
    setIsSubmitting(false);
  };

  /* ── Lesson helpers ── */
  const getLessonIcon = (type: string) => {
    switch (type) {
      case "quiz": case "exam": return <FileText className="h-4 w-4 text-orange-500" />;
      case "live_session": return <Video className="h-4 w-4 text-rose-500" />;
      case "assignment": return <BookOpen className="h-4 w-4 text-blue-500" />;
      default: return <PlayCircle className="h-4 w-4 text-emerald-500" />;
    }
  };

  const openCreateLessonModal = (moduleId: string) => {
    setLessonForm({ ...emptyLesson, module_id: moduleId });
    setEditingLessonId(null);
    setUploadSource("url");
    setSelectedUploadFile(null);
    setUploadPreviewUrl(null);
    setExistingUploadedDoc(null);
    setIsLessonModalOpen(true);
  };

  const editLesson = (lesson: Lesson) => {
    const doc = documentFiles.find(d => d.lesson_id === lesson.id && d.source_type === "object_storage");
    if (doc) {
      setUploadSource("upload");
      setExistingUploadedDoc(doc);
      requestSignedDownloadUrl(doc.id).then(({ signedUrl }) => setUploadPreviewUrl(signedUrl)).catch(() => {});
    } else {
      setUploadSource(lesson.external_url ? "url" : "url");
      setExistingUploadedDoc(null);
      setUploadPreviewUrl(null);
    }
    setSelectedUploadFile(null);
    setLessonForm({
      module_id: lesson.module_id,
      code: lesson.code,
      title: lesson.title,
      lesson_type: lesson.lesson_type,
      order_no: lesson.order_no.toString(),
      release_at: lesson.release_at ? lesson.release_at.substring(0, 16) : "",
      visibility_status: lesson.visibility_status,
      content_body: lesson.content_body || "",
      external_url: lesson.external_url || "",
    });
    setEditingLessonId(lesson.id);
    setIsLessonModalOpen(true);
  };

  const deleteLesson = async (lessonId: string) => {
    if (!window.confirm("Hapus materi ini? Tindakan ini tidak bisa dibatalkan.")) return;
    await submit(() => supabase.from("lessons").delete().eq("id", lessonId), "Materi berhasil dihapus.");
  };

  const deleteModule = async (moduleId: string) => {
    if (!window.confirm("Hapus mata pelajaran ini beserta semua materinya?")) return;
    await submit(() => supabase.from("program_modules").delete().eq("id", moduleId), "Mata pelajaran berhasil dihapus.");
  };

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  /* ── URL Preview Helper ── */
  const renderUrlPreview = (url: string) => {
    const lower = url.toLowerCase();
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
      const videoId = lower.includes("youtu.be")
        ? url.split("youtu.be/")[1]?.split("?")[0]
        : url.split("v=")[1]?.split("&")[0];
      return <iframe className="w-full aspect-video rounded-lg" src={`https://www.youtube.com/embed/${videoId}`} allowFullScreen title="YouTube Preview" />;
    }
    if (lower.endsWith(".mp4") || lower.endsWith(".webm")) return <video className="w-full aspect-video rounded-lg bg-black" controls src={url} />;
    if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".ogg")) return <audio className="w-full mt-2" controls src={url} />;
    if (lower.includes("drive.google.com")) {
      const previewUrl = url.replace(/\/view.*$/, "/preview");
      return <iframe className="w-full h-64 rounded-lg border" src={previewUrl} title="Google Drive Preview" />;
    }
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Preview otomatis tidak tersedia. <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">Buka Tautan ↗</a>
      </div>
    );
  };

  /* ── File preview helper ── */
  const renderFilePreview = () => {
    const url = uploadPreviewUrl || "";
    const filename = selectedUploadFile?.name || existingUploadedDoc?.display_name || "";
    const lowerName = filename.toLowerCase();
    if (!url && !filename) return null;
    if (lowerName.endsWith(".mp4") || lowerName.endsWith(".webm")) return <video className="w-full aspect-video rounded-lg bg-black" controls src={url} />;
    if (lowerName.endsWith(".mp3") || lowerName.endsWith(".wav") || lowerName.endsWith(".ogg")) return <audio className="w-full mt-2" controls src={url} />;
    return (
      <div className="p-4 text-center text-sm">
        <div className="flex items-center justify-center gap-2 font-medium"><FileText className="h-5 w-5 text-primary opacity-70" />{filename}</div>
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs mt-2 inline-block">Pratinjau Dokumen ↗</a>}
      </div>
    );
  };

  /* ── Lesson Modal Submit ── */
  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setMessage(null);

    const autoCode = `MTR-${Date.now().toString(36).toUpperCase()}`;
    const payload = {
      module_id: lessonForm.module_id,
      code: editingLessonId ? lessonForm.code : autoCode,
      title: lessonForm.title.trim(),
      lesson_type: lessonForm.lesson_type,
      order_no: Number(lessonForm.order_no || 0),
      release_at: lessonForm.release_at ? new Date(lessonForm.release_at).toISOString() : null,
      visibility_status: lessonForm.visibility_status,
      content_body: lessonForm.content_body.trim() || null,
      external_url: uploadSource === "url" ? (lessonForm.external_url.trim() || null) : null,
    };

    const request = editingLessonId
      ? supabase.from("lessons").update(payload).eq("id", editingLessonId).select("id").single()
      : supabase.from("lessons").insert(payload).select("id").single();

    const { data, error } = await request;
    if (error || !data) {
      setErrorMessage(error?.message ?? "Gagal menyimpan materi.");
      setIsSubmitting(false);
      return;
    }

    const lessonIdToUse = editingLessonId || data.id;

    // Handle file upload to S3
    if (uploadSource === "upload" && selectedUploadFile) {
      try {
        const { signedUrl, bucket, objectKey } = await requestSignedUploadUrl({ lessonId: lessonIdToUse, file: selectedUploadFile });
        const uploadRes = await fetch(signedUrl, { method: "PUT", body: selectedUploadFile, headers: { "Content-Type": selectedUploadFile.type || "application/octet-stream" } });
        if (!uploadRes.ok) throw new Error("Gagal mengunggah file ke S3 Contabo");

        // Remove old doc if editing
        if (existingUploadedDoc) await supabase.from("document_files").delete().eq("id", existingUploadedDoc.id);

        await supabase.from("document_files").insert({
          lesson_id: lessonIdToUse,
          source_type: "object_storage",
          storage_provider: "contabo_s3",
          bucket_name: bucket,
          object_key: objectKey,
          display_name: selectedUploadFile.name,
          mime_type: selectedUploadFile.type || null,
          file_size_bytes: selectedUploadFile.size,
          file_category: inferFileCategory(selectedUploadFile.type, selectedUploadFile.name),
          access_level: "enrolled",
          status: "active",
          uploaded_by: user?.id || null,
        });
      } catch (err: any) {
        setErrorMessage(err.message ?? "Gagal mengunggah file.");
        setIsSubmitting(false);
        return;
      }
    }

    setMessage(`Materi berhasil ${editingLessonId ? "diperbarui" : "dibuat"}.`);
    setIsLessonModalOpen(false);
    setEditingLessonId(null);
    setLessonForm(emptyLesson);
    setSelectedUploadFile(null);
    await loadData();
    setIsSubmitting(false);
  };

  /* ───────────────── Render ───────────────── */

  if (isLoading && !program) {
    return (
      <div className="page-stack flex items-center justify-center min-h-[40vh]">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent mx-auto" />
          <p className="text-muted-foreground text-sm">Memuat detail program...</p>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="page-stack space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Program tidak ditemukan atau Anda tidak memiliki akses.</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(-1)} variant="outline">Kembali</Button>
      </div>
    );
  }

  return (
    <div className="page-stack">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" className="h-10 w-10 p-0 rounded-full shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="shrink-0">{program.code}</Badge>
            <Badge variant={program.status === "active" ? "default" : "secondary"} className="capitalize shrink-0">{program.status}</Badge>
          </div>
          <h2 className="text-2xl font-bold truncate">{program.name}</h2>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex gap-2 border-b pb-4 mb-6 overflow-x-auto">
        {([
          { key: "info" as const, label: "📝 Info Program" },
          { key: "kurikulum" as const, label: "📚 Kurikulum & Materi" },
          ...(program.curriculum_model === "angkatan" ? [{ key: "angkatan" as const, label: "👥 Angkatan & Kelas" }] : []),
        ]).map(tab => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            onClick={() => setActiveTab(tab.key)}
            className="rounded-full whitespace-nowrap"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* ── Toast Notifications ── */}
      {(message || errorMessage) && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-sm">
          {message && (
            <div className="bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 mb-2">
              <span className="text-lg">✅</span>
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2">
              <span className="text-lg">❌</span>
              <span className="text-sm font-medium">{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB: INFO ═══════════════ */}
      {activeTab === "info" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Profil Program</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nama Program</p>
                <p className="text-base font-semibold">{program.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Deskripsi</p>
                <p className="text-base">{program.description || "Belum ada deskripsi"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mode Belajar</p>
                  <p className="text-base capitalize">{program.delivery_mode}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sistem Pembelajaran</p>
                  <p className="text-base font-semibold text-primary capitalize">{program.curriculum_model === "mandiri" ? "Mandiri (Evergreen)" : "Terjadwal (Angkatan)"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ringkasan Statistik</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {program.curriculum_model === "angkatan" && (
                  <>
                    <div className="p-4 rounded-xl bg-muted/50 border">
                      <p className="text-sm font-medium text-muted-foreground">Total Angkatan</p>
                      <p className="text-3xl font-bold mt-1">{batches.length}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50 border">
                      <p className="text-sm font-medium text-muted-foreground">Total Kelas</p>
                      <p className="text-3xl font-bold mt-1">{classes.length}</p>
                    </div>
                  </>
                )}
                <div className="p-4 rounded-xl bg-muted/50 border">
                  <p className="text-sm font-medium text-muted-foreground">Mata Pelajaran</p>
                  <p className="text-3xl font-bold mt-1">{modules.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border">
                  <p className="text-sm font-medium text-muted-foreground">Total Materi</p>
                  <p className="text-3xl font-bold mt-1">{lessons.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════ TAB: ANGKATAN ═══════════════ */}
      {activeTab === "angkatan" && program.curriculum_model === "angkatan" && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Buat Angkatan */}
            <Card>
              <CardHeader><CardTitle className="text-base">Buat Angkatan Baru</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(() => supabase.from("batches").insert({ program_id: programId, code: batchForm.code.trim(), name: batchForm.name.trim(), start_date: batchForm.start_date || null, end_date: batchForm.end_date || null, status: batchForm.status }), "Angkatan berhasil dibuat."); setBatchForm(emptyBatch); }}>
                  <Input placeholder="Kode (BATCH-01)" required value={batchForm.code} onChange={e => setBatchForm(c => ({ ...c, code: e.target.value }))} />
                  <Input placeholder="Nama (Angkatan 1)" required value={batchForm.name} onChange={e => setBatchForm(c => ({ ...c, name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" title="Tanggal Mulai" value={batchForm.start_date} onChange={e => setBatchForm(c => ({ ...c, start_date: e.target.value }))} />
                    <Input type="date" title="Tanggal Selesai" value={batchForm.end_date} onChange={e => setBatchForm(c => ({ ...c, end_date: e.target.value }))} />
                  </div>
                  <Button disabled={isSubmitting} type="submit" className="w-full">Tambahkan Angkatan</Button>
                </form>
              </CardContent>
            </Card>

            {/* Buat Kelas */}
            <Card>
              <CardHeader><CardTitle className="text-base">Buat Kelas Baru</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(() => supabase.from("classes").insert({ program_id: programId, batch_id: classForm.batch_id || null, code: classForm.code.trim(), name: classForm.name.trim(), capacity: classForm.capacity ? Number(classForm.capacity) : null, teacher_user_id: classForm.teacher_user_id || null }), "Kelas berhasil dibuat."); setClassForm(emptyClass); }}>
                  <select className="field-control" value={classForm.batch_id} onChange={e => setClassForm(c => ({ ...c, batch_id: e.target.value }))}>
                    <option value="">-- Pilih Angkatan --</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                  </select>
                  <Input placeholder="Kode kelas (KLS-A)" required value={classForm.code} onChange={e => setClassForm(c => ({ ...c, code: e.target.value }))} />
                  <Input placeholder="Nama kelas (Kelas A)" required value={classForm.name} onChange={e => setClassForm(c => ({ ...c, name: e.target.value }))} />
                  <Input placeholder="Kapasitas" type="number" value={classForm.capacity} onChange={e => setClassForm(c => ({ ...c, capacity: e.target.value }))} />
                  <select className="field-control" value={classForm.teacher_user_id} onChange={e => setClassForm(c => ({ ...c, teacher_user_id: e.target.value }))}>
                    <option value="">-- Pilih Pengajar --</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>)}
                  </select>
                  <Button disabled={isSubmitting} type="submit" className="w-full">Tambahkan Kelas</Button>
                </form>
              </CardContent>
            </Card>

            {/* Buat Halaqah */}
            <Card>
              <CardHeader><CardTitle className="text-base">Buat Halaqah / Kelompok</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(() => supabase.from("halaqahs").insert({ class_id: halaqahForm.class_id, code: halaqahForm.code.trim(), name: halaqahForm.name.trim(), capacity: halaqahForm.capacity ? Number(halaqahForm.capacity) : null, mentor_user_id: halaqahForm.mentor_user_id || null }), "Halaqah berhasil dibuat."); setHalaqahForm(emptyHalaqah); }}>
                  <select className="field-control" required value={halaqahForm.class_id} onChange={e => setHalaqahForm(c => ({ ...c, class_id: e.target.value }))}>
                    <option value="">-- Pilih Kelas --</option>
                    {classes.map(cl => <option key={cl.id} value={cl.id}>{cl.code} - {cl.name}</option>)}
                  </select>
                  <Input placeholder="Kode halaqah (HLQ-01)" required value={halaqahForm.code} onChange={e => setHalaqahForm(c => ({ ...c, code: e.target.value }))} />
                  <Input placeholder="Nama halaqah" required value={halaqahForm.name} onChange={e => setHalaqahForm(c => ({ ...c, name: e.target.value }))} />
                  <Input placeholder="Kapasitas" type="number" value={halaqahForm.capacity} onChange={e => setHalaqahForm(c => ({ ...c, capacity: e.target.value }))} />
                  <select className="field-control" value={halaqahForm.mentor_user_id} onChange={e => setHalaqahForm(c => ({ ...c, mentor_user_id: e.target.value }))}>
                    <option value="">-- Pilih Mentor --</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>)}
                  </select>
                  <Button disabled={isSubmitting} type="submit" className="w-full">Tambahkan Halaqah</Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Ringkasan Kelas */}
          <Card className="mt-6">
            <CardHeader><CardTitle>Ringkasan Kelas & Halaqah</CardTitle></CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground border rounded-lg border-dashed">Belum ada kelas di program ini.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Kelas</th><th>Angkatan</th><th>Pengajar</th><th>Halaqah</th></tr>
                    </thead>
                    <tbody>
                      {classes.map(cl => (
                        <tr key={cl.id}>
                          <td className="font-medium">{cl.code} - {cl.name}</td>
                          <td>{batches.find(b => b.id === cl.batch_id)?.name ?? "-"}</td>
                          <td>{staff.find(s => s.id === cl.teacher_user_id)?.full_name ?? "-"}</td>
                          <td>{classScopedHalaqahs.filter(h => h.class_id === cl.id).map(h => <Badge key={h.id} variant="secondary" className="mr-1 mb-1">{h.name}</Badge>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══════════════ TAB: KURIKULUM ═══════════════ */}
      {activeTab === "kurikulum" && (
        <>
          {/* Form Builder Row */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Buat Tahapan */}
            <Card>
              <CardHeader><CardTitle className="text-base">Buat Tahapan (Opsional)</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(() => supabase.from("levels").insert({ program_id: programId, parent_level_id: levelForm.parent_level_id || null, code: levelForm.code.trim(), name: levelForm.name.trim(), order_no: Number(levelForm.order_no || 0) }), "Tahapan berhasil dibuat."); setLevelForm(emptyLevel); }}>
                  <select className="field-control" value={levelForm.parent_level_id} onChange={e => setLevelForm(c => ({ ...c, parent_level_id: e.target.value }))}>
                    <option value="">Tanpa parent tahapan</option>
                    {levels.map(l => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
                  </select>
                  <Input placeholder="Kode (DASAR)" required value={levelForm.code} onChange={e => setLevelForm(c => ({ ...c, code: e.target.value }))} />
                  <Input placeholder="Nama (Level 1 Dasar)" required value={levelForm.name} onChange={e => setLevelForm(c => ({ ...c, name: e.target.value }))} />
                  <Input placeholder="Urutan (1)" type="number" value={levelForm.order_no} onChange={e => setLevelForm(c => ({ ...c, order_no: e.target.value }))} />
                  <Button disabled={isSubmitting} type="submit" className="w-full">Tambahkan Tahapan</Button>
                </form>
              </CardContent>
            </Card>

            {/* Buat Mata Pelajaran */}
            <Card>
              <CardHeader><CardTitle className="text-base">{editingModuleId ? "Edit Mata Pelajaran" : "Buat Mata Pelajaran"}</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(e) => {
                  e.preventDefault();
                  if (editingModuleId) {
                    void submit(() => supabase.from("program_modules").update({ parent_module_id: moduleForm.parent_module_id || null, level_id: moduleForm.level_id || null, code: moduleForm.code.trim(), title: moduleForm.title.trim(), order_no: Number(moduleForm.order_no || 0) }).eq("id", editingModuleId), "Mata Pelajaran berhasil diperbarui.");
                    setEditingModuleId(null);
                  } else {
                    void submit(() => supabase.from("program_modules").insert({ program_id: programId, parent_module_id: moduleForm.parent_module_id || null, level_id: moduleForm.level_id || null, code: moduleForm.code.trim(), title: moduleForm.title.trim(), order_no: Number(moduleForm.order_no || 0) }), "Mata Pelajaran berhasil dibuat.");
                  }
                  setModuleForm(emptyModule);
                }}>
                  <select className="field-control" value={moduleForm.level_id} onChange={e => setModuleForm(c => ({ ...c, level_id: e.target.value }))}>
                    <option value="">-- Pilih Tahapan (Opsional) --</option>
                    {levels.map(l => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
                  </select>
                  <select className="field-control" value={moduleForm.parent_module_id} onChange={e => setModuleForm(c => ({ ...c, parent_module_id: e.target.value }))}>
                    <option value="">-- Induk (Opsional) --</option>
                    {modules.map(m => <option key={m.id} value={m.id}>{m.code} - {m.title}</option>)}
                  </select>
                  <Input placeholder="Kode (THD)" required value={moduleForm.code} onChange={e => setModuleForm(c => ({ ...c, code: e.target.value }))} />
                  <Input placeholder="Nama Mata Pelajaran (Tauhid)" required value={moduleForm.title} onChange={e => setModuleForm(c => ({ ...c, title: e.target.value }))} />
                  <Input placeholder="Urutan (1)" type="number" value={moduleForm.order_no} onChange={e => setModuleForm(c => ({ ...c, order_no: e.target.value }))} />
                  <div className="flex gap-2">
                    <Button disabled={isSubmitting} type="submit" className="flex-1">{editingModuleId ? "Simpan Perubahan" : "Tambahkan"}</Button>
                    {editingModuleId && <Button type="button" variant="outline" onClick={() => { setEditingModuleId(null); setModuleForm(emptyModule); }}>Batal</Button>}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Struktur Kurikulum */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Struktur Kurikulum Program</CardTitle>
              <Badge variant="outline">{modules.length} Mata Pelajaran · {lessons.length} Materi</Badge>
            </CardHeader>
            <CardContent>
              {modules.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground border rounded-lg border-dashed">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Belum ada Mata Pelajaran.</p>
                  <p className="text-sm">Buat Mata Pelajaran di form di atas.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {moduleTree.map(({ module, lessons: moduleLessons }) => (
                    <div className="rounded-xl border shadow-sm bg-card overflow-hidden" key={module.id}>
                      {/* Module Header */}
                      <div
                        className="bg-muted/40 p-4 border-b cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => toggleModule(module.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            {expandedModules[module.id] ? <ChevronDown className="h-5 w-5 text-primary shrink-0" /> : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
                            <div className="min-w-0">
                              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                                <span className="truncate">{module.code} - {module.title}</span>
                              </h3>
                              {module.levels && (
                                <p className="text-xs text-muted-foreground mt-0.5">Tahapan: <span className="text-primary font-medium">{module.levels.name}</span></p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="bg-white text-xs">{moduleLessons.length} Materi</Badge>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50 rounded-full" onClick={(e) => { e.stopPropagation(); setModuleForm({ parent_module_id: module.parent_module_id || "", level_id: module.level_id || "", code: module.code, title: module.title, order_no: module.order_no.toString() }); setEditingModuleId(module.id); }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" onClick={(e) => { e.stopPropagation(); void deleteModule(module.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Module Content (Expanded) */}
                      {expandedModules[module.id] && (
                        <div>
                          {moduleLessons.length === 0 ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">Belum ada materi di mata pelajaran ini.</div>
                          ) : (
                            <div className="divide-y border-t bg-background">
                              {moduleLessons.map(lesson => (
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors" key={lesson.id}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">{getLessonIcon(lesson.lesson_type)}</div>
                                    <div className="min-w-0">
                                      <span className="text-sm font-bold text-foreground truncate block">{lesson.title}</span>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-muted-foreground">{lesson.code}</span>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{lesson.lesson_type.replace("_", " ")}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant={lesson.visibility_status === "published" ? "default" : "secondary"} className="text-xs">{lesson.visibility_status}</Badge>
                                    <Button variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50 rounded-full" onClick={() => editLesson(lesson)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" onClick={() => void deleteLesson(lesson.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Lesson Button */}
                          <div className="p-3 bg-muted/20 border-t">
                            <Button variant="outline" className="w-full border-dashed rounded-lg" onClick={() => openCreateLessonModal(module.id)}>
                              <Plus className="h-4 w-4 mr-2" /> Tambah Pertemuan / Materi
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══════════════ UNIFIED LESSON MODAL ═══════════════ */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-xl flex items-center gap-2 text-primary">
                <Presentation className="h-5 w-5" />
                {editingLessonId ? "Edit Pertemuan / Materi" : "Buat Pertemuan / Materi Baru"}
              </CardTitle>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsLessonModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-5" onSubmit={handleLessonSubmit}>
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Judul Materi <span className="text-red-500">*</span></label>
                  <Input placeholder="Contoh: Pengantar Tauhid - Pertemuan 1" required value={lessonForm.title} onChange={e => setLessonForm(c => ({ ...c, title: e.target.value }))} className="h-11" />
                </div>

                {/* Type & Status */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Tipe Pertemuan</label>
                    <select className="field-control h-11" value={lessonForm.lesson_type} onChange={e => setLessonForm(c => ({ ...c, lesson_type: e.target.value }))}>
                      <option value="content">📖 Materi Pembelajaran</option>
                      <option value="quiz">✍️ Kuis Harian</option>
                      <option value="exam">🏆 Ujian</option>
                      <option value="live_session">🎥 Sesi Live</option>
                      <option value="assignment">📝 Tugas</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Status</label>
                    <select className="field-control h-11" value={lessonForm.visibility_status} onChange={e => setLessonForm(c => ({ ...c, visibility_status: e.target.value as LessonVisibilityStatus }))}>
                      <option value="draft">Draft</option>
                      <option value="published">Diterbitkan</option>
                      <option value="locked">Terkunci</option>
                    </select>
                  </div>
                </div>

                {/* Order & Release */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Urutan</label>
                    <Input placeholder="1" type="number" value={lessonForm.order_no} onChange={e => setLessonForm(c => ({ ...c, order_no: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Tanggal Rilis (Opsional)</label>
                    <Input type="datetime-local" value={lessonForm.release_at} onChange={e => setLessonForm(c => ({ ...c, release_at: e.target.value }))} />
                  </div>
                </div>

                {/* Source Material — conditional on lesson type */}
                {lessonForm.lesson_type === "live_session" ? (
                  <div className="space-y-4 p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/50 dark:border-rose-800/30">
                    <label className="text-sm font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                      <Video className="h-4 w-4" /> Pengaturan Sesi Live
                    </label>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Link Meeting (Zoom / Google Meet) <span className="text-red-500">*</span></label>
                      <Input
                        placeholder="https://zoom.us/j/123456 atau https://meet.google.com/abc-defg-hij"
                        value={lessonForm.external_url}
                        onChange={e => setLessonForm(c => ({ ...c, external_url: e.target.value }))}
                        className="h-11"
                      />
                      {lessonForm.external_url && (
                        <div className="flex items-center gap-2 p-2.5 bg-background rounded-lg border text-sm">
                          {lessonForm.external_url.toLowerCase().includes("zoom") ? (
                            <span className="text-blue-600 font-semibold flex items-center gap-1.5">🎦 Zoom Meeting</span>
                          ) : lessonForm.external_url.toLowerCase().includes("meet.google") ? (
                            <span className="text-green-600 font-semibold flex items-center gap-1.5">📹 Google Meet</span>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Link Meeting</span>
                          )}
                          <span className="text-muted-foreground">·</span>
                          <a href={lessonForm.external_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate text-xs">{lessonForm.external_url}</a>
                        </div>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Tanggal & Waktu Mulai <span className="text-red-500">*</span></label>
                        <Input
                          type="datetime-local"
                          value={lessonForm.release_at}
                          onChange={e => setLessonForm(c => ({ ...c, release_at: e.target.value }))}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Estimasi Durasi</label>
                        <select className="field-control h-11" value={lessonForm.order_no || "60"} onChange={e => setLessonForm(c => ({ ...c, order_no: e.target.value }))}>
                          <option value="30">30 Menit</option>
                          <option value="60">1 Jam</option>
                          <option value="90">1.5 Jam</option>
                          <option value="120">2 Jam</option>
                          <option value="180">3 Jam</option>
                        </select>
                      </div>
                    </div>
                    {lessonForm.release_at && (
                      <div className="p-3 bg-background rounded-lg border flex items-center gap-3 text-sm">
                        <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                          <Video className="h-5 w-5 text-rose-600" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Sesi dijadwalkan pada:</p>
                          <p className="text-muted-foreground text-xs">{new Date(lessonForm.release_at).toLocaleString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-muted/30 rounded-xl border">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-primary" /> Sumber Materi Utama
                    </label>
                    <div className="flex bg-background p-1 rounded-lg w-fit border">
                      <button type="button" onClick={() => setUploadSource("url")} className={`px-4 py-2 text-sm rounded-md transition-all flex items-center gap-2 ${uploadSource === "url" ? "bg-primary text-primary-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                        <Link2 className="h-4 w-4" /> URL Tautan
                      </button>
                      <button type="button" onClick={() => setUploadSource("upload")} className={`px-4 py-2 text-sm rounded-md transition-all flex items-center gap-2 ${uploadSource === "upload" ? "bg-primary text-primary-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                        <Upload className="h-4 w-4" /> Unggah File (S3)
                      </button>
                    </div>

                    {uploadSource === "url" ? (
                      <div className="space-y-3">
                        <Input placeholder="Paste link YouTube, Google Drive, MP4, atau MP3..." value={lessonForm.external_url} onChange={e => setLessonForm(c => ({ ...c, external_url: e.target.value }))} />
                        {lessonForm.external_url && (
                          <div className="mt-2 p-2 border rounded-lg bg-background">{renderUrlPreview(lessonForm.external_url)}</div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div
                          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm font-medium">{selectedUploadFile ? selectedUploadFile.name : "Klik untuk memilih file"}</p>
                          <p className="text-xs text-muted-foreground mt-1">Video, Audio, atau Dokumen (Max 500MB)</p>
                          {selectedUploadFile && <p className="text-xs text-primary mt-1">{(selectedUploadFile.size / 1024 / 1024).toFixed(2)} MB</p>}
                        </div>
                        <input ref={fileInputRef} type="file" className="hidden" accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx" onChange={e => setSelectedUploadFile(e.target.files?.[0] || null)} />
                        {(uploadPreviewUrl || existingUploadedDoc) && (
                          <div className="p-2 border rounded-lg bg-background">{renderFilePreview()}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Description — improved UI */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {lessonForm.lesson_type === "live_session" ? "Agenda / Catatan Sesi" :
                       lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam" ? "Instruksi Ujian / Kuis" :
                       lessonForm.lesson_type === "assignment" ? "Instruksi Tugas" :
                       "Deskripsi Materi"}
                    </label>
                    <span className={`text-xs tabular-nums ${(lessonForm.content_body?.length || 0) > 900 ? "text-amber-500" : "text-muted-foreground"}`}>
                      {lessonForm.content_body?.length || 0} / 1000
                    </span>
                  </div>
                  <textarea
                    className="field-control min-h-[120px] leading-relaxed resize-y"
                    placeholder={
                      lessonForm.lesson_type === "live_session"
                        ? "Tuliskan agenda sesi live, topik yang akan dibahas, atau hal yang perlu disiapkan peserta sebelum sesi dimulai..."
                        : lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam"
                        ? "Tuliskan instruksi ujian: durasi pengerjaan, jumlah soal, ketentuan, dan aturan khusus..."
                        : lessonForm.lesson_type === "assignment"
                        ? "Jelaskan tugas yang harus dikerjakan peserta, format pengumpulan, dan batas waktu..."
                        : "Tuliskan ringkasan materi, poin-poin penting yang akan dipelajari, atau catatan tambahan untuk peserta..."
                    }
                    maxLength={1000}
                    value={lessonForm.content_body}
                    onChange={e => setLessonForm(c => ({ ...c, content_body: e.target.value }))}
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsLessonModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit" className="px-8 shadow-md">
                    {isSubmitting ? "Menyimpan..." : editingLessonId ? "Simpan Perubahan" : "Simpan Materi"}
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