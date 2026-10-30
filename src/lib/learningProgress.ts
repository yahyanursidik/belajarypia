export type LearningModule = { id: string; order_no: number };
export type LearningLesson = { id: string; module_id: string; title: string; order_no: number; lesson_type: string; due_at?: string | null };
export type LearningProgress = { lesson_id: string; status: string };
export type LearningPrerequisite = { lesson_id: string; prerequisite_lesson_id: string };

export function summarizeLearning(modules: LearningModule[], lessons: LearningLesson[], progress: LearningProgress[], prerequisites: LearningPrerequisite[] = []) {
  const ranks = new Map([...modules].sort((a, b) => a.order_no - b.order_no || a.id.localeCompare(b.id)).map((module, i) => [module.id, i]));
  const ordered = lessons.filter((lesson) => ranks.has(lesson.module_id)).sort((a, b) => (ranks.get(a.module_id)! - ranks.get(b.module_id)!) || a.order_no - b.order_no || a.id.localeCompare(b.id));
  const completed = new Set(progress.filter((row) => row.status === 'completed').map((row) => row.lesson_id));
  const done = ordered.filter((lesson) => completed.has(lesson.id)).length;
  const next = ordered.find((lesson) => !completed.has(lesson.id) && prerequisites.filter((row) => row.lesson_id === lesson.id).every((row) => completed.has(row.prerequisite_lesson_id))) ?? null;
  return { ordered, completed: done, total: ordered.length, percent: ordered.length ? Math.round(done / ordered.length * 100) : 0, next, finished: ordered.length > 0 && done === ordered.length };
}

export function canCompleteReading(type: string) {
  return ["content", "board", "text", "document", "pdf", "link", "video", "audio"].includes(type);
}
