// Offline review of real managed privileges. No connection or execution mode.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {tableScope,target} from './target-plan.mjs';

export const protectedTables=['auth.schema_migrations','storage.buckets_vectors','storage.migrations','storage.vector_indexes'];
export function assessLocks(observation){
  assert.equal(observation.protocol,'potok-target-lock-admission-observation-v1');
  assert.equal(observation.projectRef,target);
  assert.equal(observation.actor,'postgres');assert.equal(observation.actorSuper,false);
  assert.equal(observation.readOnly,'on');assert(Number.isFinite(Date.parse(observation.observedAt)));
  const tables=tableScope(observation.tables),limited=[];
  const locks=tables.map(t=>{
    assert.equal(typeof t.select,'boolean');assert.equal(typeof t.allLockModes,'boolean');
    assert(t.select,'Every protected row fingerprint still requires SELECT');
    const name=t.schema+'.'+t.name;
    if(!t.allLockModes)limited.push(name);
    // This is a reviewed proposal, never an implicit runtime fallback.
    return {schema:t.schema,name:t.name,mode:t.allLockModes?'SHARE ROW EXCLUSIVE':'ACCESS SHARE',blocksConcurrentWrites:t.allLockModes};
  });
  assert.deepEqual(limited,protectedTables,'Unexpected lock privilege change; never silently weaken another table');
  return {protocol:'potok-managed-lock-review-v1',projectRef:target,observedAt:observation.observedAt,
    inventoryTables:116,writeBlockingTables:112,ddlOnlyTables:4,locks,
    originalUniformEnvelopeExecutable:false,
    remainingRequirement:'Review explicit provider-maintenance exclusion for four managed tables; ACCESS SHARE does not freeze their contents. Preserve all 116 old-column row checks and require a fresh observation at execution.',
    hostedLocksAttempted:false,includesRunner:false,mayApply:false,releaseReady:false};
}
export function lockReviewSQL(plan){
  assert.equal(plan.protocol,'potok-managed-lock-review-v1');assert.equal(plan.mayApply,false);
  assert.equal(plan.locks.length,116);
  const q=x=>'"'+x.replace(/"/g,'""')+'"';
  return `-- OFFLINE LOCK REVIEW ONLY. Do not remove the stop to deploy.
-- Supersedes the feasibility claim of the old uniform 116-table outline only.
-- ACCESS SHARE on four managed tables does NOT block their writers.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='120s';
DO $guard$ BEGIN RAISE EXCEPTION 'MANAGED_LOCK_REVIEW_NOT_APPROVED'; END $guard$;
${plan.locks.map(t=>`LOCK TABLE ${q(t.schema)}.${q(t.name)} IN ${t.mode} MODE;`).join('\n')}
-- All 116 old-column checks remain required. No weaker runtime fallback.
-- Provider maintenance/concurrent-write exclusion needs an explicit decision.
ROLLBACK;
`;
}
export async function main(args){
  assert(args.length===1&&['--write-review','--verify'].includes(args[0]));
  const observation=JSON.parse(await readFile(new URL('lock-observation-20261029.json',import.meta.url),'utf8'));
  const plan=assessLocks(observation);
  for(const [name,content] of Object.entries({'lock-admission-20261029.json':JSON.stringify(plan,null,2)+'\n','managed-locks.review.sql':lockReviewSQL(plan)})){
    const url=new URL(name,import.meta.url);
    if(args[0]==='--write-review')await writeFile(url,content);
    else assert.equal(await readFile(url,'utf8'),content);
  }
  console.log('MANAGED_LOCK_REVIEW_OK: 112 write-blocking / four explicit DDL-only proposals; no apply or hosted locks');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(()=>{console.error('MANAGED_LOCK_REVIEW_STOPPED');process.exitCode=1;});
