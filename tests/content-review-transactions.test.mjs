import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  for (const f of [
    "tests/fixtures/participant-sql-schema.sql",
    "tests/fixtures/content-review-sql-schema.sql",
    "supabase/migrations/202610310016_content_review_workspace.sql",
  ])
    await db.exec(await readFile(new URL("../" + f, import.meta.url), "utf8"));
  await db.exec(
    `insert into auth.users(id,email) values('${id(1)}','review@example.test');set test.actor='${id(1)}';set test.role='super_admin';insert into programs(id,code,name) values('${id(10)}','P','Program Uji');insert into program_modules(id,program_id,title) values('${id(20)}','${id(10)}','Modul Uji');insert into lessons(id,module_id,code,title,content_body) values('${id(30)}','${id(20)}','M1','Materi Uji','Isi materi');`,
  );
  return db;
}
async function detail(db, n = 30) {
  return (
    await db.query("select public.system_content_review_detail($1) value", [
      id(n),
    ])
  ).rows[0].value;
}
async function decide(db, s, status, notes = null) {
  return (
    await db.query(
      "select public.system_content_review_decide($1,$2,$3,$4) value",
      [s.lesson.id, s.revision, status, notes],
    )
  ).rows[0].value;
}
async function list(db, filters = {}) {
  return (
    await db.query(
      "select public.system_content_review_list($1::jsonb) value",
      [JSON.stringify(filters)],
    )
  ).rows[0].value;
}
test("readiness, status filters and publication schedule use actual content", async (t) => {
  const db = await fixture(t);
  let s = await detail(db);
  assert.equal(s.checks.ready, true);
  assert.equal((await list(db)).total, 1);
  s = await decide(db, s, "published");
  assert.equal(s.lesson.visibility_status, "published");
  assert.equal((await list(db, { status: "published" })).total, 1);
  await db.exec(
    `update lessons set release_at=now()+interval '1 day' where id='${id(30)}'`,
  );
  assert.equal((await list(db, { status: "scheduled" })).total, 1);
  assert.equal((await list(db, { status: "published" })).total, 0);
  assert.equal((await list(db, { q: "%(),", status: "all" })).total, 0);
});
test("empty and staff-only sources block publication; private metadata is omitted", async (t) => {
  const db = await fixture(t);
  await db.exec(
    `update lessons set content_body=null;insert into document_files(lesson_id,source_type,display_name,access_level,bucket_name,object_key) values('${id(30)}','object_storage','Panduan','staff_only','private','secret.pdf')`,
  );
  let s = await detail(db);
  assert.equal(s.checks.ready, false);
  assert.equal(JSON.stringify(s).includes("secret.pdf"), false);
  await assert.rejects(decide(db, s, "published"), /Lengkapi/);
  await db.exec("update document_files set access_level='enrolled'");
  s = await detail(db);
  assert.equal(s.checks.ready, true);
  await db.exec("update document_files set mime_type='video/mp4'");
  assert.equal((await detail(db)).checks.ready, false);
});
test("quiz checks questions, answer key, options, points and configuration", async (t) => {
  const db = await fixture(t);
  await db.exec("update lessons set lesson_type='quiz'");
  assert.equal((await detail(db)).checks.ready, false);
  await db.query(
    "insert into quiz_questions(lesson_id,question_type,question_text,options,correct_answer,points) values($1,'multiple_choice','Soal?',$2,'A',10)",
    [
      id(30),
      JSON.stringify([
        { label: "A", text: "Ya" },
        { label: "B", text: "Tidak" },
      ]),
    ],
  );
  assert.equal((await detail(db)).checks.ready, true);
  await db.exec("update quiz_questions set correct_answer='Z'");
  assert.equal((await detail(db)).checks.ready, false);
  await db.exec(
    "update quiz_questions set correct_answer='A';update lessons set randomized_questions_count=2",
  );
  assert.equal((await detail(db)).checks.ready, false);
  await db.exec(
    "update lessons set randomized_questions_count=1;update quiz_questions set options='{}'",
  );
  assert.equal((await detail(db)).checks.ready, false);
});
test("decision validates source revision, notes, transitions and audit atomically", async (t) => {
  const db = await fixture(t);
  let s = await detail(db);
  await db.exec(
    `insert into document_files(lesson_id,source_type,external_url,display_name) values('${id(30)}','external_link','https://example.test/path','Sumber')`,
  );
  await assert.rejects(decide(db, s, "published"), /sudah berubah/);
  s = await detail(db);
  s = await decide(db, s, "published", "Sesuai kurikulum");
  assert.equal(s.history.length, 1);
  assert.equal(s.history[0].details.notes, "Sesuai kurikulum");
  await assert.rejects(decide(db, s, "locked", ""), /catatan/);
  s = await decide(db, s, "locked", "Perlu perbaikan");
  s = await decide(db, s, "archived", "Materi lama");
  await assert.rejects(decide(db, s, "published"), /draf/);
  s = await decide(db, s, "draft", "Diperbaiki kembali");
  assert.equal(s.history.length, 4);
  await db.exec(
    "create function reject_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable';end;$$;create trigger reject_audit before insert on audit_logs for each row execute function reject_audit()",
  );
  await assert.rejects(decide(db, s, "published"), /audit unavailable/);
  assert.equal((await detail(db)).lesson.visibility_status, "draft");
});
test("board, live session, unsafe URLs, programme and prerequisites checks", async (t) => {
  const db = await fixture(t);
  await db.exec(
    "update lessons set lesson_type='live_session',external_url='javascript:alert(1)'",
  );
  assert.equal((await detail(db)).checks.ready, false);
  await db.exec("update lessons set external_url='https://example.test/room'");
  assert.equal((await detail(db)).checks.ready, true);
  await db.exec("update lessons set lesson_type='board'");
  assert.equal((await detail(db)).checks.ready, false);
  await db.exec(
    `insert into lesson_boards(id,lesson_id,layout) values('${id(40)}','${id(30)}','wall');insert into lesson_board_posts(board_id,body,image_object_key) values('${id(40)}','Baca','private/image.png')`,
  );
  const s = await detail(db);
  assert.equal(s.checks.ready, true);
  assert.equal(s.posts[0].has_image, true);
  assert.equal(JSON.stringify(s).includes("private/image.png"), false);
  await db.exec(
    `insert into lesson_prerequisites(lesson_id,prerequisite_lesson_id) values('${id(30)}','${id(30)}')`,
  );
  assert.equal((await detail(db)).checks.ready, false);
});
test("pagination above REST cap, attention and read-only queries", async (t) => {
  const db = await fixture(t);
  await db.exec(
    `insert into lessons(module_id,code,title,content_body) select '${id(20)}',i::text,'Materi '||i,'Isi' from generate_series(1,1200) i`,
  );
  const r = await list(db, { status: "all", page: 25, size: 50 });
  assert.equal(r.total, 1201);
  assert.equal(r.rows.length, 1);
  assert.equal(r.counts.draft, 1201);
  assert.equal(
    (await db.query("select count(*)::int n from audit_logs")).rows[0].n,
    0,
  );
  await db.exec("update lessons set content_body=null where code='1'");
  assert.equal((await list(db, { status: "all", attention: true })).total, 1);
  await assert.rejects(list(db, { status: "bad" }), /Filter/);
});
test("anonymous, other roles and inactive superadmins cannot read or mutate", async (t) => {
  const db = await fixture(t);
  const s = await detail(db);
  for (const role of ["participant", "admin", "content_reviewer", "finance"]) {
    await db.query("select set_config('test.role',$1,false)", [role]);
    await assert.rejects(detail(db), /superadmin/);
    await assert.rejects(list(db), /superadmin/);
    await assert.rejects(decide(db, s, "published"), /superadmin/);
  }
  await db.exec(
    "set test.role='super_admin';update profiles set status='inactive'",
  );
  await assert.rejects(detail(db), /superadmin/);
  await db.exec("update profiles set status='active';set test.actor=''");
  await assert.rejects(detail(db), /superadmin/);
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('anon','public.system_content_review_detail(uuid)','execute') value",
      )
    ).rows[0].value,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('authenticated','public.system_content_snapshot(uuid)','execute') value",
      )
    ).rows[0].value,
    false,
  );
});

test("publication reuses announcement trigger, respects release and preserves learning history", async (t) => {
  const db = await fixture(t);
  await db.exec(
    `create table announcements(id uuid primary key default gen_random_uuid(),title text,content text,target_role text,target_program_id uuid,status text,created_by uuid,source text,source_lesson_id uuid unique,action_kind text,publish_at timestamptz,revision int default 1,updated_at timestamptz default now());create table lesson_progresses(id uuid primary key default gen_random_uuid(),lesson_id uuid,status text);insert into lesson_progresses(lesson_id,status) values('${id(30)}','completed');`,
  );
  const source = await readFile(
    new URL(
      "../supabase/migrations/202610310012_announcement_workspace.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const fn = source.match(
    /create or replace function public\.create_lesson_publication_announcement\(\)[\s\S]*?end;\$\$;/,
  )[0];
  await db.exec(
    fn +
      `create trigger publication after update of visibility_status on lessons for each row execute function create_lesson_publication_announcement();update lessons set release_at=now()+interval '1 day'`,
  );
  let s = await decide(db, await detail(db), "published");
  let a = (await db.query("select * from announcements")).rows[0];
  assert.equal(a.status, "published");
  assert.equal(
    new Date(a.publish_at).getTime(),
    new Date(s.lesson.release_at).getTime(),
  );
  s = await decide(db, s, "locked", "Perlu diperbaiki");
  a = (await db.query("select * from announcements")).rows[0];
  assert.equal(a.status, "draft");
  assert.equal(
    (await db.query("select count(*)::int n from announcements")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select status from lesson_progresses")).rows[0].status,
    "completed",
  );
});
test("authenticated superadmin RPC works, direct helper remains private; cycles are blocked", async (t) => {
  const db = await fixture(t);
  await db.exec(
    `grant usage on schema public,auth to authenticated;set role authenticated;`,
  );
  assert.equal((await list(db)).total, 1);
  await assert.rejects(
    db.query("select system_content_snapshot($1)", [id(30)]),
    /permission/,
  );
  await db.exec(
    `reset role;insert into lessons(id,module_id,code,title,content_body) values('${id(31)}','${id(20)}','M2','Materi dua','Isi');insert into lesson_prerequisites(lesson_id,prerequisite_lesson_id) values('${id(30)}','${id(31)}'),('${id(31)}','${id(30)}')`,
  );
  assert.ok((await detail(db)).checks.issues.some((s) => s.includes("siklus")));
});
