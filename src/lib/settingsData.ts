import { useRef } from "react";
import { supabase } from "./supabase";
import type { SystemSettings } from "./settings";
import { notifySystemSettingsChanged } from "./useSystemSettings";
export async function saveSettings(
  id: string,
  payload: Record<string, unknown>,
  expected: string,
  key: string,
) {
  const { data, error } = await supabase.rpc("admin_save_system_settings", {
    p_id: id,
    p_payload: payload,
    p_expected_updated_at: expected,
    p_request_key: key,
  });
  if (error) throw error;
  if (!data?.id || data.id !== id || !data.updated_at)
    throw Error(
      "Hasil simpan belum terkonfirmasi. Coba lagi dengan isian yang sama.",
    );
  notifySystemSettingsChanged();
  return data as SystemSettings;
}
export function useSettingsRequestKey() {
  const current = useRef<{ signature: string; key: string } | null>(null);
  return (value: unknown) => {
    const signature = JSON.stringify(value);
    if (current.current?.signature !== signature)
      current.current = { signature, key: crypto.randomUUID() };
    return current.current.key;
  };
}
export async function uploadBrandAsset(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data, error } = await supabase.functions.invoke("settings-assets", {
    body: form,
  });
  if (error)
    throw Error(
      "Gambar belum berhasil diunggah. Periksa koneksi lalu coba lagi.",
    );
  if (!data?.url || !data?.asset_id)
    throw Error("Unggahan belum terkonfirmasi.");
  return data.url as string;
}
