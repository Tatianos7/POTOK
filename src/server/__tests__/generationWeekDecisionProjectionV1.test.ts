import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {createWeekDecisionProjectionPortV1,projectGenerationWeekDecisionsRawV1} from '../generationWeekDecisionProjectionV1';
import {createConvenienceBoundedGenerationSelectionV1,createOptimizedGenerationSelectionV1,createGenerationSelectionV1} from '../generationDayOptionsV1';
import {createConvenienceBoundedGenerationWorkerBindingsV1} from '../generationWorkerBindingsV1';
import {generationMenuCandidateSourceContractV1} from '../generationMenuCandidatesV1';
import {generationValidationAuthorityContractV1,type GenerationValidationAuthorityPortV1} from '../generationValidationAdapterV1';
import {createGenerationWeekMetricProducerV1,generationWeekMetricPolicyContractV1,generationWeekConvenienceContractV1} from '../generationWeekMetricProducerV1';
import {generationPreparationContextFixtureV1} from './generationPreparationSqlFixturesV1';
import {optimizationPolicyContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {adaptiveNutritionCandidateManifestCanonicalBytesV2} from '../../utils/adaptiveNutritionAuthoritiesV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {fullFixture,resignEntry,id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
const canonical=(v:unknown)=>canonicalJsonV1(v,'SAFE_INTEGER');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
async function fixture(known=false){
  const f=await fullFixture(s=>{for(const e of s.context.manifest.entries)e.recipeSnapshot.baseYield.totalYieldGrams=null;});
  const request=f.context.input.operation.requestId,contextRaw=await generationPreparationContextFixtureV1(f);
  const source={async loadPreparationRaw(){return JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId:request,
    contextRaw:f.contextRaw,policiesRaw:f.policiesRaw,goalProfile:'MAINTENANCE',slotRevisions:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({
      slotId:s.slotId,mealSnapshotRevision:s.mealSnapshotRevision})))});}};
  const warnings={async loadMealWarningRaw(_r:string,slotId:string,mealSnapshotDigest:string){return JSON.stringify(resignEntry({...f.set.entries[0],slotId,mealSnapshotDigest}));}};
  const metricPolicy=JSON.stringify({contract:generationWeekMetricPolicyContractV1,metricPolicyRevision:id(991),optimizationPolicyRevision:f.context.input.optimizationPolicyRevision,
    targetFit:'MEAN_DAILY_CALORIE_FIT_V1',diversity:'UNIQUE_RECIPE_MEAL_SHARE_V1',shoppingReuse:'CANONICAL_FOOD_MEAL_REUSE_SHARE_V1',convenience:'INDEPENDENT_WEEK_CONVENIENCE_V1'});
  const metrics=createGenerationWeekMetricProducerV1({async loadContextRaw(){return contextRaw;}},metricPolicy,known?{
    async loadConvenienceRaw(r,sha,digest,rev){return JSON.stringify({contract:generationWeekConvenienceContractV1,requestOperationId:r,
      weekRawSha256:sha,generationInputDigest:digest,metricPolicyRevision:rev,sourceRevision:id(992),score:'0.750'});}
  }:null);
  const optimization={policyRaw:JSON.stringify({contract:optimizationPolicyContractV1,policyRevision:f.context.input.optimizationPolicyRevision,
    weights:{targetFit:'0.400',diversity:'0.250',convenience:'0.200',shoppingReuse:'0.150'}}),metrics};
  const engine=known?createOptimizedGenerationSelectionV1(source,warnings,optimization):createConvenienceBoundedGenerationSelectionV1(source,warnings,optimization);
  const result=await engine.generate(request);if(result.status!=='FEASIBLE_PROPOSAL')throw Error('fixture');
  const run=(raw=result.selectionReceiptRaw)=>projectGenerationWeekDecisionsRawV1(request,result.week.weekRaw,raw,f.contextRaw);
  return {f,request,source,warnings,optimization,result,run};
}
function resignSelection(receipt:Record<string,unknown>){
  const {digest,...content}=receipt;void digest;
  receipt.digest=hash(canonical({contract:receipt.contract,encoding:receipt.contract==='potok-generation-selection-receipt-v3'
    ?'potok-generation-selection-receipt-canonical-json-v3':'potok-generation-selection-receipt-canonical-json-v2',receipt:content}));
  return JSON.stringify(receipt);
}
test('actual strict and bounded week results produce deterministic slot projection receipts, not fixture optimization hashes',async()=>{
  for(const known of [false,true]){
    const x=await fixture(known),projected=await x.run(),trace=JSON.parse(projected.traceRaw);
    assert.deepEqual(await x.run(),projected);assert.equal(projected.slotDecisionReceiptsRaw.length,7);
    assert.equal(trace.weekRawSha256,hash(x.result.week.weekRaw));
    assert.equal(trace.weekOptimizationResultDigest,JSON.parse(x.result.selectionReceiptRaw).weekOptimizationResultDigest);
    for(const raw of projected.slotDecisionReceiptsRaw){
      const {digest,...content}=JSON.parse(raw);assert.equal(content.scope,'PROJECTED_FROM_WEEK_COMPARISON');
      assert.equal(digest,hash(canonical({contract:content.contract,encoding:'potok-generation-slot-week-decision-canonical-json-v1',decision:content})));
      const slot=trace.slots.find((s:{slotId:string})=>s.slotId===content.slotId);
      assert.equal(slot.generatorDecisionEvidence.optimizationResultDigest,content.weekOptimizationResultDigest);
      assert.notEqual(slot.generatorDecisionEvidence.optimizationResultDigest,digest);
      assert.equal(slot.generatorDecisionEvidence.selectedCandidateDigest,content.selectedCandidateDigest);
      assert.notEqual(digest,x.f.plan.graph.days[0].slots[0].generatorDecisionEvidence.optimizationResultDigest);
    }
    assert.equal(await createWeekDecisionProjectionPortV1().produceDecisionTraceRaw(x.request,x.result.week.weekRaw,x.result.selectionReceiptRaw,x.f.contextRaw),projected.traceRaw);
  }
});
test('receipt, request, selected week and nested result substitutions are rejected',async()=>{
  const x=await fixture(),r=JSON.parse(x.result.selectionReceiptRaw);
  await assert.rejects(()=>x.run(JSON.stringify({...r,digest:'a'.repeat(64)})),/DIGEST_MISMATCH/);
  await assert.rejects(()=>projectGenerationWeekDecisionsRawV1(id(999),x.result.week.weekRaw,x.result.selectionReceiptRaw,x.f.contextRaw),/BINDING_MISMATCH/);
  r.weekRawSha256='b'.repeat(64);await assert.rejects(()=>x.run(resignSelection(r)),/BINDING_MISMATCH/);
  const nested=JSON.parse(x.result.selectionReceiptRaw);nested.weekOptimizationReceiptRaw=nested.weekOptimizationReceiptRaw.replace('"selectedScore":null','"selectedScore":"0.000"');
  await assert.rejects(()=>x.run(resignSelection(nested)),/DIGEST_MISMATCH/);
});
test('self-consistently rehashed pool/slot changes cannot select a different meal or omit its warning membership',async()=>{
  const x=await fixture();
  for(const mode of ['selected','pool','warning','duplicate']){
    const r=JSON.parse(x.result.selectionReceiptRaw);
    if(mode==='selected')r.selectedSlots[0].selectedCandidateDigest='a'.repeat(64);
    if(mode==='duplicate')r.selectedSlots[1]=r.selectedSlots[0];
    if(mode==='pool')r.pools[0].candidateSetDigest='b'.repeat(64);
    if(mode==='warning'){
      const p=r.pools[0];p.admittedWarnings=[];const {candidateSetDigest,...content}=p;void candidateSetDigest;
      p.candidateSetDigest=hash(canonical(content));r.selectedSlots.find((s:{slotId:string})=>s.slotId===p.slotId).candidateSetDigest=p.candidateSetDigest;
    }
    await assert.rejects(()=>x.run(resignSelection(r)),/SLOT_MISMATCH|POOL_MISMATCH|POOL_MEMBERSHIP_REQUIRED/);
  }
});
test('first-feasible receipts never become fabricated weighted optimization metadata; duplicate JSON is rejected',async()=>{
  const x=await fixture(),first=await createGenerationSelectionV1(x.source,x.warnings).generate(x.request);
  if(first.status!=='FEASIBLE_PROPOSAL')throw Error('fixture');
  await assert.rejects(()=>projectGenerationWeekDecisionsRawV1(x.request,first.week.weekRaw,first.selectionReceiptRaw,x.f.contextRaw));
  await assert.rejects(()=>x.run('{"digest":"duplicate",'+x.result.selectionReceiptRaw.slice(1)));
});
test('computed metrics and projected slot decisions reach exact-byte worker validation without per-slot decision fixtures',async()=>{
  const x=await fixture();let calls=0,revoked=false;
  const authority:GenerationValidationAuthorityPortV1={async loadForProposalRaw(r,sha){calls++;if(revoked)return null;
    return JSON.stringify({contract:generationValidationAuthorityContractV1,requestOperationId:r,accountId:x.f.context.input.accountId,
      generationInputDigest:x.f.evidence.generationInputDigest,evaluatedPlanRawSha256:sha,trustedContextRaw:x.f.contextRaw,
      pinnedPoliciesRaw:x.f.policiesRaw,pinnedWarningEvidenceRaw:x.f.warningRaw});}};
  const bindings=createConvenienceBoundedGenerationWorkerBindingsV1(x.source,x.warnings,x.optimization,createWeekDecisionProjectionPortV1(),authority);
  const input={requestOperationId:x.request,generationInputCanonicalHex:Buffer.from(canonical(x.f.context.input)).toString('hex'),
    candidateManifestCanonicalHex:Buffer.from(await adaptiveNutritionCandidateManifestCanonicalBytesV2(x.f.context.manifest)).toString('hex')};
  const proposal=await bindings.generator.generate(input);assert.deepEqual(await bindings.validator.validate({...input,...proposal}),proposal);assert.equal(calls,2);
  const plan=JSON.parse(Buffer.from(proposal.generatedWeekPlanCanonicalHex,'hex').toString('utf8'));assert.deepEqual(plan.facts,[]);
  for(const d of plan.graph.days)for(const s of d.slots)for(const c of s.mealSnapshot.components)assert.equal(c.assignedPortion.assignedGrams,null);
  revoked=true;await assert.rejects(()=>bindings.validator.validate({...input,...proposal}),/GENERATION_VALIDATION_BLOCKED/);
});
