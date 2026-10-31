import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ImageIcon,
  Link2,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { PageHeader } from "../../components/admin/PageHeader";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { WizardSteps } from "../../components/ui/wizard-steps";
import { SettingsFields } from "../../components/settings/SettingsFields";
import { SettingsPreview } from "../../components/settings/SettingsPreview";
import { ParticipantTranscriptDialog } from "../../components/participants/ParticipantTranscriptDialog";
import {
  useSystemSettings,
  notifySystemSettingsChanged,
} from "../../lib/useSystemSettings";
import { readSystemSettings, type SystemSettings } from "../../lib/settings";
import { saveSettings, useSettingsRequestKey } from "../../lib/settingsData";
import { supabase } from "../../lib/supabase";
import {
  settingFields,
  settingsChanges,
  settingsDraft,
  settingsError,
  settingsPatch,
  settingsSections,
  validateSettings,
  type SettingsDraft,
  type SettingsSection,
} from "../../lib/settingsWorkspace";
const icons = {
  overview: Settings2,
  identity: Building2,
  branding: ImageIcon,
  themes: Palette,
  connections: Link2,
};
const date = (v: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(v));
export function GlobalSettingsPage() {
  const { settings, loading, error, refresh } = useSystemSettings();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const key = useSettingsRequestKey();
  if (loading) return <div className="settings-empty">Memuat pengaturan…</div>;
  if (error && !settings)
    return (
      <div className="settings-empty" role="alert">
        <h1>Pengaturan belum dapat dimuat</h1>
        <p>{error}</p>
        <Button onClick={() => void refresh()}>Coba lagi</Button>
      </div>
    );
  if (!settings)
    return (
      <div className="settings-empty">
        <Building2 size={30} />
        <h1>Siapkan identitas lembaga</h1>
        <p>Belum ada konfigurasi global.</p>
        {message && <p role="alert">{message}</p>}
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              const { data, error: problem } = await supabase.rpc(
                "admin_create_system_settings",
                { p_request_key: key("initial-settings") },
              );
              if (problem) throw problem;
              if (!data?.id) throw Error("Hasil belum terkonfirmasi.");
              notifySystemSettingsChanged();
              await refresh();
            } catch (e) {
              setMessage(settingsError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Menyiapkan…" : "Buat pengaturan awal"}
        </Button>
      </div>
    );
  return <SettingsWorkspace initial={settings} loadError={error} />;
}
function SettingsWorkspace({
  initial,
  loadError,
}: {
  initial: SystemSettings;
  loadError: string;
}) {
  const { user } = useAuthSession();
  const [params, setParams] = useSearchParams();
  const cacheKey = `ypia:settings:${user?.id ?? "session"}:${initial.id}`;
  const restored = useRef(false);
  const [start] = useState(() => {
    try {
      const c = JSON.parse(sessionStorage.getItem(cacheKey) ?? "null");
      if (
        c &&
        Date.now() - c.savedAt < 86400000 &&
        typeof c.version === "string" &&
        Number.isFinite(Date.parse(c.version)) &&
        c.draft &&
        c.before &&
        Object.keys(settingFields).every(
          (k) =>
            (typeof c.draft[k] === "string" || c.draft[k] === null) &&
            (typeof c.before[k] === "string" || c.before[k] === null),
        )
      ) {
        restored.current = true;
        return {
          baseline: {
            ...initial,
            ...settingsDraft({ ...initial, ...c.before }),
            updated_at: c.version,
          },
          draft: settingsDraft({ ...initial, ...c.draft }),
        };
      }
    } catch {
      /* Fall back to the saved record. */
    }
    return { baseline: initial, draft: settingsDraft(initial) };
  });
  const [baseline, setBaseline] = useState(start.baseline),
    [draft, setDraft] = useState<SettingsDraft>(start.draft);
  const [busy, setBusy] = useState(false),
    [uploadBusy, setUploadBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [cacheError, setCacheError] = useState(false);
  const [review, setReview] = useState(false),
    [reset, setReset] = useState(false),
    [transcript, setTranscript] = useState(false),
    [wizard, setWizard] = useState<number | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateSettings>>({});
  const key = useSettingsRequestKey();
  const raw = params.get("tab") ?? "overview";
  const section: SettingsSection = settingsSections.some((s) => s.id === raw)
    ? (raw as SettingsSection)
    : "overview";
  const changes = settingsChanges(baseline, draft),
    dirty = changes.length > 0;
  const locked = busy || uploadBusy;
  const remoteChanged =
    Date.parse(initial.updated_at) > Date.parse(baseline.updated_at);
  function changeSection(next: SettingsSection) {
    setParams(
      (current) => {
        const p = new URLSearchParams(current);
        if (next === "overview") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );
  }
  function change(next: SettingsDraft) {
    setDraft(next);
    setErrors({});
    setError("");
    setNotice("");
  }
  useEffect(() => {
    try {
      if (dirty)
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            savedAt: Date.now(),
            version: baseline.updated_at,
            before: settingsDraft(baseline),
            draft,
          }),
        );
      else sessionStorage.removeItem(cacheKey);
      setCacheError(false);
    } catch {
      setCacheError(true);
    }
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty, draft, baseline, cacheKey]);
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    const input =
      document.querySelector<HTMLInputElement>(
        '.settings-wizard-dialog[open] [aria-invalid="true"]',
      ) ??
      document.querySelector<HTMLInputElement>(
        '.settings-workspace [aria-invalid="true"]',
      );
    input?.focus();
  }, [errors]);
  async function reload() {
    setBusy(true);
    setError("");
    try {
      const s = await readSystemSettings();
      if (!s) throw Error("Pengaturan belum tersedia.");
      setBaseline(s);
      setDraft(settingsDraft(s));
      setErrors({});
      setNotice("Isian mengikuti pengaturan terakhir yang tersimpan.");
      restored.current = false;
      setReset(false);
      notifySystemSettingsChanged();
    } catch (e) {
      setError(settingsError(e));
    } finally {
      setBusy(false);
    }
  }
  function openReview() {
    const e = validateSettings(draft);
    setErrors(e);
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0] as keyof typeof settingFields;
      changeSection(settingFields[first].section);
      setError("Periksa isian yang ditandai.");
      return;
    }
    setError("");
    setReview(true);
  }
  async function save() {
    const e = validateSettings(draft);
    setErrors(e);
    if (Object.keys(e).length) {
      setError("Periksa isian yang ditandai.");
      return;
    }
    if (remoteChanged) {
      setError(
        "Pengaturan telah berubah. Muat ulang sebelum menyimpan. Isian Anda tetap tersedia.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const patch = settingsPatch(baseline, draft);
      if (!Object.keys(patch).length) return;
      const value = await saveSettings(
        baseline.id,
        patch,
        baseline.updated_at,
        key({ patch, stamp: baseline.updated_at }),
      );
      setBaseline(value);
      setDraft(settingsDraft(value));
      setReview(false);
      setWizard(null);
      restored.current = false;
      setNotice("Pengaturan tersimpan dan diterapkan.");
    } catch (e) {
      setError(settingsError(e));
    } finally {
      setBusy(false);
    }
  }
  const fieldProps = {
    draft,
    onChange: change,
    errors,
    disabled: locked,
    onUploadBusy: setUploadBusy,
  };
  const renderFields = (s: "identity" | "branding" | "themes") => (
    <SettingsFields section={s} {...fieldProps} />
  );
  const links = [
    {
      to: "/system/program",
      title: "Program & pembelajaran",
      desc: "Fitur, kurikulum, kelas dan kelulusan",
      tone: "sky",
    },
    {
      to: "/system/pendaftaran?tab=settings",
      title: "Form pendaftaran",
      desc: "Periode, pertanyaan dan grup peserta",
      tone: "violet",
    },
    {
      to: "/system/keuangan?tab=channels",
      title: "Rekening & QR",
      desc: "Tujuan biaya kelas, donasi dan wakaf",
      tone: "emerald",
    },
    {
      to: "/system/sertifikat",
      title: "Template sertifikat",
      desc: "Desain dan penomoran syahadah",
      tone: "amber",
    },
    {
      to: "/system/pengguna",
      title: "Akun & peran",
      desc: "Akses pengguna sesuai tugas",
      tone: "sky",
    },
    {
      to: "/system/audit",
      title: "Audit perubahan",
      desc: "Riwayat tindakan pengelola",
      tone: "violet",
    },
  ];
  return (
    <div className="page-stack settings-workspace">
      <PageHeader
        title="Pengaturan"
        actions={
          <>
            <span className={`settings-saved-state ${dirty ? "is-dirty" : ""}`}>
              <CheckCircle2 size={14} />
              {dirty ? `${changes.length} perubahan` : "Tersimpan"}
            </span>
            <Button
              variant="outline"
              disabled={locked}
              aria-label="Muat ulang pengaturan"
              onClick={() => (dirty ? setReset(true) : void reload())}
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              variant="outline"
              disabled={locked}
              onClick={() => setWizard(0)}
            >
              <WandSparkles size={16} />
              Panduan pengaturan
            </Button>
          </>
        }
      />
      {(loadError || error) && (
        <div className="program-error" role="alert">
          {error || loadError}
        </div>
      )}
      {notice && (
        <div className="program-notice" role="status">
          {notice}
        </div>
      )}
      {restored.current && (
        <p className="settings-local-note">
          Isian sebelumnya dipulihkan dari perangkat ini.
        </p>
      )}
      {cacheError && dirty && (
        <p className="program-error">
          Isian belum tersimpan di perangkat. Pertahankan halaman ini hingga
          berhasil disimpan.
        </p>
      )}
      {remoteChanged && (
        <div className="program-notice">
          Ada versi baru dari pengaturan.{" "}
          <Button
            size="sm"
            variant="ghost"
            disabled={locked}
            onClick={() => (dirty ? setReset(true) : void reload())}
          >
            Muat versi terbaru
          </Button>
        </div>
      )}
      <div className="settings-layout">
        <aside className="settings-navigation">
          <label className="settings-section-picker">
            Bagian pengaturan
            <select
              className="field-control"
              aria-label="Bagian pengaturan"
              disabled={locked}
              value={section}
              onChange={(e) => changeSection(e.target.value as SettingsSection)}
            >
              {settingsSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <nav aria-label="Bagian pengaturan">
            {settingsSections.map((s) => {
              const Icon = icons[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={locked}
                  aria-current={s.id === section ? "page" : undefined}
                  onClick={() => changeSection(s.id)}
                >
                  <Icon size={17} />
                  <span>{s.label}</span>
                  {changes.filter((c) => c.section === s.id).length > 0 && (
                    <i aria-label="Ada perubahan" />
                  )}
                </button>
              );
            })}
          </nav>
          <div className="settings-scope-note">
            <ShieldCheck size={17} />
            <strong>Berlaku untuk seluruh LMS</strong>
            <span>Terakhir disimpan</span>
            <time>{date(baseline.updated_at)} WIB</time>
          </div>
        </aside>
        <div className="settings-main">
          {section === "overview" ? (
            <>
              <div className="settings-overview-cards">
                {[
                  {
                    section: "identity" as const,
                    label: "Identitas & kontak",
                    icon: Building2,
                    value: !draft.institution_name
                      ? "Perlu diisi"
                      : draft.institution_name,
                    detail:
                      [
                        draft.contact_email ? "Email tersedia" : null,
                        draft.contact_phone ? "WhatsApp tersedia" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Kontak belum diisi",
                    tone: "sky",
                  },
                  {
                    section: "branding" as const,
                    label: "Logo & tampilan",
                    icon: ImageIcon,
                    value: `${[draft.logo_url, draft.login_logo_url, draft.favicon_url].filter(Boolean).length}/3 aset`,
                    detail: "Utama, login dan ikon browser",
                    tone: "violet",
                  },
                  {
                    section: "themes" as const,
                    label: "Warna portal",
                    icon: Palette,
                    value: "5 portal",
                    detail: "Admin, peserta, pengajar, musyrif, publik",
                    tone: "emerald",
                  },
                ].map((c) => (
                  <button
                    key={c.section}
                    className={`settings-overview-card settings-tone-${c.tone}`}
                    onClick={() => changeSection(c.section)}
                  >
                    <c.icon size={21} />
                    <span>{c.label}</span>
                    <strong>{c.value}</strong>
                    <small>{c.detail}</small>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
              <SettingsPreview key={baseline.updated_at} draft={draft} />
              <section className="settings-panel">
                <div className="settings-section-title">
                  <h2>Langkah berikutnya</h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => changeSection("connections")}
                  >
                    Semua pengaturan <ArrowRight size={14} />
                  </Button>
                </div>
                <div className="settings-checklist">
                  {[
                    {
                      label: "Identitas lembaga",
                      ok: !!draft.institution_name,
                      section: "identity" as const,
                    },
                    {
                      label: "Kontak bantuan",
                      ok: !!draft.contact_email || !!draft.contact_phone,
                      section: "identity" as const,
                    },
                    {
                      label: "Logo utama",
                      ok: !!draft.logo_url,
                      section: "branding" as const,
                    },
                    {
                      label: "Ikon browser",
                      ok: !!draft.favicon_url,
                      section: "branding" as const,
                    },
                  ].map((c) => (
                    <button
                      key={c.label}
                      onClick={() => changeSection(c.section)}
                    >
                      <CheckCircle2
                        size={17}
                        className={c.ok ? "text-emerald-600" : "text-slate-300"}
                      />
                      <span>{c.label}</span>
                      <small>{c.ok ? "Terisi" : "Lengkapi"}</small>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : section === "connections" ? (
            <div className="settings-form-stack">
              <div className="settings-linked-grid">
                {links.map((l) => (
                  <Link
                    className={`settings-linked-card settings-tone-${l.tone}`}
                    to={l.to}
                    key={l.to}
                  >
                    <h2>
                      {l.title}
                      <ArrowRight size={16} />
                    </h2>
                    <p>{l.desc}</p>
                  </Link>
                ))}
                <button
                  type="button"
                  className="settings-linked-card settings-tone-amber"
                  disabled={dirty || locked}
                  onClick={() => setTranscript(true)}
                >
                  <h2>
                    Template transkrip
                    <ArrowRight size={16} />
                  </h2>
                  <p>
                    {dirty
                      ? "Simpan perubahan global lebih dahulu"
                      : "Kop dokumen dan penandatangan"}
                  </p>
                </button>
              </div>
              <p className="settings-caption">
                Pengaturan program dan rekening dikelola pada modul terkait.
              </p>
            </div>
          ) : (
            <>
              {renderFields(section)}
              <SettingsPreview key={baseline.updated_at} draft={draft} />
            </>
          )}
        </div>
      </div>
      <footer className="settings-save-bar">
        <span>
          {dirty ? (
            <>
              <strong>{changes.length} perubahan belum disimpan</strong>
              <small>Tinjau sebelum diterapkan ke seluruh portal.</small>
            </>
          ) : (
            <>
              <strong>Pengaturan tersimpan</strong>
              <small>Hanya pilihan yang diubah akan disimpan.</small>
            </>
          )}
        </span>
        <div>
          {dirty && (
            <Button
              variant="outline"
              disabled={locked}
              onClick={() => setReset(true)}
            >
              <RotateCcw size={15} />
              Kembalikan
            </Button>
          )}
          <Button disabled={!dirty || locked} onClick={openReview}>
            <Save size={16} />
            {uploadBusy ? "Mengunggah…" : "Tinjau perubahan"}
          </Button>
        </div>
      </footer>
      {review && (
        <Dialog
          title="Tinjau perubahan"
          onClose={() => setReview(false)}
          busy={locked}
          className="settings-review-dialog"
        >
          <Changes changes={changes} />
          {error && (
            <p className="program-error" role="alert">
              {error}
            </p>
          )}
          <footer className="workspace-dialog__footer">
            <Button
              variant="outline"
              disabled={locked}
              onClick={() => setReview(false)}
            >
              Kembali
            </Button>
            <Button
              disabled={locked || !dirty || remoteChanged}
              onClick={() => void save()}
            >
              {busy ? "Menyimpan…" : "Simpan & terapkan"}
            </Button>
          </footer>
        </Dialog>
      )}
      {wizard !== null && (
        <Dialog
          title="Panduan pengaturan"
          onClose={() => setWizard(null)}
          busy={locked}
          className="settings-wizard-dialog"
        >
          <WizardSteps
            steps={["Identitas", "Tampilan", "Tema", "Tinjau"]}
            current={wizard}
          />
          {wizard < 3 ? (
            renderFields((["identity", "branding", "themes"] as const)[wizard])
          ) : (
            <>
              <Changes changes={changes} />
              <SettingsPreview key={baseline.updated_at} draft={draft} />
            </>
          )}
          {error && (
            <p className="program-error" role="alert">
              {error}
            </p>
          )}
          <footer className="workspace-dialog__footer">
            <Button
              variant="outline"
              disabled={locked}
              onClick={() =>
                wizard === 0 ? setWizard(null) : setWizard(wizard - 1)
              }
            >
              {wizard === 0 ? "Tutup & lanjut nanti" : "Kembali"}
            </Button>
            {wizard < 3 ? (
              <Button
                disabled={locked}
                onClick={() => {
                  const e = validateSettings(draft);
                  const current = (["identity", "branding", "themes"] as const)[
                    wizard
                  ];
                  const relevant = Object.entries(e).filter(
                    ([k]) =>
                      settingFields[k as keyof typeof settingFields].section ===
                      current,
                  );
                  setErrors(e);
                  if (!relevant.length) {
                    setError("");
                    setWizard(wizard + 1);
                  } else setError("Periksa isian yang ditandai.");
                }}
              >
                Lanjut
              </Button>
            ) : (
              <Button
                disabled={locked || !dirty || remoteChanged}
                onClick={() => void save()}
              >
                {busy ? "Menyimpan…" : "Simpan & terapkan"}
              </Button>
            )}
          </footer>
        </Dialog>
      )}
      {reset && (
        <Dialog
          title="Muat pengaturan terakhir?"
          busy={busy}
          onClose={() => setReset(false)}
        >
          <p>
            Isian yang belum disimpan di halaman ini akan diganti dengan versi
            tersimpan.
          </p>
          <footer className="workspace-dialog__footer">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setReset(false)}
            >
              Lanjut mengedit
            </Button>
            <Button disabled={busy} onClick={() => void reload()}>
              {busy ? "Memuat…" : "Muat & ganti isian"}
            </Button>
          </footer>
        </Dialog>
      )}
      {transcript && (
        <ParticipantTranscriptDialog
          onClose={() => {
            setTranscript(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}
function Changes({ changes }: { changes: ReturnType<typeof settingsChanges> }) {
  return (
    <div className="settings-change-list">
      <p className="settings-caption">
        Berlaku untuk seluruh portal setelah disimpan.
      </p>
      {changes.length ? (
        changes.map((c) => (
          <div key={c.label}>
            <strong>{c.label}</strong>
            <span>
              {c.key.endsWith("_url") && c.before.startsWith("https://")
                ? assetSource(c.before)
                : c.before}
            </span>
            <ArrowRight size={15} />
            <b>
              {c.key.endsWith("_url") && c.after.startsWith("https://")
                ? assetSource(c.after)
                : c.after}
            </b>
          </div>
        ))
      ) : (
        <p>Tidak ada perubahan yang perlu disimpan.</p>
      )}
    </div>
  );
}

function assetSource(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "Gambar sebelumnya";
  }
}
