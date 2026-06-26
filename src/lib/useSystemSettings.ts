import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { SystemSettings } from "./settings";

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
          setSettings(data as SystemSettings);
        }
      } catch (err) {
        console.error("Failed to fetch system settings:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return { settings, loading };
}
