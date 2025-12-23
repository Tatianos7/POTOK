import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Единый Supabase‑клиент для всего фронтенда.
 *
 * URL и anon‑key берём только из переменных окружения Vite:
 *  - VITE_SUPABASE_URL
 *  - VITE_SUPABASE_ANON_KEY
 *
 * Никаких ключей в коде не хардкодим.
 *
 * Если переменные окружения не заданы, клиент будет null,
 * и приложение продолжит работать (только Supabase-фичи не будут доступны).
 */
const supabaseUrl = (import.meta.env as { VITE_SUPABASE_URL?: string }).VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta.env as { VITE_SUPABASE_ANON_KEY?: string }).VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

if (!supabase) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY не заданы. ' +
      'Supabase-фичи (привычки, аналитика) работать не будут. ' +
      'Добавь их в .env.local для полной функциональности.'
  );
}

/**
 * Простейший тестовый метод, который можно вызвать из любого места,
 * чтобы убедиться, что Supabase настроен корректно.
 *
 * Например, можно вызвать его один раз при старте приложения.
 */
export async function testSupabaseConnection() {
  if (!supabase) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseClient] Supabase client not initialized. Check .env.local file.');
    return null;
  }

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[supabaseClient] auth.getSession error', error);
      return null;
    }

    // eslint-disable-next-line no-console
    console.log('[supabaseClient] ✅ Supabase connection OK, session:', session ? 'exists' : 'none');
    return session;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[supabaseClient] unexpected error while testing connection', err);
    return null;
  }
}

