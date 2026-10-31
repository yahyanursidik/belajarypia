import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { dashboardError, type DashboardData } from "./dashboardWorkspace";
export function useSystemDashboard(program: string | null, days: number) {
  const key = `${program ?? "all"}:${days}`;
  const [record, setRecord] = useState<{
    key: string;
    data: DashboardData;
  } | null>(null);
  const [programs, setPrograms] = useState<DashboardData["programs"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const r = await supabase
        .rpc("system_dashboard_summary", {
          p_program_id: program,
          p_days: days,
        })
        .abortSignal(controller.signal);
      if (r.error) throw r.error;
      if (
        !r.data?.generated_at ||
        !r.data?.summary ||
        !Array.isArray(r.data?.daily) ||
        !Array.isArray(r.data?.programs) ||
        !r.data?.queues ||
        !r.data?.learning ||
        !r.data?.admission ||
        !r.data?.onboarding ||
        !r.data?.global ||
        !Array.isArray(r.data?.program_activity) ||
        !Array.isArray(r.data?.recent_audit) ||
        !Array.isArray(r.data?.notification_failures)
      )
        throw new Error("Ringkasan dashboard belum terkonfirmasi.");
      if (!controller.signal.aborted) {
        setRecord({ key, data: r.data as DashboardData });
        setPrograms(r.data.programs);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(dashboardError(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [program, days, key]);
  useEffect(() => {
    void load();
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const interval = setInterval(visible, 60000);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      request.current?.abort();
      clearInterval(interval);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  return {
    data: record?.key === key ? record.data : null,
    programs,
    loading,
    error,
    load,
  };
}
