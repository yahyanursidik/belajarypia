export type LessonProgressStatus = "started" | "completed";
export type QuizAttemptStatus = "ongoing" | "submitted" | "abandoned";

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
};

export type QuizAttemptAnswer = {
  id: string;
  quiz_attempt_id: string;
  question_id: string;
  selected_option: string | null;
  is_correct: boolean | null;
  points_earned: number;
};
