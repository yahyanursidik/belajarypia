import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { createS3SignedUrl, requiredEnv } from "../_shared/s3.ts";
import {
  certificateRenderLayout,
  jsonResponse,
  authenticatedClient,
  corsHeaders,
} from "../_shared/certificate.ts";
type Job = {
  id: string;
  claim_token: string;
  snapshot: {
    recipient_name: string;
    program_name: string;
    program_id: string;
    template_data_json: Record<string, unknown>;
    background_object_key: string | null;
  };
};
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return jsonResponse({ error: "Gunakan metode POST." }, 405);
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(requiredEnv("SUPABASE_URL"), serviceKey);
  let claimed: { data: unknown; error: unknown };
  try {
    const { batch_id } = await request.json();
    if (request.headers.get("Authorization") === `Bearer ${serviceKey}`) {
      claimed = await db.rpc("claim_certificate_jobs", {
        p_batch_id: batch_id || null,
      });
    } else {
      const caller = await authenticatedClient(request, createClient);
      if (!batch_id) throw new Error();
      claimed = await caller.rpc("admin_claim_certificate_jobs", {
        p_batch_id: batch_id,
      });
    }
    if (claimed.error) throw claimed.error;
  } catch {
    return jsonResponse(
      {
        error:
          "Akses pemrosesan antrean ditolak. Periksa sesi dan cakupan program.",
      },
      403,
    );
  }
  try {
    const data = claimed.data;
    const results = [];
    for (const job of (data ?? []) as Job[]) {
      try {
        const s = job.snapshot;
        if (!s?.recipient_name || !s.program_name || !s.program_id)
          throw new Error("Data penerbitan belum lengkap.");
        const layout = certificateRenderLayout(s.template_data_json ?? {});
        let pdf: PDFDocument;
        if (s.background_object_key) {
          if (
            !/\.pdf$/i.test(s.background_object_key) ||
            s.background_object_key.includes("://") ||
            s.background_object_key.includes("..")
          )
            throw new Error("Dokumen latar harus berupa PDF.");
          const url = await createS3SignedUrl({
            method: "GET",
            objectKey: s.background_object_key,
          });
          const res = await fetch(url);
          if (!res.ok) throw new Error("Dokumen latar belum dapat dibaca.");
          const bytes = await res.arrayBuffer();
          if (bytes.byteLength > 15 * 1024 * 1024)
            throw new Error("Ukuran PDF latar maksimal 15 MB.");
          pdf = await PDFDocument.load(bytes);
        } else {
          pdf = await PDFDocument.create();
          pdf.addPage([842, 595]);
        }
        const first = pdf.getPages()[0];
        if (!first) throw new Error("PDF latar tidak memiliki halaman.");
        const { width, height } = first.getSize();
        if (Math.abs(width - 842) > 3 || Math.abs(height - 595) > 3)
          throw new Error("Gunakan PDF A4 mendatar agar posisi teks sesuai.");
        for (const [key, value] of Object.entries(layout)) {
          const max = key.endsWith("_x")
            ? width
            : key.endsWith("_y")
              ? height
              : 72;
          if (
            !Number.isFinite(value) ||
            value < (key.endsWith("size") ? 6 : 0) ||
            value > max
          )
            throw new Error("Tata letak template di luar area dokumen.");
        }
        const font = await pdf.embedFont(StandardFonts.HelveticaBold),
          regular = await pdf.embedFont(StandardFonts.Helvetica);
        const num = `YPIA-SYH-${job.id.replaceAll("-", "").toUpperCase()}`;
        if (
          font.widthOfTextAtSize(s.recipient_name, layout.name_size) +
            layout.name_x >
            width ||
          regular.widthOfTextAtSize(`No: ${num}`, layout.no_size) +
            layout.no_x >
            width
        )
          throw new Error(
            "Teks melebihi lebar halaman. Kecilkan ukuran teks pada template.",
          );
        first.drawText(s.recipient_name, {
          x: layout.name_x,
          y: layout.name_y,
          size: layout.name_size,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        first.drawText(`No: ${num}`, {
          x: layout.no_x,
          y: layout.no_y,
          size: layout.no_size,
          font: regular,
        });
        const bytes = await pdf.save();
        const objectKey = `certificates/${s.program_id}/${job.id}/${job.claim_token}.pdf`;
        const put = await createS3SignedUrl({
          method: "PUT",
          objectKey,
          contentType: "application/pdf",
        });
        const response = await fetch(put, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: Uint8Array.from(bytes).buffer,
        });
        if (!response.ok) throw new Error("Dokumen belum berhasil disimpan.");
        const result = await db.rpc("finish_certificate_job", {
          p_job_id: job.id,
          p_claim_token: job.claim_token,
          p_error: null,
        });
        if (result.error) throw result.error;
        results.push({ job_id: job.id, ...result.data });
      } catch (problem) {
        const known = (problem as Error).message;
        const message =
          /^(Data penerbitan|Dokumen latar|Ukuran PDF|PDF latar|Gunakan PDF|Tata letak|Teks melebihi|Dokumen belum)/.test(
            known,
          )
            ? known
            : "Pembuatan PDF belum berhasil. Periksa template dan konfigurasi penyimpanan.";
        const failed = await db.rpc("finish_certificate_job", {
          p_job_id: job.id,
          p_claim_token: job.claim_token,
          p_error: message,
        });
        results.push({
          job_id: job.id,
          status: failed.error ? "unconfirmed" : failed.data?.status,
          error: message,
        });
      }
    }
    return jsonResponse({ results });
  } catch {
    return jsonResponse({ error: "Antrean belum dapat diproses." }, 500);
  }
});
