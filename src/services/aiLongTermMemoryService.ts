import { supabase } from '../lib/supabaseClient';

export interface LongTermMemoryInput {
  user_preferences?: Record<string, unknown> | null;
  rejected_patterns?: Record<string, unknown> | null;
  success_patterns?: Record<string, unknown> | null;
  injury_history?: Record<string, unknown> | null;
  food_intolerances?: Record<string, unknown> | null;
  psychological_triggers?: Record<string, unknown> | null;
}

class AiLongTermMemoryService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[aiLongTermMemoryService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async upsertMemory(userId: string, input: LongTermMemoryInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('ai_long_term_memory')
      .upsert(
        {
          user_id: sessionUserId,
          user_preferences: input.user_preferences ?? null,
          rejected_patterns: input.rejected_patterns ?? null,
          success_patterns: input.success_patterns ?? null,
          injury_history: input.injury_history ?? null,
          food_intolerances: input.food_intolerances ?? null,
          psychological_triggers: input.psychological_triggers ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      throw error;
    }
  }

  async getMemory(userId: string): Promise<LongTermMemoryInput | null> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('ai_long_term_memory')
      .select('*')
      .eq('user_id', sessionUserId)
      .maybeSingle();

    if (error) {
      return null;
    }

    return {
      user_preferences: data?.user_preferences ?? null,
      rejected_patterns: data?.rejected_patterns ?? null,
      success_patterns: data?.success_patterns ?? null,
      injury_history: data?.injury_history ?? null,
      food_intolerances: data?.food_intolerances ?? null,
      psychological_triggers: data?.psychological_triggers ?? null,
    };
  }
}

export const aiLongTermMemoryService = new AiLongTermMemoryService();
