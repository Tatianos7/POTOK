import assert from 'node:assert/strict';import test from 'node:test';
import {createExactPlanPostgresStoreV3,exactPlanChannelSqlV3,exactPlanCurrentSqlV3,exactPlanReadSqlV3,exactPlanInsertSqlV3,type ExactPlanSqlSourceClientV3} from '../exactPlanPostgresV3';
import type {ExactPlanTransactionV3} from '../exactPlanAdmissionV3';
const op='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sourceSql='SELECT potok_nutrition.synthetic_source($1::uuid) AS result_raw';
function fixture(mode='normal'){
 const calls:{sql:string;values:readonly string[]}[]=[],released:boolean[]=[];let acquired=0,source:ExactPlanSqlSourceClientV3|undefined;
 const pool={async acquire(){acquired++;return {async query(sql:string,values:readonly string[]){calls.push({sql,values});if(mode==='commit-lost'&&sql==='COMMIT')throw Error('lost');
  return {rows:[{result_raw:sql===exactPlanChannelSqlV3?mode==='wrong-role'?null:'EXACT_PLAN_CHANNEL_V3':sql===exactPlanCurrentSqlV3?'source':sql===exactPlanInsertSqlV3?'stored':null}]};},async release(discard:boolean){released.push(discard);if(mode==='release-lost')throw Error();}};}};
 const store=createExactPlanPostgresStoreV3(pool,[sourceSql],client=>{source=client;return {optimize:async()=>({status:'BLOCKED',reason:'synthetic',evaluated:0,totalCandidates:0,accepted:false,canRecord:false,canActivate:false})};},()=>true);
 return {pool,store,calls,released,acquired:()=>acquired,source:()=>source!};
}
test('one exclusive session binds nullable proposal selector and all reads/writes before COMMIT',async()=>{
 const f=fixture();let leaked!:ExactPlanTransactionV3;
 const result=await f.store.transaction(op,async tx=>{leaked=tx;assert.equal(await tx.loadLockedCurrentRequestRaw(op,null),'source');await f.source().query(sourceSql,[op]);assert.equal(await tx.readRetainedSnapshotRaw(op),null);return tx.insertSnapshotIfAbsentRaw(op,op,'a'.repeat(64),'{}');});
 assert.ok(f.calls.some(c=>c.sql===exactPlanReadSqlV3));assert.equal(result,'stored');assert.equal(f.acquired(),1);assert.equal(f.calls[0].sql,'BEGIN ISOLATION LEVEL READ COMMITTED');assert.equal(f.calls[f.calls.length-1].sql,'COMMIT');assert.deepEqual(f.released,[false]);
 assert.deepEqual(f.calls.find(c=>c.sql===exactPlanCurrentSqlV3)!.values,[op,'']);await assert.rejects(leaked.readRetainedSnapshotRaw(op),/CLOSED/);await assert.rejects(f.source().query(sourceSql,[op]),/CLOSED/);
});
test('disabled gate and wrong session identity deny without source access or owner fallback',async()=>{
 const f=fixture(),disabled=createExactPlanPostgresStoreV3(f.pool,[sourceSql],()=>({optimize:async()=>{throw Error();}}));await assert.rejects(disabled.transaction(op,async()=>true),/DISABLED/);assert.equal(f.acquired(),0);
 const bad=fixture('wrong-role');await assert.rejects(bad.store.transaction(op,async()=>true),/CHANNEL_REQUIRED/);assert.equal(bad.calls[bad.calls.length-1].sql,'ROLLBACK');assert.deepEqual(bad.released,[true]);
});
test('source selector is a copied closed allowlist; cross-operation calls and injected SQL reject',async()=>{
 const f=fixture();await f.store.transaction(op,async tx=>{
  await assert.rejects(f.source().query('DROP TABLE public.x',[]),/NOT_ALLOWLISTED/);await assert.rejects(tx.readRetainedSnapshotRaw('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),/REQUEST_MISMATCH/);
  await assert.rejects(tx.insertSnapshotIfAbsentRaw(op,op,"x');DROP",'{}'),/RECORD_INVALID/);
 });
 assert.ok(f.calls.every(c=>!c.sql.includes('DROP')));
});
test('callback failure rolls back and discards, while uncertain COMMIT never retries',async()=>{
 const f=fixture();const original=Error('business');await assert.rejects(f.store.transaction(op,async()=>{throw original;}),e=>e===original);assert.equal(f.calls[f.calls.length-1].sql,'ROLLBACK');assert.deepEqual(f.released,[true]);
 const lost=fixture('commit-lost');await assert.rejects(lost.store.transaction(op,async()=>true),/GENERATION_SQL_COMMIT_UNKNOWN/);assert.equal(lost.calls.filter(c=>c.sql==='COMMIT').length,1);assert.ok(!lost.calls.some(c=>c.sql==='ROLLBACK'));assert.equal(lost.acquired(),1);
 const release=fixture('release-lost');await assert.rejects(release.store.transaction(op,async()=>true),/GENERATION_SQL_COMMITTED_RELEASE_FAILED/);
});
