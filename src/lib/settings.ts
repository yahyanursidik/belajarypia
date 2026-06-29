import { supabase } from "./supabase";
import type { PortalThemeConfig } from "./theme";

export type SystemSettings = {
  id: string;
  institution_name: string;
  institution_profile: string | null;
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
  logo_url: null,
  login_logo_url: null,
  favicon_url: null,
  contact_email: null,
  contact_phone: null,
  address: null,
  portal_themes: { admin: "indigo", learner: "emerald", teacher: "rose", public: "amber" },
  transcript_header_text: null,
  transcript_place_date_text: "Jakarta, ",
  transcript_official_name: null,
  transcript_official_title: null,
  transcript_signature_url: null,
  created_at: "",
  updated_at: "",
};

export async function fetchSystemSettings(): Promise<SystemSettings | null> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to fetch system settings:", error?.message);
    return null;
  }

  return data as SystemSettings;
}

export async function updateSystemSettings(
  id: string,
  payload: Partial<SystemSettings>
): Promise<{ data: SystemSettings | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("system_settings")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as SystemSettings, error: null };
}
