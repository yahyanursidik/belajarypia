import { supabase } from "./supabase";
import type { Enrollment } from "./enrollment";
import type { Lesson, ProgramModule } from "./academic";

export type LessonProgress = {
  id: string;
  enrollment_id: string;
  participant_id: string;
  lesson_id: string;
  status: "started" | "completed";
  score: number | null;
  started_at: string;
  completed_at: string | null;
};

export type QuizAttempt = {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  attempt_number: number;
  score: number | null;
  status: "ongoing" | "submitted" | "abandoned";
  started_at: string;
  submitted_at: string | null;
};

export type GradingRubricItem = {
  min_score: number;
  max_score: number;
  label: string;
};

export type TranscriptData = {
  enrollment: Enrollment & { participants?: { display_name: string; global_participant_number: string } };
  modules: ProgramModule[];
  lessons: Lesson[];
  progress: LessonProgress[];
  finalGrade: number | null;
  predicate: string | null;
};

export function calculateGradePredicate(score: number | null, rubric?: GradingRubricItem[]): string | null {
  if (score === null || isNaN(score)) return null;
  
  if (!rubric || rubric.length === 0) {
    // default rubric if none provided in DB
    const defaultRubric: GradingRubricItem[] = [
      { min_score: 90, max_score: 100, label: "Mumtaz (Istimewa)" },
      { min_score: 80, max_score: 89.9, label: "Jayyid Jiddan (Baik Sekali)" },
      { min_score: 65, max_score: 79.9, label: "Jayyid (Baik)" },
      { min_score: 40, max_score: 64.9, label: "Maqbul (Cukup)" },
      { min_score: 0, max_score: 39.9, label: "Rasib (Gagal/Mengulang)" }
    ];
    rubric = defaultRubric;
  }
  
  for (const item of rubric) {
    if (score >= item.min_score && score <= item.max_score) {
      return item.label;
    }
  }
  
  return null;
}

export async function fetchTranscriptData(enrollmentId: string): Promise<TranscriptData | null> {
  // 1. Fetch enrollment
  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("*, programs(id, name, code, grading_rubric), batches(name, code), classes(name, code), halaqahs(name, code), participants(display_name, global_participant_number)")
    .eq("id", enrollmentId)
    .single();

  if (enrollmentError || !enrollmentData) return null;
  const enrollment = enrollmentData as unknown as Enrollment & { participants: any };

  // 2. Fetch modules
  const { data: modulesData } = await supabase
    .from("program_modules")
    .select("id, program_id, parent_module_id, level_id, code, title, module_type, order_no, is_required, levels(code, name)")
    .eq("program_id", enrollment.program_id)
    .order("order_no");

  const modules = (modulesData ?? []) as any as ProgramModule[];

  // 3. Fetch lessons
  let lessons: Lesson[] = [];
  if (modules.length > 0) {
    const moduleIds = modules.map(m => m.id);
    const { data: lessonsData } = await supabase
      .from("lessons")
      .select("id, module_id, code, title, lesson_type, content_format, order_no, visibility_status")
      .in("module_id", moduleIds)
      .order("order_no");
    lessons = (lessonsData ?? []) as Lesson[];
  }

  // 4. Fetch progress
  const { data: progressData } = await supabase
    .from("lesson_progresses")
    .select("*")
    .eq("enrollment_id", enrollmentId);
    
  const progress = (progressData ?? []) as LessonProgress[];

  // 5. Calculate Final Grade
  // Use simple average of all lesson scores that have a score.
  let totalScore = 0;
  let scoredLessonsCount = 0;
  
  progress.forEach(p => {
    if (p.score !== null && p.score !== undefined) {
      totalScore += Number(p.score);
      scoredLessonsCount++;
    }
  });

  const finalGrade = scoredLessonsCount > 0 ? (totalScore / scoredLessonsCount) : null;
  
  // 6. Get predicate
  const rawRubric = (enrollment as any).programs?.grading_rubric;
  let rubric: GradingRubricItem[] | undefined = undefined;
  if (Array.isArray(rawRubric)) {
    rubric = rawRubric as GradingRubricItem[];
  }
  const predicate = calculateGradePredicate(finalGrade, rubric);

  return {
    enrollment,
    modules,
    lessons,
    progress,
    finalGrade,
    predicate
  };
}
