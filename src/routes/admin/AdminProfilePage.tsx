import { useCallback, useState } from "react";
import { Link, useBeforeUnload, useLocation } from "react-router-dom";
import {
  UserRound,
  ArrowUpRight,
  ShieldCheck,
  KeyRound,
  Mail,
  RefreshCw,
  History,
  Clock3,
  CheckCheck,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { useMyProfile } from "../../lib/profileData";
import {
  type ProfileWorkspace,
  profileInitial,
  profileFieldLabel,
} from "../../lib/profileWorkspace";
import { userRoleLabels, userTime, userStatus } from "../../lib/usersWorkspace";
import { Button } from "../../components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import { Dialog } from "../../components/ui/dialog";
import { ProfileEditor } from "../../components/profile/ProfileEditor";
import { ProfilePasswordDialog } from "../../components/profile/ProfilePasswordDialog";
export function AdminProfilePage() {
  const { user, refresh } = useAuthSession(),
    { data, loading, error, load, update } = useMyProfile(user?.id),
    location = useLocation(),
    base = location.pathname.startsWith("/system") ? "/system" : location.pathname.startsWith("/teacher") ? "/teacher" : "/admin";
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [discard, setDiscard] = useState(false),
    [passwordOpen, setPasswordOpen] = useState(false),
    [notice, setNotice] = useState("");
  useBeforeUnload(
    useCallback(
      (e: BeforeUnloadEvent) => {
        if (dirty || busy) {
          e.preventDefault();
          e.returnValue = "";
        }
      },
      [dirty, busy],
    ),
  );
  async function reload() {
    if (busy) return;
    setDiscard(false);
    const next = await load();
    if (next) {
      setVersion((v) => v + 1);
      setDirty(false);
      setNotice("");
      void refresh().catch(() =>
        setNotice("Profil dimuat. Muat ulang sesi untuk memperbarui menu."),
      );
    }
  }
  function requestReload() {
    if (dirty) setDiscard(true);
    else void reload();
  }
  async function saved(next: ProfileWorkspace) {
    update(next);
    setDirty(false);
    try {
      const state = await refresh();
      if (
        state.profile?.id !== next.profile.id ||
        state.profile.full_name !== next.profile.full_name
      )
        throw new Error();
    } catch {
      setNotice(
        "Profil tersimpan. Muat ulang sesi untuk memperbarui nama di menu.",
      );
    }
  }
  const name = data?.profile.full_name || data?.login.email || "Akun saya",
    canEdit =
      !!data && data.profile.status === "active" && !data.login.login_blocked,
    governance =
      base === "/system" &&
      canEdit &&
      data.assignments.some((a) => a.code === "super_admin");
  return (
    <div className="profile-workspace">
      <header className="profile-page-header">
        <div>
          <span>
            <UserRound size={15} />
            AKUN SAYA
          </span>
          <h1>Profil Saya</h1>
          <p>Identitas, keamanan, dan akses akun.</p>
        </div>
        <div>
          <Button asChild variant="outline">
            <Link to={base}>
              <LayoutDashboard size={16} />
              Beranda
              <ArrowUpRight size={14} />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={requestReload}
            disabled={loading || busy}
            aria-label="Muat ulang profil"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </header>
      {error && (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>Profil belum dapat dimuat</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              size="sm"
              variant="outline"
              onClick={requestReload}
              disabled={loading || busy}
            >
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {notice && (
        <p className="profile-notice" role="status">
          <CheckCheck size={17} />
          {notice}
        </p>
      )}
      {!data ? (
        <section className="profile-panel profile-loading" role="status">
          {loading
            ? "Memuat profil akun…"
            : "Profil belum tersedia. Coba muat ulang."}
        </section>
      ) : (
        <>
          <section className="profile-identity" aria-label="Ringkasan akun">
            <div className="profile-initial" aria-hidden="true">
              {profileInitial(name)}
            </div>
            <div>
              <h2>{data.profile.full_name?.trim() || "Nama belum diisi"}</h2>
              <p>{data.login.email || "Email login belum tersedia"}</p>
              <div className="profile-identity-tags">
                <span
                  className={
                    "profile-status " +
                    (data.profile.status === "active"
                      ? "profile-status-active"
                      : "profile-status-inactive")
                  }
                >
                  {userStatus(data.profile.status)}
                </span>
                <span>{data.assignments.length} penugasan peran</span>
              </div>
            </div>
            <div className="profile-updated">
              <Clock3 size={14} />
              {error ? "Snapshot" : "Data"} {userTime(data.generated_at)}
              {loading ? " · Memuat…" : ""}
            </div>
          </section>
          {!canEdit && (
            <p className="profile-restricted" role="status">
              Profil tidak aktif atau login dibatasi. Hubungi pengelola untuk
              perubahan akun.
            </p>
          )}
          <div className="profile-content-grid">
            <div className="profile-primary">
              <ProfileEditor
                key={data.profile.id + ":" + version}
                data={data}
                disabled={!canEdit || loading || busy}
                onDirty={setDirty}
                onBusy={setBusy}
                onSaved={(next) => void saved(next)}
                onReload={requestReload}
              />
              <section className="profile-panel" aria-label="Keamanan akun">
                <header>
                  <span className="profile-section-icon profile-icon-violet">
                    <KeyRound size={19} />
                  </span>
                  <div>
                    <h2>Keamanan akun</h2>
                    <p>Informasi masuk dan kata sandi.</p>
                  </div>
                </header>
                <dl className="profile-account-facts">
                  <div>
                    <dt>Email masuk</dt>
                    <dd>{data.login.email || "Belum tersedia"}</dd>
                  </div>
                  <div>
                    <dt>Konfirmasi email</dt>
                    <dd>
                      <span
                        className={
                          "profile-indicator " +
                          (data.login.email_confirmed
                            ? "profile-indicator-good"
                            : "profile-indicator-pending")
                        }
                      >
                        {data.login.email_confirmed
                          ? "Tercatat"
                          : "Belum tercatat"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Profil dibuat</dt>
                    <dd>{userTime(data.profile.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Terakhir masuk</dt>
                    <dd>
                      {data.login.last_sign_in_at
                        ? userTime(data.login.last_sign_in_at)
                        : "Belum tercatat"}
                    </dd>
                  </div>
                  <div>
                    <dt>Pembatasan login</dt>
                    <dd>
                      {data.login.login_blocked
                        ? "Sedang dibatasi"
                        : "Tidak tercatat"}
                    </dd>
                  </div>
                  <div>
                    <dt>Metode masuk</dt>
                    <dd>
                      {[
                        ...new Set([
                          ...(data.login.password_enabled
                            ? ["Email & sandi"]
                            : []),
                          ...data.login.providers.map((p) =>
                            p === "email"
                              ? "Email"
                              : p === "google"
                                ? "Google"
                                : p,
                          ),
                        ]),
                      ].join(" · ") || "Belum tercatat"}
                    </dd>
                  </div>
                  {data.profile.email !== data.login.email && (
                    <div>
                      <dt>Email profil</dt>
                      <dd>{data.profile.email || "Belum diisi"}</dd>
                    </div>
                  )}
                </dl>
                <footer className="profile-security-footer">
                  <span>
                    <Mail size={14} />
                    Email masuk dikelola oleh akun login.
                  </span>
                  <Button
                    variant="outline"
                    disabled={!canEdit || loading || busy}
                    onClick={() => setPasswordOpen(true)}
                  >
                    <KeyRound size={15} />
                    {data.login.password_enabled
                      ? "Ubah kata sandi"
                      : "Atur kata sandi"}
                  </Button>
                </footer>
              </section>
            </div>
            <aside className="profile-secondary">
              <section className="profile-panel" aria-label="Peran dan akses">
                <header>
                  <span className="profile-section-icon profile-icon-amber">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    <h2>Peran & cakupan</h2>
                    <p>Penugasan akun saat ini.</p>
                  </div>
                </header>
                {data.assignments.length ? (
                  <ul className="profile-role-list">
                    {data.assignments.map((a) => (
                      <li key={a.id}>
                        <span className="profile-role-dot" />
                        <div>
                          <strong>{userRoleLabels[a.code] ?? a.name}</strong>
                          <small>{a.scope_name}</small>
                          {!a.supported_scope && (
                            <small className="profile-scope-note">
                              Cakupan lama · perlu ditinjau pengelola
                            </small>
                          )}
                        </div>
                        {a.duplicates > 1 && (
                          <span className="profile-duplicate">Duplikat</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="profile-empty">
                    Belum ada penugasan peran. Hubungi pengelola.
                  </p>
                )}
                {governance && (
                  <div className="profile-panel-links">
                    <Link to={"/system/pengguna?user=" + data.profile.id}>
                      Kelola penugasan saya
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                )}
              </section>
              <section className="profile-panel" aria-label="Riwayat profil">
                <header>
                  <span className="profile-section-icon profile-icon-green">
                    <History size={19} />
                  </span>
                  <div>
                    <h2>Riwayat profil</h2>
                    <p>Lima perubahan profil terbaru.</p>
                  </div>
                </header>
                {data.history.length ? (
                  <ol className="profile-history">
                    {data.history.map((h) => (
                      <li key={h.id}>
                        <span />
                        <div>
                          <strong>
                            {h.fields.map(profileFieldLabel).join(", ")}
                          </strong>
                          <small>{userTime(h.created_at)}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="profile-empty">
                    Belum ada perubahan profil yang tercatat.
                  </p>
                )}
                {governance && (
                  <div className="profile-panel-links">
                    <Link
                      to={
                        "/system/audit?entity=profile&target=" + data.profile.id
                      }
                    >
                      Buka audit profil
                      <ArrowUpRight size={14} />
                    </Link>
                    <Link to={"/system/audit?actor=" + data.profile.id}>
                      Aktivitas saya
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                )}
              </section>
              <Link className="profile-help-link" to={base === "/teacher" ? "/teacher/bantuan" : base + "/helpdesk"}>
                <span>Butuh bantuan akun?</span>Buka Helpdesk
                <ArrowRight size={15} />
              </Link>
            </aside>
          </div>
        </>
      )}
      {discard && (
        <Dialog
          title="Muat profil terbaru?"
          onClose={() => setDiscard(false)}
          className="profile-discard-dialog"
        >
          <p className="profile-muted">
            Perubahan yang belum disimpan akan diganti dengan data server.
          </p>
          <footer className="profile-dialog-footer">
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Lanjut mengedit
            </Button>
            <Button onClick={() => void reload()}>Muat data terbaru</Button>
          </footer>
        </Dialog>
      )}
      {passwordOpen && data && (
        <ProfilePasswordDialog
          email={data.login.email ?? name}
          onClose={() => setPasswordOpen(false)}
          onSaved={() => {
            setPasswordOpen(false);
            setNotice(
              "Kata sandi berhasil diperbarui. Gunakan sandi baru saat masuk berikutnya.",
            );
            void refresh().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
