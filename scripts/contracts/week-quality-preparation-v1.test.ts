import test from 'node:test';import assert from 'node:assert/strict';
import {reviewConditionalWeekV1,readObservedGroupsRawV1,decodeObservedGroupsV1,evaluateExplicitRecipeExclusionV1,buildOfflineValidationPreparationV1,type ReviewInputModelV1} from './week-quality-preparation-v1';
import {findCompleteInputWeekWitnessV1} from './complete-input-week-witness-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
import {decodeGenerationPreparationContextRawV1} from '../../src/server/generationValidationAuthorityLoaderV1';
const scenario={weekStart:'2026-11-02',dailyCalorieTarget:100,tolerancePercent:0,maxRecipeUses:2,slots:[{label:'meal',sourceCategories:['LUNCH']}]};
function fixture(){
 const models:ReviewInputModelV1[]=Array.from({length:4},(_,i)=>{const recipeId='synthetic_'+i,rows=['a','b'].map(x=>({component:{rowId:recipeId+'_'+x,status:'DECLARED_SOURCE_INPUT_MODEL' as const,componentKind:'FOOD' as const,sourceRecord:'SR28:05062',vector:{calories:'100',protein:'10',fat:'2',carbs:'15',fiber:'3'},quantityG:'50',quantityDecision:'DECLARED_GRAMS',optional:false}}));return {recipeId,sourceCategory:'LUNCH',declaredServings:1,rows,calculation:calculatePreciseInputV3(rows.map(r=>r.component),1),sourceApproved:false,runtimePublishable:false};});
 const inputs=models.map(m=>({recipeId:m.recipeId,sourceCategory:m.sourceCategory,caloriesPerDeclaredServing:m.calculation.perDeclaredServing!.calories})),witness=findCompleteInputWeekWitnessV1(inputs,scenario);
 const candidateRaw=JSON.stringify({originalAuthoringCatalog:{recipes:models.map(m=>({recipeId:m.recipeId,declaredServings:1,sourceRecipe:{meal_type_primary:m.sourceCategory}}))}});return {models,inputs,witness,candidateRaw};
}
test('full exact nutrient sums preserve source energy and leave unknown personal targets unassessed',()=>{
 const {models,witness}=fixture(),before=JSON.stringify([models,witness]),r=reviewConditionalWeekV1(models,witness,scenario);assert.equal(r.weeklySourceInputNutrition.calories,'700.00000000');assert.equal(r.weeklySourceInputNutrition.protein,'70.00000000');assert.equal(r.averageDailySourceInputNutrition.fat,'2.00000000');assert.equal(r.averageDailySourceInputNutrition.carbs,'15.00000000');assert.equal(r.averageDailySourceInputNutrition.fiber,'3.00000000');assert.equal(r.proteinFatCarbohydrateFiberTargets.status,'NOT_ASSESSED_PINNED_PERSONAL_TARGETS_NOT_BOUND');assert.equal(JSON.stringify([models,witness]),before);
});
test('multiple same-group source rows count once per meal and do not assert repeat-family compliance',()=>{const {models,witness}=fixture(),r=reviewConditionalWeekV1(models,witness,scenario),g=r.observedSourceGroups.find(g=>g.group==='CHICKEN');assert.equal(g?.mealMentions,7);assert.equal(g?.mainMealMentions,7);assert.equal(g?.distinctDays,7);assert.equal(r.thresholdsApplied,false);assert.equal(r.repeatFamilyPolicy.status,'NOT_ASSESSED_OBSERVATIONS_ARE_NOT_ELIGIBILITY');});
test('changed nutrient vector, promoted flags, category forgery and bad serving assignment reject',()=>{
 for(const mode of ['NUTRIENT','APPROVE','CATEGORY','SERVING']){const {models,witness}=fixture();if(mode==='NUTRIENT')models[0].calculation.perDeclaredServing!.protein='999';if(mode==='APPROVE')models[0].sourceApproved=true;if(mode==='CATEGORY')witness.days[0].meals[0].sourceCategory='BREAKFAST';if(mode==='SERVING')witness.days[0].meals[0].assignedDeclaredServings=2;assert.throws(()=>reviewConditionalWeekV1(models,witness,scenario));}
});
test('stale dates, duplicate daily recipe, forged usage summary and rounded calories reject',()=>{
 for(const mode of ['DATE','DUPLICATE','USES','CALORIES']){const {models,witness}=fixture();if(mode==='DATE')witness.days[0].date='2026-11-03';if(mode==='DUPLICATE')witness.days[0].meals.push(witness.days[0].meals[0]);if(mode==='USES')witness.recipeUses[0].uses=0;if(mode==='CALORIES')witness.days[0].calories='101.000';assert.throws(()=>reviewConditionalWeekV1(models,witness,scenario));}
});
test('observation taxonomy cannot claim allergen, dietary or authoritative repeat-family status',()=>{
 for(const key of ['allergenClassification','dietaryEligibility','repeatFamilyPolicy','thresholdsApproved','sourceApproved']){const raw=JSON.parse(readObservedGroupsRawV1());raw[key]=true;assert.throws(()=>decodeObservedGroupsV1(JSON.stringify(raw)));}
 const raw=JSON.parse(readObservedGroupsRawV1());raw.groups.TUNA.push('SR28:05062');assert.throws(()=>decodeObservedGroupsV1(JSON.stringify(raw)));assert.throws(()=>decodeObservedGroupsV1('{"groups":{},"groups":{}}'));
});
test('explicit exclusions do not mutate the pool or use an excluded recipe as fallback',()=>{
 const {inputs}=fixture();inputs.push({recipeId:'extra',sourceCategory:'LUNCH',caloriesPerDeclaredServing:'100'});const before=JSON.stringify(inputs),r=evaluateExplicitRecipeExclusionV1(inputs,scenario,['extra']);assert.equal(r.witness.days.length,7);assert.ok(r.witness.days.every(d=>d.meals.every(m=>m.recipeId!=='extra')));assert.equal(r.fallbackUsed,false);assert.equal(JSON.stringify(inputs),before);
 assert.throws(()=>evaluateExplicitRecipeExclusionV1(inputs,scenario,['unknown']));assert.throws(()=>evaluateExplicitRecipeExclusionV1(inputs,scenario,['extra','extra']));
});
test('exclusions with insufficient repeats retain a real no-week result',()=>{const {inputs}=fixture(),r=evaluateExplicitRecipeExclusionV1(inputs,scenario,[inputs[0].recipeId]);assert.equal(r.witness.status,'NO_WEEK_IN_COMPLETE_CONDITIONAL_INPUT_DOMAIN');assert.equal(r.calorieCapacity.status,'INSUFFICIENT_RECIPE_REPEAT_CAPACITY');assert.equal(r.exclusionScope,'EXPLICIT_RECIPE_IDS_ONLY_NOT_ALLERGEN_OR_DIETARY_SCREENING');});
test('remaining-energy pruning is conservative and cannot turn an unproven budget stop into infeasibility',()=>{
 const p=Array.from({length:4},(_,i)=>({recipeId:'x'+i,sourceCategory:'LUNCH',caloriesPerDeclaredServing:i===0?'100':'90'})),r=findCompleteInputWeekWitnessV1(p,scenario);assert.equal(r.status,'NO_WEEK_IN_COMPLETE_CONDITIONAL_INPUT_DOMAIN');assert.ok(r.caloriePrunedNodes>0);
 const {inputs}=fixture(),limited=findCompleteInputWeekWitnessV1(inputs,scenario,{maxDayCandidates:100000,maxWeekNodes:1});assert.equal(limited.status,'INCOMPLETE_BOUNDED_WITNESS_SEARCH');
});
test('offline preparation binds exact inputs, preserves unknown authorities and rejects forged review content',()=>{
 const {models,witness,candidateRaw}=fixture(),review=reviewConditionalWeekV1(models,witness,scenario),p=buildOfflineValidationPreparationV1(candidateRaw,JSON.stringify(scenario),models,witness,review);assert.equal(p.readyForServerSubmission,false);assert.equal(p.accountContext,null);assert.equal(p.requestOperationId,null);assert.equal(p.canonicalRecipeIdentities,null);assert.equal(p.requiredEvidence.sourceNutritionAdmission,'NOT_REVIEWED');assert.match(p.bindings.qualityReviewSha256,/^[a-f0-9]{64}$/);
 const forged=structuredClone(review);forged.weeklySourceInputNutrition.protein='1';assert.throws(()=>buildOfflineValidationPreparationV1(candidateRaw,JSON.stringify(scenario),models,witness,forged));
 const wrong=JSON.parse(candidateRaw);wrong.originalAuthoringCatalog.recipes[0].sourceRecipe.meal_type_primary='BREAKFAST';assert.throws(()=>buildOfflineValidationPreparationV1(JSON.stringify(wrong),JSON.stringify(scenario),models,witness,review));
});
test('real server context and publication decoders reject offline packets and forged authority flags',async()=>{
 const {models,witness,candidateRaw}=fixture(),review=reviewConditionalWeekV1(models,witness,scenario),packet=buildOfflineValidationPreparationV1(candidateRaw,JSON.stringify(scenario),models,witness,review);
 for(const v of [packet,{...packet,readyForServerSubmission:true,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){const raw=JSON.stringify(v);await assert.rejects(decodeGenerationPreparationContextRawV1(raw,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
test('remaining-energy pruning agrees with exhaustive variable-calorie weekly domains',()=>{
 for(const values of [[90,95,100,110],[80,90,110,120]])for(const tolerancePercent of [0,10])for(const maxRecipeUses of [1,2,3]){
  const inputs=values.map((n,i)=>({recipeId:'x'+i,sourceCategory:'LUNCH',caloriesPerDeclaredServing:String(n)})),s={...scenario,tolerancePercent,maxRecipeUses};let exists=false;
  for(let code=0;code<4**7&&!exists;code++){let n=code,valid=true;const uses=[0,0,0,0];for(let day=0;day<7;day++){const pick=n%4;n=Math.floor(n/4);uses[pick]++;if(values[pick]<100-tolerancePercent||values[pick]>100+tolerancePercent)valid=false;}exists=valid&&uses.every(u=>u<=maxRecipeUses);}
  assert.equal(findCompleteInputWeekWitnessV1(inputs,s).status==='CONDITIONAL_INPUT_WEEK_WITNESS',exists);
 }
});
