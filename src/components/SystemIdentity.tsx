import { useEffect } from "react";
import { useSystemSettings } from "../lib/useSystemSettings";
import { validAssetUrl } from "../lib/settingsWorkspace";
export function SystemIdentity() {
  const { settings } = useSystemSettings();
  useEffect(() => {
    if (!settings) return;
    document.title = `${settings.institution_name || "YPIA"} · LMS`;
    const old =
      document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!settings.favicon_url || !validAssetUrl(settings.favicon_url)) {
      if (old?.dataset.ypia === "true") {
        old.href = "/favicon.svg";
        old.type = "image/svg+xml";
        delete old.dataset.ypia;
      }
      return;
    }
    const icon = old ?? document.createElement("link");
    icon.rel = "icon";
    icon.href = settings.favicon_url;
    icon.dataset.ypia = "true";
    icon.removeAttribute("type");
    if (!old) document.head.append(icon);
  }, [settings]);
  return null;
}
