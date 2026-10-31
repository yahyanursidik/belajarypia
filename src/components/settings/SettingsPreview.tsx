import { useState } from "react";
import { BookOpen, CheckCircle2, Menu } from "lucide-react";
import { BrandMark } from "../BrandMark";
import { getThemeStyles, type PortalThemeConfig } from "../../lib/theme";
import { portalNames, type SettingsDraft } from "../../lib/settingsWorkspace";
export function SettingsPreview({ draft }: { draft: SettingsDraft }) {
  const [portal, setPortal] = useState<keyof PortalThemeConfig>("learner");
  return (
    <section className="settings-preview">
      <div className="settings-section-title">
        <h2>Pratinjau portal</h2>
        <select
          aria-label="Portal pratinjau"
          className="field-control"
          value={portal}
          onChange={(e) => setPortal(e.target.value as keyof PortalThemeConfig)}
        >
          {Object.entries(portalNames).map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {portal === "public" ? (
        <div
          className="settings-preview-public"
          style={getThemeStyles(draft.portal_themes.public)}
        >
          <div className="settings-preview-public-brand">
            <span className="settings-preview-brand">
              <BrandMark
                src={draft.login_logo_url || draft.logo_url}
                fallback={<BookOpen size={20} />}
              />
            </span>
            <strong>{draft.institution_name || "YPIA"}</strong>
          </div>
          <div className="settings-preview-public-card">
            <small>PORTAL PUBLIK</small>
            <h3>Masuk ke ruang belajar</h3>
            <span>Email akun</span>
            <div className="settings-preview-input">nama@contoh.id</div>
            <span>Kata sandi</span>
            <div className="settings-preview-input">••••••••••</div>
            <button type="button" tabIndex={-1}>
              Masuk
            </button>
          </div>
        </div>
      ) : (
        <div
          className="settings-preview-shell"
          style={getThemeStyles(draft.portal_themes[portal])}
        >
          <div className="settings-preview-sider">
            <span className="settings-preview-brand">
              <BrandMark
                src={draft.logo_url}
                fallback={<BookOpen size={20} />}
              />
            </span>
            <strong>{draft.app_sidebar_title || "YPIA"}</strong>
            <small>{draft.app_sidebar_subtitle || "Portal Pembelajaran"}</small>
            <span className="settings-preview-menu">
              <Menu size={14} />
              Beranda
            </span>
            <span>Program belajar</span>
            <span>Pengumuman</span>
          </div>
          <div className="settings-preview-main">
            <small>{portalNames[portal]}</small>
            <h3>
              {portal === "admin"
                ? draft.system_header_title || "Pusat Kendali Sistem"
                : portal === "teacher"
                  ? "Ruang mengajar Anda"
                  : portal === "mentor"
                    ? "Pendampingan Anda"
                    : "Ruang belajar Anda"}
            </h3>
            <p>
              {portal === "admin"
                ? draft.system_header_subtitle || "Tata Kelola & Pemantauan LMS"
                : "Lanjutkan kegiatan hari ini."}
            </p>
            <div className="settings-preview-progress">
              <BookOpen size={22} />
              <strong>Program belajar</strong>
              <span>Progres pembelajaran</span>
              <i />
              <button type="button" tabIndex={-1}>
                Lanjutkan <CheckCircle2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="settings-caption">Simulasi warna dan identitas.</p>
    </section>
  );
}
