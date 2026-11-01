import { createGenerationMenuCandidatePreparerV1, type GenerationMenuCandidateSourcePortV1,
  type GenerationMenuCandidateSlotV1 } from './generationMenuCandidatesV1';
import { generationWeekSearchContractV1, searchGenerationWeekRawV1,
  type GenerationWeekSearchResultV1 } from './generationWeekSearchV1';
import {optimizeGenerationWeekRawV1,type GenerationWeekOptimizationConfigV1} from './generationWeekOptimizationV1';
import { decodeTrustedGenerationInputV1 } from '../utils/adaptiveNutritionGraphV2';
import { decodeAdaptiveNutritionCandidateManifestV2, decodeNutritionPreferenceSnapshotV1,
  decodeNutritionSafetySnapshotV1 } from '../utils/adaptiveNutritionAuthoritiesV1';
import { decodeTrustedValidationEvidenceV1 } from '../utils/trustedValidationEvidenceV1';
import { decodeTrustedValidationPoliciesRawV2 } from '../utils/trustedValidationPoliciesV1';
import { decodePreparedMealWarningEvidenceRawV2, type MealWarningEvidenceV1 } from '../utils/trustedMealWarningEvidenceV1';
import { assertRawJsonWithoutDuplicateKeysV1,adaptiveNutritionSha256HexV1,canonicalJsonV1 } from '../utils/adaptiveNutritionWireV1';
import { dayValidatorInputContractV1, mealValidatorInputContractV1, mealCandidateEvidenceContractV2,
  weekValidatorInputContractV2, validateDaySnapshotRawV2 } from '../utils/adaptiveNutritionMealBalanceV1';

/** Read-only independently admitted warning source. Null never means all signals are false. */
export interface GenerationPreparationWarningPortV1 {
  loadMealWarningRaw(requestOperationId: string, slotId: string, mealSnapshotDigest: string,
    validationEvidenceDigest: string, validationPoliciesDigest: string): Promise<string | null>;
}
export interface GenerationDayDiagnosticV1 {
  date: string;
  evaluated: number;
  invalid: number;
  blocked: number;
  feasible: number;
  missingWarningOptions: number;
}
type FeasibleWeek = Extract<GenerationWeekSearchResultV1, { status: 'FEASIBLE_PROPOSAL' }>;
export type GenerationDayOptionsResultV1 =
  | { status: 'FEASIBLE_PROPOSAL'; requestOperationId: string; week: FeasibleWeek;
      selectedWarningEntriesRaw: string[]; days: GenerationDayDiagnosticV1[] }
  | { status: 'BLOCKED_SOURCE_MISSING' | 'RESOURCE_LIMIT_REACHED' | 'INCOMPLETE_MEAL_POOL'
      | 'DAY_SEARCH_LIMIT_REACHED' | 'NO_FEASIBLE_DAY' | 'BLOCKED_WARNING_EVIDENCE'
      | 'BLOCKED_MISSING_EVIDENCE' | 'NO_FEASIBLE_WEEK_IN_POOL' | 'SEARCH_LIMIT_REACHED' | 'BLOCKED_OPTIMIZATION_METRICS';
      requestOperationId: string; days: GenerationDayDiagnosticV1[] };
type Option = GenerationMenuCandidateSlotV1['meals'][number];
type WarnedOption = { option: Option; warning: MealWarningEvidenceV1; warningRaw: string };
interface SelectionPoolV1 {
  contract:string;requestOperationId:string;generationInputDigest:string;slotId:string;candidateSetDigest:string;
  candidates:{mealSnapshotDigest:string;sourceKind:Option['sourceKind'];isolatedCompositionScore:string}[];
  admittedWarnings:{mealSnapshotDigest:string;warningEvidenceDigest:string}[];
}
export const generationSelectionReceiptContractV1='potok-generation-selection-receipt-v1';
export const generationSelectionReceiptContractV2='potok-generation-selection-receipt-v2';
export type GenerationSelectionResultV1=Exclude<GenerationDayOptionsResultV1,{status:'FEASIBLE_PROPOSAL'}>
  | (Extract<GenerationDayOptionsResultV1,{status:'FEASIBLE_PROPOSAL'}>&{selectionReceiptRaw:string});
type InternalResult=GenerationDayOptionsResultV1&{selectionReceiptRaw?:string};
async function receiptHash(value:unknown):Promise<string>{
  return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1(value,'SAFE_INTEGER')));
}

function parse(raw: unknown): unknown {
  if (typeof raw !== 'string') throw new Error('DAY_PREPARATION_RAW_REQUIRED');
  if (raw.length > 8_000_000) throw new Error('DAY_PREPARATION_RAW_TOO_LARGE');
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return JSON.parse(raw);
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).length !== keys.length || !keys.every(k => Object.prototype.hasOwnProperty.call(value, k))) {
    throw new Error('INVALID_DAY_PREPARATION_FIELDS');
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
function limits(raw: string) {
  const row = record(parse(raw), ['maxDayEvaluations', 'maxWeekEvaluations']);
  for (const v of Object.values(row)) if (!Number.isSafeInteger(v) || (v as number) < 1 || (v as number) > 1024) {
    throw new Error('INVALID_DAY_PREPARATION_BUDGET');
  }
  return { maxDayEvaluations: row.maxDayEvaluations as number, maxWeekEvaluations: row.maxWeekEvaluations as number };
}

/** Inactive catalog -> meal options -> validated day alternatives -> bounded weekly proposal. */
function createGenerationDayOptionsInternalV1(sourcePort: GenerationMenuCandidateSourcePortV1,
  warningPort: GenerationPreparationWarningPortV1,captureSelection:boolean,optimization?:GenerationWeekOptimizationConfigV1) {
  return Object.freeze({ async generate(requestOperationId: string,
    limitsRaw = '{"maxDayEvaluations":1024,"maxWeekEvaluations":1024}'): Promise<InternalResult> {
    const budget = limits(limitsRaw);
    if (typeof requestOperationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestOperationId)) {
      throw new Error('INVALID_DAY_PREPARATION_REQUEST');
    }
    // One preparation snapshot per call. No second source read, cross-call cache or retry.
    const raw = await sourcePort.loadPreparationRaw(requestOperationId);
    const prepared = await createGenerationMenuCandidatePreparerV1({ async loadPreparationRaw() { return raw; } }).prepare(requestOperationId);
    const days: GenerationDayDiagnosticV1[] = [];
    const stop = (status: Exclude<GenerationDayOptionsResultV1['status'], 'FEASIBLE_PROPOSAL'>): GenerationDayOptionsResultV1 =>
      freeze({ status, requestOperationId, days });
    if (!('slots' in prepared)) return stop(prepared.status);
    if (prepared.status === 'INCOMPLETE') return stop('INCOMPLETE_MEAL_POOL');
    // Source has already crossed the strict preparation boundary. Reuse its owned raw snapshots.
    const source = parse(raw) as { contextRaw: string; policiesRaw: string };
    const context = parse(source.contextRaw) as { trustedGenerationInputRaw: string; candidateManifestRaw: string;
      preferenceSnapshotRaw: string; safetySnapshotRaw: string; trustedValidationEvidenceRaw: string };
    const owned = { input: parse(context.trustedGenerationInputRaw), manifest: parse(context.candidateManifestRaw),
      preference: parse(context.preferenceSnapshotRaw), safety: parse(context.safetySnapshotRaw) };
    const input = decodeTrustedGenerationInputV1(owned.input);
    const manifest = await decodeAdaptiveNutritionCandidateManifestV2(owned.manifest);
    const preference = await decodeNutritionPreferenceSnapshotV1(owned.preference);
    const safety = await decodeNutritionSafetySnapshotV1(owned.safety);
    const evidence = await decodeTrustedValidationEvidenceV1(parse(context.trustedValidationEvidenceRaw), owned);
    const policies = await decodeTrustedValidationPoliciesRawV2(source.policiesRaw, source.contextRaw);
    const slotPools = new Map(prepared.slots.map(s => [s.slotId, s.meals]));
    for (const day of evidence.distributionPolicy.days) {
      const count = day.requiredSlots.reduce((n, s) => n * slotPools.get(s.slotId)!.length, 1);
      if (!Number.isSafeInteger(count) || count > budget.maxDayEvaluations) return stop('DAY_SEARCH_LIMIT_REACHED');
    }
    const warnings = new Map<string, WarnedOption>();
    const warnedPools = new Map<string, WarnedOption[]>();
    const missingBySlot = new Map<string, number>();
    for (const slot of prepared.slots) {
      const options: WarnedOption[] = [];
      for (const option of slot.meals) {
        const warningRaw = await warningPort.loadMealWarningRaw(requestOperationId, slot.slotId, option.meal.digest,
          evidence.digest, policies.digest);
        if (warningRaw === null) { missingBySlot.set(slot.slotId, (missingBySlot.get(slot.slotId) ?? 0) + 1); continue; }
        parse(warningRaw); // Size, primitive raw and duplicate-key admission before decoding.
        const warning = await decodePreparedMealWarningEvidenceRawV2(warningRaw, source.policiesRaw, source.contextRaw, JSON.stringify(option.meal));
        const warned = { option, warning, warningRaw };
        options.push(warned); warnings.set(`${slot.slotId}:${option.meal.digest}`, warned);
      }
      warnedPools.set(slot.slotId, options);
    }
    const projectDay = (day: typeof evidence.distributionPolicy.days[number], chosen: WarnedOption[]) => ({
      contract: dayValidatorInputContractV1, date: day.date, timezone: input.timezone,
      goalRevision: input.goalNutritionTarget.goalRevision, targetPolicyRevision: input.goalNutritionTarget.targetPolicyRevision,
      planRevision: input.selection.proposedPlanRevision, compositionPolicyRevision: input.compositionPolicyRevision,
      balancePolicy: policies.balance.policy, requiredSlots: day.requiredSlots,
      goalTarget: input.goalNutritionTarget, distributionBounds: day.distributionBounds,
      meals: day.requiredSlots.map((slot, index) => {
        const { option, warning } = chosen[index];
        return { ...slot, date: day.date, validationInput: { contract: mealValidatorInputContractV1,
          sourceKind: option.sourceKind, meal: option.meal,
          compositionPolicy: { ...policies.composition.policy, maxComponents: policies.balance.policy.maxComponents,
            patterns: policies.composition.policy.patterns.filter(p => p.roles.length <= policies.balance.policy.maxComponents) },
          balancePolicy: policies.balance.policy,
          expected: { goalRevision: input.goalNutritionTarget.goalRevision, compositionPolicyRevision: input.compositionPolicyRevision },
          userConstraints: { revisionId: preference.revisionId, excludedAllergens: safety.declaredAllergenCodes,
            excludedIngredientFamilies: [], requiredDietaryTags: preference.hard.dietaryPattern === 'UNSPECIFIED' ? [] : [preference.hard.dietaryPattern.toLowerCase()],
            forbiddenDietaryTags: safety.dietaryHardExclusionCodes },
          componentEvidence: option.meal.components.map(component => {
            const e = evidence.components.find(c => c.slotId === slot.slotId && c.mealComponentId === component.mealComponentId)!;
            const entry = manifest.entries.find(c => c.recipeId === e.recipeId && c.recipeRevisionId === e.recipeRevisionId
              && c.portionRevisionId === e.portionRevisionId && c.eligibilityRevisionId === e.eligibilityRevisionId)!;
            return { contract: mealCandidateEvidenceContractV2, mealComponentId: e.mealComponentId, recipeRevision: entry.recipeRevisionId,
              recipeId: entry.recipeId, portionRevision: entry.portionRevisionId, eligibilityRevision: entry.eligibilityRevisionId,
              manifestRevision: manifest.manifestRevision, manifestDigest: manifest.digest, specialty: entry.specialty, expensive: entry.expensive,
              publicationStatus: entry.publicationStatus, publicationRevision: e.publicationRevision,
              canonicalStatus: 'READY', canonicalEvidenceRevision: e.canonicalEvidenceRevision,
              nutritionStatus: 'COMPLETE', nutritionEvidenceRevision: e.nutritionEvidenceRevision,
              allergenStatus: 'REVIEWED', allergenEvidenceRevision: e.allergenEvidenceRevision,
              dietaryStatus: 'REVIEWED', dietaryEvidenceRevision: e.dietaryEvidenceRevision,
              portionPolicyRevision: e.portionPolicyRevision, accessibility: entry.accessibility,
              allergens: entry.allergenCodes, dietaryTags: entry.dietaryCodes, ingredientFamilies: e.ingredientFamilies,
              dominantIngredientFamily: entry.dominantIngredientFamily, repeatFamily: entry.repeatFamily,
              assignedServingsMinimum: entry.portionRules.assignedServingsMinimum, assignedServingsMaximum: entry.portionRules.assignedServingsMaximum,
              proteinSource: e.proteinSource, produceSource: e.produceSource };
          }),
          nutritionBounds: day.nutritionBounds[index].bounds,
          requirements: { proteinSourceRequired: day.requirements[index].proteinSourceRequired, produceRequired: day.requirements[index].produceRequired },
          warningSignals: warning.signals } };
      }),
    });
    const dayOptions: Array<ReturnType<typeof projectDay>[]> = [];
    for (const day of evidence.distributionPolicy.days) {
      const pools = day.requiredSlots.map(s => warnedPools.get(s.slotId)!);
      const count = pools.reduce((n, pool) => n * pool.length, 1);
      const diagnostic = { date: day.date, evaluated: 0, invalid: 0, blocked: 0, feasible: 0,
        missingWarningOptions: day.requiredSlots.reduce((n, s) => n + (missingBySlot.get(s.slotId) ?? 0), 0) };
      days.push(diagnostic);
      const options: ReturnType<typeof projectDay>[] = [];
      const indexes = pools.map(() => 0);
      for (let n = 0; n < count; n++) {
        const draft = projectDay(day, pools.map((pool, i) => pool[indexes[i]]));
        const dayRaw = JSON.stringify(draft);
        if (dayRaw.length > 8_000_000) return stop('RESOURCE_LIMIT_REACHED');
        const validation = await validateDaySnapshotRawV2(dayRaw, context.candidateManifestRaw);
        diagnostic.evaluated++;
        if (validation.status === 'VALID' || validation.status === 'VALID_WITH_WARNINGS') {
          options.push(draft); diagnostic.feasible++;
          if (options.length > 16) return stop('RESOURCE_LIMIT_REACHED');
        } else if (validation.status === 'BLOCKED_MISSING_EVIDENCE') diagnostic.blocked++;
        else diagnostic.invalid++;
        for (let i = pools.length - 1; i >= 0; i--) {
          indexes[i]++;
          if (indexes[i] < pools[i].length) break;
          indexes[i] = 0;
        }
      }
      if (!options.length) return stop(diagnostic.missingWarningOptions ? 'BLOCKED_WARNING_EVIDENCE'
        : diagnostic.blocked ? 'BLOCKED_MISSING_EVIDENCE' : 'NO_FEASIBLE_DAY');
      dayOptions.push(options);
    }
    const fallback = evidence.ordinaryFallback;
    const searchRaw = JSON.stringify({ contract: generationWeekSearchContractV1,
      weekHeader: { contract: weekValidatorInputContractV2, weekAnchor: input.weekStartLocal, timezone: input.timezone,
        goalRevision: input.goalNutritionTarget.goalRevision, targetPolicyRevision: input.goalNutritionTarget.targetPolicyRevision,
        planRevision: input.selection.proposedPlanRevision, compositionPolicyRevision: input.compositionPolicyRevision,
        balancePolicy: policies.balance.policy, ordinaryFallbackProof: { candidatePoolDigest: fallback.candidatePoolDigest,
          status: fallback.status, ordinaryWeekDigest: fallback.ordinaryWeekDigest } }, dayOptions,
      maxEvaluations: budget.maxWeekEvaluations });
    if (searchRaw.length > 8_000_000) return stop('RESOURCE_LIMIT_REACHED');
    const week = optimization
      ?await optimizeGenerationWeekRawV1(searchRaw,context.candidateManifestRaw,optimization.policyRaw,context.trustedGenerationInputRaw,optimization.metrics)
      :await searchGenerationWeekRawV1(searchRaw, context.candidateManifestRaw);
    if (week.status !== 'FEASIBLE_PROPOSAL') {
      return stop(week.status === 'NO_FEASIBLE_WEEK_IN_POOL' && days.some(d => d.missingWarningOptions) ? 'BLOCKED_WARNING_EVIDENCE' : week.status);
    }
    const selectedWarningEntriesRaw = dayOptions.flatMap((pool, day) => pool[week.optionIndexes[day]].meals.map(meal => {
      const key = `${meal.slotId}:${meal.validationInput.meal.digest}`;
      return { slotId: meal.slotId, raw: warnings.get(key)!.warningRaw };
    })).sort((a, b) => a.slotId < b.slotId ? -1 : a.slotId > b.slotId ? 1 : 0).map(w => w.raw);
    const result={status:'FEASIBLE_PROPOSAL' as const,requestOperationId,week,selectedWarningEntriesRaw,days};
    if(!captureSelection)return freeze(result);
    // Capture the actual owned pools and actual search result in this invocation, never a
    // second source read/replayed generator or a producer-supplied claim of optimality.
    const pools:SelectionPoolV1[]=[];
    for(const slot of prepared.slots){
      const content={contract:'potok-generation-slot-candidate-set-v1',requestOperationId,
        generationInputDigest:prepared.generationInputDigest,slotId:slot.slotId,
        candidates:slot.meals.map(option=>({mealSnapshotDigest:option.meal.digest,sourceKind:option.sourceKind,
          isolatedCompositionScore:option.isolatedCompositionScore})),
        admittedWarnings:warnedPools.get(slot.slotId)!.map(option=>({mealSnapshotDigest:option.option.meal.digest,
          warningEvidenceDigest:option.warning.digest}))};
      pools.push({...content,candidateSetDigest:await receiptHash(content)});
    }
    const selectedSlots=dayOptions.flatMap((pool,day)=>pool[week.optionIndexes[day]].meals.map(meal=>({
      slotId:meal.slotId,sourceKind:meal.validationInput.sourceKind,
      selectedCandidateDigest:meal.validationInput.meal.digest,
      candidateSetDigest:pools.find(p=>p.slotId===meal.slotId)!.candidateSetDigest})));
    const optimized='optimizationResultDigest' in week?week:null;
    const receiptContract=optimized?generationSelectionReceiptContractV2:generationSelectionReceiptContractV1;
    const content={contract:receiptContract,requestOperationId,
      generationInputDigest:prepared.generationInputDigest,candidateManifestDigest:manifest.digest,
      generationPolicyRevision:input.generationPolicyRevision,validationEvidenceDigest:evidence.digest,
      validationPoliciesDigest:policies.digest,scope:optimized?optimized.scope:'BOUNDED_FIRST_FEASIBLE',
      warningCoverage:[...missingBySlot.values()].some(n=>n>0)?'PARTIAL':'COMPLETE',
      budget,searchInputRawSha256:await adaptiveNutritionSha256HexV1(new TextEncoder().encode(searchRaw)),
      weekRawSha256:await adaptiveNutritionSha256HexV1(new TextEncoder().encode(week.weekRaw)),
      evaluated:week.evaluated,totalCombinations:week.totalCombinations,optionIndexes:week.optionIndexes,
      weekValidationResultDigest:week.validation.subjectDigest,pools,selectedSlots,
      ...(optimized?{weekOptimizationResultDigest:optimized.optimizationResultDigest,weekOptimizationReceiptRaw:optimized.optimizationReceiptRaw}:{})};
    const receipt={...content,digest:await receiptHash({contract:receiptContract,
      encoding:optimized?'potok-generation-selection-receipt-canonical-json-v2':'potok-generation-selection-receipt-canonical-json-v1',receipt:content})};
    const selectionReceiptRaw=canonicalJsonV1(receipt,'SAFE_INTEGER');
    if(selectionReceiptRaw.length>8_000_000)return stop('RESOURCE_LIMIT_REACHED');
    return freeze({...result,selectionReceiptRaw});
  } });
}

/** Existing V1 API keeps its exact runtime output, without a selection receipt. */
export function createGenerationDayOptionsV1(source:GenerationMenuCandidateSourcePortV1,warnings:GenerationPreparationWarningPortV1):{
  readonly generate:(requestOperationId:string,limitsRaw?:string)=>Promise<GenerationDayOptionsResultV1>;
}{return createGenerationDayOptionsInternalV1(source,warnings,false);}

/** Actual bounded-search provenance, not a weighted/global optimization certificate. */
export function createGenerationSelectionV1(source:GenerationMenuCandidateSourcePortV1,warnings:GenerationPreparationWarningPortV1){
  const engine=createGenerationDayOptionsInternalV1(source,warnings,true);
  return Object.freeze({async generate(requestOperationId:string,limitsRaw?:string):Promise<GenerationSelectionResultV1>{
    const result=await engine.generate(requestOperationId,limitsRaw);
    if(result.status!=='FEASIBLE_PROPOSAL')return result;
    if(typeof result.selectionReceiptRaw!=='string')throw Error('GENERATION_SELECTION_RECEIPT_MISSING');
    return freeze({...result,selectionReceiptRaw:result.selectionReceiptRaw});
  }});
}

/** Explicit opt-in only. No fallback to first-feasible selection when metrics are missing. */
export function createOptimizedGenerationSelectionV1(source:GenerationMenuCandidateSourcePortV1,
  warnings:GenerationPreparationWarningPortV1,optimization:GenerationWeekOptimizationConfigV1){
  if(!optimization||typeof optimization.policyRaw!=='string'||!optimization.metrics
    ||typeof optimization.metrics.assessWeekRaw!=='function')throw Error('INVALID_WEEK_OPTIMIZATION_CONFIG');
  const owned=Object.freeze({policyRaw:optimization.policyRaw,metrics:optimization.metrics});
  const engine=createGenerationDayOptionsInternalV1(source,warnings,true,owned);
  return Object.freeze({async generate(requestOperationId:string,limitsRaw?:string):Promise<GenerationSelectionResultV1>{
    const result=await engine.generate(requestOperationId,limitsRaw);
    if(result.status!=='FEASIBLE_PROPOSAL')return result;
    if(typeof result.selectionReceiptRaw!=='string')throw Error('GENERATION_SELECTION_RECEIPT_MISSING');
    return freeze({...result,selectionReceiptRaw:result.selectionReceiptRaw});
  }});
}
