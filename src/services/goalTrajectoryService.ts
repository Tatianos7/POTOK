import { supabase } from '../lib/supabaseClient';

export type TrajectoryStatus = 'on_track' | 'behind' | 'ahead';

export interface GoalTrajectoryInput {
  goalType: string;
  expectedWeightCurve?: Record<string, number> | null;
  expectedStrengthCurve?: Record<string, number> | null;
  expectedFatLossCurve?: Record<string, number> | null;
  status: TrajectoryStatus;
  deviation?: Record<string, unknown> | null;
}

class GoalTrajectoryService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[goalTrajectoryService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async upsertTrajectory(userId: string, input: GoalTrajectoryInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('goal_trajectory')
      .insert({
        user_id: sessionUserId,
        goal_type: input.goalType,
        expected_weight_curve: input.expectedWeightCurve ?? null,
        expected_strength_curve: input.expectedStrengthCurve ?? null,
        expected_fat_loss_curve: input.expectedFatLossCurve ?? null,
        status: input.status,
        deviation: input.deviation ?? null,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }
  }
}

export const goalTrajectoryService = new GoalTrajectoryService();
