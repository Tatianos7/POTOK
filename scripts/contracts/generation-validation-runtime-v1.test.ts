import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAdmittedGenerationWorkerV1} from '../../src/server/generationAdmittedWorkerV1';
import {admittedGenerationValidationSourceReadSqlV1} from '../../src/server/generationValidationSourceSqlV1';
import {generationPreparationPortsFixtureV1,fixtureHashV1} from '../../src/server/__tests__/generationAdmittedWorkerFixturesV1';
import {generationWorkerFixtureV1} from '../../src/server/__tests__/generationWorkerBindingsFixturesV1';
import {canonicalJsonV1} from '../../src/utils/adaptiveNutritionWireV1';
import {ok,denied,literal,binary,hash} from './generation-validation-fixture-v1';
import {installGenerationRuntimeSourceFixtureV1} from './generation-validation-runtime-fixture-v1';
const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
const runtime=readFileSync(new URL('../../docs/premium/drafts/generation_validation_source_storage_v1.sql',import.meta.url),'utf8');
const workerSession='SET SESSION AUTHORIZATION potok_generation_reader_v1;';
test('installable package preserves the already tested source/storage admission definitions',()=>{
  for(const file of ['generation-validation-store-v1.sql','generation-validation-admission-v1.sql']){
    const original=readFileSync(new URL('./'+file,import.meta.url),'utf8');
    const functions=[...original.matchAll(/CREATE FUNCTION [\s\S]*?\$fn\$;/g)].map(m=>m[0]);
    assert.ok(functions.length>0);for(const definition of functions)assert.ok(runtime.includes(definition),'function drift from '+file);
  }
  assert.ok(runtime.trimEnd().endsWith('COMMIT;'));assert.match(runtime,/SET LOCAL search_path=pg_catalog/);
});
test('native installable storage -> admitted SQL session -> real generator/independent validator -> existing worker', {skip:!native},async t=>{
  const {f,input,request,account,inputInsert,warningInsert}=await installGenerationRuntimeSourceFixtureV1();
  const proposalSha=hash(canonicalJsonV1(f.plan,'SAFE_INTEGER'));
  const read=`SELECT potok_nutrition.read_admitted_generation_validation_source_v1(${request},${binary(proposalSha)});`;
  await t.test('prerequisite drift rolled back and successful install creates empty forced-RLS storage with one allowed reader',()=>{
    for(const table of ['generation_validation_inputs_v1','generation_validation_warnings_v1','generation_validation_receipt_bindings_v1','generation_validation_receipt_revocations_v1']){
      assert.equal(ok(`SELECT count(*) FROM potok_nutrition.${table};`),'0');
      assert.equal(ok(`SELECT relrowsecurity::text||':'||relforcerowsecurity::text FROM pg_class WHERE oid='potok_nutrition.${table}'::regclass;`),'true:true');
    }
    assert.equal(ok("SELECT rolcanlogin::text||':'||rolsuper::text||':'||rolbypassrls::text FROM pg_roles WHERE rolname='potok_generation_reader_v1';"),'false:false:false');
    denied(runtime,/GENERATION_SOURCE_ALREADY_OR_PARTIALLY_INSTALLED/);
    assert.equal(ok("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE');"),'1');
  });
  await t.test('no implicit publisher or application/source-table grant',()=>{
    for(const role of ['anon','authenticated','service_role']){
      denied(`SET ROLE ${role};`+read,/permission denied/);
      denied(`SET ROLE ${role};SELECT * FROM potok_nutrition.generation_validation_inputs_v1;`,/permission denied/);
    }
    denied(read,/GENERATION_READER_IDENTITY_REQUIRED/);
    denied('SET ROLE potok_generation_reader_v1;'+read,/GENERATION_READER_IDENTITY_REQUIRED/);
    denied(workerSession+inputInsert(),/permission denied/);
    denied(workerSession+read,/SOURCE_PROVENANCE_UNAVAILABLE/);
  });
  ok(inputInsert()+warningInsert(f.warningRaw,proposalSha));
  const register=`INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,source_storage_sha256,policies_storage_sha256)
    SELECT source_receipt_ref,request_operation_id,account_id,'INPUTS',evidence_storage_sha256,policies_storage_sha256 FROM potok_nutrition.generation_validation_inputs_v1;
    INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,proposal_raw_sha256,source_storage_sha256)
    SELECT w.source_receipt_ref,w.request_operation_id,${account},'WARNINGS',w.proposal_raw_sha256,w.warning_storage_sha256 FROM potok_nutrition.generation_validation_warnings_v1 w;`;
  denied(workerSession+read,/SOURCE_PROVENANCE_UNAVAILABLE/);ok(register);
  const ports=await generationPreparationPortsFixtureV1(f);let queries=0;
  let beforeRead:((n:number)=>void)|null=null;
  const authoritySql={async query(statement:string,values:readonly string[]){
    assert.equal(statement,admittedGenerationValidationSourceReadSqlV1);
    assert.deepEqual(values,[input.operation.requestId,proposalSha]);queries++;if(beforeRead)beforeRead(queries);
    const raw=ok(workerSession+`SELECT potok_nutrition.read_admitted_generation_validation_source_v1(${literal(values[0])},${binary(values[1])});`);
    return {rows:[{source_raw:raw||null}]};
  }};
  await t.test('actual prepared week is independently validated twice from PostgreSQL before the simulated persistence gateway',async()=>{
    const gateway=await generationWorkerFixtureV1();
    assert.equal(gateway.f.context.input.operation.requestId,input.operation.requestId);
    assert.equal(fixtureHashV1(gateway.expected),proposalSha);
    const runtimeWorker=createAdmittedGenerationWorkerV1({...ports,authoritySql,gateway:gateway.client,enabled:()=>true});
    assert.equal((await runtimeWorker.continue(input.operation.requestId)).status,'ACTIVE');
    assert.equal(queries,2);assert.equal(ports.counts.source,1);assert.equal(gateway.counts.records,1);assert.equal(gateway.counts.activations,1);
    assert.equal(Buffer.from(gateway.stored()!,'hex').toString('utf8'),canonicalJsonV1(f.plan,'SAFE_INTEGER'));
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.adaptive_nutrition_generation_requests_v2;'),'1');
    assert.equal(ok('SELECT status FROM potok_nutrition.adaptive_nutrition_generation_requests_v2;'),'REQUESTED'); // gateway is deliberately simulated
  });
  await t.test('stale Premium/selection and missing provenance remain independently denied by installed reader',()=>{
    denied("BEGIN;UPDATE potok_control.access_attestations SET valid_until=statement_timestamp()-interval '1 minute';"+workerSession+read+'ROLLBACK;',/VERIFIED_PREMIUM_REQUIRED/);
    denied("BEGIN;UPDATE public.user_premium_plan_selections SET status='active';"+workerSession+read+'ROLLBACK;',/GENERATION_REQUEST_STALE_SELECTION/);
    assert.ok(ok(workerSession+read));
  });
  await t.test('real receipt revocation between generator-side and final SQL validation prevents record/activation',async()=>{
    const gateway=await generationWorkerFixtureV1();const starting=queries;
    beforeRead=n=>{if(n===starting+2)ok("INSERT INTO potok_nutrition.generation_validation_receipt_revocations_v1(receipt_ref,reason_ref) VALUES ('synthetic-only:warnings','synthetic-only:revoked-before-final-check');");};
    await assert.rejects(createAdmittedGenerationWorkerV1({...ports,authoritySql,gateway:gateway.client,enabled:()=>true}).continue(input.operation.requestId),/SOURCE_PROVENANCE_UNAVAILABLE/);
    assert.equal(queries,starting+2);assert.equal(gateway.counts.records,0);assert.equal(gateway.counts.activations,0);
    denied(workerSession+read,/SOURCE_PROVENANCE_UNAVAILABLE/);
  });
  await t.test('source history remains append-only and prevents deletion/truncation after install',()=>{
    denied("UPDATE potok_nutrition.generation_validation_inputs_v1 SET source_receipt_ref='replaced';",/VALIDATION_HISTORY_IMMUTABLE/);
    denied('DELETE FROM potok_nutrition.generation_validation_receipt_bindings_v1;',/VALIDATION_HISTORY_IMMUTABLE/);
    denied('TRUNCATE potok_nutrition.generation_validation_receipt_revocations_v1;',/VALIDATION_HISTORY_IMMUTABLE/);
  });
});
