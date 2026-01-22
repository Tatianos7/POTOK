import { supabase } from '../lib/supabaseClient';
import { WorkoutDay, WorkoutEntry, SelectedExercise } from '../types/workout';
import { aiTrainingPlansService, TrainingDayContext } from './aiTrainingPlansService';
import { goalService } from './goalService';
import { userStateService } from './userStateService';

class WorkoutService {
  private readonly MAX_WEIGHT = 500;
  private readonly MAX_REPS = 200;
  private readonly MAX_SETS = 50;
  private readonly MAX_VOLUME = 1000000;
  private async withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 200): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === attempts) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
    throw lastError;
  }

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован. Проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[workoutService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  private assertEntryNumbers(entry: { sets?: number; reps?: number; weight?: number }): void {
    const { sets, reps, weight } = entry;
    if (sets !== undefined && (!Number.isFinite(sets) || sets < 1)) {
      throw new Error('[workoutService] Invalid sets value');
    }
    if (reps !== undefined && (!Number.isFinite(reps) || reps < 0)) {
      throw new Error('[workoutService] Invalid reps value');
    }
    if (weight !== undefined && (!Number.isFinite(weight) || weight < 0)) {
      throw new Error('[workoutService] Invalid weight value');
    }
    if (sets !== undefined && sets > this.MAX_SETS) {
      throw new Error('[workoutService] Suspicious sets value');
    }
    if (reps !== undefined && reps > this.MAX_REPS) {
      throw new Error('[workoutService] Suspicious reps value');
    }
    if (weight !== undefined && weight > this.MAX_WEIGHT) {
      throw new Error('[workoutService] Suspicious weight value');
    }
  }

  private buildTrainingDayContext(date: string, entries: WorkoutEntry[], goals?: Awaited<ReturnType<typeof goalService.getUserGoal>>): TrainingDayContext {
    const totalVolume = entries.reduce((sum, entry) => sum + entry.sets * entry.reps * entry.weight, 0);
    const totalSets = entries.reduce((sum, entry) => sum + entry.sets, 0);
    const totalReps = entries.reduce((sum, entry) => sum + entry.reps, 0);

    return {
      date,
      totals: {
        volume: totalVolume,
        sets: totalSets,
        reps: totalReps,
        exercises: entries.length,
      },
      exercises: entries.map((entry) => ({
        canonical_exercise_id: entry.canonical_exercise_id ?? entry.exercise?.canonical_exercise_id ?? entry.exercise_id,
        movement_pattern: entry.exercise?.movement_pattern ?? null,
        energy_system: entry.exercise?.energy_system ?? null,
        sets: entry.sets,
        reps: entry.reps,
        weight: entry.weight,
        volume: entry.sets * entry.reps * entry.weight,
        muscles: entry.exercise?.muscles?.map((m) => m.name) || [],
      })),
      goals: goals ? {
        calories: goals.calories,
        protein: goals.protein,
        fat: goals.fat,
        carbs: goals.carbs,
      } : null,
    };
  }

  async closeDay(userId: string, date: string): Promise<void> {
    const entries = await this.getWorkoutEntries(userId, date);
    const goals = await goalService.getUserGoal(userId);
    const periodEnd = date;
    const periodStart = new Date(new Date(date).getTime() - 29 * 86400000).toISOString().split('T')[0];
    const userState = await userStateService.buildState(userId, { fromDate: periodStart, toDate: periodEnd });
    const context = { ...this.buildTrainingDayContext(date, entries, goals), user_state: userState };
    await aiTrainingPlansService.queueTrainingPlan(userId, context);
  }
  /**
   * Получить или создать день тренировки
   */
  async getOrCreateWorkoutDay(userId: string, date: string): Promise<WorkoutDay> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован. Проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
    }

    const sessionUserId = await this.getSessionUserId(userId);

    // UPSERT (user_id, date) — устраняет гонки при создании дня
    const { data: newDay, error: createError } = await this.withRetry(() =>
      supabase
        .from('workout_days')
        .upsert(
          {
            user_id: sessionUserId,
            date: date,
          },
          { onConflict: 'user_id,date' }
        )
        .select('*')
        .single()
    );

    if (createError || !newDay) {
      const errorMessage = createError?.message || 'Ошибка создания дня тренировки';
      console.error('[workoutService] Error creating workout day:', createError);
      
      if (createError?.code === '42501' || errorMessage.includes('row-level security')) {
        throw new Error('Ошибка доступа: обновите RLS политики в Supabase SQL Editor. Выполните команды из файла supabase/workout_schema.sql (строки 135-145)');
      }
      
      throw new Error(errorMessage);
    }

    return newDay;
  }

  /**
   * Получить все записи тренировки за день
   */
  async getWorkoutEntries(userId: string, date: string): Promise<WorkoutEntry[]> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован. Проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
    }

    const sessionUserId = await this.getSessionUserId(userId);

    const { data, error } = await supabase
      .from('workout_entries')
      .select(`
        *,
        exercise:exercises(
          *,
          category:exercise_categories(*),
          exercise_muscles(
            muscle:muscles(*)
          )
        ),
        workout_day:workout_days(*)
      `)
      .eq('workout_day.user_id', sessionUserId)
      .eq('workout_day.date', date)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[workoutService] Error fetching workout entries:', error);
      throw new Error(`Ошибка получения записей тренировки: ${error.message}`);
    }

    // Преобразуем данные
    const entries: WorkoutEntry[] = (data || []).map((entry: any) => ({
      id: entry.id,
      workout_day_id: entry.workout_day_id,
      exercise_id: entry.exercise_id,
      sets: entry.sets,
      reps: entry.reps,
      weight: entry.weight,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      exercise: entry.exercise ? {
        ...entry.exercise,
        muscles: entry.exercise.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [],
      } : undefined,
      workout_day: entry.workout_day,
    }));

    return entries;
  }

  /**
   * Добавить упражнения в тренировку
   */
  async addExercisesToWorkout(
    userId: string,
    date: string,
    exercises: SelectedExercise[]
  ): Promise<WorkoutEntry[]> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован. Проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
    }

    // Получаем или создаем день тренировки (UUID сгенерируется в БД)
    const workoutDay = await this.getOrCreateWorkoutDay(userId, date);

    // Создаем записи (UUID для каждой записи сгенерируется в БД через DEFAULT gen_random_uuid())
    exercises.forEach((ex) => {
      this.assertEntryNumbers({ sets: ex.sets, reps: ex.reps, weight: ex.weight });
    });

    const entries = exercises.map(ex => ({
      workout_day_id: workoutDay.id,
      exercise_id: ex.exercise.id,
      canonical_exercise_id: ex.exercise.canonical_exercise_id ?? ex.exercise.id,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
    }));
    const totalVolume = entries.reduce((sum, entry) => sum + entry.sets * entry.reps * entry.weight, 0);
    if (totalVolume > this.MAX_VOLUME) {
      throw new Error('[workoutService] Suspicious volume spike');
    }

    const { data, error } = await this.withRetry(() =>
      supabase
        .from('workout_entries')
        .insert(entries)
        .select(`
          *,
          exercise:exercises(
            *,
            category:exercise_categories(*),
            exercise_muscles(
              muscle:muscles(*)
            )
          )
        `)
    );

    if (error) {
      const errorMessage = error.message || 'Ошибка добавления упражнений';
      console.error('[workoutService] Error adding exercises:', error);
      
      if (error.code === '42501' || errorMessage.includes('row-level security')) {
        throw new Error('Ошибка доступа: обновите RLS политики в Supabase SQL Editor. Выполните команды из файла supabase/workout_schema.sql (строки 135-145)');
      }
      
      throw new Error(errorMessage);
    }

    // Преобразуем данные
    const workoutEntries: WorkoutEntry[] = (data || []).map((entry: any) => ({
      id: entry.id,
      workout_day_id: entry.workout_day_id,
      exercise_id: entry.exercise_id,
      canonical_exercise_id: entry.canonical_exercise_id ?? null,
      sets: entry.sets,
      reps: entry.reps,
      weight: entry.weight,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      exercise: entry.exercise ? {
        ...entry.exercise,
        muscles: entry.exercise.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [],
      } : undefined,
    }));

    try {
      await aiTrainingPlansService.markTrainingPlanOutdated(userId, workoutDay.date);
    } catch (aiError) {
      console.error('[workoutService] Error marking AI training plan outdated:', aiError);
    }

    return workoutEntries;
  }

  /**
   * Обновить запись тренировки
   */
  async updateWorkoutEntry(
    entryId: string,
    updates: { sets?: number; reps?: number; weight?: number },
    expectedUpdatedAt?: string
  ): Promise<WorkoutEntry> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    try {
      const sessionUserId = await this.getSessionUserId();
      this.assertEntryNumbers(updates);
      if (expectedUpdatedAt) {
        const { data: current, error: currentError } = await supabase
          .from('workout_entries')
          .select('updated_at')
          .eq('id', entryId)
          .single();
        if (currentError) {
          throw currentError;
        }
        if (current?.updated_at && current.updated_at !== expectedUpdatedAt) {
          throw new Error('[workoutService] Conflict detected: entry was updated');
        }
      }
      const { data, error } = await supabase
        .from('workout_entries')
        .update(updates)
        .eq('id', entryId)
        .select(`
          *,
          workout_day:workout_days(date),
          exercise:exercises(
            *,
            category:exercise_categories(*),
            exercise_muscles(
              muscle:muscles(*)
            )
          )
        `)
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Ошибка обновления записи');
      }

      if (data.workout_day?.date) {
        try {
          await aiTrainingPlansService.markTrainingPlanOutdated(sessionUserId, data.workout_day.date);
        } catch (aiError) {
          console.error('[workoutService] Error marking AI training plan outdated:', aiError);
        }
      }

      return {
        ...data,
        exercise: data.exercise ? {
          ...data.exercise,
          muscles: data.exercise.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [],
        } : undefined,
      };
    } catch (error) {
      console.error('[workoutService] Error:', error);
      throw error;
    }
  }

  /**
   * Получить прогресс по упражнениям за период
   */
  async getWorkoutProgress(
    userId: string,
    fromDate: string,
    toDate: string
  ): Promise<
    Array<{
      exercise_id: string;
      exercise_name: string;
      total_sets: number;
      total_reps: number;
      total_volume: number;
      last_date: string;
    }>
  > {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('workout_entries')
      .select(`
        sets,
        reps,
        weight,
        exercise:exercises(id,name),
        workout_day:workout_days(user_id, date)
      `)
      .eq('workout_day.user_id', sessionUserId)
      .gte('workout_day.date', fromDate)
      .lte('workout_day.date', toDate)
      .order('workout_day.date', { ascending: true });

    if (error) {
      throw error;
    }

    const progress = new Map<
      string,
      {
        exercise_id: string;
        exercise_name: string;
        total_sets: number;
        total_reps: number;
        total_volume: number;
        last_date: string;
      }
    >();

    (data || []).forEach((row: any) => {
      const exerciseName = row.exercise?.name || 'Unknown';
      const exerciseId = row.exercise?.id || exerciseName;
      const date = row.workout_day?.date || '';
      const sets = Number(row.sets) || 0;
      const reps = Number(row.reps) || 0;
      const weight = Number(row.weight) || 0;
      const volume = sets * reps * weight;

      const existing = progress.get(exerciseId);
      if (existing) {
        existing.total_sets += sets;
        existing.total_reps += reps;
        existing.total_volume += volume;
        if (date && date > existing.last_date) {
          existing.last_date = date;
        }
      } else {
        progress.set(exerciseId, {
          exercise_id: exerciseId,
          exercise_name: exerciseName,
          total_sets: sets,
          total_reps: reps,
          total_volume: volume,
          last_date: date,
        });
      }
    });

    return Array.from(progress.values());
  }

  /**
   * Удалить запись тренировки
   */
  async deleteWorkoutEntry(entryId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован. Проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
    }

    const sessionUserId = await this.getSessionUserId();

    const { data, error } = await supabase
      .from('workout_entries')
      .delete()
      .eq('id', entryId)
      .select('workout_day_id, workout_day:workout_days(date)')
      .single();

    if (error) {
      const errorMessage = error.message || 'Ошибка удаления записи';
      console.error('[workoutService] Error deleting entry:', error);
      
      if (error.code === '42501' || errorMessage.includes('row-level security')) {
        throw new Error('Ошибка доступа: обновите RLS политики в Supabase SQL Editor. Выполните команды из файла supabase/workout_schema.sql (строки 135-145)');
      }
      
      throw new Error(errorMessage);
    }

    if (data?.workout_day?.date) {
      try {
        await aiTrainingPlansService.markTrainingPlanOutdated(sessionUserId, data.workout_day.date);
      } catch (aiError) {
        console.error('[workoutService] Error marking AI training plan outdated:', aiError);
      }
    }
  }

}

export const workoutService = new WorkoutService();


