import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCheck,
  Megaphone,
  Pin,
  RefreshCw,
} from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { PageHeader } from "../../components/admin/PageHeader";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog } from "../../components/ui/dialog";
import {
  AnnouncementMessage,
  AnnouncementPagination,
} from "../../components/announcements/AnnouncementShared";
import {
  announcementRpc,
  useAnnouncementData,
} from "../../lib/announcementData";
import {
  announcementDate,
  announcementError,
  announcementInboxPath,
  announcementPage,
  announcementUnread,
} from "../../lib/announcementWorkspace";
export function AnnouncementInboxPage() {
  const { primaryRole } = useAuthSession();
  const { items, loading, error, load } = useAnnouncementData("inbox");
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false),
    [readError, setReadError] = useState("");
  const q = params.get("q") ?? "",
    program = params.get("program") ?? "all",
    status = params.get("status") ?? "all";
  function update(values: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [k, v] of Object.entries(values)) {
          if (v && v !== "all") next.set(k, v);
          else next.delete(k);
        }
        if (!("page" in values)) next.delete("page");
        return next;
      },
      { replace: true },
    );
    setReadError("");
  }
  const filtered = items.filter(
    (a) =>
      (!q ||
        `${a.title} ${a.content}`.toLowerCase().includes(q.toLowerCase())) &&
      (program === "all" || a.target_program_id === program) &&
      (status !== "unread" || announcementUnread(a)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    page = Math.min(announcementPage(params.get("page")), pages);
  const detail = items.find((a) => a.id === params.get("detail"));
  const groups = [
    ...new Map(
      items
        .filter((a) => a.target_program_id)
        .map((a) => [a.target_program_id!, a.program_name ?? "Program"]),
    ).entries(),
  ];
  return (
    <div className="page-stack announcement-workspace">
      <PageHeader
        title="Pengumuman"
        actions={
          <>
            {["super_admin", "admin"].includes(primaryRole ?? "") && (
              <Button asChild variant="outline">
                <Link
                  to={`${primaryRole === "super_admin" ? "/system" : "/admin"}/pengumuman`}
                >
                  Kelola pengumuman
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              aria-label="Muat ulang pengumuman"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw size={16} />
            </Button>
          </>
        }
      />
      <div className="announcement-inbox-counts">
        <button
          aria-pressed={status === "all"}
          onClick={() => update({ status: null })}
        >
          Semua <strong>{items.length}</strong>
        </button>
        <button
          aria-pressed={status === "unread"}
          onClick={() => update({ status: "unread" })}
        >
          Belum dibaca{" "}
          <strong>{items.filter(announcementUnread).length}</strong>
        </button>
      </div>
      <div className="announcement-filters">
        <Input
          aria-label="Cari pengumuman"
          placeholder="Cari pengumuman…"
          value={q}
          onChange={(e) => update({ q: e.target.value })}
        />
        <select
          aria-label="Filter program pengumuman"
          className="field-control"
          value={program}
          onChange={(e) => update({ program: e.target.value })}
        >
          <option value="all">Semua program</option>
          {groups.map(([id, name]) => (
            <option value={id} key={id}>
              {name}
            </option>
          ))}
        </select>
        {(q || program !== "all") && (
          <Button
            variant="ghost"
            onClick={() => update({ q: null, program: null })}
          >
            Reset
          </Button>
        )}
      </div>
      {error ? (
        <section className="announcement-empty" role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Coba lagi
          </Button>
        </section>
      ) : loading ? (
        <p className="announcement-empty" role="status">
          Memuat pengumuman…
        </p>
      ) : (
        <>
          <div className="announcement-inbox-list">
            {filtered.slice((page - 1) * 10, page * 10).map((a) => (
              <button
                key={a.id}
                onClick={() => update({ detail: a.id })}
                data-unread={announcementUnread(a)}
              >
                <span className="announcement-type-icon">
                  <Megaphone size={20} />
                </span>
                <span className="announcement-inbox-title">
                  <span className="announcement-mini-label">
                    {a.program_name ?? "Informasi umum"}
                    {a.class_name ? ` · ${a.class_name}` : ""}
                  </span>
                  <strong>
                    {a.is_pinned && <Pin size={13} />} {a.title}
                  </strong>
                  <span className="announcement-excerpt">{a.content}</span>
                  <time>{announcementDate(a.publish_at ?? a.created_at)}</time>
                </span>
                {announcementUnread(a) ? (
                  <span className="admission-badge admission-tone-sky">
                    Baru
                  </span>
                ) : (
                  <CheckCheck
                    size={18}
                    className="text-emerald-700"
                    aria-label="Sudah dibaca"
                  />
                )}
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
          {!filtered.length && (
            <div className="announcement-empty">
              <Megaphone size={27} />
              <strong>
                {status === "unread"
                  ? "Semua pengumuman sudah dibaca"
                  : "Belum ada pengumuman pada filter ini"}
              </strong>
            </div>
          )}
          <AnnouncementPagination
            page={page}
            pages={pages}
            onChange={(n) => update({ page: String(n) })}
          />
        </>
      )}
      {detail && !loading && !error && (
        <Dialog
          title="Baca pengumuman"
          onClose={() => update({ detail: null })}
          busy={busy}
          className="announcement-reader-dialog"
        >
          <AnnouncementMessage item={detail} role={primaryRole} />
          {readError && (
            <p className="program-error mt-4" role="alert">
              {readError}
              <Button variant="ghost" onClick={() => void load()}>
                Muat ulang
              </Button>
            </p>
          )}
          <footer className="workspace-dialog__footer">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => update({ detail: null })}
            >
              Tutup
            </Button>
            {announcementUnread(detail) ? (
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setReadError("");
                  try {
                    const r = await announcementRpc<{ id: string }>(
                      "mark_announcement_read",
                      { p_id: detail.id, p_revision: detail.revision },
                    );
                    if (r.id !== detail.id)
                      throw new Error("Tanda baca belum terkonfirmasi.");
                    await load();
                  } catch (e) {
                    setReadError(announcementError(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <CheckCheck size={16} />
                {busy ? "Menyimpan…" : "Tandai sudah dibaca"}
              </Button>
            ) : (
              <span className="text-sm text-emerald-700 flex items-center gap-2">
                <CheckCheck size={16} />
                Sudah dibaca
              </span>
            )}
          </footer>
        </Dialog>
      )}
    </div>
  );
}
export function AnnouncementHighlights() {
  const { primaryRole } = useAuthSession();
  const { items, error, loading } = useAnnouncementData("inbox");
  if (!loading && !error && !items.length) return null;
  return (
    <section
      className="announcement-highlights"
      aria-label="Pengumuman terbaru"
    >
      <div className="announcement-section-heading">
        <h2>Pengumuman terbaru</h2>
        <Link to={announcementInboxPath(primaryRole)}>
          Lihat semua <ArrowRight size={14} />
        </Link>
      </div>
      {error ? (
        <p className="text-sm text-muted-foreground">
          Pengumuman belum dapat dimuat.{" "}
          <Link to={announcementInboxPath(primaryRole)}>Buka pengumuman</Link>
        </p>
      ) : loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Memuat pengumuman…
        </p>
      ) : (
        <div className="announcement-highlight-grid">
          {items.slice(0, 3).map((a) => (
            <Link
              key={a.id}
              to={`${announcementInboxPath(primaryRole)}?detail=${a.id}`}
            >
              <span className="announcement-mini-label">
                {a.program_name ?? "Informasi umum"}
              </span>
              <strong>
                {a.is_pinned && <Pin size={13} />} {a.title}
              </strong>
              <p>{a.content}</p>
              <time>{announcementDate(a.publish_at ?? a.created_at)}</time>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
