import { useAuthSession } from "../../app/providers/authSessionContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  RefreshCw,
  Search,
  Clock3,
} from "lucide-react";
import { PageHeader } from "../../components/admin/PageHeader";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  assessmentStatus,
  assessmentStatusLabels,
  assessmentSummary,
  filterAssessments,
  finiteScore,
  type AssessmentItem,
  type AssessmentProgram,
} from "../../lib/assessmentWorkspace";
import { loadAssessmentQueue } from "../../lib/assessmentData";
import { formatRegistrationDateTime } from "../../lib/admission";
const tones = {
  pending: "amber",
  below: "rose",
  passed: "emerald",
  graded: "blue",
  recorded: "violet",
  unavailable: "slate",
};
export function TeacherReviewPage() {
  const location = useLocation();
  const { primaryRole } = useAuthSession();
  const assignmentReview = primaryRole !== "mentor";
  const [params, setParams] = useSearchParams();
  const root = location.pathname.startsWith("/system")
    ? "/system"
    : location.pathname.startsWith("/admin")
      ? "/admin"
      : "/teacher";
  const home = root === "/teacher" ? "/teacher/review" : `${root}/penilaian`;
  const detailBase = root === "/teacher" ? "/teacher/review/quiz" : home;
  const [data, setData] = useState<{
    programs: AssessmentProgram[];
    items: AssessmentItem[];
  }>({ programs: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const load = useCallback(async (silent = false) => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setError("");
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await loadAssessmentQueue(request.signal);
      if (!request.signal.aborted) setData(next);
    } catch {
      if (!request.signal.aborted)
        setError("Antrean penilaian belum dapat dimuat. Coba lagi.");
    } finally {
      if (!request.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  useEffect(() => {
    void load();
    return () => requestRef.current?.abort();
  }, [load]);
  const filters = {
    program: params.get("program") || "all",
    lesson: params.get("lesson") || "all",
    status: params.get("status") || "all",
    kind: params.get("kind") || "all",
    q: params.get("q") || "",
    sort: params.get("sort") || "oldest",
  };
  function update(values: Record<string, string | null>, reset = true) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(values)) {
          if (!value || value === "all") next.delete(key);
          else next.set(key, value);
        }
        if (reset) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  const scoped = data.items.filter(
    (item) =>
      filters.program === "all" ||
      item.lesson.program_modules.program_id === filters.program,
  );
  const metrics = assessmentSummary(scoped);
  const filtered = filterAssessments(data.items, filters);
  const pageValue = Number(params.get("page"));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const size = [10, 25, 50].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 10;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);
  const lessons = useMemo(
    () => [
      ...new Map(
        data.items
          .filter(
            (item) =>
              filters.program === "all" ||
              item.lesson.program_modules.program_id === filters.program,
          )
          .map((item) => [item.lesson.id, item.lesson]),
      ).values(),
    ],
    [data.items, filters.program],
  );
  const queuePath = home + (params.size ? `?${params}` : "");
  const participantPath = (item: AssessmentItem) =>
    root === "/teacher"
      ? `/teacher/kelas/program/${item.lesson.program_modules.program_id}/peserta`
      : `${root}/peserta/${item.enrollment.participant_id}?tab=academic`;
  const firstPending = filterAssessments(scoped, {
    ...filters,
    program: "all",
    status: "pending",
    kind: "quiz",
    sort: "oldest",
  })[0];
  function exportCsv() {
    const rows = [
      [
        "Peserta",
        "Nomor induk",
        "Program",
        "Materi",
        "Jenis",
        "Percobaan",
        "Status",
        "Nilai final",
        "Dikumpulkan",
      ],
      ...filtered.map((item) => [
        item.enrollment.participants.display_name,
        item.enrollment.participants.global_participant_number,
        item.lesson.program_modules.programs.name,
        item.lesson.title,
        item.kind === "quiz" ? "Ujian/kuis" : "Progres tugas",
        String(item.attemptNumber),
        assessmentStatusLabels[assessmentStatus(item)],
        item.status === "graded" || item.kind === "assignment"
          ? (finiteScore(item.score) ?? "")
          : "",
        formatRegistrationDateTime(item.submittedAt),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + Papa.unparse(rows, { escapeFormulae: true })], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `penilaian-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="page-stack assessment-workspace">
      <PageHeader
        title="Penilaian"
        actions={
          <>
            <Button
              variant="outline"
              disabled={loading || refreshing}
              aria-label="Muat ulang penilaian"
              onClick={() => void load(true)}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
            </Button>
            <Button
              variant="outline"
              disabled={loading || !!error || !filtered.length}
              onClick={exportCsv}
            >
              <Download size={16} />
              Ekspor hasil
            </Button>
            {firstPending ? (
              <Button asChild>
                <Link
                  to={`${detailBase}/${firstPending.id}?returnTo=${encodeURIComponent(queuePath)}`}
                >
                  Mulai koreksi
                  <ArrowRight size={15} />
                </Link>
              </Button>
            ) : (
              <Button disabled>
                Mulai koreksi
                <ArrowRight size={15} />
              </Button>
            )}
            {assignmentReview && <Button asChild variant="outline"><Link to={`${root}/tugas?view=review`}>Pengumpulan tugas</Link></Button>}
          </>
        }
      />
      <div className="program-metrics">
        {[
          {
            label: "Semua hasil",
            value: metrics.total,
            icon: ClipboardCheck,
            tone: "blue",
            action: () =>
              update({ status: null, kind: null, q: null, lesson: null }),
          },
          {
            label: "Perlu dinilai",
            value: metrics.pending,
            icon: Clock3,
            tone: "amber",
            action: () =>
              update({
                status: "pending",
                kind: "quiz",
                q: null,
                lesson: null,
              }),
          },
          {
            label: "Di bawah batas",
            value: metrics.below,
            icon: CheckCircle2,
            tone: "rose",
            action: () =>
              update({ status: "below", kind: "quiz", q: null, lesson: null }),
          },
        ].map((item) => (
          <button
            key={item.label}
            className={`admin-stat admin-tone-${item.tone}`}
            onClick={item.action}
          >
            <span className="admin-stat__icon">
              <item.icon size={19} />
            </span>
            <span>
              <span className="admin-stat__label">{item.label}</span>
              <strong>{loading || error ? "—" : item.value}</strong>
            </span>
            <ArrowRight size={14} />
          </button>
        ))}
        <div className="admin-stat admin-tone-violet">
          <span className="admin-stat__icon">
            <BarChart3 size={19} />
          </span>
          <span>
            <span className="admin-stat__label">Rerata final terbaru</span>
            <strong>
              {loading || error || metrics.average === null
                ? "—"
                : metrics.average.toLocaleString("id-ID", {
                    maximumFractionDigits: 1,
                  })}
            </strong>
          </span>
        </div>
      </div>
      <section className="program-panel">
        <div className="assessment-filters">
          <div className="admission-search">
            <Search size={16} />
            <Input
              aria-label="Cari penilaian"
              placeholder="Peserta, nomor induk, atau materi…"
              value={filters.q}
              onChange={(event) => update({ q: event.target.value })}
            />
          </div>
          <select
            aria-label="Program penilaian"
            className="field-control"
            value={filters.program}
            onChange={(event) =>
              update({ program: event.target.value, lesson: null })
            }
          >
            <option value="all">Semua program</option>
            {data.programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Materi penilaian"
            className="field-control"
            value={filters.lesson}
            onChange={(event) => update({ lesson: event.target.value })}
          >
            <option value="all">Semua materi</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Jenis penilaian"
            className="field-control"
            value={filters.kind}
            onChange={(event) => update({ kind: event.target.value })}
          >
            <option value="all">Semua jenis</option>
            <option value="quiz">Ujian & kuis</option>
            <option value="assignment">Progres tugas</option>
          </select>
          <select
            aria-label="Status penilaian"
            className="field-control"
            value={filters.status}
            onChange={(event) => update({ status: event.target.value })}
          >
            <option value="all">Semua status</option>
            {Object.entries(assessmentStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Urutan penilaian"
            className="field-control"
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value })}
          >
            <option value="oldest">Terlama dahulu</option>
            <option value="newest">Terbaru dahulu</option>
          </select>
          {Object.values(filters).some(
            (value) => !["all", "oldest", ""].includes(value),
          ) && (
            <Button variant="ghost" onClick={() => setParams({})}>
              Hapus filter
            </Button>
          )}
        </div>
        {filters.kind === "assignment" && (
          <p className="program-notice mb-4">
            Hasil tugas terdahulu tetap tersimpan. {assignmentReview && <Link to={`${root}/tugas?view=review`}>Buka pengumpulan dan revisi tugas →</Link>}
          </p>
        )}
        {error ? (
          <div className="admission-empty">
            <p className="program-error" role="alert">
              {error}
            </p>
            <Button variant="outline" onClick={() => void load()}>
              Coba lagi
            </Button>
          </div>
        ) : loading ? (
          <p role="status" className="program-loading">
            Memuat penilaian…
          </p>
        ) : (
          <>
            <div className="admission-results">
              <span>{filtered.length} hasil</span>
              <label>
                Baris
                <select
                  className="field-control"
                  aria-label="Hasil per halaman"
                  value={size}
                  onChange={(event) => update({ size: event.target.value })}
                >
                  {[10, 25, 50].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            {!visible.length ? (
              <div className="admission-empty">
                <ClipboardCheck size={30} />
                <h3>Tidak ada hasil penilaian</h3>
                <Button variant="outline" onClick={() => setParams({})}>
                  Tampilkan semua
                </Button>
              </div>
            ) : (
              <div className="admission-table-wrap">
                <table className="admission-table">
                  <thead>
                    <tr>
                      <th>Peserta</th>
                      <th>Materi & program</th>
                      <th>Nilai</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item) => {
                      const status = assessmentStatus(item);
                      return (
                        <tr key={`${item.kind}-${item.id}`}>
                          <td data-label="Peserta">
                            <Link
                              className="admission-name"
                              to={participantPath(item)}
                            >
                              {item.enrollment.participants.display_name}
                            </Link>
                            <small>
                              {
                                item.enrollment.participants
                                  .global_participant_number
                              }{" "}
                              · {item.enrollment.enrollment_number}
                            </small>
                          </td>
                          <td data-label="Materi">
                            <strong>{item.lesson.title}</strong>
                            <small>
                              {item.lesson.program_modules.programs.name} ·{" "}
                              {item.kind === "quiz"
                                ? `Percobaan ${item.attemptNumber}`
                                : "Tugas"}
                              <br />
                              {formatRegistrationDateTime(item.submittedAt)}
                            </small>
                          </td>
                          <td data-label="Nilai">
                            <strong>
                              {status === "pending" ||
                              finiteScore(item.score) === null
                                ? "—"
                                : item.score}
                            </strong>
                            <small>
                              {item.lesson.passing_grade !== null
                                ? `Batas ${item.lesson.passing_grade}`
                                : "Tanpa batas nilai"}
                            </small>
                          </td>
                          <td data-label="Status">
                            <span
                              className={`admission-badge admission-tone-${tones[status]}`}
                            >
                              {assessmentStatusLabels[status]}
                            </span>
                          </td>
                          <td data-label="Aksi">
                            <Button
                              variant={
                                status === "pending" ? "default" : "outline"
                              }
                              size="sm"
                              asChild
                            >
                              <Link
                                to={
                                  item.kind === "quiz"
                                    ? `${detailBase}/${item.id}?returnTo=${encodeURIComponent(queuePath)}`
                                    : participantPath(item)
                                }
                              >
                                {item.kind === "assignment"
                                  ? "Lihat progres"
                                  : status === "pending"
                                    ? "Nilai esai"
                                    : "Lihat hasil"}
                                <ArrowRight size={14} />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="admission-pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 1}
                onClick={() => update({ page: String(safePage - 1) }, false)}
              >
                Sebelumnya
              </Button>
              <span>
                {safePage} / {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === pages}
                onClick={() => update({ page: String(safePage + 1) }, false)}
              >
                Berikutnya
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
