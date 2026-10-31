import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = id(1),
  user = id(2),
  participant = id(3),
  program = id(4),
  batch = id(5),
  group = id(6),
  halaqah = id(7),
  enrollment = id(8),
  otherProgram = id(9),
  otherGroup = id(10);
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    await readFile(
      new URL("fixtures/participant-sql-schema.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    "alter table classes add column capacity integer; alter table halaqahs add column capacity integer;",
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610310004_enrollment_placement.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into auth.users(id,email) values ($1,$2),($3,$4)", [
    actor,
    "admin@example.test",
    user,
    "learner@example.test",
  ]);
  await db.query(
    "insert into participants(id,user_id,display_name,global_participant_number) values ($1,$2,'Contoh','TEST-PLACEMENT')",
    [participant, user],
  );
  await db.query(
    "insert into programs(id,code) values ($1,'MAIN'),($2,'OTHER')",
    [program, otherProgram],
  );
  await db.query("insert into batches(id,program_id) values ($1,$2)", [
    batch,
    program,
  ]);
  await db.query(
    "insert into classes(id,program_id,batch_id,capacity) values ($1,$2,$3,2),($4,$5,null,2)",
    [group, program, batch, otherGroup, otherProgram],
  );
  await db.query(
    "insert into halaqahs(id,class_id,capacity) values ($1,$2,1)",
    [halaqah, group],
  );
  await db.query(
    "insert into enrollments(id,participant_id,program_id,enrollment_status,enrollment_number,payment_status,started_at) values ($1,$2,$3,'hold','ENR-KEEP','pending','2025-01-01')",
    [enrollment, participant, program],
  );
  await db.exec(
    `set test.actor='${actor}';set test.role='admin';set test.program='${program}';`,
  );
  return db;
}
async function place(db, period = batch, cl = group, hl = halaqah) {
  return (
    await db.query(
      "select admin_update_enrollment_placement($1,$2,$3,$4) as result",
      [enrollment, period, cl, hl],
    )
  ).rows[0].result;
}
test("explicit placement preserves enrollment lifecycle and retries do not duplicate audit", async (t) => {
  const db = await fixture(t);
  assert.equal((await place(db)).status, "saved");
  const row = (
    await db.query("select * from enrollments where id=$1", [enrollment])
  ).rows[0];
  assert.equal(row.class_id, group);
  assert.equal(row.halaqah_id, halaqah);
  assert.equal(row.enrollment_status, "hold");
  assert.equal(row.payment_status, "pending");
  assert.equal(row.enrollment_number, "ENR-KEEP");
  assert.equal((await place(db)).status, "unchanged");
  assert.equal(
    (await db.query("select count(*)::int as count from audit_logs")).rows[0]
      .count,
    1,
  );
  await place(db, null, null, null);
  assert.equal(
    (await db.query("select class_id from enrollments")).rows[0].class_id,
    null,
  );
});
test("placement rejects nonstaff, outside scope, mismatched hierarchy and inactive periods", async (t) => {
  const db = await fixture(t);
  await db.exec("set test.role='participant';");
  await assert.rejects(() => place(db), /administrator/);
  await db.exec(`set test.role='admin';set test.program='${otherProgram}';`);
  await assert.rejects(() => place(db), /tidak memiliki akses/);
  await db.exec(`set test.program='${program}';`);
  await assert.rejects(
    () => place(db, null, otherGroup, null),
    /Kelas tidak sesuai/,
  );
  await assert.rejects(
    () => place(db, null, group, null),
    /Kelas tidak sesuai/,
  );
  await assert.rejects(() => place(db, batch, null, halaqah), /Pilih kelas/);
  await db.exec("update batches set status='draft';");
  await assert.rejects(() => place(db), /belum aktif/);
});
test("capacity and historical enrollment states block placement without partial writes", async (t) => {
  const db = await fixture(t);
  await db.exec("update classes set capacity=0;");
  await assert.rejects(() => place(db), /Kapasitas kelas/);
  assert.equal(
    (await db.query("select class_id from enrollments")).rows[0].class_id,
    null,
  );
  await db.exec(
    "update classes set capacity=2;update enrollments set enrollment_status='completed';",
  );
  await assert.rejects(() => place(db), /enrollment berjalan/);
  await db.exec("update enrollments set enrollment_status='cancelled';");
  await assert.rejects(() => place(db), /enrollment berjalan/);
  assert.equal(
    (await db.query("select count(*)::int as count from audit_logs")).rows[0]
      .count,
    0,
  );
});
test("audit failure rolls back placement and anonymous execution is revoked", async (t) => {
  const db = await fixture(t);
  await db.exec(
    "create function fixture_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'fixture audit failure'; end; $$; create trigger fixture_fail_audit before insert on audit_logs for each row execute function fixture_fail_audit();",
  );
  await assert.rejects(() => place(db), /fixture audit failure/);
  assert.equal(
    (await db.query("select class_id from enrollments")).rows[0].class_id,
    null,
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('anon','public.admin_update_enrollment_placement(uuid,uuid,uuid,uuid)','EXECUTE') as allowed",
      )
    ).rows[0].allowed,
    false,
  );
});

test("pending and hold occupy seats, historical enrollments do not, and a same-class change does not consume another seat", async (t) => {
  const db = await fixture(t);
  const otherParticipant = id(20),
    otherEnrollment = id(21);
  await db.query(
    "insert into participants(id,display_name,global_participant_number) values ($1,'Lain','OTHER')",
    [otherParticipant],
  );
  await db.query(
    "insert into enrollments(id,participant_id,program_id,class_id,halaqah_id,enrollment_status) values ($1,$2,$3,$4,$5,'pending')",
    [otherEnrollment, otherParticipant, program, group, halaqah],
  );
  await db.exec("update classes set capacity=1;");
  await assert.rejects(() => place(db), /Kapasitas kelas/);
  await db.exec("update classes set capacity=2;");
  await assert.rejects(() => place(db), /Kapasitas halaqah/);
  await db.query(
    "update enrollments set enrollment_status='completed' where id=$1",
    [otherEnrollment],
  );
  assert.equal((await place(db)).status, "saved");
  await db.exec("update classes set capacity=1;");
  assert.equal((await place(db, batch, group, null)).status, "saved");
});
