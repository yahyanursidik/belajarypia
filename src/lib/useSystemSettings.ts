import { useEffect, useSyncExternalStore } from "react";
import { readSystemSettings, type SystemSettings } from "./settings";
import { normalizeThemes, settingsError } from "./settingsWorkspace";
type Snapshot = {
  settings: SystemSettings | null;
  loading: boolean;
  error: string;
};
let snapshot: Snapshot = { settings: null, loading: true, error: "" };
let loaded = false;
let inflight: Promise<void> | null = null;
let channel: BroadcastChannel | null = null;
let subscribers = 0;
const listeners = new Set<() => void>();
function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((f) => f());
}
export function reloadSystemSettings() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const data = await readSystemSettings();
      publish({
        settings: data
          ? { ...data, portal_themes: normalizeThemes(data.portal_themes) }
          : null,
        loading: false,
        error: "",
      });
      loaded = true;
    } catch (e) {
      publish({ ...snapshot, loading: false, error: settingsError(e) });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
function visible() {
  if (document.visibilityState === "visible") void reloadSystemSettings();
}
function refresh() {
  void reloadSystemSettings();
}
function subscribe(callback: () => void) {
  listeners.add(callback);
  subscribers++;
  if (subscribers === 1) {
    window.addEventListener("ypia-system-settings-updated", refresh);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    try {
      channel = new BroadcastChannel("ypia-settings-updated");
      channel.onmessage = refresh;
    } catch {
      /* Focus still refreshes settings without BroadcastChannel. */
    }
  }
  return () => {
    listeners.delete(callback);
    subscribers--;
    if (subscribers === 0) {
      window.removeEventListener("ypia-system-settings-updated", refresh);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
      channel?.close();
      channel = null;
    }
  };
}
export function notifySystemSettingsChanged() {
  window.dispatchEvent(new Event("ypia-system-settings-updated"));
  channel?.postMessage("updated");
}
export function useSystemSettings() {
  const value = useSyncExternalStore(subscribe, () => snapshot);
  useEffect(() => {
    if (!loaded) void reloadSystemSettings();
  }, []);
  return { ...value, refresh: reloadSystemSettings };
}
