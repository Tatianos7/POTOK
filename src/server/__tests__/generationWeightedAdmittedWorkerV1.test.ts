import assert from 'node:assert/strict';
import test from 'node:test';
import {createWeightedAdmittedGenerationWorkerV1,type WeightedAdmittedGenerationWorkerDependenciesV1} from '../generationWeightedAdmittedWorkerV1';
import {admittedGenerationValidationSourceReadSqlV1} from '../generationValidationSourceSqlV1';
import {createGenerationWeekMetricProducerV1,generationWeekMetricPolicyContractV1,generationWeekConvenienceContractV1} from '../generationWeekMetricProducerV1';
import {generationMenuCandidateSourceContractV1} from '../generationMenuCandidatesV1';
import {generationPreparationContextFixtureV1} from './generationPreparationSqlFixturesV1';
import {generationStoredAuthorityFixtureV1,fixtureHashV1} from './generationAdmittedWorkerFixturesV1';
import {GenerationPlanReadbackServiceV2,generationPlanReadbackContractV2} from '../../services/generationPlanReadbackV2';
import {GenerationPlanEntryControllerV2} from '../../services/generationPlanEntryV2';
import {adaptiveNutritionGraphSha256HexV2} from '../../utils/adaptiveNutritionGraphV2';
import {adaptiveNutritionCandidateManifestCanonicalBytesV2} from '../../utils/adaptiveNutritionAuthoritiesV1';
import {optimizationPolicyContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {fullFixture,resignEntry,id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import type {GenerationRpcClientV2} from '../../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
const canonical=(v:unknown)=>canonicalJsonV1(v,'SAFE_INTEGER');
const encode=(s:string)=>Buffer.from(s).toString('hex');
const decode=(s:string)=>Buffer.from(s,'hex').toString('utf8');
const load='load_generation_request_v2',record='record_generated_week_gateway_v2',activate='activate_generated_week_gateway_v2';
// Explicit synthetic source/admission/SQL/gateway model. Real metrics, selection,
// decision projection, graph, independent validators, worker and client readback run below.
async function fixture(known=false){
  const f=await fullFixture(s=>{for(const e of s.context.manifest.entries)e.recipeSnapshot.baseYield.totalYieldGrams=null;});
  const input=f.context.input,request=input.operation.requestId,contextRaw=await generationPreparationContextFixtureV1(f);
  const counts={source:0,warnings:0,metrics:0,sql:0,records:0,activations:0},calls:string[]=[];
  const state={enabled:true,status:'GENERATING',stored:null as string|null,proposalSha:null as string|null,
    recordLostReply:false,activationLostReply:false,conflict:false,revoke:false,closeAt:'',driftInput:false};
  const metrics=createGenerationWeekMetricProducerV1({async loadContextRaw(){return contextRaw;}},JSON.stringify({
    contract:generationWeekMetricPolicyContractV1,metricPolicyRevision:id(991),optimizationPolicyRevision:input.optimizationPolicyRevision,
    targetFit:'MEAN_DAILY_CALORIE_FIT_V1',diversity:'UNIQUE_RECIPE_MEAL_SHARE_V1',shoppingReuse:'CANONICAL_FOOD_MEAL_REUSE_SHARE_V1',
    convenience:'INDEPENDENT_WEEK_CONVENIENCE_V1'}),known?{async loadConvenienceRaw(r,sha,digest,revision){
      return JSON.stringify({contract:generationWeekConvenienceContractV1,requestOperationId:r,weekRawSha256:sha,generationInputDigest:digest,
        metricPolicyRevision:revision,sourceRevision:id(992),score:'0.750'});
    }}:null);
  const gateway:GenerationRpcClientV2={async rpc<T>(name:string,args:Record<string,unknown>){
    calls.push(name);assert.equal(args.p_request_operation_id,request);
    if(name===record){
      if(state.conflict)state.status='CONFLICT';else{
        assert.equal(counts.sql,2);const bytes=(args.p_generated_week_plan_canonical as string).slice(2);
        assert.equal(fixtureHashV1(decode(bytes)),state.proposalSha);counts.records++;state.stored=bytes;state.status='GENERATED';
        if(state.closeAt==='record')state.enabled=false;
        if(state.recordLostReply&&counts.records===1)return {data:null,error:{lost:true}};
      }
    }else if(name===activate){
      assert.ok(state.stored);counts.activations++;state.status='ACTIVE';
      if(state.closeAt==='activate')state.enabled=false;
      if(state.activationLostReply&&counts.activations===1)return {data:null,error:{lost:true}};
    }else assert.equal(name,load);
    const response={contract:'potok-adaptive-generation-request-status-v2',requestOperationId:request,status:state.status,
      retryable:state.status!=='ACTIVE',reasonCode:null};
    return {data:(name===load?{...response,generationInputCanonicalHex:encode(canonical(state.driftInput?{...input,accountId:id(999)}:input)),
      candidateManifestCanonicalHex:Buffer.from(await adaptiveNutritionCandidateManifestCanonicalBytesV2(f.context.manifest)).toString('hex'),attemptOperationId:id(88)}:response) as T,error:null};
  }};
  const deps:WeightedAdmittedGenerationWorkerDependenciesV1={
    source:{async loadPreparationRaw(r){counts.source++;assert.equal(r,request);if(state.closeAt==='source')state.enabled=false;
      return JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId:r,contextRaw:f.contextRaw,policiesRaw:f.policiesRaw,
        goalProfile:'MAINTENANCE',slotRevisions:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,mealSnapshotRevision:s.mealSnapshotRevision})))});}},
    warnings:{async loadMealWarningRaw(r,slotId,mealSnapshotDigest){counts.warnings++;assert.equal(r,request);
      if(state.closeAt==='warnings')state.enabled=false;return JSON.stringify(resignEntry({...f.set.entries[0],slotId,mealSnapshotDigest}));}},
    optimization:{policyRaw:JSON.stringify({contract:optimizationPolicyContractV1,policyRevision:input.optimizationPolicyRevision,
      weights:{targetFit:'0.400',diversity:'0.250',convenience:'0.200',shoppingReuse:'0.150'}}),metrics:{async assessWeekRaw(...args){
        counts.metrics++;const raw=await metrics.assessWeekRaw(...args);if(state.closeAt==='metrics')state.enabled=false;return raw;}}},
    comparison:'ROBUST_CONVENIENCE_BOUNDS',enabled:()=>state.enabled,gateway,
    authoritySql:{async query(statement,parameters){
      counts.sql++;assert.equal(statement,admittedGenerationValidationSourceReadSqlV1);assert.equal(parameters[0],request);
      if(state.proposalSha===null)state.proposalSha=parameters[1];else assert.equal(parameters[1],state.proposalSha);
      if(state.closeAt==='sql')state.enabled=false;
      return {rows:[{source_raw:state.revoke&&counts.sql>1?null:await generationStoredAuthorityFixtureV1(f,parameters[1])}]};
    }},
  };
  const reader=new GenerationPlanReadbackServiceV2({auth:{async getUser(){return {data:{user:{id:input.accountId}},error:null};}},
    async rpc(name,args){
      assert.equal(name,'adaptive_nutrition_read_generation_plan_v2');assert.equal(args.p_request_operation_id,request);
      if(state.status!=='ACTIVE'||!state.stored)return {data:{kind:'not_ready'},error:null};
      const graph=JSON.parse(decode(state.stored)).graph;
      return {data:{kind:'ready',contract:generationPlanReadbackContractV2,request_operation_id:request,account_id:input.accountId,
        selection_id:graph.selectionId,plan_revision:graph.planRevision,generation_operation_id:id(77),activation_operation_id:id(78),
        graph_digest_hex:await adaptiveNutritionGraphSha256HexV2(graph),graph},error:null};
    }},()=>true);
  return {f,input,request,counts,calls,state,deps,reader,run:()=>createWeightedAdmittedGenerationWorkerV1(deps).continue(request)};
}
test('computed unknown-convenience selection reaches validated record, activation and real client menu readback',async()=>{
  const x=await fixture(),session=x.reader.beginSession(x.input.accountId);
  assert.equal((await x.reader.read(session,x.request)).kind,'not_ready');
  assert.equal((await x.run()).status,'ACTIVE');assert.deepEqual(x.calls,[load,record,activate]);
  assert.deepEqual(x.counts,{source:1,warnings:7,metrics:1,sql:2,records:1,activations:1});
  const plan=JSON.parse(decode(x.state.stored!));assert.deepEqual(plan.facts,[]);
  const result=await x.reader.read(session,x.request);assert.equal(result.kind,'ready');if(result.kind!=='ready')throw Error('fixture');
  assert.deepEqual(result.graph,plan.graph);
  const entry=new GenerationPlanEntryControllerV2(x.reader);
  await entry.open(x.input.accountId,x.request,x.input.weekStartLocal,x.input.timezone);
  assert.equal(entry.snapshot().phase,'ready');assert.deepEqual(entry.snapshot().slots,plan.graph.days[0].slots);
  entry.stop();assert.equal(entry.snapshot().phase,'idle');assert.equal(entry.snapshot().slots.length,0);
  for(const d of result.graph.days)for(const s of d.slots){
    assert.equal(s.generatorDecisionEvidence.optimizationResultDigest,result.graph.weekOptimizationResultDigest);
    for(const c of s.mealSnapshot.components){assert.equal(c.recipe.baseYield.totalYieldGrams,null);assert.equal(c.assignedPortion.assignedGrams,null);}
  }
  assert.equal((await x.run()).status,'ACTIVE');assert.equal(x.counts.records,1);assert.equal(x.counts.metrics,1);
  x.reader.endSession();assert.equal((await x.reader.read(session,x.request)).kind,'session-stale');
});
test('strict comparison blocks unknown convenience without bounds or first-feasible fallback',async()=>{
  const x=await fixture();await assert.rejects(createWeightedAdmittedGenerationWorkerV1({...x.deps,comparison:'STRICT'}).continue(x.request),/GENERATION_PROPOSAL_PREPARATION_STOPPED/);
  assert.deepEqual(x.calls,[load]);assert.equal(x.counts.sql,0);assert.equal(x.state.stored,null);
});
test('default gate and gate closed during every external producer stop before persistence',async()=>{
  const x=await fixture();const {enabled,...deps}=x.deps;void enabled;
  await assert.rejects(createWeightedAdmittedGenerationWorkerV1(deps).continue(x.request),/GENERATION_RUNTIME_DISABLED/);
  assert.equal(x.calls.length,0);assert.equal(x.counts.source,0);
  for(const stage of ['source','warnings','metrics','sql']){
    const y=await fixture();y.state.closeAt=stage;await assert.rejects(y.run(),/GENERATION_RUNTIME_DISABLED/);
    assert.equal(y.counts.records,0);assert.equal(y.counts.activations,0);
  }
});
test('final authority revocation blocks recording and menu remains unavailable',async()=>{
  const x=await fixture();x.state.revoke=true;await assert.rejects(x.run(),/GENERATION_VALIDATION_BLOCKED/);
  assert.equal(x.counts.sql,2);assert.equal(x.counts.records,0);assert.equal(x.counts.activations,0);
  assert.equal((await x.reader.read(x.reader.beginSession(x.input.accountId),x.request)).kind,'not_ready');
});
test('lost record or activation reply recovers committed state without duplicate generation or writes',async()=>{
  for(const failure of ['recordLostReply','activationLostReply'] as const){
    const x=await fixture();x.state[failure]=true;const worker=createWeightedAdmittedGenerationWorkerV1(x.deps);
    await assert.rejects(worker.continue(x.request),/RPC_FAILED/);
    assert.equal((await worker.continue(x.request)).status,'ACTIVE');
    assert.equal(x.counts.records,1);assert.equal(x.counts.activations,1);assert.equal(x.counts.source,1);assert.equal(x.counts.metrics,1);
    assert.equal((await x.reader.read(x.reader.beginSession(x.input.accountId),x.request)).kind,'ready');
  }
});
test('record conflict and request input substitution cannot activate or expose a menu',async()=>{
  const x=await fixture();x.state.conflict=true;assert.equal((await x.run()).status,'CONFLICT');assert.equal(x.counts.activations,0);
  assert.equal((await x.reader.read(x.reader.beginSession(x.input.accountId),x.request)).kind,'not_ready');
  const y=await fixture();y.state.driftInput=true;await assert.rejects(y.run(),/WORKER_INPUT_SNAPSHOT_MISMATCH/);assert.equal(y.counts.sql,0);assert.equal(y.counts.records,0);
});
test('comparison mode is explicit and configuration replacements cannot switch an assembled worker',async()=>{
  const x=await fixture();assert.throws(()=>createWeightedAdmittedGenerationWorkerV1({...x.deps,comparison:'UNKNOWN' as 'STRICT'}),/INVALID_GENERATION_COMPARISON/);
  const mutable={...x.deps,optimization:{...x.deps.optimization}},worker=createWeightedAdmittedGenerationWorkerV1(mutable);
  mutable.comparison='STRICT';mutable.optimization={policyRaw:'{}',metrics:{async assessWeekRaw(){throw Error('REPLACED_METRICS');}}};
  mutable.gateway={async rpc(){throw Error('REPLACED_GATEWAY');}};
  assert.equal((await worker.continue(x.request)).status,'ACTIVE');
});

test('strict mode with independently supplied known convenience also records the real optimized plan',async()=>{
  const x=await fixture(true);const worker=createWeightedAdmittedGenerationWorkerV1({...x.deps,comparison:'STRICT'});
  assert.equal((await worker.continue(x.request)).status,'ACTIVE');assert.equal(x.counts.sql,2);assert.equal(x.counts.records,1);
  assert.equal((await x.reader.read(x.reader.beginSession(x.input.accountId),x.request)).kind,'ready');
});
test('closing the gate after a committed gateway call recovers from the stored status after reopening',async()=>{
  for(const stage of ['record','activate']){
    const x=await fixture();x.state.closeAt=stage;const worker=createWeightedAdmittedGenerationWorkerV1(x.deps);
    await assert.rejects(worker.continue(x.request),/GENERATION_RUNTIME_DISABLED/);
    assert.equal(x.counts.records,1);assert.equal(x.counts.activations,stage==='activate'?1:0);
    x.state.enabled=true;x.state.closeAt='';assert.equal((await worker.continue(x.request)).status,'ACTIVE');
    assert.equal(x.counts.records,1);assert.equal(x.counts.activations,1);assert.equal(x.counts.metrics,1);
  }
});
