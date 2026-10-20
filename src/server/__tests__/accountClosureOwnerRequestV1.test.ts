import assert from 'node:assert/strict';
import test from 'node:test';
import { accountClosureRequestContractV1, accountClosureReceiptContractV1,
  decodeClosureOwnerRequestV1, verifyClosureCommittedReceiptV1, prepareOwnerClosureV1 } from '../accountClosureOwnerRequestV1';
const owner='123e4567-e89b-42d3-a456-426614174000';
const other='123e4567-e89b-42d3-a456-426614174001';
const key='123e4567-e89b-42d3-a456-426614174010';
const input={contract:accountClosureRequestContractV1,closureKey:key};
const receipt={contract:accountClosureReceiptContractV1,accountId:owner,closureKey:key,state:'CLOSING',revision:'2'};
test('owner closure request rejects actor spoofing, extra keys and malformed closure key',()=>{
 assert.deepEqual(decodeClosureOwnerRequestV1(input),input);
 for(const bad of [{...input,accountId:other},{...input,admin:true},{...input,closureKey:'a'},null,[],{}]){
  assert.throws(()=>decodeClosureOwnerRequestV1(bad),/CLOSURE_REQUEST_INVALID/);
 }
});
test('only an exact committed matching receipt is confirmation',()=>{
 assert.deepEqual(verifyClosureCommittedReceiptV1(receipt,owner,key),receipt);
 for(const bad of [{...receipt,accountId:other},{...receipt,closureKey:'123e4567-e89b-42d3-a456-426614174011'},
  {...receipt,state:'CLOSED'},{...receipt,revision:'0'},{...receipt,admin:true},null]){
  assert.throws(()=>verifyClosureCommittedReceiptV1(bad,owner,key),/CLOSURE_RECEIPT_UNVERIFIED/);
 }
});
test('no server dispatch without verified identity',async()=>{
 let invoked=false;
 const port={verifyUser:async()=>null,beginForVerifiedActor:async()=>{invoked=true;return receipt;}};
 await assert.rejects(prepareOwnerClosureV1(port,'token',input),/CLOSURE_AUTH_REQUIRED/);
 assert.equal(invoked,false);
});
test('server binds exact verified actor; no admin role escalation',async()=>{
 let bound='';
 const port={verifyUser:async()=>({id:owner}),beginForVerifiedActor:async(a:string,k:string)=>{
  bound=a+':'+k;return receipt;
 }};
 const result=await prepareOwnerClosureV1(port,'valid-token',input);
 assert.deepEqual(result,{kind:'CONFIRMED',receipt});
 assert.equal(bound,owner+':'+key);
});
test('unverified post-dispatch outcome preserves original actor and closure key as UNKNOWN',async()=>{
 for(const failure of ['transport','forged-receipt','changed-user']){
  let verifications=0;
  const port={
   verifyUser:async()=>{verifications++;return failure==='changed-user'&&verifications>1?{id:other}:{id:owner};},
   beginForVerifiedActor:async()=>{if(failure==='transport')throw new Error('lost transport');
    return failure==='forged-receipt'?{...receipt,accountId:other}:receipt;}
  };
  assert.deepEqual(await prepareOwnerClosureV1(port,'token',input),
   {kind:'UNKNOWN',actorId:owner,closureKey:key});
 }
});
