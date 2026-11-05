import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareExactNutritionPilotCompatibilityV2} from './exact-nutrition-values-v2-compatibility';
import {readPilotBindingSourceDossiersV1} from './pilot-source-binding-proposals-v1';
import {readSourceClassDefinitionDraftsRawV1} from './source-class-precision-review-v1';
import {buildPilotInputFreezeV1,readAdmissionContractSourcesV1} from './pilot-admission-readiness-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';
import {findCompleteInputWeekWitnessV1} from './complete-input-week-witness-v1';
import {captureExactNutritionInputV2,decodeExactNutritionInputRawV2,exactNutritionInputCanonicalRawV2,
 createExactNutritionValuesV2,scaleExactNutritionValuesV2,sumExactNutritionValuesV2,exactScalarFromDecimalV2,exactNutritionValuesDigestV2,
 exactNutritionValuesCanonicalRawV2,projectExactNutritionForDisplayV2} from '../../src/utils/exactNutritionValuesV2';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const sources=readPilotBindingSourceDossiersV1();
test('all 35 original source binding labels round-trip without changing literals, basis or energy',()=>{
 const definitions=JSON.parse(readSourceClassDefinitionDraftsRawV1()).definitions as {sourceBindings:string[]}[];const keys=definitions.flatMap(d=>d.sourceBindings);assert.equal(keys.length,35);
 for(const key of keys){const s=sources.get(key)!;
  const input=captureExactNutritionInputV2({sourceRecord:key,declaredRetainedArtifactSha256:s.retainedSha256,basis:s.basis,units:{calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g'},carbohydrateSemantics:'AVAILABLE_EXCLUDING_FIBER',mappingPolicyRef:'EXISTING_OFFLINE_MAPPING_NOT_ISSUED'},s.vector);
  assert.deepEqual(input.mappedDecimalText,s.vector);assert.equal(input.reference.basis,s.basis);assert.deepEqual(decodeExactNutritionInputRawV2(exactNutritionInputCanonicalRawV2(input)),input);
  const p=createExactNutritionValuesV2(input.values),whole=scaleExactNutritionValuesV2(p,exactScalarFromDecimalV2('100'),exactScalarFromDecimalV2('100')),third=scaleExactNutritionValuesV2(whole,exactScalarFromDecimalV2('1'),exactScalarFromDecimalV2('3'));
  assert.deepEqual(sumExactNutritionValuesV2([third,third,third]).values,p.values);
 }
});
function fixture(){
 const source=sources.get('SR28:09252')!,water=sources.get('SR28:14411')!;
 const rows=[{component:{rowId:'food',status:'DECLARED_SOURCE_INPUT_MODEL' as const,componentKind:'FOOD' as const,sourceRecord:'SR28:09252',vector:{...source.vector},quantityG:'100',quantityDecision:'DECLARED_GRAMS',optional:false}},
  {component:{rowId:'water',status:'DECLARED_SOURCE_INPUT_MODEL' as const,componentKind:'POTABLE_WATER' as const,sourceRecord:'SR28:14411',vector:{...water.vector},quantityG:null,quantityDecision:'TYPED_WATER_ZERO_NO_GRAM_CONVERSION',optional:false}}];
 const model:ReviewInputModelV1={recipeId:'synthetic',sourceCategory:'LUNCH',declaredServings:3,rows,calculation:calculatePreciseInputV3(rows.map(r=>r.component),3),sourceApproved:false,runtimePublishable:false};
 const raw=JSON.stringify({originalAuthoringCatalog:{recipes:[{recipeId:'synthetic',declaredServings:3,sourceRecipe:{meal_type_primary:'LUNCH'},ingredients:[{ingredient_row_id:'food',canonical_status:'UNRESOLVED',unit:'G',amount:100,weight_g:100},{ingredient_row_id:'water',canonical_status:'UNRESOLVED',unit:'ML',amount:37,weight_g:null}]}]}}),models=[model];
 const freeze=buildPilotInputFreezeV1(raw,models,readAdmissionContractSourcesV1()),scenario={weekStart:'2026-11-02',dailyCalorieTarget:19,tolerancePercent:0,maxRecipeUses:7,slots:[{label:'meal',sourceCategories:['LUNCH']}]};
 const witness=findCompleteInputWeekWitnessV1(models.map(m=>({recipeId:m.recipeId,sourceCategory:m.sourceCategory,caloriesPerDeclaredServing:m.calculation.perDeclaredServing!.calories})),scenario);
 return {raw,models,scenarioRaw:JSON.stringify(scenario),witness,freezeRaw:JSON.stringify(freeze)};
}
const run=(f=fixture())=>prepareExactNutritionPilotCompatibilityV2(f.raw,f.models,f.scenarioRaw,f.witness,f.freezeRaw);
test('new numeric kernel agrees with the existing transfer through a full seven-day synthetic witness',async()=>{
 const r=await run();assert.equal(r.summary.recipes,1);assert.equal(r.summary.componentRows,2);assert.equal(r.summary.meals,7);assert.equal(r.summary.exactAxisComparisons,95);assert.equal(r.week.values.calories.numerator,'133');
 assert.equal(r.recipes[0].components[1].quantityG,null);assert.equal(r.recipes[0].components[1].contribution.values.calories.numerator,'0');assert.equal(r.summary.admittedRecipes,0);assert.equal(r.authorityContext,null);assert.equal(r.serverValidationAttempted,false);
});
test('caller mutation after async entry cannot change pinned numeric inputs',async()=>{
 const f=fixture(),pending=run(f);f.models[0].rows[0].component.vector!.calories='99';f.witness.days[0].meals[0].recipeId='foreign';const r=await pending;assert.equal(r.week.values.calories.numerator,'133');assert.equal(r.recipes[0].components[0].input.mappedDecimalText.calories,'57');
});
test('invalid frozen inputs and stale witness reject without fallback or partial results',async()=>{
 for(const mode of ['MODEL','WITNESS']){const f=fixture();if(mode==='MODEL')f.models[0].rows[0].component.quantityG='99';else f.witness.days[0].meals[0].recipeId='unknown';await assert.rejects(run(f));}
});
test('display projection does not alter canonical bytes/digest or authorize publication',async()=>{
 const r=await run(),before=exactNutritionValuesCanonicalRawV2(r.week),digest=await exactNutritionValuesDigestV2(r.week);
 const display=projectExactNutritionForDisplayV2(r.week,{fractionDigits:1,rounding:'HALF_UP'});assert.equal(exactNutritionValuesCanonicalRawV2(r.week),before);assert.equal(await exactNutritionValuesDigestV2(r.week),digest);
 for(const p of [r,r.week,display,{...r,sourceApproved:true,runtimePublishable:true}]){const raw=JSON.stringify(p);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
