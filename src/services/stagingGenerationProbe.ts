import { supabase } from '../lib/supabaseClient';

/** Diagnostic only: GET a new, deliberately nonexistent operation ID.
 * No POST, generation request, activation or plan mutation is allowed here.
 */
export type StagingGenerationProbeResult =
  | 'endpoint-ready'
  | 'request-status-unavailable'
  | 'auth-denied'
  | 'server-unavailable'
  | 'network-error'
  | 'not-staging';

export function isStagingGenerationProbeEnabled(env: Record<string, string | undefined> = import.meta.env): boolean {
  if (env.VITE_POTOK_STAGING_PREVIEW !== 'true' || env.VITE_SUPABASE_URL !== 'https://ozidryfvhkcbtpnulakq.supabase.co') return false;
  return typeof env.VITE_SUPABASE_ANON_KEY === 'string' && env.VITE_SUPABASE_ANON_KEY.length > 20;
}

export function classifyStagingGenerationProbe(status: number, body: unknown): StagingGenerationProbeResult {
  const code = body && typeof body === 'object' && !Array.isArray(body) && 'error' in body
    ? (body as { error?: unknown }).error : null;
  if (status === 404 && code === 'REQUEST_NOT_FOUND') return 'endpoint-ready';
  if (status === 401 || status === 403) return 'auth-denied';
  if (status === 404 || status === 405 || status === 502 || status === 503) return 'request-status-unavailable';
  return 'server-unavailable';
}

export async function probeStagingGenerationStatus(accountId: string): Promise<StagingGenerationProbeResult> {
  if (!isStagingGenerationProbeEnabled() || !supabase || !accountId) return 'not-staging';
  const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!publicKey) return 'not-staging';
  try {
    // getUser verifies the signed-in account rather than trusting cached user display details.
    const user = await supabase.auth.getUser();
    if (user.error || user.data.user?.id !== accountId) return 'auth-denied';
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (session.error || !accessToken) return 'auth-denied';
    const operationId = crypto.randomUUID();
    const response = await fetch(
      `https://ozidryfvhkcbtpnulakq.supabase.co/functions/v1/adaptive-nutrition-generate-v2?requestOperationId=${encodeURIComponent(operationId)}`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: publicKey,
          Accept: 'application/json',
        },
      },
    );
    const body: unknown = await response.json().catch(() => null);
    return classifyStagingGenerationProbe(response.status, body);
  } catch {
    return 'network-error';
  }
}
