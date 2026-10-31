export type CertificateProgram = {
  id: string;
  name: string;
  code: string;
  feature_flags: { use_certificate?: boolean };
  status: string;
};
export type CertificateTemplate = {
  id: string;
  program_id: string;
  name: string;
  template_type: "html" | "json";
  template_data_json: Record<string, unknown> | null;
  background_object_key: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};
export type CertificateBatch = {
  id: string;
  program_id: string;
  batch_id: string | null;
  template_id: string;
  status: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  created_at: string;
  completed_at: string | null;
  request_key?: string;
};
export type CertificateJob = {
  id: string;
  issuance_batch_id: string;
  enrollment_id: string;
  participant_id: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  participants: {
    display_name: string;
    global_participant_number: string;
  } | null;
};
export type IssuedCertificate = {
  id: string;
  enrollment_id: string;
  certificate_number: string;
  recipient_name: string;
  program_name: string;
  issued_at: string;
  status: string;
  object_key: string | null;
  verification_code: string;
  enrollments: {
    program_id: string;
    participant_id: string;
    batch_id: string | null;
  } | null;
};
export type EligibilityRow = {
  id: string;
  participant_id: string;
  enrollment_number: string;
  enrollment_status: string;
  eligible: boolean;
  reason: string;
  participants: { display_name: string; global_participant_number: string };
  final_score: number | null;
  predicate: string | null;
};
export const certificateStatus: Record<
  string,
  { label: string; tone: string }
> = {
  active: { label: "Aktif", tone: "emerald" },
  archived: { label: "Arsip", tone: "slate" },
  pending: { label: "Menunggu", tone: "amber" },
  processing: { label: "Diproses", tone: "blue" },
  completed: { label: "Selesai", tone: "emerald" },
  failed: { label: "Gagal", tone: "rose" },
  cancelled: { label: "Dibatalkan", tone: "slate" },
  issued: { label: "Terbit", tone: "emerald" },
  revoked: { label: "Dicabut", tone: "rose" },
  draft: { label: "Draf", tone: "slate" },
  queued: { label: "Dalam antrean", tone: "amber" },
};
export function certificatePath(
  base: string,
  section: string,
  program?: string | null,
  batch?: string | null,
) {
  const params = new URLSearchParams();
  if (program && program !== "all") params.set("program", program);
  if (batch) params.set("batch", batch);
  return `${base}/sertifikat${section ? `/${section}` : ""}${params.size ? `?${params}` : ""}`;
}
export function certificatePage(value: string | null) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
}
export function certificateError(problem: unknown, fallback: string) {
  const value = problem as { code?: string; message?: string };
  if (
    value?.code === "PGRST202" ||
    /schema cache|does not exist|could not find.*function/i.test(
      value?.message ?? "",
    )
  )
    return "Layanan sertifikat belum siap. Hubungi pengelola sistem.";
  return value?.message || fallback;
}
export function queueProgress(
  batch: Pick<
    CertificateBatch,
    "total_jobs" | "completed_jobs" | "failed_jobs"
  >,
) {
  const total = Math.max(0, batch.total_jobs);
  return {
    percent: total
      ? Math.min(
          100,
          Math.round((Math.max(0, batch.completed_jobs) / total) * 100),
        )
      : 0,
    remaining: Math.max(0, total - batch.completed_jobs - batch.failed_jobs),
  };
}
export const defaultCertificateLayout = {
  name_x: 120,
  name_y: 300,
  name_size: 32,
  no_x: 120,
  no_y: 250,
  no_size: 14,
};
export type CertificateLayout = typeof defaultCertificateLayout;
export function certificateLayout(
  data: Record<string, unknown> | null,
): CertificateLayout {
  const d = data ?? {};
  const oldName = d.recipient_name as { x?: unknown; y?: unknown } | undefined;
  const oldNo = d.certificate_number as
    { x?: unknown; y?: unknown } | undefined;
  return Object.fromEntries(
    Object.entries(defaultCertificateLayout).map(([key, fallback]) => {
      const legacy =
        key === "name_x"
          ? oldName?.x
          : key === "name_y"
            ? oldName?.y
            : key === "no_x"
              ? oldNo?.x
              : key === "no_y"
                ? oldNo?.y
                : undefined;
      const n = Number(d[key] ?? legacy ?? fallback);
      return [key, Number.isFinite(n) ? n : fallback];
    }),
  ) as CertificateLayout;
}
export function validateCertificateTemplate(
  name: string,
  programId: string,
  layout: CertificateLayout,
  background: string,
) {
  if (!programId || !name.trim()) return "Pilih program dan isi nama template.";
  if (name.trim().length > 160) return "Nama template maksimal 160 karakter.";
  for (const [key, value] of Object.entries(layout)) {
    const max = key.endsWith("_x") ? 842 : key.endsWith("_y") ? 595 : 72;
    const min = key.endsWith("size") ? 6 : 0;
    if (!Number.isFinite(value) || value < min || value > max)
      return `Posisi atau ukuran teks harus berada dalam area A4 mendatar (ukuran 6–72).`;
  }
  if (
    background.trim() &&
    (!/\.pdf$/i.test(background.trim()) ||
      background.includes("://") ||
      background.includes("..") ||
      background.startsWith("/") ||
      background.length > 500)
  )
    return "Dokumen latar harus berupa path PDF yang valid di penyimpanan.";
  return "";
}
export function confirmedCertificateBatch(data: unknown, expected: number) {
  const d = data as { batch_id?: string; total_jobs?: number; status?: string };
  if (!d?.batch_id || d.total_jobs !== expected)
    throw new Error(
      "Antrean belum terkonfirmasi. Coba lagi dengan pilihan yang sama.",
    );
  return d as { batch_id: string; total_jobs: number; status: string };
}
export function certificateReasonAction(reason: string) {
  if (reason.includes("administrasi")) return "academic";
  if (reason.includes("Sertifikat belum diaktifkan")) return "settings";
  if (reason.includes("antrean") || reason.includes("terbit")) return "queue";
  return "graduation";
}
