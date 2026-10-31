import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = id(1),
  user = id(2),
  person = id(3),
  program = id(4),
  module = id(5),
  lesson = id(6),
  enrollment = id(7),
  attempt = id(8),
  essay1 = id(9),
  essay2 = id(10),
  mcq = id(11),
  answer1 = id(12),
  answer2 = id(13),
  auto = id(14);
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  for (const file of [
    "fixtures/participant-sql-schema.sql",
    "fixtures/assessment-sql-schema.sql",
    "../supabase/migrations/202610310008_final_quiz_review.sql",
  ])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  await db.query(
    "insert into auth.users(id,email) values($1,'grader@example.test'),($2,'learner@example.test')",
    [actor, user],
  );
  await db.query(
    "insert into participants(id,user_id,global_participant_number,display_name) values($1,$2,'NIS','Peserta uji')",
    [person, user],
  );
  await db.query("insert into programs(id,code) values($1,'TAHSIN')", [
    program,
  ]);
  await db.query("insert into program_modules(id,program_id) values($1,$2)", [
    module,
    program,
  ]);
  await db.query(
    "insert into lessons(id,module_id,lesson_type) values($1,$2,'exam')",
    [lesson, module],
  );
  await db.query(
    "insert into enrollments(id,participant_id,program_id) values($1,$2,$3)",
    [enrollment, person, program],
  );
  await db.query(
    "insert into quiz_questions(id,lesson_id,question_type,points) values($1,$2,'essay',20),($3,$2,'essay',30),($4,$2,'multiple_choice',50)",
    [essay1, lesson, essay2, mcq],
  );
  await db.query(
    "insert into quiz_attempts(id,enrollment_id,lesson_id,attempt_number,status,submitted_at) values($1,$2,$3,1,'pending_review',now())",
    [attempt, enrollment, lesson],
  );
  await db.query(
    "insert into quiz_attempt_answers(id,quiz_attempt_id,question_id,points_earned) values($1,$2,$3,0),($4,$2,$5,0),($6,$2,$7,50)",
    [answer1, attempt, essay1, answer2, essay2, auto, mcq],
  );
  await db.exec(
    `set test.actor='${actor}';set test.role='admin';set test.program='${program}';`,
  );
  return db;
}
const grades = [
  { answer_id: answer1, points: 20, feedback: "Baik" },
  { answer_id: answer2, points: 30, feedback: "Tepat" },
];
const grade = async (db, payload = grades, aid = attempt) =>
  (
    await db.query("select grade_quiz_attempt($1,$2,'Capaian baik') score", [
      aid,
      JSON.stringify(payload),
    ])
  ).rows[0].score;
test("all answers grade atomically, repeat finalization is idempotent, and finalized scores cannot change", async (t) => {
  const db = await fixture(t);
  assert.equal(Number(await grade(db)), 100);
  assert.equal(
    (await db.query("select score from lesson_progresses")).rows[0].score,
    "100.00",
  );
  assert.equal(Number(await grade(db)), 100);
  assert.equal(
    (await db.query("select count(*)::int count from audit_logs")).rows[0]
      .count,
    1,
  );
  await assert.rejects(
    () => grade(db, [{ ...grades[0], points: 0 }, grades[1]]),
    /sudah final/,
  );
});
test("duplicate, missing, foreign, null, nonnumeric and excessive essay grades are rejected without partial writes", async (t) => {
  const db = await fixture(t);
  for (const payload of [
    [grades[0], grades[0]],
    [grades[0]],
    [{ ...grades[0], answer_id: id(99) }, grades[1]],
    [{ ...grades[0], points: null }, grades[1]],
    [{ ...grades[0], points: "NaN" }, grades[1]],
    [{ ...grades[0], points: 21 }, grades[1]],
  ])
    await assert.rejects(() => grade(db, payload));
  assert.equal(
    (await db.query("select status from quiz_attempts")).rows[0].status,
    "pending_review",
  );
  assert.equal(
    (await db.query("select count(*)::int count from lesson_progresses"))
      .rows[0].count,
    0,
  );
});
test("zero is a valid explicit grade while pending and out-of-scope actors cannot finalize", async (t) => {
  const db = await fixture(t);
  await db.exec("set test.role='participant';");
  await assert.rejects(() => grade(db), /tidak memiliki akses/);
  await db.exec(`set test.role='admin';set test.program='${id(90)}';`);
  await assert.rejects(() => grade(db), /tidak memiliki akses/);
  await db.exec(
    `set test.program='${program}';update quiz_attempt_answers set points_earned=0;`,
  );
  assert.equal(
    Number(
      await grade(db, [
        { ...grades[0], points: 0 },
        { ...grades[1], points: 0 },
      ]),
    ),
    0,
  );
});
test("grading an older attempt keeps the latest graded attempt in learning progress", async (t) => {
  const db = await fixture(t);
  await db.query(
    "insert into quiz_attempts(id,enrollment_id,lesson_id,attempt_number,status,score,submitted_at,graded_at) values($1,$2,$3,2,'graded',90,now(),now())",
    [id(20), enrollment, lesson],
  );
  await grade(db);
  assert.equal(
    Number(
      (await db.query("select score from lesson_progresses")).rows[0].score,
    ),
    90,
  );
});
test("audit failure rolls back grades, status and learning progress; anonymous execution remains denied", async (t) => {
  const db = await fixture(t);
  await db.exec(
    "create function fail_grade_audit() returns trigger language plpgsql as $$begin raise exception 'audit failed';end;$$;create trigger fail_grade_audit before insert on audit_logs for each row execute function fail_grade_audit();",
  );
  await assert.rejects(() => grade(db), /audit failed/);
  assert.equal(
    (await db.query("select status from quiz_attempts")).rows[0].status,
    "pending_review",
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select points_earned from quiz_attempt_answers where id=$1",
          [answer1],
        )
      ).rows[0].points_earned,
    ),
    0,
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('anon','public.grade_quiz_attempt(uuid,jsonb,text)','EXECUTE') allowed",
      )
    ).rows[0].allowed,
    false,
  );
});

test("teacher grading requires the specific program or enrollment assignment", async (t) => {
  const db = await fixture(t);
  await db.exec("set test.role='teacher';");
  await assert.rejects(() => grade(db), /tidak memiliki akses/);
  await db.query("update programs set teacher_user_id=$1 where id=$2", [
    actor,
    program,
  ]);
  assert.equal(Number(await grade(db)), 100);
});
