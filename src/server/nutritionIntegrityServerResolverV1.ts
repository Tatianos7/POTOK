/**
 * Issue #170: isolated trusted-adapter boundary; NOT an HTTP endpoint or a diary writer.
 * Never wire to a client-provided profile. The adapter must use authenticated, server-owned
 * storage and validate current revisions, approvals and invalidations atomically.
 */
import {
  assessPortionV1,
  type FoodConversionV1,
  type FoodNutritionProfileV1,
  type NutritionValuesV1,
  type PortionAssessmentV1,
  type PortionRequestV1,
  type PortionUnitV1,
} from '../utils/nutritionIntegrityV1';

export interface ServerPortionIntentV1 {
  foodId: string;
  amount: string;
  unit: PortionUnitV1;
}

/** Values only from a server-owned lookup, never request JSON. */
export type ServerFoodEvidenceV1 =
  | {
      kind: 'REVIEWED';
      foodId: string;
      basis: 'PER_100_G_EDIBLE';
      nutrition: NutritionValuesV1;
      nutritionRevisionId: string;
      nutritionDigest: string;
      approvalEventId: string;
      /** Currentness predicates must be checked by the trusted storage adapter. */
      current: {
        approved: boolean;
        canonicalBindingCurrent: boolean;
        nutritionBindingCurrent: boolean;
        foodStateApplicable: boolean;
        notInvalidated: boolean;
      };
    }
  | {
      kind: 'USER_DECLARED';
      foodId: string;
      ownerId: string;
      basis: 'PER_100_G_EDIBLE' | 'PER_100_ML' | 'PER_PORTION';
      nutrition: NutritionValuesV1;
    }
  | {
      kind: 'LEGACY_CONTRACT';
      foodId: string;
      contractRef: string;
      /** Explicit server-curated claim, not inferred from unit or populated macros. */
      curated100g: boolean;
      nutrition: NutritionValuesV1;
    }
  | { kind: 'UNRESOLVED'; foodId: string };

export interface ServerConversionEvidenceV1 extends FoodConversionV1 {
  /** Server-enforced ownership for user conversions and current reviewed binding for reviewed conversions. */
  applicable: boolean;
  current: boolean;
  ownerId: string | null;
}

export interface TrustedNutritionStorageV1 {
  /** Must read a consistent current evidence snapshot scoped by food and actor. */
  resolveFood(foodId: string, actorId: string): Promise<ServerFoodEvidenceV1 | null>;
  resolveConversions(foodId: string, actorId: string): Promise<readonly ServerConversionEvidenceV1[]>;
}

const unknown = (reason: 'INVALID_INPUT' | 'BASIS_UNKNOWN' | 'CONVERSION_UNAVAILABLE'): PortionAssessmentV1 =>
  ({ status: 'UNKNOWN', reason, totals: null, normalizedGrams: null });

function reviewedCurrent(evidence: Extract<ServerFoodEvidenceV1, {kind: 'REVIEWED'}>): boolean {
  return Object.values(evidence.current).every(value => value === true) &&
    Boolean(evidence.nutritionRevisionId && evidence.nutritionDigest && evidence.approvalEventId);
}

function profileFor(evidence: ServerFoodEvidenceV1, actorId: string): FoodNutritionProfileV1 | null {
  if (evidence.kind === 'REVIEWED') {
    if (!reviewedCurrent(evidence)) return null;
    return {
      foodId: evidence.foodId, basis: evidence.basis, perBasis: evidence.nutrition,
      provenance: { kind: 'REVIEWED_REVISION', nutritionRevisionId: evidence.nutritionRevisionId,
        nutritionDigest: evidence.nutritionDigest, approvalEventId: evidence.approvalEventId },
    };
  }
  if (evidence.kind === 'USER_DECLARED') {
    if (evidence.ownerId !== actorId) return null;
    return { foodId: evidence.foodId, basis: evidence.basis, perBasis: evidence.nutrition,
      provenance: { kind: 'USER_DECLARED', ownerId: evidence.ownerId } };
  }
  if (evidence.kind === 'LEGACY_CONTRACT') {
    if (!evidence.curated100g || !evidence.contractRef.trim()) return null;
    return { foodId: evidence.foodId, basis: 'PER_100_G_EDIBLE', perBasis: evidence.nutrition,
      provenance: { kind: 'LEGACY_CONTRACT', contractRef: evidence.contractRef } };
  }
  return null;
}

/**
 * Server-only orchestration. Fails closed on unavailable or inconsistent storage.
 * Adapter correctness, trust, SQL atomicity and DB write enforcement are separate gates.
 * Do not treat this result as an authorization to persist diary entries.
 */
export async function assessServerPortionV1(
  intent: ServerPortionIntentV1, actorId: string, storage: TrustedNutritionStorageV1
): Promise<PortionAssessmentV1> {
  if (!actorId || !intent || typeof intent.foodId !== 'string' || !intent.foodId.trim()) return unknown('INVALID_INPUT');
  try {
    const evidence = await storage.resolveFood(intent.foodId, actorId);
    if (!evidence || evidence.foodId !== intent.foodId) return unknown('BASIS_UNKNOWN');
    const profile = profileFor(evidence, actorId);
    if (!profile) return unknown('BASIS_UNKNOWN');
    const resolved = await storage.resolveConversions(intent.foodId, actorId);
    // One rejected or cross-food conversion must never be silently omitted: it
    // may duplicate/conflict with otherwise valid evidence.
    if (!Array.isArray(resolved) || resolved.some(row =>
      row.foodId !== intent.foodId || row.applicable !== true || row.current !== true ||
      (row.source === 'USER_DECLARED' && row.ownerId !== actorId) ||
      (row.source === 'REVIEWED_EVIDENCE' && row.ownerId !== null)
    )) return unknown('CONVERSION_UNAVAILABLE');
    const conversions: FoodConversionV1[] = resolved.map(row => ({
      foodId: row.foodId, unit: row.unit, kind: row.kind, value: row.value,
      source: row.source, evidenceRef: row.evidenceRef,
    }));
    const request: PortionRequestV1 = { foodId: intent.foodId, amount: intent.amount, unit: intent.unit };
    return assessPortionV1(request, profile, conversions);
  } catch {
    // No optimistic CONFIRMED or invented numeric data on storage outage.
    return unknown('BASIS_UNKNOWN');
  }
}
