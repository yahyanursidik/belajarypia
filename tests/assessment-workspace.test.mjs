import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessmentStatus,
  assessmentSummary,
  assessmentDirectory,
  finiteScore,
  reviewGradePayload,
  reviewScorePreview,
} from "../src/lib/assessmentWorkspace.ts";
const item = {
  id: "a1",
  kind: "quiz",
  lesson: { id: "l1", passing_grade: 65 },
  enrollment: { id: "e1" },
  status: "pending_review",
  score: 99,
  attemptNumber: 1,
  submittedAt: "2026-01-01",
};
test("pending state is authoritative, zero stays a score, and assignment progress is not an essay queue item", () => {
  assert.equal(assessmentStatus(item), "pending");
  assert.equal(
    assessmentStatus({ ...item, status: "graded", score: 0 }),
    "below",
  );
  assert.equal(
    assessmentStatus({
      ...item,
      kind: "assignment",
      status: "completed",
      score: null,
    }),
    "recorded",
  );
  assert.equal(finiteScore(null), null);
  assert.equal(finiteScore(""), null);
  assert.equal(finiteScore(0), 0);
  assert.equal(
    assessmentSummary([
      { ...item, status: "graded", score: 50 },
      { ...item, id: "a2", status: "graded", score: 90, attemptNumber: 2 },
    ]).average,
    90,
  );
});
test("blank essay points are incomplete and final preview weights automatic and manual points", () => {
  const questions = [
    { id: "q1", question_type: "essay", points: 20 },
    { id: "q2", question_type: "multiple_choice", points: 80 },
  ];
  const answers = [
    { id: "a1", question_id: "q1", points_earned: 0 },
    { id: "a2", question_id: "q2", points_earned: 80 },
  ];
  assert.throws(
    () =>
      reviewGradePayload(questions, answers, {
        a1: { points: "", feedback: "" },
      }),
    /Lengkapi/,
  );
  assert.equal(
    reviewScorePreview(questions, answers, { a1: { points: "", feedback: "" } })
      .score,
    null,
  );
  assert.equal(
    reviewScorePreview(questions, answers, {
      a1: { points: "0", feedback: "" },
    }).score,
    80,
  );
  assert.equal(
    reviewScorePreview(questions, answers, {
      a1: { points: "20", feedback: "" },
    }).score,
    100,
  );
});
test("queue return only accepts the matching role queue", () => {
  assert.equal(
    assessmentDirectory("/system/penilaian", "https://example.test"),
    "/system/penilaian",
  );
  assert.equal(
    assessmentDirectory("/system/penilaian", "/system/penilaian/another"),
    "/system/penilaian",
  );
  assert.equal(
    assessmentDirectory(
      "/system/penilaian",
      "/system/penilaian?status=pending",
    ),
    "/system/penilaian?status=pending",
  );
});
