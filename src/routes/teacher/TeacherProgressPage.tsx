import { Link, useSearchParams } from "react-router-dom";
import { useTeachingWorkspace } from "../../lib/teacherData";
import { teachingProgress } from "../../lib/teacherWorkspace";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Progress } from "../../components/ui/progress";
import { TeachingLinks } from "../../components/teacher/TeachingLinks";
export function TeacherProgressPage() {
  const { data, error, loading, reload } = useTeachingWorkspace();
  const [params, setParams] = useSearchParams();
  const program = params.get("program") || "",
    classId = params.get("class") || "",
    q = params.get("q") || "";
  function update(key: string, value: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (value) n.set(key, value);
      else n.delete(key);
      n.delete("page");
      if (key === "program") n.delete("class");
      return n;
    });
  }
  const rows = (data?.enrollments ?? []).filter(
    (e) =>
      (!program || e.program_id === program) &&
      (!classId || e.class_id === classId) &&
      `${e.participants?.display_name ?? ""} ${e.enrollment_number} ${e.participants?.global_participant_number ?? ""}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const requested = Number(params.get("page") || 1);
  const page = Number.isSafeInteger(requested)
    ? Math.max(1, Math.min(pages, requested))
    : 1;
  return (
    <div className="teaching-workspace">
      <header className="teaching-heading">
        <div>
          <span>PERKEMBANGAN BELAJAR</span>
          <h1>Progres peserta</h1>
        </div>
        <Button variant="outline" disabled={loading} onClick={reload}>
          Muat ulang
        </Button>
      </header>
      <TeachingLinks />
      <div className="teaching-filters">
        <label>
          Program
          <select
            value={program}
            onChange={(e) => update("program", e.target.value)}
          >
            <option value="">Semua program</option>
            {data?.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kelas
          <select
            value={classId}
            onChange={(e) => update("class", e.target.value)}
          >
            <option value="">Semua kelas</option>
            {data?.classes
              .filter((c) => !program || c.program_id === program)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Cari peserta
          <Input
            value={q}
            onChange={(e) => update("q", e.target.value)}
            placeholder="Nama atau nomor peserta"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="teaching-error">
          {error}
        </p>
      )}
      {loading && !data ? (
        <p role="status">Memuat progres peserta…</p>
      ) : (
        data && (
          <section className="teaching-panel">
            <header>
              <h2>{rows.length} kepesertaan aktif</h2>
              <span>Materi terbit dan sudah dirilis</span>
            </header>
            <div className="teaching-roster">
              {rows.slice((page - 1) * 20, page * 20).map((e) => {
                const s = teachingProgress(
                  e,
                  data.lessons.filter((l) => l.program_id === e.program_id),
                  data.progress,
                );
                return (
                  <article key={e.id}>
                    <div>
                      <h3>
                        {e.participants?.display_name ||
                          "Identitas belum tersedia"}
                      </h3>
                      <small>
                        {e.enrollment_number} ·{" "}
                        {data.programs.find((p) => p.id === e.program_id)?.name}
                      </small>
                    </div>
                    <div>
                      <strong>
                        {s.percent === null ? "—" : s.percent + "%"}
                      </strong>
                      <Progress
                        value={s.percent ?? 0}
                        aria-label={
                          "Progres " +
                          (e.participants?.display_name || e.enrollment_number)
                        }
                      />
                      <small>
                        {s.completed}/{s.total} materi tersedia
                      </small>
                    </div>
                    <Link
                      to={
                        "/teacher/review?program=" +
                        e.program_id +
                        "&q=" +
                        encodeURIComponent(e.enrollment_number)
                      }
                    >
                      Hasil penilaian →
                    </Link>
                  </article>
                );
              })}
            </div>
            {!rows.length && <p>Tidak ada peserta sesuai filter.</p>}
            <footer className="teaching-actions">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() =>
                  setParams((p) => {
                    p.set("page", String(page - 1));
                    return p;
                  })
                }
              >
                Sebelumnya
              </Button>
              <span>
                Halaman {page} / {pages}
              </span>
              <Button
                variant="outline"
                disabled={page === pages}
                onClick={() =>
                  setParams((p) => {
                    p.set("page", String(page + 1));
                    return p;
                  })
                }
              >
                Berikutnya
              </Button>
            </footer>
            <p className="teaching-note">
              Progres materi tidak menentukan kelulusan. Data mengikuti akses
              pengajaran Anda.
            </p>
          </section>
        )
      )}
    </div>
  );
}
