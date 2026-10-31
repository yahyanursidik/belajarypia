export type TeachingProgram = {
  id: string;
  name: string;
  code: string;
  status: string;
};
export type TeachingClass = {
  id: string;
  program_id: string;
  name: string;
  code: string;
};
export type TeachingEnrollment = {
  id: string;
  program_id: string;
  class_id: string | null;
  enrollment_number: string;
  enrollment_status: string;
  participants: {
    display_name: string;
    global_participant_number: string;
  } | null;
};
export type TeachingLesson = {
  id: string;
  module_id: string;
  visibility_status: string;
  release_at: string | null;
};
export type TeachingProgress = {
  enrollment_id: string;
  lesson_id: string;
  status: string;
  completed_at: string | null;
};
export function teachingProgress(
  enrollment: TeachingEnrollment,
  lessons: TeachingLesson[],
  progress: TeachingProgress[],
  now = Date.now(),
) {
  const available = new Set(
    lessons
      .filter(
        (l) =>
          l.visibility_status === "published" &&
          (!l.release_at || Date.parse(l.release_at) <= now),
      )
      .map((l) => l.id),
  );
  const completed = new Set(
    progress
      .filter(
        (p) =>
          p.enrollment_id === enrollment.id &&
          p.status === "completed" &&
          available.has(p.lesson_id),
      )
      .map((p) => p.lesson_id),
  );
  return {
    total: available.size,
    completed: completed.size,
    percent: available.size
      ? Math.round((completed.size / available.size) * 100)
      : null,
  };
}
