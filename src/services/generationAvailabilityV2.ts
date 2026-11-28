/** A release gate is explicit for each build; runtime Premium and server checks still apply. */
export function isGenerationEnabled(env: Record<string, string | undefined> = import.meta.env): boolean {
  if (env.VITE_POTOK_GENERATION_ENABLED === 'true') return true;
  return env.MODE === 'staging-preview'
    && env.VITE_POTOK_STAGING_PREVIEW === 'true'
    && env.VITE_SUPABASE_URL === 'https://ozidryfvhkcbtpnulakq.supabase.co'
    && env.VITE_POTOK_STAGING_GENERATION_ENABLED === 'true';
}
