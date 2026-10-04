import {
  decodeMealSnapshotV1,
  type MealAnchorKindV1,
  type MealComponentRoleV1,
  type MealSnapshotV1,
} from './adaptiveNutritionMealCompositionV1';
import {
  decodeGoalNutritionTargetV1,
  type GoalNutritionTargetV1,
} from './adaptiveNutritionMealBalanceV1';
import type { GraphMealTypeV1, GraphNutritionV1 } from './adaptiveNutritionGraphV1';

export const adaptiveNutritionGraphContractV2 = 'adaptive_nutrition_graph_v2' as const;
export const adaptiveNutritionGraphEncodingV2 = 'potok-adaptive-nutrition-graph-v2-canonical-json-v1' as const;
export const trustedGenerationInputContractV1 = 'potok-adaptive-trusted-generation-input-v1' as const;
export const generatedWeekPlanContractV1 = 'potok-adaptive-generated-week-plan-v1' as const;
export const sharedAccountGateContractV1 = 'potok-shared-account-gate-v1' as const;

export type GraphV2SourceKind = 'COMPLETE_RECIPE' | 'COMPOSED_MEAL';
export type GenerationStatusV1 = 'GENERATION_VALID' | 'GENERATION_BLOCKED_MISSING_EVIDENCE'
  | 'GENERATION_NO_VALID_PLAN' | 'GENERATION_CONFLICT_STALE_INPUT'
  | 'GENERATION_CONFLICT_IDEMPOTENCY' | 'GENERATION_ENTITLEMENT_DENIED';

export interface TrustedGenerationInputV1 {
  contract: typeof trustedGenerationInputContractV1;
  accountGateContract: typeof sharedAccountGateContractV1;
  accountId: string;
  selection: {
    selectionId: string;
    planSelectionRevision: string;
    expectedStatus: 'pending_generation';
    expectedPlanRevision: null;
    proposedPlanRevision: string;
  };
  weekStartLocal: string;
  timezone: string;
  goalNutritionTarget: GoalNutritionTargetV1;
  preferenceRevision: string;
  safetyRevision: string;
  entitlementEvidenceRevision: string;
  candidateManifestRevision: string;
  candidateManifestDigest: string;
  compositionPolicyRevision: string;
  validationPolicyRevision: string;
  optimizationPolicyRevision: string;
  generationPolicyRevision: string;
  operation: { requestId: string; idempotencyKey: string };
}

export interface GraphV2ComponentEvidenceBinding {
  mealComponentId: string;
  eligibilityRevisionId: string;
  publicationRevision: string;
  canonicalEvidenceRevision: string;
  nutritionEvidenceRevision: string;
  allergenEvidenceRevision: string;
  dietaryEvidenceRevision: string;
  evidenceDigest: string;
}

export interface GraphV2GeneratorDecisionEvidence {
  decisionPath: GraphV2SourceKind;
  generationPolicyRevision: string;
  candidateManifestDigest: string;
  candidateSetDigest: string;
  selectedCandidateDigest: string;
  optimizationResultDigest: string;
}

export interface AdaptiveNutritionGraphSlotV2 {
  slotId: string;
  civilDate: string;
  mealType: GraphMealTypeV1;
  sortOrder: number;
  sourceKind: GraphV2SourceKind;
  mealSnapshotRevision: string;
  mealSnapshot: MealSnapshotV1;
  validationResultDigest: string;
  generatorDecisionEvidence: GraphV2GeneratorDecisionEvidence;
  goalRevision: string;
  targetPolicyRevision: string;
  compositionPolicyRevision: string;
  validationPolicyRevision: string;
  optimizationPolicyRevision: string;
  catalogManifestRevision: string;
  componentEvidence: GraphV2ComponentEvidenceBinding[];
  canonicalSnapshotDigest: string;
}

export interface AdaptiveNutritionGraphDayV2 {
  date: string;
  dayIndex: number;
  slots: AdaptiveNutritionGraphSlotV2[];
  nutritionTotal: GraphNutritionV1;
  validationResultDigest: string;
}

export interface AdaptiveNutritionGraphV2 {
  contract: typeof adaptiveNutritionGraphContractV2;
  contractVersion: 2;
  selectionId: string;
  planSelectionRevision: string;
  planRevision: string;
  weekStartLocal: string;
  timezone: string;
  goalRevision: string;
  targetPolicyRevision: string;
  goalNutritionTarget: GoalNutritionTargetV1;
  preferenceRevision: string;
  safetyRevision: string;
  catalogManifestRevision: string;
  candidateManifestDigest: string;
  compositionPolicyRevision: string;
  validationPolicyRevision: string;
  optimizationPolicyRevision: string;
  generationPolicyRevision: string;
  days: AdaptiveNutritionGraphDayV2[];
  weekValidationResultDigest: string;
  weekOptimizationResultDigest: string;
}

export type AdaptiveNutritionGraphSlotDraftV2 = Omit<AdaptiveNutritionGraphSlotV2, 'canonicalSnapshotDigest'>;
export type AdaptiveNutritionGraphDayDraftV2 = Omit<AdaptiveNutritionGraphDayV2, 'slots'> & {
  slots: AdaptiveNutritionGraphSlotDraftV2[];
};
export type AdaptiveNutritionGraphDraftV2 = Omit<AdaptiveNutritionGraphV2, 'days'> & {
  days: AdaptiveNutritionGraphDayDraftV2[];
};

export interface GeneratedWeekPlanV1 {
  contract: typeof generatedWeekPlanContractV1;
  accountId: string;
  selectionId: string;
  planSelectionRevision: string;
  weekStartLocal: string;
  timezone: string;
  generationInputDigest: string;
  generationPolicyRevision: string;
  candidateManifestDigest: string;
  goalRevision: string;
  targetPolicyRevision: string;
  proposedPlanRevision: string;
  graph: AdaptiveNutritionGraphV2;
  graphDigest: string;
  generatedAt: null;
  facts: [];
  deterministicContentDigest: string;
}

export interface GenerationAuthorityRecheckV1 {
  accountGateContract: typeof sharedAccountGateContractV1;
  accountId: string;
  selectionId: string;
  weekStartLocal: string;
  timezone: string;
  entitlement: 'verified' | 'revoked' | 'expired';
  planSelectionRevision: string;
  expectedStatus: 'pending_generation';
  expectedPlanRevision: null;
  goalRevision: string;
  targetPolicyRevision: string;
  preferenceRevision: string;
  safetyRevision: string;
  entitlementEvidenceRevision: string;
  candidateManifestRevision: string;
  candidateManifestDigest: string;
  compositionPolicyRevision: string;
  validationPolicyRevision: string;
  optimizationPolicyRevision: string;
  generationPolicyRevision: string;
}

export type GenerationFinalizeResultV1 =
  | { status: 'GENERATION_VALID'; plan: GeneratedWeekPlanV1 }
  | { status: 'GENERATION_ENTITLEMENT_DENIED'; reason: 'ENTITLEMENT_REVOKED' | 'ENTITLEMENT_EXPIRED' }
  | { status: 'GENERATION_CONFLICT_STALE_INPUT'; reason: string };

export type GenerationReplayResultV1 =
  | { status: 'NEW' }
  | { status: 'UNKNOWN' }
  | { status: 'EXACT_REPLAY'; resultDigest: string }
  | { status: 'GENERATION_CONFLICT_IDEMPOTENCY'; reason: 'IDEMPOTENCY_PAYLOAD_MISMATCH' };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const nutritionKeys: ReadonlyArray<keyof GraphNutritionV1> = ['calories', 'protein', 'fat', 'carbs', 'fiber'];
const decimalPattern = /^(0|[1-9][0-9]{0,8})\.[0-9]{3}$/;
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

function digestHex(value: unknown, label: string): string {
  if (typeof value !== 'string' || !digestPattern.test(value)) throw new Error(`invalid_${label}_digest`);
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
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || value.length > 64) {
    throw new Error('invalid_timezone');
  }
  try {
    if (new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone !== value) {
      throw new Error('invalid_timezone');
    }
  } catch {
    throw new Error('invalid_timezone');
  }
  return value;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new Error(`invalid_${label}`);
  return value as T;
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`invalid_${label}`);
  return value as number;
}

function decimalMinor(value: unknown, label: string): bigint {
  if (typeof value !== 'string' || !decimalPattern.test(value)) throw new Error(`invalid_${label}_decimal`);
  return BigInt(value.replace('.', ''));
}

function decimalFromMinor(value: bigint): string {
  return `${value / 1_000n}.${String(value % 1_000n).padStart(3, '0')}`;
}

function nutrition(value: unknown, label: string): GraphNutritionV1 {
  const row = record(value, nutritionKeys, label);
  return Object.fromEntries(nutritionKeys.map((key) => [key,
    decimalFromMinor(decimalMinor(row[key], `${label}_${key}`))])) as unknown as GraphNutritionV1;
}

function addNutrition(values: GraphNutritionV1[]): GraphNutritionV1 {
  return Object.fromEntries(nutritionKeys.map((key) => [key, decimalFromMinor(values.reduce(
    (sum, value) => sum + decimalMinor(value[key], `nutrition_${key}`), 0n,
  ))])) as unknown as GraphNutritionV1;
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

async function sha256(value: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('sha256_unavailable');
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function addDays(value: string, amount: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

export function decodeTrustedGenerationInputV1(value: unknown): TrustedGenerationInputV1 {
  const row = record(value, ['contract', 'accountGateContract', 'accountId', 'selection', 'weekStartLocal', 'timezone',
    'goalNutritionTarget', 'preferenceRevision', 'safetyRevision', 'entitlementEvidenceRevision',
    'candidateManifestRevision', 'candidateManifestDigest', 'compositionPolicyRevision',
    'validationPolicyRevision', 'optimizationPolicyRevision', 'generationPolicyRevision', 'operation'],
  'trusted_generation_input');
  if (row.contract !== trustedGenerationInputContractV1) throw new Error('unsupported_generation_input');
  if (row.accountGateContract !== sharedAccountGateContractV1) throw new Error('unsupported_account_gate_contract');
  const selection = record(row.selection, ['selectionId', 'planSelectionRevision', 'expectedStatus',
    'expectedPlanRevision', 'proposedPlanRevision'], 'generation_selection');
  if (selection.expectedStatus !== 'pending_generation' || selection.expectedPlanRevision !== null) {
    throw new Error('generation_requires_pending_null_plan_head');
  }
  const operation = record(row.operation, ['requestId', 'idempotencyKey'], 'generation_operation');
  const weekStartLocal = date(row.weekStartLocal, 'week_start');
  if (new Date(`${weekStartLocal}T00:00:00.000Z`).getUTCDay() !== 1) throw new Error('week_start_not_monday');
  return {
    contract: trustedGenerationInputContractV1,
    accountGateContract: sharedAccountGateContractV1,
    accountId: uuid(row.accountId, 'generation_account'),
    selection: {
      selectionId: uuid(selection.selectionId, 'generation_selection'),
      planSelectionRevision: uuid(selection.planSelectionRevision, 'plan_selection_revision'),
      expectedStatus: 'pending_generation', expectedPlanRevision: null,
      proposedPlanRevision: uuid(selection.proposedPlanRevision, 'proposed_plan_revision'),
    },
    weekStartLocal, timezone: timezone(row.timezone),
    goalNutritionTarget: decodeGoalNutritionTargetV1(row.goalNutritionTarget),
    preferenceRevision: uuid(row.preferenceRevision, 'preference_revision'),
    safetyRevision: uuid(row.safetyRevision, 'safety_revision'),
    entitlementEvidenceRevision: uuid(row.entitlementEvidenceRevision, 'entitlement_evidence_revision'),
    candidateManifestRevision: uuid(row.candidateManifestRevision, 'candidate_manifest_revision'),
    candidateManifestDigest: digestHex(row.candidateManifestDigest, 'candidate_manifest'),
    compositionPolicyRevision: uuid(row.compositionPolicyRevision, 'composition_policy_revision'),
    validationPolicyRevision: uuid(row.validationPolicyRevision, 'validation_policy_revision'),
    optimizationPolicyRevision: uuid(row.optimizationPolicyRevision, 'optimization_policy_revision'),
    generationPolicyRevision: uuid(row.generationPolicyRevision, 'generation_policy_revision'),
    operation: {
      requestId: uuid(operation.requestId, 'generation_request'),
      idempotencyKey: uuid(operation.idempotencyKey, 'generation_idempotency'),
    },
  };
}

export function trustedGenerationInputDigestV1(value: unknown): Promise<string> {
  return sha256({ contract: trustedGenerationInputContractV1, input: decodeTrustedGenerationInputV1(value) });
}

function decodeComponentEvidence(value: unknown): GraphV2ComponentEvidenceBinding {
  const row = record(value, ['mealComponentId', 'eligibilityRevisionId', 'publicationRevision',
    'canonicalEvidenceRevision', 'nutritionEvidenceRevision', 'allergenEvidenceRevision',
    'dietaryEvidenceRevision', 'evidenceDigest'], 'graph_v2_component_evidence');
  return {
    mealComponentId: uuid(row.mealComponentId, 'evidence_component'),
    eligibilityRevisionId: uuid(row.eligibilityRevisionId, 'eligibility_revision'),
    publicationRevision: uuid(row.publicationRevision, 'publication_revision'),
    canonicalEvidenceRevision: uuid(row.canonicalEvidenceRevision, 'canonical_evidence_revision'),
    nutritionEvidenceRevision: uuid(row.nutritionEvidenceRevision, 'nutrition_evidence_revision'),
    allergenEvidenceRevision: uuid(row.allergenEvidenceRevision, 'allergen_evidence_revision'),
    dietaryEvidenceRevision: uuid(row.dietaryEvidenceRevision, 'dietary_evidence_revision'),
    evidenceDigest: digestHex(row.evidenceDigest, 'component_evidence'),
  };
}

function decodeDecisionEvidence(value: unknown): GraphV2GeneratorDecisionEvidence {
  const row = record(value, ['decisionPath', 'generationPolicyRevision', 'candidateManifestDigest',
    'candidateSetDigest', 'selectedCandidateDigest', 'optimizationResultDigest'], 'generator_decision_evidence');
  return {
    decisionPath: enumValue(row.decisionPath, ['COMPLETE_RECIPE', 'COMPOSED_MEAL'] as const, 'decision_path'),
    generationPolicyRevision: uuid(row.generationPolicyRevision, 'decision_generation_policy_revision'),
    candidateManifestDigest: digestHex(row.candidateManifestDigest, 'decision_candidate_manifest'),
    candidateSetDigest: digestHex(row.candidateSetDigest, 'decision_candidate_set'),
    selectedCandidateDigest: digestHex(row.selectedCandidateDigest, 'selected_candidate'),
    optimizationResultDigest: digestHex(row.optimizationResultDigest, 'decision_optimization_result'),
  };
}

function slotDigestPayload(slot: Omit<AdaptiveNutritionGraphSlotV2, 'canonicalSnapshotDigest'>): unknown {
  return { contract: adaptiveNutritionGraphContractV2, slot };
}

async function decodeSlot(value: unknown, graph: Omit<AdaptiveNutritionGraphV2, 'days'>,
  expectedDate: string, expectedOrder: number): Promise<AdaptiveNutritionGraphSlotV2> {
  const row = record(value, ['slotId', 'civilDate', 'mealType', 'sortOrder', 'sourceKind', 'mealSnapshotRevision',
    'mealSnapshot', 'validationResultDigest', 'generatorDecisionEvidence', 'goalRevision', 'targetPolicyRevision',
    'compositionPolicyRevision', 'validationPolicyRevision', 'optimizationPolicyRevision', 'catalogManifestRevision',
    'componentEvidence', 'canonicalSnapshotDigest'], 'graph_v2_slot');
  const slotId = uuid(row.slotId, 'graph_v2_slot');
  const civilDate = date(row.civilDate, 'graph_v2_slot');
  if (civilDate !== expectedDate || row.sortOrder !== expectedOrder) throw new Error('graph_v2_slot_order_mismatch');
  const mealType = enumValue(row.mealType, mealTypes, 'graph_v2_meal_type');
  const sourceKind = enumValue(row.sourceKind, ['COMPLETE_RECIPE', 'COMPOSED_MEAL'] as const, 'graph_v2_source_kind');
  const mealSnapshot = await decodeMealSnapshotV1(row.mealSnapshot);
  const mealSnapshotRevision = uuid(row.mealSnapshotRevision, 'graph_v2_meal_snapshot_revision');
  if (mealSnapshot.mealSnapshotRevision !== mealSnapshotRevision || mealSnapshot.mealSlotId !== slotId
      || mealSnapshot.mealType !== mealType) throw new Error('graph_v2_meal_snapshot_binding_mismatch');
  if (mealSnapshot.components.length > 5) throw new Error('graph_v2_component_limit_exceeded');
  const anchors = mealSnapshot.components.filter((item) => item.eligibility.anchorKind !== 'NONE');
  if (sourceKind === 'COMPLETE_RECIPE') {
    if (mealSnapshot.components.length !== 1 || anchors.length !== 1
        || anchors[0].eligibility.anchorKind !== 'COMPLETE') throw new Error('graph_v2_complete_source_mismatch');
  } else if (anchors.length !== 1 || anchors[0].eligibility.anchorKind !== 'PARTIAL'
      || mealSnapshot.components.some((item) => item !== anchors[0] && item.eligibility.anchorKind !== 'NONE')) {
    throw new Error('graph_v2_composed_source_mismatch');
  }
  const componentEvidence = Array.isArray(row.componentEvidence)
    ? row.componentEvidence.map(decodeComponentEvidence) : (() => { throw new Error('invalid_component_evidence'); })();
  if (componentEvidence.length !== mealSnapshot.components.length
      || componentEvidence.some((binding, index) => binding.mealComponentId !== mealSnapshot.components[index].mealComponentId
        || binding.eligibilityRevisionId !== mealSnapshot.components[index].eligibility.eligibilityRevisionId)) {
    throw new Error('graph_v2_component_evidence_binding_mismatch');
  }
  const generatorDecisionEvidence = decodeDecisionEvidence(row.generatorDecisionEvidence);
  const revisions = {
    goalRevision: uuid(row.goalRevision, 'slot_goal_revision'),
    targetPolicyRevision: uuid(row.targetPolicyRevision, 'slot_target_policy_revision'),
    compositionPolicyRevision: uuid(row.compositionPolicyRevision, 'slot_composition_policy_revision'),
    validationPolicyRevision: uuid(row.validationPolicyRevision, 'slot_validation_policy_revision'),
    optimizationPolicyRevision: uuid(row.optimizationPolicyRevision, 'slot_optimization_policy_revision'),
    catalogManifestRevision: uuid(row.catalogManifestRevision, 'slot_catalog_manifest_revision'),
  };
  if (mealSnapshot.goalRevision !== graph.goalRevision || mealSnapshot.compositionPolicyRevision !== graph.compositionPolicyRevision
      || revisions.goalRevision !== graph.goalRevision || revisions.targetPolicyRevision !== graph.targetPolicyRevision
      || revisions.compositionPolicyRevision !== graph.compositionPolicyRevision
      || revisions.validationPolicyRevision !== graph.validationPolicyRevision
      || revisions.optimizationPolicyRevision !== graph.optimizationPolicyRevision
      || revisions.catalogManifestRevision !== graph.catalogManifestRevision
      || generatorDecisionEvidence.decisionPath !== sourceKind
      || generatorDecisionEvidence.generationPolicyRevision !== graph.generationPolicyRevision
      || generatorDecisionEvidence.candidateManifestDigest !== graph.candidateManifestDigest) {
    throw new Error('graph_v2_revision_binding_mismatch');
  }
  const withoutDigest = {
    slotId, civilDate, mealType, sortOrder: integer(row.sortOrder, 'graph_v2_slot_order'), sourceKind,
    mealSnapshotRevision, mealSnapshot,
    validationResultDigest: digestHex(row.validationResultDigest, 'validation_result'),
    generatorDecisionEvidence, ...revisions, componentEvidence,
  };
  const canonicalSnapshotDigest = digestHex(row.canonicalSnapshotDigest, 'canonical_snapshot');
  if (canonicalSnapshotDigest !== await sha256(slotDigestPayload(withoutDigest))) {
    throw new Error('graph_v2_slot_digest_mismatch');
  }
  return { ...withoutDigest, canonicalSnapshotDigest };
}

export async function decodeAdaptiveNutritionGraphV2(value: unknown): Promise<AdaptiveNutritionGraphV2> {
  const row = record(value, ['contract', 'contractVersion', 'selectionId', 'planSelectionRevision', 'planRevision',
    'weekStartLocal', 'timezone', 'goalRevision', 'targetPolicyRevision', 'goalNutritionTarget',
    'preferenceRevision', 'safetyRevision', 'catalogManifestRevision', 'candidateManifestDigest',
    'compositionPolicyRevision', 'validationPolicyRevision', 'optimizationPolicyRevision',
    'generationPolicyRevision', 'days', 'weekValidationResultDigest', 'weekOptimizationResultDigest'], 'graph_v2');
  if (row.contract !== adaptiveNutritionGraphContractV2 || row.contractVersion !== 2) {
    throw new Error('unsupported_graph_v2_contract');
  }
  const weekStartLocal = date(row.weekStartLocal, 'graph_v2_week_start');
  if (new Date(`${weekStartLocal}T00:00:00.000Z`).getUTCDay() !== 1) throw new Error('graph_v2_week_not_monday');
  const goalNutritionTarget = decodeGoalNutritionTargetV1(row.goalNutritionTarget);
  const graphWithoutDays = {
    contract: adaptiveNutritionGraphContractV2, contractVersion: 2 as const,
    selectionId: uuid(row.selectionId, 'graph_v2_selection'),
    planSelectionRevision: uuid(row.planSelectionRevision, 'graph_v2_plan_selection_revision'),
    planRevision: uuid(row.planRevision, 'graph_v2_plan_revision'), weekStartLocal,
    timezone: timezone(row.timezone), goalRevision: uuid(row.goalRevision, 'graph_v2_goal_revision'),
    targetPolicyRevision: uuid(row.targetPolicyRevision, 'graph_v2_target_policy_revision'), goalNutritionTarget,
    preferenceRevision: uuid(row.preferenceRevision, 'graph_v2_preference_revision'),
    safetyRevision: uuid(row.safetyRevision, 'graph_v2_safety_revision'),
    catalogManifestRevision: uuid(row.catalogManifestRevision, 'graph_v2_catalog_manifest_revision'),
    candidateManifestDigest: digestHex(row.candidateManifestDigest, 'graph_v2_candidate_manifest'),
    compositionPolicyRevision: uuid(row.compositionPolicyRevision, 'graph_v2_composition_policy_revision'),
    validationPolicyRevision: uuid(row.validationPolicyRevision, 'graph_v2_validation_policy_revision'),
    optimizationPolicyRevision: uuid(row.optimizationPolicyRevision, 'graph_v2_optimization_policy_revision'),
    generationPolicyRevision: uuid(row.generationPolicyRevision, 'graph_v2_generation_policy_revision'),
    weekValidationResultDigest: digestHex(row.weekValidationResultDigest, 'week_validation_result'),
    weekOptimizationResultDigest: digestHex(row.weekOptimizationResultDigest, 'week_optimization_result'),
  };
  if (goalNutritionTarget.goalRevision !== graphWithoutDays.goalRevision
      || goalNutritionTarget.targetPolicyRevision !== graphWithoutDays.targetPolicyRevision) {
    throw new Error('graph_v2_goal_target_binding_mismatch');
  }
  if (!Array.isArray(row.days) || row.days.length !== 7) throw new Error('graph_v2_requires_seven_days');
  const slotIds = new Set<string>();
  const days: AdaptiveNutritionGraphDayV2[] = [];
  for (let dayIndex = 0; dayIndex < row.days.length; dayIndex += 1) {
    const dayRow = record(row.days[dayIndex], ['date', 'dayIndex', 'slots', 'nutritionTotal',
      'validationResultDigest'], `graph_v2_day_${dayIndex}`);
    const dayDate = date(dayRow.date, `graph_v2_day_${dayIndex}`);
    if (dayDate !== addDays(weekStartLocal, dayIndex) || dayRow.dayIndex !== dayIndex) {
      throw new Error('graph_v2_day_order_mismatch');
    }
    if (!Array.isArray(dayRow.slots)) throw new Error('invalid_graph_v2_slots');
    const slots: AdaptiveNutritionGraphSlotV2[] = [];
    for (let slotIndex = 0; slotIndex < dayRow.slots.length; slotIndex += 1) {
      const slot = await decodeSlot(dayRow.slots[slotIndex], graphWithoutDays, dayDate, slotIndex);
      if (slotIds.has(slot.slotId)) throw new Error('duplicate_graph_v2_slot');
      slotIds.add(slot.slotId);
      slots.push(slot);
    }
    const nutritionTotal = nutrition(dayRow.nutritionTotal, `graph_v2_day_${dayIndex}_nutrition`);
    if (canonicalJson(nutritionTotal) !== canonicalJson(addNutrition(slots.map((slot) => slot.mealSnapshot.nutrition)))) {
      throw new Error('graph_v2_day_nutrition_mismatch');
    }
    days.push({ date: dayDate, dayIndex, slots, nutritionTotal,
      validationResultDigest: digestHex(dayRow.validationResultDigest, 'day_validation_result') });
  }
  return { ...graphWithoutDays, days };
}

export async function sealAdaptiveNutritionGraphV2(value: AdaptiveNutritionGraphDraftV2): Promise<AdaptiveNutritionGraphV2> {
  const days = await Promise.all(value.days.map(async (day) => ({ ...day,
    slots: await Promise.all(day.slots.map(async (slot) => ({
      ...slot,
      canonicalSnapshotDigest: await sha256(slotDigestPayload(slot)),
    }))),
  })));
  return decodeAdaptiveNutritionGraphV2({ ...value, days });
}

export async function encodeAdaptiveNutritionGraphCanonicalV2(value: unknown): Promise<Uint8Array> {
  const graph = await decodeAdaptiveNutritionGraphV2(value);
  return new TextEncoder().encode(canonicalJson({
    encoding: adaptiveNutritionGraphEncodingV2,
    contract: adaptiveNutritionGraphContractV2,
    graph,
  }));
}

export async function adaptiveNutritionGraphSha256HexV2(value: unknown): Promise<string> {
  const bytes = await encodeAdaptiveNutritionGraphCanonicalV2(value);
  if (!globalThis.crypto?.subtle) throw new Error('sha256_unavailable');
  const result = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function inputGraphMismatch(input: TrustedGenerationInputV1, graph: AdaptiveNutritionGraphV2): string | null {
  const pairs: Array<[boolean, string]> = [
    [input.selection.selectionId !== graph.selectionId, 'SELECTION_REVISION_STALE'],
    [input.selection.planSelectionRevision !== graph.planSelectionRevision, 'SELECTION_REVISION_STALE'],
    [input.selection.proposedPlanRevision !== graph.planRevision, 'SELECTION_REVISION_STALE'],
    [input.weekStartLocal !== graph.weekStartLocal || input.timezone !== graph.timezone, 'WEEK_IDENTITY_STALE'],
    [input.goalNutritionTarget.goalRevision !== graph.goalRevision, 'GOAL_REVISION_STALE'],
    [input.goalNutritionTarget.targetPolicyRevision !== graph.targetPolicyRevision, 'TARGET_POLICY_STALE'],
    [canonicalJson(input.goalNutritionTarget) !== canonicalJson(graph.goalNutritionTarget), 'GOAL_TARGET_MISMATCH'],
    [input.preferenceRevision !== graph.preferenceRevision, 'PREFERENCE_REVISION_STALE'],
    [input.safetyRevision !== graph.safetyRevision, 'SAFETY_REVISION_STALE'],
    [input.candidateManifestRevision !== graph.catalogManifestRevision
      || input.candidateManifestDigest !== graph.candidateManifestDigest, 'CATALOG_MANIFEST_STALE'],
    [input.compositionPolicyRevision !== graph.compositionPolicyRevision, 'COMPOSITION_POLICY_STALE'],
    [input.validationPolicyRevision !== graph.validationPolicyRevision, 'VALIDATION_POLICY_STALE'],
    [input.optimizationPolicyRevision !== graph.optimizationPolicyRevision, 'OPTIMIZATION_POLICY_STALE'],
    [input.generationPolicyRevision !== graph.generationPolicyRevision, 'GENERATION_POLICY_STALE'],
  ];
  return pairs.find(([mismatch]) => mismatch)?.[1] ?? null;
}

export async function bindGeneratedWeekPlanV1(inputValue: unknown, graphValue: unknown): Promise<GeneratedWeekPlanV1> {
  const input = decodeTrustedGenerationInputV1(inputValue);
  const graph = await decodeAdaptiveNutritionGraphV2(graphValue);
  const mismatch = inputGraphMismatch(input, graph);
  if (mismatch) throw new Error(mismatch);
  const generationInputDigest = await trustedGenerationInputDigestV1(input);
  const graphDigest = await adaptiveNutritionGraphSha256HexV2(graph);
  const content = {
    contract: generatedWeekPlanContractV1,
    accountId: input.accountId,
    selectionId: input.selection.selectionId,
    planSelectionRevision: input.selection.planSelectionRevision,
    weekStartLocal: input.weekStartLocal,
    timezone: input.timezone,
    generationInputDigest,
    generationPolicyRevision: input.generationPolicyRevision,
    candidateManifestDigest: input.candidateManifestDigest,
    goalRevision: input.goalNutritionTarget.goalRevision,
    targetPolicyRevision: input.goalNutritionTarget.targetPolicyRevision,
    proposedPlanRevision: input.selection.proposedPlanRevision,
    graph,
    graphDigest,
    generatedAt: null,
    facts: [] as [],
  };
  return { ...content, deterministicContentDigest: await sha256(content) };
}

export async function finalizeGeneratedWeekPlanV1(inputValue: unknown, graphValue: unknown,
  recheck: GenerationAuthorityRecheckV1): Promise<GenerationFinalizeResultV1> {
  const input = decodeTrustedGenerationInputV1(inputValue);
  if (recheck.entitlement !== 'verified') return {
    status: 'GENERATION_ENTITLEMENT_DENIED',
    reason: recheck.entitlement === 'revoked' ? 'ENTITLEMENT_REVOKED' : 'ENTITLEMENT_EXPIRED',
  };
  const checks: Array<[boolean, string]> = [
    [recheck.accountId !== input.accountId, 'ACCOUNT_BINDING_STALE'],
    [recheck.selectionId !== input.selection.selectionId, 'SELECTION_REVISION_STALE'],
    [recheck.weekStartLocal !== input.weekStartLocal || recheck.timezone !== input.timezone,
    'WEEK_IDENTITY_STALE'],
    [recheck.planSelectionRevision !== input.selection.planSelectionRevision
      || recheck.expectedStatus !== 'pending_generation' || recheck.expectedPlanRevision !== null,
    'SELECTION_REVISION_STALE'],
    [recheck.goalRevision !== input.goalNutritionTarget.goalRevision, 'GOAL_REVISION_STALE'],
    [recheck.targetPolicyRevision !== input.goalNutritionTarget.targetPolicyRevision, 'TARGET_POLICY_STALE'],
    [recheck.preferenceRevision !== input.preferenceRevision, 'PREFERENCE_REVISION_STALE'],
    [recheck.safetyRevision !== input.safetyRevision, 'SAFETY_REVISION_STALE'],
    [recheck.entitlementEvidenceRevision !== input.entitlementEvidenceRevision, 'ENTITLEMENT_EVIDENCE_STALE'],
    [recheck.accountGateContract !== input.accountGateContract, 'ACCOUNT_GATE_CONTRACT_STALE'],
    [recheck.candidateManifestRevision !== input.candidateManifestRevision
      || recheck.candidateManifestDigest !== input.candidateManifestDigest, 'CATALOG_MANIFEST_STALE'],
    [recheck.compositionPolicyRevision !== input.compositionPolicyRevision, 'COMPOSITION_POLICY_STALE'],
    [recheck.validationPolicyRevision !== input.validationPolicyRevision, 'VALIDATION_POLICY_STALE'],
    [recheck.optimizationPolicyRevision !== input.optimizationPolicyRevision, 'OPTIMIZATION_POLICY_STALE'],
    [recheck.generationPolicyRevision !== input.generationPolicyRevision, 'GENERATION_POLICY_STALE'],
  ];
  const conflict = checks.find(([failed]) => failed);
  if (conflict) return { status: 'GENERATION_CONFLICT_STALE_INPUT', reason: conflict[1] };
  return { status: 'GENERATION_VALID', plan: await bindGeneratedWeekPlanV1(input, graphValue) };
}

export function resolveGenerationReplayV1(existing: null | {
  accountId: string;
  weekStartLocal: string;
  idempotencyKey: string;
  generationInputDigest: string;
  state: 'in_progress' | 'settled';
  resultDigest: string | null;
}, attempt: { accountId: string; weekStartLocal: string; idempotencyKey: string;
  generationInputDigest: string }): GenerationReplayResultV1 {
  if (!existing) return { status: 'NEW' };
  if (existing.accountId !== attempt.accountId || existing.weekStartLocal !== attempt.weekStartLocal
      || existing.idempotencyKey !== attempt.idempotencyKey
      || existing.generationInputDigest !== attempt.generationInputDigest) {
    return { status: 'GENERATION_CONFLICT_IDEMPOTENCY', reason: 'IDEMPOTENCY_PAYLOAD_MISMATCH' };
  }
  if (existing.state === 'in_progress') return { status: 'UNKNOWN' };
  if (existing.resultDigest === null) throw new Error('settled_generation_result_digest_required');
  return { status: 'EXACT_REPLAY', resultDigest: digestHex(existing.resultDigest, 'generation_result') };
}

export type GraphV2EligibilityRole = MealComponentRoleV1;
export type GraphV2EligibilityAnchor = MealAnchorKindV1;
