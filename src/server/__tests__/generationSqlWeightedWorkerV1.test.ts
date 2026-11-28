import {createSqlTransportGenerationWorkerV1} from '../generationSqlTransportWorkerV1';
import {generationLoadGatewaySqlV1,generationRecordGatewaySqlV1,generationActivateGatewaySqlV1} from '../generationSqlGatewayV1';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createSqlWeightedGenerationWorkerV1} from '../generationSqlWeightedWorkerV1';
import {generationGoalPreparationReadSqlV1} from '../generationGoalPreparationSourceV1';
import {generationPreparationReadSqlV1} from '../generationPreparationSourceV1';
import {generationMealWarningSourceReadSqlV1} from '../generationProducerSourcesV1';
import {admittedGenerationValidationSourceReadSqlV1} from '../generationValidationSourceSqlV1';
import {GenerationPlanReadbackServiceV2,generationPlanReadbackContractV2} from '../../services/generationPlanReadbackV2';
import {adaptiveNutritionGraphSha256HexV2} from '../../utils/adaptiveNutritionGraphV2';
import {id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import {generationSqlWeightedWorkerFixtureV1 as fixture} from './generationSqlWeightedWorkerFixturesV1';
test('SQL goal, admitted warning ports and computed metrics reach exact validated storage and real menu decoding',async()=>{
  const x=await fixture();assert.equal((await x.run()).status,'ACTIVE');
  assert.deepEqual(x.queryLog.map(q=>q.statement),[generationGoalPreparationReadSqlV1,...Array(7).fill(generationMealWarningSourceReadSqlV1),
    generationPreparationReadSqlV1,admittedGenerationValidationSourceReadSqlV1,admittedGenerationValidationSourceReadSqlV1]);
  assert.equal(x.state.records,1);assert.equal(x.state.activations,1);
  const plan=JSON.parse(Buffer.from(x.state.stored!,'hex').toString('utf8'));assert.deepEqual(plan.facts,[]);
  for(const day of plan.graph.days)for(const slot of day.slots){
    assert.match(slot.mealSnapshotRevision,/^[0-9a-f-]{14}8/);
    assert.equal(slot.generatorDecisionEvidence.optimizationResultDigest,plan.graph.weekOptimizationResultDigest);
    for(const c of slot.mealSnapshot.components){assert.equal(c.recipe.baseYield.totalYieldGrams,null);assert.equal(c.assignedPortion.assignedGrams,null);}
  }
  const reader=new GenerationPlanReadbackServiceV2({auth:{async getUser(){return {data:{user:{id:x.input.accountId}},error:null};}},
    async rpc(name,args){assert.equal(name,'adaptive_nutrition_read_generation_plan_v2');assert.equal(args.p_request_operation_id,x.request);
      return {data:{kind:'ready',contract:generationPlanReadbackContractV2,request_operation_id:x.request,account_id:x.input.accountId,
        selection_id:plan.graph.selectionId,plan_revision:plan.graph.planRevision,generation_operation_id:id(77),activation_operation_id:id(78),
        graph_digest_hex:await adaptiveNutritionGraphSha256HexV2(plan.graph),graph:plan.graph},error:null};}},()=>true);
  const r=await reader.read(reader.beginSession(x.input.accountId),x.request);assert.equal(r.kind,'ready');if(r.kind==='ready')assert.deepEqual(r.graph,plan.graph);
  const count=x.queryLog.length;assert.equal((await x.run()).status,'ACTIVE');assert.equal(x.queryLog.length,count);assert.equal(x.state.records,1);
});
test('no goal/profile, warning, metrics or final authority absence is replaced by synthetic metadata or defaults',async()=>{
  for(const mode of ['missingGoal','unknownGoal','missingWarning','missingMetrics','revokeFinal','staleFinal']){
    const x=await fixture();x.state.mode=mode;if(mode==='unknownGoal')x.state.goal='unsupported';
    await assert.rejects(x.run());assert.equal(x.state.records,0);assert.equal(x.state.activations,0);
    if(mode==='missingGoal'||mode==='unknownGoal')assert.deepEqual(x.queryLog.map(q=>q.statement),[generationGoalPreparationReadSqlV1]);
    if(mode==='revokeFinal')assert.equal(x.state.finalReads,2);
  }
});
test('reader identity errors and corrupt stored warning hashes stop without a different reader or write',async()=>{
  for(const mode of ['identity','corruptWarning']){const x=await fixture();x.state.mode=mode;
    await assert.rejects(x.run(),mode==='identity'?/GENERATION_READER_IDENTITY_REQUIRED/:/GENERATION_PRODUCER_STORAGE_DIGEST_MISMATCH/);
    assert.equal(x.state.records,0);assert.equal(x.state.finalReads,0);if(mode==='identity')assert.equal(x.queryLog.length,1);
  }
});
test('default and mid-await SQL/convenience gate closure stop all further work',async()=>{
  const x=await fixture(),{enabled,...deps}=x.deps;void enabled;
  await assert.rejects(createSqlWeightedGenerationWorkerV1(deps).continue(x.request),/GENERATION_RUNTIME_DISABLED/);assert.equal(x.queryLog.length,0);assert.equal(x.rpcLog.length,0);
  for(const closeAt of ['goal','metrics','convenience']){const y=await fixture(closeAt==='convenience');y.state.closeAt=closeAt;
    await assert.rejects(y.run(),/GENERATION_RUNTIME_DISABLED/);assert.equal(y.state.records,0);assert.equal(y.state.finalReads,0);
  }
});
test('strict mode preserves unknown convenience and requires an explicit admitted known source to succeed',async()=>{
  const x=await fixture();await assert.rejects(createSqlWeightedGenerationWorkerV1({...x.deps,comparison:'STRICT'}).continue(x.request));assert.equal(x.state.records,0);
  const y=await fixture(true);assert.equal((await createSqlWeightedGenerationWorkerV1({...y.deps,comparison:'STRICT'}).continue(y.request)).status,'ACTIVE');
  assert.throws(()=>createSqlWeightedGenerationWorkerV1({...x.deps,convenience:undefined as never}),/INVALID_WEEK_CONVENIENCE_SOURCE/);
});

test('fixed SQL gateway composes with admitted SQL sources and recovers a committed record after a lost reply',async()=>{
  const x=await fixture(),{gateway,...generation}=x.deps;let loseRecordReply=true;const calls:string[]=[];
  const worker=createSqlTransportGenerationWorkerV1({...generation,gatewaySql:{async query(statement,parameters){
    calls.push(statement);assert.ok([generationLoadGatewaySqlV1,generationRecordGatewaySqlV1,generationActivateGatewaySqlV1].includes(statement));
    const record=statement===generationRecordGatewaySqlV1;
    const result=await gateway.rpc(statement===generationLoadGatewaySqlV1?'load_generation_request_v2':record?'record_generated_week_gateway_v2':'activate_generated_week_gateway_v2',
      {p_request_operation_id:parameters[0],...(record?{p_generated_week_plan_canonical:'\\x'+parameters[1]}:{})});
    if(record)assert.equal(x.state.stored,parameters[1]);
    if(record&&loseRecordReply){loseRecordReply=false;throw Error('synthetic committed reply loss');}
    return {rows:[{result_raw:result.data}]};
  }}});
  await assert.rejects(worker.continue(x.request),/RPC_FAILED/);assert.equal(x.state.records,1);assert.equal(x.state.activations,0);
  const sourceReads=x.queryLog.length;assert.equal((await worker.continue(x.request)).status,'ACTIVE');
  assert.equal(x.queryLog.length,sourceReads);assert.equal(x.state.records,1);assert.equal(x.state.activations,1);
  assert.deepEqual(JSON.parse(Buffer.from(x.state.stored!,'hex').toString('utf8')).facts,[]);
  assert.deepEqual(calls,[generationLoadGatewaySqlV1,generationRecordGatewaySqlV1,generationLoadGatewaySqlV1,generationActivateGatewaySqlV1]);
});
test('SQL gateway identity denial prevents preparation and final-authority reads',async()=>{
  const x=await fixture(),{gateway,...generation}=x.deps;void gateway;
  const worker=createSqlTransportGenerationWorkerV1({...generation,gatewaySql:{async query(){return {rows:[{result_raw:null}]};}}});
  await assert.rejects(worker.continue(x.request),/RPC_FAILED/);assert.equal(x.queryLog.length,0);assert.equal(x.state.records,0);
});
