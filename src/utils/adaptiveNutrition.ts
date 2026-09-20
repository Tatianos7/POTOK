import type { IngredientMeasure, MacroSelection, NutritionValues, TrainingNutritionContext } from '../types/adaptiveNutrition';
import type { UserGoal } from '../services/goalService';

export function trainingContextFromLegacyGoal(goal: UserGoal): TrainingNutritionContext {
  return {
    trains: goal.training_place === 'none' ? false : null,
    place: goal.training_place === 'home' || goal.training_place === 'gym' ? goal.training_place : null,
    activities: [], sessionsPerWeek: null, durationMinutes: null, perceivedLoad: null,
  };
}

const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;

/** Math only. This does not provide clinical clearance or change a saved goal. */
export function previewAdvancedMacros(input: {
  recommendation: NutritionValues;
  calories: { source: 'potok' } | { source: 'manual'; value: number };
  protein: MacroSelection;
  fat: MacroSelection;
  weightKg: number;
}): { ok: true; values: NutritionValues; canActivate: false; clinicalSafety: 'not-evaluated' } |
   { ok: false; reason: 'invalid-input' | 'negative-carbohydrate-energy' } {
  const grams = (selection: MacroSelection, recommended: number) => selection.source === 'potok' ? recommended :
    selection.unit === 'g' ? selection.value : selection.value * input.weightKg;
  if (!Object.values(input.recommendation).every(nonnegative) || !Number.isFinite(input.weightKg) || input.weightKg <= 0 ||
      [input.protein, input.fat].some((s) => s.source === 'manual' && !nonnegative(s.value))) {
    return { ok: false, reason: 'invalid-input' };
  }
  const calories = input.calories.source === 'potok' ? input.recommendation.calories : input.calories.value;
  const protein = grams(input.protein, input.recommendation.protein);
  const fat = grams(input.fat, input.recommendation.fat);
  const remainingEnergy = calories - protein * 4 - fat * 9;
  if (![calories, protein, fat, remainingEnergy].every(Number.isFinite) || calories <= 0) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (remainingEnergy < 0) return { ok: false, reason: 'negative-carbohydrate-energy' };
  return { ok: true, values: { calories, protein, fat, carbs: remainingEnergy / 4 },
    canActivate: false, clinicalSafety: 'not-evaluated' };
}

/** Convert only when an explicit food-specific density source exists. */
export function ingredientGrams(measure: IngredientMeasure): number | null {
  if (!measure.stableFoodRef.trim() || !Number.isFinite(measure.amount) || measure.amount <= 0) return null;
  if (measure.unit === 'g') return measure.amount;
  if (!measure.density?.evidenceRef.trim() || !Number.isFinite(measure.density.gramsPerMl) || measure.density.gramsPerMl <= 0) return null;
  const grams = measure.amount * measure.density.gramsPerMl;
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}
