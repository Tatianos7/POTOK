import { supabase } from '../lib/supabaseClient';
import { aiTrustService } from './aiTrustService';

export interface AiFeedbackInput {
  aiType: 'ai_recommendations' | 'ai_meal_plans' | 'ai_training_plans';
  aiId: string;
  rating: number; // 1-5
  comment?: string;
}

class AiFeedbackService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[aiFeedbackService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async submitFeedback(userId: string, input: AiFeedbackInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    if (!Number.isFinite(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new Error('[aiFeedbackService] Invalid rating');
    }

    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('ai_feedback')
      .upsert(
        {
          user_id: sessionUserId,
          ai_type: input.aiType,
          ai_id: input.aiId,
          rating: Math.round(input.rating),
          comment: input.comment?.trim() || null,
        },
        { onConflict: 'user_id,ai_type,ai_id' }
      );

    if (error) {
      throw error;
    }

    const delta = input.rating >= 4 ? 2 : input.rating <= 2 ? -2 : 0;
    if (delta !== 0) {
      try {
        await aiTrustService.updateTrustScore(sessionUserId, delta);
      } catch (trustError) {
        console.error('[aiFeedbackService] Failed to update trust score:', trustError);
      }
    }
  }
}

export const aiFeedbackService = new AiFeedbackService();
