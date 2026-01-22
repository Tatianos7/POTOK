import { supabase } from '../lib/supabaseClient';

export interface UserCohortInput {
  ageGroup?: string | null;
  goalType?: string | null;
  activityLevel?: string | null;
  bmiRange?: string | null;
  genderOpt?: string | null;
}

export interface PercentileResult {
  metric: string;
  percentile: number | null;
  cohortId?: string | null;
}

class SocialProofService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[socialProofService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async upsertUserCohort(userId: string, input: UserCohortInput): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('user_cohorts')
      .upsert(
        {
          user_id: sessionUserId,
          age_group: input.ageGroup ?? null,
          goal_type: input.goalType ?? null,
          activity_level: input.activityLevel ?? null,
          bmi_range: input.bmiRange ?? null,
          gender_opt: input.genderOpt ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      throw error;
    }
  }

  async getUserPercentiles(userId: string): Promise<PercentileResult[]> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('user_percentiles')
      .select('metric, percentile, cohort_id')
      .eq('user_id', sessionUserId)
      .order('metric', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((row: any) => ({
      metric: row.metric,
      percentile: row.percentile ?? null,
      cohortId: row.cohort_id ?? null,
    }));
  }

  async getCohortStats(cohortId: string): Promise<Record<string, any>[]> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase
      .from('cohort_stats')
      .select('metric,p25,p50,p75,p90,updated_at')
      .eq('cohort_id', cohortId)
      .order('metric', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }
}

export const socialProofService = new SocialProofService();
