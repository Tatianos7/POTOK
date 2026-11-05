// Synthetic-only fixtures. No real canonical IDs, approvals, authority or receipts are issued.
import { createHash } from 'node:crypto';
import {
  canonicalFoodReviewedRevisionContractV1, foodReviewedEvidenceEncodingV1, foodEvidenceReviewEventContractV1,
  canonicalFoodReviewedRevisionDigestRawV1, foodEvidenceReviewEventDigestRawV1,
  type CanonicalFoodReviewedRevisionV1, type FoodEvidenceReviewEventV1, type RetainedFoodSourceSnapshotV1,
} from '../../utils/foodReviewedEvidenceV1';
import { captureExactNutritionInputV2, exactNutritionInputDigestV2 } from '../../utils/exactNutritionValuesV2';
import { captureFoodNutritionSourceBindingRawV2, retainedFoodSourceSnapshotDigestRawV2 } from '../../utils/foodNutritionSourceBindingV2';
import {
  exactFoodNutritionRevisionContractV2, exactFoodNutritionEventContractV2, exactFoodNutritionEvidenceEncodingV2,
  exactFoodNutritionRevisionDigestRawV2, exactFoodNutritionEventDigestRawV2,
  type ExactFoodNutritionRevisionV2, type ExactFoodNutritionReviewEventV2,
} from '../../utils/exactFoodNutritionEvidenceV2';
import type { ExactFoodNutritionReviewedSnapshotV2 } from '../exactFoodNutritionReviewedAdapterV2';
export const raw = JSON.stringify;
export const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
export const copy = <T>(value: T): T => JSON.parse(raw(value)) as T;
export async function exactFoodFixtureV2(basis: 'PER_100_G_EDIBLE' | 'PER_100_G_FOOD' = 'PER_100_G_FOOD') {
  const zero = '0'.repeat(64), app = { kind: 'EXACT_FOOD_STATE' as const, foodState: 'as-sold' as const };
  const authorityContext = { boundary: 'OWNER_ADMIN_REVIEW' as const, actorId: id(6), role: 'ADMIN' as const, authorityReference: 'synthetic event-time authority' };
  const canonical: CanonicalFoodReviewedRevisionV1 = { contract: canonicalFoodReviewedRevisionContractV1, encoding: foodReviewedEvidenceEncodingV1,
    revisionId: id(1), supersedesRevisionId: null, reviewEventId: id(2), digest: zero,
    foodId: id(3), canonicalFoodId: id(3), foodStableId: 'synthetic-v2', source: 'core', foodState: 'as-sold', applicability: app, sharedCatalogAccessible: true,
    identitySnapshot: { name: 'Synthetic 🥕', nameOriginal: null, normalizedName: 'synthetic', brand: null, normalizedBrand: null, barcode: null, aliases: [] } };
  canonical.digest = await canonicalFoodReviewedRevisionDigestRawV1(raw(canonical));
  const text = 'synthetic retained artifact 🥕';
  const source: RetainedFoodSourceSnapshotV1 = { sourceArtifactId: id(4), providerIdentity: 'Synthetic', documentIdentity: 'Fixture',
    sourceRevision: null, locator: 'https://example.invalid/synthetic', capturedAt: '2026-11-05T00:00:00.000Z', mediaType: 'text/plain',
    byteLength: Buffer.byteLength(text), sourceBytesSha256: sha(text), text,
    mappings: (['calories', 'protein', 'fat', 'carbs', 'fiber'] as const).map(field => ({ field, sourceField: 'synthetic.' + field, applicability: app })) };
  const input = captureExactNutritionInputV2({ sourceRecord: 'synthetic', declaredRetainedArtifactSha256: sha(text), basis,
    units: { calories: 'kcal', protein: 'g', fat: 'g', carbs: 'g', fiber: 'g' }, carbohydrateSemantics: 'AVAILABLE_EXCLUDING_FIBER', mappingPolicyRef: 'synthetic-only' },
    { calories: '378.866123', protein: '13.49645', fat: '5.89', carbs: '58.23755', fiber: '10.42' });
  const pins = { canonicalRevisionDigest: canonical.digest, retainedSnapshotDigest: await retainedFoodSourceSnapshotDigestRawV2(raw(source)), numericInputDigest: await exactNutritionInputDigestV2(input) };
  const proposal = await captureFoodNutritionSourceBindingRawV2(raw(canonical), raw(source), raw(input), raw(pins));
  const revision: ExactFoodNutritionRevisionV2 = { contract: exactFoodNutritionRevisionContractV2, encoding: exactFoodNutritionEvidenceEncodingV2,
    revisionId: id(7), supersedesRevisionId: null, reviewEventId: id(8), sourceProposal: proposal, digest: zero };
  const sealed = { ...revision, digest: await exactFoodNutritionRevisionDigestRawV2(raw(revision), raw(pins)) };
  async function canonicalEvent(invalidation = false): Promise<FoodEvidenceReviewEventV1> {
    const common = { contract: foodEvidenceReviewEventContractV1, encoding: foodReviewedEvidenceEncodingV1,
      eventId: invalidation ? id(20) : canonical.reviewEventId, occurredAt: '2026-11-05T01:00:00.000Z', timestampOrigin: 'SERVER' as const,
      authorityContext, idempotencyReference: id(10), requestDigest: sha('canonical request'), digest: zero,
      target: { kind: 'CANONICAL_REVIEWED_REVISION' as const, revisionId: canonical.revisionId, digest: canonical.digest, canonicalFoodId: canonical.canonicalFoodId },
      retainedSource: { ...source, mappings: [{ field: 'identitySnapshot' as const, sourceField: 'synthetic identity', applicability: app }] } };
    const event: FoodEvidenceReviewEventV1 = invalidation ? { ...common, kind: 'INVALIDATION', severity: 'CORRECTION', reason: 'synthetic invalidation' } : { ...common, kind: 'REVIEW_APPROVED' };
    return { ...event, digest: await foodEvidenceReviewEventDigestRawV1(raw(event)) };
  }
  async function nutritionEvent(kind: ExactFoodNutritionReviewEventV2['kind'] = 'REVIEW_APPROVED'): Promise<ExactFoodNutritionReviewEventV2> {
    const common = { contract: exactFoodNutritionEventContractV2, encoding: exactFoodNutritionEvidenceEncodingV2,
      eventId: kind === 'REVIEW_APPROVED' ? sealed.reviewEventId : id(21), occurredAt: '2026-11-05T01:00:00.000Z', timestampOrigin: 'SERVER' as const,
      authorityContext, idempotencyReference: id(11), requestDigest: sha('nutrition request'), digest: zero };
    const target = { kind: 'EXACT_NUTRITION_REVISION_V2' as const, revisionId: sealed.revisionId, digest: sealed.digest, canonicalFoodId: canonical.canonicalFoodId };
    const event: ExactFoodNutritionReviewEventV2 = kind === 'REVIEW_APPROVED' ? { ...common, kind, target } : kind === 'INVALIDATION'
      ? { ...common, kind, target, severity: 'SAFETY_CRITICAL', reason: 'synthetic invalidation' }
      : { ...common, kind, target: { kind: 'SOURCE_BINDING_PROPOSAL_V2', digest: proposal.digest, canonicalFoodId: canonical.canonicalFoodId }, reason: 'synthetic rejection' };
    return { ...event, digest: await exactFoodNutritionEventDigestRawV2(raw(event)) };
  }
  const ca = await canonicalEvent(), na = await nutritionEvent();
  const snapshot: ExactFoodNutritionReviewedSnapshotV2 = { requestedFoodId: canonical.foodId, nutritionRaw: raw(sealed), sourcePinsRaw: raw(pins),
    canonicalApprovalRaw: raw(ca), nutritionApprovalRaw: raw(na), relevantEventRaws: [raw(ca), raw(na)],
    activeCanonicalRevisionId: canonical.revisionId, activeNutritionRevisionId: sealed.revisionId, currentFoodState: canonical.foodState };
  return { canonical, source, input, pins, proposal, revision: sealed, ca, na, snapshot, canonicalEvent, nutritionEvent };
}
