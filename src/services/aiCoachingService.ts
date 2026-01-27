import { supabase } from '../lib/supabaseClient';
import type { UserState } from './userStateService';

export type CoachingType = 'motivation' | 'correction' | 'warning' | 'celebration' | 'habit_nudge' | 'recovery_alert';

export interface CoachingEventInput {
  type: CoachingType;
  trigger: string;
  confidence?: number | null;
  trustScoreUsed?: number | null;
  stateSnapshot?: UserState | null;
}

class AiCoachingService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[aiCoachingService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async createCoachingEvent(userId: string, input: CoachingEventInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('ai_coaching_events')
      .insert({
        user_id: sessionUserId,
        type: input.type,
        trigger: input.trigger,
        confidence: input.confidence ?? null,
        trust_score_used: input.trustScoreUsed ?? null,
        state_snapshot: input.stateSnapshot ?? null,
      });

    if (error) {
      throw error;
    }
  }
}

export const aiCoachingService = new AiCoachingService();
