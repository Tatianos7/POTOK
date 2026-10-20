/**
 * Issue #170: reviewed evidence adapter CORE only. No production DB, HTTP, or diary writes.
 *
 * Inputs MUST be read atomically from a trusted server-owned store with a complete event
 * history and authorization decisions. A digest proves integrity, NOT issuance or authority.
 */
import {
  decodeCanonicalFoodReviewedRevisionRawV1,
  decodeNutritionReviewedRevisionRawV1,
  decodeFoodEvidenceReviewEventRawV1,
  type FoodEvidenceReviewEventV1,
} from '../utils/foodReviewedEvidenceV1';
import type { ServerFoodEvidenceV1 } from './nutritionIntegrityServerResolverV1';

export interface ReviewedEvidenceSnapshotV1 {
  requestedFoodId: string;
  canonicalRaw: string;
  nutritionRaw: string;
  canonicalApprovalRaw: string;
  nutritionApprovalRaw: string;
  /** Complete events affecting EITHER revision, including later invalidations; trusted store contract. */
  relevantEventRaws: readonly string[];
  /** Server-owned snapshot current head IDs; cannot originate from the browser. */
  activeCanonicalRevisionId: string;
  activeNutritionRevisionId: string;
  currentFoodState: 'raw' | 'dry' | 'frozen' | 'cooked' | 'as-sold';
}

export interface ReviewedEvidenceAuthorityV1 {
  /** Must validate server-issuance and reviewer privilege AT EVENT TIME, not merely event claims. */
  isAuthorizedEvent(event: FoodEvidenceReviewEventV1): Promise<boolean>;
}

/**
 * Fail closed. Even a structurally valid review event is not trusted unless independently
 * authorized. The caller is responsible for transaction-consistent completeness of events.
 * Never expose this snapshot/input interface to untrusted client requests.
 */
export async function resolveReviewedEvidenceSnapshotV1(
  snapshot: ReviewedEvidenceSnapshotV1,
  authority: ReviewedEvidenceAuthorityV1
): Promise<ServerFoodEvidenceV1> {
  const unresolved = (): ServerFoodEvidenceV1 => ({ kind: 'UNRESOLVED', foodId: snapshot.requestedFoodId });
  try {
    const canonical = await decodeCanonicalFoodReviewedRevisionRawV1(snapshot.canonicalRaw);
    const nutrition = await decodeNutritionReviewedRevisionRawV1(snapshot.nutritionRaw, snapshot.canonicalRaw);
    if (canonical.foodId !== snapshot.requestedFoodId ||
      canonical.revisionId !== snapshot.activeCanonicalRevisionId ||
      nutrition.revisionId !== snapshot.activeNutritionRevisionId ||
      canonical.foodState !== snapshot.currentFoodState ||
      nutrition.foodState !== snapshot.currentFoodState ||
      canonical.sharedCatalogAccessible !== true) return unresolved();

    const canonicalApproval = await decodeFoodEvidenceReviewEventRawV1(
      snapshot.canonicalApprovalRaw, snapshot.canonicalRaw
    );
    const nutritionApproval = await decodeFoodEvidenceReviewEventRawV1(
      snapshot.nutritionApprovalRaw, snapshot.nutritionRaw, snapshot.canonicalRaw
    );
    if (canonicalApproval.kind !== 'REVIEW_APPROVED' ||
      nutritionApproval.kind !== 'REVIEW_APPROVED' ||
      canonicalApproval.target.kind !== 'CANONICAL_REVIEWED_REVISION' ||
      nutritionApproval.target.kind !== 'NUTRITION_REVIEWED_REVISION') return unresolved();

    if (!await authority.isAuthorizedEvent(canonicalApproval) ||
      !await authority.isAuthorizedEvent(nutritionApproval)) return unresolved();

    // The adapter must supply a COMPLETE history. Do not trust a client-supplied subset.
    // Every history event is checked, including authentic invalidations, and ANY invalidation
    // of either selected revision blocks CONFIRMED irrespective of timestamp ordering.
    if (!Array.isArray(snapshot.relevantEventRaws)) return unresolved();
    const ids = new Set([canonicalApproval.eventId, nutritionApproval.eventId]);
    const historyIds = new Set<string>();
    for (const raw of snapshot.relevantEventRaws) {
      // An event may refer to either revision; bind using its actual target before decoding.
      const eventShape = JSON.parse(raw) as { target?: { kind?: string; revisionId?: string } };
      if (eventShape?.target?.kind !== 'CANONICAL_REVIEWED_REVISION' &&
        eventShape?.target?.kind !== 'NUTRITION_REVIEWED_REVISION') return unresolved();
      const isCanonical = eventShape.target.kind === 'CANONICAL_REVIEWED_REVISION';
      const targetId = isCanonical ? canonical.revisionId : nutrition.revisionId;
      if (eventShape.target.revisionId !== targetId) return unresolved();
      const event = await decodeFoodEvidenceReviewEventRawV1(
        raw, isCanonical ? snapshot.canonicalRaw : snapshot.nutritionRaw,
        isCanonical ? undefined : snapshot.canonicalRaw
      );
      if (historyIds.has(event.eventId) || !await authority.isAuthorizedEvent(event)) return unresolved();
      historyIds.add(event.eventId);
      if (event.kind === 'INVALIDATION') return unresolved();
      if (event.kind !== 'REVIEW_APPROVED' || !ids.has(event.eventId)) return unresolved();
    }
    // Ensure the complete history explicitly contains both approvals.
    if (historyIds.size !== 2 || ![...ids].every(id => historyIds.has(id))) return unresolved();
    return {
      kind: 'REVIEWED', foodId: canonical.foodId, basis: nutrition.basis,
      nutrition: { ...nutrition.nutrition },
      nutritionRevisionId: nutrition.revisionId, nutritionDigest: nutrition.digest,
      approvalEventId: nutritionApproval.eventId,
      current: { approved: true, canonicalBindingCurrent: true,
        nutritionBindingCurrent: true, foodStateApplicable: true, notInvalidated: true },
    };
  } catch {
    return unresolved();
  }
}
