import {test} from 'node:test';
import assert from 'node:assert/strict';
import {companionProgress,companionError} from '../src/lib/companionWorkspace.ts';
import {announcementAction} from '../src/lib/announcementWorkspace.ts';
import {wibDateKey} from '../src/lib/dateRange.ts';
test('family totals are weighted and unavailable curriculum is not a fabricated zero percent',()=>{
 assert.deepEqual(companionProgress([]),{total:0,completed:0,percent:null});
 assert.deepEqual(companionProgress([{total:2,completed:1},{total:8,completed:3}]),{total:10,completed:4,percent:40});
});
test('guardian announcement actions preserve program context without opening learner content or finance',()=>{
 assert.deepEqual(announcementAction({action_kind:'lesson',source_lesson_id:'private',target_program_id:'p'},'guardian'),{label:'Perkembangan anak',to:'/learner/anak-saya?program=p'});
 assert.equal(announcementAction({action_kind:'payment',target_program_id:'p'},'guardian').to,'/learner/bantuan?category=payment&contextProgram=p');
});
test('missing deployment is explained and midnight WIB belongs to new day',()=>{
 assert.match(companionError({code:'PGRST202'}),/belum diaktifkan/);
 assert.equal(wibDateKey('2026-10-31T17:01:00Z'),'2026-11-01');
});
