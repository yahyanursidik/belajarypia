import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { supabase } from "./supabase";
import {
  financeError,
  validateFinanceFile,
  type FinanceData,
} from "./financeWorkspace";
export const emptyFinanceData: FinanceData = {
  programs: [],
  participants: [],
  enrollments: [],
  channels: [],
  invoices: [],
  transactions: [],
  donors: [],
  commitments: [],
  accounts: [],
  journals: [],
  lines: [],
};
export async function financeRows<T>(
  table: string,
  signal: AbortSignal,
  select = "*",
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const r = await supabase
      .from(table)
      .select(select)
      .order("id")
      .range(offset, offset + 499)
      .abortSignal(signal);
    if (r.error) throw r.error;
    rows.push(...((r.data ?? []) as T[]));
    if ((r.data?.length ?? 0) < 500) return rows;
  }
}
export function useFinanceData(learner = false) {
  const [data, setData] = useState<FinanceData>(emptyFinanceData);
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
      const [
        programs,
        participants,
        enrollments,
        channels,
        invoices,
        transactions,
        donors,
        commitments,
        accounts,
        journals,
        lines,
      ] = await Promise.all([
        financeRows<FinanceData["programs"][number]>(
          "programs",
          controller.signal,
          "id,unit_id,name,code,status,feature_flags",
        ),
        financeRows<FinanceData["participants"][number]>(
          "participants",
          controller.signal,
          "id,display_name,global_participant_number,phone,status",
        ),
        financeRows<FinanceData["enrollments"][number]>(
          "enrollments",
          controller.signal,
          "id,participant_id,program_id,batch_id,class_id,enrollment_number,enrollment_status,payment_status",
        ),
        financeRows<FinanceData["channels"][number]>(
          "donation_payment_channels",
          controller.signal,
        ),
        financeRows<FinanceData["invoices"][number]>(
          "finance_invoices",
          controller.signal,
        ),
        financeRows<FinanceData["transactions"][number]>(
          "transactions",
          controller.signal,
        ),
        learner
          ? Promise.resolve([])
          : financeRows<FinanceData["donors"][number]>(
              "donor_profiles",
              controller.signal,
            ),
        learner
          ? Promise.resolve([])
          : financeRows<FinanceData["commitments"][number]>(
              "donor_commitments",
              controller.signal,
            ),
        learner
          ? Promise.resolve([])
          : financeRows<FinanceData["accounts"][number]>(
              "finance_accounts",
              controller.signal,
            ),
        learner
          ? Promise.resolve([])
          : financeRows<FinanceData["journals"][number]>(
              "finance_journal_entries",
              controller.signal,
            ),
        learner
          ? Promise.resolve([])
          : financeRows<FinanceData["lines"][number]>(
              "finance_journal_lines",
              controller.signal,
            ),
      ]);
      if (!controller.signal.aborted)
        setData({
          programs,
          participants,
          enrollments,
          channels,
          invoices,
          transactions,
          donors,
          commitments,
          accounts,
          journals,
          lines,
        });
    } catch (problem) {
      if (!controller.signal.aborted)
        setError(
          financeError(problem, "Data keuangan belum dapat dimuat. Coba lagi."),
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [learner]);
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  return { data, loading, error, load };
}
export async function financeRpc<T>(
  name: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.rpc(name, payload);
  if (error) throw error;
  if (data === null || data === undefined)
    throw new Error(
      "Perubahan belum terkonfirmasi. Muat ulang sebelum mencoba lagi.",
    );
  return data as T;
}
async function financeEdge(body: Record<string, unknown>) {
  const result = await supabase.functions.invoke("finance-documents", { body });
  if (result.error) {
    let message = "Dokumen belum dapat diproses. Coba lagi.";
    try {
      const context = (result.error as { context?: Response }).context;
      const payload = await context?.clone().json();
      if (payload?.error) message = String(payload.error);
    } catch {
      /* Response may not contain a JSON body. */
    }
    throw new Error(message);
  }
  if (result.data?.error) throw new Error(String(result.data.error));
  return result;
}
export async function financeDocumentUrl(documentId: string) {
  const { data, error } = await financeEdge({
    operation: "download",
    document_id: documentId,
  });
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Dokumen belum dapat dibuka.");
  return String(data.signedUrl);
}
export async function uploadFinanceDocument(
  file: File,
  purpose: "proof" | "qr",
) {
  const message = validateFinanceFile(file, purpose);
  if (message) throw new Error(message);
  const prepared = await financeEdge({
    operation: "prepare",
    purpose,
    file_name: file.name,
    mime_type:
      file.type ||
      {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
      }[file.name.split(".").pop()!.toLowerCase()],
    file_size: file.size,
  });
  if (prepared.error) throw prepared.error;
  if (!prepared.data?.document_id || !prepared.data?.signedUrl)
    throw new Error("Unggahan belum siap.");
  const response = await fetch(prepared.data.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": prepared.data.mime_type },
    body: file,
  });
  if (!response.ok)
    throw new Error("Unggah dokumen belum berhasil. Coba lagi.");
  const complete = await financeEdge({
    operation: "complete",
    document_id: prepared.data.document_id,
  });
  if (complete.error) throw complete.error;
  if (complete.data?.status !== "ready")
    throw new Error("Dokumen belum terkonfirmasi.");
  return String(prepared.data.document_id);
}
export function financeCsv(name: string, rows: (string | number)[][]) {
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
export function useFinanceRequestKey() {
  const request = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const value = JSON.stringify(payload);
    if (request.current?.payload !== value)
      request.current = { payload: value, key: crypto.randomUUID() };
    return request.current.key;
  };
}
