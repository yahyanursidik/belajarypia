import type { Program } from "./organization";

export type ApplicantStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "revision_requested"
  | "accepted"
  | "rejected";

export type RegistrationFieldType = "text" | "textarea" | "email" | "phone" | "select" | "file";

export type RegistrationWindowState = "draft" | "upcoming" | "open" | "closed" | "archived";

export type GroupLinkSetting = {
  name: string;
  link: string;
  click_limit?: number | null;
};

export type GroupSettings = {
  platform: "whatsapp" | "telegram" | "none";
  separated_gender: boolean;
  ikhwan_groups: GroupLinkSetting[];
  akhwat_groups: GroupLinkSetting[];
  general_groups: GroupLinkSetting[];
};

export type RegistrationForm = {
  id: string;
  program_id: string | null;
  title: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  registration_open_at?: string | null;
  registration_close_at?: string | null;
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

export const defaultGroupSettings: GroupSettings = {
  platform: "none",
  separated_gender: false,
  ikhwan_groups: [],
  akhwat_groups: [],
  general_groups: [],
};

export function normalizeGroupSettings(settings: Partial<GroupSettings> | null | undefined): GroupSettings {
  return {
    ...defaultGroupSettings,
    ...(settings ?? {}),
    ikhwan_groups: (settings?.ikhwan_groups ?? []).map(normalizeGroupLink),
    akhwat_groups: (settings?.akhwat_groups ?? []).map(normalizeGroupLink),
    general_groups: (settings?.general_groups ?? []).map(normalizeGroupLink),
  };
}

function normalizeGroupLink(group: Partial<GroupLinkSetting>): GroupLinkSetting {
  return {
    name: group.name ?? "",
    link: group.link ?? "",
    click_limit:
      typeof group.click_limit === "number" && Number.isFinite(group.click_limit)
        ? group.click_limit
        : 500,
  };
}

export function getRegistrationWindowState(
  form: Pick<RegistrationForm, "status" | "registration_open_at" | "registration_close_at"> | null | undefined,
  now = new Date(),
): RegistrationWindowState {
  if (!form || form.status === "draft") {
    return "draft";
  }

  if (form.status === "archived") {
    return "archived";
  }

  const openAt = form.registration_open_at ? new Date(form.registration_open_at) : null;
  const closeAt = form.registration_close_at ? new Date(form.registration_close_at) : null;

  if (openAt && now < openAt) {
    return "upcoming";
  }

  if (closeAt && now > closeAt) {
    return "closed";
  }

  return "open";
}

export function isRegistrationOpen(
  form: Pick<RegistrationForm, "status" | "registration_open_at" | "registration_close_at"> | null | undefined,
): boolean {
  return getRegistrationWindowState(form) === "open";
}

export function formatRegistrationDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
