import test from 'node:test';
import assert from 'node:assert/strict';
import { exactFoodFixtureV2, id, raw, sha } from './exactFoodNutritionFixturesV2';
import { exactFoodNutritionRequestContractV2, decodeExactFoodNutritionReviewRequestRawV2 as decode,
  exactFoodNutritionReviewRequestDigestRawV2 } from '../exactFoodNutritionReviewRequestV2';
import { exactFoodNutritionEventDigestRawV2 } from '../../utils/exactFoodNutritionEvidenceV2';
import { submitExactFoodNutritionReviewV2, recoverExactFoodNutritionReviewV2, verifyExactFoodNutritionReceiptV2,
  readCurrentExactFoodNutritionV2, createStagingExactFoodNutritionUserPortV2, type ExactFoodNutritionUserPortV2 } from '../exactFoodNutritionReviewGatewayV2';
const request = () => ({ contract:exactFoodNutritionRequestContractV2,kind:'REVIEW_APPROVED' as const,
  idempotencyReference:id(11),sourceProposalDigest:'a'.repeat(64),expectedHead:null });
async function fixture() {
  const f = await exactFoodFixtureV2();
  const req = { ...request(),sourceProposalDigest:f.proposal.digest };
  const event = { ...f.na,requestDigest:await exactFoodNutritionReviewRequestDigestRawV2(raw(req)) };
  const sealed = { ...event,digest:await exactFoodNutritionEventDigestRawV2(raw(event)) };
  const receipt = { contract:'potok-exact-food-nutrition-review-receipt-v2',actorId:f.na.authorityContext.actorId,
    idempotencyReference:req.idempotencyReference,requestDigest:sealed.requestDigest,rawRequestSha256:sha(raw(req)),eventRaw:raw(sealed),
    targetRaw:raw(f.revision),sourcePinsRaw:raw(f.pins),replayed:false };
  const port: ExactFoodNutritionUserPortV2 = { verifyUser:async () => ({ id:receipt.actorId }),review:async () => receipt,
    receipt:async () => ({ ...receipt,replayed:true }),current:async () => ({ kind:'COMPLETE_TRUSTED_STORE_SNAPSHOT_V2',snapshot:f.snapshot,
      eventAuthorizations:[f.ca,f.na].map(e => ({ eventId:e.eventId,digest:e.digest,authorized:true })) }) };
  return { f,req,receipt,port };
}
test('request admits only prepared source references and bounded exact CAS context', () => {
  assert.deepEqual(decode(raw(request())),request());
  for (const change of [{ sourceProposal:{ authority:'ADMIN' } },{ sourcePinsRaw:'{}' },{ numericInput:{} },{ actorId:id(6) },
    { expectedHead:{ revisionId:id(1),digest:'bad' } },{ sourceProposalDigest:undefined },{ expectedHead:undefined }]) {
    assert.throws(() => decode(raw({ ...request(),...change })));
  }
});
test('duplicate keys, oversized/deep JSON, negative zero and unknown kinds fail before dispatch', async () => {
  const { port } = await fixture(); let calls = 0;
  for (const s of [raw(request()).replace('{','{"kind":"INVALIDATION",'),raw({ ...request(),expectedHead:-0 }).replace('"expectedHead":0','"expectedHead":-0'),
    '['.repeat(14)+']'.repeat(14),' '.repeat(65537),raw({ ...request(),kind:'APPROVE' })]) {
    await assert.rejects(submitExactFoodNutritionReviewV2({ ...port,review:async () => { calls++; } },s));
  }
  assert.equal(calls,0);
});
test('reasons reject empty, NUL, lone surrogate and excess length', () => {
  for (const reason of [' ','\u0000','\ud800','a'.repeat(1025)]) assert.throws(() => decode(raw({
    contract:exactFoodNutritionRequestContractV2,kind:'REVIEW_REJECTED',idempotencyReference:id(1),sourceProposalDigest:'a'.repeat(64),reason })));
});
test('concrete transport refuses non-Staging origin, privileged keys and malformed bearer without network calls', () => {
  const config = { supabaseUrl:'https://ozidryfvhkcbtpnulakq.supabase.co',publishableKey:'sb_publishable_synthetic',authorization:'Bearer synthetic' };
  for (const change of [{ supabaseUrl:'https://example.invalid' },{ publishableKey:'sb_secret_synthetic' },{ authorization:'' },{ authorization:'Bearer one,two' },
    { publishableKey:'x.'+btoa(raw({ role:'service_role' }))+'.x' }]) assert.throws(() => createStagingExactFoodNutritionUserPortV2({ ...config,...change }),/STAGING_CALLER_JWT_CONFIGURATION_REQUIRED/);
  assert.equal(typeof createStagingExactFoodNutritionUserPortV2(config).review,'function');
});
test('request semantic hash is canonical but raw receipt hash binds exact request bytes', async () => {
  const { req,receipt } = await fixture();
  assert.equal(await exactFoodNutritionReviewRequestDigestRawV2(' '+raw(req)),await exactFoodNutritionReviewRequestDigestRawV2(raw(req)));
  await verifyExactFoodNutritionReceiptV2(raw(req),receipt.actorId,receipt);
  await assert.rejects(verifyExactFoodNutritionReceiptV2(' '+raw(req),receipt.actorId,receipt));
});
test('receipt binds actor, source, event and request independently of self digests', async () => {
  const { req,receipt } = await fixture();
  for (const change of [{ actorId:id(99) },{ rawRequestSha256:'f'.repeat(64) },{ requestDigest:'f'.repeat(64) },
    { sourcePinsRaw:'{}' },{ targetRaw:raw({}) },{ replayed:'true' },{ extra:true }]) {
    await assert.rejects(verifyExactFoodNutritionReceiptV2(raw(req),receipt.actorId,{ ...receipt,...change }));
  }
});
test('uncertain dispatch/receipt/auth produces UNKNOWN; recovery calls no writer', async () => {
  const { req,port } = await fixture(); let writes = 0, reads = 0;
  const losing = { ...port,review:async () => { writes++; throw Error('lost reply'); },receipt:async (key: string) => { reads++; return port.receipt(key); } };
  const pending = await submitExactFoodNutritionReviewV2(losing,raw(req)); assert.equal(pending.kind,'UNKNOWN');
  if (pending.kind!=='UNKNOWN') assert.fail('expected UNKNOWN');
  assert.equal((await recoverExactFoodNutritionReviewV2(losing,pending)).kind,'CONFIRMED'); assert.equal(writes,1); assert.equal(reads,1);
  await assert.rejects(recoverExactFoodNutritionReviewV2({ ...losing,verifyUser:async () => ({ id:id(99) }) },pending),/AUTH_CHANGED/);
  assert.equal(reads,1);
});
test('confirmed result requires stable verified actor before and after write', async () => {
  const { req,port } = await fixture(); assert.equal((await submitExactFoodNutritionReviewV2(port,raw(req))).kind,'CONFIRMED');
  let checks = 0;
  assert.equal((await submitExactFoodNutritionReviewV2({ ...port,verifyUser:async () => ({ id:++checks===1?id(6):id(99) }) },raw(req))).kind,'UNKNOWN');
});
test('atomic trusted SQL snapshot resolves exact values; forged authorization/history fails closed', async () => {
  const { f,port } = await fixture();
  assert.equal((await readCurrentExactFoodNutritionV2(port,f.canonical.foodId,'as-sold')).kind,'REVIEWED_EXACT_V2');
  const valid = JSON.parse(raw(await port.current(f.canonical.foodId,'as-sold')));
  for (const mutate of [
    (v: typeof valid) => { v.eventAuthorizations[0].authorized='true'; },
    (v: typeof valid) => { v.eventAuthorizations[0].digest='f'.repeat(64); },
    (v: typeof valid) => { v.eventAuthorizations[0]=v.eventAuthorizations[1]; },
    (v: typeof valid) => { v.snapshot.relevantEventRaws.pop(); },
    (v: typeof valid) => { v.snapshot.currentFoodState='raw'; },
    (v: typeof valid) => { v.snapshot.requestedFoodId=id(99); },
  ]) {
    const changed = JSON.parse(raw(valid)); mutate(changed);
    assert.equal((await readCurrentExactFoodNutritionV2({ ...port,current:async () => changed },f.canonical.foodId,'as-sold')).kind,'UNRESOLVED');
  }
});
