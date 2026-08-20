import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { emptySettings, type SystemSettings } from "./settings";

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("*")
          .limit(1)
          .single();

        if (error) throw error;
        if (data) {
          setSettings({ ...emptySettings, ...(data as SystemSettings) });
        }
      } catch (err) {
        console.error("Failed to fetch system settings:", err);
      } finally {
        setLoading(false);
      }
    }

    const handleSettingsUpdated = () => {
      void fetchSettings();
    };

    void fetchSettings();
    window.addEventListener("ypia-system-settings-updated", handleSettingsUpdated);
    return () => window.removeEventListener("ypia-system-settings-updated", handleSettingsUpdated);
  }, []);

  return { settings, loading };
}
