import { supabase } from '../lib/supabaseClient';

class AiTrustService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[aiTrustService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async getTrustScore(userId: string): Promise<number> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('ai_trust_scores')
      .select('trust_score')
      .eq('user_id', sessionUserId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return Number(data?.trust_score ?? 50);
  }

  async updateTrustScore(userId: string, delta: number): Promise<number> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const sessionUserId = await this.getSessionUserId(userId);
    const current = await this.getTrustScore(sessionUserId);
    const next = Math.min(100, Math.max(0, current + delta));

    const { error } = await supabase
      .from('ai_trust_scores')
      .upsert(
        {
          user_id: sessionUserId,
          trust_score: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      throw error;
    }

    return next;
  }
}

export const aiTrustService = new AiTrustService();
