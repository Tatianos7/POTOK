import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { MeasurementHistory } from './measurementsService';

// Перечень поддерживаемых событий аналитики
export type AnalyticsEventName = 'create_habit' | 'complete_habit' | 'add_food' | 'save_recipe';

interface TrackEventPayload {
  name: AnalyticsEventName;
  userId: string;
  // Дополнительные данные события
  metadata?: Record<string, unknown>;
}

/**
 * Простая обёртка над Supabase для записи аналитических событий.
 * Таблица на стороне Supabase:
 *
 * analytics_events (
 *   id          uuid primary key default gen_random_uuid(),
 *   user_id     uuid not null references auth.users(id),
 *   event_name  text not null,
 *   metadata    jsonb,
 *   created_at  timestamptz default now()
 * )
 */
export async function trackEvent({ name, userId, metadata }: TrackEventPayload): Promise<void> {
  if (!supabase) {
    // Supabase ещё не сконфигурирован — тихо выходим, чтобы не ломать UI.
    return;
  }

  try {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }
    if (userId && userId !== data.user.id) {
      console.warn('[analytics] Передан userId не совпадает с сессией');
    }
    const sessionUserId = data.user.id;
    const { error: insertError } = await supabase.from('analytics_events').insert({
      user_id: sessionUserId,
      event_name: name,
      metadata: metadata || null,
    });

    if (insertError) {
      // eslint-disable-next-line no-console
      console.error('[analytics] failed to track event', name, insertError);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[analytics] unexpected error', err);
  }
}

export interface ProgressPoint {
  date: string;
  weight?: number;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  volume?: number;
}

export interface ProgressTrends {
  points: ProgressPoint[];
  weeklyDelta: Record<string, number | null>;
  monthlyDelta: Record<string, number | null>;
}

async function getSessionUserId(userId?: string): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase не инициализирован');
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    throw new Error('Пользователь не авторизован');
  }

  if (userId && userId !== data.user.id) {
    console.warn('[analytics] Передан userId не совпадает с сессией');
  }

  return data.user.id;
}

const parseWeight = (measurements: MeasurementHistory['measurements']): number | null => {
  const byId = measurements.find((m) => m.id === 'weight');
  if (byId && Number.isFinite(Number(byId.value))) {
    return Number(byId.value);
  }
  const byName = measurements.find((m) => m.name?.toLowerCase() === 'вес');
  if (byName && Number.isFinite(Number(byName.value))) {
    return Number(byName.value);
  }
  return null;
};

const computeDelta = (points: ProgressPoint[], days: number): Record<string, number | null> => {
  if (points.length === 0) {
    return { weight: null, calories: null, protein: null, fat: null, carbs: null, volume: null };
  }
  const latest = points[points.length - 1];
  const cutoff = new Date(latest.date);
  cutoff.setDate(cutoff.getDate() - days);
  const previous = [...points].reverse().find((p) => new Date(p.date) <= cutoff);
  if (!previous) {
    return { weight: null, calories: null, protein: null, fat: null, carbs: null, volume: null };
  }

  const delta = (current?: number, prev?: number) =>
    current !== undefined && prev !== undefined ? current - prev : null;

  return {
    weight: delta(latest.weight, previous.weight),
    calories: delta(latest.calories, previous.calories),
    protein: delta(latest.protein, previous.protein),
    fat: delta(latest.fat, previous.fat),
    carbs: delta(latest.carbs, previous.carbs),
    volume: delta(latest.volume, previous.volume),
  };
};

export async function getProgressTrends(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<ProgressTrends> {
  if (!supabase) {
    throw new Error('Supabase не инициализирован');
  }
  const sessionUserId = await getSessionUserId(userId);

  const [foodRes, workoutDaysRes, measurementRes] = await Promise.all([
    supabase
      .from('food_diary_entries')
      .select('date, calories, protein, fat, carbs')
      .eq('user_id', sessionUserId)
      .gte('date', fromDate)
      .lte('date', toDate),
    supabase
      .from('workout_days')
      .select('id, date')
      .eq('user_id', sessionUserId)
      .gte('date', fromDate)
      .lte('date', toDate),
    supabase
      .from('measurement_history')
      .select('date, measurements')
      .eq('user_id', sessionUserId)
      .gte('date', fromDate)
      .lte('date', toDate),
  ]);

  if (foodRes.error) throw foodRes.error;
  if (workoutDaysRes.error) throw workoutDaysRes.error;
  if (measurementRes.error) throw measurementRes.error;

  const dayIds = (workoutDaysRes.data || []).map((day) => day.id).filter(Boolean);
  let workoutEntries: any[] = [];
  if (dayIds.length > 0) {
    const { data, error } = await supabase
      .from('workout_entries')
      .select('sets, reps, weight, workout_day:workout_days(date)')
      .in('workout_day_id', dayIds);
    if (error) throw error;
    workoutEntries = data || [];
  }

  const pointsMap = new Map<string, ProgressPoint>();

  (foodRes.data || []).forEach((row: any) => {
    const date = row.date;
    const existing = pointsMap.get(date) ?? { date };
    existing.calories = (existing.calories ?? 0) + Number(row.calories || 0);
    existing.protein = (existing.protein ?? 0) + Number(row.protein || 0);
    existing.fat = (existing.fat ?? 0) + Number(row.fat || 0);
    existing.carbs = (existing.carbs ?? 0) + Number(row.carbs || 0);
    pointsMap.set(date, existing);
  });

  (workoutEntries || []).forEach((row: any) => {
    const date = row.workout_day?.date;
    if (!date) return;
    const existing = pointsMap.get(date) ?? { date };
    const volume = Number(row.sets || 0) * Number(row.reps || 0) * Number(row.weight || 0);
    existing.volume = (existing.volume ?? 0) + volume;
    pointsMap.set(date, existing);
  });

  (measurementRes.data || []).forEach((row: any) => {
    const date = row.date;
    const existing = pointsMap.get(date) ?? { date };
    const weight = parseWeight(row.measurements || []);
    if (weight !== null) {
      existing.weight = weight;
    }
    pointsMap.set(date, existing);
  });

  const points = Array.from(pointsMap.values()).sort((a, b) => (a.date > b.date ? 1 : -1));
  const weeklyDelta = computeDelta(points, 7);
  const monthlyDelta = computeDelta(points, 30);

  return { points, weeklyDelta, monthlyDelta };
}

/**
 * Хелпер‑hook для удобства вызова аналитики из компонентов React.
 * Не обязательно использовать, но иногда удобнее, чем отдельно пробрасывать userId.
 */
export function useAnalytics() {
  const { user } = useAuth();

  const safeTrack = async (name: AnalyticsEventName, metadata?: Record<string, unknown>) => {
    if (!user?.id) return;
    await trackEvent({ name, userId: user.id, metadata });
  };

  return { trackEvent: safeTrack };
}


