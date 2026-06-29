import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { createS3SignedUrl, requiredEnv } from "../_shared/s3.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { certificate_id } = await request.json();
    if (!certificate_id) throw new Error("certificate_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authorization = request.headers.get("Authorization");
    
    if (!authorization) throw new Error("No authorization header");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) throw new Error("Unauthorized");

    // Fetch the certificate. RLS will ensure they can only see it if they are allowed
    const { data: cert, error: certError } = await supabase
      .from("certificates")
      .select("id, object_key")
      .eq("id", certificate_id)
      .single();

    if (certError || !cert) throw new Error("Certificate not found or access denied");
    
    if (!cert.object_key) {
      throw new Error("Certificate document is not ready");
    }

    const signedUrl = await createS3SignedUrl({
      method: "GET",
      objectKey: cert.object_key,
    });

    await supabase.from("certificate_download_logs").insert({
      certificate_id: cert.id,
      user_id: user.user.id,
      ip_address: request.headers.get("x-forwarded-for") || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return new Response(JSON.stringify({ signedUrl }), {
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
