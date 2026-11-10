import {decodeReferenceSavedGoal, referenceSavedGoalScope, type ReferenceSavedGoal} from '../dev/referenceSavedGoalV1';
const origin = 'https://ozidryfvhkcbtpnulakq.supabase.co';
/** Authenticated user's RLS read, never management credentials or local fallback. */
export async function readReferenceSavedGoal(accountId: string, authorization: string, publicKey: string, send: typeof fetch): Promise<ReferenceSavedGoal> {
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) throw Error('INVALID_SAVED_GOAL');
  const query = new URLSearchParams({select: 'user_id,goal_revision,updated_at,calories,protein,fat,carbs', user_id: 'eq.' + accountId, limit: '2'});
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await send(origin + '/rest/v1/user_goals?' + query.toString(), {method: 'GET', cache: 'no-store', redirect: 'error',
      signal: controller.signal, headers: {Authorization: authorization, apikey: publicKey, Accept: 'application/json'}});
    if (!response.ok) throw Error('SAVED_GOAL_UNAVAILABLE');
    const raw = await response.text();if (new TextEncoder().encode(raw).length > 8192) throw Error('INVALID_SAVED_GOAL');
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length > 1) throw Error('INVALID_SAVED_GOAL');
    if (!rows.length) throw Error('SAVED_GOAL_MISSING');
    const r = rows[0];
    if (!r || typeof r !== 'object' || Array.isArray(r) || r.user_id !== accountId
      || Object.keys(r).sort().join(',') !== 'calories,carbs,fat,goal_revision,protein,updated_at,user_id') throw Error('INVALID_SAVED_GOAL');
    const numeric = (v: unknown) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && /^(0|[1-9]\d{0,4})(\.\d{1,6})?$/.test(v)) return Number(v);
      throw Error('INVALID_SAVED_GOAL');
    };
    return decodeReferenceSavedGoal({scope: referenceSavedGoalScope, accountId, goalRevision: r.goal_revision,
      updatedAt: r.updated_at, calories: numeric(r.calories), protein: numeric(r.protein), fat: numeric(r.fat), carbs: numeric(r.carbs)});
  } finally {clearTimeout(timeout);}
}
