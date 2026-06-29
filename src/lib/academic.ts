import type { Program } from "./organization";

export type AcademicStatus = "draft" | "active" | "archived";
export type LessonVisibilityStatus = "draft" | "published" | "locked" | "archived";

export type StaffProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type Level = {
  id: string;
  program_id: string;
  parent_level_id: string | null;
  code: string;
  name: string;
  order_no: number;
};

export type ProgramModule = {
  id: string;
  program_id: string;
  parent_module_id: string | null;
  level_id: string | null;
  code: string;
  title: string;
  module_type: string;
  order_no: number;
  is_required: boolean;
  levels?: Pick<Level, "name" | "code"> | null;
};

export type Lesson = {
  id: string;
  module_id: string;
  code: string;
  title: string;
  lesson_type: string;
  content_format?: "plain_text" | "markdown" | "html";
  content_body?: string | null;
  external_url?: string | null;
  order_no: number;
  release_at: string | null;
  due_at: string | null;
  visibility_status: LessonVisibilityStatus;
  passing_grade?: number | null;
  duration_minutes?: number | null;
  max_attempts?: number | null;
  is_strict_mode?: boolean | null;
  max_tab_switches?: number | null;
  randomized_questions_count?: number | null;
  program_modules?: Pick<ProgramModule, "id" | "title" | "code" | "program_id"> & {
    programs?: Pick<Program, "name" | "code"> | null;
  };
};

export type LessonPrerequisite = {
  id: string;
  lesson_id: string;
  prerequisite_lesson_id: string;
  rule_type: string;
};

export type DocumentFile = {
  id: string;
  lesson_id: string;
  source_type: "object_storage" | "external_link";
  storage_provider: string;
  bucket_name: string | null;
  object_key: string | null;
  external_url: string | null;
  display_name: string;
  description: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  file_category: "document" | "pdf" | "audio" | "video" | "link" | "other";
  access_level: "staff_only" | "enrolled";
  status: "draft" | "active" | "archived";
  uploaded_by: string | null;
  created_at: string;
};

export type AcademicBatch = {
  id: string;
  program_id: string;
  code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: AcademicStatus;
};

export type AcademicClass = {
  id: string;
  program_id: string;
  batch_id: string | null;
  code: string;
  name: string;
  capacity: number | null;
  teacher_user_id: string | null;
  status: "active" | "archived";
};

export type AcademicHalaqah = {
  id: string;
  class_id: string;
  code: string;
  name: string;
  capacity: number | null;
  mentor_user_id: string | null;
  status: "active" | "archived";
};

export type QuestionBank = {
  id: string;
  program_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type QuestionBankItem = {
  id: string;
  question_bank_id: string;
  question_type: string;
  question_text: string;
  options: string[] | any;
  correct_answer: string | null;
  explanation: string | null;
  points: number;
};

export type QuizQuestion = {
  id: string;
  lesson_id: string;
  question_type: string;
  question_text: string;
  options: string[] | any;
  correct_answer: string | null;
  explanation: string | null;
  order_no: number;
  points: number;
};
