import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  User as UserIcon,
  UserCog,
  UserX,
  Users,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "../../lib/supabase";

type RoleRow = {
  id: string;
  code: string;
  name: string;
};

type UserRoleRow = {
  id: string;
  role_id: string;
  roles: RoleRow | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  created_at?: string | null;
  user_roles?: UserRoleRow[];
};

type Feedback = { type: "success" | "error"; message: string } | null;

const pageSizeOptions = [10, 25, 50, 100];

function getInitial(user: ProfileRow) {
  return (user.full_name || user.email || "U").trim().charAt(0).toUpperCase();
}

function getUserRoles(user: ProfileRow) {
  return (user.user_roles || []).map((userRole) => userRole.roles).filter(Boolean) as RoleRow[];
}

function getStatusMeta(status?: string | null) {
  if (status === "active") return { label: "Aktif", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (status === "inactive") return { label: "Nonaktif", className: "border-slate-200 bg-slate-100 text-slate-700" };
  if (status === "suspended") return { label: "Ditahan", className: "border-rose-200 bg-rose-50 text-rose-700" };
  return { label: status || "Belum jelas", className: "border-amber-200 bg-amber-50 text-amber-700" };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function SystemUsersPage() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null);
  const [userRolesInput, setUserRolesInput] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const notify = useCallback((message: string, type: NonNullable<Feedback>["type"] = "success") => {
    setFeedback({ message, type });
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setFeedback(null);

    const [rolesResult, usersResult] = await Promise.all([
      supabase.from("roles").select("id, code, name").order("name"),
      supabase
        .from("profiles")
        .select(`
          id, full_name, email, status, created_at,
          user_roles (
            id, role_id, roles (id, code, name)
          )
        `)
        .order("created_at", { ascending: false }),
    ]);

    if (rolesResult.error || usersResult.error) {
      notify(rolesResult.error?.message || usersResult.error?.message || "Gagal memuat data pengguna.", "error");
    } else {
      setRoles((rolesResult.data || []) as RoleRow[]);
      setUsers((usersResult.data || []) as unknown as ProfileRow[]);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, [notify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), feedback.type === "error" ? 7000 : 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterRole, filterStatus, pageSize, searchQuery]);

  const stats = useMemo(() => {
    const usersWithRoles = users.filter((user) => getUserRoles(user).length > 0).length;
    const withoutRoles = users.length - usersWithRoles;
    const active = users.filter((user) => user.status === "active").length;
    const suspended = users.filter((user) => user.status === "suspended" || user.status === "inactive").length;
    const superAdmins = users.filter((user) => getUserRoles(user).some((role) => role.code === "super_admin")).length;

    return { total: users.length, active, suspended, withoutRoles, superAdmins };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      const rolesForUser = getUserRoles(user);
      const matchSearch =
        !query ||
        (user.full_name || "").toLowerCase().includes(query) ||
        (user.email || "").toLowerCase().includes(query) ||
        rolesForUser.some((role) => role.name.toLowerCase().includes(query) || role.code.toLowerCase().includes(query));
      const matchRole =
        filterRole === "all" ||
        (filterRole === "without_role" ? rolesForUser.length === 0 : rolesForUser.some((role) => role.code === filterRole));
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "unknown" ? !user.status : (user.status || "unknown") === filterStatus);

      return matchSearch && matchRole && matchStatus;
    });
  }, [filterRole, filterStatus, searchQuery, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = filteredUsers.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredUsers.length);
  const paginatedUsers = filteredUsers.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const openEditModal = (user: ProfileRow) => {
    setEditingUser(user);
    setUserRolesInput(getUserRoles(user).map((role) => role.code));
  };

  const handleToggleRole = (code: string) => {
    setUserRolesInput((current) => (current.includes(code) ? current.filter((role) => role !== code) : [...current, code]));
  };

  const saveRoles = async () => {
    if (!editingUser) return;

    setIsSaving(true);
    setFeedback(null);

    try {
      const currentRoles = getUserRoles(editingUser).map((role) => role.code);
      const toAdd = userRolesInput.filter((code) => !currentRoles.includes(code));
      const toRemove = currentRoles.filter((code) => !userRolesInput.includes(code));

      if (toAdd.length > 0) {
        const insertData = toAdd.map((code) => {
          const role = roles.find((item) => item.code === code);
          if (!role) throw new Error(`Role ${code} tidak ditemukan.`);
          return { user_id: editingUser.id, role_id: role.id };
        });
        const { error } = await supabase.from("user_roles").insert(insertData);
        if (error) throw error;
      }

      if (toRemove.length > 0) {
        const removeRoleIds = toRemove
          .map((code) => roles.find((item) => item.code === code)?.id)
          .filter(Boolean) as string[];
        const { error } = await supabase.from("user_roles").delete().eq("user_id", editingUser.id).in("role_id", removeRoleIds);
        if (error) throw error;
      }

      notify("Role pengguna berhasil diperbarui.");
      setEditingUser(null);
      await loadData(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menyimpan role pengguna.", "error");
    }

    setIsSaving(false);
  };

  const exportToCSV = () => {
    const csvRows = [["Nama", "Email", "Status", "Roles", "Tanggal Dibuat"]];
    filteredUsers.forEach((user) => {
      csvRows.push([
        user.full_name || "",
        user.email || "",
        user.status || "",
        getUserRoles(user).map((role) => role.name).join("; "),
        formatDate(user.created_at),
      ]);
    });

    const csvString = csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csvString}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pengguna-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack">
      <div className="page-hero flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Badge variant="outline" className="border-white/35 bg-white/15 text-white">Akses Sistem</Badge>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-white">Akses & Pengguna</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/80">
            Kelola akun, role, dan kesiapan akses pengguna LMS dari satu pusat kendali.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => void loadData(true)}
            disabled={isRefreshing || isLoading}
            className="h-10 border-white/35 bg-white/15 !text-white hover:bg-white/25 hover:!text-white"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Muat Ulang
          </Button>
          <Button onClick={exportToCSV} disabled={filteredUsers.length === 0} className="h-10 bg-white !text-primary hover:bg-white/90">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {feedback && (
        <Alert className={feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-900"}>
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{feedback.type === "success" ? "Berhasil" : "Gagal"}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard title="Total Pengguna" value={stats.total} description="akun terdaftar" icon={Users} />
        <MetricCard title="Aktif" value={stats.active} description="siap menggunakan sistem" icon={BadgeCheck} />
        <MetricCard title="Bermasalah" value={stats.suspended} description="nonaktif atau ditahan" icon={UserX} />
        <MetricCard title="Tanpa Role" value={stats.withoutRoles} description="perlu ditindaklanjuti" icon={AlertCircle} />
        <MetricCard title="Super Admin" value={stats.superAdmins} description="akses tertinggi" icon={ShieldCheck} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Audit Akses</CardTitle>
          <CardDescription>Prioritas pemeriksaan untuk menjaga hak akses tetap rapi dan aman.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <WorkflowItem
            done={stats.withoutRoles === 0}
            title="Lengkapi role kosong"
            description={stats.withoutRoles ? `${stats.withoutRoles} pengguna belum memiliki role.` : "Semua pengguna sudah memiliki role."}
            action="Filter Tanpa Role"
            onClick={() => {
              setFilterRole("without_role");
              setFilterStatus("all");
            }}
          />
          <WorkflowItem
            done={stats.suspended === 0}
            title="Review akun bermasalah"
            description={stats.suspended ? `${stats.suspended} akun nonaktif atau ditahan.` : "Tidak ada akun nonaktif/ditahan."}
            action="Filter Nonaktif"
            onClick={() => setFilterStatus("inactive")}
          />
          <WorkflowItem
            done={stats.superAdmins <= 3}
            title="Audit super admin"
            description={`${stats.superAdmins} akun memiliki akses super admin.`}
            action="Lihat Super Admin"
            onClick={() => setFilterRole("super_admin")}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Direktori Pengguna</CardTitle>
            <CardDescription>Cari akun, filter status/role, audit akses, dan kelola role pengguna.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_220px_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama, email, atau role..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-11 pl-9"
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <select className="h-11 w-full bg-transparent text-sm font-medium outline-none" value={filterRole} onChange={(event) => setFilterRole(event.target.value)}>
                <option value="all">Semua Role</option>
                <option value="without_role">Tanpa Role</option>
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>{role.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              <select className="h-11 w-full bg-transparent text-sm font-medium outline-none" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
                <option value="suspended">Ditahan</option>
                <option value="unknown">Belum jelas</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-muted-foreground">
              Menampilkan <span className="font-semibold text-foreground">{filteredUsers.length === 0 ? 0 : pageStartIndex + 1}-{pageEndIndex}</span> dari{" "}
              <span className="font-semibold text-foreground">{filteredUsers.length}</span> hasil
              {filteredUsers.length !== users.length ? `, total ${users.length} pengguna` : ""}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="system-users-page-size">Baris</label>
              <select id="system-users-page-size" className="field-control h-9 w-24 text-sm" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full table-fixed text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-[360px] px-5 py-4 font-semibold">Pengguna</th>
                    <th className="w-[150px] px-5 py-4 text-center font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Roles</th>
                    <th className="w-[150px] px-5 py-4 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-16 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                        <p className="font-medium">Memuat pengguna...</p>
                      </td>
                    </tr>
                  ) : paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-16 text-center text-muted-foreground">
                        <UserIcon className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                        <p className="font-semibold text-foreground">Pengguna tidak ditemukan</p>
                        <p className="mt-1 text-sm">Ubah kata kunci, role, atau status filter.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => {
                      const statusMeta = getStatusMeta(user.status);
                      const rolesForUser = getUserRoles(user);

                      return (
                        <tr key={user.id} className="hover:bg-muted/30">
                          <td className="px-5 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 font-bold text-primary">
                                {getInitial(user)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{user.full_name || "-"}</p>
                                <p className="mt-1 flex min-w-0 items-center gap-2 truncate text-sm text-muted-foreground">
                                  <Mail className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{user.email || "-"}</span>
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">Dibuat: {formatDate(user.created_at)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <Badge variant="outline" className={`min-w-[90px] justify-center ${statusMeta.className}`}>{statusMeta.label}</Badge>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {rolesForUser.length === 0 ? (
                                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Tanpa role</Badge>
                              ) : (
                                rolesForUser.map((role) => (
                                  <Badge key={role.code} variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{role.name}</Badge>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <Button variant="outline" size="sm" className="h-9 whitespace-nowrap !text-foreground" onClick={() => openEditModal(user)}>
                              <Edit2 className="h-4 w-4" />
                              Role
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t bg-muted/30 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">Audit akses: {stats.withoutRoles === 0 ? "lengkap" : `${stats.withoutRoles} akun tanpa role`}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-9 !text-foreground" disabled={safeCurrentPage <= 1 || filteredUsers.length === 0} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </Button>
                <span className="min-w-[110px] text-center text-xs font-medium text-muted-foreground">
                  Halaman {filteredUsers.length === 0 ? 0 : safeCurrentPage} / {filteredUsers.length === 0 ? 0 : totalPages}
                </span>
                <Button type="button" variant="outline" size="sm" className="h-9 !text-foreground" disabled={safeCurrentPage >= totalPages || filteredUsers.length === 0} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
                  Berikutnya
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
            <CardHeader className="border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Kelola Role Pengguna</CardTitle>
                  <CardDescription className="mt-1">
                    Atur hak akses untuk <strong>{editingUser.full_name || editingUser.email}</strong>.
                  </CardDescription>
                </div>
                <Button variant="ghost" className="h-8 w-8 shrink-0 p-0" onClick={() => setEditingUser(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 overflow-y-auto p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Ringkasan</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{getInitial(editingUser)}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{editingUser.full_name || "-"}</p>
                    <p className="truncate text-xs text-muted-foreground">{editingUser.email || "-"}</p>
                  </div>
                </div>
                <div className="rounded-lg border bg-background p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Role dipilih</p>
                  <p className="mt-1 text-2xl font-bold">{userRolesInput.length}</p>
                </div>
              </div>

              <div className="space-y-2">
                {roles.map((role) => {
                  const isActive = userRolesInput.includes(role.code);
                  return (
                    <label
                      key={role.code}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 transition ${
                        isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-md border ${isActive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
                          {isActive && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>{role.name}</p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{role.code}</p>
                        </div>
                      </div>
                      <input type="checkbox" className="sr-only" checked={isActive} onChange={() => handleToggleRole(role.code)} />
                    </label>
                  );
                })}
              </div>
            </CardContent>
            <div className="flex justify-end gap-3 border-t bg-muted/30 p-4">
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)} disabled={isSaving}>Batal</Button>
              <Button onClick={saveRoles} disabled={isSaving}>
                {isSaving ? "Menyimpan..." : "Simpan Role"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function WorkflowItem({
  done,
  title,
  description,
  action,
  onClick,
}: {
  done: boolean;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start gap-3">
        {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />}
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <Button type="button" variant={done ? "outline" : "default"} size="sm" className="mt-3 h-9 whitespace-nowrap" onClick={onClick}>
            <KeyRound className="h-4 w-4" />
            {action}
          </Button>
        </div>
      </div>
    </div>
  );
}
