/** Food-only preparation. Recipe publication, nonfood authority and Graph remain separate gates. */
import {
  resolveExactFoodNutritionReviewedSnapshotV2, type ExactFoodNutritionReviewedSnapshotV2,
  type ExactFoodNutritionReviewAuthorityV2,
} from './exactFoodNutritionReviewedAdapterV2';
import { exactNutritionInputDigestV2 } from '../utils/exactNutritionValuesV2';
import {
  decodeExactRecipeNutritionRequestRawV2, exactRecipeNutritionRequestDigestRawV2, calculateExactRecipeNutritionRawV2,
  type ExactRecipeNutritionSnapshotV2,
} from '../utils/exactRecipeNutritionV2';
export type ExactRecipePreparationResultV2 =
  | { readonly kind: 'PREPARED_EXACT_FOOD_INPUTS_V2'; readonly snapshot: ExactRecipeNutritionSnapshotV2 }
  | { readonly kind: 'BLOCKED'; readonly reason: 'REQUEST_INVALID_OR_CHANGED' | 'NONFOOD_EVIDENCE_NOT_INTEGRATED' | 'FOOD_EVIDENCE_UNAVAILABLE_OR_MISMATCHED' };
/** Snapshots and request digest must come from an independent complete server-owned read.
 * No HTTP handler or store implementation is supplied here. This does not verify recipe authority. */
export async function prepareExactRecipeNutritionRawV2(requestRaw: string, expectedRequestDigest: string,
  rows: readonly { readonly rowId: string; readonly snapshot: ExactFoodNutritionReviewedSnapshotV2 }[],
  authority: ExactFoodNutritionReviewAuthorityV2,
): Promise<ExactRecipePreparationResultV2> {
  const blocked = (reason: Extract<ExactRecipePreparationResultV2, {kind:'BLOCKED'}>['reason']): ExactRecipePreparationResultV2 => Object.freeze({kind:'BLOCKED',reason});
  let owned;
  try {
    if (!Array.isArray(rows) || rows.length > 128 || new Set(rows.map(r => r.rowId)).size !== rows.length) return blocked('FOOD_EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
    // Capture all ingredients before the first await, including request digest verification.
    owned = rows.map(({rowId,snapshot}) => ({rowId,snapshot:{...snapshot,relevantEventRaws:[...snapshot.relevantEventRaws]}}));
  } catch { return blocked('FOOD_EVIDENCE_UNAVAILABLE_OR_MISMATCHED'); }
  let request;
  try {
    request = decodeExactRecipeNutritionRequestRawV2(requestRaw);
    if (await exactRecipeNutritionRequestDigestRawV2(requestRaw) !== expectedRequestDigest) return blocked('REQUEST_INVALID_OR_CHANGED');
  } catch { return blocked('REQUEST_INVALID_OR_CHANGED'); }
  if (request.components.some(row => row.inputKind !== 'FOOD')) return blocked('NONFOOD_EVIDENCE_NOT_INTEGRATED');
  try {
    if (owned.length !== request.components.length) return blocked('FOOD_EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
    const inputs = [];
    for (const row of request.components) {
      if (row.inputKind !== 'FOOD') return blocked('NONFOOD_EVIDENCE_NOT_INTEGRATED');
      const stored = owned.find(r => r.rowId === row.rowId)?.snapshot;
      if (!stored || stored.requestedFoodId !== row.foodId || stored.currentFoodState !== row.foodState) return blocked('FOOD_EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
      const evidence = await resolveExactFoodNutritionReviewedSnapshotV2(stored, authority);
      if (evidence.kind !== 'REVIEWED_EXACT_V2' || evidence.foodId !== row.foodId || evidence.nutritionRevisionId !== row.nutritionRevisionId
        || evidence.nutritionDigest !== row.nutritionDigest || evidence.sourceProposalDigest !== row.sourceProposalDigest
        || evidence.numericInput.reference.basis !== row.basis || await exactNutritionInputDigestV2(evidence.numericInput) !== row.numericInputDigest) return blocked('FOOD_EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
      inputs.push({rowId:row.rowId,input:evidence.numericInput});
    }
    return Object.freeze({kind:'PREPARED_EXACT_FOOD_INPUTS_V2',snapshot:await calculateExactRecipeNutritionRawV2(requestRaw,JSON.stringify(inputs),expectedRequestDigest)});
  } catch { return blocked('FOOD_EVIDENCE_UNAVAILABLE_OR_MISMATCHED'); }
}
