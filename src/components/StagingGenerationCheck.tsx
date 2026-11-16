import { useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF } from '../services/adaptiveNutritionSmokePreview';
import { GenerationRequestFlowV2 } from '../services/generationRequestFlowV2';
import { GenerationRequestFlowEntryV2 } from './GenerationRequestFlowV2';

export function canOpenStagingGenerationCheck(accountId?: string): boolean {
  const env = import.meta.env;
  const stagingUrl = `https://${ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF}.supabase.co`;
  return env.VITE_POTOK_STAGING_GENERATION_CHECK === 'true'
    && env.VITE_SUPABASE_URL?.replace(/\/$/, '') === stagingUrl
    && Boolean(accountId && accountId === env.VITE_POTOK_STAGING_GENERATION_ACCOUNT);
}

export function StagingGenerationCheck({ accountId }: { accountId: string }) {
  const controller = useMemo(() => new GenerationRequestFlowV2(
    supabase, () => canOpenStagingGenerationCheck(accountId), undefined, () => window.sessionStorage,
  ), [accountId]);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat('en', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts();
  const date = ['year', 'month', 'day'].map(kind => parts.find(part => part.type === kind)?.value).join('-');
  return <GenerationRequestFlowEntryV2
    accountId={accountId} today={date} timeZone={timeZone} controller={controller}
  />;
}
