import { useEffect, useState } from "react";
import {
  ExternalLink,
  FileText,
  KeyRound,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { requestSignedDownloadUrl } from "../../lib/documents";
import { requestLessonBoardImageUrl } from "../../lib/lessonBoards";
import {
  safeContentUrl,
  type ContentDetail,
  type ContentDocument,
} from "../../lib/contentReviewWorkspace";
function DocumentSource({ doc }: { doc: ContentDocument }) {
  const [prepared, setPrepared] = useState<{
      url: string;
      expires: number;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!prepared) return;
    const timer = setTimeout(
      () => setPrepared(null),
      Math.max(0, prepared.expires - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [prepared]);
  const external =
    doc.source_type === "external_link"
      ? safeContentUrl(doc.external_url)
      : null;
  async function prepare() {
    setError("");
    setBusy(true);
    setPrepared(null);
    try {
      const r = await requestSignedDownloadUrl(doc.id);
      const url = safeContentUrl(r.signedUrl);
      if (!url) throw new Error();
      setPrepared({ url, expires: Date.now() + (r.expiresIn ?? 60) * 1000 });
    } catch {
      setError("File belum dapat disiapkan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="content-source">
      <FileText size={19} />
      <div>
        <strong>{doc.display_name}</strong>
        <small>
          {doc.source_type === "external_link"
            ? "Tautan eksternal"
            : "Dokumen privat"}{" "}
          ·{" "}
          {doc.access_level === "staff_only"
            ? "Khusus pengelola"
            : "Untuk peserta"}
        </small>
        {error && (
          <p role="alert" className="program-error">
            {error}
          </p>
        )}
      </div>
      {external ? (
        <Button asChild size="sm" variant="outline">
          <a href={external} target="_blank" rel="noopener noreferrer">
            Buka
            <ExternalLink size={14} />
          </a>
        </Button>
      ) : doc.source_type === "object_storage" ? (
        prepared && prepared.expires > Date.now() ? (
          <Button asChild size="sm" variant="outline">
            <a href={prepared.url} target="_blank" rel="noopener noreferrer">
              Buka file
              <ExternalLink size={14} />
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void prepare()}
          >
            {busy ? "Menyiapkan…" : "Siapkan file"}
          </Button>
        )
      ) : (
        <span className="content-warning">Tautan tidak valid</span>
      )}
    </article>
  );
}
function BoardImage({ post }: { post: ContentDetail["posts"][number] }) {
  const [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const r = await requestLessonBoardImageUrl(post.id);
      const value = safeContentUrl(r.signedUrl);
      if (!value) throw new Error();
      setUrl(value);
    } catch {
      setError("Gambar belum dapat dimuat.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {url ? (
        <img
          src={url}
          alt={post.image_alt || post.title || "Gambar materi"}
          onError={() => {
            setUrl("");
            setError("Tautan gambar berakhir atau belum tersedia.");
          }}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={busy}
        >
          <ImageIcon size={15} />
          {busy ? "Memuat…" : "Lihat gambar"}
        </Button>
      )}
      {error && (
        <p role="alert" className="program-error">
          {error}
        </p>
      )}
    </>
  );
}
export function ContentPreview({ data }: { data: ContentDetail }) {
  const [keys, setKeys] = useState(false),
    [questionPage, setQuestionPage] = useState(1);
  const lesson = data.lesson,
    url = safeContentUrl(lesson.external_url);
  const html =
    lesson.content_format === "html" ||
    /<\/?[a-z][\s\S]*>/i.test(lesson.content_body ?? "");
  const questionPages = Math.max(1, Math.ceil(data.questions.length / 10));
  return (
    <div className="content-preview-stack">
      {lesson.content_body && (
        <section className="content-preview-section">
          <h3>
            {["quiz", "exam"].includes(lesson.lesson_type)
              ? "Instruksi ujian"
              : "Isi materi"}
          </h3>
          {html ? (
            <iframe
              title="Pratinjau isi materi"
              sandbox=""
              referrerPolicy="no-referrer"
              className="content-html-preview"
              srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'"><meta name="referrer" content="no-referrer"><style>body{font:15px/1.7 system-ui;color:#334155;margin:16px;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${lesson.content_body}</body></html>`}
            />
          ) : (
            <div className="content-body-text">{lesson.content_body}</div>
          )}
        </section>
      )}
      {lesson.external_url && (
        <section className="content-external">
          <div>
            <strong>
              {lesson.lesson_type === "live_session"
                ? "Tautan sesi live"
                : "Tautan utama"}
            </strong>
            <small>{url ? new URL(url).hostname : "Tautan tidak valid"}</small>
          </div>
          {url && (
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noopener noreferrer">
                Buka tautan
                <ExternalLink size={14} />
              </a>
            </Button>
          )}
        </section>
      )}
      {data.documents.length > 0 && (
        <section className="content-preview-section">
          <h3>
            Sumber materi <span>{data.documents.length}</span>
          </h3>
          {data.documents.map((doc) => (
            <DocumentSource key={doc.id} doc={doc} />
          ))}
        </section>
      )}
      {["quiz", "exam"].includes(lesson.lesson_type) && (
        <section className="content-preview-section">
          <div className="content-inline-head">
            <h3>
              Soal <span>{data.questions.length}</span>
            </h3>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={keys}
              onClick={() => setKeys((v) => !v)}
            >
              <KeyRound size={14} />
              {keys ? "Sembunyikan kunci" : "Lihat kunci"}
            </Button>
          </div>
          <dl className="content-settings">
            <div>
              <dt>Nilai minimum</dt>
              <dd>{lesson.passing_grade ?? "Bawaan ujian"}</dd>
            </div>
            <div>
              <dt>Durasi</dt>
              <dd>
                {lesson.duration_minutes
                  ? `${lesson.duration_minutes} menit`
                  : "Tanpa batas"}
              </dd>
            </div>
            <div>
              <dt>Percobaan</dt>
              <dd>{lesson.max_attempts ?? "Tanpa batas"}</dd>
            </div>
            <div>
              <dt>Soal acak</dt>
              <dd>{lesson.randomized_questions_count || "Semua soal"}</dd>
            </div>
          </dl>
          {!data.questions.length && (
            <p className="content-empty">
              Belum ada soal. Lengkapi melalui editor materi.
            </p>
          )}
          {data.questions
            .slice((questionPage - 1) * 10, questionPage * 10)
            .map((q, i) => (
              <article className="content-question" key={q.id}>
                <div>
                  <b>
                    {(questionPage - 1) * 10 + i + 1}. {q.question_text}
                  </b>
                  <small>
                    {q.question_type === "essay" ? "Esai" : "Pilihan ganda"} ·{" "}
                    {q.points} poin
                  </small>
                </div>
                {Array.isArray(q.options) && q.options.length > 0 && (
                  <ul>
                    {q.options.map((o, n) => (
                      <li
                        key={n}
                        data-correct={keys && o.label === q.correct_answer}
                      >
                        <b>{o.label}.</b> {o.text}
                      </li>
                    ))}
                  </ul>
                )}
                {keys && (
                  <div className="content-key">
                    {q.question_type === "essay"
                      ? q.grading_guide || "Belum ada panduan penilaian."
                      : `Kunci: ${q.correct_answer || "Belum diisi"}`}
                  </div>
                )}
              </article>
            ))}
          {questionPages > 1 && (
            <nav className="content-pagination" aria-label="Halaman soal">
              <Button
                size="sm"
                variant="outline"
                disabled={questionPage === 1}
                onClick={() => setQuestionPage((p) => p - 1)}
              >
                Sebelumnya
              </Button>
              <span>
                {questionPage}/{questionPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={questionPage === questionPages}
                onClick={() => setQuestionPage((p) => p + 1)}
              >
                Berikutnya
              </Button>
            </nav>
          )}
        </section>
      )}
      {lesson.lesson_type === "board" && (
        <section className="content-preview-section">
          <h3>
            {data.board?.title || "Papan belajar"}{" "}
            <span>{data.posts.length} kartu</span>
          </h3>
          {data.board?.description && <p>{data.board.description}</p>}
          {!data.posts.length && (
            <p className="content-empty">Belum ada kartu materi.</p>
          )}
          <div className="content-board-preview">
            {data.posts.map((post) => (
              <article key={post.id}>
                {data.board?.layout === "columns" && (
                  <small>
                    {data.columns.find(
                      (c) => c.id === (post.column_id || data.columns[0]?.id),
                    )?.title || "Tanpa kolom"}
                  </small>
                )}
                {post.title && <h4>{post.title}</h4>}
                {post.body && <p>{post.body}</p>}
                {post.has_image && <BoardImage post={post} />}
              </article>
            ))}
          </div>
        </section>
      )}
      {!lesson.content_body &&
        !lesson.external_url &&
        !data.documents.length &&
        !["quiz", "exam", "board"].includes(lesson.lesson_type) && (
          <p className="content-empty">Belum ada isi atau sumber materi.</p>
        )}
    </div>
  );
}
