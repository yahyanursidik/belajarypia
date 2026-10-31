import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = async (db, n, role = "participant") =>
  db.exec(
    `reset role;set test.actor='${
      id(n)
    }';set test.role='${role}';set test.program='${
      id(20)
    }';set role authenticated;`,
  );
const rpc = async (db, name, args = [], casts = []) =>
  (await db.query(
    `select ${name}(${
      args.map((_, i) => "$" + (i + 1) + (casts[i] ? "::" + casts[i] : ""))
        .join(",")
    }) value`,
    args,
  )).rows[0].value;
const config = (kind = "text") => ({
  instructions: "Tuliskan hasil latihan.",
  response_kind: kind,
  checklist: kind === "checklist" ? ["Latihan pertama", "Latihan kedua"] : [],
  allow_late: false,
  due_at: "2099-01-01T00:00:00Z",
});
async function fixture(t, kind = "text") {
  const db = new PGlite();
  t.after(() => db.close());
  for (
    const file of [
      "tests/fixtures/participant-sql-schema.sql",
      "tests/fixtures/assignment-sql-schema.sql",
      "supabase/migrations/202610310022_assignment_workflow.sql",
    ]
  ) {
    await db.exec(
      await readFile(new URL("../" + file, import.meta.url), "utf8"),
    );
  }
  await db.exec(
    `insert into auth.users(id,email) values ${
      [1, 2, 3, 4, 5].map((n) => `('${id(n)}','user${n}@example.test')`).join(
        ",",
      )
    };
 insert into programs(id,code,name,teacher_user_id) values('${
      id(20)
    }','P1','Program satu','${id(3)}'),('${id(21)}','P2','Program lain',null);
 insert into classes(id,program_id,teacher_user_id) values('${id(30)}','${
      id(20)
    }','${id(4)}'),('${id(31)}','${id(20)}',null);
 insert into participants(id,user_id,global_participant_number,display_name) values('${
      id(10)
    }','${id(1)}','A','Peserta A'),('${id(11)}','${id(2)}','B','Peserta B');
 insert into enrollments(id,participant_id,program_id,class_id) values('${
      id(60)
    }','${id(10)}','${id(20)}','${id(30)}'),('${id(61)}','${id(11)}','${
      id(20)
    }','${id(31)}');
 insert into program_modules(id,program_id,title) values('${id(40)}','${
      id(20)
    }','Modul satu'),('${id(41)}','${id(21)}','Modul lain');
 insert into lessons(id,module_id,title,lesson_type,visibility_status) values('${
      id(50)
    }','${id(40)}','Tugas','assignment','draft'),('${id(51)}','${
      id(40)
    }','Prasyarat','content','published');`,
  );
  await actor(db, 3, "teacher");
  await rpc(db, "assignment_configure", [
    id(50),
    id(40),
    null,
    "Tugas refleksi",
    JSON.stringify(config(kind)),
    true,
  ]);
  await actor(db, 1);
  return db;
}
const detail = (db, e = null) => rpc(db, "assignment_detail", [id(50), e]);
const begin = (db) => rpc(db, "assignment_begin", [id(50)]);
const save = (
  db,
  s,
  submit = false,
  checks = [],
  files = [],
  text = "Jawaban peserta",
) =>
  rpc(db, "assignment_save", [
    s.id,
    s.revision,
    text,
    JSON.stringify(checks),
    files,
    submit,
  ], ["uuid", "uuid", "text", "jsonb", "uuid[]", "boolean"]);
const review = (
  db,
  s,
  decision = "accepted",
  score = 85,
  feedback = "Sudah baik",
) =>
  rpc(db, "assignment_review", [s.id, s.revision, decision, score, feedback]);
test("draft → submit → revision → resubmit → final preserves history and updates progress atomically", async (t) => {
  const db = await fixture(t);
  const first = await begin(db);
  assert.equal(await begin(db), first);
  let d = await detail(db);
  await save(db, d.history[0], true);
  await save(db, d.history[0], true); // retry is idempotent
  await actor(db, 4, "teacher");
  d = await detail(db, id(60));
  await review(db, d.history[0], "needs_revision", null, "Tambahkan contoh.");
  await actor(db, 1);
  const next = await begin(db);
  assert.notEqual(first, next);
  d = await detail(db);
  assert.equal(d.history[0].answer_text, "Jawaban peserta");
  assert.equal(d.history[0].attempt_number, 2);
  await save(db, d.history[0], true, [], [], "Jawaban dengan contoh");
  await actor(db, 3, "teacher");
  d = await detail(db, id(60));
  await review(db, d.history[0]);
  await assert.rejects(review(db, d.history[0]), /sudah ditinjau/);
  await db.exec("reset role");
  const p = (await db.query("select * from lesson_progresses")).rows[0];
  assert.equal(p.status, "completed");
  assert.equal(Number(p.score), 85);
  await actor(db, 1);
  d = await detail(db);
  assert.equal(d.history[1].answer_text, "Jawaban peserta");
  assert.equal(d.history[1].feedback, "Tambahkan contoh.");
  assert.equal(d.history[0].status, "accepted");
  await assert.rejects(save(db, d.history[0]), /tidak dapat ditimpa/);
});
test("scope, private drafts, self-grading and direct-table bypasses are rejected", async (t) => {
  const db = await fixture(t);
  await begin(db);
  let d = await detail(db);
  await save(db, d.history[0]);
  await actor(db, 4, "teacher");
  assert.equal((await detail(db, id(60))).history.length, 0);
  await assert.rejects(detail(db, id(61)), /Akses jawaban/);
  await assert.rejects(
    rpc(db, "assignment_configure", [
      id(50),
      id(40),
      null,
      "X",
      JSON.stringify(config()),
      true,
    ]),
    /Akses pengaturan/,
  );
  await actor(db, 1, "super_admin");
  d = await detail(db);
  await save(db, d.history[0], true);
  d = await detail(db);
  await assert.rejects(review(db, d.history[0]), /Akses penilaian/);
  await assert.rejects(
    db.query("select * from assignment_submissions"),
    /permission/,
  );
  await assert.rejects(
    db.query(`update assignment_files set status='ready'`),
    /permission/,
  );
  await assert.rejects(
    rpc(db, "assignment_mark_file_ready", [id(1), id(1), "key"]),
    /permission/,
  );
  await db.exec("reset role;set role anon");
  await assert.rejects(detail(db), /permission/);
});
test("stale writes preserve draft; configuration freezes after the first attempt", async (t) => {
  const db = await fixture(t);
  await begin(db);
  let d = await detail(db);
  const old = d.history[0];
  await save(db, old, false, [], [], "Versi baru");
  await assert.rejects(save(db, old), /Draf sudah berubah/);
  assert.equal((await detail(db)).history[0].answer_text, "Versi baru");
  await actor(db, 3, "teacher");
  d = await detail(db, id(60));
  await assert.rejects(
    rpc(db, "assignment_configure", [
      id(50),
      id(40),
      d.config.revision,
      "Tugas",
      JSON.stringify(config()),
      true,
    ]),
    /terkunci/,
  );
});
test("release, prerequisite, deadline, suspended actor and enrollment are server-enforced", async (t) => {
  const db = await fixture(t);
  for (
    const sql of [
      `update lessons set release_at='2099-01-01' where id='${id(50)}'`,
      `update profiles set status='inactive' where id='${id(1)}'`,
      `update enrollments set enrollment_status='hold' where id='${id(60)}'`,
    ]
  ) {
    await db.exec("reset role;begin;" + sql);
    await db.exec("set role authenticated");
    await assert.rejects(begin(db), /Akses tugas/);
    await db.exec("rollback;reset role;set role authenticated");
  }
  await db.exec(
    `reset role;insert into lesson_prerequisites values('${id(50)}','${
      id(51)
    }');set role authenticated;`,
  );
  await assert.rejects(begin(db), /prasyarat/);
  await db.exec(
    `reset role;delete from lesson_prerequisites;update lessons set due_at=now()-interval '1 day' where id='${
      id(50)
    }';set role authenticated;`,
  );
  await assert.rejects(begin(db), /Tenggat/);
});
test("checklist validation and late requested revisions remain usable", async (t) => {
  const db = await fixture(t, "checklist");
  await begin(db);
  let d = await detail(db);
  await assert.rejects(save(db, d.history[0], true, [0]), /Lengkapi/);
  await assert.rejects(
    save(db, d.history[0], false, [0, 0]),
    /Checklist|checklist/,
  );
  await save(db, d.history[0], true, [0, 1]);
  await actor(db, 3, "teacher");
  d = await detail(db, id(60));
  await assert.rejects(
    review(db, d.history[0], "needs_revision", null, ""),
    /umpan balik/,
  );
  await review(db, d.history[0], "needs_revision", null, "Periksa lagi");
  await db.exec(
    `reset role;update lessons set due_at=now()-interval '1 day' where id='${
      id(50)
    }'`,
  );
  await actor(db, 1);
  await begin(db);
  d = await detail(db);
  await save(db, d.history[0], true, [0, 1]);
});
test("attachment readiness, ownership, RLS, and immutable copies on revision", async (t) => {
  const db = await fixture(t, "document");
  const sid = await begin(db);
  let d = await detail(db);
  await assert.rejects(save(db, d.history[0], true), /Lengkapi/);
  await assert.rejects(
    rpc(db, "assignment_prepare_file", [sid, "film.mp4", "video/mp4", 100]),
    /Gunakan PDF/,
  );
  const f = await rpc(db, "assignment_prepare_file", [
    sid,
    "latihan.pdf",
    "application/pdf",
    9,
  ]);
  await assert.rejects(save(db, d.history[0], true, [], [f.id]), /belum siap/);
  await actor(db, 4, "teacher");
  assert.equal(
    (await db.query("select * from assignment_files")).rows.length,
    0,
  );
  await db.exec("reset role;set role service_role");
  await rpc(db, "assignment_mark_file_ready", [
    f.id,
    id(1),
    `assignments/ready/${f.id}/${id(80)}.pdf`,
  ]);
  await actor(db, 1);
  d = await detail(db);
  await save(db, d.history[0], true, [], [f.id]);
  await actor(db, 4, "teacher");
  assert.equal(
    (await db.query("select * from assignment_files")).rows.length,
    1,
  );
  d = await detail(db, id(60));
  await review(db, d.history[0], "needs_revision", null, "Perbaiki");
  await actor(db, 1);
  await begin(db);
  d = await detail(db);
  assert.equal(d.history[0].files.length, 1);
  assert.notEqual(d.history[0].files[0].id, f.id);
  assert.equal(d.history[1].files[0].id, f.id);
  await actor(db, 2);
  await assert.rejects(
    rpc(db, "assignment_download_file", [f.id]),
    /Akses dokumen/,
  );
});
test("review audit failure rolls back score, status and progress; legacy results remain intact", async (t) => {
  const db = await fixture(t);
  await begin(db);
  let d = await detail(db);
  await save(db, d.history[0], true);
  await actor(db, 3, "teacher");
  d = await detail(db, id(60));
  await db.exec(
    `reset role;create function reject_assignment_audit() returns trigger language plpgsql as $$begin if new.action='assignment.accepted' then raise exception 'audit failure';end if;return new;end;$$;create trigger fail_audit before insert on audit_logs for each row execute function reject_assignment_audit();set role authenticated;`,
  );
  await assert.rejects(review(db, d.history[0]), /audit failure/);
  assert.equal((await detail(db, id(60))).history[0].status, "submitted");
  await db.exec("reset role");
  assert.equal(
    (await db.query("select status from lesson_progresses")).rows[0].status,
    "started",
  );
  await db.exec(
    `insert into lesson_progresses(enrollment_id,participant_id,lesson_id,status,score) values('${
      id(61)
    }','${id(11)}','${id(50)}','completed',90);`,
  );
  await actor(db, 2);
  await assert.rejects(begin(db), /hasil lama/);
});

test("workspace connects scoped catalog, private learner drafts and revision review queues", async (t) => {
  const db = await fixture(t);
  const list = (view = "mine", status = "all", page = 1, search = "") =>
    rpc(db, "assignment_workspace", [view, null, status, page, search]);
  assert.equal((await list()).items[0].status, "not_started");
  await begin(db);
  let d = await detail(db);
  await save(db, d.history[0], true);
  await actor(db, 4, "teacher");
  assert.equal((await list("review", "submitted")).total, 1);
  assert.equal((await list("catalog")).modules.length, 0);
  d = await detail(db, id(60));
  await review(db, d.history[0], "needs_revision", null, "Tambahkan contoh.");
  await actor(db, 1);
  await begin(db);
  assert.equal((await list()).items[0].status, "draft");
  await actor(db, 4, "teacher");
  assert.equal((await list("review", "needs_revision")).total, 1);
  assert.equal((await list("review", "all", 2)).items.length, 0);
  assert.equal((await list("review", "all", 1, "tidak ditemukan")).total, 0);
  await actor(db, 5, "admin");
  const cat = await list("catalog");
  assert.equal(cat.modules.length, 1);
  assert.equal(cat.programs.length, 1);
  const created = await rpc(db, "assignment_configure", [
    null,
    id(40),
    null,
    "Tugas admin",
    JSON.stringify(config()),
    true,
  ]);
  assert.ok(created);
  await assert.rejects(
    rpc(db, "assignment_configure", [
      null,
      id(41),
      null,
      "Di luar cakupan",
      JSON.stringify(config()),
      true,
    ]),
    /Akses pengaturan/,
  );
  assert.equal((await list("catalog")).total, 2);
  await actor(db, 2);
  assert.equal(
    (await list()).items.find((x) => x.lesson_id === id(50)).status,
    "not_started",
  );
  await assert.rejects(list("review"), /Akses pengelolaan/);
});
