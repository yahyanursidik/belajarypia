import { supabase } from "./supabase";
import type { PortalThemeConfig } from "./theme";

export type SystemSettings = {
  id: string;
  institution_name: string;
  institution_profile: string | null;
  app_sidebar_title?: string | null;
  app_sidebar_subtitle?: string | null;
  system_header_title?: string | null;
  system_header_subtitle?: string | null;
  logo_url: string | null;
  login_logo_url: string | null;
  favicon_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  portal_themes?: PortalThemeConfig;
  transcript_header_text?: string | null;
  transcript_place_date_text?: string | null;
  transcript_official_name?: string | null;
  transcript_official_title?: string | null;
  transcript_signature_url?: string | null;
  created_at: string;
  updated_at: string;
};

export const emptySettings: SystemSettings = {
  id: "",
  institution_name: "YPIA",
  institution_profile: null,
  app_sidebar_title: "YPIA",
  app_sidebar_subtitle: "Portal Pembelajaran",
  system_header_title: "Pusat Kendali Sistem",
  system_header_subtitle: "Tata Kelola & Pemantauan LMS",
  logo_url: null,
  login_logo_url: null,
  favicon_url: null,
  contact_email: null,
  contact_phone: null,
  address: null,
  portal_themes: {
    admin: "slate",
    learner: "emerald",
    teacher: "indigo",
    mentor: "rose",
    public: "amber",
  },
  transcript_header_text: null,
  transcript_place_date_text: "Jakarta, ",
  transcript_official_name: null,
  transcript_official_title: null,
  transcript_signature_url: null,
  created_at: "",
  updated_at: "",
};

export async function readSystemSettings(): Promise<SystemSettings | null> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .limit(2);
  if (error) throw error;
  if ((data?.length ?? 0) > 1)
    throw new Error("Ditemukan konfigurasi ganda. Hubungi pengelola sistem.");
  return (data?.[0] as SystemSettings) ?? null;
}
export async function fetchSystemSettings(): Promise<SystemSettings | null> {
  try {
    return await readSystemSettings();
  } catch {
    return null;
  }
}
export async function updateSystemSettings(
  id: string,
  payload: Partial<SystemSettings>,
  expectedUpdatedAt?: string,
): Promise<{ data: SystemSettings | null; error: Error | null }> {
  try {
    if (!expectedUpdatedAt)
      throw new Error(
        "Versi pengaturan tidak tersedia. Muat ulang terlebih dahulu.",
      );
    const { data, error } = await supabase.rpc("admin_save_system_settings", {
      p_id: id,
      p_payload: payload,
      p_expected_updated_at: expectedUpdatedAt,
      p_request_key: crypto.randomUUID(),
    });
    if (error) throw error;
    if (!data?.id || data.id !== id)
      throw new Error("Hasil simpan belum terkonfirmasi.");
    window.dispatchEvent(new Event("ypia-system-settings-updated"));
    return { data: data as SystemSettings, error: null };
  } catch (e) {
    return {
      data: null,
      error: new Error(
        (e as Error).message || "Pengaturan belum dapat disimpan.",
      ),
    };
  }
}
