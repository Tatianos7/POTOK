import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeFoodEvidenceReviewRequestRawV1 as decode, foodReviewProposalDigestV1, foodEvidenceRequestDigestRawV1,
  foodEvidenceRequestCanonicalBytesRawV1, foodEvidenceInputDomainsV1, foodEvidenceRequestMaxBytesV1 } from '../foodEvidenceReviewRequestV1';
import { createFoodEvidenceReviewHandlerV1 as handler, createStagingFoodEvidenceReviewGatewayV1,
  verifyFoodEvidenceReceiptV1 as verify, foodEvidenceStagingOriginV1, type FoodEvidenceUserClientV1 } from '../foodEvidenceReviewGatewayV1';
import { foodEvidenceReviewEventDigestRawV1 } from '../../utils/foodReviewedEvidenceV1';
import { id, actor, sha, approved, rejected, receipt, source, proposal } from './foodEvidenceFixturesV1';
const raw = JSON.stringify;
const post = (body: string | ArrayBuffer, authorization = 'Bearer synthetic-test-token'): Request => new Request('https://fixture.invalid/review', {
  method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body });

test('strict approved request: no generated authority/IDs/time/defaults and owned immutable snapshot', async () => {
  const input = await approved(10), decoded = await decode(raw(input));
  assert.deepEqual(decoded,input); assert.ok(Object.isFrozen(decoded)); assert.ok(Object.isFrozen(decoded.retainedSource));
  for (const field of ['actorId','role','authorityReference','occurredAt','timestampOrigin','requestDigest','revisionId']) {
    await assert.rejects(decode(raw({ ...input, [field]: field })),/EXACT_FIELDS/);
  }
  for (const field of Object.keys(input)) { const altered = { ...input } as Record<string,unknown>; delete altered[field]; await assert.rejects(decode(raw(altered))); }
  await assert.rejects(decode(input as unknown as string), /RAW_STRING/);
});
test('duplicate-aware parsing before coercion or digest: root, proposal, source and nested identity', async () => {
  const input = raw(await approved(11));
  for (const [key,value] of [['kind','"REVIEW_APPROVED"'],['canonicalFoodId',raw(id(50))],['byteLength','1'],['name','"Synthetic food"']]) {
    const duplicate = input.replace(`"${key}":`, `"${key}":${value},"${key}":`);
    await assert.rejects(decode(duplicate),/Duplicate|duplicate|DUPLICATE/);
  }
});
test('exact proposal/version/digest and unknown nested fields; no evidence normalization', async () => {
  const input = await approved(12);
  await assert.rejects(decode(raw({ ...input, contract: 'v2' })),/CONTRACT/);
  await assert.rejects(decode(raw({ ...input, proposalDigest: '0'.repeat(64) })),/PROPOSAL_DIGEST/);
  await assert.rejects(decode(raw({ ...input, proposal: { ...input.proposal, extra: true } })),/EXACT_FIELDS/);
  const p = proposal(); p.identitySnapshot.name = 'different';
  assert.notEqual(await foodReviewProposalDigestV1(p), input.proposalDigest);
});
test('nutrition exact scale, mandatory fiber and canonical binding shape', async () => {
  const n = { contract: 'potok-nutrition-review-proposal-v1' as const, canonicalFoodId: id(50), canonicalRevisionId: id(90), canonicalRevisionDigest: 'a'.repeat(64),
    foodState: 'raw' as const, applicability: proposal().applicability, basis: 'PER_100_G_EDIBLE' as const,
    units: { calories: 'kcal' as const, protein: 'g' as const, fat: 'g' as const, carbs: 'g' as const, fiber: 'g' as const },
    nutrition: { calories: '17.200', protein: '1.230', fat: '0.000', carbs: '2.000', fiber: '0.100' } };
  const input = { ...await approved(13), proposal: n, proposalDigest: await foodReviewProposalDigestV1(n), retainedSource: source(213,'fixture',false,true) };
  await decode(raw(input));
  for (const fiber of [undefined,null,0,'-0.000','-1.000','1e0','1.23','1.2300','1.2301','1000000000.000']) {
    await assert.rejects(decode(raw({ ...input, proposal: { ...n, nutrition: { ...n.nutrition, fiber } } })));
  }
  await assert.rejects(decode(raw({ ...input, proposal: { ...n, canonicalRevisionId: 'bad' } })),/UUID/);
});
test('retained bytes: UTF-8/base64, exact lengths/hashes, XOR and coverage; locator never fetched', async () => {
  const input = await approved(14);
  for (const binary of [false,true]) await decode(raw({ ...input, retainedSource: source(214,'сыр\n',binary) }));
  await decode(raw({ ...input, retainedSource: source(215,'zero\u0000byte',true) }));
  await decode(raw({ ...input, retainedSource: source(216,'literal \\u0000 characters') }));
  await assert.rejects(decode(raw({ ...input, retainedSource: source(215,'zero\u0000byte') })),/POSTGRES_TEXT_NUL/);
  const s = source(217,'сыр\n',true);
  for (const altered of [{ ...s, byteLength: 0 },{ ...s, sourceBytesSha256: '0'.repeat(64) },{ ...s, bytesBase64: '***' },
    { ...s, bytesBase64: 'Zh==' },{ ...s, text: 'also text' },{ ...s, mappings: [] }]) await assert.rejects(decode(raw({ ...input, retainedSource: altered })));
});
test('literal raw -0 rejected with otherwise valid request; request cap enforced', async () => {
  const input = { ...await approved(15), retainedSource: source(215,'') };
  await decode(raw(input));
  await assert.rejects(decode(raw(input).replace('"byteLength":0','"byteLength":-0')),/BYTE_LENGTH/);
  await assert.rejects(decode(' '.repeat(foodEvidenceRequestMaxBytesV1 + 1)),/TOO_LARGE/);
});
test('deterministic request/proposal domains and numeric byteLength spelling; raw proposal not normalized', async () => {
  const input = await approved(16), encoded = raw(input);
  const reordered = raw(Object.fromEntries(Object.entries(input).reverse()));
  assert.deepEqual(await foodEvidenceRequestCanonicalBytesRawV1(encoded),await foodEvidenceRequestCanonicalBytesRawV1(reordered));
  assert.equal(await foodEvidenceRequestDigestRawV1(encoded),sha(await foodEvidenceRequestCanonicalBytesRawV1(encoded)));
  assert.notEqual(await foodEvidenceRequestDigestRawV1(encoded),input.proposalDigest);
  const bytes = new TextDecoder().decode(await foodEvidenceRequestCanonicalBytesRawV1(encoded));
  assert.ok(bytes.startsWith(`{"domain":"${foodEvidenceInputDomainsV1.request}","payload":`));
  assert.equal(await foodEvidenceRequestDigestRawV1(encoded),await foodEvidenceRequestDigestRawV1(encoded.replace(`"byteLength":${input.retainedSource.byteLength}`,`"byteLength":${input.retainedSource.byteLength}.0`)));
});
test('rejected proposal has provenance without a reviewed revision; no implicit null retained source', async () => {
  const input = await rejected(17), result = await receipt(input);
  await verify(await decode(raw(input)),actor,result);
  assert.equal(result.revision,null); assert.equal(result.canonicalRevision,null);
  assert.ok(!('revisionId' in result.event.target));
  await assert.rejects(verify(input,actor,{ ...result, revision: {} }));
  const missing = { ...input } as Record<string,unknown>; delete missing.retainedSource;
  await assert.rejects(decode(raw(missing)),/EXACT_FIELDS/);
});
test('approval receipt: exact actor/request/proposal/source bindings survive valid self-digest attacks', async () => {
  const input = await approved(18), result = await receipt(input);
  await verify(input,actor,result);
  for (const event of [{ ...result.event, requestDigest: 'a'.repeat(64) },{ ...result.event, authorityContext: { ...result.event.authorityContext, actorId: id(2) } },
    { ...result.event, idempotencyReference: id(19) },{ ...result.event, retainedSource: source(218,'changed') }]) {
    event.digest = await foodEvidenceReviewEventDigestRawV1(raw(event));
    await assert.rejects(verify(input,actor,{ ...result, event }));
  }
});
test('receipt recovery uses the same mandatory six-field contract as an exact review replay', async () => {
  const input = await rejected(24), original = await receipt(input);
  await verify(input,actor,{ ...original,replayed:true });
  const missing = { ...original } as Record<string,unknown>; delete missing.replayed;
  await assert.rejects(verify(input,actor,missing));
  await assert.rejects(verify(input,actor,{ ...original,replayed:'true' }));
});
test('invalidation requires exact existing revision, source and both severities; no proposal substitution', async () => {
  const approval = await receipt(await approved(19)); assert.ok(approval.revision);
  for (const severity of ['CORRECTION','SAFETY_CRITICAL'] as const) {
    const input = { contract: 'potok-food-evidence-review-request-v1' as const, kind: 'INVALIDATION' as const, idempotencyReference: id(20),
      target: { kind: 'CANONICAL_REVIEWED_REVISION' as const, revisionId: approval.revision.revisionId, digest: approval.revision.digest, canonicalFoodId: id(50) },
      retainedSource: source(220), severity, reason: 'synthetic invalidation' };
    const decoded = await decode(raw(input)); await verify(decoded,actor,await receipt(input,actor,approval.revision));
    await assert.rejects(decode(raw({ ...input, proposal: proposal() })),/EXACT_FIELDS/);
    await assert.rejects(decode(raw({ ...input, retainedSource: null })));
  }
});
test('HTTP authentication rejects missing/invalid JWT verification before any RPC (transport doubles only)', async () => {
  let authCalls = 0, writes = 0;
  const client: FoodEvidenceUserClientV1 = { async verifyUser() { authCalls++; return null; }, async review() { writes++; throw Error('must not run'); } };
  const serve = handler({ createUserClient() { return client; } });
  assert.equal((await serve(post(raw(await approved(21)),''))).status,401);
  assert.equal((await serve(post(raw(await approved(21))))).status,401);
  assert.equal(authCalls,1); assert.equal(writes,0);
});
test('HTTP forwards exact raw bytes once and independently verifies receipt; no automatic retry', async () => {
  const input = await approved(22), result = await receipt(input), encoded = JSON.stringify(input,null,2);
  let calls = 0;
  const serve = handler({ createUserClient(authorization) { assert.equal(authorization,'Bearer synthetic-test-token'); return {
    async verifyUser(token) { assert.equal(token,'synthetic-test-token'); return { id: actor }; },
    async review(request) { calls++; assert.equal(request,encoded); return { data: result, error: null }; },
  }; } });
  assert.equal((await serve(post(encoded))).status,200); assert.equal(calls,1);
  assert.equal((await serve(post(raw({ ...input, actorId: id(2) })))).status,400); assert.equal(calls,1);
});
test('HTTP rejects malformed UTF-8/BOM and sanitizes server errors; Main host has no fallback', async () => {
  let writes = 0;
  const serve = handler({ createUserClient() { return { async verifyUser() { return { id: actor }; },
    async review() { writes++; return { data: null, error: { message: 'private untrusted database detail' } }; } }; } });
  assert.equal((await serve(post(Uint8Array.from([0xff]).buffer))).status,400);
  assert.equal((await serve(post('\ufeff'+raw(await approved(23))))).status,400);
  assert.equal(writes,0);
  const result = await serve(post(raw(await approved(23)))); assert.equal(result.status,503);
  assert.deepEqual(await result.json(),{ error: 'FOOD_EVIDENCE_UNAVAILABLE' }); assert.equal(writes,1);
  assert.throws(() => createStagingFoodEvidenceReviewGatewayV1({ supabaseUrl: 'https://main.invalid', publishableKey: 'synthetic-placeholder' }),/STAGING_CONFIGURATION/);
});
test('server configuration permits public keys only; factory import/construction does not make network calls', () => {
  // These are deliberately synthetic classifications, not signed tokens or real API keys.
  const key = (role: string) => `synthetic.${btoa(JSON.stringify({ role }))}.synthetic`;
  for (const publishableKey of ['sb_publishable_synthetic', key('anon')]) {
    assert.equal(typeof createStagingFoodEvidenceReviewGatewayV1({ supabaseUrl:foodEvidenceStagingOriginV1,publishableKey }),'function');
  }
  for (const publishableKey of ['sb_secret_synthetic',key('service_role'),key('authenticated'),'malformed','']) {
    assert.throws(() => createStagingFoodEvidenceReviewGatewayV1({ supabaseUrl:foodEvidenceStagingOriginV1,publishableKey }),/STAGING_CONFIGURATION/);
  }
});
