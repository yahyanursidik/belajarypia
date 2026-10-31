import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
  contentError,
  type ContentDetail,
  type ContentList,
} from "./contentReviewWorkspace";
export function useContentList(
  filters: ReturnType<typeof import("./contentReviewWorkspace").contentFilters>,
) {
  const key = JSON.stringify(filters);
  const [record, setRecord] = useState<{
    key: string;
    value: ContentList;
  } | null>(null);
  const [programs, setPrograms] = useState<ContentList["programs"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    try {
      const r = await supabase
        .rpc("system_content_review_list", { p_filters: JSON.parse(key) })
        .abortSignal(current.signal);
      if (r.error) throw r.error;
      if (
        !Array.isArray(r.data?.rows) ||
        !Array.isArray(r.data?.programs) ||
        !r.data?.counts
      )
        throw new Error("Laporan konten belum lengkap.");
      if (!current.signal.aborted) {
        setRecord({ key, value: r.data as ContentList });
        setPrograms(r.data.programs);
      }
    } catch (e) {
      if (!current.signal.aborted) setError(contentError(e));
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
    programs,
    loading,
    error,
    load,
  };
}
export function useContentDetail(id: string | null) {
  const [record, setRecord] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    setRecord(null);
    setError("");
    if (!id) {
      setLoading(false);
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    try {
      const r = await supabase
        .rpc("system_content_review_detail", { p_lesson: id })
        .abortSignal(current.signal);
      if (r.error) throw r.error;
      if (
        r.data?.lesson?.id !== id ||
        !r.data?.checks ||
        !r.data?.revision ||
        !Array.isArray(r.data?.questions) ||
        !Array.isArray(r.data?.documents) ||
        !Array.isArray(r.data?.history)
      )
        throw new Error("Detail materi belum lengkap.");
      if (!current.signal.aborted) setRecord(r.data as ContentDetail);
    } catch (e) {
      if (!current.signal.aborted) setError(contentError(e));
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);
  return {
    data: record?.lesson.id === id ? record : null,
    loading,
    error,
    load,
    update: setRecord,
  };
}
