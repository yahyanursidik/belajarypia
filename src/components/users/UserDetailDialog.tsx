import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Plus,
  RefreshCw,
  Shield,
  UserRound,
  AlertTriangle,
} from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { UserRoleWizard } from "./UserRoleWizard";
import {
  userInitial,
  userName,
  userStatus,
  userTime,
  userRoleLabels,
  userRoleHints,
  type UserDetail,
  type UserAssignment,
  type UserRelation,
} from "../../lib/usersWorkspace";
function Relations({
  title,
  items,
  kind,
}: {
  title: string;
  items: UserRelation[];
  kind: "participant" | "program" | "class" | "unit";
}) {
  const [all, setAll] = useState(false);
  return (
    <section className="users-relations">
      <h3>
        {title}
        <span>{items.length}</span>
      </h3>
      {!items.length ? (
        <p className="users-muted">Belum ada tautan.</p>
      ) : (
        <ul>
          {items.slice(0, all ? undefined : 5).map((item, i) => (
            <li key={`${item.id}:${i}`}>
              {kind === "unit" ? (
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.role || "Keanggotaan unit"}</small>
                </div>
              ) : (
                <Link
                  to={
                    kind === "participant"
                      ? `/system/peserta/${item.id}`
                      : kind === "program"
                        ? `/system/program/${item.id}/kurikulum`
                        : `/system/program/${item.program_id}/angkatan-kelas`
                  }
                >
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {[item.number || item.program_name, item.relation]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </div>
                  <ArrowUpRight size={15} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length > 5 && (
        <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
          {all ? "Ringkas" : `Lihat ${items.length} tautan`}
        </Button>
      )}
    </section>
  );
}
export function UserDetailDialog({
  data,
  loading,
  error,
  actor,
  onClose,
  onReload,
  onSaved,
}: {
  data: UserDetail | null;
  loading: boolean;
  error: string;
  actor: string;
  onClose: () => void;
  onReload: () => void;
  onSaved: (d: UserDetail) => void;
}) {
  const [tab, setTab] = useState("account"),
    [wizard, setWizard] = useState<"add" | UserAssignment | null>(null);
  const tabs = [
    ["account", "Akun"],
    ["roles", "Peran"],
    ["relations", "Hubungan"],
    ["history", "Riwayat"],
  ];
  return (
    <Dialog
      title={data ? userName(data.profile) : "Detail pengguna"}
      onClose={onClose}
      className="users-detail-dialog"
    >
      {!data ? (
        <div className="users-empty" aria-busy={loading}>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <Button onClick={onReload}>Coba lagi</Button>
            </>
          ) : (
            <p role="status">Memuat detail pengguna…</p>
          )}
        </div>
      ) : (
        <>
          <header className="users-identity">
            <span className="users-avatar">{userInitial(data.profile)}</span>
            <div>
              <strong>{data.profile.email || "Email belum tersedia"}</strong>
              <span
                className={`users-status users-status-${data.profile.status}`}
              >
                {userStatus(data.profile.status)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label="Muat ulang detail pengguna"
              onClick={onReload}
            >
              <RefreshCw size={15} />
            </Button>
          </header>
          <nav
            role="tablist"
            aria-label="Bagian detail pengguna"
            className="users-detail-tabs"
          >
            {tabs.map(([key, label]) => (
              <button
                key={key}
                id={`users-tab-${key}`}
                role="tab"
                aria-selected={tab === key}
                aria-controls={`users-panel-${key}`}
                tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
                onKeyDown={(e) => {
                  if (
                    !["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)
                  )
                    return;
                  e.preventDefault();
                  const i = tabs.findIndex((t) => t[0] === key),
                    next =
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? 3
                          : (i + (e.key === "ArrowRight" ? 1 : 3)) % 4;
                  setTab(tabs[next][0]);
                  const buttons =
                    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      "button",
                    );
                  buttons?.[next]?.focus();
                }}
              >
                {label}
                {key === "roles" && <span>{data.assignments.length}</span>}
              </button>
            ))}
          </nav>
          <div
            className="users-detail-panel"
            role="tabpanel"
            id={`users-panel-${tab}`}
            aria-labelledby={`users-tab-${tab}`}
            tabIndex={0}
          >
            {tab === "account" && (
              <>
                <div className="users-account-facts">
                  <div>
                    <span>Akun login</span>
                    <strong>
                      {data.auth.account_exists ? "Tersedia" : "Belum tersedia"}
                    </strong>
                  </div>
                  <div>
                    <span>Konfirmasi email</span>
                    <strong>
                      {data.auth.email_confirmed
                        ? "Tercatat"
                        : "Belum tercatat"}
                    </strong>
                  </div>
                  <div>
                    <span>Login terakhir</span>
                    <strong>{userTime(data.auth.last_sign_in_at)}</strong>
                  </div>
                  <div>
                    <span>Pembatasan login</span>
                    <strong>
                      {data.auth.login_blocked
                        ? "Sedang diblokir"
                        : "Tidak tercatat"}
                    </strong>
                  </div>
                  <div>
                    <span>Kontak</span>
                    <strong>{data.profile.phone || "Belum diisi"}</strong>
                  </div>
                  <div>
                    <span>Profil dibuat</span>
                    <strong>{userTime(data.profile.created_at)}</strong>
                  </div>
                </div>
                {!data.assignments.length && (
                  <div className="users-attention">
                    <AlertTriangle size={18} />
                    <span>Belum ada peran untuk membuka portal.</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTab("roles")}
                    >
                      Kelola peran
                    </Button>
                  </div>
                )}
                {data.profile.status !== "active" && (
                  <p className="users-warning">
                    Status profil tidak aktif. Status ini berbeda dari
                    pemblokiran login.
                  </p>
                )}
                <section className="users-recovery">
                  <h3>Pemulihan sandi</h3>
                  <p>
                    Pemilik akun memakai “Lupa kata sandi” di halaman masuk dan
                    menerima tautan melalui emailnya.
                  </p>
                </section>
                <div className="users-inline-links">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTab("relations")}
                  >
                    <UserRound size={15} />
                    Data peserta & penugasan
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to={
                        "/system/audit?category=auth&entity=profile&target=" +
                        data.profile.id
                      }
                    >
                      Audit akses
                      <ArrowUpRight size={14} />
                    </Link>
                  </Button>
                </div>
              </>
            )}
            {tab === "roles" && (
              <>
                <div className="users-section-heading">
                  <div>
                    <h3>Penugasan peran</h3>
                    <p>Satu peran dapat memiliki beberapa cakupan.</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={
                      data.profile.status !== "active" ||
                      !data.auth.account_exists ||
                      data.auth.login_blocked
                    }
                    onClick={() => setWizard("add")}
                  >
                    <Plus size={15} />
                    Tambah peran
                  </Button>
                </div>
                {!data.assignments.length && (
                  <p className="users-empty">Belum ada penugasan peran.</p>
                )}
                <div className="users-assignments">
                  {data.assignments.map((a) => (
                    <article key={a.id}>
                      <span className="users-role-icon">
                        <Shield size={18} />
                      </span>
                      <div>
                        <strong>{userRoleLabels[a.code] ?? a.name}</strong>
                        <p>
                          {a.scope_name}
                          {a.scope_type === "unit"
                            ? " · Unit"
                            : a.scope_type === "program"
                              ? " · Program"
                              : ""}
                        </p>
                        <small>
                          {userRoleHints[a.code] ??
                            "Peran lama; periksa kebijakan akses sebelum mengubahnya."}
                        </small>
                        {!a.supported_scope && (
                          <p className="users-warning">
                            Cakupan tersimpan ini belum didukung konsisten di
                            seluruh modul.
                          </p>
                        )}
                        {a.duplicates > 1 && (
                          <p className="users-warning">
                            Ada {a.duplicates} penugasan dengan peran dan
                            cakupan yang sama.
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          a.code === "super_admin" && data.profile.id === actor
                        }
                        onClick={() => setWizard(a)}
                      >
                        Lepas
                      </Button>
                    </article>
                  ))}
                </div>
                {data.profile.id === actor &&
                  data.assignments.some((a) => a.code === "super_admin") && (
                    <p className="users-hint">
                      Peran superadmin akun Anda dilindungi dari pelepasan di
                      halaman ini.
                    </p>
                  )}
              </>
            )}
            {tab === "relations" && (
              <div className="users-relation-grid">
                <Relations
                  title="Profil peserta"
                  items={data.participants}
                  kind="participant"
                />
                <Relations
                  title="Anak yang didampingi"
                  items={data.children}
                  kind="participant"
                />
                <Relations
                  title="Program diampu"
                  items={data.program_assignments}
                  kind="program"
                />
                <Relations
                  title="Kelas mengajar"
                  items={data.classes}
                  kind="class"
                />
                <Relations
                  title="Halaqah mentoring"
                  items={data.halaqahs}
                  kind="class"
                />
                <Relations
                  title="Keanggotaan unit"
                  items={data.units}
                  kind="unit"
                />
                <div className="users-inline-links">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/system/peserta">
                      Kelola peserta & wali
                      <ArrowUpRight size={14} />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            {tab === "history" && (
              <>
                <h3>Perubahan peran terbaru</h3>
                {!data.history.length && (
                  <p className="users-empty">
                    Belum ada perubahan peran yang dicatat melalui halaman ini.
                  </p>
                )}
                <ol className="users-history">
                  {data.history.map((h) => (
                    <li key={h.id}>
                      <strong>
                        {h.action === "user.role_granted"
                          ? "Peran ditambahkan"
                          : "Penugasan dilepas"}{" "}
                        · {userRoleLabels[h.details.role] ?? h.details.role}
                      </strong>
                      <small>
                        {h.actor_name} · {userTime(h.created_at)}
                      </small>
                      <p>{h.details.reason}</p>
                    </li>
                  ))}
                </ol>
                <Button asChild variant="outline" size="sm">
                  <Link
                    to={
                      "/system/audit?category=auth&entity=profile&target=" +
                      data.profile.id
                    }
                  >
                    Buka audit akses
                    <ArrowUpRight size={14} />
                  </Link>
                </Button>
              </>
            )}
          </div>
          {wizard && (
            <UserRoleWizard
              data={data}
              actor={actor}
              assignment={wizard === "add" ? undefined : wizard}
              onClose={() => setWizard(null)}
              onReload={() => {
                setWizard(null);
                onReload();
              }}
              onSaved={(value) => {
                setWizard(null);
                onSaved(value);
                setTab("roles");
              }}
            />
          )}
        </>
      )}
    </Dialog>
  );
}
