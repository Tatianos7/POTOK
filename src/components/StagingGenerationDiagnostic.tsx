import { useState } from 'react';
import {
  isStagingGenerationProbeEnabled,
  probeStagingGenerationStatus,
  type StagingGenerationProbeResult,
} from '../services/stagingGenerationProbe';

const explanations: Record<StagingGenerationProbeResult, string> = {
  'endpoint-ready': 'Сервер отвечает на запрос статуса. Это ещё не означает, что запуск генерации разрешён.',
  'request-status-unavailable': 'Серверный запрос статуса недоступен. Генерацию пока нельзя запускать.',
  'auth-denied': 'Сервер не подтвердил доступ этого тестового аккаунта.',
  'server-unavailable': 'Сервер вернул неожиданный ответ. Генерацию пока не запускаем.',
  'network-error': 'Не удалось установить связь. Проверьте интернет и попробуйте ещё раз.',
  'not-staging': 'Проверка доступна только в отдельной тестовой версии POTOK.',
};

/** Visible ONLY on explicitly configured staging preview. No generation POST is exposed. */
export default function StagingGenerationDiagnostic({ currentUserId }: { currentUserId: string }) {
  const [result, setResult] = useState<StagingGenerationProbeResult | null>(null);
  const [running, setRunning] = useState(false);
  if (!isStagingGenerationProbeEnabled()) return null;

  const run = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    try { setResult(await probeStagingGenerationStatus(currentUserId)); }
    finally { setRunning(false); }
  };
  return <section className="mx-auto mt-4 w-full max-w-[560px] rounded-xl border border-emerald-200 bg-emerald-50/50 p-4" aria-label="Проверка генератора Staging">
    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">STAGING · проверка генератора</p>
    <h2 className="mt-2 text-base font-semibold text-stone-900">Подключаем недельное меню</h2>
    <p className="mt-2 text-sm text-stone-700">
      Демо выше не создано генератором. Сейчас можно проверить связь с сервером, но не создавать настоящий план.
    </p>
    <button type="button" disabled={running}
      onClick={() => { void run(); }}
      className="mt-3 w-full rounded-lg border border-emerald-700 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 disabled:opacity-50">
      {running ? 'Проверяем связь…' : 'Проверить связь с генератором'}
    </button>
    {result && <p className="mt-3 text-sm text-stone-800" role="status">{explanations[result]}</p>}
    <p className="mt-3 text-xs text-stone-600">Безопасный GET-запрос. Меню, Premium и дневник не изменяются.</p>
  </section>;
}
