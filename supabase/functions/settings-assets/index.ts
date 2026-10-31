import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { createS3SignedUrl, requiredEnv } from "../_shared/s3.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (!["GET", "POST"].includes(request.method))
    return json({ error: "Metode tidak didukung." }, 405);
  try {
    const base = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
    if (request.method === "GET") {
      const id = new URL(request.url).searchParams.get("asset");
      if (!id || !uuid.test(id))
        return json({ error: "Gambar tidak tersedia." }, 404);
      const admin = createClient(
        base,
        requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      );
      const { data: asset, error } = await admin
        .from("system_brand_assets")
        .select("object_key,public_url")
        .eq("id", id)
        .maybeSingle();
      if (error || !asset)
        return json({ error: "Gambar tidak tersedia." }, 404);
      const { data: settings, error: problem } = await admin
        .from("system_settings")
        .select("logo_url,login_logo_url,favicon_url")
        .limit(2);
      if (
        problem ||
        settings?.length !== 1 ||
        ![
          settings[0].logo_url,
          settings[0].login_logo_url,
          settings[0].favicon_url,
        ].includes(asset.public_url)
      )
        return json({ error: "Gambar tidak tersedia." }, 404);
      // Only images explicitly selected as current public branding are readable.
      const url = await createS3SignedUrl({
        method: "GET",
        objectKey: asset.object_key,
      });
      return new Response(null, {
        status: 302,
        headers: {
          ...cors,
          Location: url,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Silakan masuk kembali." }, 401);
    const db = createClient(base, requiredEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
    });
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth.user)
      return json({ error: "Sesi tidak valid." }, 401);
    const { data: allowed, error: roleError } = await db.rpc(
      "settings_can_manage",
    );
    if (roleError || allowed !== true)
      return json(
        { error: "Hanya superadmin aktif yang dapat mengunggah branding." },
        403,
      );
    if (!request.headers.get("Content-Type")?.startsWith("multipart/form-data"))
      return json({ error: "Pilih berkas gambar." }, 400);
    const length = Number(request.headers.get("Content-Length"));
    if (length > 2113536)
      return json({ error: "Ukuran gambar maksimal 2 MB." }, 400);
    if (!request.body) return json({ error: "Pilih berkas gambar." }, 400);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.length;
        if (total > 2113536)
          return json({ error: "Ukuran gambar maksimal 2 MB." }, 400);
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel();
    }
    const raw = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      raw.set(chunk, offset);
      offset += chunk.length;
    }
    const form = await new Response(raw, {
      headers: { "Content-Type": request.headers.get("Content-Type")! },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0 || file.size > 2097152)
      return json(
        { error: "Ukuran gambar harus lebih dari 0 dan maksimal 2 MB." },
        400,
      );
    const extensions: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };
    const ext = extensions[file.type];
    const suffix = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !(ext === suffix || (ext === "jpg" && suffix === "jpeg")))
      return json({ error: "Gunakan PNG, JPG, atau WebP." }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = new TextDecoder().decode(bytes.subarray(0, 32));
    const valid =
      file.type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
        : file.type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : text.startsWith("RIFF") && text.slice(8, 12) === "WEBP";
    if (!valid)
      return json({ error: "Isi berkas bukan gambar yang sesuai." }, 400);
    const id = crypto.randomUUID();
    const objectKey = `branding/${id}.${ext}`;
    const response = await fetch(
      await createS3SignedUrl({
        method: "PUT",
        objectKey,
        contentType: file.type,
        acl: "private",
      }),
      {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-amz-acl": "private" },
        body: bytes,
      },
    );
    if (!response.ok) throw Error("upload failed");
    const admin = createClient(base, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const { data, error } = await admin.rpc("settings_register_brand_asset", {
      p_user: auth.user.id,
      p_id: id,
      p_key: objectKey,
      p_url: `${base}/functions/v1/settings-assets?asset=${id}`,
      p_mime: file.type,
      p_size: file.size,
    });
    if (error || !data?.asset_id) throw Error("registration failed");
    return json(data);
  } catch {
    return json({ error: "Gambar belum dapat diproses. Coba lagi." }, 500);
  }
});
