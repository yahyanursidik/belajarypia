import { useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Button } from "../../components/ui/button";
import { AssignmentConfigForm } from "../../components/assignments/AssignmentConfigForm";
import { AssignmentWork } from "../../components/assignments/AssignmentWork";
import {
  assignmentLabels,
  type AssignmentList,
  assignmentPath,
  assignmentTime,
  responseLabels,
} from "../../lib/assignments";
import { useAssignmentRead } from "../../lib/useAssignmentRead";
export function AssignmentDetailPage() {
  const { lessonId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuthSession();
  return (
    <AssignmentWork
      key={`${user?.id}:${lessonId}:${params.get("enrollment")}`}
      lessonId={lessonId!}
      enrollment={params.get("enrollment")}
    />
  );
}
export function AssignmentsPage() {
  const base = "/" + useLocation().pathname.split("/")[1],
    mine = base === "/learner";
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = mine
    ? "mine"
    : params.get("view") === "catalog"
    ? "catalog"
    : "review";
  const program = params.get("program") || "",
    status = params.get("status") || "all",
    search = params.get("q") || "";
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(params.get("page"))) || 1),
  );
  const { data, loading, error, reload } = useAssignmentRead<AssignmentList>(
    "assignment_workspace",
    {
      p_view: view,
      p_program: program || null,
      p_status: status,
      p_page: page,
      p_search: search,
    },
  );
  const [creating, setCreating] = useState(false);
  const update = (key: string, value: string) =>
    setParams((old) => {
      const n = new URLSearchParams(old);
      if (value) n.set(key, value);
      else n.delete(key);
      if (key !== "page") n.delete("page");
      if (key === "view") n.delete("status");
      return n;
    });
  return (
    <div className="assignment-workspace">
      <header className="assignment-heading">
        <div>
          <span>{mine ? "LANGKAH BELAJAR" : "PENGUMPULAN & UMPAN BALIK"}</span>
          <h1>{mine ? "Tugas saya" : "Ruang tugas"}</h1>
        </div>
        <Button variant="outline" disabled={loading} onClick={reload}>
          Muat ulang
        </Button>
      </header>
      {!mine && (
        <nav className="assignment-actions" aria-label="Alur tugas">
          <Button
            variant={view === "review" ? "default" : "outline"}
            onClick={() => {
              setCreating(false);
              update("view", "review");
            }}
          >
            Pengumpulan
          </Button>
          <Button
            variant={view === "catalog" ? "default" : "outline"}
            onClick={() => update("view", "catalog")}
          >
            Daftar tugas
          </Button>
          <Button asChild variant="outline">
            <Link
              to={base === "/teacher" ? "/teacher/review" : base + "/penilaian"}
            >
              Penilaian ujian
            </Link>
          </Button>
          {view === "catalog" && data?.modules.length
            ? <Button onClick={() => setCreating(true)}>+ Buat tugas</Button>
            : null}
        </nav>
      )}
      {creating && data && (
        <AssignmentConfigForm
          modules={data.modules.filter((m) =>
            !program || m.program_id === program
          ).map((m) => ({
            ...m,
            title: (data.programs.find((p) =>
              p.id === m.program_id
            )?.name ?? "") + " · " + m.title,
          }))}
          onCancel={() => setCreating(false)}
          onSaved={(id) => navigate(assignmentPath(base, id))}
        />
      )}
      <section className="assignment-filters" aria-label="Filter tugas">
        <label>
          Cari tugas{!mine && " / peserta"}
          <input
            type="search"
            value={search}
            maxLength={150}
            onChange={(e) => update("q", e.target.value)}
            placeholder="Cari…"
          />
        </label>
        <label>
          Program<select
            value={program}
            onChange={(e) => update("program", e.target.value)}
          >
            <option value="">Semua program</option>
            {data?.programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label>
          Status<select
            value={status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="all">Semua status</option>
            {(view === "catalog"
              ? ["unconfigured", "draft", "published", "locked", "archived"]
              : view === "mine"
              ? [
                "not_started",
                "draft",
                "submitted",
                "needs_revision",
                "accepted",
                "legacy_completed",
              ]
              : ["submitted", "needs_revision", "accepted"]).map((s) => (
                <option key={s} value={s}>{assignmentLabels[s]}</option>
              ))}
          </select>
        </label>
      </section>
      {error
        ? (
          <section role="alert" className="assignment-panel">
            <p>{error}</p>
            <Button variant="outline" onClick={reload}>Coba lagi</Button>
          </section>
        )
        : loading
        ? <p role="status">Memuat daftar tugas…</p>
        : data && !data.items.length
        ? (
          <section className="assignment-empty">
            <h2>Belum ada tugas pada filter ini</h2>
            <p>
              {mine
                ? "Tugas muncul setelah diterbitkan untuk program Anda."
                : view === "review"
                ? "Kiriman peserta akan masuk ke antrean ini."
                : "Buat tugas atau atur materi bertipe Tugas dari kurikulum."}
            </p>
            <Button variant="outline" onClick={() => setParams({ view })}>
              Hapus filter
            </Button>
          </section>
        )
        : (
          <div className="assignment-grid">
            {data?.items.map((row) => (
              <article
                key={row.lesson_id + row.enrollment_id}
                className="assignment-panel"
              >
                <div className="assignment-tags">
                  <span>
                    {responseLabels[row.response_kind ?? ""] || "Belum diatur"}
                  </span>
                  <span className="assignment-status" data-status={row.status}>
                    {assignmentLabels[row.status] ?? row.status}
                  </span>
                </div>
                <h2>{row.title}</h2>
                <p>{row.program_name}</p>
                {view === "review" && (
                  <p>
                    <strong>{row.participant_name}</strong> · Kiriman{" "}
                    {row.attempt_number}
                  </p>
                )}
                <p className="assignment-muted">{assignmentTime(row.due_at)}</p>
                {view === "catalog" && (
                  <p>{row.pending_count} menunggu penilaian</p>
                )}
                {row.score !== null && (
                  <p>
                    Nilai: <strong>{row.score}/100</strong>
                  </p>
                )}
                <Button
                  asChild
                  variant={row.status === "needs_revision" ||
                      row.status === "submitted"
                    ? "default"
                    : "outline"}
                >
                  <Link
                    to={mine && !row.can_work && !row.submission_id
                      ? "/learner/program/" + row.program_id
                      : assignmentPath(
                        base,
                        row.lesson_id,
                        view === "catalog" ? null : row.enrollment_id,
                      )}
                  >
                    {mine && !row.can_work && !row.submission_id
                      ? "Periksa akses program"
                      : view === "catalog"
                      ? "Detail & pengaturan"
                      : row.status === "needs_revision" && mine
                      ? "Perbaiki jawaban"
                      : row.status === "submitted" && !mine
                      ? "Tinjau kiriman"
                      : "Buka tugas"} →
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        )}
      {data && data.total > 0 && (
        <nav className="assignment-actions" aria-label="Halaman tugas">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() =>
              update("page", String(page - 1))}
          >
            Sebelumnya
          </Button>
          <span>
            {page} / {Math.max(1, Math.ceil(data.total / 30))} · {data.total}
            {" "}
            tugas
          </span>
          <Button
            variant="outline"
            disabled={page * 30 >= data.total}
            onClick={() => update("page", String(page + 1))}
          >
            Berikutnya
          </Button>
        </nav>
      )}
    </div>
  );
}
