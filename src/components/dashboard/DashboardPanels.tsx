import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  HelpCircle,
  ReceiptText,
  BookOpen,
  ClipboardCheck,
} from "lucide-react";
import { Progress } from "../ui/progress";
import {
  dashboardAdmissionLabels,
  dashboardAuditLabel,
  dashboardDay,
  dashboardHref,
  dashboardPercentage,
  dashboardQueueHref,
  dashboardQueues,
  dashboardTime,
  type DashboardData,
} from "../../lib/dashboardWorkspace";
const queueIcons = {
  admission: ClipboardList,
  assessment: ClipboardCheck,
  payments: ReceiptText,
  certificates: GraduationCap,
  helpdesk: HelpCircle,
  program: BookOpen,
};
export function DashboardQueues({
  data,
  program,
}: {
  data: DashboardData;
  program: string | null;
}) {
  const active = dashboardQueues.filter((q) => data.queues[q.key] > 0);
  const total = active.reduce((sum, q) => sum + data.queues[q.key], 0);
  return (
    <section className="dashboard-panel dashboard-queues">
      <header className="dashboard-panel-head">
        <div>
          <h2>Perlu ditindaklanjuti</h2>
          <p>Kondisi saat ini</p>
        </div>
        <span className="dashboard-state">{active.length} jenis antrean</span>
      </header>
      {active.length ? (
        <div className="dashboard-queue-list">
          {active.map((q) => {
            const Icon = queueIcons[q.icon];
            return (
              <Link
                key={q.key}
                to={dashboardQueueHref(q.key, program)}
                className={`dashboard-queue dashboard-tone-${q.tone}`}
              >
                <span className="dashboard-icon">
                  <Icon size={18} />
                </span>
                <strong>{q.label}</strong>
                <b>{data.queues[q.key].toLocaleString("id-ID")}</b>
                <ArrowUpRight size={16} />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="dashboard-clear">
          <CheckCircle2 size={30} />
          <h3>Antrean ini sudah tertangani</h3>
          <p>Tidak ada item tertunda pada pilihan program ini.</p>
        </div>
      )}
      {total > 0 && (
        <div className="dashboard-queues-note">
          Klik antrean untuk membuka daftar yang sesuai.
        </div>
      )}
    </section>
  );
}
export function DashboardAdmission({
  data,
  program,
}: {
  data: DashboardData;
  program: string | null;
}) {
  const statuses = Object.keys(dashboardAdmissionLabels).map(
    (key) =>
      [
        key,
        data.admission[key as keyof typeof dashboardAdmissionLabels],
      ] as const,
  );
  const total = statuses.reduce((sum, [, value]) => sum + value, 0);
  return (
    <section className="dashboard-panel">
      <header className="dashboard-panel-head">
        <div>
          <h2>Status pendaftaran</h2>
          <p>{total.toLocaleString("id-ID")} pilihan program · Semua waktu</p>
        </div>
        <Link
          className="dashboard-text-link"
          to={dashboardHref("/system/pendaftaran", program, {
            tab: "overview",
          })}
        >
          Ringkasan
          <ArrowUpRight size={14} />
        </Link>
      </header>
      {total > 0 ? (
        <>
          <div
            className="dashboard-status-bar"
            role="img"
            aria-label={statuses
              .map(
                ([key, value]) =>
                  `${dashboardAdmissionLabels[key as keyof typeof dashboardAdmissionLabels]}: ${value}`,
              )
              .join(", ")}
          >
            {statuses
              .filter(([, v]) => v > 0)
              .map(([key, value]) => (
                <span
                  key={key}
                  className={`dashboard-admission-${key}`}
                  style={{ flexGrow: value }}
                  title={`${dashboardAdmissionLabels[key as keyof typeof dashboardAdmissionLabels]}: ${value}`}
                />
              ))}
          </div>
          <div className="dashboard-admission-legend">
            {statuses.map(([key, value]) => (
              <Link
                key={key}
                to={dashboardHref("/system/pendaftaran", program, {
                  tab: "review",
                  status: key,
                })}
              >
                <i className={`dashboard-admission-${key}`} />
                <span>
                  {
                    dashboardAdmissionLabels[
                      key as keyof typeof dashboardAdmissionLabels
                    ]
                  }
                </span>
                <strong>{value}</strong>
                <ArrowUpRight size={12} />
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p className="dashboard-empty">
          Belum ada pilihan pendaftaran pada program ini.
        </p>
      )}
    </section>
  );
}
export function DashboardLearning({ data }: { data: DashboardData }) {
  const learning = dashboardPercentage(
    data.learning.completed,
    data.learning.expected,
  );
  const onboarding = dashboardPercentage(
    data.onboarding.completed,
    data.onboarding.total,
  );
  return (
    <section className="dashboard-panel dashboard-learning">
      <header className="dashboard-panel-head">
        <div>
          <h2>Pembelajaran & onboarding</h2>
          <p>Kondisi saat ini</p>
        </div>
      </header>
      <div className="dashboard-progress-block">
        <div>
          <strong>Aktivitas belajar selesai</strong>
          <b>{learning === null ? "—" : `${learning}%`}</b>
        </div>
        {learning !== null && (
          <Progress
            value={learning}
            aria-label="Penyelesaian aktivitas belajar"
          />
        )}
        <p>
          {learning === null
            ? "Belum ada kombinasi enrollment aktif dan materi tersedia."
            : `${data.learning.completed.toLocaleString("id-ID")} dari ${data.learning.expected.toLocaleString("id-ID")} aktivitas`}
        </p>
        <small>
          {data.learning.active_enrollments.toLocaleString("id-ID")} enrollment
          belajar aktif
        </small>
      </div>
      <div className="dashboard-progress-block">
        <div>
          <strong>Onboarding tercatat</strong>
          <b>{onboarding === null ? "—" : `${onboarding}%`}</b>
        </div>
        {onboarding !== null && (
          <Progress
            value={onboarding}
            aria-label="Penyelesaian onboarding tercatat"
          />
        )}
        <p>
          {onboarding === null
            ? "Belum ada onboarding tercatat."
            : `${data.onboarding.completed.toLocaleString("id-ID")} dari ${data.onboarding.total.toLocaleString("id-ID")} onboarding selesai`}
        </p>
      </div>
    </section>
  );
}
export function DashboardAudit({ data }: { data: DashboardData }) {
  const href = dashboardHref("/system/audit", null, {
    from: data.period.from,
    to: data.period.to,
  });
  return (
    <section className="dashboard-panel dashboard-audit">
      <header className="dashboard-panel-head">
        <div>
          <h2>Aktivitas sistem</h2>
          <p>
            {dashboardDay(data.period.from)} – {dashboardDay(data.period.to)}
          </p>
        </div>
        <span className="dashboard-state">Global</span>
      </header>
      {data.recent_audit.length ? (
        <ol>
          {data.recent_audit.map((log) => (
            <li key={log.id}>
              <span className="dashboard-audit-dot" />
              <div>
                <strong>
                  <Link to={href + "&event=" + log.id}>
                    {dashboardAuditLabel(log)}
                  </Link>
                </strong>
                <small>
                  {log.actor_name} · {dashboardTime(log.created_at)} WIB
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dashboard-empty">
          Belum ada aktivitas audit pada periode ini.
        </p>
      )}
      <Link className="dashboard-text-link" to={href}>
        Buka audit
        <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
