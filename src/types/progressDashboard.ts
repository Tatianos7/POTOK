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
