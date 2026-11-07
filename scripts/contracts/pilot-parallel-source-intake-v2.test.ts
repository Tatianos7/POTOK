import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPilotV2SourceCandidateRaw as inspect} from './pilot-parallel-source-intake-v2';
import {buildPilotV2ReviewBacklog} from './pilot-parallel-review-backlog-v2';
const task=buildPilotV2ReviewBacklog().tasks.find(t=>t.sourceRecord==='SR28:20124');
if(!task)throw Error('MISSING_PASTA_REVIEW_TASK');
const payload=()=>({contract:'potok-parallel-pilot-source-candidate-v2',taskId:task.taskId,
 recipeSha256:task.priorRecipeSha256,sourceRecord:task.sourceRecord,
 sourceDocumentId:'record-20124',sourceRevision:'candidate-r1',
 sourceDigest:'a'.repeat(64),productDescription:'whole wheat pasta (claimed)',
 foodState:'DRY',edibleBasis:'per_100g_edible',
 calories:'350',protein:'12',fat:'2.1',carbs:'70',fiber:'8',carbsExcludeFiber:true,
 originalRowSha256:task.originalRowSha256});
test('source candidate with valid structure is still untrusted and never published',()=>{
 const r=inspect(JSON.stringify(payload()));
 assert.equal(r.taskId,task.taskId);
 assert.equal(r.sourceApproved,false);
 assert.equal(r.identityApproved,false);
 assert.equal(r.canApply,false);
 assert.equal(r.readyForServerSubmission,false);
 assert.ok(r.reviewReasons.includes('INDEPENDENT_SOURCE_AUTHENTICITY_UNVERIFIED'));
 assert.ok(r.reviewReasons.includes('COMMON_WHEAT_AND_DRY_BASIS_NOT_ESTABLISHED'));
});
test('unrelated task, false fiber convention, tampered original hash and duplicate keys fail closed',()=>{
 assert.throws(()=>inspect(JSON.stringify({...payload(),taskId:'wrong#row'})));
 assert.throws(()=>inspect(JSON.stringify({...payload(),carbsExcludeFiber:false})));
 assert.throws(()=>inspect(JSON.stringify({...payload(),originalRowSha256:'b'.repeat(64)})));
 assert.throws(()=>inspect(JSON.stringify({...payload(),foodState:''})));
 assert.throws(()=>inspect(JSON.stringify({...payload(),extra:'approved'})));
 assert.throws(()=>inspect('{"contract":"a","contract":"b"}'));
});
test('plausibility flags cannot be overridden or construed as confirmation',()=>{
 const r=inspect(JSON.stringify({...payload(),calories:'950',carbs:'95',fiber:'25'}));
 assert.ok(r.reviewReasons.includes('PER_100G_MASS_BALANCE_REVIEW'));
 assert.ok(r.reviewReasons.includes('ENERGY_PER_100G_PLAUSIBILITY_REVIEW'));
 assert.equal(r.canApply,false);
});
