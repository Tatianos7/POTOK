export type ProgressPeriodKey = '7d' | '14d' | '30d' | '3m' | '6m' | '1y' | 'custom';

export interface ProgressPeriod {
  key: ProgressPeriodKey;
  label: string;
  start: string;
  end: string;
  days: string[];
}

export type TrendDirection = 'up' | 'down' | 'flat';

export interface ProgressSectionResult<T> {
  status: 'ok' | 'empty' | 'error' | 'cached';
  data: T | null;
  message?: string;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface ProgressSummary {
  weightTrend?: number | null;
  strengthTrend?: number | null;
  avgCalories?: number | null;
  adherence?: number | null;
  coachInsight?: string | null;
}

export interface NutritionStats {
  average: MacroTotals;
  total: MacroTotals;
  deviations?: Partial<MacroTotals> | null;
  popularItem?: string | null;
  recommendations?: string[];
  dailyCalories?: Array<{ date: string; calories: number }>;
  anchorDate?: string;
  periodKind?: 'day' | 'week' | 'month';
  periodStart?: string;
  periodEnd?: string;
  periodDays?: number;
  calories?: {
    total: number;
    has_data: boolean;
  };
  macros?: {
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    has_data: boolean;
  };
  deficit?: {
    value: number | null;
    has_data: boolean;
    is_visible: boolean;
    target_calories: number | null;
  };
  periodCoverage?: {
    days_with_data: number;
    coverage_ratio: number;
  };
  topFoods?: Array<{
    canonical_food_id: string;
    product_name: string;
    total_weight_g: number;
    entry_count: number;
    total_calories: number;
  }>;
  coverage?: {
    included_canonical_count: number;
    included_recipe_snapshot_count: number;
    excluded_fallback_count: number;
    excluded_unresolved_count: number;
  };
}

export interface TrainingCell {
  sets: number;
  reps: number;
  weight: number;
  trend?: TrendDirection;
}

export interface TrainingRow {
  id: string;
  name: string;
  cells: Record<string, TrainingCell | null>;
  trend?: TrendDirection;
}

export interface TrainingStats {
  dates: string[];
  rows: TrainingRow[];
}

export interface MeasurementValue {
  value: number | null;
  trend?: TrendDirection;
}

export interface MeasurementsRow {
  date: string;
  values: Record<string, MeasurementValue>;
}

export interface MeasurementsTable {
  dates: string[];
  metrics: string[];
  rows: MeasurementsRow[];
}

export interface HabitItemStat {
  id: string;
  title: string;
  streak: number;
  adherence: number;
  trend?: TrendDirection;
}

export interface HabitsStats {
  totalHabits: number;
  completedHabits: number;
  adherence: number;
  streak: number;
  habits: HabitItemStat[];
}

export interface CoachRecommendations {
  items: string[];
}
