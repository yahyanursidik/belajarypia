import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
  learnerError,
  type LearnerPortal,
  type LearnerOutline,
} from "./learnerWorkspace";
import { useAuthSession } from "../app/providers/authSessionContext";
export async function loadLearnerOutline(
  program: string,
  signal?: AbortSignal,
) {
  const r = await supabase
    .rpc("learner_program_outline", { p_program: program })
    .abortSignal(signal ?? new AbortController().signal);
  if (r.error) throw r.error;
  if (
    r.data?.program?.id !== program ||
    !Array.isArray(r.data.lessons) ||
    !Array.isArray(r.data.modules) ||
    !Array.isArray(r.data.progress) ||
    !Array.isArray(r.data.requirements) ||
    !Array.isArray(r.data.attempts)
  )
    throw new Error("Struktur belajar belum lengkap.");
  return r.data as LearnerOutline;
}
export function useLearnerPortal() {
  const { user } = useAuthSession();
  const [record, setRecord] = useState<{
      user: string;
      data: LearnerPortal;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    request = useRef<AbortController | null>(null);
  const id = user?.id;
  const load = useCallback(async () => {
    request.current?.abort();
    if (!id) {
      setLoading(false);
      return;
    }
    const c = new AbortController();
    request.current = c;
    setLoading(true);
    setError("");
    try {
      const r = await supabase
        .rpc("learner_portal_workspace")
        .abortSignal(c.signal);
      if (r.error) throw r.error;
      if (!Array.isArray(r.data?.enrollments) || !r.data.generated_at)
        throw new Error("Data belajar belum lengkap.");
      if (!c.signal.aborted) setRecord({ user: id, data: r.data });
    } catch (e) {
      if (!c.signal.aborted) setError(learnerError(e));
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  return {
    data: record && record.user === id ? record.data : null,
    loading,
    error,
    load,
  };
}
