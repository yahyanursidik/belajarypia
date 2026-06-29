import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { createS3SignedUrl, requiredEnv } from "../_shared/s3.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseServiceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: jobs, error: fetchError } = await supabase
      .from("certificate_generation_jobs")
      .select(`
        id, attempt_count, max_attempts, enrollment_id, participant_id, issuance_batch_id,
        enrollments ( id, program_id, batch_id, participants ( display_name ) ),
        certificate_templates ( id, name, template_data_json, background_object_key ),
        certificate_issuance_batches ( id, completed_jobs, failed_jobs )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);

    if (fetchError) throw fetchError;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No jobs pending" }), { headers: corsHeaders });
    }

    const jobIds = jobs.map((j: any) => j.id);
    await supabase
      .from("certificate_generation_jobs")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .in("id", jobIds);

    const results = [];

    for (const job of jobs) {
      let status = "completed";
      let errorMsg = null;
      
      try {
        const participantName = job.enrollments.participants.display_name;
        const programId = job.enrollments.program_id;
        const batchId = job.enrollments.batch_id;
        const template = job.certificate_templates;
        
        const certNumber = `YPIA-SYH-${new Date().getFullYear()}-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
        const verifyCode = crypto.randomUUID().substring(0, 8).toUpperCase();

        let pdfDoc;
        if (template.background_object_key) {
          const bgSignedUrl = await createS3SignedUrl({
            method: "GET",
            objectKey: template.background_object_key,
          });
          const bgRes = await fetch(bgSignedUrl);
          if (bgRes.ok) {
            const bgBuffer = await bgRes.arrayBuffer();
            pdfDoc = await PDFDocument.load(bgBuffer);
          }
        }

        if (!pdfDoc) {
          pdfDoc = await PDFDocument.create();
          pdfDoc.addPage([842, 595]); // A4 landscape fallback
        }

        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        const templateData = template.template_data_json || {};
        
        firstPage.drawText(participantName, {
          x: templateData.name_x || 300,
          y: templateData.name_y || 300,
          size: templateData.name_size || 36,
          font: font,
          color: rgb(0.2, 0.2, 0.2),
        });

        firstPage.drawText(`No: ${certNumber}`, {
          x: templateData.no_x || 300,
          y: templateData.no_y || 250,
          size: templateData.no_size || 14,
          font: fontRegular,
        });

        const pdfBytes = await pdfDoc.save();

        const objectKey = `certificates/${programId}/${batchId || "no-batch"}/${certNumber}.pdf`;
        const putUrl = await createS3SignedUrl({
          method: "PUT",
          objectKey,
          contentType: "application/pdf",
          acl: "private"
        });

        const uploadRes = await fetch(putUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: pdfBytes,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed: ${uploadRes.statusText}`);
        }

        const { error: certError } = await supabase
          .from("certificates")
          .insert({
            enrollment_id: job.enrollment_id,
            certificate_template_id: template.id,
            certificate_number: certNumber,
            recipient_name: participantName,
            program_name: "Program Syahadah", // Ideally fetched from programs table
            object_key: objectKey,
            verification_code: verifyCode,
            status: "issued"
          });

        if (certError) throw certError;

      } catch (err: any) {
        status = "failed";
        errorMsg = err.message;
      }

      const attemptCount = job.attempt_count + 1;
      let finalStatus = status;
      if (status === "failed" && attemptCount < job.max_attempts) {
        finalStatus = "pending";
      }

      await supabase
        .from("certificate_generation_jobs")
        .update({
          status: finalStatus,
          processed_at: new Date().toISOString(),
          error_message: errorMsg,
          attempt_count: attemptCount,
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);
        
      if (finalStatus === "completed" || finalStatus === "failed") {
        const batch = job.certificate_issuance_batches;
        await supabase
          .from("certificate_issuance_batches")
          .update({
            completed_jobs: finalStatus === "completed" ? batch.completed_jobs + 1 : batch.completed_jobs,
            failed_jobs: finalStatus === "failed" ? batch.failed_jobs + 1 : batch.failed_jobs
          })
          .eq("id", batch.id);
      }

      results.push({ jobId: job.id, status: finalStatus, errorMsg });
    }

    return new Response(JSON.stringify({ results }), {
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
