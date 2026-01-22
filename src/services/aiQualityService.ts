import { supabase } from '../lib/supabaseClient';

export interface AiQualityInput {
  aiType: 'ai_recommendations' | 'ai_meal_plans' | 'ai_training_plans';
  aiId: string;
  confidenceScore?: number | null;
  relevanceScore?: number | null;
  notes?: Record<string, unknown> | null;
}

class AiQualityService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[aiQualityService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async recordQuality(userId: string, input: AiQualityInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('ai_quality_metrics')
      .insert({
        user_id: sessionUserId,
        ai_type: input.aiType,
        ai_id: input.aiId,
        confidence_score: input.confidenceScore ?? null,
        relevance_score: input.relevanceScore ?? null,
        notes: input.notes ?? null,
      });

    if (error) {
      throw error;
    }
  }
}

export const aiQualityService = new AiQualityService();
