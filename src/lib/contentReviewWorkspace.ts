export const contentStatuses = {
  all: "Semua",
  draft: "Draf",
  published: "Terbit",
  scheduled: "Terjadwal",
  locked: "Terkunci",
  archived: "Arsip",
} as const;
export const contentKinds = {
  all: "Semua jenis",
  content: "Materi",
  quiz: "Kuis",
  exam: "Ujian",
  assignment: "Tugas",
  live_session: "Sesi live",
  board: "Papan belajar",
} as const;
export type ContentStatus = Exclude<
  keyof typeof contentStatuses,
  "all" | "scheduled"
>;
export type ContentChecks = {
  ready: boolean;
  issues: string[];
  warnings: string[];
  questions: number;
  sources: number;
  cards: number;
};
export type ContentRow = {
  id: string;
  code: string;
  title: string;
  lesson_type: string;
  visibility_status: ContentStatus;
  release_at: string | null;
  updated_at: string;
  program_id: string;
  program_name: string;
  module_title: string;
  checks: ContentChecks;
};
export type ContentList = {
  generated_at: string;
  total: number;
  page: number;
  size: number;
  programs: { id: string; name: string; status: string }[];
  counts: Record<keyof typeof contentStatuses | "attention", number>;
  rows: ContentRow[];
};
export type ContentDocument = {
  id: string;
  display_name: string;
  source_type: string;
  external_url: string | null;
  access_level: string;
  file_category: string;
  mime_type?: string;
};
export type ContentQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  options: { label: string; text: string }[] | null;
  correct_answer: string | null;
  points: number;
  grading_guide?: string | null;
};
export type ContentDetail = {
  revision: string;
  lesson: {
    id: string;
    code: string;
    title: string;
    lesson_type: string;
    visibility_status: ContentStatus;
    content_body: string | null;
    content_format: string;
    external_url: string | null;
    release_at: string | null;
    due_at: string | null;
    updated_at: string;
    passing_grade: number | null;
    duration_minutes: number | null;
    max_attempts: number | null;
    randomized_questions_count: number | null;
  };
  context: {
    program_id: string;
    program_name: string;
    program_status: string;
    module_id: string;
    module_title: string;
  };
  documents: ContentDocument[];
  questions: ContentQuestion[];
  checks: ContentChecks;
  prerequisites: {
    id: string;
    title: string;
    visibility_status: ContentStatus;
    program_id: string;
  }[];
  board: {
    id: string;
    layout: string;
    title: string | null;
    description?: string | null;
  } | null;
  columns: { id: string; title: string }[];
  posts: {
    id: string;
    column_id: string | null;
    title: string | null;
    body: string | null;
    has_image: boolean;
    image_alt?: string | null;
  }[];
  history: {
    id: string;
    created_at: string;
    actor_name: string;
    details: {
      status: ContentStatus;
      previous_status: ContentStatus;
      notes: string | null;
    };
  }[];
};
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function contentId(value: string | null) {
  return value && uuid.test(value) ? value : null;
}
export function contentFilters(params: URLSearchParams) {
  const status = params.get("status") ?? "draft",
    kind = params.get("kind") ?? "all";
  const page = Number(params.get("page")),
    size = Number(params.get("size"));
  return {
    program: contentId(params.get("program")),
    status: Object.prototype.hasOwnProperty.call(contentStatuses, status)
      ? status
      : "draft",
    kind: Object.prototype.hasOwnProperty.call(contentKinds, kind)
      ? kind
      : "all",
    q: (params.get("q") ?? "").slice(0, 120),
    attention: params.get("attention") === "true",
    page: Number.isInteger(page) && page > 0 && page <= 100000 ? page : 1,
    size: [10, 20, 50].includes(size) ? size : 20,
  };
}
export function safeContentUrl(value: string | null | undefined) {
  try {
    const url = new URL(value ?? "");
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function contentStatus(
  row: Pick<ContentRow, "visibility_status" | "release_at">,
) {
  return row.visibility_status === "published" &&
    row.release_at &&
    new Date(row.release_at).getTime() > Date.now()
    ? "scheduled"
    : row.visibility_status;
}
export function contentTime(value: string | null) {
  if (!value) return "Tidak ditentukan";
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(d) + " WIB"
    : "Tanggal tidak valid";
}
export function contentReviewHref(lesson: string, params?: URLSearchParams) {
  const q = new URLSearchParams(params);
  q.set("lesson", lesson);
  return `/system/konten?${q}`;
}
export function contentEditorHref(
  detail: ContentDetail,
  params: URLSearchParams,
) {
  const q = new URLSearchParams({
    reviewLesson: detail.lesson.id,
    reviewReturn: contentReviewHref(detail.lesson.id, params),
  });
  return `/system/program/${detail.context.program_id}/kurikulum?${q}`;
}
export function contentDecisionError(
  status: ContentStatus,
  notes: string,
  current: ContentStatus,
  ready: boolean,
) {
  if (status === current) return "Pilih status yang berbeda.";
  if (current === "archived" && status !== "draft")
    return "Buka arsip sebagai draf terlebih dahulu.";
  if (status === "published" && !ready)
    return "Lengkapi pemeriksaan materi terlebih dahulu.";
  if (
    notes.trim().length > 1500 ||
    (status !== "published" && notes.trim().length < 3)
  )
    return "Isi catatan 3–1.500 karakter untuk keputusan ini.";
  return "";
}
export function contentError(error: unknown) {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Data konten belum dapat dimuat.";
  if (/system_content_review|schema cache|PGRST202/i.test(msg))
    return "Pembaruan layanan Review Konten belum tersedia.";
  if (/fetch|network|abort/i.test(msg))
    return "Koneksi terputus. Coba muat ulang.";
  return msg;
}
