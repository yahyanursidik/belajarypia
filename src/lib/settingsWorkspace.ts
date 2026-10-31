import type { SystemSettings } from "./settings";
import { THEMES, type PortalThemeConfig } from "./theme.ts";
export const defaultPortalThemes: PortalThemeConfig = {
  admin: "slate",
  learner: "emerald",
  teacher: "indigo",
  mentor: "rose",
  public: "amber",
};
export const portalColorNames = {
  indigo: "Biru",
  emerald: "Hijau",
  rose: "Merah hangat",
  amber: "Emas",
  slate: "Abu-abu",
} as const;
export const portalNames: Record<keyof PortalThemeConfig, string> = {
  admin: "Admin & sistem",
  learner: "Peserta & wali",
  teacher: "Pengajar",
  mentor: "Musyrif",
  public: "Portal publik",
};
export const settingsSections = [
  { id: "overview", label: "Ikhtisar" },
  { id: "identity", label: "Identitas & kontak" },
  { id: "branding", label: "Tampilan & logo" },
  { id: "themes", label: "Warna portal" },
  { id: "connections", label: "Pengaturan terkait" },
] as const;
export type SettingsSection = (typeof settingsSections)[number]["id"];
export const settingFields = {
  institution_name: { label: "Nama lembaga", section: "identity", max: 160 },
  institution_profile: {
    label: "Profil singkat",
    section: "identity",
    max: 1500,
  },
  contact_email: { label: "Email bantuan", section: "identity", max: 254 },
  contact_phone: { label: "WhatsApp bantuan", section: "identity", max: 32 },
  address: { label: "Alamat", section: "identity", max: 1000 },
  app_sidebar_title: { label: "Judul sidebar", section: "branding", max: 60 },
  app_sidebar_subtitle: {
    label: "Subjudul sidebar",
    section: "branding",
    max: 100,
  },
  system_header_title: {
    label: "Judul pusat kendali",
    section: "branding",
    max: 100,
  },
  system_header_subtitle: {
    label: "Subjudul pusat kendali",
    section: "branding",
    max: 180,
  },
  logo_url: { label: "Logo utama", section: "branding", max: 2000 },
  login_logo_url: { label: "Logo login", section: "branding", max: 2000 },
  favicon_url: { label: "Ikon tab browser", section: "branding", max: 2000 },
} as const;
export type SettingField = keyof typeof settingFields;
export type SettingsDraft = Pick<SystemSettings, SettingField> & {
  portal_themes: PortalThemeConfig;
};
export function normalizeThemes(value: unknown): PortalThemeConfig {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    Object.entries(defaultPortalThemes).map(([key, fallback]) => [
      key,
      typeof raw[key] === "string" && Object.hasOwn(THEMES, raw[key] as string)
        ? raw[key]
        : fallback,
    ]),
  ) as PortalThemeConfig;
}
export function settingsDraft(settings: SystemSettings): SettingsDraft {
  return {
    ...Object.fromEntries(
      Object.keys(settingFields).map((k) => [
        k,
        settings[k as SettingField] ?? null,
      ]),
    ),
    portal_themes: normalizeThemes(settings.portal_themes),
  } as SettingsDraft;
}
export function cleanSettings(draft: SettingsDraft): SettingsDraft {
  return {
    ...Object.fromEntries(
      Object.keys(settingFields).map((k) => [
        k,
        typeof draft[k as SettingField] === "string"
          ? draft[k as SettingField]!.trim() || null
          : null,
      ]),
    ),
    portal_themes: normalizeThemes(draft.portal_themes),
  } as SettingsDraft;
}
export function settingsChanges(saved: SystemSettings, draft: SettingsDraft) {
  const next = cleanSettings(draft),
    before = cleanSettings(settingsDraft(saved));
  const changes: Array<{
    key: SettingField | keyof PortalThemeConfig;
    label: string;
    before: string;
    after: string;
    section: string;
  }> = [];
  for (const [k, config] of Object.entries(settingFields)) {
    const key = k as SettingField;
    if ((before[key] ?? null) !== (next[key] ?? null))
      changes.push({
        key,
        label: config.label,
        before: before[key] || "Belum diisi",
        after: next[key] || "Dikosongkan",
        section: config.section,
      });
  }
  for (const key of Object.keys(defaultPortalThemes) as Array<
    keyof PortalThemeConfig
  >)
    if (before.portal_themes[key] !== next.portal_themes[key])
      changes.push({
        key,
        label: "Warna " + portalNames[key],
        before: portalColorNames[before.portal_themes[key]],
        after: portalColorNames[next.portal_themes[key]],
        section: "themes",
      });
  return changes;
}
export function settingsPatch(saved: SystemSettings, draft: SettingsDraft) {
  const next = cleanSettings(draft);
  const keys = settingsChanges(saved, draft)
    .filter((c) => c.section !== "themes")
    .map((c) => c.key as SettingField);
  const patch: Record<string, unknown> = Object.fromEntries(
    keys.map((k) => [k, next[k]]),
  );
  if (settingsChanges(saved, draft).some((c) => c.section === "themes"))
    patch.portal_themes = next.portal_themes;
  return patch;
}
export function validAssetUrl(value: string | null | undefined) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !Array.from(value).some((c) => c.charCodeAt(0) <= 32)
    );
  } catch {
    return false;
  }
}
export function normalizeContactPhone(value: string | null | undefined) {
  if (!value) return null;
  let s = value.replace(/[\s()+.-]/g, "");
  if (!/^\d{8,15}$/.test(s)) return null;
  if (s.startsWith("0")) s = "62" + s.slice(1);
  return s.length <= 15 ? s : null;
}
export function settingsContacts(
  value: Pick<SystemSettings, "contact_email" | "contact_phone"> | null,
) {
  const phone = normalizeContactPhone(value?.contact_phone);
  const email = value?.contact_email?.trim();
  return {
    whatsapp: phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent("Assalamu’alaikum Admin, saya membutuhkan bantuan LMS.")}`
      : null,
    email:
      email && /^[^\s@?<>:;]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(email)
        ? `mailto:${encodeURIComponent(email)}?subject=Bantuan%20LMS`
        : null,
  };
}
export function validateSettings(draft: SettingsDraft) {
  const errors: Partial<Record<SettingField, string>> = {};
  const clean = cleanSettings(draft);
  for (const [k, c] of Object.entries(settingFields)) {
    const key = k as SettingField;
    if ((clean[key]?.length ?? 0) > c.max)
      errors[key] = `Maksimal ${c.max.toLocaleString("id-ID")} karakter.`;
  }
  if (!clean.institution_name) errors.institution_name = "Isi nama lembaga.";
  if (
    clean.contact_email &&
    !/^[^\s@?<>:;]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(clean.contact_email)
  )
    errors.contact_email = "Masukkan email yang valid.";
  if (clean.contact_phone && !normalizeContactPhone(clean.contact_phone))
    errors.contact_phone = "Gunakan 8–15 digit, misalnya 0812… atau +62812….";
  for (const key of ["logo_url", "login_logo_url", "favicon_url"] as const)
    if (!validAssetUrl(clean[key]))
      errors[key] = "Gunakan URL HTTPS tanpa kredensial.";
  return errors;
}
export function settingsFileError(file: Pick<File, "name" | "type" | "size">) {
  if (file.size <= 0 || file.size > 2097152)
    return "Ukuran gambar harus lebih dari 0 dan maksimal 2 MB.";
  const suffix = file.name.split(".").pop()?.toLowerCase();
  if (
    !(
      {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
      } as Record<string, string>
    )[suffix ?? ""] ||
    (
      {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
      } as Record<string, string>
    )[suffix ?? ""] !== file.type
  )
    return "Gunakan gambar PNG, JPG, atau WebP.";
  return "";
}
export function settingsError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (/failed to fetch|network|load failed/i.test(e?.message ?? ""))
    return "Koneksi terputus. Periksa jaringan lalu coba lagi.";
  if (
    e?.code === "PGRST202" ||
    /schema cache|could not find.*function/i.test(e?.message ?? "")
  )
    return "Layanan pengaturan belum siap. Hubungi pengelola sistem.";
  return e?.message || "Pengaturan belum dapat diproses. Coba lagi.";
}
