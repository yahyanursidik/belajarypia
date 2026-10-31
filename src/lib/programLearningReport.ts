export type ReportLesson = {
  id: string;
  lesson_type: string;
  visibility_status: string;
  passing_grade?: number | null;
};
export type ReportProgress = {
  lesson_id: string;
  status: string;
  score: number | null;
  updated_at?: string;
};
export function summarizeProgramLearning(
  lessons: ReportLesson[],
  progress: ReportProgress[],
) {
  const published = lessons.filter(
    (lesson) => lesson.visibility_status === "published",
  );
  const lessonIds = new Set(published.map((lesson) => lesson.id));
  const latest = new Map<string, ReportProgress>();
  for (const row of progress) {
    if (!lessonIds.has(row.lesson_id)) continue;
    const previous = latest.get(row.lesson_id);
    if (
      !previous ||
      !previous.updated_at ||
      !row.updated_at ||
      row.updated_at >= previous.updated_at
    )
      latest.set(row.lesson_id, row);
  }
  const completed = published.filter(
    (lesson) => latest.get(lesson.id)?.status === "completed",
  ).length;
  const assessments = published.filter((lesson) =>
    ["quiz", "exam"].includes(lesson.lesson_type),
  );
  const scores = assessments
    .map((lesson) => latest.get(lesson.id))
    .filter((row): row is ReportProgress =>
      Boolean(
        row &&
        row.status === "completed" &&
        row.score !== null &&
        Number.isFinite(Number(row.score)) &&
        Number(row.score) >= 0 &&
        Number(row.score) <= 100,
      ),
    )
    .map((row) => Number(row.score));
  return {
    total: published.length,
    completed,
    percent: published.length
      ? Math.min(100, (completed / published.length) * 100)
      : 0,
    averageScore: scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null,
    scoredAssessments: scores.length,
    assessments,
    latest,
  };
}
