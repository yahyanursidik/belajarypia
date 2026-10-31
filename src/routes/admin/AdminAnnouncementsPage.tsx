import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useState } from "react";
import {
  Archive,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  Inbox,
  Megaphone,
  Pin,
  Plus,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "../../components/admin/PageHeader";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog } from "../../components/ui/dialog";
import { AnnouncementEditor } from "../../components/announcements/AnnouncementEditor";
import {
  AnnouncementBadge,
  AnnouncementConfirm,
  AnnouncementMessage,
  AnnouncementPagination,
} from "../../components/announcements/AnnouncementShared";
import {
  announcementRpc,
  useAnnouncementData,
} from "../../lib/announcementData";
import {
  announcementDate,
  announcementPage,
  announcementRoles,
  announcementState,
  announcementStates,
  type Announcement,
} from "../../lib/announcementWorkspace";
export function AdminAnnouncementsPage() {
  const { pathname } = useLocation();
  const base = pathname.startsWith("/system") ? "/system" : "/admin";
  const { items, programs, classes, globalAllowed, loading, error, load } =
    useAnnouncementData("manage");
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState("");
  const [transition, setTransition] = useState<{
    item: Announcement;
    status: "draft" | "published" | "archived";
  } | null>(null);
  const program = params.get("program") ?? "all",
    role = params.get("role") ?? "all",
    status = params.get("status") ?? "all",
    source = params.get("source") ?? "all",
    q = params.get("q") ?? "",
    from = params.get("from") ?? "",
    to = params.get("to") ?? "";
  const composing =
    params.get("action") === "new" || params.get("tab") === "compose";
  const edited = items.find((a) => a.id === params.get("edit"));
  const detail = items.find((a) => a.id === params.get("detail"));
  const duplicating = params.get("action") === "duplicate";
  const editorOpen = composing || !!edited;
  const filtered = items.filter(
    (a) =>
      (program === "all" ||
        (program === "global"
          ? !a.target_program_id
          : a.target_program_id === program)) &&
      (role === "all" ||
        a.target_role === (role === "broadcast" ? "all" : role)) &&
      (status === "all" || announcementState(a) === status) &&
      (source === "all" || a.source === source) &&
      (!q ||
        `${a.title} ${a.content}`.toLowerCase().includes(q.toLowerCase())) &&
      (!from || announcementLocalDay(a.created_at) >= from) &&
      (!to || announcementLocalDay(a.created_at) <= to),
  );
  const scoped = items.filter(
    (a) =>
      program === "all" ||
      (program === "global"
        ? !a.target_program_id
        : a.target_program_id === program),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12)),
    page = Math.min(announcementPage(params.get("page")), pages);
  function update(values: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [k, v] of Object.entries(values)) {
          if (v && v !== "all") next.set(k, v);
          else next.delete(k);
        }
        if (
          Object.keys(values).some((k) =>
            ["program", "role", "status", "source", "q", "from", "to"].includes(
              k,
            ),
          )
        )
          next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  function closeEditor() {
    update({ action: null, edit: null, tab: null });
  }
  function edit(a: Announcement, copy = false) {
    update({
      detail: null,
      edit: a.id,
      action: copy ? "duplicate" : "edit",
      tab: null,
    });
  }
  const previewRole =
    detail && detail.target_role !== "all" ? detail.target_role : "participant";
  return (
    <div className="page-stack announcement-workspace">
      <PageHeader
        title="Pengumuman"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`${base}/informasi`}>
                <Inbox size={16} />
                Untuk saya
              </Link>
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void load()}
              aria-label="Muat ulang pengumuman"
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              disabled={loading || !!error}
              onClick={() =>
                update({ action: "new", edit: null, detail: null, tab: null })
              }
            >
              <Plus size={16} />
              Buat pengumuman
            </Button>
          </>
        }
      />
      {notice && (
        <div
          className="program-notice flex justify-between gap-3"
          role="status"
        >
          {notice}
          <button
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      <div className="announcement-metrics">
        {[
          { key: "live", icon: CheckCircle2 },
          { key: "draft", icon: FileText },
          { key: "scheduled", icon: CalendarClock },
          { key: "archived", icon: Archive },
        ].map((m) => (
          <button
            key={m.key}
            className={`announcement-metric announcement-tone-${announcementStates[m.key as keyof typeof announcementStates].tone}`}
            aria-pressed={status === m.key}
            onClick={() =>
              update({ status: status === m.key ? "all" : m.key, q: null })
            }
          >
            <m.icon size={20} />
            <span>
              {
                announcementStates[m.key as keyof typeof announcementStates]
                  .label
              }
            </span>
            <strong>
              {scoped.filter((a) => announcementState(a) === m.key).length}
            </strong>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
      <div className="announcement-filters">
        <Input
          aria-label="Cari pengumuman"
          placeholder="Cari judul atau isi pesan…"
          value={q}
          onChange={(e) => update({ q: e.target.value })}
        />
        <select
          aria-label="Filter program pengumuman"
          className="field-control"
          value={program}
          onChange={(e) => update({ program: e.target.value, detail: null })}
        >
          <option value="all">Semua cakupan</option>
          {globalAllowed && <option value="global">Informasi umum</option>}
          {programs.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter status pengumuman"
          className="field-control"
          value={status}
          onChange={(e) => update({ status: e.target.value })}
        >
          <option value="all">Semua status</option>
          {Object.entries(announcementStates).map(([key, meta]) => (
            <option value={key} key={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <details className="announcement-extra-filters">
          <summary>Filter lainnya</summary>
          <div>
            <label className="certificate-field">
              Peran
              <select
                aria-label="Filter peran pengumuman"
                className="field-control"
                value={role}
                onChange={(e) => update({ role: e.target.value })}
              >
                <option value="all">Semua sasaran</option>
                {Object.entries(announcementRoles).map(([key, label]) => (
                  <option value={key === "all" ? "broadcast" : key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="certificate-field">
              Sumber
              <select
                aria-label="Filter sumber pengumuman"
                className="field-control"
                value={source}
                onChange={(e) => update({ source: e.target.value })}
              >
                <option value="all">Semua sumber</option>
                <option value="manual">Ditulis admin</option>
                <option value="lesson">Materi otomatis</option>
              </select>
            </label>
            <label className="certificate-field">
              Dibuat dari
              <Input
                type="date"
                aria-label="Pengumuman dari tanggal"
                value={from}
                onChange={(e) => update({ from: e.target.value })}
              />
            </label>
            <label className="certificate-field">
              Sampai
              <Input
                type="date"
                aria-label="Pengumuman sampai tanggal"
                min={from}
                value={to}
                onChange={(e) => update({ to: e.target.value })}
              />
            </label>
          </div>
        </details>
        {(program !== "all" ||
          status !== "all" ||
          role !== "all" ||
          source !== "all" ||
          q ||
          from ||
          to) && (
          <Button
            variant="ghost"
            onClick={() =>
              update({
                program: null,
                status: null,
                role: null,
                source: null,
                q: null,
                from: null,
                to: null,
              })
            }
          >
            Reset
          </Button>
        )}
      </div>
      <div className="announcement-section-heading">
        <h2>
          Daftar pengumuman <span>{filtered.length}</span>
        </h2>
        {program !== "all" && program !== "global" && (
          <Link
            className="announcement-text-link"
            to={`${base}/program/${program}/peserta`}
          >
            Buka program <ArrowRight size={14} />
          </Link>
        )}
      </div>
      {error ? (
        <section className="announcement-empty" role="alert">
          <strong>Pengumuman belum dapat dimuat</strong>
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
          <div className="announcement-directory">
            {filtered.slice((page - 1) * 12, page * 12).map((a) => (
              <article
                key={a.id}
                className="announcement-directory-card"
                data-state={announcementState(a)}
              >
                <div className="announcement-card-icon">
                  <Megaphone size={22} />
                </div>
                <div className="announcement-card-main">
                  <div className="announcement-card-status">
                    <AnnouncementBadge item={a} />
                    {a.is_pinned && (
                      <span className="announcement-pin">
                        <Pin size={13} />
                        Disematkan
                      </span>
                    )}
                    {a.source === "lesson" && (
                      <span className="announcement-source">
                        Materi otomatis
                      </span>
                    )}
                  </div>
                  <h3>
                    <button onClick={() => update({ detail: a.id })}>
                      {a.title}
                    </button>
                  </h3>
                  <p className="announcement-excerpt">{a.content}</p>
                  <div className="announcement-audience-tags">
                    <span>
                      {announcementRoles[a.target_role] ?? a.target_role}
                    </span>
                    <span>{a.program_name ?? "Semua program"}</span>
                    {a.class_name && <span>{a.class_name}</span>}
                  </div>
                  <div className="announcement-card-meta">
                    <time>
                      {announcementState(a) === "scheduled"
                        ? "Tayang " + announcementDate(a.publish_at)
                        : "Diperbarui " + announcementDate(a.updated_at)}
                    </time>
                    <span>{a.read_count ?? 0} akun membaca revisi ini</span>
                  </div>
                </div>
                <div className="announcement-card-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => update({ detail: a.id })}
                  >
                    Lihat
                  </Button>
                  {a.source === "manual" && a.status !== "archived" && (
                    <Button variant="ghost" size="sm" onClick={() => edit(a)}>
                      <Edit3 size={14} />
                      Ubah
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => edit(a, true)}
                    aria-label={`Salin ${a.title}`}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <section className="announcement-empty">
              <Megaphone size={32} />
              <strong>Belum ada pengumuman pada filter ini</strong>
              <Button
                variant="outline"
                onClick={() =>
                  update({ action: "new", edit: null, detail: null })
                }
              >
                Buat pengumuman
              </Button>
            </section>
          )}
          <AnnouncementPagination
            page={page}
            pages={pages}
            onChange={(n) => update({ page: String(n) })}
          />
        </>
      )}
      {editorOpen && !loading && !error && (
        <AnnouncementEditor
          key={edited ? edited.id + ":" + String(duplicating) : "new"}
          item={edited}
          duplicate={duplicating}
          initialProgram={program === "global" ? "all" : program}
          programs={programs}
          classes={classes}
          globalAllowed={globalAllowed}
          onClose={closeEditor}
          onSaved={(id) => {
            closeEditor();
            update({ detail: id, action: null, edit: null, tab: null });
            setNotice("Pengumuman tersimpan.");
            void load();
          }}
        />
      )}
      {detail && !editorOpen && !error && (
        <Dialog
          title="Detail pengumuman"
          onClose={() => update({ detail: null })}
          className="announcement-reader-dialog"
        >
          <div className="announcement-detail-badges">
            <AnnouncementBadge item={detail} />
            <span className="text-xs text-muted-foreground">
              Pratinjau penerima
            </span>
          </div>
          <AnnouncementMessage item={detail} role={previewRole} preview />
          <dl className="certificate-summary my-5">
            <div>
              <dt>Riwayat baca</dt>
              <dd>
                {detail.read_count ?? 0} akun · revisi {detail.revision}
              </dd>
            </div>
            <div>
              <dt>Diperbarui</dt>
              <dd>{announcementDate(detail.updated_at)}</dd>
            </div>
            <div>
              <dt>Sumber</dt>
              <dd>
                {detail.source === "lesson"
                  ? "Publikasi materi"
                  : "Ditulis admin"}
              </dd>
            </div>
          </dl>
          {detail.target_program_id && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Button asChild variant="outline" size="sm">
                <Link
                  to={`${base}/program/${detail.target_program_id}/${detail.source === "lesson" ? "kurikulum" : "peserta"}`}
                >
                  Buka{" "}
                  {detail.source === "lesson" ? "materi sumber" : "program"}{" "}
                  <ArrowRight size={14} />
                </Link>
              </Button>
              {detail.target_class_id && (
                <Button asChild variant="outline" size="sm">
                  <Link
                    to={`${base}/program/${detail.target_program_id}/angkatan-kelas`}
                  >
                    Kelas penerima <ArrowRight size={14} />
                  </Link>
                </Button>
              )}
            </div>
          )}
          <footer className="announcement-detail-actions">
            {detail.status === "archived" ? (
              <Button
                onClick={() => setTransition({ item: detail, status: "draft" })}
              >
                Pulihkan sebagai draf
              </Button>
            ) : (
              <>
                {detail.source === "manual" && (
                  <Button variant="outline" onClick={() => edit(detail)}>
                    Ubah pesan / jadwal
                  </Button>
                )}
                {announcementState(detail) === "live" ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setTransition({ item: detail, status: "draft" })
                    }
                  >
                    Tarik ke draf
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      setTransition({ item: detail, status: "published" })
                    }
                  >
                    Tayangkan sekarang
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() =>
                    setTransition({ item: detail, status: "archived" })
                  }
                >
                  <Archive size={15} />
                  Arsipkan
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={() => edit(detail, true)}>
              <Copy size={15} />
              Salin
            </Button>
          </footer>
        </Dialog>
      )}
      {transition && (
        <AnnouncementConfirm
          title={
            transition.status === "published"
              ? "Tayangkan sekarang?"
              : transition.status === "archived"
                ? "Arsipkan pengumuman?"
                : transition.item.status === "archived"
                  ? "Pulihkan sebagai draf?"
                  : "Tarik pengumuman ke draf?"
          }
          label={
            transition.status === "published"
              ? "Tayangkan"
              : transition.status === "archived"
                ? "Arsipkan"
                : "Simpan sebagai draf"
          }
          onClose={() => setTransition(null)}
          onConfirm={async () => {
            const r = await announcementRpc<{ id: string; status: string }>(
              "admin_set_announcement_state",
              {
                p_id: transition.item.id,
                p_status: transition.status,
                p_expected_updated_at: transition.item.updated_at,
              },
            );
            if (r.id !== transition.item.id || r.status !== transition.status)
              throw new Error("Perubahan belum terkonfirmasi.");
            setNotice("Status pengumuman diperbarui.");
            await load();
          }}
        >
          <strong>{transition.item.title}</strong>
          <p className="text-sm text-muted-foreground mt-3">
            {transition.status === "published"
              ? `Sasaran: ${announcementRoles[transition.item.target_role] ?? transition.item.target_role} · ${transition.item.program_name ?? "Semua program"}${transition.item.class_name ? " · " + transition.item.class_name : ""}.`
              : transition.status === "archived"
                ? "Pengumuman berhenti tampil bagi penerima dan dapat dipulihkan sebagai draf."
                : "Pengumuman belum tampil bagi penerima sampai ditayangkan kembali."}
          </p>
        </AnnouncementConfirm>
      )}
      <p className="announcement-footnote">
        Publikasi di dalam portal. Jadwal menggunakan WIB.
      </p>
    </div>
  );
}
function announcementLocalDay(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
