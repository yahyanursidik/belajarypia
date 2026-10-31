import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Download,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundPlus,
  Users,
  UserX,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import { UserDetailDialog } from "../../components/users/UserDetailDialog";
import { useUsers, useUserDetail } from "../../lib/usersData";
import {
  userFilters,
  userId,
  userName,
  userInitial,
  userStatus,
  userRoleLabels,
  userTime,
  usersCsv,
  usersError,
  type UserList,
  type UserDetail,
} from "../../lib/usersWorkspace";
import { supabase } from "../../lib/supabase";
import { useAuthSession } from "../../app/providers/authSessionContext";
export function SystemUsersPage() {
  const [params, setParams] = useSearchParams();
  const filters = userFilters(params),
    selected = userId(params.get("user"));
  const { data, roles, programs, loading, error, load } = useUsers(filters),
    detail = useUserDetail(selected);
  const { user, refresh } = useAuthSession();
  const [search, setSearch] = useState(filters.q),
    [message, setMessage] = useState(""),
    [exportError, setExportError] = useState(""),
    [exporting, setExporting] = useState(false);
  const exportController = useRef<AbortController | null>(null);
  const exportKey = JSON.stringify(filters);
  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(
      () =>
        setParams(
          (current) => {
            const next = new URLSearchParams(current);
            if (search.trim()) next.set("q", search.slice(0, 120));
            else next.delete("q");
            next.delete("page");
            next.delete("user");
            return next;
          },
          { replace: true },
        ),
      350,
    );
    return () => clearTimeout(timer);
  }, [search, filters.q, setParams]);
  useEffect(() => {
    exportController.current?.abort();
    setExporting(false);
    setExportError("");
    return () => exportController.current?.abort();
  }, [exportKey]);
  function update(changes: Record<string, string | null>) {
    setMessage("");
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
      }
      if (!("page" in changes)) next.delete("page");
      if (!("user" in changes)) next.delete("user");
      return next;
    });
  }
  const pages = data ? Math.max(1, Math.ceil(data.total / filters.size)) : 1;
  useEffect(() => {
    if (
      !data ||
      loading ||
      filters.page <= Math.max(1, Math.ceil(data.total / filters.size))
    )
      return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(
          "page",
          String(Math.max(1, Math.ceil(data.total / filters.size))),
        );
        return next;
      },
      { replace: true },
    );
  }, [data, loading, filters.page, filters.size, setParams]);
  async function exportCsv() {
    const c = new AbortController();
    exportController.current?.abort();
    exportController.current = c;
    setExporting(true);
    setExportError("");
    try {
      const r = await supabase
        .rpc("system_users_list", { p_filters: { ...filters, export: true } })
        .abortSignal(c.signal);
      if (r.error) throw r.error;
      const value = r.data as UserList;
      if (!Array.isArray(value?.rows) || value.rows.length !== value.total)
        throw new Error("Data ekspor belum lengkap. Ulangi ekspor.");
      if (c.signal.aborted) return;
      const url = URL.createObjectURL(
          new Blob([usersCsv(value.rows)], { type: "text/csv;charset=utf-8;" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = `pengguna-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        `${value.total.toLocaleString("id-ID")} pengguna diekspor sesuai filter.`,
      );
    } catch (e) {
      if (!c.signal.aborted) setExportError(usersError(e));
    } finally {
      if (!c.signal.aborted) setExporting(false);
    }
  }
  function saved(next: UserDetail) {
    detail.update(next);
    setMessage("Penugasan peran tersimpan dan dicatat di audit.");
    void load();
    if (next.profile.id === user?.id)
      void refresh().catch(() =>
        setMessage("Peran tersimpan. Muat ulang sesi untuk memperbarui menu."),
      );
  }
  const metrics = [
    {
      key: "total",
      label: "Seluruh akun",
      icon: Users,
      tone: "blue",
      filters: {},
    },
    {
      key: "without_role",
      label: "Tanpa peran",
      icon: ShieldAlert,
      tone: "amber",
      filters: { role: "without_role" },
    },
    {
      key: "nonactive",
      label: "Profil nonaktif",
      icon: UserX,
      tone: "violet",
      filters: { status: "nonactive" },
    },
    {
      key: "superadmins",
      label: "Profil superadmin aktif",
      icon: ShieldCheck,
      tone: "green",
      filters: { role: "super_admin", status: "active" },
    },
  ] as const;
  return (
    <div className="page-stack users-workspace">
      <header className="users-page-header">
        <div>
          <small className="users-eyebrow">
            <ShieldCheck size={16} />
            TATA KELOLA AKSES
          </small>
          <h1>Akses & Pengguna</h1>
          <p>Akun, peran, dan hubungan pembelajaran.</p>
        </div>
        <div>
          <Button asChild variant="outline">
            <Link to="/system/peserta">
              <UserRoundPlus size={16} />
              Kelola peserta
              <ArrowUpRight size={14} />
            </Link>
          </Button>
          <Button
            variant="outline"
            disabled={loading || !data?.total || exporting}
            onClick={() => void exportCsv()}
          >
            <Download size={16} />
            {exporting ? "Menyiapkan…" : "Ekspor CSV"}
          </Button>
          <Button
            variant="outline"
            aria-label="Muat ulang pengguna"
            disabled={loading}
            onClick={() => {
              void load();
              if (selected) void detail.load();
            }}
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </header>
      <div className="users-metrics" aria-label="Ringkasan seluruh pengguna">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              className={`users-metric users-tone-${m.tone}`}
              aria-label={`${m.label}: ${data?.stats[m.key] ?? "belum tersedia"}`}
              onClick={() => {
                setSearch("");
                setMessage("");
                setParams(new URLSearchParams(m.filters));
              }}
            >
              <Icon size={22} />
              <div>
                <span>{m.label}</span>
                <strong>
                  {data?.stats[m.key]?.toLocaleString("id-ID") ?? "—"}
                </strong>
              </div>
              <ArrowUpRight size={16} />
            </button>
          );
        })}
      </div>
      <section className="users-toolbar" aria-label="Filter pengguna">
        <label className="users-search">
          Cari akun
          <div>
            <Search size={16} />
            <Input
              aria-label="Cari pengguna"
              maxLength={120}
              placeholder="Nama, email, atau peran…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </label>
        <label>
          Peran
          <select
            className="field-control"
            value={filters.role}
            onChange={(e) => update({ role: e.target.value })}
          >
            <option value="all">Semua peran</option>
            <option value="without_role">Tanpa peran</option>
            {filters.role !== "all" &&
              filters.role !== "without_role" &&
              !roles.some((r) => r.code === filters.role) && (
                <option value={filters.role}>
                  {userRoleLabels[filters.role] ?? "Peran terpilih"}
                </option>
              )}
            {roles.map((r) => (
              <option key={r.id} value={r.code}>
                {userRoleLabels[r.code] ?? r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status profil
          <select
            className="field-control"
            value={filters.status}
            onChange={(e) => update({ status: e.target.value })}
          >
            <option value="all">Semua profil</option>
            <option value="active">Aktif</option>
            <option value="nonactive">Semua nonaktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="suspended">Ditahan</option>
            <option value="other">Status lain</option>
          </select>
        </label>
        <label>
          Terhubung ke program
          <select
            className="field-control"
            value={filters.program ?? "all"}
            onChange={(e) =>
              update({
                program: e.target.value === "all" ? null : e.target.value,
              })
            }
          >
            <option value="all">Semua program</option>
            {filters.program &&
              !programs.some((p) => p.id === filters.program) && (
                <option value={filters.program}>Program terpilih</option>
              )}
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Perlu ditinjau
          <select
            className="field-control"
            value={filters.attention}
            onChange={(e) => update({ attention: e.target.value })}
          >
            <option value="all">Semua kondisi</option>
            <option value="unconfirmed">Konfirmasi email belum tercatat</option>
            <option value="missing_auth">Akun login belum tersedia</option>
            <option value="scope">Cakupan lama / tidak didukung</option>
            <option value="duplicates">Duplikasi penugasan peran</option>
          </select>
        </label>
        {(filters.q ||
          filters.role !== "all" ||
          filters.status !== "all" ||
          filters.program ||
          filters.attention !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setMessage("");
              setParams({});
            }}
          >
            Reset filter
          </Button>
        )}
      </section>
      {error && (
        <Alert>
          <AlertTitle>
            {data
              ? "Data terakhir dipertahankan"
              : "Pengguna belum dapat dimuat"}
          </AlertTitle>
          <AlertDescription>
            {error}
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {exportError && (
        <p className="users-error" role="alert">
          {exportError}
        </p>
      )}
      {message && (
        <p className="users-success" role="status">
          {message}
        </p>
      )}
      <section className="users-directory" aria-label="Direktori pengguna">
        <header>
          <div>
            <h2>Direktori akun</h2>
            <span>
              {data
                ? `${data.total.toLocaleString("id-ID")} hasil`
                : "Menunggu data"}
              {loading ? " · Memuat…" : ""}
            </span>
          </div>
          <small>{data ? `Data ${userTime(data.generated_at)}` : ""}</small>
        </header>
        <div className="users-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Status profil</th>
                <th>Peran & cakupan</th>
                <th>Hubungan</th>
                <th>
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data ? (
                data.rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Pengguna">
                      <button
                        className="users-person"
                        onClick={() =>
                          update({ user: row.id, page: String(filters.page) })
                        }
                        aria-label={`Buka akun ${userName(row)}`}
                      >
                        <span className="users-avatar">{userInitial(row)}</span>
                        <span>
                          <strong>{userName(row)}</strong>
                          <small>{row.email || "Email belum tersedia"}</small>
                          {!row.account_exists && (
                            <em>Akun login belum tersedia</em>
                          )}
                        </span>
                      </button>
                    </td>
                    <td data-label="Status profil">
                      <span
                        className={`users-status users-status-${row.status}`}
                      >
                        {userStatus(row.status)}
                      </span>
                    </td>
                    <td data-label="Peran & cakupan">
                      <div className="users-row-roles">
                        {!row.assignments.length ? (
                          <span className="users-role-empty">
                            Belum ada peran
                          </span>
                        ) : (
                          row.assignments.slice(0, 3).map((a) => (
                            <span
                              className="users-role-badge"
                              data-warning={
                                !a.supported_scope || a.duplicates > 1
                              }
                              key={a.id}
                            >
                              <b>{userRoleLabels[a.code] ?? a.name}</b>
                              <small>{a.scope_name}</small>
                            </span>
                          ))
                        )}
                        {row.assignments.length > 3 && (
                          <span className="users-more">
                            +{row.assignments.length - 3} penugasan
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Hubungan">
                      <span className="users-connections">
                        {row.participants_count > 0
                          ? `${row.participants_count} profil peserta`
                          : row.classes_count > 0
                            ? `${row.classes_count} kelas tertaut`
                            : "Lihat detail"}
                      </span>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          update({ user: row.id, page: String(filters.page) })
                        }
                        aria-label={`Detail ${userName(row)}`}
                      >
                        Detail
                        <ArrowUpRight size={14} />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div
                      className="users-empty"
                      role={loading ? "status" : undefined}
                    >
                      {loading
                        ? "Memuat pengguna…"
                        : "Coba muat ulang untuk menampilkan pengguna."}
                    </div>
                  </td>
                </tr>
              )}
              {data && !data.rows.length && (
                <tr>
                  <td colSpan={5}>
                    <div className="users-empty">
                      <Users size={31} />
                      <h3>Tidak ada pengguna pada filter ini</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSearch("");
                          setParams({});
                        }}
                      >
                        Lihat semua akun
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="users-pagination">
          <label>
            Baris
            <select
              value={filters.size}
              onChange={(e) => update({ size: e.target.value })}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span>
            {data?.total
              ? `${(filters.page - 1) * filters.size + 1}–${Math.min(filters.page * filters.size, data.total)} dari ${data.total}`
              : data
                ? "0 hasil"
                : "— hasil"}
          </span>
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={loading || filters.page <= 1 || !data}
              onClick={() => update({ page: String(filters.page - 1) })}
            >
              Sebelumnya
            </Button>
            <span>
              {filters.page}/{pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={loading || filters.page >= pages || !data}
              onClick={() => update({ page: String(filters.page + 1) })}
            >
              Berikutnya
            </Button>
          </div>
        </footer>
      </section>
      {selected && (
        <UserDetailDialog
          key={selected}
          data={detail.data}
          loading={detail.loading}
          error={detail.error}
          actor={user?.id ?? ""}
          onClose={() => update({ user: null, page: String(filters.page) })}
          onReload={() => void detail.load()}
          onSaved={saved}
        />
      )}
    </div>
  );
}
