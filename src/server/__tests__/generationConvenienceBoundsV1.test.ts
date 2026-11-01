import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {optimizeGenerationWeekRawV1,optimizeGenerationWeekWithConvenienceBoundsRawV1,
  generationWeekMetricsContractV1,type GenerationWeekMetricsPortV1} from '../generationWeekOptimizationV1';
import {generationWeekSearchContractV1} from '../generationWeekSearchV1';
import {createGenerationMenuCandidatePreparerV1,generationMenuCandidateSourceContractV1} from '../generationMenuCandidatesV1';
import {createConvenienceBoundedGenerationSelectionV1,generationSelectionReceiptContractV3} from '../generationDayOptionsV1';
import {createConvenienceBoundedGenerationWorkerBindingsV1} from '../generationWorkerBindingsV1';
import {generationDecisionTraceContractV1,type GenerationSelectionDecisionPortV1} from '../generationPlanProposalV1';
import {generationValidationAuthorityContractV1,type GenerationValidationAuthorityPortV1} from '../generationValidationAdapterV1';
import {createGenerationWeekMetricProducerV1,generationWeekMetricPolicyContractV1} from '../generationWeekMetricProducerV1';
import {generationPreparationContextFixtureV1} from './generationPreparationSqlFixturesV1';
import {optimizationPolicyContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {adaptiveNutritionCandidateManifestCanonicalBytesV2} from '../../utils/adaptiveNutritionAuthoritiesV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {fullFixture,fixtureWeekValidationInput,resignEntry,id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
const hash=(raw:string)=>createHash('sha256').update(raw).digest('hex');
const weights={targetFit:'0.400',diversity:'0.250',convenience:'0.200',shoppingReuse:'0.150'};
async function fixture(withWarnings=false){
  const f=await fullFixture(s=>{
    s.context.input.goalNutritionTarget.calories={min:'100.000',target:'150.000',max:'400.000'};
    if(withWarnings){s.balance.policy.allowedWarningCodes.push('LONG_PREPARATION_BURDEN');s.balance.policy.allowedWarningCodes.sort();}
    for(const d of s.evidence.distributionPolicy.days)for(const b of [...d.nutritionBounds,...d.distributionBounds])
      b.bounds.maximum={calories:'200.000',protein:'20.000',fat:'10.000',carbs:'20.000',fiber:'4.000'};
  });
  const sourceRaw=JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId:f.context.input.operation.requestId,
    contextRaw:f.contextRaw,policiesRaw:f.policiesRaw,goalProfile:'MAINTENANCE',
    slotRevisions:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,mealSnapshotRevision:s.mealSnapshotRevision})))});
  const prepared=await createGenerationMenuCandidatePreparerV1({async loadPreparationRaw(){return sourceRaw;}}).prepare(f.context.input.operation.requestId);
  if(prepared.status!=='PREPARED')throw Error('fixture');
  const {days,...weekHeader}=fixtureWeekValidationInput(f),alternative=structuredClone(days[6]);
  alternative.meals[0].validationInput.meal=prepared.slots[6].meals[1].meal;
  const search={contract:generationWeekSearchContractV1,weekHeader,dayOptions:days.map(d=>[d]),maxEvaluations:16};search.dayOptions[6].push(alternative);
  const policyRaw=JSON.stringify({contract:optimizationPolicyContractV1,policyRevision:f.context.input.optimizationPolicyRevision,weights});
  let mode='dominant',calls=0;const endpoints:[string|null,string|null]=[null,null];
  const rawWeek=(last:number)=>JSON.stringify({...weekHeader,days:search.dayOptions.map((p,i)=>p[i===6?last:0])});
  const hashes=[hash(rawWeek(0)),hash(rawWeek(1))];
  const metrics:GenerationWeekMetricsPortV1={async assessWeekRaw(request,weekRaw,inputDigest){
    calls++;const high=JSON.parse(weekRaw).days[6].meals[0].validationInput.meal.nutrition.calories==='200.000',index=high?1:0;
    const value=mode==='overlap'?(high?'0.600':'0.500'):mode==='known'?(high?'0.800':'0.200'):high?'1.000':'0.000';
    const values:Record<string,unknown>={targetFit:value,diversity:value,shoppingReuse:value,convenience:mode==='known'?'0.500':endpoints[index]};
    if(mode==='tie-safe'||mode==='tie-unsafe'){
      const lowerHashIndex=hashes[0]<hashes[1]?0:1;
      const favored=mode==='tie-safe'?lowerHashIndex:1-lowerHashIndex;
      values.targetFit=index===favored?'0.500':'0.000';values.diversity='0.000';values.shoppingReuse='0.000';
    }
    if(mode==='missing-other')values.targetFit=null;
    if(mode==='bad')values.convenience='1.001';
    if(mode==='drift')values.convenience=calls===1?null:'0.000';
    if(mode==='missing-source')return null;
    return JSON.stringify({contract:generationWeekMetricsContractV1,requestOperationId:request,generationInputDigest:inputDigest,
      weekRawSha256:hash(weekRaw),optimizationPolicyRevision:f.context.input.optimizationPolicyRevision,assessmentRevision:id(993),metrics:values});
  }};
  const args=()=>[JSON.stringify(search),f.rawContext.candidateManifestRaw,policyRaw,JSON.stringify(f.context.input),metrics] as const;
  return {f,search,hashes,calls:()=>calls,set:(v:string)=>{mode=v;},endpoint:(a:string|null,b:string|null)=>{endpoints[0]=a;endpoints[1]=b;},
    run:()=>optimizeGenerationWeekWithConvenienceBoundsRawV1(...args()),strict:()=>optimizeGenerationWeekRawV1(...args())};
}
test('unknown convenience stays unknown while interval dominance proves a later winner with unchanged weights',async()=>{
  const x=await fixture(),result=await x.run();assert.equal(result.status,'FEASIBLE_PROPOSAL');if(result.status!=='FEASIBLE_PROPOSAL')return;
  assert.equal(result.optionIndexes[6],1);assert.equal(result.score,null);
  assert.deepEqual(result.scoreBounds,{minimum:'0.800',maximum:'1.000'});assert.deepEqual(result.unknownMetrics,['convenience']);
  const r=JSON.parse(result.optimizationReceiptRaw);assert.deepEqual(r.optimizationPolicy.weights,weights);
  assert.equal(r.selectedScore,null);assert.equal(r.comparison,'ROBUST_CONVENIENCE_BOUNDS');
  assert.ok(r.evaluations.every((e:{score:unknown;unknownMetrics:string[]})=>e.score===null&&e.unknownMetrics[0]==='convenience'));
  x.endpoint('1.000',null);const unknownWinner=await x.run();
  assert.equal(unknownWinner.status,'FEASIBLE_PROPOSAL');if(unknownWinner.status==='FEASIBLE_PROPOSAL')assert.equal(unknownWinner.score,null);
  x.endpoint(null,'0.000');const knownWinner=await x.run();
  assert.equal(knownWinner.status,'FEASIBLE_PROPOSAL');if(knownWinner.status==='FEASIBLE_PROPOSAL'){
    assert.equal(knownWinner.score,'0.800');assert.deepEqual(knownWinner.unknownMetrics,[]);
  }
  for(const a of ['0.000','1.000'])for(const b of ['0.000','1.000']){
    x.endpoint(a,b);const exact=await x.strict();assert.equal(exact.status,'FEASIBLE_PROPOSAL');
    if(exact.status==='FEASIBLE_PROPOSAL')assert.equal(exact.weekRaw,result.weekRaw);
  }
});
test('existing valid-before-warnings priority is retained even across disjoint score intervals',async()=>{
  const x=await fixture(true),meal=x.search.dayOptions[6][1].meals[0];
  meal.validationInput.warningSignals={...meal.validationInput.warningSignals,longPreparationBurden:true};
  const result=await x.run();assert.equal(result.status,'FEASIBLE_PROPOSAL');
  if(result.status==='FEASIBLE_PROPOSAL'){assert.equal(result.optionIndexes[6],0);assert.equal(result.validation.status,'VALID');}
});
test('later missing hard evidence still withholds an earlier feasible candidate',async()=>{
  const x=await fixture();x.search.dayOptions[6][1].goalTarget=null as unknown as typeof x.search.dayOptions[6][1]['goalTarget'];
  const result=await x.run();assert.equal(result.status,'BLOCKED_MISSING_EVIDENCE');assert.equal('weekRaw' in result,false);
});
test('contradictory assessments for a duplicate week abort instead of resolving uncertainty optimistically',async()=>{
  const x=await fixture();x.search.dayOptions[6][1]=structuredClone(x.search.dayOptions[6][0]);x.set('drift');
  await assert.rejects(x.run,/METRICS_DRIFT/);
});
test('overlapping intervals withhold a winner; a higher lower bound is not itself proof',async()=>{
  const x=await fixture();x.set('overlap');const result=await x.run();
  assert.equal(result.status,'BLOCKED_OPTIMIZATION_UNCERTAINTY');assert.equal('weekRaw' in result,false);
  assert.equal(result.evaluated,2);assert.equal(result.totalCombinations,2);
});
test('touching interval endpoints respect the exact existing SHA tie break',async()=>{
  const x=await fixture();x.set('tie-safe');const safe=await x.run();assert.equal(safe.status,'FEASIBLE_PROPOSAL');
  if(safe.status==='FEASIBLE_PROPOSAL')assert.equal(hash(safe.weekRaw),[...x.hashes].sort()[0]);
  x.set('tie-unsafe');assert.equal((await x.run()).status,'BLOCKED_OPTIMIZATION_UNCERTAINTY');
});
test('a single feasible prefix can win without an invented score; scope never expands beyond its budget',async()=>{
  const x=await fixture();x.search.maxEvaluations=1;const result=await x.run();
  assert.equal(result.status,'FEASIBLE_PROPOSAL');if(result.status!=='FEASIBLE_PROPOSAL')return;
  assert.equal(result.scope,'BEST_EVALUATED_PREFIX');assert.equal(result.totalCombinations,2);assert.equal(result.evaluated,1);
  assert.equal(result.score,null);assert.deepEqual(result.scoreBounds,{minimum:'0.000',maximum:'0.200'});
});
test('known metrics agree with strict optimization and missing other metrics still block',async()=>{
  const x=await fixture();x.set('known');const bounded=await x.run(),strict=await x.strict();
  assert.equal(bounded.status,'FEASIBLE_PROPOSAL');assert.equal(strict.status,'FEASIBLE_PROPOSAL');
  if(bounded.status!=='FEASIBLE_PROPOSAL'||strict.status!=='FEASIBLE_PROPOSAL')return;
  assert.equal(bounded.weekRaw,strict.weekRaw);assert.equal(bounded.score,strict.score);
  assert.deepEqual(bounded.scoreBounds,{minimum:strict.score,maximum:strict.score});assert.deepEqual(bounded.unknownMetrics,[]);
  for(const mode of ['missing-other','missing-source']){x.set(mode);assert.equal((await x.run()).status,'BLOCKED_OPTIMIZATION_METRICS');}
  x.set('bad');await assert.rejects(x.run,/INVALID_WEEK_OPTIMIZATION_METRIC/);
});
test('strict mode never silently becomes bounded, and duplicate identical weeks are not fake competitors',async()=>{
  const x=await fixture();assert.equal((await x.strict()).status,'BLOCKED_OPTIMIZATION_METRICS');
  x.search.dayOptions[6][1]=structuredClone(x.search.dayOptions[6][0]);
  const result=await x.run();assert.equal(result.status,'FEASIBLE_PROPOSAL');
  if(result.status==='FEASIBLE_PROPOSAL'){assert.equal(result.optionIndexes[6],0);assert.equal(result.score,null);}
});

test('computed partial metrics reach bounded selection and worker validation without a convenience source',async()=>{
  const f=await fullFixture(s=>{for(const e of s.context.manifest.entries)e.recipeSnapshot.baseYield.totalYieldGrams=null;});
  const request=f.context.input.operation.requestId,contextRaw=await generationPreparationContextFixtureV1(f);
  const metricPolicyRaw=JSON.stringify({contract:generationWeekMetricPolicyContractV1,metricPolicyRevision:id(991),
    optimizationPolicyRevision:f.context.input.optimizationPolicyRevision,targetFit:'MEAN_DAILY_CALORIE_FIT_V1',
    diversity:'UNIQUE_RECIPE_MEAL_SHARE_V1',shoppingReuse:'CANONICAL_FOOD_MEAL_REUSE_SHARE_V1',convenience:'INDEPENDENT_WEEK_CONVENIENCE_V1'});
  const metrics=createGenerationWeekMetricProducerV1({async loadContextRaw(){return contextRaw;}},metricPolicyRaw,null);
  const config={policyRaw:JSON.stringify({contract:optimizationPolicyContractV1,policyRevision:f.context.input.optimizationPolicyRevision,weights}),metrics};
  const source={async loadPreparationRaw(){return JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId:request,
    contextRaw:f.contextRaw,policiesRaw:f.policiesRaw,goalProfile:'MAINTENANCE',slotRevisions:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({
      slotId:s.slotId,mealSnapshotRevision:s.mealSnapshotRevision})))});}};
  const warnings={async loadMealWarningRaw(_r:string,slotId:string,mealSnapshotDigest:string){return JSON.stringify(resignEntry({...f.set.entries[0],slotId,mealSnapshotDigest}));}};
  const selected=await createConvenienceBoundedGenerationSelectionV1(source,warnings,config).generate(request);
  assert.equal(selected.status,'FEASIBLE_PROPOSAL');if(selected.status!=='FEASIBLE_PROPOSAL')return;
  const receipt=JSON.parse(selected.selectionReceiptRaw);assert.equal(receipt.contract,generationSelectionReceiptContractV3);
  assert.equal(receipt.selectedScore,null);assert.deepEqual(receipt.selectedScoreBounds,{minimum:'0.250',maximum:'0.450'});
  let calls=0,revoked=false;
  const decisions:GenerationSelectionDecisionPortV1={async produceDecisionTraceRaw(r,weekRaw,raw){
    const actual=JSON.parse(raw);assert.equal(actual.selectedScore,null);assert.equal(actual.weekRawSha256,hash(weekRaw));
    // Only per-slot optimization evidence remains explicitly synthetic in this integration fixture.
    return JSON.stringify({contract:generationDecisionTraceContractV1,requestOperationId:r,weekRawSha256:hash(weekRaw),
      weekOptimizationResultDigest:actual.weekOptimizationResultDigest,
      slots:actual.selectedSlots.map((s:{slotId:string;sourceKind:string;selectedCandidateDigest:string;candidateSetDigest:string})=>({
        slotId:s.slotId,generatorDecisionEvidence:{...f.plan.graph.days[0].slots[0].generatorDecisionEvidence,decisionPath:s.sourceKind,
          selectedCandidateDigest:s.selectedCandidateDigest,candidateSetDigest:s.candidateSetDigest}}))});
  }};
  const authority:GenerationValidationAuthorityPortV1={async loadForProposalRaw(r,sha){calls++;if(revoked)return null;
    return JSON.stringify({contract:generationValidationAuthorityContractV1,requestOperationId:r,accountId:f.context.input.accountId,
      generationInputDigest:f.evidence.generationInputDigest,evaluatedPlanRawSha256:sha,trustedContextRaw:f.contextRaw,
      pinnedPoliciesRaw:f.policiesRaw,pinnedWarningEvidenceRaw:f.warningRaw});}};
  const bindings=createConvenienceBoundedGenerationWorkerBindingsV1(source,warnings,config,decisions,authority);
  const input={requestOperationId:request,generationInputCanonicalHex:Buffer.from(canonicalJsonV1(f.context.input,'SAFE_INTEGER')).toString('hex'),
    candidateManifestCanonicalHex:Buffer.from(await adaptiveNutritionCandidateManifestCanonicalBytesV2(f.context.manifest)).toString('hex')};
  const proposal=await bindings.generator.generate(input);assert.deepEqual(await bindings.validator.validate({...input,...proposal}),proposal);
  assert.equal(calls,2);const plan=JSON.parse(Buffer.from(proposal.generatedWeekPlanCanonicalHex,'hex').toString('utf8'));
  assert.deepEqual(plan.facts,[]);assert.equal(plan.graph.weekOptimizationResultDigest,receipt.weekOptimizationResultDigest);
  for(const d of plan.graph.days)for(const s of d.slots)for(const c of s.mealSnapshot.components)assert.equal(c.assignedPortion.assignedGrams,null);
  revoked=true;await assert.rejects(()=>bindings.validator.validate({...input,...proposal}),/GENERATION_VALIDATION_BLOCKED/);
});
