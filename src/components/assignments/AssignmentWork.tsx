import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import {
  assignmentRpc,
  downloadAssignmentFile,
  uploadAssignmentFile,
} from "../../lib/assignmentData";
import {
  type AssignmentAttempt,
  type AssignmentDetail,
  assignmentError,
  type AssignmentFile,
  assignmentLabels,
  assignmentTime,
  responseLabels,
} from "../../lib/assignments";
import { useAssignmentRead } from "../../lib/useAssignmentRead";
import { AssignmentConfigForm } from "./AssignmentConfigForm";
function Attachment({ file }: { file: AssignmentFile }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="assignment-file">
      <span>
        {file.file_name} <small>({Math.ceil(file.file_size / 1024)} KB)</small>
      </span>
      {url
        ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            Buka berkas ↗
          </a>
        )
        : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setUrl(await downloadAssignmentFile(file.id));
              } catch (e) {
                setError(assignmentError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Menyiapkan…" : "Unduh"}
          </Button>
        )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function DraftEditor(
  { attempt, detail, onSaved, onDirty }: {
    attempt: AssignmentAttempt;
    detail: AssignmentDetail;
    onSaved: () => void;
    onDirty: (v: boolean) => void;
  },
) {
  const [text, setText] = useState(attempt.answer_text),
    [checks, setChecks] = useState(attempt.checked_items),
    [files, setFiles] = useState(attempt.files),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const save = async (submit: boolean) => {
    setBusy(true);
    setError("");
    try {
      await assignmentRpc("assignment_save", {
        p_id: attempt.id,
        p_revision: attempt.revision,
        p_text: text,
        p_checks: checks,
        p_files: files.map((f) => f.id),
        p_submit: submit,
      });
      onDirty(false);
      onSaved();
    } catch (e) {
      setError(assignmentError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="assignment-panel">
      <h2>Jawaban Anda · Kiriman {attempt.attempt_number}</h2>
      {error && <p role="alert" className="assignment-error">{error}</p>}
      <fieldset disabled={busy} className="assignment-form">
        {detail.config?.response_kind === "checklist" &&
          detail.config.checklist.map((c, i) => (
            <label className="assignment-check" key={i}>
              <input
                type="checkbox"
                checked={checks.includes(i)}
                onChange={(e) => {
                  setChecks((v) =>
                    e.target.checked ? [...v, i] : v.filter((x) =>
                      x !== i
                    )
                  );
                  onDirty(true);
                  setConfirm(false);
                }}
              />
              {c}
            </label>
          ))}
        <label>
          {detail.config?.response_kind === "text"
            ? "Jawaban teks"
            : "Catatan tambahan"}
          <textarea
            rows={8}
            maxLength={50000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onDirty(true);
              setConfirm(false);
            }}
          />
        </label>
        <label>
          Lampiran · PDF/JPG/PNG/WebP, 5 MB per berkas<input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            disabled={files.length >= 5}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setError("");
              setConfirm(false);
              try {
                const next = await uploadAssignmentFile(attempt.id, file);
                setFiles((v) => [...v, next]);
                onDirty(true);
              } catch (e) {
                setError(assignmentError(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <p className="assignment-muted">
          Maksimal 5 lampiran. Audio dan video tidak didukung.
        </p>
        {files.map((f) => (
          <div key={f.id} className="assignment-file">
            <span>{f.file_name}</span>
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setFiles((v) => v.filter((x) => x.id !== f.id));
                onDirty(true);
                setConfirm(false);
              }}
            >
              Lepas lampiran
            </Button>
          </div>
        ))}
        {confirm && (
          <div className="assignment-preview">
            <strong>Kumpulkan jawaban ini?</strong>
            <p>Jawaban dikunci sampai penilai meminta revisi.</p>
            <Button onClick={() => void save(true)}>Ya, kumpulkan</Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Periksa lagi
            </Button>
          </div>
        )}
        <div className="assignment-actions">
          <Button variant="outline" onClick={() => void save(false)}>
            {busy ? "Memproses…" : "Simpan draf"}
          </Button>
          <Button onClick={() => setConfirm(true)} disabled={confirm}>
            Kumpulkan tugas
          </Button>
        </div>
      </fieldset>
    </section>
  );
}
function ReviewEditor(
  { attempt, onSaved }: { attempt: AssignmentAttempt; onSaved: () => void },
) {
  const [score, setScore] = useState(""),
    [feedback, setFeedback] = useState(""),
    [decision, setDecision] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (
        decision === "accepted" &&
        (score.trim() === "" || !Number.isFinite(Number(score)) ||
          Number(score) < 0 || Number(score) > 100)
      ) throw new Error("Isi nilai 0–100.");
      if (decision === "needs_revision" && !feedback.trim()) {
        throw new Error("Jelaskan perbaikan yang diperlukan.");
      }
      await assignmentRpc("assignment_review", {
        p_id: attempt.id,
        p_revision: attempt.revision,
        p_decision: decision,
        p_score: decision === "accepted" ? Number(score) : null,
        p_feedback: feedback,
      });
      onSaved();
    } catch (e) {
      setError(assignmentError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="assignment-panel">
      <h2>Tinjau kiriman terbaru</h2>
      {error && <p role="alert" className="assignment-error">{error}</p>}
      <fieldset disabled={busy} className="assignment-form">
        <label>
          Umpan balik<textarea
            rows={4}
            maxLength={6000}
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
              setDecision("");
            }}
          />
        </label>
        <label>
          Nilai final (0–100)<input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={score}
            onChange={(e) => {
              setScore(e.target.value);
              setDecision("");
            }}
          />
        </label>
        {decision
          ? (
            <div className="assignment-preview">
              <p>
                {decision === "accepted"
                  ? `Finalkan nilai ${
                    score || "—"
                  }? Progres materi akan selesai dan nilai terkunci.`
                  : "Kirim permintaan revisi beserta umpan balik?"}
              </p>
              <Button onClick={() => void save()}>
                {busy ? "Menyimpan…" : "Konfirmasi"}
              </Button>
              <Button variant="ghost" onClick={() => setDecision("")}>
                Kembali
              </Button>
            </div>
          )
          : (
            <div className="assignment-actions">
              <Button
                variant="outline"
                onClick={() => setDecision("needs_revision")}
              >
                Minta revisi
              </Button>
              <Button onClick={() => setDecision("accepted")}>
                Finalkan nilai
              </Button>
            </div>
          )}
      </fieldset>
    </section>
  );
}
export function AssignmentWork(
  { lessonId, enrollment }: { lessonId: string; enrollment?: string | null },
) {
  const base = "/" + useLocation().pathname.split("/")[1];
  const { data, error, loading, reload } = useAssignmentRead<AssignmentDetail>(
    "assignment_detail",
    { p_lesson: lessonId, p_enrollment: enrollment ?? null },
  );
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  if (loading && !data) return <p role="status">Memuat tugas…</p>;
  if (!data) {
    return (
      <section className="assignment-panel">
        <p role="alert">{error || "Tugas tidak tersedia."}</p>
        <Button variant="outline" onClick={reload}>Coba lagi</Button>
      </section>
    );
  }
  const current = data.history[0];
  const revisionRequest = current?.status === "draft"
    ? data.history.find((s) => s.status === "needs_revision")
    : current;
  const begin = async () => {
    setBusy(true);
    setActionError("");
    try {
      await assignmentRpc("assignment_begin", { p_lesson: lessonId });
      reload();
    } catch (e) {
      setActionError(assignmentError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="assignment-workspace">
      <header className="assignment-heading">
        <div>
          <span>{data.lesson.program_name}</span>
          <h1>{data.lesson.title}</h1>
          <p>
            {data.participant_name || "Pengaturan tugas"} ·{" "}
            {assignmentTime(data.lesson.due_at)}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy || loading}
          onClick={() => {
            if (
              !dirty ||
              window.confirm(
                "Draf belum disimpan. Muat ulang dan buang perubahan lokal?",
              )
            ) {
              setDirty(false);
              reload();
            }
          }}
        >
          Muat ulang
        </Button>
      </header>
      {(actionError || error) && (
        <p role="alert" className="assignment-error">{actionError || error}</p>
      )}
      <nav className="assignment-actions" aria-label="Menu terkait tugas">
        <Button asChild variant="outline">
          <Link to={`${base}/tugas`}>Daftar tugas</Link>
        </Button>
        {base === "/learner"
          ? (
            <Button asChild variant="outline">
              <Link to={"/learner/program/" + data.lesson.program_id}>
                Program & progres
              </Link>
            </Button>
          )
          : (
            <Button asChild variant="outline">
              <Link
                to={`${
                  base === "/teacher" ? "/teacher/kelas" : base
                }/program/${data.lesson.program_id}/kurikulum`}
              >
                Kurikulum program
              </Link>
            </Button>
          )}
        {data.can_manage && !data.config_locked && (
          <Button
            variant="outline"
            onClick={() => setEditing((v) => !v)}
          >
            Atur tugas
          </Button>
        )}
      </nav>
      {editing && (
        <AssignmentConfigForm
          initial={data}
          modules={[{
            id: data.lesson.module_id,
            title: data.lesson.title,
            program_id: data.lesson.program_id,
          }]}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
      {data.config
        ? (
          <section className="assignment-panel">
            <div className="assignment-tags">
              <span>{responseLabels[data.config.response_kind]}</span>
              <span>{assignmentLabels[current?.status ?? "not_started"]}</span>
              {dirty && <span>Perubahan belum disimpan</span>}
            </div>
            <h2>Instruksi</h2>
            <p className="whitespace-pre-wrap">{data.config.instructions}</p>
            {data.config.response_kind === "checklist" && (
              <ul>
                {data.config.checklist.map((x, i) => <li key={i}>□ {x}</li>)}
              </ul>
            )}
            {data.config.allow_late && (
              <p className="assignment-muted">
                Pengumpulan terlambat diizinkan.
              </p>
            )}
            {revisionRequest?.status === "needs_revision" && (
              <div className="assignment-feedback">
                <strong>Perbaikan dari penilai</strong>
                <p className="whitespace-pre-wrap">
                  {revisionRequest.feedback}
                </p>
              </div>
            )}
            {data.is_owner && data.can_work && !data.legacy_completed &&
              (!current || current.status === "needs_revision") && (
              <Button
                disabled={busy}
                onClick={() => void begin()}
              >
                {busy
                  ? "Menyiapkan…"
                  : current
                  ? "Mulai revisi"
                  : "Mulai mengerjakan"}
              </Button>
            )}
            {data.legacy_completed && (
              <p>Hasil tugas sebelumnya tetap tersimpan di progres.</p>
            )}
            {data.is_owner && !data.can_work && (
              <p>
                Akses pengumpulan belum tersedia. Periksa kepesertaan dan
                prasyarat program.
              </p>
            )}
          </section>
        )
        : (
          <section className="assignment-panel">
            <h2>Tugas belum diatur</h2>
            <p>
              Pengelola perlu mengatur jenis jawaban dan instruksi sebelum
              peserta mulai.
            </p>
          </section>
        )}
      {data.is_owner && data.can_work && current?.status === "draft" && (
        <DraftEditor
          key={current.id + current.revision}
          attempt={current}
          detail={data}
          onDirty={setDirty}
          onSaved={reload}
        />
      )}
      {data.history.filter((s) => s.status !== "draft").map((s, i) => {
        const Container = i === 0 ? "section" : "details";
        const Heading = i === 0 ? "header" : "summary";
        return (
          <Container key={s.id} className="assignment-panel">
            <Heading className="assignment-heading">
              <h2>Kiriman {s.attempt_number}{i === 0 ? " · terbaru" : ""}</h2>
              <span className="assignment-status" data-status={s.status}>
                {assignmentLabels[s.status]}
              </span>
            </Heading>
            <p className="assignment-muted">
              Dikumpulkan {assignmentTime(s.submitted_at)}
              {s.snapshot.late ? " · Setelah tenggat" : ""}
            </p>
            <p className="whitespace-pre-wrap">{s.answer_text}</p>
            {s.checked_items.map((n) => (
              <p key={n}>✓ {s.snapshot.checklist?.[n]}</p>
            ))}
            {s.files.map((f) => <Attachment file={f} key={f.id} />)}
            {s.feedback && (
              <div className="assignment-feedback">
                <strong>Umpan balik</strong>
                <p className="whitespace-pre-wrap">{s.feedback}</p>
              </div>
            )}
            {s.score !== null && (
              <p className="assignment-score">
                Nilai final: <strong>{s.score}/100</strong>
              </p>
            )}
          </Container>
        );
      })}
      {data.can_review && current?.status === "submitted" && (
        <ReviewEditor
          key={current.id + current.revision}
          attempt={current}
          onSaved={reload}
        />
      )}
    </div>
  );
}
