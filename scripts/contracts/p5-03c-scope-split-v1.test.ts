import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

// Scope invariant only: this test does not prove authorization, erasure or live DB fencing.
const load=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');
const scope=load('docs/architecture/p5-03c-p5-04-scope-split-2026-10-20.md');
const food=load('supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql');
const nonfood=load('supabase/migration_drafts/nonfood_reviewed_evidence_v1.sql');
const admission=load('src/server/accountClosureFenceV1.ts');
const prototype=load('scripts/contracts/p5-03c-closure-fence-disposable-prototype.sql');

test('issuer activation remains blocked on real transaction closure guard',()=>{
  assert.match(scope,/A closure fence is \*\*required before any live issuance\*\*/);
  assert.match(scope,/issuer SQL \*\*does not\*\* call the closure prototype/);
  assert.match(scope,/same PostgreSQL transaction as its write/);
  assert.match(scope,/STAGING-only, separately authorized real JWT\/PostgREST tests/);
  assert.match(scope,/Numeric retention periods are \*\*not\*\* approved/);
});

test('prototype closure helper is not accidentally wired into food or nonfood issuer',()=>{
  assert.match(prototype,/potok_closure_disposable\.assert_active/);
  assert.doesNotMatch(food,/potok_closure_disposable/);
  assert.doesNotMatch(nonfood,/potok_closure_disposable/);
  assert.match(admission,/read-only admission check/i);
});

test('full account deletion is distinct from P5-04 request-status skeleton',()=>{
  assert.match(scope,/Separate account deletion program/);
  assert.match(scope,/P5-04 may proceed in a separate Draft/);
  assert.match(scope,/cannot issue a live plan until real reviewed ingredients/);
  assert.match(scope,/No automatic merge, deploy, or DB apply/);
});
