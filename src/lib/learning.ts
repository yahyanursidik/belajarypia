export type LessonProgressStatus = "started" | "completed";
export type QuizAttemptStatus = "ongoing" | "submitted" | "pending_review" | "graded" | "abandoned";

export type LessonProgress = {
  id: string;
  enrollment_id: string;
  participant_id: string;
  lesson_id: string;
  status: LessonProgressStatus;
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
  status: QuizAttemptStatus;
  started_at: string;
  submitted_at: string | null;
  graded_by?: string | null;
  graded_at?: string | null;
  grader_feedback?: string | null;
};

export type QuizAttemptAnswer = {
  id: string;
  quiz_attempt_id: string;
  question_id: string;
  selected_option: string | null;
  essay_answer?: string | null;
  is_correct: boolean | null;
  points_earned: number;
  grader_feedback?: string | null;
  graded_by?: string | null;
  graded_at?: string | null;
};
