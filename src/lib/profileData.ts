import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { profileError, type ProfileWorkspace } from "./profileWorkspace";
export function useMyProfile(userId: string | undefined) {
  const [record, setRecord] = useState<ProfileWorkspace | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    setError("");
    if (!userId) {
      setLoading(false);
      return null;
    }
    const c = new AbortController();
    request.current = c;
    setLoading(true);
    try {
      const r = await supabase
        .rpc("my_profile_workspace")
        .abortSignal(c.signal);
      if (r.error) throw r.error;
      if (
        r.data?.profile?.id !== userId ||
        !r.data.revision ||
        !r.data.login ||
        !Array.isArray(r.data.assignments) ||
        !Array.isArray(r.data.history)
      )
        throw new Error("Data profil belum lengkap. Coba muat ulang.");
      if (!c.signal.aborted) {
        setRecord(r.data);
        return r.data as ProfileWorkspace;
      }
      return null;
    } catch (e) {
      if (!c.signal.aborted) setError(profileError(e));
      return null;
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  return {
    data: record?.profile.id === userId ? record : null,
    loading,
    error,
    load,
    update: setRecord,
  };
}
