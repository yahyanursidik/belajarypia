export type AssessmentProgram = { id: string; name: string; code: string };
export type AssessmentLesson = {
  id: string;
  module_id: string;
  title: string;
  lesson_type: string;
  passing_grade: number | null;
  program_modules: {
    id: string;
    title: string;
    program_id: string;
    programs: AssessmentProgram;
  };
};
export type AssessmentEnrollment = {
  id: string;
  participant_id: string;
  program_id: string;
  enrollment_number: string;
  participants: {
    id: string;
    display_name: string;
    global_participant_number: string;
  };
};
export type AssessmentItem = {
  id: string;
  kind: "quiz" | "assignment";
  lesson: AssessmentLesson;
  enrollment: AssessmentEnrollment;
  score: number | null;
  status: string;
  attemptNumber: number;
  submittedAt: string | null;
};
export const assessmentStatusLabels = {
  pending: "Perlu dinilai",
  below: "Di bawah batas",
  passed: "Memenuhi batas",
  graded: "Sudah dinilai",
  recorded: "Progres tercatat",
  unavailable: "Nilai belum tersedia",
};
export function finiteScore(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
}
export function assessmentStatus(
  item: AssessmentItem,
): keyof typeof assessmentStatusLabels {
  if (item.kind === "quiz" && ["pending_review"].includes(item.status))
    return "pending";
  if (item.kind === "quiz" && item.status === "submitted") return "unavailable";
  const score = finiteScore(item.score);
  if (score === null)
    return item.kind === "assignment" ? "recorded" : "unavailable";
  const passing = finiteScore(item.lesson.passing_grade);
  return passing === null ? "graded" : score >= passing ? "passed" : "below";
}
export function assessmentDirectory(path: string, requested: string | null) {
  return requested === path || requested?.startsWith(path + "?")
    ? requested
    : path;
}
export function latestGradedItems(items: AssessmentItem[]) {
  const latest = new Map<string, AssessmentItem>();
  for (const item of items) {
    if (
      item.kind !== "quiz" ||
      item.status !== "graded" ||
      finiteScore(item.score) === null
    )
      continue;
    const key = `${item.enrollment.id}:${item.lesson.id}`;
    const previous = latest.get(key);
    if (
      !previous ||
      item.attemptNumber > previous.attemptNumber ||
      (item.attemptNumber === previous.attemptNumber &&
        (item.submittedAt ?? "") > (previous.submittedAt ?? ""))
    )
      latest.set(key, item);
  }
  return [...latest.values()];
}
export function assessmentSummary(items: AssessmentItem[]) {
  const final = latestGradedItems(items);
  return {
    total: items.length,
    pending: items.filter((item) => assessmentStatus(item) === "pending")
      .length,
    below: items.filter(
      (item) => item.kind === "quiz" && assessmentStatus(item) === "below",
    ).length,
    average: final.length
      ? final.reduce((sum, item) => sum + Number(item.score), 0) / final.length
      : null,
  };
}
export function filterAssessments(
  items: AssessmentItem[],
  filters: {
    program: string;
    lesson: string;
    status: string;
    kind: string;
    q: string;
    sort: string;
  },
) {
  const q = filters.q.toLowerCase().trim();
  return items
    .filter(
      (item) =>
        (filters.program === "all" ||
          item.lesson.program_modules.program_id === filters.program) &&
        (filters.lesson === "all" || item.lesson.id === filters.lesson) &&
        (filters.kind === "all" || item.kind === filters.kind) &&
        (filters.status === "all" ||
          assessmentStatus(item) === filters.status) &&
        (!q ||
          [
            item.lesson.title,
            item.lesson.program_modules.programs.name,
            item.enrollment.participants.display_name,
            item.enrollment.participants.global_participant_number,
            item.enrollment.enrollment_number,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    )
    .sort((a, b) => {
      const date = (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "");
      return (
        (filters.sort === "newest" ? -date : date) || a.id.localeCompare(b.id)
      );
    });
}
export type ReviewQuestion = {
  id: string;
  lesson_id?: string;
  question_type: "multiple_choice" | "essay";
  question_text: string;
  correct_answer: string | null;
  grading_guide: string | null;
  points: number;
  order_no: number;
};
export type ReviewAnswer = {
  id: string;
  question_id: string;
  selected_option: string | null;
  essay_answer: string | null;
  points_earned: number | null;
  grader_feedback: string | null;
  graded_at?: string | null;
};
export type GradeDraft = Record<string, { points: string; feedback: string }>;
export function reviewGradePayload(
  questions: ReviewQuestion[],
  answers: ReviewAnswer[],
  grades: GradeDraft,
) {
  const map = new Map(answers.map((answer) => [answer.question_id, answer]));
  return questions
    .filter((question) => question.question_type === "essay")
    .map((question, index) => {
      const answer = map.get(question.id);
      const input = answer ? grades[answer.id] : null;
      const points = input?.points.trim() ? Number(input.points) : NaN;
      if (
        !answer ||
        !Number.isFinite(points) ||
        points < 0 ||
        points > Number(question.points)
      )
        throw new Error(
          `Lengkapi poin esai ${index + 1}: 0 sampai ${question.points}.`,
        );
      return {
        answer_id: answer.id,
        points,
        feedback: input?.feedback.trim() ?? "",
      };
    });
}
export function reviewScorePreview(
  questions: ReviewQuestion[],
  answers: ReviewAnswer[],
  grades: GradeDraft,
) {
  let earned = 0,
    total = 0,
    reviewed = 0,
    essays = 0;
  const map = new Map(answers.map((answer) => [answer.question_id, answer]));
  for (const question of questions) {
    const answer = map.get(question.id);
    if (!answer) continue;
    total += Number(question.points);
    if (question.question_type === "essay") {
      essays++;
      const text = grades[answer.id]?.points ?? "";
      const points = text.trim() ? Number(text) : NaN;
      if (
        Number.isFinite(points) &&
        points >= 0 &&
        points <= Number(question.points)
      ) {
        earned += points;
        reviewed++;
      }
    } else earned += Number(answer.points_earned ?? 0);
  }
  return {
    earned,
    total,
    reviewed,
    essays,
    score:
      total > 0 && reviewed === essays
        ? Math.round((earned / total) * 10000) / 100
        : null,
  };
}
