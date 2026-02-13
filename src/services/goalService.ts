import { supabase } from '../lib/supabaseClient';

export interface UserGoal {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  goal_type?: string;
  current_weight?: number;
  target_weight?: number;
  start_date?: string;
  end_date?: string;
  months_to_goal?: number;
  bmr?: number;
  tdee?: number;
  training_place?: 'home' | 'gym';
  gender?: 'male' | 'female';
  age?: number;
  height?: number;
  lifestyle?: string;
  intensity?: string;
  updated_at?: string;
}

class GoalService {
  private saveErrorLogged = false;
  private readonly LOGGED_ERROR_KEYS = ['code', 'message', 'details', 'hint', 'status'] as const;
  private assertGoalValid(goal: UserGoal): void {
    const values = [goal.calories, goal.protein, goal.fat, goal.carbs];
    const invalid = values.some((value) => !Number.isFinite(value) || value < 0);
    if (invalid) {
      throw new Error('[goalService] Invalid goal values');
    }
  }

  private logSupabaseErrorOnce(context: string, error: unknown): void {
    if (this.saveErrorLogged) return;
    this.saveErrorLogged = true;
    const errorRecord =
      error && typeof error === 'object'
        ? (error as Partial<Record<(typeof this.LOGGED_ERROR_KEYS)[number], unknown>>)
        : {};
    console.warn('[goalService] Supabase error:', {
      context,
      code: errorRecord.code,
      message: errorRecord.message,
      details: errorRecord.details,
      hint: errorRecord.hint,
      status: errorRecord.status,
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

    let canUseLocalFallback = true;

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
          } else {
            // Legitimate "no data" from backend should not be replaced by stale local cache.
            canUseLocalFallback = false;
          }
        } else if (data) {
          const goal: UserGoal = {
            calories: Number(data.calories) || 0,
            protein: Number(data.protein) || 0,
            fat: Number(data.fat) || 0,
            carbs: Number(data.carbs) || 0,
            goal_type: data.goal_type || undefined,
            current_weight: data.current_weight ? Number(data.current_weight) : undefined,
            target_weight: data.target_weight ? Number(data.target_weight) : undefined,
            start_date: data.start_date || undefined,
            end_date: data.end_date || undefined,
            months_to_goal: data.months_to_goal ? Number(data.months_to_goal) : undefined,
            bmr: data.bmr ? Number(data.bmr) : undefined,
            tdee: data.tdee ? Number(data.tdee) : undefined,
            training_place: data.training_place === 'gym' ? 'gym' : 'home',
            gender: data.gender === 'male' ? 'male' : data.gender === 'female' ? 'female' : undefined,
            age: data.age ? Number(data.age) : undefined,
            height: data.height ? Number(data.height) : undefined,
            lifestyle: data.lifestyle || undefined,
            intensity: data.intensity || undefined,
            updated_at: data.updated_at,
          };
          return goal;
        } else {
          canUseLocalFallback = false;
          return null;
        }
      } catch (err) {
        // Игнорируем ошибки подключения, используем localStorage
        // Не логируем, чтобы не засорять консоль
      }
    }

    if (!canUseLocalFallback) {
      return null;
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
            goal_type: parsed.goalType || undefined,
            current_weight: parsed.currentWeight ? Number(parsed.currentWeight) : undefined,
            target_weight: parsed.targetWeight ? Number(parsed.targetWeight) : undefined,
            start_date: parsed.startDate || undefined,
            end_date: parsed.endDate || undefined,
            months_to_goal: parsed.monthsToGoal ? Number(parsed.monthsToGoal) : undefined,
            bmr: parsed.bmr ? Number(parsed.bmr) : undefined,
            tdee: parsed.tdee ? Number(parsed.tdee) : undefined,
            training_place: parsed.trainingPlace === 'gym' ? 'gym' : 'home',
            gender: parsed.gender === 'male' ? 'male' : parsed.gender === 'female' ? 'female' : undefined,
            age: parsed.age ? Number(parsed.age) : undefined,
            height: parsed.height ? Number(parsed.height) : undefined,
            lifestyle: parsed.lifestyle || undefined,
            intensity: parsed.intensity || undefined,
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
        interface UserGoalUpsertPayload {
          user_id: string;
          calories: number;
          protein: number;
          fat: number;
          carbs: number;
          updated_at: string;
          goal_type?: string;
          current_weight?: number;
          target_weight?: number;
          start_date?: string;
          end_date?: string;
          months_to_goal?: number;
          bmr?: number;
          tdee?: number;
          training_place?: 'home' | 'gym';
          gender?: 'male' | 'female';
          age?: number;
          height?: number;
          lifestyle?: string;
          intensity?: string;
        }

        const payload: UserGoalUpsertPayload = {
          user_id: sessionUserId,
          calories: Math.round(goal.calories),
          protein: goal.protein,
          fat: goal.fat,
          carbs: goal.carbs,
          updated_at: new Date().toISOString(),
        };
        if (goal.goal_type !== undefined) payload.goal_type = goal.goal_type;
        if (goal.current_weight !== undefined) payload.current_weight = goal.current_weight;
        if (goal.target_weight !== undefined) payload.target_weight = goal.target_weight;
        if (goal.start_date !== undefined) payload.start_date = goal.start_date;
        if (goal.end_date !== undefined) payload.end_date = goal.end_date;
        if (goal.months_to_goal !== undefined) payload.months_to_goal = goal.months_to_goal;
        if (goal.bmr !== undefined) payload.bmr = goal.bmr;
        if (goal.tdee !== undefined) payload.tdee = goal.tdee;
        if (goal.training_place !== undefined) payload.training_place = goal.training_place;
        if (goal.gender !== undefined) payload.gender = goal.gender;
        if (goal.age !== undefined) payload.age = goal.age;
        if (goal.height !== undefined) payload.height = goal.height;
        if (goal.lifestyle !== undefined) payload.lifestyle = goal.lifestyle;
        if (goal.intensity !== undefined) payload.intensity = goal.intensity;
        const { error } = await supabase
          .from('user_goals')
          .upsert(payload, {
            onConflict: 'user_id',
          });

        if (error) {
          this.logSupabaseErrorOnce('user_goals upsert', error);
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
        goalType: goal.goal_type ?? parsed.goalType,
        currentWeight: goal.current_weight?.toString() ?? parsed.currentWeight,
        targetWeight: goal.target_weight?.toString() ?? parsed.targetWeight,
        startDate: goal.start_date ?? parsed.startDate,
        endDate: goal.end_date ?? parsed.endDate,
        monthsToGoal: goal.months_to_goal ?? parsed.monthsToGoal,
        bmr: goal.bmr ?? parsed.bmr,
        tdee: goal.tdee ?? parsed.tdee,
        trainingPlace: goal.training_place ?? parsed.trainingPlace ?? 'home',
        gender: goal.gender ?? parsed.gender,
        age: goal.age ?? parsed.age,
        height: goal.height ?? parsed.height,
        lifestyle: goal.lifestyle ?? parsed.lifestyle,
        intensity: goal.intensity ?? parsed.intensity,
      };
      localStorage.setItem(`goal_${userId}`, JSON.stringify(updated));
    } catch (error) {
      console.warn('[goalService] Failed to persist local goal cache:', error);
    }
  }

}

export const goalService = new GoalService();
