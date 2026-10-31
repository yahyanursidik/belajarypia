import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Activity,
  Users,
  KeyRound,
  Trash2,
  Download,
  RefreshCw,
  Search,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import {
  AuditDetailDialog,
  AuditActivityBadge,
} from "../../components/audit/AuditDetailDialog";
import { AuditExploreDialog } from "../../components/audit/AuditExploreDialog";
import {
  auditFilters,
  auditId,
  auditCategories,
  auditEntityLabel,
  auditActionLabel,
  auditTime,
  auditActor,
  auditPeriod,
  auditCsv,
  auditError,
  type AuditList,
} from "../../lib/auditWorkspace";
import { useAuditList } from "../../lib/auditData";
import { supabase } from "../../lib/supabase";
export function SystemAuditPage() {
  const [params, setParams] = useSearchParams(),
    filters = auditFilters(params),
    selected = auditId(params.get("event")),
    invalidDates = !!(filters.from && filters.to && filters.from > filters.to),
    { data, options, loading, error, load } = useAuditList(
      filters,
      !invalidDates,
    );
  const [search, setSearch] = useState(filters.q),
    [exploring, setExploring] = useState(false),
    [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState("");
  const exportingController = useRef<AbortController | null>(null),
    key = JSON.stringify(filters);
  const visibleError = invalidDates
    ? "Tanggal akhir harus setelah atau sama dengan tanggal awal."
    : error;
  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => {
    if (search.trim() === filters.q) return;
    const t = setTimeout(() => {
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (search.trim()) n.set("q", search.trim().slice(0, 200));
          else n.delete("q");
          n.delete("page");
          n.delete("event");
          return n;
        },
        { replace: true },
      );
    }, 350);
    return () => clearTimeout(t);
  }, [search, filters.q, setParams]);
  useEffect(() => {
    exportingController.current?.abort();
    setExporting(false);
    setExportError("");
    return () => exportingController.current?.abort();
  }, [key]);
  useEffect(() => {
    if (data && !loading && data.page !== filters.page)
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          n.set("page", String(data.page));
          return n;
        },
        { replace: true },
      );
  }, [data, loading, filters.page, setParams]);
  function update(patch: Record<string, string | null>) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      for (const [k, v] of Object.entries(patch))
        if (!v || v === "all") n.delete(k);
        else n.set(k, v);
      if (!("page" in patch) && !("event" in patch)) n.delete("page");
      if (!("event" in patch)) n.delete("event");
      return n;
    });
  }
  async function exportCsv() {
    const c = new AbortController();
    exportingController.current?.abort();
    exportingController.current = c;
    setExporting(true);
    setExportError("");
    try {
      const r = await supabase
        .rpc("system_audit_list", { p_filters: { ...filters, export: true } })
        .abortSignal(c.signal);
      if (r.error) throw r.error;
      const value = r.data as AuditList;
      if (!Array.isArray(value?.rows) || value.rows.length !== value.total)
        throw new Error(
          "Hasil ekspor belum lengkap. Persempit filter dan coba lagi.",
        );
      if (c.signal.aborted) return;
      const url = URL.createObjectURL(
          new Blob([auditCsv(value.rows)], { type: "text/csv;charset=utf-8;" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "audit-" + new Date().toISOString().slice(0, 10) + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!c.signal.aborted) setExportError(auditError(e));
    } finally {
      if (!c.signal.aborted) setExporting(false);
    }
  }
  const active =
    filters.q ||
    filters.category !== "all" ||
    filters.entity !== "all" ||
    filters.action !== "all" ||
    filters.actor ||
    filters.target ||
    filters.from ||
    filters.to;
  const pages = data ? Math.max(1, Math.ceil(data.total / filters.size)) : 1;
  const actions = [
      ...new Set([
        ...options.actions,
        ...(filters.action !== "all" ? [filters.action] : []),
      ]),
    ],
    entities = [
      ...new Set([
        ...options.entities,
        ...(filters.entity !== "all" ? [filters.entity] : []),
      ]),
    ];
  return (
    <div className="audit-workspace">
      <header className="audit-header">
        <div>
          <span className="audit-eyebrow">
            <Activity size={15} />
            JEJAK AKTIVITAS
          </span>
          <h1>Audit Sistem</h1>
          <p>Telusuri perubahan dan buka data terkait.</p>
        </div>
        <div className="audit-toolbar">
          <Button variant="outline" onClick={() => setExploring(true)}>
            <SlidersHorizontal size={16} />
            Telusuri
          </Button>
          <Button
            variant="outline"
            onClick={() => void exportCsv()}
            disabled={!data?.total || loading || exporting || invalidDates}
          >
            <Download size={16} />
            {exporting ? "Menyiapkan…" : "Ekspor CSV"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading || invalidDates}
            aria-label="Muat ulang audit"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </header>
      <div className="audit-metrics" aria-label="Ringkasan hasil filter">
        {[
          {
            label: "Hasil filter",
            value: data?.total,
            Icon: Activity,
            tone: "blue",
          },
          {
            label: "Pelaku tercatat",
            value: data?.stats.actors,
            Icon: Users,
            tone: "violet",
          },
          {
            label: "Akses & peran",
            value: data?.stats.access,
            Icon: KeyRound,
            tone: "amber",
          },
          {
            label: "Penghapusan",
            value: data?.stats.deletions,
            Icon: Trash2,
            tone: "rose",
          },
        ].map(({ label, value, Icon, tone }) => (
          <div className={"audit-metric audit-tone-" + tone} key={label}>
            <Icon size={22} />
            <div>
              <span>{label}</span>
              <strong>{invalidDates ? "—" : (value ?? "—")}</strong>
            </div>
          </div>
        ))}
      </div>
      <section className="audit-filter-panel" aria-label="Filter audit">
        <div
          className="audit-category-tabs"
          role="group"
          aria-label="Jenis aktivitas"
        >
          {Object.entries(auditCategories).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filters.category === value ? "default" : "ghost"}
              aria-pressed={filters.category === value}
              onClick={() => update({ category: value })}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="audit-filters">
          <label className="audit-search">
            Cari aktivitas
            <div>
              <Search size={16} />
              <Input
                aria-label="Cari aktivitas"
                placeholder="Pelaku, aktivitas, atau ID…"
                value={search}
                maxLength={200}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>
          <label>
            Objek
            <select
              aria-label="Objek audit"
              value={filters.entity}
              onChange={(e) => update({ entity: e.target.value })}
            >
              <option value="all">Semua objek</option>
              {entities.map((v) => (
                <option key={v} value={v}>
                  {auditEntityLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Aktivitas
            <select
              aria-label="Kode aktivitas"
              value={filters.action}
              onChange={(e) => update({ action: e.target.value })}
            >
              <option value="all">Semua aktivitas</option>
              {actions.map((v) => (
                <option key={v} value={v}>
                  {auditActionLabel(v)}
                  {actions.some(
                    (other) =>
                      other !== v &&
                      auditActionLabel(other) === auditActionLabel(v),
                  )
                    ? ` · ${v}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dari (WIB)
            <Input
              aria-label="Tanggal awal"
              type="date"
              value={filters.from}
              onChange={(e) => update({ from: e.target.value })}
            />
          </label>
          <label>
            Sampai (WIB)
            <Input
              aria-label="Tanggal akhir"
              type="date"
              value={filters.to}
              onChange={(e) => update({ to: e.target.value })}
            />
          </label>
        </div>
        <div className="audit-filter-footer">
          <div className="audit-periods">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => update(auditPeriod(7))}
            >
              7 hari
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => update(auditPeriod(30))}
            >
              30 hari
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => update({ from: null, to: null })}
            >
              Seluruh waktu
            </Button>
          </div>
          <div className="audit-active-filters">
            {filters.actor && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => update({ actor: null })}
                aria-label="Hapus filter pelaku"
              >
                Pelaku tertentu
                <X size={13} />
              </Button>
            )}
            {filters.target && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => update({ target: null })}
                aria-label="Hapus filter objek tertentu"
              >
                Objek tertentu
                <X size={13} />
              </Button>
            )}
            {active && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setParams({});
                }}
              >
                Reset filter
              </Button>
            )}
          </div>
        </div>
      </section>
      {(visibleError || exportError) && (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTitle>
            {exportError ? "Ekspor belum berhasil" : "Audit belum dapat dimuat"}
          </AlertTitle>
          <AlertDescription>
            {exportError || visibleError}
            {!invalidDates && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setExportError("");
                  void load();
                }}
              >
                Coba lagi
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      <section className="audit-directory" aria-label="Riwayat aktivitas">
        <div className="audit-directory-heading">
          <div>
            <h2>Riwayat aktivitas</h2>
            <span>
              {data && !invalidDates ? data.total + " hasil" : "Menunggu data"}
              {loading ? " · Memuat…" : ""}
            </span>
          </div>
          {data && !invalidDates && (
            <span className="audit-muted">
              {error ? "Snapshot " : "Data "}
              {auditTime(data.generated_at)}
            </span>
          )}
        </div>
        <div className="audit-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktivitas</th>
                <th>Pelaku</th>
                <th>Objek</th>
                <th>
                  <span className="sr-only">Detail</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invalidDates ? (
                <tr>
                  <td colSpan={5} className="audit-state">
                    Perbaiki rentang tanggal untuk menampilkan aktivitas.
                  </td>
                </tr>
              ) : !data ? (
                <tr>
                  <td colSpan={5} className="audit-state">
                    {loading ? (
                      <span role="status">Memuat aktivitas…</span>
                    ) : error ? (
                      "Data belum tersedia. Coba muat ulang."
                    ) : (
                      "Belum ada data."
                    )}
                  </td>
                </tr>
              ) : !data.rows.length ? (
                <tr>
                  <td colSpan={5} className="audit-state">
                    <Activity size={30} />
                    <strong>
                      {active
                        ? "Tidak ada aktivitas yang sesuai"
                        : "Belum ada catatan audit"}
                    </strong>
                    {active && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearch("");
                          setParams({});
                        }}
                      >
                        Reset filter
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Waktu">
                      <time dateTime={r.created_at}>
                        {auditTime(r.created_at)}
                      </time>
                    </td>
                    <td data-label="Aktivitas">
                      <AuditActivityBadge row={r} />
                    </td>
                    <td data-label="Pelaku">
                      <strong>{auditActor(r)}</strong>
                      {r.actor_name && r.actor_email && (
                        <small>{r.actor_email}</small>
                      )}
                    </td>
                    <td data-label="Objek">
                      <span>{auditEntityLabel(r.entity_type)}</span>
                      {r.entity_id && (
                        <small title={r.entity_id}>
                          {r.entity_id.slice(0, 8)}…
                        </small>
                      )}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => update({ event: r.id })}
                        aria-label={
                          "Detail aktivitas " +
                          auditActionLabel(r.action) +
                          " " +
                          auditTime(r.created_at)
                        }
                      >
                        Detail
                        <ArrowUpRight size={13} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="audit-pagination">
          <label>
            Baris
            <select
              aria-label="Baris audit"
              value={filters.size}
              onChange={(e) => update({ size: e.target.value })}
            >
              {[25, 50, 100].map((n) => (
                <option value={n} key={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span>
            {data && !invalidDates
              ? (data.total
                  ? (data.page - 1) * filters.size +
                    1 +
                    "–" +
                    Math.min(data.page * filters.size, data.total)
                  : "0") +
                " dari " +
                data.total
              : "— hasil"}
          </span>
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={!data || loading || invalidDates || data.page <= 1}
              onClick={() => update({ page: String(filters.page - 1) })}
            >
              <ChevronLeft size={14} />
              Sebelumnya
            </Button>
            <span>
              {data?.page ?? 1}/{pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={!data || loading || invalidDates || data.page >= pages}
              onClick={() => update({ page: String(filters.page + 1) })}
            >
              Berikutnya
              <ChevronRight size={14} />
            </Button>
          </div>
        </footer>
      </section>
      <p className="audit-footnote">
        Hanya aktivitas yang dicatat aplikasi.{" "}
        <Link to="/system/pengguna">
          Kelola akses pengguna
          <ArrowUpRight size={13} />
        </Link>
      </p>
      {selected && (
        <AuditDetailDialog
          id={selected}
          onClose={() => update({ event: null })}
          onFilter={(f) => {
            setSearch("");
            setParams(
              new URLSearchParams(
                Object.entries(f).filter((v): v is [string, string] => !!v[1]),
              ),
            );
          }}
        />
      )}
      {exploring && (
        <AuditExploreDialog
          entities={entities}
          onClose={() => setExploring(false)}
          onApply={(f) => {
            setSearch("");
            setParams(
              new URLSearchParams(
                Object.entries(f).filter(([, v]) => v && v !== "all"),
              ),
            );
            setExploring(false);
          }}
        />
      )}
    </div>
  );
}
