import { test } from "node:test";
import assert from "node:assert/strict";
import { agendaEvents, agendaMonth, agendaTarget, monthBounds, learnerAgendaLessons } from "../src/lib/agenda.ts";

const lesson = { id: "l1", title: "Materi", program_id: "p1", program_name: "Program", visibility_status: "published", release_at: "2026-09-30T17:00:00Z", due_at: "2026-10-31T17:00:00Z" };
test("agenda uses WIB month boundaries and deduplicates lesson events", () => {
  const events = agendaEvents([lesson, lesson, { ...lesson, id: "draft", visibility_status: "draft" }], "2026-10");
  assert.deepEqual(events.map((e) => [e.key, e.day]), [["l1:release", "2026-10-01"]]);
  assert.equal(agendaEvents([lesson], "2026-11")[0].kind, "due");
});
test("invalid dates are ignored and events sort by instant, not offset text", () => {
  const events = agendaEvents([
    { ...lesson, id: "late", release_at: "2026-10-02T00:00:00Z", due_at: "invalid" },
    { ...lesson, id: "early", release_at: "2026-10-02T01:00:00+07:00", due_at: null },
  ], "2026-10");
  assert.deepEqual(events.map((e) => e.id), ["early", "late"]);
});
test("month filters validate query input and roll over the year", () => {
  assert.equal(agendaMonth("2026-13", "2026-10-31"), "2026-10");
  assert.equal(agendaMonth("2026-02", "2026-10-31"), "2026-02");
  assert.deepEqual(monthBounds("2026-12"), { start: "2026-12-01T00:00:00+07:00", end: "2027-01-01T00:00:00+07:00" });
});
test("learner agenda omits inactive enrollment and tracks prerequisites, completion, review", () => {
  const outline = { program: { name: "Program" }, lessons: [lesson], progress: [], requirements: [{ lesson_id: "l1", prerequisite_lesson_id: "before" }], attempts: [] };
  const data = { enrollments: [
    { program_id: "p1", enrollment_status: "active", outline },
    { program_id: "hidden", enrollment_status: "hold", outline },
    { program_id: "empty", enrollment_status: "active", outline: null },
  ] };
  let rows = learnerAgendaLessons(data);
  assert.equal(rows.length, 1); assert.equal(rows[0].locked, true);
  assert.equal(agendaTarget("/learner", rows[0]), "/learner/program/p1");
  outline.progress.push({ lesson_id: "before", status: "completed" }, { lesson_id: "l1", status: "completed" });
  rows = learnerAgendaLessons(data);
  assert.equal(rows[0].completed, true); assert.equal(rows[0].locked, false);
  outline.progress = []; outline.attempts.push({ lesson_id: "l1", status: "pending_review" });
  assert.equal(learnerAgendaLessons(data)[0].waiting, true);
});
test("each portal links to an implemented learning route", () => {
  assert.equal(agendaTarget("/teacher", lesson), "/teacher/kelas/program/p1/kurikulum");
  assert.equal(agendaTarget("/system", lesson), "/system/program/p1/kurikulum");
  assert.equal(agendaTarget("/admin", lesson), "/admin/program/p1/kurikulum");
  assert.equal(agendaTarget("/learner", lesson), "/learner/lesson/l1");
});
