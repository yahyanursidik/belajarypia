import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
  usersError,
  type UserList,
  type UserDetail,
  userFilters,
} from "./usersWorkspace";
export function useUsers(filters: ReturnType<typeof userFilters>) {
  const key = JSON.stringify(filters);
  const [record, setRecord] = useState<{ key: string; value: UserList } | null>(
      null,
    ),
    [roles, setRoles] = useState<UserList["roles"]>([]),
    [programs, setPrograms] = useState<UserList["programs"]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    try {
      const r = await supabase
        .rpc("system_users_list", { p_filters: JSON.parse(key) })
        .abortSignal(current.signal);
      if (r.error) throw r.error;
      if (
        !Array.isArray(r.data?.rows) ||
        !r.data?.stats ||
        !Array.isArray(r.data?.roles) ||
        !Array.isArray(r.data?.programs)
      )
        throw new Error("Daftar pengguna belum lengkap.");
      if (!current.signal.aborted) {
        setRecord({ key, value: r.data as UserList });
        setRoles(r.data.roles);
        setPrograms(r.data.programs);
      }
    } catch (e) {
      if (!current.signal.aborted) setError(usersError(e));
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [key]);
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);
  return {
    data: record?.key === key ? record.value : null,
    roles,
    programs,
    loading,
    error,
    load,
  };
}
export function useUserDetail(id: string | null) {
  const [data, setData] = useState<UserDetail | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    setData(null);
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
        .rpc("system_user_detail", { p_user: id })
        .abortSignal(c.signal);
      if (r.error) throw r.error;
      if (
        r.data?.profile?.id !== id ||
        !r.data?.revision ||
        !Array.isArray(r.data?.assignments) ||
        !r.data?.options ||
        !Array.isArray(r.data?.participants) ||
        !Array.isArray(r.data?.history)
      )
        throw new Error("Detail pengguna belum lengkap.");
      if (!c.signal.aborted) setData(r.data as UserDetail);
    } catch (e) {
      if (!c.signal.aborted) setError(usersError(e));
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);
  return {
    data: data?.profile.id === id ? data : null,
    loading,
    error,
    load,
    update: setData,
  };
}
