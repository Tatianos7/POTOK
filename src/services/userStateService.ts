import { supabase } from '../lib/supabaseClient';
import { getProgressTrends } from './analyticsService';

export interface UserState {
  user_id: string;
  current_weight: number | null;
  trend_weight_7d: number | null;
  trend_weight_30d: number | null;
  avg_calories: number | null;
  avg_protein: number | null;
  training_load_index: number | null;
  fatigue_index: number | null;
  adherence_score: number | null;
  recovery_score: number | null;
  consistency_score: number | null;
  updated_at?: string;
}

export interface UserStatePeriod {
  fromDate: string;
  toDate: string;
}

class UserStateService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[userStateService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  private calcAverage(values: Array<number | undefined>): number | null {
    const filtered = values.filter((v) => Number.isFinite(v)) as number[];
    if (filtered.length === 0) return null;
    return filtered.reduce((sum, v) => sum + v, 0) / filtered.length;
  }

  private async getHabitAdherence(userId: string, period: UserStatePeriod): Promise<number | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('habit_logs')
      .select('completed')
      .eq('user_id', userId)
      .gte('date', period.fromDate)
      .lte('date', period.toDate);

    if (error) {
      return null;
    }
    const logs = data || [];
    if (logs.length === 0) return null;
    const completed = logs.filter((l: any) => l.completed).length;
    return completed / logs.length;
  }

  private async getTrainingLoadIndex(userId: string, period: UserStatePeriod): Promise<number | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('workout_entries')
      .select('sets,reps,weight, workout_day:workout_days(user_id, date)')
      .eq('workout_day.user_id', userId)
      .gte('workout_day.date', period.fromDate)
      .lte('workout_day.date', period.toDate);

    if (error) return null;
    const volume = (data || []).reduce((sum: number, row: any) => {
      return sum + Number(row.sets || 0) * Number(row.reps || 0) * Number(row.weight || 0);
    }, 0);
    const days = Math.max(1, Math.floor((new Date(period.toDate).getTime() - new Date(period.fromDate).getTime()) / 86400000) + 1);
    return volume / days;
  }

  async buildState(userId: string, period: UserStatePeriod): Promise<UserState> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const trends = await getProgressTrends(sessionUserId, period.fromDate, period.toDate);
    const lastPoint = trends.points[trends.points.length - 1];

    const avgCalories = this.calcAverage(trends.points.map((p) => p.calories));
    const avgProtein = this.calcAverage(trends.points.map((p) => p.protein));
    const loadIndex = await this.getTrainingLoadIndex(sessionUserId, period);
    const adherence = await this.getHabitAdherence(sessionUserId, period);

    const fatigueIndex = loadIndex !== null ? Math.min(1, loadIndex / 100000) : null;
    const recoveryScore = loadIndex !== null ? Math.max(0, 1 - (loadIndex / 150000)) : null;
    const consistencyScore = adherence !== null ? adherence : null;

    return {
      user_id: sessionUserId,
      current_weight: lastPoint?.weight ?? null,
      trend_weight_7d: trends.weeklyDelta.weight ?? null,
      trend_weight_30d: trends.monthlyDelta.weight ?? null,
      avg_calories: avgCalories,
      avg_protein: avgProtein,
      training_load_index: loadIndex,
      fatigue_index: fatigueIndex,
      adherence_score: adherence,
      recovery_score: recoveryScore,
      consistency_score: consistencyScore,
    };
  }

  async updateState(userId: string, period: UserStatePeriod): Promise<UserState> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const state = await this.buildState(sessionUserId, period);

    const { error } = await supabase
      .from('user_state')
      .upsert({ ...state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    if (error) {
      throw error;
    }

    return state;
  }
}

export const userStateService = new UserStateService();
