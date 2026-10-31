export const assignmentLabels: Record<string, string> = {
  draft: "Draf",
  submitted: "Menunggu penilaian",
  needs_revision: "Perlu revisi",
  accepted: "Nilai final",
  not_started: "Belum dikerjakan",
  legacy_completed: "Hasil sebelumnya",
  unconfigured: "Belum diatur",
  published: "Diterbitkan",
  locked: "Terkunci",
  archived: "Diarsipkan",
};
export const responseLabels: Record<string, string> = {
  text: "Jawaban teks",
  document: "Dokumen / gambar",
  checklist: "Checklist",
};
export type AssignmentFile = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
};
export type AssignmentAttempt = {
  id: string;
  revision: string;
  attempt_number: number;
  status: string;
  answer_text: string;
  checked_items: number[];
  file_ids: string[];
  files: AssignmentFile[];
  score: number | null;
  feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  snapshot: {
    instructions?: string;
    checklist?: string[];
    title?: string;
    late?: boolean;
  };
};
export type AssignmentConfig = {
  revision: string;
  instructions: string;
  response_kind: string;
  checklist: string[];
  allow_late: boolean;
};
export type AssignmentLesson = {
  id: string;
  title: string;
  module_id: string;
  program_id: string;
  program_name: string;
  release_at: string | null;
  due_at: string | null;
  visibility_status: string;
};
export type AssignmentDetail = {
  lesson: AssignmentLesson;
  config: AssignmentConfig | null;
  history: AssignmentAttempt[];
  enrollment_id: string | null;
  participant_name: string | null;
  can_manage: boolean;
  config_locked: boolean;
  is_owner: boolean;
  can_work: boolean;
  can_review: boolean;
  legacy_completed: boolean;
};
export type AssignmentList = {
  items: {
    lesson_id: string;
    title: string;
    program_id: string;
    program_name: string;
    module_id: string;
    due_at: string | null;
    status: string;
    enrollment_id: string | null;
    submission_id: string | null;
    attempt_number: number | null;
    score: number | null;
    participant_name: string | null;
    can_manage: boolean;
    can_work: boolean;
    response_kind: string | null;
    pending_count: number;
  }[];
  total: number;
  programs: { id: string; name: string; can_manage: boolean }[];
  modules: { id: string; program_id: string; title: string }[];
};
export function assignmentError(error: unknown) {
  const m = (error as { message?: string })?.message ||
    "Tugas belum dapat diproses. Coba lagi.";
  return /schema cache|could not find.*function|does not exist/i.test(m)
    ? "Fitur tugas belum diaktifkan di server. Hubungi pengelola."
    : m;
}
export function validateAssignmentFile(
  file: { name: string; type: string; size: number },
) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  if (
    !ext || types[ext] !== file.type || file.size < 1 || file.size > 5242880 ||
    file.name.length > 180 ||
    (/[/\\]/.test(file.name) ||
      Array.from(file.name).some((c) =>
        c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127
      ))
  ) throw new Error("Gunakan PDF, JPG, PNG atau WebP maksimal 5 MB.");
}
export function assignmentPath(
  base: string,
  lesson: string,
  enrollment?: string | null,
) {
  return `${base}/tugas/${encodeURIComponent(lesson)}${
    enrollment ? "?enrollment=" + encodeURIComponent(enrollment) : ""
  }`;
}
export const assignmentTime = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "short",
    }) + " WIB"
    : "Tanpa tenggat";
