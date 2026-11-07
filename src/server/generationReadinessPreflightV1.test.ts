import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGenerationReadinessV1,type GenerationReadinessEvidenceV1} from './generationReadinessPreflightV1';

const base:GenerationReadinessEvidenceV1={
 projectRef:'ozidryfvhkcbtpnulakq',observedAt:'2026-11-07T19:20:00Z',
 candidateManifests:0,candidateManifestHeads:0,candidateEntries:0,
 generationPolicyHeads:0,goalTargets:0,independentlyReviewedRecipes:0,
 unresolvedIngredientLinks:null,
 trustedSourceAndNutritionReceiptsVerified:false,candidateManifestCurrentnessVerified:false,
 generationPolicyCurrentnessVerified:false,targetOwnerBindingVerified:false,
 premiumEntitlementVerified:false,workerCredentialsAndTlsProven:false,
};
test('actual known Staging absent inputs fail closed and cannot grant publication',()=>{
 const r=evaluateGenerationReadinessV1(base);
 assert.equal(r.status,'BLOCKED');
 for(const reason of ['MANIFEST_NOT_READY','POLICY_NOT_READY','TARGETS_NOT_READY',
  'RECIPE_EVIDENCE_NOT_READY','UNRESOLVED_INGREDIENTS','SOURCE_NUTRITION_NOT_VERIFIED',
  'PREMIUM_NOT_VERIFIED','WORKER_CONNECTION_NOT_PROVEN']) assert(r.reasons.includes(reason as never));
 assert.equal(r.mayActivateWorker,false);
 assert.equal(r.mayWritePlan,false);
 assert.equal(r.mayPublishCatalog,false);
});
test('unknown counts, wrong project and invalid observation never default to approval',()=>{
 const r=evaluateGenerationReadinessV1({...base,projectRef:'dtsdnhbcwpbfrhcazqkb',
  observedAt:'unverified',candidateEntries:null});
 assert.equal(r.status,'BLOCKED');
 assert(r.reasons.includes('WRONG_PROJECT'));
 assert(r.reasons.includes('INVALID_OBSERVATION'));
});
test('even externally claimed passing preconditions are never authorization to activate a worker or publish',()=>{
 const r=evaluateGenerationReadinessV1({...base,candidateManifests:1,candidateManifestHeads:1,
  candidateEntries:28,generationPolicyHeads:1,goalTargets:1,
  independentlyReviewedRecipes:28,unresolvedIngredientLinks:0,
  trustedSourceAndNutritionReceiptsVerified:true,candidateManifestCurrentnessVerified:true,
  generationPolicyCurrentnessVerified:true,targetOwnerBindingVerified:true,
  premiumEntitlementVerified:true,workerCredentialsAndTlsProven:true});
 assert.equal(r.status,'PRECONDITIONS_REPORTED');
 assert.deepEqual(r.reasons,[]);
 assert.equal(r.mayPublishCatalog,false);
 assert.equal(r.mayActivateWorker,false);
 assert.equal(r.mayWritePlan,false);
});
