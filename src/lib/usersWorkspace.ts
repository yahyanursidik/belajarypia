export const userStatusLabels = {
  active: "Profil aktif",
  inactive: "Profil nonaktif",
  suspended: "Profil ditahan",
} as const;
export const userRoleLabels: Record<string, string> = {
  super_admin: "Superadmin",
  admin: "Admin",
  teacher: "Pengajar",
  mentor: "Mentor",
  participant: "Peserta",
  guardian: "Wali",
  finance: "Keuangan",
  helpdesk: "Helpdesk",
  content_reviewer: "Reviewer konten",
};
export const userRoleHints: Record<string, string> = {
  super_admin: "Pengelolaan sistem di seluruh unit dan program.",
  admin:
    "Akademik mengikuti unit. Cakupan umum dapat memberi akses komunikasi lebih luas.",
  teacher: "Kelas dan materi mengikuti penugasan mengajar.",
  mentor: "Halaqah dan peserta mengikuti penugasan mentor.",
  participant: "Data belajar mengikuti profil peserta dan enrollment.",
  guardian: "Data anak mengikuti relasi wali yang ditautkan.",
  finance: "Akses Keuangan lintas program; pembatasan per unit belum didukung.",
  helpdesk: "Tiket mengikuti cakupan dan penugasan petugas.",
  content_reviewer:
    "Menu program; data tetap mengikuti akses unit dan kebijakan konten.",
};
export type UserAssignment = {
  id: string;
  role_id: string;
  code: string;
  name: string;
  scope_type: string | null;
  scope_id: string | null;
  scope_name: string;
  supported_scope: boolean;
  duplicates: number;
  created_at: string;
};
export type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
  assignments: UserAssignment[];
  account_exists: boolean;
  email_confirmed: boolean;
  last_sign_in_at: string | null;
  login_blocked: boolean;
  participants_count: number;
  classes_count: number;
};
export type UserOption = { id: string; name: string; status: string };
export type UserRoleOption = { id: string; code: string; name: string };
export type UserList = {
  generated_at: string;
  total: number;
  page: number;
  size: number;
  rows: UserRow[];
  roles: UserRoleOption[];
  programs: UserOption[];
  stats: {
    total: number;
    active: number;
    nonactive: number;
    without_role: number;
    superadmins: number;
    unconfirmed: number;
    missing_auth: number;
    scope: number;
    duplicates: number;
  };
};
export type UserRelation = {
  id: string;
  name: string;
  number?: string;
  status?: string;
  relation?: string;
  program_id?: string;
  program_name?: string;
  role?: string;
};
export type UserDetail = {
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  };
  assignments: UserAssignment[];
  revision: string;
  auth: {
    account_exists: boolean;
    email_confirmed: boolean;
    last_sign_in_at: string | null;
    login_blocked: boolean;
  };
  participants: UserRelation[];
  children: UserRelation[];
  classes: UserRelation[];
  halaqahs: UserRelation[];
  units: UserRelation[];
  program_assignments: UserRelation[];
  options: {
    roles: UserRoleOption[];
    units: UserOption[];
    programs: UserOption[];
  };
  history: {
    id: string;
    action: string;
    created_at: string;
    actor_name: string;
    details: {
      role: string;
      scope_type: string | null;
      scope_id: string | null;
      reason: string;
    };
  }[];
};
export type UserChange = {
  operation: "grant" | "revoke";
  role?: string;
  scope_type?: string | null;
  scope_id?: string | null;
  assignment_id?: string;
  reason: string;
};
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function userId(v: string | null) {
  return v && uuid.test(v) ? v : null;
}
export function userFilters(p: URLSearchParams) {
  const status = p.get("status") ?? "all",
    attention = p.get("attention") ?? "all",
    role = p.get("role") ?? "all";
  const page = Number(p.get("page")),
    size = Number(p.get("size"));
  return {
    q: (p.get("q") ?? "").slice(0, 120),
    role: ["all", "without_role", ...Object.keys(userRoleLabels)].includes(role)
      ? role
      : "all",
    status: [
      "all",
      "active",
      "inactive",
      "suspended",
      "other",
      "nonactive",
    ].includes(status)
      ? status
      : "all",
    attention: [
      "all",
      "unconfirmed",
      "missing_auth",
      "scope",
      "duplicates",
    ].includes(attention)
      ? attention
      : "all",
    program: userId(p.get("program")),
    page: Number.isInteger(page) && page > 0 && page <= 100000 ? page : 1,
    size: [10, 25, 50, 100].includes(size) ? size : 25,
  };
}
export function userName(row: {
  full_name: string | null;
  email: string | null;
}) {
  return row.full_name?.trim() || row.email || "Akun tanpa nama";
}
export function userInitial(row: {
  full_name: string | null;
  email: string | null;
}) {
  return userName(row).slice(0, 1).toUpperCase();
}
export function userStatus(status: string | null) {
  return (
    userStatusLabels[status as keyof typeof userStatusLabels] ??
    "Status profil lain"
  );
}
export function userTime(value: string | null) {
  if (!value) return "Belum tercatat";
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
export function userScopeModes(role: string) {
  return role === "helpdesk"
    ? ["global", "unit", "program"]
    : role === "admin"
      ? ["global", "unit"]
      : ["global"];
}
export function userChangeError(
  change: UserChange,
  detail: UserDetail,
  actor: string,
) {
  if (change.reason.trim().length < 3 || change.reason.trim().length > 1000)
    return "Isi alasan 3–1.000 karakter.";
  if (change.operation === "revoke") {
    const row = detail.assignments.find((a) => a.id === change.assignment_id);
    if (!row) return "Pilih penugasan peran yang akan dilepas.";
    if (row.code === "super_admin" && detail.profile.id === actor)
      return "Peran superadmin Anda sendiri tidak dapat dilepas.";
    return "";
  }
  if (!change.role || !Object.hasOwn(userRoleLabels, change.role))
    return "Pilih peran.";
  if (
    detail.profile.status !== "active" ||
    !detail.auth.account_exists ||
    detail.auth.login_blocked
  )
    return "Peran baru memerlukan profil aktif dan akun login yang tidak diblokir.";
  const mode = change.scope_type || "global";
  if (!userScopeModes(change.role).includes(mode))
    return "Cakupan belum didukung untuk peran ini.";
  if (mode !== "global") {
    const options =
      mode === "unit" ? detail.options.units : detail.options.programs;
    if (!options.some((o) => o.id === change.scope_id && o.status === "active"))
      return `Pilih ${mode === "unit" ? "unit" : "program"} aktif.`;
  }
  if (
    detail.assignments.some(
      (a) =>
        a.code === change.role &&
        (["participant", "guardian"].includes(change.role!) ||
          ((a.scope_type || "global") === mode &&
            (a.scope_id || null) === (change.scope_id || null))),
    )
  )
    return "Peran dengan cakupan ini sudah ada.";
  if (change.role === "participant" && !detail.participants.length)
    return "Tautkan profil peserta melalui menu Peserta terlebih dahulu.";
  if (change.role === "guardian" && !detail.children.length)
    return "Tautkan wali dan anak melalui menu Peserta terlebih dahulu.";
  return "";
}
export function usersCsv(rows: UserRow[]) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      ["Nama", "Email", "Status profil", "Peran dan cakupan", "Tanggal dibuat"],
      ...rows.map((row) => [
        row.full_name ?? "",
        row.email ?? "",
        userStatus(row.status),
        row.assignments
          .map((a) => `${userRoleLabels[a.code] ?? a.name} · ${a.scope_name}`)
          .join("; "),
        userTime(row.created_at),
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
export function usersError(e: unknown) {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String(e.message)
      : "Data pengguna belum dapat dimuat.";
  if (
    /system_users_list|system_user_detail|system_user_role_change|PGRST202|schema cache/i.test(
      msg,
    )
  )
    return "Pembaruan layanan pengguna belum tersedia.";
  if (/fetch|network|abort/i.test(msg))
    return "Koneksi terputus. Coba muat ulang.";
  return msg;
}
