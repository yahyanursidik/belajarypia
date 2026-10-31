import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
  announcementError,
  sortAnnouncements,
  type Announcement,
  type AnnouncementClass,
  type AnnouncementProgram,
} from "./announcementWorkspace";
export async function announcementRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  if (data === null || data === undefined)
    throw new Error(
      "Hasil belum terkonfirmasi. Muat ulang sebelum mencoba lagi.",
    );
  return data as T;
}
export function useAnnouncementData(mode: "manage" | "inbox") {
  const [items, setItems] = useState<Announcement[]>([]);
  const [programs, setPrograms] = useState<AnnouncementProgram[]>([]);
  const [classes, setClasses] = useState<AnnouncementClass[]>([]);
  const [globalAllowed, setGlobalAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const loaded = useRef(false);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (!loaded.current) setLoading(true);
    setError("");
    try {
      const rows: Announcement[] = [];
      for (let offset = 0; ; offset += 500) {
        const r = await supabase
          .rpc(
            mode === "manage" ? "admin_list_announcements" : "my_announcements",
            { p_offset: offset, p_limit: 500 },
          )
          .abortSignal(controller.signal);
        if (r.error) throw r.error;
        rows.push(...((r.data ?? []) as Announcement[]));
        if ((r.data?.length ?? 0) < 500) break;
      }
      if (mode === "manage") {
        const options = await supabase
          .rpc("admin_announcement_options")
          .abortSignal(controller.signal);
        if (options.error) throw options.error;
        if (!controller.signal.aborted) {
          setGlobalAllowed(options.data?.global_allowed === true);
          setPrograms(options.data?.programs ?? []);
          setClasses(options.data?.classes ?? []);
        }
      }
      if (!controller.signal.aborted) setItems(sortAnnouncements(rows));
    } catch (problem) {
      if (!controller.signal.aborted) {
        setItems([]);
        setError(announcementError(problem));
      }
    } finally {
      if (!controller.signal.aborted) {
        loaded.current = true;
        setLoading(false);
      }
    }
  }, [mode]);
  useEffect(() => {
    void load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    function reloadVisible() {
      if (document.visibilityState === "visible") void load();
    }
    function changed() {
      clearTimeout(timer);
      timer = setTimeout(reloadVisible, 180);
    }
    const channel = supabase
      .channel(`announcement-${mode}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        changed,
      )
      .subscribe();
    const interval = setInterval(reloadVisible, 60000);
    window.addEventListener("focus", reloadVisible);
    document.addEventListener("visibilitychange", reloadVisible);
    return () => {
      request.current?.abort();
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("focus", reloadVisible);
      document.removeEventListener("visibilitychange", reloadVisible);
      void supabase.removeChannel(channel);
    };
  }, [load, mode]);
  return { items, programs, classes, globalAllowed, loading, error, load };
}
export function useAnnouncementKey() {
  const ref = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const serialized = JSON.stringify(payload);
    if (ref.current?.payload !== serialized)
      ref.current = { payload: serialized, key: crypto.randomUUID() };
    return ref.current.key;
  };
}
