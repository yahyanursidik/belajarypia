export type DashboardProgram = {
  id: string;
  code: string;
  name: string;
  status: string;
};
export type ProgramActivity = DashboardProgram & {
  active_enrollments: number;
  released_lessons: number;
  modules: number;
  completed_activities: number;
  expected_activities: number;
};
export type DashboardQueueKey =
  | "admission"
  | "assessment"
  | "payments"
  | "certificates"
  | "helpdesk"
  | "helpdesk_overdue"
  | "invoices_overdue"
  | "programs_empty";
export type DashboardAudit = {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  actor_name: string;
};
export type DashboardData = {
  generated_at: string;
  period: { days: number; from: string; to: string };
  programs: DashboardProgram[];
  summary: {
    active_participants: number;
    active_programs: number;
    application_choices: number;
    verified_amount: number;
    verified_payments: number;
    new_choices: number;
    new_enrollments: number;
  };
  queues: Record<DashboardQueueKey, number>;
  admission: Record<
    | "draft"
    | "submitted"
    | "under_review"
    | "revision_requested"
    | "accepted"
    | "rejected",
    number
  >;
  onboarding: { total: number; completed: number };
  learning: { active_enrollments: number; completed: number; expected: number };
  program_activity: ProgramActivity[];
  daily: {
    day: string;
    applications: number;
    enrollments: number;
    verified_amount: number;
  }[];
  global: {
    users: number;
    units: number;
    failed_notifications: number;
    access_events: number;
  };
  notification_failures: {
    id: string;
    event_type: string;
    status: string;
    created_at: string;
  }[];
  recent_audit: DashboardAudit[];
};
export const dashboardQueues: {
  key: DashboardQueueKey;
  label: string;
  tone: string;
  icon:
    | "admission"
    | "assessment"
    | "payments"
    | "certificates"
    | "helpdesk"
    | "program";
}[] = [
  {
    key: "payments",
    label: "Pembayaran perlu verifikasi",
    tone: "amber",
    icon: "payments",
  },
  {
    key: "admission",
    label: "Pendaftaran perlu tindak lanjut",
    tone: "blue",
    icon: "admission",
  },
  {
    key: "assessment",
    label: "Esai menunggu penilaian",
    tone: "violet",
    icon: "assessment",
  },
  {
    key: "certificates",
    label: "Batch sertifikat gagal",
    tone: "rose",
    icon: "certificates",
  },
  {
    key: "helpdesk",
    label: "Tiket perlu balasan",
    tone: "cyan",
    icon: "helpdesk",
  },
  {
    key: "helpdesk_overdue",
    label: "Tiket lewat jadwal tindak lanjut",
    tone: "rose",
    icon: "helpdesk",
  },
  {
    key: "invoices_overdue",
    label: "Tagihan melewati jatuh tempo",
    tone: "amber",
    icon: "payments",
  },
  {
    key: "programs_empty",
    label: "Program aktif tanpa kurikulum",
    tone: "violet",
    icon: "program",
  },
];
export const dashboardAdmissionLabels = {
  draft: "Draf",
  submitted: "Dikirim",
  under_review: "Ditinjau",
  revision_requested: "Perlu revisi",
  accepted: "Diterima",
  rejected: "Ditolak",
} as const;
export function dashboardHref(
  path: string,
  program: string | null = null,
  query: Record<string, string | number | null | undefined> = {},
) {
  const params = new URLSearchParams();
  if (program) params.set("program", program);
  for (const [k, v] of Object.entries(query))
    if (v != null && v !== "") params.set(k, String(v));
  return path + (params.size ? "?" + params : "");
}
export function dashboardQueueHref(
  key: DashboardQueueKey,
  program: string | null,
) {
  switch (key) {
    case "admission":
      return dashboardHref("/system/pendaftaran", program, {
        tab: "review",
        status: "pending",
      });
    case "assessment":
      return dashboardHref("/system/penilaian", program, {
        status: "pending",
        kind: "quiz",
      });
    case "payments":
      return dashboardHref("/system/keuangan", program, {
        tab: "transactions",
        status: "pending",
      });
    case "certificates":
      return dashboardHref("/system/sertifikat/antrean", program, {
        status: "failed",
      });
    case "helpdesk":
      return dashboardHref("/system/helpdesk", program, { queue: "reply" });
    case "helpdesk_overdue":
      return dashboardHref("/system/helpdesk", program, { queue: "overdue" });
    case "invoices_overdue":
      return dashboardHref("/system/keuangan", program, {
        tab: "invoices",
        status: "overdue",
      });
    case "programs_empty":
      return program
        ? `/system/program/${program}/kurikulum`
        : dashboardHref("/system/program", null, {
            attention: "empty-curriculum",
            status: "active",
          });
  }
}
export function dashboardPercentage(done: number, total: number) {
  return total > 0
    ? Math.max(0, Math.min(100, Math.round((done / total) * 100)))
    : null;
}
export function dashboardPeriod(value: string | null) {
  const n = Number(value);
  return [7, 30, 90].includes(n) ? n : 30;
}
export function dashboardProgram(value: string | null) {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}
export function dashboardTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}
export function dashboardDay(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00+07:00`));
}
export function dashboardMoney(value: number, compact = false) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(value);
}
export function dashboardAuditLabel(
  log: Pick<DashboardAudit, "action" | "entity_type">,
) {
  const entities: Record<string, string> = {
    program: "Program",
    programs: "Program",
    participant: "Peserta",
    participants: "Peserta",
    enrollment: "Enrollment",
    enrollments: "Enrollment",
    profile: "Akun",
    profiles: "Akun",
    user_role: "Peran",
    user_roles: "Peran",
    transaction: "Pembayaran",
    finance_invoice: "Tagihan",
    certificate: "Sertifikat",
    certificate_template: "Template sertifikat",
    certificate_issuance_batch: "Penerbitan sertifikat",
    announcement: "Pengumuman",
    system_settings: "Pengaturan",
    helpdesk_ticket: "Tiket bantuan",
    quiz_attempt: "Penilaian",
  };
  const entity = entities[log.entity_type] ?? "Data";
  const action = log.action.toLowerCase();
  if (action.includes("verified")) return "Pembayaran diverifikasi";
  if (action.includes("rejected")) return `${entity} ditolak`;
  if (/grade|review/.test(action)) return `${entity} ditinjau`;
  if (/create|insert|added/.test(action)) return `${entity} ditambahkan`;
  if (/delete|remove/.test(action)) return `${entity} dihapus`;
  if (/update|edit|save|managed/.test(action)) return `${entity} diperbarui`;
  if (action.includes("login")) return "Pengguna masuk";
  if (action.includes("logout")) return "Pengguna keluar";
  return `Aktivitas ${entity.toLowerCase()}`;
}
export type DashboardIntent = "admission" | "invoice" | "announcement";
export function dashboardIntentHref(intent: DashboardIntent, program: string) {
  if (intent === "admission") return `/system/program/${program}/pendaftaran`;
  if (intent === "invoice")
    return dashboardHref("/system/keuangan", program, {
      tab: "invoices",
      action: "invoice",
    });
  return dashboardHref("/system/pengumuman", program, { tab: "compose" });
}
export function dashboardError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (["PGRST202", "42883"].includes(e?.code ?? ""))
    return "Pembaruan dashboard belum tersedia di server.";
  return (
    e?.message ||
    "Dashboard belum dapat dimuat. Periksa koneksi lalu coba lagi."
  );
}
