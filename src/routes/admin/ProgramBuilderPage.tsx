import { type ComponentType, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  ExternalLink,
  FileText,
  Info,
  Layers,
  Library,
  PlayCircle,
  Plus,
  Presentation,
  Trash2,
  Trophy,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";
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
import { inferFileCategory, requestSignedUploadUrl } from "../../lib/documents";
import type { Program } from "../../lib/organization";
import { parseQuizImport, type ParsedImportQuestion, type QuizQuestionType } from "../../lib/quiz";
import { supabase } from "../../lib/supabase";
import { ProgramParticipants } from "./ProgramParticipants";
import { ProgramDetailSection } from "./ProgramDetailSection";
import { ProgramGraduationSection } from "./ProgramGraduationSection";
import { ProgramSyllabusSection } from "./ProgramSyllabusSection";

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
  visibility_status: "published" as LessonVisibilityStatus,
  content_body: "",
  external_url: "",
  passing_grade: "",
  duration_minutes: "",
  max_attempts: "",
  is_strict_mode: false,
  max_tab_switches: "3",
  randomized_questions_count: ""
};
const emptyQuestion = {
  question_type: "multiple_choice" as QuizQuestionType,
  question_text: "",
  optA: "",
  optB: "",
  optC: "",
  optD: "",
  correct_option: "A",
  explanation: "",
  grading_guide: "",
  points: 10,
};

type MaterialLinkDraft = {
  id: string;
  label: string;
  url: string;
  category: DocumentFile["file_category"];
};

type UploadPreview = {
  name: string;
  url: string;
};

type ProgramTab = "info" | "kurikulum" | "peserta" | "angkatan" | "bank_soal" | "silabus" | "kelulusan";
type ProgramTabItem = {
  key: ProgramTab;
  label: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  count?: number;
};

const programTabSegments: Record<ProgramTab, string> = {
  info: "detail-program",
  silabus: "silabus",
  kurikulum: "kurikulum",
  angkatan: "angkatan-kelas",
  bank_soal: "bank-soal",
  peserta: "peserta",
  kelulusan: "kelulusan",
};

const programSegmentTabs = Object.entries(programTabSegments).reduce<Record<string, ProgramTab>>((acc, [tab, segment]) => {
  acc[segment] = tab as ProgramTab;
  return acc;
}, {});

const programStatusMeta = {
  active: { label: "Aktif", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  draft: { label: "Draft", className: "border-amber-200 bg-amber-50 text-amber-700" },
  archived: { label: "Diarsipkan", className: "border-slate-200 bg-slate-100 text-slate-700" },
};

const createMaterialLinkDraft = (): MaterialLinkDraft => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  label: "",
  url: "",
  category: "link",
});

const getMaterialCategoryLabel = (category: DocumentFile["file_category"]) => {
  switch (category) {
    case "video": return "Video";
    case "audio": return "Audio";
    case "pdf": return "PDF";
    case "document": return "Dokumen";
    case "link": return "Link";
    default: return "Lainnya";
  }
};

const getCurriculumLabel = (model: string) => model === "angkatan" ? "Terjadwal (Angkatan)" : "Mandiri (Evergreen)";

const getProgramTabFromSegment = (segment?: string): ProgramTab => {
  if (!segment) return "info";
  return programSegmentTabs[segment] ?? "info";
};

/* ───────────────── Component ───────────────── */

export function ProgramBuilderPage() {
  const { programId, section } = useParams<{ programId: string; section?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
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
  const activeTab = getProgramTabFromSegment(section);
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ParsedImportQuestion[]>([]);
  const [importQuestionType, setImportQuestionType] = useState<QuizQuestionType>("multiple_choice");
  const [selectedBankItems, setSelectedBankItems] = useState<Record<string, boolean>>({});

  const [bankForm, setBankForm] = useState({ name: "", description: "" });
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [materialLinks, setMaterialLinks] = useState<MaterialLinkDraft[]>([createMaterialLinkDraft()]);
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [uploadPreviewUrls, setUploadPreviewUrls] = useState<UploadPreview[]>([]);
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
    const previews = selectedUploadFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setUploadPreviewUrls(previews);

    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [selectedUploadFiles]);

  /* ── Loader Functions ── */
  const parseQuestionsText = (text: string, type = importQuestionType) => {
    setImportPreview(parseQuizImport(text, type));
  };

  const handleBulkImport = async () => {
    if (!managingBankId) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    
    const validQuestions = importPreview.filter(q => q.isValid);
    if (validQuestions.length === 0) {
      setIsSubmitting(false);
      return;
    }
    
    const insertData = validQuestions.map(q => {
      const ops = q.options.map((opt) => opt.text);
      const correctAnswerText = q.options.find((opt) => opt.label === q.correct_answer)?.text || null;

      return {
        question_bank_id: managingBankId,
        question_type: q.question_type,
        question_text: q.question_text,
        options: ops,
        correct_answer: q.question_type === "essay" ? null : correctAnswerText,
        grading_guide: q.grading_guide || null,
        points: q.points,
      };
    });
    
    const { error } = await supabase.from("question_bank_items").insert(insertData);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage(`${validQuestions.length} soal berhasil diimpor.`);
      setIsImportModalOpen(false);
      setImportText("");
      setImportPreview([]);
      // await loadBankItems(managingBankId);
    }
    setIsSubmitting(false);
  };

  /* ── Data Loading ── */
  const loadData = useCallback(async () => {
    if (!programId) return;
    setIsLoading(true);
    setErrorMessage(null);

    const [
      programResult,
      batchResult,
      classResult,
      halaqahResult,
      levelResult,
      moduleResult,
      lessonResult,
      docResult,
      staffResult,
      bankResult,
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

    const firstError =
      programResult.error ||
      batchResult.error ||
      classResult.error ||
      halaqahResult.error ||
      levelResult.error ||
      moduleResult.error ||
      lessonResult.error ||
      docResult.error ||
      staffResult.error ||
      bankResult.error;

    if (firstError) {
      setErrorMessage(`Gagal memuat detail program: ${firstError.message}`);
    }

    const prog = programResult.data;
    const batchRows = batchResult.data;
    const classRows = classResult.data;
    const halaqahRows = halaqahResult.data;
    const levelRows = levelResult.data;
    const moduleRows = moduleResult.data;
    const lessonRows = lessonResult.data;
    const docRows = docResult.data;
    const staffRows = staffResult.data;
    const bankRows = bankResult.data;

    if (prog) {
      setProgram(prog as unknown as Program);
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
  }, [programId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const programBasePath = useMemo(() => {
    if (!programId) return location.pathname;
    const marker = `/program/${programId}`;
    const markerIndex = location.pathname.indexOf(marker);
    if (markerIndex === -1) return location.pathname;
    return `${location.pathname.slice(0, markerIndex)}${marker}`;
  }, [location.pathname, programId]);

  const getProgramSectionPath = useCallback((tab: ProgramTab) => {
    return `${programBasePath}/${programTabSegments[tab]}`;
  }, [programBasePath]);

  const navigateToProgramTab = useCallback((tab: ProgramTab, options?: { replace?: boolean }) => {
    navigate(getProgramSectionPath(tab), { replace: options?.replace ?? false });
  }, [getProgramSectionPath, navigate]);

  useEffect(() => {
    if (!programId) return;
    const isKnownSection = !section || Boolean(programSegmentTabs[section]);
    if (!isKnownSection) {
      navigateToProgramTab("info", { replace: true });
      return;
    }
    if (!section) {
      navigateToProgramTab("info", { replace: true });
      return;
    }
    if (program && activeTab === "angkatan" && program.curriculum_model !== "angkatan") {
      navigateToProgramTab("kurikulum", { replace: true });
    }
  }, [activeTab, navigateToProgramTab, program, programId, section]);

  /* ── Derived data ── */
  const classScopedHalaqahs = halaqahs;
  const moduleTree = useMemo(
    () => modules.map((m) => ({
      module: m,
      lessons: lessons.filter((l) => l.module_id === m.id).sort((a, b) => a.order_no - b.order_no),
    })),
    [lessons, modules],
  );

  const programSummary = useMemo(() => {
    const publishedLessons = lessons.filter((lesson) => lesson.visibility_status === "published").length;
    const quizLessons = lessons.filter((lesson) => lesson.lesson_type === "quiz" || lesson.lesson_type === "exam").length;

    return {
      modules: modules.length,
      lessons: lessons.length,
      publishedLessons,
      quizLessons,
      batches: batches.length,
      classes: classes.length,
      halaqahs: halaqahs.length,
      questionBanks: questionBanks.length,
    };
  }, [batches.length, classes.length, halaqahs.length, lessons, modules.length, questionBanks.length]);

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
      lesson_type: mode === "kuis" ? "quiz" : "content",
      duration_minutes: mode === "kuis" ? "" : "60",
    });
    setEditingLessonId(null);
    setMaterialLinks([createMaterialLinkDraft()]);
    setSelectedUploadFiles([]);
    setIsLessonModalOpen(true);
  };

  const editLesson = (lesson: Lesson) => {
    setLessonModalMode(lesson.lesson_type === "quiz" || lesson.lesson_type === "exam" ? "kuis" : "materi");
    const externalDocs = documentFiles.filter(d => d.lesson_id === lesson.id && d.source_type === "external_link");
    const drafts = externalDocs.map((doc) => ({
      id: doc.id,
      label: doc.display_name,
      url: doc.external_url || "",
      category: doc.file_category,
    }));
    if (lesson.external_url && !drafts.some((draft) => draft.url === lesson.external_url)) {
      drafts.unshift({
        id: `legacy-${lesson.id}`,
        label: "Link utama",
        url: lesson.external_url,
        category: inferFileCategory(undefined, lesson.external_url) as DocumentFile["file_category"],
      });
    }
    setMaterialLinks(drafts.length > 0 ? drafts : [createMaterialLinkDraft()]);
    setSelectedUploadFiles([]);
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
      max_attempts: lesson.max_attempts?.toString() || "",
      is_strict_mode: lesson.is_strict_mode || false,
      max_tab_switches: lesson.max_tab_switches?.toString() || "3",
      randomized_questions_count: lesson.randomized_questions_count?.toString() || "0"
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
    const { data } = await supabase.from("question_bank_items").select("*, question_banks!inner(name, programs(name))");
    setAllBankItems(data || []);
    setSelectedBankItems({});
    setIsBankSelectModalOpen(true);
  };

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEssay = questionForm.question_type === "essay";
    const opts = isEssay ? [] : [questionForm.optA, questionForm.optB, questionForm.optC, questionForm.optD].filter(o => o.trim() !== "");
    let correct = questionForm.optA;
    if (questionForm.correct_option === "B") correct = questionForm.optB;
    if (questionForm.correct_option === "C") correct = questionForm.optC;
    if (questionForm.correct_option === "D") correct = questionForm.optD;

    if (questionTarget === "quiz" && managingLesson) {
      await submit(async () => {
        const payload = {
          lesson_id: managingLesson.id,
          question_type: questionForm.question_type,
          question_text: questionForm.question_text,
          options: opts,
          correct_answer: isEssay ? null : correct,
          explanation: questionForm.explanation || null,
          grading_guide: isEssay ? questionForm.grading_guide || null : null,
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
          question_type: questionForm.question_type,
          question_text: questionForm.question_text,
          options: opts,
          correct_answer: isEssay ? null : correct,
          explanation: questionForm.explanation || null,
          grading_guide: isEssay ? questionForm.grading_guide || null : null,
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
      grading_guide: item.grading_guide,
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
  const getLessonSources = (lessonId: string) =>
    documentFiles
      .filter((doc) => doc.lesson_id === lessonId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const addMaterialLink = () => {
    setMaterialLinks((current) => [...current, createMaterialLinkDraft()]);
  };

  const updateMaterialLink = (id: string, patch: Partial<MaterialLinkDraft>) => {
    setMaterialLinks((current) => current.map((link) => (link.id === id ? { ...link, ...patch } : link)));
  };

  const removeMaterialLink = (id: string) => {
    setMaterialLinks((current) => {
      const next = current.filter((link) => link.id !== id);
      return next.length > 0 ? next : [createMaterialLinkDraft()];
    });
  };

  const removeSelectedUploadFile = (fileName: string) => {
    setSelectedUploadFiles((current) => current.filter((file) => file.name !== fileName));
  };

  const deleteMaterialSource = async (doc: DocumentFile) => {
    if (!window.confirm(`Hapus sumber materi "${doc.display_name}"?`)) return;

    const { error } = await supabase.from("document_files").delete().eq("id", doc.id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setDocumentFiles((current) => current.filter((item) => item.id !== doc.id));
    setMessage("Sumber materi berhasil dihapus.");
  };

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
  const renderFilePreview = (filename: string, url = "") => {
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

    if (lessonForm.lesson_type === "live_session" && !lessonForm.external_url.trim()) {
      setErrorMessage("Link meeting wajib diisi untuk sesi live.");
      setIsSubmitting(false);
      return;
    }

    if (lessonForm.lesson_type === "live_session" && !lessonForm.release_at) {
      setErrorMessage("Tanggal dan waktu mulai wajib diisi untuk sesi live.");
      setIsSubmitting(false);
      return;
    }

    if ((lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam") && lessonForm.passing_grade) {
      const passingGrade = Number(lessonForm.passing_grade);
      if (Number.isNaN(passingGrade) || passingGrade < 0 || passingGrade > 100) {
        setErrorMessage("Passing grade harus berada di rentang 0 sampai 100.");
        setIsSubmitting(false);
        return;
      }
    }

    const autoCode = `MTR-${Date.now().toString(36).toUpperCase()}`;
    const cleanedMaterialLinks = materialLinks
      .map((link) => ({
        ...link,
        label: link.label.trim(),
        url: link.url.trim(),
      }))
      .filter((link) => link.url.length > 0);
    const primaryExternalUrl = lessonForm.lesson_type === "live_session"
      ? lessonForm.external_url.trim() || null
      : cleanedMaterialLinks[0]?.url ?? null;
    const payload = {
      module_id: lessonForm.module_id,
      code: editingLessonId ? lessonForm.code : autoCode,
      title: lessonForm.title.trim(),
      lesson_type: lessonForm.lesson_type,
      order_no: Number(lessonForm.order_no || 0),
      release_at: lessonForm.release_at ? new Date(lessonForm.release_at).toISOString() : null,
      visibility_status: lessonForm.visibility_status,
      content_body: lessonForm.content_body.trim() || null,
      external_url: primaryExternalUrl,
      passing_grade: lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam" ? (lessonForm.passing_grade ? Number(lessonForm.passing_grade) : null) : null,
      duration_minutes: lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam" || lessonForm.lesson_type === "live_session" ? (lessonForm.duration_minutes ? Number(lessonForm.duration_minutes) : null) : null,
      max_attempts: lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam" ? (lessonForm.max_attempts ? Number(lessonForm.max_attempts) : null) : null,
      is_strict_mode: lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam" ? lessonForm.is_strict_mode : false,
      max_tab_switches: lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam" ? Number(lessonForm.max_tab_switches || 3) : 3,
      randomized_questions_count: lessonForm.lesson_type === "quiz" || lessonForm.lesson_type === "exam" ? (lessonForm.randomized_questions_count ? Number(lessonForm.randomized_questions_count) : null) : null,
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

    if (lessonForm.lesson_type !== "live_session" && lessonModalMode !== "kuis") {
      const { error: deleteLinkError } = await supabase
        .from("document_files")
        .delete()
        .eq("lesson_id", lessonIdToUse)
        .eq("source_type", "external_link");

      if (deleteLinkError) {
        setErrorMessage(deleteLinkError.message);
        setIsSubmitting(false);
        return;
      }

      if (cleanedMaterialLinks.length > 0) {
        const { error: linkError } = await supabase.from("document_files").insert(
          cleanedMaterialLinks.map((link) => ({
            lesson_id: lessonIdToUse,
            source_type: "external_link",
            storage_provider: "external",
            external_url: link.url,
            display_name: link.label || link.url,
            file_category: link.category,
            access_level: "enrolled",
            status: "active",
            uploaded_by: user?.id || null,
          })),
        );

        if (linkError) {
          setErrorMessage(linkError.message);
          setIsSubmitting(false);
          return;
        }
      }
    }

    // Handle file uploads to S3. Each new file is appended as an additional source.
    if (selectedUploadFiles.length > 0) {
      try {
        for (const file of selectedUploadFiles) {
          const { signedUrl, bucket, objectKey } = await requestSignedUploadUrl({ lessonId: lessonIdToUse, file });
          const uploadRes = await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
          if (!uploadRes.ok) throw new Error("Gagal mengunggah file ke S3 Contabo");

          const { error: fileError } = await supabase.from("document_files").insert({
            lesson_id: lessonIdToUse,
            source_type: "object_storage",
            storage_provider: "contabo_s3",
            bucket_name: bucket,
            object_key: objectKey,
            display_name: file.name,
            mime_type: file.type || null,
            file_size_bytes: file.size,
            file_category: inferFileCategory(file.type, file.name),
            access_level: "enrolled",
            status: "active",
            uploaded_by: user?.id || null,
          });

          if (fileError) throw fileError;
        }
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
    setMaterialLinks([createMaterialLinkDraft()]);
    setSelectedUploadFiles([]);
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
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Program tidak ditemukan atau Anda tidak memiliki akses.</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(-1)} variant="outline" className="h-10 w-fit whitespace-nowrap !text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
      </div>
    );
  }

  const statusMeta = programStatusMeta[program.status] ?? programStatusMeta.draft;
  const programTabs: ProgramTabItem[] = [
    { key: "info", label: "Detail Program", desc: "Profil, publikasi, dan kesiapan", icon: Info },
    { key: "silabus", label: "Silabus", desc: "Dokumen akademik dan capaian", icon: FileText },
    { key: "kurikulum", label: "Kurikulum", desc: "Tahapan, modul, dan materi", icon: Layers, count: programSummary.lessons },
    ...(program.curriculum_model === "angkatan"
      ? [{ key: "angkatan" as const, label: "Angkatan & Kelas", desc: "Batch, kelas, dan halaqah", icon: CalendarDays, count: programSummary.classes + programSummary.halaqahs }]
      : []),
    { key: "bank_soal", label: "Bank Soal", desc: "Repositori soal program", icon: Library, count: programSummary.questionBanks },
    { key: "peserta", label: "Peserta", desc: "Direktori peserta program", icon: Users },
    { key: "kelulusan", label: "Kelulusan", desc: "Kriteria, antrean, dan penetapan hasil", icon: Trophy },
  ];
  const activeProgramTab = programTabs.find((tab) => tab.key === activeTab) ?? programTabs[0];
  const sectionStats = [
    { label: "Modul", value: programSummary.modules },
    { label: "Materi", value: programSummary.lessons },
    { label: "Kelas", value: programSummary.classes },
    { label: "Bank Soal", value: programSummary.questionBanks },
  ];
  const selectedLessonModule = modules.find((module) => module.id === lessonForm.module_id);
  const lessonWorkflowSteps = lessonModalMode === "kuis"
    ? [
        "Tentukan judul dan tipe evaluasi",
        "Atur kelulusan, durasi, percobaan, dan anti-cheat",
        "Simpan lalu kelola butir soal dari daftar kurikulum",
      ]
    : [
        "Tentukan judul dan tipe pertemuan",
        "Tambahkan sumber belajar atau jadwal live",
        "Lengkapi deskripsi agar peserta paham konteks materi",
      ];

  return (
    <div className="page-stack w-full max-w-none">
      {/* ── Header ── */}
      <div className="page-hero flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-white/35 bg-white/15 font-mono text-white">
              {program.code}
            </Badge>
            <Badge variant="outline" className={statusMeta.className}>
              {statusMeta.label}
            </Badge>
            <Badge variant="outline" className="border-white/35 bg-white/10 text-white">
              {getCurriculumLabel(program.curriculum_model)}
            </Badge>
            <Badge variant="outline" className="border-white/35 bg-white/10 text-white capitalize">
              {program.delivery_mode}
            </Badge>
          </div>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-white">{program.name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/80">
            {program.description || "Kelola struktur program, materi, peserta, silabus, bank soal, dan kelulusan dari satu halaman detail."}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="h-10 min-w-[110px] whitespace-nowrap border-white/35 bg-white/15 !text-white hover:bg-white/25 hover:!text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
          <Button
            onClick={() => navigateToProgramTab("peserta")}
            className="h-10 min-w-[140px] whitespace-nowrap bg-white !text-primary shadow-lg hover:bg-white/90"
          >
            <Users className="h-4 w-4" />
            Kelola Peserta
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pb-3">
              <CardTitle className="text-base">Menu Program</CardTitle>
              <p className="text-xs text-muted-foreground">Pindah submenu tanpa meninggalkan detail program.</p>
            </CardHeader>
            <CardContent className="grid gap-1.5 p-2">
              {programTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => navigateToProgramTab(tab.key)}
                    className={`flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                      isActive ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{tab.label}</span>
                        <span className={`block truncate text-[11px] ${isActive ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                          {tab.desc}
                        </span>
                      </span>
                    </span>
                    {typeof tab.count === "number" && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 space-y-6">
          <ProgramSectionHeader tab={activeProgramTab} stats={sectionStats} />

      {/* ── Toast Notifications ── */}
      {(message || errorMessage) && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-sm">
          {message && (
            <div className="bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB: INFO ═══════════════ */}
      {activeTab === "info" && (
        <ProgramDetailSection
          program={program}
          summary={programSummary}
          onNavigate={(target) => navigateToProgramTab(target)}
          onProgramUpdated={setProgram}
        />
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
                          <div className="grid gap-3 border-t bg-muted/20 p-3 md:grid-cols-2">
                            <Button
                              variant="outline"
                              className="h-auto min-h-[76px] w-full justify-start gap-3 border-dashed p-4 text-left"
                              onClick={() => openCreateLessonModal(module.id, "materi")}
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <Plus className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold">Tambah Pertemuan / Materi</span>
                                <span className="block text-xs font-normal text-muted-foreground">Video, dokumen, tugas, atau sesi live.</span>
                              </span>
                            </Button>
                            <Button
                              variant="outline"
                              className="h-auto min-h-[76px] w-full justify-start gap-3 border-dashed border-orange-200 p-4 text-left text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                              onClick={() => openCreateLessonModal(module.id, "kuis")}
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                                <FileText className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold">Tambah Kuis / Ujian</span>
                                <span className="block text-xs font-normal text-orange-700/75">Atur passing grade, durasi, dan bank soal.</span>
                              </span>
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
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm text-foreground">{q.question_text}</p>
                            <Badge variant="outline">{q.question_type === "essay" ? "Esai" : "Pilihan Ganda"}</Badge>
                            <Badge variant="secondary">{q.points} poin</Badge>
                          </div>
                          {q.question_type === "essay" ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                              <span className="font-semibold">Panduan penilaian:</span> {q.grading_guide || "Belum diisi"}
                            </div>
                          ) : <div className="space-y-2">
                            {(q.options || []).map((opt: string, idx: number) => (
                              <div key={idx} className={`p-2 border rounded-md text-sm ${opt === q.correct_answer ? "bg-emerald-50 border-emerald-200 font-medium" : "bg-muted/30"}`}>
                                {String.fromCharCode(65 + idx)}. {opt}
                                {opt === q.correct_answer && <span className="float-right text-emerald-600 text-xs">Jawaban Benar</span>}
                              </div>
                            ))}
                          </div>}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50 rounded-full"><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" onClick={() => submit(async () => { const res = await supabase.from("quiz_questions").delete().eq("id", q.id); if (!res.error && managingLesson) { const { data } = await supabase.from("quiz_questions").select("*").eq("lesson_id", managingLesson.id).order("order_no"); setQuizQuestions(data || []); } return res; }, "Soal dihapus.")}><Trash2 className="h-4 w-4" /></Button>
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
          <Card className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="shrink-0 border-b bg-background/95 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className={`flex items-center gap-2 text-xl ${lessonModalMode === "kuis" ? "text-orange-700" : "text-primary"}`}>
                    {lessonModalMode === "kuis" ? <FileText className="h-5 w-5" /> : <Presentation className="h-5 w-5" />}
                    {editingLessonId
                      ? (lessonModalMode === "kuis" ? "Edit Kuis / Ujian" : "Edit Pertemuan / Materi")
                      : (lessonModalMode === "kuis" ? "Buat Kuis / Ujian Baru" : "Buat Pertemuan / Materi Baru")}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lessonModalMode === "kuis"
                      ? "Siapkan evaluasi dengan pengaturan nilai, durasi, percobaan, dan alur kelola soal."
                      : "Siapkan materi belajar, sumber konten, jadwal rilis, atau sesi live untuk peserta."}
                  </p>
                </div>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsLessonModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto p-0">
              <form className="grid lg:grid-cols-[280px_minmax(0,1fr)]" onSubmit={handleLessonSubmit}>
                <aside className="space-y-4 border-b bg-muted/25 p-5 lg:border-b-0 lg:border-r">
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Mata Pelajaran</p>
                    <p className="mt-1 text-sm font-semibold">{selectedLessonModule ? `${selectedLessonModule.code} - ${selectedLessonModule.title}` : "Belum dipilih"}</p>
                  </div>
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Workflow</p>
                    <div className="mt-3 space-y-3">
                      {lessonWorkflowSteps.map((step, index) => (
                        <div key={step} className="flex gap-3">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${lessonModalMode === "kuis" ? "bg-orange-100 text-orange-700" : "bg-primary/10 text-primary"}`}>
                            {index + 1}
                          </span>
                          <p className="text-sm leading-snug text-muted-foreground">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Status Simpan</p>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Judul</span>
                        {lessonForm.title.trim() ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Rilis</span>
                        <Badge variant="outline" className="bg-muted/40">{lessonForm.visibility_status}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{lessonModalMode === "kuis" ? "Evaluasi" : "Konten"}</span>
                        {lessonModalMode === "kuis" || lessonForm.external_url.trim() || selectedUploadFiles.length > 0 || lessonForm.content_body.trim()
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          : <AlertCircle className="h-4 w-4 text-amber-600" />}
                      </div>
                    </div>
                  </div>
                </aside>
                <div className="space-y-5 p-5">
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
                        <select className="field-control h-11" value={lessonForm.duration_minutes || "60"} onChange={e => setLessonForm(c => ({ ...c, duration_minutes: e.target.value }))}>
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
                  <div className="space-y-5 p-5 bg-primary/5 rounded-xl border border-primary/20 shadow-sm">
                    <label className="text-sm font-semibold flex items-center gap-2 text-primary">
                      <BookOpen className="h-4 w-4" /> Pengaturan Ujian & Kelulusan
                    </label>
                    <div className="grid gap-5 md:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Passing Grade (Nilai Kelulusan)</label>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="Misal: 70"
                            value={lessonForm.passing_grade}
                            onChange={e => setLessonForm(c => ({ ...c, passing_grade: e.target.value }))}
                            className="h-11 border-primary/30 focus:border-primary focus:ring-primary/20 transition-all pr-8 bg-background"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Batas Waktu (Durasi)</label>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="Bebas"
                            value={lessonForm.duration_minutes}
                            onChange={e => setLessonForm(c => ({ ...c, duration_minutes: e.target.value }))}
                            className="h-11 border-primary/30 focus:border-primary focus:ring-primary/20 transition-all pr-12 bg-background"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Menit</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Batas Percobaan Ulang</label>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="Bebas"
                            value={lessonForm.max_attempts}
                            onChange={e => setLessonForm(c => ({ ...c, max_attempts: e.target.value }))}
                            className="h-11 border-primary/30 focus:border-primary focus:ring-primary/20 transition-all pr-10 bg-background"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Kali</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Batas Soal Ditampilkan (Acak)</label>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="Semua"
                            value={lessonForm.randomized_questions_count}
                            onChange={e => setLessonForm(c => ({ ...c, randomized_questions_count: e.target.value }))}
                            className="h-11 border-primary/30 focus:border-primary focus:ring-primary/20 transition-all pr-10 bg-background"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Soal</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-5 p-4 rounded-lg border border-primary/20 bg-background shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <label className="text-sm font-semibold text-foreground">Mode Ujian Ketat (Anti-Cheat)</label>
                          <p className="text-xs text-muted-foreground mt-0.5">Mencegah peserta pindah tab, copy-paste, dan membatasi aplikasi lain. Direkomendasikan untuk ujian kelulusan.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={lessonForm.is_strict_mode}
                            onChange={(e) => setLessonForm(c => ({ ...c, is_strict_mode: e.target.checked }))}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                      
                      {lessonForm.is_strict_mode && (
                        <div className="pt-3 border-t border-primary/10 flex flex-col gap-2">
                          <label className="text-xs font-medium text-foreground">Toleransi Pindah Layar / Tab</label>
                          <div className="flex items-center gap-3">
                            <Input
                              type="number"
                              min="0"
                              placeholder="3"
                              value={lessonForm.max_tab_switches}
                              onChange={e => setLessonForm(c => ({ ...c, max_tab_switches: e.target.value }))}
                              className="h-9 w-24 border-primary/30 focus:border-primary focus:ring-primary/20 bg-background text-sm"
                            />
                            <span className="text-xs text-muted-foreground">Kali (Ujian otomatis batal jika melebihi)</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-start gap-3 mt-4 bg-primary/10 p-3 rounded-lg border border-primary/20">
                      <div className="mt-0.5 text-primary">💡</div>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        <strong>Kelola Soal:</strong> Setelah ujian/kuis ini disimpan, Anda dapat menyusun butir soal melalui tombol <strong>"Kelola Soal"</strong> yang akan muncul pada daftar modul materi.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5 p-4 bg-muted/30 rounded-xl border">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-primary" /> Sumber Materi Utama
                      </label>
                      <Badge variant="outline" className="w-fit bg-background">
                        Bisa video/audio + PDF/dokumen sekaligus
                      </Badge>
                    </div>

                    {editingLessonId && getLessonSources(editingLessonId).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sumber tersimpan</p>
                        <div className="grid gap-2">
                          {getLessonSources(editingLessonId).map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{doc.display_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {getMaterialCategoryLabel(doc.file_category)} · {doc.source_type === "external_link" ? "Link eksternal" : "File private"}
                                </p>
                              </div>
                              <Button type="button" variant="ghost" className="h-8 w-8 shrink-0 p-0 text-red-500 hover:bg-red-50" onClick={() => void deleteMaterialSource(doc)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Link sumber</p>
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={addMaterialLink}>
                          <Plus className="mr-2 h-3.5 w-3.5" /> Tambah Link
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {materialLinks.map((link, index) => (
                          <div key={link.id} className="rounded-lg border bg-background p-3 space-y-3">
                            <div className="grid gap-3 md:grid-cols-[1fr_150px_40px]">
                              <Input
                                placeholder={`Judul link ${index + 1}, misal: Video pembuka`}
                                value={link.label}
                                onChange={e => updateMaterialLink(link.id, { label: e.target.value })}
                              />
                              <select
                                className="field-control h-10"
                                value={link.category}
                                onChange={e => updateMaterialLink(link.id, { category: e.target.value as DocumentFile["file_category"] })}
                              >
                                <option value="video">Video</option>
                                <option value="audio">Audio</option>
                                <option value="pdf">PDF</option>
                                <option value="document">Dokumen</option>
                                <option value="link">Link</option>
                                <option value="other">Lainnya</option>
                              </select>
                              <Button type="button" variant="ghost" className="h-10 w-10 p-0 text-red-500 hover:bg-red-50" onClick={() => removeMaterialLink(link.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <Input
                              placeholder="Paste link YouTube, Google Drive, PDF, MP4, MP3, atau hyperlink lainnya..."
                              value={link.url}
                              onChange={e => updateMaterialLink(link.id, { url: e.target.value })}
                            />
                            {link.url && (
                              <div className="mt-2 p-2 border rounded-lg bg-muted/20">{renderUrlPreview(link.url)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upload file private</p>
                        <span className="text-xs text-muted-foreground">Video, audio, PDF, dokumen</span>
                      </div>
                      <div
                        className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Klik untuk memilih satu atau banyak file</p>
                        <p className="text-xs text-muted-foreground mt-1">File baru akan ditambahkan sebagai sumber tambahan.</p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx"
                        onChange={e => setSelectedUploadFiles(Array.from(e.target.files ?? []))}
                      />
                      {selectedUploadFiles.length > 0 && (
                        <div className="grid gap-2">
                          {selectedUploadFiles.map((file) => {
                            const preview = uploadPreviewUrls.find((item) => item.name === file.name);
                            return (
                              <div key={file.name} className="rounded-lg border bg-background p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {getMaterialCategoryLabel(inferFileCategory(file.type, file.name) as DocumentFile["file_category"])} · {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  </div>
                                  <Button type="button" variant="ghost" className="h-8 w-8 shrink-0 p-0 text-red-500 hover:bg-red-50" onClick={() => removeSelectedUploadFile(file.name)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                {preview && <div className="mt-2 p-2 border rounded-lg bg-muted/20">{renderFilePreview(file.name, preview.url)}</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
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
                <div className="sticky bottom-0 -mx-5 flex justify-end gap-3 border-t bg-background/95 px-5 pt-4 pb-1 backdrop-blur">
                  <Button type="button" variant="outline" onClick={() => setIsLessonModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit" className={`px-8 shadow-md ${lessonModalMode === "kuis" ? "bg-orange-600 hover:bg-orange-700" : ""}`}>
                    {isSubmitting ? "Menyimpan..." : editingLessonId ? "Simpan Perubahan" : (lessonModalMode === "kuis" ? "Simpan Kuis" : "Simpan Materi")}
                  </Button>
                </div>
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
                  <label className="text-sm font-semibold mb-1 block">Tipe Soal</label>
                  <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-1">
                    {([
                      ["multiple_choice", "Pilihan Ganda"],
                      ["essay", "Esai"],
                    ] as const).map(([value, label]) => (
                      <Button
                        key={value}
                        type="button"
                        variant={questionForm.question_type === value ? "default" : "ghost"}
                        onClick={() => setQuestionForm((current) => ({ ...current, question_type: value }))}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Teks Soal / Pertanyaan <span className="text-red-500">*</span></label>
                  <textarea className="field-control min-h-[100px]" required placeholder="Masukkan pertanyaan..." value={questionForm.question_text} onChange={e => setQuestionForm(c => ({ ...c, question_text: e.target.value }))} />
                </div>
                
                {questionForm.question_type === "multiple_choice" ? <div className="space-y-3">
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
                </div> : (
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Panduan Penilaian</label>
                    <textarea
                      className="field-control min-h-[110px]"
                      placeholder="Tuliskan poin-poin jawaban ideal atau rubrik singkat untuk penilai."
                      value={questionForm.grading_guide}
                      onChange={e => setQuestionForm(c => ({ ...c, grading_guide: e.target.value }))}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Panduan hanya terlihat oleh admin/pengajar saat menilai.</p>
                  </div>
                )}

                {questionForm.question_type === "multiple_choice" && <div>
                  <label className="text-sm font-semibold mb-1 block">Penjelasan (Opsional)</label>
                  <textarea className="field-control min-h-[80px]" placeholder="Penjelasan kenapa jawaban tersebut benar..." value={questionForm.explanation} onChange={e => setQuestionForm(c => ({ ...c, explanation: e.target.value }))} />
                </div>}
                
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
                <Button variant="outline" className="shadow-sm" onClick={() => { setIsImportModalOpen(true); setImportText(""); setImportPreview([]); }}>
                  <Upload className="h-4 w-4 mr-2" /> Impor Soal (Teks)
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
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm text-foreground">{q.question_text}</p>
                            <Badge variant="outline">{q.question_type === "essay" ? "Esai" : "Pilihan Ganda"}</Badge>
                            <Badge variant="secondary">{q.points} poin</Badge>
                          </div>
                          {q.question_type === "essay" ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                              <span className="font-semibold">Panduan penilaian:</span> {q.grading_guide || "Belum diisi"}
                            </div>
                          ) : <div className="space-y-2">
                            {(q.options || []).map((opt: string, idx: number) => (
                              <div key={idx} className={`p-2 border rounded-md text-sm ${opt === q.correct_answer ? "bg-emerald-50 border-emerald-200 font-medium" : "bg-muted/30"}`}>
                                {String.fromCharCode(65 + idx)}. {opt}
                                {opt === q.correct_answer && <span className="float-right text-emerald-600 text-xs">Jawaban Benar</span>}
                              </div>
                            ))}
                          </div>}
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
                  <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border mb-2">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 shrink-0 accent-primary" 
                        checked={allBankItems.length > 0 && Object.values(selectedBankItems).filter(Boolean).length === allBankItems.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSelected: Record<string, boolean> = {};
                            allBankItems.forEach(q => newSelected[q.id] = true);
                            setSelectedBankItems(newSelected);
                          } else {
                            setSelectedBankItems({});
                          }
                        }}
                      />
                      <span className="font-semibold text-sm">Pilih Semua Soal ({allBankItems.length})</span>
                    </label>
                  </div>
                  {allBankItems.map(q => (
                    <Card key={q.id} className={`cursor-pointer transition-colors ${selectedBankItems[q.id] ? "border-primary bg-primary/5" : ""}`} onClick={() => setSelectedBankItems(prev => ({ ...prev, [q.id]: !prev[q.id] }))}>
                      <div className="flex gap-4 p-4 items-center">
                        <input type="checkbox" className="w-5 h-5 shrink-0" checked={!!selectedBankItems[q.id]} readOnly />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground line-clamp-2">{q.question_text}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> {q.question_banks?.name} 
                            <span className="opacity-50">•</span> 
                            <span className="truncate">{q.question_banks?.programs?.name || "Program"}</span>
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
        <ProgramSyllabusSection program={program} onProgramUpdated={setProgram} />
      )}

      {/* ═══════════════ TAB: KELULUSAN ═══════════════ */}
      {activeTab === "kelulusan" && (
        <ProgramGraduationSection program={program} lessons={lessons} onProgramUpdated={setProgram} />
      )}

      {/* Modal Import Soal (Bulk Text) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b flex flex-row items-center justify-between py-4 shrink-0 bg-slate-50">
              <div>
                <CardTitle className="text-xl">Impor Soal Massal (Dari Teks)</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Salin dan tempel daftar soal Anda ke kotak di bawah ini.</p>
              </div>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={() => setIsImportModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto bg-muted/10 grid grid-cols-1 md:grid-cols-2">
              <div className="p-4 border-r bg-white flex flex-col">
                <label className="text-sm font-semibold mb-2 block">Tipe Soal yang Diimpor</label>
                <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-1">
                  {([[
                    "multiple_choice",
                    "Pilihan Ganda",
                  ], ["essay", "Esai"]] as const).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={importQuestionType === value ? "default" : "ghost"}
                      onClick={() => {
                        setImportQuestionType(value);
                        parseQuestionsText(importText, value);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <label className="text-sm font-semibold mb-2 block">Teks Sumber Soal</label>
                <textarea 
                  className="w-full h-[400px] p-4 text-sm border rounded-xl focus:ring-primary focus:border-primary font-mono text-slate-700 bg-slate-50" 
                  placeholder={importQuestionType === "essay"
                    ? "1. Jelaskan makna ikhlas dalam menuntut ilmu.\nPanduan: Menjelaskan niat karena Allah dan contoh penerapannya.\nPoin: 20"
                    : "1. Apa tujuan manusia diciptakan?\nA. Mencari ilmu\nB. Beribadah\nKunci: B\nPoin: 10"}
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    parseQuestionsText(e.target.value);
                  }}
                />
                <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-100">
                  <strong>Format {importQuestionType === "essay" ? "esai" : "pilihan ganda"}:</strong><br />
                  - Awali soal dengan angka & titik (<code>1. </code>, <code>2. </code>)<br />
                  {importQuestionType === "essay" ? <>
                    - Tambahkan <code>Panduan: ...</code> sebagai rubrik penilai<br />
                    - Tambahkan <code>Poin: 10</code> untuk bobot soal
                  </> : <>
                    - Awali opsi dengan huruf (<code>A. </code>, <code>B. </code>)<br />
                    - Tambahkan <code>Kunci: [A/B/C/D]</code> dan <code>Poin: 10</code>
                  </>}
                  
                  <div className="mt-3 pt-3 border-t border-blue-200/50">
                    <a href={importQuestionType === "essay" ? "/template-impor-soal-esai.txt" : "/template-impor-soal.txt"} download className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-50 transition-colors font-medium">
                      <FileText className="w-3.5 h-3.5" />
                      Unduh Contoh Format (.txt)
                    </a>
                  </div>
                </div>
              </div>
              <div className="p-4 flex flex-col bg-slate-50 overflow-y-auto h-[500px]">
                <label className="text-sm font-semibold mb-2 block">Pratinjau Hasil Impor ({importPreview.filter(q => q.isValid).length} Valid)</label>
                {importPreview.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground border border-dashed rounded-xl bg-white">
                    Mulai mengetik/paste untuk melihat pratinjau.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {importPreview.map((q, idx) => (
                      <Card key={idx} className={`p-4 border-l-4 ${q.isValid ? 'border-l-emerald-500 shadow-sm' : 'border-l-red-500 bg-red-50'}`}>
                        <p className="font-semibold text-sm mb-2">{idx + 1}. {q.question_text}</p>
                        <div className="space-y-1 mb-3">
                          {q.options.map((opt, oidx: number) => (
                            <div key={oidx} className="text-xs flex gap-2">
                              <span className="font-bold text-slate-500">{opt.label}.</span> 
                              <span className={opt.label === q.correct_answer ? "font-semibold text-emerald-700 bg-emerald-100 px-1 rounded" : "text-slate-600"}>
                                {opt.text}
                              </span>
                            </div>
                          ))}
                        </div>
                        {q.question_type === "essay" && (
                          <div className="mb-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                            <span className="font-semibold">Panduan:</span> {q.grading_guide || "Tidak diisi"} · {q.points} poin
                          </div>
                        )}
                        {!q.isValid && (
                          <p className="text-xs text-red-600 font-medium">Format soal belum lengkap atau nilai poin tidak valid.</p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <div className="p-4 border-t flex justify-end gap-3 bg-slate-50 shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsImportModalOpen(false)}>Batal</Button>
              <Button disabled={isSubmitting || importPreview.filter(q => q.isValid).length === 0} onClick={handleBulkImport}>
                {isSubmitting ? "Menyimpan..." : `Simpan ${importPreview.filter(q => q.isValid).length} Soal`}
              </Button>
            </div>
          </Card>
        </div>
      )}

        </main>
      </div>
    </div>
  );
}

function ProgramSectionHeader({ tab, stats }: { tab: ProgramTabItem; stats: Array<{ label: string; value: number }> }) {
  const Icon = tab.icon;

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">Halaman Program</p>
            <h2 className="mt-1 text-2xl font-bold leading-tight">{tab.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tab.desc}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[360px]">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-lg font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
