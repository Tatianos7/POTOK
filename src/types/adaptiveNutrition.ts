import type { UserGoal } from '../services/goalService';
import type { PremiumMealSlot, PremiumRecipe } from '../services/premiumCatalogService';

/** In-memory contract extensions only; no new goal store or DB payload. */
export type NutritionGoal = 'weight-loss' | 'maintain' | 'gain' | 'athletic-cut';
export type NutritionSafetyState = 'OK' | 'CAUTION' | 'NOT_RECOMMENDED' | 'BLOCKED';
export type NutritionDayKind = 'training' | 'rest' | 'higher-load' | 'unknown';
export type MealType = NonNullable<PremiumMealSlot['mealType']>;
export type NutritionValues = Pick<UserGoal, 'calories' | 'protein' | 'fat' | 'carbs'>;

export interface TrainingNutritionContext {
  trains: boolean | null;
  place: 'home' | 'gym' | 'other' | null;
  activities: Array<'strength' | 'cardio' | 'mixed' | 'running' | 'swimming' | 'cycling' | 'other'>;
  sessionsPerWeek: number | null;
  durationMinutes: number | null;
  perceivedLoad: 'light' | 'moderate' | 'high' | null;
}

export interface NutritionPreferences {
  pattern: 'ordinary' | 'vegetarian' | 'vegan' | 'keto' | 'low-carb';
  excludedFoodRefs: string[];
  allergies: { status: 'not-supplied' } | { status: 'supplied'; excludedAllergenRefs: string[] };
  mealsPerDay: number | null;
  cookingMinutes: number | null;
}

export type MacroSelection = { source: 'potok' } |
  { source: 'manual'; unit: 'g' | 'g/kg'; value: number };

export interface AdaptiveGoalDraft {
  userId: string;
  baseGoalVersion: string;
  mode: 'potok' | 'advanced';
  goal: NutritionGoal;
  anthropometry: Pick<UserGoal, 'gender' | 'age' | 'height' | 'current_weight'>;
  training: TrainingNutritionContext;
  preferences: NutritionPreferences;
  calories: { source: 'potok' } | { source: 'manual'; value: number };
  protein: MacroSelection;
  fat: MacroSelection;
  // Carbohydrates are the mathematical residual; clinical review is separate.
}

export interface NutritionScope {
  userId: string;
  planId: string;
  planVersion: string;
  goalVersion: string;
}

export type CuratedRecipeTag = 'cut' | 'bulk' | 'vegan' | 'high_protein' | 'high_carb' | 'keto' |
  'lower-carb' | 'lower-fat' | 'high-volume' | 'energy-dense' | 'pre-workout' | 'post-workout';

/** Same existing Premium recipe ID; private Recipe IDs cannot opt in implicitly. */
export interface CuratedRecipeEligibility {
  recipeId: PremiumRecipe['id'];
  origin: 'potok-curated';
  review: 'pending' | 'approved';
  tags: CuratedRecipeTag[];
  mealTypes: MealType[];
  collectionVisible: boolean;
  planEligible: boolean;
  portionScalable: boolean;
  servings: number | null;
  fiber: number | null;
}

export interface IngredientMeasure {
  stableFoodRef: string;
  state: 'raw' | 'dry' | 'frozen' | 'cooked' | 'as-sold';
  amount: number;
  unit: 'g' | 'ml';
  density?: { gramsPerMl: number; evidenceRef: string };
}

export type CycleNutritionContext = { enabled: false } | {
  enabled: true;
  contraception: 'hormonal' | 'non-hormonal' | 'not-supplied';
  symptoms: Array<'hunger' | 'cravings' | 'low-energy' | 'fatigue' | 'bloating' | 'pain'>;
  reportedCycleDisruption: boolean;
  // No inferred phase or automatic calorie adjustment; ephemeral, opt-in only.
};
