import { useSearchParams, Link } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { useLearnerPortal } from "../../lib/learnerData";
import { learnerEnrollmentLabels } from "../../lib/learnerWorkspace";
import {
  LearnerLoadState,
  LearnerRefresh,
  LearnerUnlinked,
  StudentProgramCard,
} from "../../components/learner/LearnerShared";
export function LearnerProgramLessonsPage() {
  const { data, loading, error, load } = useLearnerPortal(),
    [params, setParams] = useSearchParams(),
    q = params.get("q") ?? "",
    status = ["active", "completed", "hold", "pending", "cancelled"].includes(
      params.get("status") ?? "",
    )
      ? params.get("status")!
      : "all";
  function update(key: string, value: string) {
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (value && value !== "all") n.set(key, value);
        else n.delete(key);
        return n;
      },
      { replace: true },
    );
  }
  if (!data)
    return (
      <LearnerLoadState
        error={error}
        loading={loading}
        onRetry={() => void load()}
      />
    );
  if (!data.participant) return <LearnerUnlinked />;
  const rows = data.enrollments.filter(
    (e) =>
      (status === "all" || e.enrollment_status === status) &&
      (!q ||
        `${e.programs?.name} ${e.programs?.code} ${e.enrollment_number}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  return (
    <div className="student-workspace">
      <header className="student-page-heading">
        <div>
          <span>PERJALANAN BELAJAR</span>
          <h1>Program saya</h1>
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
      <div className="student-directory-filters">
        <label>
          <Search size={17} />
          <Input
            aria-label="Cari program"
            placeholder="Nama atau nomor enrollment…"
            value={q}
            onChange={(e) => update("q", e.target.value)}
          />
        </label>
        <select
          aria-label="Status program saya"
          value={status}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="all">Semua status</option>
          {Object.entries(learnerEnrollmentLabels).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
        <Link to="/learner/progres">
          Progres belajar
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="student-section-heading">
        <h2>{rows.length} program</h2>
        <Link to="/learner/cek-status">
          Status pendaftaran
          <ArrowRight size={14} />
        </Link>
      </div>
      {rows.length ? (
        <div className="student-program-grid">
          {rows.map((e, i) => (
            <StudentProgramCard key={e.id} enrollment={e} index={i} />
          ))}
        </div>
      ) : (
        <section className="student-empty">
          <h2>
            {q || status !== "all"
              ? "Program tidak ditemukan"
              : "Belum ada program terdaftar"}
          </h2>
          {q || status !== "all" ? (
            <Button variant="outline" onClick={() => setParams({})}>
              Reset filter
            </Button>
          ) : (
            <Button asChild>
              <Link to="/learner">Jelajahi program</Link>
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
