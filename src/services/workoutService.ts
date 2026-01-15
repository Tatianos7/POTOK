import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';
import { WorkoutDay, WorkoutEntry, SelectedExercise } from '../types/workout';

class WorkoutService {
  /**
   * Получить или создать день тренировки
   */
  async getOrCreateWorkoutDay(userId: string, date: string): Promise<WorkoutDay> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован. Проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
    }

    // Преобразуем userId в UUID формат
    const uuidUserId = toUUID(userId);

    // Пытаемся найти существующий день
    const { data: existingDay, error: fetchError } = await supabase
      .from('workout_days')
      .select('*')
      .eq('user_id', uuidUserId)
      .eq('date', date)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[workoutService] Error fetching workout day:', fetchError);
      throw new Error(`Ошибка получения дня тренировки: ${fetchError.message}`);
    }

    if (existingDay) {
      return existingDay;
    }

    // Создаем новый день (UUID сгенерируется в БД через DEFAULT gen_random_uuid())
    const { data: newDay, error: createError } = await supabase
      .from('workout_days')
      .insert({
        user_id: uuidUserId,
        date: date,
      })
      .select('*')
      .single();

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

    // Преобразуем userId в UUID формат
    const uuidUserId = toUUID(userId);

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
      .eq('workout_day.user_id', uuidUserId)
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
    const entries = exercises.map(ex => ({
      workout_day_id: workoutDay.id,
      exercise_id: ex.exercise.id,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
    }));

    const { data, error } = await supabase
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
      `);

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

    return workoutEntries;
  }

  /**
   * Обновить запись тренировки
   */
  async updateWorkoutEntry(
    entryId: string,
    updates: { sets?: number; reps?: number; weight?: number }
  ): Promise<WorkoutEntry> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    try {
      const { data, error } = await supabase
        .from('workout_entries')
        .update(updates)
        .eq('id', entryId)
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
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Ошибка обновления записи');
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
   * Удалить запись тренировки
   */
  async deleteWorkoutEntry(entryId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован. Проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
    }

    const { error } = await supabase
      .from('workout_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      const errorMessage = error.message || 'Ошибка удаления записи';
      console.error('[workoutService] Error deleting entry:', error);
      
      if (error.code === '42501' || errorMessage.includes('row-level security')) {
        throw new Error('Ошибка доступа: обновите RLS политики в Supabase SQL Editor. Выполните команды из файла supabase/workout_schema.sql (строки 135-145)');
      }
      
      throw new Error(errorMessage);
    }
  }

}

export const workoutService = new WorkoutService();


