import { nutritionWeekDates } from './nutritionWeek';

export const adaptiveNutritionGraphContractV1 = 'potok-adaptive-nutrition-graph-v1' as const;
export const adaptiveNutritionGraphEncodingV1 = 'potok-adaptive-nutrition-graph-canonical-json-v1' as const;

export type GraphDecimalV1 = string;
export type GraphMealTypeV1 = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type GraphQuantityUnitV1 = 'g' | 'ml' | 'piece';
export type GraphFoodStateV1 = 'raw' | 'dry' | 'frozen' | 'cooked' | 'as-sold';

export interface GraphNutritionV1 {
  calories: GraphDecimalV1;
  protein: GraphDecimalV1;
  fat: GraphDecimalV1;
  carbs: GraphDecimalV1;
  fiber: GraphDecimalV1;
}

export interface GraphComponentV1 {
  componentId: string;
  recipeRevisionId: string;
  identity:
    | { kind: 'canonical_food'; canonicalFoodId: string }
    | { kind: 'approved_non_food'; componentDefinitionId: string };
  displayNameSnapshot: string;
  state: GraphFoodStateV1;
  quantity: { amount: GraphDecimalV1; unit: GraphQuantityUnitV1 };
  normalizedGrams: GraphDecimalV1 | null;
  normalizationEvidenceRef: string | null;
  scaling: { mode: 'continuous' } | { mode: 'discrete'; increment: GraphDecimalV1 };
  nutrition: GraphNutritionV1;
  sortOrder: number;
}

export interface GraphRecipeSnapshotV1 {
  recipeId: string;
  recipeRevisionId: string;
  displayNameSnapshot: string;
  baseYield: {
    servings: GraphDecimalV1;
    servingLabel: string;
    totalYieldGrams: GraphDecimalV1 | null;
  };
  fullRecipeNutrition: GraphNutritionV1;
  ingredients: GraphComponentV1[];
}

export interface GraphAssignedPortionV1 {
  source: 'potok_generator';
  portionRevisionId: string;
  assignedServings: GraphDecimalV1;
  servingMultiplier: GraphDecimalV1;
  assignedGrams: GraphDecimalV1 | null;
}

export interface AdaptiveNutritionGraphSlotV1 {
  slotId: string;
  mealType: GraphMealTypeV1;
  sortOrder: number;
  displayLabel: string | null;
  plannedLocalTime: string | null;
  snapshot: {
    snapshotRevision: string;
    recipeRevision: string;
    portionRevision: string;
    recipe: GraphRecipeSnapshotV1;
    assignedPortion: GraphAssignedPortionV1;
    ingredients: GraphComponentV1[];
    nutrition: GraphNutritionV1;
  };
}

export interface AdaptiveNutritionGraphDayV1 {
  date: string;
  dayIndex: number;
  targetSnapshot: GraphNutritionV1 | null;
  slots: AdaptiveNutritionGraphSlotV1[];
}

export interface AdaptiveNutritionGraphV1 {
  contract_version: 1;
  selection_id: string;
  plan_revision: string;
  goal_revision: string;
  week_anchor: string;
  timezone: string;
  generated_at: string;
  generation: {
    generatorVersion: string;
    contentRevision: string;
  };
  days: AdaptiveNutritionGraphDayV1[];
}

export interface PremiumRecipeCollectionPreviewV1 {
  recipeId: string;
  recipeRevisionId: string;
  selectedServings: GraphDecimalV1;
  scaleFactor: GraphDecimalV1;
  ingredients: GraphComponentV1[];
  nutrition: GraphNutritionV1;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const decimalPattern = /^(0|[1-9][0-9]{0,8})\.[0-9]{3}$/;
const timePattern = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const generatedAtPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const tokenPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const decimalScale = 1_000n;

function requireRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).length !== keys.length
      || !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error(`invalid_${label}_fields`);
  }
  return value as Record<string, unknown>;
}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error(`invalid_${label}_uuid`);
  return value;
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || value.length > 240) {
    throw new Error(`invalid_${label}`);
  }
  return value;
}

function requireDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`invalid_${label}_date`);
  }
  return value;
}

function requireTimezone(value: unknown): string {
  if (typeof value !== 'string' || !value || value.trim() !== value) throw new Error('invalid_timezone');
  try {
    if (new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone !== value) {
      throw new Error('invalid_timezone');
    }
  } catch {
    throw new Error('invalid_timezone');
  }
  return value;
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`invalid_${label}`);
  return value as T;
}

function decimalMinor(value: unknown, label: string, positive: boolean): bigint {
  if (typeof value !== 'string' || !decimalPattern.test(value)) throw new Error(`invalid_${label}_decimal`);
  const [whole, fraction] = value.split('.');
  const minor = BigInt(whole) * decimalScale + BigInt(fraction);
  if (positive ? minor <= 0n : minor < 0n) throw new Error(`invalid_${label}_value`);
  return minor;
}

function decimalFromMinor(value: bigint): GraphDecimalV1 {
  if (value < 0n) throw new Error('negative_decimal');
  const whole = value / decimalScale;
  const fraction = String(value % decimalScale).padStart(3, '0');
  return `${whole}.${fraction}`;
}

function multiplyDivide(left: string, multiplier: string, divisor: string, label: string): string {
  const leftMinor = decimalMinor(left, `${label}_left`, false);
  const multiplierMinor = decimalMinor(multiplier, `${label}_multiplier`, true);
  const divisorMinor = decimalMinor(divisor, `${label}_divisor`, true);
  const numerator = leftMinor * multiplierMinor;
  return decimalFromMinor((numerator + divisorMinor / 2n) / divisorMinor);
}

function requireNutrition(value: unknown, label: string): GraphNutritionV1 {
  const row = requireRecord(value, ['calories', 'protein', 'fat', 'carbs', 'fiber'], label);
  return {
    calories: decimalFromMinor(decimalMinor(row.calories, `${label}_calories`, false)),
    protein: decimalFromMinor(decimalMinor(row.protein, `${label}_protein`, false)),
    fat: decimalFromMinor(decimalMinor(row.fat, `${label}_fat`, false)),
    carbs: decimalFromMinor(decimalMinor(row.carbs, `${label}_carbs`, false)),
    fiber: decimalFromMinor(decimalMinor(row.fiber, `${label}_fiber`, false)),
  };
}

function addNutrition(values: GraphNutritionV1[]): GraphNutritionV1 {
  const field = (key: keyof GraphNutritionV1): string => decimalFromMinor(values.reduce(
    (total, value) => total + decimalMinor(value[key], `nutrition_${key}`, false), 0n,
  ));
  return { calories: field('calories'), protein: field('protein'), fat: field('fat'),
    carbs: field('carbs'), fiber: field('fiber') };
}

function sameNutrition(left: GraphNutritionV1, right: GraphNutritionV1): boolean {
  return (Object.keys(left) as Array<keyof GraphNutritionV1>).every((key) => left[key] === right[key]);
}

function requireIdentity(value: unknown): GraphComponentV1['identity'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_component_identity');
  const kind = (value as Record<string, unknown>).kind;
  if (kind === 'canonical_food') {
    const row = requireRecord(value, ['kind', 'canonicalFoodId'], 'component_identity');
    return { kind, canonicalFoodId: requireUuid(row.canonicalFoodId, 'canonical_food') };
  }
  if (kind === 'approved_non_food') {
    const row = requireRecord(value, ['kind', 'componentDefinitionId'], 'component_identity');
    return { kind, componentDefinitionId: requireUuid(row.componentDefinitionId, 'component_definition') };
  }
  throw new Error('unresolved_or_ambiguous_component_identity');
}

function requireScaling(value: unknown): GraphComponentV1['scaling'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_component_scaling');
  const mode = (value as Record<string, unknown>).mode;
  if (mode === 'continuous') {
    requireRecord(value, ['mode'], 'component_scaling');
    return { mode };
  }
  if (mode === 'discrete') {
    const row = requireRecord(value, ['mode', 'increment'], 'component_scaling');
    return { mode, increment: decimalFromMinor(decimalMinor(row.increment, 'component_increment', true)) };
  }
  throw new Error('invalid_component_scaling');
}

function requireComponent(value: unknown, recipeRevisionId: string, expectedOrder: number): GraphComponentV1 {
  const row = requireRecord(value, ['componentId', 'recipeRevisionId', 'identity', 'displayNameSnapshot', 'state',
    'quantity', 'normalizedGrams', 'normalizationEvidenceRef', 'scaling', 'nutrition', 'sortOrder'], 'component');
  const quantity = requireRecord(row.quantity, ['amount', 'unit'], 'component_quantity');
  const unit = requireEnum(quantity.unit, ['g', 'ml', 'piece'] as const, 'component_unit');
  const normalizedGrams = row.normalizedGrams === null ? null
    : decimalFromMinor(decimalMinor(row.normalizedGrams, 'normalized_grams', true));
  const evidence = row.normalizationEvidenceRef === null ? null
    : requireUuid(row.normalizationEvidenceRef, 'normalization_evidence');
  const amount = decimalFromMinor(decimalMinor(quantity.amount, 'component_amount', true));
  if (unit === 'g' && normalizedGrams !== amount) throw new Error('gram_quantity_normalization_mismatch');
  if (unit !== 'g' && (normalizedGrams === null) !== (evidence === null)) {
    throw new Error('normalization_requires_evidence');
  }
  const linkedRevision = requireUuid(row.recipeRevisionId, 'component_recipe_revision');
  if (linkedRevision !== recipeRevisionId) throw new Error('component_recipe_revision_mismatch');
  if (row.sortOrder !== expectedOrder) throw new Error('component_order_mismatch');
  return {
    componentId: requireUuid(row.componentId, 'component'), recipeRevisionId: linkedRevision,
    identity: requireIdentity(row.identity), displayNameSnapshot: requireText(row.displayNameSnapshot, 'component_name'),
    state: requireEnum(row.state, ['raw', 'dry', 'frozen', 'cooked', 'as-sold'] as const, 'component_state'),
    quantity: { amount, unit },
    normalizedGrams, normalizationEvidenceRef: evidence, scaling: requireScaling(row.scaling),
    nutrition: requireNutrition(row.nutrition, 'component_nutrition'), sortOrder: expectedOrder,
  };
}

function requireComponentList(value: unknown, recipeRevisionId: string): GraphComponentV1[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('ingredients_required');
  const components = value.map((component, index) => requireComponent(component, recipeRevisionId, index));
  if (new Set(components.map((component) => component.componentId)).size !== components.length) {
    throw new Error('duplicate_component_id');
  }
  return components;
}

export function decodeGraphRecipeSnapshotV1(value: unknown): GraphRecipeSnapshotV1 {
  const row = requireRecord(value, ['recipeId', 'recipeRevisionId', 'displayNameSnapshot', 'baseYield',
    'fullRecipeNutrition', 'ingredients'], 'recipe_snapshot');
  const recipeRevisionId = requireUuid(row.recipeRevisionId, 'recipe_revision');
  const baseYield = requireRecord(row.baseYield, ['servings', 'servingLabel', 'totalYieldGrams'], 'base_yield');
  const ingredients = requireComponentList(row.ingredients, recipeRevisionId);
  const fullRecipeNutrition = requireNutrition(row.fullRecipeNutrition, 'full_recipe_nutrition');
  if (!sameNutrition(fullRecipeNutrition, addNutrition(ingredients.map((ingredient) => ingredient.nutrition)))) {
    throw new Error('full_recipe_nutrition_mismatch');
  }
  return {
    recipeId: requireUuid(row.recipeId, 'recipe'), recipeRevisionId,
    displayNameSnapshot: requireText(row.displayNameSnapshot, 'recipe_name'),
    baseYield: {
      servings: decimalFromMinor(decimalMinor(baseYield.servings, 'base_yield_servings', true)),
      servingLabel: requireText(baseYield.servingLabel, 'serving_label'),
      totalYieldGrams: baseYield.totalYieldGrams === null ? null
        : decimalFromMinor(decimalMinor(baseYield.totalYieldGrams, 'total_yield_grams', true)),
    },
    fullRecipeNutrition, ingredients,
  };
}

function scaleNutrition(value: GraphNutritionV1, selected: string, base: string): GraphNutritionV1 {
  return {
    calories: multiplyDivide(value.calories, selected, base, 'calories'),
    protein: multiplyDivide(value.protein, selected, base, 'protein'),
    fat: multiplyDivide(value.fat, selected, base, 'fat'),
    carbs: multiplyDivide(value.carbs, selected, base, 'carbs'),
    fiber: multiplyDivide(value.fiber, selected, base, 'fiber'),
  };
}

function scaleComponent(
  component: GraphComponentV1,
  selected: string,
  base: string,
  enforceDiscreteIncrement: boolean,
): GraphComponentV1 {
  const amount = multiplyDivide(component.quantity.amount, selected, base, 'component_amount');
  if (enforceDiscreteIncrement && component.scaling.mode === 'discrete'
      && decimalMinor(amount, 'scaled_component_amount', true)
        % decimalMinor(component.scaling.increment, 'component_increment', true) !== 0n) {
    throw new Error('discrete_component_not_divisible');
  }
  return {
    ...component,
    quantity: { ...component.quantity, amount },
    normalizedGrams: component.normalizedGrams === null ? null
      : multiplyDivide(component.normalizedGrams, selected, base, 'normalized_grams'),
    nutrition: scaleNutrition(component.nutrition, selected, base),
  };
}

/** Presentation/cooking preview only. It never changes recipe identity or revision. */
function scaleRecipeSnapshot(
  recipe: GraphRecipeSnapshotV1,
  servings: unknown,
  label: string,
  enforceDiscreteIncrement: boolean,
) {
  const selected = decimalFromMinor(decimalMinor(servings, label, true));
  const ingredients = recipe.ingredients.map((component) => scaleComponent(
    component, selected, recipe.baseYield.servings, enforceDiscreteIncrement,
  ));
  return { selected, ingredients, nutrition: addNutrition(ingredients.map((ingredient) => ingredient.nutrition)) };
}

export function scalePremiumRecipeCollectionV1(
  rawRecipe: unknown,
  selectedServings: unknown,
): PremiumRecipeCollectionPreviewV1 {
  const recipe = decodeGraphRecipeSnapshotV1(rawRecipe);
  const scaled = scaleRecipeSnapshot(recipe, selectedServings, 'selected_servings', false);
  return {
    recipeId: recipe.recipeId, recipeRevisionId: recipe.recipeRevisionId,
    selectedServings: scaled.selected,
    scaleFactor: multiplyDivide('1.000', scaled.selected, recipe.baseYield.servings, 'scale_factor'),
    ingredients: scaled.ingredients,
    nutrition: scaled.nutrition,
  };
}

function requireAssignedPortion(value: unknown, recipe: GraphRecipeSnapshotV1): GraphAssignedPortionV1 {
  const row = requireRecord(value, ['source', 'portionRevisionId', 'assignedServings', 'servingMultiplier',
    'assignedGrams'], 'assigned_portion');
  if (row.source !== 'potok_generator') throw new Error('assigned_portion_requires_generator');
  const assignedServings = decimalFromMinor(decimalMinor(row.assignedServings, 'assigned_servings', true));
  const servingMultiplier = decimalFromMinor(decimalMinor(row.servingMultiplier, 'serving_multiplier', true));
  if (servingMultiplier !== multiplyDivide('1.000', assignedServings, recipe.baseYield.servings, 'serving_multiplier')) {
    throw new Error('assigned_portion_multiplier_mismatch');
  }
  const assignedGrams = row.assignedGrams === null ? null
    : decimalFromMinor(decimalMinor(row.assignedGrams, 'assigned_grams', true));
  if (recipe.baseYield.totalYieldGrams === null ? assignedGrams !== null : assignedGrams === null) {
    throw new Error('assigned_grams_basis_mismatch');
  }
  if (assignedGrams !== null && recipe.baseYield.totalYieldGrams !== null
      && assignedGrams !== multiplyDivide(recipe.baseYield.totalYieldGrams, assignedServings,
        recipe.baseYield.servings, 'assigned_grams')) {
    throw new Error('assigned_grams_mismatch');
  }
  return {
    source: 'potok_generator', portionRevisionId: requireUuid(row.portionRevisionId, 'portion_revision'),
    assignedServings, servingMultiplier, assignedGrams,
  };
}

function requireSlot(value: unknown, slotIds: Set<string>): AdaptiveNutritionGraphSlotV1 {
  const row = requireRecord(value, ['slotId', 'mealType', 'sortOrder', 'displayLabel', 'plannedLocalTime', 'snapshot'],
    'meal_slot');
  const slotId = requireUuid(row.slotId, 'slot');
  if (slotIds.has(slotId)) throw new Error('duplicate_slot_id');
  slotIds.add(slotId);
  if (!Number.isSafeInteger(row.sortOrder) || (row.sortOrder as number) < 0) throw new Error('invalid_slot_order');
  const snapshot = requireRecord(row.snapshot, ['snapshotRevision', 'recipeRevision', 'portionRevision', 'recipe',
    'assignedPortion', 'ingredients', 'nutrition'], 'meal_snapshot');
  const recipe = decodeGraphRecipeSnapshotV1(snapshot.recipe);
  const recipeRevision = requireUuid(snapshot.recipeRevision, 'snapshot_recipe_revision');
  if (recipeRevision !== recipe.recipeRevisionId) throw new Error('snapshot_recipe_revision_mismatch');
  const assignedPortion = requireAssignedPortion(snapshot.assignedPortion, recipe);
  const portionRevision = requireUuid(snapshot.portionRevision, 'snapshot_portion_revision');
  if (portionRevision !== assignedPortion.portionRevisionId) throw new Error('snapshot_portion_revision_mismatch');
  const ingredients = requireComponentList(snapshot.ingredients, recipe.recipeRevisionId);
  const expected = scaleRecipeSnapshot(recipe, assignedPortion.assignedServings, 'assigned_servings', true);
  if (JSON.stringify(ingredients) !== JSON.stringify(expected.ingredients)) throw new Error('assigned_ingredients_mismatch');
  const nutrition = requireNutrition(snapshot.nutrition, 'assigned_nutrition');
  if (!sameNutrition(nutrition, addNutrition(ingredients.map((ingredient) => ingredient.nutrition)))) {
    throw new Error('assigned_nutrition_mismatch');
  }
  return {
    slotId,
    mealType: requireEnum(row.mealType, ['breakfast', 'lunch', 'dinner', 'snack'] as const, 'meal_type'),
    sortOrder: row.sortOrder as number,
    displayLabel: row.displayLabel === null ? null : requireText(row.displayLabel, 'slot_label'),
    plannedLocalTime: row.plannedLocalTime === null ? null : (() => {
      if (typeof row.plannedLocalTime !== 'string' || !timePattern.test(row.plannedLocalTime)) {
        throw new Error('invalid_planned_time');
      }
      return row.plannedLocalTime;
    })(),
    snapshot: {
      snapshotRevision: requireUuid(snapshot.snapshotRevision, 'snapshot_revision'), recipeRevision,
      portionRevision, recipe, assignedPortion, ingredients, nutrition,
    },
  };
}

export function decodeAdaptiveNutritionGraphV1(value: unknown): AdaptiveNutritionGraphV1 {
  const row = requireRecord(value, ['contract_version', 'selection_id', 'plan_revision', 'goal_revision',
    'week_anchor', 'timezone', 'generated_at', 'generation', 'days'], 'graph');
  if (row.contract_version !== 1) throw new Error('unsupported_graph_contract_version');
  const weekAnchor = requireDate(row.week_anchor, 'week_anchor');
  if (new Date(`${weekAnchor}T00:00:00.000Z`).getUTCDay() !== 1) throw new Error('week_anchor_must_be_monday');
  if (typeof row.generated_at !== 'string' || !generatedAtPattern.test(row.generated_at)
      || new Date(row.generated_at).toISOString() !== row.generated_at) throw new Error('invalid_generated_at');
  const generation = requireRecord(row.generation, ['generatorVersion', 'contentRevision'], 'generation');
  if (typeof generation.generatorVersion !== 'string' || !tokenPattern.test(generation.generatorVersion)) {
    throw new Error('invalid_generator_version');
  }
  if (!Array.isArray(row.days) || row.days.length !== 7) throw new Error('graph_requires_exactly_7_days');
  const expectedDates = nutritionWeekDates(weekAnchor);
  const slotIds = new Set<string>();
  const days = row.days.map((valueDay, index): AdaptiveNutritionGraphDayV1 => {
    const day = requireRecord(valueDay, ['date', 'dayIndex', 'targetSnapshot', 'slots'], 'day');
    const date = requireDate(day.date, 'day');
    if (date !== expectedDates[index] || day.dayIndex !== index) throw new Error('day_sequence_mismatch');
    if (!Array.isArray(day.slots)) throw new Error('invalid_day_slots');
    const slots = day.slots.map((slot) => requireSlot(slot, slotIds));
    if (new Set(slots.map((slot) => slot.sortOrder)).size !== slots.length
        || slots.some((slot, slotIndex) => slot.sortOrder !== slotIndex)) throw new Error('slot_order_mismatch');
    return { date, dayIndex: index,
      targetSnapshot: day.targetSnapshot === null ? null : requireNutrition(day.targetSnapshot, 'day_target'), slots };
  });
  return {
    contract_version: 1,
    selection_id: requireUuid(row.selection_id, 'selection'),
    plan_revision: requireUuid(row.plan_revision, 'plan_revision'),
    goal_revision: requireUuid(row.goal_revision, 'goal_revision'),
    week_anchor: weekAnchor,
    timezone: requireTimezone(row.timezone),
    generated_at: row.generated_at,
    generation: { generatorVersion: generation.generatorVersion, contentRevision: requireUuid(
      generation.contentRevision, 'content_revision',
    ) },
    days,
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('canonical_numbers_must_be_integers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
  }
  throw new Error('unsupported_canonical_graph_value');
}

export function encodeAdaptiveNutritionGraphCanonicalV1(value: unknown): Uint8Array {
  const graph = decodeAdaptiveNutritionGraphV1(value);
  return new TextEncoder().encode(canonicalJson({
    encoding: adaptiveNutritionGraphEncodingV1,
    contract: adaptiveNutritionGraphContractV1,
    graph,
  }));
}

export async function adaptiveNutritionGraphSha256HexV1(value: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('sha256_unavailable');
  const bytes = encodeAdaptiveNutritionGraphCanonicalV1(value);
  const stable = new Uint8Array(bytes.byteLength);
  stable.set(bytes);
  const digest = await subtle.digest('SHA-256', stable.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function formatGraphDecimalForPresentationV1(value: GraphDecimalV1, fractionDigits = 1): string {
  if (!Number.isSafeInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 3) {
    throw new Error('invalid_presentation_precision');
  }
  const minor = decimalMinor(value, 'presentation', false);
  if (fractionDigits === 3) return decimalFromMinor(minor);
  const divisor = 10n ** BigInt(3 - fractionDigits);
  const rounded = (minor + divisor / 2n) / divisor;
  const scale = 10n ** BigInt(fractionDigits);
  if (fractionDigits === 0) return String(rounded);
  return `${rounded / scale}.${String(rounded % scale).padStart(fractionDigits, '0')}`;
}
