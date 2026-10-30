import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLearning, canCompleteReading } from '../src/lib/learningProgress.ts';
const modules = [{id:'a',order_no:1},{id:'b',order_no:2}];
const lesson = (id, module_id, order_no) => ({id,module_id,order_no,title:id,lesson_type:'text'});

test('continues in module order before global lesson order', () => {
 const result = summarizeLearning(modules,[lesson('later','b',1),lesson('first','a',10)],[]);
 assert.equal(result.next.id,'first');
});
test('completion only counts unique published lessons in this program', () => {
 const result = summarizeLearning(modules,[lesson('first','a',1)], [{lesson_id:'first',status:'completed'},{lesson_id:'first',status:'completed'},{lesson_id:'other-program',status:'completed'}]);
 assert.equal(result.percent,100);assert.equal(result.completed,1);assert.equal(result.next,null);assert.equal(result.finished,true);
});
test('does not return a lesson with an incomplete prerequisite', () => {
 const lessons=[lesson('locked','a',1),lesson('intro','a',2)];
 const requirements=[{lesson_id:'locked',prerequisite_lesson_id:'intro'}];
 assert.equal(summarizeLearning(modules,lessons,[],requirements).next.id,'intro');
 assert.equal(summarizeLearning(modules,lessons,[{lesson_id:'intro',status:'completed'}],requirements).next.id,'locked');
});
test('no available lessons is not a finished program', () => {
 const result=summarizeLearning(modules,[],[]);
 assert.equal(result.finished,false);assert.equal(result.next,null);assert.equal(result.percent,0);
});
test('in-progress lessons remain actionable and input is not mutated', () => {
 const lessons=[lesson('second','b',1),lesson('first','a',1)];
 const result=summarizeLearning(modules,lessons,[{lesson_id:'first',status:'started'}]);
 assert.equal(result.next.id,'first');assert.equal(result.percent,0);assert.equal(lessons[0].id,'second');
});

test('reading completion never bypasses assessment or attendance', () => {
 for (const type of ['quiz','exam','assignment','live_session','unknown']) assert.equal(canCompleteReading(type),false);
 for (const type of ['content','board','pdf','text']) assert.equal(canCompleteReading(type),true);
});
