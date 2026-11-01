import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {installGenerationRuntimeSourceFixtureV1} from './generation-validation-runtime-fixture-v1';
import {ok,denied,literal,binary,hash} from './generation-validation-fixture-v1';
import {createAdmittedGenerationPreparationSourceV1,generationPreparationReadSqlV1} from '../../src/server/generationPreparationSourceV1';
import {createSqlPreparedGenerationWorkerV1} from '../../src/server/generationSqlPreparedWorkerV1';
import {admittedGenerationValidationSourceReadSqlV1} from '../../src/server/generationValidationSourceSqlV1';
import {createGenerationMenuCandidatePreparerV1} from '../../src/server/generationMenuCandidatesV1';
import {generationPreparationMetadataFixtureV1} from '../../src/server/__tests__/generationPreparationSqlFixturesV1';
import {generationPreparationPortsFixtureV1} from '../../src/server/__tests__/generationAdmittedWorkerFixturesV1';
import {generationWorkerFixtureV1} from '../../src/server/__tests__/generationWorkerBindingsFixturesV1';
import {canonicalJsonV1} from '../../src/utils/adaptiveNutritionWireV1';
import {id,fixtureWeekValidationInput} from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
import {createSqlGenerationWeekMetricProducerV1,generationWeekMetricPolicyContractV1,generationWeekConvenienceContractV1} from '../../src/server/generationWeekMetricProducerV1';
import {optimizeGenerationWeekRawV1,optimizeGenerationWeekWithConvenienceBoundsRawV1} from '../../src/server/generationWeekOptimizationV1';
import {generationWeekSearchContractV1} from '../../src/server/generationWeekSearchV1';
import {optimizationPolicyContractV1} from '../../src/utils/adaptiveNutritionMealBalanceV1';
const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
const extension=readFileSync(new URL('../../docs/premium/drafts/generation_preparation_source_v1.sql',import.meta.url),'utf8');
const workerSession='SET SESSION AUTHORIZATION potok_generation_reader_v1;';
test('native request-only preparation starts without final warnings; proposal validation still requires them',{skip:!native},async t=>{
  const {f,input,request,account,inputInsert,warningInsert}=await installGenerationRuntimeSourceFixtureV1();
  ok(extension);
  const read=`SELECT potok_nutrition.read_admitted_generation_preparation_source_v1(${request});`;
  const proposalSha=hash(canonicalJsonV1(f.plan,'SAFE_INTEGER'));
  const finalRead=`SELECT potok_nutrition.read_admitted_generation_validation_source_v1(${request},${binary(proposalSha)});`;
  await t.test('only admitted reader identity may call new endpoint; existing validation reader remains unchanged',()=>{
    assert.equal(ok("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE');"),'2');
    for(const role of ['anon','authenticated','service_role'])denied(`SET ROLE ${role};`+read,/permission denied/);
    denied(read,/GENERATION_READER_IDENTITY_REQUIRED/);denied('SET ROLE potok_generation_reader_v1;'+read,/GENERATION_READER_IDENTITY_REQUIRED/);
    assert.equal(ok("SELECT md5(prosrc) FROM pg_proc WHERE oid='potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)'::regprocedure;"),'c12b5e1198160e7b3b9df7eeb8a6661f');
    denied(extension,/PREPARATION_SOURCE_ALREADY_INSTALLED/);
  });
  await t.test('missing inputs or unregistered/revoked storage provenance never yield preparation',()=>{
    denied(workerSession+read,/SOURCE_PROVENANCE_UNAVAILABLE/);ok(inputInsert());denied(workerSession+read,/SOURCE_PROVENANCE_UNAVAILABLE/);
    ok(`INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,source_storage_sha256,policies_storage_sha256)
      SELECT source_receipt_ref,request_operation_id,account_id,'INPUTS',evidence_storage_sha256,policies_storage_sha256 FROM potok_nutrition.generation_validation_inputs_v1;`);
    const raw=ok(workerSession+read),value=JSON.parse(raw);assert.equal(value.contract,'potok-generation-preparation-context-source-v1');
    assert.equal('evaluatedPlanRawSha256' in value,false);assert.equal('warningEvidenceRaw' in value,false);
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_validation_warnings_v1;'),'0');
    denied(workerSession+finalRead,/SOURCE_PROVENANCE_UNAVAILABLE/);
  });
  const statements:string[]=[];
  const sql={async query(statement:string,parameters:readonly string[]){
    statements.push(statement);assert.equal(parameters[0],input.operation.requestId);
    if(statement===generationPreparationReadSqlV1){assert.equal(parameters.length,1);return {rows:[{source_raw:ok(workerSession+read)||null}]};}
    assert.equal(statement,admittedGenerationValidationSourceReadSqlV1);assert.deepEqual(parameters,[input.operation.requestId,proposalSha]);
    return {rows:[{source_raw:ok(workerSession+finalRead)||null}]};
  }};
  const metadata={async loadMetadataRaw(r:string,digest:string){assert.equal(r,input.operation.requestId);assert.equal(digest,f.evidence.generationInputDigest);return generationPreparationMetadataFixtureV1(f);}};
  const ports=await generationPreparationPortsFixtureV1(f);
  const metricPolicyRaw=JSON.stringify({contract:generationWeekMetricPolicyContractV1,metricPolicyRevision:id(991),
    optimizationPolicyRevision:input.optimizationPolicyRevision,targetFit:'MEAN_DAILY_CALORIE_FIT_V1',
    diversity:'UNIQUE_RECIPE_MEAL_SHARE_V1',shoppingReuse:'CANONICAL_FOOD_MEAL_REUSE_SHARE_V1',convenience:'INDEPENDENT_WEEK_CONVENIENCE_V1'});
  const optimizationPolicyRaw=JSON.stringify({contract:optimizationPolicyContractV1,policyRevision:input.optimizationPolicyRevision,
    weights:{targetFit:'0.400',diversity:'0.250',convenience:'0.200',shoppingReuse:'0.150'}});
  const metricWeekRaw=JSON.stringify(fixtureWeekValidationInput(f));
  // Only convenience remains an explicit synthetic upstream source. Other metrics are computed from SQL context.
  const computedMetrics=createSqlGenerationWeekMetricProducerV1(sql,metricPolicyRaw,{async loadConvenienceRaw(r,sha,digest,revision){
    return JSON.stringify({contract:generationWeekConvenienceContractV1,requestOperationId:r,weekRawSha256:sha,generationInputDigest:digest,
      metricPolicyRevision:revision,sourceRevision:id(992),score:'0.750'});
  }});

  await t.test('actual PostgreSQL context goes through strict stored decoders and real candidate preparation',async()=>{
    const source=createAdmittedGenerationPreparationSourceV1(sql,metadata),raw=await source.loadPreparationRaw(input.operation.requestId);assert.ok(raw);
    const prepared=await createGenerationMenuCandidatePreparerV1({async loadPreparationRaw(){return raw;}}).prepare(input.operation.requestId);
    assert.equal(prepared.status,'PREPARED');assert.equal(statements[0],generationPreparationReadSqlV1);
  });
  await t.test('successful SQL preparation cannot bypass missing independent proposal warnings',async()=>{
    const gateway=await generationWorkerFixtureV1();
    await assert.rejects(createSqlPreparedGenerationWorkerV1({preparationSql:sql,authoritySql:sql,metadata,warnings:ports.warnings,decisions:ports.decisions,gateway:gateway.client,enabled:()=>true}).continue(input.operation.requestId),/SOURCE_PROVENANCE_UNAVAILABLE/);
    assert.equal(gateway.counts.records,0);assert.equal(gateway.counts.activations,0);
  });

  await t.test('SQL context feeds calculated metrics and real weighted search before final warning storage',async()=>{
    const unknown=createSqlGenerationWeekMetricProducerV1(sql,metricPolicyRaw,null);
    const partial=await unknown.calculateWeekRaw(input.operation.requestId,metricWeekRaw,f.evidence.generationInputDigest,optimizationPolicyRaw);
    assert.ok(partial);assert.equal(partial.status,'PARTIAL');assert.equal(JSON.parse(partial.metricsRaw).metrics.convenience,null);
    const {days,...weekHeader}=fixtureWeekValidationInput(f);
    const searchRaw=JSON.stringify({contract:generationWeekSearchContractV1,weekHeader,dayOptions:days.map(d=>[d]),maxEvaluations:1});
    const result=await optimizeGenerationWeekRawV1(searchRaw,f.rawContext.candidateManifestRaw,optimizationPolicyRaw,
      JSON.stringify(input),computedMetrics);
    assert.equal(result.status,'FEASIBLE_PROPOSAL');if(result.status==='FEASIBLE_PROPOSAL')assert.equal(result.score,'0.400');
    const bounded=await optimizeGenerationWeekWithConvenienceBoundsRawV1(searchRaw,f.rawContext.candidateManifestRaw,optimizationPolicyRaw,
      JSON.stringify(input),unknown);
    assert.equal(bounded.status,'FEASIBLE_PROPOSAL');
    if(bounded.status==='FEASIBLE_PROPOSAL'){
      assert.equal(bounded.score,null);assert.deepEqual(bounded.scoreBounds,{minimum:'0.250',maximum:'0.450'});
      assert.deepEqual(bounded.unknownMetrics,['convenience']);
    }
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_validation_warnings_v1;'),'0');
  });
  ok(warningInsert(f.warningRaw,proposalSha));
  ok(`INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,proposal_raw_sha256,source_storage_sha256)
    SELECT source_receipt_ref,request_operation_id,${account},'WARNINGS',proposal_raw_sha256,warning_storage_sha256 FROM potok_nutrition.generation_validation_warnings_v1;`);
  await t.test('request context plus separate final authority feed the real pipeline and existing worker',async()=>{
    const gateway=await generationWorkerFixtureV1(),start=statements.length;
    const result=await createSqlPreparedGenerationWorkerV1({preparationSql:sql,authoritySql:sql,metadata,warnings:ports.warnings,decisions:ports.decisions,gateway:gateway.client,enabled:()=>true}).continue(input.operation.requestId);
    assert.equal(result.status,'ACTIVE');assert.equal(gateway.counts.records,1);assert.equal(gateway.counts.activations,1);
    assert.equal(Buffer.from(gateway.stored()!,'hex').toString('utf8'),canonicalJsonV1(f.plan,'SAFE_INTEGER'));
    assert.deepEqual(statements.slice(start),[generationPreparationReadSqlV1,admittedGenerationValidationSourceReadSqlV1,admittedGenerationValidationSourceReadSqlV1]);
  });
  await t.test('current Premium/selection/manifest and terminal status are still enforced',()=>{
    denied("BEGIN;UPDATE potok_control.access_attestations SET valid_until=statement_timestamp()-interval '1 minute';"+workerSession+read+'ROLLBACK;',/VERIFIED_PREMIUM_REQUIRED/);
    denied("BEGIN;UPDATE public.user_premium_plan_selections SET origin_lineage='{}';"+workerSession+read+'ROLLBACK;',/SOURCE_PROVENANCE_UNAVAILABLE/);
    denied(`BEGIN;UPDATE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 SET current_manifest_revision=${literal(id(999))};`+workerSession+read+'ROLLBACK;',/query returned no rows/);
    denied(`BEGIN;INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifests_v2
      SELECT ${literal(id(999))},publication_state,canonical_bytes,canonical_digest FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2;
      UPDATE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 SET current_manifest_revision=${literal(id(999))};`+workerSession+read+'ROLLBACK;',/GENERATION_REQUEST_STALE_MANIFEST/);
    denied("BEGIN;UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='ACTIVE';"+workerSession+read+'ROLLBACK;',/SOURCE_PROVENANCE_UNAVAILABLE/);
    assert.ok(ok(workerSession+read));
  });
  await t.test('request-only reader adds no source rows, no publishers or table grants',()=>{
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_validation_inputs_v1;'),'1');
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_validation_warnings_v1;'),'1');
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_validation_receipt_bindings_v1;'),'2');
    denied(workerSession+inputInsert(),/permission denied/);
    denied(workerSession+'SELECT * FROM potok_nutrition.generation_validation_inputs_v1;',/permission denied/);
  });
  await t.test('input-receipt revocation blocks preparation before producer metadata or persistence',async()=>{
    ok("INSERT INTO potok_nutrition.generation_validation_receipt_revocations_v1(receipt_ref,reason_ref) VALUES ('synthetic-only:inputs','synthetic-only:revoked');");
    let calls=0;const source=createAdmittedGenerationPreparationSourceV1(sql,{async loadMetadataRaw(){calls++;return null;}});
    await assert.rejects(source.loadPreparationRaw(input.operation.requestId),/SOURCE_PROVENANCE_UNAVAILABLE/);assert.equal(calls,0);
    await assert.rejects(computedMetrics.assessWeekRaw(input.operation.requestId,metricWeekRaw,f.evidence.generationInputDigest,optimizationPolicyRaw),/SOURCE_PROVENANCE_UNAVAILABLE/);
  });
});
