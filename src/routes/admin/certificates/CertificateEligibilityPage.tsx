import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Dialog } from "../../../components/ui/dialog";
import { WizardSteps } from "../../../components/ui/wizard-steps";
import { supabase } from "../../../lib/supabase";
import {
  useCertificateWorkspace,
  exportCertificateCsv,
} from "../../../lib/certificateData";
import {
  certificateError,
  certificatePath,
  certificatePage,
  certificateReasonAction,
  confirmedCertificateBatch,
  type EligibilityRow,
} from "../../../lib/certificateWorkspace";
import { CertificateModuleHeader } from "./CertificateModuleNav";
export function CertificateEligibilityPage() {
  const location = useLocation();
  const base = location.pathname.startsWith("/system") ? "/system" : "/admin";
  const [params, setParams] = useSearchParams();
  const {
    programs,
    templates,
    groups,
    loading,
    error: loadError,
    load,
  } = useCertificateWorkspace();
  const program = params.get("program") || "";
  const batch = params.get("batch") || "";
  const template = params.get("template") || "";
  const q = params.get("q") || "";
  const filter = params.get("status") || "all";
  const [rows, setRows] = useState<EligibilityRow[] | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const check = useRef<AbortController | null>(null);
  const request = useRef<{ payload: string; key: string } | null>(null);
  const activeTemplates = templates.filter(
    (t) => t.program_id === program && t.status === "active",
  );
  const selectedTemplate = activeTemplates.find((t) => t.id === template);
  const selectedProgram = programs.find((p) => p.id === program);
  const selected = rows?.filter((r) => r.eligible && selection.has(r.id)) ?? [];
  function update(values: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(values)) {
          if (value && value !== "all") next.set(key, value);
          else next.delete(key);
        }
        if (!("page" in values)) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  useEffect(() => {
    check.current?.abort();
    setRows(null);
    setSelection(new Set());
    setStep(0);
    setError("");
    setCreated(null);
    setBusy(false);
    request.current = null;
    return () => check.current?.abort();
  }, [program, batch]);
  async function checkEligibility() {
    check.current?.abort();
    const controller = new AbortController();
    check.current = controller;
    setBusy(true);
    setError("");
    setRows(null);
    setSelection(new Set());
    try {
      const { data, error: problem } = await supabase
        .rpc("admin_check_certificate_eligibility", {
          p_program_id: program,
          p_batch_id: batch || null,
        })
        .abortSignal(controller.signal);
      if (controller.signal.aborted) return;
      if (problem) throw problem;
      if (!Array.isArray(data))
        throw new Error("Hasil pemeriksaan belum terkonfirmasi.");
      setRows(data as EligibilityRow[]);
      setStep(1);
      update({ status: null, q: null, page: null });
    } catch (problem) {
      if (!controller.signal.aborted)
        setError(certificateError(problem, "Pemeriksaan belum berhasil."));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function create() {
    if (!selectedTemplate || !selected.length) return;
    setBusy(true);
    setError("");
    const payload = {
      p_program_id: program,
      p_batch_id: batch || null,
      p_template_id: template,
      p_enrollment_ids: selected.map((r) => r.id).sort(),
    };
    const serial = JSON.stringify(payload);
    if (request.current?.payload !== serial)
      request.current = { payload: serial, key: crypto.randomUUID() };
    try {
      const { data, error: problem } = await supabase.rpc(
        "admin_create_certificate_batch",
        { ...payload, p_request_key: request.current.key },
      );
      if (problem) throw problem;
      const result = confirmedCertificateBatch(data, selected.length);
      setCreated(result.batch_id);
      setConfirm(false);
      setSelection(new Set());
    } catch (problem) {
      setError(
        certificateError(
          problem,
          "Antrean belum dibuat. Pilihan Anda tetap tersimpan.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const filtered = (rows ?? []).filter(
    (r) =>
      (filter === "all" ||
        (filter === "eligible" ? r.eligible : !r.eligible)) &&
      (!q ||
        `${r.participants.display_name} ${r.participants.global_participant_number} ${r.enrollment_number} ${r.reason}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  const page = Math.min(pages, certificatePage(params.get("page")));
  const visible = filtered.slice((page - 1) * 15, page * 15);
  const visibleEligible = visible.filter((r) => r.eligible);
  const allVisible =
    visibleEligible.length > 0 &&
    visibleEligible.every((r) => selection.has(r.id));
  function toggleAll() {
    setSelection((current) => {
      const next = new Set(current);
      visibleEligible.forEach((r) =>
        allVisible ? next.delete(r.id) : next.add(r.id),
      );
      return next;
    });
  }
  const actionPath = (r: EligibilityRow) => {
    const action = certificateReasonAction(r.reason);
    return action === "queue"
      ? certificatePath(base, "antrean", program)
      : action === "academic"
        ? `${base}/peserta/${r.participant_id}?tab=academic`
        : action === "settings"
          ? `${base}/program/${program}/detail-program`
          : `${base}/program/${program}/kelulusan`;
  };
  return (
    <div className="page-stack certificate-workspace">
      <CertificateModuleHeader
        active="eligibility"
        title="Kelayakan sertifikat"
        actions={
          <Button
            variant="outline"
            aria-label="Muat ulang opsi sertifikat"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
          </Button>
        }
      />
      {created ? (
        <section className="program-panel certificate-empty">
          <CheckCircle2 size={36} />
          <h2>Antrean berhasil dibuat</h2>
          <Button asChild>
            <Link
              to={
                certificatePath(base, "antrean", program, batch) +
                `&detail=${created}`
              }
            >
              Pantau penerbitan
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCreated(null);
              setStep(0);
              setRows(null);
            }}
          >
            Pemeriksaan baru
          </Button>
        </section>
      ) : (
        <>
          <WizardSteps
            steps={["Pilih program", "Pilih peserta", "Tinjau antrean"]}
            current={step}
          />
          {(error || loadError) && !confirm && (
            <p role="alert" className="program-error">
              {error || loadError}
            </p>
          )}
          <section className="program-panel">
            <div className="certificate-filters">
              <label className="certificate-field">
                Program
                <select
                  aria-label="Program sertifikat"
                  className="field-control"
                  disabled={loading || busy}
                  value={program}
                  onChange={(e) =>
                    update({
                      program: e.target.value,
                      batch: null,
                      template: null,
                    })
                  }
                >
                  <option value="">Pilih program</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="certificate-field">
                Angkatan
                <select
                  aria-label="Angkatan sertifikat"
                  className="field-control"
                  disabled={!program || busy || loading}
                  value={batch}
                  onChange={(e) => update({ batch: e.target.value })}
                >
                  <option value="">Semua angkatan</option>
                  {groups
                    .filter((g) => g.program_id === program)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                disabled={!program || busy || loading || !!loadError}
                onClick={() => void checkEligibility()}
              >
                <ClipboardCheck size={16} />
                {busy ? "Memeriksa…" : "Periksa kelayakan"}
              </Button>
            </div>
            {selectedProgram &&
              !selectedProgram.feature_flags?.use_certificate && (
                <p className="program-notice">
                  Sertifikat belum diaktifkan pada program ini.{" "}
                  <Link to={`${base}/program/${program}/detail-program`}>
                    Buka pengaturan program
                  </Link>
                </p>
              )}
            {!program && (
              <p className="text-sm text-muted-foreground">
                Pilih program untuk memeriksa peserta yang sudah ditetapkan
                lulus.
              </p>
            )}
          </section>
          {rows && step === 1 && (
            <>
              <div className="program-metrics">
                {[
                  {
                    label: "Diperiksa",
                    value: rows.length,
                    status: "all",
                    tone: "blue",
                    icon: Users,
                  },
                  {
                    label: "Layak",
                    value: rows.filter((r) => r.eligible).length,
                    status: "eligible",
                    tone: "emerald",
                    icon: CheckCircle2,
                  },
                  {
                    label: "Perlu ditindaklanjuti",
                    value: rows.filter((r) => !r.eligible).length,
                    status: "not_eligible",
                    tone: "amber",
                    icon: XCircle,
                  },
                ].map(({ label, value, status, tone, icon: Icon }) => (
                  <button
                    key={label}
                    className={`admin-stat admin-tone-${tone}`}
                    onClick={() => update({ status, q: null })}
                  >
                    <span className="admin-stat__icon">
                      <Icon size={19} />
                    </span>
                    <span>
                      <span className="admin-stat__label">{label}</span>
                      <strong>{value}</strong>
                    </span>
                  </button>
                ))}
              </div>
              <section className="program-panel">
                <div className="certificate-filters">
                  <Input
                    aria-label="Cari peserta sertifikat"
                    value={q}
                    placeholder="Cari peserta atau nomor induk…"
                    onChange={(e) => update({ q: e.target.value })}
                  />
                  <select
                    aria-label="Hasil kelayakan"
                    className="field-control"
                    value={filter}
                    onChange={(e) => update({ status: e.target.value })}
                  >
                    <option value="all">Semua hasil</option>
                    <option value="eligible">Layak</option>
                    <option value="not_eligible">Perlu ditindaklanjuti</option>
                  </select>
                  <Button
                    variant="outline"
                    disabled={!filtered.length}
                    onClick={() =>
                      exportCertificateCsv("kelayakan-sertifikat", [
                        [
                          "Nama",
                          "Nomor induk",
                          "Enrollment",
                          "Status",
                          "Alasan",
                        ],
                        ...filtered.map((r) => [
                          r.participants.display_name,
                          r.participants.global_participant_number,
                          r.enrollment_number,
                          r.eligible ? "Layak" : "Belum layak",
                          r.reason,
                        ]),
                      ])
                    }
                  >
                    <Download size={15} />
                    Ekspor
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3 mb-4 items-center text-sm">
                  <label className="flex gap-2 items-center">
                    <input
                      type="checkbox"
                      aria-label="Pilih peserta layak di halaman ini"
                      checked={allVisible}
                      disabled={!visibleEligible.length}
                      onChange={toggleAll}
                    />
                    Pilih halaman ini
                  </label>
                  <strong>{selected.length} dipilih</strong>
                  {selected.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelection(new Set())}
                    >
                      Bersihkan pilihan
                    </Button>
                  )}
                </div>
                {!filtered.length ? (
                  <p className="certificate-empty">
                    Tidak ada hasil yang cocok.
                  </p>
                ) : (
                  <table className="admission-table certificate-table">
                    <thead>
                      <tr>
                        <th>Pilih</th>
                        <th>Peserta</th>
                        <th>Kelayakan</th>
                        <th>Tindak lanjut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => (
                        <tr key={r.id}>
                          <td data-label="Pilih">
                            <input
                              type="checkbox"
                              aria-label={`Pilih ${r.participants.display_name}`}
                              disabled={!r.eligible}
                              checked={selection.has(r.id)}
                              onChange={() =>
                                setSelection((current) => {
                                  const next = new Set(current);
                                  if (next.has(r.id)) next.delete(r.id);
                                  else next.add(r.id);
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td data-label="Peserta">
                            <Link
                              className="font-medium"
                              to={`${base}/peserta/${r.participant_id}?tab=academic`}
                            >
                              {r.participants.display_name}
                            </Link>
                            <small>
                              {r.participants.global_participant_number} ·{" "}
                              {r.enrollment_number}
                            </small>
                          </td>
                          <td data-label="Kelayakan">
                            <span
                              className={`admission-badge admission-tone-${r.eligible ? "emerald" : "amber"}`}
                            >
                              {r.eligible ? "Layak" : "Belum layak"}
                            </span>
                            <small>{r.reason}</small>
                          </td>
                          <td data-label="Tindak lanjut">
                            <Button asChild variant="ghost" size="sm">
                              <Link
                                to={
                                  r.eligible
                                    ? `${base}/peserta/${r.participant_id}/transkrip/${r.id}`
                                    : actionPath(r)
                                }
                              >
                                {r.eligible
                                  ? "Transkrip"
                                  : certificateReasonAction(r.reason) ===
                                      "queue"
                                    ? "Buka antrean"
                                    : "Tindak lanjuti"}
                                <ArrowRight size={14} />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
              </section>
              <div className="assessment-footer">
                <span>{selected.length} peserta dipilih</span>
                <Button
                  disabled={!selected.length || busy}
                  onClick={() => {
                    if (!selectedTemplate)
                      update({ template: activeTemplates[0]?.id ?? null });
                    setStep(2);
                  }}
                >
                  Lanjut
                  <ArrowRight size={16} />
                </Button>
              </div>
            </>
          )}
          {step === 2 && (
            <section className="program-panel space-y-5">
              <div className="program-section-heading">
                <h2>Tinjau antrean</h2>
                <strong>{selected.length} peserta</strong>
              </div>
              <label className="certificate-field">
                Template aktif
                <select
                  aria-label="Template penerbitan"
                  className="field-control"
                  value={selectedTemplate?.id ?? ""}
                  onChange={(e) => update({ template: e.target.value })}
                >
                  <option value="">Pilih template</option>
                  {activeTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {!activeTemplates.length && (
                <p className="program-notice">
                  Belum ada template aktif.{" "}
                  <Link to={certificatePath(base, "", program)}>
                    Siapkan template
                  </Link>
                </p>
              )}
              <dl className="certificate-summary">
                <div>
                  <dt>Program</dt>
                  <dd>{selectedProgram?.name}</dd>
                </div>
                <div>
                  <dt>Angkatan</dt>
                  <dd>
                    {groups.find((g) => g.id === batch)?.name ??
                      "Semua angkatan"}
                  </dd>
                </div>
                <div>
                  <dt>Peserta</dt>
                  <dd>
                    {selected
                      .map((r) => r.participants.display_name)
                      .join(", ")}
                  </dd>
                </div>
              </dl>
              <div className="workspace-dialog__footer">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setStep(1)}
                >
                  Kembali
                </Button>
                <Button
                  disabled={
                    !selectedTemplate ||
                    !selected.length ||
                    busy ||
                    loading ||
                    !!loadError
                  }
                  onClick={() => {
                    setError("");
                    setConfirm(true);
                  }}
                >
                  Buat antrean
                </Button>
              </div>
            </section>
          )}
        </>
      )}
      {confirm && (
        <Dialog
          title="Buat antrean sertifikat?"
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <p>
            {selected.length} peserta · {selectedProgram?.name}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {selectedTemplate?.name}. Kelayakan akan diperiksa ulang sebelum
            antrean disimpan.
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
              Periksa lagi
            </Button>
            <Button disabled={busy} onClick={() => void create()}>
              {busy ? "Menyimpan…" : "Konfirmasi antrean"}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
