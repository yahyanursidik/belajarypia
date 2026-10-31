import { PageHeader } from "../../components/admin/PageHeader";
import { ProgramNavigation } from "../../components/programs/ProgramNavigation";
import { ProgramFormDialog } from "../../components/programs/ProgramFormDialog";
import { ProgramPlacementDialog } from "../../components/programs/ProgramPlacementDialog";
import { ProgramDialog } from "../../components/programs/ProgramDialog";
import { WizardSteps } from "../../components/ui/wizard-steps";
import { programDirectoryPath, programSectionPath, validateLessonSettings, validateProgramUpload, isHttpUrl, type ProgramSection } from "../../lib/programWorkspace";
import { toDateTimeLocalValue } from "../../lib/admission";
import { ProgramAdmissionBuilder } from "./ProgramAdmissionBuilder";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Settings,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  ExternalLink,
  FileText,
  PlayCircle,
  Plus,
  Presentation,
  Trash2,
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

const emptyBatch = { code: "", name: "", start_date: "", end_date: "", status: "draft" as AcademicBatch["status"] };
const emptyClass = { batch_id: "", code: "", name: "", capacity: "", teacher_user_id: "", status: "active" as AcademicClass["status"] };
const emptyHalaqah = { class_id: "", code: "", name: "", capacity: "", mentor_user_id: "", status: "active" as AcademicHalaqah["status"] };
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
  optE: "",
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

type ProgramTab = "info" | "kurikulum" | "peserta" | "angkatan" | "bank_soal" | "silabus" | "kelulusan" | "pendaftaran";
const programTabSegments: Record<ProgramTab, string> = {
  info: "detail-program",
  silabus: "silabus",
  kurikulum: "kurikulum",
  angkatan: "angkatan-kelas",
  bank_soal: "bank-soal",
  peserta: "peserta",
  kelulusan: "kelulusan",
  pendaftaran: "pendaftaran",
};

const programSegmentTabs = Object.entries(programTabSegments).reduce<Record<string, ProgramTab>>((acc, [tab, segment]) => {
  acc[segment] = tab as ProgramTab;
  return acc;
}, {});

const programStatusMeta = {
  active: { label: "Aktif", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  draft: { label: "Draf", className: "border-amber-200 bg-amber-50 text-amber-700" },
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


const getProgramTabFromSegment = (segment?: string): ProgramTab => {
  if (!segment) return "info";
  return programSegmentTabs[segment] ?? "info";
};

/* ───────────────── Component ───────────────── */

export function ProgramBuilderPage() {
  const { programId, section } = useParams<{ programId: string; section?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, primaryRole } = useAuthSession();
  const [searchParams] = useSearchParams();
  const canManageProgram = primaryRole === "admin" || primaryRole === "super_admin";
  const workspaceBase = location.pathname.startsWith('/system') ? '/system' : location.pathname.startsWith('/teacher') ? '/teacher/kelas' : '/admin';
  const directoryPath = programDirectoryPath(workspaceBase, searchParams.get('returnTo'));
  const [isSettingsOpen,setIsSettingsOpen]=useState(false);
  const [placementRevision,setPlacementRevision]=useState(0);
  const [editingBatchId,setEditingBatchId]=useState<string|null>(null);
  const [editingClassId,setEditingClassId]=useState<string|null>(null);
  const [editingHalaqahId,setEditingHalaqahId]=useState<string|null>(null);
  const [deleteRequest,setDeleteRequest]=useState<{message:string;resolve:(confirmed:boolean)=>void}|null>(null);
  const [placement,setPlacement]=useState<{enrollmentId?:string;classId?:string}|null>(null);
  const [lessonStep,setLessonStep]=useState(0);
  const [participantCount,setParticipantCount]=useState(0);
  const [loadError,setLoadError]=useState('');
  const loadController=useRef<AbortController|null>(null);

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
  const [editingQuestionId,setEditingQuestionId]=useState<string|null>(null);
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
      const refreshed=await supabase.from('question_bank_items').select('*').eq('question_bank_id',managingBankId).order('created_at');
      if(refreshed.error)setErrorMessage('Soal tersimpan; muat ulang bank untuk melihat hasil.');else setBankItems(refreshed.data||[]);
    }
    setIsSubmitting(false);
  };

  /* ── Data Loading ── */
  const loadData = useCallback(async (silent = false) => {
    if (!programId) return;
    loadController.current?.abort();
    const controller = new AbortController(); loadController.current = controller;
    if (!silent) { setIsLoading(true); setProgram(null); }
    setLoadError('');
    try {
      const requests = await Promise.all([
        supabase.from("programs").select("*,units(code,name)").eq("id", programId).abortSignal(controller.signal).single(),
        supabase.from("batches").select("*").eq("program_id", programId).order("created_at").abortSignal(controller.signal),
        supabase.from("classes").select("*").eq("program_id", programId).order("created_at").abortSignal(controller.signal),
        supabase.from("halaqahs").select("*,classes!inner(program_id)").eq("classes.program_id", programId).abortSignal(controller.signal),
        supabase.from("levels").select("*").eq("program_id", programId).order("order_no").abortSignal(controller.signal),
        supabase.from("program_modules").select("*,levels(name,code)").eq("program_id", programId).order("order_no").abortSignal(controller.signal),
        supabase.from("lessons").select("*,program_modules!inner(program_id)").eq("program_modules.program_id", programId).order("order_no").abortSignal(controller.signal),
        supabase.from("profiles").select("id,full_name,email,user_roles!inner(roles!inner(code))").eq("status","active").in("user_roles.roles.code",["teacher","mentor","admin","super_admin"]).abortSignal(controller.signal),
        supabase.from("question_banks").select("*").eq("program_id", programId).order("created_at").abortSignal(controller.signal),
        supabase.from("enrollments").select("id",{count:"exact",head:true}).eq("program_id",programId).eq("enrollment_status","active").abortSignal(controller.signal),
      ]);
      if(controller.signal.aborted)return;
      if(requests.some(result=>result.error))throw new Error('Data program belum lengkap dimuat.');
      const [prog,batchRows,classRows,halaqahRows,levelRows,moduleRows,lessonRows,staffRows,bankRows,countResult]=requests;
      const lessonIds=(lessonRows.data??[]).map(row=>row.id as string);
      const docResult=lessonIds.length?await supabase.from("document_files").select("*").in("lesson_id",lessonIds).abortSignal(controller.signal):{data:[],error:null};
      if(controller.signal.aborted)return;
      if(docResult.error)throw docResult.error;
      setProgram(prog.data as unknown as Program);
      setBatches((batchRows.data??[]) as AcademicBatch[]);setClasses((classRows.data??[]) as AcademicClass[]);
      setHalaqahs((halaqahRows.data??[]) as unknown as AcademicHalaqah[]);setLevels((levelRows.data??[]) as Level[]);
      setModules((moduleRows.data??[]) as unknown as ProgramModule[]);setLessons((lessonRows.data??[]) as unknown as Lesson[]);
      setStaff((staffRows.data??[]) as StaffProfile[]);setQuestionBanks((bankRows.data??[]) as QuestionBank[]);
      setDocumentFiles((docResult.data??[]) as DocumentFile[]);setParticipantCount(countResult.count??0);
    } catch { if(!controller.signal.aborted)setLoadError('Data program belum dapat dimuat. Coba lagi.'); }
    finally { if(!controller.signal.aborted)setIsLoading(false); }
  }, [programId]);
  useEffect(() => { void loadData(); return()=>loadController.current?.abort(); }, [loadData]);

  const programBasePath = useMemo(() => {
    if (!programId) return location.pathname;
    const marker = `/program/${programId}`;
    const markerIndex = location.pathname.indexOf(marker);
    if (markerIndex === -1) return location.pathname;
    return `${location.pathname.slice(0, markerIndex)}${marker}`;
  }, [location.pathname, programId]);

  const boardEditorPrefix = useMemo(() => {
    if (location.pathname.startsWith("/system")) return "/system";
    if (location.pathname.startsWith("/teacher")) return "/teacher";
    return "/admin";
  }, [location.pathname]);

  const getProgramSectionPath = useCallback((tab: ProgramTab) => {
    const query = new URLSearchParams(); if(directoryPath !== `${workspaceBase}/program`)query.set("returnTo",directoryPath);
    return `${programBasePath}/${programTabSegments[tab]}${query.size?`?${query}`:""}`;
  }, [programBasePath,directoryPath,workspaceBase]);

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
    if (program && activeTab === "angkatan" && program.curriculum_model !== "angkatan" && classes.length===0) {
      navigateToProgramTab("kurikulum", { replace: true });
    }
  }, [activeTab, navigateToProgramTab, program, programId, section,classes.length]);

  useEffect(()=>{const requested=searchParams.get('placeEnrollment');if(canManageProgram&&requested&&program?.curriculum_model==='angkatan'){setPlacement({enrollmentId:requested});}},[searchParams,program?.id,program?.curriculum_model,canManageProgram]);
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
      participants: participantCount,
    };
  }, [batches.length, classes.length, halaqahs.length, lessons, modules.length, questionBanks.length,participantCount]);

  /* ── Generic submit helper ── */
  const submit = async (
    callback: () => PromiseLike<{ error: { message: string } | null }>,
    success: string,
  ) => {
    if(isSubmitting)return false;
    setIsSubmitting(true); setErrorMessage(null); setMessage(null);
    try {
      const {error}=await callback();
      if(error)throw error;
      setMessage(success); await loadData(true); return true;
    } catch(error) { setErrorMessage((error as {message?:string})?.message??'Perubahan belum tersimpan. Coba lagi.'); return false; }
    finally { setIsSubmitting(false); }
  };

  const saveStructure = async (event:React.FormEvent, kind:'batch'|'class'|'halaqah'|'level'|'module'|'bank') => {
    event.preventDefault();
    const source = kind==='batch'?batchForm:kind==='class'?classForm:kind==='halaqah'?halaqahForm:kind==='level'?levelForm:kind==='module'?moduleForm:bankForm;
    const name = 'name' in source ? source.name : source.title;
    if(!name.trim() || ('code' in source && !source.code.trim())) { setErrorMessage('Isi nama dan kode yang diperlukan.'); return; }
    if('capacity' in source && source.capacity && (!Number.isSafeInteger(Number(source.capacity))||Number(source.capacity)<1)) { setErrorMessage('Kapasitas harus berupa bilangan bulat lebih dari 0.'); return; }
    if(kind==='batch' && batchForm.start_date && batchForm.end_date && batchForm.end_date<batchForm.start_date){setErrorMessage('Tanggal selesai tidak boleh sebelum tanggal mulai.');return;}
    if(kind==='halaqah'&&!classes.some(item=>item.id===halaqahForm.class_id)){setErrorMessage('Pilih kelas program ini.');return;}
    if(kind==='class'&&classForm.batch_id&&!batches.some(item=>item.id===classForm.batch_id)){setErrorMessage('Pilih angkatan program ini.');return;}
    let saved=false;
    if(kind==='batch'){
      const payload={program_id:programId,code:batchForm.code.trim(),name:batchForm.name.trim(),start_date:batchForm.start_date||null,end_date:batchForm.end_date||null,status:batchForm.status};
      saved=await submit(()=>(editingBatchId?supabase.from('batches').update(payload).eq('id',editingBatchId):supabase.from('batches').insert(payload)).select('id').single(),'Angkatan tersimpan.');
    }
    if(kind==='class'){
      const payload={program_id:programId,batch_id:classForm.batch_id||null,code:classForm.code.trim(),name:classForm.name.trim(),capacity:classForm.capacity?Number(classForm.capacity):null,teacher_user_id:classForm.teacher_user_id||null,status:classForm.status};
      saved=await submit(()=>(editingClassId?supabase.from('classes').update(payload).eq('id',editingClassId):supabase.from('classes').insert(payload)).select('id').single(),'Kelas tersimpan.');
    }
    if(kind==='halaqah'){
      const payload={class_id:halaqahForm.class_id,code:halaqahForm.code.trim(),name:halaqahForm.name.trim(),capacity:halaqahForm.capacity?Number(halaqahForm.capacity):null,mentor_user_id:halaqahForm.mentor_user_id||null,status:halaqahForm.status};
      saved=await submit(()=>(editingHalaqahId?supabase.from('halaqahs').update(payload).eq('id',editingHalaqahId):supabase.from('halaqahs').insert(payload)).select('id').single(),'Halaqah tersimpan.');
    }
    if(kind==='level')saved=await submit(()=>supabase.from('levels').insert({program_id:programId,parent_level_id:null,code:levelForm.code.trim(),name:levelForm.name.trim(),order_no:Number(levelForm.order_no||0)}),'Tahapan tersimpan.');
    if(kind==='bank')saved=await submit(()=>supabase.from('question_banks').insert({program_id:programId,name:bankForm.name.trim(),description:bankForm.description.trim()||null}),'Bank soal tersimpan.');
    if(kind==='module'){
      const payload={program_id:programId,parent_module_id:moduleForm.parent_module_id||null,level_id:moduleForm.level_id||null,code:moduleForm.code.trim(),title:moduleForm.title.trim(),order_no:Number(moduleForm.order_no||0)};
      saved=await submit(()=>editingModuleId?supabase.from('program_modules').update(payload).eq('id',editingModuleId):supabase.from('program_modules').insert(payload),'Mata pelajaran tersimpan.');
    }
    if(!saved)return;
    if(kind==='batch'){setEditingBatchId(null);setBatchForm(emptyBatch);setIsBatchModalOpen(false);}
    if(kind==='class'){setEditingClassId(null);setClassForm(emptyClass);setIsClassModalOpen(false);}
    if(kind==='halaqah'){setEditingHalaqahId(null);setHalaqahForm(emptyHalaqah);setIsHalaqahModalOpen(false);}
    if(kind==='level'){setLevelForm(emptyLevel);setIsLevelModalOpen(false);}
    if(kind==='module'){setModuleForm(emptyModule);setEditingModuleId(null);setIsModuleModalOpen(false);}
    if(kind==='bank'){setBankForm({name:'',description:''});setIsBankModalOpen(false);}
  };

  const askDelete=(message:string)=>new Promise<boolean>(resolve=>setDeleteRequest({message,resolve}));
  useEffect(()=>()=>deleteRequest?.resolve(false),[deleteRequest]);
  const removeQuestion=async(id:string,target:'quiz'|'bank')=>{
    if(!await askDelete('Hapus butir soal ini?'))return;
    const table=target==='quiz'?'quiz_questions':'question_bank_items';
    const owner=target==='quiz'?managingLesson?.id:managingBankId;
    if(!owner)return;
    await submit(async()=>{const result=await supabase.from(table).delete().eq('id',id);if(!result.error){const refreshed=await supabase.from(table).select('*').eq(target==='quiz'?'lesson_id':'question_bank_id',owner).order(target==='quiz'?'order_no':'created_at');if(!refreshed.error){if(target==='quiz')setQuizQuestions(refreshed.data??[]);else setBankItems(refreshed.data??[]);}}return result;},'Butir soal dihapus.');
  };
  const removeBank=async(id:string)=>{if(await askDelete('Hapus bank soal beserta butirnya? Soal yang sudah disalin ke ujian tetap tersimpan.'))await submit(()=>supabase.from('question_banks').delete().eq('id',id),'Bank soal dihapus.');};

  /* ── Lesson helpers ── */
  const getLessonIcon = (type: string) => {
    switch (type) {
      case "quiz": case "exam": return <FileText className="h-4 w-4 text-orange-500" />;
      case "live_session": return <Video className="h-4 w-4 text-rose-500" />;
      case "assignment": return <BookOpen className="h-4 w-4 text-blue-500" />;
      case "board": return <Presentation className="h-4 w-4 text-violet-600" />;
      default: return <PlayCircle className="h-4 w-4 text-emerald-500" />;
    }
  };

  const openCreateLessonModal = (moduleId: string, mode: "materi" | "kuis") => {
    setLessonStep(0); setErrorMessage(null);
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
    setLessonStep(0); setErrorMessage(null);
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
      release_at: toDateTimeLocalValue(lesson.release_at),
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
    if (!await askDelete("Hapus materi ini? Tindakan ini tidak bisa dibatalkan.")) return;
    await submit(() => supabase.from("lessons").delete().eq("id", lessonId), "Materi berhasil dihapus.");
  };

  const deleteModule = async (moduleId: string) => {
    if (!await askDelete("Hapus mata pelajaran ini beserta semua materinya?")) return;
    await submit(() => supabase.from("program_modules").delete().eq("id", moduleId), "Mata pelajaran berhasil dihapus.");
  };

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const manageQuestions = async (lesson: Lesson) => {
    setManagingLesson(lesson);
    setIsQuestionModalOpen(true);
    setQuizQuestions([]);setErrorMessage(null);
    const {data,error}=await supabase.from('quiz_questions').select('*').eq('lesson_id',lesson.id).order('order_no');
    if(error)setErrorMessage('Butir soal belum dapat dimuat. Tutup dan coba lagi.');else setQuizQuestions(data||[]);
  };

  const manageBankItems = async (bankId: string) => {
    setManagingBankId(bankId);
    setIsManageBankItemsModalOpen(true);
    setBankItems([]);setErrorMessage(null);
    const {data,error}=await supabase.from('question_bank_items').select('*').eq('question_bank_id',bankId).order('created_at');
    if(error)setErrorMessage('Bank soal belum dapat dimuat. Tutup dan coba lagi.');else setBankItems(data||[]);
  };

  const openSelectFromBank = async () => {
    setAllBankItems([]);setErrorMessage(null);
    const {data,error}=await supabase.from('question_bank_items').select('*,question_banks!inner(name,program_id,programs(name))').eq('question_banks.program_id',programId);
    if(error)setErrorMessage('Pilihan bank soal belum dapat dimuat.');else setAllBankItems(data||[]);
    setSelectedBankItems({});
    setIsBankSelectModalOpen(true);
  };

  const editQuestion=(question:any,target:'quiz'|'bank')=>{
    setQuestionTarget(target);setEditingQuestionId(question.id);setErrorMessage(null);
    const options=(question.options??[]) as string[];
    setQuestionForm({...emptyQuestion,question_type:question.question_type,question_text:question.question_text,optA:options[0]??'',optB:options[1]??'',optC:options[2]??'',optD:options[3]??'',optE:options[4]??'',correct_option:String.fromCharCode(65+Math.max(0,options.indexOf(question.correct_answer))),explanation:question.explanation??'',grading_guide:question.grading_guide??'',points:question.points??10});
    setIsCreateQuestionModalOpen(true);
  };
  const submitQuestion = async (event:React.FormEvent) => {
    event.preventDefault();
    const essay=questionForm.question_type==='essay';
    const options=[questionForm.optA,questionForm.optB,questionForm.optC,questionForm.optD,questionForm.optE].map(option=>option.trim()).filter(Boolean);
    const correct=({A:questionForm.optA,B:questionForm.optB,C:questionForm.optC,D:questionForm.optD,E:questionForm.optE} as Record<string,string>)[questionForm.correct_option]?.trim();
    if(!questionForm.question_text.trim()||!Number.isFinite(questionForm.points)||questionForm.points<=0){setErrorMessage('Isi pertanyaan dan bobot nilai lebih dari 0.');return;}
    if(!essay&&(options.length<2||new Set(options).size!==options.length||!correct||!options.includes(correct))){setErrorMessage('Isi minimal dua jawaban yang berbeda dan pilih kunci yang terisi.');return;}
    const table=questionTarget==='quiz'?'quiz_questions':'question_bank_items';
    const targetId=questionTarget==='quiz'?managingLesson?.id:managingBankId;
    if(!targetId)return;
    const payload={question_type:questionForm.question_type,question_text:questionForm.question_text.trim(),options:essay?[]:options,correct_answer:essay?null:correct,explanation:questionForm.explanation.trim()||null,grading_guide:essay?questionForm.grading_guide.trim()||null:null,points:questionForm.points};
    const saved=await submit(async()=>{
      const result=editingQuestionId?await supabase.from(table).update(payload).eq('id',editingQuestionId):await supabase.from(table).insert({...payload,...(questionTarget==='quiz'?{lesson_id:targetId,order_no:quizQuestions.length+1}:{question_bank_id:targetId})});
      if(!result.error){const refreshed=await supabase.from(table).select('*').eq(questionTarget==='quiz'?'lesson_id':'question_bank_id',targetId).order(questionTarget==='quiz'?'order_no':'created_at');if(!refreshed.error){if(questionTarget==='quiz')setQuizQuestions(refreshed.data||[]);else setBankItems(refreshed.data||[]);}}
      return result;
    },'Butir soal tersimpan.');
    if(saved){setQuestionForm(emptyQuestion);setEditingQuestionId(null);setIsCreateQuestionModalOpen(false);}
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

    const saved=await submit(async () => {
      const res = await supabase.from("quiz_questions").insert(payloads);
      if (!res.error) {
        const { data } = await supabase.from("quiz_questions").select("*").eq("lesson_id", managingLesson.id).order("order_no");
        setQuizQuestions(data || []);
      }
      return res;
    }, `${itemsToImport.length} soal berhasil diimpor.`);
    if(saved)setIsBankSelectModalOpen(false);
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
    if (!await askDelete(`Hapus sumber materi "${doc.display_name}"?`)) return;

    const { error } = await supabase.from("document_files").delete().eq("id", doc.id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setDocumentFiles((current) => current.filter((item) => item.id !== doc.id));
    setMessage("Sumber materi berhasil dihapus.");
  };

  const renderUrlPreview = (url: string) => {
    if(!isHttpUrl(url))return <p className="text-xs text-red-700">Masukkan tautan http atau https yang valid.</p>;
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
    if(isSubmitting)return;
    const validation=validateLessonSettings(lessonForm);
    if(validation){setErrorMessage(validation);return;}
    const invalidFile=selectedUploadFiles.map(validateProgramUpload).find(Boolean);
    if(invalidFile){setErrorMessage(invalidFile);return;}
    if(materialLinks.some(link=>link.url.trim()&&!isHttpUrl(link.url.trim()))){setErrorMessage('Gunakan tautan sumber http atau https yang valid.');return;}
    setIsSubmitting(true);setErrorMessage(null);setMessage(null);
    const wasNew=!editingLessonId;
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
    const shouldOpenBoardAfterSave = lessonForm.lesson_type === "board" && !editingLessonId;
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
    // Retain the confirmed id when a later link/upload fails, so retries update this lesson.
    setEditingLessonId(lessonIdToUse);
    setLessonForm(current=>({...current,code:payload.code}));

    if (lessonForm.lesson_type === "board") {
      const { error: boardError } = await supabase.from("lesson_boards").upsert({
        lesson_id: lessonIdToUse,
        title: lessonForm.title.trim(),
        description: lessonForm.content_body.trim() || null,
        created_by: user?.id || null,
      }, { onConflict: "lesson_id", ignoreDuplicates: true });
      if (boardError) {
        setErrorMessage(boardError.message);
        setIsSubmitting(false);
        return;
      }
    }

    if (lessonForm.lesson_type !== "live_session" && lessonModalMode !== "kuis") {
      const linksToSave=cleanedMaterialLinks.map(link=>({...link,id:/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(link.id)?link.id:crypto.randomUUID()}));
      if(linksToSave.length){
        setMaterialLinks(linksToSave);
        const {error:linkError}=await supabase.from('document_files').upsert(linksToSave.map(link=>({id:link.id,lesson_id:lessonIdToUse,source_type:'external_link',storage_provider:'external',external_url:link.url,display_name:link.label||link.url,file_category:link.category,access_level:'enrolled',status:'active',uploaded_by:user?.id||null})),{onConflict:'id'});
        if(linkError){setErrorMessage(`Materi tersimpan, tetapi tautan belum lengkap: ${linkError.message}`);setIsSubmitting(false);return;}
        setMaterialLinks(linksToSave);
      }
      const retained=new Set(linksToSave.map(link=>link.id));
      const removed=documentFiles.filter(doc=>doc.lesson_id===lessonIdToUse&&doc.source_type==='external_link'&&!retained.has(doc.id)).map(doc=>doc.id);
      if(removed.length){
        const {error:removeError}=await supabase.from('document_files').delete().eq('lesson_id',lessonIdToUse).in('id',removed);
        if(removeError){setErrorMessage(`Materi tersimpan, tetapi tautan lama belum dihapus: ${removeError.message}`);setIsSubmitting(false);return;}
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
          setSelectedUploadFiles(current=>current.filter(item=>item!==file));
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
    await loadData(true);
    setIsSubmitting(false);
    if(wasNew&&lessonModalMode==='kuis')void manageQuestions({...payload,id:lessonIdToUse} as Lesson);
    if (shouldOpenBoardAfterSave) navigate(`${boardEditorPrefix}/board/${lessonIdToUse}`);
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

  if (loadError) return <div className="page-stack"><p className="program-error" role="alert">{loadError}</p><div className="flex gap-2"><Button variant="outline" onClick={()=>navigate(directoryPath)}>Daftar program</Button><Button onClick={()=>void loadData()}>Coba lagi</Button></div></div>;
  if (!program) {
    return (
      <div className="page-stack space-y-4">
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>Program belum tersedia</AlertTitle>
          <AlertDescription>Program tidak ditemukan atau Anda tidak memiliki akses.</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(directoryPath)} variant="outline" className="h-10 w-fit whitespace-nowrap !text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
      </div>
    );
  }

  const statusMeta = programStatusMeta[program.status] ?? programStatusMeta.draft;
  const currentSection=programTabSegments[activeTab] as ProgramSection;
  const navigateSection=(target:ProgramSection)=>navigate(programSectionPath(workspaceBase,program.id,target,directoryPath));
  const selectedLessonModule = modules.find(module=>module.id===lessonForm.module_id);

  return (
    <div className="page-stack w-full max-w-none program-workspace">
      {/* ── Header ── */}
      <nav aria-label="Jejak navigasi" className="admin-breadcrumb"><button type="button" onClick={() => navigate(directoryPath)}>Program</button><span aria-hidden="true">/</span><span>{program.name}</span></nav>
      <PageHeader title={program.name} eyebrow={`${program.code} · ${statusMeta.label}`} actions={<><Button variant="outline" onClick={()=>void loadData(true)} aria-label="Muat ulang program"><RefreshCw size={16}/></Button>{canManageProgram&&<Button asChild variant="outline"><Link to={`${workspaceBase}/keuangan?tab=invoices&program=${program.id}`}>Tagihan & pembayaran</Link></Button>}{canManageProgram&&<Button asChild variant="outline"><Link to={`${workspaceBase}/pengumuman?program=${program.id}`}>Pengumuman</Link></Button>}{canManageProgram&&<Button variant="outline" onClick={()=>setIsSettingsOpen(true)}><Settings size={16}/>Pengaturan</Button>}</>}/>
      <ProgramNavigation basePath={workspaceBase} programId={program.id} section={currentSection} scheduled={program.curriculum_model==="angkatan"||classes.length>0} returnTo={directoryPath} admin={canManageProgram}/>
      <div>
        <div className="min-w-0 space-y-6">


      {/* ── Toast Notifications ── */}
      {(message || errorMessage) && (
        <div className="program-feedback" role={errorMessage?"alert":"status"}>
          {message && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-lg flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-50 text-red-800 border border-red-200 px-4 py-3 rounded-lg flex items-center gap-2">
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
          onNavigate={navigateSection}
          onSettings={canManageProgram?()=>setIsSettingsOpen(true):undefined}
        />
      )}

      {/* ═══════════════ TAB: ANGKATAN ═══════════════ */}
      {activeTab === "angkatan" && (program.curriculum_model === "angkatan"||classes.length>0) && (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <Button onClick={() => { setEditingBatchId(null); setBatchForm(emptyBatch); setIsBatchModalOpen(true); }} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Tambah Angkatan
            </Button>
            <Button variant="outline" onClick={() => { setEditingClassId(null); setClassForm(emptyClass); setIsClassModalOpen(true); }} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Tambah Kelas
            </Button>
            <Button variant="outline" onClick={() => { setEditingHalaqahId(null); setHalaqahForm(emptyHalaqah); setIsHalaqahModalOpen(true); }} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Tambah Halaqah
            </Button>
          </div>

          <div className="program-cohort-grid">{batches.map(batch=><article key={batch.id} className="program-panel"><header><div><h3>{batch.name}</h3><small>{batch.code}</small></div><span className={`program-status program-status--${batch.status}`}>{({active:'Aktif',draft:'Draf',archived:'Arsip'} as Record<string,string>)[batch.status]}</span></header><p className="text-xs text-muted-foreground">{batch.start_date?new Date(batch.start_date).toLocaleDateString('id-ID'):'Mulai belum diatur'}{batch.end_date?` – ${new Date(batch.end_date).toLocaleDateString('id-ID')}`:''}</p><footer className="flex items-center justify-between mt-3"><span className="text-sm">{classes.filter(group=>group.batch_id===batch.id).length} kelas</span><Button variant="outline" size="sm" onClick={()=>{setEditingBatchId(batch.id);setBatchForm({code:batch.code,name:batch.name,start_date:batch.start_date??'',end_date:batch.end_date??'',status:batch.status});setIsBatchModalOpen(true);}}>Ubah</Button></footer></article>)}</div>
          {/* Ringkasan Kelas */}
          <Card>
            <CardHeader className="program-section-heading"><CardTitle>Kelas & halaqah</CardTitle>{canManageProgram&&<Button disabled={!classes.length} onClick={()=>setPlacement({})}><Users size={15}/>Tempatkan peserta</Button>}</CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground border rounded-lg border-dashed">Belum ada kelas di program ini.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Kelas</th><th>Angkatan</th><th>Pengajar</th><th>Halaqah</th><th>Aksi</th></tr>
                    </thead>
                    <tbody>
                      {classes.map(cl => (
                        <tr key={cl.id}>
                          <td className="font-medium">{cl.name}<small className="block text-muted-foreground">{cl.code} · {cl.capacity?`${cl.capacity} tempat`:"Tanpa batas kapasitas"} · {cl.status==='active'?'Aktif':'Arsip'}</small></td>
                          <td>{batches.find(b => b.id === cl.batch_id)?.name ?? "-"}</td>
                          <td>{staff.find(s => s.id === cl.teacher_user_id)?.full_name ?? "-"}</td>
                          <td>{classScopedHalaqahs.filter(h => h.class_id === cl.id).map(h => <button key={h.id} className="program-halaqah-chip" onClick={()=>{setEditingHalaqahId(h.id);setHalaqahForm({class_id:h.class_id,code:h.code,name:h.name,capacity:h.capacity?.toString()??'',mentor_user_id:h.mentor_user_id??'',status:h.status});setIsHalaqahModalOpen(true);}}>{h.name}<Edit2 size={12}/></button>)}</td><td><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>{setEditingClassId(cl.id);setClassForm({batch_id:cl.batch_id??'',code:cl.code,name:cl.name,capacity:cl.capacity?.toString()??'',teacher_user_id:cl.teacher_user_id??'',status:cl.status});setIsClassModalOpen(true);}}>Ubah</Button>{canManageProgram&&<Button variant="outline" size="sm" disabled={cl.status!=='active'} onClick={()=>setPlacement({classId:cl.id})}>Tempatkan</Button>}</div></td>
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
                      <div className="program-module-header">
                        <div className="flex items-center justify-between gap-2">
                          <button type="button" className="program-module-toggle" aria-expanded={Boolean(expandedModules[module.id])} onClick={()=>toggleModule(module.id)}>
                            {expandedModules[module.id] ? <ChevronDown className="h-5 w-5 text-primary shrink-0" /> : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
                            <div className="min-w-0">
                              <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                                <span className="truncate">{module.code} - {module.title}</span>
                              </h3>
                              {module.levels && (
                                <p className="text-xs text-muted-foreground mt-0.5">Tahapan: <span className="text-primary font-medium">{module.levels.name}</span></p>
                              )}
                            </div>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="bg-white text-xs">{moduleLessons.length} materi</Badge>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50 rounded-full" aria-label={`Ubah mata pelajaran ${module.title}`} onClick={(e) => { e.stopPropagation(); setModuleForm({ parent_module_id: module.parent_module_id || "", level_id: module.level_id || "", code: module.code, title: module.title, order_no: module.order_no.toString() }); setEditingModuleId(module.id); setIsModuleModalOpen(true); }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" aria-label={`Hapus mata pelajaran ${module.title}`} onClick={(e) => { e.stopPropagation(); void deleteModule(module.id); }}>
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
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{({content:"Materi",board:"Papan belajar",assignment:"Tugas",live_session:"Sesi live",quiz:"Kuis",exam:"Ujian"} as Record<string,string>)[lesson.lesson_type]??lesson.lesson_type}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {(lesson.lesson_type === "quiz" || lesson.lesson_type === "exam") && (
                                      <Button variant="outline" size="sm" className="h-8 text-xs border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => manageQuestions(lesson)}>
                                        <BookOpen className="h-3 w-3 mr-1" /> Kelola Soal
                                      </Button>
                                    )}
                                    {lesson.lesson_type === "board" && (
                                      <Button variant="outline" size="sm" className="h-8 text-xs border-violet-200 text-violet-700 hover:bg-violet-50" onClick={() => navigate(`${boardEditorPrefix}/board/${lesson.id}`)}>
                                        <Presentation className="h-3 w-3 mr-1" /> Kelola Board
                                      </Button>
                                    )}
                                    <Badge variant={lesson.visibility_status === "published" ? "default" : "secondary"} className="text-xs">{({published:"Terbit",draft:"Draf",locked:"Terkunci",archived:"Diarsipkan"} as Record<string,string>)[lesson.visibility_status]??lesson.visibility_status}</Badge>
                                    <Button variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50 rounded-full" aria-label={`Ubah ${lesson.title}`} onClick={() => editLesson(lesson)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" aria-label={`Hapus ${lesson.title}`} onClick={() => void deleteLesson(lesson.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Lesson Button */}
                          <div className="grid gap-3 border-t bg-muted/20 p-3 md:grid-cols-2">
                            <Button
                              variant="outline"
                              className="h-10 w-full justify-start gap-3 border-dashed p-4 text-left"
                              onClick={() => openCreateLessonModal(module.id, "materi")}
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <Plus className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold">Tambah Pertemuan / Materi</span>

                              </span>
                            </Button>
                            <Button
                              variant="outline"
                              className="h-10 w-full justify-start gap-3 border-dashed border-orange-200 p-4 text-left text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                              onClick={() => openCreateLessonModal(module.id, "kuis")}
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                                <FileText className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold">Tambah Kuis / Ujian</span>

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
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" aria-label={`Hapus bank ${bank.name}`} onClick={()=>void removeBank(bank.id)}><Trash2 className="h-4 w-4" /></Button>
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
        <ProgramDialog title={`Soal: ${managingLesson.title}`} busy={isSubmitting} error={errorMessage} wide={true} onClose={()=>{setIsQuestionModalOpen(false);setManagingLesson(null);setErrorMessage(null);}}>
            <CardContent className="p-6 overflow-y-auto flex-1 bg-muted/10">
              <div className="flex gap-4 mb-6">
                <Button className="shadow-sm" onClick={() => { setQuestionTarget("quiz"); setEditingQuestionId(null); setQuestionForm(emptyQuestion); setIsCreateQuestionModalOpen(true); }}>
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
                          <Button aria-label="Edit butir soal" variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50 rounded-full" onClick={()=>editQuestion(q,"quiz")}><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" onClick={()=>void removeQuestion(q.id,"quiz")}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </ProgramDialog>
      )}

      {/* Modal Bank Soal */}
      {isBankModalOpen && (
        <ProgramDialog title={"Buat bank soal"} busy={isSubmitting} error={errorMessage} wide={false} onClose={()=>{setIsBankModalOpen(false);setErrorMessage(null);}}>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={event=>void saveStructure(event,'bank')}>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-1">Nama Bank Soal <span className="text-red-500">*</span></label>
                  <Input id="program-field-1" placeholder="Contoh: Bank Soal Tauhid" required value={bankForm.name} onChange={e => setBankForm(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-2">Deskripsi</label>
                  <textarea id="program-field-2" className="field-control min-h-[80px]" placeholder="Keterangan..." value={bankForm.description} onChange={e => setBankForm(c => ({ ...c, description: e.target.value }))} />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsBankModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Simpan Bank Soal</Button>
                </div>
              </form>
            </CardContent>
          </ProgramDialog>
      )}

      {/* Modal Angkatan */}
      {isBatchModalOpen && (
        <ProgramDialog title={editingBatchId?"Edit angkatan":"Buat angkatan"} busy={isSubmitting} error={errorMessage} wide={false} onClose={()=>{setIsBatchModalOpen(false);setErrorMessage(null);}}>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={event=>void saveStructure(event,'batch')}>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-3">Kode Angkatan</label>
                  <Input id="program-field-3" placeholder="Contoh: BATCH-01" required value={batchForm.code} onChange={e => setBatchForm(c => ({ ...c, code: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-4">Nama Angkatan</label>
                  <Input id="program-field-4" placeholder="Contoh: Angkatan 1" required value={batchForm.name} onChange={e => setBatchForm(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-5">Tanggal Mulai</label>
                    <Input id="program-field-5" type="date" value={batchForm.start_date} onChange={e => setBatchForm(c => ({ ...c, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-6">Tanggal Selesai</label>
                    <Input id="program-field-6" type="date" value={batchForm.end_date} onChange={e => setBatchForm(c => ({ ...c, end_date: e.target.value }))} />
                  </div>
                </div>
                <label className="block space-y-2">Status<select className="field-control" value={batchForm.status} onChange={event=>setBatchForm(current=>({...current,status:event.target.value as AcademicBatch['status']}))}><option value="draft">Draf</option><option value="active">Aktif</option><option value="archived">Diarsipkan</option></select></label>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsBatchModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Simpan angkatan</Button>
                </div>
              </form>
            </CardContent>
          </ProgramDialog>
      )}

      {/* Modal Kelas */}
      {isClassModalOpen && (
        <ProgramDialog title={editingClassId?"Edit kelas":"Buat kelas"} busy={isSubmitting} error={errorMessage} wide={false} onClose={()=>{setIsClassModalOpen(false);setErrorMessage(null);}}>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={event=>void saveStructure(event,'class')}>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-7">Angkatan (Opsional)</label>
                  <select id="program-field-7" className="field-control" value={classForm.batch_id} onChange={e => setClassForm(c => ({ ...c, batch_id: e.target.value }))}>
                    <option value="">-- Pilih Angkatan --</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-8">Kode Kelas</label>
                    <Input id="program-field-8" placeholder="KLS-A" required value={classForm.code} onChange={e => setClassForm(c => ({ ...c, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-9">Kapasitas</label>
                    <Input id="program-field-9" placeholder="Max peserta" type="number" min={1} step={1} value={classForm.capacity} onChange={e => setClassForm(c => ({ ...c, capacity: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-10">Nama Kelas</label>
                  <Input id="program-field-10" placeholder="Contoh: Kelas A" required value={classForm.name} onChange={e => setClassForm(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-11">Pengajar Utama</label>
                  <select id="program-field-11" className="field-control" value={classForm.teacher_user_id} onChange={e => setClassForm(c => ({ ...c, teacher_user_id: e.target.value }))}>
                    <option value="">-- Pilih Pengajar --</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>)}
                  </select>
                </div>
                <label className="block space-y-2">Status<select className="field-control" value={classForm.status} onChange={event=>setClassForm(current=>({...current,status:event.target.value as AcademicClass['status']}))}><option value="active">Aktif</option><option value="archived">Diarsipkan</option></select></label>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsClassModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Simpan kelas</Button>
                </div>
              </form>
            </CardContent>
          </ProgramDialog>
      )}

      {/* Modal Halaqah */}
      {isHalaqahModalOpen && (
        <ProgramDialog title={editingHalaqahId?"Edit halaqah":"Buat halaqah"} busy={isSubmitting} error={errorMessage} wide={false} onClose={()=>{setIsHalaqahModalOpen(false);setErrorMessage(null);}}>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={event=>void saveStructure(event,'halaqah')}>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-12">Kelas <span className="text-red-500">*</span></label>
                  <select id="program-field-12" className="field-control" required value={halaqahForm.class_id} onChange={e => setHalaqahForm(c => ({ ...c, class_id: e.target.value }))}>
                    <option value="">-- Pilih Kelas --</option>
                    {classes.map(cl => <option key={cl.id} value={cl.id}>{cl.code} - {cl.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-13">Kode Halaqah</label>
                    <Input id="program-field-13" placeholder="HLQ-01" required value={halaqahForm.code} onChange={e => setHalaqahForm(c => ({ ...c, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-14">Kapasitas</label>
                    <Input id="program-field-14" placeholder="Max" type="number" min={1} step={1} value={halaqahForm.capacity} onChange={e => setHalaqahForm(c => ({ ...c, capacity: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-15">Nama Halaqah</label>
                  <Input id="program-field-15" placeholder="Contoh: Kelompok Abu Bakar" required value={halaqahForm.name} onChange={e => setHalaqahForm(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-16">Mentor / Pendamping</label>
                  <select id="program-field-16" className="field-control" value={halaqahForm.mentor_user_id} onChange={e => setHalaqahForm(c => ({ ...c, mentor_user_id: e.target.value }))}>
                    <option value="">-- Pilih Mentor --</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>)}
                  </select>
                </div>
                <label className="block space-y-2">Status<select className="field-control" value={halaqahForm.status} onChange={event=>setHalaqahForm(current=>({...current,status:event.target.value as AcademicHalaqah['status']}))}><option value="active">Aktif</option><option value="archived">Diarsipkan</option></select></label>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsHalaqahModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Simpan halaqah</Button>
                </div>
              </form>
            </CardContent>
          </ProgramDialog>
      )}

      {/* Modal Tahapan */}
      {isLevelModalOpen && (
        <ProgramDialog title={"Buat tahapan"} busy={isSubmitting} error={errorMessage} wide={false} onClose={()=>{setIsLevelModalOpen(false);setErrorMessage(null);}}>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={event=>void saveStructure(event,'level')}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-17">Kode</label>
                    <Input id="program-field-17" placeholder="Contoh: DASAR" required value={levelForm.code} onChange={e => setLevelForm(c => ({ ...c, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-18">Urutan</label>
                    <Input id="program-field-18" placeholder="1" type="number" value={levelForm.order_no} onChange={e => setLevelForm(c => ({ ...c, order_no: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-19">Nama Tahapan</label>
                  <Input id="program-field-19" placeholder="Contoh: Level 1 Dasar" required value={levelForm.name} onChange={e => setLevelForm(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsLevelModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Tambahkan Tahapan</Button>
                </div>
              </form>
            </CardContent>
          </ProgramDialog>
      )}

      {/* Modal Mata Pelajaran */}
      {isModuleModalOpen && (
        <ProgramDialog title={editingModuleId?"Edit mata pelajaran":"Buat mata pelajaran"} busy={isSubmitting} error={errorMessage} wide={false} onClose={()=>{setIsModuleModalOpen(false);setEditingModuleId(null);setErrorMessage(null);}}>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={event=>void saveStructure(event,'module')}>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-20">Tahapan (Opsional)</label>
                  <select id="program-field-20" className="field-control" value={moduleForm.level_id} onChange={e => setModuleForm(c => ({ ...c, level_id: e.target.value }))}>
                    <option value="">-- Pilih Tahapan --</option>
                    {levels.map(l => <option key={l.id} value={l.id}>{l.code} - {l.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-21">Kode</label>
                    <Input id="program-field-21" placeholder="THD-1" required value={moduleForm.code} onChange={e => setModuleForm(c => ({ ...c, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-22">Urutan</label>
                    <Input id="program-field-22" placeholder="1" type="number" value={moduleForm.order_no} onChange={e => setModuleForm(c => ({ ...c, order_no: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-23">Judul Mata Pelajaran</label>
                  <Input id="program-field-23" placeholder="Contoh: Pengantar Tauhid" required value={moduleForm.title} onChange={e => setModuleForm(c => ({ ...c, title: e.target.value }))} />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => { setIsModuleModalOpen(false); setEditingModuleId(null); setModuleForm(emptyModule); }}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">{editingModuleId ? "Simpan Perubahan" : "Tambahkan Mata Pelajaran"}</Button>
                </div>
              </form>
            </CardContent>
          </ProgramDialog>
      )}

      {/* ═══════════════ UNIFIED LESSON MODAL ═══════════════ */}
      {isLessonModalOpen && (
        <ProgramDialog title={editingLessonId?"Edit materi / ujian":lessonModalMode==="kuis"?"Buat kuis / ujian":"Buat materi"} busy={isSubmitting} error={errorMessage} wide={true} onClose={()=>{setIsLessonModalOpen(false);setErrorMessage(null);}}>
            <CardContent className="overflow-y-auto p-0">
              <WizardSteps steps={['Identitas',lessonModalMode==='kuis'?'Aturan ujian':'Konten','Tinjau']} current={lessonStep}/>
              <p className="program-lesson-context">{selectedLessonModule?.title}</p>
              <form className="space-y-5" onSubmit={event=>{event.preventDefault();if(lessonStep<2){if(lessonStep===0&&!lessonForm.title.trim()){setErrorMessage('Isi judul materi.');return;}if(lessonStep===1){const validation=validateLessonSettings(lessonForm);if(validation){setErrorMessage(validation);return;}}setErrorMessage(null);setLessonStep(lessonStep+1);}else void handleLessonSubmit(event);}}>
                <fieldset hidden={lessonStep!==0} disabled={lessonStep!==0} className="space-y-4">
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold" htmlFor="program-field-24">{lessonModalMode === "kuis" ? "Judul Kuis / Ujian" : "Judul Materi"} <span className="text-red-500">*</span></label>
                  <Input id="program-field-24" placeholder={lessonModalMode === "kuis" ? "Contoh: Ujian Akhir Semester" : "Contoh: Pengantar Tauhid - Pertemuan 1"} required value={lessonForm.title} onChange={e => setLessonForm(c => ({ ...c, title: e.target.value }))} className="h-11" />
                </div>

                {/* Type & Status */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold" htmlFor="program-field-25">{lessonModalMode === "kuis" ? "Tipe Evaluasi" : "Tipe Pertemuan"}</label>
                    <select id="program-field-25" className="field-control h-11" value={lessonForm.lesson_type} onChange={e => setLessonForm(c => ({ ...c, lesson_type: e.target.value }))}>
                      {lessonModalMode === "materi" ? (
                        <>
                          <option value="content">📖 Materi Pembelajaran</option>
                          <option value="board">🗂️ Board Materi Interaktif</option>
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
                    <label className="text-sm font-semibold" htmlFor="program-field-26">Status</label>
                    <select id="program-field-26" className="field-control h-11" value={lessonForm.visibility_status} onChange={e => setLessonForm(c => ({ ...c, visibility_status: e.target.value as LessonVisibilityStatus }))}>
                      <option value="draft">Draf</option>
                      <option value="published" disabled={lessonModalMode==="kuis"&&!editingLessonId}>Diterbitkan</option>
                      <option value="locked">Terkunci</option>
                    </select>
                  </div>
                </div>

                {/* Order & Release */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold" htmlFor="program-field-27">Urutan</label>
                    <Input id="program-field-27" placeholder="1" type="number" value={lessonForm.order_no} onChange={e => setLessonForm(c => ({ ...c, order_no: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold" htmlFor="program-field-28">Tanggal Rilis (Opsional)</label>
                    <Input id="program-field-28" type="datetime-local" value={lessonForm.release_at} onChange={e => setLessonForm(c => ({ ...c, release_at: e.target.value }))} />
                  </div>
                </div>

                </fieldset>
                <fieldset hidden={lessonStep!==1} disabled={lessonStep!==1} className="space-y-4">
                {/* Source Material — conditional on lesson type */}
                {lessonForm.lesson_type === "live_session" ? (
                  <div className="space-y-4 p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/50 dark:border-rose-800/30">
                    <label className="text-sm font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                      <Video className="h-4 w-4" /> Pengaturan Sesi Live
                    </label>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="program-field-29">Link Meeting (Zoom / Google Meet) <span className="text-red-500">*</span></label>
                      <Input id="program-field-29"
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
                        <label className="text-xs font-medium text-muted-foreground" htmlFor="program-field-30">Tanggal & Waktu Mulai <span className="text-red-500">*</span></label>
                        <Input id="program-field-30"
                          type="datetime-local"
                          value={lessonForm.release_at}
                          onChange={e => setLessonForm(c => ({ ...c, release_at: e.target.value }))}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground" htmlFor="program-field-31">Estimasi Durasi</label>
                        <select id="program-field-31" className="field-control h-11" value={lessonForm.duration_minutes || "60"} onChange={e => setLessonForm(c => ({ ...c, duration_minutes: e.target.value }))}>
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
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Nilai minimum kelulusan</label>
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
                          <label className="text-sm font-semibold text-foreground">Mode ujian ketat</label>
                          <p className="text-xs text-muted-foreground mt-0.5">Mencatat perpindahan tab dan membatasi salin-tempel di halaman ujian.</p>
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
                            <span className="text-xs text-muted-foreground">kali</span>
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
                        Tautan & dokumen
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
                              <Button type="button" variant="ghost" className="h-8 w-8 shrink-0 p-0 text-red-500 hover:bg-red-50" aria-label={`Hapus sumber ${doc.display_name}`} onClick={() => void deleteMaterialSource(doc)}>
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
                              <Input aria-label={`Judul sumber ${index+1}`}
                                placeholder={`Judul link ${index + 1}, misal: Video pembuka`}
                                value={link.label}
                                onChange={e => updateMaterialLink(link.id, { label: e.target.value })}
                              />
                              <select aria-label={`Jenis sumber ${index+1}`}
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
                              <Button type="button" variant="ghost" className="h-10 w-10 p-0 text-red-500 hover:bg-red-50" aria-label={`Hapus tautan sumber ${index+1}`} onClick={() => removeMaterialLink(link.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <Input aria-label={`Tautan sumber ${index+1}`}
                              placeholder="https://… (sumber belajar eksternal)"
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
                        <span className="text-xs text-muted-foreground">PDF, dokumen & gambar</span>
                      </div>
                      <button type="button"
                        className="w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Klik untuk memilih satu atau banyak file</p>
                        <p className="text-xs text-muted-foreground mt-1">File baru akan ditambahkan sebagai sumber tambahan.</p>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.webp"
                        onChange={event=>{const files=Array.from(event.target.files??[]);const invalid=files.map(validateProgramUpload).find(Boolean);if(invalid)setErrorMessage(invalid);else{setSelectedUploadFiles(current=>[...new Map([...current,...files].map(file=>[file.name,file])).values()]);setErrorMessage(null);}event.target.value='';}}
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
                  <textarea aria-label="Deskripsi atau instruksi"
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

                </fieldset>
                {lessonStep===2&&<section className="program-review"><h3>Periksa {lessonModalMode==='kuis'?'ujian':'materi'}</h3><dl><div><dt>Judul</dt><dd>{lessonForm.title}</dd></div><div><dt>Mata pelajaran</dt><dd>{selectedLessonModule?.title}</dd></div><div><dt>Status</dt><dd>{({draft:'Draf',published:'Diterbitkan',locked:'Terkunci',archived:'Diarsipkan'} as Record<string,string>)[lessonForm.visibility_status]}</dd></div><div><dt>Waktu rilis</dt><dd>{lessonForm.release_at?new Date(lessonForm.release_at).toLocaleString('id-ID'):'Langsung setelah diterbitkan'}</dd></div><div><dt>{lessonModalMode==='kuis'?'Nilai minimum':'Sumber baru'}</dt><dd>{lessonModalMode==='kuis'?(lessonForm.passing_grade||'Tidak ditentukan'):`${materialLinks.filter(link=>link.url.trim()).length} tautan · ${selectedUploadFiles.length} file`}</dd></div></dl>{lessonModalMode==='kuis'&&!editingLessonId&&<p className="program-notice">Setelah disimpan, lanjutkan menyusun butir soal.</p>}</section>}
                <div className="wizard-footer"><Button type="button" variant="outline" onClick={()=>lessonStep?setLessonStep(lessonStep-1):setIsLessonModalOpen(false)}>{lessonStep?'Kembali':'Batal'}</Button><span className="text-xs text-muted-foreground">{lessonStep+1} dari 3</span><Button disabled={isSubmitting} type="submit">{isSubmitting?'Menyimpan…':lessonStep<2?'Lanjut':'Simpan'}</Button></div>
              </form>
            </CardContent>
          </ProgramDialog>
      )}
      {/* Modal Buat Soal Sendiri (Digunakan di Kuis dan Bank Soal) */}
      {isCreateQuestionModalOpen && (
        <ProgramDialog title={"Butir soal"} busy={isSubmitting} error={errorMessage} wide={false} onClose={()=>{setIsCreateQuestionModalOpen(false);setErrorMessage(null);}}>
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
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-32">Teks Soal / Pertanyaan <span className="text-red-500">*</span></label>
                  <textarea id="program-field-32" className="field-control min-h-[100px]" required placeholder="Masukkan pertanyaan..." value={questionForm.question_text} onChange={e => setQuestionForm(c => ({ ...c, question_text: e.target.value }))} />
                </div>

                {questionForm.question_type === "multiple_choice" ? <div className="space-y-3">
                  <label className="text-sm font-semibold block">Pilihan Jawaban</label>
                  <div className="grid gap-3">
                    {["A", "B", "C", "D", "E"].map(opt => (
                      <div key={opt} className="flex gap-3 items-center">
                        <div className="flex items-center gap-2">
                          <input type="radio" name="correct_option" value={opt} checked={questionForm.correct_option === opt} onChange={e => setQuestionForm(c => ({ ...c, correct_option: e.target.value }))} className="w-4 h-4" />
                          <span className="font-bold">{opt}.</span>
                        </div>
                        <Input
                          required={opt==='A'||opt==='B'}
                          aria-label={`Pilihan ${opt}`}
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
                    <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-33">Panduan Penilaian</label>
                    <textarea id="program-field-33"
                      className="field-control min-h-[110px]"
                      placeholder="Tuliskan poin-poin jawaban ideal atau rubrik singkat untuk penilai."
                      value={questionForm.grading_guide}
                      onChange={e => setQuestionForm(c => ({ ...c, grading_guide: e.target.value }))}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Panduan hanya terlihat oleh admin/pengajar saat menilai.</p>
                  </div>
                )}

                {questionForm.question_type === "multiple_choice" && <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-34">Penjelasan (Opsional)</label>
                  <textarea id="program-field-34" className="field-control min-h-[80px]" placeholder="Penjelasan kenapa jawaban tersebut benar..." value={questionForm.explanation} onChange={e => setQuestionForm(c => ({ ...c, explanation: e.target.value }))} />
                </div>}

                <div>
                  <label className="text-sm font-semibold mb-1 block" htmlFor="program-field-35">Bobot nilai</label>
                  <Input id="program-field-35" type="number" min={1} required value={questionForm.points} onChange={e => setQuestionForm(c => ({ ...c, points: Number(e.target.value) }))} className="w-32" />
                  <p className="text-xs text-muted-foreground mt-1">Bobot standar adalah 10. Bisa diubah jika soal ini lebih sulit.</p>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsCreateQuestionModalOpen(false)}>Batal</Button>
                  <Button disabled={isSubmitting} type="submit">Simpan Soal</Button>
                </div>
              </form>
            </CardContent>
          </ProgramDialog>
      )}

      {/* Modal Kelola Butir Soal (Bank Soal) */}
      {isManageBankItemsModalOpen && managingBankId && (
        <ProgramDialog title={`Bank soal: ${questionBanks.find(bank=>bank.id===managingBankId)?.name??""}`} busy={isSubmitting} error={errorMessage} wide={true} onClose={()=>{setIsManageBankItemsModalOpen(false);setManagingBankId(null);setErrorMessage(null);}}>
            <CardContent className="p-6 overflow-y-auto flex-1 bg-muted/10">
              <div className="flex gap-4 mb-6">
                <Button className="shadow-sm" onClick={() => { setQuestionTarget("bank"); setEditingQuestionId(null); setQuestionForm(emptyQuestion); setIsCreateQuestionModalOpen(true); }}>
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
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-full" onClick={()=>void removeQuestion(q.id,"bank")}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </ProgramDialog>
      )}

      {/* Modal Ambil dari Bank Soal (ke Kuis) */}
      {isBankSelectModalOpen && (
        <ProgramDialog title={"Ambil soal dari bank"} busy={isSubmitting} error={errorMessage} wide={true} onClose={()=>{setIsBankSelectModalOpen(false);setErrorMessage(null);}}>
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
                        <input type="checkbox" className="w-5 h-5 shrink-0" checked={!!selectedBankItems[q.id]} aria-label={`Pilih soal ${q.question_text}`} onClick={event=>event.stopPropagation()} onChange={event=>setSelectedBankItems(current=>({...current,[q.id]:event.target.checked}))} />
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
          </ProgramDialog>
      )}
      {activeTab === 'pendaftaran' && canManageProgram && <section className="space-y-4"><div className="program-section-heading"><h2>Pendaftaran program</h2><Button asChild variant="outline"><Link to={`${workspaceBase}/pendaftaran?tab=review&program=${program.id}`}>Tinjau pendaftar <ArrowRight size={14}/></Link></Button></div><ProgramAdmissionBuilder programId={program.id} onFlagsChanged={flags=>setProgram(current=>current?{...current,feature_flags:flags}:current)}/></section>}
      {deleteRequest&&<ProgramDialog title="Konfirmasi penghapusan" busy={false} onClose={()=>{deleteRequest.resolve(false);setDeleteRequest(null);}}><p className="text-sm">{deleteRequest.message}</p><div className="wizard-footer"><Button variant="outline" onClick={()=>{deleteRequest.resolve(false);setDeleteRequest(null);}}>Batal</Button><Button className="bg-red-700 hover:bg-red-800" onClick={()=>{deleteRequest.resolve(true);setDeleteRequest(null);}}>Hapus</Button></div></ProgramDialog>}
      {placement&&<ProgramPlacementDialog programId={program.id} batches={batches} classes={classes} halaqahs={halaqahs} enrollmentId={placement.enrollmentId} initialClassId={placement.classId} onClose={()=>setPlacement(null)} onSaved={()=>{setPlacement(null);setMessage('Penempatan peserta tersimpan.');setPlacementRevision(value=>value+1);void loadData(true);}}/>}
      {isSettingsOpen&&<ProgramFormDialog program={program} onClose={()=>setIsSettingsOpen(false)} onSaved={updated=>{setProgram(updated);setIsSettingsOpen(false);setMessage('Pengaturan program tersimpan.');}}/>}

      {/* ═══════════════ TAB: INFO PESERTA ═══════════════ */}
      {activeTab === "peserta" && (
        <ProgramParticipants programId={program.id} reloadToken={placementRevision} onPlace={canManageProgram&&(program.curriculum_model==='angkatan'||classes.length>0)?enrollmentId=>setPlacement({enrollmentId}):undefined}/>
      )}

      {/* ═══════════════ TAB: SILABUS ═══════════════ */}
      {activeTab === "silabus" && (
        <ProgramSyllabusSection key={program.id} program={program} onProgramUpdated={setProgram} />
      )}

      {/* ═══════════════ TAB: KELULUSAN ═══════════════ */}
      {activeTab === "kelulusan" && (
        <ProgramGraduationSection program={program} lessons={lessons} onProgramUpdated={setProgram} />
      )}

      {/* Modal Import Soal (Bulk Text) */}
      {isImportModalOpen && (
        <ProgramDialog title={"Impor soal dari teks"} busy={isSubmitting} error={errorMessage} wide={true} onClose={()=>{setIsImportModalOpen(false);setErrorMessage(null);}}>
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
                <label className="text-sm font-semibold mb-2 block" htmlFor="program-field-36">Teks Sumber Soal</label>
                <textarea id="program-field-36"
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
          </ProgramDialog>
      )}

        </div>
      </div>
    </div>
  );
}
