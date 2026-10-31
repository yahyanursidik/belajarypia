import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  Archive,
  Award,
  CheckCircle2,
  Edit2,
  Plus,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Dialog } from "../../../components/ui/dialog";
import { CertificateTemplateDialog } from "../../../components/certificates/CertificateTemplateDialog";
import { supabase } from "../../../lib/supabase";
import { useCertificateWorkspace } from "../../../lib/certificateData";
import {
  certificateError,
  certificatePath,
  certificatePage,
  certificateLayout,
  type CertificateTemplate,
} from "../../../lib/certificateWorkspace";
import {
  CertificateModuleHeader,
  CertificateBadge,
} from "./CertificateModuleNav";
export function CertificateTemplatesPage() {
  const location = useLocation();
  const base = location.pathname.startsWith("/system") ? "/system" : "/admin";
  const [params, setParams] = useSearchParams();
  const { programs, templates, loading, error, load } =
    useCertificateWorkspace();
  const [editor, setEditor] = useState<CertificateTemplate | "new" | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState<CertificateTemplate | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [notice, setNotice] = useState("");
  const program = params.get("program") || "all";
  const status = params.get("status") || "all";
  const q = params.get("q") || "";
  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
        if (key !== "page") next.delete("page");
        if (key === "program") next.delete("batch");
        return next;
      },
      { replace: true },
    );
  const scoped = templates.filter(
    (t) => program === "all" || t.program_id === program,
  );
  const filtered = scoped
    .filter(
      (t) =>
        (status === "all" || t.status === status) &&
        (!q ||
          `${t.name} ${programs.find((p) => p.id === t.program_id)?.name}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    )
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const page = Math.min(pages, certificatePage(params.get("page")));
  async function archive() {
    if (!confirmation) return;
    setBusy(true);
    setMutationError("");
    try {
      const { data, error: problem } = await supabase.rpc(
        "admin_save_certificate_template",
        {
          p_id: confirmation.id,
          p_expected_updated_at: confirmation.updated_at,
          p_program_id: confirmation.program_id,
          p_name: confirmation.name,
          p_data: {
            ...(confirmation.template_data_json ?? {}),
            ...certificateLayout(confirmation.template_data_json),
          },
          p_background: confirmation.background_object_key,
          p_status: confirmation.status === "active" ? "archived" : "active",
        },
      );
      if (problem) throw problem;
      if (!data?.id) throw new Error("Perubahan belum terkonfirmasi.");
      setConfirmation(null);
      setNotice("Status template diperbarui.");
      await load();
    } catch (problem) {
      setMutationError(certificateError(problem, "Status belum tersimpan."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack certificate-workspace">
      <CertificateModuleHeader
        active="templates"
        title="Sertifikat"
        actions={
          <>
            <Button
              variant="outline"
              aria-label="Muat ulang template"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              onClick={() => setEditor("new")}
              disabled={loading || !!error}
            >
              <Plus size={16} />
              Buat template
            </Button>
          </>
        }
      />
      {notice && (
        <p role="status" className="admission-notice">
          {notice}
        </p>
      )}
      <div className="program-metrics">
        {[
          {
            label: "Semua template",
            value: scoped.length,
            status: "all",
            tone: "blue",
            icon: Award,
          },
          {
            label: "Aktif",
            value: scoped.filter((t) => t.status === "active").length,
            status: "active",
            tone: "emerald",
            icon: CheckCircle2,
          },
          {
            label: "Arsip",
            value: scoped.filter((t) => t.status === "archived").length,
            status: "archived",
            tone: "violet",
            icon: Archive,
          },
        ].map(({ label, value, status: s, tone, icon: Icon }) => (
          <button
            className={`admin-stat admin-tone-${tone}`}
            key={label}
            disabled={loading || !!error}
            onClick={() => {
              setParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  next.delete("q");
                  next.delete("page");
                  if (s === "all") next.delete("status");
                  else next.set("status", s);
                  return next;
                },
                { replace: true },
              );
            }}
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
        <div className="certificate-filters">
          <Input
            aria-label="Cari template"
            value={q}
            placeholder="Cari template atau program…"
            onChange={(e) => update("q", e.target.value)}
          />
          <select
            className="field-control"
            aria-label="Program sertifikat"
            value={program}
            onChange={(e) => update("program", e.target.value)}
          >
            <option value="all">Semua program</option>
            {programs.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="field-control"
            aria-label="Status template"
            value={status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="archived">Arsip</option>
          </select>
        </div>
        {error ? (
          <div role="alert" className="program-error">
            {error}
            <Button variant="outline" onClick={() => void load()}>
              Coba lagi
            </Button>
          </div>
        ) : loading ? (
          <p role="status">Memuat template…</p>
        ) : filtered.length === 0 ? (
          <div className="certificate-empty">
            <Award size={30} />
            <h2>Belum ada template yang cocok</h2>
            <Button onClick={() => setEditor("new")}>Buat template</Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              {filtered.length} template
            </p>
            <div className="certificate-template-grid">
              {filtered.slice((page - 1) * 12, page * 12).map((t) => (
                <article className="certificate-template-card" key={t.id}>
                  <div className="certificate-template-art">
                    <Award size={34} />
                    <span>Syahadah</span>
                    <small>
                      {t.background_object_key ? "Latar PDF" : "A4 mendatar"}
                    </small>
                  </div>
                  <div className="space-y-3 p-4">
                    <CertificateBadge status={t.status} />
                    <h2>{t.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {programs.find((p) => p.id === t.program_id)?.name ??
                        "Program arsip"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditor(t)}
                      >
                        <Edit2 size={14} />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`${t.status === "active" ? "Arsipkan" : "Aktifkan"} ${t.name}`}
                        onClick={() => {
                          setMutationError("");
                          setConfirmation(t);
                        }}
                      >
                        <Archive size={14} />
                        {t.status === "active" ? "Arsipkan" : "Aktifkan"}
                      </Button>
                      {t.status === "active" && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            to={
                              certificatePath(
                                base,
                                "kelayakan",
                                t.program_id,
                                params.get("batch"),
                              ) + `&template=${t.id}`
                            }
                          >
                            Pakai
                            <ArrowRight size={14} />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="certificate-pagination">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => update("page", String(page - 1))}
              >
                Sebelumnya
              </Button>
              <span>
                {page} / {pages}
              </span>
              <Button
                variant="outline"
                disabled={page === pages}
                onClick={() => update("page", String(page + 1))}
              >
                Berikutnya
              </Button>
            </div>
          </>
        )}
      </section>
      {editor && (
        <CertificateTemplateDialog
          template={editor === "new" ? undefined : editor}
          programs={programs}
          initialProgram={program}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setNotice("Template tersimpan.");
            void load();
          }}
        />
      )}
      {confirmation && (
        <Dialog
          title={
            confirmation.status === "active"
              ? "Arsipkan template?"
              : "Aktifkan template?"
          }
          onClose={() => setConfirmation(null)}
          busy={busy}
        >
          <p>{confirmation.name}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Antrean dan dokumen yang sudah ada tetap tersimpan.
          </p>
          {mutationError && (
            <p role="alert" className="program-error">
              {mutationError}
            </p>
          )}
          <div className="workspace-dialog__footer">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              Batal
            </Button>
            <Button disabled={busy} onClick={() => void archive()}>
              {busy ? "Menyimpan…" : "Simpan status"}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
