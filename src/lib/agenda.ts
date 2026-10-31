import { validDateKey, wibDateKey } from "./dateRange.ts";
import type { LearnerPortal } from "./learnerWorkspace.ts";

export type AgendaLesson = {
  id: string; title: string; program_id: string; program_name: string;
  release_at: string | null; due_at: string | null;
  visibility_status: string; completed?: boolean; waiting?: boolean; locked?: boolean;
};
export type AgendaEvent = AgendaLesson & { key: string; kind: "release" | "due"; at: string; day: string };
export function agendaMonth(value: string | null, today = wibDateKey(new Date().toISOString())) {
  return value && /^\d{4}-\d{2}$/.test(value) && validDateKey(value + "-01") ? value : today.slice(0, 7);
}
export function monthBounds(month: string) {
  const start = month + "-01";
  if (!validDateKey(start)) throw new Error("Bulan tidak valid.");
  const next = new Date(start + "T00:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start: start + "T00:00:00+07:00", end: next.toISOString().slice(0, 10) + "T00:00:00+07:00" };
}
export function agendaEvents(lessons: AgendaLesson[], month: string) {
  const events = new Map<string, AgendaEvent>();
  for (const lesson of lessons) {
    if (lesson.visibility_status !== "published") continue;
    for (const kind of ["release", "due"] as const) {
      const at = kind === "release" ? lesson.release_at : lesson.due_at;
      if (!at) continue;
      const day = wibDateKey(at);
      if (day.slice(0, 7) !== month) continue;
      const key = `${lesson.id}:${kind}`;
      events.set(key, { ...lesson, key, kind, at, day });
    }
  }
  return [...events.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.key.localeCompare(b.key));
}
export function learnerAgendaLessons(data: LearnerPortal): AgendaLesson[] {
  return data.enrollments.flatMap((e) => {
    if (e.enrollment_status !== "active" || !e.outline) return [];
    const o = e.outline;
    const completed = new Set(o.progress.filter((p) => p.status === "completed").map((p) => p.lesson_id));
    return o.lessons.map((l) => ({
      ...l, program_id: e.program_id, program_name: o.program.name,
      completed: completed.has(l.id),
      waiting: o.attempts.some((a) => a.lesson_id === l.id && ["submitted", "pending_review"].includes(a.status)),
      locked: o.requirements.some((r) => r.lesson_id === l.id && !completed.has(r.prerequisite_lesson_id)),
    }));
  });
}
export function agendaTarget(base: string, event: AgendaEvent) {
  if (base === "/learner") return event.locked ? `/learner/program/${encodeURIComponent(event.program_id)}` : `/learner/lesson/${encodeURIComponent(event.id)}`;
  return `${base === "/teacher" ? "/teacher/kelas" : base}/program/${encodeURIComponent(event.program_id)}/kurikulum`;
}
