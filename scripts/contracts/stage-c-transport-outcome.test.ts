import test from 'node:test';
import assert from 'node:assert/strict';
import {transportOutcomeV1,reconcileFinalStateV1} from './stage-c-transport-outcome';
import {retryableCatalogFailureV1} from './catalogTransactionRetryV1';
test('only verified post-COMMIT HTTP acknowledgement proves committed; ambiguity never retries',()=>{
 assert.equal(transportOutcomeV1({kind:'HTTP_SUCCESS',bodyVerified:true,rollbackPreference:false}).status,'COMMITTED');
 for(const observation of [{kind:'DISCONNECT'} as const,{kind:'HTTP_SUCCESS',bodyVerified:false,rollbackPreference:false} as const,{kind:'HTTP_SUCCESS',bodyVerified:true,rollbackPreference:true} as const])
  assert.deepEqual(transportOutcomeV1(observation),{status:'UNKNOWN',retryAllowed:false});
 assert.equal(transportOutcomeV1({kind:'HTTP_ERROR',rollbackConfirmed:true,error:{code:'42501',message:'denied',details:null,hint:null}}).status,'ABORTED');
});
test('PostgREST error text cannot restore missing engine routine or permit retry',()=>{
 for(const code of ['40P01','40001','42501','57014'])assert.equal(retryableCatalogFailureV1({code,rollbackConfirmed:true}),false);
 assert.equal(retryableCatalogFailureV1({code:'40001',detail:'POTOK_BUSINESS_CONFLICT_V1',routine:'exec_stmt_raise',rollbackConfirmed:true}),false);
});
test('read-only state match/absence/difference cannot prove request causality',()=>{
 const expected={foodId:'fixed',stableKey:'key',digest:'digest'};
 assert.deepEqual(reconcileFinalStateV1(expected,{...expected}),{state:'MATCH',operationStatus:'UNKNOWN',retryAllowed:false});
 assert.equal(reconcileFinalStateV1(expected,null).operationStatus,'UNKNOWN');
 assert.equal(reconcileFinalStateV1(expected,{...expected,digest:'changed'}).state,'DIFFERENT');
});
