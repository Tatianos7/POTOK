import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePilotServerTransferV1,pilotTransferRequestContractV1,pilotTransferPrecisionPolicyV1} from './pilot-server-transfer-v1';
import {buildPilotInputFreezeV1,pilotCanonicalV1,pilotDigestV1,readAdmissionContractSourcesV1} from './pilot-admission-readiness-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';
import {candidateRecipeSnapshotDigestV2,type AdaptiveNutritionCandidateManifestEntryV2} from '../../src/utils/adaptiveNutritionAuthoritiesV1';
import {adaptiveMealCompositionEligibilityV1_1} from '../../src/utils/adaptiveNutritionMealCompositionV1';
import {sealPlanEligibilityEvidenceV1,planEligibilityEvidenceContractV1} from '../../src/utils/trustedValidationEvidenceV1';
import {reviewedRuntimeRecipePublicationEvidenceContractV1 as contract,reviewedRuntimeRecipePublicationEvidenceEncodingV1 as encoding,type ReviewedRuntimeRecipePublicationEvidenceV1 as Evidence,decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
import {decodeGenerationPreparationContextRawV1} from '../../src/server/generationValidationAuthorityLoaderV1';
const uid=(n:number)=>'bbbbbbbb-bbbb-4bbb-8bbb-'+String(n).padStart(12,'0');
const zero={calories:'0.000',protein:'0.000',fat:'0.000',carbs:'0.000',fiber:'0.000'};
const food={calories:'100.000',protein:'12.000',fat:'4.000',carbs:'8.000',fiber:'2.000'};
const axes=['calories','protein','fat','carbs','fiber'] as const;
function fixture(){
 const model:ReviewInputModelV1={recipeId:'synthetic_transfer',sourceCategory:'LUNCH',declaredServings:2,sourceApproved:false,runtimePublishable:false,
 rows:[{component:{rowId:'synthetic_food',status:'DECLARED_SOURCE_INPUT_MODEL',componentKind:'FOOD',sourceRecord:'SYNTHETIC_UNAPPROVED',vector:{calories:'125',protein:'15',fat:'5',carbs:'10',fiber:'2.5'},quantityG:'80',quantityDecision:'DECLARED_GRAMS',optional:false}},
 {component:{rowId:'synthetic_water',status:'DECLARED_SOURCE_INPUT_MODEL',componentKind:'POTABLE_WATER',sourceRecord:'SR28:14411',vector:{...zero},quantityG:null,quantityDecision:'TYPED_WATER_ZERO_NO_GRAM_CONVERSION',optional:false}}],calculation:{perDeclaredServing:null}};
 const original={recipeId:model.recipeId,declaredServings:2,sourceRecipe:{meal_type_primary:'LUNCH'},ingredients:[{ingredient_row_id:'synthetic_food',canonical_status:'UNRESOLVED',amount:80,unit:'G',weight_g:80},{ingredient_row_id:'synthetic_water',canonical_status:'UNRESOLVED',amount:37,unit:'ML',weight_g:null}]};
 return {model,original};
}
function freeze(f=fixture()){
 f.model.calculation=calculatePreciseInputV3(f.model.rows.map(r=>r.component),f.model.declaredServings);
 f.original.declaredServings=f.model.declaredServings as number;
 const raw=JSON.stringify({originalAuthoringCatalog:{recipes:[f.original]}}),models=[f.model];
 const pin=buildPilotInputFreezeV1(raw,models,readAdmissionContractSourcesV1());return {raw,models,pin,freezeRaw:JSON.stringify(pin)};
}
const run=(f:ReturnType<typeof freeze>,bindings?:string)=>preparePilotServerTransferV1(f.raw,f.models,f.freezeRaw,bindings);
function sign(e:Evidence){const {digest,...evidence}=e;assert.equal(typeof digest,'string');e.digest=pilotDigestV1(pilotCanonicalV1({contract,encoding,evidence}));return JSON.stringify(e);}
async function evidence(){
 const recipeSnapshot={recipeId:uid(10),recipeRevisionId:uid(11),displayNameSnapshot:'Synthetic only',baseYield:{servings:'2.000',servingLabel:'synthetic',totalYieldGrams:null},fullRecipeNutrition:food,
 ingredients:[{componentId:uid(20),recipeRevisionId:uid(11),identity:{kind:'canonical_food' as const,canonicalFoodId:uid(12)},displayNameSnapshot:'Synthetic food',state:'raw' as const,quantity:{amount:'80.000',unit:'g' as const},normalizedGrams:'80.000',normalizationEvidenceRef:null,scaling:{mode:'continuous' as const},nutrition:food,sortOrder:0},
 {componentId:uid(21),recipeRevisionId:uid(11),identity:{kind:'approved_non_food' as const,componentDefinitionId:uid(99)},displayNameSnapshot:'Synthetic water',state:'raw' as const,quantity:{amount:'37.000',unit:'ml' as const},normalizedGrams:null,normalizationEvidenceRef:null,scaling:{mode:'continuous' as const},nutrition:zero,sortOrder:1}]};
 const entry:AdaptiveNutritionCandidateManifestEntryV2={recipeId:uid(10),recipeRevisionId:uid(11),portionRevisionId:uid(13),eligibilityRevisionId:uid(14),publicationRevision:uid(15),publicationStatus:'PUBLISHED',canonicalEvidenceRevision:uid(16),canonicalEvidenceDigest:'a'.repeat(64),nutritionEvidenceRevision:uid(17),nutritionEvidenceDigest:'b'.repeat(64),allergenEvidenceRevision:uid(18),dietaryEvidenceRevision:uid(19),ingredientIds:[uid(12)],allergenCodes:[],intoleranceCodes:[],dietaryCodes:[],allowedMealTypes:['lunch'],role:'MAIN_COMPONENT',anchorKind:'COMPLETE',requiredCompanionRoleSets:[],pairingTags:[],incompatiblePairingTags:[],repeatFamily:'synthetic',energyClass:'BALANCED',beverageClass:'NOT_BEVERAGE',dominantIngredientFamily:'synthetic',accessibility:'COMMON_RU_RETAIL',specialty:false,expensive:false,portionRules:{mode:'HYBRID',assignedServingsMinimum:'0.500',assignedServingsMaximum:'2.000',assignedServingsIncrement:'0.500',componentIncrements:[]},recipeSnapshot,recipeSnapshotDigest:await candidateRecipeSnapshotDigestV2(recipeSnapshot)};
 const e:Evidence={contract,manifestEntry:entry,compositionEligibility:{contract:adaptiveMealCompositionEligibilityV1_1,eligibilityRevisionId:entry.eligibilityRevisionId,recipeRevisionId:entry.recipeRevisionId,compositionPolicyRevision:uid(100),role:entry.role,anchorKind:entry.anchorKind,allowedMealTypes:entry.allowedMealTypes,requiredCompanionRoleSets:entry.requiredCompanionRoleSets,pairingTags:[],incompatiblePairingTags:[],repeatFamily:entry.repeatFamily,energyClass:entry.energyClass,beverageClass:entry.beverageClass},
 planEligibility:structuredClone(await sealPlanEligibilityEvidenceV1({contract:planEligibilityEvidenceContractV1,recipeId:entry.recipeId,recipeRevisionId:entry.recipeRevisionId,portionRevisionId:entry.portionRevisionId,eligibilityRevisionId:entry.eligibilityRevisionId,planEligible:true,evidenceRevision:uid(101)})),
 reviewedSource:{reviewStatus:'REVIEWED',authoringRecipeId:'synthetic_transfer',workbookRevision:'synthetic-only',recipeEvidenceRef:'synthetic:recipe',publicationRevision:entry.publicationRevision,nutritionEvidenceRef:'synthetic:nutrition',allergenEvidenceRef:'synthetic:allergens',dietaryEvidenceRef:'synthetic:dietary',foodBindings:[{componentId:uid(20),canonicalStatus:'RESOLVED',canonical:{foodStableId:'synthetic_food',canonicalFoodId:uid(12),source:'core',sharedCatalogAccessible:true,evidenceRevision:'synthetic',evidenceDigest:'c'.repeat(64)}}],nonFoodBindings:[{componentId:uid(21),componentDefinitionId:uid(99),approvedNonFoodEvidenceRef:'synthetic:nonfood-receipt-not-real'}]},digest:'0'.repeat(64)};
 return e;
}
function request(f:ReturnType<typeof freeze>,proposed:string,pinned=proposed){return JSON.stringify({contract:pilotTransferRequestContractV1,candidateBytesSha256:f.pin.candidateBytesSha256,inputSetSha256:f.pin.inputSetSha256,recipes:[{recipeId:'synthetic_transfer',reviewedPublicationRaw:proposed,pinnedReviewedPublicationRaw:pinned,componentBindings:[{rowId:'synthetic_food',componentId:uid(20)},{rowId:'synthetic_water',componentId:uid(21)}]}]});}
test('lossless transfer preserves exact rationals, declared portions and unknown water mass',async()=>{
 const f=freeze(),before=pilotCanonicalV1(f),r=await run(f),p=r.recipes[0];
 assert.equal(r.precisionPolicy,pilotTransferPrecisionPolicyV1);assert.deepEqual(p.exactGraphNutrition,food);assert.equal(p.declaredServings,'2.000');
 assert.deepEqual(p.components[1].quantity,{amount:'37.000',unit:'ml',normalizedGrams:null,normalizationEvidenceRef:null});assert.equal(p.components[1].identity,null);assert.equal(p.components[1].approvedNonFoodEvidenceRef,null);
 assert.deepEqual(p.wholeInput.calories.exact,{numerator:'100',denominator:'1'});assert.equal(p.perDeclaredServing.calories.graphValue,'50.000');
 assert.equal(p.currentPublicationAudit.status,'ML_NORMALIZATION_BLOCKED');assert.equal(p.measuredYieldG,null);assert.equal(p.confirmedServings,null);assert.equal(p.physicalCookingValidation,'DEFERRED_TO_OWNER_PRELAUNCH_NOT_AN_OFFLINE_GATE');assert.equal(pilotCanonicalV1(f),before);
});
test('one-third is preserved as an exact rational rather than an eight-place or three-place substitute',async()=>{
 const f=fixture();f.model.declaredServings=3;f.model.rows[0].component.vector!.calories='1.25';const r=(await run(freeze(f))).recipes[0];
 assert.deepEqual(r.perDeclaredServing.calories.exact,{numerator:'1',denominator:'3'});assert.equal(r.perDeclaredServing.calories.v3Preview,'0.33333333');assert.equal(r.perDeclaredServing.calories.graphValue,null);assert.equal(r.exactGraphNutrition,null);
});
test('component loss is blocked even when independently rounded contributions could match the whole',async()=>{
 const f=fixture();f.model.declaredServings=1;f.model.rows[0].component.quantityG='100';f.model.rows[0].component.vector!.calories='1.2345';
 f.model.rows.push({component:{...f.model.rows[0].component,rowId:'synthetic_second_food',vector:{...zero,calories:'0.0005'}}});f.original.ingredients.push({...f.original.ingredients[0],ingredient_row_id:'synthetic_second_food'});
 const r=(await run(freeze(f))).recipes[0];assert.equal(r.wholeInput.calories.graphValue,'1.235');assert.equal(r.components[0].values.calories.graphValue,null);assert.equal(r.components[2].values.calories.graphValue,null);assert.equal(r.exactGraphNutrition,null);
 assert.ok(r.precisionBlockers.some(b=>b.scope==='COMPONENT'&&b.axis==='calories'));
});
test('half-unit neighbors are never rounded, truncated or allocated as residuals',async()=>{
 for(const amount of ['0.00049','0.00050','0.00051']){const f=fixture();f.model.declaredServings=1;f.model.rows[0].component.quantityG='100';f.model.rows[0].component.vector!.calories=amount;const p=(await run(freeze(f))).recipes[0];assert.equal(p.components[0].values.calories.graphValue,null);assert.equal(p.wholeInput.calories.graphValue,null);assert.equal(p.components[0].values.calories.exact.numerator,amount==='0.00050'?'1':amount==='0.00049'?'49':'51');}
});
test('exact component rational sums conserve all five axes and serving division',async()=>{
 for(const servings of [1,2,3,7]){const f=fixture();f.model.declaredServings=servings;const p=(await run(freeze(f))).recipes[0];for(const a of axes){const whole=p.wholeInput[a].exact,part=p.components[0].values[a].exact,per=p.perDeclaredServing[a].exact;assert.equal(BigInt(whole.numerator)*BigInt(part.denominator),BigInt(part.numerator)*BigInt(whole.denominator));assert.equal(BigInt(per.numerator)*BigInt(whole.denominator)*BigInt(servings),BigInt(whole.numerator)*BigInt(per.denominator));assert.deepEqual(p.components[1].values[a].exact,{numerator:'0',denominator:'1'});}}
});
test('positive synthetic reviewed package uses actual decoders and still cannot approve or publish the pilot',async()=>{
 const f=freeze(),e=await evidence(),raw=sign(e),r=await run(f,request(f,raw));assert.equal(r.summary.matchedReviewedValueComparisons,1);assert.equal(r.summary.admittedRecipes,0);
 const p=r.recipes[0];assert.equal(p.evidenceComparison,'MATCHED_VALUES_ONLY_NOT_SOURCE_ADMISSION');assert.equal(p.currentPublicationAudit.status,'ML_NORMALIZATION_BLOCKED');assert.equal(p.nonFoodReceiptsAndCurrentness,'NOT_VERIFIED');assert.equal(p.sourceAdmission,'NOT_PERFORMED');
 for(const k of ['sourceApproved','runtimePublishable','canApply','mayActivate','readyForServerSubmission'] as const){assert.equal(r[k],false);assert.equal(p[k],false);}assert.equal(p.accountAndRequestContext,null);assert.ok(p.components.every(c=>c.identity===null));
});
test('missing, wrong-definition and empty non-food references reject through the real evidence decoder',async()=>{
 for(const mode of ['MISSING','WRONG','EMPTY']){const f=freeze(),e=await evidence();if(mode==='MISSING')e.reviewedSource.nonFoodBindings=[];if(mode==='WRONG')e.reviewedSource.nonFoodBindings[0].componentDefinitionId=uid(200);if(mode==='EMPTY')e.reviewedSource.nonFoodBindings[0].approvedNonFoodEvidenceRef='';await assert.rejects(run(f,request(f,sign(e))));}
});
test('changed pinned evidence cannot be replaced by a rehashed proposed package',async()=>{
 const f=freeze(),e=await evidence(),pin=sign(e);e.reviewedSource.nutritionEvidenceRef='synthetic:changed';await assert.rejects(run(f,request(f,sign(e),pin)),/PINNED_MISMATCH/);
});
test('even internally valid rehashed packages must match the frozen model quantities, nutrition, servings and row mapping',async()=>{
 for(const mode of ['RECIPE','QUANTITY','MACROS','SERVINGS','MAP','ORDER','NONFOOD_BYPASS','WATER_MASS']){const f=freeze(),e=await evidence();if(mode==='RECIPE')e.reviewedSource.authoringRecipeId='other';if(mode==='QUANTITY'){e.manifestEntry.recipeSnapshot.ingredients[0].quantity.amount='81.000';e.manifestEntry.recipeSnapshot.ingredients[0].normalizedGrams='81.000';}if(mode==='MACROS'){e.manifestEntry.recipeSnapshot.ingredients[0].nutrition={...food,calories:'101.000'};e.manifestEntry.recipeSnapshot.fullRecipeNutrition={...food,calories:'101.000'};}if(mode==='SERVINGS')e.manifestEntry.recipeSnapshot.baseYield.servings='3.000';if(mode==='ORDER'){e.manifestEntry.recipeSnapshot.ingredients.reverse().forEach((c,i)=>c.sortOrder=i);}if(mode==='NONFOOD_BYPASS'){e.manifestEntry.recipeSnapshot.ingredients[0].identity={kind:'approved_non_food',componentDefinitionId:uid(98)};e.manifestEntry.ingredientIds=[];e.reviewedSource.foodBindings=[];e.reviewedSource.nonFoodBindings.push({componentId:uid(20),componentDefinitionId:uid(98),approvedNonFoodEvidenceRef:'synthetic'});}if(mode==='WATER_MASS'){e.manifestEntry.recipeSnapshot.ingredients[1].normalizedGrams='37.000';e.manifestEntry.recipeSnapshot.ingredients[1].normalizationEvidenceRef=uid(102);}
  e.manifestEntry.recipeSnapshotDigest=await candidateRecipeSnapshotDigestV2(e.manifestEntry.recipeSnapshot);let raw=request(f,sign(e));if(mode==='MAP'){const v=JSON.parse(raw);v.recipes[0].componentBindings[0].rowId='unknown_row';raw=JSON.stringify(v);}await assert.rejects(run(f,raw));}
});
test('binding envelope rejects stale inputs, duplicate recipes/rows/components, unknown fields and duplicate raw JSON keys',async()=>{
 const f=freeze(),e=await evidence(),base=request(f,sign(e));for(const mode of ['INPUT','RECIPE','ROW','COMPONENT','EXTRA','KEY']){const p=JSON.parse(base);if(mode==='INPUT')p.inputSetSha256='0'.repeat(64);if(mode==='RECIPE')p.recipes.push(p.recipes[0]);if(mode==='ROW')p.recipes[0].componentBindings[1].rowId='synthetic_food';if(mode==='COMPONENT')p.recipes[0].componentBindings[1].componentId=uid(20);if(mode==='EXTRA')p.readyForServerSubmission=true;const raw=mode==='KEY'?base.replace('"contract":','"contract":"duplicate","contract":'):JSON.stringify(p);await assert.rejects(run(f,raw));}
});
test('invalid volume and invented water mass are rejected without conversion fallback',async()=>{
 for(const mode of ['ZERO','NEGATIVE','PIECE','PRECISION','MASS']){const f=fixture();if(mode==='ZERO')f.original.ingredients[1].amount=0;if(mode==='NEGATIVE')f.original.ingredients[1].amount=-1;if(mode==='PIECE')f.original.ingredients[1].unit='PIECE';if(mode==='PRECISION')f.original.ingredients[1].amount=37.0001;if(mode==='MASS'){f.model.rows[1].component.quantityG='37';assert.throws(()=>freeze(f));continue;}await assert.rejects(run(freeze(f)));}
});
test('real authority decoders reject both the preparation result and forged readiness flags',async()=>{
 const r=await run(freeze());for(const p of [r,{...r,sourceApproved:true,runtimePublishable:true,readyForServerSubmission:true,mayActivate:true}]){const raw=JSON.stringify(p);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));await assert.rejects(decodeGenerationPreparationContextRawV1(raw,uid(900)));}
});
