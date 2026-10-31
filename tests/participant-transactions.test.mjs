// Run with PGLITE_MODULE pointing to an externally installed @electric-sql/pglite.
// This test-only PostgreSQL engine is not an application dependency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const actor = '00000000-0000-4000-8000-000000000001';
const g1 = '00000000-0000-4000-8000-000000000002';
const g2 = '00000000-0000-4000-8000-000000000003';
const user = '00000000-0000-4000-8000-000000000004';
const participant = '00000000-0000-4000-8000-000000000005';
const program = '00000000-0000-4000-8000-000000000006';
const other = '00000000-0000-4000-8000-000000000007';
async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  for (const file of ['fixtures/participant-sql-schema.sql', '../supabase/migrations/202610310002_preserve_participant_enrollment.sql', '../supabase/migrations/202610310003_atomic_participant_guardians.sql']) {
    await db.exec(await readFile(new URL(file, import.meta.url), 'utf8'));
  }
  for (const [id,email] of [[actor,'admin@example.test'],[g1,'guardian1@example.test'],[g2,'guardian2@example.test'],[user,'participant@example.test']]) {
    await db.query('insert into auth.users(id,email,encrypted_password) values ($1,$2,$3)',[id,email,'original']);
  }
  await db.query("insert into participants(id,user_id,global_participant_number,display_name) values ($1,$2,'TEST-1','Peserta contoh')",[participant,user]);
  await db.query("insert into participants(id,global_participant_number,display_name) values ($1,'TEST-2','Peserta lain')",[other]);
  await db.query("insert into programs(id,code) values ($1,'TAHSIN')",[program]);
  await db.exec(`set test.actor = '${actor}'; set test.role = 'super_admin';`);
  return db;
}
async function guardian(db,action,profile=null,relation=null,pid=participant) {
  return (await db.query('select admin_manage_participant_guardian($1,$2,$3,$4) as result',[pid,action,profile,relation])).rows[0].result;
}
async function save(db,email='participant@example.test',code='TAHSIN',nis='TEST-1') {
  return (await db.query("select admin_create_participant_with_user($1,'new-password','Peserta contoh','',$2,'Laki-laki','adult','','',$3) as result",[email,nis,code])).rows[0].result;
}

test('repeat import preserves all enrollment statuses, placement, password and account count', async (t) => {
  const db = await fixture(t);
  for (const status of ['active','hold','completed','cancelled','pending']) {
    await db.query('insert into enrollments(participant_id,program_id,enrollment_status,batch_id,class_id,halaqah_id) values ($1,$2,$3,$4,$4,$4) on conflict(participant_id,program_id) do update set enrollment_status=$3',[participant,program,status,g1]);
    const result=await save(db,' PARTICIPANT@EXAMPLE.TEST ');
    assert.equal(result.enrollment_action,'unchanged');
    const row=(await db.query('select * from enrollments')).rows[0];
    assert.equal(row.enrollment_status,status);
    assert.equal(row.batch_id,g1); assert.equal(row.class_id,g1); assert.equal(row.halaqah_id,g1);
  }
  assert.equal((await db.query('select encrypted_password from auth.users where id=$1',[user])).rows[0].encrypted_password,'original');
  assert.equal((await db.query('select count(*)::int as count from auth.users')).rows[0].count,4);
  assert.equal((await db.query('select count(*)::int as count from enrollments')).rows[0].count,1);
});

test('new participant is saved with identity, role, optional program and audit without password', async (t) => {
  const db=await fixture(t);
  const noProgram=await save(db,'new@example.test',null,'TEST-NEW');
  assert.equal(noProgram.status,'created'); assert.equal(noProgram.enrollment_action,'none');
  assert.equal((await db.query('select count(*)::int as count from auth.identities')).rows[0].count,1);
  assert.equal((await db.query('select count(*)::int as count from user_roles')).rows[0].count,1);
  const enrolled=await save(db,'new@example.test','TAHSIN','TEST-IGNORED');
  assert.equal(enrolled.participant_id,noProgram.participant_id); assert.equal(enrolled.enrollment_action,'created');
  const audit=JSON.stringify((await db.query('select details from audit_logs')).rows);
  assert.ok(!audit.includes('new-password')); assert.ok(!audit.includes('new@example.test'));
});

test('authorization and invalid program roll back provisioning', async (t) => {
  const db=await fixture(t);
  await db.exec("set test.role = 'participant';");
  await assert.rejects(()=>save(db,'blocked@example.test',null,'BLOCKED'),/administrator/);
  await db.exec("set test.role = 'super_admin'; update programs set status='archived';");
  await assert.rejects(()=>save(db,'blocked@example.test','TAHSIN','BLOCKED'),/tidak aktif/);
  assert.equal((await db.query("select count(*)::int as count from auth.users where email='blocked@example.test'")).rows[0].count,0);
});

test('guardian attach is idempotent; primary switch and detach preserve one primary', async (t) => {
  const db=await fixture(t);
  const first=await guardian(db,'attach',g1);
  const repeat=await guardian(db,'attach',g1);
  assert.equal(first.relation_id,repeat.relation_id); assert.equal(repeat.status,'unchanged');
  const second=await guardian(db,'attach',g2);
  await guardian(db,'primary',null,second.relation_id);
  assert.equal((await db.query('select id from guardian_participants where is_primary')).rows[0].id,second.relation_id);
  await guardian(db,'detach',null,second.relation_id);
  assert.equal((await db.query('select id from guardian_participants where is_primary')).rows[0].id,first.relation_id);
  assert.equal((await db.query('select count(*)::int as count from guardians')).rows[0].count,2);
});

test('failed primary switch rolls back; foreign relation, self, inactive profile and nonadmin rejected', async (t) => {
  const db=await fixture(t);
  const first=await guardian(db,'attach',g1); const second=await guardian(db,'attach',g2);
  await db.exec(`create function fixture_reject_primary() returns trigger language plpgsql as $$ begin if new.id='${second.relation_id}' and new.is_primary then raise exception 'fixture failure'; end if; return new; end; $$;
    create trigger fixture_reject_primary before update on guardian_participants for each row execute function fixture_reject_primary();`);
  await assert.rejects(()=>guardian(db,'primary',null,second.relation_id),/fixture failure/);
  assert.equal((await db.query('select id from guardian_participants where is_primary')).rows[0].id,first.relation_id);
  await assert.rejects(()=>guardian(db,'primary',null,first.relation_id,other),/tidak ditemukan/);
  await assert.rejects(()=>guardian(db,'attach',user),/berbeda/);
  await db.query("update profiles set status='inactive' where id=$1",[g2]);
  await assert.rejects(()=>guardian(db,'attach',g2),/tidak aktif/);
  await db.exec("set test.role = 'participant';");
  await assert.rejects(()=>guardian(db,'detach',null,first.relation_id),/tidak memiliki akses/);
});

test('guardian RLS reads and scoped admin mutations do not cross participant scope', async (t) => {
  const db=await fixture(t);
  await guardian(db,'attach',g1); await guardian(db,'attach',g2,null,other);
  await db.exec(`set test.role='admin'; set test.scope='${participant}'; set role authenticated;`);
  assert.equal((await db.query('select count(*)::int as count from guardian_participants')).rows[0].count,1);
  assert.equal((await db.query('select count(*)::int as count from guardians')).rows[0].count,1);
  await assert.rejects(()=>guardian(db,'attach',g2,null,other),/tidak memiliki akses/);
  await db.exec("set test.role='participant';");
  assert.equal((await db.query('select count(*)::int as count from guardian_participants')).rows[0].count,0);
});


test('direct enrollment is scoped, validates placement and preserves a cancelled enrollment', async (t) => {
  const db=await fixture(t);
  const enroll=async (pid=participant,cls=null)=>(await db.query('select direct_enroll_participant($1,$2,null,$3,null) as result',[pid,program,cls])).rows[0].result;
  await db.exec("set test.role='participant';");
  await assert.rejects(()=>enroll(),/tidak memiliki akses/);
  await db.exec("set test.role='admin';");
  await assert.rejects(()=>enroll(),/tidak memiliki akses/);
  await db.exec(`set test.program='${program}';`);
  await assert.rejects(()=>enroll(participant,g1),/Kelas tidak sesuai/);
  const created=await enroll();
  assert.equal(created.enrollment_action,'created');
  assert.equal((await db.query('select count(*)::int as count from onboarding_step_progresses')).rows[0].count,3);
  await db.query("update enrollments set enrollment_status='cancelled',class_id=$1",[g1]);
  const repeated=await enroll(); assert.equal(repeated.enrollment_action,'unchanged');
  assert.equal((await db.query('select class_id,enrollment_status from enrollments')).rows[0].class_id,g1);
  assert.equal((await db.query('select class_id,enrollment_status from enrollments')).rows[0].enrollment_status,'cancelled');
  assert.equal((await db.query('select count(*)::int as count from enrollment_status_logs')).rows[0].count,1);
  const saved=await save(db,'scoped-new@example.test','TAHSIN','SCOPED-NEW');
  assert.equal(saved.enrollment_action,'created');
});
