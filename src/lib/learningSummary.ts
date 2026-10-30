import { supabase } from './supabase';
import { summarizeLearning, type LearningModule, type LearningLesson, type LearningProgress, type LearningPrerequisite } from './learningProgress';

export async function fetchLearningSummary(programId: string, enrollmentId: string, signal?: AbortSignal) {
  const modulesResult = await supabase.from('program_modules').select('id, order_no').eq('program_id', programId).abortSignal(signal ?? new AbortController().signal);
  if (modulesResult.error) throw modulesResult.error;
  const modules = (modulesResult.data ?? []) as LearningModule[];
  if (!modules.length) return summarizeLearning([], [], []);
  const [lessonResult, progressResult] = await Promise.all([
    supabase.from('lessons').select('id, module_id, title, lesson_type, order_no, due_at').in('module_id', modules.map((m) => m.id)).eq('visibility_status', 'published').or(`release_at.lte.${new Date().toISOString()},release_at.is.null`).abortSignal(signal ?? new AbortController().signal),
    supabase.from('lesson_progresses').select('lesson_id,status').eq('enrollment_id', enrollmentId).abortSignal(signal ?? new AbortController().signal),
  ]);
  if (lessonResult.error || progressResult.error) throw lessonResult.error ?? progressResult.error;
  const lessons = (lessonResult.data ?? []) as LearningLesson[];
  let prerequisites: LearningPrerequisite[] = [];
  if (lessons.length) {
    const result = await supabase.from('lesson_prerequisites').select('lesson_id,prerequisite_lesson_id').in('lesson_id', lessons.map((l) => l.id)).abortSignal(signal ?? new AbortController().signal);
    if (result.error) throw result.error;
    prerequisites = result.data ?? [];
  }
  return summarizeLearning(modules, lessons, (progressResult.data ?? []) as LearningProgress[], prerequisites);
}
