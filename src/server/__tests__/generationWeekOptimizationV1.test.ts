import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {optimizeGenerationWeekRawV1,generationWeekMetricsContractV1,type GenerationWeekMetricsPortV1} from '../generationWeekOptimizationV1';
import {createOptimizedGenerationSelectionV1,generationSelectionReceiptContractV2} from '../generationDayOptionsV1';
import {createGenerationMenuCandidatePreparerV1,generationMenuCandidateSourceContractV1} from '../generationMenuCandidatesV1';
import {generationWeekSearchContractV1} from '../generationWeekSearchV1';
import {optimizationPolicyContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {fullFixture,fixtureWeekValidationInput,resignEntry,id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
const hash=(raw:string)=>createHash('sha256').update(raw,'utf8').digest('hex');
const weights={targetFit:'0.400',diversity:'0.250',convenience:'0.200',shoppingReuse:'0.150'};
async function fixture(warnings=false){
  const f=await fullFixture(s=>{
    s.context.input.goalNutritionTarget.calories={min:'100.000',target:'150.000',max:'400.000'};
    if(warnings){s.balance.policy.allowedWarningCodes.push('LONG_PREPARATION_BURDEN');s.balance.policy.allowedWarningCodes.sort();}
    for(const d of s.evidence.distributionPolicy.days)for(const b of [...d.nutritionBounds,...d.distributionBounds])
      b.bounds.maximum={calories:'200.000',protein:'20.000',fat:'10.000',carbs:'20.000',fiber:'4.000'};
  });
  const sourceRaw=JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId:f.context.input.operation.requestId,
    contextRaw:f.contextRaw,policiesRaw:f.policiesRaw,goalProfile:'MAINTENANCE',
    slotRevisions:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,mealSnapshotRevision:s.mealSnapshotRevision})))});
  const source={async loadPreparationRaw(){return sourceRaw;}};
  const prepared=await createGenerationMenuCandidatePreparerV1(source).prepare(f.context.input.operation.requestId);
  if(prepared.status!=='PREPARED')throw Error('fixture');
  const {days,...weekHeader}=fixtureWeekValidationInput(f);
  const alternative=structuredClone(days[6]);alternative.meals[0].validationInput.meal=prepared.slots[6].meals[1].meal;
  const search={contract:generationWeekSearchContractV1,weekHeader,dayOptions:days.map(d=>[d]),maxEvaluations:16};
  search.dayOptions[6].push(alternative);
  const policyRaw=JSON.stringify({contract:optimizationPolicyContractV1,policyRevision:f.context.input.optimizationPolicyRevision,weights});
  let calls=0,mode='normal';
  const metrics:GenerationWeekMetricsPortV1={async assessWeekRaw(request,weekRaw,inputDigest,policy){
    calls++;assert.equal(request,f.context.input.operation.requestId);assert.equal(inputDigest,f.evidence.generationInputDigest);assert.equal(policy,policyRaw);
    const high=JSON.parse(weekRaw).days[6].meals[0].validationInput.meal.nutrition.calories==='200.000';
    if(mode==='missing'||(mode==='missing-later'&&high))return null;
    const values:Record<string,unknown>={targetFit:high?'1.000':'0.000',diversity:'0.500',convenience:'0.500',shoppingReuse:'0.500'};
    if(mode==='tie')values.targetFit='0.500';
    if(mode==='zero')for(const key of Object.keys(values))values[key]='0.000';
    if(mode==='null')values.convenience=null;
    if(mode==='malformed-null'){values.convenience=null;values.diversity='1.001';}
    if(mode==='bad-type')values.shoppingReuse=0.5;
    const facts:Record<string,unknown>={contract:generationWeekMetricsContractV1,requestOperationId:request,generationInputDigest:inputDigest,
      weekRawSha256:hash(weekRaw),optimizationPolicyRevision:f.context.input.optimizationPolicyRevision,assessmentRevision:id(990),metrics:values};
    if(mode.startsWith('swap:')){const key=mode.slice(5);facts[key]=key.endsWith('Digest')||key==='weekRawSha256'?'a'.repeat(64):id(999);}
    if(mode==='duplicate')return '{"contract":"duplicate",'+JSON.stringify(facts).slice(1);
    if(mode==='drift')values.targetFit=calls===1?'0.000':'1.000';
    return JSON.stringify(facts);
  }};
  return {f,source,search,policyRaw,metrics,calls:()=>calls,set:(v:string)=>{mode=v;},
    run:()=>optimizeGenerationWeekRawV1(JSON.stringify(search),f.rawContext.candidateManifestRaw,policyRaw,JSON.stringify(f.context.input),metrics)};
}
test('later higher-scoring feasible week wins; receipt binds actual weighted results and all visited candidates',async()=>{
  const x=await fixture(),r=await x.run();assert.equal(r.status,'FEASIBLE_PROPOSAL');if(r.status!=='FEASIBLE_PROPOSAL')return;
  assert.equal(r.scope,'BEST_IN_VALIDATED_POOL');assert.equal(r.evaluated,2);assert.equal(r.totalCombinations,2);
  assert.equal(r.optionIndexes[6],1);assert.equal(r.score,'0.700');assert.equal(x.calls(),2);
  const receipt=JSON.parse(r.optimizationReceiptRaw);assert.equal(receipt.selectedWeekRawSha256,hash(r.weekRaw));
  assert.deepEqual(receipt.evaluations.map((v:{score:string})=>v.score),['0.300','0.700']);
  assert.deepEqual(receipt.optimizationPolicy.weights,weights);
  const {digest,...content}=receipt;assert.equal(r.optimizationResultDigest,digest);
  assert.equal(digest,hash(canonicalJsonV1({contract:receipt.contract,
    encoding:'potok-generation-week-optimization-result-canonical-json-v1',result:content},'SAFE_INTEGER')));
  assert.equal(Object.isFrozen(r.validation),true);assert.equal('acceptedPlanRaw' in r,false);
});
test('a budget cut returns best evaluated prefix, never an exhaustive optimum',async()=>{
  const x=await fixture();x.search.maxEvaluations=1;const r=await x.run();
  assert.equal(r.status,'FEASIBLE_PROPOSAL');if(r.status!=='FEASIBLE_PROPOSAL')return;
  assert.equal(r.scope,'BEST_EVALUATED_PREFIX');assert.equal(r.evaluated,1);assert.equal(r.totalCombinations,2);assert.equal(r.score,'0.300');
});
test('ties use stable week digest; identical raw inputs produce identical results',async()=>{
  const x=await fixture();x.set('tie');const a=await x.run(),b=await x.run();assert.deepEqual(a,b);
  if(a.status!=='FEASIBLE_PROPOSAL')throw Error('fixture');
  const r=JSON.parse(a.optimizationReceiptRaw);assert.equal(r.selectedWeekRawSha256,r.evaluations.map((v:{weekRawSha256:string})=>v.weekRawSha256).sort()[0]);
  x.search.dayOptions[6].reverse();const reversed=await x.run();
  if(reversed.status!=='FEASIBLE_PROPOSAL')throw Error('fixture');assert.equal(reversed.weekRaw,a.weekRaw);
});
test('existing valid-before-warnings preference precedes weighted score',async()=>{
  const x=await fixture(true);const meal=x.search.dayOptions[6][1].meals[0];
  meal.validationInput.warningSignals={...meal.validationInput.warningSignals,longPreparationBurden:true};
  const r=await x.run();assert.equal(r.status,'FEASIBLE_PROPOSAL');if(r.status!=='FEASIBLE_PROPOSAL')return;
  assert.equal(r.optionIndexes[6],0);assert.equal(r.score,'0.300');assert.equal(r.validation.status,'VALID');
});
test('missing metrics including on a later candidate withhold any earlier best; malformed data is not absence',async()=>{
  const x=await fixture();
  for(const mode of ['missing','missing-later','null']){x.set(mode);const r=await x.run();assert.equal(r.status,'BLOCKED_OPTIMIZATION_METRICS');assert.equal('weekRaw' in r,false);}
  for(const mode of ['malformed-null','bad-type','duplicate']){x.set(mode);await assert.rejects(x.run);}
});
test('known zero metrics are usable; unknown later validation cannot be declared inferior to an earlier valid week',async()=>{
  const x=await fixture();x.set('zero');const result=await x.run();assert.equal(result.status,'FEASIBLE_PROPOSAL');
  if(result.status==='FEASIBLE_PROPOSAL')assert.equal(result.score,'0.000');
  x.search.dayOptions[6][1].goalTarget=null as unknown as typeof x.search.dayOptions[6][1]['goalTarget'];
  const blocked=await x.run();assert.equal(blocked.status,'BLOCKED_MISSING_EVIDENCE');assert.equal(blocked.evaluated,2);
  assert.equal('weekRaw' in blocked,false);
});
test('assessment request/input/week/policy/revision substitutions abort',async()=>{
  const x=await fixture();
  for(const key of ['requestOperationId','generationInputDigest','weekRawSha256','optimizationPolicyRevision']){
    x.set('swap:'+key);await assert.rejects(x.run,/METRICS_BINDING_MISMATCH/);
  }
});
test('invalid candidates need no metrics; limited infeasibility and missing validation evidence remain distinct',async()=>{
  const x=await fixture();for(const day of x.search.dayOptions[6])day.meals[0].validationInput.requirements.produceRequired=true;
  assert.equal((await x.run()).status,'NO_FEASIBLE_WEEK_IN_POOL');assert.equal(x.calls(),0);
  x.search.maxEvaluations=1;assert.equal((await x.run()).status,'SEARCH_LIMIT_REACHED');
  x.search.dayOptions[0][0].goalTarget=null as unknown as typeof x.search.dayOptions[0][0]['goalTarget'];
  assert.equal((await x.run()).status,'BLOCKED_MISSING_EVIDENCE');
});
test('raw/budget/policy/input substitutions fail before metric source access',async()=>{
  const x=await fixture();x.search.maxEvaluations=0;await assert.rejects(x.run,/BUDGET/);assert.equal(x.calls(),0);
  x.search.maxEvaluations=16;
  await assert.rejects(()=>optimizeGenerationWeekRawV1(JSON.stringify(x.search),x.f.rawContext.candidateManifestRaw,
    x.policyRaw.replace(x.f.context.input.optimizationPolicyRevision,id(999)),JSON.stringify(x.f.context.input),x.metrics),/INPUT_MISMATCH/);
  await assert.rejects(()=>optimizeGenerationWeekRawV1('{"contract":"duplicate",'+JSON.stringify(x.search).slice(1),
    x.f.rawContext.candidateManifestRaw,x.policyRaw,JSON.stringify(x.f.context.input),x.metrics));
  assert.equal(x.calls(),0);
});
test('duplicate week assessments cannot silently drift during one comparison',async()=>{
  const x=await fixture();x.search.dayOptions[6][1]=structuredClone(x.search.dayOptions[6][0]);x.set('drift');
  await assert.rejects(x.run,/METRICS_DRIFT/);
});
test('actual day selection uses weighted comparison, emits V2 proof and never falls back on missing metrics',async()=>{
  const x=await fixture();
  const warnings={async loadMealWarningRaw(_r:string,slotId:string,mealSnapshotDigest:string){return JSON.stringify(resignEntry({...x.f.set.entries[0],slotId,mealSnapshotDigest}));}};
  const config={policyRaw:x.policyRaw,metrics:x.metrics};const engine=createOptimizedGenerationSelectionV1(x.source,warnings,config);
  config.policyRaw='mutated after construction';
  const r=await engine.generate(x.f.context.input.operation.requestId,'{"maxDayEvaluations":16,"maxWeekEvaluations":2}');
  assert.equal(r.status,'FEASIBLE_PROPOSAL');if(r.status!=='FEASIBLE_PROPOSAL')return;
  const receipt=JSON.parse(r.selectionReceiptRaw);assert.equal(receipt.contract,generationSelectionReceiptContractV2);
  assert.equal(receipt.scope,'BEST_EVALUATED_PREFIX');assert.equal(r.week.optionIndexes[6],1);
  assert.equal(receipt.weekOptimizationResultDigest,JSON.parse(receipt.weekOptimizationReceiptRaw).digest);
  x.set('missing');const blocked=await engine.generate(x.f.context.input.operation.requestId);
  assert.equal(blocked.status,'BLOCKED_OPTIMIZATION_METRICS');assert.equal('selectionReceiptRaw' in blocked,false);
});
