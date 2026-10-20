/** Design-only contract. Nothing in the current diary runtime imports this module. */
import type { NutritionReviewedRevisionV1 } from './foodReviewedEvidenceV1';

export type NutritionBasisV1 = NutritionReviewedRevisionV1['basis'] | 'PER_100_ML' | 'PER_PORTION' | 'UNKNOWN';
export type PortionUnitV1 = 'g' | 'ml' | 'l' | 'tbsp' | 'tsp' | 'piece' | 'portion';
export type NutritionIntegrityStatusV1 = 'CONFIRMED' | 'ESTIMATE' | 'UNKNOWN';
export type DecimalV1 = string;

export interface NutritionValuesV1 {
  calories: DecimalV1;
  protein: DecimalV1;
  fat: DecimalV1;
  carbs: DecimalV1;
  fiber: DecimalV1 | null;
}

export type BasisProvenanceV1 =
  | { kind: 'REVIEWED_REVISION'; nutritionRevisionId: string; nutritionDigest: string; approvalEventId: string }
  | { kind: 'USER_DECLARED'; ownerId: string }
  | { kind: 'LEGACY_CONTRACT'; contractRef: string }
  | { kind: 'UNKNOWN' };

export interface FoodNutritionProfileV1 {
  foodId: string;
  basis: NutritionBasisV1;
  provenance: BasisProvenanceV1;
  perBasis: NutritionValuesV1 | null;
}

/** A conversion applies to one food and one unit. The server must resolve its evidence, never trust a client claim. */
export interface FoodConversionV1 {
  foodId: string;
  unit: PortionUnitV1;
  kind: 'GRAMS_PER_ML' | 'GRAMS_PER_UNIT' | 'ML_PER_UNIT';
  value: DecimalV1;
  source: 'REVIEWED_EVIDENCE' | 'USER_DECLARED';
  evidenceRef: string;
}

export interface PortionRequestV1 {
  foodId: string;
  amount: DecimalV1;
  unit: PortionUnitV1;
}

export type PortionAssessmentV1 =
  | { status: 'UNKNOWN'; reason: 'INVALID_INPUT' | 'BASIS_UNKNOWN' | 'CONVERSION_UNAVAILABLE'; totals: null; normalizedGrams: null }
  | { status: 'ESTIMATE' | 'CONFIRMED'; reason: null; totals: NutritionValuesV1; normalizedGrams: DecimalV1 | null;
      basis: Exclude<NutritionBasisV1, 'UNKNOWN'>; provenance: BasisProvenanceV1; conversionRef: string | null;
      legacyGramWriterCompatible: boolean };

const decimalPattern = /^(?:0|[1-9][0-9]{0,8})(?:\.([0-9]{1,3}))?$/;
const validUnits: readonly PortionUnitV1[] = ['g', 'ml', 'l', 'tbsp', 'tsp', 'piece', 'portion'];
const validConversionKinds: readonly FoodConversionV1['kind'][] = ['GRAMS_PER_ML', 'GRAMS_PER_UNIT', 'ML_PER_UNIT'];
const validConversionSources: readonly FoodConversionV1['source'][] = ['REVIEWED_EVIDENCE', 'USER_DECLARED'];
const thousand = 1000n;
const hundred = 100000n;

function minor(value: string): bigint | null {
  if (typeof value !== 'string') return null;
  const match = decimalPattern.exec(value);
  if (!match) return null;
  const [integer, fraction = ''] = value.split('.');
  return BigInt(integer) * thousand + BigInt(fraction.padEnd(3, '0'));
}

function decimal(value: bigint): string {
  return `${value / thousand}.${String(value % thousand).padStart(3, '0')}`;
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

function validNutrition(values: NutritionValuesV1 | null): values is NutritionValuesV1 {
  if (values === null || typeof values !== 'object') return false;
  // Calories, protein, fat and carbs are required. Only fiber may be unknown.
  // Missing required nutrition must never flow into arithmetic as zero or null.
  const required = [values.calories, values.protein, values.fat, values.carbs];
  return required.every((value) => minor(value) !== null) &&
    (values.fiber === null || minor(values.fiber) !== null);
}

function validProvenance(profile: FoodNutritionProfileV1): boolean {
  const source = profile.provenance;
  if (!source || typeof source !== 'object') return false;
  if (source.kind === 'REVIEWED_REVISION') {
    // Reviewed evidence v1 currently has only the edible per-100-g basis.
    return profile.basis === 'PER_100_G_EDIBLE' && Boolean(source.nutritionRevisionId && source.nutritionDigest && source.approvalEventId);
  }
  if (source.kind === 'USER_DECLARED') return Boolean(source.ownerId);
  if (source.kind === 'LEGACY_CONTRACT') return profile.basis === 'PER_100_G_EDIBLE' && Boolean(source.contractRef);
  return profile.basis === 'UNKNOWN';
}

function findConversion(
  conversions: readonly FoodConversionV1[], foodId: string, unit: PortionUnitV1, kind: FoodConversionV1['kind']
): FoodConversionV1 | null {
  const matches = conversions.filter((row) => row.foodId === foodId && row.unit === unit && row.kind === kind);
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (!validUnits.includes(match.unit) || !validConversionKinds.includes(match.kind) ||
      !validConversionSources.includes(match.source) ||
      typeof match.evidenceRef !== 'string' || !match.evidenceRef.trim() ||
      minor(match.value) === null || minor(match.value) === 0n) return null;
  return match;
}

/** Pure arithmetic and classification. Only a trusted server resolver may supply REVIEWED_REVISION/evidence. */
export function assessPortionV1(
  request: PortionRequestV1, profile: FoodNutritionProfileV1, conversions: readonly FoodConversionV1[] = []
): PortionAssessmentV1 {
  const amount = minor(request.amount);
  if (!request.foodId || request.foodId !== profile.foodId ||
      !validUnits.includes(request.unit) || amount === null || amount <= 0n ||
      !validProvenance(profile)) {
    return { status: 'UNKNOWN', reason: 'INVALID_INPUT', totals: null, normalizedGrams: null };
  }
  if (profile.basis === 'UNKNOWN') {
    return { status: 'UNKNOWN', reason: 'BASIS_UNKNOWN', totals: null, normalizedGrams: null };
  }
  if (!validNutrition(profile.perBasis)) {
    return { status: 'UNKNOWN', reason: 'INVALID_INPUT', totals: null, normalizedGrams: null };
  }

  const volumeMl = request.unit === 'ml' ? amount : request.unit === 'l' ? amount * thousand : null;
  let basisAmount: bigint | null = null;
  let grams: bigint | null = null;
  let used: FoodConversionV1 | null = null;
  const conversion = (unit: PortionUnitV1, kind: FoodConversionV1['kind']) =>
    findConversion(conversions, profile.foodId, unit, kind);

  if (profile.basis === 'PER_100_G_EDIBLE') {
    if (request.unit === 'g') {
      grams = amount;
    } else if (volumeMl !== null) {
      used = conversion('ml', 'GRAMS_PER_ML');
      if (used) grams = divideRounded(volumeMl * minor(used.value)!, thousand);
    } else {
      used = conversion(request.unit, 'GRAMS_PER_UNIT');
      if (used) grams = divideRounded(amount * minor(used.value)!, thousand);
    }
    basisAmount = grams;
  } else if (profile.basis === 'PER_100_ML') {
    if (volumeMl !== null) {
      basisAmount = volumeMl;
    } else if (request.unit === 'g') {
      used = conversion('ml', 'GRAMS_PER_ML');
      if (used) basisAmount = divideRounded(amount * thousand, minor(used.value)!);
    } else {
      used = conversion(request.unit, 'ML_PER_UNIT');
      if (used) basisAmount = divideRounded(amount * minor(used.value)!, thousand);
    }
    const density = conversion('ml', 'GRAMS_PER_ML');
    if (basisAmount !== null && density) grams = divideRounded(basisAmount * minor(density.value)!, thousand);
    if (request.unit === 'g') grams = amount;
  } else if (request.unit === 'portion') {
    basisAmount = amount;
    const portionWeight = conversion('portion', 'GRAMS_PER_UNIT');
    if (portionWeight) grams = divideRounded(amount * minor(portionWeight.value)!, thousand);
  }

  if (basisAmount === null || basisAmount <= 0n) {
    return { status: 'UNKNOWN', reason: 'CONVERSION_UNAVAILABLE', totals: null, normalizedGrams: null };
  }
  // A required gram conversion must not turn a positive quantity into zero mass.
  // For volume-/portion-based nutrition, normalized grams are only optional metadata.
  if (grams === 0n) {
    if (profile.basis === 'PER_100_G_EDIBLE') {
      return { status: 'UNKNOWN', reason: 'INVALID_INPUT', totals: null, normalizedGrams: null };
    }
    grams = null;
  }

  const denominator = profile.basis === 'PER_PORTION' ? thousand : hundred;
  const nutrition = profile.perBasis;
  const scaled = [nutrition.calories, nutrition.protein, nutrition.fat, nutrition.carbs, nutrition.fiber]
    .map((value) => value === null ? null : divideRounded(minor(value)! * basisAmount, denominator));
  // Existing diary numeric(8,2) fields and weight cannot represent larger values.
  const currentColumnMaxMinor = 999999990n;
  if (scaled.some((value) => value !== null && value > currentColumnMaxMinor) ||
      (grams !== null && grams > currentColumnMaxMinor)) {
    return { status: 'UNKNOWN', reason: 'INVALID_INPUT', totals: null, normalizedGrams: null };
  }
  const confirmed = profile.provenance.kind === 'REVIEWED_REVISION' && (!used || used.source === 'REVIEWED_EVIDENCE');
  return {
    status: confirmed ? 'CONFIRMED' : 'ESTIMATE',
    reason: null,
    totals: {
      calories: decimal(scaled[0]!), protein: decimal(scaled[1]!), fat: decimal(scaled[2]!),
      carbs: decimal(scaled[3]!), fiber: scaled[4] === null ? null : decimal(scaled[4]),
    },
    normalizedGrams: grams === null ? null : decimal(grams),
    basis: profile.basis,
    provenance: profile.provenance,
    conversionRef: used?.evidenceRef ?? null,
    // Legacy diary weight is numeric(8,2); thousandth-gram values cannot be represented unchanged.
    legacyGramWriterCompatible: profile.basis === 'PER_100_G_EDIBLE' &&
      grams !== null && grams % 10n === 0n,
  };
}

/** Null is how pre-V1 rows are read: historical numbers remain untouched, certainty is UNKNOWN. */
export function readStoredIntegrityStatusV1(
  contractVersion: unknown, storedStatus: unknown
): NutritionIntegrityStatusV1 {
  if (contractVersion !== 1 || (storedStatus !== 'CONFIRMED' && storedStatus !== 'ESTIMATE')) return 'UNKNOWN';
  return storedStatus;
}
