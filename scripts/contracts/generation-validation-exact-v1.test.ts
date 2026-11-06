import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {installExactPlanNativeFixtureV3} from './exact-plan-native-fixture-v3';import {createExactPlanAdmissionV3} from '../../src/server/exactPlanAdmissionV3';
import {exactPlanInsertSqlV3,exactPlanCurrentSqlV3} from '../../src/server/exactPlanPostgresV3';
const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
test('actual PostgreSQL exact source -> optimizer -> atomic retention/recovery and ACL (synthetic evidence only)',{skip:!native},async t=>{
 const f=await installExactPlanNativeFixtureV3();
 const denied=(sql:string,pattern:RegExp)=>{const r=spawnSync('psql',['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5432','-U','postgres','-d','potok_generation_store_disposable'],{input:sql,encoding:'utf8',env:{...process.env,PGPASSWORD:'disposable-generation-only',PGCONNECT_TIMEOUT:'5'}});assert.notEqual(r.status,0);assert.match(r.stderr,pattern);};
 try{
  const selected=await f.store.transaction(f.operation,tx=>tx.optimize(f.operation));if(selected.status!=='EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION')assert.fail(JSON.stringify(selected));
  assert.equal(selected.proposal.graph.evaluatedSnapshotRawSha256,f.expectedSelectedSnapshotSha256);
  await f.rawPool.query(exactPlanCurrentSqlV3,[f.operation,'']);
  const proposalRaw=f.canonical(selected.proposal);let insertQueries=0;
  await t.test('lost actual COMMIT reply plus a concurrent duplicate commits one row and replays it',async()=>{
   let inserted!:()=>void,release!:()=>void;const reached=new Promise<void>(r=>{inserted=r;}),hold=new Promise<void>(r=>{release=r;});
   const faultPool={async acquire(){const c=await f.pool.acquire();return {release:c.release,async query(sql:string,values:readonly string[]){const row=await c.query(sql,values);if(sql===exactPlanInsertSqlV3){insertQueries++;inserted();await hold;}if(sql==='COMMIT')throw Error('SYNTHETIC_COMMIT_REPLY_LOST');return row;}};}};
   const fault=createExactPlanAdmissionV3(f.storeFor(faultPool),()=>true),first=fault.record(f.operation,proposalRaw);
   let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([reached,first.then(r=>{throw Error('FIRST_RECORD_ENDED_BEFORE_INSERT:'+JSON.stringify(r));}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('INSERT_NOT_REACHED')),30000);})]);}finally{clearTimeout(timer);}
   let settled=false;const second=f.service.record(f.operation,proposalRaw).finally(()=>{settled=true;});
   try{assert.equal((await f.owner.query('SELECT count(*)::int AS n FROM potok_nutrition.exact_retained_plan_proposals_v3')).rows[0].n,0);
    for(let i=0;i<20;i++){if((await f.owner.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name='potok-exact-v3-native' AND wait_event_type='Lock'")).rows[0].n>0)break;await new Promise(r=>setTimeout(r,25));}
    assert.equal(settled,false);
   }finally{release();}
   const [a,b]=await Promise.all([first,second]);assert.equal(a.status,'UNKNOWN_RETRYABLE');assert.equal(b.status,'SNAPSHOT_REPLAY');assert.equal(insertQueries,1);
   assert.equal((await f.owner.query('SELECT count(*)::int AS n FROM potok_nutrition.exact_retained_plan_proposals_v3')).rows[0].n,1);
   assert.equal((await f.service.recover(f.operation)).status,'SNAPSHOT_VERIFIED');assert.equal(insertQueries,1);
  });
  await t.test('persistent reopen preserves exact bytes and leaves request/selection pending with no FACT',async()=>{
   const before=(await f.owner.query('SELECT canonical_raw FROM potok_nutrition.exact_retained_plan_proposals_v3')).rows[0].canonical_raw;
   const opened=await f.service.open(f.operation);assert.equal(opened.status,'SNAPSHOT_VERIFIED');if(!('snapshot'in opened))assert.fail();
   assert.equal(opened.snapshot.proposalCanonicalRaw,proposalRaw);assert.equal(opened.planActivated,false);assert.equal(opened.factsWritten,false);
   const s=(await f.owner.query('SELECT canonical_raw,encode(storage_sha256,\'hex\') AS sha FROM potok_nutrition.exact_retained_plan_proposals_v3')).rows[0];assert.equal(s.canonical_raw,before);
   assert.equal((await f.owner.query('SELECT status FROM potok_nutrition.adaptive_nutrition_generation_requests_v2')).rows[0].status,'REQUESTED');
   assert.equal((await f.owner.query('SELECT status FROM public.user_premium_plan_selections')).rows[0].status,'pending_generation');
   assert.deepEqual(opened.snapshot.facts,[]);
  });
  await t.test('client/service/owner/SET ROLE channels cannot call private gateway functions or mutate retained bytes',async()=>{
   for(const role of ['anon','authenticated','service_role']){denied(`SET ROLE ${role};SELECT * FROM potok_nutrition.exact_retained_plan_proposals_v3;`,/permission denied/);denied(`SET ROLE ${role};SELECT potok_nutrition.read_exact_retained_plan_v3('${f.operation}');`,/permission denied/);}
   denied('SET SESSION AUTHORIZATION potok_generation_gateway_v1;SELECT * FROM potok_nutrition.exact_retained_plan_proposals_v3;',/permission denied/);
   denied(`SELECT potok_nutrition.read_exact_retained_plan_v3('${f.operation}');`,/EXACT_PLAN_CHANNEL_REQUIRED/);
   denied(`SET ROLE potok_generation_gateway_v1;SELECT potok_nutrition.read_exact_retained_plan_v3('${f.operation}');`,/EXACT_PLAN_CHANNEL_REQUIRED/);
   denied('UPDATE potok_nutrition.exact_retained_plan_proposals_v3 SET canonical_raw=canonical_raw;',/IMMUTABLE/);
   denied('DELETE FROM potok_nutrition.exact_retained_plan_proposals_v3;',/IMMUTABLE/);denied('TRUNCATE potok_nutrition.exact_retained_plan_proposals_v3;',/IMMUTABLE/);
   denied('DELETE FROM potok_nutrition.adaptive_nutrition_generation_requests_v2;',/foreign key constraint/);
   const r=(await f.owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='potok_nutrition.exact_retained_plan_proposals_v3'::regclass")).rows[0];assert.equal(r.relrowsecurity,true);assert.equal(r.relforcerowsecurity,true);
  });
  await t.test('real Premium, selection and authority head mutations fail with unchanged retained bytes',async()=>{
   const before=(await f.owner.query('SELECT canonical_raw FROM potok_nutrition.exact_retained_plan_proposals_v3')).rows[0].canonical_raw;
   const changed=f.canonical({...JSON.parse(before),digest:'0'.repeat(64)});
   denied(`SET SESSION AUTHORIZATION potok_generation_gateway_v1;SELECT potok_nutrition.retain_exact_plan_v3('${f.operation}','${f.input.accountId}',decode('${f.inputDigest}','hex'),${f.literal(changed)});`,/EXACT_RECORD_DIGEST_INVALID/);
   for(const mutation of ["UPDATE potok_control.access_attestations SET valid_until=statement_timestamp()-interval '1 second';","UPDATE public.user_premium_plan_selections SET status='active';","UPDATE potok_nutrition.nutrition_authority_heads_v1 SET current_safety_revision='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';"]){
    denied(`BEGIN;${mutation}SET SESSION AUTHORIZATION potok_generation_gateway_v1;SELECT potok_nutrition.read_exact_retained_plan_v3('${f.operation}');`,/VERIFIED_PREMIUM_REQUIRED|STALE_SELECTION|STALE_AUTHORITY/);
   }
   assert.equal((await f.owner.query('SELECT canonical_raw FROM potok_nutrition.exact_retained_plan_proposals_v3')).rows[0].canonical_raw,before);
  });
  await t.test('closed source storage rejects client/service/owner impersonation, changed binding and mutable history',async()=>{
   for(const role of ['anon','authenticated','service_role','potok_generation_gateway_v1'])denied(`SET ROLE ${role};SELECT * FROM potok_nutrition.exact_generation_sources_v3;`,/permission denied/);
   for(const role of ['anon','authenticated','service_role'])denied(`SET ROLE ${role};SELECT potok_nutrition.read_exact_generation_source_v3('${f.operation}','POOL',NULL);`,/permission denied/);
   denied(`SELECT potok_nutrition.read_exact_generation_source_v3('${f.operation}','POOL',NULL);`,/EXACT_PLAN_CHANNEL_REQUIRED/);
   denied(`SET ROLE potok_generation_gateway_v1;SELECT potok_nutrition.read_exact_generation_source_v3('${f.operation}','POOL',NULL);`,/EXACT_PLAN_CHANNEL_REQUIRED/);
   denied(`INSERT INTO potok_nutrition.exact_generation_sources_v3(source_ref,request_operation_id,account_id,generation_input_digest,source_kind,payload_raw) SELECT 'bad-owner',request_operation_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',generation_input_digest,source_kind,payload_raw FROM potok_nutrition.exact_generation_sources_v3 WHERE source_kind='POOL';`,/EXACT_SOURCE_BINDING_INVALID/);
   denied('TRUNCATE potok_nutrition.exact_generation_sources_v3;',/foreign key constraint/);
   for(const sql of ['UPDATE potok_nutrition.exact_generation_sources_v3 SET payload_raw=payload_raw;','DELETE FROM potok_nutrition.exact_generation_sources_v3;','TRUNCATE potok_nutrition.exact_generation_sources_v3,potok_nutrition.exact_generation_source_revocations_v3;'])denied(sql,/IMMUTABLE/);
   const r=(await f.owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='potok_nutrition.exact_generation_sources_v3'::regclass")).rows[0];assert.equal(r.relrowsecurity,true);assert.equal(r.relforcerowsecurity,true);
   const stored=(await f.owner.query("SELECT payload_raw,encode(storage_sha256,'hex') AS sha FROM potok_nutrition.exact_generation_sources_v3 WHERE source_kind='POOL'")).rows[0];
   const read=(await f.rawPool.query("SELECT potok_nutrition.read_exact_generation_source_v3($1,'POOL',NULL) AS raw",[f.operation])).rows[0].raw;
   const packet=JSON.parse(read);assert.equal(packet.payloadRaw,stored.payload_raw);assert.equal(packet.storageSha256,stored.sha);assert.equal(packet.purpose,'RETAINED_SOURCE_NOT_REVIEW_APPROVAL');
  });
  await t.test('source revocation waits for the active request fence and blocks subsequent immutable reopen',async()=>{
   const held=await f.rawPool.connect(),revoker=await f.owner.connect();let pending:Promise<unknown>|undefined;
   try{
    await held.query('BEGIN');await held.query("SELECT potok_nutrition.read_exact_generation_source_v3($1,'POOL',NULL)",[f.operation]);
    const pid=(await revoker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    pending=revoker.query("INSERT INTO potok_nutrition.exact_generation_source_revocations_v3(source_ref,reason_ref) VALUES('synthetic-native:pool','native-revocation-test')");
    let waiting=false;for(let i=0;i<40;i++){waiting=(await f.owner.query("SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1",[pid])).rows[0]?.waiting===true;if(waiting)break;await new Promise(r=>setTimeout(r,25));}
    assert.equal(waiting,true);await held.query('COMMIT');await pending;pending=undefined;
   }finally{try{await held.query('ROLLBACK');await pending;}finally{held.release();revoker.release();}}
   assert.equal((await f.rawPool.query("SELECT potok_nutrition.read_exact_generation_source_v3($1,'POOL',NULL) AS raw",[f.operation])).rows[0].raw,null);
   assert.equal((await f.service.open(f.operation)).status,'BLOCKED');
   assert.equal((await f.owner.query('SELECT count(*)::int AS n FROM potok_nutrition.exact_retained_plan_proposals_v3')).rows[0].n,1);
   for(const sql of ['UPDATE potok_nutrition.exact_generation_source_revocations_v3 SET reason_ref=reason_ref;','DELETE FROM potok_nutrition.exact_generation_source_revocations_v3;','TRUNCATE potok_nutrition.exact_generation_source_revocations_v3;'])denied(sql,/IMMUTABLE/);
   // Owner revocation is still possible after the original selection becomes stale.
   await f.owner.query("BEGIN;UPDATE public.user_premium_plan_selections SET status='active';INSERT INTO potok_nutrition.exact_generation_source_revocations_v3(source_ref,reason_ref) SELECT source_ref,'stale-selection-revocation' FROM potok_nutrition.exact_generation_sources_v3 WHERE source_kind='GRAPH' LIMIT 1;ROLLBACK;");
  });
 }finally{await f.close();}
});
