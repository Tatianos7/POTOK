import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePilotSourceBindingProposalsV1,readPilotBindingSourceDossiersV1} from './pilot-source-binding-proposals-v1';
import {buildPilotInputFreezeV1,readAdmissionContractSourcesV1,pilotCanonicalV1,pilotDigestV1} from './pilot-admission-readiness-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
import {nutritionReviewedRevisionCanonicalBytesRawV1} from '../../src/utils/foodReviewedEvidenceV1';
const flags={sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false};
const dossiers=readPilotBindingSourceDossiersV1(),id='11111111-1111-4111-8111-111111111111';
function fixture(sourceRecord='SR28:09252'){
 const source=dossiers.get(sourceRecord)!;
 const model:ReviewInputModelV1={recipeId:'synthetic',sourceCategory:'SNACK',declaredServings:1,sourceApproved:false,runtimePublishable:false,rows:[{component:{rowId:'row',status:'DECLARED_SOURCE_INPUT_MODEL',componentKind:'FOOD',sourceRecord,vector:{...source.vector},quantityG:'100',quantityDecision:'DECLARED_GRAMS',optional:false}}],calculation:{perDeclaredServing:null}};
 model.calculation=calculatePreciseInputV3(model.rows.map(r=>r.component),1);
 const candidateRaw=JSON.stringify({originalAuthoringCatalog:{recipes:[{recipeId:model.recipeId,declaredServings:1,sourceRecipe:{meal_type_primary:'SNACK'},ingredients:[{ingredient_row_id:'row',canonical_status:'UNRESOLVED'}]}]}});
 const freeze=buildPilotInputFreezeV1(candidateRaw,[model],readAdmissionContractSourcesV1());
 const exact={contract:'potok-pilot-catalog-match-review-v1',freezeSha256:pilotDigestV1(pilotCanonicalV1(freeze)),observation:{environment:'STAGING',projectId:'synthetic'},rows:[{recipeId:model.recipeId,rowId:'row',keys:['груша'],sourceRecord,componentKind:'FOOD',identityStatus:'NO_EXACT_MATCH',candidateObservations:[] as unknown[],proposedCanonicalFoodId:null,proposedStableFoodId:null,...flags}],...flags};
 const snapshot={contract:'potok-shared-catalog-discovery-snapshot-v1',environment:'STAGING',projectId:'synthetic',readScope:'SHARED_CORE_BRAND_ONLY_NO_USER_ROWS',readOnly:true,capturedAt:'2026-11-05T12:00:00Z',rows:[{id,canonical_food_id:id,source:'core',name:'Груша',stable_food_id:'pear',cooking_state:'fresh',data_source:'UNVERIFIED_LEGACY',source_version:null,calories:'42.00',protein:'0.4',fat:'0.3',carbs:'10.9',fiber:null,verified:true,suspicious:false,is_searchable:null,needs_review:null}]};
 const plan={contract:'potok-pilot-discovery-review-plan-v1',exactReviewSha256:'',snapshotSha256:'',rows:[{rowId:'row',remainingAttributes:['identity_state_edible_part'],expectedCatalogStateLabels:['fresh'],candidates:[{stableId:'pear',disposition:'POTENTIAL',reason:'Only a candidate'}]}]};
 return {model,candidateRaw,freeze,exact,snapshot,plan};
}
function run(f=fixture()){
 const exactRaw=JSON.stringify(f.exact),snapshotRaw=JSON.stringify(f.snapshot);f.plan.exactReviewSha256=pilotDigestV1(exactRaw);f.plan.snapshotSha256=pilotDigestV1(snapshotRaw);
 return preparePilotSourceBindingProposalsV1(f.candidateRaw,[f.model],exactRaw,snapshotRaw,JSON.stringify(f.plan),JSON.stringify(f.freeze));
}
test('existing source mappers provide exact primary values without replacing the legacy candidate',()=>{
 const f=fixture(),before=JSON.stringify(f.snapshot),r=run(f),row=r.rows[0];assert.deepEqual(row.source.vector,{calories:'57',protein:'0.36',fat:'0.14',carbs:'12.130',fiber:'3.1'});
 assert.equal(row.catalogCandidates[0].legacyNutrition.fiber,null);assert.equal(row.catalogCandidates[0].legacyNutrition.calories,'42.00');assert.equal(row.sourceDecimalMapping.calories.value,'57.000');assert.equal(row.sourceDecimalMapping.fiber.value,'3.100');assert.equal(row.proposedCanonicalFoodId,null);assert.equal(row.reviewEvent,null);assert.equal(row.authorityContext,null);assert.equal(JSON.stringify(f.snapshot),before);
});
test('Foundation oat and almond precision is blocked by the real food evidence decimal rule',()=>{
 for(const key of ['FDC_FOUNDATION:2346396:2048:2033:100G','FDC_FOUNDATION:2346393:2048:1079:RAW:100G']){const r=run(fixture(key)),row=r.rows[0];assert.equal(row.proposedReviewRoute,'PRECISION_DECISION_REQUIRED_BEFORE_EVIDENCE');assert.deepEqual(row.precisionBlockedAxes,['calories','protein','carbs']);assert.equal(row.sourceDecimalMapping.calories.value,null);assert.equal(row.sourceDecimalMapping.fat.status,'EXACT_THREE_PLACE_REPRESENTATION');}
});
test('source specificity retains wild trout, farmed salmon, tuna medium and lentil colour unknown',()=>{
 for(const [key,finding] of [['FDC_SR_LEGACY:175154:RAW:100G','SOURCE_IS_WILD_RAINBOW_NOT_FARMED'],['FDC_SR_LEGACY:175167:FARMED_ATLANTIC_RAW:100G','SOURCE_IS_FARMED_ATLANTIC_NOT_GENERIC_SALMON'],['FDC_SR_LEGACY:173709:WATER_DRAINED:100G','WATER_PACKED_LIGHT_TUNA_DRAINED_SALTED_OWN_JUICE_EQUIVALENCE_NOT_ESTABLISHED'],['FDC_SR_LEGACY:172420:DRY_RAW:100G','SOURCE_COLOUR_AND_CULTIVAR_NOT_REPORTED_BROWN_EQUIVALENCE_NOT_APPROVED']])assert.ok(run(fixture(key)).rows[0].sourceSpecificApplicability.includes(finding));
});
test('no candidates requests catalog precheck and never invents a new identity',()=>{
 const f=fixture();f.snapshot.rows=[];const row=run(f).rows[0];assert.equal(row.proposedReviewRoute,'CATALOG_IDENTITY_PRECHECK_BEFORE_SOURCE_CLASS_DEFINITION');assert.equal(row.proposedStableFoodId,null);assert.deepEqual(row.catalogCandidates,[]);
});
test('changed frozen model, report recipe/state/source or invented source cannot rebind the proposal',()=>{
 for(const mode of ['MODEL','RECIPE','KIND','SOURCE','INVENTED','FREEZE','MISSING']){const f=fixture();if(mode==='MODEL')f.model.rows[0].component.vector!.calories='99';if(mode==='RECIPE')f.exact.rows[0].recipeId='foreign';if(mode==='KIND')f.exact.rows[0].componentKind='TABLE_SALT';if(mode==='SOURCE')f.exact.rows[0].sourceRecord='SR28:01174';if(mode==='INVENTED')f.exact.rows[0].sourceRecord='INVENTED';if(mode==='FREEZE')f.exact.freezeSha256='0'.repeat(64);if(mode==='MISSING'){f.exact.rows=[];f.plan.rows=[];}assert.throws(()=>run(f));}
});
test('a newly rehashed freeze cannot make altered source values equal the primary mapper values',()=>{
 const f=fixture();f.model.rows[0].component.vector!.fiber='4';f.model.calculation=calculatePreciseInputV3(f.model.rows.map(r=>r.component),1);f.freeze=buildPilotInputFreezeV1(f.candidateRaw,[f.model],readAdmissionContractSourcesV1());f.exact.freezeSha256=pilotDigestV1(pilotCanonicalV1(f.freeze));assert.throws(()=>run(f));
});
test('typed water uses existing nonfood review even when its source vector contains explicit zeros',()=>{
 const f=fixture();f.model.rows.push({component:{rowId:'water',status:'DECLARED_SOURCE_INPUT_MODEL',componentKind:'POTABLE_WATER',sourceRecord:'SR28:14411',vector:{...dossiers.get('SR28:14411')!.vector},quantityG:null,quantityDecision:'TYPED_WATER_ZERO_NO_GRAM_CONVERSION',optional:false}});
 f.model.calculation=calculatePreciseInputV3(f.model.rows.map(r=>r.component),1);const c=JSON.parse(f.candidateRaw);c.originalAuthoringCatalog.recipes[0].ingredients.push({ingredient_row_id:'water',canonical_status:'UNRESOLVED'});f.candidateRaw=JSON.stringify(c);
 f.freeze=buildPilotInputFreezeV1(f.candidateRaw,[f.model],readAdmissionContractSourcesV1());f.exact.freezeSha256=pilotDigestV1(pilotCanonicalV1(f.freeze));f.exact.rows.push({...f.exact.rows[0],rowId:'water',componentKind:'POTABLE_WATER',sourceRecord:'SR28:14411'});f.plan.rows.push({...f.plan.rows[0],rowId:'water',candidates:[]});
 const row=run(f).rows.find(r=>r.rowId==='water')!;assert.equal(row.proposedReviewRoute,'EXISTING_TYPED_NONFOOD_REVIEW_PATH');assert.equal(row.sourceDecimalMapping.fiber.value,'0.000');assert.equal(row.reviewEvent,null);assert.equal(row.proposedCanonicalFoodId,null);
});
test('source completeness never issues authority and existing runtime decoder refuses forged approval',async()=>{
 const r=run();assert.equal(r.summary.sourceApprovals,0);assert.equal(r.summary.admittedRecipes,0);assert.equal(r.summary.appliedBindings,0);assert.equal(r.recipeQuantitiesAndTotals,'NOT_MODIFIED_OR_RECALCULATED');
 for(const v of [r,{...r,sourceApproved:true,runtimePublishable:true,readyForServerSubmission:true}]){const raw=JSON.stringify(v);assert.throws(()=>nutritionReviewedRevisionCanonicalBytesRawV1(raw));await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
