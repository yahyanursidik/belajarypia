import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { createS3SignedUrl, requiredEnv } from "../_shared/s3.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (request.method !== "POST") {
    return json({ error: "Gunakan metode POST." }, 405);
  }
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Silakan masuk kembali." }, 401);
    const db = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: user, error: authError } = await db.auth.getUser();
    if (authError || !user.user) {
      return json({ error: "Sesi tidak valid. Silakan masuk kembali." }, 401);
    }
    const body = await request.json();
    if (body.operation === "prepare") {
      const { data, error } = await db.rpc("assignment_prepare_file", {
        p_submission: body.submission_id,
        p_name: body.file_name,
        p_mime: body.mime_type,
        p_size: body.file_size,
      });
      if (error) throw error;
      const signedUrl = await createS3SignedUrl({
        method: "PUT",
        objectKey: data.object_key,
        contentType: data.mime_type,
      });
      return json({
        document_id: data.id,
        signedUrl,
        mime_type: data.mime_type,
      });
    }
    if (body.operation === "complete") {
      const { data: doc, error } = await db
        .from("assignment_files")
        .select("*")
        .eq("id", body.document_id)
        .eq("owner_id", user.user.id)
        .single();
      if (error || !doc) throw new Error("Dokumen bukan milik Anda.");
      if (doc.status === "ready") {
        return json({ document_id: doc.id, status: "ready" });
      }
      const content = await fetch(
        await createS3SignedUrl({ method: "GET", objectKey: doc.object_key }),
      );
      if (
        !content.ok ||
        !content.body ||
        (content.headers.get("content-type") ?? "").split(";")[0].trim() !==
          doc.mime_type
      ) {
        throw new Error(
          "Dokumen belum lengkap atau jenisnya berbeda. Unggah ulang.",
        );
      }
      const reader = content.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > 5242880 || size > Number(doc.file_size)) {
            throw new Error("Dokumen melebihi ukuran yang diizinkan.");
          }
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      if (size !== Number(doc.file_size)) {
        throw new Error("Dokumen belum lengkap. Unggah ulang.");
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const signature = bytes.subarray(0, 32);
      const text = new TextDecoder().decode(signature);
      const valid = doc.mime_type === "application/pdf"
        ? text.startsWith("%PDF-")
        : doc.mime_type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every(
          (b, i) => signature[i] === b,
        )
        : doc.mime_type === "image/jpeg"
        ? signature[0] === 255 &&
          signature[1] === 216 &&
          signature[2] === 255
        : doc.mime_type === "image/webp"
        ? text.startsWith("RIFF") && text.slice(8, 12) === "WEBP"
        : false;
      if (!valid) {
        throw new Error(
          "Dokumen tidak sesuai jenis berkas. Gunakan PDF atau gambar yang valid.",
        );
      }
      // The browser only receives a PUT URL for staging. Seal a distinct key so a
      // still-valid staging URL cannot overwrite evidence after verification.
      const sealedKey = `assignments/ready/${doc.id}/${crypto.randomUUID()}.${
        doc.file_name.split(".").pop()!.toLowerCase()
      }`;
      const copied = await fetch(
        await createS3SignedUrl({
          method: "PUT",
          objectKey: sealedKey,
          contentType: doc.mime_type,
        }),
        {
          method: "PUT",
          headers: { "Content-Type": doc.mime_type },
          body: bytes.buffer,
        },
      );
      if (!copied.ok) {
        throw new Error("Dokumen belum dapat diamankan. Coba lagi.");
      }
      const service = createClient(
        requiredEnv("SUPABASE_URL"),
        requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      );
      const marked = await service.rpc("assignment_mark_file_ready", {
        p_id: doc.id,
        p_owner: user.user.id,
        p_object_key: sealedKey,
      });
      if (marked.error) throw marked.error;
      return json({ document_id: doc.id, status: "ready" });
    }
    if (body.operation === "download") {
      const { data: doc, error } = await db.rpc("assignment_download_file", {
        p_id: body.document_id,
      });
      if (error || !doc) {
        throw new Error("Dokumen tidak tersedia atau akses ditolak.");
      }
      const signedUrl = await createS3SignedUrl({
        method: "GET",
        objectKey: doc.object_key,
      });
      return json({
        signedUrl,
        file_name: doc.file_name,
        mime_type: doc.mime_type,
      });
    }
    throw new Error("Operasi dokumen tidak dikenal.");
  } catch (problem) {
    const message = (problem as { message?: string }).message ?? "";
    return json(
      {
        error: /^(Akses|Gunakan|Dokumen|QR|Unggah|Sesi|Silakan|Operasi)/.test(
            message,
          )
          ? message
          : "Dokumen belum dapat diproses. Coba lagi.",
      },
      400,
    );
  }
});
