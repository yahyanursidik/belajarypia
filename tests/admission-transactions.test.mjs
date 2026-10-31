import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = id(1),
  account = id(2),
  person = id(3),
  program = id(4),
  otherProgram = id(5),
  applicant = id(6),
  choice = id(7),
  otherChoice = id(8),
  batch = id(9),
  group = id(10),
  halaqah = id(11);
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  for (const file of [
    "fixtures/participant-sql-schema.sql",
    "fixtures/admission-sql-schema.sql",
    "../supabase/migrations/202610310002_preserve_participant_enrollment.sql",
    "../supabase/migrations/202610310004_enrollment_placement.sql",
    "../supabase/migrations/202610310005_admission_review.sql",
    "../supabase/migrations/202610310006_atomic_admission_forms.sql",
    "../supabase/migrations/202610310007_owned_admission_status.sql",
  ])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  await db.query(
    "insert into auth.users(id,email) values($1,'admin@example.test'),($2,'learner@example.test')",
    [actor, account],
  );
  await db.query(
    "insert into participants(id,user_id,global_participant_number,display_name) values($1,$2,'NIS-KEEP','Nama sama')",
    [person, account],
  );
  await db.query(
    "insert into programs(id,code) values($1,'TAHSIN'),($2,'OTHER')",
    [program, otherProgram],
  );
  await db.query(
    "insert into applicants(id,full_name,email,phone) values($1,'Nama sama','learner@example.test','081234567890')",
    [applicant],
  );
  await db.query(
    "insert into applicant_program_choices(id,applicant_id,program_id) values($1,$2,$3),($4,$2,$5)",
    [choice, applicant, program, otherChoice, otherProgram],
  );
  await db.exec(
    `set test.actor='${actor}';set test.role='admin';set test.program='${program}';`,
  );
  return db;
}
const review = async (
  db,
  status,
  notes = "Catatan",
  expected = "submitted",
  updated = null,
) =>
  (
    await db.query(
      "select admin_review_application($1,$2,$3,$4,$5) as result",
      [choice, status, notes, expected, updated],
    )
  ).rows[0].result;
const accept = async (db, period = null, cl = null, hl = null) =>
  (
    await db.query(
      "select admin_accept_application($1,'Diperiksa','submitted',null,$2,$3,$4) as result",
      [choice, period, cl, hl],
    )
  ).rows[0].result;
const payload = {
  title: "Pendaftaran",
  description: "",
  status: "active",
  direct: false,
  registration_open_at: null,
  registration_close_at: null,
  group_settings: {
    platform: "none",
    separated_gender: false,
    general_groups: [],
    ikhwan_groups: [],
    akhwat_groups: [],
  },
};
const saveForm = async (
  db,
  form = null,
  updated = null,
  body = payload,
  fields = [],
) =>
  (
    await db.query(
      "select admin_save_admission_form($1,$2,$3,$4,$5) as result",
      [program, form, updated, JSON.stringify(body), JSON.stringify(fields)],
    )
  ).rows[0].result;
test("review affects one choice only and rejects stale changes and nonadmins", async (t) => {
  const db = await fixture(t);
  const result = await review(db, "revision_requested", "Periksa dokumen");
  assert.equal(result.status, "revision_requested");
  assert.equal(
    (
      await db.query(
        "select review_status from applicant_program_choices where id=$1",
        [otherChoice],
      )
    ).rows[0].review_status,
    "submitted",
  );
  await assert.rejects(() => review(db, "rejected"), /sudah berubah/);
  await db.exec("set test.role='participant';");
  await assert.rejects(() => review(db, "under_review"), /administrator/);
});
test("acceptance preserves hold/completed/cancelled placements and retries are idempotent", async (t) => {
  const db = await fixture(t);
  for (const state of ["hold", "completed", "cancelled"]) {
    await db.query(
      "insert into enrollments(participant_id,program_id,enrollment_status,class_id,enrollment_number) values($1,$2,$3,$4,$5) on conflict(participant_id,program_id) do update set enrollment_status=$3",
      [person, program, state, id(90), "KEEP"],
    );
    await db.query(
      "update applicant_program_choices set review_status='submitted',participant_id=null,enrollment_id=null,review_updated_at=null where id=$1",
      [choice],
    );
    const result = await accept(db);
    assert.equal(result.enrollment_action, "unchanged");
    const row = (await db.query("select * from enrollments")).rows[0];
    assert.equal(row.enrollment_status, state);
    assert.equal(row.class_id, id(90));
    assert.equal(row.enrollment_number, "KEEP");
    assert.equal((await accept(db)).enrollment_action, "unchanged");
  }
  assert.equal(
    (await db.query("select count(*)::int count from enrollments")).rows[0]
      .count,
    1,
  );
});
test("same name with different email creates a separate identity, and active program/scope are required", async (t) => {
  const db = await fixture(t);
  await db.exec("update applicants set email='different@example.test';");
  const result = await accept(db);
  assert.notEqual(result.participant_id, person);
  assert.equal(result.account_linked, false);
  assert.equal(
    (await db.query("select count(*)::int count from participants")).rows[0]
      .count,
    2,
  );
  await db.exec(`set test.program='${otherProgram}';`);
  await assert.rejects(() => accept(db), /cakupan/);
});
test("full class or invalid hierarchy rolls back participant, enrollment, decision and notes", async (t) => {
  const db = await fixture(t);
  await db.exec("update applicants set email='new@example.test';");
  await db.query("insert into batches(id,program_id) values($1,$2)", [
    batch,
    program,
  ]);
  await db.query(
    "insert into classes(id,program_id,batch_id,capacity) values($1,$2,$3,0)",
    [group, program, batch],
  );
  await assert.rejects(() => accept(db, batch, group), /Kapasitas kelas/);
  assert.equal(
    (await db.query("select count(*)::int count from participants")).rows[0]
      .count,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int count from enrollments")).rows[0]
      .count,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select review_status from applicant_program_choices where id=$1",
        [choice],
      )
    ).rows[0].review_status,
    "submitted",
  );
});
test("form saves atomically, checks version, blocks foreign question IDs and rolls back failed audit", async (t) => {
  const db = await fixture(t);
  const field = {
    field_key: "goal",
    label: "Tujuan",
    field_type: "text",
    is_required: true,
  };
  const first = await saveForm(db, null, null, payload, [field]);
  assert.ok(first.form_id);
  const question = (await db.query("select * from registration_form_fields"))
    .rows[0];
  await assert.rejects(
    () => saveForm(db, first.form_id, null, payload, [field]),
    /sudah berubah/,
  );
  await assert.rejects(
    () =>
      saveForm(db, first.form_id, first.updated_at, payload, [
        { ...field, id: id(99) },
      ]),
    /bukan milik/,
  );
  await db.exec(
    "create function fail_admission_audit() returns trigger language plpgsql as $$ begin raise exception 'audit failed';end;$$;create trigger fail_audit before insert on audit_logs for each row execute function fail_admission_audit();",
  );
  await assert.rejects(
    () =>
      saveForm(
        db,
        first.form_id,
        first.updated_at,
        { ...payload, title: "Harus rollback" },
        [{ ...field, id: question.id, label: "Diubah" }],
      ),
    /audit failed/,
  );
  assert.equal(
    (await db.query("select title from registration_forms")).rows[0].title,
    payload.title,
  );
  assert.equal(
    (await db.query("select label from registration_form_fields")).rows[0]
      .label,
    "Tujuan",
  );
});
test("claimed group positions remain stable; duplicate choices, reversed dates, and anonymous mutations are rejected", async (t) => {
  const db = await fixture(t);
  const body = {
    ...payload,
    group_settings: {
      ...payload.group_settings,
      platform: "whatsapp",
      general_groups: [
        { name: "Grup", link: "https://example.test/group", click_limit: 1 },
      ],
    },
  };
  const form = await saveForm(db, null, null, body);
  await db.query(
    "insert into registration_group_link_claims(form_id,group_bucket,group_index,applicant_id) values($1,'general_groups',0,$2)",
    [form.form_id, applicant],
  );
  await assert.rejects(
    () =>
      saveForm(db, form.form_id, form.updated_at, {
        ...body,
        group_settings: { ...body.group_settings, general_groups: [] },
      }),
    /Tambahkan tautan|sudah dipakai/,
  );
  await assert.rejects(
    () =>
      saveForm(db, form.form_id, form.updated_at, {
        ...body,
        registration_open_at: "2026-11-02",
        registration_close_at: "2026-11-01",
      }),
    /setelah/,
  );
  const privileges = await db.query(
    "select has_function_privilege('anon','public.admin_save_admission_form(uuid,uuid,timestamptz,jsonb,jsonb)','EXECUTE') allowed",
  );
  assert.equal(privileges.rows[0].allowed, false);
});

test("public lookup uses per-program decisions and full phone, and a rejected choice can submit again without changing another choice", async (t) => {
  const db = await fixture(t);
  await review(db, "rejected", "Belum sesuai");
  const lookup = await db.query(
    "select * from check_applicant_status('learner@example.test','+6281234567890')",
  );
  assert.equal(lookup.rows.length, 2);
  assert.ok(lookup.rows.some((row) => row.status === "rejected"));
  assert.ok(lookup.rows.some((row) => row.status === "submitted"));
  assert.equal(
    (
      await db.query(
        "select * from check_applicant_status('learner@example.test','34567890')",
      )
    ).rows.length,
    0,
  );
  await saveForm(db);
  const again = await db.query(
    "select submit_program_application($1,'Nama sama','learner@example.test','081234567890',null,null,null,'[]',null,null) as id",
    [program],
  );
  assert.ok(again.rows[0].id);
  await assert.rejects(
    () =>
      db.query(
        "select submit_program_application($1,'Nama sama','learner@example.test','081234567890',null,null,null,'[]',null,null)",
        [program],
      ),
    /sudah tercatat/,
  );
});
test("direct admission mode saves as a draft and preserves unrelated program flags", async (t) => {
  const db = await fixture(t);
  await db.exec(
    "update programs set feature_flags='{\"use_certificate\":true}'::jsonb",
  );
  const first = await saveForm(db, null, null, { ...payload, direct: true });
  assert.equal(first.status, "draft");
  const row = (
    await db.query("select feature_flags from programs where id=$1", [program])
  ).rows[0];
  assert.equal(row.feature_flags.use_certificate, true);
  assert.equal(row.feature_flags.use_direct_enrollment, true);
});

test("new enrollment receives the selected hierarchy, onboarding and audit in one transaction without creating an Auth account", async (t) => {
  const db = await fixture(t);
  await db.exec("update applicants set email='new-placement@example.test';");
  await db.query("insert into batches(id,program_id) values($1,$2)", [
    batch,
    program,
  ]);
  await db.query(
    "insert into classes(id,program_id,batch_id,capacity) values($1,$2,$3,2)",
    [group, program, batch],
  );
  await db.query("insert into halaqahs(id,class_id,capacity) values($1,$2,2)", [
    halaqah,
    group,
  ]);
  const result = await accept(db, batch, group, halaqah);
  assert.equal(result.enrollment_action, "created");
  const row = (
    await db.query("select * from enrollments where id=$1", [
      result.enrollment_id,
    ])
  ).rows[0];
  assert.equal(row.batch_id, batch);
  assert.equal(row.class_id, group);
  assert.equal(row.halaqah_id, halaqah);
  assert.equal(
    (await db.query("select count(*)::int count from onboarding_progresses"))
      .rows[0].count,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int count from auth.users")).rows[0]
      .count,
    2,
  );
});

test("signed-in registration lookup follows choice decisions and cannot inspect another account", async (t) => {
  const db = await fixture(t);
  await review(db, "rejected", "Tidak sesuai");
  await db.exec(`set test.actor='${account}';set test.role='participant';`);
  const own = (
    await db.query("select * from check_user_program_registration($1,$2,$3)", [
      account,
      "learner@example.test",
      program,
    ])
  ).rows[0];
  assert.equal(own.already_applied, false);
  const otherProgramStatus = (
    await db.query("select * from check_user_program_registration($1,$2,$3)", [
      account,
      "learner@example.test",
      otherProgram,
    ])
  ).rows[0];
  assert.equal(otherProgramStatus.application_status, "submitted");
  await assert.rejects(
    () =>
      db.query("select * from check_user_program_registration($1,$2,$3)", [
        actor,
        "admin@example.test",
        program,
      ]),
    /akun Anda sendiri/,
  );
});
