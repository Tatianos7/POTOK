import {useEffect, useRef, useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {isStagingGenerationProbeEnabled} from '../services/stagingGenerationProbe';
import {requestStagingRealWeek, type StagingRealWeekView} from '../services/stagingRealWeek';
import {AuthoringWeekContent} from '../dev/AuthoringWeekViewer';

export default function StagingRealWeekTest({currentUserId}: {currentUserId: string}) {
  const [target, setTarget] = useState(1600), [weekStart, setWeekStart] = useState('2026-11-09');
  const [view, setView] = useState<StagingRealWeekView | null>(null), [day, setDay] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const epoch = useRef(0);
  function clear() {++epoch.current; setView(null); setDay(0); setError(''); setBusy(false);}
  useEffect(() => {const scope = epoch; clear(); return () => {++scope.current;};}, [currentUserId]);
  if (!isStagingGenerationProbeEnabled()) return null;
  async function generate() {
    if (busy || !supabase) return;
    const client = supabase, request = ++epoch.current;
    setView(null); setDay(0); setError(''); setBusy(true);
    try {
      const result = await requestStagingRealWeek(currentUserId, target, weekStart, {
        async userId() {const r = await client.auth.getUser(); return r.error ? null : r.data.user?.id ?? null;},
        async token() {const r = await client.auth.getSession(); return r.error ? null : r.data.session?.access_token ?? null;},
        send: (input, init) => fetch(input, init),
      });
      if (request === epoch.current) setView(result);
    } catch (err) {
      if (request === epoch.current) setError(err instanceof Error && ['AUTH_REQUIRED', 'SESSION_CHANGED'].includes(err.message)
        ? 'Тестовый вход изменился. Войди снова и повтори подбор.'
        : 'Не удалось получить тестовую неделю. Старое меню скрыто. Попробуй ещё раз.');
    } finally {if (request === epoch.current) setBusy(false);}
  }
  return <section className="mt-5 space-y-4 rounded-xl border border-emerald-200 bg-white p-4" aria-label="Тест реальных рецептов">
    <h2 className="text-xl font-semibold">Собрать неделю из реальных рецептов</h2>
    <p className="text-sm">Тест по нашему сборнику. КБЖУ справочные, фактический выход и порции ещё не проверены. Аллергены и личные ограничения не проверяются. В дневник и базу ничего не записывается.</p>
    <label className="block text-sm">Тестовая калорийность
      <select aria-label="Калорийность тестовой недели" value={target} onChange={e => {clear(); setTarget(Number(e.target.value));}} className="mt-2 block w-full rounded-lg border p-3">
        {[1400, 1600, 1800, 2000].map(n => <option key={n} value={n}>{n} ккал в день</option>)}
      </select>
    </label>
    <label className="block text-sm">Начало недели
      <input aria-label="Начало тестовой недели" type="date" value={weekStart} onChange={e => {clear(); setWeekStart(e.target.value);}} className="mt-2 block w-full rounded-lg border p-3" />
    </label>
    <button type="button" disabled={busy || !weekStart} onClick={() => {void generate();}} className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50">
      {busy ? 'Подбираем меню…' : 'Сгенерировать неделю из рецептов'}
    </button>
    {busy && <p role="status">Сервер подбирает семь дней из сборника…</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm">{error}</p>}
    {view && <>
      <p role="status" className="text-sm">В сборнике {view.sourceRecipes} рецепта; {view.eligibleRecipes} с полными справочными числами для теста.</p>
      {view.exactWeekTargetProvenUnreachable && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        По доступным справочным данным при текущих целых порциях и ограничении повторов все семь дней ровно по {target.toLocaleString('ru-RU')} ккал собрать невозможно. Ниже показана фактическая калорийность; размеры порций автоматически не меняются.
      </p>}
      <p className="text-sm">Показаны ингредиенты, подготовка и шаги приготовления. Дополнительные заметки автора в этот тест не включены. Ужин тестово выбирается из обедов. Поиск ограничен; допуск и порции автоматически не меняются.</p>
      <AuthoringWeekContent report={view.report} catalog={view.catalog} selectedDay={day} onSelectDay={setDay} />
    </>}
  </section>;
}
