import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type AdmissionSubmission = {
  captcha_token?: string;
  p_program_id?: string;
  p_full_name?: string;
  p_email?: string;
  p_phone?: string;
  p_city?: string | null;
  p_gender?: string | null;
  p_birth_date?: string | null;
  p_answers?: unknown[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await request.json()) as AdmissionSubmission;
    if (!body.captcha_token) {
      return json({ error: "Selesaikan verifikasi keamanan sebelum mengirimkan formulir." }, 400);
    }

    if (!body.p_program_id || !body.p_full_name || !body.p_email || !body.p_phone) {
      return json({ error: "Data pendaftaran wajib belum lengkap." }, 400);
    }

    const turnstileResult = await verifyTurnstile(
      body.captcha_token,
      request.headers.get("CF-Connecting-IP"),
    );
    if (!turnstileResult.success || turnstileResult.action !== "program_admission") {
      return json({ error: "Verifikasi keamanan gagal atau kedaluwarsa. Silakan ulangi verifikasi." }, 400);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
    const authorization = request.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();

    const adminClient = createClient(supabaseUrl, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const { data: applicantId, error: submissionError } = await adminClient.rpc(
      "submit_program_application",
      {
        p_program_id: body.p_program_id,
        p_full_name: body.p_full_name,
        p_email: body.p_email,
        p_phone: body.p_phone,
        p_city: body.p_city ?? null,
        p_gender: body.p_gender ?? null,
        p_birth_date: body.p_birth_date ?? null,
        p_answers: body.p_answers ?? [],
        p_submitter_id: user?.id ?? null,
        p_submitter_email: user?.email ?? null,
      },
    );

    if (submissionError) {
      return json({ error: submissionError.message }, 400);
    }

    return json({ applicant_id: applicantId });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan pada layanan pendaftaran." },
      500,
    );
  }
});

async function verifyTurnstile(token: string, remoteip: string | null) {
  const formData = new FormData();
  formData.append("secret", requiredEnv("TURNSTILE_SECRET_KEY"));
  formData.append("response", token);
  if (remoteip) {
    formData.append("remoteip", remoteip);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Layanan verifikasi keamanan tidak dapat dihubungi.");
  }

  return (await response.json()) as { success: boolean; action?: string };
}

function requiredEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
