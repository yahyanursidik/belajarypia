import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const superadmin = id(1),
  reporter = id(2),
  other = id(3),
  admin = id(4),
  desk = id(5),
  desk2 = id(6),
  finance = id(7),
  mentor = id(8),
  guardian = id(9),
  program = id(11),
  foreign = id(12),
  enrol = id(31),
  invoice = id(41);
let serial = 100;
async function actor(db, user) {
  await db.query("select set_config('test.actor',$1,false)", [user]);
}
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  for (const path of [
    "tests/fixtures/participant-sql-schema.sql",
    "tests/fixtures/announcement-sql-schema.sql",
    "supabase/migrations/20260627080000_phase_22_helpdesk.sql",
  ])
    await db.exec(
      await readFile(new URL("../" + path, import.meta.url), "utf8"),
    );
  await db.exec(
    `create table finance_invoices(id uuid primary key,program_id uuid,enrollment_id uuid,participant_id uuid,invoice_number text,created_at timestamptz default now());`,
  );
  const ann = await readFile(
    new URL(
      "../supabase/migrations/202610310012_announcement_workspace.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(
    ann.slice(
      ann.indexOf("create or replace function public.announcement_recipient"),
      ann.indexOf("create or replace function public.announcement_visible"),
    ),
  );
  for (let n = 1; n <= 10; n++)
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [
        id(n),
        `user${n}@example.test`,
        JSON.stringify({ full_name: `Akun ${n}` }),
      ],
    );
  await db.exec(
    `insert into roles(code) values('super_admin'),('admin'),('helpdesk'),('finance'),('mentor'),('guardian');`,
  );
  for (const [n, role, scope] of [
    [1, "super_admin", null],
    [2, "participant", null],
    [3, "participant", null],
    [4, "admin", program],
    [5, "helpdesk", program],
    [6, "helpdesk", null],
    [7, "finance", program],
    [8, "mentor", program],
    [9, "guardian", null],
  ])
    await db.query(
      "insert into user_roles(user_id,role_id,scope_type,scope_id) select $1,id,case when $3::uuid is null then null else 'program' end,$3 from roles where code=$2",
      [id(n), role, scope],
    );
  await db.query(
    "insert into programs(id,code,name,unit_id) values($1,'A','Program A',$3),($2,'B','Program B',$4)",
    [program, foreign, id(21), id(22)],
  );
  await db.query(
    "insert into participants(id,user_id,global_participant_number,display_name) values($1,$2,'P1','Peserta A'),($3,$4,'P2','Peserta B')",
    [id(51), reporter, id(52), other],
  );
  await db.query(
    "insert into enrollments(id,participant_id,program_id,enrollment_number) values($1,$2,$3,'EN1'),($4,$5,$6,'EN2')",
    [enrol, id(51), program, id(32), id(52), foreign],
  );
  await db.query(
    "insert into finance_invoices(id,program_id,enrollment_id,participant_id,invoice_number) values($1,$2,$3,$4,'INV-A')",
    [invoice, program, enrol, id(51)],
  );
  await db.query("insert into guardians(id,user_id) values($1,$2);", [
    id(61),
    guardian,
  ]);
  await db.query(
    "insert into guardian_participants(guardian_id,participant_id) values($1,$2)",
    [id(61), id(51)],
  );
  await db.query(
    "insert into helpdesk_tickets(id,ticket_number,reporter_id,subject) values($1,'TKT-000009',$2,'Tiket lama')",
    [id(90), reporter],
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610310014_helpdesk_workspace.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    "grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;",
  );
  await actor(db, reporter);
  return db;
}
const payload = (extra = {}) => ({
  subject: "Materi belum tersedia",
  category: "academic",
  message: "Mohon bantu memeriksa materi ini.",
  target_program_id: program,
  enrollment_id: enrol,
  invoice_id: null,
  ...extra,
});
async function create(db, p = payload(), key = id(serial++)) {
  return (
    await db.query("select helpdesk_create($1,$2) r", [JSON.stringify(p), key])
  ).rows[0].r;
}
async function detail(db, tid) {
  return (await db.query("select helpdesk_detail($1) r", [tid])).rows[0].r;
}
async function list(db, view = "staff", filters = {}, offset = 0) {
  return (
    await db.query("select helpdesk_list($1,$2,$3,20) r", [
      view,
      JSON.stringify(filters),
      offset,
    ])
  ).rows[0].r;
}
async function reply(
  db,
  tid,
  body = "Balasan petugas",
  internal = false,
  status = "waiting_reporter",
  version = null,
  key = id(serial++),
) {
  return (
    await db.query("select helpdesk_reply($1,$2,$3,$4,$5,$6) r", [
      tid,
      body,
      internal,
      status,
      version ?? (await detail(db, tid)).ticket.updated_at,
      key,
    ])
  ).rows[0].r;
}
async function manage(db, tid, patch, version = null, key = id(serial++)) {
  return (
    await db.query("select helpdesk_manage($1,$2,$3,$4) r", [
      tid,
      JSON.stringify(patch),
      version ?? (await detail(db, tid)).ticket.updated_at,
      key,
    ])
  ).rows[0].r;
}
test("helpdesk transaction and privacy contracts", async (t) => {
  const db = await fixture(t);
  await t.test(
    "migration keeps legacy ticket and new numbering uses maximum suffix",
    async () => {
      const old = (
        await db.query("select * from helpdesk_tickets where id=$1", [id(90)])
      ).rows[0];
      assert.equal(old.subject, "Tiket lama");
      assert.equal(old.target_program_id, null);
      const a = await create(db);
      assert.equal((await detail(db, a.id)).ticket.ticket_number, "TKT-000010");
    },
  );
  await t.test(
    "creation is atomic and retries cannot duplicate the first message",
    async () => {
      const key = id(serial++),
        p = payload(),
        a = await create(db, p, key);
      assert.deepEqual(await create(db, p, key), a);
      assert.equal((await detail(db, a.id)).messages.length, 1);
      await assert.rejects(
        () => create(db, payload({ subject: "Berbeda" }), key),
        /Permintaan berbeda/,
      );
      const before = (
        await db.query("select count(*)::int n from helpdesk_tickets")
      ).rows[0].n;
      await db.exec(
        "create function fail_helpdesk_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable';end;$$;create trigger helpdesk_fail before insert on audit_logs for each row execute function fail_helpdesk_audit();",
      );
      await assert.rejects(() => create(db), /audit unavailable/);
      await db.exec("drop trigger helpdesk_fail on audit_logs");
      assert.equal(
        (await db.query("select count(*)::int n from helpdesk_tickets")).rows[0]
          .n,
        before,
      );
    },
  );
  await t.test(
    "context, membership, invoice ownership and allowlisted payload are enforced",
    async () => {
      for (const p of [
        payload({ target_program_id: foreign }),
        payload({ invoice_id: invoice }),
        payload({ reporter_id: other }),
        payload({ subject: "x" }),
        payload({ category: "unknown" }),
        payload({ message: "x".repeat(8001) }),
      ])
        await assert.rejects(() => create(db, p));
      await create(db, payload({ category: "billing", invoice_id: invoice }));
      await actor(db, guardian);
      await create(db, payload());
      await assert.rejects(
        () => create(db, payload({ category: "billing", invoice_id: invoice })),
        /tidak sesuai/,
      );
      await actor(db, reporter);
    },
  );
  let tid;
  await t.test(
    "scope and assignment restrict admin, helpdesk and finance queues",
    async () => {
      tid = (await create(db)).id;
      await actor(db, admin);
      assert.equal((await detail(db, tid)).ticket.can_manage, true);
      await manage(db, tid, { assigned_to: desk });
      await actor(db, desk2);
      await assert.rejects(() => detail(db, tid), /tidak dapat diakses/);
      await actor(db, finance);
      await assert.rejects(() => detail(db, tid), /tidak dapat diakses/);
      assert.ok((await list(db)).items.every((i) => i.category === "billing"));
      await actor(db, desk);
      assert.equal((await detail(db, tid)).ticket.can_manage, true);
      await actor(db, other);
      await assert.rejects(() => detail(db, tid));
      assert.equal((await list(db, "mine")).total, 0);
      await actor(db, admin);
      assert.ok(
        (await list(db)).items.every((i) => i.target_program_id === program),
      );
    },
  );
  await t.test(
    "notes are private through both RPC and direct RLS reads",
    async () => {
      await actor(db, reporter);
      const v = (await detail(db, tid)).ticket.updated_at;
      await actor(db, desk);
      await reply(db, tid, "Catatan rahasia", true, null);
      await actor(db, reporter);
      const d = await detail(db, tid);
      assert.equal(d.ticket.updated_at, v);
      assert.ok(d.messages.every((m) => !m.is_internal_note));
      await db.exec("set role authenticated");
      const direct = await db.query(
        "select message_body from helpdesk_messages where ticket_id=$1",
        [tid],
      );
      assert.ok(direct.rows.every((m) => m.message_body !== "Catatan rahasia"));
      await assert.rejects(
        () =>
          db.query(
            "insert into helpdesk_messages(ticket_id,sender_id,message_body) values($1,$2,'bypass')",
            [tid, reporter],
          ),
        /permission denied/,
      );
      await db.exec("reset role");
      await assert.rejects(
        () => reply(db, tid, "Note palsu", true, null),
        /tidak valid/,
      );
    },
  );
  await t.test(
    "replies lock versions, audit atomically and support explicit reopen with idempotent retry",
    async () => {
      await actor(db, desk);
      const v = (await detail(db, tid)).ticket.updated_at;
      const k = id(serial++);
      await reply(db, tid, "Solusi sudah diterapkan", false, "resolved", v, k);
      assert.deepEqual(
        await reply(
          db,
          tid,
          "Solusi sudah diterapkan",
          false,
          "resolved",
          v,
          k,
        ),
        { id: tid },
      );
      await assert.rejects(
        () => reply(db, tid, "Pesan usang", false, "in_progress", v),
        /telah berubah/,
      );
      await actor(db, reporter);
      await assert.rejects(
        () => reply(db, tid, "Masih bermasalah", false, null),
        /Konfirmasi/,
      );
      await reply(db, tid, "Masih bermasalah", false, "open");
      assert.equal((await detail(db, tid)).ticket.status, "open");
      await assert.rejects(
        () => reply(db, tid, "Ubah status", false, "closed"),
        /tidak valid/,
      );
    },
  );
  await t.test(
    "management validates assignees, new scope and public resolution; stale edits fail",
    async () => {
      await actor(db, admin);
      await assert.rejects(
        () => manage(db, tid, { assigned_to: reporter }),
        /Petugas/,
      );
      await assert.rejects(
        () => manage(db, tid, { target_program_id: foreign }),
        /di luar cakupan/,
      );
      await assert.rejects(
        () => manage(db, tid, { status: "closed" }),
        /ringkasan/,
      );
      const v = (await detail(db, tid)).ticket.updated_at;
      await manage(db, tid, {
        priority: "urgent",
        follow_up_at: "2020-01-01T00:00:00Z",
      });
      await assert.rejects(
        () => manage(db, tid, { priority: "low" }, v),
        /telah berubah/,
      );
      await manage(db, tid, {
        status: "closed",
        resolution_summary: "Sudah ditangani",
      });
      await actor(db, reporter);
      assert.equal(
        (await detail(db, tid)).ticket.resolution_summary,
        "Sudah ditangani",
      );
      assert.equal(
        (await detail(db, tid)).messages.at(-1).message_body,
        "Sudah ditangani",
      );
    },
  );
  await t.test(
    "counts and filters are server-wide, pagination and literal searches stay consistent",
    async () => {
      await actor(db, reporter);
      for (let n = 0; n < 23; n++)
        await create(db, payload({ subject: `Tiket halaman ${n}` }));
      await actor(db, admin);
      const all = await list(db);
      assert.ok(all.total > 20);
      assert.equal(all.items.length, 20);
      assert.ok((await list(db, "staff", {}, 20)).items.length > 0);
      assert.ok(all.stats.active > 20);
      assert.equal((await list(db, "staff", { q: "Tiket halaman" })).total, 23);
      assert.equal(
        (await list(db, "staff", { q: "%,subject.ilike.*" })).total,
        0,
      );
    },
  );
  await t.test(
    "inactive/anonymous callers and internal helper RPCs cannot bypass policies",
    async () => {
      await actor(db, id(10));
      await db.query("update profiles set status='inactive' where id=$1", [
        id(10),
      ]);
      await assert.rejects(() => create(db), /masuk/);
      await db.exec("set role authenticated");
      await assert.rejects(
        () => db.query("select helpdesk_ticket_json($1,true)", [tid]),
        /permission denied/,
      );
      await db.exec("reset role");
      await actor(db, null);
      await assert.rejects(() => detail(db, tid));
      await db.exec("set role anon");
      await assert.rejects(
        () => db.query("select helpdesk_list()"),
        /permission denied/,
      );
      await assert.rejects(
        () => db.query("select * from helpdesk_operations"),
        /permission denied/,
      );
      await db.exec("reset role");
    },
  );
});
