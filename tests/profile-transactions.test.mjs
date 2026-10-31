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
    "supabase/migrations/202610310017_users_workspace.sql",
    "supabase/migrations/202610310018_users_own_scope.sql",
    "supabase/migrations/202610310020_profile_workspace.sql",
  ])
    await db.exec(
      await readFile(new URL("../" + file, import.meta.url), "utf8"),
    );
  await db.exec(
    `insert into auth.users(id,email,encrypted_password,email_confirmed_at,last_sign_in_at,banned_until,raw_user_meta_data) values('${id(1)}','own@example.test','SECRET_HASH',now(),now(),null,'{"full_name":"Pemilik Contoh","SECRET":"TOKEN"}'),('${id(2)}','other@example.test','SECRET_HASH',null,null,null,'{"full_name":"Akun Lain"}');update profiles set phone='+62 812 3456 7890' where id='${id(1)}';set test.actor='${id(1)}';set test.role='super_admin';insert into user_roles(user_id,role_id) select '${id(1)}',id from roles where code='super_admin';`,
  );
  return db;
}
const read = async (db) =>
  (await db.query("select my_profile_workspace() value")).rows[0].value;
const save = async (db, r, patch) =>
  (
    await db.query("select my_profile_update($1,$2::jsonb) value", [
      r.revision,
      JSON.stringify(patch),
    ])
  ).rows[0].value;
test("own workspace loads persisted phone, real status and only necessary login metadata", async (t) => {
  const db = await fixture(t);
  const r = await read(db);
  assert.equal(r.profile.phone, "+62 812 3456 7890");
  assert.equal(r.profile.id, id(1));
  assert.equal(r.login.email_confirmed, true);
  assert.equal(r.login.password_enabled, true);
  assert.equal(r.assignments[0].code, "super_admin");
  assert.equal(JSON.stringify(r).includes("SECRET"), false);
  assert.equal(r.history.length, 0);
  await db.exec(`set test.actor='${id(2)}';set test.role='participant';`);
  const other = await read(db);
  assert.equal(other.profile.id, id(2));
  assert.equal(other.assignments.length, 0);
  assert.equal(other.login.email_confirmed, false);
  assert.equal(JSON.stringify(other).includes("own@example.test"), false);
});
test("patch updates own name without clearing phone; audits field names, preserves credentials/roles and supports no-op", async (t) => {
  const db = await fixture(t);
  let before = await read(db);
  const after = await save(db, before, { full_name: "  Nama Baru  " });
  assert.equal(after.profile.full_name, "Nama Baru");
  assert.equal(after.profile.phone, before.profile.phone);
  assert.notEqual(after.revision, before.revision);
  assert.equal(after.saved, true);
  assert.deepEqual(after.history[0].fields, ["full_name"]);
  const a = (await db.query("select details from audit_logs")).rows[0].details;
  assert.deepEqual(a, { fields: ["full_name"] });
  assert.equal(JSON.stringify(a).includes("Nama Baru"), false);
  assert.equal(
    (
      await db.query(
        `select encrypted_password from auth.users where id='${id(1)}'`,
      )
    ).rows[0].encrypted_password,
    "SECRET_HASH",
  );
  assert.equal(
    (await db.query("select count(*) n from user_roles")).rows[0].n,
    1,
  );
  const noOp = await save(db, after, { full_name: "Nama Baru" });
  assert.equal(noOp.saved, false);
  assert.equal(noOp.revision, after.revision);
  assert.equal(noOp.history.length, 1);
  const clear = await save(db, noOp, { phone: null });
  assert.equal(clear.profile.phone, null);
  assert.deepEqual(clear.history[0].fields, ["phone"]);
  assert.equal(
    (await db.query(`select full_name from profiles where id='${id(2)}'`))
      .rows[0].full_name,
    "Akun Lain",
  );
});
test("rejects stale revision, foreign payload and invalid formats; rollback preserves contact", async (t) => {
  const db = await fixture(t);
  const before = await read(db);
  await save(db, before, { full_name: "Versi Kedua" });
  await assert.rejects(
    save(db, before, { phone: "08123456789" }),
    /sudah berubah/,
  );
  const current = await read(db);
  for (const patch of [
    { status: "active" },
    { email: "fake@example.test" },
    { id: id(2) },
    { user_id: id(2) },
    { full_name: null },
    { full_name: 3 },
    { phone: 99 },
    { phone: true },
    { full_name: "  " },
    { full_name: "A\nB" },
    { full_name: "A".repeat(161) },
    { phone: "+12" },
    { phone: "nomor telepon" },
    { phone: "123456789012345678901" },
  ])
    await assert.rejects(save(db, current, patch));
  assert.equal((await read(db)).profile.phone, current.profile.phone);
  await assert.rejects(
    db.query("select my_profile_update($1,null)", [current.revision]),
    /tidak valid/,
  );
  await assert.rejects(
    db.query("select my_profile_update($1,'[]')", [current.revision]),
    /tidak valid/,
  );
});
test("inactive/blocked accounts remain readable but cannot edit; missing actor and missing profile denied", async (t) => {
  const db = await fixture(t);
  await db.exec(`update profiles set status='suspended' where id='${id(1)}';`);
  let r = await read(db);
  assert.equal(r.profile.status, "suspended");
  await assert.rejects(save(db, r, { full_name: "Nama Baru" }), /tidak aktif/);
  await db.exec(
    `update profiles set status='active' where id='${id(1)}';update auth.users set banned_until=now()+interval '1 day' where id='${id(1)}';`,
  );
  r = await read(db);
  assert.equal(r.login.login_blocked, true);
  await assert.rejects(save(db, r, { full_name: "Nama Baru" }), /dibatasi/);
  await db.exec("set test.actor='';");
  await assert.rejects(read(db), /masuk kembali/);
  await assert.rejects(
    save(db, r, { full_name: "Nama Baru" }),
    /masuk kembali/,
  );
  await db.exec(`set test.actor='${id(99)}';`);
  await assert.rejects(read(db), /belum tersedia/);
});
test("audit failure rolls back profile update and revision", async (t) => {
  const db = await fixture(t);
  const before = await read(db);
  await db.exec(
    `create function reject_audit() returns trigger language plpgsql as $$begin raise exception 'audit failure';end;$$;create trigger reject_audit before insert on audit_logs for each row execute function reject_audit();`,
  );
  await assert.rejects(
    save(db, before, { full_name: "Nama Baru", phone: "08123456789" }),
    /audit failure/,
  );
  const after = await read(db);
  assert.equal(after.revision, before.revision);
  assert.equal(after.profile.full_name, before.profile.full_name);
  assert.equal(after.profile.phone, before.profile.phone);
});
test("authenticated only; callers cannot select another target or execute private assignment helper", async (t) => {
  const db = await fixture(t);
  await db.exec("set role authenticated;");
  const before = await read(db);
  assert.equal(
    (await save(db, before, { full_name: "Pemilik Baru" })).profile.id,
    id(1),
  );
  await assert.rejects(
    db.query("select system_user_assignments($1)", [id(2)]),
    /permission/,
  );
  await db.exec("reset role;set role anon;");
  await assert.rejects(read(db), /permission/);
  await assert.rejects(
    save(db, before, { full_name: "Anon Baru" }),
    /permission/,
  );
});
test("deployment preserves row fingerprints and existing table grants/policies", async (t) => {
  const db = await fixture(t);
  const snapshot = async () =>
    JSON.stringify(
      (
        await db.query(
          "select (select jsonb_agg(to_jsonb(p) order by id) from profiles p) profiles,(select jsonb_agg(to_jsonb(a) order by id) from auth.users a) auth,(select jsonb_agg(to_jsonb(a) order by id) from user_roles a) roles,(select count(*) from audit_logs) audit,(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where tablename='profiles') policies,(select relacl::text from pg_class where oid='profiles'::regclass) acl",
        )
      ).rows,
    );
  const before = await snapshot();
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610310020_profile_workspace.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await read(db);
  assert.equal(await snapshot(), before);
});
