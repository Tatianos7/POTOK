/** Unmounted server read boundary. Requires a complete atomic trusted-store snapshot.
 * No HTTP handler, JWT verifier, issuer, storage writer or Graph/diary adapter. */
import { decodeFoodEvidenceReviewEventRawV1, type FoodEvidenceReviewEventV1 } from '../utils/foodReviewedEvidenceV1';
import {
  decodeExactFoodNutritionRevisionRawV2, decodeExactFoodNutritionReviewEventRawV2,
  exactFoodNutritionEventContractV2, type ExactFoodNutritionReviewEventV2,
} from '../utils/exactFoodNutritionEvidenceV2';
import { parseFoodNutritionSourceBindingJsonRawV2 as parse } from '../utils/foodNutritionSourceBindingV2';
import type { ExactNutritionInputV2 } from '../utils/exactNutritionValuesV2';
import type { ReviewedEvidenceAuthorityV1 } from './nutritionIntegrityReviewedEvidenceAdapterV1';

export interface ExactFoodNutritionReviewedSnapshotV2 {
  readonly requestedFoodId: string;
  readonly nutritionRaw: string;
  /** Trusted mapper/identity context, never taken from the candidate packet. */
  readonly sourcePinsRaw: string;
  readonly canonicalApprovalRaw: string;
  readonly nutritionApprovalRaw: string;
  /** Complete events affecting either selected revision. Must include both approvals and all invalidations. */
  readonly relevantEventRaws: readonly string[];
  readonly activeCanonicalRevisionId: string;
  readonly activeNutritionRevisionId: string;
  readonly currentFoodState: 'raw' | 'dry' | 'frozen' | 'cooked' | 'as-sold';
}
/** Reuse the same event-time authorization port; implementations must explicitly support V2 events.
 * A V1-only verifier is not a V2 verifier and must never be cast to this type. */
export type ExactFoodNutritionReviewAuthorityV2 = ReviewedEvidenceAuthorityV1<FoodEvidenceReviewEventV1 | ExactFoodNutritionReviewEventV2>;
export type ExactFoodNutritionReadResultV2 =
  | { readonly kind: 'UNRESOLVED'; readonly foodId: string }
  | { readonly kind: 'REVIEWED_EXACT_V2'; readonly foodId: string; readonly canonicalRevisionId: string;
      readonly canonicalRevisionDigest: string; readonly nutritionRevisionId: string; readonly nutritionDigest: string;
      readonly approvalEventId: string; readonly sourceProposalDigest: string; readonly numericInput: ExactNutritionInputV2 };

/** Hashes prove integrity only. Authorization/currentness require server-owned inputs and transaction semantics. */
export async function resolveExactFoodNutritionReviewedSnapshotV2(
  snapshot: ExactFoodNutritionReviewedSnapshotV2, authority: ExactFoodNutritionReviewAuthorityV2,
): Promise<ExactFoodNutritionReadResultV2> {
  const requestedFoodId = snapshot.requestedFoodId;
  const unresolved = (): ExactFoodNutritionReadResultV2 => Object.freeze({ kind: 'UNRESOLVED', foodId: requestedFoodId });
  try {
    // Own all context before the first await; external mutation cannot mix snapshot generations.
    if (!Array.isArray(snapshot.relevantEventRaws) || snapshot.relevantEventRaws.length > 1024
      || snapshot.relevantEventRaws.length < 2) return unresolved();
    const relevantEventRaws: string[] = [];
    for (let i = 0; i < snapshot.relevantEventRaws.length; i++) {
      const item = Object.getOwnPropertyDescriptor(snapshot.relevantEventRaws, String(i));
      if (!item || !('value' in item) || typeof item.value !== 'string') return unresolved();
      relevantEventRaws.push(item.value);
    }
    const owned = { nutritionRaw: snapshot.nutritionRaw, sourcePinsRaw: snapshot.sourcePinsRaw,
      canonicalApprovalRaw: snapshot.canonicalApprovalRaw, nutritionApprovalRaw: snapshot.nutritionApprovalRaw,
      activeCanonicalRevisionId: snapshot.activeCanonicalRevisionId, activeNutritionRevisionId: snapshot.activeNutritionRevisionId,
      currentFoodState: snapshot.currentFoodState };
    const nutrition = await decodeExactFoodNutritionRevisionRawV2(owned.nutritionRaw, owned.sourcePinsRaw);
    const proposal = nutrition.sourceProposal, canonical = proposal.canonical, canonicalRaw = JSON.stringify(canonical);
    if (canonical.foodId !== requestedFoodId || canonical.revisionId !== owned.activeCanonicalRevisionId
      || nutrition.revisionId !== owned.activeNutritionRevisionId || canonical.foodState !== owned.currentFoodState) return unresolved();
    const canonicalApproval = await decodeFoodEvidenceReviewEventRawV1(owned.canonicalApprovalRaw, canonicalRaw);
    const nutritionApproval = await decodeExactFoodNutritionReviewEventRawV2(owned.nutritionApprovalRaw, owned.nutritionRaw, owned.sourcePinsRaw);
    if (canonicalApproval.kind !== 'REVIEW_APPROVED' || canonicalApproval.target.kind !== 'CANONICAL_REVIEWED_REVISION'
      || nutritionApproval.kind !== 'REVIEW_APPROVED' || canonicalApproval.eventId === nutritionApproval.eventId) return unresolved();
    // A truthy string/object from a malformed implementation is not authorization.
    if (await authority.isAuthorizedEvent(canonicalApproval) !== true || await authority.isAuthorizedEvent(nutritionApproval) !== true) return unresolved();
    const expected = new Map([[canonicalApproval.eventId, canonicalApproval.digest], [nutritionApproval.eventId, nutritionApproval.digest]]), historyIds = new Set<string>();
    for (const raw of relevantEventRaws) {
      const shape = parse(raw) as { contract?: unknown } | null;
      const event = shape?.contract === exactFoodNutritionEventContractV2
        ? await decodeExactFoodNutritionReviewEventRawV2(raw, owned.nutritionRaw, owned.sourcePinsRaw)
        : await decodeFoodEvidenceReviewEventRawV1(raw, canonicalRaw);
      if (historyIds.has(event.eventId) || await authority.isAuthorizedEvent(event) !== true) return unresolved();
      historyIds.add(event.eventId);
      // Invalidations block regardless of ordering/time/severity. Reject extra or rejected events.
      if (event.kind !== 'REVIEW_APPROVED' || expected.get(event.eventId) !== event.digest) return unresolved();
    }
    if (historyIds.size !== 2 || ![...expected.keys()].every(id => historyIds.has(id))) return unresolved();
    return Object.freeze({ kind: 'REVIEWED_EXACT_V2', foodId: canonical.foodId, canonicalRevisionId: canonical.revisionId,
      canonicalRevisionDigest: canonical.digest, nutritionRevisionId: nutrition.revisionId, nutritionDigest: nutrition.digest,
      approvalEventId: nutritionApproval.eventId, sourceProposalDigest: proposal.digest, numericInput: proposal.numericInput });
  } catch { return unresolved(); }
}
