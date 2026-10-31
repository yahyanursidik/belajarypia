import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = id(1),
  learner = id(2),
  person = id(3),
  program = id(4),
  enrollment = id(5),
  channel = id(6);
let serial = 100;
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  for (const file of [
    "tests/fixtures/participant-sql-schema.sql",
    "tests/fixtures/finance-sql-schema.sql",
    "supabase/migrations/20260626143651_phase_17_finance.sql",
    "supabase/migrations/202607140001_finance_donation_wakaf.sql",
    "supabase/migrations/202607140004_link_donor_profiles_to_participants.sql",
    "supabase/migrations/202607140005_wakaf_commitment_details_and_reminder_day.sql",
    "supabase/migrations/202607140006_finance_accounting.sql",
    "supabase/migrations/202610310010_finance_workspace.sql",
    "supabase/migrations/202610310011_finance_integrity_followup.sql",
  ]) {
    try {
      await db.exec(
        await readFile(new URL("../" + file, import.meta.url), "utf8"),
      );
    } catch (e) {
      console.error({
        file,
        error: e.message,
        position: e.position,
        where: e.where,
      });
      throw e;
    }
  }
  await db.query(
    "insert into auth.users(id,email) values($1,'finance@example.test'),($2,'learner@example.test')",
    [actor, learner],
  );
  await db.query("insert into programs(id,code) values($1,'THS')", [program]);
  await db.query(
    "insert into participants(id,user_id,display_name,global_participant_number) values($1,$2,'Peserta uji','NIS-01')",
    [person, learner],
  );
  await db.query(
    "insert into enrollments(id,program_id,participant_id,enrollment_number,enrollment_status,payment_status) values($1,$2,$3,'ENR-01','hold','not_required')",
    [enrollment, program, person],
  );
  await db.query(
    "insert into donation_payment_channels(id,name,channel_type,bank_name,account_number,account_holder,purpose,asset_account_id) values($1,'Bank contoh','bank','Bank Uji','1234567890','Yayasan Uji','both',(select id from finance_accounts where code='1010'))",
    [channel],
  );
  await db.exec(
    `set test.actor='${actor}';set test.role='admin';set test.program='${program}';`,
  );
  return db;
}
const rpc = async (db, name, payload, key = id(serial++)) =>
  (
    await db.query(`select ${name}($1,$2) result`, [
      JSON.stringify(payload),
      key,
    ])
  ).rows[0].result;
async function bill(db, amount = 100, extra = {}) {
  return rpc(db, "finance_create_invoices", {
    program_id: program,
    enrollment_ids: [enrollment],
    title: "Biaya kelas",
    invoice_type: "education_infaq",
    amount,
    ...extra,
  });
}
async function proof(db) {
  const file = (
    await db.query(
      "select finance_prepare_document('proof','bukti.pdf','application/pdf',100) d",
    )
  ).rows[0].d;
  await db.query(
    "select finance_mark_document_ready($1::uuid,$2::uuid,'finance/ready/'||($1::uuid)::text||'/00000000-0000-4000-8000-000000009999.pdf')",
    [file.id, (await db.query("select auth.uid() id")).rows[0].id],
  );
  return file.id;
}
async function pay(db, invoiceId, amount = 100, extra = {}, key) {
  const ch = (
    await db.query(
      "select updated_at from donation_payment_channels where id=$1",
      [channel],
    )
  ).rows[0];
  const date = (
    await db.query(
      "select (now() at time zone 'Asia/Jakarta')::date::text date",
    )
  ).rows[0].date;
  return rpc(
    db,
    "finance_create_transaction",
    {
      invoice_id: invoiceId,
      transaction_type: invoiceId ? "education_infaq" : "donation",
      program_id: invoiceId ? program : null,
      amount,
      payment_channel_id: channel,
      channel_updated_at: ch.updated_at,
      payer_name: "Pembayar uji",
      paid_at: date,
      proof_document_id: await proof(db),
      ...extra,
    },
    key,
  );
}
async function review(
  db,
  tid,
  status = "verified",
  notes = "Bukti cocok",
  activate = false,
) {
  const tx = (
    await db.query("select updated_at from transactions where id=$1", [tid])
  ).rows[0];
  return (
    await db.query("select finance_review_transaction($1,$2,$3,$4,$5) result", [
      tid,
      status,
      notes,
      tx.updated_at,
      activate,
    ])
  ).rows[0].result;
}
test("invoice and payment submission are idempotent; verification posts balanced journal and preserves enrollment lifecycle", async (t) => {
  const db = await fixture(t);
  const payload = {
    program_id: program,
    enrollment_ids: [enrollment],
    title: "Bulanan",
    invoice_type: "spp",
    billing_month: "2026-10-01",
    amount: 100,
  };
  const key = id(serial++);
  const first = await rpc(db, "finance_create_invoices", payload, key);
  assert.deepEqual(
    await rpc(db, "finance_create_invoices", payload, key),
    first,
  );
  assert.equal(first.created, 1);
  await assert.rejects(
    () => rpc(db, "finance_create_invoices", payload),
    /sudah ada/,
  );
  const invoiceId = first.invoice_ids[0];
  const tx = await pay(db, invoiceId, 100, { status: "verified" });
  assert.equal(tx.status, "pending");
  assert.equal(
    (await db.query("select count(*)::int n from finance_journal_entries"))
      .rows[0].n,
    0,
  );
  await review(db, tx.transaction_id);
  assert.deepEqual(
    (await db.query("select payment_status,enrollment_status from enrollments"))
      .rows[0],
    { payment_status: "paid", enrollment_status: "hold" },
  );
  assert.equal(
    (await db.query("select status from finance_invoices")).rows[0].status,
    "paid",
  );
  assert.equal(
    (
      await db.query(
        "select sum(debit-credit)::text n from finance_journal_lines",
      )
    ).rows[0].n,
    "0.00",
  );
  await review(db, tx.transaction_id);
  assert.equal(
    (await db.query("select count(*)::int n from finance_journal_entries"))
      .rows[0].n,
    1,
  );
});
test("partial payments reserve unpaid balance and explicit activation happens only when all invoices are settled", async (t) => {
  const db = await fixture(t);
  const invoiceId = (await bill(db)).invoice_ids[0];
  const a = await pay(db, invoiceId, 60);
  await assert.rejects(() => pay(db, invoiceId, 50), /melebihi/);
  await review(db, a.transaction_id, "verified", "Cocok", true);
  assert.equal(
    (await db.query("select enrollment_status from enrollments")).rows[0]
      .enrollment_status,
    "hold",
  );
  const b = await pay(db, invoiceId, 40);
  await review(db, b.transaction_id, "verified", "Cocok", true);
  assert.equal(
    (await db.query("select enrollment_status from enrollments")).rows[0]
      .enrollment_status,
    "active",
  );
});
test("void creates one reversal and reopens the invoice without pretending to refund money or resetting enrollment status", async (t) => {
  const db = await fixture(t);
  const invoiceId = (await bill(db)).invoice_ids[0];
  const tx = await pay(db, invoiceId);
  await review(db, tx.transaction_id);
  await assert.rejects(
    () => review(db, tx.transaction_id, "void", ""),
    /alasan/,
  );
  await review(db, tx.transaction_id, "void", "Salah pencatatan");
  assert.equal(
    (await db.query("select count(*)::int n from finance_journal_entries"))
      .rows[0].n,
    2,
  );
  assert.equal(
    (
      await db.query(
        "select sum(debit-credit)::text n,sum(debit)::text d,sum(credit)::text c from finance_journal_lines",
      )
    ).rows[0].n,
    "0.00",
  );
  assert.equal(
    (await db.query("select status from finance_invoices")).rows[0].status,
    "open",
  );
  assert.equal(
    (await db.query("select payment_status from enrollments")).rows[0]
      .payment_status,
    "pending",
  );
  await review(db, tx.transaction_id, "void", "Salah pencatatan");
  assert.equal(
    (await db.query("select count(*)::int n from finance_journal_entries"))
      .rows[0].n,
    2,
  );
});
test("foreign proofs, duplicate references, stale reviews, invalid amounts and out-of-scope writes are rejected", async (t) => {
  const db = await fixture(t);
  const invoiceId = (await bill(db)).invoice_ids[0];
  await assert.rejects(() => pay(db, invoiceId, 0), /nominal/);
  const tx = await pay(db, invoiceId, 50, { reference_number: "REF-01" });
  await assert.rejects(
    () => pay(db, invoiceId, 50, { reference_number: "ref-01" }),
    /referensi/,
  );
  await assert.rejects(
    () =>
      db.query(
        "select finance_review_transaction($1,'verified','Cocok','2000-01-01',false)",
        [tx.transaction_id],
      ),
    /berubah/,
  );
  await db.exec("set test.role='teacher'");
  await assert.rejects(() => review(db, tx.transaction_id), /akses/);
  await assert.rejects(() => bill(db), /akses/);
  const acl = (
    await db.query(
      "select has_function_privilege('authenticated','finance_mark_document_ready(uuid,uuid,text)','execute') mark,has_function_privilege('anon','finance_create_transaction(jsonb,uuid)','execute') anon",
    )
  ).rows[0];
  assert.deepEqual(acl, { mark: false, anon: false });
});
test("audit failure rolls back verification, invoice balances and journals together", async (t) => {
  const db = await fixture(t);
  const invoiceId = (await bill(db)).invoice_ids[0];
  const tx = await pay(db, invoiceId);
  await db.exec(
    "create function block_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable';end;$$;create trigger block_audit before insert on audit_logs for each row execute function block_audit();",
  );
  await assert.rejects(
    () => review(db, tx.transaction_id),
    /audit unavailable/,
  );
  assert.equal(
    (await db.query("select status from transactions")).rows[0].status,
    "pending",
  );
  assert.equal(
    (await db.query("select count(*)::int n from finance_journal_entries"))
      .rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select status from finance_invoices")).rows[0].status,
    "open",
  );
});
test("invalid placeholder bank and media uploads stay unavailable; channel changes are scoped and versioned", async (t) => {
  const db = await fixture(t);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from donation_payment_channels where finance_channel_ready(id)",
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    () =>
      db.query(
        "select finance_prepare_document('proof','audio.mp3','audio/mpeg',100)",
      ),
    /dokumen/,
  );
  await assert.rejects(
    () =>
      db.query(
        "select finance_prepare_document('qr','scan.pdf','application/pdf',100)",
      ),
    /dokumen/,
  );
  await assert.rejects(
    () =>
      rpc(db, "finance_save_channel", {
        name: "Global",
        channel_type: "bank",
        program_id: null,
        is_active: true,
      }),
    /akses/,
  );
  const data = {
    name: "Rekening kelas",
    channel_type: "bank",
    program_id: program,
    purpose: "class",
    bank_name: "Bank Uji",
    account_number: "0000000000",
    account_holder: "Yayasan Uji",
    is_active: true,
  };
  await assert.rejects(() => rpc(db, "finance_save_channel", data), /Lengkapi/);
  const saved = await rpc(db, "finance_save_channel", {
    ...data,
    account_number: "1234567890",
  });
  assert.ok(saved.id);
  await assert.rejects(
    () =>
      rpc(db, "finance_save_channel", {
        ...data,
        id: saved.id,
        expected_updated_at: "2000-01-01",
        account_number: "1234567890",
      }),
    /berubah/,
  );
});
test("learner cannot pay another participant invoice or reuse a foreign or already attached proof", async (t) => {
  const db = await fixture(t);
  const invoiceId = (await bill(db)).invoice_ids[0];
  const foreign = await proof(db);
  await db.exec(`set test.actor='${learner}';set test.role='learner';`);
  await assert.rejects(
    () => pay(db, invoiceId, 50, { proof_document_id: foreign }),
    /bukan milik/,
  );
  const own = await proof(db);
  const a = await pay(db, invoiceId, 50, { proof_document_id: own });
  assert.equal(a.status, "pending");
  await assert.rejects(
    () => pay(db, invoiceId, 50, { proof_document_id: own }),
    /sudah digunakan/,
  );
  await db.query("update participants set user_id=null where id=$1", [person]);
  await assert.rejects(() => pay(db, invoiceId, 50), /bukan milik/);
  await assert.rejects(() => review(db, a.transaction_id), /akses/);
});
test("cancel restores baseline payment state; allocating a legacy receipt does not duplicate revenue", async (t) => {
  const db = await fixture(t);
  let invoiceId = (await bill(db)).invoice_ids[0];
  const stamp = (
    await db.query("select updated_at from finance_invoices where id=$1", [
      invoiceId,
    ])
  ).rows[0].updated_at;
  await db.query("select finance_cancel_invoice($1,'Biaya salah',$2)", [
    invoiceId,
    stamp,
  ]);
  assert.equal(
    (await db.query("select payment_status from enrollments")).rows[0]
      .payment_status,
    "not_required",
  );
  invoiceId = (await bill(db)).invoice_ids[0];
  const tx = await pay(db, invoiceId);
  await review(db, tx.transaction_id);
  await db.query("update transactions set invoice_id=null where id=$1", [
    tx.transaction_id,
  ]);
  const v = (
    await db.query("select updated_at from transactions where id=$1", [
      tx.transaction_id,
    ])
  ).rows[0].updated_at;
  await db.query("select finance_allocate_transaction($1,$2,$3)", [
    tx.transaction_id,
    invoiceId,
    v,
  ]);
  assert.equal(
    (await db.query("select count(*)::int n from finance_journal_entries"))
      .rows[0].n,
    1,
  );
  await assert.rejects(
    () =>
      db.query("select finance_cancel_invoice($1,'Salah',$2)", [
        invoiceId,
        stamp,
      ]),
    /berubah|pembayaran/,
  );
});
test("legacy empty journal can be repaired atomically; partial or incorrect lines are never silently accepted", async (t) => {
  const db = await fixture(t);
  const invoiceId = (await bill(db)).invoice_ids[0];
  const tx = await pay(db, invoiceId);
  await review(db, tx.transaction_id);
  const j = (
    await db.query(
      "select id from finance_journal_entries where transaction_id=$1",
      [tx.transaction_id],
    )
  ).rows[0].id;
  await db.query(
    "delete from finance_journal_lines where journal_entry_id=$1",
    [j],
  );
  await db.query("select finance_post_transactions($1)", [[tx.transaction_id]]);
  assert.equal(
    (await db.query("select count(*)::int n from finance_journal_entries"))
      .rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int n from finance_journal_lines"))
      .rows[0].n,
    2,
  );
  await db.query(
    "update finance_journal_lines set debit=1 where journal_entry_id=$1 and debit>0",
    [j],
  );
  await assert.rejects(
    () =>
      db.query("select finance_post_transactions($1)", [[tx.transaction_id]]),
    /tidak sesuai/,
  );
});
test("donor commitments are separate from cash, follow-ups are manual, and request keys avoid duplicate donors", async (t) => {
  const db = await fixture(t);
  const payload = {
    program_id: program,
    donor_name: "Donatur Contoh",
    commitment_type: "donation",
    amount: 100,
    frequency: "monthly",
    reminder_day_of_month: 15,
    status: "active",
  };
  const key = id(serial++);
  const c = await rpc(db, "finance_save_commitment", payload, key);
  assert.deepEqual(await rpc(db, "finance_save_commitment", payload, key), c);
  assert.equal(
    (await db.query("select count(*)::int n from donor_profiles")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int n from transactions")).rows[0].n,
    0,
  );
  const stamp = (
    await db.query("select updated_at from donor_commitments where id=$1", [
      c.id,
    ])
  ).rows[0].updated_at;
  await db.query(
    "select finance_record_followup($1,null,'Sudah dihubungi oleh admin',$2)",
    [c.id, stamp],
  );
  assert.match(
    (
      await db.query(
        "select reminder_notes from donor_commitments where id=$1",
        [c.id],
      )
    ).rows[0].reminder_notes,
    /Sudah dihubungi/,
  );
  await assert.rejects(
    () =>
      rpc(db, "finance_save_commitment", {
        ...payload,
        reminder_day_of_month: 31,
      }),
    /jadwal/,
  );
});
test("proof attachment is ownership checked and QR snapshot stays readable after channel changes", async (t) => {
  const db = await fixture(t);
  const invoiceId = (await bill(db)).invoice_ids[0];
  const tx = await pay(db, invoiceId);
  await db.query("update transactions set proof_document_id=null where id=$1", [
    tx.transaction_id,
  ]);
  const foreign = await proof(db);
  const stamp = (
    await db.query("select updated_at from transactions where id=$1", [
      tx.transaction_id,
    ])
  ).rows[0].updated_at;
  await db.exec(`set test.actor='${learner}';set test.role='learner';`);
  await assert.rejects(
    () =>
      db.query("select finance_attach_proof($1,$2,$3)", [
        tx.transaction_id,
        foreign,
        stamp,
      ]),
    /Dokumen/,
  );
  const doc = await proof(db);
  await db.query("select finance_attach_proof($1,$2,$3)", [
    tx.transaction_id,
    doc,
    stamp,
  ]);
  await db.exec(`set test.actor='${actor}';set test.role='admin';`);
  const qr = (
    await db.query(
      "select finance_prepare_document('qr','qr.png','image/png',100) d",
    )
  ).rows[0].d;
  await db.query(
    "select finance_mark_document_ready($1::uuid,$2::uuid,'finance/ready/'||($1::uuid)::text||'/00000000-0000-4000-8000-000000009999.pdf')",
    [qr.id, actor],
  );
  await db.query(
    "update transactions set channel_snapshot=jsonb_build_object('qr_document_id',$1::text) where id=$2",
    [qr.id, tx.transaction_id],
  );
  await db.exec(`set test.actor='${learner}';set test.role='learner';`);
  assert.equal(
    (await db.query("select finance_document_access($1) allowed", [qr.id]))
      .rows[0].allowed,
    true,
  );
  assert.equal(
    (await db.query("select finance_document_access($1) allowed", [foreign]))
      .rows[0].allowed,
    false,
  );
});
test("RLS exposes only own invoices and payments to learners, and browser mutations remain denied", async (t) => {
  const db = await fixture(t);
  const invoiceId = (await bill(db)).invoice_ids[0];
  await pay(db, invoiceId);
  await db.exec(
    `set test.role='learner';set test.actor='${learner}';set role authenticated;`,
  );
  assert.equal(
    (await db.query("select count(*)::int n from finance_invoices")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int n from transactions")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int n from donor_commitments")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int n from finance_journal_entries"))
      .rows[0].n,
    0,
  );
  await assert.rejects(
    () => db.query("update transactions set status='verified'"),
    /permission denied/,
  );
  await db.exec(
    `reset role;set test.actor='${id(99)}';set role authenticated;`,
  );
  assert.equal(
    (await db.query("select count(*)::int n from finance_invoices")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int n from transactions")).rows[0].n,
    0,
  );
  await db.exec("reset role");
});
test("staff-recorded donations inherit the validated donor participant; payload cannot assign an unrelated participant", async (t) => {
  const db = await fixture(t);
  const c = await rpc(db, "finance_save_commitment", {
    program_id: program,
    participant_id: person,
    commitment_type: "donation",
    amount: 100,
    frequency: "monthly",
    reminder_day_of_month: 15,
  });
  const payment = await pay(db, null, 100, {
    program_id: program,
    donor_id: c.donor_id,
    donor_commitment_id: c.id,
  });
  assert.equal(
    (
      await db.query("select participant_id from transactions where id=$1", [
        payment.transaction_id,
      ])
    ).rows[0].participant_id,
    person,
  );
  await assert.rejects(
    () => pay(db, null, 100, { program_id: program, participant_id: person }),
    /peserta|donatur/,
  );
  await db.exec(
    `set test.role='learner';set test.actor='${learner}';set role authenticated;`,
  );
  assert.equal(
    (
      await db.query("select count(*)::int n from transactions where id=$1", [
        payment.transaction_id,
      ])
    ).rows[0].n,
    1,
  );
  await db.exec("reset role");
});
test("balanced legacy journals with a different transaction amount block cancellation and roll back status", async (t) => {
  const db = await fixture(t);
  const invoiceId = (await bill(db)).invoice_ids[0];
  const payment = await pay(db, invoiceId);
  await review(db, payment.transaction_id);
  await db.exec(
    "update finance_journal_lines set debit=debit/2,credit=credit/2",
  );
  await assert.rejects(
    () => review(db, payment.transaction_id, "void", "Salah catatan"),
    /nominal|sesuai/,
  );
  assert.equal(
    (
      await db.query("select status from transactions where id=$1", [
        payment.transaction_id,
      ])
    ).rows[0].status,
    "verified",
  );
  assert.equal(
    (
      await db.query("select status from finance_invoices where id=$1", [
        invoiceId,
      ])
    ).rows[0].status,
    "paid",
  );
  assert.equal(
    (await db.query("select count(*)::int n from finance_journal_entries"))
      .rows[0].n,
    1,
  );
});
test("legacy zero or negative receipts cannot reduce invoice balances through allocation", async (t) => {
  const db = await fixture(t);
  const invoiceId = (await bill(db)).invoice_ids[0];
  const txid = id(serial++);
  await db.query(
    "insert into transactions(id,participant_id,program_id,amount,transaction_type,status) values($1,$2,$3,-10,'spp','pending')",
    [txid, person, program],
  );
  const stamp = (
    await db.query("select updated_at from transactions where id=$1", [txid])
  ).rows[0].updated_at;
  await assert.rejects(
    () =>
      db.query("select finance_allocate_transaction($1,$2,$3)", [
        txid,
        invoiceId,
        stamp,
      ]),
    /nominal|positif/,
  );
  assert.equal(
    (await db.query("select invoice_id from transactions where id=$1", [txid]))
      .rows[0].invoice_id,
    null,
  );
});
