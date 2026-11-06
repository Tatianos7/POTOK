import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPilotInputFreezeV1,inspectPilotAdmissionReadinessV1,verifyPilotInputFreezeV1,readAdmissionContractSourcesV1,readPilotFreezeRawV1,pilotCanonicalV1,pilotDigestV1,admissionContractPathsV1} from './pilot-admission-readiness-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
import {decodeGenerationPreparationContextRawV1} from '../../src/server/generationValidationAuthorityLoaderV1';
import {auditCuratedRecipePublicationV1,curatedRecipePublicationContractV1,type CuratedRecipeAuthoringV1} from '../../src/utils/curatedRecipePublicationV1';
import {decodeGraphRecipeSnapshotV1} from '../../src/utils/adaptiveNutritionGraphV1';
const sources=readAdmissionContractSourcesV1();
function fixture(){
 const models:ReviewInputModelV1[]=Array.from({length:19},(_,n)=>{
  const recipeId='synthetic_pilot_'+n,rows=[{component:{rowId:recipeId+'_food',status:'DECLARED_SOURCE_INPUT_MODEL' as const,componentKind:'FOOD' as const,sourceRecord:'SYNTHETIC_NOT_APPROVED',vector:{calories:'123.456789',protein:'12',fat:'3',carbs:'11',fiber:'4'},quantityG:'73',quantityDecision:'DECLARED_GRAMS',optional:false}},
  {component:{rowId:recipeId+'_water',status:'DECLARED_SOURCE_INPUT_MODEL' as const,componentKind:'POTABLE_WATER' as const,sourceRecord:'SR28:14411',vector:{calories:'0',protein:'0',fat:'0',carbs:'0',fiber:'0'},quantityG:null,quantityDecision:'TYPED_WATER_ZERO_NO_GRAM_CONVERSION',optional:false}}];
  return {recipeId,rows,sourceCategory:'LUNCH',declaredServings:3,calculation:calculatePreciseInputV3(rows.map(r=>r.component),3),sourceApproved:false,runtimePublishable:false};
 });
 const raw=JSON.stringify({originalAuthoringCatalog:{recipes:models.map(m=>({recipeId:m.recipeId,sourceRecipe:{meal_type_primary:m.sourceCategory},declaredServings:m.declaredServings,ingredients:m.rows.map(r=>({ingredient_row_id:r.component.rowId,canonical_status:'UNRESOLVED'}))}))}});
 const freeze=buildPilotInputFreezeV1(raw,models,sources),freezeRaw=JSON.stringify(freeze);return {models,raw,freeze,freezeRaw};
}
test('freeze pins all private input bytes, complete model objects and each server source',()=>{
 const {raw,models,freeze,freezeRaw}=fixture();assert.equal(freeze.recipes.length,19);assert.equal(freeze.serverContracts.length,7);
 assert.deepEqual(verifyPilotInputFreezeV1(raw,[...models].reverse(),freezeRaw,sources),freeze);
 const serialized=JSON.stringify(freeze);assert.ok(!serialized.includes('quantityG'));assert.ok(!serialized.includes('123.456789'));assert.ok(!serialized.includes('SYNTHETIC_NOT_APPROVED'));
});
test('checked-in pilot contains exactly19 unique opaque recipe bindings and current source digests',()=>{
 const f=JSON.parse(readPilotFreezeRawV1());assert.equal(f.recipes.length,19);assert.equal(new Set(f.recipes.map((r:{recipeId:string})=>r.recipeId)).size,19);
 assert.equal(f.recipes.reduce((s:number,r:{componentRows:number})=>s+r.componentRows,0),88);
 assert.equal(f.serverContracts.length,admissionContractPathsV1.length);
 for(const path of admissionContractPathsV1)assert.equal(f.serverContracts.find((x:{path:string})=>x.path===path).sha256,pilotDigestV1(sources[path]));
 for(const r of f.recipes){assert.match(r.modelSha256,/^[a-f0-9]{64}$/);assert.match(r.authoringRecipeSha256,/^[a-f0-9]{64}$/);}
});
test('changed bytes, recipe scope, model metadata and server contracts fail closed',()=>{
 for(const mode of ['BYTES','SCOPE','MODEL','CONTRACT']){const {raw,models,freezeRaw}=fixture(),changed={...sources};if(mode==='SCOPE')models.pop();if(mode==='MODEL')Object.assign(models[0],{extra:'changed'});if(mode==='CONTRACT')changed[admissionContractPathsV1[0]]+='\n';assert.throws(()=>verifyPilotInputFreezeV1(raw+(mode==='BYTES'?' ':''),models,freezeRaw,changed));}
});
test('forged freeze flags, extra fields, duplicate JSON keys and changed digests reject',()=>{
 for(const mode of ['FLAG','EXTRA','DIGEST']){const {raw,models,freeze}=fixture();if(mode==='FLAG')Object.assign(freeze,{readyForServerSubmission:true});if(mode==='EXTRA')Object.assign(freeze,{approved:true});if(mode==='DIGEST')freeze.recipes[0].modelSha256='0'.repeat(64);assert.throws(()=>verifyPilotInputFreezeV1(raw,models,JSON.stringify(freeze),sources));}
 const {raw,models,freezeRaw}=fixture();assert.throws(()=>verifyPilotInputFreezeV1(raw,models,freezeRaw.replace('"contract":','"contract":"duplicate","contract":'),sources));assert.throws(()=>buildPilotInputFreezeV1(raw.replace('{','{"originalAuthoringCatalog":{},'),models,sources));
});
test('forged input approval, arithmetic, identity status and duplicate rows reject',()=>{
 for(const mode of ['FLAG','ROW_FLAG','ARITHMETIC','IDENTITY','DUPLICATE']){const {raw,models}=fixture();let input=raw;if(mode==='FLAG')models[0].sourceApproved=true;if(mode==='ROW_FLAG')Object.assign(models[0].rows[0],{runtimePublishable:true});if(mode==='ARITHMETIC')models[0].calculation.perDeclaredServing!.calories='1.00000000';if(mode==='IDENTITY')input=raw.replace('UNRESOLVED','NOT_APPLICABLE');if(mode==='DUPLICATE')models[0].rows.push(models[0].rows[0]);assert.throws(()=>buildPilotInputFreezeV1(input,models,sources));}
});
test('water zero is not non-food approval, invented grams, or canonical identity',()=>{
 const {raw,models,freezeRaw}=fixture(),before=pilotCanonicalV1([raw,models]),r=inspectPilotAdmissionReadinessV1(raw,models,freezeRaw,sources);
 assert.equal(r.summary.admittedRecipes,0);assert.equal(r.summary.potableWaterRows,19);assert.equal(r.currentAccountAndRequestContext,null);
 for(const recipe of r.recipes){assert.equal(recipe.rows[1].approvedNonFoodEvidence,'NOT_SUPPLIED_IN_INPUT_MODEL');assert.equal(recipe.rows[1].publicationNormalization,'ML_WITHOUT_GRAMS_REQUIRES_COMPATIBILITY_REVIEW');assert.ok(Object.values(recipe.evidence).every(v=>v===null));assert.equal(recipe.physicalCookingValidation,'DEFERRED_TO_OWNER_PRELAUNCH_NOT_AN_OFFLINE_GATE');}
 assert.equal(pilotCanonicalV1([raw,models]),before);
});
test('precision inventory preserves original strings and never rounds or allocates contributions',()=>{
 const {raw,models,freezeRaw}=fixture(),before=models[0].calculation.perDeclaredServing!.calories,r=inspectPilotAdmissionReadinessV1(raw,models,freezeRaw,sources);
 assert.ok(r.recipes.every(x=>x.precision.nonzeroBeyondThreeAxes.includes('calories')));assert.equal(models[0].calculation.perDeclaredServing!.calories,before);
 assert.equal(r.recipes[0].precision.mappingPolicy,'NOT_SUPPLIED_NO_ROUNDING_OR_CONTRIBUTION_ALLOCATION_APPLIED');
});
test('real server decoders reject inventory, freeze and forged promotion flags',async()=>{
 const {raw,models,freezeRaw,freeze}=fixture(),r=inspectPilotAdmissionReadinessV1(raw,models,freezeRaw,sources);
 for(const p of [freeze,r,{...r,sourceApproved:true,runtimePublishable:true,readyForServerSubmission:true,mayActivate:true}]){const bytes=JSON.stringify(p);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(bytes,bytes));await assert.rejects(decodeGenerationPreparationContextRawV1(bytes,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));}
});
// Synthetic UUIDs and approvals below exercise contracts only; none is emitted
// into the real pilot freeze or readiness packet.
const uid=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
const zero={calories:'0.000',protein:'0.000',fat:'0.000',carbs:'0.000',fiber:'0.000'};
const nonzero={...zero,calories:'100.000'};
function authoring():CuratedRecipeAuthoringV1{
 const nutrition={...nonzero,basis:'full_recipe' as const,authority:'reviewed' as const,evidenceRef:'synthetic:nutrition',evidenceDigest:'a'.repeat(64)};
 return {contract:curatedRecipePublicationContractV1,authoringRecipeId:'synthetic_compatibility',nameRu:'Тест',nameEn:'Test',description:'Synthetic fixture only',status:'REVIEWED',baseYield:{servings:'1.000',servingLabel:'test',totalWeightG:null,servingWeightG:null},nutrition,
 ingredients:[{ingredientRowId:'synthetic_food',sortOrder:0,nameRu:'Тест',nameEn:'Test',amount:'1.000',unit:'g',weightG:'1.000',optional:false,preparationNote:null,state:'raw',componentKind:'food',foodStableId:'synthetic_food',canonicalStatus:'RESOLVED',canonical:{foodStableId:'synthetic_food',canonicalFoodId:uid(1),source:'core',sharedCatalogAccessible:true,evidenceRevision:'synthetic',evidenceDigest:'a'.repeat(64)},approvedNonFoodEvidenceRef:null,normalizationEvidenceRef:null,nutrition,scalingMode:'continuous',discreteIncrement:null}],
 steps:[{stepRowId:'step',stepOrder:1,instruction:'Test',durationMinutes:null,temperatureCelsius:null}],tags:[],eligibility:{collectionVisible:true,planEligible:true,allowedMealTypes:['lunch']},safety:{allergenReview:'reviewed',allergenEvidenceRef:'synthetic',dietaryReview:'reviewed',dietaryEvidenceRef:'synthetic'},source:{workbookRevision:'synthetic',recipeEvidenceRef:'synthetic'}};
}
test('real publication audit accepts deferred physical weights with otherwise reviewed synthetic data',()=>{
 const a=authoring(),r=auditCuratedRecipePublicationV1(a);assert.equal(r.status,'READY_FOR_PUBLICATION');assert.ok(!r.blockers.some(b=>b.code==='YIELD_CONFLICT'));
});
test('ML normalization differs between existing graph and publication audit, without changing either gate',()=>{
 const a=authoring();a.ingredients.push({...a.ingredients[0],ingredientRowId:'synthetic_water',sortOrder:1,componentKind:'approved_non_food',canonicalStatus:'NOT_APPLICABLE',canonical:null,foodStableId:null,amount:'47.000',unit:'ml',weightG:null,normalizationEvidenceRef:null,approvedNonFoodEvidenceRef:'synthetic:only',nutrition:{...a.nutrition,...zero}});
 const blockers=auditCuratedRecipePublicationV1(a).blockers;assert.ok(blockers.some(b=>b.code==='SOURCE_CONFLICT'&&b.path==='ingredients[1].normalization'));assert.ok(!blockers.some(b=>b.code==='YIELD_CONFLICT'));
 const snapshot={recipeId:uid(2),recipeRevisionId:uid(3),displayNameSnapshot:'Synthetic',baseYield:{servings:'1.000',servingLabel:'test',totalYieldGrams:null},fullRecipeNutrition:nonzero,
 ingredients:a.ingredients.map((i,n)=>({componentId:uid(4+n),recipeRevisionId:uid(3),identity:n===0?{kind:'canonical_food',canonicalFoodId:uid(1)}:{kind:'approved_non_food',componentDefinitionId:uid(6)},displayNameSnapshot:'Synthetic',state:'raw',quantity:{amount:i.amount,unit:i.unit},normalizedGrams:i.weightG,normalizationEvidenceRef:null,scaling:{mode:'continuous'},nutrition:n===0?nonzero:zero,sortOrder:n}))};
 assert.equal(decodeGraphRecipeSnapshotV1(snapshot).ingredients[1].normalizedGrams,null);
 snapshot.ingredients[1].normalizedGrams='47.000';assert.throws(()=>decodeGraphRecipeSnapshotV1(snapshot),/normalization_requires_evidence/);
});
test('resolved authoring labels alone never create reviewed canonical receipts',()=>{
 const {raw,models}=fixture(),changed=raw.replaceAll('UNRESOLVED','RESOLVED'),freeze=JSON.stringify(buildPilotInputFreezeV1(changed,models,sources));
 const r=inspectPilotAdmissionReadinessV1(changed,models,freeze,sources);assert.equal(r.summary.authoringUnresolvedRows,0);assert.equal(r.summary.admittedRecipes,0);
 assert.ok(r.recipes.every(x=>x.rows.every(row=>row.identityEvidence==='NOT_SUPPLIED_IN_INPUT_MODEL')));
});
test('reviewed-looking nutrition without reviewed authority is blocked by the real publisher',()=>{
 const a=authoring();a.nutrition.authority='reference_only';a.ingredients[0].nutrition={...a.ingredients[0].nutrition,authority:'reference_only'};
 assert.ok(auditCuratedRecipePublicationV1(a).blockers.some(b=>b.code==='SOURCE_CONFLICT'));
});
test('water cannot gain invented grams or nonzero nutrition through a recomputed freeze',()=>{
 for(const mode of ['MASS','NUTRIENT']){const {raw,models}=fixture();if(mode==='MASS')models[0].rows[1].component.quantityG='47';if(mode==='NUTRIENT')models[0].rows[1].component.vector!.calories='1';assert.throws(()=>buildPilotInputFreezeV1(raw,models,sources));}
});

test('content V4 source rebind preserves original private input and all 19 recipe pins without promotion',()=>{
 const originalRaw=readFileSync(new URL('../../docs/premium/retained-sources/pilot19-admission-20261105/pilot-input-freeze-v1.json',import.meta.url),'utf8');
 assert.equal(pilotDigestV1(originalRaw),'c231a7c21d17d44d6cbad1bc9524ce7f83cb16f5508b99846e3d8f3da54186fe');
 const original=JSON.parse(originalRaw),current=JSON.parse(readPilotFreezeRawV1());
 const {serverContracts:oldSources,...oldInputs}=original,{serverContracts:newSources,...newInputs}=current;
 assert.deepEqual(newInputs,oldInputs);assert.deepEqual(newSources.map((s:{path:string})=>s.path),oldSources.map((s:{path:string})=>s.path));
 for(const source of newSources)assert.equal(source.sha256,pilotDigestV1(sources[source.path]));
});
