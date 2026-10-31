import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  RefreshCw,
  BarChart3,
  Wallet,
  UserRound,
  MessageCircle,
  Megaphone,
} from "lucide-react";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import {
  learnerSummary,
  learnerNext,
  learnerEnrollmentLabels,
  type LearnerEnrollment,
} from "../../lib/learnerWorkspace";
export function LearnerLoadState({
  error,
  loading,
  onRetry,
}: {
  error: string;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      className={"student-load-state " + (error ? "student-error" : "")}
      role={error ? "alert" : "status"}
    >
      {error ? (
        <>
          <strong>Data belajar belum dapat dimuat</strong>
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={loading}
          >
            Coba lagi
          </Button>
        </>
      ) : (
        "Memuat ruang belajar…"
      )}
    </div>
  );
}
export function LearnerUnlinked() {
  return (
    <section className="student-empty">
      <BookOpen size={30} />
      <h2>Akun belum terhubung ke peserta</h2>
      <div>
        <Button asChild>
          <Link to="/learner/cek-status">Cek pendaftaran</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/learner/bantuan?category=account">Bantuan akun</Link>
        </Button>
      </div>
    </section>
  );
}
export function LearnerRefresh({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      disabled={loading}
      aria-label="Muat ulang data belajar"
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
    </Button>
  );
}
export function StudentProgramCard({
  enrollment: e,
  index = 0,
}: {
  enrollment: LearnerEnrollment;
  index?: number;
}) {
  const s = e.outline ? learnerSummary(e.outline) : null,
    action = learnerNext(e);
  return (
    <article className={"student-program-card student-color-" + (index % 4)}>
      <header>
        <span className="student-course-icon">
          <BookOpen size={22} />
        </span>
        <span
          className={"student-status student-status-" + e.enrollment_status}
        >
          {learnerEnrollmentLabels[e.enrollment_status] ?? e.enrollment_status}
        </span>
      </header>
      <span className="student-course-code">{e.programs?.code}</span>
      <h3>{e.programs?.name ?? "Program belajar"}</h3>
      {e.classes?.name && (
        <small className="student-muted">
          {e.classes.name}
          {e.halaqahs?.name ? " · " + e.halaqahs.name : ""}
        </small>
      )}
      {s ? (
        <>
          <div className="student-progress-label">
            <span>
              {s.completed}/{s.total} materi tersedia
            </span>
            <strong>{s.total ? s.percent + "%" : "—"}</strong>
          </div>
          <Progress
            aria-label={"Progres " + e.programs?.name}
            value={s.total ? s.percent : 0}
          />
        </>
      ) : ["completed", "active"].includes(e.enrollment_status) ? (
        <p className="student-course-access">
          {e.enrollment_status === "completed"
            ? "Hasil belajar tetap tersedia."
            : e.enrollment_status === "active"
              ? "Akses belajar belum tersedia."
              : learnerEnrollmentLabels[e.enrollment_status]}
        </p>
      ) : null}
      <p className="student-course-next">{action.note}</p>
      <footer>
        <Button asChild size="sm">
          <Link to={action.href}>
            {action.label}
            <ArrowRight size={14} />
          </Link>
        </Button>
        {e.outline && (
          <Link
            className="student-text-link"
            to={"/learner/program/" + e.program_id}
          >
            Detail program
          </Link>
        )}
      </footer>
    </article>
  );
}
export function LearnerServices() {
  return (
    <nav className="student-services" aria-label="Layanan peserta">
      {[
        { to: "/learner/progres", label: "Progres", Icon: BarChart3 },
        { to: "/learner/keuangan", label: "Pembayaran", Icon: Wallet },
        { to: "/learner/pengumuman", label: "Pengumuman", Icon: Megaphone },
        { to: "/learner/profil", label: "Profil belajar", Icon: UserRound },
        { to: "/learner/bantuan", label: "Bantuan", Icon: MessageCircle },
      ].map(({ to, label, Icon }) => (
        <Link key={to} to={to}>
          <Icon size={18} />
          <span>{label}</span>
          <ArrowRight size={13} />
        </Link>
      ))}
    </nav>
  );
}
