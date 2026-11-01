import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {installGenerationRuntimeSourceFixtureV1} from './generation-validation-runtime-fixture-v1';
import {ok,denied,literal} from './generation-validation-fixture-v1';
import {createGoalDerivedGenerationPreparationSourceV1,generationGoalPreparationReadSqlV1} from '../../src/server/generationGoalPreparationSourceV1';
import {createGenerationMenuCandidatePreparerV1} from '../../src/server/generationMenuCandidatesV1';
const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
const preparation=readFileSync(new URL('../../docs/premium/drafts/generation_preparation_source_v1.sql',import.meta.url),'utf8');
const extension=readFileSync(new URL('../../docs/premium/drafts/generation_goal_preparation_source_v1.sql',import.meta.url),'utf8');
const session='SET SESSION AUTHORIZATION potok_generation_reader_v1;';
test('native admitted goal source derives metadata without metadata rows or table grants',{skip:!native},async t=>{
  const {input,request,account,inputInsert}=await installGenerationRuntimeSourceFixtureV1();
  ok(preparation);
  await t.test('missing goal column or drifted context reader aborts the extension transaction',()=>{
    denied(extension,/GOAL_PREPARATION_GOAL_TYPE_COLUMN_REQUIRED/);
    assert.equal(ok("SELECT to_regprocedure('potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)') IS NULL;"),'t');
    ok('ALTER TABLE public.user_goals ADD COLUMN goal_type text;');
    denied("BEGIN;ALTER FUNCTION potok_nutrition.read_admitted_generation_preparation_source_v1(uuid) SET search_path=public;"+extension,
      /GOAL_PREPARATION_CONTEXT_READER_DRIFT/);
    assert.equal(ok("SELECT to_regprocedure('potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)') IS NULL;"),'t');
  });
  ok(extension);
  const read=`SELECT potok_nutrition.read_admitted_generation_goal_preparation_source_v1(${request});`;
  const source=createGoalDerivedGenerationPreparationSourceV1({async query(statement,parameters){
    assert.equal(statement,generationGoalPreparationReadSqlV1);assert.deepEqual(parameters,[input.operation.requestId]);
    return {rows:[{source_raw:ok(session+read)}]};
  }});
  await t.test('one new private reader grant; owner, app roles and SET ROLE are denied',()=>{
    for(const role of ['anon','authenticated','service_role'])denied(`SET ROLE ${role};`+read,/permission denied/);
    denied(read,/GENERATION_READER_IDENTITY_REQUIRED/);
    denied('SET ROLE potok_generation_reader_v1;'+read,/GENERATION_READER_IDENTITY_REQUIRED/);
    denied(session+'SELECT goal_type FROM public.user_goals;',/permission denied/);
    denied(session+'SELECT potok_nutrition.read_admitted_generation_goal_preparation_source_v1(NULL);',/INVALID_GOAL_PREPARATION_LOOKUP/);
    assert.equal(ok("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE');"),'3');
    denied(extension,/GOAL_PREPARATION_ALREADY_INSTALLED/);
  });
  await t.test('missing and unadmitted inputs cannot disclose even a goal type',()=>{
    denied(session+read,/SOURCE_PROVENANCE_UNAVAILABLE/);ok(inputInsert());
    denied(session+read,/SOURCE_PROVENANCE_UNAVAILABLE/);
    ok(`INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,source_storage_sha256,policies_storage_sha256)
      SELECT source_receipt_ref,request_operation_id,account_id,'INPUTS',evidence_storage_sha256,policies_storage_sha256 FROM potok_nutrition.generation_validation_inputs_v1;`);
  });
  await t.test('null and unrecognized saved goals never become maintenance',async()=>{
    assert.equal(await source.loadPreparationRaw(input.operation.requestId),null);
    ok(`UPDATE public.user_goals SET goal_type='legacy unknown' WHERE user_id=${account};`);
    assert.equal(await source.loadPreparationRaw(input.operation.requestId),null);
  });
  let metadataRaw:string;
  await t.test('actual stored goal and context produce stable complete recipe candidates with no stored metadata',async()=>{
    ok(`UPDATE public.user_goals SET goal_type='Поддержка формы' WHERE user_id=${account};`);
    const raw=await source.loadPreparationRaw(input.operation.requestId);assert.ok(raw);metadataRaw=raw;
    assert.equal(JSON.parse(raw).goalProfile,'MAINTENANCE');
    assert.equal(await source.loadPreparationRaw(input.operation.requestId),raw);
    const result=await createGenerationMenuCandidatePreparerV1(source).prepare(input.operation.requestId);
    assert.equal(result.status,'PREPARED');
    if(result.status==='PREPARED'){assert.equal(result.slots.length,7);assert.ok(result.slots.every(s=>s.meals.length>0));}
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_validation_warnings_v1;'),'0');
    assert.equal(ok("SELECT to_regclass('potok_nutrition.generation_preparation_sources_v1') IS NULL;"),'t');
  });
  await t.test('goal revision, account, Premium, policy and revoked input receipt changes fail closed',()=>{
    for(const change of [
      `UPDATE public.user_goals SET goal_revision='00000000-0000-4000-8000-000000000999' WHERE user_id=${account};`,
      `UPDATE public.user_goals SET user_id='00000000-0000-4000-8000-000000000999' WHERE user_id=${account};`,
      "UPDATE potok_control.access_attestations SET valid_until=statement_timestamp()-interval '1 minute';",
      "UPDATE potok_nutrition.adaptive_nutrition_generation_policy_head_v2 SET publication_state='DRAFT';",
      `INSERT INTO potok_nutrition.generation_validation_receipt_revocations_v1(receipt_ref,reason_ref) VALUES('synthetic-only:inputs','synthetic-only:goal-test');`,
    ])denied('BEGIN;'+change+session+read,/SOURCE_PROVENANCE_UNAVAILABLE|GENERATION_REQUEST_STALE_SELECTION|GENERATION_REQUEST_STALE_POLICY|VERIFIED_PREMIUM_REQUIRED/);
  });
  await t.test('previous metadata does not hide later unavailability',async()=>{
    assert.ok(metadataRaw!);ok(`UPDATE public.user_goals SET goal_type=NULL WHERE user_id=${account};`);
    assert.equal(await source.loadPreparationRaw(input.operation.requestId),null);
  });
});
