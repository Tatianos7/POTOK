import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';
import { WorkoutDay, WorkoutEntry, SelectedExercise } from '../types/workout';

class WorkoutService {
  /**
   * Получить или создать день тренировки
   */
  async getOrCreateWorkoutDay(userId: string, date: string): Promise<WorkoutDay> {
    if (!supabase) {
      return this.getOrCreateWorkoutDayFromLocalStorage(userId, date);
    }

    try {
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
      }

      if (existingDay) {
        return existingDay;
      }

      // Создаем новый день
      const { data: newDay, error: createError } = await supabase
        .from('workout_days')
        .insert({
          user_id: uuidUserId,
          date: date,
        })
        .select('*')
        .single();

      if (createError || !newDay) {
        throw new Error(createError?.message || 'Ошибка создания дня тренировки');
      }

      return newDay;
    } catch (error) {
      console.error('[workoutService] Error:', error);
      return this.getOrCreateWorkoutDayFromLocalStorage(userId, date);
    }
  }

  /**
   * Получить все записи тренировки за день
   */
  async getWorkoutEntries(userId: string, date: string): Promise<WorkoutEntry[]> {
    if (!supabase) {
      return this.getWorkoutEntriesFromLocalStorage(userId, date);
    }

    try {
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
        return this.getWorkoutEntriesFromLocalStorage(userId, date);
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
    } catch (error) {
      console.error('[workoutService] Error:', error);
      return this.getWorkoutEntriesFromLocalStorage(userId, date);
    }
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
      return this.addExercisesToWorkoutInLocalStorage(userId, date, exercises);
    }

    try {
      // Получаем или создаем день тренировки
      const workoutDay = await this.getOrCreateWorkoutDay(userId, date);

      // Создаем записи
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
        throw new Error(error.message || 'Ошибка добавления упражнений');
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
    } catch (error) {
      console.error('[workoutService] Error:', error);
      return this.addExercisesToWorkoutInLocalStorage(userId, date, exercises);
    }
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
      return this.deleteWorkoutEntryFromLocalStorage(entryId);
    }

    try {
      const { error } = await supabase
        .from('workout_entries')
        .delete()
        .eq('id', entryId);

      if (error) {
        throw new Error(error.message || 'Ошибка удаления записи');
      }
    } catch (error) {
      console.error('[workoutService] Error:', error);
      this.deleteWorkoutEntryFromLocalStorage(entryId);
    }
  }

  // Fallback методы для localStorage
  private getOrCreateWorkoutDayFromLocalStorage(userId: string, date: string): WorkoutDay {
    const key = `workout_day_${userId}_${date}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }

      const newDay: WorkoutDay = {
        id: `workout_day_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        date: date,
      };

      localStorage.setItem(key, JSON.stringify(newDay));
      return newDay;
    } catch {
      return {
        id: `workout_day_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        date: date,
      };
    }
  }

  private getWorkoutEntriesFromLocalStorage(userId: string, date: string): WorkoutEntry[] {
    const key = `workout_entries_${userId}_${date}`;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private async addExercisesToWorkoutInLocalStorage(
    userId: string,
    date: string,
    exercises: SelectedExercise[]
  ): Promise<WorkoutEntry[]> {
    const key = `workout_entries_${userId}_${date}`;
    const existing = this.getWorkoutEntriesFromLocalStorage(userId, date);

    const newEntries: WorkoutEntry[] = exercises.map(ex => ({
      id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workout_day_id: `workout_day_${userId}_${date}`,
      exercise_id: ex.exercise.id,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      exercise: ex.exercise,
    }));

    const allEntries = [...existing, ...newEntries];
    localStorage.setItem(key, JSON.stringify(allEntries));
    return newEntries;
  }

  private deleteWorkoutEntryFromLocalStorage(entryId: string): void {
    // Простая реализация - удаляем из всех дат
    const keys = Object.keys(localStorage).filter(k => k.startsWith('workout_entries_'));
    keys.forEach(key => {
      try {
        const entries: WorkoutEntry[] = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = entries.filter(e => e.id !== entryId);
        localStorage.setItem(key, JSON.stringify(filtered));
      } catch {
        // Игнорируем ошибки
      }
    });
  }
}

export const workoutService = new WorkoutService();

