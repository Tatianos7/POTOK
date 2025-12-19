import { supabase } from '../lib/supabaseClient';
import { trackEvent } from './analyticsService';
import { toUUID } from '../utils/uuid';

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

export async function createHabit(params: {
  userId: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
}): Promise<Habit | null> {
  if (!supabase) return null;

  const { userId, title, description, frequency } = params;

  const uuidUserId = toUUID(userId);
  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: uuidUserId,
      title: title.trim(),
      description: description?.trim() || null,
      frequency,
    })
    .select('*')
    .single();

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

  const uuidUserId = toUUID(userId);
  const { data: existing, error: selectError } = await supabase
    .from('habit_logs')
    .select<'*, habit_id, user_id, date, completed'>('*')
    .eq('user_id', uuidUserId)
    .eq('habit_id', habitId)
    .eq('date', date)
    .maybeSingle();

  if (selectError && selectError.code !== 'PGRST116') {
    // eslint-disable-next-line no-console
    console.error('[habitsService] toggleHabitComplete select error', selectError);
    return null;
  }

  const nextCompleted = existing ? !existing.completed : true;

  let log: HabitLog | null = null;

  if (existing) {
    const { data, error } = await supabase
      .from('habit_logs')
      .update({ completed: nextCompleted })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[habitsService] toggleHabitComplete update error', error);
      return null;
    }
    log = data as HabitLog;
  } else {
    const { data, error } = await supabase
      .from('habit_logs')
      .insert({
        habit_id: habitId,
        user_id: uuidUserId,
        date,
        completed: true,
      })
      .select('*')
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[habitsService] toggleHabitComplete insert error', error);
      return null;
    }
    log = data as HabitLog;
  }

  if (nextCompleted) {
    await trackEvent({ name: 'complete_habit', userId, metadata: { habit_id: habitId, date } });
  }

  return log;
}

export async function getHabitsForDate(params: {
  userId: string;
  date: string; // YYYY-MM-DD
}): Promise<HabitWithStatus[]> {
  if (!supabase) return [];

  const { userId, date } = params;

  const uuidUserId = toUUID(userId);
  const [{ data: habits, error: habitsError }, { data: logs, error: logsError }] = await Promise.all([
    supabase
      .from('habits')
      .select<'*'>('*')
      .eq('user_id', uuidUserId)
      .eq('is_active', true),
    supabase
      .from('habit_logs')
      .select<'*'>('*')
      .eq('user_id', uuidUserId)
      .eq('date', date),
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


