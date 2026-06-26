export type OrganizationStatus = "active" | "archived";
export type ProgramStatus = "draft" | "active" | "archived";

export type MvpFeatureFlagKey =
  | "use_payment"
  | "use_whatsapp_group"
  | "use_quran_engine"
  | "use_forum"
  | "use_certificate"
  | "use_live_session"
  | "use_parent_portal"
  | "use_assignment"
  | "use_attendance"
  | "use_document_upload"
  | "use_ai_assist"
  | "use_audio_submission"
  | "use_video_submission"
  | "use_direct_enrollment"
  | "use_custom_enrollment_number";

export type MvpFeatureFlags = Record<MvpFeatureFlagKey, boolean> & {
  payment_type?: "free" | "spp";
  payment_amount?: number;
};

export type GradingRubricItem = {
  min_score: number;
  max_score: number;
  label: string;
};

export type Organization = {
  id: string;
  name: string;
  legal_name: string | null;
  status: OrganizationStatus;
};

export type Unit = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  status: OrganizationStatus;
  organizations?: Pick<Organization, "name"> | null;
};

export type Program = {
  id: string;
  unit_id: string;
  code: string;
  name: string;
  description: string | null;
  syllabus?: string | null;
  program_type: string;
  curriculum_model: string;
  delivery_mode: string;
  status: ProgramStatus;
  feature_flags: MvpFeatureFlags;
  grading_rubric?: GradingRubricItem[] | null;
  units?: Pick<Unit, "name" | "code"> | null;
};

export const defaultMvpFeatureFlags: MvpFeatureFlags = {
  use_payment: false,
  use_whatsapp_group: false,
  use_quran_engine: false,
  use_forum: false,
  use_certificate: false,
  use_live_session: false,
  use_parent_portal: false,
  use_assignment: false,
  use_attendance: false,
  use_document_upload: false,
  use_ai_assist: false,
  use_audio_submission: false,
  use_video_submission: false,
  use_direct_enrollment: false,
  use_custom_enrollment_number: false,
  payment_type: "free",
  payment_amount: 0,
};

export const mvpFeatureFlagLabels: Record<MvpFeatureFlagKey, string> = {
  use_payment: "Pembayaran",
  use_whatsapp_group: "Grup WhatsApp",
  use_quran_engine: "Qur'an",
  use_forum: "Forum",
  use_certificate: "Sertifikat",
  use_live_session: "Sesi Live",
  use_parent_portal: "Portal Wali",
  use_assignment: "Tugas",
  use_attendance: "Presensi",
  use_document_upload: "Upload Dokumen",
  use_ai_assist: "AI Assist",
  use_audio_submission: "Audio Submission",
  use_video_submission: "Video Submission",
  use_direct_enrollment: "Pendaftaran Langsung",
  use_custom_enrollment_number: "NIM Kustom Otomatis",
};

export const allowedMvpFeatureFlags = Object.keys(
  defaultMvpFeatureFlags,
) as MvpFeatureFlagKey[];

export function mergeWithDefaultFeatureFlags(
  flags: Partial<MvpFeatureFlags> | null | undefined,
): MvpFeatureFlags {
  return {
    ...defaultMvpFeatureFlags,
    ...(flags ?? {}),
    use_ai_assist: false,
    use_audio_submission: false,
    use_video_submission: false,
  };
}
