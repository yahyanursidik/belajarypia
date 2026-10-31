import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Dialog } from "../../../components/ui/dialog";
import { Progress } from "../../../components/ui/progress";
import { supabase } from "../../../lib/supabase";
import {
  useCertificateWorkspace,
  loadCertificateJobs,
  openCertificateDocument,
  exportCertificateCsv,
} from "../../../lib/certificateData";
import {
  certificateError,
  certificatePage,
  certificatePath,
  certificateStatus,
  queueProgress,
  type CertificateBatch,
  type CertificateJob,
} from "../../../lib/certificateWorkspace";
import { formatRegistrationDateTime } from "../../../lib/admission";
import {
  CertificateModuleHeader,
  CertificateBadge,
} from "./CertificateModuleNav";
export function CertificateQueuePage() {
  const location = useLocation();
  const base = location.pathname.startsWith("/system") ? "/system" : "/admin";
  const [params, setParams] = useSearchParams();
  const {
    programs,
    templates,
    batches,
    certificates,
    groups,
    loading,
    error,
    load,
  } = useCertificateWorkspace(true);
  const program = params.get("program") || "all";
  const batch = params.get("batch") || "";
  const view = params.get("view") || "queue";
  const status = params.get("status") || "all";
  const q = params.get("q") || "";
  const detail = batches.find((b) => b.id === params.get("detail"));
  const [download, setDownload] = useState("");
  const [notice, setNotice] = useState("");
  const [fileError, setFileError] = useState("");
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
  }
  const scoped = batches.filter(
    (b) =>
      (program === "all" || b.program_id === program) &&
      (!batch || b.batch_id === batch),
  );
  const scopedCerts = certificates.filter(
    (c) =>
      (program === "all" || c.enrollments?.program_id === program) &&
      (!batch || c.enrollments?.batch_id === batch),
  );
  const filtered = scoped
    .filter(
      (b) =>
        (status === "all" ||
          (status === "waiting"
            ? ["pending", "processing"].includes(b.status)
            : b.status === status)) &&
        (!q ||
          `${b.id} ${programs.find((p) => p.id === b.program_id)?.name} ${templates.find((t) => t.id === b.template_id)?.name}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const filteredCerts = scopedCerts
    .filter(
      (c) =>
        (status === "all" || c.status === status) &&
        (!q ||
          `${c.certificate_number} ${c.recipient_name} ${c.program_name}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    )
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at));
  const pages = Math.max(
    1,
    Math.ceil(
      (view === "issued" ? filteredCerts.length : filtered.length) / 12,
    ),
  );
  const page = Math.min(pages, certificatePage(params.get("page")));
  async function downloadCertificate(id: string) {
    setDownload(id);
    setFileError("");
    try {
      await openCertificateDocument(id);
    } catch (problem) {
      setFileError(certificateError(problem, "Dokumen belum dapat dibuka."));
    } finally {
      setDownload("");
    }
  }
  return (
    <div className="page-stack certificate-workspace">
      <CertificateModuleHeader
        active="queue"
        title="Antrean & dokumen"
        actions={
          <>
            <Button
              variant="outline"
              disabled={loading}
              aria-label="Muat ulang antrean sertifikat"
              onClick={() => void load()}
            >
              <RefreshCw size={16} />
            </Button>
            <Button asChild>
              <Link to={certificatePath(base, "kelayakan", program, batch)}>
                Cek kelayakan
                <ArrowRight size={16} />
              </Link>
            </Button>
          </>
        }
      />
      {notice && (
        <p role="status" className="admission-notice">
          {notice}
        </p>
      )}
      {fileError && (
        <p role="alert" className="program-error">
          {fileError}
        </p>
      )}
      <div className="program-metrics">
        {[
          {
            label: "Menunggu & diproses",
            value: scoped.filter((b) =>
              ["pending", "processing"].includes(b.status),
            ).length,
            tone: "amber",
            icon: Clock,
            status: "waiting",
            view: "queue",
          },
          {
            label: "Antrean selesai",
            value: scoped.filter((b) => b.status === "completed").length,
            tone: "blue",
            icon: CheckCircle2,
            status: "completed",
            view: "queue",
          },
          {
            label: "Antrean gagal",
            value: scoped.filter((b) => b.status === "failed").length,
            tone: "rose",
            icon: XCircle,
            status: "failed",
            view: "queue",
          },
          {
            label: "Dokumen terbit",
            value: scopedCerts.filter((c) => c.status === "issued").length,
            tone: "emerald",
            icon: Award,
            status: "issued",
            view: "issued",
          },
        ].map(({ label, value, tone, icon: Icon, status: s, view: v }) => (
          <button
            key={label}
            className={`admin-stat admin-tone-${tone}`}
            disabled={loading || !!error}
            onClick={() => update({ view: v, status: s, q: null })}
          >
            <span className="admin-stat__icon">
              <Icon size={19} />
            </span>
            <span>
              <span className="admin-stat__label">{label}</span>
              <strong>{loading || error ? "—" : value}</strong>
            </span>
          </button>
        ))}
      </div>
      <section className="program-panel">
        <div className="flex gap-2 mb-4">
          <Button
            variant={view === "queue" ? "default" : "outline"}
            onClick={() => update({ view: "queue", status: null })}
          >
            Antrean
          </Button>
          <Button
            variant={view === "issued" ? "default" : "outline"}
            onClick={() => update({ view: "issued", status: null })}
          >
            Dokumen
          </Button>
        </div>
        <div className="certificate-filters">
          <Input
            aria-label="Cari antrean atau dokumen"
            value={q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={
              view === "issued"
                ? "Cari peserta atau nomor sertifikat…"
                : "Cari program atau template…"
            }
          />
          <select
            aria-label="Program sertifikat"
            className="field-control"
            value={program}
            onChange={(e) =>
              update({ program: e.target.value, batch: null, detail: null })
            }
          >
            <option value="all">Semua program</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Status antrean sertifikat"
            className="field-control"
            value={status}
            onChange={(e) => update({ status: e.target.value })}
          >
            <option value="all">Semua status</option>
            {(view === "issued"
              ? ["issued", "revoked", "draft", "queued", "failed"]
              : ["pending", "processing", "completed", "failed", "waiting"]
            ).map((s) => (
              <option key={s} value={s}>
                {s === "waiting"
                  ? "Menunggu & diproses"
                  : (certificateStatus[s]?.label ?? s)}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={
              loading ||
              !!error ||
              !(view === "issued" ? filteredCerts.length : filtered.length)
            }
            onClick={() =>
              exportCertificateCsv(
                "sertifikat",
                view === "issued"
                  ? [
                      ["Nomor", "Penerima", "Program", "Status", "Tanggal"],
                      ...filteredCerts.map((c) => [
                        c.certificate_number,
                        c.recipient_name,
                        c.program_name,
                        certificateStatus[c.status]?.label ?? c.status,
                        formatRegistrationDateTime(c.issued_at),
                      ]),
                    ]
                  : [
                      [
                        "Program",
                        "Template",
                        "Total",
                        "Selesai",
                        "Gagal",
                        "Status",
                      ],
                      ...filtered.map((b) => [
                        programs.find((p) => p.id === b.program_id)?.name ?? "",
                        templates.find((t) => t.id === b.template_id)?.name ??
                          "",
                        b.total_jobs,
                        b.completed_jobs,
                        b.failed_jobs,
                        certificateStatus[b.status]?.label ?? b.status,
                      ]),
                    ],
              )
            }
          >
            <Download size={15} />
            Ekspor
          </Button>
        </div>
        {batch && (
          <p className="text-xs text-muted-foreground mb-4">
            Angkatan:{" "}
            {groups.find((g) => g.id === batch)?.name ?? "Pilihan tersimpan"}{" "}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => update({ batch: null })}
            >
              Semua angkatan
            </Button>
          </p>
        )}
        {error ? (
          <p role="alert" className="program-error">
            {error}
            <Button variant="outline" onClick={() => void load()}>
              Coba lagi
            </Button>
          </p>
        ) : loading ? (
          <p role="status">Memuat antrean dan dokumen…</p>
        ) : (
          <>
            {view === "queue" ? (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  {filtered.length} antrean
                </p>
                {!filtered.length ? (
                  <p className="certificate-empty">
                    Belum ada antrean yang cocok.
                  </p>
                ) : (
                  <table className="admission-table certificate-table">
                    <thead>
                      <tr>
                        <th>Penerbitan</th>
                        <th>Progres</th>
                        <th>Status</th>
                        <th>Rincian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice((page - 1) * 12, page * 12).map((b) => {
                        const progress = queueProgress(b);
                        return (
                          <tr key={b.id}>
                            <td data-label="Penerbitan">
                              <strong>
                                {programs.find((p) => p.id === b.program_id)
                                  ?.name ?? "Program arsip"}
                              </strong>
                              <small>
                                {templates.find((t) => t.id === b.template_id)
                                  ?.name ?? "Template arsip"}
                              </small>
                              <small>
                                {formatRegistrationDateTime(b.created_at)}
                              </small>
                            </td>
                            <td data-label="Progres">
                              <div className="certificate-progress">
                                <Progress value={progress.percent} />
                                <span>
                                  {b.completed_jobs}/{b.total_jobs} selesai
                                </span>
                                <small>
                                  {b.failed_jobs > 0
                                    ? `${b.failed_jobs} gagal · `
                                    : ""}
                                  {progress.remaining} menunggu/diproses
                                </small>
                              </div>
                            </td>
                            <td data-label="Status">
                              <CertificateBadge status={b.status} />
                            </td>
                            <td data-label="Rincian">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => update({ detail: b.id })}
                              >
                                Lihat peserta
                                <ArrowRight size={14} />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  {filteredCerts.length} dokumen
                </p>
                {!filteredCerts.length ? (
                  <p className="certificate-empty">
                    Belum ada dokumen yang cocok.
                  </p>
                ) : (
                  <table className="admission-table certificate-table">
                    <thead>
                      <tr>
                        <th>Sertifikat</th>
                        <th>Program</th>
                        <th>Status</th>
                        <th>Dokumen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCerts
                        .slice((page - 1) * 12, page * 12)
                        .map((c) => (
                          <tr key={c.id}>
                            <td data-label="Sertifikat">
                              <strong>{c.recipient_name}</strong>
                              <small>{c.certificate_number}</small>
                              {c.enrollments && (
                                <Link
                                  className="text-xs"
                                  to={`${base}/peserta/${c.enrollments.participant_id}?tab=academic`}
                                >
                                  Profil akademik ↗
                                </Link>
                              )}
                            </td>
                            <td data-label="Program">
                              {c.program_name}
                              <small>
                                {formatRegistrationDateTime(c.issued_at)}
                              </small>
                            </td>
                            <td data-label="Status">
                              <CertificateBadge status={c.status} />
                            </td>
                            <td data-label="Dokumen">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                  c.status !== "issued" ||
                                  !c.object_key ||
                                  !!download
                                }
                                onClick={() => void downloadCertificate(c.id)}
                              >
                                <Download size={14} />
                                {download === c.id ? "Membuka…" : "Unduh PDF"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
            <div className="certificate-pagination">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => update({ page: String(page - 1) })}
              >
                Sebelumnya
              </Button>
              <span>
                {page} / {pages}
              </span>
              <Button
                variant="outline"
                disabled={page === pages}
                onClick={() => update({ page: String(page + 1) })}
              >
                Berikutnya
              </Button>
            </div>
          </>
        )}
      </section>
      {detail && (
        <CertificateBatchDetail
          key={detail.id}
          batch={detail}
          base={base}
          onClose={() => update({ detail: null })}
          onUpdated={() => {
            setNotice("Antrean diperbarui.");
            void load();
          }}
        />
      )}
    </div>
  );
}
function CertificateBatchDetail({
  batch,
  base,
  onClose,
  onUpdated,
}: {
  batch: CertificateBatch;
  base: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [jobs, setJobs] = useState<CertificateJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [processConfirm, setProcessConfirm] = useState(false);
  const [processNotice, setProcessNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadCertificateJobs(batch.id, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setJobs(rows);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Rincian antrean belum dapat dimuat.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [batch.id, retry]);
  const failed = jobs.filter((j) => j.status === "failed");
  const filtered = jobs.filter(
    (j) =>
      (filter === "all" || j.status === filter) &&
      (!q ||
        `${j.participants?.display_name} ${j.participants?.global_participant_number}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  const safePage = Math.min(page, pages);
  async function retryFailed() {
    setBusy(true);
    setError("");
    try {
      const { data, error: problem } = await supabase.rpc(
        "admin_retry_certificate_jobs",
        { p_batch_id: batch.id, p_job_ids: failed.map((j) => j.id) },
      );
      if (problem) throw problem;
      if (data?.retried !== failed.length)
        throw new Error(
          "Penjadwalan ulang belum terkonfirmasi. Muat ulang rincian.",
        );
      setConfirm(false);
      setRetry((n) => n + 1);
      onUpdated();
    } catch (problem) {
      setError(certificateError(problem, "Belum dapat dijadwalkan ulang."));
    } finally {
      setBusy(false);
    }
  }
  async function processQueue() {
    setBusy(true);
    setError("");
    setProcessNotice("");
    try {
      const { data, error: problem } = await supabase.functions.invoke(
        "process-certificate-queue",
        { body: { batch_id: batch.id } },
      );
      if (problem) throw problem;
      if (!Array.isArray(data?.results))
        throw new Error(
          "Hasil pemrosesan belum terkonfirmasi. Muat ulang rincian sebelum mencoba lagi.",
        );
      setProcessConfirm(false);
      setRetry((n) => n + 1);
      onUpdated();
      setProcessNotice(
        data.results.length
          ? `${data.results.length} pekerjaan diproses. Periksa status dan dokumen hasilnya.`
          : "Belum ada pekerjaan baru yang siap. Perbarui status beberapa saat lagi.",
      );
    } catch {
      setError(
        "Pemrosesan belum terkonfirmasi. Muat ulang rincian sebelum mencoba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Rincian penerbitan"
      onClose={onClose}
      busy={busy}
      className="admission-detail-dialog"
    >
      <div className="flex justify-between gap-3 mb-4">
        <CertificateBadge status={batch.status} />
        <Button
          variant="outline"
          size="sm"
          disabled={loading || busy}
          onClick={() => setRetry((n) => n + 1)}
        >
          <RefreshCw size={14} />
          Muat ulang
        </Button>
      </div>
      {error && (
        <p role="alert" className="program-error">
          {error}
        </p>
      )}
      {processNotice && (
        <p role="status" className="admission-notice">
          {processNotice}
        </p>
      )}
      <div className="certificate-filters">
        <Input
          aria-label="Cari peserta dalam antrean"
          value={q}
          placeholder="Cari peserta…"
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="field-control"
          aria-label="Status pekerjaan sertifikat"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Semua status</option>
          {["pending", "processing", "completed", "failed", "cancelled"].map(
            (s) => (
              <option key={s} value={s}>
                {certificateStatus[s].label}
              </option>
            ),
          )}
        </select>
      </div>
      {loading ? (
        <p role="status">Memuat peserta…</p>
      ) : !filtered.length ? (
        <p className="certificate-empty">Tidak ada pekerjaan yang cocok.</p>
      ) : (
        <div className="space-y-3">
          {filtered.slice((safePage - 1) * 15, safePage * 15).map((j) => (
            <article className="certificate-job-card" key={j.id}>
              <div className="flex justify-between gap-3">
                <Link
                  className="font-medium"
                  to={`${base}/peserta/${j.participant_id}?tab=academic`}
                >
                  {j.participants?.display_name ?? "Peserta arsip"}
                </Link>
                <CertificateBadge status={j.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {j.participants?.global_participant_number} · Percobaan{" "}
                {j.attempt_count}/{j.max_attempts}
              </p>
              {j.error_message && (
                <p className="program-error mt-2">{j.error_message}</p>
              )}
              <Link
                className="text-xs inline-block mt-3"
                to={`${base}/peserta/${j.participant_id}/transkrip/${j.enrollment_id}`}
              >
                Buka transkrip ↗
              </Link>
            </article>
          ))}
        </div>
      )}
      <div className="certificate-pagination">
        <Button
          variant="outline"
          disabled={safePage === 1}
          onClick={() => setPage(safePage - 1)}
        >
          Sebelumnya
        </Button>
        <span>
          {safePage}/{pages}
        </span>
        <Button
          variant="outline"
          disabled={safePage === pages}
          onClick={() => setPage(safePage + 1)}
        >
          Berikutnya
        </Button>
      </div>
      <div className="workspace-dialog__footer">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Tutup
        </Button>
        <Button
          variant="outline"
          disabled={loading || busy || !failed.length || !!error}
          onClick={() => setConfirm(true)}
        >
          Ulangi {failed.length} pekerjaan gagal
        </Button>
        <Button
          disabled={
            loading ||
            busy ||
            !!error ||
            !jobs.some(
              (j) => j.status === "pending" || j.status === "processing",
            )
          }
          onClick={() => setProcessConfirm(true)}
        >
          Proses antrean
        </Button>
      </div>
      {confirm && (
        <Dialog
          title="Jadwalkan ulang pekerjaan gagal?"
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <p>
            {failed.length} pekerjaan akan diperiksa kelayakannya kembali. Tata
            letak template terbaru akan digunakan. Dokumen yang sudah terbit
            tidak dibuat ulang.
          </p>
          {error && (
            <p role="alert" className="program-error">
              {error}
            </p>
          )}
          <div className="workspace-dialog__footer">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Batal
            </Button>
            <Button disabled={busy} onClick={() => void retryFailed()}>
              {busy ? "Menyimpan…" : "Jadwalkan ulang"}
            </Button>
          </div>
        </Dialog>
      )}
      {processConfirm && (
        <Dialog
          title="Proses penerbitan sertifikat?"
          onClose={() => setProcessConfirm(false)}
          busy={busy}
        >
          <p>
            Dokumen akan dibuat untuk peserta dalam antrean ini. Kelayakan
            diperiksa kembali sebelum terbit.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Maksimal 5 dokumen per proses. Lanjutkan lagi jika masih ada yang
            menunggu.
          </p>
          {error && (
            <p role="alert" className="program-error">
              {error}
            </p>
          )}
          <div className="workspace-dialog__footer">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setProcessConfirm(false)}
            >
              Periksa lagi
            </Button>
            <Button disabled={busy} onClick={() => void processQueue()}>
              {busy ? "Memproses…" : "Proses sekarang"}
            </Button>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}
