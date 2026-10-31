import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = id(1),
  p1 = id(10),
  p2 = id(11),
  p3 = id(12),
  part1 = id(20),
  part2 = id(21),
  e1 = id(30),
  e2 = id(31),
  e3 = id(32),
  l1 = id(50),
  l2 = id(51);
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  for (const file of [
    "tests/fixtures/participant-sql-schema.sql",
    "tests/fixtures/dashboard-sql-schema.sql",
    "supabase/migrations/202610310015_system_dashboard.sql",
  ])
    await db.exec(
      await readFile(new URL("../" + file, import.meta.url), "utf8"),
    );
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,'admin@example.test','{\"full_name\":\"Admin Contoh\"}')",
    [actor],
  );
  await db.query(
    "select set_config('test.actor',$1,false),set_config('test.role','super_admin',false)",
    [actor],
  );
  await db.query(
    "insert into programs(id,code,name,status) values($1,'A','Program A','active'),($2,'B','Program B','active'),($3,'C','Program C','draft')",
    [p1, p2, p3],
  );
  await db.query(
    "insert into participants(id,global_participant_number,display_name,status) values($1,'P1','Aktif','active'),($2,'P2','Nonaktif','inactive'),($3,'P3','Tanpa enrollment','active')",
    [part1, part2, id(22)],
  );
  await db.query(
    "insert into enrollments(id,participant_id,program_id,enrollment_status) values($1,$4,$6,'active'),($2,$5,$6,'active'),($3,$4,$7,'active')",
    [e1, e2, e3, part1, part2, p1, p2],
  );
  await db.query(
    "insert into program_modules(id,program_id) values($1,$3),($2,$4)",
    [id(40), id(41), p1, p2],
  );
  await db.query(
    "insert into lessons(id,module_id,visibility_status,lesson_type,release_at) values($1,$3,'published','content',null),($2,$3,'published','exam',now()-interval '1 day'),($4,$3,'published','content',now()+interval '1 day'),($5,$3,'draft','content',null),($6,$7,'published','content',null)",
    [l1, l2, id(40), id(52), id(53), id(54), id(41)],
  );
  await db.query(
    "insert into lesson_progresses(enrollment_id,participant_id,lesson_id,status) values($1,$4,$5,'completed'),($1,$4,$6,'started'),($2,$7,$5,'completed'),($3,$4,$8,'completed')",
    [e1, e2, e3, part1, l1, l2, part2, id(54)],
  );
  await db.query(
    "insert into applicant_program_choices(applicant_id,program_id,review_status) values($1,$2,'accepted'),($1,$3,'submitted'),($4,$2,'revision_requested')",
    [id(60), p1, p2, id(61)],
  );
  await db.query(
    "insert into transactions(program_id,amount,status,paid_at) values($1,100,'verified',(now() at time zone 'Asia/Jakarta')::date),($1,500,'pending',null),($2,200,'verified',(now() at time zone 'Asia/Jakarta')::date),($1,999,'rejected',null)",
    [p1, p2],
  );
  return db;
}
async function snapshot(db, program = null, days = 30) {
  return (
    await db.query("select system_dashboard_summary($1,$2) r", [program, days])
  ).rows[0].r;
}
test("system dashboard aggregation contracts", async (t) => {
  const db = await fixture(t);
  await t.test(
    "distinct active profiles, scoped program choices and active learning denominators remain different",
    async () => {
      const all = await snapshot(db),
        a = await snapshot(db, p1);
      assert.equal(all.summary.active_participants, 2);
      assert.equal(a.summary.active_participants, 1);
      assert.equal(all.summary.application_choices, 3);
      assert.equal(a.summary.application_choices, 2);
      assert.equal(all.admission.accepted, 1);
      assert.equal(all.admission.submitted, 1);
      assert.equal(a.admission.submitted, 0);
      assert.deepEqual(a.learning, {
        active_enrollments: 1,
        completed: 1,
        expected: 2,
      });
      assert.deepEqual(all.learning, {
        active_enrollments: 2,
        completed: 2,
        expected: 3,
      });
      assert.equal(a.programs.length, 3);
      assert.equal(a.program_activity.length, 1);
      assert.equal(a.onboarding.total, 0);
    },
  );
  await t.test(
    "only verified payments enter the period total, with program and WIB day boundaries",
    async () => {
      let a = await snapshot(db, p1, 7);
      assert.equal(a.summary.verified_amount, 100);
      assert.equal(a.summary.verified_payments, 1);
      assert.equal(a.queues.payments, 1);
      await db.query(
        "insert into transactions(program_id,amount,status,created_at) values($1,50,'verified',((now() at time zone 'Asia/Jakarta')::date)::timestamp at time zone 'Asia/Jakarta'),($1,700,'verified',(((now() at time zone 'Asia/Jakarta')::date-7)::timestamp) at time zone 'Asia/Jakarta')",
        [p1],
      );
      a = await snapshot(db, p1, 7);
      assert.equal(a.summary.verified_amount, 150);
      assert.equal(
        a.daily.reduce((s, d) => s + d.verified_amount, 0),
        150,
      );
      assert.equal(a.daily.length, 7);
      assert.equal((await snapshot(db, p1, 30)).summary.verified_amount, 850);
    },
  );
  await t.test(
    "admission time buckets use choice creation in Jakarta rather than applicant-wide status or UTC date",
    async () => {
      await db.query(
        "insert into applicant_program_choices(program_id,review_status,created_at) values($1,'submitted',((((now() at time zone 'Asia/Jakarta')::date)::timestamp) at time zone 'Asia/Jakarta')-interval '1 second'),($1,'under_review',(((now() at time zone 'Asia/Jakarta')::date)::timestamp) at time zone 'Asia/Jakarta')",
        [p1],
      );
      const a = await snapshot(db, p1, 7);
      assert.equal(a.daily.at(-1).applications, 3);
      assert.equal(a.daily.at(-2).applications, 1);
      assert.equal(a.admission.under_review, 1);
    },
  );
  await t.test(
    "queues include public last sender, internal notes do not clear replies, and closed work is excluded",
    async () => {
      await db.query(
        "insert into helpdesk_tickets(id,reporter_id,target_program_id,status,follow_up_at) values($1,$4,$5,'waiting_reporter',now()-interval '1 day'),($2,$4,$5,'closed',now()-interval '1 day'),($3,$4,$6,'open',null)",
        [id(70), id(71), id(72), id(2), p1, p2],
      );
      await db.query(
        "insert into helpdesk_messages(ticket_id,sender_id,is_internal_note,created_at) values($1,$3,false,now()-interval '2 minute'),($1,$4,true,now()-interval '1 minute'),($2,$3,false,now())",
        [id(70), id(71), id(2), actor],
      );
      await db.query(
        "insert into quiz_attempts(enrollment_id,lesson_id,status) values($1,$2,'pending_review'),($1,$2,'graded')",
        [e1, l2],
      );
      await db.query(
        "insert into certificate_issuance_batches(program_id,status) values($1,'failed'),($1,'completed'),($2,'failed')",
        [p1, p2],
      );
      await db.query(
        "insert into finance_invoices(program_id,status,due_date) values($1,'open',(now() at time zone 'Asia/Jakarta')::date-1),($1,'cancelled',(now() at time zone 'Asia/Jakarta')::date-1),($1,'open',(now() at time zone 'Asia/Jakarta')::date)",
        [p1],
      );
      const a = await snapshot(db, p1);
      assert.equal(a.queues.helpdesk, 1);
      assert.equal(a.queues.helpdesk_overdue, 1);
      assert.equal(a.queues.assessment, 1);
      assert.equal(a.queues.certificates, 1);
      assert.equal(a.queues.invoices_overdue, 1);
    },
  );
  await t.test(
    "global access audit and failure logs are explicitly global, bounded, period-scoped and omit private payload",
    async () => {
      await db.query(
        "insert into audit_logs(user_id,action,entity_type) values($1,'role.updated','user_role')",
        [actor],
      );
      await db.exec(
        "insert into notification_logs(event_type,status,error_message) select 'lesson.published','failed','PRIVATE PAYLOAD' from generate_series(1,8);insert into notification_logs(event_type,status,created_at) values('old','failed',now()-interval '100 day');",
      );
      const a = await snapshot(db, p1, 7),
        b = await snapshot(db, p2, 7);
      assert.equal(a.global.failed_notifications, 8);
      assert.equal(a.notification_failures.length, 6);
      assert.equal(a.global.access_events, 1);
      assert.deepEqual(a.global, b.global);
      assert.ok(!JSON.stringify(a).includes("PRIVATE PAYLOAD"));
      assert.equal(a.recent_audit[0].actor_name, "Admin Contoh");
    },
  );
  await t.test(
    "aggregation counts beyond API pagination and daily zero fill match all scoped choices",
    async () => {
      await db.query(
        "insert into applicant_program_choices(program_id,review_status) select $1,'submitted' from generate_series(1,1201)",
        [p1],
      );
      const a = await snapshot(db, p1, 90);
      assert.equal(a.summary.application_choices, 1205);
      assert.equal(a.daily.length, 90);
      assert.equal(
        a.daily.reduce((sum, d) => sum + d.applications, 0),
        1205,
      );
    },
  );
  await t.test(
    "RPC reads do not change progress, business data or audit, and invalid scopes/periods fail",
    async () => {
      const before = (
        await db.query(
          "select (select count(*) from audit_logs)::int audit,(select count(*) from transactions)::int payments,(select count(*) from lesson_progresses)::int progress",
        )
      ).rows[0];
      await snapshot(db);
      await snapshot(db, p1);
      const after = (
        await db.query(
          "select (select count(*) from audit_logs)::int audit,(select count(*) from transactions)::int payments,(select count(*) from lesson_progresses)::int progress",
        )
      ).rows[0];
      assert.deepEqual(before, after);
      for (const d of [null, 0, 1, 8, 365])
        await assert.rejects(() => snapshot(db, null, d), /periode/);
      await assert.rejects(
        () => snapshot(db, id(999)),
        /Program tidak ditemukan/,
      );
    },
  );
  await t.test(
    "only an active superadmin can use the definer function, including direct authenticated calls",
    async () => {
      await db.exec(
        "grant usage on schema public,auth to authenticated,anon;set role authenticated",
      );
      assert.equal((await snapshot(db, p1)).summary.active_programs, 1);
      await db.exec("reset role");
      await db.query("select set_config('test.role','admin',false)");
      await assert.rejects(() => snapshot(db), /superadmin aktif/);
      await db.query("select set_config('test.role','super_admin',false)");
      await db.query("update profiles set status='inactive' where id=$1", [
        actor,
      ]);
      await assert.rejects(() => snapshot(db), /superadmin aktif/);
      await db.query("update profiles set status='active' where id=$1", [
        actor,
      ]);
      await db.query("select set_config('test.actor','',false)");
      await assert.rejects(() => snapshot(db), /superadmin aktif/);
      await db.exec("set role anon");
      await assert.rejects(() => snapshot(db), /permission denied/);
      await db.exec("reset role");
    },
  );
});
