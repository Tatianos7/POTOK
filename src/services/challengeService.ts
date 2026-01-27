import { supabase } from '../lib/supabaseClient';
import { userStateService } from './userStateService';

export interface Challenge {
  id: string;
  type: string;
  goal_metric: string;
  duration_days: number;
  difficulty: string;
  reward_xp: number;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  progress: number;
  status: 'active' | 'completed' | 'abandoned';
}

class ChallengeService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[challengeService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async listChallenges(): Promise<Challenge[]> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .order('duration_days', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Challenge[];
  }

  async joinChallenge(userId: string, challengeId: string): Promise<ChallengeParticipant> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const { data, error } = await supabase
      .from('challenge_participants')
      .upsert(
        {
          challenge_id: challengeId,
          user_id: sessionUserId,
          progress: 0,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'challenge_id,user_id' }
      )
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to join challenge');
    }

    return data as ChallengeParticipant;
  }

  async updateProgress(userId: string, challengeId: string, progress: number): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const nextProgress = Math.max(0, progress);

    const { error } = await supabase
      .from('challenge_participants')
      .update({ progress: nextProgress, updated_at: new Date().toISOString() })
      .eq('challenge_id', challengeId)
      .eq('user_id', sessionUserId);

    if (error) {
      throw error;
    }
  }

  async adaptDifficulty(userId: string, period: { fromDate: string; toDate: string }): Promise<string> {
    const state = await userStateService.buildState(userId, period);
    if ((state.fatigue_index ?? 0) > 0.7) return 'easy';
    if ((state.consistency_score ?? 0) < 0.4) return 'easy';
    if ((state.training_load_index ?? 0) > 60000) return 'hard';
    return 'medium';
  }
}

export const challengeService = new ChallengeService();
