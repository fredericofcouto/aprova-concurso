import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readBank,readModule} from '../scripts/read-curated-bank.mjs';
const bank=readBank();const {roleIds,blueprint,eligible,buildExam,grade}=readModule('lib/exam-engine.ts');
const syllabus=JSON.parse(readFileSync(new URL('../lib/syllabus.json',import.meta.url),'utf8'));
test('curated bank has valid unique IDs, four distinct options, answer keys and syllabus references',()=>{
 assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
 for(const q of bank){assert.equal(q.options.length,4,q.id);assert.equal(new Set(q.options.map(s=>s.trim().toLowerCase())).size,4,q.id);assert.ok(q.answer>=0&&q.answer<4,q.id);assert.ok(q.prompt&&q.explanation&&q.source,q.id);const items=q.role==='common'?syllabus.common[q.level][q.subject]:syllabus.specific[q.role];assert.ok(items[Number(q.syllabusItem)-1],q.id);}
});
test('actual published bank supports two disjoint complete attempts per role and section',()=>{
 for(const role of roleIds){const history=[];for(let run=0;run<2;run++){const result=buildExam(bank,role,history);assert.equal(result.repeated,0,role);history.push(...result.questions.map(q=>q.family));}}
});
test('actual bank produces 2500 correctly ordered, weighted exams without duplicate families',()=>{
 for(const role of roleIds)for(let run=0;run<500;run++){const result=buildExam(bank,role);assert.equal(new Set(result.questions.map(q=>q.family)).size,result.questions.length);assert.equal(JSON.stringify(result.questions.map(q=>q.subject)),JSON.stringify(blueprint(role).flatMap(s=>Array(s.count).fill(s.subject))));assert.equal(grade(result.questions,Object.fromEntries(result.questions.map(q=>[q.id,q.answer])),role).points,100);}
});
test('all numbered syllabus items have at least one mapped question (not a claim of exhaustive subtopic coverage)',()=>{
 for(const role of roleIds){const level=role==='ti'||role==='acs'?'MEDIO':'SUPERIOR';for(const section of blueprint(role)){const items=section.subject==='ESPECIFICOS'?syllabus.specific[role]:syllabus.common[level][section.subject];const covered=new Set(eligible(bank,role,section.subject).map(q=>q.syllabusItem));for(let i=1;i<=items.length;i++)assert.ok(covered.has(String(i)),`${role}/${section.subject}/${i}`);}}
});
