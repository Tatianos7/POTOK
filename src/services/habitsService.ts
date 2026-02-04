import { supabase } from '../lib/supabaseClient';
import { trackEvent } from './analyticsService';
import { coachRuntime } from './coachRuntime';
import { aiRecommendationsService } from './aiRecommendationsService';
import type { HabitsExplainabilityDTO } from '../types/explainability';

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

async function getTrustScore(userId: string): Promise<number> {
  if (!supabase) return 50;
  const { data } = await supabase
    .from('ai_trust_scores')
    .select('trust_score')
    .eq('user_id', userId)
    .maybeSingle();
  return Number(data?.trust_score ?? 50);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 200): Promise<T> {
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
  const { data, error } = await withRetry(async () =>
    (await supabase!
      .from('habits')
      .insert({
        user_id: sessionUserId,
        title: title.trim(),
        description: description?.trim() || null,
        frequency,
      })
      .select('*')
      .single()) as { data: Habit; error: any }
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
  const { data, error } = await withRetry(async () =>
    (await supabase!.rpc('toggle_habit_log', {
      p_user_id: sessionUserId,
      p_habit_id: habitId,
      p_date: date,
    })) as { data: HabitLog | null; error: any }
  );

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[habitsService] toggleHabitComplete rpc error', error);
    return null;
  }

  const log = data as HabitLog | null;

  if (log?.completed) {
    await trackEvent({ name: 'complete_habit', userId, metadata: { habit_id: habitId, date } });
    await coachRuntime.handleUserEvent(
      {
        type: 'HabitCompleted',
        timestamp: new Date().toISOString(),
        payload: { habit_id: habitId, date },
        confidence: 0.8,
        safetyClass: 'normal',
        trustImpact: 1,
      },
      {
        screen: 'Habits',
        userMode: 'Manual',
        subscriptionState: 'Free',
      }
    );
  } else if (log) {
    await coachRuntime.handleUserEvent(
      {
        type: 'HabitBroken',
        timestamp: new Date().toISOString(),
        payload: { habit_id: habitId, date },
        confidence: 0.7,
        safetyClass: 'normal',
        trustImpact: -1,
      },
      {
        screen: 'Habits',
        userMode: 'Manual',
        subscriptionState: 'Free',
      }
    );
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

  const { data, error } = await withRetry(async () =>
    (await supabase!
      .from('habit_logs')
      .select('date, completed')
      .eq('user_id', sessionUserId)
      .eq('habit_id', habitId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })) as { data: Array<{ date: string; completed: boolean }>; error: any }
  );

  if (error) {
    console.error('[habitsService] getHabitStats error', error);
    return { streak: 0, adherence: 0 };
  }

  const logs = data || [];
  const completedDates = new Set(logs.filter((l) => l.completed).map((l) => l.date));

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
    withRetry(async () =>
      (await supabase!
        .from('habits')
        .select<'*'>('*')
        .eq('user_id', sessionUserId)
        .eq('is_active', true)) as { data: Habit[]; error: any }
    ),
    withRetry(async () =>
      (await supabase!
        .from('habit_logs')
        .select<'*'>('*')
        .eq('user_id', sessionUserId)
        .eq('date', date)) as { data: HabitLog[]; error: any }
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
  (logs || []).forEach((log: HabitLog) => {
    logMap.set(log.habit_id, log as HabitLog);
  });

  return (habits || []).map((habit: Habit) => {
    const log = logMap.get(habit.id);
    return {
      ...(habit as Habit),
      completed: !!log?.completed,
    };
  });
}

export const habitsService = {
  load: async (): Promise<void> => {
    return Promise.resolve();
  },
  refresh: async (): Promise<void> => {
    return Promise.resolve();
  },
  offlineSnapshot: async (): Promise<void> => {
    return Promise.resolve();
  },
  revalidate: async (): Promise<void> => {
    return Promise.resolve();
  },
  recover: async (): Promise<void> => {
    return Promise.resolve();
  },
  explain: async (): Promise<HabitsExplainabilityDTO> => {
    const userId = await getSessionUserId();
    const today = new Date().toISOString().split('T')[0];
    const habits = await getHabitsForDate({ userId, date: today });
    const total = habits.length;
    const completed = habits.filter((h) => h.completed).length;
    const completionRate = total === 0 ? 0 : completed / total;
    const confidence = total === 0 ? 0.2 : Math.min(1, 0.6 + completionRate * 0.4);
    const trustScore = await getTrustScore(userId);

    return {
      source: 'habitsService',
      version: '1.0',
      data_sources: ['habits', 'habit_logs'],
      confidence,
      trust_score: trustScore,
      decision_ref: 'habits:daily',
      safety_notes: total === 0 ? ['Нет привычек на сегодня.'] : [],
      trust_level: trustScore,
      safety_flags: total === 0 ? ['data_gap'] : [],
      premium_reason: undefined,
    };
  },
  createHabit,
  toggleHabitComplete,
  getHabitStats,
  requestHabitFeedback,
  getHabitsForDate,
};