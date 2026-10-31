import type { UserAssignment } from "./usersWorkspace";
export type ProfileWorkspace = {
  generated_at: string;
  revision: string;
  profile: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  };
  login: {
    email: string | null;
    email_confirmed: boolean;
    last_sign_in_at: string | null;
    login_blocked: boolean;
    password_enabled: boolean;
    providers: string[];
  };
  assignments: UserAssignment[];
  history: { id: string; created_at: string; fields: string[] }[];
  saved?: boolean;
};
export type ProfileDraft = { full_name: string; phone: string };
export function profileDraft(data: ProfileWorkspace): ProfileDraft {
  return {
    full_name: data.profile.full_name ?? "",
    phone: data.profile.phone ?? "",
  };
}
export function profilePatch(data: ProfileWorkspace, draft: ProfileDraft) {
  const patch: Partial<{ full_name: string; phone: string | null }> = {};
  const name = draft.full_name.trim(),
    phone = draft.phone.trim() || null;
  if (name !== (data.profile.full_name ?? "").trim()) patch.full_name = name;
  if (phone !== (data.profile.phone?.trim() || null)) patch.phone = phone;
  return patch;
}
export function profileValidation(patch: ReturnType<typeof profilePatch>) {
  if (
    "full_name" in patch &&
    (patch.full_name!.length < 2 ||
      patch.full_name!.length > 160 ||
      Array.from(patch.full_name!).some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ))
  )
    return "Nama harus 2–160 karakter tanpa baris baru.";
  if (
    patch.phone &&
    (!/^\+?[0-9() .-]+$/.test(patch.phone) ||
      patch.phone.length > 32 ||
      patch.phone.replace(/[^0-9]/g, "").length < 7 ||
      patch.phone.replace(/[^0-9]/g, "").length > 20)
  )
    return "Nomor telepon harus berisi 7–20 digit.";
  return "";
}
export function profilePasswordValidation(
  password: string,
  confirmation: string,
) {
  if (password.length < 8) return "Kata sandi minimal 8 karakter.";
  if (password.length > 128) return "Kata sandi maksimal 128 karakter.";
  if (password !== confirmation) return "Konfirmasi kata sandi belum sama.";
  return "";
}
export function profileError(error: unknown) {
  const e = error as { message?: string; code?: string };
  if (
    /schema cache|could not find.*function|does not exist/i.test(
      e?.message ?? "",
    )
  )
    return "Pembaruan Profil belum tersedia di server.";
  return e?.message || "Profil belum dapat dimuat. Coba lagi.";
}
export function profilePasswordError(error: unknown) {
  const e = error as { code?: string };
  switch (e?.code) {
    case "weak_password":
      return "Kata sandi belum memenuhi ketentuan keamanan server.";
    case "same_password":
      return "Gunakan kata sandi yang berbeda dari sebelumnya.";
    case "reauthentication_needed":
    case "reauthentication_not_valid":
      return "Sesi perlu diverifikasi ulang. Keluar, masuk kembali, lalu ulangi.";
    case "session_not_found":
    case "refresh_token_not_found":
    case "bad_jwt":
      return "Sesi berakhir. Silakan masuk kembali.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
    default:
      return "Kata sandi belum dapat diubah. Periksa koneksi dan coba lagi.";
  }
}
export const profileFieldLabel = (key: string) =>
  ({ full_name: "Nama lengkap", phone: "Nomor telepon" })[key] ?? key;
export function profileInitial(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0] ?? "")
      .join("")
      .toUpperCase() || "A"
  );
}
