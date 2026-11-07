import test from 'node:test';
import assert from 'node:assert/strict';
import {checkGenerationAdmissionPreflightV1,requiredMealSlotsV1} from './generationAdmissionPreflightV1';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const evidence=()=>({
 manifestHeadPublished:true,policyHeadPublished:true,currentGoalTargetPrepared:true,
 verifiedPremiumEntitlement:true,currentAuthorityAttested:true,
 currentSourceEvidenceVerified:true,admissionRevisionsCurrent:true,
 eligiblePublishedRecipeIdsBySlot:Object.fromEntries(requiredMealSlotsV1.map((slot,k)=>
  [slot,Array.from({length:4},(_,i)=>id(k*4+i+1))]))
});
test('fails closed before any evidence is available or trusted',()=>{
 const x=checkGenerationAdmissionPreflightV1(undefined);
 assert.equal(x.mayRequestGeneration,false);assert.equal(x.mayActivate,false);
 assert.deepEqual(x.missing,['INVALID_ADMISSION_INPUT']);
 for(const value of [null,{},'example',{...evidence(),verifiedPremiumEntitlement:'true'},
  {...evidence(),eligiblePublishedRecipeIdsBySlot:{breakfast:[id(1)]}}]){
  assert.equal(checkGenerationAdmissionPreflightV1(value).mayRequestGeneration,false);
 }
});
test('actual current evidence and at least four distinct recipes per meal type are necessary, not sufficient',()=>{
 const x=checkGenerationAdmissionPreflightV1(evidence());
 assert.equal(x.mayRequestGeneration,true);
 assert.equal(x.mayActivate,false);
 assert.equal(x.coverage.length,4);
 assert.ok(x.coverage.every(x=>x.required===4&&x.missing===0));
 const stale={...evidence(),policyHeadPublished:false};
 assert.deepEqual(checkGenerationAdmissionPreflightV1(stale).missing,['POLICY_NOT_PUBLISHED']);
 const lacking=evidence();
 lacking.eligiblePublishedRecipeIdsBySlot.dinner=[id(9)];
 const y=checkGenerationAdmissionPreflightV1(lacking);
 assert.equal(y.mayRequestGeneration,false);
 assert.deepEqual(y.coverage.find(x=>x.slot==='dinner'),{slot:'dinner',eligible:1,required:4,missing:3});
 assert.ok(y.missing.includes('INSUFFICIENT_ELIGIBLE_RECIPES'));
});
test('wrong input shape, duplicate IDs within pool, and inflated retry cap cannot make the gate pass',()=>{
 assert.equal(checkGenerationAdmissionPreflightV1(evidence(),{maxRecipeUses:8}).mayRequestGeneration,false);
 const duplicates=evidence();
 duplicates.eligiblePublishedRecipeIdsBySlot.snack=[id(1),id(1),id(3),id(4)];
 assert.equal(checkGenerationAdmissionPreflightV1(duplicates).mayRequestGeneration,false);
 const extra={...evidence(),unknown:true};
 assert.equal(checkGenerationAdmissionPreflightV1(extra).mayRequestGeneration,false);
});
