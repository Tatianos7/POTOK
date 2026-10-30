import { decodeTrustedGenerationInputV1, type GraphV2ComponentEvidenceBinding } from '../utils/adaptiveNutritionGraphV2';
import type { MealSourceKindV1 } from '../utils/adaptiveNutritionMealBalanceV1';
import { decodeAdaptiveNutritionCandidateManifestV2, decodeNutritionPreferenceSnapshotV1,
  decodeNutritionSafetySnapshotV1, validateCandidateAuthoritiesV1 } from '../utils/adaptiveNutritionAuthoritiesV1';
import { decodeTrustedValidationEvidenceV1 } from '../utils/trustedValidationEvidenceV1';
import { decodeTrustedValidationPoliciesRawV2, trustedValidationPoliciesRawBoundaryContractV2 } from '../utils/trustedValidationPoliciesV1';
import { assertRawJsonWithoutDuplicateKeysV1 } from '../utils/adaptiveNutritionWireV1';
import { scalePremiumRecipeCollectionV1, type GraphNutritionV1 } from '../utils/adaptiveNutritionGraphV1';
import { composeAdaptiveMealV1, adaptiveMealCompositionEligibilityV1_1,
  type MealComponentCandidateV1, type MealSnapshotV1, type MealGoalProfileV1 } from '../utils/adaptiveNutritionMealCompositionV1';

export const generationMenuCandidateSourceContractV1 = 'potok-generation-menu-candidate-source-v1' as const;

/** Independently admitted server source, never generator/browser-supplied catalog or review flags. */
export interface GenerationMenuCandidateSourcePortV1 {
  loadPreparationRaw(requestOperationId: string): Promise<string | null>;
}
export interface GenerationMenuCandidateExclusionV1 {
  slotId: string;
  recipeId: string | null;
  assignedServings: string | null;
  reason: string;
}
export interface GenerationMenuCandidateSlotV1 {
  date: string;
  slotId: string;
  meals: Array<{ meal: MealSnapshotV1; sourceKind: MealSourceKindV1;
    componentEvidence: GraphV2ComponentEvidenceBinding[]; isolatedCompositionScore: string }>;
}
export type GenerationMenuCandidateResultV1 =
  | { status: 'PREPARED' | 'INCOMPLETE'; requestOperationId: string; generationInputDigest: string;
      manifestDigest: string; validationEvidenceDigest: string; validationPoliciesDigest: string;
      slots: GenerationMenuCandidateSlotV1[]; exclusions: GenerationMenuCandidateExclusionV1[] }
  | { status: 'BLOCKED_SOURCE_MISSING' | 'RESOURCE_LIMIT_REACHED'; requestOperationId: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const axes = ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const;
const zero: GraphNutritionV1 = { calories: '0.000', protein: '0.000', fat: '0.000', carbs: '0.000', fiber: '0.000' };
const minor = (value: string): bigint => BigInt(value.replace('.', ''));
const decimal = (value: bigint): string => `${value / 1000n}.${String(value % 1000n).padStart(3, '0')}`;
const ratio = (value: string, servings: string, base: string): string =>
  decimal((minor(value) * minor(servings) + minor(base) / 2n) / minor(base));
const identity = (v: { recipeId: string; recipeRevisionId: string; portionRevisionId: string; eligibilityRevisionId: string }) =>
  [v.recipeId, v.recipeRevisionId, v.portionRevisionId, v.eligibilityRevisionId].join(':');
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

function parse(raw: unknown): unknown {
  if (typeof raw !== 'string') throw new Error('MENU_CANDIDATE_RAW_STRING_REQUIRED');
  if (raw.length > 8_000_000) throw new Error('MENU_CANDIDATE_SOURCE_TOO_LARGE');
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return JSON.parse(raw);
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).length !== keys.length || !keys.every(key => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error('INVALID_MENU_CANDIDATE_FIELDS');
  }
  return value as Record<string, unknown>;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
class ResourceLimit extends Error {}

async function prepare(sourceRaw: string, requestOperationId: string): Promise<GenerationMenuCandidateResultV1> {
  const source = record(parse(sourceRaw), ['contract', 'requestOperationId', 'contextRaw', 'policiesRaw', 'goalProfile', 'slotRevisions']);
  if (source.contract !== generationMenuCandidateSourceContractV1 || source.requestOperationId !== requestOperationId) {
    throw new Error('MENU_CANDIDATE_REQUEST_MISMATCH');
  }
  if (!['WEIGHT_LOSS', 'CUT', 'MAINTENANCE', 'MASS_GAIN'].includes(source.goalProfile as string)) {
    throw new Error('INVALID_MENU_CANDIDATE_GOAL_PROFILE');
  }
  const context = record(parse(source.contextRaw), ['contract', 'trustedGenerationInputRaw', 'candidateManifestRaw',
    'preferenceSnapshotRaw', 'safetySnapshotRaw', 'trustedValidationEvidenceRaw']);
  if (context.contract !== trustedValidationPoliciesRawBoundaryContractV2) throw new Error('INVALID_MENU_CANDIDATE_CONTEXT');
  // Own every raw source before the first await. Existing decoders verify all pinned digests and bindings.
  const owned = { input: parse(context.trustedGenerationInputRaw), manifest: parse(context.candidateManifestRaw),
    preference: parse(context.preferenceSnapshotRaw), safety: parse(context.safetySnapshotRaw) };
  const evidenceOwned = parse(context.trustedValidationEvidenceRaw);
  const input = decodeTrustedGenerationInputV1(owned.input);
  if (input.operation.requestId !== requestOperationId) throw new Error('MENU_CANDIDATE_REQUEST_MISMATCH');
  const manifest = await decodeAdaptiveNutritionCandidateManifestV2(owned.manifest);
  const preference = await decodeNutritionPreferenceSnapshotV1(owned.preference);
  const safety = await decodeNutritionSafetySnapshotV1(owned.safety);
  const evidence = await decodeTrustedValidationEvidenceV1(evidenceOwned, owned);
  const policies = await decodeTrustedValidationPoliciesRawV2(source.policiesRaw as string, source.contextRaw as string);
  if (!Array.isArray(source.slotRevisions)) throw new Error('INVALID_MENU_CANDIDATE_SLOT_REVISIONS');
  const revisions = new Map<string, string>();
  for (const value of source.slotRevisions) {
    const row = record(value, ['slotId', 'mealSnapshotRevision']);
    if (typeof row.slotId !== 'string' || !uuid.test(row.slotId) || typeof row.mealSnapshotRevision !== 'string'
        || !uuid.test(row.mealSnapshotRevision) || revisions.has(row.slotId)) {
      throw new Error('INVALID_MENU_CANDIDATE_SLOT_REVISIONS');
    }
    revisions.set(row.slotId, row.mealSnapshotRevision);
  }
  const requiredSlots = evidence.distributionPolicy.days.flatMap(day => day.requiredSlots);
  if (requiredSlots.length === 0 || requiredSlots.length !== revisions.size || requiredSlots.some(slot => !revisions.has(slot.slotId))) {
    throw new Error('MENU_CANDIDATE_SLOT_COVERAGE_MISMATCH');
  }
  if (requiredSlots.length > 64 || manifest.entries.length > 512) throw new ResourceLimit();
  const slots: GenerationMenuCandidateSlotV1[] = [];
  const exclusions: GenerationMenuCandidateExclusionV1[] = [];
  let totalCompositions = 0;
  for (const day of evidence.distributionPolicy.days) for (const slot of day.requiredSlots) {
    const exclude = (recipeId: string | null, reason: string, assignedServings: string | null = null) => {
      exclusions.push({ slotId: slot.slotId, recipeId, assignedServings, reason });
      if (exclusions.length > 16384) throw new ResourceLimit();
    };
    const candidates: MealComponentCandidateV1[] = [];
    for (const entry of manifest.entries) {
      if (!entry.allowedMealTypes.includes(slot.mealType)) { exclude(entry.recipeId, 'MEAL_TYPE_NOT_ALLOWED'); continue; }
      const admission = validateCandidateAuthoritiesV1({ accountId: input.accountId, candidate: { ...entry, mealType: slot.mealType },
        preference, safety, manifest });
      if (admission.status === 'BLOCKED') { exclude(entry.recipeId, admission.reason); continue; }
      if (entry.accessibility === 'ACCESSIBILITY_BLOCKED') { exclude(entry.recipeId, 'ACCESSIBILITY_BLOCKED'); continue; }
      const component = evidence.components.find(c => c.slotId === slot.slotId && identity(c) === identity(entry));
      if (!component) { exclude(entry.recipeId, 'COMPONENT_EVIDENCE_MISSING'); continue; }
      if (!evidence.planEligibility.some(e => identity(e) === identity(entry) && e.planEligible)) {
        exclude(entry.recipeId, 'PLAN_ELIGIBILITY_REQUIRED'); continue;
      }
      const rules = entry.portionRules;
      const step = minor(rules.assignedServingsIncrement);
      const first = ((minor(rules.assignedServingsMinimum) + step - 1n) / step) * step;
      const last = minor(rules.assignedServingsMaximum);
      if (first > last) { exclude(entry.recipeId, 'NO_REPRESENTABLE_PORTION'); continue; }
      // Bound work before enumeration; never truncate a recipe's reviewed portion grid silently.
      if ((last - first) / step + 1n > 64n) throw new ResourceLimit();
      for (let amount = first; amount <= last; amount += step) {
        const servings = decimal(amount);
        const scaled = scalePremiumRecipeCollectionV1(entry.recipeSnapshot, servings);
        const assignedGrams = entry.recipeSnapshot.baseYield.totalYieldGrams === null ? null
          : ratio(entry.recipeSnapshot.baseYield.totalYieldGrams, servings, entry.recipeSnapshot.baseYield.servings);
        if (rules.componentIncrements.some(rule => {
          const ingredient = scaled.ingredients.find(i => i.componentId === rule.componentId);
          return !ingredient || minor(ingredient.quantity.amount) % minor(rule.increment) !== 0n;
        })) { exclude(entry.recipeId, 'DISCRETE_PORTION_NOT_REPRESENTABLE', servings); continue; }
        if (minor(scaled.scaleFactor) === 0n || (assignedGrams !== null && minor(assignedGrams) === 0n)
            || scaled.ingredients.some(i => minor(i.quantity.amount) === 0n
            || (i.normalizedGrams !== null && minor(i.normalizedGrams) === 0n))) {
          exclude(entry.recipeId, 'PORTION_ROUNDS_TO_ZERO', servings); continue;
        }
        const values = [scaled.scaleFactor, ...axes.map(axis => scaled.nutrition[axis]),
          ...(assignedGrams === null ? [] : [assignedGrams]),
          ...scaled.ingredients.flatMap(i => [i.quantity.amount, ...(i.normalizedGrams === null ? [] : [i.normalizedGrams])])];
        if (values.some(v => !/^(0|[1-9][0-9]{0,8})\.[0-9]{3}$/.test(v))) {
          exclude(entry.recipeId, 'PORTION_OUTSIDE_NUMERIC_RANGE', servings); continue;
        }
        const { role, anchorKind, allowedMealTypes, requiredCompanionRoleSets, pairingTags,
          incompatiblePairingTags, repeatFamily, energyClass, beverageClass } = entry;
        candidates.push({ mealComponentId: component.mealComponentId,
          eligibility: { contract: adaptiveMealCompositionEligibilityV1_1, eligibilityRevisionId: entry.eligibilityRevisionId,
            recipeRevisionId: entry.recipeRevisionId, compositionPolicyRevision: input.compositionPolicyRevision,
            role, anchorKind, allowedMealTypes, requiredCompanionRoleSets, pairingTags, incompatiblePairingTags,
            repeatFamily, energyClass, beverageClass },
          recipeRevision: entry.recipeRevisionId, portionRevision: entry.portionRevisionId, recipe: entry.recipeSnapshot,
          assignedPortion: { source: 'potok_generator', portionRevisionId: entry.portionRevisionId, assignedServings: servings,
            servingMultiplier: scaled.scaleFactor, assignedGrams },
          ingredients: scaled.ingredients, nutrition: scaled.nutrition });
        if (candidates.length > 64) throw new ResourceLimit();
      }
    }
    candidates.sort((a, b) => compare(a.mealComponentId, b.mealComponentId)
      || (minor(a.assignedPortion.assignedServings) < minor(b.assignedPortion.assignedServings) ? -1 : 1));
    const bounds = day.nutritionBounds.find(b => b.slotId === slot.slotId)!.bounds;
    const distribution = day.distributionBounds.find(b => b.slotId === slot.slotId)!.bounds;
    const requirements = day.requirements.find(r => r.slotId === slot.slotId)!;
    const meals = new Map<string, GenerationMenuCandidateSlotV1['meals'][number]>();
    let slotCompositions = 0;
    for (const pattern of policies.composition.policy.patterns) {
      if (!pattern.allowedMealTypes.includes(slot.mealType) || pattern.roles.length > policies.balance.policy.maxComponents) continue;
      const groups = pattern.roles.map(role => candidates.filter(c => c.eligibility.role === role));
      if (groups.some(group => group.length === 0)) continue;
      const indexes = Array<number>(groups.length).fill(0);
      const count = groups.reduce((n, group) => n * group.length, 1);
      if (slotCompositions + count > 1024 || totalCompositions + count > 8192) throw new ResourceLimit();
      for (let n = 0; n < count; n++) {
        const selected = groups.map((group, i) => group[indexes[i]]);
        slotCompositions++; totalCompositions++;
        const composed = await composeAdaptiveMealV1({ mealSlotId: slot.slotId, mealSnapshotRevision: revisions.get(slot.slotId),
          mealType: slot.mealType, goalRevision: input.goalNutritionTarget.goalRevision, goalProfile: source.goalProfile as MealGoalProfileV1,
          policy: { ...policies.composition.policy, patterns: [pattern] },
          slotTarget: bounds.target, slotHardMaximum: bounds.maximum,
          // Isolated option enumeration, not an accumulated day or a day-fit certificate.
          currentDayNutrition: zero, dayTarget: bounds.target, dayHardMaximum: bounds.maximum,
          excludedRecipeRevisions: [], excludedRepeatFamilies: [], candidates: selected });
        if (composed.status === 'COMPLETE') {
          const nutrition = composed.meal.nutrition;
          const inBounds = [bounds, distribution].every(b => axes.every(axis => minor(nutrition[axis]) >= minor(b.minimum[axis])
            && minor(nutrition[axis]) <= minor(b.maximum[axis])));
          const proof = selected.map(c => evidence.components.find(e => e.mealComponentId === c.mealComponentId)!);
          if (inBounds && (!requirements.proteinSourceRequired || proof.some(e => e.proteinSource))
              && (!requirements.produceRequired || proof.some(e => e.produceSource))) {
            meals.set(composed.meal.digest, { meal: composed.meal,
              sourceKind: selected.length === 1 && selected[0].eligibility.anchorKind === 'COMPLETE' ? 'COMPLETE_RECIPE' : 'COMPOSED_MEAL',
              componentEvidence: proof.map(e => ({ mealComponentId: e.mealComponentId, eligibilityRevisionId: e.eligibilityRevisionId,
                publicationRevision: e.publicationRevision, canonicalEvidenceRevision: e.canonicalEvidenceRevision,
                nutritionEvidenceRevision: e.nutritionEvidenceRevision, allergenEvidenceRevision: e.allergenEvidenceRevision,
                dietaryEvidenceRevision: e.dietaryEvidenceRevision, evidenceDigest: e.digest })),
              isolatedCompositionScore: composed.score });
          }
        }
        for (let i = groups.length - 1; i >= 0; i--) {
          indexes[i]++;
          if (indexes[i] < groups[i].length) break;
          indexes[i] = 0;
        }
      }
    }
    const options = [...meals.values()].sort((a, b) => {
      const left = BigInt(a.isolatedCompositionScore), right = BigInt(b.isolatedCompositionScore);
      return left === right ? compare(a.meal.digest, b.meal.digest) : left < right ? -1 : 1;
    });
    if (!options.length) exclude(null, 'NO_COMPLETE_MENU_OPTION');
    slots.push({ date: day.date, slotId: slot.slotId, meals: options });
  }
  return freeze({ status: slots.every(slot => slot.meals.length) ? 'PREPARED' : 'INCOMPLETE', requestOperationId,
    generationInputDigest: evidence.generationInputDigest, manifestDigest: manifest.digest,
    validationEvidenceDigest: evidence.digest, validationPoliciesDigest: policies.digest, slots, exclusions });
}

export function createGenerationMenuCandidatePreparerV1(port: GenerationMenuCandidateSourcePortV1) {
  return Object.freeze({ async prepare(requestOperationId: string): Promise<GenerationMenuCandidateResultV1> {
    if (typeof requestOperationId !== 'string' || !uuid.test(requestOperationId)) throw new Error('INVALID_MENU_CANDIDATE_REQUEST');
    const raw = await port.loadPreparationRaw(requestOperationId);
    if (raw === null) return Object.freeze({ status: 'BLOCKED_SOURCE_MISSING', requestOperationId });
    try { return await prepare(raw, requestOperationId); }
    catch (error) {
      if (error instanceof ResourceLimit) return Object.freeze({ status: 'RESOURCE_LIMIT_REACHED', requestOperationId });
      throw error;
    }
  } });
}
