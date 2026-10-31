import { useEffect, useState } from "react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { WizardSteps } from "../ui/wizard-steps";
import { supabase } from "../../lib/supabase";
import {
  certificateError,
  certificateLayout,
  validateCertificateTemplate,
  type CertificateProgram,
  type CertificateTemplate,
  type CertificateLayout,
} from "../../lib/certificateWorkspace";
export function CertificateTemplateDialog({
  template,
  programs,
  initialProgram,
  onClose,
  onSaved,
}: {
  template?: CertificateTemplate;
  programs: CertificateProgram[];
  initialProgram: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuthSession();
  const key = `ypia:certificate-template:${user?.id}:${template?.id ?? initialProgram}`;
  const initial = {
    name: template?.name ?? "",
    program:
      template?.program_id ?? (initialProgram === "all" ? "" : initialProgram),
    layout: certificateLayout(template?.template_data_json ?? null),
    background: template?.background_object_key ?? "",
    status: template?.status ?? "active",
  };
  const [form, setForm] = useState(initial);
  const [baseline] = useState(JSON.stringify(initial));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      if (
        cached?.layout &&
        typeof cached.name === "string" &&
        typeof cached.program === "string" &&
        typeof cached.background === "string" &&
        ["active", "archived"].includes(cached.status)
      ) {
        setForm({
          ...cached,
          layout: Object.fromEntries(
            Object.keys(certificateLayout(null)).map((key) => [
              key,
              typeof cached.layout[key] === "number" ? cached.layout[key] : NaN,
            ]),
          ) as CertificateLayout,
        });
        setRestored(true);
      }
    } catch {
      /* Keep server state. */
    }
  }, [key]);
  const dirty = JSON.stringify(form) !== baseline;
  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify(form));
      else sessionStorage.removeItem(key);
    } catch {
      /* Keep in-memory draft. */
    }
  }, [dirty, form, key]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const patch = (value: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...value }));
    setError("");
  };
  const validate = () =>
    validateCertificateTemplate(
      form.name,
      form.program,
      form.layout,
      form.background,
    );
  const close = () => {
    if (dirty) setDiscard(true);
    else onClose();
  };
  async function save() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error: problem } = await supabase.rpc(
        "admin_save_certificate_template",
        {
          p_id: template?.id ?? null,
          p_expected_updated_at: template?.updated_at ?? null,
          p_program_id: form.program,
          p_name: form.name.trim(),
          p_data: { ...(template?.template_data_json ?? {}), ...form.layout },
          p_background: form.background.trim() || null,
          p_status: form.status,
        },
      );
      if (problem) throw problem;
      if (!data?.id) throw new Error("Simpan belum terkonfirmasi.");
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Optional cache. */
      }
      onSaved();
    } catch (problem) {
      setError(
        certificateError(problem, "Template belum tersimpan. Coba lagi."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={template ? "Edit template" : "Buat template"}
      onClose={close}
      busy={busy}
      className="certificate-template-dialog"
    >
      <WizardSteps
        steps={["Identitas", "Tata letak", "Tinjau"]}
        current={step}
      />
      {restored && (
        <p role="status" className="admission-notice">
          Draf template dipulihkan.
        </p>
      )}
      {error && (
        <p role="alert" className="program-error">
          {error}
        </p>
      )}
      {step === 0 && (
        <div className="space-y-4">
          <label className="certificate-field">
            Program
            <select
              aria-label="Program template"
              className="field-control"
              disabled={!!template || busy}
              value={form.program}
              onChange={(e) => patch({ program: e.target.value })}
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
            Nama template
            <Input
              value={form.name}
              disabled={busy}
              maxLength={160}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Syahadah Tahsin Reguler"
            />
          </label>
          <label className="certificate-field">
            Status
            <select
              aria-label="Status template"
              className="field-control"
              value={form.status}
              onChange={(e) =>
                patch({ status: e.target.value as "active" | "archived" })
              }
            >
              <option value="active">Aktif</option>
              <option value="archived">Arsip</option>
            </select>
          </label>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-5">
          <div
            className="certificate-layout-preview"
            aria-label="Pratinjau tata letak A4 mendatar"
          >
            <span className="certificate-preview-caption">
              Pratinjau posisi teks · A4 mendatar
            </span>
            <span
              style={{
                left: `${(form.layout.name_x / 842) * 100}%`,
                bottom: `${(form.layout.name_y / 595) * 100}%`,
                fontSize: `clamp(8px,${(form.layout.name_size / 842) * 60}vw,${form.layout.name_size * 0.65}px)`,
              }}
            >
              Nama Peserta
            </span>
            <span
              style={{
                left: `${(form.layout.no_x / 842) * 100}%`,
                bottom: `${(form.layout.no_y / 595) * 100}%`,
                fontSize: `clamp(7px,${(form.layout.no_size / 842) * 60}vw,${form.layout.no_size * 0.65}px)`,
              }}
            >
              No: YPIA-SYH-CONTOH
            </span>
          </div>
          {(["name", "no"] as const).map((prefix) => (
            <fieldset className="certificate-coordinate-fields" key={prefix}>
              <legend>
                {prefix === "name" ? "Nama peserta" : "Nomor sertifikat"}
              </legend>
              {(["x", "y", "size"] as const).map((part) => {
                const k = `${prefix}_${part}` as keyof CertificateLayout;
                return (
                  <label key={k}>
                    {part === "x"
                      ? "Posisi horizontal"
                      : part === "y"
                        ? "Posisi vertikal"
                        : "Ukuran teks"}
                    <Input
                      type="number"
                      aria-label={`${prefix === "name" ? "Nama" : "Nomor"} ${part}`}
                      min={part === "size" ? 6 : 0}
                      max={part === "x" ? 842 : part === "y" ? 595 : 72}
                      value={Number.isNaN(form.layout[k]) ? "" : form.layout[k]}
                      onChange={(e) =>
                        patch({
                          layout: {
                            ...form.layout,
                            [k]:
                              e.target.value === ""
                                ? NaN
                                : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                );
              })}
            </fieldset>
          ))}
          <details className="program-disclosure">
            <summary>Dokumen latar (opsional)</summary>
            <div className="p-4 space-y-2">
              <label className="certificate-field">
                Path PDF di penyimpanan
                <Input
                  aria-label="Dokumen latar PDF"
                  value={form.background}
                  onChange={(e) => patch({ background: e.target.value })}
                  placeholder="certificates/backgrounds/syahadah.pdf"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Gunakan PDF A4 mendatar. Kosongkan untuk halaman putih.
              </p>
            </div>
          </details>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <dl className="certificate-summary">
            <div>
              <dt>Program</dt>
              <dd>
                {programs.find((p) => p.id === form.program)?.name ?? "—"}
              </dd>
            </div>
            <div>
              <dt>Template</dt>
              <dd>{form.name}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{form.status === "active" ? "Aktif" : "Arsip"}</dd>
            </div>
            <div>
              <dt>Latar</dt>
              <dd>{form.background ? "PDF penyimpanan" : "Halaman putih"}</dd>
            </div>
            <div>
              <dt>Nama peserta</dt>
              <dd>
                {form.layout.name_x}, {form.layout.name_y} ·{" "}
                {form.layout.name_size} pt
              </dd>
            </div>
            <div>
              <dt>Nomor</dt>
              <dd>
                {form.layout.no_x}, {form.layout.no_y} · {form.layout.no_size}{" "}
                pt
              </dd>
            </div>
          </dl>
          <p className="program-notice">
            Perubahan template digunakan untuk antrean baru.
          </p>
        </div>
      )}
      <footer className="workspace-dialog__footer">
        <Button
          variant="outline"
          disabled={busy}
          onClick={step ? () => setStep(step - 1) : close}
        >
          {step ? "Kembali" : "Tutup"}
        </Button>
        {step < 2 ? (
          <Button
            disabled={busy}
            onClick={() => {
              const message =
                step === 0
                  ? !form.name.trim() || !form.program
                    ? "Pilih program dan isi nama template."
                    : ""
                  : validate();
              if (message) setError(message);
              else {
                setError("");
                setStep(step + 1);
              }
            }}
          >
            Lanjut
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Menyimpan…" : "Simpan template"}
          </Button>
        )}
      </footer>
      {discard && (
        <Dialog
          title="Tutup editor template?"
          onClose={() => setDiscard(false)}
        >
          <p>Draf tetap tersimpan di browser ini.</p>
          <div className="workspace-dialog__footer">
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Lanjut mengedit
            </Button>
            <Button onClick={onClose}>Tutup editor</Button>
            <Button
              variant="outline"
              onClick={() => {
                sessionStorage.removeItem(key);
                onClose();
              }}
            >
              Buang draf
            </Button>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}
