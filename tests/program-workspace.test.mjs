import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProgramFlags,
  programDirectoryPath,
  programSectionPath,
  programSetupItems,
  validProgramPage,
  validateLessonSettings,
  validateProgramUpload,
} from "../src/lib/programWorkspace.ts";
import { summarizeProgramLearning } from "../src/lib/programLearningReport.ts";
import { parseQuizImport } from "../src/lib/quiz.ts";

test("workspace preserves directory context without accepting external or record return paths", () => {
  const directory = "/system/program?status=draft&q=tahsin&page=2";
  assert.equal(programDirectoryPath("/system", directory), directory);
  assert.equal(
    programDirectoryPath("/system", "https://example.test"),
    "/system/program",
  );
  assert.equal(
    programDirectoryPath("/system", "/system/program/another"),
    "/system/program",
  );
  assert.equal(
    programDirectoryPath("/system", "/admin/program"),
    "/system/program",
  );
  assert.equal(programDirectoryPath("/teacher/kelas", null), "/teacher/kelas");
  const path = programSectionPath("/system", "p1", "report", directory);
  assert.equal(
    new URL(path, "http://localhost").searchParams.get("returnTo"),
    directory,
  );
});
test("billing flags stay consistent and forbidden features stay disabled", () => {
  const legacy = normalizeProgramFlags({
    use_payment: true,
    payment_amount: 100000,
    use_audio_submission: true,
  });
  assert.equal(legacy.payment_type, "spp");
  assert.equal(legacy.use_payment, true);
  assert.equal(legacy.use_audio_submission, false);
  const free = normalizeProgramFlags({ ...legacy, payment_type: "free" });
  assert.equal(free.use_payment, false);
  assert.equal(free.payment_amount, 0);
});
test("setup requires published lessons and scheduled classes, without adding cohort requirements to self-paced programs", () => {
  const program = {
    description: "Deskripsi",
    syllabus: "Silabus",
    grading_rubric: [{ label: "Baik" }],
    curriculum_model: "mandiri",
  };
  const summary = {
    modules: 1,
    lessons: 2,
    publishedLessons: 0,
    quizLessons: 0,
    batches: 0,
    classes: 0,
    halaqahs: 0,
    questionBanks: 0,
    participants: 0,
  };
  const independent = programSetupItems(program, summary);
  assert.ok(!independent.some((item) => item.key === "classes"));
  assert.equal(independent.find((item) => item.key === "lessons").done, false);
  const scheduled = programSetupItems(
    { ...program, curriculum_model: "angkatan" },
    { ...summary, classes: 1 },
  );
  assert.equal(scheduled.find((item) => item.key === "classes").done, false);
});
test("lesson validation rejects invalid integers, grades, and unsafe meeting URLs", () => {
  const input = {
    title: "Materi",
    module_id: "m1",
    lesson_type: "quiz",
    release_at: "",
    external_url: "",
    passing_grade: "0",
    duration_minutes: "30",
    max_attempts: "1",
    randomized_questions_count: "0",
    max_tab_switches: "0",
    order_no: "0",
  };
  assert.equal(validateLessonSettings(input), null);
  assert.match(
    validateLessonSettings({ ...input, duration_minutes: "-1" }),
    /Durasi/,
  );
  assert.match(
    validateLessonSettings({ ...input, max_attempts: "1.5" }),
    /Percobaan/,
  );
  assert.match(
    validateLessonSettings({ ...input, passing_grade: "101" }),
    /Nilai/,
  );
  assert.match(
    validateLessonSettings({
      ...input,
      lesson_type: "live_session",
      external_url: "javascript:alert(1)",
      release_at: "2026-11-01T10:00",
    }),
    /tautan/,
  );
  assert.equal(validProgramPage("Infinity"), 1);
  assert.equal(validProgramPage("2.5"), 1);
  assert.equal(validProgramPage("2"), 2);
});
test("program upload rejects media, unsupported extensions and oversized files", () => {
  assert.equal(
    validateProgramUpload({
      name: "modul.pdf",
      type: "application/pdf",
      size: 1000,
    }),
    null,
  );
  assert.ok(
    validateProgramUpload({
      name: "rekaman.mp3",
      type: "audio/mpeg",
      size: 1000,
    }),
  );
  assert.ok(
    validateProgramUpload({ name: "palsu.pdf", type: "video/mp4", size: 1000 }),
  );
  assert.ok(
    validateProgramUpload({ name: "script.exe", type: "", size: 1000 }),
  );
  assert.match(
    validateProgramUpload({
      name: "modul.pdf",
      type: "application/pdf",
      size: 21 * 1024 * 1024,
    }),
    /20 MB/,
  );
});
test("reports exclude draft/foreign lessons and unfinished scores; zero is a real grade", () => {
  const lessons = [
    { id: "read", lesson_type: "content", visibility_status: "published" },
    { id: "exam", lesson_type: "exam", visibility_status: "published" },
    { id: "draft", lesson_type: "quiz", visibility_status: "draft" },
  ];
  const rows = [
    { lesson_id: "read", status: "completed", score: 100 },
    { lesson_id: "exam", status: "started", score: 90 },
    { lesson_id: "draft", status: "completed", score: 100 },
    { lesson_id: "foreign", status: "completed", score: 100 },
  ];
  const pending = summarizeProgramLearning(lessons, rows);
  assert.equal(pending.total, 2);
  assert.equal(pending.completed, 1);
  assert.equal(pending.percent, 50);
  assert.equal(pending.averageScore, null);
  const graded = summarizeProgramLearning(lessons, [
    ...rows,
    { lesson_id: "exam", status: "completed", score: 0 },
  ]);
  assert.equal(graded.averageScore, 0);
  assert.equal(graded.percent, 100);
  const duplicate = summarizeProgramLearning(lessons, [...rows, ...rows]);
  assert.equal(duplicate.completed, 1);
});
test("question text import requires an existing answer key and distinct nonempty choices", () => {
  assert.equal(
    parseQuizImport(
      "1. Pertanyaan\nA. Satu\nB. Dua\nKunci: B",
      "multiple_choice",
    )[0].isValid,
    true,
  );
  assert.equal(
    parseQuizImport(
      "1. Pertanyaan\nA. Satu\nB. Dua\nKunci: E",
      "multiple_choice",
    )[0].isValid,
    false,
  );
  assert.equal(
    parseQuizImport(
      "1. Pertanyaan\nA. Sama\nB. Sama\nKunci: A",
      "multiple_choice",
    )[0].isValid,
    false,
  );
});
