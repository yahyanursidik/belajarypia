import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

type SignedUrlRequest =
  | {
      operation: "upload";
      context?: "lesson" | "system";
      lesson_id?: string;
      file_name: string;
      mime_type?: string;
    }
  | {
      operation: "download";
      file_id: string;
    };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as SignedUrlRequest;
    const authorization = request.headers.get("Authorization") ?? "";
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (body.operation === "upload") {
      const context = body.context || "lesson";
      let objectKey = "";

      if (context === "system") {
        const { data: isSuperAdmin, error } = await supabase.rpc("is_super_admin");
        if (error || !isSuperAdmin) {
          return json({ error: "Tidak memiliki akses upload sistem." }, 403);
        }
        objectKey = buildSystemObjectKey(body.file_name);
      } else {
        if (!body.lesson_id) {
          return json({ error: "lesson_id required for lesson context" }, 400);
        }
        const { data: canManage, error } = await supabase.rpc("can_manage_lesson_content", {
          target_lesson_id: body.lesson_id,
        });

        if (error || !canManage) {
          return json({ error: "Tidak memiliki akses upload untuk lesson ini." }, 403);
        }
        objectKey = buildObjectKey(body.lesson_id, body.file_name);
      }

      const signedUrl = await createS3SignedUrl({
        method: "PUT",
        objectKey,
        contentType: body.mime_type || "application/octet-stream",
      });

      const endpoint = requiredEnv("S3_ENDPOINT").replace(/\/+$/g, "");
      const bucket = requiredEnv("S3_BUCKET");
      const publicUrl = `${endpoint}/${bucket}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;

      return json({
        bucket,
        objectKey,
        signedUrl,
        publicUrl,
        expiresIn: Number(Deno.env.get("S3_SIGNED_URL_EXPIRES_SECONDS") ?? "900"),
      });
    }

    const { data: canAccess, error: accessError } = await supabase.rpc(
      "can_access_document_file",
      { target_file_id: body.file_id },
    );

    if (accessError || !canAccess) {
      return json({ error: "Tidak memiliki akses ke file ini." }, 403);
    }

    const { data: file, error: fileError } = await supabase
      .from("document_files")
      .select("source_type, object_key, external_url")
      .eq("id", body.file_id)
      .single();

    if (fileError || !file) {
      return json({ error: "File tidak ditemukan." }, 404);
    }

    if (file.source_type === "external_link") {
      return json({ signedUrl: file.external_url, external: true });
    }

    const signedUrl = await createS3SignedUrl({
      method: "GET",
      objectKey: file.object_key,
    });

    return json({
      signedUrl,
      expiresIn: Number(Deno.env.get("S3_SIGNED_URL_EXPIRES_SECONDS") ?? "900"),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function requiredEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
}

function buildObjectKey(lessonId: string, fileName: string) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return `lessons/${lessonId}/${crypto.randomUUID()}-${safeName || "file"}`;
}

function buildSystemObjectKey(fileName: string) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return `system/${crypto.randomUUID()}-${safeName || "file"}`;
}

async function createS3SignedUrl({
  method,
  objectKey,
  contentType,
}: {
  method: "GET" | "PUT";
  objectKey: string;
  contentType?: string;
}) {
  const endpoint = requiredEnv("S3_ENDPOINT").replace(/\/+$/g, "");
  const region = Deno.env.get("S3_REGION") ?? "us-east-1";
  const bucket = requiredEnv("S3_BUCKET");
  const accessKeyId = requiredEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("S3_SECRET_ACCESS_KEY");
  const expires = Deno.env.get("S3_SIGNED_URL_EXPIRES_SECONDS") ?? "900";
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const host = new URL(endpoint).host;
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  const canonicalUri = `/${bucket}/${encodedKey}`;
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const signedHeaders = method === "PUT" ? "content-type;host" : "host";
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expires,
    "X-Amz-SignedHeaders": signedHeaders,
  });
  const canonicalQueryString = query.toString().replace(/\+/g, "%20");
  const canonicalHeaders =
    method === "PUT"
      ? `content-type:${contentType}\nhost:${host}\n`
      : `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, "s3");
  const signature = await hmacHex(signingKey, stringToSign);

  return `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(hash);
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

async function hmacHex(key: ArrayBuffer | Uint8Array, value: string) {
  return toHex(await hmac(key, value));
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string,
) {
  const kDate = await hmac(encoder.encode(`AWS4${key}`), dateStamp);
  const kRegion = await hmac(kDate, regionName);
  const kService = await hmac(kRegion, serviceName);
  return hmac(kService, "aws4_request");
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
