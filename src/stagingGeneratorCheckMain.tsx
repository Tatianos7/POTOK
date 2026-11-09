import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { supabase } from './lib/supabaseClient';
import StagingGenerationDiagnostic from './components/StagingGenerationDiagnostic';
import StagingSyntheticWeekDemo from './components/StagingSyntheticWeekDemo';
import StagingGenerationReadback from './components/StagingGenerationReadback';
import StagingRealWeekTest from './components/StagingRealWeekTest';
import { isStagingGenerationProbeEnabled } from './services/stagingGenerationProbe';

export function TestPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let cancelled = false, epoch = 0;
    const client = supabase;
    if (!isStagingGenerationProbeEnabled() || !client) {setChecked(true); return;}
    async function verify() {
      const request = ++epoch;
      setAccountId(null); setChecked(false);
      try {
        const {data, error} = await client!.auth.getUser();
        if (!cancelled && request === epoch) {setAccountId(error ? null : data.user?.id ?? null); setChecked(true);}
      } catch {if (!cancelled && request === epoch) setChecked(true);}
    }
    void verify();
    // Never await another Auth call inside the synchronous Auth event callback.
    const {data: {subscription}} = client.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return;
      ++epoch; setAccountId(null); setChecked(event === 'SIGNED_OUT');
      if (event !== 'SIGNED_OUT') window.setTimeout(() => {if (!cancelled) void verify();}, 0);
    });
    return () => {cancelled = true; ++epoch; subscription.unsubscribe();};
  }, []);
  return <main className="mx-auto min-h-screen w-full max-w-[560px] bg-white px-5 py-8 text-stone-900">
    <a href="/" className="text-sm font-semibold text-emerald-800">← Вернуться в POTOK</a>
    <h1 className="mt-6 text-2xl font-bold">STAGING · Генератор питания</h1>
    <p className="mt-3 text-sm text-stone-700">
      Здесь можно собрать тестовую неделю из нашего сборника, открыть рецепты и сохранить черновик на устройстве. Персональный план не включается, записей в дневник и базу нет.
    </p>
    {!isStagingGenerationProbeEnabled()
      ? <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-4">Проверка недоступна вне Staging.</p>
      : !checked
        ? <p role="status" className="mt-5">Проверяем тестовый аккаунт…</p>
        : accountId
          ? <>
            <StagingRealWeekTest key={accountId} currentUserId={accountId} />
            <details className="mt-5"><summary>Технические проверки</summary>
              <StagingGenerationDiagnostic currentUserId={accountId} />
              <StagingSyntheticWeekDemo currentUserId={accountId} />
              <StagingGenerationReadback currentUserId={accountId} />
            </details>
          </>
          : <p role="status" className="mt-5 rounded-lg bg-stone-50 p-4">
            Для проверки открой POTOK по ссылке выше и войди в тестовый аккаунт на этом же сайте.
          </p>}
  </main>;
}
ReactDOM.createRoot(document.getElementById('staging-generation-check')!).render(<React.StrictMode><TestPage /></React.StrictMode>);
