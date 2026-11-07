import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPilotParallelDraftV2} from './pilot-parallel-catalog-draft-v2';
import {pilotDigestV1} from './pilot-admission-readiness-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
import {decodeGenerationPreparationContextRawV1} from '../../src/server/generationValidationAuthorityLoaderV1';

const stableFreeze='docs/premium/retained-sources/pilot19-admission-20261105/pilot-input-freeze-content-v4-20261106.json';
test('parallel draft contains exactly immutable 19 recipe pins and 10 review-only rows, never invented serving or nutrition',()=>{
 const raw=readFileSync(stableFreeze,'utf8');
 const original=JSON.parse(raw);
 const draft=buildPilotParallelDraftV2();
 assert.equal(draft.parentFreezeSha256,pilotDigestV1(raw));
 assert.equal(draft.originalCandidateSha256,original.candidateBytesSha256);
 assert.equal(draft.originalInputSetSha256,original.inputSetSha256);
 assert.equal(draft.recipeCount,19);
 assert.equal(draft.knownUnresolvedOccurrences,10);
 assert.equal(draft.originalRowDigestsAvailable,7);
 assert.equal(draft.originalRowRecheckRequired,3);
 assert.equal(draft.unrecoveredFullRecipes,19);
 assert.deepEqual(draft.recipes.map(r=>r.recipeId),original.recipes.map((r:{recipeId:string})=>r.recipeId));
 for(const recipe of draft.recipes){
  const pin=original.recipes.find((p:{recipeId:string})=>p.recipeId===recipe.recipeId);
  assert.equal(recipe.priorRecipeSha256,pin.authoringRecipeSha256);
  assert.equal(recipe.priorModelSha256,pin.modelSha256);
  assert.equal(recipe.expectedComponentRows,pin.componentRows);
  assert.equal(recipe.servings,null);
  assert.equal(recipe.declaredYieldG,null);
  assert.equal(recipe.ingredients,null);
  assert.equal(recipe.nutrition,null);
  assert.equal(recipe.recipeStatus,'INCOMPLETE_DRAFT_NOT_PUBLISHABLE');
  assert.ok(recipe.knownBlockedIngredients.every(x=>x.canonicalFoodId===null&&x.sourceApproval===null));
 }
 assert.equal(draft.catalogWrites,0);
 assert.equal(draft.sourceApprovals,0);
 assert.equal(draft.canApply,false);
 assert.equal(draft.mayActivate,false);
 assert.equal(draft.runtimePublishable,false);
});
test('parallel draft and forged approvals cannot impersonate reviewed publication or generation authority',async()=>{
 const draft=buildPilotParallelDraftV2();
 for(const v of [draft,{...draft,sourceApproved:true,runtimePublishable:true,canApply:true,readyForServerSubmission:true}]){
  const raw=JSON.stringify(v);
  await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));
  await assert.rejects(decodeGenerationPreparationContextRawV1(raw,'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'));
 }
});
