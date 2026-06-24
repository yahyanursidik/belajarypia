import type { Program } from "./organization";

export type Batch = {
  id: string;
  program_id: string;
  code: string;
  name: string;
  status: "draft" | "active" | "archived";
};

export type ClassGroup = {
  id: string;
  program_id: string;
  batch_id: string | null;
  code: string;
  name: string;
  status: "active" | "archived";
};

export type Halaqah = {
  id: string;
  class_id: string;
  code: string;
  name: string;
  status: "active" | "archived";
};

export type Participant = {
  id: string;
  user_id: string | null;
  global_participant_number: string;
  display_name: string;
  status: "active" | "inactive" | "archived";
};

export type Enrollment = {
  id: string;
  participant_id: string;
  program_id: string;
  batch_id: string | null;
  class_id: string | null;
  halaqah_id: string | null;
  enrollment_number: string;
  enrollment_status: "pending" | "active" | "hold" | "completed" | "cancelled";
  payment_status: string;
  programs?: Pick<Program, "id" | "name" | "code" | "feature_flags"> | null;
  batches?: Pick<Batch, "name" | "code"> | null;
  classes?: Pick<ClassGroup, "name" | "code"> | null;
  halaqahs?: Pick<Halaqah, "name" | "code"> | null;
};

export type OnboardingProgress = {
  id: string;
  enrollment_id: string;
  status: "not_started" | "in_progress" | "completed";
  onboarding_steps?: Array<{
    step_key: string;
    title: string;
    description: string | null;
    order_no: number;
  }>;
};

export type WhatsappGroup = {
  id: string;
  scope_type: "program" | "batch" | "class" | "halaqah";
  scope_id: string;
  group_name: string;
  invite_link: string;
  is_active: boolean;
};
