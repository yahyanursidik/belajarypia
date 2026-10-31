import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Upload, ImageIcon, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { BrandMark } from "../BrandMark";
import {
  THEME_OPTIONS,
  type PortalThemeConfig,
  type ThemeKey,
} from "../../lib/theme";
import {
  settingFields,
  portalNames,
  portalColorNames,
  settingsFileError,
  settingsError,
  type SettingsDraft,
  type SettingField,
} from "../../lib/settingsWorkspace";
import { uploadBrandAsset } from "../../lib/settingsData";
type Props = {
  draft: SettingsDraft;
  onChange: (value: SettingsDraft) => void;
  errors: Partial<Record<SettingField, string>>;
  disabled: boolean;
  onUploadBusy: (v: boolean) => void;
};
export function SettingsFields({
  draft,
  onChange,
  errors,
  disabled,
  onUploadBusy,
  section,
}: { section: "identity" | "branding" | "themes" } & Props) {
  function field(key: SettingField, multiline = false) {
    const c = settingFields[key];
    return (
      <label key={key} className="settings-field">
        {c.label}
        {key === "institution_name" && <span aria-hidden="true"> *</span>}
        {multiline ? (
          <textarea
            className="field-control"
            aria-label={c.label}
            rows={3}
            maxLength={c.max}
            value={draft[key] ?? ""}
            disabled={disabled}
            aria-invalid={!!errors[key]}
            onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
          />
        ) : (
          <Input
            aria-label={c.label}
            required={key === "institution_name"}
            maxLength={c.max}
            value={draft[key] ?? ""}
            disabled={disabled}
            type={key === "contact_email" ? "email" : "text"}
            aria-invalid={!!errors[key]}
            onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
          />
        )}
        <small className={errors[key] ? "settings-field-error" : ""}>
          {errors[key] ||
            (key === "institution_name" || multiline
              ? `${(draft[key] ?? "").length}/${c.max}`
              : "")}
        </small>
      </label>
    );
  }
  if (section === "identity")
    return (
      <div className="settings-form-stack">
        <section className="settings-panel">
          <h2>Lembaga</h2>
          {field("institution_name")}
          {field("institution_profile", true)}
        </section>
        <section className="settings-panel">
          <h2>Kontak bantuan</h2>
          <div className="settings-form-grid">
            {field("contact_email")}
            {field("contact_phone")}
          </div>
          {field("address", true)}
          <p className="settings-caption">
            Dipakai di Bantuan peserta. Nomor 08… otomatis menjadi +62.
          </p>
        </section>
      </div>
    );
  if (section === "branding")
    return (
      <div className="settings-form-stack">
        <section className="settings-panel">
          <h2>Teks tampilan</h2>
          <div className="settings-form-grid">
            {field("app_sidebar_title")}
            {field("app_sidebar_subtitle")}
            {field("system_header_title")}
            {field("system_header_subtitle")}
          </div>
        </section>
        <section className="settings-panel">
          <div className="settings-section-title">
            <h2>Logo & ikon</h2>
            <span className="settings-caption">
              PNG, JPG, WebP · maks. 2 MB
            </span>
          </div>
          <div className="settings-assets">
            {(["logo_url", "login_logo_url", "favicon_url"] as const).map(
              (key) => (
                <SettingsAsset
                  key={key}
                  field={key}
                  value={draft[key] ?? null}
                  disabled={disabled}
                  error={errors[key]}
                  onChange={(value) => onChange({ ...draft, [key]: value })}
                  onBusy={onUploadBusy}
                />
              ),
            )}
          </div>
        </section>
      </div>
    );
  return (
    <div className="settings-form-stack">
      {(Object.keys(portalNames) as Array<keyof PortalThemeConfig>).map(
        (portal) => (
          <section className="settings-panel" key={portal}>
            <div className="settings-section-title">
              <h2>{portalNames[portal]}</h2>
              <span className="settings-caption">
                {portal === "public"
                  ? "Login, pendaftaran & halaman publik"
                  : portal === "admin"
                    ? "Superadmin, admin & operasional"
                    : "Portal " + portalNames[portal].toLowerCase()}
              </span>
            </div>
            <div
              role="group"
              aria-label={`Warna ${portalNames[portal]}`}
              className="settings-theme-options"
            >
              {THEME_OPTIONS.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={draft.portal_themes[portal] === theme.id}
                  aria-label={`${portalNames[portal]}: ${portalColorNames[theme.id as ThemeKey]}`}
                  onClick={() =>
                    onChange({
                      ...draft,
                      portal_themes: {
                        ...draft.portal_themes,
                        [portal]: theme.id as ThemeKey,
                      },
                    })
                  }
                >
                  <i className={theme.color} />
                  <span>{portalColorNames[theme.id as ThemeKey]}</span>
                  {draft.portal_themes[portal] === theme.id && (
                    <span aria-hidden="true">✓</span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
function SettingsAsset({
  field,
  value,
  onChange,
  disabled,
  error,
  onBusy,
}: {
  field: "logo_url" | "login_logo_url" | "favicon_url";
  value: string | null;
  onChange: (v: string | null) => void;
  disabled: boolean;
  error?: string;
  onBusy: (v: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [preview, setPreview] = useState<{ value: string; url: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = settingsFileError(file);
    if (problem) {
      setMessage(problem + " Gambar sebelumnya tetap dipakai.");
      return;
    }
    setMessage("");
    setBusy(true);
    onBusy(true);
    let url = "";
    try {
      url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      if (!img.width || !img.height || img.width > 4096 || img.height > 4096)
        throw Error("Dimensi gambar maksimal 4.096 × 4.096 piksel.");
      const remote = await uploadBrandAsset(file);
      if (!mounted.current) return;
      setPreview({ value: remote, url });
      onChange(remote);
      url = "";
      setMessage("Gambar siap. Tinjau dan simpan untuk menerapkan.");
    } catch (e) {
      if (mounted.current)
        setMessage(settingsError(e) + " Gambar sebelumnya tetap dipakai.");
    } finally {
      if (url) URL.revokeObjectURL(url);
      if (mounted.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  return (
    <article className="settings-asset">
      <h3>{settingFields[field].label}</h3>
      <div className="settings-asset-preview">
        <BrandMark
          allowBlob={preview?.value === value}
          src={preview?.value === value ? preview.url : value}
          fallback={<ImageIcon size={28} />}
        />
      </div>
      <div className="settings-asset-actions">
        <label
          className={`settings-upload-button ${disabled ? "is-disabled" : ""}`}
        >
          <Upload size={14} />
          {busy ? "Mengunggah…" : value ? "Ganti gambar" : "Pilih gambar"}
          <input
            type="file"
            aria-label={`Unggah ${settingFields[field].label}`}
            disabled={disabled || busy}
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => void upload(e)}
          />
        </label>
        {value && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Kosongkan ${settingFields[field].label}`}
            disabled={disabled}
            onClick={() => {
              onChange(null);
              setMessage("Gambar akan dilepas setelah disimpan.");
            }}
          >
            <X size={15} />
          </Button>
        )}
      </div>
      <details>
        <summary>Gunakan URL gambar</summary>
        <Input
          aria-label={`URL ${settingFields[field].label}`}
          value={value ?? ""}
          disabled={disabled}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value || null)}
        />
      </details>
      {(error || message) && (
        <p role={error ? "alert" : "status"} className="settings-caption">
          {error || message}
        </p>
      )}
      <p className="settings-caption">
        {field === "logo_url"
          ? "Sidebar dan dokumen"
          : field === "login_logo_url"
            ? "Login; kosong memakai logo utama"
            : "Tab browser; PNG 32 × 32 disarankan"}
      </p>
    </article>
  );
}
