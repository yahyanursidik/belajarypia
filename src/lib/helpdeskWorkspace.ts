import type { RoleCode } from "./auth";
export const helpdeskStatuses = {
  open: "Baru",
  in_progress: "Diproses",
  waiting_reporter: "Menunggu pelapor",
  resolved: "Selesai",
  closed: "Ditutup",
} as const;
export const helpdeskCategories = {
  technical_issue: "Kendala teknis",
  academic: "Pembelajaran",
  billing: "Pembayaran & donasi",
  account: "Akun & akses",
  other: "Lainnya",
} as const;
export const helpdeskPriorities = {
  low: "Rendah",
  medium: "Normal",
  high: "Tinggi",
  urgent: "Mendesak",
} as const;
export type HelpdeskStatus = keyof typeof helpdeskStatuses;
export type HelpdeskCategory = keyof typeof helpdeskCategories;
export type HelpdeskTicket = {
  id: string;
  ticket_number: string;
  reporter_id: string;
  reporter_name: string | null;
  reporter_email: string | null;
  subject: string;
  category: HelpdeskCategory;
  status: HelpdeskStatus;
  priority: keyof typeof helpdeskPriorities;
  assigned_to: string | null;
  assigned_name: string | null;
  target_program_id: string | null;
  program_name: string | null;
  enrollment_id: string | null;
  participant_id: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  resolution_summary: string | null;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  last_sender_id: string | null;
  can_manage: boolean;
};
export type HelpdeskMessage = {
  id: string;
  sender_id: string;
  sender_name: string | null;
  message_body: string;
  is_internal_note: boolean;
  created_at: string;
};
export type HelpdeskEvent = {
  id: string;
  actor_name: string | null;
  kind: string;
  details: { from?: string; to?: string; fields?: string[] };
  is_internal: boolean;
  created_at: string;
};
export type HelpdeskDetail = {
  ticket: HelpdeskTicket;
  messages: HelpdeskMessage[];
  events: HelpdeskEvent[];
};
export type HelpdeskOptions = {
  programs: { id: string; name: string }[];
  enrollments: {
    id: string;
    program_id: string;
    name: string;
    number: string;
  }[];
  invoices: {
    id: string;
    program_id: string;
    enrollment_id: string;
    number: string;
  }[];
  assignees: { id: string; name: string }[];
};
export type HelpdeskList = {
  items: HelpdeskTicket[];
  total: number;
  stats: {
    active: number;
    unassigned: number;
    waiting: number;
    resolved: number;
  };
  programs: HelpdeskOptions["programs"];
};
export type HelpdeskPayload = {
  subject: string;
  category: HelpdeskCategory;
  message: string;
  target_program_id: string | null;
  enrollment_id: string | null;
  invoice_id: string | null;
};
export const emptyHelpdeskOptions: HelpdeskOptions = {
  programs: [],
  enrollments: [],
  invoices: [],
  assignees: [],
};
export function helpdeskDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(value))
    : "Belum dijadwalkan";
}
export function helpdeskError(error: unknown) {
  const e = error as { message?: string; code?: string };
  if (["PGRST202", "42883", "42703"].includes(e?.code ?? ""))
    return "Pembaruan helpdesk belum tersedia di server. Hubungi pengelola sistem.";
  return (
    e?.message || "Tidak dapat memuat helpdesk. Periksa koneksi lalu coba lagi."
  );
}
export function helpdeskPage(value: string | null) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
}
export function isHelpdeskDone(status: string) {
  return status === "resolved" || status === "closed";
}
export function helpdeskLinks(t: HelpdeskTicket, role: RoleCode | null) {
  const links: { label: string; href: string }[] = [];
  const root = role === "super_admin" ? "/system" : "/admin";
  if (t.target_program_id && (role === "super_admin" || role === "admin"))
    links.push({
      label: "Program",
      href: `${root}/program/${t.target_program_id}`,
    });
  if (t.participant_id && (role === "super_admin" || role === "admin"))
    links.push({
      label: "Peserta",
      href: `${root}/peserta/${t.participant_id}`,
    });
  if (
    t.invoice_id &&
    (role === "super_admin" || role === "admin" || role === "finance")
  )
    links.push({
      label: "Tagihan",
      href: `${root}/keuangan?tab=invoices&program=${t.target_program_id}&invoice=${t.invoice_id}`,
    });
  if (t.invoice_id && role === "participant")
    links.push({
      label: "Pembayaran saya",
      href: `/learner/keuangan?invoice=${t.invoice_id}`,
    });
  return links;
}
export function validateHelpdesk(payload: HelpdeskPayload) {
  if (payload.subject.trim().length < 3 || payload.subject.trim().length > 160)
    return "Isi judul 3–160 karakter.";
  if (payload.message.trim().length < 5 || payload.message.trim().length > 8000)
    return "Isi pesan 5–8.000 karakter.";
  return "";
}
export type HelpdeskCommand = {
  name: string;
  args: Record<string, unknown>;
  semantic: string;
};
export function sameHelpdeskCommand(
  command: HelpdeskCommand,
  name: string,
  args: Record<string, unknown>,
) {
  const {
    p_expected_updated_at: _version,
    p_request_key: _key,
    ...semantic
  } = args;
  void _version;
  void _key;
  return command.name === name && command.semantic === JSON.stringify(semantic);
}
export function newHelpdeskCommand(
  name: string,
  args: Record<string, unknown>,
  key: string,
): HelpdeskCommand {
  const { p_expected_updated_at: _version, ...semantic } = args;
  void _version;
  return {
    name,
    args: { ...args, p_request_key: key },
    semantic: JSON.stringify(semantic),
  };
}
export function definitiveHelpdeskFailure(error: unknown) {
  const code = (error as { code?: string })?.code;
  return (
    !!code &&
    /^[0-9A-Z]{5}$/.test(code) &&
    !code.startsWith("08") &&
    !code.startsWith("PGRST")
  );
}
