import { supabase } from '../lib/supabaseClient';

export interface AiGuardResult {
  status: 'passed' | 'suppressed' | 'requires_review';
  reasons: string[];
}

export interface AiGuardInput {
  aiType: 'ai_recommendations' | 'ai_meal_plans' | 'ai_training_plans';
  aiId: string;
  content: string;
  context?: Record<string, unknown>;
}

const MEDICAL_KEYWORDS = ['диагноз', 'лечить', 'лекарств', 'болезн', 'симптом'];
const EXTREME_DIET_KEYWORDS = ['голодание', '0 калорий', 'экстремальная диета'];
const EXTREME_LOAD_KEYWORDS = ['200 кг', '250 кг', '300 кг'];

class AiGuardService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[aiGuardService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  evaluate(content: string): AiGuardResult {
    const text = content.toLowerCase();
    const reasons: string[] = [];

    if (MEDICAL_KEYWORDS.some((k) => text.includes(k))) {
      reasons.push('medical_claim');
    }
    if (EXTREME_DIET_KEYWORDS.some((k) => text.includes(k))) {
      reasons.push('extreme_diet');
    }
    if (EXTREME_LOAD_KEYWORDS.some((k) => text.includes(k))) {
      reasons.push('extreme_load');
    }

    if (reasons.includes('medical_claim')) {
      return { status: 'suppressed', reasons };
    }
    if (reasons.length > 0) {
      return { status: 'requires_review', reasons };
    }
    return { status: 'passed', reasons: [] };
  }

  async logGuardResult(userId: string, input: AiGuardInput, result: AiGuardResult): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('ai_guard_logs')
      .insert({
        user_id: sessionUserId,
        ai_type: input.aiType,
        ai_id: input.aiId,
        status: result.status,
        reasons: { reasons: result.reasons, context: input.context ?? null },
      });

    if (error) {
      throw error;
    }
  }
}

export const aiGuardService = new AiGuardService();
