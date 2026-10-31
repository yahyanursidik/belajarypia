import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
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
    const { program_id, batch_id, template_id, enrollments, request_key } =
      await request.json();
    if (!Array.isArray(enrollments) || !request_key)
      throw new Error("Pilih peserta dan sertakan identitas permintaan.");
    const db = await authenticatedClient(request, createClient);
    const { data, error } = await db.rpc("admin_create_certificate_batch", {
      p_program_id: program_id,
      p_batch_id: batch_id || null,
      p_template_id: template_id,
      p_enrollment_ids: enrollments.map(
        (e: { enrollment_id: string }) => e.enrollment_id,
      ),
      p_request_key: request_key,
    });
    if (error) throw error;
    return jsonResponse({ success: true, batch: data });
  } catch (error) {
    return errorResponse(error);
  }
});
