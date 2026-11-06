import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import { approved, source, actor, foodId, id } from '../../src/server/__tests__/foodEvidenceFixturesV1';
import { foodReviewProposalDigestV1, type FoodEvidenceReviewRequestV1, type NutritionFoodReviewProposalV1 } from '../../src/server/foodEvidenceReviewRequestV1';
import { verifyFoodEvidenceReceiptV1 } from '../../src/server/foodEvidenceReviewGatewayV1';
import { captureExactNutritionInputV2, exactNutritionInputDigestV2 } from '../../src/utils/exactNutritionValuesV2';
import { captureFoodNutritionSourceBindingRawV2, retainedFoodSourceSnapshotDigestRawV2 } from '../../src/utils/foodNutritionSourceBindingV2';
import { type CanonicalFoodReviewedRevisionV1 } from '../../src/utils/foodReviewedEvidenceV1';
import { exactFoodNutritionRequestContractV2, type ExactFoodNutritionReviewRequestV2 } from '../../src/server/exactFoodNutritionReviewRequestV2';
import { verifyExactFoodNutritionReceiptV2, submitExactFoodNutritionReviewV2, recoverExactFoodNutritionReviewV2,
  readCurrentExactFoodNutritionV2, type ExactFoodNutritionUserPortV2 } from '../../src/server/exactFoodNutritionReviewGatewayV2';
import { preparePinnedPilotSourceBindingForReviewV2 } from './pilot-exact-source-review-batch-v2';
import { readPilotBindingSourceDossiersV1 } from './pilot-source-binding-proposals-v1';
import { buildExactFoodNutritionStagingPackageV2,exactStagingCatalogFingerprintQueryV2,exactStagingProjectV2 } from './exact-food-nutrition-staging-package-v2';

const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const raw = JSON.stringify;
interface DB {
  sql(statement: string): Promise<string>;
  asUser(statement: string, user?: string, claims?: Record<string, unknown>): Promise<string>;
}
export async function runExactFoodNutritionAcceptanceV2(t: TestContext, db: DB): Promise<void> {
  const { sql, asUser } = db;
  const staged = process.env.POTOK_EXACT_FOOD_STAGING_ACCEPTANCE==='1';
  const fingerprint = staged?await sql(exactStagingCatalogFingerprintQueryV2):null;
  const candidate = staged?buildExactFoodNutritionStagingPackageV2({ projectId:exactStagingProjectV2,catalogFingerprint:fingerprint! }).sql
    :await readFile('scripts/contracts/exact-food-nutrition-v2-disposable.sql','utf8');
  await t.test('V2 install requires explicit target acknowledgement and leaves no partial objects', async () => {
    await assert.rejects(sql(candidate), staged?/EXPLICIT_EXACT_STAGING_INSTALL_ACK_REQUIRED/:/OWN_DISPOSABLE_CLUSTER_REQUIRED/);
    assert.equal(await sql("SELECT to_regclass('potok_food_evidence.exact_events_v2') IS NULL"),'t');
  });
  const ack = staged?"SET potok_food_evidence.exact_staging_target='staging:ozidryfvhkcbtpnulakq';\n":"SET potok_food_evidence.exact_test_target='disposable-postgresql-only';\n";
  if (staged) {
    await t.test('wrong target, stale catalog pin, leaked ACL and prerequisite drift all reject atomically', async () => {
      await assert.rejects(sql("SET potok_food_evidence.exact_staging_target='production';\n"+candidate),/EXPLICIT_EXACT_STAGING_INSTALL_ACK_REQUIRED/);
      const wrong = buildExactFoodNutritionStagingPackageV2({ projectId:exactStagingProjectV2,catalogFingerprint:'f'.repeat(64) }).sql;
      await assert.rejects(sql(ack+wrong),/STAGING_CATALOG_FINGERPRINT_CHANGED/);
      await sql('GRANT SELECT ON potok_food_evidence.retained_sources_v1 TO authenticated');
      await assert.rejects(sql(ack+candidate),/REVIEWED_V1_PRIVATE_ACL_REQUIRED/);
      await sql('REVOKE SELECT ON potok_food_evidence.retained_sources_v1 FROM authenticated');
      await sql('ALTER FUNCTION potok_food_evidence.authority_v1() SET search_path=public');
      await assert.rejects(sql(ack+candidate),/REVIEWED_V1_PREREQUISITES_REQUIRED/);
      await sql('ALTER FUNCTION potok_food_evidence.authority_v1() SET search_path=pg_catalog');
      assert.equal(await sql("SELECT to_regclass('potok_food_evidence.exact_events_v2') IS NULL"),'t');
    });
  }
  await sql(ack+candidate);
  if (staged) await t.test('reapply fails without replacing or truncating installed evidence objects', async () => {
    await assert.rejects(sql(ack+candidate),/EXACT_V2_ALREADY_PRESENT_REVIEW_STATE/);
  });
  const port = (user = actor): ExactFoodNutritionUserPortV2 => ({
    // Synthetic verified-claims fixture ONLY. Real Auth signature verification is not exercised by this suite.
    verifyUser: async () => ({ id: user }),
    review: async value => JSON.parse(await asUser(`SELECT public.food_nutrition_review_v2(${q(value)})`,user)),
    receipt: async key => JSON.parse(await asUser(`SELECT public.food_nutrition_receipt_v2(${q(key)})`,user)),
    current: async (food,state) => JSON.parse(await asUser(`SELECT public.food_nutrition_current_v2(${q(food)},${q(state)})`,user)),
  });
  const v1 = async (input: FoodEvidenceReviewRequestV1) => {
    const r = JSON.parse(await asUser(`SELECT public.food_evidence_review_v1(${q(raw(input))})`));
    await verifyFoodEvidenceReceiptV1(input,actor,r); return r;
  };
  const canonical = async (food: string, key: number, expectedHead: { revisionId: string; digest: string } | null = null) => {
    const req = await approved(key); req.proposal = { ...req.proposal, canonicalFoodId: food };
    req.proposalDigest = await foodReviewProposalDigestV1(req.proposal); req.expectedHead = expectedHead;
    return (await v1(req)).revision as CanonicalFoodReviewedRevisionV1;
  };
  const prepare = async (c: CanonicalFoodReviewedRevisionV1, n: number) => {
    const s = source(n, 'SYNTHETIC: 378.866123 kcal; protein 13.49645; fat 5.89; available carbs 58.23755; fiber 10.42.\n', false, true);
    const input = captureExactNutritionInputV2({ sourceRecord: 'synthetic-row', declaredRetainedArtifactSha256: s.sourceBytesSha256,
      basis: 'PER_100_G_EDIBLE', carbohydrateSemantics: 'AVAILABLE_EXCLUDING_FIBER', mappingPolicyRef: 'synthetic-exact-mapper-v2',
      units: { calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g' } },
    { calories:'378.866123',protein:'13.49645',fat:'5.89',carbs:'58.23755',fiber:'10.42' });
    const pins = { canonicalRevisionDigest: c.digest, numericInputDigest: await exactNutritionInputDigestV2(input),
      retainedSnapshotDigest: await retainedFoodSourceSnapshotDigestRawV2(raw(s)) };
    const p = await captureFoodNutritionSourceBindingRawV2(raw(c),raw(s),raw(input),raw(pins));
    const register = (pRaw = raw(p), pinsRaw = raw(pins)) => sql(`SELECT potok_food_evidence.register_exact_source_v2(${q(pRaw)},${q(pinsRaw)})`);
    await register(); return { p, pins, register };
  };
  const approve = (key: number, digest: string, expectedHead: { revisionId: string; digest: string } | null = null): ExactFoodNutritionReviewRequestV2 => ({
    contract: exactFoodNutritionRequestContractV2, kind:'REVIEW_APPROVED',idempotencyReference:id(key),sourceProposalDigest:digest,expectedHead });
  const issue = async (req: ExactFoodNutritionReviewRequestV2, user = actor) => {
    const receipt = await port(user).review(raw(req)); await verifyExactFoodNutritionReceiptV2(raw(req),user,receipt);
    return receipt as { eventRaw: string; targetRaw: string; replayed: boolean };
  };
  // Extra canonical root is fixture setup, never a side effect of issuance.
  await sql(`INSERT INTO public.foods SELECT ${q(id(51))},${q(id(51))},stable_food_id,source,created_by_user_id,is_searchable,needs_review,
    name,name_original,normalized_name,brand,normalized_brand,barcode,aliases FROM public.foods WHERE id=${q(foodId)}`);
  const before = await sql(`SELECT jsonb_build_object('foods',(SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.foods f),
    'diary',(SELECT jsonb_agg(to_jsonb(f)) FROM public.food_diary_entries f),'aliases',(SELECT jsonb_agg(to_jsonb(f)) FROM public.food_aliases f))`);
  const c = await canonical(foodId,5000), dossier = await prepare(c,5200);
  await t.test('actual retained primary capture passes the mapper-to-SQL preparation boundary without issuing approval', async () => {
    // Synthetic canonical identity ONLY: this tests bytes/precision/storage, not real source/food equivalence.
    const sourceRecord = 'FDC_FOUNDATION:2346396:2048:2033:100G';
    const source = readPilotBindingSourceDossiersV1().get(sourceRecord)!;
    const input = captureExactNutritionInputV2({ sourceRecord,declaredRetainedArtifactSha256:source.retainedSha256,basis:source.basis,
      units:{ calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g' },carbohydrateSemantics:'AVAILABLE_EXCLUDING_FIBER',
      mappingPolicyRef:'EXISTING_OFFLINE_SAME_SOURCE_CARBOHYDRATE_MAPPING_NOT_ISSUED_EVIDENCE' },source.vector);
    const handoff = await preparePinnedPilotSourceBindingForReviewV2({ sourceRecord,canonicalRaw:raw(c),expectedCanonicalDigest:c.digest,
      expectedNumericInputDigest:await exactNutritionInputDigestV2(input),expectedRetainedSha256:source.retainedSha256,
      expectedFoodState:'raw',sourceArtifactId:id(6000),capturedAt:new Date().toISOString() });
    assert.equal(await sql(`SELECT potok_food_evidence.register_exact_source_v2(${q(raw(handoff.proposal))},${q(raw(handoff.pins))})`),handoff.proposal.digest);
    assert.equal(await sql(`SELECT proposal->'numericInput'->'mappedDecimalText'->>'calories' FROM potok_food_evidence.exact_sources_v2 WHERE digest=${q(handoff.proposal.digest)}`),'378.866123');
    assert.equal(await sql('SELECT count(*) FROM potok_food_evidence.exact_events_v2'),'0');
    assert.equal((await readCurrentExactFoodNutritionV2(port(),foodId,'raw')).kind,'UNRESOLVED');
  });
  await t.test('private prepared sources confer no approval; current read stays unresolved', async () => {
    assert.equal(await dossier.register(),dossier.p.digest);
    assert.equal(await sql('SELECT count(*) FROM potok_food_evidence.exact_events_v2'),'0');
    assert.equal((await readCurrentExactFoodNutritionV2(port(),foodId,'raw')).kind,'UNRESOLVED');
  });
  await t.test('FORCE RLS and least privilege prohibit all direct client writes/private preparation', async () => {
    assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='potok_food_evidence' AND relname LIKE 'exact_%_v2' AND relkind='r' AND relrowsecurity AND relforcerowsecurity"),'5');
    for (const role of ['anon','authenticated','service_role']) {
      await assert.rejects(sql(`SET ROLE ${role}; SELECT potok_food_evidence.register_exact_source_v2('{}','{}')`),/permission denied/);
      await assert.rejects(sql(`SET ROLE ${role}; INSERT INTO potok_food_evidence.exact_requests_v2 DEFAULT VALUES`),/permission denied/);
      if (role!=='authenticated') await assert.rejects(sql(`SET ROLE ${role}; SELECT public.food_nutrition_review_v2('{}')`),/permission denied/);
    }
  });
  await t.test('source bytes, independent pins, states and exact fractions are checked in SQL', async () => {
    await assert.rejects(dossier.register(raw(dossier.p),raw({ ...dossier.pins,numericInputDigest:'f'.repeat(64) })),/INDEPENDENT_SOURCE_PIN_MISMATCH/);
    const p = JSON.parse(raw(dossier.p));
    p.numericInput.values.calories = { numerator:'378866', denominator:'1000' };
    await assert.rejects(dossier.register(raw(p)),/EXACT_SOURCE_VALUE_MISMATCH/);
    const wrongSource = { ...dossier.p,retainedSource:{ ...dossier.p.retainedSource,text:'replaced bytes' } };
    await assert.rejects(dossier.register(raw(wrongSource)),/SOURCE_BYTE_LENGTH_MISMATCH|SOURCE_SHA256_MISMATCH/);
    await assert.rejects(dossier.register(raw(dossier.p).replace('"byteLength":', '"byteLength":0,"byteLength":')),/DUPLICATE_JSON_KEYS/);
  });
  await t.test('is_admin alone, anonymous sessions, expired JWT and missing sessions cannot issue', async () => {
    const req = raw(approve(5001,dossier.p.digest));
    for (const [user,claims,pattern] of [[id(3),{},/VERIFIED_ADMIN_REQUIRED/],[id(4),{},/LIVE_AUTH_SESSION_REQUIRED/],
      [actor,{ exp:0 },/JWT_EXPIRED/],[actor,{ session_id:id(999) },/LIVE_AUTH_SESSION_REQUIRED/]] as const) {
      await assert.rejects(asUser(`SELECT public.food_nutrition_review_v2(${q(req)})`,user,claims),pattern);
    }
    await assert.rejects(port().review(raw({ ...approve(5001,dossier.p.digest),actorId:actor })),/EXACT_FIELDS_REQUIRED/);
  });
  const req = approve(5002,dossier.p.digest); let first!: Awaited<ReturnType<typeof issue>>;
  await t.test('actual issuance preserves 378.866123 and all decimal text with V2 artifact parity', async () => {
    first = await issue(req);
    const r = JSON.parse(first.targetRaw);
    assert.equal(r.sourceProposal.numericInput.mappedDecimalText.calories,'378.866123');
    assert.deepEqual(r.sourceProposal.numericInput.values.calories,{ numerator:'378866123',denominator:'1000000' });
    assert.equal(r.sourceProposal.authority,'NONE'); assert.equal(r.sourceProposal.status,'REVIEW_REQUIRED');
    assert.equal(first.replayed,false);
  });
  await t.test('exact-byte retry reuses event and revision; whitespace change conflicts', async () => {
    const again = await issue(req); assert.equal(again.eventRaw,first.eventRaw); assert.equal(again.targetRaw,first.targetRaw); assert.equal(again.replayed,true);
    await assert.rejects(port().review(' '+raw(req)),/IDEMPOTENCY_PAYLOAD_CONFLICT/);
    assert.equal(await sql('SELECT count(*) FROM potok_food_evidence.exact_events_v2'),'1');
  });
  await t.test('current read uses actual stored event-time attestations and feeds exact consumer', async () => {
    const envelope = await port().current(foodId,'raw') as { kind: string; eventAuthorizations: { authorized: unknown }[] };
    assert.equal(envelope.kind,'COMPLETE_TRUSTED_STORE_SNAPSHOT_V2');
    assert.equal(envelope.eventAuthorizations.length,2); assert.ok(envelope.eventAuthorizations.every(e => e.authorized===true));
    const current = await readCurrentExactFoodNutritionV2(port(),foodId,'raw'); assert.equal(current.kind,'REVIEWED_EXACT_V2');
    if (current.kind==='REVIEWED_EXACT_V2') assert.equal(current.numericInput.mappedDecimalText.protein,'13.49645');
    const valid = await port().current(foodId,'raw') as { eventAuthorizations: { authorized: unknown }[] };
    const forged = structuredClone(valid); forged.eventAuthorizations[0].authorized='true';
    assert.equal((await readCurrentExactFoodNutritionV2({ ...port(),current:async () => forged },foodId,'raw')).kind,'UNRESOLVED');
    assert.equal((await readCurrentExactFoodNutritionV2(port(),foodId,'dry')).kind,'UNRESOLVED');
  });
  await t.test('lost reply produces UNKNOWN; read-only actor-pinned recovery never repeats write', async () => {
    let writes = 0; const losing = { ...port(), review:async (s: string) => { writes++; await port().review(s); throw Error('lost response'); } };
    const head = JSON.parse(first.targetRaw);
    const pending = await submitExactFoodNutritionReviewV2(losing,raw(approve(5003,dossier.p.digest,{ revisionId:head.revisionId,digest:head.digest })));
    assert.equal(pending.kind,'UNKNOWN'); assert.equal(writes,1);
    if (pending.kind!=='UNKNOWN') assert.fail('expected UNKNOWN');
    const recovered = await recoverExactFoodNutritionReviewV2(losing,pending); assert.equal(recovered.kind,'CONFIRMED'); assert.equal(writes,1);
    await assert.rejects(recoverExactFoodNutritionReviewV2(port(id(2)),pending),/AUTH_CHANGED/);
    await assert.rejects(port(id(2)).receipt(pending.idempotencyReference),/REQUEST_NOT_FOUND/);
  });
  let latest!: { revisionId: string; digest: string };
  await t.test('real concurrent reviewers with the same expected head have exactly one winner', async () => {
    const state = await readCurrentExactFoodNutritionV2(port(),foodId,'raw'); if (state.kind!=='REVIEWED_EXACT_V2') assert.fail('missing current');
    const head = { revisionId:state.nutritionRevisionId,digest:state.nutritionDigest };
    const result = await Promise.allSettled([issue(approve(5004,dossier.p.digest,head)),issue(approve(5005,dossier.p.digest,head),id(2))]);
    assert.equal(result.filter(r => r.status==='fulfilled').length,1);
    const failed = result.find(r => r.status==='rejected'); assert.match(String(failed?.status==='rejected' ? failed.reason : ''),/CURRENT_HEAD_CONFLICT/);
    const state2 = await readCurrentExactFoodNutritionV2(port(),foodId,'raw'); if (state2.kind!=='REVIEWED_EXACT_V2') assert.fail('missing current');
    latest = { revisionId:state2.nutritionRevisionId,digest:state2.nutritionDigest };
  });
  const invalidate = (key: number, revision: { revisionId: string; digest: string }): ExactFoodNutritionReviewRequestV2 => ({
    contract:exactFoodNutritionRequestContractV2,kind:'INVALIDATION',idempotencyReference:id(key),
    target:{ revisionId:revision.revisionId,digest:revision.digest,canonicalFoodId:foodId },severity:'SAFETY_CRITICAL',reason:'Synthetic source correction' });
  await t.test('historical invalidation cannot roll back or invalidate a newer head', async () => {
    await issue(invalidate(5006,JSON.parse(first.targetRaw)));
    const state = await readCurrentExactFoodNutritionV2(port(),foodId,'raw'); assert.equal(state.kind,'REVIEWED_EXACT_V2');
    if (state.kind==='REVIEWED_EXACT_V2') assert.equal(state.nutritionRevisionId,latest.revisionId);
  });
  await t.test('current invalidation blocks read; no fallback to historical approval', async () => {
    await issue(invalidate(5007,latest)); assert.equal((await readCurrentExactFoodNutritionV2(port(),foodId,'raw')).kind,'UNRESOLVED');
    assert.equal(await sql(`SELECT revision_id FROM potok_food_evidence.exact_heads_v2 WHERE canonical_food_id=${q(foodId)}`),latest.revisionId);
  });
  await t.test('rejection creates terminal event/receipt without revision or head change', async () => {
    const before = await sql('SELECT count(*) FROM potok_food_evidence.exact_revisions_v2');
    await issue({ contract:exactFoodNutritionRequestContractV2,kind:'REVIEW_REJECTED',idempotencyReference:id(5008),sourceProposalDigest:dossier.p.digest,reason:'Synthetic rejected mapping' });
    assert.equal(await sql('SELECT count(*) FROM potok_food_evidence.exact_revisions_v2'),before);
  });
  const nutritionV1 = (c: CanonicalFoodReviewedRevisionV1): NutritionFoodReviewProposalV1 => ({
    contract:'potok-nutrition-review-proposal-v1',canonicalFoodId:c.canonicalFoodId,canonicalRevisionId:c.revisionId,canonicalRevisionDigest:c.digest,
    nutrition:{ calories:'378.866',protein:'13.496',fat:'5.890',carbs:'58.238',fiber:'10.420' }, basis:'PER_100_G_EDIBLE',
    units:{ calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g' },foodState:'raw',applicability:c.applicability });
  const v1Nutrition = async (c: CanonicalFoodReviewedRevisionV1,key: number) => {
    const p = nutritionV1(c); return v1({ contract:'potok-food-evidence-review-request-v1',kind:'REVIEW_APPROVED',idempotencyReference:id(key),proposal:p,
      proposalDigest:await foodReviewProposalDigestV1(p),expectedHead:null,retainedSource:source(key+100,undefined,false,true) });
  };
  await t.test('V2 head prevents V1 downgrade even after invalidation', async () => {
    await assert.rejects(v1Nutrition(c,5010),/EXPLICIT_NUTRITION_VERSION_MIGRATION_REQUIRED/);
  });
  await t.test('existing V1 head prevents implicit V2 takeover', async () => {
    const second = await canonical(id(51),5011); await v1Nutrition(second,5012);
    const prepared = await prepare(second,5212);
    await assert.rejects(issue(approve(5013,prepared.p.digest)),/EXPLICIT_NUTRITION_VERSION_MIGRATION_REQUIRED/);
  });
  await t.test('deferred COMMIT rechecks real session expiry and atomically rolls back all writes', async () => {
    const count = await sql('SELECT count(*) FROM potok_food_evidence.exact_events_v2');
    await sql(`UPDATE auth.sessions SET not_after=clock_timestamp()+interval '1.5 seconds' WHERE id=${q(id(101))}`);
    try {
      await assert.rejects(asUser(`SELECT public.food_nutrition_review_v2(${q(raw(approve(5014,dossier.p.digest,latest)))}); SELECT pg_sleep(2)`),/LIVE_AUTH_SESSION_REQUIRED/);
    } finally { await sql(`UPDATE auth.sessions SET not_after=NULL WHERE id=${q(id(101))}`); }
    assert.equal(await sql('SELECT count(*) FROM potok_food_evidence.exact_events_v2'),count);
    await assert.rejects(port().receipt(id(5014)),/REQUEST_NOT_FOUND/);
  });
  await t.test('deferred COMMIT also rejects admin entitlement expiry and leaves no event/receipt', async () => {
    const count = await sql('SELECT count(*) FROM potok_food_evidence.exact_events_v2');
    await sql(`SELECT potok_control.grant_entitlement_v2(${q(id(2))},'admin',clock_timestamp()+interval '1.5 seconds','synthetic-expiry','synthetic test')`);
    const req: ExactFoodNutritionReviewRequestV2 = { contract:exactFoodNutritionRequestContractV2,kind:'REVIEW_REJECTED',
      idempotencyReference:id(5018),sourceProposalDigest:dossier.p.digest,reason:'Synthetic expiry test' };
    await assert.rejects(asUser(`SELECT public.food_nutrition_review_v2(${q(raw(req))}); SELECT pg_sleep(2)`,id(2)),/VERIFIED_ADMIN_REQUIRED/);
    await sql(`SELECT potok_control.grant_entitlement_v2(${q(id(2))},'admin',NULL,'synthetic-restored','synthetic test')`);
    assert.equal(await sql('SELECT count(*) FROM potok_food_evidence.exact_events_v2'),count);
    await assert.rejects(port(id(2)).receipt(id(5018)),/REQUEST_NOT_FOUND/);
  });
  await t.test('admin revocation blocks new access but does not retroactively revoke historical source approval', async () => {
    const r = await issue(approve(5017,dossier.p.digest,latest)); const revision = JSON.parse(r.targetRaw);
    latest = { revisionId:revision.revisionId,digest:revision.digest };
    await sql(`SELECT potok_control.revoke_entitlement_v2(${q(actor)},'admin','synthetic-revoke','synthetic test')`);
    assert.equal((await readCurrentExactFoodNutritionV2(port(),foodId,'raw')).kind,'UNRESOLVED');
    assert.equal((await readCurrentExactFoodNutritionV2(port(id(2)),foodId,'raw')).kind,'REVIEWED_EXACT_V2');
    await sql(`SELECT potok_control.grant_entitlement_v2(${q(actor)},'admin',NULL,'synthetic-restored','synthetic test')`);
  });
  await t.test('immutable revisions/events/requests/sources resist owner mutation and truncate', async () => {
    for (const table of ['exact_sources_v2','exact_revisions_v2','exact_events_v2','exact_requests_v2']) {
      await assert.rejects(sql(`DELETE FROM potok_food_evidence.${table}`),/IMMUTABLE_FOOD_EVIDENCE/);
      await assert.rejects(sql(`TRUNCATE potok_food_evidence.${table} CASCADE`),/IMMUTABLE_FOOD_EVIDENCE/);
    }
  });
  await t.test('new canonical head makes old dossier unusable until explicitly prepared against it', async () => {
    await canonical(foodId,5015,{ revisionId:c.revisionId,digest:c.digest });
    await assert.rejects(issue(approve(5016,dossier.p.digest,latest)),/LIVE_CANONICAL_BINDING_REQUIRED/);
    assert.equal((await readCurrentExactFoodNutritionV2(port(),foodId,'raw')).kind,'UNRESOLVED');
  });
  await t.test('issuance never changes foods, aliases or historical diary snapshots', async () => {
    assert.equal(await sql(`SELECT jsonb_build_object('foods',(SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.foods f),
      'diary',(SELECT jsonb_agg(to_jsonb(f)) FROM public.food_diary_entries f),'aliases',(SELECT jsonb_agg(to_jsonb(f)) FROM public.food_aliases f))`),before);
  });
}
