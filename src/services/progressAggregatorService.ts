import { supabase } from '../lib/supabaseClient';
import { getProgressTrends, ProgressTrends } from './analyticsService';
import { goalService } from './goalService';
import { measurementsService } from './measurementsService';
import { computeEMA, computeSlope, TrendPoint } from '../utils/progressMetrics';
import type { ProgressExplainabilityDTO } from '../types/explainability';

export interface ProgressSnapshot {
  date: string;
  weight?: number | null;
  calories?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  volume?: number | null;
  photos?: number | null;
  habitsAdherence?: number | null;
  programAdherence?: number | null;
  targets?: {
    calories?: number | null;
    protein?: number | null;
    fat?: number | null;
    carbs?: number | null;
  };
}

export interface TrendSummary {
  periodStart: string;
  periodEnd: string;
  weightEma?: number | null;
  weightSlope?: number | null;
  volumeSlope?: number | null;
  avgCalories?: number | null;
  avgProtein?: number | null;
  calorieBalance?: number | null;
  proteinSufficiency?: number | null;
}

export interface ExplainabilityBundle {
  metric: string;
  decision_ref: string;
  data_sources: string[];
  confidence: number;
  safety_notes?: string[];
  trust_impact?: 'low' | 'medium' | 'high';
}

class ProgressAggregatorService {
  private readonly SNAPSHOT_KEY = 'potok_progress_snapshot';
  private readonly TRENDS_KEY = 'potok_progress_trends';

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }
    if (userId && userId !== data.user.id) {
      console.warn('[progressAggregator] Передан userId не совпадает с сессией');
    }
    return data.user.id;
  }

  private async getTrustScore(userId: string): Promise<number> {
    if (!supabase) return 50;
    const { data } = await supabase
      .from('ai_trust_scores')
      .select('trust_score')
      .eq('user_id', userId)
      .maybeSingle();
    return Number(data?.trust_score ?? 50);
  }

  private saveSnapshotToLocal(userId: string, snapshot: ProgressSnapshot): void {
    try {
      localStorage.setItem(`${this.SNAPSHOT_KEY}_${userId}_${snapshot.date}`, JSON.stringify(snapshot));
    } catch (error) {
      console.error('[progressAggregator] Error saving snapshot to localStorage', error);
    }
  }

  private loadSnapshotFromLocal(userId: string, date: string): ProgressSnapshot | null {
    try {
      const stored = localStorage.getItem(`${this.SNAPSHOT_KEY}_${userId}_${date}`);
      return stored ? (JSON.parse(stored) as ProgressSnapshot) : null;
    } catch (error) {
      console.error('[progressAggregator] Error loading snapshot from localStorage', error);
      return null;
    }
  }

  private saveTrendsToLocal(userId: string, periodKey: string, trends: ProgressTrends): void {
    try {
      localStorage.setItem(`${this.TRENDS_KEY}_${userId}_${periodKey}`, JSON.stringify(trends));
    } catch (error) {
      console.error('[progressAggregator] Error saving trends to localStorage', error);
    }
  }

  private loadTrendsFromLocal(userId: string, periodKey: string): ProgressTrends | null {
    try {
      const stored = localStorage.getItem(`${this.TRENDS_KEY}_${userId}_${periodKey}`);
      return stored ? (JSON.parse(stored) as ProgressTrends) : null;
    } catch (error) {
      console.error('[progressAggregator] Error loading trends from localStorage', error);
      return null;
    }
  }

  private async getHabitAdherence(userId: string, fromDate: string, toDate: string): Promise<number | null> {
    if (!supabase) return null;
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('habit_logs')
      .select('completed')
      .eq('user_id', sessionUserId)
      .gte('date', fromDate)
      .lte('date', toDate);
    if (error) return null;
    const logs = data || [];
    if (logs.length === 0) return null;
    const completed = logs.filter((l: any) => l.completed).length;
    return completed / logs.length;
  }

  private async getProgramAdherence(userId: string, fromDate: string, toDate: string): Promise<number | null> {
    if (!supabase) return null;
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('program_sessions')
      .select('status, day_date')
      .eq('user_id', sessionUserId)
      .gte('day_date', fromDate)
      .lte('day_date', toDate);
    if (error) return null;
    const sessions = data || [];
    const total = sessions.length;
    if (total === 0) return null;
    const completed = sessions.filter((s: any) => s.status === 'completed').length;
    return completed / total;
  }

  async progressSnapshot(userId: string, date: string): Promise<ProgressSnapshot> {
    const periodStart = new Date(new Date(date).getTime() - 29 * 86400000).toISOString().split('T')[0];
    const periodKey = `${periodStart}_${date}`;

    let trends: ProgressTrends | null = null;
    try {
      trends = await getProgressTrends(userId, periodStart, date);
      this.saveTrendsToLocal(userId, periodKey, trends);
    } catch (error) {
      trends = this.loadTrendsFromLocal(userId, periodKey);
    }

    const cachedSnapshot = this.loadSnapshotFromLocal(userId, date);
    const snapshot: ProgressSnapshot = {
      ...(cachedSnapshot ?? {}),
      date,
    };

    const targetGoal = await goalService.getUserGoal(userId).catch(() => null);
    snapshot.targets = targetGoal
      ? {
          calories: targetGoal.calories,
          protein: targetGoal.protein,
          fat: targetGoal.fat,
          carbs: targetGoal.carbs,
        }
      : undefined;

    if (trends) {
      const point = trends.points.find((p) => p.date === date);
      snapshot.weight = point?.weight ?? null;
      snapshot.calories = point?.calories ?? null;
      snapshot.protein = point?.protein ?? null;
      snapshot.fat = point?.fat ?? null;
      snapshot.carbs = point?.carbs ?? null;
      snapshot.volume = point?.volume ?? null;
    }

    const history = await measurementsService.getMeasurementHistory(userId).catch(() => []);
    const latest = history[0];
    if (latest) {
      const totalPhotos = (latest.photos?.length || 0) + (latest.additionalPhotos?.length || 0);
      snapshot.photos = totalPhotos;
    }

    snapshot.habitsAdherence = await this.getHabitAdherence(userId, periodStart, date);
    snapshot.programAdherence = await this.getProgramAdherence(userId, periodStart, date);

    this.saveSnapshotToLocal(userId, snapshot);
    return snapshot;
  }

  async trendSummary(userId: string, fromDate: string, toDate: string): Promise<TrendSummary> {
    const periodKey = `${fromDate}_${toDate}`;
    let trends: ProgressTrends | null = null;
    try {
      trends = await getProgressTrends(userId, fromDate, toDate);
      this.saveTrendsToLocal(userId, periodKey, trends);
    } catch (error) {
      trends = this.loadTrendsFromLocal(userId, periodKey);
    }

    const summary: TrendSummary = {
      periodStart: fromDate,
      periodEnd: toDate,
    };

    if (!trends || trends.points.length === 0) {
      return summary;
    }

    const weightPoints: TrendPoint[] = trends.points.map((p) => ({ date: p.date, value: p.weight ?? null }));
    const volumePoints: TrendPoint[] = trends.points.map((p) => ({ date: p.date, value: p.volume ?? null }));
    const ema = computeEMA(weightPoints);
    summary.weightEma = ema[ema.length - 1]?.value ?? null;
    summary.weightSlope = computeSlope(ema);
    summary.volumeSlope = computeSlope(volumePoints);

    const avgCalories =
      trends.points.reduce((sum, p) => sum + (Number(p.calories) || 0), 0) / trends.points.length;
    const avgProtein =
      trends.points.reduce((sum, p) => sum + (Number(p.protein) || 0), 0) / trends.points.length;
    summary.avgCalories = Number.isFinite(avgCalories) ? avgCalories : null;
    summary.avgProtein = Number.isFinite(avgProtein) ? avgProtein : null;

    const goal = await goalService.getUserGoal(userId).catch(() => null);
    if (goal) {
      summary.calorieBalance =
        summary.avgCalories !== null ? summary.avgCalories - (goal.calories || 0) : null;
      summary.proteinSufficiency =
        summary.avgProtein !== null && goal.protein
          ? summary.avgProtein / goal.protein
          : null;
    }

    return summary;
  }

  explainabilityBundle(metric: string, dataCoverage: number): ExplainabilityBundle {
    const confidence = Math.max(0.2, Math.min(1, dataCoverage));
    return {
      metric,
      decision_ref: `progress:${metric}`,
      data_sources: [
        'measurement_history',
        'food_diary_entries',
        'workout_entries',
        'user_goals',
        'habit_logs',
        'program_sessions',
      ],
      confidence,
      safety_notes: confidence < 0.5 ? ['Недостаточно данных, показатели могут быть неточными.'] : undefined,
      trust_impact: confidence < 0.5 ? 'low' : confidence < 0.8 ? 'medium' : 'high',
    };
  }

  async load(): Promise<void> {
    const userId = await this.getSessionUserId();
    const today = new Date().toISOString().split('T')[0];
    await this.progressSnapshot(userId, today);
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  async offlineSnapshot(): Promise<void> {
    return Promise.resolve();
  }

  async revalidate(): Promise<void> {
    await this.refresh();
  }

  async recover(): Promise<void> {
    await this.refresh();
  }

  async explain(): Promise<ProgressExplainabilityDTO> {
    const userId = await this.getSessionUserId();
    const today = new Date().toISOString().split('T')[0];
    const fromDate = new Date(new Date(today).getTime() - 29 * 86400000).toISOString().split('T')[0];

    let dataCoverage = 0.3;
    try {
      const trends = await getProgressTrends(userId, fromDate, today);
      dataCoverage = Math.min(1, Math.max(0.2, trends.points.length / 30));
    } catch (error) {
      dataCoverage = 0.3;
    }

    const bundle = this.explainabilityBundle('overview', dataCoverage);
    const trustScore = await this.getTrustScore(userId);

    return {
      source: 'progressAggregatorService',
      version: '1.0',
      data_sources: bundle.data_sources,
      confidence: bundle.confidence,
      trust_score: trustScore,
      decision_ref: bundle.decision_ref,
      safety_notes: bundle.safety_notes ?? [],
      trust_level: trustScore,
      safety_flags: bundle.confidence < 0.5 ? ['data_gap'] : [],
      premium_reason: undefined,
    };
  }
}

export const progressAggregatorService = new ProgressAggregatorService();
