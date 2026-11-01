import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {createGenerationSelectionV1,createGenerationDayOptionsV1,generationSelectionReceiptContractV1} from '../generationDayOptionsV1';
import {createSelectionBoundGenerationProposalV1,createOptimizedGenerationProposalV1,generationDecisionTraceContractV1,type GenerationSelectionDecisionPortV1} from '../generationPlanProposalV1';
import {createSelectionBoundGenerationWorkerBindingsV1,createOptimizedGenerationWorkerBindingsV1} from '../generationWorkerBindingsV1';
import {generationWeekMetricsContractV1,type GenerationWeekOptimizationConfigV1} from '../generationWeekOptimizationV1';
import {optimizationPolicyContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {adaptiveNutritionCandidateManifestCanonicalBytesV2} from '../../utils/adaptiveNutritionAuthoritiesV1';
import {generationMenuCandidateSourceContractV1} from '../generationMenuCandidatesV1';
import {generationValidationAuthorityContractV1,type GenerationValidationAuthorityPortV1} from '../generationValidationAdapterV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {fullFixture,resignEntry,type FullFixture} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
const hash=(raw:string)=>createHash('sha256').update(raw,'utf8').digest('hex');
function ports(f:FullFixture,knownOnly=false){
  const counts={source:0,warnings:0};
  const source={async loadPreparationRaw(){counts.source++;return JSON.stringify({
    contract:generationMenuCandidateSourceContractV1,requestOperationId:f.context.input.operation.requestId,
    contextRaw:f.contextRaw,policiesRaw:f.policiesRaw,goalProfile:'MAINTENANCE',
    slotRevisions:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,mealSnapshotRevision:s.mealSnapshotRevision})))});}};
  const warnings={async loadMealWarningRaw(_request:string,slotId:string,mealSnapshotDigest:string){
    counts.warnings++;if(knownOnly&&!f.set.entries.some(e=>e.slotId===slotId&&e.mealSnapshotDigest===mealSnapshotDigest))return null;
    return JSON.stringify(resignEntry({...f.set.entries[0],slotId,mealSnapshotDigest}));
  }};
  return {source,warnings,counts};
}
test('receipt records actual pools, selected meal identities, raw week hash and bounded search counts',async()=>{
  const f=await fullFixture(),p=ports(f),request=f.context.input.operation.requestId;
  const result=await createGenerationSelectionV1(p.source,p.warnings).generate(request);
  assert.equal(result.status,'FEASIBLE_PROPOSAL');if(result.status!=='FEASIBLE_PROPOSAL')return;
  assert.deepEqual(p.counts,{source:1,warnings:7});const r=JSON.parse(result.selectionReceiptRaw);
  assert.equal(r.contract,generationSelectionReceiptContractV1);assert.equal(r.requestOperationId,request);
  assert.equal(r.generationInputDigest,f.evidence.generationInputDigest);assert.equal(r.candidateManifestDigest,f.context.manifest.digest);
  assert.equal(r.weekRawSha256,hash(result.week.weekRaw));assert.equal(r.weekValidationResultDigest,result.week.validation.subjectDigest);
  assert.equal(r.scope,'BOUNDED_FIRST_FEASIBLE');assert.equal(r.warningCoverage,'COMPLETE');
  assert.equal(r.evaluated,result.week.evaluated);assert.equal(r.totalCombinations,result.week.totalCombinations);
  assert.deepEqual(r.optionIndexes,result.week.optionIndexes);assert.equal(r.selectedSlots.length,7);
  for(const slot of r.selectedSlots){
    const pool=r.pools.find((v:{slotId:string})=>v.slotId===slot.slotId);
    assert.ok(pool.candidates.some((v:{mealSnapshotDigest:string})=>v.mealSnapshotDigest===slot.selectedCandidateDigest));
    assert.equal(pool.candidateSetDigest,slot.candidateSetDigest);
    const {candidateSetDigest,...content}=pool;assert.equal(candidateSetDigest,hash(canonicalJsonV1(content,'SAFE_INTEGER')));
  }
  const {digest,...content}=r;assert.equal(digest,hash(canonicalJsonV1({contract:generationSelectionReceiptContractV1,
    encoding:'potok-generation-selection-receipt-canonical-json-v1',receipt:content},'SAFE_INTEGER')));
  assert.equal('weekOptimizationResultDigest' in r,false);assert.equal('optimal' in r,false);
  const legacy=await createGenerationDayOptionsV1(p.source,p.warnings).generate(request);
  assert.equal('selectionReceiptRaw' in legacy,false);
  if(legacy.status==='FEASIBLE_PROPOSAL')assert.equal(legacy.week.weekRaw,result.week.weekRaw);
});
test('partial warning coverage is explicit and changes pool bindings without changing selected meals',async()=>{
  const f=await fullFixture(s=>{
    s.context.input.goalNutritionTarget.calories={min:'100.000',target:'150.000',max:'400.000'};
    for(const d of s.evidence.distributionPolicy.days)for(const b of [...d.nutritionBounds,...d.distributionBounds])
      b.bounds.maximum={calories:'200.000',protein:'20.000',fat:'10.000',carbs:'20.000',fiber:'4.000'};
  });
  const partial=ports(f,true),complete=ports(f),request=f.context.input.operation.requestId;
  const a=await createGenerationSelectionV1(partial.source,partial.warnings).generate(request);
  const b=await createGenerationSelectionV1(complete.source,complete.warnings).generate(request);
  assert.equal(a.status,'FEASIBLE_PROPOSAL');assert.equal(b.status,'FEASIBLE_PROPOSAL');
  if(a.status!=='FEASIBLE_PROPOSAL'||b.status!=='FEASIBLE_PROPOSAL')return;
  const r=JSON.parse(a.selectionReceiptRaw),s=JSON.parse(b.selectionReceiptRaw);
  assert.equal(r.warningCoverage,'PARTIAL');assert.equal(s.warningCoverage,'COMPLETE');
  assert.ok(r.pools.every((p:{candidates:unknown[];admittedWarnings:unknown[]})=>p.candidates.length===2&&p.admittedWarnings.length===1));
  assert.equal(a.week.weekRaw,b.week.weekRaw);assert.notEqual(r.pools[0].candidateSetDigest,s.pools[0].candidateSetDigest);
  assert.equal(s.totalCombinations,128);assert.equal(s.evaluated,1);
});
test('receipts are deterministic, fresh and sensitive to actual configured search limits',async()=>{
  const f=await fullFixture(),p=ports(f),g=createGenerationSelectionV1(p.source,p.warnings),request=f.context.input.operation.requestId;
  const a=await g.generate(request),b=await g.generate(request);
  assert.deepEqual(a,b);assert.deepEqual(p.counts,{source:2,warnings:14});
  const c=await g.generate(request,'{"maxDayEvaluations":10,"maxWeekEvaluations":10}');
  if(a.status!=='FEASIBLE_PROPOSAL'||c.status!=='FEASIBLE_PROPOSAL')throw Error('fixture');
  assert.equal(a.week.weekRaw,c.week.weekRaw);assert.notEqual(a.selectionReceiptRaw,c.selectionReceiptRaw);
});
async function pipelineFixture(optimized=false){
  const f=await fullFixture(),p=ports(f);let authorityCalls=0,decisionCalls=0;
  let mode='ok';
  let optimizationDigest:string|null=null;
  const optimization:GenerationWeekOptimizationConfigV1={policyRaw:JSON.stringify({contract:optimizationPolicyContractV1,
    policyRevision:f.context.input.optimizationPolicyRevision,weights:{targetFit:'0.400',diversity:'0.250',convenience:'0.200',shoppingReuse:'0.150'}}),
    metrics:{async assessWeekRaw(request,weekRaw,inputDigest){
      if(mode==='missing-metrics')return null;
      return JSON.stringify({contract:generationWeekMetricsContractV1,requestOperationId:request,generationInputDigest:inputDigest,
        weekRawSha256:hash(weekRaw),optimizationPolicyRevision:f.context.input.optimizationPolicyRevision,
        assessmentRevision:'00000000-0000-4000-8000-000000000991',
        metrics:{targetFit:'0.500',diversity:'0.500',convenience:'0.500',shoppingReuse:'0.500'}});
    }}};
  const decisions:GenerationSelectionDecisionPortV1={async produceDecisionTraceRaw(request,weekRaw,receiptRaw,contextRaw){
    decisionCalls++;assert.equal(contextRaw,f.contextRaw);const receipt=JSON.parse(receiptRaw);
    assert.equal(receipt.weekRawSha256,hash(weekRaw));assert.equal(receipt.requestOperationId,request);
    if(optimized){assert.equal(typeof receipt.weekOptimizationResultDigest,'string');optimizationDigest=receipt.weekOptimizationResultDigest;}
    if(mode==='missing')return null;
    // Optimization digests below are explicit synthetic fixtures only, not search receipts.
    const trace={contract:generationDecisionTraceContractV1,requestOperationId:request,weekRawSha256:hash(weekRaw),
      slots:receipt.selectedSlots.map((s:{slotId:string;sourceKind:string;candidateSetDigest:string;selectedCandidateDigest:string})=>({
        slotId:s.slotId,generatorDecisionEvidence:{...f.plan.graph.days[0].slots[0].generatorDecisionEvidence,
          decisionPath:s.sourceKind,candidateSetDigest:s.candidateSetDigest,selectedCandidateDigest:s.selectedCandidateDigest}})),
      weekOptimizationResultDigest:optimized?receipt.weekOptimizationResultDigest:f.plan.graph.weekOptimizationResultDigest};
    if(mode==='pool')trace.slots[0].generatorDecisionEvidence.candidateSetDigest='a'.repeat(64);
    if(mode==='meal')trace.slots[0].generatorDecisionEvidence.selectedCandidateDigest='b'.repeat(64);
    if(mode==='path')trace.slots[0].generatorDecisionEvidence.decisionPath='COMPOSED_MEAL';
    if(mode==='duplicate')trace.slots[1]=trace.slots[0];
    if(mode==='week')trace.weekRawSha256='c'.repeat(64);
    if(mode==='request')trace.requestOperationId='00000000-0000-4000-8000-000000000999';
    if(mode==='optimization')trace.weekOptimizationResultDigest='d'.repeat(64);
    return JSON.stringify(trace);
  }};
  const authority:GenerationValidationAuthorityPortV1={async loadForProposalRaw(request,sha){
    authorityCalls++;if(mode==='revoked')return null;
    return JSON.stringify({contract:generationValidationAuthorityContractV1,requestOperationId:request,accountId:f.context.input.accountId,
      generationInputDigest:f.evidence.generationInputDigest,evaluatedPlanRawSha256:sha,trustedContextRaw:f.contextRaw,
      pinnedPoliciesRaw:f.policiesRaw,pinnedWarningEvidenceRaw:f.warningRaw});
  }};
  const pipeline=optimized?createOptimizedGenerationProposalV1(p.source,p.warnings,optimization,decisions,authority)
    :createSelectionBoundGenerationProposalV1(p.source,p.warnings,decisions,authority);
  return {f,p,decisions,authority,optimization,optimizationDigest:()=>optimizationDigest,
    run:()=>pipeline.generate(f.context.input.operation.requestId),set:(v:string)=>{mode=v;},
    counts:()=>({authorityCalls,decisionCalls})};
}
test('selection-bound pipeline receives actual selection and preserves independent final validation',async()=>{
  const x=await pipelineFixture(),result=await x.run();assert.equal(result.status,'VALIDATED_PROPOSAL');
  assert.deepEqual(x.counts(),{authorityCalls:1,decisionCalls:1});
  if(result.status==='VALIDATED_PROPOSAL'){
    const plan=JSON.parse(result.generatedPlanRaw);assert.deepEqual(plan.facts,[]);assert.equal(result.validation.status,'ACCEPTED');
    for(const d of plan.graph.days)for(const s of d.slots)assert.equal(s.generatorDecisionEvidence.selectedCandidateDigest,s.mealSnapshot.digest);
  }
});
test('selection-bound worker bindings keep exact validated bytes and independently recheck before recording',async()=>{
  const x=await pipelineFixture();
  const bindings=createSelectionBoundGenerationWorkerBindingsV1(x.p.source,x.p.warnings,x.decisions,x.authority);
  const value={requestOperationId:x.f.context.input.operation.requestId,
    generationInputCanonicalHex:Buffer.from(canonicalJsonV1(x.f.context.input,'SAFE_INTEGER')).toString('hex'),
    candidateManifestCanonicalHex:Buffer.from(await adaptiveNutritionCandidateManifestCanonicalBytesV2(x.f.context.manifest)).toString('hex')};
  const proposal=await bindings.generator.generate(value);
  assert.deepEqual(await bindings.validator.validate({...value,...proposal}),proposal);
  assert.deepEqual(x.counts(),{authorityCalls:2,decisionCalls:1});
  x.set('revoked');await assert.rejects(()=>bindings.validator.validate({...value,...proposal}),/GENERATION_VALIDATION_BLOCKED/);
  assert.equal(x.counts().authorityCalls,3);
});
test('different candidate pools/meals/path, duplicate slots and replayed request/week abort before authority',async()=>{
  const x=await pipelineFixture();
  for(const mode of ['pool','meal','path','duplicate','week','request']){x.set(mode);await assert.rejects(x.run,/SELECTION_DECISION/);}
  assert.equal(x.counts().authorityCalls,0);
});
test('missing decision evidence and revoked final authority withhold the plan',async()=>{
  const x=await pipelineFixture();x.set('missing');assert.equal((await x.run()).status,'BLOCKED_DECISION_TRACE');
  assert.equal(x.counts().authorityCalls,0);x.set('revoked');const result=await x.run();
  assert.equal(result.status,'VALIDATION_STOPPED');assert.equal('generatedPlanRaw' in result,false);
});
test('blocked preparation exposes no selection receipt and never calls the decision producer',async()=>{
  const f=await fullFixture(),p=ports(f);let calls=0;
  const result=await createGenerationSelectionV1({async loadPreparationRaw(){return null;}},p.warnings).generate(f.context.input.operation.requestId);
  assert.equal(result.status,'BLOCKED_SOURCE_MISSING');assert.equal('selectionReceiptRaw' in result,false);
  const pipeline=createSelectionBoundGenerationProposalV1(p.source,{async loadMealWarningRaw(){return null;}},
    {async produceDecisionTraceRaw(){calls++;return null;}},{async loadForProposalRaw(){throw Error('unexpected authority');}});
  assert.equal((await pipeline.generate(f.context.input.operation.requestId)).status,'PREPARATION_STOPPED');assert.equal(calls,0);
});
test('weighted proposal carries the computed week optimization digest through independent validation',async()=>{
  const x=await pipelineFixture(true),result=await x.run();assert.equal(result.status,'VALIDATED_PROPOSAL');
  if(result.status==='VALIDATED_PROPOSAL')assert.equal(JSON.parse(result.generatedPlanRaw).graph.weekOptimizationResultDigest,x.optimizationDigest());
  x.set('optimization');await assert.rejects(x.run,/SELECTION_DECISION_TRACE_MISMATCH/);
  assert.equal(x.counts().authorityCalls,1);
});
test('weighted worker retains fresh byte-exact validation and blocks missing metrics before trace production',async()=>{
  const x=await pipelineFixture(true);
  const bindings=createOptimizedGenerationWorkerBindingsV1(x.p.source,x.p.warnings,x.optimization,x.decisions,x.authority);
  const value={requestOperationId:x.f.context.input.operation.requestId,
    generationInputCanonicalHex:Buffer.from(canonicalJsonV1(x.f.context.input,'SAFE_INTEGER')).toString('hex'),
    candidateManifestCanonicalHex:Buffer.from(await adaptiveNutritionCandidateManifestCanonicalBytesV2(x.f.context.manifest)).toString('hex')};
  const proposal=await bindings.generator.generate(value);assert.deepEqual(await bindings.validator.validate({...value,...proposal}),proposal);
  assert.deepEqual(x.counts(),{authorityCalls:2,decisionCalls:1});
  x.set('missing-metrics');await assert.rejects(()=>bindings.generator.generate(value),/GENERATION_PROPOSAL_PREPARATION_STOPPED/);
  assert.deepEqual(x.counts(),{authorityCalls:2,decisionCalls:1});
});
test('explicit weighted factories reject absent configuration instead of taking the legacy first-feasible path',async()=>{
  const x=await pipelineFixture(true),invalid=null as unknown as GenerationWeekOptimizationConfigV1;
  assert.throws(()=>createOptimizedGenerationProposalV1(x.p.source,x.p.warnings,invalid,x.decisions,x.authority),/INVALID_WEEK_OPTIMIZATION_CONFIG/);
  assert.throws(()=>createOptimizedGenerationWorkerBindingsV1(x.p.source,x.p.warnings,invalid,x.decisions,x.authority),/INVALID_WEEK_OPTIMIZATION_CONFIG/);
  assert.deepEqual(x.counts(),{authorityCalls:0,decisionCalls:0});assert.equal(x.p.counts.source,0);
});
