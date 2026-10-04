import {
  adaptiveNutritionGraphContractV1,
  adaptiveNutritionGraphEncodingV1,
  decodeAdaptiveNutritionGraphV1,
  decodeGraphRecipeSnapshotV1,
  encodeAdaptiveNutritionGraphCanonicalV1,
  type AdaptiveNutritionGraphV1,
  type GraphMealTypeV1,
  type GraphRecipeSnapshotV1,
} from './adaptiveNutritionGraphV1';
import { assertRawJsonWithoutDuplicateKeysV1 } from './adaptiveNutritionWireV1';

export const adaptiveGoalSnapshotContractV1 = 'potok-adaptive-goal-snapshot-v1' as const;
export const adaptiveGoalSnapshotEncodingV1 = 'potok-adaptive-goal-snapshot-canonical-json-v1' as const;
export const adaptiveCatalogManifestContractV1 = 'potok-adaptive-catalog-manifest-v1' as const;
export const adaptiveCatalogManifestEncodingV1 = 'potok-adaptive-catalog-manifest-canonical-json-v1' as const;
export const activateGeneratedWeekContractV1 = 'potok-adaptive-nutrition-activate-generated-week-v1' as const;
export const planActivatedReceiptContractV1 = 'potok-adaptive-nutrition-plan-activated-receipt-v1' as const;

export const adaptiveActivationLockOrderV1 = [
  'account_advisory_lock',
  'operation_idempotency_lookup',
  'selection_for_update',
  'goal_for_update',
  'immutable_catalog_manifest_reads',
] as const;

export const adaptiveActivationForbiddenEffectsV1 = [
  'FACT', 'PLAN_REPLACED', 'adaptive_event', 'diary_entry', 'replacement', 'shopping_mutation',
] as const;

export interface PotokAdaptiveGoalSnapshotSourceV1 {
  accountId: string;
  goalRevision: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  goalType: string | null;
}

export interface PotokAdaptiveGoalSnapshotV1 {
  contract: typeof adaptiveGoalSnapshotContractV1;
  accountId: string;
  goalRevision: string;
  goalType: string | null;
  nutritionTargets: {
    calories: string;
    protein: string;
    fat: string;
    carbs: string;
  };
}

export interface AdaptiveCatalogManifestRecipeV1 {
  recipeId: string;
  recipeRevisionId: string;
  portionRevisionId: string;
  eligibilityRevisionId: string;
  recipeSnapshot: GraphRecipeSnapshotV1;
  allowedMealTypes: GraphMealTypeV1[];
  reviewedTags: string[];
  planEligible: true;
  portionRules: {
    mode: 'hybrid';
    assignedServingsIncrement: string;
    componentIncrements: Array<{ componentId: string; increment: string }>;
  };
}

export interface AdaptiveCatalogManifestV1 {
  contract: typeof adaptiveCatalogManifestContractV1;
  manifestRevision: string;
  recipes: AdaptiveCatalogManifestRecipeV1[];
}

export interface TrustedGeneratorInputV1 {
  contract: 'potok-adaptive-nutrition-generator-input-v1';
  authority: { source: 'server_selection'; accountId: string };
  operation: { idempotencyKey: string; proposedPlanRevision: string };
  selection: {
    selectionId: string;
    contractVersion: 1;
    expectedStatus: 'pending_generation';
    expectedPlanRevision: null;
    goalRevision: string;
    historyRevision: string;
    diaryRevision: string;
    weekAnchor: string;
    timezone: string;
  };
  goalSnapshot: PotokAdaptiveGoalSnapshotV1;
  catalogAuthority: { source: 'published_server_manifest'; manifest: AdaptiveCatalogManifestV1 };
  generation: {
    generatorVersion: string;
    graphContract: typeof adaptiveNutritionGraphContractV1;
    graphEncoding: typeof adaptiveNutritionGraphEncodingV1;
    portionPolicy: 'hybrid';
  };
}

export interface TrustedGeneratorOutputV1 {
  contract: 'potok-adaptive-nutrition-generator-output-v1';
  operation: { idempotencyKey: string; proposedPlanRevision: string };
  selection: { selectionId: string; goalRevision: string; weekAnchor: string; timezone: string };
  graph: AdaptiveNutritionGraphV1;
  usedContent: Array<{
    recipeId: string;
    recipeRevisionId: string;
    portionRevisionId: string;
    eligibilityRevisionId: string;
  }>;
}

export interface CanonicalAdaptiveNutritionGraphEnvelopeV1 {
  graph: AdaptiveNutritionGraphV1;
  canonicalBytes: Uint8Array;
}

export interface ActivateGeneratedWeekV1 {
  contract: typeof activateGeneratedWeekContractV1;
  authority: { source: 'server_selection'; accountId: string };
  operation: { idempotencyKey: string; proposedPlanRevision: string };
  expected: {
    selectionId: string;
    status: 'pending_generation';
    planRevision: null;
    goalRevision: string;
    historyRevision: string;
    diaryRevision: string;
    weekAnchor: string;
    timezone: string;
  };
  goalSnapshot: PotokAdaptiveGoalSnapshotV1;
  catalogAuthority: { source: 'published_server_manifest'; manifestRevision: string };
  graph: AdaptiveNutritionGraphV1;
}

export interface PlanActivatedReceiptV1 {
  kind: 'settled';
  contract: typeof planActivatedReceiptContractV1;
  outcome: 'accepted';
  operationId: string;
  idempotencyKey: string;
  selectionId: string;
  status: 'active';
  planRevision: string;
  goalRevision: string;
  historyRevision: string;
  diaryRevision: string;
  weekAnchor: string;
  timezone: string;
  graphDigestHex: string;
  committedAt: string;
  eventIds: [];
}

export interface PlanActivatedReceiptWireV1 {
  kind: 'settled';
  contract: typeof planActivatedReceiptContractV1;
  outcome: 'accepted';
  operation_id: string;
  idempotency_key: string;
  selection_id: string;
  status: 'active';
  plan_revision: string;
  goal_revision: string;
  history_revision: string;
  diary_revision: string;
  week_anchor: string;
  timezone: string;
  graph_digest_hex: string;
  committed_at: string;
  event_ids: [];
}

export type ActivationReplayResultV1 =
  | { kind: 'new' }
  | { kind: 'replay'; receipt: PlanActivatedReceiptV1 }
  | { kind: 'unknown' }
  | { kind: 'conflict'; reason: 'idempotency_payload_mismatch' };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const sourceDecimalPattern = /^(0|[1-9][0-9]{0,8})(?:\.[0-9]{1,3})?$/;
const canonicalDecimalPattern = /^(0|[1-9][0-9]{0,8})\.[0-9]{3}$/;
const mealTypes: readonly GraphMealTypeV1[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).length !== keys.length
      || !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error(`invalid_${label}_fields`);
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error(`invalid_${label}_uuid`);
  return value;
}

function canonicalDecimal(value: unknown, label: string, positive: boolean): string {
  if (typeof value !== 'string' || !canonicalDecimalPattern.test(value)) throw new Error(`invalid_${label}_decimal`);
  if (positive ? BigInt(value.replace('.', '')) <= 0n : BigInt(value.replace('.', '')) < 0n) {
    throw new Error(`invalid_${label}_value`);
  }
  return value;
}

function sourceDecimal(value: unknown, label: string, positive: boolean): string {
  if (typeof value !== 'string' || !sourceDecimalPattern.test(value)) throw new Error(`invalid_${label}_decimal`);
  const [whole, fraction = ''] = value.split('.');
  const normalized = `${whole}.${fraction.padEnd(3, '0')}`;
  return canonicalDecimal(normalized, label, positive);
}

function text(value: unknown, label: string, max = 120): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || value.length > max) {
    throw new Error(`invalid_${label}`);
  }
  return value;
}

function date(value: unknown, label: string): string {
  if (typeof value !== 'string' || !datePattern.test(value)
      || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`invalid_${label}_date`);
  }
  return value;
}

function timezone(value: unknown): string {
  if (typeof value !== 'string' || !value || value.trim() !== value) throw new Error('invalid_timezone');
  try {
    if (new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone !== value) throw new Error();
  } catch {
    throw new Error('invalid_timezone');
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('canonical_numbers_must_be_integers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
  }
  throw new Error('unsupported_canonical_value');
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('sha256_unavailable');
  const stable = new Uint8Array(bytes.byteLength);
  stable.set(bytes);
  const digest = await subtle.digest('SHA-256', stable.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function buildPotokAdaptiveGoalSnapshotV1(value: unknown): PotokAdaptiveGoalSnapshotV1 {
  const row = record(value, ['accountId', 'goalRevision', 'calories', 'protein', 'fat', 'carbs', 'goalType'],
    'goal_snapshot_source');
  return {
    contract: adaptiveGoalSnapshotContractV1,
    accountId: uuid(row.accountId, 'goal_account'),
    goalRevision: uuid(row.goalRevision, 'goal_revision'),
    goalType: row.goalType === null ? null : text(row.goalType, 'goal_type'),
    nutritionTargets: {
      calories: sourceDecimal(row.calories, 'goal_calories', true),
      protein: sourceDecimal(row.protein, 'goal_protein', false),
      fat: sourceDecimal(row.fat, 'goal_fat', false),
      carbs: sourceDecimal(row.carbs, 'goal_carbs', false),
    },
  };
}

export function decodePotokAdaptiveGoalSnapshotV1(value: unknown): PotokAdaptiveGoalSnapshotV1 {
  const row = record(value, ['contract', 'accountId', 'goalRevision', 'goalType', 'nutritionTargets'], 'goal_snapshot');
  if (row.contract !== adaptiveGoalSnapshotContractV1) throw new Error('invalid_goal_snapshot_contract');
  const targets = record(row.nutritionTargets, ['calories', 'protein', 'fat', 'carbs'], 'goal_targets');
  return {
    contract: adaptiveGoalSnapshotContractV1,
    accountId: uuid(row.accountId, 'goal_account'),
    goalRevision: uuid(row.goalRevision, 'goal_revision'),
    goalType: row.goalType === null ? null : text(row.goalType, 'goal_type'),
    nutritionTargets: {
      calories: canonicalDecimal(targets.calories, 'goal_calories', true),
      protein: canonicalDecimal(targets.protein, 'goal_protein', false),
      fat: canonicalDecimal(targets.fat, 'goal_fat', false),
      carbs: canonicalDecimal(targets.carbs, 'goal_carbs', false),
    },
  };
}

export function encodePotokAdaptiveGoalSnapshotCanonicalV1(value: unknown): Uint8Array {
  const snapshot = decodePotokAdaptiveGoalSnapshotV1(value);
  return new TextEncoder().encode(canonicalJson({
    encoding: adaptiveGoalSnapshotEncodingV1,
    contract: adaptiveGoalSnapshotContractV1,
    snapshot,
  }));
}

export function potokAdaptiveGoalSnapshotSha256HexV1(value: unknown): Promise<string> {
  return sha256(encodePotokAdaptiveGoalSnapshotCanonicalV1(value));
}

function decodeManifestRecipe(value: unknown): AdaptiveCatalogManifestRecipeV1 {
  const row = record(value, ['recipeId', 'recipeRevisionId', 'portionRevisionId', 'eligibilityRevisionId',
    'recipeSnapshot', 'allowedMealTypes', 'reviewedTags', 'planEligible', 'portionRules'], 'manifest_recipe');
  const recipeSnapshot = decodeGraphRecipeSnapshotV1(row.recipeSnapshot);
  const recipeId = uuid(row.recipeId, 'manifest_recipe');
  const recipeRevisionId = uuid(row.recipeRevisionId, 'manifest_recipe_revision');
  if (recipeSnapshot.recipeId !== recipeId || recipeSnapshot.recipeRevisionId !== recipeRevisionId) {
    throw new Error('manifest_recipe_snapshot_mismatch');
  }
  if (!Array.isArray(row.allowedMealTypes) || row.allowedMealTypes.length === 0) {
    throw new Error('manifest_meal_types_required');
  }
  const allowedMealTypes = row.allowedMealTypes.map((item) => {
    if (typeof item !== 'string' || !mealTypes.includes(item as GraphMealTypeV1)) throw new Error('invalid_manifest_meal_type');
    return item as GraphMealTypeV1;
  });
  if (new Set(allowedMealTypes).size !== allowedMealTypes.length
      || allowedMealTypes.some((item, index) => mealTypes.indexOf(item) <= (index === 0 ? -1 : mealTypes.indexOf(allowedMealTypes[index - 1])))) {
    throw new Error('manifest_meal_types_not_canonical');
  }
  if (!Array.isArray(row.reviewedTags)) throw new Error('invalid_reviewed_tags');
  const reviewedTags = row.reviewedTags.map((item) => text(item, 'reviewed_tag', 64));
  if (new Set(reviewedTags).size !== reviewedTags.length
      || reviewedTags.some((item, index) => index > 0 && item <= reviewedTags[index - 1])) {
    throw new Error('reviewed_tags_not_canonical');
  }
  if (row.planEligible !== true) throw new Error('manifest_recipe_not_plan_eligible');
  const rules = record(row.portionRules, ['mode', 'assignedServingsIncrement', 'componentIncrements'], 'portion_rules');
  if (rules.mode !== 'hybrid' || !Array.isArray(rules.componentIncrements)) throw new Error('invalid_hybrid_portion_rules');
  const componentIncrements = rules.componentIncrements.map((item) => {
    const increment = record(item, ['componentId', 'increment'], 'component_increment');
    return { componentId: uuid(increment.componentId, 'increment_component'),
      increment: canonicalDecimal(increment.increment, 'component_increment', true) };
  });
  if (new Set(componentIncrements.map((item) => item.componentId)).size !== componentIncrements.length
      || componentIncrements.some((item, index) => index > 0 && item.componentId <= componentIncrements[index - 1].componentId)) {
    throw new Error('component_increments_not_canonical');
  }
  const expectedIncrements = recipeSnapshot.ingredients.flatMap((ingredient) => ingredient.scaling.mode === 'discrete'
    ? [{ componentId: ingredient.componentId, increment: ingredient.scaling.increment }] : [])
    .sort((left, right) => left.componentId.localeCompare(right.componentId));
  if (canonicalJson(componentIncrements) !== canonicalJson(expectedIncrements)) throw new Error('portion_rules_snapshot_mismatch');
  return {
    recipeId, recipeRevisionId, portionRevisionId: uuid(row.portionRevisionId, 'manifest_portion_revision'),
    eligibilityRevisionId: uuid(row.eligibilityRevisionId, 'manifest_eligibility_revision'), recipeSnapshot,
    allowedMealTypes, reviewedTags, planEligible: true,
    portionRules: { mode: 'hybrid',
      assignedServingsIncrement: canonicalDecimal(rules.assignedServingsIncrement, 'assigned_servings_increment', true),
      componentIncrements },
  };
}

export function decodeAdaptiveCatalogManifestV1(value: unknown): AdaptiveCatalogManifestV1 {
  const row = record(value, ['contract', 'manifestRevision', 'recipes'], 'catalog_manifest');
  if (row.contract !== adaptiveCatalogManifestContractV1) throw new Error('invalid_catalog_manifest_contract');
  if (!Array.isArray(row.recipes) || row.recipes.length === 0) throw new Error('catalog_manifest_recipes_required');
  const recipes = row.recipes.map(decodeManifestRecipe);
  const keys = recipes.map((recipe) => `${recipe.recipeId}:${recipe.recipeRevisionId}:${recipe.portionRevisionId}`);
  if (new Set(keys).size !== keys.length || keys.some((key, index) => index > 0 && key <= keys[index - 1])) {
    throw new Error('catalog_manifest_not_canonical');
  }
  return { contract: adaptiveCatalogManifestContractV1,
    manifestRevision: uuid(row.manifestRevision, 'manifest_revision'), recipes };
}

export function encodeAdaptiveCatalogManifestCanonicalV1(value: unknown): Uint8Array {
  const manifest = decodeAdaptiveCatalogManifestV1(value);
  return new TextEncoder().encode(canonicalJson({ contract: adaptiveCatalogManifestContractV1, manifest }));
}

export function adaptiveCatalogManifestSha256HexV1(value: unknown): Promise<string> {
  return sha256(encodeAdaptiveCatalogManifestCanonicalV1(value));
}

export function validateActivateGeneratedWeekV1(
  value: unknown,
  authoritativeManifestValue: unknown,
): ActivateGeneratedWeekV1 {
  const row = record(value, ['contract', 'authority', 'operation', 'expected', 'goalSnapshot', 'catalogAuthority', 'graph'],
    'activation_command');
  if (row.contract !== activateGeneratedWeekContractV1) throw new Error('invalid_activation_contract');
  const authority = record(row.authority, ['source', 'accountId'], 'activation_authority');
  if (authority.source !== 'server_selection') throw new Error('invalid_activation_authority');
  const accountId = uuid(authority.accountId, 'activation_account');
  const operation = record(row.operation, ['idempotencyKey', 'proposedPlanRevision'], 'activation_operation');
  const expected = record(row.expected, ['selectionId', 'status', 'planRevision', 'goalRevision', 'historyRevision',
    'diaryRevision', 'weekAnchor', 'timezone'], 'activation_expected');
  if (expected.status !== 'pending_generation' || expected.planRevision !== null) throw new Error('activation_requires_pending_null_head');
  const selectionId = uuid(expected.selectionId, 'activation_selection');
  const goalRevision = uuid(expected.goalRevision, 'activation_goal_revision');
  const weekAnchor = date(expected.weekAnchor, 'activation_week_anchor');
  if (new Date(`${weekAnchor}T00:00:00.000Z`).getUTCDay() !== 1) throw new Error('activation_week_anchor_not_monday');
  const timeZone = timezone(expected.timezone);
  const proposedPlanRevision = uuid(operation.proposedPlanRevision, 'proposed_plan_revision');
  const goalSnapshot = decodePotokAdaptiveGoalSnapshotV1(row.goalSnapshot);
  if (goalSnapshot.accountId !== accountId || goalSnapshot.goalRevision !== goalRevision) {
    throw new Error('activation_goal_binding_mismatch');
  }
  const catalogAuthority = record(row.catalogAuthority, ['source', 'manifestRevision'], 'catalog_authority');
  if (catalogAuthority.source !== 'published_server_manifest') throw new Error('invalid_catalog_authority');
  const manifestRevision = uuid(catalogAuthority.manifestRevision, 'manifest_revision');
  const catalogManifest = decodeAdaptiveCatalogManifestV1(authoritativeManifestValue);
  if (catalogManifest.manifestRevision !== manifestRevision) throw new Error('catalog_authority_revision_mismatch');
  const graph = decodeAdaptiveNutritionGraphV1(row.graph);
  if (graph.selection_id !== selectionId || graph.plan_revision !== proposedPlanRevision
      || graph.goal_revision !== goalRevision || graph.week_anchor !== weekAnchor || graph.timezone !== timeZone) {
    throw new Error('activation_graph_binding_mismatch');
  }
  const catalog = new Map(catalogManifest.recipes.map((recipe) => [
    `${recipe.recipeId}:${recipe.recipeRevisionId}:${recipe.portionRevisionId}`, recipe,
  ]));
  for (const day of graph.days) for (const slot of day.slots) {
    const recipe = slot.snapshot.recipe;
    const key = `${recipe.recipeId}:${recipe.recipeRevisionId}:${slot.snapshot.portionRevision}`;
    const candidate = catalog.get(key);
    if (!candidate || !candidate.allowedMealTypes.includes(slot.mealType)
        || canonicalJson(candidate.recipeSnapshot) !== canonicalJson(recipe)) {
      throw new Error('activation_graph_content_not_in_manifest');
    }
    const servings = BigInt(canonicalDecimal(slot.snapshot.assignedPortion.assignedServings,
      'assigned_servings', true).replace('.', ''));
    const increment = BigInt(candidate.portionRules.assignedServingsIncrement.replace('.', ''));
    if (servings % increment !== 0n) throw new Error('activation_assigned_servings_increment_mismatch');
  }
  return {
    contract: activateGeneratedWeekContractV1,
    authority: { source: 'server_selection', accountId },
    operation: { idempotencyKey: uuid(operation.idempotencyKey, 'activation_idempotency'), proposedPlanRevision },
    expected: { selectionId, status: 'pending_generation', planRevision: null, goalRevision,
      historyRevision: uuid(expected.historyRevision, 'activation_history_revision'),
      diaryRevision: uuid(expected.diaryRevision, 'activation_diary_revision'), weekAnchor, timezone: timeZone },
    goalSnapshot, catalogAuthority: { source: 'published_server_manifest', manifestRevision }, graph,
  };
}

export function encodeActivationCanonicalPayloadV1(
  value: unknown,
  authoritativeManifestValue: unknown,
): Uint8Array {
  return new TextEncoder().encode(canonicalJson(validateActivateGeneratedWeekV1(value, authoritativeManifestValue)));
}

/**
 * Protected canonical-validator boundary for raw generator output.
 *
 * Duplicate keys are rejected from the original text before JSON.parse. The strict
 * Graph decoder then rebuilds the sole authoritative canonical representation. This
 * boundary deliberately rejects valid JSON whose bytes are not already that exact
 * representation; no caller-provided digest participates in the decision.
 */
export function decodeCanonicalAdaptiveNutritionGraphEnvelopeRawV1(
  raw: string,
): CanonicalAdaptiveNutritionGraphEnvelopeV1 {
  assertRawJsonWithoutDuplicateKeysV1(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('invalid_graph_envelope_json');
  }
  const envelope = record(parsed, ['encoding', 'contract', 'graph'], 'graph_envelope');
  if (envelope.encoding !== adaptiveNutritionGraphEncodingV1
      || envelope.contract !== adaptiveNutritionGraphContractV1) {
    throw new Error('invalid_graph_envelope_contract');
  }
  const graph = decodeAdaptiveNutritionGraphV1(envelope.graph);
  const canonicalBytes = encodeAdaptiveNutritionGraphCanonicalV1(graph);
  const receivedBytes = new TextEncoder().encode(raw);
  if (receivedBytes.length !== canonicalBytes.length
      || receivedBytes.some((byte, index) => byte !== canonicalBytes[index])) {
    throw new Error('noncanonical_graph_envelope');
  }
  return { graph, canonicalBytes };
}

export async function canonicalAdaptiveNutritionGraphSha256HexV1(raw: string): Promise<string> {
  return sha256(decodeCanonicalAdaptiveNutritionGraphEnvelopeRawV1(raw).canonicalBytes);
}

export function activationPayloadSha256HexV1(value: unknown, authoritativeManifestValue: unknown): Promise<string> {
  return sha256(encodeActivationCanonicalPayloadV1(value, authoritativeManifestValue));
}

export function decodePlanActivatedReceiptV1(value: unknown): PlanActivatedReceiptV1 {
  const row = record(value, ['kind', 'contract', 'outcome', 'operationId', 'idempotencyKey', 'selectionId', 'status',
    'planRevision', 'goalRevision', 'historyRevision', 'diaryRevision', 'weekAnchor', 'timezone', 'graphDigestHex',
    'committedAt', 'eventIds'], 'activation_receipt');
  if (row.kind !== 'settled' || row.contract !== planActivatedReceiptContractV1 || row.outcome !== 'accepted'
      || row.status !== 'active' || !Array.isArray(row.eventIds) || row.eventIds.length !== 0) {
    throw new Error('invalid_activation_receipt');
  }
  if (typeof row.graphDigestHex !== 'string' || !digestPattern.test(row.graphDigestHex)) {
    throw new Error('invalid_graph_digest');
  }
  if (typeof row.committedAt !== 'string' || !timestampPattern.test(row.committedAt)
      || new Date(row.committedAt).toISOString() !== row.committedAt) throw new Error('invalid_committed_at');
  return {
    kind: 'settled', contract: planActivatedReceiptContractV1, outcome: 'accepted',
    operationId: uuid(row.operationId, 'activation_operation'),
    idempotencyKey: uuid(row.idempotencyKey, 'activation_idempotency'),
    selectionId: uuid(row.selectionId, 'activation_selection'), status: 'active',
    planRevision: uuid(row.planRevision, 'activation_plan_revision'),
    goalRevision: uuid(row.goalRevision, 'activation_goal_revision'),
    historyRevision: uuid(row.historyRevision, 'activation_history_revision'),
    diaryRevision: uuid(row.diaryRevision, 'activation_diary_revision'),
    weekAnchor: date(row.weekAnchor, 'activation_week_anchor'), timezone: timezone(row.timezone),
    graphDigestHex: row.graphDigestHex, committedAt: row.committedAt, eventIds: [],
  };
}

export function decodePlanActivatedReceiptWireV1(value: unknown): PlanActivatedReceiptV1 {
  const row = record(value, ['kind', 'contract', 'outcome', 'operation_id', 'idempotency_key', 'selection_id',
    'status', 'plan_revision', 'goal_revision', 'history_revision', 'diary_revision', 'week_anchor', 'timezone',
    'graph_digest_hex', 'committed_at', 'event_ids'], 'activation_receipt_wire');
  return decodePlanActivatedReceiptV1({
    kind: row.kind,
    contract: row.contract,
    outcome: row.outcome,
    operationId: row.operation_id,
    idempotencyKey: row.idempotency_key,
    selectionId: row.selection_id,
    status: row.status,
    planRevision: row.plan_revision,
    goalRevision: row.goal_revision,
    historyRevision: row.history_revision,
    diaryRevision: row.diary_revision,
    weekAnchor: row.week_anchor,
    timezone: row.timezone,
    graphDigestHex: row.graph_digest_hex,
    committedAt: row.committed_at,
    eventIds: row.event_ids,
  });
}

export function resolveActivationReplayV1(existing: null | {
  accountId: string;
  idempotencyKey: string;
  payloadDigestHex: string;
  outcome: 'in_progress' | 'accepted';
  receipt: unknown;
}, attempt: { accountId: string; idempotencyKey: string; payloadDigestHex: string }): ActivationReplayResultV1 {
  if (!existing) return { kind: 'new' };
  if (existing.accountId !== attempt.accountId || existing.idempotencyKey !== attempt.idempotencyKey
      || existing.payloadDigestHex !== attempt.payloadDigestHex) {
    return { kind: 'conflict', reason: 'idempotency_payload_mismatch' };
  }
  if (existing.outcome === 'in_progress') return { kind: 'unknown' };
  return { kind: 'replay', receipt: decodePlanActivatedReceiptV1(existing.receipt) };
}

export const adaptiveActivationGraphContractV1 = adaptiveNutritionGraphContractV1;
export const adaptiveActivationGraphEncodingV1 = adaptiveNutritionGraphEncodingV1;
