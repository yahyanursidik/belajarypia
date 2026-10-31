import { Link, useSearchParams } from "react-router-dom";
import { useTeachingWorkspace } from "../../lib/teacherData";
import { TeachingLinks } from "../../components/teacher/TeachingLinks";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
export function TeacherClassPage() {
  const { data, error, loading, reload } = useTeachingWorkspace();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  return (
    <div className="teaching-workspace">
      <header className="teaching-heading">
        <div>
          <span>AMANAH PENGAJARAN</span>
          <h1>Program & kelas</h1>
        </div>
        <Button variant="outline" onClick={reload} disabled={loading}>
          Muat ulang
        </Button>
      </header>
      <TeachingLinks />
      <Input
        aria-label="Cari program atau kelas"
        placeholder="Cari program atau kelas…"
        value={q}
        onChange={(e) => setParams({ q: e.target.value })}
      />
      {error && (
        <p role="alert" className="teaching-error">
          {error}
        </p>
      )}
      {loading && !data ? (
        <p role="status">Memuat program dan kelas…</p>
      ) : (
        data && (
          <>
            <section className="teaching-panel">
              <header>
                <h2>Program pengajaran</h2>
                <span>{data.programs.length} program terkait</span>
              </header>
              <div className="teaching-courses">
                {data.programs
                  .filter((p) =>
                    `${p.name} ${p.code}`
                      .toLowerCase()
                      .includes(q.toLowerCase()),
                  )
                  .map((p) => (
                    <article key={p.id}>
                      <small>{p.code}</small>
                      <h3>{p.name}</h3>
                      <div className="teaching-actions">
                        <Link
                          to={
                            "/teacher/kelas/program/" + p.id + "/detail-program"
                          }
                        >
                          Detail program →
                        </Link>
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
              {!data.programs.some((p) =>
                `${p.name} ${p.code}`.toLowerCase().includes(q.toLowerCase()),
              ) && <p>Tidak ada program sesuai pencarian.</p>}
            </section>
            <section className="teaching-panel">
              <header>
                <h2>Kelas ditugaskan</h2>
                <span>{data.classes.length} kelas</span>
              </header>
              <div className="teaching-courses">
                {data.classes
                  .filter((c) =>
                    `${c.name} ${c.code}`
                      .toLowerCase()
                      .includes(q.toLowerCase()),
                  )
                  .map((c) => (
                    <article key={c.id}>
                      <small>{c.code}</small>
                      <h3>{c.name}</h3>
                      <span>
                        {data.programs.find((p) => p.id === c.program_id)?.name}
                      </span>
                      <div className="teaching-actions">
                        <Link to={"/teacher/kelas/" + c.id}>Buka kelas →</Link>
                        <Link
                          to={
                            "/teacher/progres?program=" +
                            c.program_id +
                            "&class=" +
                            c.id
                          }
                        >
                          Progres kelas →
                        </Link>
                      </div>
                    </article>
                  ))}
              </div>
              {!data.classes.some((c) =>
                `${c.name} ${c.code}`.toLowerCase().includes(q.toLowerCase()),
              ) && <p>Tidak ada kelas sesuai pencarian.</p>}
            </section>
          </>
        )
      )}
    </div>
  );
}
