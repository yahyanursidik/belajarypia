import type { Enrollment, Participant } from "./enrollment";
import type { Program } from "./organization";
import type { ProgramModule, Lesson } from "./academic";
import {
  summarizeLearning,
  type LearningProgress,
  type LearningPrerequisite,
} from "./learningProgress.ts";
import { wibDateKey } from "./dateRange.ts";
export type LearnerOutline = {
  generated_at: string;
  program: Program;
  enrollment: Enrollment;
  modules: ProgramModule[];
  lessons: Lesson[];
  requirements: LearningPrerequisite[];
  progress: (LearningProgress & {
    score: number | null;
    completed_at: string | null;
    started_at: string | null;
  })[];
  attempts: {
    id: string;
    lesson_id: string;
    attempt_number: number;
    status: string;
    score: number | null;
    started_at: string;
    submitted_at: string | null;
  }[];
};
export type LearnerEnrollment = Enrollment & {
  program_status: string;
  onboarding_status: string | null;
  outline: LearnerOutline | null;
};
export type LearnerPortal = {
  generated_at: string;
  participant: Participant | null;
  profile_ready: boolean;
  enrollments: LearnerEnrollment[];
};
export const learnerEnrollmentLabels: Record<string, string> = {
  active: "Aktif",
  completed: "Selesai",
  hold: "Ditahan",
  pending: "Menunggu aktivasi",
  cancelled: "Dibatalkan",
};
export const learnerLessonLabels: Record<string, string> = {
  content: "Materi",
  text: "Bacaan",
  document: "Dokumen",
  pdf: "Dokumen",
  link: "Tautan",
  quiz: "Kuis",
  exam: "Ujian",
  assignment: "Tugas",
  board: "Papan belajar",
  live_session: "Sesi belajar",
  video: "Tautan video",
  audio: "Tautan audio",
};
export const learnerSummary = (o: LearnerOutline) =>
  summarizeLearning(o.modules, o.lessons, o.progress, o.requirements);
export function learnerNext(e: LearnerEnrollment) {
  const program = "/learner/program/" + e.program_id,
    help =
      "/learner/bantuan?category=academic&contextProgram=" +
      e.program_id +
      "&contextEnrollment=" +
      e.id;
  if (!e.outline) {
    if (e.enrollment_status === "completed")
      return {
        label: "Lihat hasil",
        href: "/learner/transkrip/" + e.id,
        note: "Program tercatat selesai.",
      };
    if (
      ["hold", "pending"].includes(e.enrollment_status) &&
      ["pending", "failed"].includes(e.payment_status)
    )
      return {
        label: "Periksa pembayaran",
        href: "/learner/keuangan?program=" + e.program_id,
        note: learnerEnrollmentLabels[e.enrollment_status],
      };
    return {
      label: "Bantuan akses",
      href: help,
      note:
        learnerEnrollmentLabels[e.enrollment_status] ?? "Akses belum tersedia",
    };
  }
  const s = learnerSummary(e.outline);
  if (s.next) {
    const attempt = e.outline.attempts.find((a) => a.lesson_id === s.next!.id);
    if (attempt?.status === "pending_review" || attempt?.status === "submitted")
      return {
        label: "Lihat status ujian",
        href: "/learner/lesson/" + s.next.id + "/quiz?attempt=" + attempt.id,
        note: "Menunggu hasil penilaian",
      };
    if (attempt?.status === "ongoing")
      return {
        label: "Lanjutkan ujian",
        href: "/learner/lesson/" + s.next.id + "/quiz",
        note: s.next.title,
      };
    return {
      label: s.completed ? "Lanjutkan belajar" : "Mulai belajar",
      href: "/learner/lesson/" + s.next.id,
      note: s.next.title,
    };
  }
  return {
    label: s.finished ? "Lihat hasil" : "Buka program",
    href: s.finished ? "/learner/transkrip/" + e.id : program,
    note: s.finished
      ? "Semua materi tersedia selesai."
      : "Materi berikutnya belum tersedia.",
  };
}
export function learnerContinue(data: LearnerPortal) {
  const active = data.enrollments.filter(
    (e) => e.outline && learnerSummary(e.outline).next,
  );
  const recent = (e: LearnerEnrollment) =>
    Math.max(
      0,
      ...e.outline!.progress.map(
        (p) => Date.parse(p.completed_at || p.started_at || "") || 0,
      ),
      ...e.outline!.attempts.map((a) => Date.parse(a.started_at) || 0),
    );
  return (
    [...active].sort(
      (a, b) => recent(b) - recent(a) || a.id.localeCompare(b.id),
    )[0] ??
    data.enrollments.find((e) => e.outline) ??
    null
  );
}
export function learnerTotals(data: LearnerPortal) {
  const available = data.enrollments.filter((e) => e.outline);
  return available.reduce(
    (s, e) => {
      const o = e.outline!,
        r = learnerSummary(o);
      s.total += r.total;
      s.completed += r.completed;
      s.review += o.attempts.filter((a) =>
        ["pending_review", "submitted"].includes(a.status),
      ).length;
      return s;
    },
    {
      total: 0,
      completed: 0,
      review: 0,
      active: data.enrollments.filter((e) => e.enrollment_status === "active")
        .length,
    },
  );
}
export function learnerActivity(data: LearnerPortal) {
  return data.enrollments
    .flatMap((e) =>
      e.outline
        ? e.outline.progress
            .filter(
              (p) =>
                p.status === "completed" &&
                p.completed_at &&
                e.outline!.lessons.some((l) => l.id === p.lesson_id),
            )
            .map((p) => ({
              id: e.id + ":" + p.lesson_id,
              lesson: e.outline!.lessons.find((l) => l.id === p.lesson_id)!,
              program: e.programs?.name ?? "Program",
              program_id: e.program_id,
              at: p.completed_at!,
            }))
        : [],
    )
    .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}
export function learnerWeek(
  data: LearnerPortal,
  today = wibDateKey(new Date().toISOString()),
) {
  const events = learnerActivity(data);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const day = d.toISOString().slice(0, 10);
    return {
      day,
      count: events.filter((e) => wibDateKey(e.at) === day).length,
    };
  });
}
export function learnerAgenda(data: LearnerPortal) {
  return data.enrollments
    .flatMap((e) => {
      if (!e.outline) return [];
      const completed = new Set(
        e.outline.progress
          .filter((p) => p.status === "completed")
          .map((p) => p.lesson_id),
      );
      return learnerSummary(e.outline)
        .ordered.filter((l) =>
          l.due_at && !completed.has(l.id) &&
          !e.outline!.attempts.some((a) =>
            a.lesson_id === l.id && ["pending_review", "submitted"].includes(a.status),
          ),
        )
        .map((l) => ({
          lesson: l,
          program: e.programs?.name ?? "Program",
          program_id: e.program_id,
          locked: e.outline!.requirements.some(
            (p) =>
              p.lesson_id === l.id && !completed.has(p.prerequisite_lesson_id),
          ),
        }));
    })
    .sort((a, b) => a.lesson.due_at!.localeCompare(b.lesson.due_at!));
}
export function learnerError(e: unknown) {
  const m =
    (e as { message?: string })?.message ?? "Data belajar belum dapat dimuat.";
  return /schema cache|could not find.*function|does not exist/i.test(m)
    ? "Pembaruan ruang belajar belum tersedia di server."
    : m;
}
