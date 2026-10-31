import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileCheck,
  FileText,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import { ContentDetailPanel } from "../../components/content-review/ContentDetailPanel";
import { useContentList, useContentDetail } from "../../lib/contentReviewData";
import {
  contentFilters,
  contentId,
  contentKinds,
  contentStatuses,
  contentStatus,
  contentTime,
  type ContentDetail,
} from "../../lib/contentReviewWorkspace";
export function SystemContentReviewPage() {
  const [params, setParams] = useSearchParams();
  const filters = contentFilters(params),
    selected = contentId(params.get("lesson"));
  const { data, programs, loading, error, load } = useContentList(filters);
  const detail = useContentDetail(selected);
  const [search, setSearch] = useState(filters.q),
    [message, setMessage] = useState("");
  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(
      () =>
        setParams(
          (current) => {
            const next = new URLSearchParams(current);
            if (search.trim()) next.set("q", search.slice(0, 120));
            else next.delete("q");
            next.delete("page");
            next.delete("lesson");
            return next;
          },
          { replace: true },
        ),
      350,
    );
    return () => clearTimeout(timer);
  }, [search, filters.q, setParams]);
  function update(changes: Record<string, string | null>) {
    setMessage("");
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || (value === "all" && key !== "status"))
          next.delete(key);
        else next.set(key, value);
      }
      if (!("page" in changes)) next.delete("page");
      if (!("lesson" in changes)) next.delete("lesson");
      return next;
    });
  }
  const pages = data ? Math.max(1, Math.ceil(data.total / filters.size)) : 1;
  useEffect(() => {
    if (
      !data ||
      loading ||
      filters.page <= Math.max(1, Math.ceil(data.total / filters.size))
    )
      return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(
          "page",
          String(Math.max(1, Math.ceil(data.total / filters.size))),
        );
        return next;
      },
      { replace: true },
    );
  }, [data, loading, filters.page, filters.size, setParams]);
  const metrics = [
    { key: "draft", label: "Draf", icon: FileText, tone: "blue" },
    { key: "published", label: "Terbit", icon: CheckCircle2, tone: "green" },
    { key: "scheduled", label: "Terjadwal", icon: Clock, tone: "violet" },
    {
      key: "attention",
      label: "Perlu dilengkapi",
      icon: AlertTriangle,
      tone: "amber",
    },
  ] as const;
  function saved(next: ContentDetail) {
    detail.update(next);
    setMessage(
      "Keputusan tersimpan. Status materi dan audit sudah diperbarui.",
    );
    void load();
  }
  return (
    <div className="page-stack content-workspace">
      <header className="content-page-header">
        <div>
          <small className="content-eyebrow">
            <FileCheck size={16} />
            PENGAWASAN PEMBELAJARAN
          </small>
          <h1>Review Konten</h1>
          <p>Periksa materi, sumber, dan kesiapan terbit.</p>
        </div>
        <div>
          <Button asChild variant="outline">
            <Link
              to={
                filters.program
                  ? `/system/program/${filters.program}/kurikulum`
                  : "/system/program"
              }
            >
              <BookOpen size={16} />
              Materi & ujian
              <ArrowUpRight size={15} />
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void load();
              if (selected) void detail.load();
            }}
            disabled={loading}
            aria-label="Muat ulang review konten"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </header>
      <div className="content-metrics" aria-label="Ringkasan konten">
        {metrics.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={`content-metric content-tone-${item.tone}`}
              aria-label={`${item.label}: ${data?.counts[item.key] ?? "belum tersedia"}`}
              aria-pressed={
                item.key === "attention"
                  ? filters.attention
                  : filters.status === item.key && !filters.attention
              }
              onClick={() =>
                update(
                  item.key === "attention"
                    ? {
                        attention: filters.attention ? null : "true",
                        status: "all",
                      }
                    : { status: item.key, attention: null },
                )
              }
            >
              <Icon size={21} />
              <span>
                {item.label}
                <strong>
                  {data?.counts[item.key]?.toLocaleString("id-ID") ?? "—"}
                </strong>
              </span>
              <ArrowUpRight size={16} />
            </button>
          );
        })}
      </div>
      <section className="content-toolbar" aria-label="Filter materi">
        <label>
          Program
          <select
            className="field-control"
            value={filters.program ?? "all"}
            onChange={(e) =>
              update({
                program: e.target.value === "all" ? null : e.target.value,
              })
            }
          >
            <option value="all">Semua program</option>
            {filters.program &&
              !programs.some((p) => p.id === filters.program) && (
                <option value={filters.program}>Program terpilih</option>
              )}
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status === "archived" ? " · Arsip" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jenis
          <select
            className="field-control"
            value={filters.kind}
            onChange={(e) => update({ kind: e.target.value })}
          >
            {Object.entries(contentKinds).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="content-search">
          <span>Cari materi</span>
          <div>
            <Search size={16} />
            <Input
              aria-label="Cari materi"
              placeholder="Judul, kode, program, atau modul…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={120}
            />
          </div>
        </label>
      </section>
      <div className="content-filter-row">
        <nav aria-label="Status materi">
          {Object.entries(contentStatuses).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={filters.status === key}
              onClick={() => update({ status: key })}
            >
              {label}
              {data && (
                <span>{data.counts[key as keyof typeof contentStatuses]}</span>
              )}
            </button>
          ))}
        </nav>
        {(filters.program ||
          filters.kind !== "all" ||
          filters.q ||
          filters.attention ||
          filters.status !== "draft") && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setParams({});
              setMessage("");
            }}
          >
            Reset filter
          </Button>
        )}
      </div>
      {filters.attention && (
        <div className="content-active-filter">
          Menampilkan materi yang perlu dilengkapi
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update({ attention: null })}
          >
            Hapus filter
          </Button>
        </div>
      )}
      {error && (
        <Alert>
          <AlertTitle>
            {data ? "Data terakhir dipertahankan" : "Konten belum dapat dimuat"}
          </AlertTitle>
          <AlertDescription>
            {error}{" "}
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {message && (
        <p className="content-success" role="status">
          {message}
        </p>
      )}
      <div className="content-result-info">
        <span>
          {data ? `${data.total.toLocaleString("id-ID")} materi` : "— materi"}
          {loading ? " · Memuat…" : ""}
        </span>
        <small>
          {data ? `Data ${contentTime(data.generated_at)}` : "Menunggu data"}
        </small>
      </div>
      <div
        className={`content-review-layout ${selected ? "content-has-selection" : ""}`}
      >
        <section
          className="content-list"
          aria-label="Daftar materi"
          aria-busy={loading}
        >
          {!data ? (
            loading ? (
              <p role="status" className="content-empty">
                Memuat daftar materi…
              </p>
            ) : (
              <p className="content-empty">
                Coba muat ulang untuk menampilkan materi.
              </p>
            )
          ) : (
            <>
              <div className="content-list-items">
                {data.rows.map((row) => {
                  const state = contentStatus(row);
                  return (
                    <button
                      key={row.id}
                      className="content-lesson-row"
                      aria-label={`Tinjau ${row.title} · ${row.code} · ${row.program_name} · ${contentStatuses[state]}`}
                      aria-pressed={row.id === selected}
                      onClick={() =>
                        update({ lesson: row.id, page: String(filters.page) })
                      }
                    >
                      <span className="content-row-top">
                        <small>
                          {contentKinds[
                            row.lesson_type as keyof typeof contentKinds
                          ] ?? "Materi"}{" "}
                          · {row.code}
                        </small>
                        <span
                          className={`content-status content-status-${state}`}
                        >
                          {contentStatuses[state]}
                        </span>
                      </span>
                      <strong>{row.title}</strong>
                      <span className="content-row-context">
                        {row.program_name}
                      </span>
                      <small>{row.module_title}</small>
                      <span className="content-row-bottom">
                        <span data-ready={row.checks.ready}>
                          {row.checks.ready ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <AlertTriangle size={13} />
                          )}{" "}
                          {row.checks.ready
                            ? "Data lengkap"
                            : `${row.checks.issues.length} perbaikan`}
                        </span>
                        <small>
                          {new Date(row.updated_at).toLocaleDateString(
                            "id-ID",
                            {
                              timeZone: "Asia/Jakarta",
                              day: "numeric",
                              month: "short",
                            },
                          )}
                        </small>
                      </span>
                    </button>
                  );
                })}
                {!data.rows.length && (
                  <div className="content-empty">
                    <FileCheck size={31} />
                    <h3>Tidak ada materi pada filter ini</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setParams({ status: "all" });
                      }}
                    >
                      Lihat semua materi
                    </Button>
                  </div>
                )}
              </div>
              <footer className="content-pagination">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading || filters.page <= 1}
                  onClick={() => update({ page: String(filters.page - 1) })}
                >
                  Sebelumnya
                </Button>
                <span>
                  {filters.page}/{pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading || filters.page >= pages}
                  onClick={() => update({ page: String(filters.page + 1) })}
                >
                  Berikutnya
                </Button>
              </footer>
              <label className="content-page-size">
                Baris per halaman
                <select
                  value={filters.size}
                  onChange={(e) => update({ size: e.target.value })}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </label>
            </>
          )}
        </section>
        <div className="content-detail-container">
          {selected ? (
            detail.data ? (
              <ContentDetailPanel
                key={selected}
                data={detail.data}
                params={params}
                onClose={() =>
                  update({ lesson: null, page: String(filters.page) })
                }
                onReload={() => void detail.load()}
                onSaved={saved}
              />
            ) : (
              <section
                className="content-detail content-empty"
                aria-busy={detail.loading}
              >
                {detail.error ? (
                  <>
                    <h3>Materi belum dapat dibuka</h3>
                    <p role="alert">{detail.error}</p>
                    <Button onClick={() => void detail.load()}>
                      Coba lagi
                    </Button>
                  </>
                ) : (
                  <p role="status">Memuat detail materi…</p>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    update({ lesson: null, page: String(filters.page) })
                  }
                >
                  Kembali ke daftar
                </Button>
              </section>
            )
          ) : (
            <section className="content-detail content-empty content-no-selection">
              <FileCheck size={40} />
              <h2>Pilih materi untuk diperiksa</h2>
              <p>Isi & sumber → Pemeriksaan → Keputusan</p>
              <div>
                <span>1. Periksa isi</span>
                <span>2. Cek kelengkapan</span>
                <span>3. Tinjau status</span>
              </div>
              {data?.rows[0] && (
                <Button
                  onClick={() =>
                    update({
                      lesson: data.rows[0].id,
                      page: String(filters.page),
                    })
                  }
                >
                  Mulai dari materi pertama
                </Button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
