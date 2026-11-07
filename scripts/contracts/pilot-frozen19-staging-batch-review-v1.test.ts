import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewFrozen19StagingSnapshotV1 as review, type Frozen19StagingObservationV1} from './pilot-frozen19-staging-batch-review-v1';
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const item=()=>({id,name:'Макароны из полбы цельнозерновые',source:'core',canonical_food_id:id,
 is_searchable:null,needs_review:null,verified:null,cooking_state:'unknown',
 calories:'361.00',protein:'16.90',fat:'2.40',carbs:'67.80',fiber:null});
const packet=():Frozen19StagingObservationV1=>({projectId:'ozidryfvhkcbtpnulakq',
 capturedAt:'2026-11-07T12:00:00.000Z',candidates:[{sourceRecord:'SR28:20124',food:item()}]});
const now='2026-11-07T12:05:00.000Z';
test('read-only Staging review reports observed structural gaps, never selects spelt or approves source',()=>{
 const r=review(packet(),now);
 assert.equal(r.expectedOccurrences,10);
 assert.equal(r.originalRowHashesStillNeeded,3);
 assert.equal(r.candidateObservations,1);
 assert.equal(r.families.length,5);
 assert.equal(r.families.reduce((s,g)=>s+g.expectedOccurrences,0),10);
 assert.equal(r.families.filter(g=>g.observedCandidateCount>0).length,1);
 assert.ok(r.observations[0].missing.includes('SPELT_NOT_COMMON_WHEAT'));
 assert.equal(r.approvedBindings,0);assert.equal(r.catalogWrites,0);
 assert.equal(r.canApply,false);assert.equal(r.readyForServerSubmission,false);
});
test('wrong project, stale or future observation, unknown source and duplicate candidate are rejected',()=>{
 assert.throws(()=>review({...packet(),projectId:'dtsdnhbcwpbfrhcazqkb'},now));
 assert.throws(()=>review({...packet(),capturedAt:'2026-11-05T00:00:00.000Z'},now));
 assert.throws(()=>review({...packet(),capturedAt:'2026-11-08T00:00:00.000Z'},now));
 assert.throws(()=>review({...packet(),candidates:[{sourceRecord:'INVALID',food:item()}]},now));
 assert.throws(()=>review({...packet(),candidates:[...packet().candidates,...packet().candidates]},now));
});
test('even an apparently complete food snapshot does not bypass identity, source and visibility review',()=>{
 const s=packet();
 s.candidates[0].food={...item(),name:'Паста из обычной цельной пшеницы',
 is_searchable:true,needs_review:false,verified:true,cooking_state:'dry',fiber:'10.1'};
 const r=review(s,now);
 assert.equal(r.families.find(g=>g.sourceRecord==='SR28:20124')?.candidatesWithStructuralBlockers,0);
 assert.equal(r.families.find(g=>g.sourceRecord==='SR28:20124')?.independentlyApprovedCandidates,0);
 assert.equal(r.observations[0].identityApproved,false);
 assert.equal(r.observations[0].sourceApproved,false);
});
