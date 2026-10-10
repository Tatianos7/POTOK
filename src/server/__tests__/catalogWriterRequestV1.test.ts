import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePrivateFoodRequestRawV1, decodeCatalogBatchRequestRawV1, catalogBatchOutcomeV1, runCatalogImportJobV1 } from '../catalogWriterRequestV1';
const p={name:'Private',normalizedName:'private',brand:null,normalizedBrand:null,calories:'10.00',protein:'1.00',fat:'2.00',carbs:'3.00',fiber:'0.00'};
const create={contract:'potok-private-food-request-v1',kind:'CREATE',payload:p};
test('strict private shape and no source/owner/identity promotion',()=>{
 assert.equal(decodePrivateFoodRequestRawV1(JSON.stringify(create)).kind,'CREATE');
 const empty=decodePrivateFoodRequestRawV1(JSON.stringify({...create,payload:{...p,normalizedBrand:''}}));
 assert.ok(empty.kind==='CREATE');assert.equal(empty.payload.normalizedBrand,'');
 for(const field of ['actorId','source','createdByUserId','foodId','canonicalFoodId']) assert.throws(()=>decodePrivateFoodRequestRawV1(JSON.stringify({...create,[field]:'forged'})));
 assert.throws(()=>decodePrivateFoodRequestRawV1(JSON.stringify({...create,payload:{...p,source:'core'}})));
 assert.throws(()=>decodePrivateFoodRequestRawV1(JSON.stringify({...create,payload:{...p,calories:10}})));
 assert.throws(()=>decodePrivateFoodRequestRawV1(JSON.stringify(create).replace('"kind":"CREATE"','"kind":"CREATE","kind":"CREATE"')));
});
test('batch uses exact nullable-brand key semantics and cap',()=>{
 const row={foodId:'00000000-0000-4000-8000-000000009001',foodStableId:null,source:'core',payload:p};
 const b={contract:'potok-catalog-batch-request-v1',mode:'UPSERT_NORMALIZED',rows:[row]};
 assert.equal(decodeCatalogBatchRequestRawV1(JSON.stringify(b)).rows.length,1);
 assert.throws(()=>decodeCatalogBatchRequestRawV1(JSON.stringify({...b,rows:[row,{...row,foodId:'00000000-0000-4000-8000-000000009002',payload:{...p,normalizedBrand:''}}]})));
 assert.throws(()=>decodeCatalogBatchRequestRawV1(JSON.stringify({...b,rows:Array(201).fill(row)})));
 assert.throws(()=>decodeCatalogBatchRequestRawV1(JSON.stringify({...b,rows:[{...row,source:'user'}]})));
});
test('job outcomes separate committed batches, confirmed abort and UNKNOWN fail-stop',()=>{
 assert.deepEqual(catalogBatchOutcomeV1({kind:'COMMIT_ACK',rowsApplied:1}),{status:'COMMITTED',rowsApplied:1});
 assert.deepEqual(catalogBatchOutcomeV1({kind:'FAILURE',rollbackConfirmed:true}),{status:'ABORTED',rollbackConfirmed:true});
 assert.deepEqual(catalogBatchOutcomeV1({kind:'FAILURE',rollbackConfirmed:false}),{status:'UNKNOWN',retryAllowed:false});
 assert.throws(()=>catalogBatchOutcomeV1({kind:'COMMIT_ACK',rowsApplied:201}));
});

test('sequential job preserves committed prefix and stops after ABORTED/UNKNOWN without retry',async()=>{
 const raw=JSON.stringify({contract:'potok-catalog-batch-request-v1',mode:'INSERT',rows:[{foodId:'00000000-0000-4000-8000-000000009001',foodStableId:null,source:'core',payload:p}]});
 for(const status of ['ABORTED','UNKNOWN'] as const){let calls=0;
  const result=await runCatalogImportJobV1([raw,raw,raw],async()=>++calls===1?{status:'COMMITTED',rowsApplied:1}:status==='ABORTED'?{status,rollbackConfirmed:true}:{status,retryAllowed:false});
  assert.equal(calls,2);assert.equal(result.batches[0].outcome.status,'COMMITTED');assert.equal(result.status,status==='ABORTED'?'STOPPED_ABORTED':'STOPPED_UNKNOWN');
 }
 let calls=0;const lost=await runCatalogImportJobV1([raw,raw],async()=>{calls++;throw new Error('response lost');});assert.equal(lost.status,'STOPPED_UNKNOWN');assert.equal(calls,1);
 const wrong=await runCatalogImportJobV1([raw],async()=>({status:'COMMITTED',rowsApplied:2}));assert.equal(wrong.status,'STOPPED_UNKNOWN');
});
