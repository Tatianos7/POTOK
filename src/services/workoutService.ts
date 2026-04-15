import { supabase } from '../lib/supabaseClient';
import {
  WorkoutDay,
  WorkoutEntry,
  SelectedExercise,
  WorkoutHistoryDaySummary,
  WorkoutProgressObservation,
  WorkoutMetricType,
  WorkoutMetricUnit,
} from '../types/workout';
import { aiTrainingPlansService, TrainingDayContext } from './aiTrainingPlansService';
import { goalService } from './goalService';
import { userStateService } from './userStateService';
import { convertWeightToKg } from '../utils/workoutUnits';
import { aggregateWorkoutEntries, calculateVolume } from '../utils/workoutMetrics';
import { coachRuntime } from './coachRuntime';
import { clearWorkoutEntriesForDay, removeWorkoutEntryFromList, updateWorkoutEntryInList } from '../utils/workoutDiaryMutations';
import {
  getWorkoutMetricUnit,
  normalizeWorkoutMetricType,
  normalizeWorkoutMetricUnit,
  normalizeWorkoutMetricValue,
} from '../utils/workoutEntryMetric';

type WorkoutHistoryAggregateRow = {
  workout_day_id: string;
  date: string;
  sets: number;
  reps: number;
  weight: number;
  exercise_id?: string | null;
};

type WorkoutEntryUpdatePatch = {
  sets?: number;
  reps?: number;
  weight?: number;
  base_unit?: string | null;
  display_amount?: number;
  display_unit?: string | null;
  metric_type?: WorkoutMetricType;
};

type WorkoutProgressObservationRow = {
  id?: string | null;
  workout_day_id?: string | null;
  created_at?: string | null;
  exercise_id?: string | null;
  sets?: number | string | null;
  reps?: number | string | null;
  weight?: number | string | null;
  exercise?: {
    id?: string | null;
    name?: string | null;
    canonical_exercise_id?: string | null;
  } | null;
};

type WorkoutEntryWriteRow = {
  workout_day_id: string;
  exercise_id: string;
  metric_type?: WorkoutMetricType;
  sets: number;
  reps: number;
  weight: number;
  base_unit: string | null;
  display_unit: string | null;
  display_amount: number;
  idempotency_key: string;
};

type PersistedWorkoutEntryResult = {
  data: any[] | null;
  error: { code?: string | null; message?: string | null; details?: string | null } | null;
};

type WorkoutMetricTypeSchemaCapabilityCache = {
  available: boolean;
  checkedAt: number;
};

const WORKOUT_METRIC_TYPE_SCHEMA_CACHE_KEY = 'potok_workout_metric_type_schema_capability';
const WORKOUT_METRIC_TYPE_SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000;

export function isMetricTypeSchemaCacheError(error: { message?: string | null; details?: string | null } | null | undefined): boolean {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return message.includes('metric_type') && (
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('column')
  );
}

export function isWorkoutMetricReadSchemaError(error: { message?: string | null; details?: string | null } | null | undefined): boolean {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  const referencesMetricColumns = (
    message.includes('metric_type') ||
    message.includes('display_unit') ||
    message.includes('display_amount') ||
    message.includes('base_unit')
  );

  return referencesMetricColumns && (
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('column')
  );
}

export function getWorkoutProgressEntryDetailsSelectClause(metricSchemaAvailable: boolean): string {
  const metricColumns = metricSchemaAvailable
    ? `
        metric_type,
        base_unit,
        display_unit,
        display_amount,
      `
    : '';

  return `
        id,
        workout_day_id,
        exercise_id,
        ${metricColumns}
        sets,
        reps,
        weight,
        idempotency_key,
        created_at,
        updated_at,
        exercise:exercises(id,name),
        workout_day:workout_days(id,date)
      `;
}

export function stripMetricTypeFromLegacyWorkoutWriteRows(rows: WorkoutEntryWriteRow[]): Array<Omit<WorkoutEntryWriteRow, 'metric_type'>> {
  return rows.map(({ metric_type: _metricType, ...row }) => {
    const fallbackValue = Number(row.display_amount ?? row.weight ?? 0) || 0;

    return {
      ...row,
      weight: fallbackValue,
      base_unit: 'кг',
      display_unit: 'кг',
      display_amount: fallbackValue,
    };
  });
}

export function stripMetricTypeFromLegacyWorkoutUpdatePatch(patch: WorkoutEntryUpdatePatch): WorkoutEntryUpdatePatch {
  const { metric_type: _metricType, ...rest } = patch;
  const fallbackValue = Number(rest.display_amount ?? rest.weight ?? 0) || 0;

  return {
    ...rest,
    weight: fallbackValue,
    display_amount: fallbackValue,
    display_unit: 'кг',
  };
}

export function readCachedMetricTypeSchemaCapability(
  rawValue: string | null,
  now = Date.now(),
  ttlMs = WORKOUT_METRIC_TYPE_SCHEMA_CACHE_TTL_MS,
): boolean | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as WorkoutMetricTypeSchemaCapabilityCache;
    if (
      typeof parsed.available !== 'boolean' ||
      typeof parsed.checkedAt !== 'number' ||
      now - parsed.checkedAt > ttlMs
    ) {
      return null;
    }
    return parsed.available;
  } catch {
    return null;
  }
}

export function serializeMetricTypeSchemaCapability(
  available: boolean,
  checkedAt = Date.now(),
): string {
  return JSON.stringify({ available, checkedAt });
}

export function buildWorkoutHistoryDaySummaries(rows: WorkoutHistoryAggregateRow[]): WorkoutHistoryDaySummary[] {
  const dayMap = new Map<string, WorkoutHistoryDaySummary & { exerciseIds: Set<string> }>();

  rows.forEach((row) => {
    if (!row.workout_day_id || !row.date) return;

    const current = dayMap.get(row.workout_day_id) ?? {
      workout_day_id: row.workout_day_id,
      date: row.date,
      exercise_count: 0,
      total_sets: 0,
      total_volume: 0,
      exerciseIds: new Set<string>(),
    };

    const sets = Number(row.sets) || 0;
    const reps = Number(row.reps) || 0;
    const weight = Number(row.weight) || 0;
    const exerciseId = row.exercise_id || null;

    current.total_sets += sets;
    current.total_volume += calculateVolume(sets, reps, weight);

    if (exerciseId && !current.exerciseIds.has(exerciseId)) {
      current.exerciseIds.add(exerciseId);
      current.exercise_count += 1;
    }

    dayMap.set(row.workout_day_id, current);
  });

  return Array.from(dayMap.values())
    .map(({ exerciseIds: _exerciseIds, ...summary }) => summary)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function buildWorkoutEntryUpdatePatch(
  updates: { sets?: number; reps?: number; weight?: number; metricType?: WorkoutMetricType; metricUnit?: WorkoutMetricUnit },
): WorkoutEntryUpdatePatch {
  const patch: WorkoutEntryUpdatePatch = {};
  const metricType = normalizeWorkoutMetricType(updates.metricType);
  if (updates.sets !== undefined) {
    patch.sets = updates.sets;
  }
  if (updates.reps !== undefined) {
    patch.reps = updates.reps;
  }
  if (updates.weight !== undefined) {
    const value = normalizeWorkoutMetricValue(metricType, updates.weight);
    patch.weight = value;
    patch.display_amount = value;
  }
  if (updates.metricType !== undefined) {
    patch.metric_type = metricType;
    patch.base_unit = getWorkoutMetricUnit(metricType, updates.metricUnit) || null;
    patch.display_unit = getWorkoutMetricUnit(metricType, updates.metricUnit) || null;
    if (metricType === 'none') {
      patch.weight = 0;
      patch.display_amount = 0;
    }
  } else if (updates.metricUnit !== undefined) {
    patch.base_unit = getWorkoutMetricUnit(metricType, updates.metricUnit) || null;
    patch.display_unit = getWorkoutMetricUnit(metricType, updates.metricUnit) || null;
  }
  return patch;
}

export function buildWorkoutProgressObservations(
  rows: WorkoutProgressObservationRow[],
  dayDateMap: Map<string, string>,
): WorkoutProgressObservation[] {
  const observations: WorkoutProgressObservation[] = [];

  rows.forEach((row) => {
    const exerciseId = String(row.exercise?.id ?? row.exercise_id ?? '').trim();
    const exerciseName = String(row.exercise?.name ?? 'Unknown').trim() || 'Unknown';
    const canonicalExerciseId = String(row.exercise?.canonical_exercise_id ?? '').trim();
    const entryId = String(row.id ?? '').trim();
    const workoutDayId = typeof row.workout_day_id === 'string' ? row.workout_day_id : '';
    const date = dayDateMap.get(workoutDayId) ?? '';
    const exerciseGroupKey = canonicalExerciseId || exerciseId || exerciseName;

    if (!exerciseGroupKey || !exerciseId || !entryId || !date) {
      return;
    }

    observations.push({
      exerciseGroupKey,
      exerciseId,
      exerciseName,
      date,
      entryId,
      createdAt: typeof row.created_at === 'string' ? row.created_at : undefined,
      sets: Number(row.sets) || 0,
      reps: Number(row.reps) || 0,
      weight: Number(row.weight) || 0,
    });
  });

  return observations.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    (a.createdAt ?? '').localeCompare(b.createdAt ?? '') ||
    a.entryId.localeCompare(b.entryId),
  );
}

class WorkoutService {
  private readonly WORKOUTS_STORAGE_KEY = 'potok_workout_entries';
  private readonly MAX_WEIGHT = 500;
  private readonly MAX_REPS = 200;
  private readonly MAX_SETS = 50;
  private readonly MAX_VOLUME = 1000000;
  private schemaWarned = false;
  private metricTypeSchemaAvailable: boolean | null = null;
  private metricTypeFallbackWarned = false;

  private warnMetricTypeSchemaFallback() {
    if (this.metricTypeFallbackWarned) return;
    console.warn('[workoutService] metric_type column is not available yet; falling back to legacy weight save contract');
    this.metricTypeFallbackWarned = true;
  }

  private getCachedMetricTypeSchemaCapability(): boolean | null {
    if (this.metricTypeSchemaAvailable !== null) {
      return this.metricTypeSchemaAvailable;
    }

    try {
      const cached = readCachedMetricTypeSchemaCapability(
        localStorage.getItem(WORKOUT_METRIC_TYPE_SCHEMA_CACHE_KEY),
      );
      this.metricTypeSchemaAvailable = cached;
      return cached;
    } catch {
      return this.metricTypeSchemaAvailable;
    }
  }

  private persistMetricTypeSchemaCapability(available: boolean) {
    this.metricTypeSchemaAvailable = available;

    try {
      localStorage.setItem(
        WORKOUT_METRIC_TYPE_SCHEMA_CACHE_KEY,
        serializeMetricTypeSchemaCapability(available),
      );
    } catch {
      // ignore cache persistence failures
    }
  }

  private async upsertWorkoutEntriesWithMetricFallback(
    rows: WorkoutEntryWriteRow[],
    selectClause: string,
  ): Promise<PersistedWorkoutEntryResult> {
    if (!supabase) {
      return { data: null, error: { message: 'Supabase не инициализирован' } };
    }
    const supabaseClient = supabase;

    const usesLegacyWrite = this.getCachedMetricTypeSchemaCapability() === false;
    const writeRows = usesLegacyWrite ? stripMetricTypeFromLegacyWorkoutWriteRows(rows) : rows;

    const attempt = async (payload: typeof writeRows) =>
      await this.withRetry(async () =>
        await supabaseClient
          .from('workout_entries')
          .upsert(payload, { onConflict: 'workout_day_id,idempotency_key' })
          .select(selectClause),
      );

    let result = await attempt(writeRows);
    if (!result.error) {
      if (!usesLegacyWrite) {
        this.persistMetricTypeSchemaCapability(true);
      }
      return result;
    }

    if (isMetricTypeSchemaCacheError(result.error) && this.getCachedMetricTypeSchemaCapability() !== false) {
      this.persistMetricTypeSchemaCapability(false);
      this.warnMetricTypeSchemaFallback();
      result = await attempt(stripMetricTypeFromLegacyWorkoutWriteRows(rows));
    }

    return result;
  }

  private async insertWorkoutEntriesWithMetricFallback(
    rows: WorkoutEntryWriteRow[],
    selectClause: string,
  ): Promise<PersistedWorkoutEntryResult> {
    if (!supabase) {
      return { data: null, error: { message: 'Supabase не инициализирован' } };
    }
    const supabaseClient = supabase;

    const usesLegacyWrite = this.getCachedMetricTypeSchemaCapability() === false;
    const writeRows = usesLegacyWrite ? stripMetricTypeFromLegacyWorkoutWriteRows(rows) : rows;

    const attempt = async (payload: typeof writeRows) =>
      await this.withRetry(async () =>
        await supabaseClient
          .from('workout_entries')
          .insert(payload)
          .select(selectClause),
      );

    let result = await attempt(writeRows);
    if (!result.error) {
      if (!usesLegacyWrite) {
        this.persistMetricTypeSchemaCapability(true);
      }
      return result;
    }

    if (isMetricTypeSchemaCacheError(result.error) && this.getCachedMetricTypeSchemaCapability() !== false) {
      this.persistMetricTypeSchemaCapability(false);
      this.warnMetricTypeSchemaFallback();
      result = await attempt(stripMetricTypeFromLegacyWorkoutWriteRows(rows));
    }

    return result;
  }

  private async updateWorkoutEntryWithMetricFallback(
    entryId: string,
    patch: WorkoutEntryUpdatePatch,
    selectClause: string,
  ): Promise<{ data: any | null; error: { code?: string | null; message?: string | null; details?: string | null } | null }> {
    if (!supabase) {
      return { data: null, error: { message: 'Supabase не инициализирован' } };
    }
    const supabaseClient = supabase;

    const usesLegacyWrite = this.getCachedMetricTypeSchemaCapability() === false;
    const writePatch = usesLegacyWrite ? stripMetricTypeFromLegacyWorkoutUpdatePatch(patch) : patch;

    const attempt = async (payload: WorkoutEntryUpdatePatch) =>
      await supabaseClient
        .from('workout_entries')
        .update(payload)
        .eq('id', entryId)
        .select(selectClause)
        .single();

    let result = await attempt(writePatch);
    if (!result.error) {
      if (!usesLegacyWrite) {
        this.persistMetricTypeSchemaCapability(true);
      }
      return result;
    }

    if (isMetricTypeSchemaCacheError(result.error) && this.getCachedMetricTypeSchemaCapability() !== false) {
      this.persistMetricTypeSchemaCapability(false);
      this.warnMetricTypeSchemaFallback();
      result = await attempt(stripMetricTypeFromLegacyWorkoutUpdatePatch(patch));
    }

    return result;
  }

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

  private buildRepeatIdempotencyKey(targetDate: string, sourceEntryId: string, exerciseId: string, operationId: string): string {
    const safeSourceEntryId = sourceEntryId || 'unknown-source';
    const safeExerciseId = exerciseId || 'unknown-exercise';
    return `repeat:${targetDate}:${safeSourceEntryId}:${safeExerciseId}:${operationId}`;
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

  private emitWorkoutsSynced(date: string, entries: WorkoutEntry[]): void {
    try {
      window.dispatchEvent(new CustomEvent('workouts-synced', { detail: { date, entries } }));
    } catch {
      // ignore if window is not available
    }
  }

  private updateLocalWorkoutEntries(userId: string, date: string, updater: (entries: WorkoutEntry[]) => WorkoutEntry[]): WorkoutEntry[] {
    const current = this.getWorkoutsFromLocalStorage(userId, date) || [];
    const next = updater(current);
    this.saveWorkoutsToLocalStorage(userId, date, next);
    this.emitWorkoutsSynced(date, next);
    return next;
  }

  private mapWorkoutEntryRow(entry: any): WorkoutEntry {
    const metricType = normalizeWorkoutMetricType(entry.metric_type);
    const metricValue = normalizeWorkoutMetricValue(metricType, Number(entry.weight) || 0);
    const metricUnit = normalizeWorkoutMetricUnit(metricType, entry.display_unit ?? entry.base_unit ?? null) ?? undefined;
    return {
      id: entry.id,
      workout_day_id: entry.workout_day_id,
      exercise_id: entry.exercise_id,
      canonical_exercise_id: entry.exercise?.canonical_exercise_id ?? entry.exercise_id ?? null,
      metricType,
      metricUnit,
      sets: Number(entry.sets) || 0,
      reps: Number(entry.reps) || 0,
      weight: metricValue,
      baseUnit: entry.base_unit ?? getWorkoutMetricUnit(metricType, metricUnit) ?? 'кг',
      displayUnit: metricUnit,
      displayAmount: normalizeWorkoutMetricValue(metricType, Number(entry.display_amount ?? entry.weight ?? 0)),
      idempotencyKey: entry.idempotency_key ?? undefined,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      exercise: entry.exercise
        ? {
            ...entry.exercise,
            muscles: entry.exercise.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [],
          }
        : undefined,
      workout_day: entry.workout_day,
    };
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

  async getWorkoutDay(userId: string, date: string): Promise<WorkoutDay | null> {
    if (!supabase) {
      return null;
    }

    let sessionUserId: string;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch {
      return null;
    }

    const { data, error } = await supabase
      .from('workout_days')
      .select('*')
      .eq('user_id', sessionUserId)
      .eq('date', date)
      .maybeSingle();

    if (error) {
      if (error.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout day:', error);
      }
      return null;
    }

    return data ?? null;
  }

  async getOrCreatePersistedWorkoutDay(userId: string, date: string): Promise<WorkoutDay> {
    const workoutDay = await this.getOrCreateWorkoutDay(userId, date);
    if (!workoutDay?.id || String(workoutDay.id).startsWith('local-')) {
      throw new Error('Не удалось создать persisted workout day для заметки');
    }
    return workoutDay;
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

  async getWorkoutEntriesPersisted(userId: string, date: string): Promise<WorkoutEntry[]> {
    return this.getWorkoutEntriesFromSupabase(userId, date);
  }

  async getWorkoutHistoryDays(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<WorkoutHistoryDaySummary[]> {
    if (!supabase) {
      console.warn('[workoutService] Supabase not available, history day summaries require persisted source');
      return [];
    }

    let sessionUserId: string;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch {
      return [];
    }

    const { data: workoutDays, error: workoutDaysError } = await supabase
      .from('workout_days')
      .select('id, date')
      .eq('user_id', sessionUserId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false });

    if (workoutDaysError) {
      if (workoutDaysError.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout history days:', workoutDaysError);
      }
      return [];
    }

    const dayIds = (workoutDays || []).map((day) => day.id).filter(Boolean);
    if (dayIds.length === 0) {
      return [];
    }

    const dayDateMap = new Map<string, string>(
      (workoutDays || [])
        .filter((day): day is { id: string; date: string } => Boolean(day?.id && day?.date))
        .map((day) => [day.id, day.date]),
    );

    const { data: entryRows, error: entriesError } = await supabase
      .from('workout_entries')
      .select('workout_day_id, exercise_id, sets, reps, weight')
      .in('workout_day_id', dayIds);

    if (entriesError) {
      if (entriesError.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout history entries:', entriesError);
      }
      return [];
    }

    const aggregateRows: WorkoutHistoryAggregateRow[] = (entryRows || [])
      .map((row: any) => ({
        workout_day_id: row.workout_day_id,
        date: dayDateMap.get(row.workout_day_id) || '',
        exercise_id: row.exercise_id,
        sets: Number(row.sets) || 0,
        reps: Number(row.reps) || 0,
        weight: Number(row.weight) || 0,
      }))
      .filter((row) => row.date !== '');

    return buildWorkoutHistoryDaySummaries(aggregateRows);
  }

  async getWorkoutProgressObservations(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<WorkoutProgressObservation[]> {
    if (!supabase) {
      console.warn('[workoutService] Supabase not available, workout progress observations require persisted source');
      return [];
    }

    let sessionUserId: string;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch {
      return [];
    }

    const { data: workoutDays, error: workoutDaysError } = await supabase
      .from('workout_days')
      .select('id, date')
      .eq('user_id', sessionUserId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true });

    if (workoutDaysError) {
      if (workoutDaysError.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout progress days:', workoutDaysError);
      }
      return [];
    }

    const dayIds = (workoutDays || []).map((day) => day.id).filter(Boolean);
    if (dayIds.length === 0) {
      return [];
    }

    const dayDateMap = new Map<string, string>(
      (workoutDays || [])
        .filter((day): day is { id: string; date: string } => Boolean(day?.id && day?.date))
        .map((day) => [day.id, day.date]),
    );

    const { data, error } = await supabase
      .from('workout_entries')
      .select(`
        id,
        workout_day_id,
        created_at,
        exercise_id,
        sets,
        reps,
        weight,
        exercise:exercises(id,name)
      `)
      .in('workout_day_id', dayIds)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout progress observations:', error);
      }
      return [];
    }

    const rows = Array.isArray(data) ? (data as WorkoutProgressObservationRow[]) : [];
    return buildWorkoutProgressObservations(rows, dayDateMap);
  }

  async getWorkoutProgressEntryDetails(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<WorkoutEntry[]> {
    if (!supabase) {
      console.warn('[workoutService] Supabase not available, workout progress entry details require persisted source');
      return [];
    }
    const supabaseClient = supabase;

    let sessionUserId: string;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch {
      return [];
    }

    const { data: workoutDays, error: workoutDaysError } = await supabase
      .from('workout_days')
      .select('id, date')
      .eq('user_id', sessionUserId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true });

    if (workoutDaysError) {
      if (workoutDaysError.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout progress entry detail days:', workoutDaysError);
      }
      return [];
    }

    const dayIds = (workoutDays || []).map((day) => day.id).filter(Boolean);
    if (dayIds.length === 0) {
      return [];
    }

    const attempt = async (metricSchemaAvailable: boolean) =>
      await supabaseClient
        .from('workout_entries')
        .select(getWorkoutProgressEntryDetailsSelectClause(metricSchemaAvailable))
        .in('workout_day_id', dayIds)
        .order('created_at', { ascending: true });

    const usesLegacyRead = this.getCachedMetricTypeSchemaCapability() === false;
    let result = await attempt(!usesLegacyRead);

    if (result.error && isWorkoutMetricReadSchemaError(result.error) && this.getCachedMetricTypeSchemaCapability() !== false) {
      this.persistMetricTypeSchemaCapability(false);
      this.warnMetricTypeSchemaFallback();
      result = await attempt(false);
    } else if (!result.error && !usesLegacyRead) {
      this.persistMetricTypeSchemaCapability(true);
    }

    if (result.error) {
      if (result.error.code !== 'PGRST205') {
        console.error('[workoutService] Error fetching workout progress entry details:', result.error);
      }
      return [];
    }

    return (result.data ?? []).map((entry: any) => this.mapWorkoutEntryRow(entry));
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
    const entries: WorkoutEntry[] = (data || []).map((entry: any) => this.mapWorkoutEntryRow(entry));

    this.saveWorkoutsToLocalStorage(sessionUserId, date, entries);
    this.emitWorkoutsSynced(date, entries);

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
      const metricType = normalizeWorkoutMetricType(ex.metricType);
      const metricValue = normalizeWorkoutMetricValue(metricType, ex.weight);
      this.assertEntryNumbers({ sets: ex.sets, reps: ex.reps, weight: metricValue });
      const key = this.buildIdempotencyKey(date, ex.exercise.id);
      const displayUnit = normalizeWorkoutMetricUnit(metricType, ex.metricUnit) ?? undefined;
      const displayAmount = metricValue;
      const baseWeight = metricType === 'weight'
        ? convertWeightToKg(displayAmount, 'кг')
        : metricValue;
      const existing = localExisting.find((entry) => entry.idempotencyKey === key);
      return {
        id: existing?.id || `local-${key}`,
        workout_day_id: existing?.workout_day_id || `local-${date}`,
        exercise_id: ex.exercise.id,
        canonical_exercise_id: ex.exercise.canonical_exercise_id ?? ex.exercise.id,
        metricType,
        metricUnit: displayUnit,
        sets: ex.sets,
        reps: ex.reps,
        weight: baseWeight,
        baseUnit: displayUnit,
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
      const metricType = normalizeWorkoutMetricType(ex.metricType);
      this.assertEntryNumbers({ sets: ex.sets, reps: ex.reps, weight: normalizeWorkoutMetricValue(metricType, ex.weight) });
    });

    const entries = exercises.map((ex) => {
      const metricType = normalizeWorkoutMetricType(ex.metricType);
      const metricValue = normalizeWorkoutMetricValue(metricType, ex.weight);
      const metricUnit = normalizeWorkoutMetricUnit(metricType, ex.metricUnit) ?? null;
      return {
        workout_day_id: workoutDay.id,
        exercise_id: ex.exercise.id,
        metric_type: metricType,
        sets: ex.sets,
        reps: ex.reps,
        weight: metricType === 'weight' ? convertWeightToKg(metricValue, 'кг') : metricValue,
        base_unit: metricUnit,
        display_unit: metricUnit,
        display_amount: metricValue,
        idempotency_key: this.buildIdempotencyKey(date, ex.exercise.id),
      };
    });
    const totalVolume = entries.reduce((sum, entry) => sum + calculateVolume(entry.sets, entry.reps, entry.weight), 0);
    if (totalVolume > this.MAX_VOLUME) {
      throw new Error('[workoutService] Suspicious volume spike');
    }

    const { data, error } = await this.upsertWorkoutEntriesWithMetricFallback(
      entries,
      `
        *,
        exercise:exercises(
          *,
          category:exercise_categories(*),
          exercise_muscles(
            muscle:muscles(*)
          )
        )
      `,
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
    const workoutEntries: WorkoutEntry[] = (data || []).map((entry: any) => this.mapWorkoutEntryRow(entry));

    this.saveWorkoutsToLocalStorage(userId, date, workoutEntries);

    try {
      await aiTrainingPlansService.markTrainingPlanOutdated(userId, workoutDay.date);
    } catch (aiError) {
      console.error('[workoutService] Error marking AI training plan outdated:', aiError);
    }

    return workoutEntries;
  }

  async copyWorkoutEntriesToDate(
    userId: string,
    sourceDate: string,
    targetDate: string,
    exerciseIds: string[],
  ): Promise<WorkoutEntry[]> {
    const selectedExerciseIds = new Set(exerciseIds.filter(Boolean));
    if (selectedExerciseIds.size === 0) {
      throw new Error('Не выбраны упражнения для повторения');
    }

    const sourceEntries = supabase
      ? await this.getWorkoutEntriesPersisted(userId, sourceDate)
      : this.getWorkoutsFromLocalStorage(userId, sourceDate) || [];

    const entriesToCopy = sourceEntries.filter((entry) => selectedExerciseIds.has(entry.exercise_id));
    if (entriesToCopy.length === 0) {
      throw new Error('Не удалось найти выбранные упражнения в исходной тренировке');
    }

    const operationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (!supabase) {
      const existingTargetEntries = this.getWorkoutsFromLocalStorage(userId, targetDate) || [];
      const copiedEntries = entriesToCopy.map((entry, index) => ({
        ...entry,
        id: `local-repeat-${operationId}-${index}`,
        workout_day_id: `local-${targetDate}`,
        idempotencyKey: this.buildRepeatIdempotencyKey(targetDate, entry.id, entry.exercise_id, operationId),
      }));
      const nextEntries = [...existingTargetEntries, ...copiedEntries];
      this.saveWorkoutsToLocalStorage(userId, targetDate, nextEntries);
      this.emitWorkoutsSynced(targetDate, nextEntries);
      return nextEntries;
    }

    let workoutDay: WorkoutDay;
    try {
      workoutDay = await this.getOrCreateWorkoutDay(userId, targetDate);
    } catch (error) {
      const existingTargetEntries = this.getWorkoutsFromLocalStorage(userId, targetDate) || [];
      const copiedEntries = entriesToCopy.map((entry, index) => ({
        ...entry,
        id: `local-repeat-${operationId}-${index}`,
        workout_day_id: `local-${targetDate}`,
        idempotencyKey: this.buildRepeatIdempotencyKey(targetDate, entry.id, entry.exercise_id, operationId),
      }));
      const nextEntries = [...existingTargetEntries, ...copiedEntries];
      this.saveWorkoutsToLocalStorage(userId, targetDate, nextEntries);
      this.emitWorkoutsSynced(targetDate, nextEntries);
      return nextEntries;
    }
    const rows = entriesToCopy.map((entry) => {
      const metricType = normalizeWorkoutMetricType(entry.metricType);
      const displayAmount = normalizeWorkoutMetricValue(metricType, entry.displayAmount ?? entry.weight);
      const displayUnit = normalizeWorkoutMetricUnit(metricType, entry.metricUnit ?? entry.displayUnit ?? null) ?? null;
      return {
        workout_day_id: workoutDay.id,
        exercise_id: entry.exercise_id,
        metric_type: metricType,
        sets: entry.sets,
        reps: entry.reps,
        weight: metricType === 'weight' ? convertWeightToKg(displayAmount, 'кг') : displayAmount,
        base_unit: displayUnit,
        display_unit: displayUnit,
        display_amount: displayAmount,
        idempotency_key: this.buildRepeatIdempotencyKey(targetDate, entry.id, entry.exercise_id, operationId),
      };
    });

    const totalVolume = rows.reduce((sum, row) => sum + calculateVolume(row.sets, row.reps, row.weight), 0);
    if (totalVolume > this.MAX_VOLUME) {
      throw new Error('[workoutService] Suspicious volume spike');
    }

    const { error } = await this.insertWorkoutEntriesWithMetricFallback(
      rows,
      `
        *,
        exercise:exercises(
          *,
          category:exercise_categories(*),
          exercise_muscles(
            muscle:muscles(*)
          )
        ),
        workout_day:workout_days(*)
      `,
    );

    if (error) {
      const errorMessage = error.message || 'Ошибка повторения тренировки';
      console.error('[workoutService] Error copying workout entries:', error);
      throw new Error(errorMessage);
    }

    const targetEntries = await this.getWorkoutEntriesFromSupabase(userId, targetDate);
    try {
      await aiTrainingPlansService.markTrainingPlanOutdated(userId, targetDate);
    } catch (aiError) {
      console.error('[workoutService] Error marking AI training plan outdated:', aiError);
    }

    return targetEntries;
  }

  /**
   * Обновить запись тренировки
   */
  async updateWorkoutEntry(
    entryId: string,
    updates: { sets?: number; reps?: number; weight?: number; metricType?: WorkoutMetricType; metricUnit?: WorkoutMetricUnit },
    expectedUpdatedAt?: string,
    context?: { userId?: string; date?: string }
  ): Promise<WorkoutEntry> {
    if (!supabase) {
      if (context?.userId && context?.date) {
        const localEntries = this.getWorkoutsFromLocalStorage(context.userId, context.date) || [];
        const currentEntry = localEntries.find((entry) => entry.id === entryId);
        if (!currentEntry) {
          throw new Error('Запись тренировки не найдена');
        }
        const mergedEntry: WorkoutEntry = {
          ...currentEntry,
          metricType: normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
          metricUnit: normalizeWorkoutMetricUnit(
            normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
            updates.metricUnit ?? currentEntry.metricUnit ?? currentEntry.displayUnit ?? null,
          ) || undefined,
          sets: updates.sets ?? currentEntry.sets,
          reps: updates.reps ?? currentEntry.reps,
          weight: normalizeWorkoutMetricValue(
            normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
            updates.weight ?? currentEntry.weight,
          ),
          displayAmount: normalizeWorkoutMetricValue(
            normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
            updates.weight ?? currentEntry.displayAmount ?? currentEntry.weight,
          ),
          baseUnit: getWorkoutMetricUnit(
            normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
            updates.metricUnit ?? currentEntry.metricUnit ?? currentEntry.displayUnit ?? null,
          ) || undefined,
          displayUnit: getWorkoutMetricUnit(
            normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
            updates.metricUnit ?? currentEntry.metricUnit ?? currentEntry.displayUnit ?? null,
          ) || undefined,
        };
        this.updateLocalWorkoutEntries(context.userId, context.date, (entries) =>
          updateWorkoutEntryInList(entries, entryId, {
            sets: mergedEntry.sets,
            reps: mergedEntry.reps,
            weight: mergedEntry.weight,
            displayAmount: mergedEntry.displayAmount ?? mergedEntry.weight,
            displayUnit: mergedEntry.displayUnit,
            metricType: mergedEntry.metricType,
            metricUnit: mergedEntry.metricUnit,
          }),
        );
        return mergedEntry;
      }
      throw new Error('Supabase не инициализирован');
    }

    try {
      let sessionUserId: string;
      try {
        sessionUserId = await this.getSessionUserId(context?.userId);
      } catch (error) {
        if (context?.userId && context?.date) {
          const localEntries = this.getWorkoutsFromLocalStorage(context.userId, context.date) || [];
          const currentEntry = localEntries.find((entry) => entry.id === entryId);
          if (!currentEntry) {
            throw new Error('Запись тренировки не найдена');
          }
          const mergedEntry: WorkoutEntry = {
            ...currentEntry,
            metricType: normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
            metricUnit: normalizeWorkoutMetricUnit(
              normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
              updates.metricUnit ?? currentEntry.metricUnit ?? currentEntry.displayUnit ?? null,
            ) || undefined,
            sets: updates.sets ?? currentEntry.sets,
            reps: updates.reps ?? currentEntry.reps,
            weight: normalizeWorkoutMetricValue(
              normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
              updates.weight ?? currentEntry.weight,
            ),
            displayAmount: normalizeWorkoutMetricValue(
              normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
              updates.weight ?? currentEntry.displayAmount ?? currentEntry.weight,
            ),
            baseUnit: getWorkoutMetricUnit(
              normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
              updates.metricUnit ?? currentEntry.metricUnit ?? currentEntry.displayUnit ?? null,
            ) || undefined,
            displayUnit: getWorkoutMetricUnit(
              normalizeWorkoutMetricType(updates.metricType ?? currentEntry.metricType),
              updates.metricUnit ?? currentEntry.metricUnit ?? currentEntry.displayUnit ?? null,
            ) || undefined,
          };
          this.updateLocalWorkoutEntries(context.userId, context.date, (entries) =>
            updateWorkoutEntryInList(entries, entryId, {
              sets: mergedEntry.sets,
              reps: mergedEntry.reps,
              weight: mergedEntry.weight,
              displayAmount: mergedEntry.displayAmount ?? mergedEntry.weight,
              displayUnit: mergedEntry.displayUnit,
              metricType: mergedEntry.metricType,
              metricUnit: mergedEntry.metricUnit,
            }),
          );
          return mergedEntry;
        }
        throw error;
      }
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
      const patch = buildWorkoutEntryUpdatePatch(updates);
      const { data, error } = await this.updateWorkoutEntryWithMetricFallback(
        entryId,
        patch,
        `
          *,
          workout_day:workout_days(date),
          exercise:exercises(
            *,
            category:exercise_categories(*),
            exercise_muscles(
              muscle:muscles(*)
            )
          )
        `,
      );

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

      const mapped = this.mapWorkoutEntryRow(data);

      const workoutDate = Array.isArray(data.workout_day) ? data.workout_day?.[0]?.date : data.workout_day?.date;
      if (sessionUserId && workoutDate) {
        this.updateLocalWorkoutEntries(sessionUserId, workoutDate, (entries) =>
          updateWorkoutEntryInList(entries, entryId, {
            sets: mapped.sets,
            reps: mapped.reps,
            weight: mapped.weight,
            displayAmount: mapped.displayAmount ?? mapped.weight,
            displayUnit: mapped.displayUnit,
            metricType: mapped.metricType,
            metricUnit: mapped.metricUnit,
          }),
        );
      }

      return mapped;
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
  async deleteWorkoutEntry(entryId: string, userId?: string, date?: string): Promise<void> {
    if (!supabase) {
      if (userId && date) {
        this.updateLocalWorkoutEntries(userId, date, (entries) => removeWorkoutEntryFromList(entries, entryId));
        return;
      }
      throw new Error('Supabase не инициализирован. Проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
    }

    let sessionUserId: string;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch (error) {
      if (userId && date) {
        this.updateLocalWorkoutEntries(userId, date, (entries) => removeWorkoutEntryFromList(entries, entryId));
        return;
      }
      throw error;
    }

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
    if (sessionUserId && workoutDate) {
      this.updateLocalWorkoutEntries(sessionUserId, workoutDate, (entries) => removeWorkoutEntryFromList(entries, entryId));
    }
    if (workoutDate) {
      try {
        await aiTrainingPlansService.markTrainingPlanOutdated(sessionUserId, workoutDate);
      } catch (aiError) {
        console.error('[workoutService] Error marking AI training plan outdated:', aiError);
      }
    }
  }

  async deleteWorkoutDay(userId: string, date: string): Promise<void> {
    if (!supabase) {
      this.updateLocalWorkoutEntries(userId, date, () => clearWorkoutEntriesForDay());
      return;
    }

    let sessionUserId: string;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch (error) {
      this.updateLocalWorkoutEntries(userId, date, () => clearWorkoutEntriesForDay());
      return;
    }

    const { data: workoutDay, error: workoutDayError } = await supabase
      .from('workout_days')
      .select('id')
      .eq('user_id', sessionUserId)
      .eq('date', date)
      .maybeSingle();

    if (workoutDayError) {
      const errorMessage = workoutDayError.message || 'Ошибка удаления тренировки';
      console.error('[workoutService] Error fetching workout day for delete:', workoutDayError);
      if (workoutDayError.code === '42501' || errorMessage.includes('row-level security')) {
        throw new Error('Ошибка доступа: обновите RLS политики в Supabase SQL Editor. Выполните команды из файла supabase/workout_schema.sql (строки 135-145)');
      }
      throw new Error(errorMessage);
    }

    if (!workoutDay?.id) {
      this.updateLocalWorkoutEntries(sessionUserId, date, () => clearWorkoutEntriesForDay());
      return;
    }

    const { error: entriesError } = await supabase
      .from('workout_entries')
      .delete()
      .eq('workout_day_id', workoutDay.id);

    if (entriesError) {
      const errorMessage = entriesError.message || 'Ошибка удаления упражнений тренировки';
      console.error('[workoutService] Error deleting workout day entries:', entriesError);
      if (entriesError.code === '42501' || errorMessage.includes('row-level security')) {
        throw new Error('Ошибка доступа: обновите RLS политики в Supabase SQL Editor. Выполните команды из файла supabase/workout_schema.sql (строки 135-145)');
      }
      throw new Error(errorMessage);
    }

    const { error: workoutDayDeleteError } = await supabase
      .from('workout_days')
      .delete()
      .eq('id', workoutDay.id);

    if (workoutDayDeleteError) {
      const errorMessage = workoutDayDeleteError.message || 'Ошибка удаления тренировки';
      console.error('[workoutService] Error deleting workout day container:', workoutDayDeleteError);
      if (workoutDayDeleteError.code === '42501' || errorMessage.includes('row-level security')) {
        throw new Error('Ошибка доступа: обновите RLS политики в Supabase SQL Editor. Выполните команды из файла supabase/workout_schema.sql (строки 135-145)');
      }
      throw new Error(errorMessage);
    }

    this.updateLocalWorkoutEntries(sessionUserId, date, () => clearWorkoutEntriesForDay());

    try {
      await aiTrainingPlansService.markTrainingPlanOutdated(sessionUserId, date);
    } catch (aiError) {
      console.error('[workoutService] Error marking AI training plan outdated:', aiError);
    }
  }

}

export const workoutService = new WorkoutService();
