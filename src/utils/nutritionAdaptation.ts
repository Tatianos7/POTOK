import type { CycleNutritionContext, NutritionScope, NutritionValues } from '../types/adaptiveNutrition';
import { parseNutritionDate } from './nutritionWeek';

export type MealConfirmationChoice = 'ate-as-planned' | 'ate-with-changes' | 'did-not-eat' | 'extra-food';
export type DailyNutritionState = 'normal' | 'no_time' | 'tired' | 'hungry' | 'training_day' | 'rest_day';

export const DAILY_NUTRITION_STATES: ReadonlyArray<{ id: DailyNutritionState; label: string; hint: string }> = [
  { id: 'normal', label: 'Обычный день', hint: 'Можно оставить план без изменений.' },
  { id: 'no_time', label: 'Нет времени', hint: 'Можно рассмотреть блюда с меньшим временем приготовления.' },
  { id: 'tired', label: 'Устал(а)', hint: 'Отметьте самочувствие перед выбором изменений.' },
  { id: 'hungry', label: 'Сильнее голод', hint: 'Можно обсудить более сытные варианты без автоматического изменения цели.' },
  { id: 'training_day', label: 'Тренировочный день', hint: 'Нагрузка учитывается как контекст, а не как автоматическая прибавка калорий.' },
  { id: 'rest_day', label: 'День отдыха', hint: 'Отдых не означает автоматического сокращения питания.' },
];

export function normalizeDailyNutritionState(value: string): DailyNutritionState | null {
  const aliases: Record<string, DailyNutritionState> = { usual: 'normal', 'no-time': 'no_time',
    low_energy: 'tired', fatigue: 'tired', hungrier: 'hungry', 'heavy-training': 'training_day', rest: 'rest_day' };
  return Object.prototype.hasOwnProperty.call(aliases, value) ? aliases[value] :
    DAILY_NUTRITION_STATES.find((state) => state.id === value)?.id ?? null;
}

export interface MealConfirmationIntent {
  kind: 'confirmation-intent';
  scope: NutritionScope;
  date: string;
  slotId: string | null;
  choice: MealConfirmationChoice;
  createsDiaryFact: false;
  requiresFactReview: true;
}

export function createMealConfirmationIntent(input: {
  currentUserId: string;
  scope: NutritionScope;
  date: string;
  slotId: string | null;
  choice: MealConfirmationChoice;
}): MealConfirmationIntent {
  parseNutritionDate(input.date);
  assertScope(input.scope, input.currentUserId);
  if (!['ate-as-planned', 'ate-with-changes', 'did-not-eat', 'extra-food'].includes(input.choice)) throw new Error('invalid_meal_choice');
  if (input.choice !== 'extra-food' && !input.slotId?.trim()) throw new Error('missing_meal_slot');
  return { kind: 'confirmation-intent', scope: { ...input.scope }, date: input.date,
    slotId: input.slotId, choice: input.choice, createsDiaryFact: false, requiresFactReview: true };
}

function assertScope(scope: NutritionScope, currentUserId: string) {
  if (!currentUserId.trim() || scope.userId !== currentUserId || Object.values(scope).some((value) => !value.trim())) {
    throw new Error('nutrition_account_or_version_missing');
  }
}

export interface ActualNutritionSnapshot {
  userId: string;
  date: string;
  source: 'diary-facts';
  coverage: 'partial' | 'confirmed-complete';
  totals: NutritionValues;
}

/** Informational review only; no deficit, cycling or compensation prescription. */
export function reviewDailyNutrition(input: {
  currentUserId: string;
  scope: NutritionScope;
  date: string;
  target: NutritionValues;
  actual: ActualNutritionSnapshot | null;
  dayState: DailyNutritionState;
  cycle: CycleNutritionContext;
}) {
  assertScope(input.scope, input.currentUserId);
  parseNutritionDate(input.date);
  if (!DAILY_NUTRITION_STATES.some((state) => state.id === input.dayState)) throw new Error('invalid_day_state');
  const valid = (values: NutritionValues) => [values.calories, values.protein, values.fat, values.carbs]
    .every((value) => Number.isFinite(value) && value >= 0);
  if (!valid(input.target) || input.target.calories <= 0) throw new Error('invalid_nutrition_target');
  if (input.actual && (input.actual.userId !== input.currentUserId || input.actual.date !== input.date ||
      input.actual.source !== 'diary-facts' || !valid(input.actual.totals))) throw new Error('invalid_actual_nutrition_scope');
  const actual = input.actual;
  const delta = actual ? {
    calories: actual.totals.calories - input.target.calories,
    protein: actual.totals.protein - input.target.protein,
    fat: actual.totals.fat - input.target.fat,
    carbs: actual.totals.carbs - input.target.carbs,
  } : null;
  const healthReview = input.cycle.enabled && input.cycle.reportedCycleDisruption;
  return {
    kind: 'adaptation-review' as const,
    scope: { ...input.scope }, date: input.date, dayState: input.dayState,
    actualCoverage: actual?.coverage ?? 'unknown',
    actualMinusTarget: delta,
    // Partial logged intake never becomes a confirmed deficit or adherence score.
    isCompleteDayComparison: actual?.coverage === 'confirmed-complete',
    options: [
      { action: 'keep-plan' as const, appliesAutomatically: false },
      { action: 'review-rest-of-day' as const, appliesAutomatically: false, blockedUntil: 'reviewed-safety-policy' as const },
      { action: 'review-rest-of-week' as const, appliesAutomatically: false, blockedUntil: 'reviewed-safety-policy' as const },
    ],
    guidance: healthReview ? 'health-review-before-restriction' as const : 'review-before-change' as const,
    requiresConfirmation: true as const,
    canApplyAdjustment: false as const,
    changesGoal: false as const,
    createsDiaryFact: false as const,
  };
}
