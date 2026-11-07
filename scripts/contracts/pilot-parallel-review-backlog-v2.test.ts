import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPilotV2ReviewBacklog} from './pilot-parallel-review-backlog-v2';
import {buildPilotParallelDraftV2} from './pilot-parallel-catalog-draft-v2';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
import {decodeGenerationPreparationContextRawV1} from '../../src/server/generationValidationAuthorityLoaderV1';
test('V2 review backlog preserves the immutable scope with ten source-specific tasks and no invented nutrition',()=>{
 const q=buildPilotV2ReviewBacklog(),draft=buildPilotParallelDraftV2();
 assert.equal(q.recipeCount,19);assert.equal(q.knownSourceTasks,10);
 assert.equal(q.originalRowRecheckNeeded,3);
 assert.equal(q.parentFreezeSha256,draft.parentFreezeSha256);
 assert.equal(q.families.length,5);
 assert.deepEqual(q.families.map(f=>f.rowReviewTasks).sort((a,b)=>a-b),[1,2,2,2,3]);
 assert.deepEqual(q.recipeIntake.map(r=>r.recipeId),draft.recipes.map(r=>r.recipeId));
 assert.ok(q.recipeIntake.every(r=>!r.fullOriginalIngredientListVerified&&
  !r.declaredServingsVerified&&!r.yieldAndCookingVerified&&
  !r.allergenAndDietaryEvidenceVerified&&!r.nutritionVerified));
 assert.ok(q.tasks.every(r=>r.selectedFoodId===null&&r.weightG===null&&r.macroValues===null&&
  r.evidenceRequired.includes('CARBS_EXCLUDE_FIBER_PER_100G')&&
  r.evidenceRequired.includes('SOURCE_REVISION_AND_DIGEST')));
 assert.equal(q.approvedBindings,0);assert.equal(q.catalogWrites,0);
 assert.equal(q.readyForServerSubmission,false);
 assert.equal(q.runtimePublishable,false);assert.equal(q.mayActivate,false);
});
test('no V2 backlog or forged promoted copy crosses authoritative recipe publication boundary',async()=>{
 const q=buildPilotV2ReviewBacklog();
 for(const payload of [q,{...q,sourceApproved:true,runtimePublishable:true,canApply:true}]){
  const raw=JSON.stringify(payload);
  await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));
  await assert.rejects(decodeGenerationPreparationContextRawV1(raw,'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'));
 }
});
