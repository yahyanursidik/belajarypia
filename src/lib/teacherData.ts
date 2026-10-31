import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { useAuthSession } from "../app/providers/authSessionContext";
import type {
  TeachingProgram,
  TeachingClass,
  TeachingEnrollment,
  TeachingLesson,
  TeachingProgress,
} from "./teacherWorkspace";
export async function teachingRows<T>(
  query: (
    offset: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const r = await query(offset);
    if (r.error) throw r.error;
    rows.push(...((r.data ?? []) as T[]));
    if ((r.data?.length ?? 0) < 500) return rows;
  }
}
async function scope(user: string, signal: AbortSignal) {
  const [programs, classes] = await Promise.all([
    teachingRows<TeachingProgram>((o) =>
      supabase
        .from("programs")
        .select("id,name,code,status")
        .eq("teacher_user_id", user)
        .order("id")
        .range(o, o + 499)
        .abortSignal(signal),
    ),
    teachingRows<TeachingClass>((o) =>
      supabase
        .from("classes")
        .select("id,program_id,name,code")
        .eq("teacher_user_id", user)
        .order("id")
        .range(o, o + 499)
        .abortSignal(signal),
    ),
  ]);
  const ids = [
    ...new Set([
      ...programs.map((p) => p.id),
      ...classes.map((c) => c.program_id),
    ]),
  ];
  if (!ids.length)
    return {
      programs,
      classes,
      enrollments: [] as TeachingEnrollment[],
      lessons: [] as (TeachingLesson & { program_id: string })[],
      progress: [] as TeachingProgress[],
    };
  const extra = ids.filter((id) => !programs.some((p) => p.id === id));
  for (let i = 0; i < extra.length; i += 100)
    programs.push(
      ...(await teachingRows<TeachingProgram>((o) =>
        supabase
          .from("programs")
          .select("id,name,code,status")
          .in("id", extra.slice(i, i + 100))
          .order("id")
          .range(o, o + 499)
          .abortSignal(signal),
      )),
    );
  const enrollments: TeachingEnrollment[] = [],
    lessons: (TeachingLesson & { program_id: string })[] = [],
    progress: TeachingProgress[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const [enrs, modules] = await Promise.all([
      teachingRows<TeachingEnrollment>((o) =>
        supabase
          .from("enrollments")
          .select(
            "id,program_id,class_id,enrollment_number,enrollment_status,participants(display_name,global_participant_number)",
          )
          .in("program_id", batch)
          .eq("enrollment_status", "active")
          .order("id")
          .range(o, o + 499)
          .abortSignal(signal),
      ),
      teachingRows<{ id: string; program_id: string }>((o) =>
        supabase
          .from("program_modules")
          .select("id,program_id")
          .in("program_id", batch)
          .order("id")
          .range(o, o + 499)
          .abortSignal(signal),
      ),
    ]);
    // Class assignment must not turn into a whole-program participant directory.
    enrollments.push(
      ...enrs.filter(
        (e) =>
          !extra.includes(e.program_id) ||
          classes.some((c) => c.id === e.class_id),
      ),
    );
    for (let j = 0; j < modules.length; j += 100) {
      const m = modules.slice(j, j + 100);
      const ls = await teachingRows<TeachingLesson>((o) =>
        supabase
          .from("lessons")
          .select("id,module_id,visibility_status,release_at")
          .in(
            "module_id",
            m.map((x) => x.id),
          )
          .order("id")
          .range(o, o + 499)
          .abortSignal(signal),
      );
      lessons.push(
        ...ls.map((l) => ({
          ...l,
          program_id: m.find((x) => x.id === l.module_id)!.program_id,
        })),
      );
    }
  }
  for (let i = 0; i < enrollments.length; i += 100)
    progress.push(
      ...(await teachingRows<TeachingProgress>((o) =>
        supabase
          .from("lesson_progresses")
          .select("enrollment_id,lesson_id,status,completed_at")
          .in(
            "enrollment_id",
            enrollments.slice(i, i + 100).map((e) => e.id),
          )
          .order("id")
          .range(o, o + 499)
          .abortSignal(signal),
      )),
    );
  return { programs, classes, enrollments, lessons, progress };
}
export function useTeachingWorkspace() {
  const { user } = useAuthSession();
  const [record, setRecord] = useState<{
    user: string;
    data: Awaited<ReturnType<typeof scope>>;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    if (!user?.id) {
      setLoading(false);
      return;
    }
    void scope(user.id, c.signal)
      .then((data) => {
        if (!c.signal.aborted) setRecord({ user: user.id, data });
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError("Data pengajaran belum dapat dimuat. Coba lagi.");
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [user?.id, version]);
  return {
    data: record?.user === user?.id ? record?.data : null,
    error,
    loading,
    reload,
  };
}
