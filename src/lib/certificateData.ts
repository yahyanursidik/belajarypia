import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { supabase } from "./supabase";
import type {
  CertificateProgram,
  CertificateTemplate,
  CertificateBatch,
  CertificateJob,
  IssuedCertificate,
} from "./certificateWorkspace";
export async function certificateRows<T>(
  table: string,
  select = "*",
  signal?: AbortSignal,
  filters: Record<string, string> = {},
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase
      .from(table)
      .select(select)
      .order("id")
      .range(offset, offset + 499);
    for (const [key, value] of Object.entries(filters))
      query = query.eq(key, value);
    if (signal) query = query.abortSignal(signal);
    const result = await query;
    if (result.error) throw result.error;
    rows.push(...((result.data ?? []) as T[]));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}
export function useCertificateWorkspace(queue = false) {
  const [data, setData] = useState<{
    programs: CertificateProgram[];
    templates: CertificateTemplate[];
    batches: CertificateBatch[];
    certificates: IssuedCertificate[];
    groups: { id: string; name: string; program_id: string }[];
  }>({
    programs: [],
    templates: [],
    batches: [],
    certificates: [],
    groups: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const [programs, templates, groups, batches, certificates] =
        await Promise.all([
          certificateRows<CertificateProgram>(
            "programs",
            "id,name,code,status,feature_flags",
            controller.signal,
          ),
          certificateRows<CertificateTemplate>(
            "certificate_templates",
            "*",
            controller.signal,
          ),
          certificateRows<{ id: string; name: string; program_id: string }>(
            "batches",
            "id,name,program_id",
            controller.signal,
          ),
          queue
            ? certificateRows<CertificateBatch>(
                "certificate_issuance_batches",
                "*",
                controller.signal,
              )
            : Promise.resolve([]),
          queue
            ? certificateRows<IssuedCertificate>(
                "certificates",
                "id,enrollment_id,certificate_number,recipient_name,program_name,issued_at,status,object_key,verification_code,enrollments!inner(program_id,participant_id,batch_id)",
                controller.signal,
              )
            : Promise.resolve([]),
        ]);
      if (!controller.signal.aborted)
        setData({
          programs: programs.sort((a, b) => a.name.localeCompare(b.name)),
          templates,
          groups,
          batches,
          certificates,
        });
    } catch {
      if (!controller.signal.aborted)
        setError("Data sertifikat belum dapat dimuat. Coba lagi.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [queue]);
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  return { ...data, loading, error, load };
}
export const loadCertificateJobs = (batch: string, signal: AbortSignal) =>
  certificateRows<CertificateJob>(
    "certificate_generation_jobs",
    "id,issuance_batch_id,enrollment_id,participant_id,status,attempt_count,max_attempts,error_message,created_at,participants(display_name,global_participant_number)",
    signal,
    { issuance_batch_id: batch },
  );
export async function openCertificateDocument(id: string) {
  const { data, error } = await supabase.functions.invoke(
    "create-certificate-download-url",
    { body: { certificate_id: id } },
  );
  if (error) throw error;
  if (!data?.signedUrl || !/^https?:\/\//.test(data.signedUrl))
    throw new Error("Dokumen belum dapat dibuka.");
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}
export function exportCertificateCsv(
  name: string,
  rows: (string | number)[][],
) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + Papa.unparse(rows, { escapeFormulae: true })], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
