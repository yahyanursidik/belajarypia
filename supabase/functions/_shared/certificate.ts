import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
export const errorResponse = (error: unknown) =>
  jsonResponse(
    {
      error:
        (error as { message?: string }).message ??
        "Permintaan sertifikat belum berhasil.",
    },
    400,
  );
export async function authenticatedClient(
  request: Request,
  factory: typeof createClient,
) {
  if (request.method !== "POST") throw new Error("Gunakan metode POST.");
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new Error("Sesi tidak tersedia.");
  const db = factory(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authorization } } },
  );
  const { data, error } = await db.auth.getUser();
  if (error || !data.user)
    throw new Error("Sesi tidak valid. Silakan masuk kembali.");
  return db;
}
export function certificateRenderLayout(data: Record<string, unknown>) {
  const legacyName = data.recipient_name as
    { x?: number; y?: number } | undefined;
  const legacyNo = data.certificate_number as
    { x?: number; y?: number } | undefined;
  return {
    name_x: Number(data.name_x ?? legacyName?.x ?? 120),
    name_y: Number(data.name_y ?? legacyName?.y ?? 300),
    name_size: Number(data.name_size ?? 32),
    no_x: Number(data.no_x ?? legacyNo?.x ?? 120),
    no_y: Number(data.no_y ?? legacyNo?.y ?? 250),
    no_size: Number(data.no_size ?? 14),
  };
}
