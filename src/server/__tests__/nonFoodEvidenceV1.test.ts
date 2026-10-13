import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeNonFoodRequestV1, verifyNonFoodReceiptV1, nonFoodRequestDigestV1, nonFoodMaxBytesV1 } from '../nonFoodEvidenceV1';
import { dispatchNonFoodV1, createNonFoodReviewHandlerV1 } from '../nonFoodEvidenceGatewayV1';
import { definitionRequest, nutritionRequest, syntheticReceipt, actor, id } from './nonFoodEvidenceFixturesV1';

test('strict nonfood definition and explicit zero nutrition requests decode without food identity', async () => {
  const d = definitionRequest();assert.equal((await decodeNonFoodRequestV1(JSON.stringify(d))).kind,'REVIEW_APPROVED');
  const n = nutritionRequest(id(10),id(11),'a'.repeat(64));assert.equal((await decodeNonFoodRequestV1(JSON.stringify(n))).kind,'REVIEW_APPROVED');
  assert.equal(JSON.stringify(n).includes('canonicalFoodId'),false);
});
test('duplicate keys, missing/foreign authority fields and malformed UTF8 reject', async () => {
  const raw=JSON.stringify(definitionRequest());
  await assert.rejects(decodeNonFoodRequestV1(raw.replace('"kind":"REVIEW_APPROVED"','"kind":"REVIEW_APPROVED","kind":"REVIEW_APPROVED"')));
  for (const field of ['actorId','role','approvedAt','approvedStatus','ingredientIds','canonicalFoodId']) {
    await assert.rejects(decodeNonFoodRequestV1(JSON.stringify({...definitionRequest(),[field]:'forged'})));
  }
  await assert.rejects(decodeNonFoodRequestV1(new Uint8Array([0xff])));
  await assert.rejects(decodeNonFoodRequestV1(new Uint8Array(nonFoodMaxBytesV1+1)));
  const p=definitionRequest();delete (p as Partial<typeof p>).expectedHead;await assert.rejects(decodeNonFoodRequestV1(JSON.stringify(p)));
});
test('all five source numeric values are explicit; null/dash/blank/positive and unknown mapping fail', async () => {
  const n=nutritionRequest(id(10),id(11),'a'.repeat(64));assert.equal(n.proposal.kind,'NUTRITION');
  if(n.proposal.kind!=='NUTRITION') return;
  for(const f of ['calories','protein','fat','carbs','fiber']) for(const value of [null,'','—',0,'0','1.000']) {
    const p=structuredClone(n);(p.proposal as unknown as {sourceValues:Record<string,unknown>}).sourceValues[f]=value;
    await assert.rejects(decodeNonFoodRequestV1(JSON.stringify(p)));
  }
  await assert.rejects(decodeNonFoodRequestV1(JSON.stringify({...n,proposal:{...n.proposal,carbohydrateSemantics:'UNKNOWN'}})));
});
test('retained length/hash/field coverage/applicability and identity exclusion drift reject', async () => {
  const d=definitionRequest();
  for(const mutate of [(p:typeof d)=>{p.retainedSource.byteLength++;},(p:typeof d)=>{p.retainedSource.sourceBytesSha256='0'.repeat(64);},
    (p:typeof d)=>{p.retainedSource.mappings=[];},(p:typeof d)=>{p.retainedSource.mappings[0].applicability.foodState='raw';},
    (p:typeof d)=>{if(p.proposal.kind==='DEFINITION')p.proposal.exclusions=['sugar','flavor'];}]) {
    const p=structuredClone(d);mutate(p);await assert.rejects(decodeNonFoodRequestV1(JSON.stringify(p)));
  }
});
test('receipt verifies actor/key/raw bytes/events/revisions/heads; reshaped canonical-equivalent raw is different operation', async () => {
  const raw=JSON.stringify(definitionRequest());const r=await syntheticReceipt(raw);await verifyNonFoodReceiptV1(raw,actor,r);
  for(const mutate of [(p:typeof r)=>{p.actorId=id(2);},(p:typeof r)=>{p.requestDigest='0'.repeat(64);},
    (p:typeof r)=>{p.revision.digest='0'.repeat(64);},(p:typeof r)=>{p.heads.definition.digest='0'.repeat(64);},
    (p:typeof r)=>{p.event.target.definitionId=id(90);}]) {
    const p=structuredClone(r);mutate(p);await assert.rejects(verifyNonFoodReceiptV1(raw,actor,p));
  }
  const formatted=JSON.stringify(JSON.parse(raw),null,2);assert.equal(await nonFoodRequestDigestV1(raw),await nonFoodRequestDigestV1(formatted));
  await assert.rejects(verifyNonFoodReceiptV1(formatted,actor,r));
});
test('response loss/postdispatch auth exceptions quarantine exact operation; read-only recovery never redispatches', async () => {
  const raw=JSON.stringify(definitionRequest());let dispatches=0;let lookups=0;
  const receipt=await syntheticReceipt(raw);
  const client={verifyUser:async()=>({id:actor}),review:async()=>{dispatches++;throw Error('lost response');},receipt:async()=>{lookups++;return receipt;}};
  const unknown=await dispatchNonFoodV1(client,'fixture',raw);assert.equal(unknown.kind,'UNKNOWN');
  if(unknown.kind!=='UNKNOWN')return;assert.equal(unknown.raw,raw);
  assert.equal((await dispatchNonFoodV1(client,'fixture',unknown.raw,true,unknown.actorId)).kind,'SETTLED');assert.equal(dispatches,1);assert.equal(lookups,1);
  let authCalls=0;const post={...client,verifyUser:async()=>{if(++authCalls>1)throw Error('auth down');return{id:actor};},review:async()=>receipt};
  assert.equal((await dispatchNonFoodV1(post,'fixture',raw)).kind,'UNKNOWN');
  await assert.rejects(dispatchNonFoodV1({...client,verifyUser:async()=>({id:id(2)})},'fixture',raw,true,actor));
});
test('bounded unmounted gateway rejects malformed bytes and oversize before dispatch', async()=>{
  let writes=0;const handler=createNonFoodReviewHandlerV1(()=>({verifyUser:async()=>({id:actor}),review:async()=>{writes++;return null;},receipt:async()=>null}));
  for(const body of [new Uint8Array([0xff]),new Uint8Array(nonFoodMaxBytesV1+1)]){
    const result=await handler(new Request('https://fixture.invalid/',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer fixture'},body}));
    assert.equal(result.status,400);
  }assert.equal(writes,0);
});
