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
    }
  | {
      operation: "quiz_answer_upload";
      attempt_id: string;
      question_id: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: number;
    }
  | {
      operation: "quiz_answer_complete";
      attempt_id: string;
      question_id: string;
      bucket_name: string;
      object_key: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: number;
    }
  | {
      operation: "quiz_answer_download";
      file_id: string;
    }
  | {
      operation: "quiz_answer_delete";
      file_id: string;
    }
  | {
      operation: "board_image_upload";
      board_id: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: number;
    }
  | {
      operation: "board_image_download";
      post_id: string;
    }
  | {
      operation: "board_image_delete";
      board_id: string;
      object_key: string;
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
        acl: context === "system" ? "public-read" : undefined,
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

    if (body.operation === "quiz_answer_upload") {
      const { error } = await supabase.rpc("authorize_quiz_answer_file_upload", {
        p_attempt_id: body.attempt_id,
        p_question_id: body.question_id,
        p_file_name: body.file_name,
        p_mime_type: body.mime_type,
        p_file_size_bytes: body.file_size_bytes,
      });
      if (error) return json({ error: error.message }, 403);

      const objectKey = buildQuizAnswerObjectKey(user.id, body.attempt_id, body.question_id, body.file_name);
      const signedUrl = await createS3SignedUrl({
        method: "PUT",
        objectKey,
        contentType: body.mime_type,
      });
      return json({
        bucket: requiredEnv("S3_BUCKET"),
        objectKey,
        signedUrl,
        mimeType: body.mime_type,
        expiresIn: Number(Deno.env.get("S3_SIGNED_URL_EXPIRES_SECONDS") ?? "900"),
      });
    }

    if (body.operation === "quiz_answer_complete") {
      const { data, error } = await supabase.rpc("register_quiz_answer_file", {
        p_attempt_id: body.attempt_id,
        p_question_id: body.question_id,
        p_bucket_name: body.bucket_name,
        p_object_key: body.object_key,
        p_display_name: body.file_name,
        p_mime_type: body.mime_type,
        p_file_size_bytes: body.file_size_bytes,
      });
      if (error) return json({ error: error.message }, 403);
      return json(data);
    }

    if (body.operation === "quiz_answer_download") {
      const { data, error } = await supabase.rpc("get_quiz_answer_file_for_download", {
        p_file_id: body.file_id,
      });
      const file = Array.isArray(data) ? data[0] : data;
      if (error || !file) return json({ error: error?.message ?? "Lampiran tidak ditemukan." }, 403);
      return json({
        signedUrl: await createS3SignedUrl({ method: "GET", objectKey: file.object_key }),
        displayName: file.display_name,
        expiresIn: Number(Deno.env.get("S3_SIGNED_URL_EXPIRES_SECONDS") ?? "900"),
      });
    }

    if (body.operation === "quiz_answer_delete") {
      const { data: objectKey, error } = await supabase.rpc("delete_quiz_answer_file", {
        p_file_id: body.file_id,
      });
      if (error || !objectKey) return json({ error: error?.message ?? "Lampiran tidak ditemukan." }, 403);
      const deleteUrl = await createS3SignedUrl({ method: "DELETE", objectKey });
      const deleteResponse = await fetch(deleteUrl, { method: "DELETE" });
      return json({ deleted: true, storageCleanupPending: !deleteResponse.ok });
    }

    if (body.operation === "board_image_upload") {
      if (!isSupportedBoardImage(body.file_name, body.mime_type, body.file_size_bytes)) {
        return json({ error: "Gambar board harus JPG, PNG, atau WebP dengan ukuran maksimal 5 MB." }, 400);
      }
      const { data: canManage, error } = await supabase.rpc("can_manage_lesson_board", {
        target_board_id: body.board_id,
      });
      if (error || !canManage) return json({ error: "Tidak memiliki akses untuk mengelola board ini." }, 403);

      const objectKey = buildBoardImageObjectKey(body.board_id, body.file_name);
      return json({
        objectKey,
        mimeType: body.mime_type,
        signedUrl: await createS3SignedUrl({ method: "PUT", objectKey, contentType: body.mime_type }),
        expiresIn: Number(Deno.env.get("S3_SIGNED_URL_EXPIRES_SECONDS") ?? "900"),
      });
    }

    if (body.operation === "board_image_download") {
      const { data: objectKey, error } = await supabase.rpc("get_lesson_board_image_for_download", {
        p_post_id: body.post_id,
      });
      if (error || !objectKey) return json({ error: error?.message ?? "Gambar board tidak ditemukan." }, 403);
      return json({
        signedUrl: await createS3SignedUrl({ method: "GET", objectKey }),
        expiresIn: Number(Deno.env.get("S3_SIGNED_URL_EXPIRES_SECONDS") ?? "900"),
      });
    }

    if (body.operation === "board_image_delete") {
      const { data: canManage, error } = await supabase.rpc("can_manage_lesson_board", {
        target_board_id: body.board_id,
      });
      const expectedPrefix = `lesson-boards/${body.board_id}/`;
      if (error || !canManage || !body.object_key.startsWith(expectedPrefix)) {
        return json({ error: "Tidak memiliki akses untuk menghapus gambar board ini." }, 403);
      }
      const deleteUrl = await createS3SignedUrl({ method: "DELETE", objectKey: body.object_key });
      const response = await fetch(deleteUrl, { method: "DELETE" });
      return json({ deleted: response.ok, storageCleanupPending: !response.ok });
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

function buildQuizAnswerObjectKey(userId: string, attemptId: string, questionId: string, fileName: string) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `quiz-answers/${userId}/${attemptId}/${questionId}/${crypto.randomUUID()}-${safeName || "answer"}`;
}

function buildBoardImageObjectKey(boardId: string, fileName: string) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `lesson-boards/${boardId}/${crypto.randomUUID()}-${safeName || "image"}`;
}

function isSupportedBoardImage(fileName: string, mimeType: string, fileSize: number) {
  const extension = fileName.toLowerCase().split(".").pop();
  const allowed = new Map([
    ["jpg", "image/jpeg"],
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ]);
  return Number.isFinite(fileSize)
    && fileSize > 0
    && fileSize <= 5 * 1024 * 1024
    && allowed.get(extension ?? "") === mimeType.toLowerCase();
}

async function createS3SignedUrl({
  method,
  objectKey,
  contentType,
  acl,
}: {
  method: "GET" | "PUT" | "DELETE";
  objectKey: string;
  contentType?: string;
  acl?: string;
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
  let signedHeaders = method === "PUT" ? "content-type;host" : "host";
  if (acl && method === "PUT") {
    signedHeaders = "content-type;host;x-amz-acl";
  }
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expires,
    "X-Amz-SignedHeaders": signedHeaders,
  });
  const canonicalQueryString = query.toString().replace(/\+/g, "%20");
  let canonicalHeaders =
    method === "PUT"
      ? `content-type:${contentType}\nhost:${host}\n`
      : `host:${host}\n`;
  if (acl && method === "PUT") {
    canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-acl:${acl}\n`;
  }
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
