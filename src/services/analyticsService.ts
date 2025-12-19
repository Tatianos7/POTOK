import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { toUUID } from '../utils/uuid';

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
    const uuidUserId = toUUID(userId);
    const { error } = await supabase.from('analytics_events').insert({
      user_id: uuidUserId,
      event_name: name,
      metadata: metadata || null,
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[analytics] failed to track event', name, error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[analytics] unexpected error', err);
  }
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


