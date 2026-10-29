import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {assessLocks,lockReviewSQL,protectedTables,main} from './lock-admission.mjs';
const baseline=JSON.parse(fs.readFileSync(new URL('lock-observation-20261029.json',import.meta.url),'utf8'));
test('observed managed limits produce an explicit proposal without losing any table or row proof',()=>{
  const input=structuredClone(baseline),plan=assessLocks(input);
  assert.deepEqual(input,baseline);assert.equal(plan.locks.length,116);
  assert.deepEqual(plan.locks.filter(t=>!t.blocksConcurrentWrites).map(t=>t.schema+'.'+t.name),protectedTables);
  assert.equal(plan.locks.filter(t=>t.mode==='SHARE ROW EXCLUSIVE').length,112);
  assert.equal(plan.originalUniformEnvelopeExecutable,false);assert.equal(plan.mayApply,false);
  assert.equal(plan.releaseReady,false);assert.match(plan.remainingRequirement,/does not freeze/);
});
test('new missing privilege, missing SELECT, wrong actor/target, forged scope and changed protected privilege stop review',()=>{
  for(const change of [
    o=>o.projectRef='other',o=>o.actorSuper=true,o=>o.readOnly='off',
    o=>o.tables.find(t=>t.schema==='public').allLockModes=false,
    o=>o.tables[0].select=false,o=>o.tables.pop(),
    o=>o.tables.find(t=>t.name==='schema_migrations').allLockModes=true,
    o=>o.tables[0].owner='postgres',o=>o.tables[0].allLockModes='true'
  ]){const input=structuredClone(baseline);change(input);assert.throws(()=>assessLocks(input));}
});
test('SQL cannot reach locks; no role escalation or grant, commit or executable permission fallback',()=>{
  const sql=lockReviewSQL(assessLocks(baseline));
  assert(sql.indexOf("RAISE EXCEPTION 'MANAGED_LOCK_REVIEW_NOT_APPROVED'")<sql.indexOf('LOCK TABLE'));
  assert.equal((sql.match(/^LOCK TABLE/gm)||[]).length,116);
  assert.equal((sql.match(/ IN ACCESS SHARE MODE;/g)||[]).length,4);
  assert.match(sql,/ROLLBACK;\n$/);assert.doesNotMatch(sql,/^COMMIT|SET ROLE|GRANT |EXCEPTION WHEN/im);
});
test('execution modes and arbitrary connection inputs are refused',async()=>{
  for(const args of [[],['--apply'],['--verify','postgres://other']])await assert.rejects(()=>main(args));
});
