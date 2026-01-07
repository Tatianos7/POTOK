import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';

export interface UserGoal {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  updated_at?: string;
}

class GoalService {
  private readonly GOAL_STORAGE_KEY = 'potok_user_goal';

  // Get user goal from Supabase or localStorage
  async getUserGoal(userId: string): Promise<UserGoal | null> {
    if (!userId) {
      return null;
    }

    // Try Supabase first
    if (supabase) {
      try {
        const uuidUserId = toUUID(userId);
        const { data, error } = await supabase
          .from('user_goals')
          .select('*')
          .eq('user_id', uuidUserId)
          .maybeSingle();

        // Игнорируем ошибки 406 (Not Acceptable) и PGRST116 (no rows returned)
        if (error) {
          // PGRST116 = no rows returned - это нормально
          // 406 = Not Acceptable - может быть из-за RLS или других проблем, игнорируем
          if (error.code !== 'PGRST116' && error.code !== 'PGRST406') {
            console.error('[goalService] Supabase error:', error);
          }
          // Fallback to localStorage
        } else if (data) {
          const goal: UserGoal = {
            calories: Number(data.calories) || 0,
            protein: Number(data.protein) || 0,
            fat: Number(data.fat) || 0,
            carbs: Number(data.carbs) || 0,
            updated_at: data.updated_at,
          };
          // Sync to localStorage for offline support
          this.saveGoalToLocalStorage(userId, goal);
          return goal;
        }
      } catch (err) {
        // Игнорируем ошибки подключения, используем localStorage
        // Не логируем, чтобы не засорять консоль
      }
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(`${this.GOAL_STORAGE_KEY}_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert to UserGoal format if needed
        if (parsed.calories || parsed.protein || parsed.fat || parsed.carbs) {
          return {
            calories: Number(parsed.calories) || 0,
            protein: Number(parsed.protein) || 0,
            fat: Number(parsed.fat) || 0,
            carbs: Number(parsed.carbs) || 0,
          };
        }
      }
    } catch (error) {
      console.error('[goalService] Error loading goal from localStorage:', error);
    }

    return null;
  }

  // Save user goal to Supabase and localStorage
  async saveUserGoal(userId: string, goal: UserGoal): Promise<void> {
    // Save to localStorage first (for offline support)
    this.saveGoalToLocalStorage(userId, goal);

    // Try to save to Supabase
    if (supabase) {
      try {
        const uuidUserId = toUUID(userId);
        const { error } = await supabase
          .from('user_goals')
          .upsert({
            user_id: uuidUserId,
            calories: Math.round(goal.calories),
            protein: goal.protein,
            fat: goal.fat,
            carbs: goal.carbs,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (error) {
          console.error('[goalService] Supabase save error:', error);
        }
      } catch (err) {
        console.error('[goalService] Supabase save connection error:', err);
      }
    }
  }

  // Helper: Save to localStorage
  private saveGoalToLocalStorage(userId: string, goal: UserGoal): void {
    try {
      localStorage.setItem(`${this.GOAL_STORAGE_KEY}_${userId}`, JSON.stringify(goal));
    } catch (error) {
      console.error('[goalService] Error saving goal to localStorage:', error);
    }
  }
}

export const goalService = new GoalService();

