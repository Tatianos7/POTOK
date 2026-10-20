import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
const load=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');
const doc=load('docs/architecture/p5-03c-issuer-closure-lock-order-2026-10-20.md');
const food=load('supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql');
const nonfood=load('supabase/migration_drafts/nonfood_reviewed_evidence_v1.sql');
const fn=(sql:string,name:string,end:string)=>{
  const start=sql.indexOf('CREATE FUNCTION '+name);
  assert.ok(start!==-1, 'function exists: '+name);
  return sql.slice(start,sql.indexOf(end,start));
};
test('issuer drafts start with trusted authority before catalog locks',()=>{
  const f=fn(food,'public.food_evidence_review_v1(', 'REVOKE ALL ON FUNCTION public.food_evidence_review_v1');
  const n=fn(nonfood,'public.nonfood_evidence_review_v1(', 'CREATE FUNCTION public.nonfood_evidence_receipt_v1');
  assert.ok(f.indexOf('attestation:=potok_food_evidence.authority_v1()')>=0);
  assert.ok(n.indexOf('att:=potok_food_evidence.authority_v1()')>=0);
  assert.ok(n.indexOf('att:=potok_food_evidence.authority_v1()')<n.indexOf("'potok-nonfood-v1:catalog'"));
  assert.match(f,/potok-food-evidence-v1:/);
  assert.doesNotMatch(f,/potok_closure_disposable|potok_closure\.assert_active/i);
  assert.doesNotMatch(n,/potok_closure_disposable|potok_closure\.assert_active/i);
});
test('review never claims closure is wired or live account deletion works',()=>{
  assert.match(doc,/Do not apply the standalone prototype or change existing issuer SQL/);
  assert.match(doc,/inside the original SQL issuer function/);
  assert.match(doc,/Missing closure infrastructure fails closed/);
  assert.match(doc,/do not reuse admin-only/);
  assert.match(doc,/real account erasure remain unresolved/);
});
