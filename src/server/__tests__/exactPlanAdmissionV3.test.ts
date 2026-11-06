import assert from 'node:assert/strict';import test from 'node:test';
import {admissionFixtureV3 as fixture,raw,id,copy,sha} from './exactPlanAdmissionFixturesV3';
import {createExactPlanAdmissionV3,type ExactPlanAdmissionResultV3} from '../exactPlanAdmissionV3';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
const snapshot=(r:ExactPlanAdmissionResultV3)=>{if(!('snapshot'in r))assert.fail(JSON.stringify(r));return r.snapshot;};
test('real exact optimizer -> locked admission -> retained snapshot -> fresh verified readback (synthetic transaction)',async()=>{
 const f=await fixture(true),recorded=await f.service.record(f.operation,f.proposalRaw),s=snapshot(recorded);assert.equal(recorded.status,'SNAPSHOT_RECORDED');
 assert.equal(s.proposalCanonicalRaw,f.proposalRaw);assert.equal(s.accountId,f.input.accountId);assert.equal(s.proposedPlanRevision,f.input.selection.proposedPlanRevision);
 assert.deepEqual(s.facts,[]);assert.equal(recorded.planActivated,false);assert.equal(recorded.factsWritten,false);assert.ok(Object.isFrozen(s));
 const opened=await f.service.open(f.operation);assert.equal(opened.status,'SNAPSHOT_VERIFIED');assert.deepEqual(snapshot(opened),s);assert.equal(f.counts().writes,1);assert.equal(f.counts().optimizations,2);
 const {digest,...payload}=s;assert.equal(digest,sha(canonicalJsonV1({domain:'potok-exact-retained-plan-proposal-sha256-v3',payload},'SAFE_INTEGER')));
});
test('same operation/payload returns immutable stored snapshot and never inserts twice',async()=>{
 const f=await fixture(),a=await f.service.record(f.operation,f.proposalRaw),before=f.rows.get(f.operation),b=await f.service.record(f.operation,raw(f.proposal));
 assert.equal(b.status,'SNAPSHOT_REPLAY');assert.deepEqual(snapshot(a),snapshot(b));assert.equal(f.rows.get(f.operation),before);assert.equal(f.counts().writes,1);
});
test('serialized concurrent duplicate requests produce one retained snapshot',async()=>{
 const f=await fixture(),results=await Promise.all([f.service.record(f.operation,f.proposalRaw),f.service.record(f.operation,f.proposalRaw)]);
 assert.deepEqual(results.map(r=>r.status).sort(),['SNAPSHOT_RECORDED','SNAPSHOT_REPLAY']);assert.equal(f.rows.size,1);assert.equal(f.counts().writes,1);
});
test('lost COMMIT acknowledgement returns UNKNOWN and recovery only reads the committed snapshot',async()=>{
 const f=await fixture();f.setMode('lost-commit-ack');const r=await f.service.record(f.operation,f.proposalRaw);assert.equal(r.status,'UNKNOWN_RETRYABLE');assert.equal(f.rows.size,1);
 f.setMode('normal');const recovered=await f.service.recover(f.operation);assert.equal(recovered.status,'SNAPSHOT_VERIFIED');assert.equal(f.counts().writes,1);assert.equal(recovered.planActivated,false);
});
test('uncommitted or failed dispatch has no row and recovery never repeats a write',async()=>{
 for(const mode of ['insert-fail','before-commit','bad-return']){const f=await fixture();f.setMode(mode);assert.equal((await f.service.record(f.operation,f.proposalRaw)).status,'UNKNOWN_RETRYABLE');assert.equal(f.rows.size,0);
  f.setMode('normal');assert.equal((await f.service.recover(f.operation)).status,'RECOVERY_UNRESOLVED');assert.equal(f.counts().writes,1);}
});
test('revoked/expired Premium and stale account/selection/policy heads deny before insertion',async()=>{
 const f=await fixture();for(const entitlement of ['revoked','expired'] as const){f.setAdmission({...f.admission,currentAuthority:{...f.recheck,entitlement}});assert.equal((await f.service.record(f.operation,f.proposalRaw)).status,'ENTITLEMENT_DENIED');}
 for(const field of ['accountId','selectionId','planSelectionRevision','goalRevision','targetPolicyRevision','preferenceRevision','safetyRevision','entitlementEvidenceRevision','candidateManifestRevision','compositionPolicyRevision','validationPolicyRevision','optimizationPolicyRevision','generationPolicyRevision'] as const){
  f.setAdmission({...f.admission,currentAuthority:{...f.recheck,[field]:id(99)}});assert.equal((await f.service.record(f.operation,f.proposalRaw)).status,'CONFLICT');}
 assert.equal(f.counts().writes,0);
});
test('durable request actor/owner/input binding cannot come from a foreign account or forged metadata',async()=>{
 const f=await fixture();for(const patch of [{actorAccountId:id(99)},{accountId:id(99)},{generationInputDigest:'0'.repeat(64)},{requestOperationId:id(99)}]){
  f.setAdmission({...f.admission,...patch});assert.equal((await f.service.record(f.operation,f.proposalRaw)).status,'BLOCKED');}
 assert.equal(f.counts().writes,0);
});
test('changed proposal flags, facts, scores or graph do not pass a fresh exact optimizer comparison',async()=>{
 const f=await fixture();for(const patch of [{canRecord:true},{facts:[{consumed:true}]},{optimizationResultDigest:'0'.repeat(64)},{graph:{...f.proposal.graph,canActivate:true}}])assert.equal((await f.service.record(f.operation,raw({...f.proposal,...patch}))).status,'CONFLICT');
 assert.equal(f.counts().writes,0);
});
test('stored bytes/digest/owner substitutions are never exposed as a verified plan',async()=>{
 const f=await fixture();await f.service.record(f.operation,f.proposalRaw);const original=f.rows.get(f.operation)!;
 for(const patch of [{accountId:id(99)},{digest:'0'.repeat(64)},{facts:[{consumed:true}]},{proposalDigest:'0'.repeat(64)}]){f.rows.set(f.operation,canonicalJsonV1({...JSON.parse(original),...patch},'SAFE_INTEGER'));assert.equal((await f.service.open(f.operation)).status,'CONFLICT');}
 f.rows.set(f.operation,original+' ');assert.equal((await f.service.open(f.operation)).status,'CONFLICT');assert.equal(f.counts().writes,1);
});
test('gate is disabled by default and closure during a dispatched attempt requires recovery',async()=>{
 const f=await fixture(),disabled=createExactPlanAdmissionV3(f.store);assert.equal((await disabled.record(f.operation,f.proposalRaw)).status,'BLOCKED');assert.equal(f.counts().reads,0);
 f.setMode('disable-after-dispatch');assert.equal((await f.service.record(f.operation,f.proposalRaw)).status,'UNKNOWN_RETRYABLE');assert.equal(f.rows.size,0);
});
test('open never creates absent rows, and raw duplicate/unsafe/unknown authority fields reject',async()=>{
 const f=await fixture();assert.equal((await f.service.open(f.operation)).status,'BLOCKED');assert.equal(f.counts().writes,0);
 assert.equal((await f.service.record(f.operation,f.proposalRaw.replace('{','{"contract":"duplicate",'))).status,'BLOCKED');
 const bad=copy(f.admission);Object.assign(bad.currentAuthority,{approved:true});f.setAdmission(bad);assert.equal((await f.service.record(f.operation,f.proposalRaw)).status,'BLOCKED');
});

test('Premium revocation while exact selection awaits is rechecked before any snapshot insert',async()=>{
 const f=await fixture();f.setAfterOptimize(()=>f.setAdmission({...f.admission,currentAuthority:{...f.recheck,entitlement:'revoked'}}));
 assert.equal((await f.service.record(f.operation,f.proposalRaw)).status,'ENTITLEMENT_DENIED');assert.equal(f.counts().writes,0);assert.equal(f.rows.size,0);
});
