import { validDateKey, wibDateKey } from "./dateRange.ts";
export const auditCategories = {
  all: "Semua aktivitas",
  auth: "Akses & peran",
  create: "Penambahan",
  update: "Perubahan",
  delete: "Penghapusan",
  other: "Lainnya",
} as const;
export type AuditCategory = keyof typeof auditCategories;
export const auditEntities: Record<string, string> = {
  auth: "Autentikasi",
  lesson_progresses: "Progres belajar",
  system: "Sistem",
  system_settings: "Pengaturan",
  system_brand_asset: "Branding",
  profile: "Akun pengguna",
  profiles: "Akun pengguna",
  participant: "Peserta",
  participants: "Peserta",
  enrollment: "Enrollment",
  lesson: "Materi",
  quiz_attempt: "Ujian",
  program: "Program",
  programs: "Program",
  applicant_program_choice: "Pilihan pendaftaran",
  registration_form: "Formulir",
  transaction: "Pembayaran",
  transactions: "Pembayaran",
  finance_invoice: "Tagihan",
  finance_journal: "Jurnal",
  donation_payment_channel: "Rekening & QR",
  donor_commitment: "Komitmen donasi",
  finance_document: "Dokumen keuangan",
  helpdesk_ticket: "Tiket bantuan",
  announcement: "Pengumuman",
  certificate: "Sertifikat",
  certificate_template: "Template sertifikat",
  certificate_issuance_batch: "Antrean sertifikat",
};
const actions: Record<string, string> = {
  create: "Data ditambah",
  insert: "Data ditambah",
  update: "Data diubah",
  delete: "Data dihapus",
  system_setting: "Pengaturan sistem",
  other: "Aktivitas lain",
  "participant.guardian.attach": "Wali ditautkan",
  "participant.guardian.detach": "Relasi wali dilepas",
  "participant.guardian.primary": "Wali utama diubah",
  login: "Masuk akun",
  logout: "Keluar akun",
  update_settings: "Pengaturan diubah",
  verify_payment: "Pembayaran diverifikasi",
  "settings.updated": "Pengaturan diubah",
  "settings.created": "Pengaturan dibuat",
  "settings.brand_uploaded": "Branding diunggah",
  "user.role_granted": "Peran diberikan",
  "user.role_revoked": "Peran dilepas",
  "profile.updated": "Profil diperbarui",
  "learner_profile.updated": "Profil belajar diperbarui",
  "participant.save": "Peserta disimpan",
  "guardian.link": "Wali ditautkan",
  "guardian.unlink": "Relasi wali dilepas",
  "enrollment.placement": "Penempatan diubah",
  "admission.review": "Pendaftaran ditinjau",
  "admission.accept": "Pendaftar diterima",
  "admission.form.save": "Formulir disimpan",
  "content.reviewed": "Materi ditinjau",
  "quiz_attempt.graded": "Nilai ujian difinalkan",
  "lesson.completed": "Materi diselesaikan",
  "finance_transaction.verified": "Pembayaran diverifikasi",
  "finance_transaction.rejected": "Pembayaran ditolak",
  "finance_transaction.cancelled": "Pembayaran dibatalkan",
  "finance_transaction.submitted": "Bukti pembayaran dikirim",
  "finance_invoice.created": "Tagihan dibuat",
  "finance_invoice.cancelled": "Tagihan dibatalkan",
  "finance_channel.saved": "Rekening / QR disimpan",
  "finance_transaction.allocated": "Pembayaran ditautkan",
  "finance_journal.reconciled": "Jurnal direkonsiliasi",
  "finance_document.download": "Bukti pembayaran diunduh",
  "certificate.issued": "Sertifikat diterbitkan",
  "certificate_batch.created": "Antrean sertifikat dibuat",
  "certificate_batch.retried": "Antrean sertifikat diulang",
  "certificate_template.saved": "Template disimpan",
  "program_graduation.finalized": "Kelulusan ditetapkan",
  "helpdesk.created": "Tiket dibuat",
  "helpdesk.replied": "Tiket dibalas",
  "helpdesk.note": "Catatan internal ditambah",
  "helpdesk.managed": "Tiket diperbarui",
  "announcement.created": "Pengumuman dibuat",
  "announcement.updated": "Pengumuman diubah",
  "announcement.published": "Pengumuman diterbitkan",
  "announcement.archived": "Pengumuman diarsipkan",
  "announcement.draft": "Pengumuman ditarik",
  "announcement.lesson_hidden": "Pengumuman materi ditarik",
  "announcement.lesson_synced": "Pengumuman materi disinkronkan",
};
export const auditActionLabel = (action: string) =>
  actions[action.toLowerCase()] ?? action;
export const auditEntityLabel = (entity: string) =>
  auditEntities[entity] ?? entity;
export function auditId(value: string | null | undefined) {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}
export function auditFilters(p: URLSearchParams) {
  const numeric = (s: string | null, f: number) =>
    /^\d+$/.test(s ?? "") ? Math.min(1000000, Math.max(1, Number(s))) : f;
  return {
    q: (p.get("q") ?? "").trim().slice(0, 200),
    category: Object.hasOwn(auditCategories, p.get("category") ?? "all")
      ? ((p.get("category") ?? "all") as AuditCategory)
      : "all",
    entity: (p.get("entity") ?? "all").slice(0, 100),
    action: (p.get("action") ?? "all").slice(0, 150),
    actor: auditId(p.get("actor")),
    target: auditId(p.get("target")),
    from: validDateKey(p.get("from") ?? "") ? p.get("from")! : "",
    to: validDateKey(p.get("to") ?? "") ? p.get("to")! : "",
    page: numeric(p.get("page"), 1),
    size: [25, 50, 100].includes(Number(p.get("size")))
      ? Number(p.get("size"))
      : 25,
  };
}
export type AuditFilters = ReturnType<typeof auditFilters>;
export type AuditRow = {
  id: string;
  user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  category: Exclude<AuditCategory, "all">;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};
export type AuditList = {
  generated_at: string;
  total: number;
  page: number;
  size: number;
  rows: AuditRow[];
  stats: { actors: number; access: number; deletions: number };
  actions: string[];
  entities: string[];
};
export type AuditDetail = Omit<AuditRow, "actor_name" | "actor_email"> & {
  details: unknown;
  actor: { id: string; name: string | null; email: string | null } | null;
  context: Record<string, string>;
};
export function auditTime(value: string) {
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
    : "—";
}
export function auditActor(
  row: Pick<AuditRow, "user_id" | "actor_name" | "actor_email">,
) {
  return (
    row.actor_name ||
    row.actor_email ||
    (row.user_id ? "Akun tidak tersedia" : "Pelaku tidak tercatat")
  );
}
export function auditError(e: unknown) {
  const message =
    typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Audit belum dapat dimuat.";
  return /schema cache|could not find.*function|does not exist/i.test(message)
    ? "Pembaruan Audit belum tersedia di server."
    : message;
}
export function auditPeriod(days: number) {
  const to = wibDateKey(new Date().toISOString()),
    d = new Date(to + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days + 1);
  return { from: d.toISOString().slice(0, 10), to };
}
const fieldNames: Record<string, string> = {
  previous: "Sebelumnya",
  current: "Sesudahnya",
  old: "Sebelumnya",
  new: "Sesudahnya",
  old_data: "Sebelumnya",
  new_data: "Sesudahnya",
  previous_status: "Status sebelumnya",
  status: "Status",
  reason: "Alasan",
  notes: "Catatan",
  role: "Peran",
  scope_type: "Jenis cakupan",
  scope_id: "ID cakupan",
  assignment_id: "ID penugasan",
  program_id: "ID program",
  participant_id: "ID peserta",
  enrollment_id: "ID enrollment",
  batch_id: "ID angkatan",
  class_id: "ID kelas",
  halaqah_id: "ID halaqah",
  fields: "Kolom yang berubah",
  score: "Nilai",
  final_score: "Nilai akhir",
  completion_percent: "Progres (%)",
  count: "Jumlah",
  total_jobs: "Jumlah antrean",
  invoice_id: "ID tagihan",
  journal_id: "ID jurnal",
  account_status: "Status akun",
  enrollment_action: "Tindakan enrollment",
  reviewed_revision: "Versi yang ditinjau",
};
export const auditFieldLabel = (key: string) =>
  fieldNames[key] ?? key.replace(/_/g, " ");
export function auditValue(v: unknown): string {
  if (v === null) return "Tidak diisi";
  if (v === true) return "Ya";
  if (v === false) return "Tidak";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}
export function auditChanges(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details))
    return [];
  const d = details as Record<string, unknown>;
  const before = d.previous ?? d.old_data ?? d.old,
    after = d.current ?? d.new_data ?? d.new;
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) ||
    Array.isArray(after)
  )
    return [];
  const a = before as Record<string, unknown>,
    b = after as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((key) => ({
      key,
      before: key in a ? auditValue(a[key]) : "Tidak dicatat",
      after: key in b ? auditValue(b[key]) : "Tidak dicatat",
    }));
}
export function auditLinks(d: AuditDetail) {
  const c = d.context;
  const links: { label: string; href: string }[] = [];
  const add = (label: string, href: string) => links.push({ label, href });
  if (auditId(c.profile_id))
    add("Buka akun pengguna", "/system/pengguna?user=" + c.profile_id);
  if (auditId(c.participant_id))
    add("Buka peserta", "/system/peserta/" + c.participant_id);
  if (auditId(c.attempt_id))
    add("Buka penilaian", "/system/penilaian/" + c.attempt_id);
  if (auditId(c.lesson_id))
    add("Buka review materi", "/system/konten?lesson=" + c.lesson_id);
  if (auditId(c.program_id))
    add("Buka program", "/system/program/" + c.program_id + "/kurikulum");
  if (auditId(c.choice_id))
    add(
      "Buka pendaftaran",
      "/system/pendaftaran?tab=review&choice=" + c.choice_id,
    );
  if (auditId(c.transaction_id))
    add(
      "Buka pembayaran",
      "/system/keuangan?tab=transactions&transaction=" + c.transaction_id,
    );
  if (auditId(c.invoice_id))
    add(
      "Buka tagihan",
      "/system/keuangan?tab=invoices&invoice=" + c.invoice_id,
    );
  if (auditId(c.ticket_id))
    add("Buka tiket", "/system/helpdesk?ticket=" + c.ticket_id);
  if (auditId(c.announcement_id))
    add("Buka pengumuman", "/system/pengumuman?detail=" + c.announcement_id);
  if (
    ["system", "system_settings", "system_brand_asset"].includes(d.entity_type)
  )
    add("Buka pengaturan", "/system/pengaturan");
  if (d.entity_type === "registration_form")
    add(
      "Buka formulir",
      "/system/pendaftaran?tab=settings" +
        (auditId(c.program_id) ? "&program=" + c.program_id : ""),
    );
  if (
    (d.entity_type.startsWith("finance_") ||
      [
        "transaction",
        "transactions",
        "donation_payment_channel",
        "donor_commitment",
      ].includes(d.entity_type)) &&
    !c.transaction_id &&
    !c.invoice_id
  )
    add(
      "Buka modul keuangan",
      "/system/keuangan?tab=" +
        ({
          donation_payment_channel: "channels",
          finance_journal: "accounting",
          donor_commitment: "recurring",
          finance_invoice: "invoices",
        }[d.entity_type] ?? "transactions"),
    );
  if (d.entity_type.startsWith("certificate"))
    add("Buka modul sertifikat", "/system/sertifikat/antrean");
  return links;
}
export function auditCsv(rows: AuditRow[]) {
  const cell = (s: unknown) => {
    let text = String(s ?? "");
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      [
        "ID audit",
        "Waktu (WIB)",
        "Pelaku",
        "Email",
        "ID pelaku",
        "Aktivitas",
        "Kode aktivitas",
        "Jenis",
        "Objek",
        "ID objek",
      ],
      ...rows.map((r) => [
        r.id,
        auditTime(r.created_at),
        auditActor(r),
        r.actor_email,
        r.user_id,
        auditActionLabel(r.action),
        r.action,
        auditCategories[r.category],
        auditEntityLabel(r.entity_type),
        r.entity_id,
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
