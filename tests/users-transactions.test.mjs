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
    "tests/fixtures/users-sql-schema.sql",
    "supabase/migrations/202610310017_users_workspace.sql",
    "supabase/migrations/202610310018_users_own_scope.sql",
  ])
    await db.exec(await readFile(new URL("../" + f, import.meta.url), "utf8"));
  await db.exec(
    `insert into auth.users(id,email,email_confirmed_at,encrypted_password,raw_user_meta_data) values('${id(1)}','owner@example.test',now(),'SECRET_PASSWORD','{"full_name":"Pemilik uji"}'),('${id(2)}','learner@example.test',now(),'SECRET_PASSWORD','{"full_name":"Peserta uji"}'),('${id(3)}','staff@example.test',null,'SECRET_PASSWORD','{"full_name":"Staf uji"}');set test.actor='${id(1)}';set test.role='super_admin';insert into user_roles(user_id,role_id) select '${id(1)}',id from roles where code='super_admin';insert into units(id,name) values('${id(10)}','Unit A'),('${id(11)}','Unit B');insert into programs(id,code,name,unit_id) values('${id(20)}','P1','Tahsin','${id(10)}'),('${id(21)}','P2','Parenting','${id(11)}');`,
  );
  return db;
}
const detail = async (db, user = 2) =>
  (await db.query("select system_user_detail($1) value", [id(user)])).rows[0]
    .value;
const list = async (db, f = {}) =>
  (
    await db.query("select system_users_list($1::jsonb) value", [
      JSON.stringify(f),
    ])
  ).rows[0].value;
const change = async (db, s, c) =>
  (
    await db.query("select system_user_role_change($1,$2,$3::jsonb) value", [
      s.profile.id,
      s.revision,
      JSON.stringify(c),
    ])
  ).rows[0].value;
const grant = (role, extra = {}) => ({
  operation: "grant",
  role,
  reason: "Penugasan uji",
  ...extra,
});
test("directory counts, filters, authentication facts and private fields", async (t) => {
  const db = await fixture(t);
  const r = await list(db);
  assert.equal(r.total, 3);
  assert.equal(r.stats.without_role, 2);
  assert.equal(r.stats.unconfirmed, 1);
  assert.equal(r.stats.superadmins, 1);
  assert.equal((await list(db, { role: "without_role" })).total, 2);
  assert.equal((await list(db, { attention: "unconfirmed" })).total, 1);
  assert.equal((await list(db, { q: "%()," })).total, 0);
  assert.equal(JSON.stringify(r).includes("SECRET_PASSWORD"), false);
  const d = await detail(db, 3);
  assert.equal(d.auth.email_confirmed, false);
  assert.equal(JSON.stringify(d).includes("SECRET_PASSWORD"), false);
  await assert.rejects(list(db, { status: "bad" }), /Filter/);
});
test("grant and exact revoke preserve other assignments and audit reason", async (t) => {
  const db = await fixture(t);
  let d = await change(
    db,
    await detail(db),
    grant("admin", { scope_type: "unit", scope_id: id(10) }),
  );
  d = await change(
    db,
    d,
    grant("admin", { scope_type: "unit", scope_id: id(11) }),
  );
  assert.equal(d.assignments.length, 2);
  assert.equal(d.history[0].details.reason, "Penugasan uji");
  const target = d.assignments.find((a) => a.scope_id === id(10));
  d = await change(db, d, {
    operation: "revoke",
    assignment_id: target.id,
    reason: "Akhir tugas unit A",
  });
  assert.equal(d.assignments.length, 1);
  assert.equal(d.assignments[0].scope_id, id(11));
  assert.equal(d.history.length, 3);
  assert.equal((await list(db, { program: id(21) })).total, 1);
});
test("stale versions, null/global semantic duplicates and invalid scopes", async (t) => {
  const db = await fixture(t);
  const before = await detail(db);
  let d = await change(db, before, grant("finance"));
  await assert.rejects(change(db, before, grant("helpdesk")), /sudah berubah/);
  await assert.rejects(
    change(db, d, grant("finance", { scope_type: "global" })),
    /sudah ada/,
  );
  await assert.rejects(
    change(db, d, grant("finance", { scope_type: "unit", scope_id: id(10) })),
    /belum didukung/,
  );
  await assert.rejects(
    change(db, d, grant("admin", { scope_type: "program", scope_id: id(20) })),
    /belum didukung/,
  );
  await assert.rejects(
    change(db, d, grant("admin", { scope_type: "unit", scope_id: id(999) })),
    /unit aktif/,
  );
  await assert.rejects(
    change(db, d, {
      operation: "revoke",
      assignment_id: d.assignments[0].id,
      reason: "",
    }),
    /alasan/,
  );
});
test("participant and guardian roles require real linked identities", async (t) => {
  const db = await fixture(t);
  let d = await detail(db);
  await assert.rejects(change(db, d, grant("participant")), /profil peserta/);
  await db.exec(
    `insert into participants(id,user_id,global_participant_number,display_name) values('${id(30)}','${id(2)}','P-1','Peserta uji')`,
  );
  d = await change(db, d, grant("participant"));
  assert.equal(d.participants[0].id, id(30));
  await assert.rejects(change(db, d, grant("guardian")), /wali dan anak/);
  await db.exec(
    `insert into guardians(id,user_id,relation_type) values('${id(40)}','${id(2)}','Ayah');insert into guardian_participants(guardian_id,participant_id) values('${id(40)}','${id(30)}')`,
  );
  d = await change(db, d, grant("guardian"));
  assert.equal(d.children[0].name, "Peserta uji");
});
test("own superadmin cannot be removed and inactive/blocked targets cannot receive roles", async (t) => {
  const db = await fixture(t);
  let own = await detail(db, 1);
  await assert.rejects(
    change(db, own, {
      operation: "revoke",
      assignment_id: own.assignments[0].id,
      reason: "Hapus diri",
    }),
    /sendiri/,
  );
  let d = await detail(db);
  await db.exec(`update profiles set status='inactive' where id='${id(2)}'`);
  d = await detail(db);
  await assert.rejects(change(db, d, grant("teacher")), /profil aktif/);
  await db.exec(
    `update profiles set status='active' where id='${id(2)}';update auth.users set banned_until=now()+interval '1 day' where id='${id(2)}'`,
  );
  d = await detail(db);
  await assert.rejects(change(db, d, grant("teacher")), /tidak diblokir/);
});
test("legacy scoped and duplicate grants are visible and cleanup targets one row", async (t) => {
  const db = await fixture(t);
  await db.exec(
    `insert into user_roles(user_id,role_id,scope_type,scope_id) select '${id(2)}',id,'program','${id(20)}' from roles where code='finance';insert into user_roles(user_id,role_id) select '${id(2)}',id from roles where code='helpdesk';insert into user_roles(user_id,role_id) select '${id(2)}',id from roles where code='helpdesk'`,
  );
  let d = await detail(db);
  assert.equal(
    d.assignments.find((a) => a.code === "finance").supported_scope,
    false,
  );
  assert.equal((await list(db, { attention: "scope" })).total, 1);
  assert.equal((await list(db, { attention: "duplicates" })).total, 1);
  d = await change(db, d, {
    operation: "revoke",
    assignment_id: d.assignments.find((a) => a.code === "helpdesk").id,
    reason: "Rapikan duplikasi",
  });
  assert.equal(d.assignments.filter((a) => a.code === "helpdesk").length, 1);
  assert.equal(d.assignments.filter((a) => a.code === "finance").length, 1);
});
test("audit failure rolls back role change and ordinary roles/anonymous cannot operate", async (t) => {
  const db = await fixture(t);
  let d = await detail(db);
  await db.exec(
    "create function deny_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable';end;$$;create trigger deny_audit before insert on audit_logs for each row execute function deny_audit()",
  );
  await assert.rejects(change(db, d, grant("teacher")), /audit unavailable/);
  assert.equal((await detail(db)).assignments.length, 0);
  for (const role of ["admin", "teacher", "participant", "finance"]) {
    await db.query("select set_config('test.role',$1,false)", [role]);
    await assert.rejects(list(db), /superadmin/);
    await assert.rejects(detail(db), /superadmin/);
    await assert.rejects(change(db, d, grant("teacher")), /superadmin/);
  }
  await db.exec(
    "set test.role='super_admin';update profiles set status='inactive' where id='" +
      id(1) +
      "'",
  );
  await assert.rejects(list(db), /superadmin/);
  await db.exec("set test.actor=''");
  await assert.rejects(detail(db), /superadmin/);
});
test("server pagination/export exceed REST limit without truncation; read operations do not mutate", async (t) => {
  const db = await fixture(t);
  await db.exec(
    `insert into auth.users(id,email) select gen_random_uuid(),'person'||i||'@example.test' from generate_series(1,1200) i`,
  );
  const r = await list(db, { page: 13, size: 100 });
  assert.equal(r.total, 1203);
  assert.equal(r.rows.length, 3);
  const all = await list(db, { export: true });
  assert.equal(all.rows.length, 1203);
  assert.equal(
    (await db.query("select count(*)::int n from audit_logs")).rows[0].n,
    0,
  );
});
test("authenticated RPC works; private helper is denied and existing table RLS is preserved", async (t) => {
  const db = await fixture(t);
  await db.exec(
    "grant usage on schema public,auth to authenticated;set role authenticated",
  );
  assert.equal((await list(db)).total, 3);
  await assert.rejects(
    db.query("select system_user_assignments($1)", [id(2)]),
    /permission/,
  );
  await assert.rejects(db.exec("truncate user_roles"), /permission/);
  await db.exec("set test.role='participant'");
  assert.equal(
    (await db.query("delete from user_roles returning id")).rows.length,
    0,
  );
  await db.exec("set test.role='super_admin'");
  const d = await change(db, await detail(db), grant("teacher"));
  assert.equal(d.assignments[0].code, "teacher");
  const p = (
    await db.query(
      "select has_function_privilege('anon','public.system_users_list(jsonb)','execute') value",
    )
  ).rows[0].value;
  assert.equal(p, false);
});

test("another superadmin can be removed without losing owner; trusted signup inserts retain existing access", async (t) => {
  const db = await fixture(t);
  let d = await change(db, await detail(db), grant("super_admin"));
  const row = d.assignments.find((a) => a.code === "super_admin");
  d = await change(db, d, {
    operation: "revoke",
    assignment_id: row.id,
    reason: "Penugasan berakhir",
  });
  assert.equal(d.assignments.length, 0);
  assert.equal((await list(db)).stats.superadmins, 1);
  await db.exec(
    "create function trusted_enrollment_role(p_user uuid) returns void language sql security definer set search_path=public as $$insert into user_roles(user_id,role_id) select p_user,id from roles where code='participant';$$;grant usage on schema public,auth to authenticated;set role authenticated",
  );
  await db.query("select trusted_enrollment_role($1)", [id(2)]);
  assert.equal((await detail(db)).assignments[0].code, "participant");
});

test("canonical learner own scope is supported and personal-role grants cannot duplicate it", async (t) => {
  const db = await fixture(t);
  await db.exec(
    `insert into participants(id,user_id,global_participant_number,display_name) values('${id(30)}','${id(2)}','NIS-1','Peserta uji');insert into user_roles(user_id,role_id,scope_type,scope_id) select '${id(2)}',id,'own','${id(2)}' from roles where code='participant'`,
  );
  const d = await detail(db);
  assert.equal(d.assignments[0].scope_name, "Data sendiri");
  assert.equal(d.assignments[0].supported_scope, true);
  assert.equal((await list(db, { attention: "scope" })).total, 0);
  await assert.rejects(change(db, d, grant("participant")), /sudah ada/);
});
