import { goalService, type UserGoal } from './goalService';
import { measurementsService, type MeasurementHistory } from './measurementsService';
import { mealService } from './mealService';
import { progressNutritionService } from './progressNutritionService';
import { workoutProgressService, type WorkoutProgressSummary } from './workoutProgressService';
import { workoutService } from './workoutService';
import type { DailyMeals } from '../types';
import type { NutritionStats } from '../types/progressDashboard';
import type { WorkoutEntry } from '../types/workout';
import { getLocalDayKey } from '../utils/dayKey';
import {
  deriveProgressDailyGoalPeriodMetrics,
  type ProgressDailyGoalPeriodDay,
  type ProgressDailyGoalPeriodMetrics,
} from '../utils/progressDailyGoal';

export type ProgressHubSectionState = 'ok' | 'empty' | 'error';

export interface ProgressHubPeriod {
  startDate: string;
  endDate: string;
  totalDays: number;
}

export interface ProgressHubGoalSummary {
  state: ProgressHubSectionState;
  error?: string;
  hasGoal: boolean;
  goalTypeLabel: string | null;
  currentWeight: number | null;
  targetWeight: number | null;
  remainingWeight: number | null;
  caloriesTarget: number | null;
}

export interface ProgressHubNutritionSummary {
  state: ProgressHubSectionState;
  error?: string;
  averageCalories: number | null;
  caloriesTarget: number | null;
  averageCalorieBalance: number | null;
  loggedDays: number;
  totalDays: number;
  hasEnoughData: boolean;
}

export interface ProgressHubMeasurementsSummary {
  state: ProgressHubSectionState;
  error?: string;
  latestWeight: number | null;
  latestMeasurementDate: string | null;
  weightDelta30d: number | null;
  waistDelta30d: number | null;
  recordsCount30d: number;
}

export interface ProgressHubWorkoutsSummary {
  state: ProgressHubSectionState;
  error?: string;
  workoutsCount30d: number;
  averageFrequencyLabel: string;
  lastWorkoutLabel: string;
  lastWorkoutDate: string | null;
}

export interface ProgressHubTodaySummary {
  date: string;
  hasFoodEntries: boolean;
  foodEntriesCount: number;
  caloriesLogged: number;
  hasWorkoutEntries: boolean;
  workoutEntriesCount: number;
  waterGlasses: number | null;
  waterSource: 'meal_local_state' | 'unavailable';
}

export interface ProgressHubData {
  period: ProgressHubPeriod;
  today: ProgressHubTodaySummary;
  dailyGoalPeriod: ProgressDailyGoalPeriodMetrics;
  dailyGoalPeriodDays: ProgressDailyGoalPeriodDay[];
  goal: ProgressHubGoalSummary;
  nutrition: ProgressHubNutritionSummary;
  measurements: ProgressHubMeasurementsSummary;
  workouts: ProgressHubWorkoutsSummary;
  attentionMessages: string[];
}

interface ProgressHubDeps {
  goalRepo: {
    getUserGoal(userId: string): Promise<UserGoal | null>;
  };
  nutritionRepo: {
    getNutritionProgressForRange(userId: string, startDate: string, endDate: string): Promise<NutritionStats>;
  };
  todayMealsRepo: {
    getMealsForDate(userId: string, date: string): Promise<DailyMeals>;
  };
  todayWorkoutsRepo: {
    getWorkoutEntries(userId: string, date: string): Promise<WorkoutEntry[]>;
  };
  measurementsRepo: {
    getMeasurementHistory(userId: string): Promise<MeasurementHistory[]>;
  };
  workoutsRepo: {
    getWorkoutProgressSummary(input: {
      userId: string;
      dateFrom: string;
      dateTo: string;
      period?: 'week' | 'month' | 'custom';
    }): Promise<WorkoutProgressSummary>;
  };
  getToday(): string;
}

const HUB_TOTAL_DAYS = 30;
const NUTRITION_ENOUGH_DATA_RATIO = 0.8;

function shiftIsoDay(isoDay: string, deltaDays: number): string {
  const [year, month, day] = isoDay.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + deltaDays);
  return getLocalDayKey(date);
}

function parseDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getDayDiff(fromDate: string, toDate: string): number {
  return Math.max(0, Math.round((parseDayKey(toDate).getTime() - parseDayKey(fromDate).getTime()) / 86400000));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value.replace(',', '.').trim()) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getGoalTypeLabel(goalType: string | undefined): string | null {
  if (goalType === 'weight-loss') return 'Похудение';
  if (goalType === 'maintain') return 'Поддержка формы';
  if (goalType === 'gain') return 'Набор массы';
  return null;
}

function formatTimesPerWeek(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return 'нет данных';
  }

  if (value < 1) {
    return 'реже 1 раза в неделю';
  }

  const nearestInteger = Math.round(value);
  const isCloseToInteger = Math.abs(value - nearestInteger) < 0.05;

  if (isCloseToInteger) {
    const suffix = nearestInteger === 1 ? 'раз' : 'раза';
    return `${nearestInteger} ${suffix} в неделю`;
  }

  return `около ${nearestInteger} раз в неделю`;
}

function formatDaysAgo(days: number): string {
  const absDays = Math.max(0, days);
  const lastTwoDigits = absDays % 100;
  const lastDigit = absDays % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${absDays} дней назад`;
  }

  if (lastDigit === 1) {
    return `${absDays} день назад`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${absDays} дня назад`;
  }

  return `${absDays} дней назад`;
}

function formatLastDateLabel(lastDate: string | null, anchorDate: string): string {
  if (!lastDate) return 'нет данных';
  const diffDays = getDayDiff(lastDate, anchorDate);
  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'вчера';
  return formatDaysAgo(diffDays);
}

function getMeasurementValue(row: MeasurementHistory, metricId: 'weight' | 'waist'): number | null {
  const item = row.measurements.find((measurement) => measurement.id === metricId);
  return toFiniteNumber(item?.value);
}

function getMetricDelta(rows: MeasurementHistory[], metricId: 'weight' | 'waist'): number | null {
  const points = getMeasurementPoints(rows, metricId);

  if (points.length < 2) return null;
  return round1(points[points.length - 1].value - points[0].value);
}

function getMeasurementPoints(rows: MeasurementHistory[], metricId: 'weight' | 'waist'): Array<{ date: string; value: number }> {
  return rows
    .map((row) => ({ date: row.date, value: getMeasurementValue(row, metricId) }))
    .filter((point): point is { date: string; value: number } => point.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildPeriod(anchorDate: string): ProgressHubPeriod {
  return {
    startDate: shiftIsoDay(anchorDate, -(HUB_TOTAL_DAYS - 1)),
    endDate: anchorDate,
    totalDays: HUB_TOTAL_DAYS,
  };
}

function buildGoalSummary(goal: UserGoal | null): ProgressHubGoalSummary {
  if (!goal) {
    return {
      state: 'empty',
      hasGoal: false,
      goalTypeLabel: null,
      currentWeight: null,
      targetWeight: null,
      remainingWeight: null,
      caloriesTarget: null,
    };
  }

  const currentWeight = toFiniteNumber(goal.current_weight);
  const targetWeight = toFiniteNumber(goal.target_weight);
  const remainingWeight =
    currentWeight !== null && targetWeight !== null ? round1(Math.abs(targetWeight - currentWeight)) : null;

  return {
    state: 'ok',
    hasGoal: true,
    goalTypeLabel: getGoalTypeLabel(goal.goal_type),
    currentWeight,
    targetWeight,
    remainingWeight,
    caloriesTarget: toFiniteNumber(goal.calories),
  };
}

function buildNutritionSummary(stats: NutritionStats, totalDays: number): ProgressHubNutritionSummary {
  const loggedDays = stats.periodCoverage?.days_with_data ?? 0;
  const coverageRatio = stats.periodCoverage?.coverage_ratio ?? loggedDays / totalDays;
  const hasData = Boolean(stats.calories?.has_data);
  const averageCalories = hasData ? Math.round(stats.average.calories) : null;
  const caloriesTarget = stats.deficit?.target_calories != null ? Math.round(stats.deficit.target_calories / totalDays) : null;

  return {
    state: hasData ? 'ok' : 'empty',
    averageCalories,
    caloriesTarget,
    averageCalorieBalance: averageCalories !== null && caloriesTarget !== null ? averageCalories - caloriesTarget : null,
    loggedDays,
    totalDays,
    hasEnoughData: coverageRatio >= NUTRITION_ENOUGH_DATA_RATIO,
  };
}

function buildMeasurementsSummary(
  history: MeasurementHistory[],
  period: ProgressHubPeriod,
): ProgressHubMeasurementsSummary {
  const rows = history
    .filter((row) => row.date >= period.startDate && row.date <= period.endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestRow = rows[rows.length - 1] ?? null;
  const weightPoints = getMeasurementPoints(rows, 'weight');
  const latestWeightPoint = weightPoints[weightPoints.length - 1] ?? null;

  return {
    state: rows.length > 0 ? 'ok' : 'empty',
    latestWeight: latestWeightPoint?.value ?? null,
    latestMeasurementDate: latestRow?.date ?? null,
    weightDelta30d: weightPoints.length >= 2 ? round1(weightPoints[weightPoints.length - 1].value - weightPoints[0].value) : null,
    waistDelta30d: getMetricDelta(rows, 'waist'),
    recordsCount30d: rows.length,
  };
}

function buildWorkoutsSummary(summary: WorkoutProgressSummary, period: ProgressHubPeriod): ProgressHubWorkoutsSummary {
  const workoutDates = [...(summary.workoutDates ?? [])].sort();
  const lastWorkoutDate = workoutDates[workoutDates.length - 1] ?? null;
  const workoutsCount30d = summary.totalWorkouts;

  return {
    state: workoutsCount30d > 0 ? 'ok' : 'empty',
    workoutsCount30d,
    averageFrequencyLabel: formatTimesPerWeek((workoutsCount30d / period.totalDays) * 7),
    lastWorkoutLabel: formatLastDateLabel(lastWorkoutDate, period.endDate),
    lastWorkoutDate,
  };
}

function countMealEntries(meals: DailyMeals | null): number {
  if (!meals) return 0;

  return (
    (meals.breakfast?.length ?? 0) +
    (meals.lunch?.length ?? 0) +
    (meals.dinner?.length ?? 0) +
    (meals.snack?.length ?? 0)
  );
}

function sumMealCalories(meals: DailyMeals | null): number {
  if (!meals) return 0;

  const entries = [...(meals.breakfast ?? []), ...(meals.lunch ?? []), ...(meals.dinner ?? []), ...(meals.snack ?? [])];
  return entries.reduce((total, entry) => total + Math.max(0, toFiniteNumber(entry.calories) ?? 0), 0);
}

function buildTodaySummary(params: {
  date: string;
  meals: DailyMeals | null;
  workoutEntries: WorkoutEntry[] | null;
}): ProgressHubTodaySummary {
  const foodEntriesCount = countMealEntries(params.meals);
  const caloriesLogged = sumMealCalories(params.meals);
  const workoutEntriesCount = params.workoutEntries?.length ?? 0;
  const waterGlasses = typeof params.meals?.water === 'number' ? params.meals.water : null;

  return {
    date: params.date,
    hasFoodEntries: foodEntriesCount > 0,
    foodEntriesCount,
    caloriesLogged,
    hasWorkoutEntries: workoutEntriesCount > 0,
    workoutEntriesCount,
    waterGlasses,
    waterSource: waterGlasses === null ? 'unavailable' : 'meal_local_state',
  };
}

function buildDailyGoalPeriodDays(params: {
  period: ProgressHubPeriod;
  calorieTarget: number | null;
  nutritionStats: NutritionStats | null;
  workoutSummary: WorkoutProgressSummary | null;
}): ProgressDailyGoalPeriodDay[] {
  const dailyCalories = new Map(
    (params.nutritionStats?.dailyCalories ?? []).map((day) => [day.date, toFiniteNumber(day.calories) ?? 0]),
  );
  const workoutDates = new Set(params.workoutSummary?.workoutDates ?? []);

  return Array.from({ length: params.period.totalDays }, (_, index) => {
    const date = shiftIsoDay(params.period.startDate, index);
    return {
      date,
      caloriesLogged: dailyCalories.get(date) ?? 0,
      calorieTarget: params.calorieTarget,
      hasWorkoutEntries: workoutDates.has(date),
    };
  });
}

function buildDailyGoalPeriodMetrics(params: {
  period: ProgressHubPeriod;
  calorieTarget: number | null;
  nutritionStats: NutritionStats | null;
  workoutSummary: WorkoutProgressSummary | null;
}): ProgressDailyGoalPeriodMetrics {
  return deriveProgressDailyGoalPeriodMetrics(buildDailyGoalPeriodDays(params));
}

function buildAttentionMessages(input: {
  period: ProgressHubPeriod;
  goal: ProgressHubGoalSummary;
  nutrition: ProgressHubNutritionSummary;
  measurements: ProgressHubMeasurementsSummary;
  workouts: ProgressHubWorkoutsSummary;
}): string[] {
  const messages: string[] = [];

  if (input.goal.state !== 'error' && !input.goal.hasGoal) {
    messages.push('Цель не задана.');
  }

  if (input.nutrition.state !== 'error' && !input.nutrition.hasEnoughData) {
    messages.push('Питание заполнено не полностью.');
  }

  if (input.measurements.state !== 'error' && input.measurements.recordsCount30d === 0) {
    messages.push('Нет новых замеров за 30 дней.');
  }

  const noRecentWorkouts =
    input.workouts.state !== 'error' &&
    (!input.workouts.lastWorkoutDate || getDayDiff(input.workouts.lastWorkoutDate, input.period.endDate) >= 14);

  if (noRecentWorkouts) {
    messages.push('Нет тренировок последние 14 дней.');
  }

  return messages;
}

const errorGoalSummary = (error: unknown): ProgressHubGoalSummary => ({
  state: 'error',
  error: error instanceof Error ? error.message : 'Не удалось загрузить цель.',
  hasGoal: false,
  goalTypeLabel: null,
  currentWeight: null,
  targetWeight: null,
  remainingWeight: null,
  caloriesTarget: null,
});

const errorNutritionSummary = (totalDays: number, error: unknown): ProgressHubNutritionSummary => ({
  state: 'error',
  error: error instanceof Error ? error.message : 'Не удалось загрузить питание.',
  averageCalories: null,
  caloriesTarget: null,
  averageCalorieBalance: null,
  loggedDays: 0,
  totalDays,
  hasEnoughData: false,
});

const errorMeasurementsSummary = (error: unknown): ProgressHubMeasurementsSummary => ({
  state: 'error',
  error: error instanceof Error ? error.message : 'Не удалось загрузить замеры.',
  latestWeight: null,
  latestMeasurementDate: null,
  weightDelta30d: null,
  waistDelta30d: null,
  recordsCount30d: 0,
});

const errorWorkoutsSummary = (error: unknown): ProgressHubWorkoutsSummary => ({
  state: 'error',
  error: error instanceof Error ? error.message : 'Не удалось загрузить тренировки.',
  workoutsCount30d: 0,
  averageFrequencyLabel: 'нет данных',
  lastWorkoutLabel: 'нет данных',
  lastWorkoutDate: null,
});

export class ProgressHubService {
  constructor(private readonly deps: ProgressHubDeps) {}

  async getProgressHubData(userId: string): Promise<ProgressHubData> {
    const todayDate = this.deps.getToday();
    const period = buildPeriod(todayDate);

    const [goalResult, nutritionResult, todayMealsResult, todayWorkoutsResult, measurementsResult, workoutsResult] = await Promise.allSettled([
      this.deps.goalRepo.getUserGoal(userId),
      this.deps.nutritionRepo.getNutritionProgressForRange(userId, period.startDate, period.endDate),
      this.deps.todayMealsRepo.getMealsForDate(userId, todayDate),
      this.deps.todayWorkoutsRepo.getWorkoutEntries(userId, todayDate),
      this.deps.measurementsRepo.getMeasurementHistory(userId),
      this.deps.workoutsRepo.getWorkoutProgressSummary({
        userId,
        dateFrom: period.startDate,
        dateTo: period.endDate,
        period: 'month',
      }),
    ]);

    const goal =
      goalResult.status === 'fulfilled' ? buildGoalSummary(goalResult.value) : errorGoalSummary(goalResult.reason);
    const nutrition =
      nutritionResult.status === 'fulfilled'
        ? buildNutritionSummary(nutritionResult.value, period.totalDays)
        : errorNutritionSummary(period.totalDays, nutritionResult.reason);
    const measurements =
      measurementsResult.status === 'fulfilled'
        ? buildMeasurementsSummary(measurementsResult.value, period)
        : errorMeasurementsSummary(measurementsResult.reason);
    const workouts =
      workoutsResult.status === 'fulfilled'
        ? buildWorkoutsSummary(workoutsResult.value, period)
        : errorWorkoutsSummary(workoutsResult.reason);
    const today = buildTodaySummary({
      date: todayDate,
      meals: todayMealsResult.status === 'fulfilled' ? todayMealsResult.value : null,
      workoutEntries: todayWorkoutsResult.status === 'fulfilled' ? todayWorkoutsResult.value : null,
    });
    const dailyGoalPeriodDays = buildDailyGoalPeriodDays({
      period,
      calorieTarget: goal.caloriesTarget ?? nutrition.caloriesTarget,
      nutritionStats: nutritionResult.status === 'fulfilled' ? nutritionResult.value : null,
      workoutSummary: workoutsResult.status === 'fulfilled' ? workoutsResult.value : null,
    });
    const dailyGoalPeriod = deriveProgressDailyGoalPeriodMetrics(dailyGoalPeriodDays);

    return {
      period,
      today,
      dailyGoalPeriod,
      dailyGoalPeriodDays,
      goal,
      nutrition,
      measurements,
      workouts,
      attentionMessages: buildAttentionMessages({ period, goal, nutrition, measurements, workouts }),
    };
  }
}

export const createProgressHubService = (deps: ProgressHubDeps): ProgressHubService => new ProgressHubService(deps);

export const progressHubService = new ProgressHubService({
  goalRepo: goalService,
  nutritionRepo: progressNutritionService,
  todayMealsRepo: mealService,
  todayWorkoutsRepo: workoutService,
  measurementsRepo: measurementsService,
  workoutsRepo: workoutProgressService,
  getToday: () => getLocalDayKey(),
});

export const progressHubTestUtils = {
  buildAttentionMessages,
  buildGoalSummary,
  buildMeasurementsSummary,
  buildNutritionSummary,
  buildPeriod,
  buildDailyGoalPeriodMetrics,
  buildDailyGoalPeriodDays,
  buildTodaySummary,
  buildWorkoutsSummary,
  formatTimesPerWeek,
};
