import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = id(1),
  person = id(2),
  program = id(3),
  enrollment = id(4),
  template = id(5),
  request = id(6);
const layout = {
  name_x: 0,
  name_y: 300,
  name_size: 32,
  no_x: 120,
  no_y: 250,
  no_size: 14,
};
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  for (const file of [
    "fixtures/participant-sql-schema.sql",
    "fixtures/certificate-sql-schema.sql",
    "../supabase/migrations/20260627063458_phase_20_certificate_queue.sql",
    "../supabase/migrations/202610310009_certificate_workspace.sql",
  ])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  await db.query(
    "insert into auth.users(id,email) values($1,'admin@example.test')",
    [actor],
  );
  await db.query(
    "insert into participants(id,display_name,global_participant_number) values($1,'Peserta uji','NIS-01')",
    [person],
  );
  await db.query(
    "insert into programs(id,code,feature_flags) values($1,'THS','{\"use_certificate\":true}')",
    [program],
  );
  await db.query(
    "insert into enrollments(id,program_id,participant_id,enrollment_status,payment_status) values($1,$2,$3,'completed','not_required')",
    [enrollment, program, person],
  );
  await db.query(
    "insert into program_graduation_results(program_id,enrollment_id,status,final_score) values($1,$2,'graduated',0)",
    [program, enrollment],
  );
  await db.query(
    "insert into certificate_templates(id,program_id,name,template_data_json) values($1,$2,'Template uji',$3)",
    [template, program, JSON.stringify(layout)],
  );
  await db.exec(
    `set test.actor='${actor}';set test.role='admin';set test.program='${program}';`,
  );
  return db;
}
const enqueue = async (db, key = request, ids = [enrollment]) =>
  (
    await db.query(
      "select admin_create_certificate_batch($1,null,$2,$3,$4) result",
      [program, template, ids, key],
    )
  ).rows[0].result;
const eligibility = async (db) =>
  (
    await db.query("select admin_check_certificate_eligibility($1) result", [
      program,
    ])
  ).rows[0].result;
test("eligibility follows recorded graduation, participant status, payment rules and issued/queued records", async (t) => {
  const db = await fixture(t);
  assert.equal((await eligibility(db))[0].eligible, true);
  await db.query("update program_graduation_results set status='revision'");
  assert.equal((await eligibility(db))[0].reason, "Kelulusan belum ditetapkan");
  await db.query("update program_graduation_results set status='graduated'");
  await db.query(
    "update programs set graduation_settings='{\"require_payment_clearance\":true}'",
  );
  await db.query("update enrollments set payment_status='pending'");
  assert.equal((await eligibility(db))[0].eligible, false);
  await db.query("update enrollments set payment_status='paid'");
  await enqueue(db);
  assert.equal(
    (await eligibility(db))[0].reason,
    "Sudah masuk antrean penerbitan",
  );
});
test("enqueue is atomic, snapshots renderer data, deduplicates requests and rejects repeated participants", async (t) => {
  const db = await fixture(t);
  const first = await enqueue(db);
  assert.equal(first.total_jobs, 1);
  assert.deepEqual(await enqueue(db), first);
  await assert.rejects(() => enqueue(db, id(7)), /Kelayakan berubah/);
  await assert.rejects(
    () => enqueue(db, id(8), [enrollment, enrollment]),
    /berulang/,
  );
  const rows = (
    await db.query("select issuance_snapshot from certificate_generation_jobs")
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].issuance_snapshot.recipient_name, "Peserta uji");
  assert.equal(rows[0].issuance_snapshot.template_data_json.name_x, 0);
  await db.exec(
    "create function fail_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable';end;$$;create trigger fail_audit before insert on audit_logs for each row execute function fail_audit();",
  );
  await db.query("update certificate_generation_jobs set status='failed'");
  await assert.rejects(() => enqueue(db, id(9)), /audit unavailable/);
  assert.equal(
    (await db.query("select count(*)::int n from certificate_issuance_batches"))
      .rows[0].n,
    1,
  );
});
test("scope, foreign program/participant/template, and direct browser writes are denied", async (t) => {
  const db = await fixture(t);
  await db.exec("set test.role='teacher'");
  await assert.rejects(() => enqueue(db), /akses/);
  await db.exec("set test.role='admin';set test.program=''");
  await assert.rejects(() => eligibility(db), /akses/);
  await db.exec(`set test.program='${program}'`);
  await assert.rejects(() => enqueue(db, request, [id(90)]), /bukan milik/);
  await db.query("update certificate_templates set status='archived'");
  await assert.rejects(() => enqueue(db), /template aktif/);
  const acl = (
    await db.query(
      "select has_function_privilege('anon','public.admin_create_certificate_batch(uuid,uuid,uuid,uuid[],uuid)','execute') anon,has_function_privilege('authenticated','public.claim_certificate_jobs(uuid)','execute') claim",
    )
  ).rows[0];
  assert.deepEqual(acl, { anon: false, claim: false });
  await db.exec(
    "grant select,insert,update,delete on certificate_templates,certificate_generation_jobs to authenticated; set role authenticated;",
  );
  assert.equal(
    (await db.query("select * from certificate_templates")).rows.length,
    1,
  );
  assert.equal(
    (
      await db.query(
        "update certificate_templates set name='bypass' returning *",
      )
    ).rows.length,
    0,
  );
});
test("template save validates numeric layout, stale updates and atomic audit; archive preserves legacy layouts", async (t) => {
  const db = await fixture(t);
  const save = async (data, stamp = null) =>
    (
      await db.query(
        "select admin_save_certificate_template($1,$2,$3,$4,$5,null,$6) result",
        [null, stamp, program, "Nouveau", JSON.stringify(data), "active"],
      )
    ).rows[0].result;
  await assert.rejects(() => save({ ...layout, name_x: -1 }), /di luar/);
  await assert.rejects(() => save({ ...layout, name_y: null }), /Lengkapi/);
  const row = await save(layout);
  assert.ok(row.id);
  await assert.rejects(
    () =>
      db.query(
        "select admin_save_certificate_template($1,'2000-01-01',$2,'Stale',$3,null,'active')",
        [row.id, program, JSON.stringify(layout)],
      ),
    /telah berubah/,
  );
  const legacy = (
    await db.query("select updated_at from certificate_templates where id=$1", [
      template,
    ])
  ).rows[0].updated_at;
  await db.query(
    "select admin_save_certificate_template($1,$2,$3,'Arsip','{}',null,'archived')",
    [template, legacy, program],
  );
});
test("claiming is exclusive and finishing creates one stable certificate with accurate batch counters", async (t) => {
  const db = await fixture(t);
  await enqueue(db);
  const claim = (await db.query("select claim_certificate_jobs() result"))
    .rows[0].result;
  assert.equal(claim.length, 1);
  assert.deepEqual(
    (await db.query("select claim_certificate_jobs() result")).rows[0].result,
    [],
  );
  await assert.rejects(
    () =>
      db.query("select finish_certificate_job($1,$2)", [claim[0].id, id(99)]),
    /Klaim/,
  );
  await db.query("select finish_certificate_job($1,$2)", [
    claim[0].id,
    claim[0].claim_token,
  ]);
  const cert = (await db.query("select * from certificates")).rows[0];
  assert.equal(cert.program_name, "Program contoh");
  assert.equal(cert.recipient_name, "Peserta uji");
  assert.equal(cert.status, "issued");
  const batch = (
    await db.query(
      "select status,completed_jobs,failed_jobs from certificate_issuance_batches",
    )
  ).rows[0];
  assert.deepEqual(batch, {
    status: "completed",
    completed_jobs: 1,
    failed_jobs: 0,
  });
  assert.equal((await eligibility(db))[0].reason, "Sertifikat sudah terbit");
  await assert.rejects(
    () =>
      db.query("select finish_certificate_job($1,$2)", [
        claim[0].id,
        claim[0].claim_token,
      ]),
    /Klaim/,
  );
  assert.equal(
    (await db.query("select count(*)::int n from certificates")).rows[0].n,
    1,
  );
});
test("failed jobs retry only after revalidation with current template; lease recovery rejects stale workers", async (t) => {
  const db = await fixture(t);
  const created = await enqueue(db);
  const first = (await db.query("select claim_certificate_jobs() r")).rows[0]
    .r[0];
  await db.query(
    "update certificate_generation_jobs set locked_until=now()-interval '1 minute'",
  );
  const second = (await db.query("select claim_certificate_jobs() r")).rows[0]
    .r[0];
  assert.notEqual(first.claim_token, second.claim_token);
  await assert.rejects(
    () =>
      db.query("select finish_certificate_job($1,$2)", [
        first.id,
        first.claim_token,
      ]),
    /Klaim/,
  );
  await db.query(
    "update certificate_generation_jobs set attempt_count=2,max_attempts=3",
  );
  await db.query("select finish_certificate_job($1,$2,'Periksa template')", [
    second.id,
    second.claim_token,
  ]);
  assert.equal(
    (await db.query("select status from certificate_issuance_batches")).rows[0]
      .status,
    "failed",
  );
  await db.query("update certificate_templates set template_data_json=$1", [
    JSON.stringify({ ...layout, name_size: 20 }),
  ]);
  const retry = (
    await db.query("select admin_retry_certificate_jobs($1,$2) r", [
      created.batch_id,
      [first.id],
    ])
  ).rows[0].r;
  assert.equal(retry.retried, 1);
  const job = (await db.query("select * from certificate_generation_jobs"))
    .rows[0];
  assert.equal(job.status, "pending");
  assert.equal(job.issuance_snapshot.template_data_json.name_size, 20);
  await db.query("update enrollments set enrollment_status='hold'");
  const third = (await db.query("select claim_certificate_jobs() r")).rows[0]
    .r[0];
  await db.query("select finish_certificate_job($1,$2)", [
    third.id,
    third.claim_token,
  ]);
  assert.equal(
    (await db.query("select count(*)::int n from certificates")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select status from certificate_generation_jobs")).rows[0]
      .status,
    "failed",
  );
});

test("graduation bridge recomputes learning in the server and cannot trust proposed scores or create a verdict for inactive enrollments", async (t) => {
  const db = await fixture(t);
  await db.query("delete from program_graduation_results");
  await db.query("update enrollments set enrollment_status='active'");
  const module = id(80),
    quiz = id(81),
    content = id(82);
  await db.query("insert into program_modules(id,program_id) values($1,$2)", [
    module,
    program,
  ]);
  await db.query(
    "insert into lessons(id,module_id,lesson_type,visibility_status,passing_grade) values($1,$2,'quiz','published',65),($3,$2,'content','published',null)",
    [quiz, module, content],
  );
  await db.query(
    "insert into lesson_progresses(enrollment_id,lesson_id,status,score) values($1,$2,'completed',80),($1,$3,'completed',null)",
    [enrollment, quiz, content],
  );
  const finalize = (score = 80, completion = 100) =>
    db.query(
      "select finalize_program_graduation($1,$2,$3,'Jayyid Jiddan (Baik Sekali)',null) id",
      [enrollment, score, completion],
    );
  await assert.rejects(() => finalize(100), /berubah/);
  assert.equal(
    (await db.query("select count(*)::int n from program_graduation_results"))
      .rows[0].n,
    0,
  );
  await db.query("update enrollments set enrollment_status='hold'");
  await assert.rejects(() => finalize(), /aktif/);
  await db.query("update enrollments set enrollment_status='active'");
  const a = (await finalize()).rows[0].id;
  assert.equal((await finalize()).rows[0].id, a);
  assert.equal(
    (await db.query("select enrollment_status from enrollments")).rows[0]
      .enrollment_status,
    "completed",
  );
  assert.equal((await eligibility(db))[0].eligible, true);
});
test("certification does not manufacture graduation decisions for completed legacy enrollment", async (t) => {
  const db = await fixture(t);
  await db.query("delete from program_graduation_results");
  assert.equal((await eligibility(db))[0].eligible, false);
  await assert.rejects(() => enqueue(db), /Kelulusan belum ditetapkan/);
  assert.equal(
    (await db.query("select count(*)::int n from program_graduation_results"))
      .rows[0].n,
    0,
  );
});

test("manual processing can only claim an explicitly selected batch within admin scope", async (t) => {
  const db = await fixture(t);
  const created = await enqueue(db);
  await db.exec("set test.role='participant'");
  await assert.rejects(
    () =>
      db.query("select admin_claim_certificate_jobs($1)", [created.batch_id]),
    /akses/,
  );
  await db.exec("set test.role='admin';set test.program=''");
  await assert.rejects(
    () =>
      db.query("select admin_claim_certificate_jobs($1)", [created.batch_id]),
    /akses/,
  );
  await db.exec(`set test.program='${program}'`);
  const jobs = (
    await db.query("select admin_claim_certificate_jobs($1) jobs", [
      created.batch_id,
    ])
  ).rows[0].jobs;
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].enrollment_id, enrollment);
});
