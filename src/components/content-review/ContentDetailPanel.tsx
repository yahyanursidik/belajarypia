import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { Button } from "../ui/button";
import { ContentPreview } from "./ContentPreview";
import { ContentDecisionDialog } from "./ContentDecisionDialog";
import {
  contentEditorHref,
  contentReviewHref,
  contentKinds,
  contentStatuses,
  contentStatus,
  contentTime,
  type ContentDetail,
} from "../../lib/contentReviewWorkspace";
export function ContentDetailPanel({
  data,
  params,
  onClose,
  onReload,
  onSaved,
}: {
  data: ContentDetail;
  params: URLSearchParams;
  onClose: () => void;
  onReload: () => void;
  onSaved: (next: ContentDetail) => void;
}) {
  const [tab, setTab] = useState("preview"),
    [decision, setDecision] = useState(false);
  const state = contentStatus(data.lesson);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 800px)").matches)
      titleRef.current?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <section className="content-detail" aria-label="Detail materi">
      <header className="content-detail-header">
        <div className="content-detail-eyebrow">
          <span>
            {contentKinds[
              data.lesson.lesson_type as keyof typeof contentKinds
            ] ?? "Materi"}
          </span>
          <span className={`content-status content-status-${state}`}>
            {contentStatuses[state]}
          </span>
        </div>
        <h2 ref={titleRef} tabIndex={-1}>
          {data.lesson.title}
        </h2>
        <p>
          {data.context.program_name} · {data.context.module_title}
        </p>
        <small>
          {data.lesson.code} · Disimpan {contentTime(data.lesson.updated_at)}
        </small>
        <div className="content-detail-actions">
          <Button size="sm" variant="outline" onClick={onClose}>
            <ArrowLeft size={14} />
            Ke daftar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReload}
            aria-label="Muat ulang detail materi"
          >
            <RefreshCw size={14} />
          </Button>
          <Button size="sm" asChild variant="outline">
            <Link to={contentEditorHref(data, params)}>
              Ubah materi
              <ArrowUpRight size={14} />
            </Link>
          </Button>
          <Button size="sm" onClick={() => setDecision(true)}>
            <FileCheck size={15} />
            Tinjau status
          </Button>
        </div>
      </header>
      <div className="content-check-summary" data-ready={data.checks.ready}>
        <span>
          {data.checks.ready ? (
            <CheckCircle2 size={19} />
          ) : (
            <AlertTriangle size={19} />
          )}
          <strong>
            {data.checks.ready
              ? "Kelengkapan siap diperiksa"
              : `${data.checks.issues.length} hal perlu dilengkapi`}
          </strong>
        </span>
        <Button size="sm" variant="ghost" onClick={() => setTab("checks")}>
          Lihat pemeriksaan
        </Button>
      </div>
      <nav
        className="content-detail-tabs"
        aria-label="Bagian review"
        role="tablist"
      >
        {[
          ["preview", "Isi & sumber"],
          ["checks", "Pemeriksaan"],
          ["history", "Riwayat"],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            id={`content-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`content-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(event) => {
              if (
                !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const keys = ["preview", "checks", "history"];
              const i = keys.indexOf(tab),
                next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 2
                      : (i + (event.key === "ArrowRight" ? 1 : 2)) % 3;
              setTab(keys[next]);
              const buttons =
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                  "button",
                );
              buttons?.[next]?.focus();
            }}
          >
            {label}
            {key === "checks" && !data.checks.ready && (
              <span>{data.checks.issues.length}</span>
            )}
          </button>
        ))}
      </nav>
      <div
        className="content-detail-body"
        role="tabpanel"
        id={`content-panel-${tab}`}
        aria-labelledby={`content-tab-${tab}`}
        tabIndex={0}
      >
        {tab === "preview" && (
          <ContentPreview key={data.revision} data={data} />
        )}
        {tab === "checks" && (
          <div className="content-checks">
            <h3>Kelengkapan materi</h3>
            <p className="content-muted">
              Periksa isi dan akses sumber sebelum menerbitkan.
            </p>
            {data.checks.issues.map((issue, i) => (
              <div key={i} className="content-check-item content-check-fail">
                <AlertTriangle size={17} />
                <span>{issue}</span>
              </div>
            ))}
            {data.checks.ready && (
              <div className="content-check-item content-check-ok">
                <CheckCircle2 size={17} />
                <span>Data wajib sudah lengkap.</span>
              </div>
            )}
            {data.checks.warnings.map((warning, i) => (
              <div key={i} className="content-check-item content-check-warn">
                <AlertTriangle size={17} />
                <span>{warning}</span>
              </div>
            ))}
            <dl className="content-settings">
              <div>
                <dt>Rilis</dt>
                <dd>
                  {data.lesson.release_at
                    ? contentTime(data.lesson.release_at)
                    : "Setelah diterbitkan"}
                </dd>
              </div>
              <div>
                <dt>Tenggat</dt>
                <dd>{contentTime(data.lesson.due_at)}</dd>
              </div>
              <div>
                <dt>Sumber peserta</dt>
                <dd>{data.checks.sources}</dd>
              </div>
              <div>
                <dt>Soal / kartu</dt>
                <dd>
                  {data.checks.questions} / {data.checks.cards}
                </dd>
              </div>
            </dl>
            {data.prerequisites.length > 0 && (
              <section>
                <h3>Prasyarat</h3>
                <div className="content-prerequisites">
                  {data.prerequisites.map((p) => (
                    <Link key={p.id} to={contentReviewHref(p.id, params)}>
                      {p.title}
                      <span>{contentStatuses[p.visibility_status]}</span>
                      <ArrowUpRight size={14} />
                    </Link>
                  ))}
                </div>
              </section>
            )}
            <Button asChild variant="outline">
              <Link to={contentEditorHref(data, params)}>
                Lengkapi di editor materi
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          </div>
        )}
        {tab === "history" && (
          <div className="content-history">
            <h3>Keputusan terbaru</h3>
            {!data.history.length && (
              <p className="content-empty">
                Belum ada keputusan yang dicatat melalui Review Konten.
              </p>
            )}
            <ol>
              {data.history.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>
                      {contentStatuses[item.details.previous_status]} →{" "}
                      {contentStatuses[item.details.status]}
                    </strong>
                    <small>
                      {item.actor_name} · {contentTime(item.created_at)}
                    </small>
                  </div>
                  {item.details.notes && <p>{item.details.notes}</p>}
                </li>
              ))}
            </ol>
            <Button asChild size="sm" variant="outline">
              <Link to={"/system/audit?entity=lesson&target=" + data.lesson.id}>
                Buka audit sistem
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          </div>
        )}
      </div>
      <footer className="content-related">
        <Link to={`/system/program/${data.context.program_id}/kurikulum`}>
          Kurikulum
          <ArrowUpRight size={13} />
        </Link>
        <Link to={`/system/program/${data.context.program_id}/report`}>
          Progres belajar
          <ArrowUpRight size={13} />
        </Link>
        <Link to={`/system/pengumuman?program=${data.context.program_id}`}>
          Pengumuman
          <ArrowUpRight size={13} />
        </Link>
        {["quiz", "exam", "assignment"].includes(data.lesson.lesson_type) && (
          <Link
            to={`/system/penilaian?program=${data.context.program_id}${["quiz", "exam"].includes(data.lesson.lesson_type) ? "&kind=quiz" : ""}`}
          >
            Penilaian
            <ArrowUpRight size={13} />
          </Link>
        )}
      </footer>
      {decision && (
        <ContentDecisionDialog
          data={data}
          onClose={() => setDecision(false)}
          onReload={() => {
            setDecision(false);
            onReload();
          }}
          onSaved={(next) => {
            setDecision(false);
            onSaved(next);
          }}
        />
      )}
    </section>
  );
}
