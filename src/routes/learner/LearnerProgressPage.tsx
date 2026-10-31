import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCheck, Clock3 } from "lucide-react";
import { useLearnerPortal } from "../../lib/learnerData";
import {
  learnerTotals,
  learnerWeek,
  learnerActivity,
  learnerSummary,
} from "../../lib/learnerWorkspace";
import {
  LearnerLoadState,
  LearnerRefresh,
  LearnerUnlinked,
  StudentProgramCard,
} from "../../components/learner/LearnerShared";
import { userTime } from "../../lib/usersWorkspace";
export function LearnerProgressPage() {
  const { data, loading, error, load } = useLearnerPortal(),
    [params, setParams] = useSearchParams(),
    program = params.get("program") ?? "all",
    review = params.get("focus") === "review";
  if (!data)
    return (
      <LearnerLoadState
        error={error}
        loading={loading}
        onRetry={() => void load()}
      />
    );
  if (!data.participant) return <LearnerUnlinked />;
  const scoped = {
      ...data,
      enrollments: data.enrollments.filter(
        (e) => program === "all" || e.program_id === program,
      ),
    },
    totals = learnerTotals(scoped),
    week = learnerWeek(scoped),
    activity = learnerActivity(scoped),
    max = Math.max(1, ...week.map((d) => d.count)),
    waiting = scoped.enrollments.flatMap((e) =>
      e.outline
        ? e.outline.attempts
            .filter((a) => ["pending_review", "submitted"].includes(a.status))
            .map((a) => ({
              attempt: a,
              lesson: e.outline!.lessons.find((l) => l.id === a.lesson_id),
              program: e.programs?.name,
            }))
        : [],
    ),
    cards = scoped.enrollments.filter(
      (e) => e.outline || e.enrollment_status === "completed",
    );
  return (
    <div className="student-workspace">
      <header className="student-page-heading">
        <div>
          <span>LANGKAH YANG SUDAH DITEMPUH</span>
          <h1>Progres belajar</h1>
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
      <div className="student-progress-filter">
        <label>
          Program
          <select
            aria-label="Program pada progres"
            value={program}
            onChange={(e) =>
              setParams((p) => {
                const n = new URLSearchParams(p);
                if (e.target.value === "all") n.delete("program");
                else n.set("program", e.target.value);
                return n;
              })
            }
          >
            <option value="all">Semua program</option>
            {data.enrollments.map((e) => (
              <option key={e.id} value={e.program_id}>
                {e.programs?.name}
              </option>
            ))}
          </select>
        </label>
        <span>Materi tersedia sebagai pembagi progres.</span>
      </div>
      <div className="student-progress-overview">
        <section className="student-progress-total">
          <span className="student-round-icon">
            <CheckCheck size={25} />
          </span>
          <div>
            <strong>
              {totals.total
                ? Math.round((totals.completed / totals.total) * 100) + "%"
                : "—"}
            </strong>
            <h2>
              {totals.completed} dari {totals.total} materi selesai
            </h2>
            <p>Kelulusan mengikuti hasil penilaian program.</p>
          </div>
        </section>
        <section className="student-panel student-week">
          <header className="student-section-heading">
            <h2>Aktivitas 7 hari</h2>
            <span>{week.reduce((n, d) => n + d.count, 0)} selesai</span>
          </header>
          <ol aria-label="Materi selesai per hari">
            {week.map((d) => (
              <li
                key={d.day}
                aria-label={d.day + ": " + d.count + " materi selesai"}
              >
                <span>{d.count}</span>
                <div>
                  <i
                    style={{
                      height:
                        (d.count ? Math.max(8, (d.count / max) * 70) : 3) +
                        "px",
                    }}
                  />
                </div>
                <small>
                  {new Intl.DateTimeFormat("id-ID", {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(new Date(d.day + "T00:00Z"))}
                </small>
              </li>
            ))}
          </ol>
        </section>
      </div>
      {(waiting.length > 0 || review) && (
        <section className="student-panel">
          <header className="student-section-heading">
            <h2>
              <Clock3 size={17} />
              Menunggu penilaian
            </h2>
            <span>{waiting.length} aktivitas</span>
          </header>
          {waiting.length ? (
            <ul className="student-review-list">
              {waiting.map((w) => (
                <li key={w.attempt.id}>
                  <div>
                    <strong>{w.lesson?.title ?? "Ujian"}</strong>
                    <small>
                      {w.program} · Percobaan {w.attempt.attempt_number}
                    </small>
                  </div>
                  <Link
                    to={
                      "/learner/lesson/" +
                      w.attempt.lesson_id +
                      "/quiz?attempt=" +
                      w.attempt.id
                    }
                  >
                    Lihat status
                    <ArrowRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="student-empty-inline">
              Tidak ada ujian yang menunggu nilai.
            </p>
          )}
        </section>
      )}
      <section>
        <div className="student-section-heading">
          <h2>Per program</h2>
          <Link to="/learner/program-saya">
            Semua status
            <ArrowRight size={14} />
          </Link>
        </div>
        {cards.length ? (
          <div className="student-program-grid">
            {cards.map((e, i) => (
              <StudentProgramCard key={e.id} enrollment={e} index={i} />
            ))}
          </div>
        ) : (
          <p className="student-empty-inline">
            Progres muncul ketika akses belajar tersedia.
          </p>
        )}
      </section>
      <section className="student-panel">
        <header className="student-section-heading">
          <h2>Materi yang diselesaikan</h2>
          <span>{activity.length} tercatat</span>
        </header>
        {activity.length ? (
          <ol className="student-activity-list">
            {activity.slice(0, 10).map((a) => (
              <li key={a.id}>
                <CheckCheck size={18} />
                <div>
                  <Link to={"/learner/lesson/" + a.lesson.id}>
                    {a.lesson.title}
                  </Link>
                  <small>
                    {a.program} · {userTime(a.at)}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="student-empty-inline">
            Belum ada penyelesaian materi yang tercatat.
          </p>
        )}
      </section>
      <p className="student-snapshot">
        {cards.filter((e) => e.outline && learnerSummary(e.outline).finished)
          .length > 0
          ? "Materi tersedia selesai tidak berarti sertifikat otomatis diterbitkan."
          : "Lanjutkan belajar dari program yang tersedia."}
      </p>
    </div>
  );
}
