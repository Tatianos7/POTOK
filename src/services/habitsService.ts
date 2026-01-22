import { supabase } from '../lib/supabaseClient';
import { trackEvent } from './analyticsService';
import { aiRecommendationsService } from './aiRecommendationsService';

export type HabitFrequency = 'daily' | 'weekly';

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  frequency: HabitFrequency;
  created_at: string;
  is_active: boolean;
}

export interface HabitWithStatus extends Habit {
  completed: boolean;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
}

if (!supabase) {
  // eslint-disable-next-line no-console
  console.warn(
    '[habitsService] Supabase client is not configured. ' +
      'Создание и отметка привычек не будут работать, пока не настроен VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.'
  );
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
    console.warn('[habitsService] Передан userId не совпадает с сессией');
  }

  return data.user.id;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 200): Promise<T> {
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

export async function createHabit(params: {
  userId: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
}): Promise<Habit | null> {
  if (!supabase) return null;

  const { userId, title, description, frequency } = params;

  const sessionUserId = await getSessionUserId(userId);
  const { data, error } = await withRetry(() =>
    supabase
      .from('habits')
      .insert({
        user_id: sessionUserId,
        title: title.trim(),
        description: description?.trim() || null,
        frequency,
      })
      .select('*')
      .single()
  );

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[habitsService] createHabit error', error);
    return null;
  }

  await trackEvent({ name: 'create_habit', userId, metadata: { habit_id: data.id } });

  return data as Habit;
}

/**
 * Тоггл отметки привычки за конкретную дату.
 * Если записи не было — создаём completed = true.
 * Если была — инвертируем completed.
 */
export async function toggleHabitComplete(params: {
  userId: string;
  habitId: string;
  date: string; // YYYY-MM-DD
}): Promise<HabitLog | null> {
  if (!supabase) return null;

  const { userId, habitId, date } = params;

  const sessionUserId = await getSessionUserId(userId);
  const { data, error } = await withRetry(() =>
    supabase.rpc('toggle_habit_log', {
      p_user_id: sessionUserId,
      p_habit_id: habitId,
      p_date: date,
    })
  );

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[habitsService] toggleHabitComplete rpc error', error);
    return null;
  }

  const log = data as HabitLog | null;

  if (log?.completed) {
    await trackEvent({ name: 'complete_habit', userId, metadata: { habit_id: habitId, date } });
  }

  return log;
}

export async function getHabitStats(params: {
  userId: string;
  habitId: string;
  fromDate: string;
  toDate: string;
}): Promise<{ streak: number; adherence: number }> {
  if (!supabase) return { streak: 0, adherence: 0 };
  const { userId, habitId, fromDate, toDate } = params;
  const sessionUserId = await getSessionUserId(userId);

  const { data, error } = await withRetry(() =>
    supabase
      .from('habit_logs')
      .select('date, completed')
      .eq('user_id', sessionUserId)
      .eq('habit_id', habitId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
  );

  if (error) {
    console.error('[habitsService] getHabitStats error', error);
    return { streak: 0, adherence: 0 };
  }

  const logs = data || [];
  const completedDates = new Set(logs.filter((l: any) => l.completed).map((l: any) => l.date));

  let streak = 0;
  let current = new Date(toDate);
  const start = new Date(fromDate);
  while (current >= start) {
    const dateStr = current.toISOString().split('T')[0];
    if (completedDates.has(dateStr)) {
      streak += 1;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  const totalDays = Math.max(1, Math.floor((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1);
  const adherence = logs.length > 0 ? completedDates.size / totalDays : 0;

  return { streak, adherence };
}

export async function requestHabitFeedback(params: {
  userId: string;
  habitId: string;
  fromDate: string;
  toDate: string;
}): Promise<void> {
  const { userId, habitId, fromDate, toDate } = params;
  const stats = await getHabitStats({ userId, habitId, fromDate, toDate });
  const context = { habit_id: habitId, fromDate, toDate, stats };
  await aiRecommendationsService.queueHabitFeedback(userId, context, `habit-${habitId}-${toDate}`);
}

export async function getHabitsForDate(params: {
  userId: string;
  date: string; // YYYY-MM-DD
}): Promise<HabitWithStatus[]> {
  if (!supabase) return [];

  const { userId, date } = params;

  const sessionUserId = await getSessionUserId(userId);
  const [{ data: habits, error: habitsError }, { data: logs, error: logsError }] = await Promise.all([
    withRetry(() =>
      supabase
        .from('habits')
        .select<'*'>('*')
        .eq('user_id', sessionUserId)
        .eq('is_active', true)
    ),
    withRetry(() =>
      supabase
        .from('habit_logs')
        .select<'*'>('*')
        .eq('user_id', sessionUserId)
        .eq('date', date)
    ),
  ]);

  if (habitsError) {
    // eslint-disable-next-line no-console
    console.error('[habitsService] getHabitsForDate habits error', habitsError);
    return [];
  }
  if (logsError) {
    // eslint-disable-next-line no-console
    console.error('[habitsService] getHabitsForDate logs error', logsError);
  }

  const logMap = new Map<string, HabitLog>();
  (logs || []).forEach((log) => {
    logMap.set(log.habit_id, log as HabitLog);
  });

  return (habits || []).map((habit) => {
    const log = logMap.get(habit.id);
    return {
      ...(habit as Habit),
      completed: !!log?.completed,
    };
  });
}


