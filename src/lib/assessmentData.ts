import { supabase } from "./supabase";
import type {
  AssessmentEnrollment,
  AssessmentItem,
  AssessmentLesson,
  AssessmentProgram,
} from "./assessmentWorkspace";
const context =
  "lessons!inner(id,module_id,title,lesson_type,passing_grade,program_modules!inner(id,title,program_id,programs!inner(id,name,code))),enrollments!inner(id,participant_id,program_id,enrollment_number,participants!inner(id,display_name,global_participant_number))";
type Joined = {
  id: string;
  score: number | null;
  status: string;
  attempt_number?: number;
  submitted_at?: string | null;
  completed_at?: string | null;
  lessons: AssessmentLesson;
  enrollments: AssessmentEnrollment;
};
export async function loadAssessmentQueue(signal: AbortSignal) {
  const page = async <T>(
    factory: (
      offset: number,
    ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  ) => {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await factory(offset);
      if (result.error) throw result.error;
      rows.push(...((result.data ?? []) as T[]));
      if ((result.data?.length ?? 0) < 500) return rows;
    }
  };
  const [programs, attempts, assignments] = await Promise.all([
    page<AssessmentProgram>((offset) =>
      supabase
        .from("programs")
        .select("id,name,code")
        .order("name")
        .order("id")
        .range(offset, offset + 499)
        .abortSignal(signal),
    ),
    page<Joined>((offset) =>
      supabase
        .from("quiz_attempts")
        .select(`id,score,status,attempt_number,submitted_at,${context}`)
        .in("status", ["submitted", "pending_review", "graded"])
        .order("submitted_at", { ascending: true })
        .order("id")
        .range(offset, offset + 499)
        .abortSignal(signal),
    ),
    page<Joined>((offset) =>
      supabase
        .from("lesson_progresses")
        .select(`id,score,status,completed_at,${context}`)
        .eq("lessons.lesson_type", "assignment")
        .eq("status", "completed")
        .order("id")
        .range(offset, offset + 499)
        .abortSignal(signal),
    ),
  ]);
  const convert = (
    row: Joined,
    kind: AssessmentItem["kind"],
  ): AssessmentItem => ({
    id: row.id,
    kind,
    lesson: row.lessons,
    enrollment: row.enrollments,
    score: row.score,
    status: row.status,
    attemptNumber: row.attempt_number ?? 1,
    submittedAt: row.submitted_at ?? row.completed_at ?? null,
  });
  return {
    programs,
    items: [
      ...attempts.map((row) => convert(row, "quiz")),
      ...assignments.map((row) => convert(row, "assignment")),
    ],
  };
}
