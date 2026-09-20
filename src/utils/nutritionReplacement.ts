import type { PremiumRecipe } from '../services/premiumCatalogService';
import type { CuratedRecipeEligibility, MealType, NutritionScope, NutritionValues } from '../types/adaptiveNutrition';
import { filterCuratedRecipes } from './curatedRecipeEligibility';
import { weekPreviewContextKey, type WeekPreviewContext } from './nutritionWeekPreview';

/** Explicit reviewed batch nutrition, never parsed from Today display strings. */
export interface ReplacementNutritionEvidence {
  recipeId: string;
  revision: string;
  canonicalReview: 'pending' | 'approved';
  baseServings: number;
  batch: NutritionValues;
}

export interface PlannedNutritionTotals {
  scope: NutritionScope;
  fromDate: string;
  toDate: string;
  coverage: 'complete' | 'partial';
  values: NutritionValues;
}

const keys = ['calories', 'protein', 'fat', 'carbs'] as const;
const valid = (values: NutritionValues) => keys.every((key) => Number.isFinite(values[key]) && values[key] >= 0);
const map = (read: (key: typeof keys[number]) => number): NutritionValues => ({
  calories: read('calories'), protein: read('protein'), fat: read('fat'), carbs: read('carbs'),
});
const sameScope = (a: NutritionScope, b: NutritionScope) =>
  a.userId === b.userId && a.planId === b.planId && a.planVersion === b.planVersion && a.goalVersion === b.goalVersion;

/** Arithmetic proposal only. Does not rank safety, choose portions, apply or persist. */
export function previewNutritionReplacement(input: {
  context: WeekPreviewContext;
  expectedContextKey: string;
  date: string;
  slotId: string;
  mealType: MealType;
  originalRecipeId: string;
  candidateRecipeId: string;
  originalServings: number;
  candidateServings: number;
  recipes: PremiumRecipe[];
  eligibility: CuratedRecipeEligibility[];
  nutrition: ReplacementNutritionEvidence[];
  dayTotals: PlannedNutritionTotals | null;
  weekTotals: PlannedNutritionTotals | null;
}) {
  const contextKey = weekPreviewContextKey(input.context);
  if (contextKey !== input.expectedContextKey) throw new Error('stale_replacement_context');
  const { week } = input.context;
  const day = week.days.find((item) => item.date === input.date);
  const slots = day?.sourceDay?.meals.filter((meal) => meal.catalogSlotId === input.slotId) ?? [];
  if (!input.slotId.trim() || slots.length !== 1 || !input.originalRecipeId.trim() ||
      slots[0].catalogPrimaryRecipeId !== input.originalRecipeId) throw new Error('replacement_slot_or_recipe_mismatch');
  if (input.date < input.context.today) throw new Error('past_plan_requires_history_contract');
  if (!input.candidateRecipeId.trim()) throw new Error('missing_replacement_recipe');
  const eligible = filterCuratedRecipes(input.recipes, input.eligibility, { purpose: 'plan', mealType: input.mealType });
  const issues: string[] = [];
  const portion = (recipeId: string, servings: number): NutritionValues | null => {
    if (!eligible.some((recipe) => recipe.id === recipeId)) {
      issues.push('reviewed_plan_eligibility_unavailable');
      return null;
    }
    const annotations = input.nutrition.filter((item) => item.recipeId === recipeId);
    const metadata = input.eligibility.find((item) => item.recipeId === recipeId)!;
    const evidence = annotations.length === 1 ? annotations[0] : null;
    if (!evidence || !evidence.revision.trim() || evidence.canonicalReview !== 'approved' || !valid(evidence.batch)) {
      issues.push('canonical_nutrition_unavailable');
      return null;
    }
    if (!Number.isFinite(servings) || servings <= 0 || !Number.isFinite(evidence.baseServings) ||
        evidence.baseServings <= 0 || metadata.servings !== evidence.baseServings ||
        (servings !== evidence.baseServings && !metadata.portionScalable)) {
      issues.push('portion_evidence_unavailable');
      return null;
    }
    const result = map((key) => evidence.batch[key] * (servings / evidence.baseServings));
    if (!valid(result)) { issues.push('nutrition_overflow'); return null; }
    return result;
  };
  const original = portion(input.originalRecipeId, input.originalServings);
  const candidate = portion(input.candidateRecipeId, input.candidateServings);
  const mealDelta = original && candidate ? map((key) => candidate[key] - original[key]) : null;
  const period = (snapshot: PlannedNutritionTotals | null, from: string, to: string): NutritionValues | null => {
    if (snapshot && (!sameScope(snapshot.scope, week.scope) || snapshot.fromDate !== from || snapshot.toDate !== to)) {
      throw new Error('replacement_totals_scope_mismatch');
    }
    if (!snapshot || snapshot.coverage !== 'complete' || !valid(snapshot.values)) {
      issues.push('complete_period_totals_unavailable');
      return null;
    }
    if (!original || !mealDelta) return null;
    if (keys.some((key) => snapshot.values[key] < original[key])) {
      issues.push('inconsistent_period_totals');
      return null;
    }
    const result = map((key) => snapshot.values[key] + mealDelta[key]);
    if (!valid(result)) { issues.push('nutrition_overflow'); return null; }
    return result;
  };
  const proposedDay = period(input.dayTotals, input.date, input.date);
  const proposedWeek = period(input.weekTotals, week.startDate, week.endDate);
  return {
    kind: 'replacement-preview' as const, contextKey, scope: { ...week.scope }, date: input.date, slotId: input.slotId,
    originalRecipeId: input.originalRecipeId, candidateRecipeId: input.candidateRecipeId,
    originalServings: input.originalServings, candidateServings: input.candidateServings,
    mealDelta, proposedDay, proposedWeek, issues: [...new Set(issues)],
    // These reviews cannot be asserted through client booleans or invented tolerances.
    blockers: ['restriction-and-allergen-review', 'reviewed-portion-and-safety-policy', 'persistence-contract'] as const,
    canApply: false as const, createsDiaryFact: false as const, changesGoal: false as const,
  };
}
