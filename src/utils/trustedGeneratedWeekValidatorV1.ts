import {
  decodeGeneratedWeekPlanV1, decodeTrustedGenerationInputV1, trustedGenerationInputDigestV1,
  type GeneratedWeekPlanV1, type AdaptiveNutritionGraphSlotV2,
} from './adaptiveNutritionGraphV2';
import {
  decodeAdaptiveNutritionCandidateManifestV2, decodeNutritionPreferenceSnapshotV1,
  decodeNutritionSafetySnapshotV1, validateCandidateAuthoritiesV1,
} from './adaptiveNutritionAuthoritiesV1';
import { decodeTrustedValidationEvidenceV1 } from './trustedValidationEvidenceV1';
import {
  decodeTrustedValidationPoliciesRawV2, trustedValidationPoliciesRawBoundaryContractV2,
} from './trustedValidationPoliciesV1';
import { decodeTrustedMealWarningEvidenceSetRawV1 } from './trustedMealWarningEvidenceV1';
import {
  dayValidatorInputContractV1, mealValidatorInputContractV1, mealCandidateEvidenceContractV2,
  weekValidatorInputContractV2, validateWeekSnapshotRawV2,
  type MealComponentEvidenceV2, type ValidatorReasonV1,
} from './adaptiveNutritionMealBalanceV1';
import { assertRawJsonWithoutDuplicateKeysV1 } from './adaptiveNutritionWireV1';

export const trustedGeneratedWeekValidatorContractV1 = 'potok-trusted-generated-week-validator-v1' as const;
export type TrustedValidationScopeV1 = 'plan' | 'week' | 'day' | 'meal' | 'component';
export interface TrustedValidationReasonV1 {
  code: string;
  scope: TrustedValidationScopeV1;
  path: string;
  sourceCode?: string;
  dayIndex?: number;
  slotId?: string;
  mealComponentId?: string;
}
export type TrustedGeneratedWeekValidationResultV1 =
  | { contract: typeof trustedGeneratedWeekValidatorContractV1; status: 'ACCEPTED'; plan: GeneratedWeekPlanV1;
    graphDigest: string; generationInputDigest: string; manifestRevision: string; manifestDigest: string;
    preferenceRevision: string; preferenceDigest: string; safetyRevision: string; safetyDigest: string;
    validationEvidenceDigest: string; validationPoliciesDigest: string; warningEvidenceDigest: string;
    warnings: readonly TrustedValidationReasonV1[] }
  | { contract: typeof trustedGeneratedWeekValidatorContractV1; status: 'REJECTED' | 'BLOCKED';
    reasons: readonly TrustedValidationReasonV1[] };

function parseRaw(raw: string): unknown {
  if (typeof raw !== 'string') throw new Error('TRUSTED_VALIDATOR_RAW_STRING_REQUIRED');
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return JSON.parse(raw) as unknown;
}
function contextRecord(value: unknown): Record<string, string> {
  const keys = ['contract', 'trustedGenerationInputRaw', 'candidateManifestRaw', 'preferenceSnapshotRaw',
    'safetySnapshotRaw', 'trustedValidationEvidenceRaw'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length !== keys.length || !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error('INVALID_TRUSTED_VALIDATOR_CONTEXT');
  }
  const row = value as Record<string, unknown>;
  if (row.contract !== trustedValidationPoliciesRawBoundaryContractV2
    || keys.some((key) => typeof row[key] !== 'string')) throw new Error('INVALID_TRUSTED_VALIDATOR_CONTEXT');
  return row as Record<string, string>;
}
function freezeOwned<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeOwned(child);
    Object.freeze(value);
  }
  return value;
}
function ordered(reasons: TrustedValidationReasonV1[]): TrustedValidationReasonV1[] {
  const key = (reason: TrustedValidationReasonV1) => [reason.scope, reason.path, reason.code,
    reason.sourceCode ?? '', reason.dayIndex ?? '', reason.slotId ?? '', reason.mealComponentId ?? ''].join('\u0000');
  const unique = new Map(reasons.map((reason) => [key(reason), reason]));
  return [...unique.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, reason]) => reason);
}
function failure(status: 'REJECTED' | 'BLOCKED', reasons: TrustedValidationReasonV1[]): TrustedGeneratedWeekValidationResultV1 {
  return freezeOwned({ contract: trustedGeneratedWeekValidatorContractV1, status, reasons: ordered(reasons) });
}
function authorityFailure(error: unknown, path: string): TrustedGeneratedWeekValidationResultV1 {
  if (!(error instanceof Error)) throw error;
  // Shape/type errors in a trusted package remain exceptions. Only known missing/binding failures become results.
  if (/^(COMPONENT_EVIDENCE_MISSING|PLAN_ELIGIBILITY_REQUIRED|WARNING_SLOT_COVERAGE_MISMATCH)$/.test(error.message)) {
    return failure('BLOCKED', [{ code: 'TRUSTED_AUTHORITY_MISSING', scope: 'plan', path, sourceCode: error.message }]);
  }
  if (/mismatch|substitution|^pinned_|^stale_/i.test(error.message)
    && /^[A-Za-z0-9_]+$/.test(error.message)) {
    return failure('REJECTED', [{ code: 'AUTHORITY_BINDING_MISMATCH', scope: 'plan', path, sourceCode: error.message }]);
  }
  throw error;
}
async function authorities(policiesRaw: string, contextRaw: string) {
  const row = contextRecord(parseRaw(contextRaw));
  const owned = { input: parseRaw(row.trustedGenerationInputRaw), manifest: parseRaw(row.candidateManifestRaw),
    preference: parseRaw(row.preferenceSnapshotRaw), safety: parseRaw(row.safetySnapshotRaw) };
  const evidenceOwned = parseRaw(row.trustedValidationEvidenceRaw);
  const input = decodeTrustedGenerationInputV1(owned.input);
  const manifest = await decodeAdaptiveNutritionCandidateManifestV2(owned.manifest);
  const preference = await decodeNutritionPreferenceSnapshotV1(owned.preference);
  const safety = await decodeNutritionSafetySnapshotV1(owned.safety);
  const evidence = await decodeTrustedValidationEvidenceV1(evidenceOwned, owned);
  // This is the public raw-only V2 boundary; no private object policy decoder or seal is imported.
  const policies = await decodeTrustedValidationPoliciesRawV2(policiesRaw, contextRaw);
  return { input, manifest, preference, safety, evidence, policies, manifestRaw: row.candidateManifestRaw };
}
type Authorities = Awaited<ReturnType<typeof authorities>>;
const minor = (value: string): bigint => BigInt(value.replace('.', ''));
const identity = (value: { recipeId: string; recipeRevisionId: string; portionRevisionId: string; eligibilityRevisionId: string }) =>
  [value.recipeId, value.recipeRevisionId, value.portionRevisionId, value.eligibilityRevisionId].join(':');

function componentAdmission(slot: AdaptiveNutritionGraphSlotV2, dayIndex: number, authority: Authorities,
  reasons: TrustedValidationReasonV1[]): MealComponentEvidenceV2[] {
  const values: MealComponentEvidenceV2[] = [];
  for (const [index, component] of slot.mealSnapshot.components.entries()) {
    const path = `plan.graph.days[${dayIndex}].slots[${slot.sortOrder}].mealSnapshot.components[${index}]`;
    const reject = (code: string, sourceCode?: string) => reasons.push({ code, sourceCode, scope: 'component', path,
      dayIndex, slotId: slot.slotId, mealComponentId: component.mealComponentId });
    const tuple = { recipeId: component.recipe.recipeId, recipeRevisionId: component.recipeRevision,
      portionRevisionId: component.portionRevision, eligibilityRevisionId: component.eligibility.eligibilityRevisionId };
    const candidate = authority.manifest.entries.find((entry) => identity(entry) === identity(tuple));
    if (!candidate) { reject('MANIFEST_MISMATCH', 'MANIFEST_COMPONENT_MISSING'); continue; }
    if (!authority.evidence.planEligibility.some((entry) => identity(entry) === identity(tuple) && entry.planEligible === true)) {
      reject('PLAN_ELIGIBILITY_FAILURE'); continue;
    }
    const trusted = authority.evidence.components.find((entry) => entry.slotId === slot.slotId
      && entry.mealComponentId === component.mealComponentId && identity(entry) === identity(tuple));
    if (!trusted) { reject('VALIDATION_EVIDENCE_MISMATCH', 'COMPONENT_EVIDENCE_MISSING'); continue; }
    const graphEvidence = slot.componentEvidence[index];
    if (graphEvidence.evidenceDigest !== trusted.digest || graphEvidence.publicationRevision !== trusted.publicationRevision
      || graphEvidence.canonicalEvidenceRevision !== trusted.canonicalEvidenceRevision
      || graphEvidence.nutritionEvidenceRevision !== trusted.nutritionEvidenceRevision
      || graphEvidence.allergenEvidenceRevision !== trusted.allergenEvidenceRevision
      || graphEvidence.dietaryEvidenceRevision !== trusted.dietaryEvidenceRevision) {
      reject('VALIDATION_EVIDENCE_MISMATCH');
    }
    const eligibility = component.eligibility;
    for (const key of ['role', 'anchorKind', 'allowedMealTypes', 'requiredCompanionRoleSets', 'pairingTags',
      'incompatiblePairingTags', 'repeatFamily', 'energyClass', 'beverageClass'] as const) {
      // Both operands were independently normalized by strict existing decoders.
      if (JSON.stringify(eligibility[key]) !== JSON.stringify(candidate[key])) reject('MANIFEST_MISMATCH', 'ELIGIBILITY_CONTENT_MISMATCH');
    }
    if (!candidate.allowedMealTypes.includes(slot.mealType)) reject('MANIFEST_MISMATCH', 'MEAL_TYPE_NOT_ALLOWED');
    const servings = minor(component.assignedPortion.assignedServings);
    if (servings < minor(candidate.portionRules.assignedServingsMinimum)
      || servings > minor(candidate.portionRules.assignedServingsMaximum)
      || servings % minor(candidate.portionRules.assignedServingsIncrement) !== 0n) reject('PORTION_FAILURE');
    for (const rule of candidate.portionRules.componentIncrements) {
      const ingredient = component.ingredients.find((entry) => entry.componentId === rule.componentId);
      if (!ingredient || minor(ingredient.quantity.amount) % minor(rule.increment) !== 0n) {
        reject('PORTION_FAILURE', 'DISCRETE_COMPONENT_INCREMENT_MISMATCH');
      }
    }
    const access = validateCandidateAuthoritiesV1({ accountId: authority.input.accountId,
      candidate: { ...tuple, mealType: slot.mealType }, manifest: authority.manifest,
      preference: authority.preference, safety: authority.safety });
    if (access.status === 'BLOCKED') reject('PREFERENCE_SAFETY_FAILURE', access.reason);
    values.push({ contract: mealCandidateEvidenceContractV2, mealComponentId: component.mealComponentId,
      recipeRevision: candidate.recipeRevisionId, recipeId: candidate.recipeId, portionRevision: candidate.portionRevisionId,
      eligibilityRevision: candidate.eligibilityRevisionId, manifestRevision: authority.manifest.manifestRevision,
      manifestDigest: authority.manifest.digest, specialty: candidate.specialty, expensive: candidate.expensive,
      publicationStatus: candidate.publicationStatus, publicationRevision: candidate.publicationRevision,
      canonicalStatus: 'READY', canonicalEvidenceRevision: trusted.canonicalEvidenceRevision,
      nutritionStatus: 'COMPLETE', nutritionEvidenceRevision: trusted.nutritionEvidenceRevision,
      allergenStatus: 'REVIEWED', allergenEvidenceRevision: trusted.allergenEvidenceRevision,
      dietaryStatus: 'REVIEWED', dietaryEvidenceRevision: trusted.dietaryEvidenceRevision,
      portionPolicyRevision: trusted.portionPolicyRevision, accessibility: candidate.accessibility,
      allergens: candidate.allergenCodes, dietaryTags: candidate.dietaryCodes, ingredientFamilies: trusted.ingredientFamilies,
      dominantIngredientFamily: candidate.dominantIngredientFamily, repeatFamily: candidate.repeatFamily,
      assignedServingsMinimum: candidate.portionRules.assignedServingsMinimum,
      assignedServingsMaximum: candidate.portionRules.assignedServingsMaximum,
      proteinSource: trusted.proteinSource, produceSource: trusted.produceSource });
  }
  return values;
}
function balanceReason(reason: ValidatorReasonV1, plan: GeneratedWeekPlanV1): TrustedValidationReasonV1 {
  const dayIndex = plan.graph.days.findIndex((day) => reason.path.includes(`days.${day.date}.`));
  const slot = dayIndex < 0 ? undefined : plan.graph.days[dayIndex].slots.find((value) =>
    reason.path.includes(`.meals.${value.slotId}`));
  const component = slot?.mealSnapshot.components.find((value) =>
    reason.path.includes(`componentEvidence.${value.mealComponentId}`));
  const scope: TrustedValidationScopeV1 = component ? 'component' : slot ? 'meal' : dayIndex < 0 ? 'week' : 'day';
  return { code: reason.code, scope, path: reason.path, ...(dayIndex < 0 ? {} : { dayIndex }),
    ...(slot ? { slotId: slot.slotId } : {}), ...(component ? { mealComponentId: component.mealComponentId } : {}) };
}

/**
 * All authorities are independently pinned by the trusted caller, never by generator output.
 * Raw strings detach data, not provenance. Every public payload crosses a duplicate-aware parser.
 */
export async function validateGeneratedWeekPlanTrustedV1(generatedPlanRaw: string, pinnedPoliciesRaw: string,
  trustedContextRaw: string, pinnedWarningEvidenceRaw: string): Promise<TrustedGeneratedWeekValidationResultV1> {
  if (typeof pinnedPoliciesRaw !== 'string' || typeof trustedContextRaw !== 'string'
    || typeof pinnedWarningEvidenceRaw !== 'string') throw new Error('TRUSTED_VALIDATOR_RAW_STRING_REQUIRED');
  let authority: Authorities;
  try { authority = await authorities(pinnedPoliciesRaw, trustedContextRaw); }
  catch (error) { return authorityFailure(error, 'authorities'); }
  let plan: GeneratedWeekPlanV1;
  try { plan = await decodeGeneratedWeekPlanV1(parseRaw(generatedPlanRaw), authority.input); }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error instanceof TypeError || error instanceof RangeError || error.message === 'sha256_unavailable') throw error;
    return failure('REJECTED', [{ code: 'GENERATED_PLAN_INVALID', scope: 'plan', path: 'plan' }]);
  }
  let warnings;
  try { warnings = await decodeTrustedMealWarningEvidenceSetRawV1(pinnedWarningEvidenceRaw,
    pinnedPoliciesRaw, trustedContextRaw, generatedPlanRaw); }
  catch (error) { return authorityFailure(error, 'warningEvidence'); }
  const reasons: TrustedValidationReasonV1[] = [];
  const composition = authority.policies.composition.policy;
  const balance = authority.policies.balance.policy;
  const days = [];
  for (const [dayIndex, day] of plan.graph.days.entries()) {
    const distribution = authority.evidence.distributionPolicy.days[dayIndex];
    // The warning boundary has already proven exact dates/slot coverage/order/types for this same evaluated plan.
    const meals = [];
    for (const slot of day.slots) {
      const meal = slot.mealSnapshot;
      const location = { scope: 'meal' as const, dayIndex, slotId: slot.slotId,
        path: `plan.graph.days[${dayIndex}].slots[${slot.sortOrder}]` };
      const roles = meal.components.map((component) => component.eligibility.role);
      if (meal.components.length > composition.maxComponents || !composition.patterns.some((pattern) =>
        pattern.allowedMealTypes.includes(slot.mealType) && JSON.stringify(pattern.roles) === JSON.stringify(roles))) {
        reasons.push({ ...location, code: 'COMPOSITION_FAILURE', sourceCode: 'ROLE_PATTERN_NOT_ALLOWED' });
      }
      const componentEvidence = componentAdmission(slot, dayIndex, authority, reasons);
      const nutrition = distribution.nutritionBounds.find((entry) => entry.slotId === slot.slotId)!;
      const requirements = distribution.requirements.find((entry) => entry.slotId === slot.slotId)!;
      const warning = warnings.entries.find((entry) => entry.slotId === slot.slotId)!;
      if (!nutrition || !requirements || !warning) throw new Error('TRUSTED_VALIDATOR_IMPOSSIBLE_SLOT_AUTHORITY');
      meals.push({ slotId: slot.slotId, sortOrder: slot.sortOrder, mealType: slot.mealType, date: slot.civilDate,
        validationInput: { contract: mealValidatorInputContractV1, sourceKind: slot.sourceKind, meal,
          // Balance V1's literal-cap DTO is a projection, not a policy rewrite: the original composition cap and
          // ordered pattern membership were checked above. Patterns beyond the Balance cap cannot match Graph V2.
          compositionPolicy: { ...composition, maxComponents: balance.maxComponents,
            patterns: composition.patterns.filter((pattern) => pattern.roles.length <= balance.maxComponents) },
          balancePolicy: balance, expected: { goalRevision: authority.input.goalNutritionTarget.goalRevision,
            compositionPolicyRevision: authority.input.compositionPolicyRevision },
          userConstraints: { revisionId: authority.preference.revisionId, excludedAllergens: authority.safety.declaredAllergenCodes,
            // The closed preference DTO has ingredient IDs, not family exclusions. Those IDs were checked above;
            // no family exclusion is inferred from a name or invented ID-to-family mapping.
            excludedIngredientFamilies: [], requiredDietaryTags: authority.preference.hard.dietaryPattern === 'UNSPECIFIED'
              ? [] : [authority.preference.hard.dietaryPattern.toLowerCase()],
            forbiddenDietaryTags: authority.safety.dietaryHardExclusionCodes },
          componentEvidence, nutritionBounds: nutrition.bounds,
          requirements: { proteinSourceRequired: requirements.proteinSourceRequired, produceRequired: requirements.produceRequired },
          warningSignals: warning.signals } });
    }
    days.push({ contract: dayValidatorInputContractV1, date: day.date, timezone: plan.timezone,
      goalRevision: authority.input.goalNutritionTarget.goalRevision,
      targetPolicyRevision: authority.input.goalNutritionTarget.targetPolicyRevision, planRevision: plan.proposedPlanRevision,
      compositionPolicyRevision: authority.input.compositionPolicyRevision, balancePolicy: balance,
      requiredSlots: distribution.requiredSlots, meals, goalTarget: authority.input.goalNutritionTarget,
      distributionBounds: distribution.distributionBounds });
  }
  if (reasons.length) return failure('REJECTED', reasons);
  const fallback = authority.evidence.ordinaryFallback;
  const week = { contract: weekValidatorInputContractV2, weekAnchor: plan.weekStartLocal, timezone: plan.timezone,
    goalRevision: authority.input.goalNutritionTarget.goalRevision, targetPolicyRevision: authority.input.goalNutritionTarget.targetPolicyRevision,
    planRevision: plan.proposedPlanRevision, compositionPolicyRevision: authority.input.compositionPolicyRevision,
    balancePolicy: balance, days, ordinaryFallbackProof: { candidatePoolDigest: fallback.candidatePoolDigest,
      status: fallback.status, ordinaryWeekDigest: fallback.ordinaryWeekDigest } };
  let checked;
  try {
    // Only independently decoded/constructed owned data is serialized; this is never an arbitrary-object trust bridge.
    checked = await validateWeekSnapshotRawV2(JSON.stringify(week), authority.manifestRaw);
  } catch (error) {
    if (error instanceof Error && /^component_axes_/.test(error.message)) {
      return failure('REJECTED', [{ code: 'MANIFEST_MISMATCH', scope: 'plan', path: 'plan.graph', sourceCode: error.message }]);
    }
    throw error;
  }
  const failures = checked.reasons.filter((reason) => reason.severity !== 'WARNING').map((reason) => balanceReason(reason, plan));
  if (failures.length) return failure('REJECTED', failures);
  const emitted = checked.reasons.filter((reason) => reason.severity === 'WARNING');
  if (emitted.some((reason) => !balance.allowedWarningCodes.includes(reason.code))) throw new Error('UNPINNED_WARNING_EMITTED');
  return freezeOwned({ contract: trustedGeneratedWeekValidatorContractV1, status: 'ACCEPTED', plan,
    graphDigest: plan.graphDigest, generationInputDigest: await trustedGenerationInputDigestV1(authority.input),
    manifestRevision: authority.manifest.manifestRevision, manifestDigest: authority.manifest.digest,
    preferenceRevision: authority.preference.revisionId, preferenceDigest: authority.preference.digest,
    safetyRevision: authority.safety.revisionId, safetyDigest: authority.safety.digest,
    validationEvidenceDigest: authority.evidence.digest, validationPoliciesDigest: authority.policies.digest,
    warningEvidenceDigest: warnings.digest, warnings: ordered(emitted.map((reason) => balanceReason(reason, plan))) });
}
