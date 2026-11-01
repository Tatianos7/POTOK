import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {createGenerationWeekMetricProducerV1,createSqlGenerationWeekMetricProducerV1,
  generationWeekMetricPolicyContractV1,generationWeekConvenienceContractV1,type GenerationWeekConveniencePortV1} from '../generationWeekMetricProducerV1';
import {generationPreparationReadSqlV1} from '../generationPreparationSourceV1';
import {generationPreparationContextFixtureV1} from './generationPreparationSqlFixturesV1';
import {optimizeGenerationWeekRawV1} from '../generationWeekOptimizationV1';
import {generationWeekSearchContractV1} from '../generationWeekSearchV1';
import {optimizationPolicyContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {fullFixture,fixtureWeekValidationInput,id,useRecipe,type FixtureState} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
const hash=(raw:string)=>createHash('sha256').update(raw,'utf8').digest('hex');
async function fixture(change:(s:FixtureState)=>void=()=>{}){
  const f=await fullFixture(change),request=f.context.input.operation.requestId;
  let contextRaw:string|null=await generationPreparationContextFixtureV1(f),mode='known';let contextCalls=0,convenienceCalls=0;
  const metricPolicyRaw=JSON.stringify({contract:generationWeekMetricPolicyContractV1,metricPolicyRevision:id(991),
    optimizationPolicyRevision:f.context.input.optimizationPolicyRevision,targetFit:'MEAN_DAILY_CALORIE_FIT_V1',
    diversity:'UNIQUE_RECIPE_MEAL_SHARE_V1',shoppingReuse:'CANONICAL_FOOD_MEAL_REUSE_SHARE_V1',convenience:'INDEPENDENT_WEEK_CONVENIENCE_V1'});
  const optimizationPolicyRaw=JSON.stringify({contract:optimizationPolicyContractV1,policyRevision:f.context.input.optimizationPolicyRevision,
    weights:{targetFit:'0.400',diversity:'0.250',convenience:'0.200',shoppingReuse:'0.150'}});
  const context={async loadContextRaw(r:string){contextCalls++;assert.equal(r,request);return contextRaw;}};
  const convenience:GenerationWeekConveniencePortV1={async loadConvenienceRaw(r,weekSha,digest,policyRevision){
    convenienceCalls++;if(mode==='missing')return null;if(mode==='error')throw Error('source unavailable');
    const raw:Record<string,unknown>={contract:generationWeekConvenienceContractV1,requestOperationId:r,weekRawSha256:weekSha,
      generationInputDigest:digest,metricPolicyRevision:policyRevision,sourceRevision:id(992),score:mode==='null'?null:mode==='zero'?'0.000':'0.750'};
    if(mode.startsWith('swap:'))raw[mode.slice(5)]='a'.repeat(64);
    if(mode==='bad-score')raw.score=0.75;
    if(mode==='duplicate')return '{"score":"0.750",'+JSON.stringify(raw).slice(1);
    return JSON.stringify(raw);
  }};
  const producer=createGenerationWeekMetricProducerV1(context,metricPolicyRaw,convenience);
  const week=fixtureWeekValidationInput(f),weekRaw=JSON.stringify(week);
  const args=[request,weekRaw,f.evidence.generationInputDigest,optimizationPolicyRaw] as const;
  return {f,request,week,weekRaw,args,producer,context,metricPolicyRaw,optimizationPolicyRaw,
    counts:()=>({contextCalls,convenienceCalls}),set:(v:string)=>{mode=v;},setContext:(v:string|null)=>{contextRaw=v;},
    contextRaw:()=>contextRaw,run:()=>producer.calculateWeekRaw(...args)};
}
test('three metrics derive from actual pinned week; explicit convenience source completes the assessment',async()=>{
  const x=await fixture(),result=await x.run();assert.ok(result);assert.equal(result.status,'ASSESSED');
  const metrics=JSON.parse(result.metricsRaw),receipt=JSON.parse(result.calculationReceiptRaw);
  assert.deepEqual(metrics.metrics,{targetFit:'0.000',diversity:'1.000',convenience:'0.750',shoppingReuse:'0.000'});
  assert.equal(receipt.recipeAppearances,7);assert.equal(receipt.distinctRecipeIds.length,7);
  assert.equal(receipt.canonicalFoodMealAppearances,7);assert.equal(receipt.distinctCanonicalFoodIds.length,7);
  assert.equal(receipt.weekRawSha256,hash(x.weekRaw));assert.equal(receipt.dailyFits.length,7);
  const {digest,assessmentRevision,...content}=receipt;
  assert.equal(digest,hash(canonicalJsonV1({contract:content.contract,
    encoding:'potok-generation-week-metric-calculation-canonical-json-v1',calculation:content},'SAFE_INTEGER')));
  assert.equal(assessmentRevision,metrics.assessmentRevision);
  assert.match(metrics.assessmentRevision,/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(await x.run(),result);assert.deepEqual(x.counts(),{contextCalls:2,convenienceCalls:2});
  assert.equal(await x.producer.assessWeekRaw(...x.args),result.metricsRaw);
});
test('unknown convenience remains null and cannot be replaced by zero or a full optimizer result',async()=>{
  const x=await fixture();for(const mode of ['missing','null']){x.set(mode);const result=await x.run();assert.ok(result);
    assert.equal(result.status,'PARTIAL');assert.equal(JSON.parse(result.metricsRaw).metrics.convenience,null);}
  const absent=createGenerationWeekMetricProducerV1(x.context,x.metricPolicyRaw,null);
  const result=await absent.calculateWeekRaw(...x.args);assert.ok(result);assert.equal(result.status,'PARTIAL');
  x.set('missing');const {days,...weekHeader}=x.week;
  const search=JSON.stringify({contract:generationWeekSearchContractV1,weekHeader,dayOptions:days.map(d=>[d]),maxEvaluations:1});
  const blocked=await optimizeGenerationWeekRawV1(search,x.f.rawContext.candidateManifestRaw,x.optimizationPolicyRaw,
    JSON.stringify(x.f.context.input),x.producer);
  assert.equal(blocked.status,'BLOCKED_OPTIMIZATION_METRICS');assert.equal('weekRaw' in blocked,false);
  x.set('zero');const known=await x.run();assert.ok(known);assert.equal(known.status,'ASSESSED');assert.equal(JSON.parse(known.metricsRaw).metrics.convenience,'0.000');
});
test('daily goal fit reuses existing scorer and does not cancel high and low days across the week',async()=>{
  const exact=await fixture(s=>{for(const e of s.context.manifest.entries){e.recipeSnapshot.fullRecipeNutrition.calories='150.000';e.recipeSnapshot.ingredients[0].nutrition.calories='150.000';}
    for(const d of s.evidence.distributionPolicy.days)for(const b of [...d.nutritionBounds,...d.distributionBounds])b.bounds.maximum.calories='200.000';});
  const result=await exact.run();assert.ok(result);assert.equal(JSON.parse(result.metricsRaw).metrics.targetFit,'1.000');
  const mixed=await fixture(s=>{for(const e of s.context.manifest.entries.slice(3)){e.recipeSnapshot.fullRecipeNutrition.calories='200.000';e.recipeSnapshot.ingredients[0].nutrition.calories='200.000';}
    for(const d of s.evidence.distributionPolicy.days)for(const b of [...d.nutritionBounds,...d.distributionBounds])b.bounds.maximum.calories='200.000';});
  const notCancelled=await mixed.run();assert.ok(notCancelled);assert.equal(JSON.parse(notCancelled.metricsRaw).metrics.targetFit,'0.000');
});
test('canonical ingredient reuse uses stable IDs rather than food names',async()=>{
  const x=await fixture(s=>{
    const [a,b]=s.context.manifest.entries;const ingredient=structuredClone(a.recipeSnapshot.ingredients[0].identity);
    b.recipeSnapshot.ingredients[0].identity=ingredient;b.ingredientIds=[...a.ingredientIds];b.dominantIngredientFamily=a.dominantIngredientFamily;
    s.evidence.components[1].ingredientFamilies=[a.dominantIngredientFamily];
  });
  const result=await x.run();assert.ok(result);const r=JSON.parse(result.calculationReceiptRaw);
  assert.equal(r.canonicalFoodMealAppearances,7);assert.equal(r.distinctCanonicalFoodIds.length,6);
  assert.equal(JSON.parse(result.metricsRaw).metrics.shoppingReuse,'0.143');
});
test('repeated ingredient rows within a meal do not inflate shopping reuse',async()=>{
  const x=await fixture(s=>{
    const recipe=s.context.manifest.entries[0].recipeSnapshot,first=recipe.ingredients[0];
    first.quantity.amount='50.000';first.normalizedGrams='50.000';
    first.nutrition={calories:'50.000',protein:'5.000',fat:'2.500',carbs:'5.000',fiber:'1.000'};
    recipe.ingredients.push({...structuredClone(first),componentId:id(998),sortOrder:1});
  });
  const result=await x.run();assert.ok(result);const receipt=JSON.parse(result.calculationReceiptRaw);
  assert.equal(receipt.canonicalFoodMealAppearances,7);assert.equal(JSON.parse(result.metricsRaw).metrics.shoppingReuse,'0.000');
});
test('unknown cooked yield stays null and approved non-food is excluded only from the shopping metric',async()=>{
  const x=await fixture(s=>{
    for(const e of s.context.manifest.entries)e.recipeSnapshot.baseYield.totalYieldGrams=null;
    const recipe=s.context.manifest.entries[0].recipeSnapshot;
    recipe.ingredients.push({...structuredClone(recipe.ingredients[0]),componentId:id(997),identity:{kind:'approved_non_food',componentDefinitionId:id(996)},
      displayNameSnapshot:'Synthetic approved water',quantity:{amount:'10.000',unit:'g'},normalizedGrams:'10.000',sortOrder:1,
      nutrition:{calories:'0.000',protein:'0.000',fat:'0.000',carbs:'0.000',fiber:'0.000'}});
  });
  const result=await x.run();assert.ok(result);const receipt=JSON.parse(result.calculationReceiptRaw);
  assert.equal(receipt.excludedNonFoodMealAppearances,1);assert.equal(receipt.canonicalFoodMealAppearances,7);
  for(const d of x.week.days)for(const s of d.meals)for(const c of s.validationInput.meal.components)assert.equal(c.assignedPortion.assignedGrams,null);
});
test('known assessments feed the real weighted optimizer without synthetic full-week metric values',async()=>{
  const x=await fixture(),{days,...weekHeader}=x.week;
  const search=JSON.stringify({contract:generationWeekSearchContractV1,weekHeader,dayOptions:days.map(d=>[d]),maxEvaluations:1});
  const result=await optimizeGenerationWeekRawV1(search,x.f.rawContext.candidateManifestRaw,x.optimizationPolicyRaw,
    JSON.stringify(x.f.context.input),x.producer);
  assert.equal(result.status,'FEASIBLE_PROPOSAL');if(result.status!=='FEASIBLE_PROPOSAL')return;
  assert.equal(result.score,'0.400');assert.equal(JSON.parse(result.optimizationReceiptRaw).evaluations[0].assessmentRevision,
    JSON.parse((await x.producer.calculateWeekRaw(x.request,result.weekRaw,x.args[2],x.args[3]))!.metricsRaw).assessmentRevision);
});
test('source policy, request, input, target and context substitutions abort before convenience reads',async()=>{
  const x=await fixture();await assert.rejects(()=>x.producer.calculateWeekRaw('invalid',x.weekRaw,x.args[2],x.args[3]));
  assert.deepEqual(x.counts(),{contextCalls:0,convenienceCalls:0});
  await assert.rejects(()=>x.producer.calculateWeekRaw(x.request,x.weekRaw,'a'.repeat(64),x.optimizationPolicyRaw),/INPUT_MISMATCH/);
  const target=JSON.parse(x.weekRaw);target.days[0].goalTarget.calories.target='175.000';
  await assert.rejects(()=>x.producer.calculateWeekRaw(x.request,JSON.stringify(target),x.args[2],x.args[3]),/CONTEXT_MISMATCH/);
  const constraints=JSON.parse(x.weekRaw);constraints.days[0].meals[0].validationInput.userConstraints.revisionId=id(999);
  await assert.rejects(()=>x.producer.calculateWeekRaw(x.request,JSON.stringify(constraints),x.args[2],x.args[3]),/CONTEXT_MISMATCH/);
  const proof=JSON.parse(x.weekRaw),component=proof.days[0].meals[0].validationInput.componentEvidence[0];component.proteinSource=!component.proteinSource;
  await assert.rejects(()=>x.producer.calculateWeekRaw(x.request,JSON.stringify(proof),x.args[2],x.args[3]),/REQUIRES_VALID_WEEK/);
  assert.equal(x.counts().convenienceCalls,0);
  assert.throws(()=>createGenerationWeekMetricProducerV1(x.context,x.metricPolicyRaw.replace('MEAN_DAILY_CALORIE_FIT_V1','default'),null),/UNSUPPORTED/);
});
test('recipe diversity counts selected recipe identities rather than the entire catalog or number of meals',async()=>{
  const x=await fixture(s=>{useRecipe(s,1,0);});
  const result=await x.run();assert.ok(result);const receipt=JSON.parse(result.calculationReceiptRaw);
  assert.equal(receipt.recipeAppearances,7);assert.equal(receipt.distinctRecipeIds.length,6);
  assert.equal(JSON.parse(result.metricsRaw).metrics.diversity,'0.857');
});
test('malformed SQL responses and transport errors never create metric facts',async()=>{
  const x=await fixture();
  for(const rows of [[],[{source_raw:null},{source_raw:null}],[{source_raw:null,extra:true}]]){
    const producer=createSqlGenerationWeekMetricProducerV1({async query(){return {rows};}},x.metricPolicyRaw,null);
    await assert.rejects(()=>producer.assessWeekRaw(...x.args),/INVALID_WEEK_METRIC_SQL_RESULT/);
  }
  const producer=createSqlGenerationWeekMetricProducerV1({async query(){throw Error('connection failed');}},x.metricPolicyRaw,null);
  await assert.rejects(()=>producer.assessWeekRaw(...x.args),/connection failed/);
});
test('foreign, malformed and failed convenience sources cannot become known scores',async()=>{
  const x=await fixture();
  for(const mode of ['swap:requestOperationId','swap:weekRawSha256','swap:generationInputDigest','swap:metricPolicyRevision','bad-score','duplicate','error']){
    x.set(mode);await assert.rejects(x.run);
  }
});
test('admitted SQL context is read afresh with fixed parameters and missing data never reuse earlier calculations',async()=>{
  const x=await fixture();const sql={async query(statement:string,parameters:readonly string[]){
    assert.equal(statement,generationPreparationReadSqlV1);assert.deepEqual(parameters,[x.request]);return {rows:[{source_raw:x.contextRaw()}]};
  }};
  const producer=createSqlGenerationWeekMetricProducerV1(sql,x.metricPolicyRaw,null);
  assert.ok(await producer.assessWeekRaw(...x.args));x.setContext(null);assert.equal(await producer.assessWeekRaw(...x.args),null);
  x.setContext('{}');await assert.rejects(()=>producer.assessWeekRaw(...x.args));
});
