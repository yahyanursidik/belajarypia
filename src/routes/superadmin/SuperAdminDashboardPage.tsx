import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  Workflow,
  AlertCircle,
  BellRing,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { ProgramFormDialog } from "../../components/programs/ProgramFormDialog";
import { DashboardStartDialog } from "../../components/dashboard/DashboardStartDialog";
import { DashboardActivity } from "../../components/dashboard/DashboardActivity";
import { DashboardPrograms } from "../../components/dashboard/DashboardPrograms";
import {
  DashboardAdmission,
  DashboardAudit,
  DashboardLearning,
  DashboardQueues,
} from "../../components/dashboard/DashboardPanels";
import { useSystemSettings } from "../../lib/useSystemSettings";
import { useSystemDashboard } from "../../lib/dashboardData";
import {
  dashboardDay,
  dashboardHref,
  dashboardMoney,
  dashboardPeriod,
  dashboardProgram,
  dashboardTime,
} from "../../lib/dashboardWorkspace";
export function SuperAdminDashboardPage() {
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const program = dashboardProgram(params.get("program"));
  const days = dashboardPeriod(params.get("days"));
  const query = useSystemDashboard(program, days);
  const { data } = query;
  const [start, setStart] = useState(false);
  const [create, setCreate] = useState(false);
  const [notifications, setNotifications] = useState(false);
  function filter(key: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      return next;
    });
  }
  const metrics = [
    {
      label: "Peserta aktif",
      value: data?.summary.active_participants,
      caption: "Profil peserta aktif",
      icon: Users,
      tone: "blue",
      href: dashboardHref("/system/peserta", program, { status: "active" }),
    },
    {
      label: "Program aktif",
      value: data?.summary.active_programs,
      caption: program ? "Program terpilih" : "Program yang berjalan",
      icon: BookOpen,
      tone: "violet",
      href: program
        ? `/system/program/${program}/detail-program`
        : dashboardHref("/system/program", null, { status: "active" }),
    },
    {
      label: "Pilihan pendaftaran",
      value: data?.summary.application_choices,
      caption: "Semua status · Semua waktu",
      icon: ClipboardList,
      tone: "amber",
      href: dashboardHref("/system/pendaftaran", program, { tab: "review" }),
    },
    {
      label: "Pembayaran terverifikasi",
      value: data?.summary.verified_amount,
      caption: `${data?.summary.verified_payments ?? "—"} transaksi · ${days} hari`,
      icon: Wallet,
      tone: "emerald",
      href: dashboardHref("/system/keuangan", program, {
        tab: "transactions",
        status: "verified",
        from: data?.period.from,
        to: data?.period.to,
      }),
      money: true,
    },
  ];
  const errorId = "dashboard-error";
  return (
    <div className="page-stack system-dashboard" aria-busy={query.loading}>
      <header className="dashboard-page-head">
        <div>
          <div className="dashboard-eyebrow">
            <LayoutDashboard size={15} />
            BERANDA SISTEM
          </div>
          <h1>{settings?.system_header_title || "Pusat Kendali Sistem"}</h1>
          {settings?.system_header_subtitle && (
            <p>{settings.system_header_subtitle}</p>
          )}
        </div>
        <div className="dashboard-head-actions">
          <Button
            variant="outline"
            onClick={() => setStart(true)}
            disabled={!data || !!query.error}
          >
            <Workflow size={16} />
            Mulai pekerjaan
          </Button>
          <Button onClick={() => setCreate(true)}>
            <Plus size={16} />
            Buat program
          </Button>
        </div>
      </header>
      <div className="dashboard-filterbar">
        <div className="dashboard-filter-controls">
          <label>
            Program
            <select
              className="field-control"
              value={program ?? "all"}
              onChange={(e) => filter("program", e.target.value)}
            >
              <option value="all">Semua program</option>
              {program && !query.programs.some((p) => p.id === program) && (
                <option value={program}>Program terpilih</option>
              )}
              {query.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === "archived"
                    ? " · Arsip"
                    : p.status === "draft"
                      ? " · Draf"
                      : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Periode aktivitas
            <select
              className="field-control"
              value={days}
              onChange={(e) => filter("days", e.target.value)}
            >
              <option value={7}>7 hari</option>
              <option value={30}>30 hari</option>
              <option value={90}>90 hari</option>
            </select>
          </label>
        </div>
        <div className="dashboard-freshness">
          <span role="status">
            {query.loading
              ? "Memuat ringkasan…"
              : data
                ? `${query.error ? "Data terakhir: " : "Diperbarui "}${dashboardTime(data.generated_at)} WIB`
                : "Data belum tersedia"}
          </span>
          <Button
            size="icon"
            variant="outline"
            disabled={query.loading}
            aria-label="Muat ulang dashboard"
            onClick={() => void query.load()}
          >
            <RefreshCw
              size={16}
              className={query.loading ? "animate-spin" : ""}
            />
          </Button>
        </div>
      </div>
      {query.error && (
        <Alert id={errorId} className="dashboard-error">
          <AlertCircle size={18} />
          <AlertTitle>
            {data
              ? "Ringkasan belum diperbarui"
              : "Dashboard belum dapat dimuat"}
          </AlertTitle>
          <AlertDescription>{query.error}</AlertDescription>
          <div className="dashboard-error-actions">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void query.load()}
            >
              Coba lagi
            </Button>
            {program && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => filter("program", "all")}
              >
                Semua program
              </Button>
            )}
          </div>
        </Alert>
      )}
      <div
        className="dashboard-metrics"
        aria-label="Ringkasan LMS"
        aria-describedby={query.error ? errorId : undefined}
      >
        {metrics.map((m) => (
          <Link
            key={m.label}
            to={m.href}
            className={`dashboard-metric dashboard-tone-${m.tone}`}
          >
            <span className="dashboard-icon">
              <m.icon size={21} />
            </span>
            <div>
              <span>{m.label}</span>
              <strong>
                {m.value === undefined
                  ? "—"
                  : m.money
                    ? dashboardMoney(m.value, true)
                    : m.value.toLocaleString("id-ID")}
              </strong>
              <small>{m.caption}</small>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </div>
      {data ? (
        <>
          <div className="dashboard-primary-grid">
            <DashboardQueues data={data} program={program} />
            <DashboardActivity
              key={`${program}:${days}`}
              data={data}
              program={program}
            />
          </div>
          <div className="dashboard-secondary-grid">
            <DashboardPrograms data={data} />
            <div className="dashboard-side-stack">
              <DashboardAdmission data={data} program={program} />
              <DashboardLearning data={data} />
            </div>
          </div>
          <div className="dashboard-bottom-grid">
            <DashboardAudit data={data} />
            <div className="dashboard-side-stack">
              <section className="dashboard-panel">
                <header className="dashboard-panel-head">
                  <div>
                    <h2>Administrasi sistem</h2>
                    <p>
                      {data.global.users.toLocaleString("id-ID")} akun ·{" "}
                      {data.global.units} unit
                    </p>
                  </div>
                  <span className="dashboard-state">Global</span>
                </header>
                <div className="dashboard-shortcuts">
                  <Link to="/system/pengguna">
                    <Users size={18} />
                    Akun & peran
                    <ArrowUpRight size={15} />
                  </Link>
                  <Link to="/system/pengaturan">
                    <Settings size={18} />
                    Pengaturan
                    <ArrowUpRight size={15} />
                  </Link>
                  <Link
                    to={dashboardHref("/system/pengumuman", program, {
                      tab: "compose",
                    })}
                  >
                    <Megaphone size={18} />
                    Pengumuman
                    <ArrowUpRight size={15} />
                  </Link>
                  <Link
                    to={dashboardHref("/system/audit", null, {
                      category: "auth",
                      from: data.period.from,
                      to: data.period.to,
                    })}
                  >
                    <ShieldCheck size={18} />
                    Audit akses
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
                <div className="dashboard-system-events">
                  <button onClick={() => setNotifications(true)}>
                    <BellRing size={16} />
                    <span>Notifikasi gagal · {days} hari</span>
                    <strong>{data.global.failed_notifications}</strong>
                    <ArrowRight size={14} />
                  </button>
                  <Link
                    to={dashboardHref("/system/audit", null, {
                      category: "auth",
                      from: data.period.from,
                      to: data.period.to,
                    })}
                  >
                    <ShieldCheck size={16} />
                    <span>Aktivitas akses · {days} hari</span>
                    <strong>{data.global.access_events}</strong>
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </section>
              <section className="dashboard-period-summary">
                <GraduationCap size={22} />
                <div>
                  <strong>
                    {data.summary.new_enrollments.toLocaleString("id-ID")}{" "}
                    enrollment baru
                  </strong>
                  <span>
                    {data.summary.new_choices.toLocaleString("id-ID")} pilihan
                    pendaftaran baru · {dashboardDay(data.period.from)} –{" "}
                    {dashboardDay(data.period.to)}
                  </span>
                </div>
              </section>
            </div>
          </div>
        </>
      ) : !query.error ? (
        <div role="status" className="dashboard-loading">
          <span className="dashboard-loading-dot" />
          Menyiapkan antrean dan progres program…
        </div>
      ) : (
        <div className="dashboard-unavailable">
          <BookOpen size={24} />
          <p>Modul tetap dapat dibuka melalui menu navigasi.</p>
          <Link to="/system/program">
            Buka program
            <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
      {start && data && (
        <DashboardStartDialog
          programs={data.programs}
          initialProgram={program}
          onClose={() => setStart(false)}
        />
      )}
      {create && (
        <ProgramFormDialog
          onClose={() => setCreate(false)}
          onSaved={(p) => {
            setCreate(false);
            navigate(`/system/program/${p.id}/kurikulum`);
          }}
        />
      )}
      {notifications && data && (
        <Dialog
          title="Notifikasi gagal"
          onClose={() => setNotifications(false)}
        >
          <p className="dashboard-caption">
            Global · {dashboardDay(data.period.from)} –{" "}
            {dashboardDay(data.period.to)} WIB
          </p>
          {data.notification_failures.length ? (
            <ol className="dashboard-notification-list">
              {data.notification_failures.map((n) => (
                <li key={n.id}>
                  <AlertCircle size={17} />
                  <div>
                    <strong>
                      {/payment|finance/.test(n.event_type)
                        ? "Pemberitahuan pembayaran"
                        : /lesson|learning/.test(n.event_type)
                          ? "Pemberitahuan pembelajaran"
                          : /admission|registration/.test(n.event_type)
                            ? "Pemberitahuan pendaftaran"
                            : "Notifikasi sistem"}
                    </strong>
                    <span>Gagal · {dashboardTime(n.created_at)} WIB</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="dashboard-empty">
              Tidak ada kegagalan tercatat pada periode ini.
            </p>
          )}
          {data.global.failed_notifications > 6 && (
            <p className="dashboard-caption">
              Menampilkan 6 dari {data.global.failed_notifications} catatan
              terbaru.
            </p>
          )}
          <footer className="workspace-dialog__footer">
            <Button variant="outline" onClick={() => setNotifications(false)}>
              Tutup
            </Button>
          </footer>
        </Dialog>
      )}
    </div>
  );
}
