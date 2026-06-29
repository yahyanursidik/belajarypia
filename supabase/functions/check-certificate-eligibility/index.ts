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
    const { program_id, batch_id } = await request.json();
    if (!program_id) throw new Error("program_id is required");

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
    
    // Fetch enrollments
    let query = supabase.from("enrollments").select(`
      id,
      enrollment_number,
      enrollment_status,
      participant_id,
      participants (
        id,
        display_name,
        global_participant_number
      )
    `).eq("program_id", program_id);

    if (batch_id) {
      query = query.eq("batch_id", batch_id);
    }

    const { data: enrollments, error } = await query;
    if (error) throw error;

    // Fetch existing jobs to avoid double queue
    const { data: existingJobs } = await supabase
      .from("certificate_generation_jobs")
      .select("enrollment_id")
      .in("status", ["pending", "processing", "completed"])
      .in("enrollment_id", enrollments.map((e: any) => e.id));
      
    const queuedEnrollments = new Set(existingJobs?.map((j: any) => j.enrollment_id) || []);

    const eligible = [];
    const notEligible = [];

    for (const enr of enrollments) {
      const isActiveOrCompleted = ["active", "completed"].includes(enr.enrollment_status);
      const isAlreadyQueued = queuedEnrollments.has(enr.id);

      if (isActiveOrCompleted && !isAlreadyQueued) {
        eligible.push(enr);
      } else {
        notEligible.push({
          ...enr,
          reason: isAlreadyQueued ? "Already queued or generated" : "Status not active/completed"
        });
      }
    }

    return new Response(JSON.stringify({ eligible, notEligible }), {
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
