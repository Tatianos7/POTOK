import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preparePilotExactSourceReviewBatchV2 as prepare,preparePinnedPilotSourceBindingForReviewV2 as bind } from './pilot-exact-source-review-batch-v2';
import { readPilotBindingSourceDossiersV1 } from './pilot-source-binding-proposals-v1';
import { buildPilotInputFreezeV1,readAdmissionContractSourcesV1 } from './pilot-admission-readiness-v1';
import { calculatePreciseInputV3 } from './foundation-variants-review-v1';
import type { ReviewInputModelV1 } from './week-quality-preparation-v1';
import { decodeFoodNutritionSourceBindingRawV2 } from '../../src/utils/foodNutritionSourceBindingV2';
import { decodeExactFoodNutritionReviewRequestRawV2 } from '../../src/server/exactFoodNutritionReviewRequestV2';
import { decodeExactFoodNutritionRevisionRawV2 } from '../../src/utils/exactFoodNutritionEvidenceV2';
import { exactNutritionInputDigestV2,captureExactNutritionInputV2 } from '../../src/utils/exactNutritionValuesV2';
import { exactFoodFixtureV2,raw,id } from '../../src/server/__tests__/exactFoodNutritionFixturesV2';
const sources = readPilotBindingSourceDossiersV1();
const oats = 'FDC_FOUNDATION:2346396:2048:2033:100G';
function fixture(keys = ['SR28:09252',oats,'FDC_FOUNDATION:2346393:2048:1079:RAW:100G','SR28:14411','SR28:02047']) {
  const rows = keys.map((key,n)=>({ component:{ rowId:'row_'+n,status:'DECLARED_SOURCE_INPUT_MODEL' as const,
    componentKind:key==='SR28:14411'?'POTABLE_WATER' as const:key==='SR28:02047'?'TABLE_SALT' as const:'FOOD' as const,
    sourceRecord:key,vector:{ ...sources.get(key)!.vector },quantityG:key==='SR28:14411'?null:'10',
    quantityDecision:key==='SR28:14411'?'TYPED_WATER_ZERO_NO_GRAM_CONVERSION':'DECLARED_GRAMS',optional:false } }));
  const models: ReviewInputModelV1[] = [{ recipeId:'synthetic_batch',sourceCategory:'SNACK',declaredServings:2,rows,
    calculation:calculatePreciseInputV3(rows.map(r=>r.component),2),sourceApproved:false,runtimePublishable:false }];
  const candidateRaw = raw({ originalAuthoringCatalog:{ recipes:[{ recipeId:'synthetic_batch',declaredServings:2,sourceRecipe:{ meal_type_primary:'SNACK' },
    ingredients:rows.map(({ component:c })=>({ ingredient_row_id:c.rowId,canonical_status:'UNRESOLVED',ingredient_name_ru:'synthetic' })) }] } });
  const snapshot = { contract:'potok-shared-catalog-lookup-snapshot-v1',environment:'STAGING',projectId:'synthetic',readOnly:true,
    readScope:'SHARED_CORE_BRAND_ONLY_NO_USER_ROWS',capturedAt:'2026-11-06T00:00:00Z',sharedFoodCount:0,schemaHasReviewFlags:true,
    queries:[{ key:'synthetic',nameRows:[],aliasRows:[],nameCount:0,aliasCount:0,unavailableAliasCount:0 }] };
  const freeze = buildPilotInputFreezeV1(candidateRaw,models,readAdmissionContractSourcesV1());
  return { models,candidateRaw,snapshot,freeze };
}
const run = (f = fixture()) => prepare(f.candidateRaw,f.models,raw(f.snapshot),raw(f.freeze));
test('real retained oats and almonds pass exact V2 without changing their source decimal text', async () => {
  const f = fixture(), before = raw(f), packet = await run(f);
  assert.equal(packet.summary.ingredientRows,5); assert.equal(packet.summary.foodRowsPreviouslyBlockedByV1Precision,2);
  const o = packet.items.find(i=>i.sourceRecord===oats)!;
  assert.equal(o.numericInput!.mappedDecimalText.calories,'378.866123');
  assert.equal(o.numericInput!.mappedDecimalText.carbs,'58.23755000');
  assert.deepEqual(o.numericInput!.values.calories,{ numerator:'378866123',denominator:'1000000' });
  assert.equal(o.retainedMaterial.retainedCaptureIsNotFullRemoteResponse,true);
  assert.notEqual(o.retainedMaterial.sha256,o.retainedMaterial.sourceResponseSha256);
  assert.equal(raw(f),before); assert.equal(packet.recipeQuantitiesAndTotals,'NOT_MODIFIED_OR_RECALCULATED');
});
test('water and salt keep typed routes and do not become canonical-food nutrition or converted grams', async () => {
  const p = await run();
  for (const item of p.items.filter(i=>i.componentKind!=='FOOD')) {
    assert.equal(item.numericInput,null); assert.equal(item.numericInputDigest,null);
    assert.ok(item.occurrences.every(o=>o.route==='EXISTING_TYPED_NONFOOD_REVIEW'));
  }
  assert.equal(p.items.find(i=>i.componentKind==='POTABLE_WATER')!.occurrences[0].quantityG,null);
});
test('two oat binding labels remain separate and all source occurrences retain their row identities', async () => {
  const p = await run(fixture([oats,oats,'FDC_FOUNDATION:2346396:2048:2033:PER_100_G_FOOD']));
  assert.equal(p.items.length,2); assert.equal(p.summary.ingredientRows,3);
  assert.equal(p.items.find(i=>i.sourceRecord===oats)!.occurrences.length,2);
  assert.equal(new Set(p.items.flatMap(i=>i.occurrences.map(o=>o.rowId))).size,3);
});
test('missing exact-name match never creates identity, source authority or a writable request', async () => {
  const p = await run(); assert.equal(p.summary.sourceApprovals,0); assert.equal(p.summary.appliedBindings,0);
  for (const item of p.items) {
    assert.equal(item.canonicalRevision,null); assert.equal(item.sourceBindingProposal,null); assert.equal(item.reviewEvent,null);
    assert.ok(item.occurrences.every(o=>o.canonicalRevision===null && o.catalogIdentityStatus==='NO_EXACT_MATCH'));
  }
  for (const value of [p,{ ...p,sourceApproved:true,readyForServerSubmission:true }]) {
    assert.throws(()=>decodeExactFoodNutritionReviewRequestRawV2(raw(value)));
    await assert.rejects(decodeExactFoodNutritionRevisionRawV2(raw(value),'{}'));
  }
});
test('changed source values, row kinds, recipe bytes, freeze or promoted flags fail closed', async () => {
  for (const mode of ['VALUE','KIND','BYTES','FREEZE','FLAG']) {
    const f = fixture();
    if (mode==='VALUE') f.models[0].rows[0].component.vector!.calories='999';
    if (mode==='KIND') f.models[0].rows[3].component.componentKind='FOOD';
    if (mode==='BYTES') f.candidateRaw+=' ';
    if (mode==='FREEZE') f.freeze.inputSetSha256='f'.repeat(64);
    if (mode==='FLAG') Object.assign(f.models[0],{ sourceApproved:true });
    await assert.rejects(run(f));
  }
});
test('a rehashed caller freeze cannot replace validated primary values or turn water into food', async () => {
  for (const kind of ['VALUE','KIND']) {
    const f = fixture();
    if (kind==='VALUE') f.models[0].rows[0].component.vector!.calories='999';
    else { f.models[0].rows[3].component.componentKind='FOOD'; f.models[0].rows[3].component.quantityG='10'; f.models[0].rows[3].component.quantityDecision='DECLARED_GRAMS'; }
    await assert.rejects(async () => {
      f.models[0].calculation=calculatePreciseInputV3(f.models[0].rows.map(r=>r.component),2);
      f.freeze=buildPilotInputFreezeV1(f.candidateRaw,f.models,readAdmissionContractSourcesV1());
      await run(f);
    });
  }
});
async function bindingFixture() {
  const f = await exactFoodFixtureV2(), packet = await run(), item = packet.items.find(i=>i.sourceRecord===oats)!;
  return { f,item,selection:{ sourceRecord:oats,canonicalRaw:raw(f.canonical),expectedCanonicalDigest:f.canonical.digest,
    expectedNumericInputDigest:item.numericInputDigest!,expectedRetainedSha256:item.retainedMaterial.sha256,expectedFoodState:'as-sold' as const,
    sourceArtifactId:id(500),capturedAt:'2026-11-06T00:00:00.000Z' } };
}
test('post-identity handoff retains actual capture bytes and emits a decodable NONE/REVIEW_REQUIRED proposal', async () => {
  const { item,selection } = await bindingFixture(), result = await bind(selection);
  const proposal = await decodeFoodNutritionSourceBindingRawV2(raw(result.proposal),raw(result.pins));
  assert.equal(proposal.numericInput.reference.declaredRetainedArtifactSha256,item.retainedMaterial.sha256);
  assert.equal(proposal.retainedSource.text,readFileSync(item.retainedMaterial.path,'utf8'));
  assert.equal(proposal.numericInput.mappedDecimalText.calories,'378.866123');
  assert.equal(proposal.authority,'NONE'); assert.equal(proposal.status,'REVIEW_REQUIRED');
  assert.equal(result.readyForServerSubmission,false); assert.equal(result.sourceApproved,false);
  assert.equal(result.identityApplicability,'EXPLICIT_REVIEW_STILL_REQUIRED');
  assert.throws(()=>decodeExactFoodNutritionReviewRequestRawV2(raw(result)));
});
test('handoff rejects mismatched independently selected identity/state/source/numeric pins and typed nonfood', async () => {
  const { selection } = await bindingFixture();
  for (const change of [{ expectedCanonicalDigest:'f'.repeat(64) },{ expectedNumericInputDigest:'f'.repeat(64) },
    { expectedRetainedSha256:'f'.repeat(64) },{ expectedFoodState:'raw' as const },{ sourceRecord:'SR28:14411' },
    { sourceRecord:'SR28:02047' },{ capturedAt:'2026-11-06' }]) await assert.rejects(bind({ ...selection,...change }));
});
test('source selection and pins are owned before asynchronous digest verification', async () => {
  const { selection } = await bindingFixture();
  const result = bind(selection); selection.expectedNumericInputDigest='f'.repeat(64); selection.sourceRecord='SR28:14411';
  assert.equal((await result).proposal.numericInput.mappedDecimalText.calories,'378.866123');
});
test('all retained food source labels map to exact numeric values, not three-place replacements', async () => {
  const keys = [...sources.keys()].filter(k=>!['SR28:14411','SR28:02047'].includes(k));
  const packet = await run(fixture(keys)); assert.equal(packet.items.length,keys.length);
  for (const item of packet.items) {
    assert.deepEqual(item.numericInput!.mappedDecimalText,sources.get(item.sourceRecord)!.vector);
    assert.equal(item.numericInputDigest,await exactNutritionInputDigestV2(captureExactNutritionInputV2(item.numericInput!.reference,item.numericInput!.mappedDecimalText)));
  }
});
