import {
  decodeTrustedGenerationInputV1, trustedGenerationInputDigestV1,
} from './adaptiveNutritionGraphV2';
import {
  decodeAdaptiveNutritionCandidateManifestV2, decodeNutritionPreferenceSnapshotV1,
  decodeNutritionSafetySnapshotV1,
} from './adaptiveNutritionAuthoritiesV1';
import type { GraphMealTypeV1, GraphNutritionV1 } from './adaptiveNutritionGraphV1';
import type { DaySlotV1, NutritionBoundsV1, OrdinaryFallbackProofV1 } from './adaptiveNutritionMealBalanceV1';
import { assertRawJsonWithoutDuplicateKeysV1, adaptiveNutritionSha256HexV1 } from './adaptiveNutritionWireV1';

export const trustedValidationEvidenceContractV1 = 'potok-trusted-validation-evidence-v1' as const;
export const componentValidationEvidenceContractV1 = 'potok-component-validation-evidence-v1' as const;
export const componentValidationEvidenceEncodingV1 = 'potok-component-validation-evidence-canonical-json-v1' as const;
export const trustedValidationEvidenceEncodingV1 = 'potok-trusted-validation-evidence-canonical-json-v1' as const;
export const mealDistributionPolicyContractV1 = 'potok-meal-distribution-policy-snapshot-v1' as const;
export const ordinaryFallbackEvidenceContractV1 = 'potok-ordinary-fallback-evidence-v1' as const;
export const planEligibilityEvidenceContractV1 = 'potok-plan-eligibility-evidence-v1' as const;
export const planEligibilityEvidenceEncodingV1 = 'potok-plan-eligibility-evidence-canonical-json-v1' as const;

export interface DistributionDayEvidenceV1 {
  date: string;
  requiredSlots: DaySlotV1[];
  nutritionBounds: Array<{ slotId: string; bounds: NutritionBoundsV1 }>;
  requirements: Array<{ slotId: string; proteinSourceRequired: boolean; produceRequired: boolean }>;
  distributionBounds: Array<DaySlotBoundsV1>;
}
interface DaySlotBoundsV1 { slotId: string; sortOrder: number; bounds: NutritionBoundsV1 }
export interface MealDistributionPolicySnapshotV1 {
  contract: typeof mealDistributionPolicyContractV1;
  policyRevision: string;
  compositionPolicyRevision: string;
  days: DistributionDayEvidenceV1[];
}
export interface RecipeEvidenceIdentityV1 {
  recipeId: string; recipeRevisionId: string; portionRevisionId: string; eligibilityRevisionId: string;
}
export interface ComponentValidationEvidenceV1 extends RecipeEvidenceIdentityV1 {
  contract: typeof componentValidationEvidenceContractV1;
  slotId: string; mealComponentId: string;
  publicationRevision: string;
  ingredientFamilies: string[];
  proteinSource: boolean; produceSource: boolean;
  portionPolicyRevision: string;
  canonicalEvidenceRevision: string; canonicalEvidenceDigest: string;
  nutritionEvidenceRevision: string; nutritionEvidenceDigest: string;
  allergenEvidenceRevision: string; dietaryEvidenceRevision: string;
  digest: string;
}
export interface PlanEligibilityEvidenceV1 extends RecipeEvidenceIdentityV1 {
  contract: typeof planEligibilityEvidenceContractV1;
  planEligible: true;
  evidenceRevision: string;
  digest: string;
}
export interface OrdinaryFallbackEvidenceV1 extends OrdinaryFallbackProofV1 {
  contract: typeof ordinaryFallbackEvidenceContractV1;
  validationPolicyRevision: string;
  candidateManifestRevision: string; candidateManifestDigest: string;
}
export interface TrustedValidationEvidenceV1 {
  contract: typeof trustedValidationEvidenceContractV1;
  accountId: string; selectionId: string; weekStartLocal: string; timezone: string;
  generationInputDigest: string;
  validationPolicyRevision: string; compositionPolicyRevision: string; optimizationPolicyRevision: string;
  candidateManifestRevision: string; candidateManifestDigest: string;
  preferenceRevision: string; preferenceDigest: string;
  safetyRevision: string; safetyDigest: string;
  distributionPolicy: MealDistributionPolicySnapshotV1;
  components: ComponentValidationEvidenceV1[];
  ordinaryFallback: OrdinaryFallbackEvidenceV1;
  planEligibility: PlanEligibilityEvidenceV1[];
  digest: string;
}
/** These values must come from a trusted caller, never from generator output. */
export interface TrustedValidationEvidenceContextV1 {
  input: unknown; manifest: unknown; preference: unknown; safety: unknown;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hashPattern = /^[0-9a-f]{64}$/;
const decimalPattern = /^(0|[1-9][0-9]{0,8})\.[0-9]{3}$/;
const tokenPattern = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const axes: Array<keyof GraphNutritionV1> = ['calories', 'protein', 'fat', 'carbs', 'fiber'];
const identityKeys = ['recipeId', 'recipeRevisionId', 'portionRevisionId', 'eligibilityRevisionId'];
const componentKeys = ['contract', ...identityKeys, 'slotId', 'mealComponentId', 'publicationRevision',
  'ingredientFamilies', 'proteinSource', 'produceSource', 'portionPolicyRevision',
  'canonicalEvidenceRevision', 'canonicalEvidenceDigest', 'nutritionEvidenceRevision', 'nutritionEvidenceDigest',
  'allergenEvidenceRevision', 'dietaryEvidenceRevision'];
const eligibilityKeys = ['contract', ...identityKeys, 'planEligible', 'evidenceRevision'];
const aggregateKeys = ['contract', 'accountId', 'selectionId', 'weekStartLocal', 'timezone', 'generationInputDigest',
  'validationPolicyRevision', 'compositionPolicyRevision', 'optimizationPolicyRevision',
  'candidateManifestRevision', 'candidateManifestDigest', 'preferenceRevision', 'preferenceDigest',
  'safetyRevision', 'safetyDigest', 'distributionPolicy', 'components', 'ordinaryFallback', 'planEligibility'];

function record(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length !== keys.length || !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error(`INVALID_${label}_FIELDS`);
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, pattern: RegExp, label: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`INVALID_${label}`);
  return value;
}
const uuid = (value: unknown): string => text(value, uuidPattern, 'UUID');
const hash = (value: unknown): string => text(value, hashPattern, 'DIGEST');
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('INVALID_BOOLEAN');
  return value;
}
function list<T>(value: unknown, decode: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('INVALID_ARRAY');
  return Array.from(value, decode);
}
function unique<T>(items: T[], key: (item: T) => string, label: string): T[] {
  const keys = items.map(key);
  if (new Set(keys).size !== keys.length || canonical([...keys].sort()) !== canonical(keys)) {
    throw new Error(`DUPLICATE_OR_UNORDERED_${label}`);
  }
  return items;
}
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`;
  }
  throw new Error('INVALID_CANONICAL_VALUE');
}
function bytes(contract: string, encoding: string, evidence: unknown): Uint8Array {
  return new TextEncoder().encode(canonical({ contract, encoding, evidence }));
}
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}
function identity(row: Record<string, unknown>): RecipeEvidenceIdentityV1 {
  return { recipeId: uuid(row.recipeId), recipeRevisionId: uuid(row.recipeRevisionId),
    portionRevisionId: uuid(row.portionRevisionId), eligibilityRevisionId: uuid(row.eligibilityRevisionId) };
}
const identityKey = (value: RecipeEvidenceIdentityV1): string =>
  [value.recipeId, value.recipeRevisionId, value.portionRevisionId, value.eligibilityRevisionId].join(':');
function componentContent(value: unknown): Omit<ComponentValidationEvidenceV1, 'digest'> {
  const row = record(value, componentKeys, 'COMPONENT');
  if (row.contract !== componentValidationEvidenceContractV1) throw new Error('INVALID_COMPONENT_CONTRACT');
  const ingredientFamilies = unique(list(row.ingredientFamilies, (v) => text(v, tokenPattern, 'INGREDIENT_FAMILY')),
    (v) => v, 'INGREDIENT_FAMILIES');
  if (ingredientFamilies.length === 0) throw new Error('INGREDIENT_FAMILIES_REQUIRED');
  return { contract: componentValidationEvidenceContractV1, ...identity(row), slotId: uuid(row.slotId),
    mealComponentId: uuid(row.mealComponentId), publicationRevision: uuid(row.publicationRevision),
    ingredientFamilies, proteinSource: bool(row.proteinSource), produceSource: bool(row.produceSource),
    portionPolicyRevision: uuid(row.portionPolicyRevision), canonicalEvidenceRevision: uuid(row.canonicalEvidenceRevision),
    canonicalEvidenceDigest: hash(row.canonicalEvidenceDigest), nutritionEvidenceRevision: uuid(row.nutritionEvidenceRevision),
    nutritionEvidenceDigest: hash(row.nutritionEvidenceDigest), allergenEvidenceRevision: uuid(row.allergenEvidenceRevision),
    dietaryEvidenceRevision: uuid(row.dietaryEvidenceRevision) };
}
export function componentValidationEvidenceCanonicalBytesV1(value: unknown): Uint8Array {
  return bytes(componentValidationEvidenceContractV1, componentValidationEvidenceEncodingV1, componentContent(value));
}
/** Future Graph componentEvidence[].evidenceDigest must equal this exact envelope digest. */
export function componentValidationEvidenceDigestV1(value: unknown): Promise<string> {
  return adaptiveNutritionSha256HexV1(componentValidationEvidenceCanonicalBytesV1(value));
}
export async function sealComponentValidationEvidenceV1(value: Omit<ComponentValidationEvidenceV1, 'digest'>):
Promise<ComponentValidationEvidenceV1> {
  const content = componentContent(value);
  return frozen({ ...content, digest: await componentValidationEvidenceDigestV1(content) });
}
export async function decodeComponentValidationEvidenceV1(value: unknown): Promise<ComponentValidationEvidenceV1> {
  const row = record(value, [...componentKeys, 'digest'], 'COMPONENT');
  const content = { ...row }; delete content.digest;
  const result = await sealComponentValidationEvidenceV1(componentContent(content));
  if (hash(row.digest) !== result.digest) throw new Error('COMPONENT_DIGEST_MISMATCH');
  return result;
}
export async function decodeComponentValidationEvidenceRawV1(raw: string): Promise<ComponentValidationEvidenceV1> {
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return decodeComponentValidationEvidenceV1(JSON.parse(raw));
}
async function eligibility(value: unknown): Promise<PlanEligibilityEvidenceV1> {
  const row = record(value, [...eligibilityKeys, 'digest'], 'PLAN_ELIGIBILITY');
  const content = { ...row }; delete content.digest;
  const expected = await sealPlanEligibilityEvidenceV1(content as unknown as Omit<PlanEligibilityEvidenceV1, 'digest'>);
  if (hash(row.digest) !== expected.digest) throw new Error('PLAN_ELIGIBILITY_DIGEST_MISMATCH');
  return expected;
}
export async function sealPlanEligibilityEvidenceV1(value: Omit<PlanEligibilityEvidenceV1, 'digest'>): Promise<PlanEligibilityEvidenceV1> {
  const row = record(value, eligibilityKeys, 'PLAN_ELIGIBILITY');
  if (row.contract !== planEligibilityEvidenceContractV1 || row.planEligible !== true) throw new Error('PLAN_ELIGIBILITY_REQUIRED');
  const content = { contract: planEligibilityEvidenceContractV1, ...identity(row), planEligible: true as const,
    evidenceRevision: uuid(row.evidenceRevision) };
  return frozen({ ...content, digest: await adaptiveNutritionSha256HexV1(bytes(planEligibilityEvidenceContractV1,
    planEligibilityEvidenceEncodingV1, content)) });
}
function nutrition(value: unknown): GraphNutritionV1 {
  const row = record(value, axes, 'NUTRITION');
  return Object.fromEntries(axes.map((key) => [key, text(row[key], decimalPattern, 'DECIMAL')])) as unknown as GraphNutritionV1;
}
function bounds(value: unknown): NutritionBoundsV1 {
  const row = record(value, ['minimum', 'target', 'maximum'], 'BOUNDS');
  const result = { minimum: nutrition(row.minimum), target: nutrition(row.target), maximum: nutrition(row.maximum) };
  for (const key of axes) {
    const minor = (v: string) => BigInt(v.replace('.', ''));
    if (minor(result.minimum[key]) > minor(result.target[key]) || minor(result.target[key]) > minor(result.maximum[key])) {
      throw new Error('INVALID_BOUNDS_ORDER');
    }
  }
  return result;
}
function order(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || Object.is(value, -0)) throw new Error('INVALID_SLOT_ORDER');
  return value as number;
}
function distribution(value: unknown, week: string): MealDistributionPolicySnapshotV1 {
  const row = record(value, ['contract', 'policyRevision', 'compositionPolicyRevision', 'days'], 'DISTRIBUTION');
  if (row.contract !== mealDistributionPolicyContractV1) throw new Error('INVALID_DISTRIBUTION_CONTRACT');
  const days = list(row.days, (item) => {
    const day = record(item, ['date', 'requiredSlots', 'nutritionBounds', 'requirements', 'distributionBounds'], 'DISTRIBUTION_DAY');
    const requiredSlots = list(day.requiredSlots, (v) => {
      const slot = record(v, ['slotId', 'sortOrder', 'mealType'], 'REQUIRED_SLOT');
      if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(slot.mealType as string)) throw new Error('INVALID_MEAL_TYPE');
      return { slotId: uuid(slot.slotId), sortOrder: order(slot.sortOrder), mealType: slot.mealType as GraphMealTypeV1 };
    });
    if (requiredSlots.some((v, i) => v.sortOrder !== i) || new Set(requiredSlots.map((v) => v.slotId)).size !== requiredSlots.length) {
      throw new Error('AMBIGUOUS_REQUIRED_SLOTS');
    }
    const nutritionBounds = list(day.nutritionBounds, (v) => {
      const r = record(v, ['slotId', 'bounds'], 'MEAL_BOUNDS');
      return { slotId: uuid(r.slotId), bounds: bounds(r.bounds) };
    });
    const requirements = list(day.requirements, (v) => {
      const r = record(v, ['slotId', 'proteinSourceRequired', 'produceRequired'], 'REQUIREMENTS');
      return { slotId: uuid(r.slotId), proteinSourceRequired: bool(r.proteinSourceRequired), produceRequired: bool(r.produceRequired) };
    });
    const distributionBounds = list(day.distributionBounds, (v) => {
      const r = record(v, ['slotId', 'sortOrder', 'bounds'], 'DISTRIBUTION_BOUNDS');
      return { slotId: uuid(r.slotId), sortOrder: order(r.sortOrder), bounds: bounds(r.bounds) };
    });
    for (const values of [nutritionBounds, requirements, distributionBounds]) {
      if (values.length !== requiredSlots.length || values.some((v, i) => v.slotId !== requiredSlots[i].slotId)) {
        throw new Error('MISSING_OR_AMBIGUOUS_SLOT_EVIDENCE');
      }
    }
    if (distributionBounds.some((v, i) => v.sortOrder !== i)) throw new Error('INVALID_DISTRIBUTION_ORDER');
    return { date: day.date, requiredSlots, nutritionBounds, requirements, distributionBounds };
  });
  if (days.length !== 7) throw new Error('DISTRIBUTION_REQUIRES_SEVEN_DAYS');
  for (let i = 0; i < days.length; i += 1) {
    const date = new Date(`${week}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + i);
    if (days[i].date !== date.toISOString().slice(0, 10)) throw new Error('DISTRIBUTION_DATE_MISMATCH');
  }
  const slots = days.flatMap((day) => day.requiredSlots);
  if (new Set(slots.map((v) => v.slotId)).size !== slots.length) throw new Error('DUPLICATE_WEEK_SLOT');
  return { contract: mealDistributionPolicyContractV1, policyRevision: uuid(row.policyRevision),
    compositionPolicyRevision: uuid(row.compositionPolicyRevision), days: days as DistributionDayEvidenceV1[] };
}
function fallback(value: unknown): OrdinaryFallbackEvidenceV1 {
  const row = record(value, ['contract', 'validationPolicyRevision', 'candidateManifestRevision', 'candidateManifestDigest',
    'candidatePoolDigest', 'status', 'ordinaryWeekDigest'], 'ORDINARY_FALLBACK');
  if (row.contract !== ordinaryFallbackEvidenceContractV1 || !['VALID', 'UNAVAILABLE_SPECIALTY', 'UNAVAILABLE_EXPENSIVE',
    'UNAVAILABLE_BOTH'].includes(row.status as string)) throw new Error('INVALID_ORDINARY_FALLBACK');
  if (row.status !== 'VALID' && row.ordinaryWeekDigest !== null) throw new Error('INVALID_ORDINARY_WEEK_DIGEST');
  return { contract: ordinaryFallbackEvidenceContractV1, validationPolicyRevision: uuid(row.validationPolicyRevision),
    candidateManifestRevision: uuid(row.candidateManifestRevision), candidateManifestDigest: hash(row.candidateManifestDigest),
    candidatePoolDigest: hash(row.candidatePoolDigest), status: row.status as OrdinaryFallbackProofV1['status'],
    ordinaryWeekDigest: row.status === 'VALID' ? hash(row.ordinaryWeekDigest) : null };
}
async function aggregateContent(value: unknown, context: TrustedValidationEvidenceContextV1): Promise<Omit<TrustedValidationEvidenceV1, 'digest'>> {
  const row = record(value, aggregateKeys, 'TRUSTED_VALIDATION_EVIDENCE');
  const input = decodeTrustedGenerationInputV1(context.input);
  const manifest = await decodeAdaptiveNutritionCandidateManifestV2(context.manifest);
  const preference = await decodeNutritionPreferenceSnapshotV1(context.preference);
  const safety = await decodeNutritionSafetySnapshotV1(context.safety);
  const pinned = { accountId: input.accountId, selectionId: input.selection.selectionId,
    weekStartLocal: input.weekStartLocal, timezone: input.timezone, generationInputDigest: await trustedGenerationInputDigestV1(input),
    validationPolicyRevision: input.validationPolicyRevision, compositionPolicyRevision: input.compositionPolicyRevision,
    optimizationPolicyRevision: input.optimizationPolicyRevision, candidateManifestRevision: input.candidateManifestRevision,
    candidateManifestDigest: input.candidateManifestDigest, preferenceRevision: input.preferenceRevision,
    preferenceDigest: preference.digest, safetyRevision: input.safetyRevision, safetyDigest: safety.digest };
  if (row.contract !== trustedValidationEvidenceContractV1 || preference.accountId !== input.accountId || safety.accountId !== input.accountId
    || preference.revisionId !== input.preferenceRevision || safety.revisionId !== input.safetyRevision
    || manifest.manifestRevision !== input.candidateManifestRevision || manifest.digest !== input.candidateManifestDigest) {
    throw new Error('PINNED_AUTHORITY_MISMATCH');
  }
  for (const [key, expected] of Object.entries(pinned)) if (row[key] !== expected) throw new Error(`PINNED_${key}_MISMATCH`);
  const distributionPolicy = distribution(row.distributionPolicy, input.weekStartLocal);
  const ordinaryFallback = fallback(row.ordinaryFallback);
  if (distributionPolicy.policyRevision !== input.validationPolicyRevision || distributionPolicy.compositionPolicyRevision !== input.compositionPolicyRevision
    || ordinaryFallback.validationPolicyRevision !== input.validationPolicyRevision || ordinaryFallback.candidateManifestRevision !== manifest.manifestRevision
    || ordinaryFallback.candidateManifestDigest !== manifest.digest) throw new Error('POLICY_OR_MANIFEST_MISMATCH');
  const components = unique(await Promise.all(list(row.components, decodeComponentValidationEvidenceV1)),
    (v) => `${v.slotId}:${v.mealComponentId}`, 'COMPONENTS');
  const planEligibility = unique(await Promise.all(list(row.planEligibility, eligibility)), identityKey, 'PLAN_ELIGIBILITY');
  if (new Set(components.map((v) => v.mealComponentId)).size !== components.length
    || new Set(components.map((v) => `${v.slotId}:${identityKey(v)}`)).size !== components.length) throw new Error('AMBIGUOUS_COMPONENT_BINDING');
  const slots = new Map(distributionPolicy.days.flatMap((day) => day.requiredSlots).map((slot) => [slot.slotId, slot]));
  const used = new Set<string>();
  for (const component of components) {
    const entry = manifest.entries.find((v) => identityKey(v) === identityKey(component));
    const slot = slots.get(component.slotId);
    if (!entry || !slot || !entry.allowedMealTypes.includes(slot.mealType)) throw new Error('MANIFEST_COMPONENT_MISSING');
    for (const key of ['publicationRevision', 'canonicalEvidenceRevision', 'canonicalEvidenceDigest',
      'nutritionEvidenceRevision', 'nutritionEvidenceDigest', 'allergenEvidenceRevision', 'dietaryEvidenceRevision'] as const) {
      if (component[key] !== entry[key]) throw new Error(`MANIFEST_${key}_MISMATCH`);
    }
    if (!component.ingredientFamilies.includes(entry.dominantIngredientFamily)) throw new Error('DOMINANT_INGREDIENT_FAMILY_MISSING');
    if (!planEligibility.some((v) => identityKey(v) === identityKey(component))) throw new Error('PLAN_ELIGIBILITY_REQUIRED');
    used.add(identityKey(component));
  }
  if ([...slots.keys()].some((id) => !components.some((v) => v.slotId === id))) throw new Error('COMPONENT_EVIDENCE_MISSING');
  if (planEligibility.some((v) => !used.has(identityKey(v)))) throw new Error('UNUSED_PLAN_ELIGIBILITY');
  return { contract: trustedValidationEvidenceContractV1, ...pinned, distributionPolicy, components, ordinaryFallback, planEligibility };
}
export async function sealTrustedValidationEvidenceV1(value: Omit<TrustedValidationEvidenceV1, 'digest'>,
  context: TrustedValidationEvidenceContextV1): Promise<TrustedValidationEvidenceV1> {
  const content = await aggregateContent(value, context);
  return frozen({ ...content, digest: await adaptiveNutritionSha256HexV1(bytes(trustedValidationEvidenceContractV1,
    trustedValidationEvidenceEncodingV1, content)) });
}
export async function decodeTrustedValidationEvidenceV1(value: unknown,
  context: TrustedValidationEvidenceContextV1): Promise<TrustedValidationEvidenceV1> {
  const row = record(value, [...aggregateKeys, 'digest'], 'TRUSTED_VALIDATION_EVIDENCE');
  const content = { ...row }; delete content.digest;
  const expected = await sealTrustedValidationEvidenceV1(content as unknown as Omit<TrustedValidationEvidenceV1, 'digest'>, context);
  if (hash(row.digest) !== expected.digest) throw new Error('TRUSTED_VALIDATION_EVIDENCE_DIGEST_MISMATCH');
  return expected;
}
export async function decodeTrustedValidationEvidenceRawV1(raw: string,
  context: TrustedValidationEvidenceContextV1): Promise<TrustedValidationEvidenceV1> {
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return decodeTrustedValidationEvidenceV1(JSON.parse(raw), context);
}
export async function trustedValidationEvidenceCanonicalBytesV1(value: unknown,
  context: TrustedValidationEvidenceContextV1): Promise<Uint8Array> {
  const evidence = await decodeTrustedValidationEvidenceV1(value, context);
  const content: Record<string, unknown> = { ...evidence }; delete content.digest;
  return bytes(trustedValidationEvidenceContractV1, trustedValidationEvidenceEncodingV1, content);
}
/** A self-consistent hash establishes integrity, not provenance. Both pinned arguments are trusted caller data. */
export async function assertTrustedValidationEvidencePinnedV1(proposed: unknown, pinned: unknown,
  context: TrustedValidationEvidenceContextV1): Promise<TrustedValidationEvidenceV1> {
  const authority = await decodeTrustedValidationEvidenceV1(pinned, context);
  const candidate = await decodeTrustedValidationEvidenceV1(proposed, context);
  if (candidate.digest !== authority.digest) throw new Error('TRUSTED_VALIDATION_EVIDENCE_SUBSTITUTION');
  return authority;
}
