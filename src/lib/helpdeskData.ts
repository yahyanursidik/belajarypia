import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
  definitiveHelpdeskFailure,
  helpdeskError,
  newHelpdeskCommand,
  sameHelpdeskCommand,
  type HelpdeskCommand,
} from "./helpdeskWorkspace";
export async function helpdeskRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
) {
  const r = await supabase.rpc(name, args);
  if (r.error) throw r.error;
  if (r.data == null)
    throw new Error(
      "Hasil belum terkonfirmasi. Periksa kiriman dengan tombol coba lagi.",
    );
  return r.data as T;
}
export function useHelpdeskQuery<T>(
  name: string,
  args: Record<string, unknown>,
) {
  const serialized = JSON.stringify(args);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const r = await supabase
        .rpc(name, JSON.parse(serialized))
        .abortSignal(controller.signal);
      if (r.error) throw r.error;
      if (r.data == null) throw new Error("Data belum tersedia.");
      if (!controller.signal.aborted) setData(r.data as T);
    } catch (e) {
      if (!controller.signal.aborted) {
        setData(null);
        setError(helpdeskError(e));
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [name, serialized]);
  useEffect(() => {
    setData(null);
    void load();
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const interval = setInterval(visible, 45000);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      request.current?.abort();
      clearInterval(interval);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  return { data, error, loading, load };
}
// A pending command retains its ORIGINAL version/key across a lost acknowledgement.
// sessionStorage is per tab and per user/ticket; never log message bodies.
export function readHelpdeskPending(key: string): HelpdeskCommand | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function useHelpdeskCommand(key: string) {
  const pending = useRef<HelpdeskCommand | null>(readHelpdeskPending(key));
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(!!pending.current);
  const [error, setError] = useState("");
  async function run<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T | undefined> {
    if (busy) return;
    setError("");
    let command = pending.current;
    if (command && !sameHelpdeskCommand(command, name, args)) {
      setError("Periksa kiriman sebelumnya sebelum mengubah isian.");
      return;
    }
    if (!command) command = newHelpdeskCommand(name, args, crypto.randomUUID());
    pending.current = command;
    try {
      sessionStorage.setItem(key, JSON.stringify(command));
    } catch {
      setError(
        "Draf tidak dapat disimpan di tab ini. Jangan tutup halaman sebelum kiriman terkonfirmasi.",
      );
    }
    setBusy(true);
    try {
      const result = await helpdeskRpc<T>(command.name, command.args);
      pending.current = null;
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Server already confirmed success. */
      }
      setUncertain(false);
      return result;
    } catch (e) {
      if (definitiveHelpdeskFailure(e)) {
        pending.current = null;
        try {
          sessionStorage.removeItem(key);
        } catch {
          /* keep draft in UI */
        }
        setUncertain(false);
      } else setUncertain(true);
      setError(helpdeskError(e));
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, uncertain, error, pending: pending.current };
}
