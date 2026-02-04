import { supabase } from '../lib/supabaseClient';
import { mealService } from './mealService';
import { goalService } from './goalService';
import { measurementsService } from './measurementsService';
import { habitsService } from './habitsService';
import { progressAggregatorService } from './progressAggregatorService';
import {
  CoachRecommendations,
  HabitsStats,
  MacroTotals,
  MeasurementsTable,
  NutritionStats,
  ProgressPeriod,
  ProgressSectionResult,
  ProgressSummary,
  TrainingCell,
  TrainingRow,
  TrainingStats,
  TrendDirection,
} from '../types/progressDashboard';

type WorkoutEntryRow = {
  id: string;
  sets: number;
  reps: number;
  weight: number | null;
  workout_day: { date: string } | null;
  exercise: { name: string } | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const trendFromDelta = (delta: number, threshold = 0.1): TrendDirection => {
  if (delta > threshold) return 'up';
  if (delta < -threshold) return 'down';
  return 'flat';
};

class ProgressDashboardService {
  private readonly CACHE_PREFIX = 'potok_progress_dashboard';

  private cacheKey(userId: string, period: ProgressPeriod, section: string) {
    return `${this.CACHE_PREFIX}_${section}_${userId}_${period.start}_${period.end}`;
  }

  private saveCache<T>(userId: string, period: ProgressPeriod, section: string, payload: T): void {
    try {
      localStorage.setItem(this.cacheKey(userId, period, section), JSON.stringify(payload));
    } catch (error) {
      console.warn('[progressDashboardService] cache save failed', error);
    }
  }

  private loadCache<T>(userId: string, period: ProgressPeriod, section: string): T | null {
    try {
      const stored = localStorage.getItem(this.cacheKey(userId, period, section));
      return stored ? (JSON.parse(stored) as T) : null;
    } catch (error) {
      console.warn('[progressDashboardService] cache load failed', error);
      return null;
    }
  }

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }
    if (userId && userId !== data.user.id) {
      console.warn('[progressDashboardService] Передан userId не совпадает с сессией');
    }
    return data.user.id;
  }

  private toSectionResult<T>(data: T | null, message?: string, cached?: boolean): ProgressSectionResult<T> {
    if (data) {
      return { status: cached ? 'cached' : 'ok', data };
    }
    return { status: message ? 'error' : 'empty', data: null, message };
  }

  async getSummary(period: ProgressPeriod, userId?: string): Promise<ProgressSectionResult<ProgressSummary>> {
    const sessionUserId = await this.getSessionUserId(userId);
    try {
      const [snapshot, trends] = await Promise.all([
        progressAggregatorService.progressSnapshot(sessionUserId, period.end),
        progressAggregatorService.trendSummary(sessionUserId, period.start, period.end),
      ]);
      const summary: ProgressSummary = {
        weightTrend: trends.weightSlope ?? null,
        strengthTrend: trends.volumeSlope ?? null,
        avgCalories: trends.avgCalories ?? null,
        adherence: snapshot.habitsAdherence ?? snapshot.programAdherence ?? null,
        coachInsight: null,
      };
      this.saveCache(sessionUserId, period, 'summary', summary);
      return this.toSectionResult(summary);
    } catch (error) {
      const cached = this.loadCache<ProgressSummary>(sessionUserId, period, 'summary');
      if (cached) {
        return this.toSectionResult(cached, undefined, true);
      }
      return this.toSectionResult(null, 'Не удалось загрузить сводку.');
    }
  }

  async getNutritionStats(period: ProgressPeriod, userId?: string): Promise<ProgressSectionResult<NutritionStats>> {
    const sessionUserId = await this.getSessionUserId(userId);
    try {
      const mealsByPeriod = await mealService.getMealsByPeriod(sessionUserId, period.start, period.end);
      if (mealsByPeriod.length === 0) {
        return this.toSectionResult(null, undefined);
      }
      const totals: MacroTotals = mealsByPeriod.reduce(
        (acc, day) => {
          const dayTotals = mealService.calculateDayTotals(day);
          return {
            calories: acc.calories + dayTotals.calories,
            protein: acc.protein + dayTotals.protein,
            fat: acc.fat + dayTotals.fat,
            carbs: acc.carbs + dayTotals.carbs,
          };
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );
      const daysCount = mealsByPeriod.length || 1;
      const average: MacroTotals = {
        calories: Math.round(totals.calories / daysCount),
        protein: Math.round(totals.protein / daysCount),
        fat: Math.round(totals.fat / daysCount),
        carbs: Math.round(totals.carbs / daysCount),
      };
      const foodCounts = new Map<string, number>();
      mealsByPeriod.forEach((day) => {
        const entries = [...day.breakfast, ...day.lunch, ...day.dinner, ...day.snack];
        entries.forEach((entry) => {
          const name = entry.food?.name ?? entry.foodId;
          foodCounts.set(name, (foodCounts.get(name) ?? 0) + 1);
        });
      });
      const popularItem = [...foodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const goal = await goalService.getUserGoal(sessionUserId).catch(() => null);
      const deviations = goal
        ? {
            calories: average.calories - (goal.calories ?? 0),
            protein: average.protein - (goal.protein ?? 0),
            fat: average.fat - (goal.fat ?? 0),
            carbs: average.carbs - (goal.carbs ?? 0),
          }
        : null;
      const dailyCalories = mealsByPeriod.map((day) => {
        const dayTotals = mealService.calculateDayTotals(day);
        return { date: day.date, calories: Math.round(dayTotals.calories) };
      });
      const nutrition: NutritionStats = {
        average,
        total: {
          calories: Math.round(totals.calories),
          protein: Math.round(totals.protein),
          fat: Math.round(totals.fat),
          carbs: Math.round(totals.carbs),
        },
        deviations,
        popularItem,
        recommendations: [],
        dailyCalories,
      };
      this.saveCache(sessionUserId, period, 'nutrition', nutrition);
      return this.toSectionResult(nutrition);
    } catch (error) {
      const cached = this.loadCache<NutritionStats>(sessionUserId, period, 'nutrition');
      if (cached) {
        return this.toSectionResult(cached, undefined, true);
      }
      return this.toSectionResult(null, 'Не удалось загрузить питание.');
    }
  }

  async getTrainingStats(period: ProgressPeriod, userId?: string): Promise<ProgressSectionResult<TrainingStats>> {
    const sessionUserId = await this.getSessionUserId(userId);
    if (!supabase) {
      const cached = this.loadCache<TrainingStats>(sessionUserId, period, 'training');
      return cached ? this.toSectionResult(cached, undefined, true) : this.toSectionResult(null, 'Нет данных');
    }
    try {
      const { data, error } = await supabase
        .from('workout_entries')
        .select('id, sets, reps, weight, workout_day:workout_days(date, user_id), exercise:exercises(name)')
        .eq('workout_day.user_id', sessionUserId)
        .gte('workout_day.date', period.start)
        .lte('workout_day.date', period.end);

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? (data as unknown[]) : [];
      const byExercise = new Map<string, TrainingRow>();
      const datesSet = new Set<string>();

      rows.forEach((item) => {
        if (!isRecord(item)) return;
        const workoutDay = item['workout_day'];
        const exercise = item['exercise'];
        if (!isRecord(workoutDay) || !isRecord(exercise)) return;
        const date = workoutDay['date'];
        const name = exercise['name'];
        if (typeof date !== 'string' || typeof name !== 'string') return;
        datesSet.add(date);
        const sets = toNumber(item['sets']) ?? 0;
        const reps = toNumber(item['reps']) ?? 0;
        const weight = toNumber(item['weight']) ?? 0;
        const key = name;
        if (!byExercise.has(key)) {
          byExercise.set(key, {
            id: key,
            name,
            cells: {},
          });
        }
        const row = byExercise.get(key)!;
        const existing = row.cells[date];
        if (existing) {
          row.cells[date] = {
            sets: existing.sets + sets,
            reps: Math.round((existing.reps + reps) / 2),
            weight: Math.round((existing.weight + weight) / 2),
          };
        } else {
          row.cells[date] = { sets, reps, weight };
        }
      });

      const dates = [...datesSet].sort();
      const rowsData: TrainingRow[] = [...byExercise.values()].map((row) => {
        let prevWeight: number | null = null;
        dates.forEach((date) => {
          const cell = row.cells[date];
          if (!cell) return;
          if (prevWeight !== null) {
            cell.trend = trendFromDelta(cell.weight - prevWeight, 0.2);
          }
          prevWeight = cell.weight;
        });
        const first = dates.find((d) => row.cells[d]);
        const last = [...dates].reverse().find((d) => row.cells[d]);
        if (first && last && row.cells[first] && row.cells[last]) {
          row.trend = trendFromDelta(row.cells[last]!.weight - row.cells[first]!.weight, 0.2);
        }
        return row;
      });

      const training: TrainingStats = { dates, rows: rowsData };
      this.saveCache(sessionUserId, period, 'training', training);
      return this.toSectionResult(training);
    } catch (error) {
      const cached = this.loadCache<TrainingStats>(sessionUserId, period, 'training');
      if (cached) {
        return this.toSectionResult(cached, undefined, true);
      }
      return this.toSectionResult(null, 'Не удалось загрузить тренировки.');
    }
  }

  async getMeasurementsTable(period: ProgressPeriod, userId?: string): Promise<ProgressSectionResult<MeasurementsTable>> {
    const sessionUserId = await this.getSessionUserId(userId);
    try {
      const history = await measurementsService.getMeasurementHistory(sessionUserId);
      const filtered = history.filter((entry) => entry.date >= period.start && entry.date <= period.end);
      if (filtered.length === 0) {
        return this.toSectionResult(null, undefined);
      }
      const dates = filtered.map((entry) => entry.date).sort();
      const metricsSet = new Set<string>();
      filtered.forEach((entry) => {
        entry.measurements.forEach((m) => {
          metricsSet.add(m.name);
        });
      });
      const metrics = [...metricsSet];
      const weightIndex = metrics.findIndex((m) => m.toLowerCase().includes('вес') || m.toLowerCase() === 'weight');
      if (weightIndex > 0) {
        const [weight] = metrics.splice(weightIndex, 1);
        metrics.unshift(weight);
      }
      const rows = filtered
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((entry, index) => {
          const values: Record<string, { value: number | null; trend?: TrendDirection }> = {};
          metrics.forEach((metric) => {
            const current = entry.measurements.find((m) => m.name === metric);
            const currentValue = current ? toNumber(current.value) : null;
            const prev = index > 0 ? filtered[index - 1].measurements.find((m) => m.name === metric) : null;
            const prevValue = prev ? toNumber(prev.value) : null;
            const trend = prevValue !== null && currentValue !== null ? trendFromDelta(currentValue - prevValue) : undefined;
            values[metric] = { value: currentValue, trend };
          });
          return { date: entry.date, values };
        });
      const table: MeasurementsTable = { dates, metrics, rows };
      this.saveCache(sessionUserId, period, 'measurements', table);
      return this.toSectionResult(table);
    } catch (error) {
      const cached = this.loadCache<MeasurementsTable>(sessionUserId, period, 'measurements');
      if (cached) {
        return this.toSectionResult(cached, undefined, true);
      }
      return this.toSectionResult(null, 'Не удалось загрузить замеры.');
    }
  }

  async getHabitsStats(period: ProgressPeriod, userId?: string): Promise<ProgressSectionResult<HabitsStats>> {
    const sessionUserId = await this.getSessionUserId(userId);
    try {
      const habits = await habitsService.getHabitsForDate({ userId: sessionUserId, date: period.end });
      if (habits.length === 0) {
        return this.toSectionResult(null, undefined);
      }
      const stats = await Promise.all(
        habits.map(async (habit) => {
          const habitStats = await habitsService.getHabitStats({
            userId: sessionUserId,
            habitId: habit.id,
            fromDate: period.start,
            toDate: period.end,
          });
          return {
            id: habit.id,
            title: habit.title,
            streak: habitStats.streak,
            adherence: habitStats.adherence,
            trend: habitStats.adherence >= 0.7 ? 'up' : 'down',
          };
        })
      );
      const totalHabits = habits.length;
      const completedHabits = habits.filter((h) => h.completed).length;
      const adherence =
        totalHabits === 0 ? 0 : Math.round((stats.reduce((sum, item) => sum + item.adherence, 0) / totalHabits) * 100);
      const streak = Math.max(...stats.map((item) => item.streak), 0);
      const result: HabitsStats = {
        totalHabits,
        completedHabits,
        adherence,
        streak,
        habits: stats,
      };
      this.saveCache(sessionUserId, period, 'habits', result);
      return this.toSectionResult(result);
    } catch (error) {
      const cached = this.loadCache<HabitsStats>(sessionUserId, period, 'habits');
      if (cached) {
        return this.toSectionResult(cached, undefined, true);
      }
      return this.toSectionResult(null, 'Не удалось загрузить привычки.');
    }
  }

  async getCoachRecommendations(period: ProgressPeriod, userId?: string): Promise<ProgressSectionResult<CoachRecommendations>> {
    const sessionUserId = await this.getSessionUserId(userId);
    const cached = this.loadCache<CoachRecommendations>(sessionUserId, period, 'coach');
    if (cached) {
      return this.toSectionResult(cached, undefined, true);
    }
    const recommendations: CoachRecommendations = {
      items: [],
    };
    this.saveCache(sessionUserId, period, 'coach', recommendations);
    return this.toSectionResult(recommendations);
  }
}

export const progressDashboardService = new ProgressDashboardService();
