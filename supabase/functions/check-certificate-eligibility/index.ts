import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
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
    const { program_id, batch_id } = await request.json();
    const db = await authenticatedClient(request, createClient);
    const { data, error } = await db.rpc(
      "admin_check_certificate_eligibility",
      { p_program_id: program_id, p_batch_id: batch_id || null },
    );
    if (error) throw error;
    return jsonResponse({
      eligible: data.filter((r: { eligible: boolean }) => r.eligible),
      notEligible: data.filter((r: { eligible: boolean }) => !r.eligible),
    });
  } catch (error) {
    return errorResponse(error);
  }
});
