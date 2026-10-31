import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import {
  auditError,
  type AuditList,
  type AuditFilters,
  type AuditDetail,
} from "./auditWorkspace";
export function useAuditList(filters: AuditFilters, enabled: boolean) {
  const key = JSON.stringify(filters),
    [record, setRecord] = useState<{ key: string; value: AuditList } | null>(
      null,
    ),
    [options, setOptions] = useState<{ actions: string[]; entities: string[] }>(
      { actions: [], entities: [] },
    ),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    if (!enabled) {
      setLoading(false);
      return;
    }
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    setError("");
    try {
      const r = await supabase
        .rpc("system_audit_list", { p_filters: JSON.parse(key) })
        .abortSignal(c.signal);
      if (r.error) throw r.error;
      if (
        !Array.isArray(r.data?.rows) ||
        !r.data?.stats ||
        !Array.isArray(r.data.actions) ||
        !Array.isArray(r.data.entities)
      )
        throw new Error("Data Audit belum lengkap.");
      if (!c.signal.aborted) {
        setRecord({ key, value: r.data });
        setOptions({ actions: r.data.actions, entities: r.data.entities });
      }
    } catch (e) {
      if (!c.signal.aborted) setError(auditError(e));
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [key, enabled]);
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);
  return {
    data: record?.key === key ? record.value : null,
    options,
    loading,
    error,
    load,
  };
}
export function useAuditDetail(id: string | null) {
  const [record, setRecord] = useState<AuditDetail | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    setRecord(null);
    setError("");
    if (!id) {
      setLoading(false);
      return;
    }
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    try {
      const r = await supabase
        .rpc("system_audit_detail", { p_id: id })
        .abortSignal(c.signal);
      if (r.error) throw r.error;
      if (r.data?.id !== id || !r.data.context)
        throw new Error("Detail audit belum lengkap.");
      if (!c.signal.aborted) setRecord(r.data);
    } catch (e) {
      if (!c.signal.aborted) setError(auditError(e));
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);
  return { data: record?.id === id ? record : null, loading, error, load };
}
