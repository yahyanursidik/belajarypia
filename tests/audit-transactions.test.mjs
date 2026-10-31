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
  for (const file of [
    "tests/fixtures/participant-sql-schema.sql",
    "tests/fixtures/users-sql-schema.sql",
    "tests/fixtures/audit-sql-schema.sql",
    "supabase/migrations/202610310019_audit_workspace.sql",
  ])
    await db.exec(
      await readFile(new URL("../" + file, import.meta.url), "utf8"),
    );
  await db.exec(
    `insert into auth.users(id,email,raw_user_meta_data) values('${id(1)}','admin@example.test','{"full_name":"Admin Contoh"}'),('${id(2)}','staff@example.test','{"full_name":"Staf Contoh"}');set test.actor='${id(1)}';set test.role='super_admin';`,
  );
  return db;
}
async function event(
  db,
  n,
  action,
  entity = "profile",
  entityId = id(2),
  details = {},
  at = "2026-10-31T06:00:00Z",
  actor = id(1),
) {
  await db.query(
    "insert into audit_logs(id,user_id,action,entity_type,entity_id,details,created_at) values($1,$2,$3,$4,$5,$6,$7)",
    [id(n), actor, action, entity, entityId, JSON.stringify(details), at],
  );
}
const list = async (db, f = {}) =>
  (
    await db.query("select system_audit_list($1::jsonb) value", [
      JSON.stringify(f),
    ])
  ).rows[0].value;
const detail = async (db, n) =>
  (await db.query("select system_audit_detail($1) value", [id(n)])).rows[0]
    .value;
test("literal search covers UUID and actor; classification is exclusive and matches filters", async (t) => {
  const db = await fixture(t);
  for (const [n, act] of [
    "user.role_granted",
    "user.role_revoked",
    "DELETE",
    "ADD_USER",
    "VERIFY_PAYMENT",
    "settings.updated",
    "address_changed",
    "unknown",
  ].entries())
    await event(db, 100 + n, act);
  let r = await list(db);
  assert.equal(r.total, 8);
  assert.equal(r.stats.actors, 1);
  assert.equal(r.stats.access, 2);
  assert.equal(r.stats.deletions, 1);
  assert.equal((await list(db, { category: "auth" })).total, 2);
  assert.equal((await list(db, { category: "delete" })).total, 1);
  assert.equal((await list(db, { category: "other" })).total, 2);
  assert.equal((await list(db, { q: id(100) })).total, 1);
  assert.equal((await list(db, { q: "Admin Contoh" })).total, 8);
  assert.equal((await list(db, { q: "%(),_" })).total, 0);
  assert.equal((await list(db, { actor: id(2) })).total, 0);
  assert.equal((await list(db, { target: id(2), entity: "profile" })).total, 8);
  assert.equal(
    (await list(db, { action: "VERIFY_PAYMENT", category: "update" })).total,
    1,
  );
  assert.ok(!("details" in r.rows[0]));
});
test("WIB dates include both boundary days and reject invalid ranges", async (t) => {
  const db = await fixture(t);
  await event(db, 100, "LOGIN", "auth", null, {}, "2026-10-30T16:59:59Z");
  await event(db, 101, "LOGIN", "auth", null, {}, "2026-10-30T17:00:00Z");
  await event(db, 102, "LOGIN", "auth", null, {}, "2026-10-31T16:59:59Z");
  await event(db, 103, "LOGIN", "auth", null, {}, "2026-10-31T17:00:00Z");
  assert.equal(
    (await list(db, { from: "2026-10-31", to: "2026-10-31" })).total,
    2,
  );
  await assert.rejects(
    list(db, { from: "2026-11-01", to: "2026-10-31" }),
    /Tanggal akhir/,
  );
  await assert.rejects(list(db, { from: "2026-02-30" }), /range|date/i);
  await assert.rejects(list(db, { category: "bad" }), /Filter/);
  await assert.rejects(list(db, { actor: "invalid" }), /uuid/i);
  await assert.rejects(list(db, { size: 20 }), /Filter/);
});
test("exact pagination, complete facets and metadata export bypass REST row cap", async (t) => {
  const db = await fixture(t);
  await db.exec(
    `insert into audit_logs(id,action,entity_type,created_at) select ('00000000-0000-4000-8001-'||lpad(i::text,12,'0'))::uuid,case when i=1205 then 'rare.custom' else 'LOGIN' end,case when i=1205 then 'rare_object' else 'auth' end,'2026-10-31T06:00Z' from generate_series(1,1205) i;`,
  );
  const first = await list(db),
    next = await list(db, { page: 2 }),
    last = await list(db, { page: 999 });
  assert.equal(first.total, 1205);
  assert.equal(first.rows.length, 25);
  assert.notEqual(first.rows[0].id, next.rows[0].id);
  assert.equal(last.page, 49);
  assert.equal(last.rows.length, 5);
  assert.ok(first.actions.includes("rare.custom"));
  assert.ok(first.entities.includes("rare_object"));
  assert.equal((await list(db, { export: true })).rows.length, 1205);
  assert.equal(
    (await list(db, { category: "other", export: true })).rows.length,
    1,
  );
  await db.exec(
    `insert into audit_logs(action,entity_type) select 'LOGIN','auth' from generate_series(1,9000);`,
  );
  await assert.rejects(list(db, { export: true }), /10.000/);
});
test("detail recursively redacts credentials and signed URLs but preserves ordinary historical changes", async (t) => {
  const db = await fixture(t);
  await event(db, 100, "user.role_granted", "profile", id(2), {
    password: "SECRET",
    nested: [{ access_token: "SECRET", apiKey: "SECRET", normal: "Peserta" }],
    url: "https://example.test?X-Amz-Signature=SECRET",
    authorization: "Bearer SECRET",
    previous: { class_id: "A" },
    current: { class_id: "B" },
    reason: "Koreksi penempatan",
  });
  const r = await detail(db, 100),
    text = JSON.stringify(r);
  assert.equal(text.includes("SECRET"), false);
  assert.equal(r.details.reason, "Koreksi penempatan");
  assert.equal(r.details.nested[0].normal, "Peserta");
  assert.equal(r.context.profile_id, id(2));
  assert.equal(r.actor.id, id(1));
  assert.equal(r.details.current.class_id, "B");
  assert.equal(r.details.nested[0].apiKey, "[Disamarkan]");
  await event(db, 101, "OTHER", "unknown", null, {
    note: "Bearer secretvalue",
  });
  assert.equal((await detail(db, 101)).details.note, "[Disamarkan]");
});
test("current context uses real relationships; deleted/malformed references are safe", async (t) => {
  const db = await fixture(t);
  await db.exec(
    `insert into programs(id,code,name) values('${id(10)}','P','Program Contoh');insert into participants(id,user_id,global_participant_number,display_name) values('${id(20)}','${id(2)}','NIS-1','Peserta Contoh');insert into enrollments(id,participant_id,program_id) values('${id(30)}','${id(20)}','${id(10)}');insert into program_modules values('${id(40)}','${id(10)}');insert into lessons values('${id(50)}','${id(40)}','Materi Contoh');insert into quiz_attempts values('${id(60)}','${id(30)}','${id(50)}');`,
  );
  await event(db, 100, "enrollment.placement", "enrollment", id(30));
  assert.equal((await detail(db, 100)).context.participant_id, id(20));
  await event(db, 101, "quiz_attempt.graded", "quiz_attempt", id(60));
  assert.equal((await detail(db, 101)).context.attempt_id, id(60));
  await event(db, 102, "content.reviewed", "lesson", id(50));
  assert.equal((await detail(db, 102)).context.program_id, id(10));
  await event(db, 103, "OTHER", "lesson", id(999), { program_id: "malformed" });
  assert.deepEqual((await detail(db, 103)).context, {});
  await assert.rejects(detail(db, 999), /tidak ditemukan/);
});
test("anon, non-superadmin and inactive profiles cannot invoke reads; helpers stay private", async (t) => {
  const db = await fixture(t);
  await event(db, 100, "LOGIN");
  await db.exec(`set test.role='admin';`);
  await assert.rejects(list(db), /superadmin aktif/);
  await assert.rejects(detail(db, 100), /superadmin aktif/);
  await db.exec(
    `set test.role='super_admin';update profiles set status='inactive' where id='${id(1)}';`,
  );
  await assert.rejects(list(db), /superadmin aktif/);
  await db.exec(`update profiles set status='active';set role authenticated;`);
  assert.equal((await list(db)).total, 1);
  await assert.rejects(
    db.query("select system_audit_redact('{}')"),
    /permission/,
  );
  await assert.rejects(
    db.query("select system_audit_category('LOGIN')"),
    /permission/,
  );
  await db.exec("reset role;set role anon;");
  await assert.rejects(list(db), /permission/);
  await assert.rejects(detail(db, 100), /permission/);
});
test("reads and deployment preserve business rows, audit contents, table policies and grants", async (t) => {
  const db = await fixture(t);
  await event(db, 100, "UPDATE_SETTINGS", "system", null, {
    old: { name: "Lama" },
    new: { name: "Baru" },
  });
  const snapshot = async () =>
    JSON.stringify(
      (
        await db.query(
          "select (select jsonb_agg(to_jsonb(a)) from audit_logs a) logs,(select count(*) from profiles) profiles,(select relacl::text from pg_class where oid='audit_logs'::regclass) acl,(select jsonb_agg(to_jsonb(p)) from pg_policies p where tablename='audit_logs') policies",
        )
      ).rows,
    );
  const before = await snapshot();
  await list(db);
  await list(db, { export: true });
  await detail(db, 100);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610310019_audit_workspace.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(await snapshot(), before);
});
