import { supabase } from '../lib/supabaseClient';
import { goalService } from './goalService';
import type { NutritionStats } from '../types/progressDashboard';

export type NutritionProgressPeriod = 'day' | 'week' | 'month';
interface NutritionAggregationContext {
  anchorDate: string;
  periodKind: NutritionProgressPeriod;
  startDate: string;
  endDate: string;
  dayCount: number;
}

export interface DiaryNutritionRow {
  id: string;
  user_id: string;
  date: string;
  canonical_food_id: string | null;
  product_name: string;
  weight: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  idempotency_key: string | null;
}

export interface NutritionFoodNameRow {
  id: string;
  name: string;
}

interface NutritionDiaryRepository {
  listByUserAndDateRange(userId: string, fromDate: string, toDate: string): Promise<DiaryNutritionRow[]>;
}

interface NutritionFoodsRepository {
  findNamesByIds(foodIds: string[]): Promise<NutritionFoodNameRow[]>;
}

interface NutritionGoalRepository {
  getUserGoal(userId: string): Promise<{ calories: number } | null>;
}

interface ProgressNutritionDeps {
  diaryRepo: NutritionDiaryRepository;
  foodsRepo: NutritionFoodsRepository;
  goalRepo: NutritionGoalRepository;
}

const safeNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const isNonNegativeSnapshot = (row: DiaryNutritionRow): boolean =>
  row.weight >= 0 &&
  row.calories >= 0 &&
  row.protein >= 0 &&
  row.fat >= 0 &&
  row.carbs >= 0;

const isRecipeOriginRow = (row: DiaryNutritionRow): boolean =>
  row.canonical_food_id == null &&
  typeof row.idempotency_key === 'string' &&
  row.idempotency_key.includes(':recipe_');

const isCanonicalRow = (row: DiaryNutritionRow): boolean => typeof row.canonical_food_id === 'string' && row.canonical_food_id.length > 0;
const MULTI_DAY_DEFICIT_COVERAGE_THRESHOLD = 0.8;

function shiftDate(anchorDate: string, deltaDays: number): string {
  const [year, month, day] = anchorDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function getInclusiveDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

export function getNutritionPeriodRange(anchorDate: string, period: NutritionProgressPeriod): { start: string; end: string } {
  if (period === 'day') {
    return { start: anchorDate, end: anchorDate };
  }
  if (period === 'week') {
    return { start: shiftDate(anchorDate, -6), end: anchorDate };
  }
  return { start: shiftDate(anchorDate, -29), end: anchorDate };
}

function getAggregationContext(anchorDate: string, period: NutritionProgressPeriod): NutritionAggregationContext {
  const { start, end } = getNutritionPeriodRange(anchorDate, period);
  return {
    anchorDate,
    periodKind: period,
    startDate: start,
    endDate: end,
    dayCount: getInclusiveDayCount(start, end),
  };
}

export function aggregateNutritionProgress(
  rows: DiaryNutritionRow[],
  foodNamesById: Map<string, string>,
  anchorDate: string,
  period: NutritionProgressPeriod,
  calorieTarget: number | null
): NutritionStats {
  return aggregateNutritionProgressForContext(
    rows,
    foodNamesById,
    getAggregationContext(anchorDate, period),
    calorieTarget
  );
}

function aggregateNutritionProgressForContext(
  rows: DiaryNutritionRow[],
  foodNamesById: Map<string, string>,
  context: NutritionAggregationContext,
  calorieTarget: number | null
): NutritionStats {
  let includedCanonicalCount = 0;
  let includedRecipeSnapshotCount = 0;
  let excludedFallbackCount = 0;
  let excludedUnresolvedCount = 0;

  const includedRows: DiaryNutritionRow[] = [];
  const dailyCaloriesAccumulator = new Map<string, number>();
  const topFoodsAccumulator = new Map<
    string,
    { canonical_food_id: string; product_name: string; total_weight_g: number; entry_count: number; total_calories: number }
  >();

  for (const row of rows) {
    if (!isNonNegativeSnapshot(row)) {
      excludedUnresolvedCount += 1;
      continue;
    }

    if (isCanonicalRow(row)) {
      includedRows.push(row);
      includedCanonicalCount += 1;
      dailyCaloriesAccumulator.set(row.date, (dailyCaloriesAccumulator.get(row.date) ?? 0) + safeNumber(row.calories));

      const foodId = row.canonical_food_id as string;
      const current = topFoodsAccumulator.get(foodId) ?? {
        canonical_food_id: foodId,
        product_name: foodNamesById.get(foodId) ?? row.product_name,
        total_weight_g: 0,
        entry_count: 0,
        total_calories: 0,
      };
      current.total_weight_g += safeNumber(row.weight);
      current.entry_count += 1;
      current.total_calories += safeNumber(row.calories);
      topFoodsAccumulator.set(foodId, current);
      continue;
    }

    if (isRecipeOriginRow(row)) {
      includedRows.push(row);
      includedRecipeSnapshotCount += 1;
      dailyCaloriesAccumulator.set(row.date, (dailyCaloriesAccumulator.get(row.date) ?? 0) + safeNumber(row.calories));
      continue;
    }

    excludedFallbackCount += 1;
  }

  const totals = includedRows.reduce(
    (acc, row) => ({
      calories: acc.calories + safeNumber(row.calories),
      protein: acc.protein + safeNumber(row.protein),
      fat: acc.fat + safeNumber(row.fat),
      carbs: acc.carbs + safeNumber(row.carbs),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const dayCount = context.dayCount;
  const hasData = includedRows.length > 0;
  const daysWithData = dailyCaloriesAccumulator.size;
  const coverageRatio = dayCount > 0 ? daysWithData / dayCount : 0;
  const periodTargetCalories =
    calorieTarget !== null ? Math.round(calorieTarget * dayCount) : null;

  const topFoods = [...topFoodsAccumulator.values()]
    .sort((a, b) => {
      if (b.total_weight_g !== a.total_weight_g) return b.total_weight_g - a.total_weight_g;
      if (b.entry_count !== a.entry_count) return b.entry_count - a.entry_count;
      if (b.total_calories !== a.total_calories) return b.total_calories - a.total_calories;
      return a.canonical_food_id.localeCompare(b.canonical_food_id);
    })
    .slice(0, 5);

  const deficitVisible =
    periodTargetCalories !== null &&
    hasData &&
    (dayCount === 1 || coverageRatio >= MULTI_DAY_DEFICIT_COVERAGE_THRESHOLD);
  const deficitValue = deficitVisible ? periodTargetCalories - totals.calories : null;

  return {
    anchorDate: context.anchorDate,
    periodKind: context.periodKind,
    periodStart: context.startDate,
    periodEnd: context.endDate,
    periodDays: context.dayCount,
    average: {
      calories: Math.round(totals.calories / dayCount),
      protein: Math.round(totals.protein / dayCount),
      fat: Math.round(totals.fat / dayCount),
      carbs: Math.round(totals.carbs / dayCount),
    },
    total: {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      fat: Math.round(totals.fat),
      carbs: Math.round(totals.carbs),
    },
    deviations:
      periodTargetCalories !== null
        ? {
            calories: Math.round(totals.calories - periodTargetCalories),
          }
        : null,
    popularItem: topFoods[0]?.product_name ?? null,
    recommendations: [],
    dailyCalories: [...dailyCaloriesAccumulator.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, calories]) => ({ date, calories: Math.round(calories) })),
    calories: {
      total: Math.round(totals.calories),
      has_data: hasData,
    },
    macros: {
      protein_g: Math.round(totals.protein),
      fat_g: Math.round(totals.fat),
      carbs_g: Math.round(totals.carbs),
      has_data: hasData,
    },
    deficit: {
      value: deficitValue !== null ? Math.round(deficitValue) : null,
      has_data: hasData,
      is_visible: deficitVisible,
      target_calories: periodTargetCalories,
    },
    periodCoverage: {
      days_with_data: daysWithData,
      coverage_ratio: Number(coverageRatio.toFixed(4)),
    },
    topFoods,
    coverage: {
      included_canonical_count: includedCanonicalCount,
      included_recipe_snapshot_count: includedRecipeSnapshotCount,
      excluded_fallback_count: excludedFallbackCount,
      excluded_unresolved_count: excludedUnresolvedCount,
    },
  };
}

class ProgressNutritionService {
  constructor(private readonly deps: ProgressNutritionDeps) {}

  async getNutritionProgress(userId: string, anchorDate: string, period: NutritionProgressPeriod): Promise<NutritionStats> {
    const context = getAggregationContext(anchorDate, period);
    const [rows, goal] = await Promise.all([
      this.deps.diaryRepo.listByUserAndDateRange(userId, context.startDate, context.endDate),
      this.deps.goalRepo.getUserGoal(userId),
    ]);

    const canonicalFoodIds = [...new Set(rows.map((row) => row.canonical_food_id).filter((id): id is string => Boolean(id)))];
    const foodNames = await this.deps.foodsRepo.findNamesByIds(canonicalFoodIds);
    const foodNamesById = new Map(foodNames.map((item) => [item.id, item.name]));

    const calorieTarget =
      goal && Number.isFinite(goal.calories) && goal.calories > 0 ? goal.calories : null;

    return aggregateNutritionProgressForContext(rows, foodNamesById, context, calorieTarget);
  }

  async getNutritionProgressForRange(userId: string, startDate: string, endDate: string): Promise<NutritionStats> {
    const dayCount = getInclusiveDayCount(startDate, endDate);
    const periodKind: NutritionProgressPeriod = dayCount <= 1 ? 'day' : dayCount <= 7 ? 'week' : 'month';
    const context: NutritionAggregationContext = {
      anchorDate: endDate,
      periodKind,
      startDate,
      endDate,
      dayCount,
    };

    const [rows, goal] = await Promise.all([
      this.deps.diaryRepo.listByUserAndDateRange(userId, startDate, endDate),
      this.deps.goalRepo.getUserGoal(userId),
    ]);

    const canonicalFoodIds = [...new Set(rows.map((row) => row.canonical_food_id).filter((id): id is string => Boolean(id)))];
    const foodNames = await this.deps.foodsRepo.findNamesByIds(canonicalFoodIds);
    const foodNamesById = new Map(foodNames.map((item) => [item.id, item.name]));

    const calorieTarget =
      goal && Number.isFinite(goal.calories) && goal.calories > 0 ? goal.calories : null;

    return aggregateNutritionProgressForContext(rows, foodNamesById, context, calorieTarget);
  }
}

const defaultDeps: ProgressNutritionDeps = {
  diaryRepo: {
    async listByUserAndDateRange(userId: string, fromDate: string, toDate: string): Promise<DiaryNutritionRow[]> {
      if (!supabase) {
        throw new Error('Supabase не инициализирован');
      }
      const { data, error } = await supabase
        .from('food_diary_entries')
        .select('id,user_id,date,canonical_food_id,product_name,weight,calories,protein,fat,carbs,idempotency_key')
        .eq('user_id', userId)
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('date', { ascending: true });

      if (error) throw error;
      return (data as DiaryNutritionRow[] | null) ?? [];
    },
  },
  foodsRepo: {
    async findNamesByIds(foodIds: string[]): Promise<NutritionFoodNameRow[]> {
      if (!foodIds.length) return [];
      if (!supabase) {
        throw new Error('Supabase не инициализирован');
      }
      const { data, error } = await supabase
        .from('foods')
        .select('id,name')
        .in('id', foodIds);

      if (error) throw error;
      return (data as NutritionFoodNameRow[] | null) ?? [];
    },
  },
  goalRepo: {
    async getUserGoal(userId: string) {
      const goal = await goalService.getUserGoal(userId);
      return goal ? { calories: goal.calories } : null;
    },
  },
};

export const progressNutritionService = new ProgressNutritionService(defaultDeps);
export { ProgressNutritionService };
