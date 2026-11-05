import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectExactRationalRepresentationV1,readSourceClassDefinitionDraftsRawV1,validateSourceClassDefinitionDraftsV1,reviewSourceClassesAndPrecisionV1} from './source-class-precision-review-v1';
import {buildPilotInputFreezeV1,readAdmissionContractSourcesV1} from './pilot-admission-readiness-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';
import {normalizeFoodEvidenceSourceDecimalV1,nutritionReviewedRevisionCanonicalBytesRawV1} from '../../src/utils/foodReviewedEvidenceV1';
import {decodeGraphRecipeSnapshotV1,scalePremiumRecipeCollectionV1} from '../../src/utils/adaptiveNutritionGraphV1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const registryRaw=readSourceClassDefinitionDraftsRawV1(),registry=JSON.parse(registryRaw),keys=registry.definitions.flatMap((d:{sourceBindings:string[]})=>d.sourceBindings);
const rational=(numerator:string,denominator:string)=>({numerator,denominator});
test('finite rational inspection finds the minimum lossless decimal scale',()=>{
 for(const [n,d,places] of [['0','1',0],['3','1',0],['1','8',3],['1','40',3],['1','10000000',7]] as const){const r=inspectExactRationalRepresentationV1(rational(n,d));assert.equal(r.minimumFinitePlaces,places);assert.equal(r.decimalKind,'FINITE');assert.equal(r.losslessAtThreePlaces,places<=3);}
});
test('source precision never makes one-third or one-seventh a finite decimal',()=>{
 for(const [n,d] of [['1','3'],['2','3'],['1','7'],['1','3000']]){const r=inspectExactRationalRepresentationV1(rational(n,d));assert.equal(r.decimalKind,'NON_TERMINATING');assert.equal(r.minimumFinitePlaces,null);assert.equal(r.losslessAtThreePlaces,false);assert.deepEqual(r.exact,rational(n,d));}
});
test('rational inspection rejects malformed and noncanonical values',()=>{
 for(const r of [rational('1','0'),rational('-1','3'),rational('01','3'),rational('2','6'),rational('0','3'),rational('1'.repeat(81),'3'),{numerator:1,denominator:'3'},{...rational('1','3'),approved:true}])assert.throws(()=>inspectExactRationalRepresentationV1(r));
});
test('registry covers 34 exact source-class drafts and 35 original binding labels',()=>{
 const defs=validateSourceClassDefinitionDraftsV1(registryRaw,keys);assert.equal(defs.length,34);assert.equal(keys.length,35);assert.equal(defs.filter(d=>d.componentKind==='FOOD').length,32);assert.equal(defs.filter(d=>d.proposedFoodState===null).length,1);
 for(const d of defs){assert.equal(d.canonicalFoodId,null);assert.equal(d.foodStableId,null);assert.equal(d.sourceApproved,false);}
});
test('unreported walnut state, wheat species and edamame method remain unknown',()=>{
 const get=(key:string)=>registry.definitions.find((d:{sourceBindings:string[]})=>d.sourceBindings.includes(key));
 assert.equal(get('SR28:12155').proposedFoodState,null);assert.match(get('SR28:20124').unresolvedSourceAttributes.join(' '),/Вид пшеницы.*не указан/);assert.match(get('FDC_SR_LEGACY:168411:PREPARED:100G').unresolvedSourceAttributes.join(' '),/не устанавливает конкретный метод/);
 assert.match(get('FDC_SR_LEGACY:175154:RAW:100G').proposedNameRu,/дикая/);assert.match(get('FDC_SR_LEGACY:172420:DRY_RAW:100G').proposedNameRu,/цвет и сорт не указаны/);
});
test('source-class drafts reject lost/duplicated bindings, changed retained facts and promotion',()=>{
 for(const mode of ['MISSING','DUPLICATE','DESCRIPTION','VECTOR','CAPTURE','KIND','PROMOTE','ID']){const r=JSON.parse(registryRaw),d=r.definitions[0];if(mode==='MISSING')r.definitions.pop();if(mode==='DUPLICATE')r.definitions.push(d);if(mode==='DESCRIPTION')d.sourceDescription='Other source';if(mode==='VECTOR')d.sourceVectorSha256='0'.repeat(64);if(mode==='CAPTURE')d.retainedSha256='0'.repeat(64);if(mode==='KIND')d.componentKind='TABLE_SALT';if(mode==='PROMOTE')d.sourceApproved=true;if(mode==='ID')d.canonicalFoodId='11111111-1111-4111-8111-111111111111';assert.throws(()=>validateSourceClassDefinitionDraftsV1(JSON.stringify(r),keys));}
});
function oldRecipe(){const uid=(n:number)=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0'),nutrition={calories:'1.000',protein:'0.000',fat:'0.000',carbs:'0.000',fiber:'0.000'};return {recipeId:uid(1),recipeRevisionId:uid(2),displayNameSnapshot:'Synthetic existing V1',baseYield:{servings:'3.000',servingLabel:'порция',totalYieldGrams:null},fullRecipeNutrition:{...nutrition},ingredients:[{componentId:uid(3),recipeRevisionId:uid(2),identity:{kind:'canonical_food',canonicalFoodId:uid(4)},displayNameSnapshot:'Synthetic',state:'raw',quantity:{amount:'3.000',unit:'g'},normalizedGrams:'3.000',normalizationEvidenceRef:null,scaling:{mode:'continuous'},nutrition:{...nutrition},sortOrder:0}]};}
test('actual legacy Graph rounding remains three places, including one-third',()=>{
 const p=oldRecipe();assert.doesNotThrow(()=>decodeGraphRecipeSnapshotV1(p));const r=scalePremiumRecipeCollectionV1(p,'1.000');assert.equal(r.scaleFactor,'0.333');assert.equal(r.nutrition.calories,'0.333');assert.equal(inspectExactRationalRepresentationV1(rational('1','3')).losslessAtThreePlaces,false);
});
test('existing Food and Graph decoders continue to reject extra precision',()=>{
 assert.throws(()=>normalizeFoodEvidenceSourceDecimalV1('378.866123'));const p=oldRecipe();p.fullRecipeNutrition.calories='1.0001';p.ingredients[0].nutrition.calories='1.0001';assert.throws(()=>decodeGraphRecipeSnapshotV1(p));
});
function fixture(){
 const sourceRecord='SR28:09252',component={rowId:'synthetic_row',status:'DECLARED_SOURCE_INPUT_MODEL' as const,componentKind:'FOOD' as const,sourceRecord,vector:{calories:'57',protein:'0.36',fat:'0.14',carbs:'12.130',fiber:'3.1'},quantityG:'100',quantityDecision:'DECLARED_GRAMS',optional:false};
 const model:ReviewInputModelV1={recipeId:'synthetic',sourceCategory:'LUNCH',declaredServings:3,rows:[{component}],calculation:calculatePreciseInputV3([component],3),sourceApproved:false,runtimePublishable:false};
 const raw=JSON.stringify({originalAuthoringCatalog:{recipes:[{recipeId:model.recipeId,declaredServings:3,sourceRecipe:{meal_type_primary:'LUNCH'},ingredients:[{ingredient_row_id:component.rowId,canonical_status:'UNRESOLVED'}]}]}}),models=[model],freeze=buildPilotInputFreezeV1(raw,models,readAdmissionContractSourcesV1());
 const defs={...registry,definitions:registry.definitions.filter((d:{sourceBindings:string[]})=>d.sourceBindings.includes(sourceRecord))};
 const scenario={weekStart:'2026-11-02',dailyCalorieTarget:19,tolerancePercent:0,maxRecipeUses:7,slots:[{label:'meal',sourceCategories:['LUNCH']}]};return {raw,models,freezeRaw:JSON.stringify(freeze),definitionsRaw:JSON.stringify(defs),scenarioRaw:JSON.stringify(scenario)};
}
test('the existing transfer preserves nonterminating values through recipe, meal, day and week',async()=>{
 const f=fixture(),r=await reviewSourceClassesAndPrecisionV1(f.raw,f.models,f.scenarioRaw,f.definitionsRaw,f.freezeRaw);assert.equal(r.summary.sourceRows,1);assert.equal(r.exactWeek.summary.meals,7);assert.ok(r.scopeSummary.DECLARED_SERVING.nonTerminating>0);assert.ok(r.scopeSummary.DAY.nonTerminating>0);assert.ok(r.scopeSummary.WEEK.nonTerminating>0);assert.deepEqual(JSON.parse(JSON.stringify(r.exactWeek.exactWeeklyConditionalInputNutrition)),r.exactWeek.exactWeeklyConditionalInputNutrition);assert.equal(r.proposedDirection.implementedRuntimeSupport,false);assert.equal(r.summary.admittedRecipes,0);
});
test('compatibility drafts and forged flags cannot become Food or publication evidence',async()=>{
 const f=fixture(),r=await reviewSourceClassesAndPrecisionV1(f.raw,f.models,f.scenarioRaw,f.definitionsRaw,f.freezeRaw);
 for(const v of [r,{...r,sourceApproved:true,runtimePublishable:true}]){const raw=JSON.stringify(v);assert.throws(()=>nutritionReviewedRevisionCanonicalBytesRawV1(raw));await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
