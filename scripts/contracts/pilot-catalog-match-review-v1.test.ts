import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPilotCatalogMatchesV1} from './pilot-catalog-match-review-v1';
import {buildPilotInputFreezeV1,readAdmissionContractSourcesV1} from './pilot-admission-readiness-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
function food(){return {id:A,canonical_food_id:A,name:'Груша',normalized_name:'груша',name_original:null,brand:null,source:'core',
 stable_food_id:'synthetic_pear',calories:'42.00',protein:'0.40',fat:'0.30',carbs:'10.90',fiber:null,
 cooking_state:'fresh',verified:true,suspicious:false,is_searchable:null as boolean|null,needs_review:null as boolean|null,aliases:null};}
function fixture(){
 const model:ReviewInputModelV1={recipeId:'synthetic',sourceCategory:'SNACK',declaredServings:1,sourceApproved:false,runtimePublishable:false,
 rows:[{component:{rowId:'row1',status:'DECLARED_SOURCE_INPUT_MODEL',componentKind:'FOOD',sourceRecord:'SYNTHETIC',vector:{calories:'57',protein:'0.36',fat:'0.14',carbs:'12.13',fiber:'3.1'},quantityG:'100',quantityDecision:'DECLARED_GRAMS',optional:false}}],calculation:{perDeclaredServing:null}};
 model.calculation=calculatePreciseInputV3(model.rows.map(r=>r.component),1);
 const candidate={originalAuthoringCatalog:{recipes:[{recipeId:'synthetic',declaredServings:1,sourceRecipe:{meal_type_primary:'SNACK'},ingredients:[{ingredient_row_id:'row1',canonical_status:'UNRESOLVED',ingredient_name_ru:'Груша',ingredient_name_en:'pear'}]}]}};
 const snapshot={contract:'potok-shared-catalog-lookup-snapshot-v1',environment:'STAGING',projectId:'synthetic',capturedAt:'2026-11-05T12:00:00Z',sharedFoodCount:2,schemaHasReviewFlags:true,readOnly:true,readScope:'SHARED_CORE_BRAND_ONLY_NO_USER_ROWS',
 queries:[{key:'груша',nameRows:[food()],aliasRows:[] as ReturnType<typeof food>[],nameCount:1,aliasCount:0,unavailableAliasCount:0},{key:'pear',nameRows:[] as ReturnType<typeof food>[],aliasRows:[] as ReturnType<typeof food>[],nameCount:0,aliasCount:0,unavailableAliasCount:0}]};
 return {model,candidate,snapshot};
}
function run(f=fixture(),raw?:string){const candidateRaw=JSON.stringify(f.candidate),models=[f.model],freeze=buildPilotInputFreezeV1(candidateRaw,models,readAdmissionContractSourcesV1());return reviewPilotCatalogMatchesV1(candidateRaw,models,JSON.stringify(freeze),raw??JSON.stringify(f.snapshot));}
test('exact candidate keeps missing fiber, differences, unknown flags and null binding; inputs immutable',()=>{
 const f=fixture(),before=JSON.stringify(f),r=run(f),row=r.rows[0],c=row.candidateObservations[0];
 assert.equal(row.identityStatus,'EXACT_CANDIDATE');assert.equal(c.availability,'UNKNOWN_NOT_PROVEN');assert.equal(c.nutrition.fiber.comparison,'MISSING_OR_INVALID');assert.equal(c.nutrition.calories.comparison,'DIFFERENT_VALUE');
 assert.equal(row.proposedCanonicalFoodId,null);assert.equal(r.summary.appliedBindings,0);assert.equal(r.summary.admittedRecipes,0);assert.equal(JSON.stringify(f),before);
});
test('different language exact identities and conflicting aliases stay ambiguous regardless of order',()=>{
 const f=fixture(),other={...food(),id:B,canonical_food_id:B,name:'Pear',normalized_name:'pear'};f.snapshot.queries[1].nameRows=[other];f.snapshot.queries[1].nameCount=1;
 assert.equal(run(f).rows[0].identityStatus,'AMBIGUOUS');f.snapshot.queries.reverse();assert.equal(run(f).rows[0].identityStatus,'AMBIGUOUS');
});
test('name/alias duplicate UUID is one candidate; alias-only remains eligible',()=>{
 const f=fixture(),alias={...food(),alias_id:B,normalized_alias:'pear',alias_verified:false};f.snapshot.queries[1].aliasRows=[alias];f.snapshot.queries[1].aliasCount=1;
 assert.equal(run(f).rows[0].identityStatus,'EXACT_CANDIDATE');assert.equal(run(f).rows[0].candidateObservations.length,1);
 f.snapshot.queries[0].nameRows=[];f.snapshot.queries[0].nameCount=0;assert.equal(run(f).rows[0].identityStatus,'EXACT_CANDIDATE');
});
test('a competing alias to another root cannot be hidden by an exact name',()=>{
 const f=fixture();const alias={...food(),id:B,canonical_food_id:B,name:'Other',normalized_name:'other',alias_id:A,normalized_alias:'груша'};
 f.snapshot.queries[0].aliasRows=[alias];f.snapshot.queries[0].aliasCount=1;
 assert.equal(run(f).rows[0].identityStatus,'AMBIGUOUS');assert.equal(run(f).rows[0].proposedCanonicalFoodId,null);
});
test('invalid and missing nutrient text remains explicit without replacing it with zero',()=>{
 for(const value of [null,'','NaN','-1']){const f=fixture();Object.assign(f.snapshot.queries[0].nameRows[0],{protein:value});const r=run(f).rows[0];assert.equal(r.candidateObservations[0].nutrition.protein.catalog,value);assert.equal(r.candidateObservations[0].nutrition.protein.comparison,'MISSING_OR_INVALID');assert.equal(r.sourceApproved,false);}
});
test('incomplete counts and snapshot drift fail closed',()=>{
 for(const mode of ['COUNT','DRIFT','DUPLICATE_QUERY','DUPLICATE_ROW']){const f=fixture();if(mode==='COUNT')f.snapshot.queries[0].nameCount=2;if(mode==='DRIFT'){f.snapshot.queries[1].aliasRows=[{...food(),calories:'58',alias_id:B,normalized_alias:'pear'} as ReturnType<typeof food>];f.snapshot.queries[1].aliasCount=1;}if(mode==='DUPLICATE_QUERY')f.snapshot.queries.push(f.snapshot.queries[0]);if(mode==='DUPLICATE_ROW'){f.snapshot.queries[0].nameRows.push(food());f.snapshot.queries[0].nameCount=2;}assert.throws(()=>run(f));}
});
test('missing query and unavailable alias targets cannot resolve',()=>{
 const f=fixture();f.snapshot.queries.pop();assert.equal(run(f).rows[0].identityStatus,'LOOKUP_INCOMPLETE');
 const g=fixture();g.snapshot.queries[1].unavailableAliasCount=1;assert.equal(run(g).rows[0].identityStatus,'LOOKUP_INCOMPLETE');
});
test('private and user-owned shared-labelled rows reject the snapshot',()=>{
 for(const patch of [{source:'user'},{created_by_user_id:A}]){const f=fixture();Object.assign(f.snapshot.queries[0].nameRows[0],patch);assert.throws(()=>run(f));}
});
test('review flags and broken root never become usable exact candidates',()=>{
 for(const patch of [{is_searchable:false},{needs_review:true},{canonical_food_id:B}]){const f=fixture();Object.assign(f.snapshot.queries[0].nameRows[0],patch);const r=run(f);assert.equal(r.rows[0].identityStatus,'NO_ELIGIBLE_EXACT_MATCH');assert.equal(r.rows[0].candidateObservations.length,1);}
});
test('explicit flags and equal vectors still do not prove state, source or account RLS access',()=>{
 const f=fixture();Object.assign(f.snapshot.queries[0].nameRows[0],f.model.rows[0].component.vector,{is_searchable:true,needs_review:false});
 const r=run(f),c=r.rows[0].candidateObservations[0];assert.equal(c.availability,'EXPLICIT_FLAGS_ALLOW');assert.equal(c.nutrition.fiber.comparison,'EQUAL_VALUE_ONLY');assert.equal(c.stateEquivalence,'NOT_REVIEWED');assert.equal(r.sourceApproved,false);assert.equal(r.accountRlsAccessibility,'NOT_TESTED_BY_PRIVILEGED_SHARED_CATALOG_READ');
 f.snapshot.schemaHasReviewFlags=false;assert.equal(run(f).rows[0].candidateObservations[0].availability,'UNKNOWN_NOT_PROVEN');
});
test('no exact result is a lookup observation, never full catalog absence',()=>{
 const f=fixture();f.snapshot.queries[0].nameRows=[];f.snapshot.queries[0].nameCount=0;const r=run(f).rows[0];assert.equal(r.identityStatus,'NO_EXACT_MATCH');assert.match(r.lookupScope,/NOT_FULL_CATALOG_ABSENCE/);
});
test('typed nonfood keeps a distinct evidence route and no zero/fiber invention',()=>{
 const f=fixture();f.model.rows.push({component:{...f.model.rows[0].component,rowId:'row2'}});f.candidate.originalAuthoringCatalog.recipes[0].ingredients.push({...f.candidate.originalAuthoringCatalog.recipes[0].ingredients[0],ingredient_row_id:'row2'});f.model.rows[0].component.componentKind='POTABLE_WATER';Object.assign(f.model.rows[0].component,{sourceRecord:'SR28:14411',quantityDecision:'TYPED_WATER_ZERO_NO_GRAM_CONVERSION',quantityG:null});f.model.rows[0].component.vector={calories:'0',protein:'0',fat:'0',carbs:'0',fiber:'0'};f.model.calculation=calculatePreciseInputV3(f.model.rows.map(r=>r.component),1);const r=run(f).rows[0];assert.equal(r.requiredReview,'EXISTING_TYPED_NONFOOD_REVIEW_OR_REVIEWED_CANONICAL_PATH');assert.equal(r.candidateObservations[0].nutrition.fiber.catalog,null);assert.equal(r.proposedStableFoodId,null);
});
test('bad snapshot scope, wrong exact rows, duplicate raw keys and malformed flags reject',()=>{
 for(const mode of ['SCOPE','NAME','FLAG','RAW']){const f=fixture();if(mode==='SCOPE')f.snapshot.readScope='ALL_USERS';if(mode==='NAME')f.snapshot.queries[0].nameRows[0].normalized_name='груши';if(mode==='FLAG')Object.assign(f.snapshot.queries[0].nameRows[0],{needs_review:'false'});const raw=JSON.stringify(f.snapshot);assert.throws(()=>run(f,mode==='RAW'?raw.replace('"readOnly":','"readOnly":false,"readOnly":'):raw));}
});
test('actual runtime authority decoder rejects observations and forged promotion',async()=>{
 const r=run();for(const v of [r,{...r,sourceApproved:true,runtimePublishable:true,readyForServerSubmission:true}]){const raw=JSON.stringify(v);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
