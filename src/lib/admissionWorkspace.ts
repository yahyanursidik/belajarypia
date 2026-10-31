import type {
  Applicant,
  ApplicantStatus,
  GroupSettings,
  RegistrationForm,
  RegistrationFormField,
} from "./admission.ts";
import {
  getRegistrationWindowState,
  normalizeGroupSettings,
  selectRegistrationForm,
} from "./admission.ts";
export type AdmissionProgram = {
  id: string;
  code: string;
  name: string;
  status: string;
  curriculum_model: string;
  feature_flags: { use_direct_enrollment?: boolean };
};
export type ApplicationRow = {
  id: string;
  applicant_id: string;
  program_id: string;
  preferred_schedule: string | null;
  notes: string | null;
  created_at: string;
  review_status?: ApplicantStatus | null;
  review_updated_at?: string | null;
  participant_id?: string | null;
  enrollment_id?: string | null;
  applicants: Applicant;
  programs: AdmissionProgram | null;
};
export type AdmissionForm = RegistrationForm & {
  created_at: string;
  updated_at?: string;
};
export type AdmissionField = Pick<
  RegistrationFormField,
  | "field_key"
  | "label"
  | "field_type"
  | "is_required"
  | "options_json"
  | "order_no"
> & { id?: string };
export type FormDraft = {
  id: string | null;
  updated_at: string | null;
  title: string;
  description: string;
  status: RegistrationForm["status"];
  registration_open_at: string | null;
  registration_close_at: string | null;
  direct: boolean;
  fields: AdmissionField[];
  group_settings: GroupSettings;
};
export const admissionStatusTone: Record<ApplicantStatus, string> = {
  draft: "slate",
  submitted: "blue",
  under_review: "violet",
  revision_requested: "amber",
  accepted: "emerald",
  rejected: "rose",
};
export const admissionWindowLabels = {
  draft: "Draf",
  upcoming: "Terjadwal",
  open: "Dibuka",
  closed: "Ditutup",
  archived: "Arsip",
  unconfigured: "Belum ada formulir",
  direct: "Daftar langsung",
  inactive: "Program nonaktif",
};
export const applicationStatus = (row: ApplicationRow): ApplicantStatus =>
  row.review_status ?? row.applicants.status;
export const pendingAdmission = (status: ApplicantStatus) =>
  ["submitted", "under_review", "revision_requested"].includes(status);
export function filterApplications(
  rows: ApplicationRow[],
  program: string,
  status: string,
  query: string,
) {
  const search = query.trim().toLocaleLowerCase("id-ID");
  return rows.filter(
    (row) =>
      (program === "all" || row.program_id === program) &&
      (status === "all" ||
        (status === "pending"
          ? pendingAdmission(applicationStatus(row))
          : applicationStatus(row) === status)) &&
      (!search ||
        [
          row.applicants.full_name,
          row.applicants.email,
          row.applicants.phone,
          row.programs?.name,
          row.programs?.code,
        ]
          .join(" ")
          .toLocaleLowerCase("id-ID")
          .includes(search)),
  );
}
export function summarizeApplications(rows: ApplicationRow[]) {
  return {
    total: rows.length,
    people: new Set(rows.map((row) => row.applicant_id)).size,
    pending: rows.filter((row) => pendingAdmission(applicationStatus(row)))
      .length,
    submitted: rows.filter((row) => applicationStatus(row) === "submitted")
      .length,
    under_review: rows.filter(
      (row) => applicationStatus(row) === "under_review",
    ).length,
    revision_requested: rows.filter(
      (row) => applicationStatus(row) === "revision_requested",
    ).length,
    accepted: rows.filter((row) => applicationStatus(row) === "accepted")
      .length,
    rejected: rows.filter((row) => applicationStatus(row) === "rejected")
      .length,
  };
}
export function latestProgramForms(forms: AdmissionForm[]) {
  const map = new Map<string, AdmissionForm>();
  for (const form of [...forms].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  )) {
    if (form.program_id && !map.has(form.program_id))
      map.set(form.program_id, form);
  }
  return map;
}
export function programAdmissionState(
  program: AdmissionProgram,
  form?: AdmissionForm,
  availableForms?: AdmissionForm[],
) {
  if (program.status !== "active") return "inactive";
  if (program.feature_flags?.use_direct_enrollment) return "direct";
  const publicForm = availableForms
    ? selectRegistrationForm(availableForms, program.id)
    : null;
  return publicForm
    ? getRegistrationWindowState(publicForm)
    : form
      ? getRegistrationWindowState(form)
      : "unconfigured";
}
export function admissionPage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
export function draftFromForm(
  form: AdmissionForm | null,
  program: AdmissionProgram,
  fields: AdmissionField[],
): FormDraft {
  return {
    id: form?.id ?? null,
    updated_at: form?.updated_at ?? null,
    title: form?.title ?? `Pendaftaran ${program.name}`,
    description: form?.description ?? "",
    status: form?.status ?? "draft",
    registration_open_at: form?.registration_open_at ?? null,
    registration_close_at: form?.registration_close_at ?? null,
    direct: program.feature_flags?.use_direct_enrollment === true,
    fields,
    group_settings: normalizeGroupSettings(form?.group_settings),
  };
}
export function validHttpLink(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export function validateAdmissionDraft(
  draft: FormDraft,
  program: AdmissionProgram,
): string | null {
  if (!draft.title.trim()) return "Judul formulir wajib diisi.";
  if (draft.status === "active" && !draft.direct && program.status !== "active")
    return "Aktifkan program sebelum membuka formulir.";
  const open = draft.registration_open_at
      ? Date.parse(draft.registration_open_at)
      : null,
    close = draft.registration_close_at
      ? Date.parse(draft.registration_close_at)
      : null;
  if (
    (open !== null && !Number.isFinite(open)) ||
    (close !== null && !Number.isFinite(close))
  )
    return "Waktu pendaftaran tidak valid.";
  if (open !== null && close !== null && close <= open)
    return "Waktu tutup harus setelah waktu buka.";
  const keys = new Set<string>();
  for (const field of draft.fields) {
    if (!field.label.trim()) return "Lengkapi judul setiap pertanyaan.";
    if (keys.has(field.field_key)) return "Pertanyaan memiliki kode yang sama.";
    keys.add(field.field_key);
    if (field.field_type === "select") {
      const options = (field.options_json ?? []).map((v) => v.trim());
      if (
        options.length < 2 ||
        options.some((v) => !v) ||
        new Set(options.map((v) => v.toLowerCase())).size !== options.length
      )
        return `Isi minimal dua pilihan berbeda untuk “${field.label}”.`;
    }
  }
  const groups = draft.group_settings;
  if (groups.platform !== "none") {
    const buckets = groups.separated_gender
      ? (["ikhwan_groups", "akhwat_groups", "general_groups"] as const)
      : (["general_groups"] as const);
    let total = 0;
    for (const bucket of buckets) {
      for (const group of groups[bucket]) {
        total++;
        if (!group.name.trim() || !validHttpLink(group.link))
          return "Lengkapi nama dan tautan HTTP/HTTPS setiap grup.";
        if (
          group.click_limit !== null &&
          group.click_limit !== undefined &&
          (!Number.isSafeInteger(group.click_limit) || group.click_limit < 0)
        )
          return "Batas pemakaian grup harus bilangan bulat mulai dari 0.";
      }
    }
    if (!total) return "Tambahkan tautan grup atau pilih Tanpa grup.";
  }
  return null;
}
export function admissionMutationError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e.code === "PGRST202" || e.code === "42703")
    return "Pembaruan fitur pendaftaran belum tersedia di server.";
  if (e.code === "23505")
    return "Data sudah tercatat. Muat ulang sebelum melanjutkan.";
  if (e.code === "42501")
    return "Anda tidak memiliki akses untuk tindakan ini.";
  return e.message?.match(/^[A-Z]/) &&
    !e.message.includes("relation") &&
    !e.message.includes("schema")
    ? e.message
    : "Perubahan belum tersimpan. Coba lagi.";
}
export function confirmedAdmissionResult(
  data: unknown,
  requireEnrollment = false,
) {
  const value = data as {
    choice_id?: string;
    status?: string;
    participant_id?: string;
    enrollment_id?: string;
    enrollment_action?: string;
    account_linked?: boolean;
  };
  if (!value?.choice_id || !value.status)
    throw new Error(
      "Server belum mengonfirmasi keputusan. Muat ulang sebelum mengulang.",
    );
  if (requireEnrollment && (!value.participant_id || !value.enrollment_id))
    throw new Error("Server belum mengonfirmasi peserta dan enrollment.");
  return value;
}
