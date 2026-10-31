import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Papa from "papaparse";
import {
  Archive,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit2,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { PageHeader } from "../../components/admin/PageHeader";
import { ProgramFormDialog } from "../../components/programs/ProgramFormDialog";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { EmptyState } from "../../components/ui/empty-state";
import type { Program } from "../../lib/organization";
import {
  programModelLabel,
  programSectionPath,
  programStatusLabels,
  validProgramPage,
  type ProgramSection,
} from "../../lib/programWorkspace";
import { supabase } from "../../lib/supabase";

type ProgramRow = Program & {
  created_at: string;
  enrollments: { count: number }[];
  active_enrollments: { count: number }[];
  program_modules: { count: number }[];
};
const countOf = (rows?: { count: number }[]) => rows?.[0]?.count ?? 0;
export function AdminProgramListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const basePath = location.pathname.startsWith("/system")
    ? "/system"
    : "/admin";
  const q = params.get("q") ?? "";
  const model = params.get("model") || "all";
  const unit = params.get("unit") || "all";
  const status = ["active", "draft", "archived"].includes(
    params.get("status") ?? "",
  )
    ? params.get("status")!
    : "all";
  const attention = params.get("attention") === "empty-curriculum";
  const sort = params.get("sort") || "name";
  const view = params.get("view") === "table" ? "table" : "grid";
  const pageSize = [12, 24, 48].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 12;
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Program | true | null>(null);
  const [archive, setArchive] = useState<Program | null>(null);
  const [busy, setBusy] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  function patch(values: Record<string, string | null>, resetPage = true) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(values)) {
          if (!value || value === "all") next.delete(key);
          else next.set(key, value);
        }
        if (resetPage) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  const loadData = useCallback(async (silent = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const loaded: ProgramRow[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error, count } = await supabase
          .from("programs")
          .select(
            "*,units(code,name),enrollments(count),active_enrollments:enrollments(count),program_modules(count)",
            { count: "exact" },
          )
          .eq("active_enrollments.enrollment_status", "active")
          .order("name")
          .order("id")
          .range(offset, offset + 499)
          .abortSignal(controller.signal);
        if (controller.signal.aborted) return;
        if (error) throw error;
        loaded.push(...((data ?? []) as unknown as ProgramRow[]));
        if (
          !data?.length ||
          (count !== null && loaded.length >= count) ||
          data.length < 500
        )
          break;
      }
      setPrograms(loaded);
    } catch {
      if (!controller.signal.aborted)
        setError("Daftar program belum dapat dimuat. Coba lagi.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  useEffect(() => {
    void loadData();
    return () => requestRef.current?.abort();
  }, [loadData]);
  const units = [
    ...new Map(
      programs.map((program) => [
        program.unit_id,
        program.units?.name ?? "Unit program",
      ]),
    ).entries(),
  ];
  const needsCurriculum = (program: ProgramRow) =>
    program.status !== "archived" && countOf(program.program_modules) === 0;
  const filtered = programs
    .filter(
      (program) =>
        (!q ||
          [program.name, program.code, program.description]
            .join(" ")
            .toLowerCase()
            .includes(q.trim().toLowerCase())) &&
        (status === "all" || program.status === status) &&
        (model === "all" || program.curriculum_model === model) &&
        (unit === "all" || program.unit_id === unit) &&
        (!attention || needsCurriculum(program)),
    )
    .sort((a, b) =>
      sort === "newest"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : sort === "participants"
          ? countOf(b.active_enrollments) - countOf(a.active_enrollments)
          : a.name.localeCompare(b.name, "id"),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(validProgramPage(params.get("page")), pages);
  const current = filtered.slice((page - 1) * pageSize, page * pageSize);
  const returnTo = location.pathname + location.search;
  const path = (id: string, section: ProgramSection = "detail-program") =>
    programSectionPath(basePath, id, section, returnTo);
  const metrics = [
    {
      title: "Semua program",
      icon: BookOpen,
      tone: "blue",
      value: programs.length,
      filter: { status: null, attention: null },
    },
    {
      title: "Program aktif",
      icon: CheckCircle2,
      tone: "emerald",
      value: programs.filter((p) => p.status === "active").length,
      filter: { status: "active", attention: null },
    },
    {
      title: "Draf",
      icon: ClipboardList,
      tone: "amber",
      value: programs.filter((p) => p.status === "draft").length,
      filter: { status: "draft", attention: null },
    },
    {
      title: "Perlu kurikulum",
      icon: Edit2,
      tone: "violet",
      value: programs.filter(needsCurriculum).length,
      filter: { status: null, attention: "empty-curriculum" },
    },
  ];
  function exportCsv() {
    const rows = [
      [
        "Kode",
        "Program",
        "Unit",
        "Model",
        "Status",
        "Enrollment aktif",
        "Total enrollment",
        "Mata pelajaran",
      ],
      ...filtered.map((p) => [
        p.code,
        p.name,
        p.units?.name ?? "",
        programModelLabel(p.curriculum_model),
        programStatusLabels[p.status],
        countOf(p.active_enrollments),
        countOf(p.enrollments),
        countOf(p.program_modules),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + Papa.unparse(rows, { escapeFormulae: true })], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "program-ypia.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  async function archiveProgram() {
    if (!archive || busy) return;
    setBusy(true);
    setArchiveError("");
    try {
      const { data, error } = await supabase
        .from("programs")
        .update({
          status: archive.status === "archived" ? "draft" : "archived",
        })
        .eq("id", archive.id)
        .select("id")
        .single();
      if (error) throw error;
      if (!data?.id) throw new Error("Server belum mengonfirmasi perubahan.");
      setNotice(
        archive.status === "archived"
          ? "Program dipulihkan ke draf."
          : "Program diarsipkan.",
      );
      setArchive(null);
      await loadData(true);
    } catch (error) {
      setArchiveError(
        (error as { message?: string })?.message ??
          "Status program belum berubah.",
      );
    } finally {
      setBusy(false);
    }
  }
  function actions(program: ProgramRow) {
    return (
      <div className="program-row-actions">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Pengaturan ${program.name}`}
          onClick={() => setForm(program)}
        >
          <Edit2 size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${program.status === "archived" ? "Pulihkan" : "Arsipkan"} ${program.name}`}
          onClick={() => {
            setArchiveError("");
            setArchive(program);
          }}
        >
          <Archive size={16} />
        </Button>
        <Button asChild size="sm">
          <Link to={path(program.id)}>
            Kelola <ArrowRight size={14} />
          </Link>
        </Button>
      </div>
    );
  }
  function quickLinks(program: ProgramRow) {
    return (
      <div className="program-quick-links">
        <Link to={path(program.id, "kurikulum")}>Materi & ujian</Link>
        <Link to={path(program.id, "peserta")}>Peserta</Link>
        <Link to={path(program.id, "report")}>Laporan</Link>
      </div>
    );
  }
  return (
    <div className="page-stack program-directory-workspace">
      <PageHeader
        title="Program"
        actions={
          <>
            <Button
              variant="outline"
              disabled={refreshing}
              aria-label="Muat ulang program"
              onClick={() => void loadData(true)}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
            </Button>
            <Button
              variant="outline"
              disabled={loading || Boolean(error) || !filtered.length}
              onClick={exportCsv}
            >
              <Download size={16} />
              Ekspor hasil
            </Button>
            <Button onClick={() => setForm(true)}>
              <Plus size={16} />
              Buat program
            </Button>
          </>
        }
      />
      <div className="program-metrics" aria-label="Ringkasan seluruh program">
        {metrics.map(({ title, icon: Icon, tone, value, filter }) => (
          <button
            key={title}
            className={`admin-stat admin-tone-${tone}`}
            onClick={() =>
              patch({ ...filter, q: null, model: null, unit: null })
            }
          >
            <span className="admin-stat__icon">
              <Icon size={19} />
            </span>
            <span>
              <span className="admin-stat__label">{title}</span>
              <strong>{loading || error ? "—" : value}</strong>
            </span>
            <ArrowRight size={15} />
          </button>
        ))}
      </div>
      {notice && (
        <div className="program-result" role="status">
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Tutup pemberitahuan"
          >
            ×
          </button>
        </div>
      )}
      <section
        className="program-directory-toolbar"
        aria-label="Filter program"
      >
        <label className="program-search">
          <Search size={17} />
          <Input
            aria-label="Cari program"
            placeholder="Cari nama atau kode program…"
            value={q}
            onChange={(event) => patch({ q: event.target.value })}
          />
        </label>
        <select
          aria-label="Status program"
          value={status}
          onChange={(event) => patch({ status: event.target.value })}
        >
          <option value="all">Semua status</option>
          {Object.entries(programStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Model belajar"
          value={model}
          onChange={(event) => patch({ model: event.target.value })}
        >
          <option value="all">Semua model</option>
          <option value="mandiri">Mandiri</option>
          <option value="angkatan">Terjadwal</option>
        </select>
        {units.length > 1 && (
          <select
            aria-label="Unit program"
            value={unit}
            onChange={(event) => patch({ unit: event.target.value })}
          >
            <option value="all">Semua unit</option>
            {units.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Urutan program"
          value={sort}
          onChange={(event) => patch({ sort: event.target.value })}
        >
          <option value="name">Nama A–Z</option>
          <option value="newest">Terbaru</option>
          <option value="participants">Enrollment aktif terbanyak</option>
        </select>
        <div className="program-view-switch" aria-label="Tampilan program">
          {(
            [
              ["grid", LayoutGrid, "Kartu"],
              ["table", List, "Tabel"],
            ] as const
          ).map(([value, Icon, label]) => (
            <Button
              key={value}
              size="icon"
              variant={view === value ? "secondary" : "ghost"}
              aria-label={`Tampilan ${label.toLowerCase()}`}
              aria-pressed={view === value}
              onClick={() => patch({ view: value }, false)}
            >
              <Icon size={17} />
            </Button>
          ))}
        </div>
        {(q ||
          status !== "all" ||
          model !== "all" ||
          unit !== "all" ||
          attention) && (
          <Button
            variant="ghost"
            onClick={() =>
              patch({
                q: null,
                status: null,
                model: null,
                unit: null,
                attention: null,
              })
            }
          >
            Hapus filter{attention ? " · perlu kurikulum" : ""}
          </Button>
        )}
      </section>
      {loading ? (
        <p className="program-loading" role="status">
          Memuat program…
        </p>
      ) : error ? (
        <div className="program-loading">
          <p className="program-error" role="alert">
            {error}
          </p>
          <Button variant="outline" onClick={() => void loadData()}>
            Coba lagi
          </Button>
        </div>
      ) : !current.length ? (
        <EmptyState
          title="Program tidak ditemukan"
          description="Sesuaikan filter atau buat program baru."
        />
      ) : view === "grid" ? (
        <div className="program-card-grid">
          {current.map((program) => (
            <article
              key={program.id}
              className={`program-card program-card--${program.status}`}
            >
              <div className="program-card__meta">
                <span>{program.code}</span>
                <span
                  className={`program-status program-status--${program.status}`}
                >
                  {programStatusLabels[program.status]}
                </span>
              </div>
              <h2>
                <Link to={path(program.id)}>{program.name}</Link>
              </h2>
              <p className="program-card__unit">
                {program.units?.name} ·{" "}
                {programModelLabel(program.curriculum_model)}
              </p>
              {program.description && (
                <p className="program-card__description">
                  {program.description}
                </p>
              )}
              <div className="program-card__counts">
                <Link to={path(program.id, "peserta")}>
                  <strong>{countOf(program.active_enrollments)}</strong>{" "}
                  enrollment aktif
                </Link>
                <Link to={path(program.id, "kurikulum")}>
                  <strong>{countOf(program.program_modules)}</strong> mata
                  pelajaran
                </Link>
              </div>
              {needsCurriculum(program) && (
                <Link
                  className="program-card__followup"
                  to={path(program.id, "kurikulum")}
                >
                  Susun kurikulum <ArrowRight size={14} />
                </Link>
              )}
              {quickLinks(program)}
              <footer>{actions(program)}</footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="program-directory-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Model & unit</th>
                <th>Enrollment aktif</th>
                <th>Status</th>
                <th>Akses cepat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {current.map((program) => (
                <tr key={program.id}>
                  <td data-label="Program">
                    <Link className="font-semibold" to={path(program.id)}>
                      {program.name}
                    </Link>
                    <small>{program.code}</small>
                  </td>
                  <td data-label="Model & unit">
                    {programModelLabel(program.curriculum_model)}
                    <small>{program.units?.name}</small>
                  </td>
                  <td data-label="Enrollment aktif">
                    {countOf(program.active_enrollments)}
                  </td>
                  <td data-label="Status">
                    <span
                      className={`program-status program-status--${program.status}`}
                    >
                      {programStatusLabels[program.status]}
                    </span>
                  </td>
                  <td data-label="Akses cepat">{quickLinks(program)}</td>
                  <td data-label="Aksi">{actions(program)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && (
        <footer className="program-pagination">
          <span>
            {filtered.length
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}`
              : "0"}{" "}
            dari {filtered.length} program
          </span>
          <div>
            <select
              aria-label="Program per halaman"
              value={pageSize}
              onChange={(event) => patch({ size: event.target.value })}
            >
              {[12, 24, 48].map((size) => (
                <option key={size} value={size}>
                  {size} / halaman
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => patch({ page: String(page - 1) }, false)}
            >
              Sebelumnya
            </Button>
            <span>
              {page} / {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page === pages}
              onClick={() => patch({ page: String(page + 1) }, false)}
            >
              Selanjutnya
            </Button>
          </div>
        </footer>
      )}
      {form && (
        <ProgramFormDialog
          program={form === true ? null : form}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            const created = form === true;
            setForm(null);
            if (created) navigate(path(saved.id));
            else {
              setNotice("Pengaturan program tersimpan.");
              void loadData(true);
            }
          }}
        />
      )}
      {archive && (
        <Dialog
          title={
            archive.status === "archived"
              ? "Pulihkan program ke draf?"
              : "Arsipkan program?"
          }
          busy={busy}
          onClose={() => setArchive(null)}
        >
          <p className="text-sm">{archive.name}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {archive.status === "archived"
              ? "Program dapat disiapkan kembali sebelum diaktifkan."
              : "Program berhenti tersedia untuk belajar. Data peserta dan materi tetap tersimpan."}
          </p>
          {archiveError && (
            <p className="program-error" role="alert">
              {archiveError}
            </p>
          )}
          <div className="wizard-footer">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setArchive(null)}
            >
              Batal
            </Button>
            <Button disabled={busy} onClick={() => void archiveProgram()}>
              {busy
                ? "Menyimpan…"
                : archive.status === "archived"
                  ? "Pulihkan ke draf"
                  : "Arsipkan"}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
