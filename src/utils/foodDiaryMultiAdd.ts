import { Food, MealEntry } from '../types';
import { convertDisplayToGrams, FoodDisplayUnit } from './foodUnits';
import { getSafeDisplayUnit, getSupportedFoodDisplayUnits } from './foodMeasurementPresets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FoodDiaryMultiAddDraft {
  key: string;
  food: Food;
  quantity: string;
  unit: FoodDisplayUnit;
}

export interface FoodDiaryMultiAddPreview {
  weight: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  isValid: boolean;
  error: string | null;
}

export interface FoodDiaryMultiAddTotals {
  weight: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export const isValidCanonicalFoodId = (value?: string | null): boolean =>
  Boolean(value) && UUID_RE.test(String(value));

export const resolveCanonicalFoodId = (food: Pick<Food, 'id' | 'canonical_food_id'>): string | null => {
  if (isValidCanonicalFoodId(food.canonical_food_id)) return food.canonical_food_id ?? null;
  if (isValidCanonicalFoodId(food.id)) return food.id;
  return null;
};

export const getFoodDiaryMultiAddKey = (food: Food): string =>
  resolveCanonicalFoodId(food) || food.stable_food_id || food.id || food.name.toLowerCase().trim();

export const createFoodDiaryMultiAddDraft = (
  food: Food,
  defaultWeight = 100
): FoodDiaryMultiAddDraft => {
  const supportedUnits = getSupportedFoodDisplayUnits(food);
  return {
    key: getFoodDiaryMultiAddKey(food),
    food,
    quantity: String(defaultWeight),
    unit: getSafeDisplayUnit('г', supportedUnits),
  };
};

export const addFoodDiaryMultiAddDraft = (
  drafts: FoodDiaryMultiAddDraft[],
  food: Food,
  defaultWeight = 100
): { drafts: FoodDiaryMultiAddDraft[]; duplicateKey: string | null } => {
  const key = getFoodDiaryMultiAddKey(food);
  if (drafts.some((draft) => draft.key === key)) {
    return { drafts, duplicateKey: key };
  }

  return {
    drafts: [...drafts, createFoodDiaryMultiAddDraft(food, defaultWeight)],
    duplicateKey: null,
  };
};

export const removeFoodDiaryMultiAddDraft = (
  drafts: FoodDiaryMultiAddDraft[],
  key: string
): FoodDiaryMultiAddDraft[] => drafts.filter((draft) => draft.key !== key);

export const updateFoodDiaryMultiAddDraft = (
  drafts: FoodDiaryMultiAddDraft[],
  key: string,
  patch: Partial<Pick<FoodDiaryMultiAddDraft, 'quantity' | 'unit'>>
): FoodDiaryMultiAddDraft[] =>
  drafts.map((draft) => {
    if (draft.key !== key) return draft;
    const nextUnit = patch.unit
      ? getSafeDisplayUnit(patch.unit, getSupportedFoodDisplayUnits(draft.food))
      : draft.unit;

    return {
      ...draft,
      ...patch,
      unit: nextUnit,
    };
  });

export const previewFoodDiaryMultiAddDraft = (
  draft: FoodDiaryMultiAddDraft
): FoodDiaryMultiAddPreview => {
  const quantity = Number.parseFloat(draft.quantity);

  if (!draft.quantity.trim()) {
    return emptyInvalidPreview('Введите количество');
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return emptyInvalidPreview('Количество должно быть больше нуля');
  }

  const weight = convertDisplayToGrams(quantity, draft.unit, draft.food.name);

  if (!Number.isFinite(weight) || weight <= 0) {
    return emptyInvalidPreview('Вес должен быть больше нуля');
  }

  if (!resolveCanonicalFoodId(draft.food)) {
    return emptyInvalidPreview('Продукт нельзя сохранить в дневник');
  }

  const k = weight / 100;

  return {
    weight,
    calories: draft.food.calories * k,
    protein: draft.food.protein * k,
    fat: draft.food.fat * k,
    carbs: draft.food.carbs * k,
    isValid: true,
    error: null,
  };
};

export const getFoodDiaryMultiAddTotals = (
  drafts: FoodDiaryMultiAddDraft[]
): FoodDiaryMultiAddTotals =>
  drafts.reduce(
    (totals, draft) => {
      const preview = previewFoodDiaryMultiAddDraft(draft);
      if (!preview.isValid) return totals;

      return {
        weight: totals.weight + preview.weight,
        calories: totals.calories + preview.calories,
        protein: totals.protein + preview.protein,
        fat: totals.fat + preview.fat,
        carbs: totals.carbs + preview.carbs,
      };
    },
    { weight: 0, calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

export const isFoodDiaryMultiAddBasketValid = (drafts: FoodDiaryMultiAddDraft[]): boolean =>
  drafts.length > 0 && drafts.every((draft) => previewFoodDiaryMultiAddDraft(draft).isValid);

export const buildMealEntryFromMultiAddDraft = (
  draft: FoodDiaryMultiAddDraft,
  id: string = `meal_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
): MealEntry => {
  const preview = previewFoodDiaryMultiAddDraft(draft);
  const canonicalFoodId = resolveCanonicalFoodId(draft.food);

  if (!preview.isValid || !canonicalFoodId) {
    throw new Error(preview.error || 'Invalid food diary entry');
  }

  return {
    id,
    foodId: draft.food.id,
    food: draft.food,
    weight: preview.weight,
    calories: preview.calories,
    protein: preview.protein,
    fat: preview.fat,
    carbs: preview.carbs,
    baseUnit: 'г',
    displayUnit: draft.unit,
    displayAmount: Number.parseFloat(draft.quantity),
    canonicalFoodId,
  };
};

const emptyInvalidPreview = (error: string): FoodDiaryMultiAddPreview => ({
  weight: 0,
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  isValid: false,
  error,
});
