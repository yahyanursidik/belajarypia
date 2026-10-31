import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { createS3SignedUrl } from "../_shared/s3.ts";
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  authenticatedClient,
} from "../_shared/certificate.ts";
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  try {
    const { certificate_id } = await request.json();
    if (!certificate_id) throw new Error("Pilih sertifikat.");
    const db = await authenticatedClient(request, createClient);
    const { data: cert, error } = await db
      .from("certificates")
      .select("id,object_key,status")
      .eq("id", certificate_id)
      .single();
    if (error || !cert)
      throw new Error("Sertifikat tidak tersedia atau akses ditolak.");
    if (cert.status !== "issued" || !cert.object_key)
      throw new Error("Dokumen belum terbit atau telah dicabut.");
    const signedUrl = await createS3SignedUrl({
      method: "GET",
      objectKey: cert.object_key,
    });
    const { data: user } = await db.auth.getUser();
    const log = await db.from("certificate_download_logs").insert({
      certificate_id: cert.id,
      user_id: user.user?.id,
      user_agent: request.headers.get("user-agent"),
    });
    if (log.error) throw new Error("Unduhan belum dapat dicatat. Coba lagi.");
    return jsonResponse({ signedUrl });
  } catch (error) {
    return errorResponse(error);
  }
});
