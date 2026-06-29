import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { program_id, batch_id, template_id, enrollments } = await request.json();
    if (!program_id || !template_id || !enrollments || !Array.isArray(enrollments)) {
      throw new Error("Invalid payload");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authorization = request.headers.get("Authorization");
    
    if (!authorization) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) throw new Error("Unauthorized");
    
    // Create batch
    const { data: batch, error: batchError } = await supabase
      .from("certificate_issuance_batches")
      .insert({
        program_id,
        batch_id,
        template_id,
        created_by: user.user.id,
        status: "pending",
        total_jobs: enrollments.length
      })
      .select()
      .single();

    if (batchError) throw batchError;

    // Create jobs
    const jobs = enrollments.map((enr: any) => ({
      issuance_batch_id: batch.id,
      enrollment_id: enr.enrollment_id,
      participant_id: enr.participant_id,
      template_id,
      status: "pending"
    }));

    const { error: jobsError } = await supabase
      .from("certificate_generation_jobs")
      .insert(jobs);

    if (jobsError) throw jobsError;

    return new Response(JSON.stringify({ success: true, batch }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
