import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {createValidatedGenerationProposalV1,projectGenerationWeekRawV1,generationDecisionTraceContractV1} from '../generationPlanProposalV1';
import {generationMenuCandidateSourceContractV1} from '../generationMenuCandidatesV1';
import {createGenerationDayOptionsV1} from '../generationDayOptionsV1';
import {generationValidationAuthorityContractV1} from '../generationValidationAdapterV1';
import {fullFixture,fixtureWeekValidationInput,resignEntry,id,type FullFixture} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import {validateGeneratedWeekPlanTrustedV1} from '../../utils/trustedGeneratedWeekValidatorV1';
const hash=(raw:string)=>createHash('sha256').update(raw,'utf8').digest('hex');
const week=(f:FullFixture)=>JSON.stringify(fixtureWeekValidationInput(f));
function trace(f:FullFixture){return {contract:generationDecisionTraceContractV1,requestOperationId:f.context.input.operation.requestId,
  weekRawSha256:hash(week(f)),slots:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,generatorDecisionEvidence:s.generatorDecisionEvidence}))),
  weekOptimizationResultDigest:f.plan.graph.weekOptimizationResultDigest};}
function source(f:FullFixture){return JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId:f.context.input.operation.requestId,
  contextRaw:f.contextRaw,policiesRaw:f.policiesRaw,goalProfile:'MAINTENANCE',slotRevisions:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,mealSnapshotRevision:s.mealSnapshotRevision})))});}
async function harness(f:FullFixture,options:{sourceMissing?:boolean;warningMissing?:boolean;traceMissing?:boolean;authorityMissing?:boolean;independent?:FullFixture}={}){
  const warning=(slot:string,digest:string)=>JSON.stringify(resignEntry({...f.set.entries[0],slotId:slot,mealSnapshotDigest:digest}));
  // Pin the actual producer's raw serialization, not an equivalent test DTO with different key order.
  const seed=await createGenerationDayOptionsV1({async loadPreparationRaw(){return source(f);}},
    {async loadMealWarningRaw(_request,slot,digest){return warning(slot,digest);}}).generate(f.context.input.operation.requestId);
  const pinnedWeek=seed.status==='FEASIBLE_PROPOSAL'?seed.week.weekRaw:week(f);
  const pinnedTrace={...trace(f),weekRawSha256:hash(pinnedWeek)};
  const expected=await projectGenerationWeekRawV1(f.context.input.operation.requestId,pinnedWeek,f.contextRaw,JSON.stringify(pinnedTrace));
  const calls={source:0,warning:0,trace:0,authority:0};
  const pipeline=createValidatedGenerationProposalV1({async loadPreparationRaw(){calls.source++;return options.sourceMissing?null:source(f);}},
    {async loadMealWarningRaw(request,slot,digest){calls.warning++;assert.equal(request,f.context.input.operation.requestId);
      return options.warningMissing?null:warning(slot,digest);}},
    {async loadDecisionTraceRaw(request,digest){calls.trace++;assert.equal(request,f.context.input.operation.requestId);assert.equal(digest,hash(pinnedWeek));
      return options.traceMissing?null:JSON.stringify(pinnedTrace);}},
    {async loadForProposalRaw(request,digest){calls.authority++;
      if(options.authorityMissing)return null;
      assert.equal(expected.status,'PROJECTED');if(expected.status!=='PROJECTED')throw Error('invalid_fixture');
      assert.equal(digest,hash(expected.generatedPlanRaw));
      const a=options.independent??f;
      return JSON.stringify({contract:generationValidationAuthorityContractV1,requestOperationId:request,accountId:a.context.input.accountId,
        generationInputDigest:a.evidence.generationInputDigest,evaluatedPlanRawSha256:digest,
        trustedContextRaw:a.contextRaw,pinnedPoliciesRaw:a.policiesRaw,pinnedWarningEvidenceRaw:a.warningRaw});}});
  return {calls,pipeline,run:()=>pipeline.generate(f.context.input.operation.requestId)};
}
test('projects chosen meals into the existing Graph V2 and passes the real independent validator',async()=>{
  const f=await fullFixture();const p=await projectGenerationWeekRawV1(f.context.input.operation.requestId,week(f),f.contextRaw,JSON.stringify(trace(f)));
  assert.equal(p.status,'PROJECTED');if(p.status!=='PROJECTED')return;
  assert.deepEqual(JSON.parse(p.generatedPlanRaw),f.plan);
  assert.equal((await validateGeneratedWeekPlanTrustedV1(p.generatedPlanRaw,f.policiesRaw,f.contextRaw,f.warningRaw)).status,'ACCEPTED');
  assert.deepEqual(JSON.parse(p.generatedPlanRaw).facts,[]);
});
test('connects actual catalog/day/week selection, projection and request-bound independent validation',async()=>{
  const f=await fullFixture();const h=await harness(f);const r=await h.run();
  assert.equal(r.status,'VALIDATED_PROPOSAL');if(r.status!=='VALIDATED_PROPOSAL')return;
  assert.equal(r.requestOperationId,f.context.input.operation.requestId);assert.deepEqual(JSON.parse(r.generatedPlanRaw),f.plan);
  assert.equal(r.proposalRawSha256,hash(r.generatedPlanRaw));assert.equal(r.validation.status,'ACCEPTED');
  assert.deepEqual(h.calls,{source:1,warning:7,trace:1,authority:1});
  assert.equal(Object.isFrozen(r),true);assert.equal('recordReceipt' in r,false);assert.equal('active' in r,false);
  assert.deepEqual(await h.run(),r);assert.equal(h.calls.source,2); // no cross-request source cache
});
test('missing source or warnings stop before trace, projection and validation',async()=>{
  for(const options of [{sourceMissing:true},{warningMissing:true}]){
    const h=await harness(await fullFixture(),options);const r=await h.run();
    assert.equal(r.status,'PREPARATION_STOPPED');assert.equal('generatedPlanRaw' in r,false);
    assert.equal(h.calls.trace,0);assert.equal(h.calls.authority,0);
  }
});
test('known servings with unknown cooked yield survive selection, projection and independent validation',async()=>{
  const f=await fullFixture(s=>{for(const entry of s.context.manifest.entries)entry.recipeSnapshot.baseYield.totalYieldGrams=null;});
  const h=await harness(f);const result=await h.run();assert.equal(result.status,'VALIDATED_PROPOSAL');
  if(result.status!=='VALIDATED_PROPOSAL')return;
  const plan=JSON.parse(result.generatedPlanRaw);
  for(const day of plan.graph.days)for(const slot of day.slots)for(const component of slot.mealSnapshot.components){
    assert.equal(component.recipe.baseYield.totalYieldGrams,null);assert.equal(component.assignedPortion.assignedGrams,null);
    assert.equal(component.assignedPortion.assignedServings,'1.000');
  }
});
test('infeasible weekly pool never becomes a projected plan',async()=>{
  const f=await fullFixture(state=>{for(const entry of state.context.manifest.entries)entry.repeatFamily='same';});
  const h=await harness(f);const r=await h.run();assert.equal(r.status,'PREPARATION_STOPPED');
  if(r.status==='PREPARATION_STOPPED')assert.equal(r.reason,'NO_FEASIBLE_WEEK_IN_POOL');
  assert.equal(h.calls.trace,0);assert.equal(h.calls.authority,0);assert.equal('generatedPlanRaw' in r,false);
});
test('missing decision trace does not mint optimization digests or call independent validation',async()=>{
  const h=await harness(await fullFixture(),{traceMissing:true});assert.equal((await h.run()).status,'BLOCKED_DECISION_TRACE');assert.equal(h.calls.authority,0);
});
test('missing independent authority withholds the proposal result',async()=>{
  const h=await harness(await fullFixture(),{authorityMissing:true});const r=await h.run();assert.equal(r.status,'VALIDATION_STOPPED');assert.equal('generatedPlanRaw' in r,false);
});
test('independent constraints can reject a week that passed generator-side preparation',async()=>{
  const f=await fullFixture();const independent=await fullFixture(s=>{s.evidence.distributionPolicy.days[0].requirements[0].produceRequired=true;});
  const h=await harness(f,{independent});const r=await h.run();assert.equal(h.calls.authority,1);assert.equal(r.status,'VALIDATION_STOPPED');
  if(r.status==='VALIDATION_STOPPED')assert.equal(r.reason,'REJECTED');assert.equal('generatedPlanRaw' in r,false);
});
test('trace must bind this request and exact selected week bytes',async()=>{
  const f=await fullFixture();const t=trace(f);
  await assert.rejects(projectGenerationWeekRawV1(id(999),week(f),f.contextRaw,JSON.stringify(t)),/PROJECTION_REQUEST_MISMATCH/);
  await assert.rejects(projectGenerationWeekRawV1(t.requestOperationId,week(f)+' ',f.contextRaw,JSON.stringify(t)),/PROJECTION_WEEK_TRACE_MISMATCH/);
});
test('partial, repeated or foreign trace slots cannot cover the selected week',async()=>{
  const f=await fullFixture();
  for(const mode of ['missing','duplicate','foreign']){
    const t=trace(f);if(mode==='missing')t.slots.pop();else if(mode==='duplicate')t.slots[1]=t.slots[0];else t.slots[0].slotId=id(999);
    await assert.rejects(projectGenerationWeekRawV1(t.requestOperationId,week(f),f.contextRaw,JSON.stringify(t)));
  }
});
test('duplicate raw keys and fabricated decision revision bindings fail closed',async()=>{
  const f=await fullFixture();const t=trace(f);
  await assert.rejects(projectGenerationWeekRawV1(t.requestOperationId,week(f),f.contextRaw,'{"contract":"a","contract":"b"}'));
  t.slots[0].generatorDecisionEvidence={...t.slots[0].generatorDecisionEvidence,generationPolicyRevision:id(999)};
  await assert.rejects(projectGenerationWeekRawV1(t.requestOperationId,week(f),f.contextRaw,JSON.stringify(t)),/revision_binding_mismatch/);
});
