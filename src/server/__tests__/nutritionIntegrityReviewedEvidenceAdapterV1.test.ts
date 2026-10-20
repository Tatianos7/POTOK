import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  canonicalFoodReviewedRevisionContractV1 as cc, nutritionReviewedRevisionContractV1 as nc,
  foodEvidenceReviewEventContractV1 as ec, foodReviewedEvidenceEncodingV1 as encoding,
  canonicalFoodReviewedRevisionDigestRawV1 as canonicalDigest,
  nutritionReviewedRevisionDigestRawV1 as nutritionDigest,
  foodEvidenceReviewEventDigestRawV1 as eventDigest,
  type CanonicalFoodReviewedRevisionV1 as Canonical,
  type NutritionReviewedRevisionV1 as Nutrition,
  type FoodEvidenceReviewEventV1 as Event,
} from '../../utils/foodReviewedEvidenceV1';
import {
  resolveReviewedEvidenceSnapshotV1,
  type ReviewedEvidenceSnapshotV1, type ReviewedEvidenceAuthorityV1,
} from '../nutritionIntegrityReviewedEvidenceAdapterV1';

const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const raw = JSON.stringify;
const app = { kind: 'EXACT_FOOD_STATE' as const, foodState: 'as-sold' as const };
const zero = '0'.repeat(64);
const authorized: ReviewedEvidenceAuthorityV1 = { isAuthorizedEvent: async () => true };
async function fixture() {
  const c: Canonical = { contract: cc, encoding, revisionId: id(1), supersedesRevisionId: null, reviewEventId: id(3),
    digest: zero, foodId: id(2), canonicalFoodId: id(2), foodStableId: 'review_fixture', source: 'core',
    foodState: 'as-sold', applicability: app, sharedCatalogAccessible: true,
    identitySnapshot: { name: 'Synthetic', nameOriginal: null, normalizedName: 'synthetic',
      brand: null, normalizedBrand: null, barcode: null, aliases: [] } };
  c.digest = await canonicalDigest(raw(c));
  const n: Nutrition = { contract: nc, encoding, revisionId: id(4), supersedesRevisionId: null,
    reviewEventId: id(5), digest: zero, canonicalRevisionId: c.revisionId,
    canonicalRevisionDigest: c.digest, canonicalFoodId: c.canonicalFoodId, foodState: 'as-sold',
    applicability: app, basis: 'PER_100_G_EDIBLE',
    units: { calories: 'kcal', protein: 'g', fat: 'g', carbs: 'g', fiber: 'g' },
    nutrition: { calories: '100.000', protein: '10.000', fat: '2.000', carbs: '14.000', fiber: '1.000' } };
  n.digest = await nutritionDigest(raw(n));
  async function event(target: Canonical | Nutrition, kind: 'REVIEW_APPROVED' | 'INVALIDATION'): Promise<Event> {
    const isN = target.contract === nc;
    const fields = isN ? ['calories', 'protein', 'fat', 'carbs', 'fiber'] : ['identitySnapshot'];
    const text = 'synthetic retained source';
    const payload = {
      contract: ec, encoding, eventId: kind === 'INVALIDATION' ? id(9) : target.reviewEventId,
      occurredAt: '2026-10-19T12:00:00.000Z', timestampOrigin: 'SERVER' as const,
      authorityContext: { boundary: 'OWNER_ADMIN_REVIEW' as const, actorId: id(6),
        role: 'ADMIN' as const, authorityReference: 'server-auth' },
      idempotencyReference: id(10), requestDigest: hash('request'), digest: zero,
      target: { kind: isN ? 'NUTRITION_REVIEWED_REVISION' as const : 'CANONICAL_REVIEWED_REVISION' as const,
        revisionId: target.revisionId, digest: target.digest, canonicalFoodId: target.canonicalFoodId },
      retainedSource: { sourceArtifactId: id(7), providerIdentity: 'Fixture',
        documentIdentity: 'Fixture document', sourceRevision: null,
        locator: 'synthetic-fixture', capturedAt: '2026-10-19T11:00:00.000Z',
        mediaType: 'text/plain', byteLength: new TextEncoder().encode(text).length,
        sourceBytesSha256: hash(text), text,
        mappings: fields.map(field => ({ field: field as 'identitySnapshot' | 'calories' | 'protein' | 'fat' | 'carbs' | 'fiber',
          sourceField: field, applicability: app })) },
    };
    const result: Event = kind === 'REVIEW_APPROVED' ?
      { ...payload, kind } : { ...payload, kind, severity: 'CORRECTION', reason: 'invalidated' };
    result.digest = await eventDigest(raw(result)); return result;
  }
  const ca = await event(c, 'REVIEW_APPROVED'), na = await event(n, 'REVIEW_APPROVED');
  const snapshot: ReviewedEvidenceSnapshotV1 = {
    requestedFoodId: c.foodId, canonicalRaw: raw(c), nutritionRaw: raw(n),
    canonicalApprovalRaw: raw(ca), nutritionApprovalRaw: raw(na),
    relevantEventRaws: [raw(ca), raw(na)],
    activeCanonicalRevisionId: c.revisionId, activeNutritionRevisionId: n.revisionId,
    currentFoodState: 'as-sold',
  };
  return { snapshot, c, n, ca, na, event };
}

test('complete linked authorized chain yields reviewed source', async () => {
  const { snapshot, n } = await fixture();
  const r = await resolveReviewedEvidenceSnapshotV1(snapshot, authorized);
  assert.equal(r.kind, 'REVIEWED');
  if (r.kind === 'REVIEWED') {
    assert.equal(r.nutritionDigest, n.digest);
    assert.equal(r.current.notInvalidated, true);
  }
});

test('invalidations and incomplete or conflicting event histories fail closed', async () => {
  const { snapshot, n, event } = await fixture();
  const invalidation = await event(n, 'INVALIDATION');
  for (const relevantEventRaws of [
    [], [snapshot.relevantEventRaws[0]], [...snapshot.relevantEventRaws, raw(invalidation)],
    [...snapshot.relevantEventRaws, snapshot.relevantEventRaws[0]], ['malformed-json'],
  ]) {
    const r = await resolveReviewedEvidenceSnapshotV1({ ...snapshot, relevantEventRaws }, authorized);
    assert.equal(r.kind, 'UNRESOLVED');
  }
});

test('mismatched roots, current head, food state, authority and tampering reject', async () => {
  const { snapshot } = await fixture();
  const variants: ReviewedEvidenceSnapshotV1[] = [
    { ...snapshot, requestedFoodId: id(8) },
    { ...snapshot, activeCanonicalRevisionId: id(8) },
    { ...snapshot, activeNutritionRevisionId: id(8) },
    { ...snapshot, currentFoodState: 'cooked' },
    { ...snapshot, nutritionRaw: snapshot.nutritionRaw.replace('100.000', '200.000') },
  ];
  for (const input of variants) {
    assert.equal((await resolveReviewedEvidenceSnapshotV1(input, authorized)).kind, 'UNRESOLVED');
  }
  const denied: ReviewedEvidenceAuthorityV1 = { isAuthorizedEvent: async () => false };
  assert.equal((await resolveReviewedEvidenceSnapshotV1(snapshot, denied)).kind, 'UNRESOLVED');
  const outage: ReviewedEvidenceAuthorityV1 = {
    isAuthorizedEvent: async () => { throw new Error('unavailable'); },
  };
  assert.equal((await resolveReviewedEvidenceSnapshotV1(snapshot, outage)).kind, 'UNRESOLVED');
});
