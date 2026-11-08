import test from 'node:test';
import assert from 'node:assert/strict';
import {screenFrozen19StagingCandidateV1 as screen} from './pilot-frozen19-staging-candidate-screen-v1';
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const item=()=>({id,name:'Макароны из полбы цельнозерновые',source:'core',
 canonical_food_id:id,is_searchable:null,needs_review:null,verified:null,cooking_state:'unknown',
 calories:'361.00',protein:'16.90',fat:'2.40',carbs:'67.80',fiber:null});
test('spelt and missing review flags in observed Staging catalog never become a selected food',()=>{
 const result=screen('SR28:20124',item());
 assert.ok(result.missing.includes('SPELT_NOT_COMMON_WHEAT'));
 assert.ok(result.missing.includes('REVIEW_FLAGS_NOT_COMPLETE'));
 assert.ok(result.missing.includes('MISSING_NUMERIC_FIBER'));
 assert.equal(result.identityApproved,false);
 assert.equal(result.sourceApproved,false);
 assert.equal(result.canApply,false);
});
test('even superficially complete candidate cannot be published without separate source and RLS checks',()=>{
 const candidate={...item(),name:'Макароны из цельной обычной пшеницы',is_searchable:true,needs_review:false,
  verified:true,cooking_state:'dry',fiber:'9.0'};
 const r=screen('SR28:20124',candidate);
 assert.deepEqual(r.missing,['SOURCE_APPLICABILITY_INDEPENDENT_REVIEW_REQUIRED','VISIBLE_TO_REAL_CALLER_NOT_CONFIRMED']);
 assert.equal(r.readyForServerSubmission,false);
});
test('unrecognized family or invalid catalog identity fails closed',()=>{
 assert.throws(()=>screen('UNKNOWN',item()),/INVALID_FROZEN19_STAGING_OBSERVATION/);
 assert.throws(()=>screen('SR28:20124',{...item(),id:'bad'}),/INVALID_FROZEN19_STAGING_OBSERVATION/);
});
