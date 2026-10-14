import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeNonFoodRequestV1, verifyNonFoodReceiptV1, nonFoodRequestDigestV1, nonFoodDigestV1, nonFoodMaxBytesV1,
  type NonFoodRequestV1 } from '../nonFoodEvidenceV1';
import { dispatchNonFoodV1, createNonFoodReviewHandlerV1 } from '../nonFoodEvidenceGatewayV1';
import { definitionRequest, nutritionRequest, syntheticReceipt, actor, id } from './nonFoodEvidenceFixturesV1';
import { adaptiveNutritionSha256HexV1 } from '../../utils/adaptiveNutritionWireV1';

type BaseReceipt = Awaited<ReturnType<typeof syntheticReceipt>>;
type Revision = BaseReceipt['revision'];
type Head = { revisionId: string; digest: string };
type MutableReceipt = Omit<BaseReceipt, 'revision' | 'definitionRevision' | 'heads' | 'event'> & {
  revision: Revision | null;
  definitionRevision: Revision | null;
  heads: { definition: Head | null; nutrition: Head | null };
  event: Omit<BaseReceipt['event'], 'kind' | 'reason' | 'severity' | 'target'> & {
    kind: 'REVIEW_APPROVED' | 'REVIEW_REJECTED' | 'INVALIDATION'; reason: string | null;
    severity: 'CORRECTION' | 'SAFETY_CRITICAL' | null; target: unknown;
  };
};
async function eventDigest(event: MutableReceipt['event']): Promise<string> {
  const content: Record<string, unknown> = { ...event }; delete content.digest;
  return nonFoodDigestV1('potok-nonfood-event-sha256-v1', content);
}
async function nutritionReceipt(rejected = false) {
  const definition = (await syntheticReceipt(JSON.stringify(definitionRequest()))).revision;
  const request: Extract<NonFoodRequestV1, { kind: 'REVIEW_APPROVED' | 'REVIEW_REJECTED' }> = {
    ...nutritionRequest(definition.definitionId, definition.revisionId, definition.digest),
    kind: rejected ? 'REVIEW_REJECTED' : 'REVIEW_APPROVED', reason: rejected ? 'Synthetic rejection' : null,
  };
  const raw = JSON.stringify(request);
  const receipt = await syntheticReceipt(JSON.stringify(nutritionRequest(definition.definitionId, definition.revisionId, definition.digest))) as MutableReceipt;
  receipt.definitionRevision = definition;
  receipt.heads.definition = { revisionId: definition.revisionId, digest: definition.digest };
  receipt.heads.nutrition = { revisionId: receipt.revision!.revisionId, digest: receipt.revision!.digest };
  if (rejected) {
    receipt.requestDigest = await nonFoodRequestDigestV1(raw);
    receipt.rawRequestSha256 = await adaptiveNutritionSha256HexV1(new TextEncoder().encode(raw));
    receipt.event.kind = 'REVIEW_REJECTED';
    receipt.event.requestDigest = receipt.requestDigest;
    receipt.event.reason = request.reason;
    receipt.event.target = { kind: 'NUTRITION', proposal: request.proposal };
    receipt.event.digest = await eventDigest(receipt.event);
    receipt.revision = null;
    receipt.heads.nutrition = null;
  }
  return { raw, receipt };
}

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
test('linked definition revision is checked in nutrition approval and rejection receipts', async () => {
  for (const rejected of [false, true]) {
    const { raw, receipt } = await nutritionReceipt(rejected);
    await verifyNonFoodReceiptV1(raw, actor, receipt);
    for (const mutate of [
      (r: typeof receipt) => { r.definitionRevision = null; },
      (r: typeof receipt) => { r.definitionRevision!.contract = 'potok-nonfood-nutrition-revision-v1'; },
      (r: typeof receipt) => { r.definitionRevision!.proposal.kind = 'NUTRITION'; },
      (r: typeof receipt) => { r.definitionRevision!.definitionId = id(9010); },
      (r: typeof receipt) => { r.definitionRevision!.revisionId = id(9011); },
      (r: typeof receipt) => { r.definitionRevision!.reviewEventId = 'invalid'; },
      (r: typeof receipt) => { r.definitionRevision!.reviewEventId = null as unknown as string; },
      (r: typeof receipt) => { r.definitionRevision!.supersedesRevisionId = 'invalid'; },
      (r: typeof receipt) => { r.definitionRevision!.supersedesRevisionId = r.definitionRevision!.revisionId; },
      (r: typeof receipt) => { r.definitionRevision!.digest = 'f'.repeat(64); },
      (r: typeof receipt) => { r.definitionRevision!.proposal.applicability.foodState = 'raw'; },
      (r: typeof receipt) => { r.definitionRevision!.proposal.definitionId = id(9012); },
      (r: typeof receipt) => { r.definitionRevision!.retainedSource.byteLength++; },
      (r: typeof receipt) => { r.definitionRevision!.retainedSource.mappings[0].applicability.foodState = 'raw'; },
      (r: typeof receipt) => { r.heads.definition = { revisionId: id(9013), digest: r.definitionRevision!.digest }; },
    ]) {
      const changed = structuredClone(receipt); mutate(changed);
      await assert.rejects(verifyNonFoodReceiptV1(raw, actor, changed));
    }
  }
});
test('definition-only approval and rejection reject an extra linked definition revision', async () => {
  const linked = (await nutritionReceipt()).receipt.definitionRevision;
  const raw = JSON.stringify(definitionRequest());
  const approval = await syntheticReceipt(raw) as MutableReceipt;
  approval.definitionRevision = linked;
  await assert.rejects(verifyNonFoodReceiptV1(raw, actor, approval));
  const rejected = await nutritionReceipt(true);
  const request = definitionRequest();
  const rejectedRequest = { ...request, kind: 'REVIEW_REJECTED' as const, reason: 'Synthetic rejection' };
  const rejectedRaw = JSON.stringify(rejectedRequest);
  const receipt = structuredClone(rejected.receipt);
  receipt.idempotencyReference = rejectedRequest.idempotencyReference;
  receipt.requestDigest = await nonFoodRequestDigestV1(rejectedRaw);
  receipt.rawRequestSha256 = await adaptiveNutritionSha256HexV1(new TextEncoder().encode(rejectedRaw));
  receipt.event.kind = 'REVIEW_REJECTED'; receipt.event.requestDigest = receipt.requestDigest;
  receipt.event.reason = rejectedRequest.reason; receipt.event.retainedSource = rejectedRequest.retainedSource;
  receipt.event.target = { kind: 'DEFINITION', proposal: rejectedRequest.proposal };
  receipt.event.digest = await eventDigest(receipt.event);
  await assert.rejects(verifyNonFoodReceiptV1(rejectedRaw, actor, receipt));
});
test('definition invalidation rejects an unrelated linked definition revision', async () => {
  const approvalRaw = JSON.stringify(definitionRequest());
  const receipt = await syntheticReceipt(approvalRaw) as MutableReceipt;
  const revision = receipt.revision!;
  const request: NonFoodRequestV1 = {
    contract: 'potok-nonfood-review-request-v1', kind: 'INVALIDATION', idempotencyReference: id(9100),
    target: { kind: 'DEFINITION', definitionId: revision.definitionId, revisionId: revision.revisionId, digest: revision.digest },
    severity: 'CORRECTION', reason: 'Synthetic invalidation', retainedSource: definitionRequest().retainedSource,
  };
  const raw = JSON.stringify(request);
  receipt.idempotencyReference = request.idempotencyReference;
  receipt.requestDigest = await nonFoodRequestDigestV1(raw);
  receipt.rawRequestSha256 = await adaptiveNutritionSha256HexV1(new TextEncoder().encode(raw));
  receipt.event.kind = 'INVALIDATION'; receipt.event.requestDigest = receipt.requestDigest;
  receipt.event.reason = request.reason; receipt.event.severity = request.severity;
  receipt.event.digest = await eventDigest(receipt.event);
  await verifyNonFoodReceiptV1(raw, actor, receipt);
  receipt.definitionRevision = (await nutritionReceipt()).receipt.definitionRevision;
  await assert.rejects(verifyNonFoodReceiptV1(raw, actor, receipt));
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
