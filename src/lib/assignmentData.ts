import { supabase } from "./supabase";
import { type AssignmentFile, validateAssignmentFile } from "./assignments";
export async function assignmentRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  const r = await supabase.rpc(name, args).abortSignal(
    signal ?? new AbortController().signal,
  );
  if (r.error) throw r.error;
  return r.data as T;
}
async function documentCall(body: Record<string, unknown>) {
  const r = await supabase.functions.invoke("assignment-documents", { body });
  if (r.error) {
    const context = (r.error as { context?: Response }).context;
    let message = "Lampiran belum dapat diproses. Coba lagi.";
    if (context) {
      try {
        message = (await context.json()).error || message;
      } catch { /* Keep a safe message for non-JSON gateway errors. */ }
    }
    throw new Error(message);
  }
  if (r.data?.error) throw new Error(r.data.error);
  return r.data;
}
export async function uploadAssignmentFile(
  submission: string,
  file: File,
): Promise<AssignmentFile> {
  validateAssignmentFile(file);
  const p = await documentCall({
    operation: "prepare",
    submission_id: submission,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
  });
  const upload = await fetch(p.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!upload.ok) {
    throw new Error("Unggahan gagal. Draf jawaban tetap tersimpan di halaman.");
  }
  await documentCall({ operation: "complete", document_id: p.document_id });
  return {
    id: p.document_id,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
  };
}
export async function downloadAssignmentFile(id: string): Promise<string> {
  return (await documentCall({ operation: "download", document_id: id }))
    .signedUrl;
}
