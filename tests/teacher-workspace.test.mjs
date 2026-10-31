import { test } from "node:test";
import assert from "node:assert/strict";
import { teachingProgress } from "../src/lib/teacherWorkspace.ts";
const e = { id: "a" },
  lesson = (id, visibility_status = "published", release_at = null) => ({
    id,
    visibility_status,
    release_at,
  });
test("progress counts released published material once and only for selected enrollment", () => {
  const r = teachingProgress(
    e,
    [
      lesson("one"),
      lesson("two"),
      lesson("draft", "draft"),
      lesson("future", "published", "2030-01-01"),
    ],
    [
      { enrollment_id: "a", lesson_id: "one", status: "completed" },
      { enrollment_id: "a", lesson_id: "one", status: "completed" },
      { enrollment_id: "b", lesson_id: "two", status: "completed" },
      { enrollment_id: "a", lesson_id: "draft", status: "completed" },
    ],
    Date.parse("2026-10-31"),
  );
  assert.deepEqual(r, { total: 2, completed: 1, percent: 50 });
});
test("empty curriculum is unknown progress, never completed", () =>
  assert.deepEqual(teachingProgress(e, [], []), {
    total: 0,
    completed: 0,
    percent: null,
  }));
test("started material does not count as completion", () =>
  assert.equal(
    teachingProgress(
      e,
      [lesson("one")],
      [{ enrollment_id: "a", lesson_id: "one", status: "started" }],
    ).completed,
    0,
  ));
