import type { PremiumNutritionWeek } from '../services/premiumTodayAdapter';
import { createMealConfirmationIntent, DAILY_NUTRITION_STATES, type DailyNutritionState,
  type MealConfirmationChoice, type MealConfirmationIntent } from './nutritionAdaptation';
import { nutritionWeekDates, parseNutritionDate } from './nutritionWeek';

export interface WeekPreviewContext { currentUserId: string; today: string; week: PremiumNutritionWeek }
export interface WeekPreviewState {
  contextKey: string;
  selectedDate: string;
  dayStates: Record<string, DailyNutritionState>;
  intent: MealConfirmationIntent | null;
}
export type WeekPreviewActionPayload =
  { type: 'select-day'; date: string } |
  { type: 'day-state'; value: DailyNutritionState } |
  { type: 'meal-intent'; slotId: string | null; choice: MealConfirmationChoice } |
  { type: 'dismiss-intent' }
;
export type WeekPreviewAction = { contextKey: string } & WeekPreviewActionPayload;

export function weekPreviewContextKey(context: WeekPreviewContext): string {
  const { week, currentUserId, today } = context;
  parseNutritionDate(today);
  const dates = nutritionWeekDates(today);
  if (!currentUserId.trim() || week.scope.userId !== currentUserId || week.status !== 'active' ||
      Object.values(week.scope).some((value) => !value.trim()) || week.startDate !== dates[0] || week.endDate !== dates[6] ||
      week.days.length !== 7 || week.days.some((day, index) => day.date !== dates[index] || day.kind !== 'planned')) {
    throw new Error('invalid_week_preview_scope');
  }
  return JSON.stringify([currentUserId, week.scope.planId, week.scope.planVersion, week.scope.goalVersion, week.startDate, today]);
}

export function createWeekPreviewState(context: WeekPreviewContext): WeekPreviewState {
  return { contextKey: weekPreviewContextKey(context), selectedDate: context.today, dayStates: {}, intent: null };
}

/** In-memory interaction state only. No completion state or persistence callback. */
export function reduceWeekPreview(state: WeekPreviewState, action: WeekPreviewAction, context: WeekPreviewContext): WeekPreviewState {
  const key = weekPreviewContextKey(context);
  if (state.contextKey !== key || action.contextKey !== key) throw new Error('stale_week_preview');
  if (action.type === 'select-day') {
    if (!context.week.days.some((day) => day.date === action.date)) throw new Error('date_outside_active_week');
    return { ...state, selectedDate: action.date, intent: null };
  }
  if (action.type === 'dismiss-intent') return { ...state, intent: null };
  if (action.type === 'day-state') {
    if (!DAILY_NUTRITION_STATES.some((option) => option.id === action.value)) throw new Error('invalid_day_state');
    return { ...state, dayStates: { ...state.dayStates, [state.selectedDate]: action.value } };
  }
  if (state.selectedDate > context.today) throw new Error('future_meal_is_not_a_fact');
  const meals = context.week.days.find((day) => day.date === state.selectedDate)?.sourceDay?.meals ?? [];
  if (action.choice !== 'extra-food' && (!action.slotId || meals.filter((meal) => meal.catalogSlotId === action.slotId).length !== 1)) {
    throw new Error('meal_outside_selected_day');
  }
  if (!['ate-as-planned', 'ate-with-changes', 'did-not-eat', 'extra-food'].includes(action.choice)) throw new Error('invalid_meal_choice');
  return { ...state, intent: createMealConfirmationIntent({ currentUserId: context.currentUserId,
    scope: context.week.scope, date: state.selectedDate, slotId: action.slotId, choice: action.choice }) };
}
