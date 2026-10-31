import { useEffect, useState } from "react";
import { useAuthSession } from "../app/providers/authSessionContext";
import { supabase } from "./supabase";
import { teachingRows } from "./teacherData";
import { learnerAgendaLessons, monthBounds, type AgendaLesson } from "./agenda";
import type { LearnerPortal } from "./learnerWorkspace";

async function loadAgenda(base: string, user: string, month: string, signal: AbortSignal) {
  if (base === "/learner") {
    const r = await supabase.rpc("learner_portal_workspace").abortSignal(signal);
    if (r.error) throw r.error;
    if (!Array.isArray(r.data?.enrollments)) throw new Error("Data belajar belum tersedia.");
    return learnerAgendaLessons(r.data as LearnerPortal);
  }
  type Program = { id: string; name: string };
  let programs: Program[];
  if (base === "/teacher") {
    const [owned, classes] = await Promise.all([
      teachingRows<Program>((o) => supabase.from("programs").select("id,name").eq("teacher_user_id", user).order("id").range(o, o + 499).abortSignal(signal)),
      teachingRows<{ program_id: string }>((o) => supabase.from("classes").select("id,program_id").eq("teacher_user_id", user).order("id").range(o, o + 499).abortSignal(signal)),
    ]);
    programs = owned;
    const extra = [...new Set(classes.map((c) => c.program_id))].filter((id) => !owned.some((p) => p.id === id));
    for (let i = 0; i < extra.length; i += 100) programs.push(...await teachingRows<Program>((o) => supabase.from("programs").select("id,name").in("id", extra.slice(i, i + 100)).order("id").range(o, o + 499).abortSignal(signal)));
  } else {
    programs = await teachingRows<Program>((o) => supabase.from("programs").select("id,name").order("id").range(o, o + 499).abortSignal(signal));
  }
  const { start, end } = monthBounds(month);
  const lessons: AgendaLesson[] = [];
  for (let i = 0; i < programs.length; i += 100) {
    const batch = programs.slice(i, i + 100);
    const rows = await teachingRows<{
      id: string; title: string; release_at: string | null; due_at: string | null; visibility_status: string;
      program_modules: { program_id: string };
    }>((o) => supabase.from("lessons")
      .select("id,title,release_at,due_at,visibility_status,program_modules!inner(program_id)")
      .in("program_modules.program_id", batch.map((p) => p.id))
      .eq("visibility_status", "published")
      .or(`and(release_at.gte.${start},release_at.lt.${end}),and(due_at.gte.${start},due_at.lt.${end})`)
      .order("id").range(o, o + 499).abortSignal(signal));
    lessons.push(...rows.map((l) => ({ ...l, program_id: l.program_modules.program_id, program_name: batch.find((p) => p.id === l.program_modules.program_id)?.name ?? "Program" })));
  }
  return lessons;
}
export function useAgenda(base: string, month: string) {
  const { user } = useAuthSession();
  const [record, setRecord] = useState<{ key: string; lessons: AgendaLesson[] } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const key = `${user?.id}:${base}:${month}`;
  useEffect(() => {
    const c = new AbortController();
    setLoading(true); setError("");
    if (!user?.id) { setLoading(false); return; }
    void loadAgenda(base, user.id, month, c.signal)
      .then((lessons) => { if (!c.signal.aborted) setRecord({ key, lessons }); })
      .catch(() => { if (!c.signal.aborted) { setRecord(null); setError("Agenda belum dapat dimuat. Coba lagi."); } })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [base, month, user?.id, key, version]);
  return { lessons: record?.key === key ? record.lessons : [], loading, error, reload: () => setVersion((v) => v + 1) };
}
