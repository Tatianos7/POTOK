/** Cross-version integration only. All identities, retained bytes and approvals are synthetic. */
import test from 'node:test';import assert from 'node:assert/strict';
import {exactFoodFixtureV2,raw,id} from './exactFoodNutritionFixturesV2';
import {decodeFoodEvidenceReviewRequestRawV1,foodReviewProposalDigestV1,type NutritionFoodReviewProposalV1} from '../foodEvidenceReviewRequestV1';
import {verifyFoodEvidenceReceiptV1} from '../foodEvidenceReviewGatewayV1';
import {resolveExactFoodNutritionReviewedSnapshotV2} from '../exactFoodNutritionReviewedAdapterV2';
import {decodeNonFoodRequestV1} from '../nonFoodEvidenceV1';
import {nutritionRequest} from './nonFoodEvidenceFixturesV1';
async function legacyRequest(){
 const f=await exactFoodFixtureV2('PER_100_G_EDIBLE');
 const proposal:NutritionFoodReviewProposalV1={contract:'potok-nutrition-review-proposal-v1',canonicalFoodId:f.canonical.foodId,
  canonicalRevisionId:f.canonical.revisionId,canonicalRevisionDigest:f.canonical.digest,nutrition:{calories:'100.000',protein:'10.000',fat:'1.000',carbs:'5.000',fiber:'2.000'},
  basis:'PER_100_G_EDIBLE',units:{calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g'},applicability:f.canonical.applicability,foodState:f.canonical.foodState};
 const request={contract:'potok-food-evidence-review-request-v1',kind:'REVIEW_APPROVED',idempotencyReference:id(220001),proposal,
  proposalDigest:await foodReviewProposalDigestV1(proposal),expectedHead:null,retainedSource:f.source};
 return {f,request};
}
test('legacy Food issuer keeps its existing three-place request contract after integration',async()=>{
 const {request}=await legacyRequest();assert.deepEqual(await decodeFoodEvidenceReviewRequestRawV1(raw(request)),request);
});
test('exact source decimals cannot enter the legacy issuer through the new generator branch',async()=>{
 const {f,request}=await legacyRequest(),before=raw(f.input);
 await assert.rejects(decodeFoodEvidenceReviewRequestRawV1(raw({...request,proposal:{...request.proposal,nutrition:f.input.mappedDecimalText}})),/DECIMAL/);
 assert.equal(raw(f.input),before);assert.equal(f.input.mappedDecimalText.calories,'378.866123');
});
test('V2 approval remains V2: exact atomic read works, while the V1 receipt gateway rejects coercion',async()=>{
 const {f,request}=await legacyRequest();const decoded=await decodeFoodEvidenceReviewRequestRawV1(raw(request));
 const exact=await resolveExactFoodNutritionReviewedSnapshotV2(f.snapshot,{isAuthorizedEvent:async()=>true});assert.equal(exact.kind,'REVIEWED_EXACT_V2');
 await assert.rejects(verifyFoodEvidenceReceiptV1(decoded,f.na.authorityContext.actorId,{contract:'potok-food-evidence-review-receipt-v1',event:f.na,
  revision:f.revision,canonicalRevision:f.canonical,proposalTarget:null,replayed:false}));
 assert.equal((await resolveExactFoodNutritionReviewedSnapshotV2(f.snapshot,{isAuthorizedEvent:async()=>false})).kind,'UNRESOLVED');
});
test('typed water/salt issuer cannot become an alternate food nutrition writer',async()=>{
 const request=nutritionRequest(id(220010),id(220011),'a'.repeat(64));assert.deepEqual(await decodeNonFoodRequestV1(raw(request)),request);
 const sourceValues={...request.proposal.kind==='NUTRITION'?request.proposal.sourceValues:{},calories:'100.000'};
 await assert.rejects(decodeNonFoodRequestV1(raw({...request,proposal:{...request.proposal,sourceValues,nutrition:sourceValues}})));
});
