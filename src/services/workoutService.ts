import { supabase } from '../lib/supabaseClient';
import { WorkoutDay, WorkoutEntry, SelectedExercise } from '../types/workout';
import { aiTrainingPlansService, TrainingDayContext } from './aiTrainingPlansService';
import { goalService } from './goalService';
import { userStateService } from './userStateService';
import { convertWeightToKg } from '../utils/workoutUnits';
import { aggregateWorkoutEntries, calculateVolume } from '../utils/workoutMetrics';
import { coachRuntime } from './coachRuntime';

class WorkoutService {
  private readonly WORKOUTS_STORAGE_KEY = 'potok_workout_entries';
  private readonly MAX_WEIGHT = 500;
  private readonly MAX_REPS = 200;
  private readonly MAX_SETS = 50;
  private readonly MAX_VOLUME = 1000000;
  private schemaWarned = false;

  private async withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 200): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        // Stop retrying for schema-related errors (missing table/column/index); return error payload for graceful fallback
        try {
          const { isSchemaError } = await import('./dbUtils');
          if (isSchemaError(error)) {
            if (!this.schemaWarned) {
              console.warn('[workoutService] Schema error detected — operations will degrade until migration is applied');
              this.schemaWarned = true;
            }
            return { data: null, error } as unknown as T;
          }
        } catch (e) {
          // ignore
        }
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

  private buildIdempotencyKey(date: string, exerciseId: string): string {
    const safeExerciseId = exerciseId || 'unknown';
    return `${date}:${safeExerciseId}`;
  }

  private saveWorkoutsToLocalStorage(userId: string, date: string, entries: WorkoutEntry[]): void {
    try {
      const stored = localStorage.getItem(`${this.WORKOUTS_STORAGE_KEY}_${userId}`);
      const allEntries: Record<string, WorkoutEntry[]> = stored ? JSON.parse(stored) : {};
      allEntries[date] = entries;
      localStorage.setItem(`${this.WORKOUTS_STORAGE_KEY}_${userId}`, JSON.stringify(allEntries));
    } catch (error) {
      console.error('[workoutService] Error saving workouts to localStorage:', error);
    }
  }

  private getWorkoutsFromLocalStorage(userId: string, date: string): WorkoutEntry[] | null {
    try {
      const stored = localStorage.getItem(`${this.WORKOUTS_STORAGE_KEY}_${userId}`);
      if (!stored) return null;
      const allEntries: Record<string, WorkoutEntry[]> = JSON.parse(stored);
      return allEntries[date] || null;
    } catch (error) {
      console.error('[workoutService] Error loading workouts from localStorage:', error);
      return null;
    }
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
    const totals = aggregateWorkoutEntries(entries);

    return {
      date,
      totals: {
        volume: totals.volume,
        sets: totals.sets,
        reps: totals.reps,
        exercises: totals.exercises,
      },
      exercises: entries.map((entry) => ({
        canonical_exercise_id: entry.canonical_exercise_id ?? entry.exercise?.canonical_exercise_id ?? entry.exercise_id,
        movement_pattern: entry.exercise?.movement_pattern ?? null,
        energy_system: entry.exercise?.energy_system ?? null,
        sets: entry.sets,
        reps: entry.reps,
        weight: entry.weight,
        volume: calculateVolume(entry.sets, entry.reps, entry.weight),
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
    const context = {
      ...this.buildTrainingDayContext(date, entries, goals),
      user_state: (userState ?? {}) as unknown as Record<string, unknown>,
    };
    await aiTrainingPlansService.queueTrainingPlan(userId, context);

    await coachRuntime.handleUserEvent(
      {
        type: 'WorkoutCompleted',
        timestamp: new Date().toISOString(),
        payload: { date, entries: entries.length },
        confidence: 0.8,
        safetyClass: 'normal',
        trustImpact: 1,
      },
      {
        screen: 'Today',
        userMode: 'Manual',
        subscriptionState: 'Free',
      }
    );
  }
  /**
   * Получить или создать день тренировки
   */
  async getOrCreateWorkoutDay(userId: string, date: string): Promise<WorkoutDay> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован. Проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
    }

    const sessionUserId = await this.getSessionUserId(userId);
    const supabaseClient = supabase!;

    // UPSERT (user_id, date) — устраняет гонки при создании дня
    const { data: newDay, error: createError } = await this.withRetry(async () =>
      await supabaseClient
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

      try {
        const { isSchemaError } = await import('./dbUtils');
        if (createError && isSchemaError(createError)) {
          if (!this.schemaWarned) {
            console.warn('[workoutService] Schema error while creating workout day — falling back to local-only mode');
            this.schemaWarned = true;
          }
          return { id: `local-${date}`, user_id: sessionUserId, date } as unknown as WorkoutDay;
        }
      } catch (e) {
        // ignore import errors
      }

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
    // Приоритет: localStorage для мгновенного UI
    const local = this.getWorkoutsFromLocalStorage(userId, date);
    if (local) {
      // Фоновая синхронизация с Supabase
      void this.getWorkoutEntriesFromSupabase(userId, date).catch(() => undefined);
      return local;
    }

    return this.getWorkoutEntriesFromSupabase(userId, date);
  }

  private async getWorkoutEntriesFromSupabase(userId: string, date: string): Promise<WorkoutEntry[]> {
    if (!supabase) {
      console.warn('[workoutService] Supabase not available, returning empty workouts');
      return [];
    }

    let sessionUserId: string;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch (error) {
      console.warn('[workoutService] getWorkoutEntries: no active session, using local storage only');
      return this.getWorkoutsFromLocalStorage(userId, date) || [];
    }

    const { data: workoutDay, error: dayError } = await supabase
      .from('workout_days')
      .select('id')
      .eq('user_id', sessionUserId)
      .eq('date', date)
      .maybeSingle();

    if (dayError) {
      if (dayError.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout day:', dayError);
      }
      return [];
    }

    if (!workoutDay?.id) {
      return [];
    }

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
      .eq('workout_day_id', workoutDay.id)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout entries:', error);
      }
      return [];
    }

    // Преобразуем данные
    const entries: WorkoutEntry[] = (data || []).map((entry: any) => ({
      id: entry.id,
      workout_day_id: entry.workout_day_id,
      exercise_id: entry.exercise_id,
      canonical_exercise_id: entry.exercise?.canonical_exercise_id ?? entry.exercise_id ?? null,
      sets: entry.sets,
      reps: entry.reps,
      weight: Number(entry.weight) || 0,
      baseUnit: entry.base_unit ?? 'кг',
      displayUnit: entry.display_unit ?? 'кг',
      displayAmount: Number(entry.display_amount ?? entry.weight ?? 0),
      idempotencyKey: entry.idempotency_key ?? undefined,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      exercise: entry.exercise ? {
        ...entry.exercise,
        muscles: entry.exercise.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [],
      } : undefined,
      workout_day: entry.workout_day,
    }));

    this.saveWorkoutsToLocalStorage(sessionUserId, date, entries);
    try {
      window.dispatchEvent(
        new CustomEvent('workouts-synced', { detail: { date, entries } })
      );
    } catch {
      // ignore if window is not available
    }

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
    // Оптимистично обновляем localStorage (manual mode)
    const localExisting = this.getWorkoutsFromLocalStorage(userId, date) || [];
    const withKeys = exercises.map((ex) => {
      this.assertEntryNumbers({ sets: ex.sets, reps: ex.reps, weight: ex.weight });
      const key = this.buildIdempotencyKey(date, ex.exercise.id);
      const baseUnit = 'кг';
      const displayUnit = 'кг';
      const displayAmount = ex.weight;
      const baseWeight = convertWeightToKg(displayAmount, displayUnit);
      const existing = localExisting.find((entry) => entry.idempotencyKey === key);
      return {
        id: existing?.id || `local-${key}`,
        workout_day_id: existing?.workout_day_id || `local-${date}`,
        exercise_id: ex.exercise.id,
        canonical_exercise_id: ex.exercise.canonical_exercise_id ?? ex.exercise.id,
        sets: ex.sets,
        reps: ex.reps,
        weight: baseWeight,
        baseUnit,
        displayUnit,
        displayAmount,
        idempotencyKey: key,
        exercise: ex.exercise,
      } as WorkoutEntry;
    });

    const merged = [...localExisting];
    withKeys.forEach((entry) => {
      const index = merged.findIndex((e) => e.idempotencyKey === entry.idempotencyKey);
      if (index >= 0) {
        merged[index] = entry;
      } else {
        merged.push(entry);
      }
    });
    this.saveWorkoutsToLocalStorage(userId, date, merged);

    if (!supabase) {
      return merged;
    }
    const supabaseClient = supabase;

    // Получаем или создаем день тренировки (UUID сгенерируется в БД)
    let workoutDay: WorkoutDay;
    try {
      workoutDay = await this.getOrCreateWorkoutDay(userId, date);
    } catch (error) {
      console.warn('[workoutService] addExercisesToWorkout: no active session, using local storage only');
      return merged;
    }

    // Создаем записи (UUID для каждой записи сгенерируется в БД через DEFAULT gen_random_uuid())
    exercises.forEach((ex) => {
      this.assertEntryNumbers({ sets: ex.sets, reps: ex.reps, weight: ex.weight });
    });

    const entries = exercises.map(ex => ({
      workout_day_id: workoutDay.id,
      exercise_id: ex.exercise.id,
      sets: ex.sets,
      reps: ex.reps,
      weight: convertWeightToKg(ex.weight, 'кг'),
      base_unit: 'кг',
      display_unit: 'кг',
      display_amount: ex.weight,
      idempotency_key: this.buildIdempotencyKey(date, ex.exercise.id),
    }));
    const totalVolume = entries.reduce((sum, entry) => sum + calculateVolume(entry.sets, entry.reps, entry.weight), 0);
    if (totalVolume > this.MAX_VOLUME) {
      throw new Error('[workoutService] Suspicious volume spike');
    }

    const { data, error } = await this.withRetry(async () =>
      await supabaseClient
        .from('workout_entries')
        .upsert(entries, { onConflict: 'workout_day_id,idempotency_key' })
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

      try {
        const { isSchemaError } = await import('./dbUtils');
        if (isSchemaError(error)) {
          if (!this.schemaWarned) {
            console.warn('[workoutService] Schema error while upserting exercises — falling back to local-only mode');
            this.schemaWarned = true;
          }
          return merged; // return local-only merged entries
        }
      } catch (e) {
        // ignore
      }

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
      canonical_exercise_id: entry.exercise?.canonical_exercise_id ?? entry.exercise_id ?? null,
      sets: entry.sets,
      reps: entry.reps,
      weight: entry.weight,
      baseUnit: entry.base_unit ?? 'кг',
      displayUnit: entry.display_unit ?? 'кг',
      displayAmount: Number(entry.display_amount ?? entry.weight ?? 0),
      idempotencyKey: entry.idempotency_key ?? undefined,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      exercise: entry.exercise ? {
        ...entry.exercise,
        muscles: entry.exercise.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [],
      } : undefined,
    }));

    this.saveWorkoutsToLocalStorage(userId, date, workoutEntries);

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
    const { data: workoutDays, error: workoutDaysError } = await supabase
      .from('workout_days')
      .select('id, date')
      .eq('user_id', sessionUserId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true });

    if (workoutDaysError) {
      if (workoutDaysError.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout days:', workoutDaysError);
      }
      return [];
    }

    const dayIds = (workoutDays || []).map((day) => day.id).filter(Boolean);
    if (dayIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('workout_entries')
      .select(`
        sets,
        reps,
        weight,
        exercise:exercises(id,name),
        workout_day:workout_days(date)
      `)
      .in('workout_day_id', dayIds);

    if (error) {
      if (error.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout progress:', error);
      }
      return [];
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

    const workoutDayData = (data as any)?.workout_day;
    const workoutDate = Array.isArray(workoutDayData)
      ? workoutDayData?.[0]?.date
      : workoutDayData?.date;
    if (workoutDate) {
      try {
        await aiTrainingPlansService.markTrainingPlanOutdated(sessionUserId, workoutDate);
      } catch (aiError) {
        console.error('[workoutService] Error marking AI training plan outdated:', aiError);
      }
    }
  }

}

export const workoutService = new WorkoutService();


