import { assertRawJsonWithoutDuplicateKeysV1 } from '../utils/adaptiveNutritionWireV1';
import { validateWeekSnapshotRawV2, weekValidatorInputContractV2,
  type ValidatorResultV1 } from '../utils/adaptiveNutritionMealBalanceV1';

export const generationWeekSearchContractV1 = 'potok-generation-week-search-v1' as const;

export type GenerationWeekSearchResultV1 = Readonly<{
  status: 'FEASIBLE_PROPOSAL';
  evaluated: number;
  totalCombinations: number;
  optionIndexes: readonly number[];
  weekRaw: string;
  validation: ValidatorResultV1;
}> | Readonly<{
  status: 'NO_FEASIBLE_WEEK_IN_POOL' | 'SEARCH_LIMIT_REACHED' | 'BLOCKED_MISSING_EVIDENCE';
  evaluated: number;
  totalCombinations: number;
}>;

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).length !== keys.length
      || !keys.every(key => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error(`invalid_${label}`);
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

/** Inactive proposal search. A feasible domain week is never a trusted acceptance receipt. */
export async function searchGenerationWeekRawV1(
  inputRaw: string, pinnedManifestRaw: string,
): Promise<GenerationWeekSearchResultV1> {
  if (typeof inputRaw !== 'string' || typeof pinnedManifestRaw !== 'string') {
    throw new Error('week_search_raw_strings_required');
  }
  if (inputRaw.length > 8_000_000 || pinnedManifestRaw.length > 8_000_000) {
    throw new Error('week_search_input_too_large');
  }
  assertRawJsonWithoutDuplicateKeysV1(inputRaw);
  assertRawJsonWithoutDuplicateKeysV1(pinnedManifestRaw);
  // Own both snapshots before the first await; callers cannot mutate the pool mid-search.
  const input = record(JSON.parse(inputRaw), ['contract', 'weekHeader', 'dayOptions', 'maxEvaluations'], 'week_search_input');
  if (input.contract !== generationWeekSearchContractV1) throw new Error('unsupported_week_search_contract');
  const header = record(input.weekHeader, ['contract', 'weekAnchor', 'timezone', 'goalRevision',
    'targetPolicyRevision', 'planRevision', 'compositionPolicyRevision', 'balancePolicy', 'ordinaryFallbackProof'], 'week_search_header');
  if (header.contract !== weekValidatorInputContractV2) throw new Error('week_search_requires_v2');
  if (!Number.isSafeInteger(input.maxEvaluations) || (input.maxEvaluations as number) < 1
      || (input.maxEvaluations as number) > 1024) throw new Error('invalid_week_search_budget');
  if (!Array.isArray(input.dayOptions) || input.dayOptions.length !== 7) throw new Error('week_search_requires_seven_days');
  const options = input.dayOptions.map((day: unknown) => {
    if (!Array.isArray(day) || day.length < 1 || day.length > 16) throw new Error('invalid_week_search_day_options');
    return day;
  });
  const totalCombinations = options.reduce((total, day) => total * day.length, 1);
  const indexes = Array<number>(7).fill(0);
  const limit = Math.min(input.maxEvaluations as number, totalCombinations);
  let missingEvidence = false;
  for (let evaluated = 1; evaluated <= limit; evaluated++) {
    const weekRaw = JSON.stringify({ ...header, days: options.map((day, index) => day[indexes[index]]) });
    // The real V2 validator checks every visited full week, including cross-day repeat limits.
    // Structural/provenance decoding errors abort; they are never converted into infeasibility.
    const validation = await validateWeekSnapshotRawV2(weekRaw, pinnedManifestRaw);
    missingEvidence ||= validation.status === 'BLOCKED_MISSING_EVIDENCE';
    if (validation.status === 'VALID' || validation.status === 'VALID_WITH_WARNINGS') {
      return freeze({ status: 'FEASIBLE_PROPOSAL', evaluated, totalCombinations,
        optionIndexes: [...indexes], weekRaw, validation });
    }
    // Ordered Cartesian traversal: last day varies fastest, with no random IDs or policy changes.
    for (let day = 6; day >= 0; day--) {
      indexes[day]++;
      if (indexes[day] < options[day].length) break;
      indexes[day] = 0;
    }
  }
  return Object.freeze({ status: limit < totalCombinations ? 'SEARCH_LIMIT_REACHED'
    : missingEvidence ? 'BLOCKED_MISSING_EVIDENCE' : 'NO_FEASIBLE_WEEK_IN_POOL',
    evaluated: limit, totalCombinations });
}
