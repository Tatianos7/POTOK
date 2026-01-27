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

const MAX_CALORIES_PER_100G = 900;
const MAX_MACRO_PER_100G = 100;
const MAX_FIBER_PER_100G = 100;

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
