import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = id(1);
let serial = 100;
async function as(db, role = "super_admin", user = actor) {
  await db.query(
    "select set_config('test.actor',$1,false),set_config('test.role',$2,false)",
    [user, role],
  );
}
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  let beforeMigration = null;
  for (const p of [
    "tests/fixtures/participant-sql-schema.sql",
    "tests/fixtures/settings-sql-schema.sql",
    "supabase/migrations/202606240007_phase_7_system_settings.sql",
    "supabase/migrations/20260626144957_phase_18_portal_themes.sql",
    "supabase/migrations/202607140002_system_display_text_settings.sql",
    "supabase/migrations/20260627100000_phase_23_transcript_settings.sql",
    "supabase/migrations/202610310013_settings_workspace.sql",
  ]) {
    try {
      if (p.includes("013_settings"))
        beforeMigration = (
          await db.query("select to_jsonb(s) record from system_settings s")
        ).rows;
      await db.exec(
        await readFile(new URL("../" + p, import.meta.url), "utf8"),
      );
      if (p.includes("013_settings")) {
        assert.deepEqual(
          (await db.query("select to_jsonb(s) record from system_settings s"))
            .rows,
          beforeMigration,
        );
        assert.equal(
          (await db.query("select count(*)::int n from audit_logs")).rows[0].n,
          0,
        );
      }
    } catch (e) {
      console.error({
        p,
        message: e.message,
        position: e.position,
        where: e.where,
      });
      throw e;
    }
  }
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    actor,
    "super@example.test",
  ]);
  await db.exec("insert into roles(code)values('super_admin');");
  await db.query(
    "insert into user_roles(user_id,role_id)select $1,id from roles where code='super_admin'",
    [actor],
  );
  await as(db);
  return db;
}
async function row(db) {
  return (await db.query("select * from system_settings")).rows[0];
}
async function save(db, payload, key = id(serial++), version) {
  const s = await row(db);
  return (
    await db.query("select admin_save_system_settings($1,$2,$3,$4) result", [
      s.id,
      JSON.stringify(payload),
      version ?? s.updated_at,
      key,
    ])
  ).rows[0].result;
}
test("settings patch preserves unrelated document settings and serializes confirmed fields with audit", async (t) => {
  const db = await fixture(t);
  await db.exec(
    "update system_settings set transcript_official_name='Pejabat A';",
  );
  const r = await save(db, {
    contact_phone: "081234567890",
    institution_name: " Lembaga Baru ",
  });
  assert.equal(r.institution_name, "Lembaga Baru");
  assert.equal(r.transcript_official_name, "Pejabat A");
  assert.equal(
    (await db.query("select count(*)::int n from audit_logs")).rows[0].n,
    1,
  );
});
test("retries return the same result and a key cannot be reused with different content", async (t) => {
  const db = await fixture(t);
  const s = await row(db),
    key = id(serial++),
    a = await save(db, { address: "Bandung" }, key, s.updated_at);
  assert.deepEqual(
    await save(db, { address: "Bandung" }, key, s.updated_at),
    a,
  );
  await assert.rejects(
    () => save(db, { address: "Jakarta" }, key, s.updated_at),
    /Permintaan berbeda/,
  );
  assert.equal(
    (await db.query("select count(*)::int n from audit_logs")).rows[0].n,
    1,
  );
});
test("stale versions cannot overwrite another admin and validation rejects unsupported values", async (t) => {
  const db = await fixture(t);
  const s = await row(db);
  await save(db, { institution_name: "Nama baru" });
  await assert.rejects(
    () =>
      save(
        db,
        { contact_email: "other@example.test" },
        undefined,
        s.updated_at,
      ),
    /telah berubah/,
  );
  for (const p of [
    { id: actor },
    { institution_name: "" },
    { institution_name: "x".repeat(161) },
    { contact_email: "bad" },
    { contact_phone: "abc" },
    { logo_url: "javascript:alert(1)" },
    { logo_url: "https://user:pass@example.test/image.png" },
    { portal_themes: { learner: "invalid" } },
    { portal_themes: { unknown: "emerald" } },
    { portal_themes: null },
    { institution_name: 2 },
  ])
    await assert.rejects(() => save(db, p));
});
test("roles, inactive users, anon and direct writes cannot bypass the RPC", async (t) => {
  const db = await fixture(t);
  await as(db, "admin");
  await assert.rejects(() => save(db, { address: "X" }), /superadmin/);
  await as(db);
  await db.query("update profiles set status='inactive' where id=$1", [actor]);
  await assert.rejects(() => save(db, { address: "X" }), /superadmin/);
  await db.query("update profiles set status='active' where id=$1", [actor]);
  await db.exec("set role authenticated");
  await assert.rejects(
    () => db.exec("update system_settings set institution_name='Bypass'"),
    /permission denied/,
  );
  await assert.rejects(
    () => db.exec("select * from system_settings_operations"),
    /permission denied/,
  );
  await db.exec("reset role");
  const a = (
    await db.query(
      "select has_function_privilege('anon','admin_save_system_settings(uuid,jsonb,timestamptz,uuid)','execute') anon,has_function_privilege('authenticated','settings_register_brand_asset(uuid,uuid,text,text,text,integer)','execute') internal",
    )
  ).rows[0];
  assert.deepEqual(a, { anon: false, internal: false });
});
test("audit failure rolls back the config and operation receipt", async (t) => {
  const db = await fixture(t);
  const s = await row(db);
  await db.exec(
    "create function fail_audit() returns trigger language plpgsql as $$begin raise exception 'audit failed';end;$$;create trigger fail_audit before insert on audit_logs for each row execute function fail_audit();",
  );
  await assert.rejects(
    () => save(db, { address: "Other address" }),
    /audit failed/,
  );
  assert.equal((await row(db)).address, s.address);
  assert.equal(
    (await db.query("select count(*)::int n from system_settings_operations"))
      .rows[0].n,
    0,
  );
});
test("theme updates fill all five portals and leave other values intact", async (t) => {
  const db = await fixture(t);
  const result = await save(db, { portal_themes: { mentor: "amber" } });
  assert.equal(result.portal_themes.mentor, "amber");
  assert.equal(Object.keys(result.portal_themes).length, 5);
  assert.equal(result.portal_themes.learner, "emerald");
});
test("initialization preserves existing singleton and creates only once when genuinely empty", async (t) => {
  const db = await fixture(t);
  const original = await row(db);
  const first = (
    await db.query("select admin_create_system_settings($1) result", [
      id(serial++),
    ])
  ).rows[0].result;
  assert.equal(first.id, original.id);
  assert.equal(
    (await db.query("select count(*)::int n from audit_logs")).rows[0].n,
    0,
  );
  await db.exec(
    "delete from system_settings_operations;delete from system_settings;",
  );
  const key = id(serial++);
  const a = (
    await db.query("select admin_create_system_settings($1) result", [key])
  ).rows[0].result;
  const b = (
    await db.query("select admin_create_system_settings($1) result", [key])
  ).rows[0].result;
  assert.equal(a.id, b.id);
  assert.equal(
    (await db.query("select count(*)::int n from system_settings")).rows[0].n,
    1,
  );
});
test("branding registration validates actor, key, URL and type and never exposes registry to browsers", async (t) => {
  const db = await fixture(t);
  const asset = id(99);
  const args = [
    actor,
    asset,
    `branding/${asset}.png`,
    `https://project.supabase.co/functions/v1/settings-assets?asset=${asset}`,
    "image/png",
    32,
  ];
  const rpc = (values) =>
    db.query(
      "select settings_register_brand_asset($1,$2,$3,$4,$5,$6) result",
      values,
    );
  const r = (await rpc(args)).rows[0].result;
  assert.equal(r.asset_id, asset);
  await assert.rejects(
    () => rpc([...args.slice(0, 2), "../secret", ...args.slice(3)]),
    /Metadata/,
  );
  await assert.rejects(() => rpc([id(999), ...args.slice(1)]), /Akses/);
  await save(db, { logo_url: r.url });
  await assert.rejects(
    () =>
      save(db, {
        favicon_url: `https://project.supabase.co/functions/v1/settings-assets?asset=${id(98)}`,
      }),
    /belum terkonfirmasi/,
  );
  await db.exec("set role authenticated");
  await assert.rejects(
    () => db.exec("select * from system_brand_assets"),
    /permission denied/,
  );
  await db.exec("reset role");
});
