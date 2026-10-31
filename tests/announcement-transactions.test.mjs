import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin = id(1),
  learner = id(2),
  other = id(3),
  teacher = id(4),
  guardian = id(5),
  mentor = id(6),
  program = id(10),
  foreignProgram = id(11),
  group = id(20),
  secondGroup = id(21);
let serial = 1000;
async function fixture(t, legacy = false) {
  const db = new PGlite();
  t.after(() => db.close());
  for (const path of [
    "tests/fixtures/participant-sql-schema.sql",
    "tests/fixtures/announcement-sql-schema.sql",
    "supabase/migrations/20260627103000_phase_24_announcements.sql",
    "supabase/migrations/202610310012_announcement_workspace.sql",
  ]) {
    let sql = await readFile(new URL("../" + path, import.meta.url), "utf8");
    sql = sql.replace(
      "alter publication supabase_realtime add table public.announcements;",
      "",
    );
    try {
      await db.exec(sql);
      if (path.includes("phase_24")) {
        await db.exec(
          `alter table announcements add column visible_from timestamptz not null default now(), add column visible_until timestamptz not null default (now()+interval '14 days'), add constraint announcements_visible_window_check check(visible_until>visible_from);create policy "Authenticated users can view active published announcements" on announcements for select to authenticated using(status='published' and visible_from<=now() and visible_until>now());`,
        );
        if (legacy)
          await db.exec(
            `insert into announcements(id,title,content,target_role,status,visible_from,visible_until,updated_at) values ('00000000-0000-4000-8000-000000000999','Legacy','Keep original window','all','published','2026-01-01','2026-01-15','2026-01-01');`,
          );
      }
    } catch (e) {
      console.error({
        path,
        message: e.message,
        position: e.position,
        where: e.where,
      });
      throw e;
    }
  }
  for (const [n, role] of [
    [1, "admin"],
    [2, "participant"],
    [3, "participant"],
    [4, "teacher"],
    [5, "guardian"],
    [6, "mentor"],
    [7, "super_admin"],
  ]) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id(n),
      `actor${n}@example.test`,
    ]);
    await db.query(
      "insert into roles(code) values($1) on conflict(code) do nothing",
      [role],
    );
    await db.query(
      "insert into user_roles(user_id,role_id,scope_type,scope_id) select $1,id,$3,$4 from roles where code=$2",
      [
        id(n),
        role,
        role === "admin" ? "program" : "global",
        role === "admin" ? program : null,
      ],
    );
  }
  await db.query(
    "insert into programs(id,code,name,teacher_user_id) values($1,'P1','Tahsin',null),($2,'P2','Arab',null)",
    [program, foreignProgram],
  );
  await db.query(
    "insert into classes(id,program_id,name) values($1,$3,'Pagi'),($2,$3,'Sore')",
    [group, secondGroup, program],
  );
  for (const [n, user, cls] of [
    [30, learner, group],
    [31, other, secondGroup],
  ]) {
    await db.query(
      "insert into participants(id,user_id,global_participant_number,display_name) values($1,$2,$3,$3)",
      [id(n), user, "Peserta " + n],
    );
    await db.query(
      "insert into enrollments(id,participant_id,program_id,class_id,enrollment_status,enrollment_number) values($1,$2,$3,$4,'active',$5)",
      [id(n + 10), id(n), program, cls, "ENR-" + n],
    );
  }
  await db.query("update classes set teacher_user_id=$1 where id=$2", [
    teacher,
    group,
  ]);
  await db.query(
    "insert into halaqahs(id,class_id,mentor_user_id) values($1,$2,$3)",
    [id(50), group, mentor],
  );
  await db.query("insert into guardians(id,user_id) values($1,$2)", [
    id(60),
    guardian,
  ]);
  await db.query(
    "insert into guardian_participants(guardian_id,participant_id) values($1,$2)",
    [id(60), id(30)],
  );
  await as(db, admin, "admin");
  return db;
}
async function as(db, user, role = "participant") {
  await db.query(
    "select set_config('test.actor',$1,false),set_config('test.role',$2,false)",
    [user, role],
  );
}
async function save(db, extra = {}, key = id(serial++)) {
  const payload = {
    title: "Informasi kelas",
    content: "Pesan contoh",
    target_role: "participant",
    target_program_id: program,
    target_class_id: group,
    status: "draft",
    publish_at: null,
    expires_at: null,
    is_pinned: false,
    action_kind: "program",
    ...extra,
  };
  return (
    await db.query("select admin_save_announcement($1,$2) result", [
      JSON.stringify(payload),
      key,
    ])
  ).rows[0].result;
}
async function setStatus(db, aid, status) {
  const row = (
    await db.query("select updated_at from announcements where id=$1", [aid])
  ).rows[0];
  return (
    await db.query("select admin_set_announcement_state($1,$2,$3) result", [
      aid,
      status,
      row.updated_at,
    ])
  ).rows[0].result;
}
async function inbox(db) {
  return (await db.query("select my_announcements(0,500) item")).rows.map(
    (r) => r.item,
  );
}
test("drafts are private, class recipients are server scoped and publication/read withdrawal is enforced", async (t) => {
  const db = await fixture(t);
  const a = await save(db);
  await as(db, learner);
  assert.equal((await inbox(db)).length, 0);
  await as(db, admin, "admin");
  await setStatus(db, a.id, "published");
  await as(db, learner);
  assert.equal((await inbox(db)).length, 1);
  await as(db, other);
  assert.equal((await inbox(db)).length, 0);
  await assert.rejects(
    () => db.query("select mark_announcement_read($1,1)", [a.id]),
    /tidak tersedia/,
  );
  await as(db, admin, "admin");
  await setStatus(db, a.id, "draft");
  await as(db, learner);
  assert.equal((await inbox(db)).length, 0);
});
test("roles, guardian children and teaching assignments determine recipients; global teacher role is not all programs", async (t) => {
  const db = await fixture(t);
  for (const [role, person] of [
    ["teacher", teacher],
    ["guardian", guardian],
    ["mentor", mentor],
  ]) {
    const a = await save(db, { target_role: role, status: "published" });
    await as(db, person, role);
    assert.equal(
      (await inbox(db)).some((row) => row.id === a.id),
      true,
    );
    await as(db, admin, "admin");
  }
  const a = await save(db, {
    target_role: "teacher",
    target_class_id: secondGroup,
    status: "published",
  });
  await as(db, teacher, "teacher");
  assert.equal(
    (await inbox(db)).some((row) => row.id === a.id),
    false,
  );
  await as(db, learner);
  assert.equal((await inbox(db)).length, 0);
});
test("admin scope, cross-program classes, stale edits and direct writes cannot bypass validation", async (t) => {
  const db = await fixture(t);
  await assert.rejects(
    () => save(db, { target_program_id: null, target_class_id: null }),
    /cakupan/,
  );
  await assert.rejects(
    () => save(db, { target_program_id: foreignProgram }),
    /cakupan/,
  );
  const a = await save(db);
  await assert.rejects(
    () => save(db, { id: a.id, expected_updated_at: "2000-01-01" }),
    /berubah/,
  );
  await assert.rejects(() => save(db, { target_class_id: id(999) }), /Kelas/);
  await as(db, teacher, "teacher");
  await assert.rejects(() => save(db), /cakupan/);
  await db.exec("set role authenticated");
  await assert.rejects(
    () => db.exec("update announcements set status='published'"),
    /permission denied/,
  );
  const acl = (
    await db.query(
      "select has_function_privilege('authenticated','announcement_recipient(uuid,text,uuid,uuid)','execute') internal,has_function_privilege('anon','my_announcements(integer,integer)','execute') anon",
    )
  ).rows[0];
  assert.deepEqual(acl, { internal: false, anon: false });
  await db.exec("reset role");
});
test("save retries are idempotent and audit failure rolls back message and request record", async (t) => {
  const db = await fixture(t);
  const key = id(serial++),
    a = await save(db, {}, key);
  assert.deepEqual(await save(db, {}, key), a);
  assert.equal(
    (await db.query("select count(*)::int n from announcements")).rows[0].n,
    1,
  );
  await assert.rejects(
    () => save(db, { title: "Pesan lain" }, key),
    /Permintaan berbeda/,
  );
  await db.exec(
    "create function block_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable';end;$$;create trigger block_audit before insert on audit_logs for each row execute function block_audit();",
  );
  await assert.rejects(() => save(db), /audit unavailable/);
  assert.equal(
    (await db.query("select count(*)::int n from announcements")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int n from announcement_operations"))
      .rows[0].n,
    1,
  );
});
test("scheduled and expired messages stay hidden and archive restores only to draft", async (t) => {
  const db = await fixture(t);
  const now = Date.now();
  await save(db, {
    status: "published",
    publish_at: new Date(now + 3600000).toISOString(),
  });
  const visible = await save(db, { status: "published" });
  await db.query(
    "update announcements set publish_at=now()-interval '1 day',expires_at=now()-interval '1 second' where id=$1",
    [visible.id],
  );
  await as(db, learner);
  assert.equal((await inbox(db)).length, 0);
  await as(db, admin, "admin");
  await assert.rejects(
    () => setStatus(db, visible.id, "published"),
    /berakhir/,
  );
  await setStatus(db, visible.id, "archived");
  await assert.rejects(() => setStatus(db, visible.id, "published"), /draf/);
  await setStatus(db, visible.id, "draft");
  assert.equal(
    (
      await db.query("select status from announcements where id=$1", [
        visible.id,
      ])
    ).rows[0].status,
    "draft",
  );
});
test("read receipts are idempotent per revision and cannot mark stale or foreign messages read", async (t) => {
  const db = await fixture(t);
  const a = await save(db, { status: "published" });
  await as(db, learner);
  const [item] = await inbox(db);
  await db.query("select mark_announcement_read($1,$2)", [a.id, item.revision]);
  await db.query("select mark_announcement_read($1,$2)", [a.id, item.revision]);
  assert.equal(
    (await db.query("select count(*)::int n from announcement_reads")).rows[0]
      .n,
    1,
  );
  await as(db, admin, "admin");
  const stamp = (
    await db.query("select updated_at from announcements where id=$1", [a.id])
  ).rows[0].updated_at;
  await save(db, {
    id: a.id,
    expected_updated_at: stamp,
    title: "Revisi baru",
    status: "published",
  });
  await as(db, learner);
  await assert.rejects(
    () =>
      db.query("select mark_announcement_read($1,$2)", [a.id, item.revision]),
    /diperbarui/,
  );
  const [updated] = await inbox(db);
  assert.notEqual(updated.revision, updated.read_revision);
});
test("audience estimates count distinct active accounts and class deletion cannot broaden the audience", async (t) => {
  const db = await fixture(t);
  const count = (
    await db.query("select admin_announcement_audience('all',$1,$2) result", [
      program,
      group,
    ])
  ).rows[0].result.recipients;
  assert.equal(count, 6);
  await save(db);
  await assert.rejects(
    () => db.query("delete from classes where id=$1", [group]),
    /foreign key/,
  );
  await db.query("update profiles set status='inactive' where id=$1", [
    learner,
  ]);
  assert.equal(
    (
      await db.query(
        "select admin_announcement_audience('participant',$1,$2) result",
        [program, group],
      )
    ).rows[0].result.recipients,
    0,
  );
});
test("automatic lesson announcements have one source, obey release/unpublish and do not infer legacy messages", async (t) => {
  const db = await fixture(t);
  await db.query("insert into program_modules(id,program_id) values($1,$2)", [
    id(70),
    program,
  ]);
  await db.query(
    "insert into lessons(id,module_id,title,visibility_status) values($1,$2,'Materi contoh','draft')",
    [id(71), id(70)],
  );
  assert.equal(
    (await db.query("select count(*)::int n from announcements")).rows[0].n,
    0,
  );
  await db.query(
    "update lessons set visibility_status='published' where id=$1",
    [id(71)],
  );
  assert.equal(
    (await db.query("select count(*)::int n from announcements")).rows[0].n,
    1,
  );
  await as(db, learner);
  assert.equal((await inbox(db))[0].source_lesson_id, id(71));
  await as(db, admin, "admin");
  await db.query(
    "update lessons set release_at=now()+interval '1 hour' where id=$1",
    [id(71)],
  );
  await as(db, learner);
  assert.equal((await inbox(db)).length, 0);
  await as(db, admin, "admin");
  await db.query("update lessons set visibility_status='draft' where id=$1", [
    id(71),
  ]);
  assert.equal(
    (await db.query("select status from announcements")).rows[0].status,
    "draft",
  );
  await db.query(
    "update lessons set visibility_status='published',release_at=null where id=$1",
    [id(71)],
  );
  assert.equal(
    (await db.query("select count(*)::int n from announcements")).rows[0].n,
    1,
  );
  await as(db, learner);
  assert.equal((await inbox(db)).length, 1);
  await as(db, admin, "admin");
  await db.query("delete from lessons where id=$1", [id(71)]);
    const sourceId=(await db.query("select id from announcements where source='lesson'")).rows[0].id;
    await assert.rejects(()=>setStatus(db,sourceId,'published'),/sumber/);
  await as(db, learner);
  assert.equal((await inbox(db)).length, 0);
});

test("production visibility windows survive migration without touching content or updated_at", async (t) => {
  const db = await fixture(t, true);
  const a = (
    await db.query(
      "select title,status,publish_at::text,expires_at::text,updated_at::text from announcements where id=$1",
      [id(999)],
    )
  ).rows[0];
  assert.deepEqual(a, {
    title: "Legacy",
    status: "published",
    publish_at: "2026-01-01 00:00:00+00",
    expires_at: "2026-01-15 00:00:00+00",
    updated_at: "2026-01-01 00:00:00+00",
  });
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from pg_policies where tablename='announcements'",
      )
    ).rows[0].n,
    1,
  );
  await as(db, learner);
  await db.exec("set role authenticated");
  assert.equal(
    (await db.query("select count(*)::int n from announcements")).rows[0].n,
    0,
  );
  await db.exec("reset role");
});
test("direct RLS reads enforce scope, global broadcasts require super admin, and read receipts are private", async (t) => {
  const db = await fixture(t);
  const a = await save(db, { status: "published" });
  await as(db, other);
  await db.exec("set role authenticated");
  assert.equal(
    (await db.query("select count(*)::int n from announcements")).rows[0].n,
    0,
  );
  await db.exec("reset role");
  await as(db, learner);
  await db.query("select mark_announcement_read($1,1)", [a.id]);
  await db.exec("set role authenticated");
  assert.equal(
    (await db.query("select count(*)::int n from announcements")).rows[0].n,
    1,
  );
  await db.exec("reset role");
  await as(db, other);
  await db.exec("set role authenticated");
  assert.equal(
    (await db.query("select count(*)::int n from announcement_reads")).rows[0]
      .n,
    0,
  );
  await db.exec("reset role");
  await as(db, id(7), "super_admin");
  await save(db, {
    target_program_id: null,
    target_class_id: null,
    target_role: "all",
    status: "published",
    action_kind: "none",
  });
  await as(db, other);
  assert.equal((await inbox(db)).length, 1);
});
