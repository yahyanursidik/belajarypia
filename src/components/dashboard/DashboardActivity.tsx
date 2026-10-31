import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import { Button } from "../ui/button";
import {
  dashboardDay,
  dashboardHref,
  dashboardMoney,
  type DashboardData,
} from "../../lib/dashboardWorkspace";
export function DashboardActivity({
  data,
  program,
}: {
  data: DashboardData;
  program: string | null;
}) {
  const [view, setView] = useState<"applications" | "verified_amount">(
    "applications",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const focused =
    data.daily.find((d) => d.day === selected) ?? data.daily.at(-1)!;
  const max = Math.max(1, ...data.daily.map((d) => Number(d[view])));
  const total = data.daily.reduce((s, d) => s + Number(d[view]), 0);
  const label =
    view === "applications"
      ? "Pilihan pendaftaran"
      : "Pembayaran terverifikasi";
  const target = (from: string, to: string) =>
    view === "applications"
      ? dashboardHref("/system/pendaftaran", program, {
          tab: "review",
          from,
          to,
        })
      : dashboardHref("/system/keuangan", program, {
          tab: "transactions",
          status: "verified",
          from,
          to,
        });
  return (
    <section className="dashboard-panel dashboard-activity">
      <header className="dashboard-panel-head">
        <div>
          <h2>Aktivitas periode</h2>
          <p>
            {dashboardDay(data.period.from)} – {dashboardDay(data.period.to)} ·
            WIB
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setTable((v) => !v)}
          aria-expanded={table}
        >
          <BarChart3 size={15} />
          {table ? "Grafik" : "Tabel data"}
        </Button>
      </header>
      <div
        className="dashboard-chart-switch"
        role="group"
        aria-label="Data grafik"
      >
        <button
          aria-pressed={view === "applications"}
          onClick={() => {
            setView("applications");
            setSelected(null);
          }}
        >
          Pendaftaran
        </button>
        <button
          aria-pressed={view === "verified_amount"}
          onClick={() => {
            setView("verified_amount");
            setSelected(null);
          }}
        >
          Pembayaran
        </button>
      </div>
      <div className="dashboard-chart-total">
        <strong>
          {view === "applications"
            ? total.toLocaleString("id-ID")
            : dashboardMoney(total)}
        </strong>
        <span>{label.toLowerCase()}</span>
        <Link
          to={target(data.period.from, data.period.to)}
          aria-label={`Lihat ${label.toLowerCase()} pada periode ini`}
        >
          <ArrowUpRight size={19} />
        </Link>
      </div>
      {table ? (
        <div className="dashboard-chart-table">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Pendaftaran</th>
                <th>Enrollment baru</th>
                <th>Pembayaran terverifikasi</th>
              </tr>
            </thead>
            <tbody>
              {data.daily.map((d) => (
                <tr key={d.day}>
                  <td>{dashboardDay(d.day)}</td>
                  <td>{d.applications}</td>
                  <td>{d.enrollments}</td>
                  <td>{dashboardMoney(d.verified_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div
            className={`dashboard-bars ${view === "verified_amount" ? "dashboard-bars-money" : ""}`}
            aria-label={`Grafik ${label.toLowerCase()}`}
          >
            <div className="dashboard-chart-grid" aria-hidden="true" />
            {data.daily.map((d, index) => (
              <button
                key={d.day}
                type="button"
                className={
                  focused?.day === d.day ? "dashboard-bar-selected" : ""
                }
                style={
                  {
                    "--bar-height": `${Math.max(d[view] > 0 ? 3 : 0, (d[view] / max) * 100)}%`,
                  } as CSSProperties
                }
                title={`${dashboardDay(d.day)}: ${view === "applications" ? d.applications : dashboardMoney(d.verified_amount)}`}
                aria-label={`${dashboardDay(d.day)}, ${label}: ${view === "applications" ? d.applications : dashboardMoney(d.verified_amount)}`}
                aria-pressed={focused?.day === d.day}
                tabIndex={focused?.day === d.day ? 0 : -1}
                onKeyDown={(event) => {
                  let next: number;
                  if (event.key === "ArrowRight")
                    next = Math.min(data.daily.length - 1, index + 1);
                  else if (event.key === "ArrowLeft")
                    next = Math.max(0, index - 1);
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = data.daily.length - 1;
                  else return;
                  event.preventDefault();
                  setSelected(data.daily[next].day);
                  const buttons =
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      "button",
                    );
                  buttons?.[next]?.focus();
                }}
                onMouseEnter={() => setSelected(d.day)}
                onFocus={() => setSelected(d.day)}
                onClick={() => setSelected(d.day)}
              >
                <span />
              </button>
            ))}
          </div>
          <div className="dashboard-chart-axis">
            <span>{dashboardDay(data.period.from)}</span>
            <span>{dashboardDay(data.period.to)}</span>
          </div>
          {total === 0 && (
            <p className="dashboard-chart-empty">
              Belum ada aktivitas pada periode ini.
            </p>
          )}
        </>
      )}
      {focused && (
        <div className="dashboard-chart-detail" aria-live="polite">
          <span>
            {dashboardDay(focused.day)} ·{" "}
            {view === "applications"
              ? `${focused.applications} pilihan pendaftaran`
              : dashboardMoney(focused.verified_amount)}
          </span>
          <Link to={target(focused.day, focused.day)}>
            Lihat rincian
            <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
    </section>
  );
}
