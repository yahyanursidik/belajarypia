import type { Program } from "./organization";

export type ApplicantStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "revision_requested"
  | "accepted"
  | "rejected";

export type RegistrationFieldType = "text" | "textarea" | "email" | "phone" | "select";

export type GroupSettings = {
  platform: "whatsapp" | "telegram" | "none";
  separated_gender: boolean;
  ikhwan_groups: { name: string; link: string }[];
  akhwat_groups: { name: string; link: string }[];
  general_groups: { name: string; link: string }[];
};

export type RegistrationForm = {
  id: string;
  program_id: string | null;
  title: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  group_settings?: GroupSettings | null;
};

export type RegistrationFormField = {
  id: string;
  form_id: string;
  field_key: string;
  label: string;
  field_type: RegistrationFieldType;
  is_required: boolean;
  options_json: string[] | null;
  order_no: number;
};

export type Applicant = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string | null;
  gender: string | null;
  birth_date: string | null;
  source_channel: string | null;
  status: ApplicantStatus;
  submitted_at: string;
  created_at: string;
};

export type ApplicantAnswer = {
  id: string;
  applicant_id: string;
  form_field_key: string;
  value_text: string | null;
  value_json: unknown;
};

export type ApplicantProgramChoice = {
  id: string;
  applicant_id: string;
  program_id: string;
  preferred_schedule: string | null;
  notes: string | null;
  applicants?: Applicant | null;
  programs?: Pick<Program, "id" | "code" | "name" | "status"> | null;
};

export const applicantStatusLabels: Record<ApplicantStatus, string> = {
  draft: "Draft",
  submitted: "Masuk",
  under_review: "Direview",
  revision_requested: "Perlu Revisi",
  accepted: "Diterima",
  rejected: "Ditolak",
};

export const defaultRegistrationFields: Omit<
  RegistrationFormField,
  "id" | "form_id" | "order_no"
>[] = [
  {
    field_key: "motivation",
    label: "Motivasi mengikuti program",
    field_type: "textarea",
    is_required: true,
    options_json: null,
  },
  {
    field_key: "learning_goal",
    label: "Target belajar",
    field_type: "textarea",
    is_required: false,
    options_json: null,
  },
  {
    field_key: "schedule_preference",
    label: "Preferensi jadwal",
    field_type: "text",
    is_required: false,
    options_json: null,
  },
];
