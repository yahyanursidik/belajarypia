import type { ProfileWorkspace } from "./profileWorkspace";
import { profileValidation } from "./profileWorkspace.ts";
import { validDateKey, wibDateKey } from "./dateRange.ts";
export type LearnerProfileData = {
  account: ProfileWorkspace;
  revision: string;
  participant: {
    id: string;
    user_id: string;
    display_name: string;
    global_participant_number: string;
    phone: string | null;
    gender: string | null;
    city: string | null;
    birth_date: string | null;
    education_level: string | null;
    participant_type: string;
    status: string;
    updated_at: string;
  } | null;
  history: { id: string; created_at: string; fields: string[] }[];
};
export type LearnerProfileDraft = {
  full_name: string;
  display_name: string;
  phone: string;
  city: string;
  gender: string;
  birth_date: string;
  education_level: string;
};
export const learnerProfileLabels: Record<keyof LearnerProfileDraft, string> = {
  full_name: "Nama lengkap",
  display_name: "Nama tampilan",
  phone: "Nomor telepon",
  city: "Kota domisili",
  gender: "Jenis kelamin",
  birth_date: "Tanggal lahir",
  education_level: "Pendidikan",
};
const gender = (value: string | null | undefined) =>
  value === "Laki-laki"
    ? "male"
    : value === "Perempuan"
      ? "female"
      : (value ?? "");
export function learnerProfileDraft(
  d: LearnerProfileData,
): LearnerProfileDraft {
  return {
    full_name: d.account.profile.full_name ?? "",
    phone: d.account.profile.phone ?? d.participant?.phone ?? "",
    display_name: d.participant?.display_name ?? "",
    city: d.participant?.city ?? "",
    gender: gender(d.participant?.gender),
    birth_date: d.participant?.birth_date ?? "",
    education_level: d.participant?.education_level ?? "",
  };
}
export function learnerProfilePatch(
  d: LearnerProfileData,
  draft: LearnerProfileDraft,
) {
  const initial = learnerProfileDraft(d),
    patch: Partial<Record<keyof LearnerProfileDraft, string | null>> = {};
  for (const key of Object.keys(initial) as (keyof LearnerProfileDraft)[])
    if (draft[key].trim() !== initial[key].trim())
      patch[key] =
        draft[key].trim() ||
        (["full_name", "display_name"].includes(key) ? "" : null);
  return patch;
}
export function learnerProfileValidation(
  draft: LearnerProfileDraft,
  step: number,
  participant: boolean,
) {
  if (step === 1 || step === 3) {
    if (
      draft.full_name.trim().length < 2 ||
      draft.full_name.trim().length > 160
    )
      return "Nama lengkap harus 2–160 karakter.";
    if (
      participant &&
      (draft.display_name.trim().length < 2 ||
        draft.display_name.trim().length > 160)
    )
      return "Nama tampilan harus 2–160 karakter.";
  }
  if (step === 2 || step === 3) {
    const contact = profileValidation({ phone: draft.phone.trim() || null });
    if (contact) return contact;
    if (draft.city.trim().length > 120)
      return "Kota domisili maksimal 120 karakter.";
    if (draft.education_level.trim().length > 80)
      return "Pendidikan maksimal 80 karakter.";
    if (
      draft.birth_date &&
      (!validDateKey(draft.birth_date) ||
        draft.birth_date < "1900-01-01" ||
        draft.birth_date > wibDateKey(new Date().toISOString()))
    )
      return "Periksa tanggal lahir. Gunakan tanggal antara 1900 dan hari ini.";
  }
  return "";
}
export const learnerProfileValue = (key: string, value: string | null) =>
  !value
    ? "Belum diisi"
    : key === "gender"
      ? ({ male: "Laki-laki", female: "Perempuan" }[value] ?? value)
      : value;
