import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPilotUnresolvedOccurrenceQueueV1 as build, unresolvedPilotFamilyKeysV1 as keys } from './pilot-unresolved-occurrence-queue-v1';

function fixture() {
  const p={
    contract:'potok-pilot-family-identity-review-v2',usage:'PRIVATE_REVIEW_QUEUE_NOT_CATALOG_PATCH_OR_AUTHORITY',
    observation:{projectId:'ozidryfvhkcbtpnulakq',capturedAt:'2026-11-06T11:56:33Z'},
    summary:{recipes:19,foodRows:69,foodRowsWithoutFamilyCandidates:10,approvedBindings:0,catalogWrites:0,sourceApprovals:0},
    canApply:false,sourceApproved:false,readyForServerSubmission:false,mayActivate:false,
    proposedFoodCreates:[],proposedFoodUpdates:[],sourceApprovalRequests:[],
    groups:keys.map((sourceRecord,k)=>({sourceRecord,componentKind:'FOOD',occurrences:2,
      occurrenceRefs:[0,1].map(n=>({recipeId:'recipe_'+k,rowId:'row_'+n,quantityG:n===0?'50':null,quantityDecision:'DECLARED_GRAMS',optional:false})),
      candidates:[],selectedCanonicalFoodId:null})),
  };
  return p;
}
test('private frozen19 queue yields exactly ten addressable rows across five source families, never a publication',()=>{
  const p=fixture(),result=build(JSON.stringify(p));
  assert.equal(result.unresolvedRows,10);
  assert.equal(result.unresolvedFamilies,5);
  assert.equal(result.occurrences.length,10);
  assert.equal(result.occurrences[0].quantityG,'50');
  assert.equal(result.sourceApprovals,0);
  assert.equal(result.canApply,false);
  assert.equal(result.mayActivate,false);
  assert.ok(result.occurrences.every(o=>o.selectedCanonicalFoodId===null && o.resolution==='INDEPENDENT_SOURCE_AND_IDENTITY_PRECHECK_REQUIRED'));
});
test('missing, duplicated, unreviewed or source-approved rows fail closed',()=>{
  for (const mode of ['MISSING','DUPLICATE','CANDIDATE','SELECTED','APPROVED','FOREIGN','BAD_QUANTITY','PATCH','BAD_COUNT']) {
    const p=fixture();
    if(mode==='MISSING')p.groups[0].occurrenceRefs.pop();
    if(mode==='DUPLICATE')p.groups[0].occurrenceRefs[1]=p.groups[0].occurrenceRefs[0];
    if(mode==='CANDIDATE')p.groups[0].candidates.push({disposition:'CANDIDATE_FOR_REVIEW',selected:false,sourceApplicabilityApproved:false});
    if(mode==='SELECTED')p.groups[0].selectedCanonicalFoodId='fake' as never;
    if(mode==='APPROVED')p.summary.sourceApprovals=1;
    if(mode==='FOREIGN')p.observation.projectId='production';
    if(mode==='BAD_QUANTITY')p.groups[0].occurrenceRefs[0].quantityG='not a mass';
    if(mode==='PATCH')p.proposedFoodCreates.push({} as never);
    if(mode==='BAD_COUNT')p.summary.foodRowsWithoutFamilyCandidates=9;
    assert.throws(()=>build(JSON.stringify(p)),mode);
  }
});
