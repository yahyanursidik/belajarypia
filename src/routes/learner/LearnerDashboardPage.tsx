import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCheck,
  Clock3,
  UserRound,
  BarChart3,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import { AnnouncementHighlights } from "../shared/AnnouncementInboxPage";
import { useLearnerPortal } from "../../lib/learnerData";
import {
  learnerContinue,
  learnerSummary,
  learnerNext,
  learnerTotals,
  learnerWeek,
  learnerAgenda,
  learnerLessonLabels,
} from "../../lib/learnerWorkspace";
import { userTime } from "../../lib/usersWorkspace";
import {
  LearnerLoadState,
  LearnerUnlinked,
  LearnerRefresh,
  LearnerServices,
  StudentProgramCard,
} from "../../components/learner/LearnerShared";
import { LearnerCatalog } from "../../components/learner/LearnerCatalog";
export function LearnerDashboardPage() {
  const { data, loading, error, load } = useLearnerPortal();
  if (!data)
    return (
      <LearnerLoadState
        error={error}
        loading={loading}
        onRetry={() => void load()}
      />
    );
  if (!data.participant) return <LearnerUnlinked />;
  const current = learnerContinue(data),
    summary = current?.outline ? learnerSummary(current.outline) : null,
    action = current ? learnerNext(current) : null,
    totals = learnerTotals(data),
    week = learnerWeek(data),
    weekCount = week.reduce((n, d) => n + d.count, 0),
    agenda = learnerAgenda(data),
    other = data.enrollments.filter((e) => e.outline && e.id !== current?.id),
    preparation = data.enrollments.find(
      (e) =>
        e.enrollment_status === "active" &&
        e.onboarding_status &&
        e.onboarding_status !== "completed",
    );
  return (
    <div className="student-workspace">
      <header className="student-page-heading">
        <div>
          <span>Assalamu’alaikum,</span>
          <h1>{data.participant.display_name}</h1>
        </div>
        <LearnerRefresh loading={loading} onClick={() => void load()} />
      </header>
      {error && (
        <LearnerLoadState
          error={error}
          loading={loading}
          onRetry={() => void load()}
        />
      )}
      <section className="student-continue" aria-label="Lanjutkan belajar">
        <div>
          <span className="student-eyebrow">
            <BookOpen size={15} />
            RUANG BELAJARMU
          </span>
          <h2>
            {current?.programs?.name ?? "Siap memulai perjalanan belajar?"}
          </h2>
          <p>
            {action?.note ??
              "Temukan program atau periksa status pendaftaranmu."}
          </p>
          <div className="student-continue-actions">
            <Button asChild>
              <Link to={action?.href ?? "/learner/program-saya"}>
                {action?.label ?? "Lihat program"}
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Link to="/learner/tugas">Tugas & revisi</Link>
            {current && (
              <Link to={"/learner/program/" + current.program_id}>
                Semua materi
              </Link>
            )}
          </div>
        </div>
        <div className="student-continue-progress">
          <span>{summary?.total ? summary.percent + "%" : "—"}</span>
          <strong>
            {summary
              ? `${summary.completed} dari ${summary.total} materi tersedia selesai`
              : "Belum ada program belajar aktif"}
          </strong>
          <Progress
            value={summary?.total ? summary.percent : 0}
            aria-label="Progres program pilihan"
          />
        </div>
      </section>
      <div className="student-metrics">
        {[
          {
            to: "/learner/program-saya?status=active",
            label: "Program aktif",
            value: totals.active,
            Icon: BookOpen,
          },
          {
            to: "/learner/progres",
            label: "Materi selesai",
            value: totals.completed,
            Icon: CheckCheck,
          },
          {
            to: "/learner/progres?focus=review",
            label: "Menunggu nilai",
            value: totals.review,
            Icon: Clock3,
          },
          {
            to: "/learner/progres",
            label: "Selesai 7 hari ini",
            value: weekCount,
            Icon: BarChart3,
          },
        ].map(({ to, label, value, Icon }, i) => (
          <Link
            className={"student-metric student-color-" + i}
            to={to}
            key={label}
          >
            <Icon size={20} />
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
            <ArrowRight size={14} />
          </Link>
        ))}
      </div>
      {!data.profile_ready && (
        <Link className="student-profile-prompt" to="/learner/profil?edit=1">
          <span className="student-round-icon">
            <UserRound size={20} />
          </span>
          <div>
            <strong>Lengkapi profil belajarmu</strong>
            <small>Nama akun dan nama tampilan.</small>
          </div>
          <span>
            Mulai
            <ArrowRight size={15} />
          </span>
        </Link>
      )}
      {preparation && (
        <div className="student-preparation">
          <span>Persiapan {preparation.programs?.name} belum lengkap.</span>
          <Link
            to={
              "/learner/bantuan?category=account&contextProgram=" +
              preparation.program_id +
              "&contextEnrollment=" +
              preparation.id
            }
          >
            Bantuan persiapan
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <LearnerServices />
      {other.length > 0 && (
        <section>
          <div className="student-section-heading">
            <h2>Program lainnya</h2>
            <Link to="/learner/program-saya">
              Lihat semua
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="student-program-grid">
            {other.slice(0, 2).map((e, i) => (
              <StudentProgramCard key={e.id} enrollment={e} index={i + 1} />
            ))}
          </div>
        </section>
      )}
      <div className="student-home-columns">
        <section className="student-panel">
          <header className="student-section-heading">
            <h2>Agenda belajar</h2>
            <Link to="/learner/agenda">
              Semua agenda
              <ArrowRight size={14} />
            </Link>
          </header>
          {agenda.length ? (
            <ul className="student-agenda">
              {agenda.slice(0, 3).map((a) => (
                <li key={a.lesson.id}>
                  <span className="student-agenda-icon">
                    <Clock3 size={17} />
                  </span>
                  <div>
                    <small>
                      {a.program} ·{" "}
                      {learnerLessonLabels[a.lesson.lesson_type] ?? "Aktivitas"}
                    </small>
                    <strong>{a.lesson.title}</strong>
                    <span>
                      {userTime(a.lesson.due_at!)}
                      {a.locked ? " · Selesaikan prasyarat" : ""}
                    </span>
                  </div>
                  <Link
                    aria-label={"Buka " + a.lesson.title}
                    to={
                      a.locked
                        ? "/learner/program/" + a.program_id
                        : "/learner/lesson/" + a.lesson.id
                    }
                  >
                    <ArrowRight size={17} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="student-empty-inline">
              Belum ada tenggat aktivitas yang tersedia.
            </p>
          )}
        </section>
        <section className="student-announcement-panel">
          <AnnouncementHighlights />
        </section>
      </div>
      <LearnerCatalog data={data} onEnrolled={() => void load()} />
      <small className="student-snapshot">
        {error ? "Snapshot" : "Data"} {userTime(data.generated_at)}
      </small>
    </div>
  );
}
