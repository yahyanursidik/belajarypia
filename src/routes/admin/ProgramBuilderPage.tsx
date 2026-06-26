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
  QuestionBank,
} from "../../lib/academic";
import { inferFileCategory, requestSignedUploadUrl, requestSignedDownloadUrl } from "../../lib/documents";
import type { Program } from "../../lib/organization";
import { supabase } from "../../lib/supabase";
import { ProgramParticipants } from "./ProgramParticipants";

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
  passing_grade: "",
  duration_minutes: "",
  max_attempts: ""
};
const emptyQuestion = { question_text: "", optA: "", optB: "", optC: "", optD: "", correct_option: "A", explanation: "", points: 10 };

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
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);

  /* ── Form State ── */
  const [batchForm, setBatchForm] = useState(emptyBatch);
  const [classForm, setClassForm] = useState(emptyClass);
  const [halaqahForm, setHalaqahForm] = useState(emptyHalaqah);
  const [levelForm, setLevelForm] = useState(emptyLevel);
  const [moduleForm, setModuleForm] = useState(emptyModule);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonModalMode, setLessonModalMode] = useState<"materi" | "kuis">("materi");

  /* ── UI State ── */
  const [activeTab, setActiveTab] = useState<"info" | "kurikulum" | "peserta" | "angkatan" | "bank_soal" | "silabus" | "kelulusan">("info");
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isHalaqahModalOpen, setIsHalaqahModalOpen] = useState(false);
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [managingLesson, setManagingLesson] = useState<Lesson | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);

  const [managingBankId, setManagingBankId] = useState<string | null>(null);
  const [bankItems, setBankItems] = useState<any[]>([]);
  const [isManageBankItemsModalOpen, setIsManageBankItemsModalOpen] = useState(false);
  const [isCreateQuestionModalOpen, setIsCreateQuestionModalOpen] = useState(false);
  const [questionTarget, setQuestionTarget] = useState<"quiz" | "bank" | null>(null);
  const [questionForm, setQuestionForm] = useState(emptyQuestion);
  const [isBankSelectModalOpen, setIsBankSelectModalOpen] = useState(false);
  const [allBankItems, setAllBankItems] = useState<any[]>([]);
  const [selectedBankItems, setSelectedBankItems] = useState<Record<string, boolean>>({});

  const [syllabusForm, setSyllabusForm] = useState("");
  const [isSavingSyllabus, setIsSavingSyllabus] = useState(false);

  const [bankForm, setBankForm] = useState({ name: "", description: "" });
  const [gradingRubricForm, setGradingRubricForm] = useState<any[]>([]);
  const [isSavingRubric, setIsSavingRubric] = useState(false);
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
      { data: bankRows },
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
      supabase.from("question_banks").select("*").eq("program_id", programId).order("created_at"),
    ]);

    if (prog) {
      setProgram(prog as unknown as Program);
      setSyllabusForm((prog as unknown as Program).syllabus || "");
      setGradingRubricForm((prog as unknown as Program).grading_rubric || [
        { min_score: 90, max_score: 100, label: "Mumtaz (Istimewa)" },
        { min_score: 80, max_score: 89.9, label: "Jayyid Jiddan (Baik Sekali)" },
        { min_score: 65, max_score: 79.9, label: "Jayyid (Baik)" },
        { min_score: 40, max_score: 64.9, label: "Maqbul (Cukup)" },
        { min_score: 0, max_score: 39.9, label: "Rasib (Gagal/Mengulang)" }
      ]);
    }
    setBatches((batchRows ?? []) as AcademicBatch[]);
    setClasses((classRows ?? []) as AcademicClass[]);
    setHalaqahs((halaqahRows ?? []) as unknown as AcademicHalaqah[]);
    setLevels((levelRows ?? []) as Level[]);
    setModules((moduleRows ?? []) as unknown as ProgramModule[]);
    setLessons((lessonRows ?? []) as unknown as Lesson[]);
    setDocumentFiles((docRows ?? []) as unknown as DocumentFile[]);
    setStaff((staffRows ?? []) as StaffProfile[]);
    setQuestionBanks((bankRows ?? []) as any[]);
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

  const openCreateLessonModal = (moduleId: string, mode: "materi" | "kuis") => {
    setLessonModalMode(mode);
    setLessonForm({ 
      ...emptyLesson, 
      module_id: moduleId,
      lesson_type: mode === "kuis" ? "quiz" : "content" 
    });
    setEditingLessonId(null);
    setUploadSource("url");
    setSelectedUploadFile(null);
    setUploadPreviewUrl(null);
    setExistingUploadedDoc(null);
    setIsLessonModalOpen(true);
  };

  const editLesson = (lesson: Lesson) => {
    setLessonModalMode(lesson.lesson_type === "quiz" || lesson.lesson_type === "exam" ? "kuis" : "materi");
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
      passing_grade: lesson.passing_grade?.toString() || "",
      duration_minutes: lesson.duration_minutes?.toString() || "",
      max_attempts: lesson.max_attempts?.toString() || ""
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

  const manageQuestions = async (lesson: Lesson) => {
    setManagingLesson(lesson);
    setIsQuestionModalOpen(true);
    const { data } = await supabase.from("quiz_questions").select("*").eq("lesson_id", lesson.id).order("order_no");
    setQuizQuestions(data || []);
  };

  const manageBankItems = async (bankId: string) => {
    setManagingBankId(bankId);
    setIsManageBankItemsModalOpen(true);
    const { data } = await supabase.from("question_bank_items").select("*").eq("question_bank_id", bankId).order("created_at");
    setBankItems(data || []);
  };

  const openSelectFromBank = async () => {
    const { data } = await supabase.from("question_bank_items").select("*, question_banks!inner(name, programs(title))");
    setAllBankItems(data || []);
    setSelectedBankItems({});
    setIsBankSelectModalOpen(true);
  };

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const opts = [questionForm.optA, questionForm.optB, questionForm.optC, questionForm.optD].filter(o => o.trim() !== "");
    let correct = questionForm.optA;
    if (questionForm.correct_option === "B") correct = questionForm.optB;
    if (questionForm.correct_option === "C") correct = questionForm.optC;
    if (questionForm.correct_option === "D") correct = questionForm.optD;

    if (questionTarget === "quiz" && managingLesson) {
      await submit(async () => {
        const payload = {
          lesson_id: managingLesson.id,
          question_text: questionForm.question_text,
          options: opts,
          correct_answer: correct,
          explanation: questionForm.explanation || null,
          points: Number(questionForm.points || 10),
          order_no: quizQuestions.length + 1
        };
        const res = await supabase.from("quiz_questions").insert(payload);
        if (!res.error) {
          const { data } = await supabase.from("quiz_questions").select("*").eq("lesson_id", managingLesson.id).order("order_no");
          setQuizQuestions(data || []);
        }
        return res;
      }, "Soal berhasil ditambahkan ke kuis.");
    } else if (questionTarget === "bank" && managingBankId) {
      await submit(async () => {
        const payload = {
          question_bank_id: managingBankId,
          question_text: questionForm.question_text,
          options: opts,
          correct_answer: correct,
          explanation: questionForm.explanation || null,
          points: Number(questionForm.points || 10),
        };
        const res = await supabase.from("question_bank_items").insert(payload);
        if (!res.error) {
          const { data } = await supabase.from("question_bank_items").select("*").eq("question_bank_id", managingBankId).order("created_at");
          setBankItems(data || []);
        }
        return res;
      }, "Soal berhasil ditambahkan ke bank.");
    }
    setQuestionForm(emptyQuestion);
    setIsCreateQuestionModalOpen(false);
  };

  const submitImportBank = async () => {
    if (!managingLesson) return;
    const selectedIds = Object.keys(selectedBankItems).filter(k => selectedBankItems[k]);
    if (selectedIds.length === 0) return setIsBankSelectModalOpen(false);
    
    const itemsToImport = allBankItems.filter(i => selectedIds.includes(i.id));
    const startOrder = quizQuestions.length;
    const payloads = itemsToImport.map((item, idx) => ({
      lesson_id: managingLesson.id,
      question_type: item.question_type,
      question_text: item.question_text,
      options: item.options,
      correct_answer: item.correct_answer,
      explanation: item.explanation,
      points: Number(item.points || 10),
      order_no: startOrder + idx + 1
    }));

    await submit(async () => {
      const res = await supabase.from("quiz_questions").insert(payloads);
      if (!res.error) {
        const { data } = await supabase.from("quiz_questions").select("*").eq("lesson_id", managingLesson.id).order("order_no");
        setQuizQuestions(data || []);
      }
      return res;
    }, `${itemsToImport.length} soal berhasil diimpor.`);
    setIsBankSelectModalOpen(false);
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
      passing_grade: lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam" ? (lessonForm.passing_grade ? Number(lessonForm.passing_grade) : null) : null,
      duration_minutes: lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam" ? (lessonForm.duration_minutes ? Number(lessonForm.duration_minutes) : null) : null,
      max_attempts: lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam" ? (lessonForm.max_attempts ? Number(lessonForm.max_attempts) : null) : null,
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

  const handleSaveSyllabus = async () => {
    if (!program) return;
    setIsSavingSyllabus(true);
    const { error } = await supabase
      .from("programs")
      .update({ syllabus: syllabusForm })
      .eq("id", program.id);
      
    if (error) {
      setErrorMessage("Gagal menyimpan silabus");
    } else {
      setMessage("Silabus berhasil disimpan");
      setProgram(prev => prev ? { ...prev, syllabus: syllabusForm } : prev);
    }
    setIsSavingSyllabus(false);
  };

  const handleSaveRubric = async () => {
    if (!program) return;
    setIsSavingRubric(true);
    const { error } = await supabase
      .from("programs")
      .update({ grading_rubric: gradingRubricForm })
      .eq("id", program.id);
      
    if (error) {
      setErrorMessage("Gagal menyimpan rubrik kelulusan");
    } else {
      setMessage("Rubrik kelulusan berhasil disimpan");
      setProgram(prev => prev ? { ...prev, grading_rubric: gradingRubricForm } : prev);
    }
    setIsSavingRubric(false);
  };

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
        <Alert className="border-red-200 bg-red-50 text-red-900">
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
          { key: "silabus" as const, label: "📋 Silabus" },
          { key: "kurikulum" as const, label: "📚 Kurikulum & Materi" },
          ...(program.curriculum_model === "angkatan" ? [{ key: "angkatan" as const, label: "👥 Angkatan & Kelas" }] : []),
          { key: "bank_soal" as const, label: "🏦 Bank Soal" },
          { key: "peserta" as const, label: "👥 Info Peserta" },
          { key: "kelulusan" as const, label: "🏆 Kelulusan" },
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
          <div className="flex flex-wrap gap-3 mb-6">
            <Button onClick={() => { setBatchForm(emptyBatch); setIsBatchModalOpen(true); }} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Tambah Angkatan
            </Button>
            <Button variant="outline" onClick={() => { setClassForm(emptyClass); setIsClassModalOpen(true); }} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Tambah Kelas
            </Button>
            <Button variant="outline" onClick={() => { setHalaqahForm(emptyHalaqah); setIsHalaqahModalOpen(true); }} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Tambah Halaqah
            </Button>
          </div>

          {/* Ringkasan Kelas */}
          <Card>
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
          <div className="flex flex-wrap gap-3 mb-6">
            <Button onClick={() => { setModuleForm(emptyModule); setEditingModuleId(null); setIsModuleModalOpen(true); }} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Tambah Mata Pelajaran
            </Button>
            <Button variant="outline" onClick={() => { setLevelForm(emptyLevel); setIsLevelModalOpen(true); }} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Tambah Tahapan (Level)
            </Button>
          </div>

          {/* Struktur Kurikulum */}
          <Card>
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
                            <Button variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50 rounded-full" onClick={(e) => { e.stopPropagation(); setModuleForm({ parent_module_id: module.parent_module_id || "", level_id: module.level_id || "", code: module.code, title: module.title, order_no: module.order_no.toString() }); setEditingModuleId(module.id); setIsModuleModalOpen(true); }}>
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
                                    {(lesson.lesson_type === "quiz" || lesson.lesson_type === "exam") && (
                                      <Button variant="outline" size="sm" className="h-8 text-xs border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => manageQuestions(lesson)}>
                                        <BookOpen className="h-3 w-3 mr-1" /> Kelola Soal
                                      </Button>
                                    )}
                                    <Badge variant={lesson.visibility_status === "published" ? "default" : "secondary"} className="text-xs">{lesson.visibility_status}</Badge>
                                    <Button variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50 rounded-full" onClick={() => editLesson(lesson)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" onClick={() => void deleteLesson(lesson.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Lesson Button */}
                          <div className="p-3 bg-muted/20 border-t grid gap-2 md:grid-cols-2">
                            <Button variant="outline" className="w-full border-dashed rounded-lg" onClick={() => openCreateLessonModal(module.id, "materi")}>
                              <Plus className="h-4 w-4 mr-2" /> Tambah Pertemuan / Materi
                            </Button>
                            <Button variant="outline" className="w-full border-dashed rounded-lg text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200" onClick={() => openCreateLessonModal(module.id, "kuis")}>
                              <FileText className="h-4 w-4 mr-2" /> Tambah Kuis / Ujian
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

      {/* ═══════════════ TAB: BANK SOAL ═══════════════ */}
      {activeTab === "bank_soal" && (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <Button onClick={() => { setBankForm({ name: "", description: "" }); setIsBankModalOpen(true); }} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Buat Bank Soal
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daftar Bank Soal</CardTitle>
            </CardHeader>
            <CardContent>
              {questionBanks.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground border rounded-lg border-dashed">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Belum ada Bank Soal.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {questionBanks.map(bank => (
                    <Card key={bank.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{bank.name}</CardTitle>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" onClick={() => submit(() => supabase.from("question_banks").delete().eq("id", bank.id), "Bank Soal dihapus.")}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{bank.description || "Tidak ada deskripsi."}</p>
                      </CardHeader>
                      <CardContent className="pt-4 border-t">
                        <Button variant="outline" className="w-full" onClick={() => manageBankItems(bank.id)}>Kelola Butir Soal <ChevronRight className="ml-2 h-4 w-4" /></Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══════════════ MODALS ═══════════════ */}
      
      {/* Modal Kelola Soal Kuis */}
      {isQuestionModalOpen && managingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4 shrink-0">
              <div>
                <CardTitle className="text-xl">Kelola Soal: {managingLesson.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Total {quizQuestions.length} soal ditambahkan.</p>
              </div>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => { setIsQuestionModalOpen(false); setManagingLesson(null); }}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto flex-1 bg-muted/10">
              <div className="flex gap-4 mb-6">
                <Button className="shadow-sm" onClick={() => { setQuestionTarget("quiz"); setQuestionForm(emptyQuestion); setIsCreateQuestionModalOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Buat Soal Sendiri
                </Button>
                <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/5" onClick={openSelectFromBank}>
                  <BookOpen className="h-4 w-4 mr-2" /> Ambil dari Bank Soal
                </Button>
              </div>

              {quizQuestions.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground border rounded-lg border-dashed bg-background">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Belum ada soal untuk kuis ini.</p>
                  <p className="text-sm mt-1">Pilih "Buat Soal Sendiri" atau "Ambil dari Bank Soal" di atas.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quizQuestions.map((q, i) => (
                    <Card key={q.id}>
                      <div className="flex gap-4 p-4">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground mb-3">{q.question_text}</p>
                          <div className="space-y-2">
                            {(q.options || []).map((opt: string, idx: number) => (
                              <div key={idx} className={`p-2 border rounded-md text-sm ${opt === q.correct_answer ? "bg-emerald-50 border-emerald-200 font-medium" : "bg-muted/30"}`}>
                                {String.fromCharCode(65 + idx)}. {opt}
                                {opt === q.correct_answer && <span className="float-right text-emerald-600 text-xs">Jawaban Benar</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50 rounded-full"><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Bank Soal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-xl">Buat Bank Soal Baru</CardTitle>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsBankModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(() => supabase.from("question_banks").insert({ program_id: programId, name: bankForm.name.trim(), description: bankForm.description.trim() || null }), "Bank Soal berhasil dibuat."); setBankForm({ name: "", description: "" }); setIsBankModalOpen(false); }}>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Nama Bank Soal <span className="text-red-500">*</span></label>
                  <Input placeholder="Contoh: Bank Soal Tauhid" required value={bankForm.name} onChange={e => setBankForm(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Deskripsi</label>
                  <textarea className="field-control min-h-[80px]" placeholder="Keterangan..." value={bankForm.description} onChange={e => setBankForm(c => ({ ...c, description: e.target.value }))} />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsBankModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Simpan Bank Soal</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Angkatan */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-xl">Buat Angkatan Baru</CardTitle>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsBatchModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(() => supabase.from("batches").insert({ program_id: programId, code: batchForm.code.trim(), name: batchForm.name.trim(), start_date: batchForm.start_date || null, end_date: batchForm.end_date || null, status: batchForm.status }), "Angkatan berhasil dibuat."); setBatchForm(emptyBatch); setIsBatchModalOpen(false); }}>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Kode Angkatan</label>
                  <Input placeholder="Contoh: BATCH-01" required value={batchForm.code} onChange={e => setBatchForm(c => ({ ...c, code: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Nama Angkatan</label>
                  <Input placeholder="Contoh: Angkatan 1" required value={batchForm.name} onChange={e => setBatchForm(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Tanggal Mulai</label>
                    <Input type="date" value={batchForm.start_date} onChange={e => setBatchForm(c => ({ ...c, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Tanggal Selesai</label>
                    <Input type="date" value={batchForm.end_date} onChange={e => setBatchForm(c => ({ ...c, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsBatchModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Tambahkan Angkatan</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Kelas */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-xl">Buat Kelas Baru</CardTitle>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsClassModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(() => supabase.from("classes").insert({ program_id: programId, batch_id: classForm.batch_id || null, code: classForm.code.trim(), name: classForm.name.trim(), capacity: classForm.capacity ? Number(classForm.capacity) : null, teacher_user_id: classForm.teacher_user_id || null }), "Kelas berhasil dibuat."); setClassForm(emptyClass); setIsClassModalOpen(false); }}>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Angkatan (Opsional)</label>
                  <select className="field-control" value={classForm.batch_id} onChange={e => setClassForm(c => ({ ...c, batch_id: e.target.value }))}>
                    <option value="">-- Pilih Angkatan --</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Kode Kelas</label>
                    <Input placeholder="KLS-A" required value={classForm.code} onChange={e => setClassForm(c => ({ ...c, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Kapasitas</label>
                    <Input placeholder="Max peserta" type="number" value={classForm.capacity} onChange={e => setClassForm(c => ({ ...c, capacity: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Nama Kelas</label>
                  <Input placeholder="Contoh: Kelas A" required value={classForm.name} onChange={e => setClassForm(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Pengajar Utama</label>
                  <select className="field-control" value={classForm.teacher_user_id} onChange={e => setClassForm(c => ({ ...c, teacher_user_id: e.target.value }))}>
                    <option value="">-- Pilih Pengajar --</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>)}
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsClassModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Tambahkan Kelas</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Halaqah */}
      {isHalaqahModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-xl">Buat Halaqah / Kelompok</CardTitle>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsHalaqahModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(() => supabase.from("halaqahs").insert({ class_id: halaqahForm.class_id, code: halaqahForm.code.trim(), name: halaqahForm.name.trim(), capacity: halaqahForm.capacity ? Number(halaqahForm.capacity) : null, mentor_user_id: halaqahForm.mentor_user_id || null }), "Halaqah berhasil dibuat."); setHalaqahForm(emptyHalaqah); setIsHalaqahModalOpen(false); }}>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Kelas <span className="text-red-500">*</span></label>
                  <select className="field-control" required value={halaqahForm.class_id} onChange={e => setHalaqahForm(c => ({ ...c, class_id: e.target.value }))}>
                    <option value="">-- Pilih Kelas --</option>
                    {classes.map(cl => <option key={cl.id} value={cl.id}>{cl.code} - {cl.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Kode Halaqah</label>
                    <Input placeholder="HLQ-01" required value={halaqahForm.code} onChange={e => setHalaqahForm(c => ({ ...c, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Kapasitas</label>
                    <Input placeholder="Max" type="number" value={halaqahForm.capacity} onChange={e => setHalaqahForm(c => ({ ...c, capacity: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Nama Halaqah</label>
                  <Input placeholder="Contoh: Kelompok Abu Bakar" required value={halaqahForm.name} onChange={e => setHalaqahForm(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Mentor / Pendamping</label>
                  <select className="field-control" value={halaqahForm.mentor_user_id} onChange={e => setHalaqahForm(c => ({ ...c, mentor_user_id: e.target.value }))}>
                    <option value="">-- Pilih Mentor --</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>)}
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsHalaqahModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Tambahkan Halaqah</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Tahapan */}
      {isLevelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-xl">Buat Tahapan Baru</CardTitle>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsLevelModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(() => supabase.from("levels").insert({ program_id: programId, parent_level_id: null, code: levelForm.code.trim(), name: levelForm.name.trim(), order_no: Number(levelForm.order_no || 0) }), "Tahapan berhasil dibuat."); setLevelForm(emptyLevel); setIsLevelModalOpen(false); }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Kode</label>
                    <Input placeholder="Contoh: DASAR" required value={levelForm.code} onChange={e => setLevelForm(c => ({ ...c, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Urutan</label>
                    <Input placeholder="1" type="number" value={levelForm.order_no} onChange={e => setLevelForm(c => ({ ...c, order_no: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Nama Tahapan</label>
                  <Input placeholder="Contoh: Level 1 Dasar" required value={levelForm.name} onChange={e => setLevelForm(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsLevelModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Tambahkan Tahapan</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Mata Pelajaran */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-xl">{editingModuleId ? "Edit Mata Pelajaran" : "Buat Mata Pelajaran"}</CardTitle>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => { setIsModuleModalOpen(false); setEditingModuleId(null); setModuleForm(emptyModule); }}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={(e) => {
                e.preventDefault();
                if (editingModuleId) {
                  void submit(() => supabase.from("program_modules").update({ parent_module_id: moduleForm.parent_module_id || null, level_id: moduleForm.level_id || null, code: moduleForm.code.trim(), title: moduleForm.title.trim(), order_no: Number(moduleForm.order_no || 0) }).eq("id", editingModuleId), "Mata Pelajaran berhasil diperbarui.");
                  setEditingModuleId(null);
                } else {
                  void submit(() => supabase.from("program_modules").insert({ program_id: programId, parent_module_id: moduleForm.parent_module_id || null, level_id: moduleForm.level_id || null, code: moduleForm.code.trim(), title: moduleForm.title.trim(), order_no: Number(moduleForm.order_no || 0) }), "Mata Pelajaran berhasil dibuat.");
                }
                setModuleForm(emptyModule);
                setIsModuleModalOpen(false);
              }}>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Tahapan (Opsional)</label>
                  <select className="field-control" value={moduleForm.level_id} onChange={e => setModuleForm(c => ({ ...c, level_id: e.target.value }))}>
                    <option value="">-- Pilih Tahapan --</option>
                    {levels.map(l => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Kode</label>
                    <Input placeholder="THD-1" required value={moduleForm.code} onChange={e => setModuleForm(c => ({ ...c, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Urutan</label>
                    <Input placeholder="1" type="number" value={moduleForm.order_no} onChange={e => setModuleForm(c => ({ ...c, order_no: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Judul Mata Pelajaran</label>
                  <Input placeholder="Contoh: Pengantar Tauhid" required value={moduleForm.title} onChange={e => setModuleForm(c => ({ ...c, title: e.target.value }))} />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => { setIsModuleModalOpen(false); setEditingModuleId(null); setModuleForm(emptyModule); }}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">{editingModuleId ? "Simpan Perubahan" : "Tambahkan Mata Pelajaran"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════ UNIFIED LESSON MODAL ═══════════════ */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-xl flex items-center gap-2 text-primary">
                <Presentation className="h-5 w-5" />
                {editingLessonId
                  ? (lessonModalMode === "kuis" ? "Edit Kuis / Ujian" : "Edit Pertemuan / Materi")
                  : (lessonModalMode === "kuis" ? "Buat Kuis / Ujian Baru" : "Buat Pertemuan / Materi Baru")}
              </CardTitle>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsLessonModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-5" onSubmit={handleLessonSubmit}>
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">{lessonModalMode === "kuis" ? "Judul Kuis / Ujian" : "Judul Materi"} <span className="text-red-500">*</span></label>
                  <Input placeholder={lessonModalMode === "kuis" ? "Contoh: Ujian Akhir Semester" : "Contoh: Pengantar Tauhid - Pertemuan 1"} required value={lessonForm.title} onChange={e => setLessonForm(c => ({ ...c, title: e.target.value }))} className="h-11" />
                </div>

                {/* Type & Status */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">{lessonModalMode === "kuis" ? "Tipe Evaluasi" : "Tipe Pertemuan"}</label>
                    <select className="field-control h-11" value={lessonForm.lesson_type} onChange={e => setLessonForm(c => ({ ...c, lesson_type: e.target.value }))}>
                      {lessonModalMode === "materi" ? (
                        <>
                          <option value="content">📖 Materi Pembelajaran</option>
                          <option value="live_session">🎥 Sesi Live</option>
                          <option value="assignment">📝 Tugas</option>
                        </>
                      ) : (
                        <>
                          <option value="quiz">✍️ Kuis Harian</option>
                          <option value="exam">🏆 Ujian</option>
                        </>
                      )}
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
                ) : lessonModalMode === "kuis" ? (
                  <div className="space-y-4 p-5 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl border border-orange-100 dark:border-orange-900/50">
                    <label className="text-sm font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <BookOpen className="h-4 w-4" /> Pengaturan Nilai & Evaluasi
                    </label>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Passing Grade (Nilai Kelulusan)</label>
                        <Input
                          type="number"
                          placeholder="Misal: 70"
                          value={lessonForm.passing_grade}
                          onChange={e => setLessonForm(c => ({ ...c, passing_grade: e.target.value }))}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Durasi (Menit)</label>
                        <Input
                          type="number"
                          placeholder="Kosong = Tanpa Batas"
                          value={lessonForm.duration_minutes}
                          onChange={e => setLessonForm(c => ({ ...c, duration_minutes: e.target.value }))}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Batas Percobaan Ulang</label>
                        <Input
                          type="number"
                          placeholder="Kosong = Tanpa Batas"
                          value={lessonForm.max_attempts}
                          onChange={e => setLessonForm(c => ({ ...c, max_attempts: e.target.value }))}
                          className="h-11"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-2 bg-orange-100/50 p-2 rounded">
                      💡 <strong>Kelola Soal:</strong> Setelah kuis ini disimpan, Anda dapat mengklik tombol <strong>Kelola Soal</strong> di daftar materi untuk membuat soal secara manual atau mengimpor dari Bank Soal.
                    </p>
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
                  <Button disabled={isSubmitting} type="submit" className={`px-8 shadow-md ${lessonModalMode === "kuis" ? "bg-orange-600 hover:bg-orange-700" : ""}`}>
                    {isSubmitting ? "Menyimpan..." : editingLessonId ? "Simpan Perubahan" : (lessonModalMode === "kuis" ? "Simpan Kuis" : "Simpan Materi")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Modal Buat Soal Sendiri (Digunakan di Kuis dan Bank Soal) */}
      {isCreateQuestionModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-xl">Buat Soal Baru</CardTitle>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsCreateQuestionModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={submitQuestion}>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Teks Soal / Pertanyaan <span className="text-red-500">*</span></label>
                  <textarea className="field-control min-h-[100px]" required placeholder="Masukkan pertanyaan..." value={questionForm.question_text} onChange={e => setQuestionForm(c => ({ ...c, question_text: e.target.value }))} />
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm font-semibold block">Pilihan Jawaban</label>
                  <div className="grid gap-3">
                    {["A", "B", "C", "D"].map(opt => (
                      <div key={opt} className="flex gap-3 items-center">
                        <div className="flex items-center gap-2">
                          <input type="radio" name="correct_option" value={opt} checked={questionForm.correct_option === opt} onChange={e => setQuestionForm(c => ({ ...c, correct_option: e.target.value }))} className="w-4 h-4" />
                          <span className="font-bold">{opt}.</span>
                        </div>
                        <Input
                          required
                          placeholder={`Pilihan ${opt}`}
                          value={(questionForm as any)[`opt${opt}`]}
                          onChange={e => setQuestionForm(c => ({ ...c, [`opt${opt}`]: e.target.value }))}
                          className={questionForm.correct_option === opt ? "border-primary/50 bg-primary/5" : ""}
                        />
                        {questionForm.correct_option === opt && <span className="text-xs text-primary font-medium w-24 shrink-0">Jawaban Benar</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1 block">Penjelasan (Opsional)</label>
                  <textarea className="field-control min-h-[80px]" placeholder="Penjelasan kenapa jawaban tersebut benar..." value={questionForm.explanation} onChange={e => setQuestionForm(c => ({ ...c, explanation: e.target.value }))} />
                </div>
                
                <div>
                  <label className="text-sm font-semibold mb-1 block">Bobot Nilai (Points)</label>
                  <Input type="number" required value={questionForm.points} onChange={e => setQuestionForm(c => ({ ...c, points: Number(e.target.value) }))} className="w-32" />
                  <p className="text-xs text-muted-foreground mt-1">Bobot standar adalah 10. Bisa diubah jika soal ini lebih sulit.</p>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsCreateQuestionModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Simpan Soal</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Kelola Butir Soal (Bank Soal) */}
      {isManageBankItemsModalOpen && managingBankId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4 shrink-0">
              <div>
                <CardTitle className="text-xl">Kelola Butir Soal: {questionBanks.find(b => b.id === managingBankId)?.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Total {bankItems.length} soal tersimpan di bank ini.</p>
              </div>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => { setIsManageBankItemsModalOpen(false); setManagingBankId(null); }}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto flex-1 bg-muted/10">
              <div className="flex gap-4 mb-6">
                <Button className="shadow-sm" onClick={() => { setQuestionTarget("bank"); setQuestionForm(emptyQuestion); setIsCreateQuestionModalOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Buat Soal Baru
                </Button>
              </div>

              {bankItems.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground border rounded-lg border-dashed bg-background">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Belum ada soal di Bank Soal ini.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bankItems.map((q, i) => (
                    <Card key={q.id}>
                      <div className="flex gap-4 p-4">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold">{i + 1}</div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-foreground mb-3">{q.question_text}</p>
                          <div className="space-y-2">
                            {(q.options || []).map((opt: string, idx: number) => (
                              <div key={idx} className={`p-2 border rounded-md text-sm ${opt === q.correct_answer ? "bg-emerald-50 border-emerald-200 font-medium" : "bg-muted/30"}`}>
                                {String.fromCharCode(65 + idx)}. {opt}
                                {opt === q.correct_answer && <span className="float-right text-emerald-600 text-xs">Jawaban Benar</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" onClick={() => submit(async () => { await supabase.from("question_bank_items").delete().eq("id", q.id); const { data } = await supabase.from("question_bank_items").select("*").eq("question_bank_id", managingBankId).order("created_at"); setBankItems(data || []); return {error: null}; }, "Soal dihapus.")}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Ambil dari Bank Soal (ke Kuis) */}
      {isBankSelectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4 shrink-0">
              <div>
                <CardTitle className="text-xl">Pilih Soal dari Bank</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Pilih soal yang ingin disalin ke kuis ini.</p>
              </div>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsBankSelectModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto flex-1 bg-muted/10">
              {allBankItems.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground border rounded-lg border-dashed bg-background">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Tidak ada soal di Bank Soal manapun untuk program ini.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allBankItems.map(q => (
                    <Card key={q.id} className={`cursor-pointer transition-colors ${selectedBankItems[q.id] ? "border-primary bg-primary/5" : ""}`} onClick={() => setSelectedBankItems(prev => ({ ...prev, [q.id]: !prev[q.id] }))}>
                      <div className="flex gap-4 p-4 items-center">
                        <input type="checkbox" className="w-5 h-5 shrink-0" checked={!!selectedBankItems[q.id]} readOnly />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground line-clamp-2">{q.question_text}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> {q.question_banks?.name} 
                            <span className="opacity-50">•</span> 
                            <span className="truncate">{q.question_banks?.programs?.title || "Program"}</span>
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
            <div className="p-4 border-t flex justify-between items-center bg-background shrink-0">
              <span className="text-sm font-medium">{Object.values(selectedBankItems).filter(Boolean).length} soal dipilih</span>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsBankSelectModalOpen(false)}>Batal</Button>
                <Button disabled={isSubmitting || Object.values(selectedBankItems).filter(Boolean).length === 0} onClick={submitImportBank}>Impor ke Kuis</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {/* Removed Pendaftaran Tab */}

      {/* ═══════════════ TAB: INFO PESERTA ═══════════════ */}
      {activeTab === "peserta" && (
        <ProgramParticipants programId={program.id} />
      )}

      {/* ═══════════════ TAB: SILABUS ═══════════════ */}
      {activeTab === "silabus" && (
        <Card>
          <CardHeader>
            <CardTitle>Silabus Program</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tuliskan silabus, materi pembelajaran, tata tertib, atau deskripsi panjang terkait program ini. 
              Peserta dapat membaca informasi ini sebelum dan sesudah mereka mendaftar di Katalog Program.
            </p>
            <textarea
              className="w-full min-h-[400px] p-4 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono resize-y"
              placeholder="Tuliskan isi silabus di sini..."
              value={syllabusForm}
              onChange={(e) => setSyllabusForm(e.target.value)}
            />
            <div className="flex justify-end">
              <Button onClick={handleSaveSyllabus} disabled={isSavingSyllabus}>
                {isSavingSyllabus ? "Menyimpan..." : "Simpan Silabus"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════ TAB: KELULUSAN ═══════════════ */}
      {activeTab === "kelulusan" && (
        <Card>
          <CardHeader>
            <CardTitle>Rubrik Kelulusan & Predikat</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Atur rentang nilai dan predikat kelulusan (contoh: Mumtaz, Jayyid) untuk laporan akademik akhir peserta.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/30 border rounded-lg p-4">
              <div className="grid grid-cols-12 gap-4 font-semibold text-sm mb-3 px-2">
                <div className="col-span-3">Minimal Nilai</div>
                <div className="col-span-3">Maksimal Nilai</div>
                <div className="col-span-5">Predikat / Label</div>
                <div className="col-span-1"></div>
              </div>
              
              <div className="space-y-3">
                {gradingRubricForm.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.1"
                        value={item.min_score}
                        onChange={(e) => {
                          const newForm = [...gradingRubricForm];
                          newForm[idx].min_score = Number(e.target.value);
                          setGradingRubricForm(newForm);
                        }}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.1"
                        value={item.max_score}
                        onChange={(e) => {
                          const newForm = [...gradingRubricForm];
                          newForm[idx].max_score = Number(e.target.value);
                          setGradingRubricForm(newForm);
                        }}
                      />
                    </div>
                    <div className="col-span-5">
                      <Input
                        value={item.label}
                        onChange={(e) => {
                          const newForm = [...gradingRubricForm];
                          newForm[idx].label = e.target.value;
                          setGradingRubricForm(newForm);
                        }}
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          const newForm = [...gradingRubricForm];
                          newForm.splice(idx, 1);
                          setGradingRubricForm(newForm);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="mt-4 w-full border-dashed"
                onClick={() => setGradingRubricForm([...gradingRubricForm, { min_score: 0, max_score: 0, label: "" }])}
              >
                <Plus className="h-4 w-4 mr-2" /> Tambah Rentang Nilai
              </Button>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSaveRubric} disabled={isSavingRubric}>
                {isSavingRubric ? "Menyimpan..." : "Simpan Rubrik"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}