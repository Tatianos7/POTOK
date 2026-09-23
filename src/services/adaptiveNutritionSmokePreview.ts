import type { PremiumNutritionWeek } from './premiumTodayAdapter';
import { nutritionWeekDates } from '../utils/nutritionWeek';

export const ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF = 'ozidryfvhkcbtpnulakq' as const;
export const ADAPTIVE_NUTRITION_SMOKE_ACCOUNT_ID = '88c26f6b-ebc8-4bff-864d-9194fbd27f8d' as const;
export const ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID = '7e710000-0000-4000-8000-000000000001' as const;

export type AdaptiveNutritionSmokePreview =
  | { kind: 'disabled' }
  | { kind: 'blocked'; reason: 'read-off' | 'runtime-off' | 'invalid-project' | 'missing-config' | 'account-mismatch' }
  | { kind: 'ready'; weeks: { active: PremiumNutritionWeek; provisional: PremiumNutritionWeek } };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function stagingHostMatches(urlValue: string): boolean {
  try {
    const url = new URL(urlValue);
    return url.protocol === 'https:' && url.hostname === `${ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF}.supabase.co`
      && url.pathname === '/' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function emptyWeek(
  currentUserId: string,
  selectionId: string,
  today: string,
  offset: 0 | 1,
): PremiumNutritionWeek {
  const dates = nutritionWeekDates(today, offset);
  return {
    scope: { userId: currentUserId, planId: selectionId,
      planVersion: 'server-current-read-v1', goalVersion: 'server-current-read-v1' },
    status: offset === 0 ? 'active' : 'provisional',
    startDate: dates[0], endDate: dates[6], contentStatus: 'incomplete',
    targetValidation: 'not-validated',
    days: dates.map((date) => ({ date, kind: 'planned', sourceDay: null })),
  };
}

export function resolveAdaptiveNutritionSmokePreview(
  env: Readonly<Record<string, string | undefined>>,
  currentUserId: string | undefined,
  today: string,
): AdaptiveNutritionSmokePreview {
  if (env.VITE_ADAPTIVE_NUTRITION_STAGING_SMOKE_V1 !== 'true') return { kind: 'disabled' };
  if (env.VITE_ADAPTIVE_NUTRITION_READ_V1 !== 'true') return { kind: 'blocked', reason: 'read-off' };
  if (env.VITE_ADAPTIVE_NUTRITION_RUNTIME_V1 !== 'true') return { kind: 'blocked', reason: 'runtime-off' };

  const projectRef = env.VITE_ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF;
  const url = env.VITE_SUPABASE_URL;
  if (projectRef !== ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF || !url || !stagingHostMatches(url)) {
    return { kind: 'blocked', reason: 'invalid-project' };
  }

  const configuredAccount = env.VITE_ADAPTIVE_NUTRITION_SMOKE_ACCOUNT_ID;
  const configuredSelection = env.VITE_ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID;
  if (!env.VITE_SUPABASE_ANON_KEY?.trim() || configuredAccount !== ADAPTIVE_NUTRITION_SMOKE_ACCOUNT_ID
      || !uuidPattern.test(configuredAccount)
      || configuredSelection !== ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID) {
    return { kind: 'blocked', reason: 'missing-config' };
  }
  if (!currentUserId || currentUserId !== configuredAccount) {
    return { kind: 'blocked', reason: 'account-mismatch' };
  }

  try {
    return { kind: 'ready', weeks: {
      active: emptyWeek(currentUserId, configuredSelection, today, 0),
      provisional: emptyWeek(currentUserId, configuredSelection, today, 1),
    } };
  } catch {
    return { kind: 'blocked', reason: 'missing-config' };
  }
}

export function getAdaptiveNutritionSmokePreview(
  currentUserId: string | undefined,
  today: string,
): AdaptiveNutritionSmokePreview {
  const env = typeof import.meta !== 'undefined'
    ? ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {})
    : {};
  return resolveAdaptiveNutritionSmokePreview(env, currentUserId, today);
}
