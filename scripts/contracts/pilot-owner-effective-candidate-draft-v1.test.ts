import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPilotOwnerEffectiveCandidateDraftV1} from './pilot-owner-effective-candidate-draft-v1';

test('owner-adjusted draft excludes edamame and keeps frozen19 immutable',()=>{
 const result=buildPilotOwnerEffectiveCandidateDraftV1();
 assert.equal(result.contract,'potok-pilot-owner-effective-candidates-v1');
 assert.equal(result.immutableFrozenRecipeCount,19);
 assert.equal(result.candidateCount,18);
 assert.equal(result.candidates.length,18);
 assert.deepEqual(result.excludedRecipeIds,['lemon_shelled_edamame']);
 assert.equal(result.candidates.some(r=>r.recipeId==='lemon_shelled_edamame'),false);
 assert.equal(result.candidates.every(r=>r.sourceApproved===false && r.eligible===false),true);
 assert.equal(result.noDatabaseWrites,true);
 assert.equal(result.runtimePublishable,false);
 assert.equal(result.readyForServerSubmission,false);
 assert.equal(result.mayActivate,false);
});
test('lentil and buckwheat changes demand fresh review, never inherit old nutrition approval',()=>{
 const result=buildPilotOwnerEffectiveCandidateDraftV1();
 for(const id of ['brown_lentils_rice_carrot','whole_wheat_pasta_lentils_tomato']){
  const candidate=result.candidates.find(r=>r.recipeId===id);
  assert(candidate);
  assert(candidate.reviewReasons.includes('OWNER_GREEN_LENTILS_REQUIRE_NEW_RECIPE_REVISION'));
 }
 for(const id of ['buckwheat_porridge_mushrooms','chicken_meatballs_buckwheat']){
  const candidate=result.candidates.find(r=>r.recipeId===id);
  assert(candidate);
  assert(candidate.reviewReasons.includes('OWNER_UNROASTED_GREEN_BUCKWHEAT_REQUIRES_SOURCE_RECHECK'));
 }
 assert.equal(result.candidates.every(r=>r.reviewReasons.includes('FULL_ORIGINAL_INGREDIENTS_NOT_RECOVERED')),true);
});
