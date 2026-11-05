import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPilotDiscoveryV1} from './pilot-catalog-discovery-review-v1';
import {pilotDigestV1} from './pilot-admission-readiness-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const flags={sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false};
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function fixture(){
 const exact={contract:'potok-pilot-catalog-match-review-v1',freezeSha256:'0'.repeat(64),observation:{environment:'STAGING',projectId:'synthetic'},rows:[{recipeId:'r',rowId:'row',keys:['куриная грудка'],sourceRecord:'UNAPPROVED_SOURCE',identityStatus:'NO_EXACT_MATCH',proposedCanonicalFoodId:null,proposedStableFoodId:null,...flags}],...flags};
 const snapshot={contract:'potok-shared-catalog-discovery-snapshot-v1',environment:'STAGING',projectId:'synthetic',readOnly:true,readScope:'SHARED_CORE_BRAND_ONLY_NO_USER_ROWS',capturedAt:'2026-11-05T12:00:00Z',rows:[{id,canonical_food_id:id,source:'core',name:'Куриная грудка',stable_food_id:'chicken_breast',cooking_state:'raw',data_source:'SYNTHETIC',source_version:null,verified:true,suspicious:false,is_searchable:null as boolean|null,needs_review:null as boolean|null,calories:'100',protein:'20',fat:'2',carbs:'0',fiber:null as string|null}]};
 const plan={contract:'potok-pilot-discovery-review-plan-v1',exactReviewSha256:'',snapshotSha256:'',rows:[{rowId:'row',expectedCatalogStateLabels:['raw'],remainingAttributes:['skinless'],candidates:[{stableId:'chicken_breast',disposition:'POTENTIAL',reason:'same family only'}]}]};
 return {exact,snapshot,plan};
}
function run(f=fixture(),planRaw?:string){const e=JSON.stringify(f.exact),s=JSON.stringify(f.snapshot);f.plan.exactReviewSha256=pilotDigestV1(e);f.plan.snapshotSha256=pilotDigestV1(s);return reviewPilotDiscoveryV1(e,s,planRaw??JSON.stringify(f.plan));}
test('one observed label stays a candidate with missing attributes, nutrients and null bindings',()=>{
 const f=fixture(),before=JSON.stringify(f.snapshot),r=run(f),row=r.rows[0],o=row.candidates[0].observations[0];assert.equal(r.summary.targetRows,1);assert.equal(r.summary.rowsWithPotentialObservations,1);assert.equal(o.stateLabelFinding,'EXPECTED_LABEL_OBSERVED_NOT_EQUIVALENCE');assert.deepEqual(o.missingOrInvalidNutrition,['fiber']);assert.equal(o.explicitFlags,'UNKNOWN');assert.equal(row.proposedCanonicalFoodId,null);assert.deepEqual(row.remainingAttributes,['skinless']);assert.equal(JSON.stringify(f.snapshot),before);
});
test('duplicate stable key remains multiple observations; never selects an identity',()=>{
 const f=fixture();f.snapshot.rows.push({...f.snapshot.rows[0],id:other,canonical_food_id:other});const r=run(f);assert.equal(r.rows[0].candidates[0].discoveryStatus,'MULTIPLE_CATALOG_ROWS');assert.equal(r.rows[0].proposedStableFoodId,null);
});
test('unknown state, wrong state and contradictory raw/cooked labels stay distinct',()=>{
 for(const [state,name,expected] of [['unknown','Куриная грудка','STATE_LABEL_UNKNOWN'],['boiled','Куриная грудка вареная','STATE_LABEL_CONFLICT'],['raw','Куриная грудка на пару','CATALOG_NAME_STATE_CONFLICT']]){const f=fixture();Object.assign(f.snapshot.rows[0],{cooking_state:state,name});assert.equal(run(f).rows[0].candidates[0].observations[0].stateLabelFinding,expected);}
});
test('excluded variants are retained and never count as potential coverage',()=>{
 const f=fixture();f.plan.rows[0].candidates[0].disposition='EXCLUDED_VARIANT';const r=run(f);assert.equal(r.summary.rowsWithPotentialObservations,0);assert.equal(r.rows[0].candidates[0].observations.length,1);
});
test('missing selection is only absence from this capture',()=>{
 const f=fixture();f.snapshot.rows=[];const r=run(f);assert.equal(r.rows[0].candidates[0].discoveryStatus,'NOT_OBSERVED_IN_CAPTURE');assert.equal(r.summary.rowsWithoutPotentialObservations,1);assert.match(r.captureScope,/NOT_EXHAUSTIVE/);
});
test('all unmatched rows must be covered exactly once without unknown targets',()=>{
 for(const mode of ['MISSING','DUPLICATE','UNKNOWN','ALREADY_EXACT']){const f=fixture();if(mode==='MISSING')f.plan.rows=[];if(mode==='DUPLICATE')f.plan.rows.push(f.plan.rows[0]);if(mode==='UNKNOWN')f.plan.rows[0].rowId='foreign';if(mode==='ALREADY_EXACT')f.exact.rows[0].identityStatus='EXACT_CANDIDATE';assert.throws(()=>run(f));}
});
test('cross environment/project, private rows, duplicate IDs and promotions reject',()=>{
 for(const patch of ['ENV','PROJECT','PRIVATE','OWNER','DUPLICATE','PROMOTION','BOUND']){const f=fixture();if(patch==='ENV')f.snapshot.environment='PRODUCTION';if(patch==='PROJECT')f.snapshot.projectId='other';if(patch==='PRIVATE')f.snapshot.rows[0].source='user';if(patch==='OWNER')Object.assign(f.snapshot.rows[0],{created_by_user_id:id});if(patch==='DUPLICATE')f.snapshot.rows.push(f.snapshot.rows[0]);if(patch==='PROMOTION')f.exact.sourceApproved=true;if(patch==='BOUND')Object.assign(f.exact.rows[0],{proposedCanonicalFoodId:id});assert.throws(()=>run(f));}
});
test('changed inputs, duplicate JSON keys, repeated selections and invalid disposition reject',()=>{
 const f=fixture();run(f);const e=JSON.stringify(f.exact),s=JSON.stringify(f.snapshot),p=JSON.stringify(f.plan);assert.throws(()=>reviewPilotDiscoveryV1(e+' ',s,p));assert.throws(()=>reviewPilotDiscoveryV1(e,s+' ',p));assert.throws(()=>reviewPilotDiscoveryV1(e,s,p.replace('"contract":','"contract":"other","contract":')));
 for(const mode of ['DUPLICATE','DISPOSITION']){const g=fixture();if(mode==='DUPLICATE')g.plan.rows[0].candidates.push(g.plan.rows[0].candidates[0]);else g.plan.rows[0].candidates[0].disposition='APPROVED';assert.throws(()=>run(g));}
});
test('allow flags, a complete zero axis and self-root do not issue evidence',()=>{
 const f=fixture();Object.assign(f.snapshot.rows[0],{is_searchable:true,needs_review:false,fiber:'0'});const r=run(f),o=r.rows[0].candidates[0].observations[0];assert.equal(o.explicitFlags,'ALLOW_FLAGS_ONLY');assert.deepEqual(o.missingOrInvalidNutrition,[]);assert.equal(o.evidenceAndStateEquivalence,'NOT_VERIFIED');assert.equal(r.summary.appliedBindings,0);assert.equal(r.summary.admittedRecipes,0);for(const k of Object.keys(flags))assert.equal((r as unknown as Record<string,unknown>)[k],false);
});
test('existing runtime authority decoder rejects both discovery and forged approvals',async()=>{
 const r=run();for(const v of [r,{...r,sourceApproved:true,runtimePublishable:true}]){const raw=JSON.stringify(v);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
