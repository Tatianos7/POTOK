import test from 'node:test';
import assert from 'node:assert/strict';
import {fullFixture} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import {decodePreparedMealWarningEvidenceRawV2} from '../../utils/trustedMealWarningEvidenceV1';
import {assessGenerationMealWarningsRawV1,generationWarningAssessmentFactsContractV1,
  generationWarningAssessmentPolicyContractV1,createAssessedGenerationWarningPortV1} from '../generationMealWarningAssessmentV1';

// Explicit synthetic thresholds and metrics. These are never runtime policy defaults.
async function fixture(){
  const f=await fullFixture();const meal=f.plan.graph.days[0].slots[0].mealSnapshot;
  const assessmentPolicyRevision='00000000-0000-4000-8000-000000000991';
  const metrics={targetDeviationBasisPoints:500,preparationMinutes:30,distinctShoppingItems:8,
    convenienceScoreBasisPoints:6000,maximumRepeatUtilizationBasisPoints:7500};
  const policy={contract:generationWarningAssessmentPolicyContractV1,assessmentPolicyRevision,
    validationPolicyRevision:f.policies.balance.policy.policyRevision,thresholds:{...metrics}};
  const facts={contract:generationWarningAssessmentFactsContractV1,
    requestOperationId:f.context.input.operation.requestId,generationInputDigest:f.policies.generationInputDigest,
    validationEvidenceDigest:f.evidence.digest,validationPoliciesDigest:f.policies.digest,slotId:meal.mealSlotId,
    mealSnapshotDigest:meal.digest,assessmentPolicyRevision,evidenceRevision:'00000000-0000-4000-8000-000000000992',
    metrics:metrics as Record<keyof typeof metrics,number|null>};
  const run=(factsRaw=JSON.stringify(facts),policyRaw=JSON.stringify(policy))=>
    assessGenerationMealWarningsRawV1(factsRaw,policyRaw,f.policiesRaw,f.contextRaw,JSON.stringify(meal));
  return {f,meal,policy,facts,run};
}
test('threshold equality has no warning, and output passes the existing actual-meal decoder',async()=>{
  const x=await fixture();const result=await x.run();assert.equal(result.status,'ASSESSED');
  if(result.status!=='ASSESSED')throw Error('expected assessment');
  const entry=await decodePreparedMealWarningEvidenceRawV2(result.warningRaw,x.f.policiesRaw,x.f.contextRaw,JSON.stringify(x.meal));
  assert.deepEqual(Object.values(entry.signals),[false,false,false,false,false]);
  assert.equal(entry.evidenceRevision,x.facts.evidenceRevision);
  assert.equal(result.factsRawSha256.length,64);assert.equal(result.assessmentPolicyRawSha256.length,64);
  assert.deepEqual(await x.run(),result);
});
test('each warning derives from the correct metric and comparison direction',async()=>{
  const x=await fixture();Object.assign(x.facts.metrics,{targetDeviationBasisPoints:501,preparationMinutes:31,
    distinctShoppingItems:9,convenienceScoreBasisPoints:5999,maximumRepeatUtilizationBasisPoints:7501});
  const result=await x.run();assert.equal(result.status,'ASSESSED');
  if(result.status==='ASSESSED')assert.deepEqual(Object.values(JSON.parse(result.warningRaw).signals),[true,true,true,true,true]);
  for(const key of Object.keys(x.facts.metrics) as (keyof typeof x.facts.metrics)[]){
    Object.assign(x.facts.metrics,x.policy.thresholds);
    x.facts.metrics[key]=x.policy.thresholds[key]+(key==='convenienceScoreBasisPoints'?-1:1);
    const assessed=await x.run();assert.equal(assessed.status,'ASSESSED');
    if(assessed.status==='ASSESSED')assert.equal(Object.values(JSON.parse(assessed.warningRaw).signals).filter(Boolean).length,1);
  }
});
test('every missing metric blocks and emits no warning payload; zero is a known value',async()=>{
  const x=await fixture();
  for(const key of Object.keys(x.facts.metrics) as (keyof typeof x.facts.metrics)[]){
    Object.assign(x.facts.metrics,x.policy.thresholds);x.facts.metrics[key]=null;
    assert.deepEqual(await x.run(),{status:'BLOCKED_MISSING_ASSESSMENT_FACTS',missing:[key]});
  }
  Object.assign(x.facts.metrics,{targetDeviationBasisPoints:0,preparationMinutes:0,distinctShoppingItems:0,
    convenienceScoreBasisPoints:0,maximumRepeatUtilizationBasisPoints:0});
  const result=await x.run();assert.equal(result.status,'ASSESSED');
  if(result.status==='ASSESSED')assert.equal(JSON.parse(result.warningRaw).signals.lowerConvenienceScore,true);
});
test('request, input, policy, evidence, slot and meal substitutions are rejected',async()=>{
  const x=await fixture();
  for(const key of ['requestOperationId','generationInputDigest','validationEvidenceDigest','validationPoliciesDigest',
    'slotId','mealSnapshotDigest','assessmentPolicyRevision','evidenceRevision'] as const){
    const changed={...x.facts,[key]:key==='evidenceRevision'?'not-a-revision':key.endsWith('Digest')?'a'.repeat(64):'00000000-0000-4000-8000-000000000993'};
    await assert.rejects(()=>x.run(JSON.stringify(changed)));
  }
  await assert.rejects(()=>x.run(undefined,JSON.stringify({...x.policy,validationPolicyRevision:'00000000-0000-4000-8000-000000000993'})));
});
test('malformed, duplicate, missing, extra and nonnumeric fields do not become defaults',async()=>{
  const x=await fixture();const raw=JSON.stringify(x.facts);
  await assert.rejects(()=>x.run('{"contract":"duplicate",'+raw.slice(1)));
  await assert.rejects(()=>x.run(JSON.stringify({...x.facts,extra:true})));
  for(const value of [-1,1.5,'30',true,Number.MAX_SAFE_INTEGER+1]){
    await assert.rejects(()=>x.run(JSON.stringify({...x.facts,metrics:{...x.facts.metrics,preparationMinutes:value}})));
  }
  await assert.rejects(()=>x.run(raw.replace('"preparationMinutes":30','"preparationMinutes":-0')));
  await assert.rejects(()=>x.run(JSON.stringify({...x.facts,metrics:{}})));
  await assert.rejects(()=>x.run(undefined,JSON.stringify({...x.policy,thresholds:{...x.policy.thresholds,convenienceScoreBasisPoints:10001}})));
  await assert.rejects(()=>x.run(undefined,JSON.stringify({...x.policy,thresholds:{...x.policy.thresholds,preparationMinutes:null}})));
});
test('missing data does not mask an invalid actual meal or mismatched source',async()=>{
  const x=await fixture();x.facts.metrics.preparationMinutes=null;x.facts.slotId='00000000-0000-4000-8000-000000000993';
  await assert.rejects(()=>x.run(),/BINDING_MISMATCH/);
  x.facts.slotId=x.meal.mealSlotId;
  await assert.rejects(()=>assessGenerationMealWarningsRawV1(JSON.stringify(x.facts),JSON.stringify(x.policy),
    x.f.policiesRaw,x.f.contextRaw,JSON.stringify({...x.meal,digest:'a'.repeat(64)})));
});
test('preparer port computes fresh sources, propagates failures and never caches revoked/missing data',async()=>{
  const x=await fixture();let available=true;let calls=0;let failure=false;
  const port=createAssessedGenerationWarningPortV1({async loadAssessmentInputsRaw(...args){
    calls++;assert.deepEqual(args,[x.facts.requestOperationId,x.facts.slotId,x.facts.mealSnapshotDigest,
      x.facts.validationEvidenceDigest,x.facts.validationPoliciesDigest]);
    if(failure)throw Error('source unavailable');if(!available)return null;
    return JSON.stringify({factsRaw:JSON.stringify(x.facts),assessmentPolicyRaw:JSON.stringify(x.policy),
      policiesRaw:x.f.policiesRaw,trustedContextRaw:x.f.contextRaw,mealSnapshotRaw:JSON.stringify(x.meal)});
  }});
  const run=()=>port.loadMealWarningRaw(x.f.context.input.operation.requestId,x.meal.mealSlotId,x.meal.digest,x.f.evidence.digest,x.f.policies.digest);
  assert.equal(typeof await run(),'string');available=false;assert.equal(await run(),null);
  available=true;x.facts.metrics.preparationMinutes=null;assert.equal(await run(),null);
  failure=true;await assert.rejects(run,/source unavailable/);assert.equal(calls,4);
});
test('preparer port rejects a complete self-consistent source returned for a different lookup',async()=>{
  const x=await fixture();
  const port=createAssessedGenerationWarningPortV1({async loadAssessmentInputsRaw(){
    return JSON.stringify({factsRaw:JSON.stringify(x.facts),assessmentPolicyRaw:JSON.stringify(x.policy),
      policiesRaw:x.f.policiesRaw,trustedContextRaw:x.f.contextRaw,mealSnapshotRaw:JSON.stringify(x.meal)});
  }});
  await assert.rejects(()=>port.loadMealWarningRaw('00000000-0000-4000-8000-000000000993',x.meal.mealSlotId,
    x.meal.digest,x.f.evidence.digest,x.f.policies.digest),/LOOKUP_MISMATCH/);
});
