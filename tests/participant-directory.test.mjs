import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeParticipants, validateParticipant, participantPayload, participantPage, participantSaveResult, safeParticipantSearch, emptyParticipantInput } from '../src/lib/participantDirectory.ts';
const programs=[{id:'p1',code:'THS',name:'Tahsin',status:'active'},{id:'p2',code:'OLD',name:'Arsip',status:'archived'}];
const input={...emptyParticipantInput,name:'Aisyah',email:'aisyah@example.test',password:'Keep spaces  ',programCode:'THS'};
test('individual and CSV accept participants without a program',()=>{
 assert.deepEqual(validateParticipant({...input,programCode:''},programs),[]);
 const rows=analyzeParticipants([{'Nama Lengkap':'Aisyah',Email:'aisyah@example.test',Password:'secret123'}],programs);
 assert.deepEqual(rows[0].errors,[]);assert.equal(rows[0].input.programCode,'');
});
test('CSV rejects duplicate email and participant number within a file',()=>{
 const rows=analyzeParticipants([{'Nama Lengkap':'A',Email:'A@example.test',Password:'secret123','Nomor Induk':'NIS1'},{'Nama Lengkap':'B',Email:'a@example.test',Password:'secret123','Nomor Induk':'NIS1'}],programs);
 assert.equal(rows[0].errors.length,0);assert.ok(rows[1].errors.some((e)=>e.includes('Email berulang')));assert.ok(rows[1].errors.some((e)=>e.includes('Nomor induk berulang')));
});
test('unknown or archived programs do not pass validation',()=>{
 for(const code of ['BAD','OLD'])assert.ok(validateParticipant({...input,programCode:code},programs).length);
 assert.deepEqual(validateParticipant({...input,programCode:'ths'},programs),[]);
});
test('payload normalizes email without modifying the password',()=>{
 const payload=participantPayload({...input,email:' A@EXAMPLE.TEST ',nis:''});
 assert.equal(payload.p_email,'a@example.test');assert.equal(payload.p_password,input.password);assert.ok(payload.p_nis.startsWith('NIS-'));assert.notEqual(payload.p_nis,participantPayload({...input,nis:''}).p_nis);
});
test('invalid values cannot produce an unbounded page offset',()=>{
 for(const value of [null,'Infinity','-1','0','abc','1.2','9999999999999999999999'])assert.equal(participantPage(value),1);
 assert.equal(participantPage('2'),2);
});
test('search removes raw PostgREST separators',()=>{
 assert.equal(safeParticipantSearch('Aisyah,(test)%*"\\'),'Aisyah test');
 assert.equal(safeParticipantSearch('NIS-2026-001'),'NIS-2026-001');
});


test('save result distinguishes retained enrollment and rejects missing confirmation', () => {
  const existing = participantSaveResult({participant_id:'participant-1',status:'enrolled_existing',enrollment_action:'unchanged'});
  assert.equal(existing.existing,true);
  assert.match(existing.message,/penempatan lama dipertahankan/);
  assert.match(participantSaveResult({participant_id:'participant-2',status:'created',enrollment_action:'created'}).message,/program ditambahkan/);
  assert.throws(()=>participantSaveResult(null),/belum mengonfirmasi/);
  assert.throws(()=>participantSaveResult({status:'created'}),/belum mengonfirmasi/);
});
