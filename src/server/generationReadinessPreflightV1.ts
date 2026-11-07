/**
 * Preflight for trusted POTOK weekly generation.
 * This is a safety gate, NOT an authority to publish recipes, grant Premium,
 * run SQL, start a worker, or submit a generation request.
 *
 * Caller must supply independently observed Staging evidence. Unknown values
 * never become zero, an approval, or a GO. A passing count is insufficient:
 * trusted authority/recipe provenance must be independently established.
 */
export const GENERATION_READINESS_CONTRACT_V1 = 'potok-generation-readiness-v1' as const;

export type GenerationReadinessEvidenceV1 = Readonly<{
  projectRef: string;
  observedAt: string;
  candidateManifests: number | null;
  candidateManifestHeads: number | null;
  candidateEntries: number | null;
  generationPolicyHeads: number | null;
  goalTargets: number | null;
  independentlyReviewedRecipes: number | null;
  unresolvedIngredientLinks: number | null;
  trustedSourceAndNutritionReceiptsVerified: boolean;
  candidateManifestCurrentnessVerified: boolean;
  generationPolicyCurrentnessVerified: boolean;
  targetOwnerBindingVerified: boolean;
  premiumEntitlementVerified: boolean;
  workerCredentialsAndTlsProven: boolean;
}>;

export type GenerationReadinessReasonV1 =
  | 'WRONG_PROJECT' | 'INVALID_OBSERVATION' | 'MANIFEST_NOT_READY'
  | 'POLICY_NOT_READY' | 'TARGETS_NOT_READY' | 'RECIPE_EVIDENCE_NOT_READY'
  | 'UNRESOLVED_INGREDIENTS' | 'SOURCE_NUTRITION_NOT_VERIFIED'
  | 'MANIFEST_NOT_CURRENT' | 'POLICY_NOT_CURRENT' | 'TARGET_BINDING_NOT_VERIFIED'
  | 'PREMIUM_NOT_VERIFIED' | 'WORKER_CONNECTION_NOT_PROVEN';

function validCount(x: number | null): x is number {
  return typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
}
export function evaluateGenerationReadinessV1(e: GenerationReadinessEvidenceV1) {
  const reasons: GenerationReadinessReasonV1[] = [];
  if (e.projectRef !== 'ozidryfvhkcbtpnulakq') reasons.push('WRONG_PROJECT');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(e.observedAt) ||
      !Number.isFinite(Date.parse(e.observedAt))) reasons.push('INVALID_OBSERVATION');
  if (![e.candidateManifests,e.candidateManifestHeads,e.candidateEntries].every(x => validCount(x) && x > 0))
    reasons.push('MANIFEST_NOT_READY');
  if (!validCount(e.generationPolicyHeads) || e.generationPolicyHeads === 0) reasons.push('POLICY_NOT_READY');
  if (!validCount(e.goalTargets) || e.goalTargets === 0) reasons.push('TARGETS_NOT_READY');
  if (!validCount(e.independentlyReviewedRecipes) || e.independentlyReviewedRecipes === 0)
    reasons.push('RECIPE_EVIDENCE_NOT_READY');
  if (!validCount(e.unresolvedIngredientLinks) || e.unresolvedIngredientLinks !== 0)
    reasons.push('UNRESOLVED_INGREDIENTS');
  if (e.trustedSourceAndNutritionReceiptsVerified !== true) reasons.push('SOURCE_NUTRITION_NOT_VERIFIED');
  if (e.candidateManifestCurrentnessVerified !== true) reasons.push('MANIFEST_NOT_CURRENT');
  if (e.generationPolicyCurrentnessVerified !== true) reasons.push('POLICY_NOT_CURRENT');
  if (e.targetOwnerBindingVerified !== true) reasons.push('TARGET_BINDING_NOT_VERIFIED');
  if (e.premiumEntitlementVerified !== true) reasons.push('PREMIUM_NOT_VERIFIED');
  if (e.workerCredentialsAndTlsProven !== true) reasons.push('WORKER_CONNECTION_NOT_PROVEN');
  return Object.freeze({
    contract: GENERATION_READINESS_CONTRACT_V1,
    projectRef: e.projectRef,
    status: reasons.length ? 'BLOCKED' as const : 'PRECONDITIONS_REPORTED' as const,
    reasons: Object.freeze(reasons),
    /** Never infer worker runtime activation or catalog publication from preflight alone. */
    mayPublishCatalog: false as const,
    mayActivateWorker: false as const,
    mayWritePlan: false as const,
  });
}
