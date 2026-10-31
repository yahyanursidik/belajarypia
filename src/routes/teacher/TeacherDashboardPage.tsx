import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Users,
  BarChart3,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { useTeachingWorkspace } from "../../lib/teacherData";
import { Button } from "../../components/ui/button";
import { TeachingLinks } from "../../components/teacher/TeachingLinks";
export function TeacherDashboardPage() {
  const { profile } = useAuthSession();
  const { data, loading, error, reload } = useTeachingWorkspace();
  return (
    <div className="teaching-workspace">
      <header className="teaching-heading">
        <div>
          <span>RUANG PENGAJAR</span>
          <h1>
            Assalamu’alaikum, {profile?.full_name?.split(" ")[0] || "Pengajar"}
          </h1>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Muat ulang pengajaran"
          onClick={reload}
          disabled={loading}
        >
          <RefreshCw size={18} />
        </Button>
      </header>
      <section className="teaching-hero">
        <div>
          <span>FOKUS MENGAJAR</span>
          <h2>Dampingi langkah belajar peserta.</h2>
          <div className="teaching-actions">
            <Button asChild>
              <Link to="/teacher/review?status=pending">
                Buka penilaian <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/teacher/progres">Lihat progres peserta</Link>
            </Button>
          </div>
        </div>
        <ClipboardCheck size={52} />
      </section>
      {error && (
        <div role="alert" className="teaching-error">
          {error}{" "}
          <Button variant="outline" onClick={reload}>
            Coba lagi
          </Button>
        </div>
      )}
      {!data && loading ? (
        <p role="status">Memuat pengajaran…</p>
      ) : (
        data && (
          <>
            <div className="teaching-metrics">
              {[
                {
                  label: "Program terkait",
                  value: data.programs.length,
                  to: "/teacher/kelas",
                  Icon: BookOpen,
                },
                {
                  label: "Kelas ditugaskan",
                  value: data.classes.length,
                  to: "/teacher/kelas",
                  Icon: Users,
                },
                {
                  label: "Kepesertaan aktif",
                  value: data.enrollments.length,
                  to: "/teacher/progres",
                  Icon: BarChart3,
                },
              ].map(({ label, value, to, Icon }) => (
                <Link to={to} key={label}>
                  <Icon size={24} />
                  <strong>{value}</strong>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
            <TeachingLinks />
            <section className="teaching-panel">
              <header>
                <h2>Program pengajaran</h2>
                <Link to="/teacher/kelas">Semua kelas →</Link>
              </header>
              <div className="teaching-courses">
                {data.programs.map((p) => (
                  <article key={p.id}>
                    <small>{p.code}</small>
                    <h3>{p.name}</h3>
                    <span>
                      {
                        data.enrollments.filter((e) => e.program_id === p.id)
                          .length
                      }{" "}
                      kepesertaan aktif dalam cakupan
                    </span>
                    <div className="teaching-actions">
                      <Link to={"/teacher/progres?program=" + p.id}>
                        Progres peserta →
                      </Link>
                      <Link to={"/teacher/review?program=" + p.id}>
                        Penilaian →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
              {!data.programs.length && (
                <p>
                  Belum ada program yang ditugaskan.{" "}
                  <Link to="/teacher/bantuan?category=account">
                    Hubungi pengelola
                  </Link>
                </p>
              )}
            </section>
          </>
        )
      )}
      <nav className="teaching-services" aria-label="Layanan pengajar">
        <Link to="/teacher/silabus">Silabus pengajaran →</Link>
        <Link to="/teacher/pengumuman">Pengumuman →</Link>
        <Link to="/teacher/bantuan">Bantuan →</Link>
      </nav>
    </div>
  );
}
