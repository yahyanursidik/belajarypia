import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import {
  dashboardPercentage,
  type DashboardData,
} from "../../lib/dashboardWorkspace";
export function DashboardPrograms({ data }: { data: DashboardData }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const rows = data.program_activity.filter((p) =>
    `${p.name} ${p.code}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 5));
  const current = Math.min(page, pages);
  return (
    <section className="dashboard-panel dashboard-programs">
      <header className="dashboard-panel-head">
        <div>
          <h2>Progres program</h2>
          <p>Materi terbit yang sudah dapat dipelajari</p>
        </div>
        <Link className="dashboard-text-link" to="/system/program">
          Semua program
          <ArrowUpRight size={14} />
        </Link>
      </header>
      <div className="dashboard-program-search">
        <Search size={16} />
        <Input
          aria-label="Cari program pada dashboard"
          placeholder="Cari program…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <div className="dashboard-program-list">
        {rows.slice((current - 1) * 5, current * 5).map((p) => {
          const percent = dashboardPercentage(
            p.completed_activities,
            p.expected_activities,
          );
          return (
            <article key={p.id}>
              <div className="dashboard-program-icon">
                <BookOpen size={19} />
              </div>
              <div className="dashboard-program-main">
                <div className="dashboard-program-title">
                  <Link to={`/system/program/${p.id}/detail-program`}>
                    {p.name}
                  </Link>
                  <span
                    className={`dashboard-state dashboard-state-${p.status}`}
                  >
                    {p.status === "active"
                      ? "Aktif"
                      : p.status === "draft"
                        ? "Draf"
                        : "Arsip"}
                  </span>
                </div>
                <div className="dashboard-program-caption">
                  <span>{p.active_enrollments} enrollment aktif</span>
                  <span>{p.released_lessons} materi tersedia</span>
                </div>
                {percent !== null ? (
                  <>
                    <Progress
                      value={percent}
                      aria-label={`Penyelesaian materi ${p.name}`}
                    />
                    <small>
                      {percent}% ·{" "}
                      {p.completed_activities.toLocaleString("id-ID")}/
                      {p.expected_activities.toLocaleString("id-ID")} aktivitas
                      selesai
                    </small>
                  </>
                ) : (
                  <small>
                    {p.released_lessons === 0
                      ? "Belum ada materi yang tersedia."
                      : "Belum ada enrollment belajar aktif."}
                  </small>
                )}
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link
                  to={`/system/program/${p.id}/${p.modules === 0 ? "kurikulum" : "report"}`}
                >
                  {p.modules === 0 ? "Siapkan" : "Laporan"}
                  <ArrowUpRight size={14} />
                </Link>
              </Button>
            </article>
          );
        })}
        {!rows.length && (
          <p className="dashboard-empty">
            {q
              ? "Tidak ada program yang cocok."
              : "Belum ada program pada pilihan ini."}
          </p>
        )}
      </div>
      {pages > 1 && (
        <nav
          className="dashboard-pagination"
          aria-label="Halaman progres program"
        >
          <Button
            size="sm"
            variant="outline"
            disabled={current <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Sebelumnya
          </Button>
          <span>
            {current}/{pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={current >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </Button>
        </nav>
      )}
    </section>
  );
}
