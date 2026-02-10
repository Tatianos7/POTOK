import { supabase } from '../lib/supabaseClient';
import { aiRecommendationsService, DayAnalysisContext } from './aiRecommendationsService';

export interface UserGoal {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  updated_at?: string;
}

class GoalService {
  private saveErrorLogged = false;
  private assertGoalValid(goal: UserGoal): void {
    const values = [goal.calories, goal.protein, goal.fat, goal.carbs];
    const invalid = values.some((value) => !Number.isFinite(value) || value < 0);
    if (invalid) {
      throw new Error('[goalService] Invalid goal values');
    }
  }

  private logSupabaseErrorOnce(context: string, error: any): void {
    if (this.saveErrorLogged) return;
    this.saveErrorLogged = true;
    console.warn('[goalService] Supabase error:', {
      context,
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      status: error?.status,
    });
  }

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[goalService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  // Get user goal from Supabase or localStorage
  async getUserGoal(userId: string): Promise<UserGoal | null> {
    if (!userId) {
      return null;
    }

    // Try Supabase first
    if (supabase) {
      try {
        const sessionUserId = await this.getSessionUserId(userId);
        const { data, error } = await supabase
          .from('user_goals')
          .select('*')
          .eq('user_id', sessionUserId)
          .maybeSingle();

        // Игнорируем ошибки 406 (Not Acceptable) и PGRST116 (no rows returned)
        if (error) {
          // PGRST116 = no rows returned - это нормально
          // 406 = Not Acceptable - может быть из-за RLS или других проблем, игнорируем
          if (error.code !== 'PGRST116' && error.code !== 'PGRST406') {
            console.error('[goalService] Supabase error:', error);
          }
        } else if (data) {
          const goal: UserGoal = {
            calories: Number(data.calories) || 0,
            protein: Number(data.protein) || 0,
            fat: Number(data.fat) || 0,
            carbs: Number(data.carbs) || 0,
            updated_at: data.updated_at,
          };
          return goal;
        }
      } catch (err) {
        // Игнорируем ошибки подключения, используем localStorage
        // Не логируем, чтобы не засорять консоль
      }
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(`goal_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const calories = Number(parsed.calories);
        const protein = Number(parsed.proteins ?? parsed.protein);
        const fat = Number(parsed.fats ?? parsed.fat);
        const carbs = Number(parsed.carbs);
        const hasValues = [calories, protein, fat, carbs].every((v) => Number.isFinite(v));
        if (hasValues) {
          return {
            calories,
            protein,
            fat,
            carbs,
          };
        }
      }
    } catch (error) {
      console.warn('[goalService] localStorage fallback failed:', error);
    }

    return null;
  }

  // Save user goal to Supabase and localStorage
  async saveUserGoal(userId: string, goal: UserGoal): Promise<void> {
    // Try to save to Supabase
    if (supabase) {
      try {
        this.assertGoalValid(goal);
        const sessionUserId = await this.getSessionUserId(userId);
        const { error } = await supabase
          .from('user_goals')
          .upsert({
            user_id: sessionUserId,
            calories: Math.round(goal.calories),
            protein: goal.protein,
            fat: goal.fat,
            carbs: goal.carbs,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (error) {
          this.logSupabaseErrorOnce('user_goals upsert', error);
        }

        const today = new Date().toISOString().split('T')[0];
        const context: DayAnalysisContext = {
          date: today,
          totals: {
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
            weight: 0,
          },
          meals: {
            breakfast: 0,
            lunch: 0,
            dinner: 0,
            snack: 0,
          },
          goals: {
            calories: Math.round(goal.calories),
            protein: goal.protein,
            fat: goal.fat,
            carbs: goal.carbs,
          },
        };

        try {
          await aiRecommendationsService.queueDayRecommendation(
            sessionUserId,
            context,
            `goal-${sessionUserId}-${today}`
          );
        } catch (queueError) {
          this.logSupabaseErrorOnce('ai_recommendations queue', queueError);
        }
      } catch (err) {
        this.logSupabaseErrorOnce('goalService save connection', err);
      }
    }

    // Always persist a local fallback for manual flow
    try {
      const existing = localStorage.getItem(`goal_${userId}`);
      const parsed = existing ? JSON.parse(existing) : {};
      const updated = {
        ...parsed,
        calories: Math.round(goal.calories).toString(),
        proteins: goal.protein.toString(),
        fats: goal.fat.toString(),
        carbs: goal.carbs.toString(),
      };
      localStorage.setItem(`goal_${userId}`, JSON.stringify(updated));
    } catch (error) {
      console.warn('[goalService] Failed to persist local goal cache:', error);
    }
  }

}

export const goalService = new GoalService();
