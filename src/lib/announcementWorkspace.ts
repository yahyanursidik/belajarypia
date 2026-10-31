import type { RoleCode } from "./auth";
export const announcementRoles = {
  all: "Semua peran",
  participant: "Peserta",
  guardian: "Wali",
  teacher: "Pengajar",
  mentor: "Musyrif",
  admin: "Pengelola",
  finance: "Keuangan",
  helpdesk: "Helpdesk",
  content_reviewer: "Reviewer konten",
} as const;
export type AnnouncementRole = keyof typeof announcementRoles;
export type AnnouncementState =
  "draft" | "scheduled" | "live" | "expired" | "archived";
export type Announcement = {
  id: string;
  title: string;
  content: string;
  target_role: AnnouncementRole;
  target_program_id: string | null;
  target_class_id: string | null;
  status: "draft" | "published" | "archived";
  publish_at: string | null;
  expires_at: string | null;
  is_pinned: boolean;
  action_kind: "none" | "program" | "payment" | "help" | "lesson";
  source: "manual" | "lesson";
  source_lesson_id: string | null;
  source_available?: boolean;
  revision: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  program_name?: string | null;
  class_name?: string | null;
  read_at?: string | null;
  read_revision?: number | null;
  read_count?: number;
};
export type AnnouncementProgram = {
  id: string;
  unit_id: string | null;
  name: string;
  code: string;
  status: string;
};
export type AnnouncementClass = {
  id: string;
  program_id: string;
  name: string;
  code: string;
  status: string;
};
export type AnnouncementForm = {
  title: string;
  content: string;
  target_role: AnnouncementRole;
  target_program_id: string;
  target_class_id: string;
  mode: "draft" | "now" | "schedule";
  publish_at: string;
  expires_at: string;
  is_pinned: boolean;
  action_kind: Announcement["action_kind"];
};
export const announcementStates: Record<
  AnnouncementState,
  { label: string; tone: string }
> = {
  draft: { label: "Draf", tone: "slate" },
  scheduled: { label: "Terjadwal", tone: "sky" },
  live: { label: "Tayang", tone: "emerald" },
  expired: { label: "Berakhir", tone: "amber" },
  archived: { label: "Arsip", tone: "slate" },
};
export function announcementState(
  a: Pick<Announcement, "status" | "publish_at" | "expires_at"> &
    Partial<Pick<Announcement, "source" | "source_available">>,
  now = Date.now(),
): AnnouncementState {
  if (a.status === "archived") return "archived";
  if (
    a.status !== "published" ||
    (a.source === "lesson" && a.source_available === false)
  )
    return "draft";
  if (a.expires_at && Date.parse(a.expires_at) <= now) return "expired";
  if (a.publish_at && Date.parse(a.publish_at) > now) return "scheduled";
  return "live";
}
export function announcementDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
// datetime-local values use Jakarta explicitly, regardless of the browser timezone.
export function announcementLocal(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16);
}
export function announcementInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(value + "+07:00");
  if (
    !Number.isFinite(parsed.getTime()) ||
    announcementLocal(parsed.toISOString()) !== value
  )
    return null;
  return parsed.toISOString();
}
export function validateAnnouncement(form: AnnouncementForm, now = Date.now()) {
  if (!form.title.trim() || form.title.trim().length > 160)
    return "Isi judul, maksimal 160 karakter.";
  if (!form.content.trim() || form.content.trim().length > 8000)
    return "Isi pesan, maksimal 8.000 karakter.";
  if (!(form.target_role in announcementRoles))
    return "Pilih peran penerima yang valid.";
  if (form.target_class_id && !form.target_program_id)
    return "Pilih program sebelum memilih kelas.";
  if (
    ["program", "lesson"].includes(form.action_kind) &&
    !form.target_program_id
  )
    return "Tautan belajar memerlukan program.";
  const start =
    form.mode === "schedule" ? announcementInstant(form.publish_at) : null;
  if (form.mode === "schedule" && (!start || Date.parse(start) <= now))
    return "Pilih jadwal tayang setelah waktu sekarang.";
  const end = form.expires_at ? announcementInstant(form.expires_at) : null;
  if (
    form.expires_at &&
    (!end || Date.parse(end) <= Math.max(now, start ? Date.parse(start) : now))
  )
    return "Waktu berakhir harus setelah waktu tayang dan waktu sekarang.";
  return "";
}
export function announcementPayload(form: AnnouncementForm) {
  return {
    title: form.title.trim(),
    content: form.content.trim(),
    target_role: form.target_role,
    target_program_id: form.target_program_id || null,
    target_class_id: form.target_class_id || null,
    status: form.mode === "draft" ? "draft" : "published",
    publish_at:
      form.mode === "schedule" ? announcementInstant(form.publish_at) : null,
    expires_at: form.expires_at ? announcementInstant(form.expires_at) : null,
    is_pinned: form.is_pinned,
    action_kind: form.action_kind,
  };
}
export function announcementUnread(a: Announcement) {
  return !a.read_at || a.read_revision !== a.revision;
}
export function announcementPage(raw: string | null) {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
}
export function announcementInboxPath(role: RoleCode | null) {
  return role === "super_admin"
    ? "/system/informasi"
    : ["teacher", "mentor"].includes(role ?? "")
      ? "/teacher/pengumuman"
      : ["participant", "guardian"].includes(role ?? "")
        ? "/learner/pengumuman"
        : "/admin/informasi";
}
export function announcementAction(a: Announcement, role: RoleCode | null) {
  const learner = role === "participant";
  const teacher = ["teacher", "mentor"].includes(role ?? "");
  const manager = ["super_admin", "admin"].includes(role ?? "");
  const base = role === "super_admin" ? "/system" : "/admin";
  if (a.action_kind === "program" && a.target_program_id) {
    if (learner)
      return {
        label: "Buka program",
        to: `/learner/program/${a.target_program_id}`,
      };
    if (teacher)
      return {
        label: "Buka program",
        to: `/teacher/kelas/program/${a.target_program_id}`,
      };
    if (manager)
      return {
        label: "Buka program",
        to: `${base}/program/${a.target_program_id}/peserta`,
      };
  }
  if (a.action_kind === "lesson" && a.source_lesson_id) {
    if (learner)
      return {
        label: "Buka materi",
        to: `/learner/lesson/${a.source_lesson_id}`,
      };
    if (teacher && a.target_program_id)
      return {
        label: "Buka kurikulum",
        to: `/teacher/kelas/program/${a.target_program_id}/kurikulum`,
      };
    if (manager && a.target_program_id)
      return {
        label: "Buka kurikulum",
        to: `${base}/program/${a.target_program_id}/kurikulum`,
      };
  }
  if (a.action_kind === "payment") {
    if (learner)
      return {
        label: "Buka pembayaran",
        to:
          "/learner/keuangan" +
          (a.target_program_id ? `?program=${a.target_program_id}` : ""),
      };
    if (manager || role === "finance")
      return {
        label: "Buka keuangan",
        to:
          `${base}/keuangan` +
          (a.target_program_id ? `?program=${a.target_program_id}` : ""),
      };
  }
  if (a.action_kind === "help") {
    if (learner || role === "guardian")
      return { label: "Buka bantuan", to: "/learner/bantuan" };
    if (manager || role === "helpdesk")
      return { label: "Buka helpdesk", to: `${base}/helpdesk` };
  }
  return null;
}
export function announcementError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (
    e?.code === "PGRST202" ||
    /schema cache|does not exist|could not find/i.test(e?.message ?? "")
  )
    return "Layanan pengumuman belum siap. Hubungi pengelola sistem.";
  return e?.message || "Pengumuman belum dapat diproses. Coba lagi.";
}
export function sortAnnouncements(rows: Announcement[]) {
  return rows
    .slice()
    .sort(
      (a, b) =>
        Number(b.is_pinned) - Number(a.is_pinned) ||
        Date.parse(b.publish_at ?? b.created_at) -
          Date.parse(a.publish_at ?? a.created_at) ||
        a.id.localeCompare(b.id),
    );
}
