import { supabase } from '../lib/supabaseClient';

export type StreakType = 'nutrition' | 'training' | 'habits' | 'sleep';

export interface XPState {
  user_id: string;
  xp: number;
  level: number;
  rank?: string | null;
  updated_at?: string;
}

export interface StreakState {
  user_id: string;
  streak_type: StreakType;
  current_streak: number;
  best_streak: number;
  last_completed_date?: string | null;
  updated_at?: string;
}

export interface AchievementInput {
  key: string;
  title: string;
  description?: string;
}

const calcLevelFromXp = (xp: number): number => {
  if (xp < 0) return 1;
  return Math.floor(xp / 100) + 1;
};

class GamificationService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[gamificationService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async addXp(userId: string, amount: number): Promise<XPState> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { data: existing, error: existingError } = await supabase
      .from('user_xp')
      .select('xp, level, rank')
      .eq('user_id', sessionUserId)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    const currentXp = Number(existing?.xp ?? 0);
    const nextXp = Math.max(0, currentXp + Math.round(amount));
    const nextLevel = calcLevelFromXp(nextXp);

    const { data, error } = await supabase
      .from('user_xp')
      .upsert(
        {
          user_id: sessionUserId,
          xp: nextXp,
          level: nextLevel,
          rank: existing?.rank ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to update xp');
    }

    return data as XPState;
  }

  async updateStreak(userId: string, type: StreakType, date: string): Promise<StreakState> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { data: existing, error: existingError } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', sessionUserId)
      .eq('streak_type', type)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    const lastDate = existing?.last_completed_date;
    const nextDate = date;
    let currentStreak = existing?.current_streak ?? 0;
    const bestStreak = existing?.best_streak ?? 0;

    if (!lastDate) {
      currentStreak = 1;
    } else if (lastDate === nextDate) {
      // no change
    } else {
      const last = new Date(lastDate);
      const next = new Date(nextDate);
      const diffDays = Math.floor((next.getTime() - last.getTime()) / 86400000);
      if (diffDays === 1) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
    }

    const nextBest = Math.max(bestStreak, currentStreak);

    const { data, error } = await supabase
      .from('user_streaks')
      .upsert(
        {
          user_id: sessionUserId,
          streak_type: type,
          current_streak: currentStreak,
          best_streak: nextBest,
          last_completed_date: nextDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,streak_type' }
      )
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to update streak');
    }

    return data as StreakState;
  }

  async unlockAchievement(userId: string, input: AchievementInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { error } = await supabase
      .from('user_achievements')
      .upsert(
        {
          user_id: sessionUserId,
          achievement_key: input.key,
          title: input.title,
          description: input.description ?? null,
        },
        { onConflict: 'user_id,achievement_key' }
      );

    if (error) {
      throw error;
    }
  }
}

export const gamificationService = new GamificationService();
