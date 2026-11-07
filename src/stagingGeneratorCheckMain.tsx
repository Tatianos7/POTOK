import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { supabase } from './lib/supabaseClient';
import StagingGenerationDiagnostic from './components/StagingGenerationDiagnostic';
import { isStagingGenerationProbeEnabled } from './services/stagingGenerationProbe';

function TestPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!isStagingGenerationProbeEnabled() || !supabase) { setChecked(true); return; }
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!cancelled) {
        setAccountId(error ? null : (data.user?.id ?? null));
        setChecked(true);
      }
    }).catch(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, []);
  return <main className="mx-auto min-h-screen w-full max-w-[560px] bg-white px-5 py-8 text-stone-900">
    <a href="/" className="text-sm font-semibold text-emerald-800">← Вернуться в POTOK</a>
    <h1 className="mt-6 text-2xl font-bold">STAGING · Генератор питания</h1>
    <p className="mt-3 text-sm text-stone-700">
      Это отдельная безопасная проверка серверного подключения. Пока не создано настоящее персональное меню, никаких записей не производится.
    </p>
    {!isStagingGenerationProbeEnabled()
      ? <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-4">Проверка недоступна вне Staging.</p>
      : !checked
        ? <p role="status" className="mt-5">Проверяем тестовый аккаунт…</p>
        : accountId
          ? <StagingGenerationDiagnostic currentUserId={accountId} />
          : <p role="status" className="mt-5 rounded-lg bg-stone-50 p-4">
            Для проверки открой POTOK по ссылке выше и войди в тестовый аккаунт на этом же сайте.
          </p>}
  </main>;
}
ReactDOM.createRoot(document.getElementById('staging-generation-check')!).render(<React.StrictMode><TestPage /></React.StrictMode>);
