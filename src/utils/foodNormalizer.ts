export interface NutritionInput {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
}

export interface NutritionValidation {
  suspicious: boolean;
}

export type FoodMacroField = 'calories' | 'protein' | 'fat' | 'carbs';
export type InvalidFoodMacroReason =
  | 'calories_missing'
  | 'protein_missing'
  | 'fat_missing'
  | 'carbs_missing'
  | 'calories_invalid'
  | 'protein_invalid'
  | 'fat_invalid'
  | 'carbs_invalid'
  | 'calories_negative'
  | 'protein_negative'
  | 'fat_negative'
  | 'carbs_negative'
  | 'all_zero_macros';

const MAX_CALORIES_PER_100G = 900;
const MAX_MACRO_PER_100G = 100;
const MAX_FIBER_PER_100G = 100;
const MACRO_FIELDS: FoodMacroField[] = ['calories', 'protein', 'fat', 'carbs'];

export const normalizeFoodText = (value?: string | null): string => {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const buildNormalizedName = (name?: string | null): string => {
  return normalizeFoodText(name);
};

export const buildNormalizedBrand = (brand?: string | null): string => {
  return normalizeFoodText(brand ?? '');
};

export const validateNutrition = (input: NutritionInput): NutritionValidation => {
  const values = [input.calories, input.protein, input.fat, input.carbs];
  const invalid = values.some((value) => !Number.isFinite(value) || value < 0);
  if (invalid) {
    throw new Error('[foodNormalizer] Invalid nutrition values');
  }

  const fiber = Number.isFinite(input.fiber) ? Number(input.fiber) : 0;
  const sumMacros = input.protein + input.fat + input.carbs + fiber;

  const suspicious =
    input.calories > MAX_CALORIES_PER_100G ||
    input.protein > MAX_MACRO_PER_100G ||
    input.fat > MAX_MACRO_PER_100G ||
    input.carbs > MAX_MACRO_PER_100G ||
    fiber > MAX_FIBER_PER_100G ||
    sumMacros > MAX_MACRO_PER_100G + 10;

  return { suspicious };
};

const isRawValueMissing = (value: unknown): boolean => {
  return value === null || value === undefined || String(value).trim() === '';
};

export const getInvalidFoodMacroReason = (
  input: NutritionInput,
  rawValues?: Partial<Record<FoodMacroField, unknown>>
): InvalidFoodMacroReason | null => {
  for (const field of MACRO_FIELDS) {
    if (rawValues && field in rawValues && isRawValueMissing(rawValues[field])) {
      return `${field}_missing` as InvalidFoodMacroReason;
    }
    const value = input[field];
    if (!Number.isFinite(value)) {
      return `${field}_invalid` as InvalidFoodMacroReason;
    }
    if (value < 0) {
      return `${field}_negative` as InvalidFoodMacroReason;
    }
  }

  if (MACRO_FIELDS.every((field) => input[field] === 0)) {
    return 'all_zero_macros';
  }

  return null;
};

export const getInvalidFoodMacroMessage = (reason: InvalidFoodMacroReason): string => {
  switch (reason) {
    case 'calories_missing':
      return 'Укажите калории на 100 г/мл.';
    case 'protein_missing':
      return 'Укажите белки на 100 г/мл.';
    case 'fat_missing':
      return 'Укажите жиры на 100 г/мл.';
    case 'carbs_missing':
      return 'Укажите углеводы на 100 г/мл.';
    case 'calories_invalid':
    case 'protein_invalid':
    case 'fat_invalid':
    case 'carbs_invalid':
      return 'КБЖУ должны быть корректными числами.';
    case 'calories_negative':
    case 'protein_negative':
    case 'fat_negative':
    case 'carbs_negative':
      return 'КБЖУ не могут быть отрицательными.';
    case 'all_zero_macros':
      return 'Нельзя сохранить продукт с нулевыми КБЖУ по всем полям.';
    default:
      return 'Некорректные значения КБЖУ.';
  }
};

export const assertValidFoodMacros = (
  input: NutritionInput,
  rawValues?: Partial<Record<FoodMacroField, unknown>>
): void => {
  const reason = getInvalidFoodMacroReason(input, rawValues);
  if (reason) {
    throw new Error(getInvalidFoodMacroMessage(reason));
  }
};
