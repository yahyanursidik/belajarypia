import { inWibDateRange, validDateKey } from "../../lib/dateRange";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Download,
  FileCog,
  LayoutDashboard,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  Clock3,
} from "lucide-react";
import { PageHeader } from "../../components/admin/PageHeader";
import { SectionNav } from "../../components/admin/SectionNav";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  applicantStatusLabels,
  formatRegistrationDateTime,
  selectRegistrationForm,
} from "../../lib/admission";
import {
  admissionPage,
  admissionStatusTone,
  admissionWindowLabels,
  applicationStatus,
  filterApplications,
  latestProgramForms,
  programAdmissionState,
  summarizeApplications,
  type AdmissionForm,
  type AdmissionProgram,
  type ApplicationRow,
} from "../../lib/admissionWorkspace";
import { loadAdmissionWorkspace } from "../../lib/admissionData";
import { AdmissionReviewDialog } from "../../components/admission/AdmissionReviewDialog";
import { ProgramAdmissionBuilder } from "./ProgramAdmissionBuilder";
const sections = [
  { key: "overview", label: "Ringkasan", icon: LayoutDashboard },
  { key: "review", label: "Antrean pendaftar", icon: ClipboardList },
  { key: "settings", label: "Formulir & undangan", icon: FileCog },
];
export function AdminApplicantListPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const base = location.pathname.startsWith("/system") ? "/system" : "/admin";
  const [data, setData] = useState<{
    programs: AdmissionProgram[];
    forms: AdmissionForm[];
    applications: ApplicationRow[];
  }>({ programs: [], forms: [], applications: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async (silent = false) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setError("");
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await loadAdmissionWorkspace(request.signal);
      if (!request.signal.aborted) setData(next);
    } catch {
      if (!request.signal.aborted)
        setError("Pendaftaran belum dapat dimuat. Coba lagi.");
    } finally {
      if (!request.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);
  const tab = sections.some((item) => item.key === params.get("tab"))
    ? params.get("tab")!
    : "review";
  const program = params.get("program") || "all";
  const status = params.get("status") || "all";
  const query = params.get("q") || "";
  const from = validDateKey(params.get("from") ?? "") ? params.get("from")! : "";
  const to = validDateKey(params.get("to") ?? "") ? params.get("to")! : "";
  const page = admissionPage(params.get("page"));
  const size = [10, 25, 50].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 10;
  function update(values: Record<string, string | null>, reset = true) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(values)) {
          if (!value || value === "all") next.delete(key);
          else next.set(key, value);
        }
        if (reset) {
          next.delete("page");
          next.delete("choice");
        }
        return next;
      },
      { replace: true },
    );
  }
  const scoped = useMemo(
    () =>
      data.applications.filter(
        (row) => program === "all" || row.program_id === program,
      ),
    [data.applications, program],
  );
  const stats = useMemo(() => summarizeApplications(scoped), [scoped]);
  const formMap = useMemo(() => latestProgramForms(data.forms), [data.forms]);
  const scopedPrograms = data.programs.filter(
    (row) => program === "all" || row.id === program,
  );
  const openForms = scopedPrograms.filter(
    (row) =>
      programAdmissionState(row, formMap.get(row.id), data.forms) === "open",
  ).length;
  const filtered = useMemo(
    () =>
      filterApplications(data.applications, program, status, query).filter((row) =>
        inWibDateRange(row.created_at, from, to),
      ),
    [data.applications, program, status, query, from, to],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);
  const choice = data.applications.find(
    (row) => row.id === params.get("choice"),
  );
  const selectedProgram = data.programs.find((row) => row.id === program);
  const formQuery = params.get("formQ") || "";
  const formState = params.get("form") || "all";
  const visiblePrograms = scopedPrograms.filter(
    (row) =>
      (!formQuery ||
        [row.name, row.code]
          .join(" ")
          .toLocaleLowerCase("id-ID")
          .includes(formQuery.toLocaleLowerCase("id-ID"))) &&
      (formState === "all" ||
        programAdmissionState(row, formMap.get(row.id), data.forms) ===
          formState),
  );
  const formPage = admissionPage(params.get("formPage"));
  const formPages = Math.max(1, Math.ceil(visiblePrograms.length / 12));
  const formSlice = visiblePrograms.slice(
    (Math.min(formPage, formPages) - 1) * 12,
    Math.min(formPage, formPages) * 12,
  );
  const healthy = !loading && !error;
  const openChoice = (id: string) =>
    update({ tab: "review", choice: id }, false);
  function exportCsv() {
    const rows = [
      ["Nama", "Email", "WhatsApp", "Program", "Status", "Tanggal daftar"],
      ...filtered.map((row) => [
        row.applicants.full_name,
        row.applicants.email,
        row.applicants.phone,
        row.programs?.name ?? "",
        applicantStatusLabels[applicationStatus(row)],
        formatRegistrationDateTime(
          row.applicants.submitted_at || row.created_at,
        ),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + Papa.unparse(rows, { escapeFormulae: true })], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `pendaftaran-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const list = (rows: ApplicationRow[]) => (
    <div className="admission-table-wrap">
      <table className="admission-table">
        <thead>
          <tr>
            <th>Pendaftar</th>
            <th>Program</th>
            <th>Status</th>
            <th>Masuk</th>
            <th>
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td data-label="Pendaftar">
                <button
                  className="admission-name"
                  onClick={() => openChoice(row.id)}
                >
                  {row.applicants.full_name}
                </button>
                <small>{row.applicants.email}</small>
              </td>
              <td data-label="Program">
                <span>{row.programs?.name ?? "Program tidak tersedia"}</span>
                <small>{row.programs?.code}</small>
              </td>
              <td data-label="Status">
                <span
                  className={`admission-badge admission-tone-${admissionStatusTone[applicationStatus(row)]}`}
                >
                  {applicantStatusLabels[applicationStatus(row)]}
                </span>
              </td>
              <td data-label="Masuk">
                {formatRegistrationDateTime(
                  row.applicants.submitted_at || row.created_at,
                )}
              </td>
              <td data-label="Aksi">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openChoice(row.id)}
                  aria-label={`Tinjau ${row.applicants.full_name} untuk ${row.programs?.name}`}
                >
                  {applicationStatus(row) === "accepted"
                    ? "Lihat hasil"
                    : "Tinjau"}
                  <ArrowRight size={14} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const programCard = (row: AdmissionProgram) => {
    const form = formMap.get(row.id);
    const state = programAdmissionState(row, form, data.forms);
    const publicForm = selectRegistrationForm(data.forms, row.id) ?? form;
    return (
      <article
        className={`admission-form-card admission-form-card--${state}`}
        key={row.id}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="admission-eyebrow">{row.code}</span>
          <span
            className={`admission-badge admission-tone-${state === "open" || state === "direct" ? "emerald" : state === "upcoming" ? "blue" : state === "inactive" ? "slate" : "amber"}`}
          >
            {admissionWindowLabels[state]}
          </span>
        </div>
        <h3>{row.name}</h3>
        <p>
          {publicForm?.title ??
            (state === "direct"
              ? "Pendaftaran langsung di katalog"
              : "Siapkan formulir program")}
        </p>
        {publicForm?.registration_open_at ||
        publicForm?.registration_close_at ? (
          <small>
            {formatRegistrationDateTime(publicForm.registration_open_at)} →{" "}
            {formatRegistrationDateTime(publicForm.registration_close_at)}
          </small>
        ) : null}
        <footer>
          <Button
            size="sm"
            onClick={() =>
              update({
                tab: "settings",
                program: row.id,
                form: null,
                formQ: null,
              })
            }
          >
            {form ? "Atur formulir" : "Siapkan pendaftaran"}
            <ArrowRight size={14} />
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link
              to={`${base}/program/${row.id}/detail-program`}
              aria-label={`Buka program ${row.name}`}
            >
              <BookOpen size={15} />
            </Link>
          </Button>
        </footer>
      </article>
    );
  };
  return (
    <div className="page-stack admission-workspace">
      <PageHeader
        title="Pendaftaran"
        actions={
          <>
            <Button
              variant="outline"
              disabled={refreshing || loading}
              onClick={() => void load(true)}
              aria-label="Muat ulang pendaftaran"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
            </Button>
            {tab === "review" && (
              <Button
                variant="outline"
                disabled={!healthy || !filtered.length}
                onClick={exportCsv}
              >
                <Download size={16} />
                Ekspor hasil
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to={`${base}/program`}>
                Kelola program
                <ArrowRight size={15} />
              </Link>
            </Button>
          </>
        }
      />
      <SectionNav
        items={sections}
        value={tab}
        onChange={(value) => update({ tab: value }, false)}
        label="Navigasi pendaftaran"
      />
      <div className="admission-scope">
        <label>
          Program
          <select
            className="field-control"
            value={program}
            onChange={(event) =>
              update({ program: event.target.value, formPage: null })
            }
          >
            <option value="all">Semua program</option>
            {data.programs.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · {row.code}
              </option>
            ))}
          </select>
        </label>
        {selectedProgram && (
          <Link to={`${base}/program/${selectedProgram.id}/pendaftaran`}>
            Buka di Program
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
      <div className="program-metrics admission-metrics">
        {[
          {
            label: "Pendaftaran",
            value: stats.total,
            icon: Users,
            tone: "blue",
            action: () => update({ tab: "review", status: null, q: null }),
          },
          {
            label: "Perlu ditinjau",
            value: stats.pending,
            icon: Clock3,
            tone: "amber",
            action: () => update({ tab: "review", status: "pending", q: null }),
          },
          {
            label: "Diterima",
            value: stats.accepted,
            icon: UserCheck,
            tone: "emerald",
            action: () =>
              update({ tab: "review", status: "accepted", q: null }),
          },
          {
            label: "Formulir dibuka",
            value: openForms,
            icon: CalendarClock,
            tone: "violet",
            action: () =>
              update({
                tab: "settings",
                form: "open",
                formQ: null,
                formPage: null,
              }),
          },
        ].map((item) => (
          <button
            key={item.label}
            className={`admin-stat admin-tone-${item.tone}`}
            onClick={item.action}
          >
            <span className="admin-stat__icon">
              <item.icon size={19} />
            </span>
            <span>
              <span className="admin-stat__label">{item.label}</span>
              <strong>{healthy ? item.value : "—"}</strong>
            </span>
            <ArrowRight size={14} />
          </button>
        ))}
      </div>
      {notice && (
        <div className="admission-notice" role="status">
          {notice}
          <button
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {error ? (
        <div className="admission-empty">
          <p className="program-error" role="alert">
            {error}
          </p>
          <Button variant="outline" onClick={() => void load()}>
            Coba lagi
          </Button>
        </div>
      ) : loading ? (
        <p role="status" className="program-loading">
          Memuat pendaftaran…
        </p>
      ) : (
        <>
          {tab === "overview" && (
            <div className="space-y-5">
              <section className="program-panel">
                <div className="program-section-heading">
                  <h2>Antrean review</h2>
                  <span className="text-xs text-muted-foreground">
                    {stats.people} pendaftar unik · {stats.total} pilihan
                    program
                  </span>
                </div>
                <div className="admission-pipeline">
                  {(
                    [
                      "submitted",
                      "under_review",
                      "revision_requested",
                      "rejected",
                    ] as const
                  ).map((value) => (
                    <button
                      key={value}
                      onClick={() =>
                        update({ tab: "review", status: value, q: null })
                      }
                    >
                      <span
                        className={`admission-dot admission-tone-${admissionStatusTone[value]}`}
                      />
                      <span>{applicantStatusLabels[value]}</span>
                      <strong>{stats[value]}</strong>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              </section>
              <section className="program-panel">
                <div className="program-section-heading">
                  <h2>Pendaftaran terbaru</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update({ tab: "review", status: null, q: null })
                    }
                  >
                    Lihat semua
                    <ArrowRight size={14} />
                  </Button>
                </div>
                {scoped.length ? (
                  list(scoped.slice(0, 5))
                ) : (
                  <p className="admission-empty">
                    Belum ada pendaftaran untuk program ini.
                  </p>
                )}
              </section>
              <section className="space-y-3">
                <div className="program-section-heading">
                  <h2>Formulir program</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update({ tab: "settings", form: null, formQ: null })
                    }
                  >
                    Kelola formulir
                    <ArrowRight size={14} />
                  </Button>
                </div>
                <div className="admission-form-grid">
                  {scopedPrograms.slice(0, 3).map(programCard)}
                </div>
              </section>
            </div>
          )}
          {tab === "review" && (
            <section className="program-panel admission-review-list">
              <div className="admission-filters">
                <div className="admission-search">
                  <Search size={16} />
                  <Input
                    aria-label="Cari pendaftar"
                    placeholder="Nama, email, telepon, atau program…"
                    value={query}
                    onChange={(event) => update({ q: event.target.value })}
                  />
                </div>
                <select
                  className="field-control"
                  aria-label="Status pendaftaran"
                  value={status}
                  onChange={(event) => update({ status: event.target.value })}
                >
                  <option value="all">Semua status</option>
                  <option value="pending">Perlu ditinjau</option>
                  {Object.entries(applicantStatusLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
                <label className="dashboard-date-field">
                  Pengajuan mulai (WIB)
                  <Input type="date" value={from} onChange={(e) => update({ from: e.target.value })} />
                </label>
                <label className="dashboard-date-field">
                  Sampai (WIB)
                  <Input type="date" value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value })} />
                </label>
                {(query || status !== "all" || from || to) && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      update({ q: null, status: null, from: null, to: null })
                    }
                  >
                    Hapus filter
                  </Button>
                )}
              </div>
              <div className="admission-results">
                <span>
                  {filtered.length
                    ? `${(safePage - 1) * size + 1}–${Math.min(safePage * size, filtered.length)} dari ${filtered.length}`
                    : "0 hasil"}
                </span>
                <label>
                  Baris
                  <select
                    className="field-control"
                    aria-label="Pendaftaran per halaman"
                    value={size}
                    onChange={(event) => update({ size: event.target.value })}
                  >
                    {[10, 25, 50].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              </div>
              {visible.length ? (
                list(visible)
              ) : (
                <div className="admission-empty">
                  <ClipboardList size={28} />
                  <h3>
                    {query || status !== "all"
                      ? "Tidak ada hasil yang cocok"
                      : "Belum ada pendaftaran"}
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() =>
                      update(
                        query || status !== "all"
                          ? { q: null, status: null }
                          : { tab: "settings" },
                      )
                    }
                  >
                    {query || status !== "all"
                      ? "Hapus filter"
                      : "Siapkan formulir"}
                  </Button>
                </div>
              )}
              <div className="admission-pagination">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage === 1}
                  onClick={() =>
                    update({ page: String(safePage - 1), choice: null }, false)
                  }
                >
                  Sebelumnya
                </Button>
                <span>
                  {safePage} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage === pages}
                  onClick={() =>
                    update({ page: String(safePage + 1), choice: null }, false)
                  }
                >
                  Berikutnya
                </Button>
              </div>
            </section>
          )}
          {tab === "settings" && (
            <div className="space-y-4">
              {selectedProgram ? (
                <>
                  <div className="program-section-heading">
                    <div>
                      <h2>{selectedProgram.name}</h2>
                      <span className="admission-eyebrow">
                        {selectedProgram.code}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => update({ program: null, form: null })}
                    >
                      Ganti program
                    </Button>
                  </div>
                  <ProgramAdmissionBuilder
                    key={selectedProgram.id}
                    programId={selectedProgram.id}
                    onSaved={() => void load(true)}
                  />
                </>
              ) : (
                <>
                  <div className="admission-filters">
                    <div className="admission-search">
                      <Search size={16} />
                      <Input
                        aria-label="Cari program pendaftaran"
                        placeholder="Cari nama atau kode program…"
                        value={formQuery}
                        onChange={(event) =>
                          update(
                            { formQ: event.target.value, formPage: null },
                            false,
                          )
                        }
                      />
                    </div>
                    <select
                      className="field-control"
                      aria-label="Kondisi formulir"
                      value={formState}
                      onChange={(event) =>
                        update(
                          { form: event.target.value, formPage: null },
                          false,
                        )
                      }
                    >
                      <option value="all">Semua formulir</option>
                      {Object.entries(admissionWindowLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="admission-form-grid">
                    {formSlice.map(programCard)}
                  </div>
                  {!visiblePrograms.length && (
                    <div className="admission-empty">
                      <p>Tidak ada program yang cocok.</p>
                      <Button
                        variant="outline"
                        onClick={() => update({ form: null, formQ: null })}
                      >
                        Hapus filter
                      </Button>
                    </div>
                  )}
                  <div className="admission-pagination">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={formPage <= 1}
                      onClick={() =>
                        update({ formPage: String(formPage - 1) }, false)
                      }
                    >
                      Sebelumnya
                    </Button>
                    <span>
                      {Math.min(formPage, formPages)} / {formPages} ·{" "}
                      {visiblePrograms.length} program
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={formPage >= formPages}
                      onClick={() =>
                        update({ formPage: String(formPage + 1) }, false)
                      }
                    >
                      Berikutnya
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
      {choice && tab === "review" && (
        <AdmissionReviewDialog
          key={choice.id}
          row={choice}
          basePath={base}
          onClose={() => update({ choice: null }, false)}
          onSaved={(message) => {
            setNotice(message);
            void load(true);
          }}
        />
      )}
    </div>
  );
}
