import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {installGenerationRuntimeSourceFixtureV1} from './generation-validation-runtime-fixture-v1';
import {ok,denied,literal,binary,hash} from './generation-validation-fixture-v1';
import {createAdmittedGenerationProducerPortsV1,generationMetadataSourceReadSqlV1,generationMealWarningSourceReadSqlV1} from '../../src/server/generationProducerSourcesV1';
import {createAdmittedGenerationPreparationSourceV1,generationPreparationReadSqlV1} from '../../src/server/generationPreparationSourceV1';
import {admittedGenerationValidationSourceReadSqlV1} from '../../src/server/generationValidationSourceSqlV1';
import {createStoredProducerGenerationWorkerV1} from '../../src/server/generationStoredProducerWorkerV1';
import {createGenerationMenuCandidatePreparerV1} from '../../src/server/generationMenuCandidatesV1';
import {generationPreparationMetadataFixtureV1} from '../../src/server/__tests__/generationPreparationSqlFixturesV1';
import {generationPreparationPortsFixtureV1} from '../../src/server/__tests__/generationAdmittedWorkerFixturesV1';
import {generationWorkerFixtureV1} from '../../src/server/__tests__/generationWorkerBindingsFixturesV1';
import {canonicalJsonV1} from '../../src/utils/adaptiveNutritionWireV1';
import {id} from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
const preparation=readFileSync(new URL('../../docs/premium/drafts/generation_preparation_source_v1.sql',import.meta.url),'utf8');
const extension=readFileSync(new URL('../../docs/premium/drafts/generation_producer_sources_v1.sql',import.meta.url),'utf8');
const session='SET SESSION AUTHORIZATION potok_generation_reader_v1;';
test('native owner-admitted metadata and per-meal warning storage feed the real pipeline',{skip:!native},async t=>{
  const {f,input,request,account,inputInsert,warningInsert}=await installGenerationRuntimeSourceFixtureV1();ok(preparation);ok(extension);
  const inputSha=f.evidence.generationInputDigest,evidence=f.evidence.digest,policies=JSON.parse(f.policiesRaw).digest,proposal=hash(canonicalJsonV1(f.plan,'SAFE_INTEGER'));
  const metadataRead=`SELECT potok_nutrition.read_admitted_generation_producer_source_v1(${request},'METADATA',${binary(inputSha)},NULL,NULL,NULL,NULL);`;
  const warningRead=(slot:string,meal:string,ev=evidence,policy=policies)=>`SELECT potok_nutrition.read_admitted_generation_producer_source_v1(${request},'MEAL_WARNING',NULL,${literal(slot)},${binary(meal)},${binary(ev)},${binary(policy)});`;
  const insert=(ref:string,kind:'METADATA'|'MEAL_WARNING',raw:string,owner=account)=>{
    const data=JSON.parse(raw);return `INSERT INTO potok_nutrition.generation_preparation_sources_v1(source_ref,request_operation_id,account_id,source_kind,generation_input_digest,validation_evidence_digest,validation_policies_digest,slot_id,meal_snapshot_digest,payload_raw)
      VALUES(${literal(ref)},${request},${owner},${literal(kind)},${binary(inputSha)},${binary(evidence)},${binary(policies)},${kind==='METADATA'?'NULL':literal(data.slotId)},${kind==='METADATA'?'NULL':binary(data.mealSnapshotDigest)},${literal(raw)});`;
  };
  const statements:string[]=[];
  const sql={async query(statement:string,args:readonly string[]){
    statements.push(statement);assert.equal(args[0],input.operation.requestId);let read:string;
    if(statement===generationPreparationReadSqlV1)read=`SELECT potok_nutrition.read_admitted_generation_preparation_source_v1(${request});`;
    else if(statement===generationMetadataSourceReadSqlV1){assert.equal(args.length,2);read=`SELECT potok_nutrition.read_admitted_generation_producer_source_v1(${request},'METADATA',${binary(args[1])},NULL,NULL,NULL,NULL);`;}
    else if(statement===generationMealWarningSourceReadSqlV1){assert.equal(args.length,5);read=warningRead(args[1],args[2],args[3],args[4]);}
    else {assert.equal(statement,admittedGenerationValidationSourceReadSqlV1);assert.equal(args[1],proposal);read=`SELECT potok_nutrition.read_admitted_generation_validation_source_v1(${request},${binary(args[1])});`;}
    const raw=ok(session+read);return {rows:[{source_raw:raw||null}]};
  }};
  const ports=createAdmittedGenerationProducerPortsV1(sql),fixture=await generationPreparationPortsFixtureV1(f),metadata=generationPreparationMetadataFixtureV1(f);
  await t.test('only admitted reader identity has the three exact reader functions; no table or publisher access',()=>{
    assert.equal(ok("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE');"),'3');
    for(const table of ['generation_preparation_sources_v1','generation_preparation_source_revocations_v1']){
      assert.equal(ok(`SELECT count(*) FROM potok_nutrition.${table};`),'0');
      assert.equal(ok(`SELECT relrowsecurity::text||':'||relforcerowsecurity::text FROM pg_class WHERE oid='potok_nutrition.${table}'::regclass;`),'true:true');
      for(const role of ['anon','authenticated','service_role','potok_generation_reader_v1'])denied(`SET ROLE ${role};SELECT * FROM potok_nutrition.${table};`,/permission denied/);
    }
    for(const role of ['anon','authenticated','service_role'])denied(`SET ROLE ${role};`+metadataRead,/permission denied/);
    denied(metadataRead,/GENERATION_READER_IDENTITY_REQUIRED/);denied('SET ROLE potok_generation_reader_v1;'+metadataRead,/GENERATION_READER_IDENTITY_REQUIRED/);
    denied(extension,/GENERATION_PRODUCER_ALREADY_OR_PARTIALLY_INSTALLED/);
  });
  await t.test('unreviewed input provenance cannot admit producer rows or be read',()=>{
    ok(inputInsert());denied(insert('synthetic-only:metadata','METADATA',metadata),/SOURCE_PROVENANCE_UNAVAILABLE/);denied(session+metadataRead,/SOURCE_PROVENANCE_UNAVAILABLE/);
    ok(`INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,source_storage_sha256,policies_storage_sha256)
      SELECT source_receipt_ref,request_operation_id,account_id,'INPUTS',evidence_storage_sha256,policies_storage_sha256 FROM potok_nutrition.generation_validation_inputs_v1;`);
    assert.equal(ok(session+metadataRead),'');
  });
  await t.test('owner admission rejects wrong account, incomplete profile and malformed slot coverage',()=>{
    denied(insert('synthetic-only:wrong-account','METADATA',metadata,literal(id(999))),/GENERATION_PRODUCER_SOURCE_BINDING_MISMATCH/);
    const data=JSON.parse(metadata);delete data.goalProfile;denied(insert('synthetic-only:no-profile','METADATA',JSON.stringify(data)),/INVALID_STORED_PREPARATION_METADATA/);
    const slots=JSON.parse(metadata);slots.slotRevisions.pop();denied(insert('synthetic-only:missing-slot','METADATA',JSON.stringify(slots)),/STORED_PREPARATION_SLOT_COVERAGE_MISMATCH/);
    denied(insert('synthetic-only:duplicate-json','METADATA',metadata.replace('{','{"contract":"duplicate",')),/check constraint/);
  });
  ok(insert('synthetic-only:metadata','METADATA',metadata));
  await t.test('actual SQL metadata is consumed unchanged and cannot be overwritten',async()=>{
    assert.equal(await ports.metadata.loadMetadataRaw(input.operation.requestId,inputSha),metadata);
    denied(insert('synthetic-only:metadata-again','METADATA',metadata),/duplicate key/);
    denied(session+insert('synthetic-only:writer','METADATA',metadata),/permission denied/);
  });
  const source=createAdmittedGenerationPreparationSourceV1(sql,ports.metadata);
  const prepared=await createGenerationMenuCandidatePreparerV1(source).prepare(input.operation.requestId);
  assert.equal(prepared.status,'PREPARED');if(!('slots'in prepared))throw Error('INVALID_FIXTURE');
  await t.test('missing per-meal records remain unavailable and signals/digests are structurally bound',async()=>{
    const slot=prepared.slots[0],meal=slot.meals[0].meal;
    assert.equal(await ports.warnings.loadMealWarningRaw(input.operation.requestId,slot.slotId,meal.digest,evidence,policies),null);
    const warning=JSON.parse(await fixture.warnings.loadMealWarningRaw(input.operation.requestId,slot.slotId,meal.digest));
    const missing=structuredClone(warning);delete missing.signals.longPreparationBurden;
    denied(insert('synthetic-only:missing-signal','MEAL_WARNING',JSON.stringify(missing)),/INVALID_STORED_MEAL_WARNING_SIGNALS/);
    const changed=structuredClone(warning);changed.signals.longPreparationBurden=!changed.signals.longPreparationBurden;
    denied(insert('synthetic-only:wrong-warning-digest','MEAL_WARNING',JSON.stringify(changed)),/STORED_MEAL_WARNING_DIGEST_MISMATCH/);
    const wrong=structuredClone(warning);wrong.validationEvidenceDigest='f'.repeat(64);
    denied(insert('synthetic-only:wrong-warning-context','MEAL_WARNING',JSON.stringify(wrong)),/INVALID_STORED_MEAL_WARNING/);
  });
  const refs=new Map<string,string>();let number=0;
  // These known fixture assessments are synthetic. No runtime evaluator or publication is implied.
  for(const slot of prepared.slots)for(const option of slot.meals){
    const warning=await fixture.warnings.loadMealWarningRaw(input.operation.requestId,slot.slotId,option.meal.digest),ref='synthetic-only:meal-'+number++;
    ok(insert(ref,'MEAL_WARNING',warning));refs.set(slot.slotId+':'+option.meal.digest,ref);
  }
  await t.test('SQL metadata and per-meal warnings do not replace independent final proposal authority',async()=>{
    const gateway=await generationWorkerFixtureV1();
    await assert.rejects(createStoredProducerGenerationWorkerV1({sourcesSql:sql,decisions:fixture.decisions,gateway:gateway.client,enabled:()=>true}).continue(input.operation.requestId),/SOURCE_PROVENANCE_UNAVAILABLE/);
    assert.equal(gateway.counts.records,0);assert.equal(gateway.counts.activations,0);
  });
  ok(warningInsert(f.warningRaw,proposal));
  ok(`INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,proposal_raw_sha256,source_storage_sha256)
    SELECT source_receipt_ref,request_operation_id,${account},'WARNINGS',proposal_raw_sha256,warning_storage_sha256 FROM potok_nutrition.generation_validation_warnings_v1;`);
  await t.test('stored metadata and warnings feed real catalog/day/week/projection and two final SQL checks',async()=>{
    const gateway=await generationWorkerFixtureV1(),start=statements.length;
    assert.equal((await createStoredProducerGenerationWorkerV1({sourcesSql:sql,decisions:fixture.decisions,gateway:gateway.client,enabled:()=>true}).continue(input.operation.requestId)).status,'ACTIVE');
    const queries=statements.slice(start);assert.equal(queries.filter(s=>s===generationPreparationReadSqlV1).length,1);assert.equal(queries.filter(s=>s===generationMetadataSourceReadSqlV1).length,1);
    assert.ok(queries.filter(s=>s===generationMealWarningSourceReadSqlV1).length>=7);assert.equal(queries.filter(s=>s===admittedGenerationValidationSourceReadSqlV1).length,2);
    assert.equal(Buffer.from(gateway.stored()!,'hex').toString('utf8'),canonicalJsonV1(f.plan,'SAFE_INTEGER'));assert.equal(gateway.counts.records,1);assert.equal(gateway.counts.activations,1);
    assert.equal(ok('SELECT status FROM potok_nutrition.adaptive_nutrition_generation_requests_v2;'),'REQUESTED'); // persistence gateway is simulated
  });
  await t.test('revoked meal data is unavailable, while changed context lookup cannot borrow another snapshot',async()=>{
    const slot=f.plan.graph.days[0].slots[0],ref=refs.get(slot.slotId+':'+slot.mealSnapshot.digest);assert.ok(ref);
    ok(`INSERT INTO potok_nutrition.generation_preparation_source_revocations_v1(source_ref,reason_ref) VALUES(${literal(ref)},'synthetic-only:revoked');`);
    assert.equal(await ports.warnings.loadMealWarningRaw(input.operation.requestId,slot.slotId,slot.mealSnapshot.digest,evidence,policies),null);
    assert.equal(await ports.metadata.loadMetadataRaw(input.operation.requestId,'f'.repeat(64)),null);
    assert.equal(await ports.warnings.loadMealWarningRaw(input.operation.requestId,slot.slotId,slot.mealSnapshot.digest,'f'.repeat(64),policies),null);
  });
  await t.test('metadata revocation prevents generation and storage history stays immutable',async()=>{
    ok("INSERT INTO potok_nutrition.generation_preparation_source_revocations_v1(source_ref,reason_ref) VALUES('synthetic-only:metadata','synthetic-only:revoked');");
    assert.equal(await ports.metadata.loadMetadataRaw(input.operation.requestId,inputSha),null);
    const gateway=await generationWorkerFixtureV1();await assert.rejects(createStoredProducerGenerationWorkerV1({sourcesSql:sql,decisions:fixture.decisions,gateway:gateway.client,enabled:()=>true}).continue(input.operation.requestId),/GENERATION_PROPOSAL_PREPARATION_STOPPED/);
    assert.equal(gateway.counts.records,0);
    denied("UPDATE potok_nutrition.generation_preparation_sources_v1 SET source_ref='replaced';",/VALIDATION_HISTORY_IMMUTABLE/);
    denied('DELETE FROM potok_nutrition.generation_preparation_source_revocations_v1;',/VALIDATION_HISTORY_IMMUTABLE/);
    denied('TRUNCATE potok_nutrition.generation_preparation_source_revocations_v1;',/VALIDATION_HISTORY_IMMUTABLE/);
  });
});
