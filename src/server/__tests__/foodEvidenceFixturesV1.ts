// SYNTHETIC TEST INPUTS ONLY. No retained production evidence or privileged credentials.
import { createHash } from 'node:crypto';
import { canonicalFoodReviewedRevisionDigestRawV1, foodEvidenceReviewEventDigestRawV1,
  foodReviewedEvidenceEncodingV1, type CanonicalFoodReviewedRevisionV1, type FoodEvidenceReviewEventV1,
  type RetainedFoodSourceSnapshotV1 } from '../../utils/foodReviewedEvidenceV1';
import { foodEvidenceRequestContractV1, foodReviewProposalDigestV1, foodEvidenceRequestDigestRawV1,
  type CanonicalFoodReviewProposalV1, type FoodEvidenceReviewRequestV1 } from '../foodEvidenceReviewRequestV1';
export const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const sha = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export const actor = id(1);
export const foodId = id(50);
export const proposal = (): CanonicalFoodReviewProposalV1 => ({ contract: 'potok-canonical-food-review-proposal-v1', canonicalFoodId: foodId,
  foodStableId: 'synthetic_root', source: 'core', foodState: 'raw', applicability: { kind: 'EXACT_FOOD_STATE', foodState: 'raw' }, sharedCatalogAccessible: true,
  identitySnapshot: { name: 'Synthetic food', nameOriginal: null, normalizedName: 'synthetic food', brand: null, normalizedBrand: null, barcode: null, aliases: [] } });
export function source(n: number, text = 'Синтетический источник\n', binary = false, nutrition = false): RetainedFoodSourceSnapshotV1 {
  const bytes = new TextEncoder().encode(text);
  return { sourceArtifactId: id(n), providerIdentity: 'synthetic-fixture-provider', documentIdentity: 'synthetic-fixture-document',
    sourceRevision: null, locator: 'https://fixture.invalid/source', capturedAt: '2026-10-01T00:00:00.000Z', mediaType: 'text/plain; charset=utf-8',
    byteLength: bytes.length, sourceBytesSha256: sha(bytes),
    mappings: (nutrition ? ['calories','protein','fat','carbs','fiber'] as const : ['identitySnapshot'] as const)
      .map(field => ({ field, sourceField: `synthetic-${field}`, applicability: { kind: 'EXACT_FOOD_STATE' as const, foodState: 'raw' as const } })),
    ...(binary ? { bytesBase64: btoa(String.fromCharCode(...bytes)) } : { text }) };
}
export async function approved(key: number, sourceId = key + 100): Promise<FoodEvidenceReviewRequestV1 & { kind: 'REVIEW_APPROVED' }> {
  const p = proposal();
  return { contract: foodEvidenceRequestContractV1, kind: 'REVIEW_APPROVED', idempotencyReference: id(key), proposal: p,
    proposalDigest: await foodReviewProposalDigestV1(p), retainedSource: source(sourceId), expectedHead: null };
}
export async function rejected(key: number): Promise<FoodEvidenceReviewRequestV1 & { kind: 'REVIEW_REJECTED' }> {
  const p = proposal();
  return { contract: foodEvidenceRequestContractV1, kind: 'REVIEW_REJECTED', idempotencyReference: id(key), proposal: p,
    proposalDigest: await foodReviewProposalDigestV1(p), retainedSource: null, reason: 'Synthetic rejection reason' };
}
export async function receipt(request: FoodEvidenceReviewRequestV1, actorId = actor, retainedRevision?: CanonicalFoodReviewedRevisionV1) {
  const eventId = id(800), zero = '0'.repeat(64);
  let revision: CanonicalFoodReviewedRevisionV1 | null = null;
  let target: FoodEvidenceReviewEventV1['target'];
  if (request.kind === 'REVIEW_APPROVED') {
    if (request.proposal.contract !== 'potok-canonical-food-review-proposal-v1') throw new Error('Fixture supports canonical approval only');
    const { contract, ...snapshot } = request.proposal;
    void contract;
    revision = { ...snapshot, contract: 'potok-canonical-food-reviewed-revision-v1', foodId: request.proposal.canonicalFoodId,
      encoding: foodReviewedEvidenceEncodingV1, revisionId: id(801), supersedesRevisionId: request.expectedHead?.revisionId ?? null, reviewEventId: eventId, digest: zero };
    revision.digest = await canonicalFoodReviewedRevisionDigestRawV1(JSON.stringify(revision));
    target = { kind: 'CANONICAL_REVIEWED_REVISION', revisionId: revision.revisionId, digest: revision.digest, canonicalFoodId: revision.canonicalFoodId };
  } else if (request.kind === 'REVIEW_REJECTED') {
    target = { kind: request.proposal.contract === 'potok-canonical-food-review-proposal-v1' ? 'CANONICAL_PROPOSAL' : 'NUTRITION_PROPOSAL',
      canonicalFoodId: request.proposal.canonicalFoodId, proposalDigest: request.proposalDigest, applicability: request.proposal.applicability };
  } else {
    if (!retainedRevision) throw new Error('Fixture requires the exact existing revision');
    revision = retainedRevision; target = request.target;
  }
  const common = { contract: 'potok-food-evidence-review-event-v1' as const, encoding: foodReviewedEvidenceEncodingV1,
    eventId, occurredAt: '2026-10-09T12:00:00.000Z', timestampOrigin: 'SERVER' as const,
    authorityContext: { boundary: 'OWNER_ADMIN_REVIEW' as const, actorId, role: 'ADMIN' as const, authorityReference: `potok-control-admin-attestation-v2:${id(900)}` },
    idempotencyReference: request.idempotencyReference, requestDigest: await foodEvidenceRequestDigestRawV1(JSON.stringify(request)), digest: zero };
  const event = { ...common, kind: request.kind, target, retainedSource: request.retainedSource,
    ...(request.kind === 'REVIEW_APPROVED' ? {} : { reason: request.reason }), ...(request.kind === 'INVALIDATION' ? { severity: request.severity } : {}) };
  event.digest = await foodEvidenceReviewEventDigestRawV1(JSON.stringify(event));
  return { contract: 'potok-food-evidence-review-receipt-v1', event, revision, canonicalRevision: null,
    proposalTarget: request.kind === 'REVIEW_REJECTED' ? target : null, replayed: false };
}
