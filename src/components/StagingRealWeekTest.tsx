import {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {isStagingGenerationProbeEnabled} from '../services/stagingGenerationProbe';
import {requestStagingRealWeek, type StagingRealWeekView} from '../services/stagingRealWeek';
import {loadStagingWeekDraft, saveStagingWeekDraft, removeStagingWeekDraft, type StagingWeekDraft} from '../services/stagingWeekDraft';
import {AuthoringWeekContent} from '../dev/AuthoringWeekViewer';

export default function StagingRealWeekTest({currentUserId}: {currentUserId: string}) {
  const [target, setTarget] = useState(1600), [weekStart, setWeekStart] = useState('2026-11-09');
  const [view, setView] = useState<StagingRealWeekView | null>(null), [day, setDay] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [saved, setSaved] = useState<StagingWeekDraft | null>(null), [notice, setNotice] = useState('');
  const epoch = useRef(0);
  function clear() {++epoch.current; setView(null); setDay(0); setError(''); setNotice(''); setBusy(false);}
  const reopen = useCallback(async () => {
    const request = ++epoch.current;
    setView(null); setSaved(null); setDay(0); setError(''); setNotice('');
    if (!isStagingGenerationProbeEnabled() || !supabase) return;
    setBusy(true);
    try {
      const user = await supabase.auth.getUser();
      if (request !== epoch.current) return;
      if (user.error || user.data.user?.id !== currentUserId) throw Error('SESSION_CHANGED');
      const draft = loadStagingWeekDraft(window.localStorage, currentUserId);
      if (draft) {
        setSaved(draft); setTarget(draft.target); setWeekStart(draft.weekStart); setView(draft.view);
        setNotice('Открыта сохранённая тестовая неделя. Повторный подбор не выполнялся.');
      } else setNotice('На этом устройстве нет сохранённой тестовой недели.');
    } catch {
      if (request === epoch.current) setError('Не удалось открыть черновик или подтвердить вход. Сохранённые данные не изменены. Проверь подключение; можно повторить открытие или собрать новую неделю.');
    } finally {if (request === epoch.current) setBusy(false);}
  }, [currentUserId]);
  useEffect(() => {void reopen(); const scope = epoch; return () => {++scope.current;};}, [reopen]);
  async function changeDraft(action: 'save' | 'remove') {
    if (busy || !supabase) return;
    const request = ++epoch.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const user = await supabase.auth.getUser();
      if (request !== epoch.current) return;
      if (user.error || user.data.user?.id !== currentUserId) {setView(null); setSaved(null); throw Error('SESSION_CHANGED');}
      if (action === 'remove') {
        removeStagingWeekDraft(window.localStorage, currentUserId); setSaved(null);
        setNotice('Сохранённый черновик удалён с этого устройства.');
      } else if (view?.report.days.length === 7) {
        const draft = saveStagingWeekDraft(window.localStorage, currentUserId, view.snapshot, Intl.DateTimeFormat().resolvedOptions().timeZone);
        setSaved(draft); setNotice('Тестовая неделя сохранена на этом устройстве.');
      }
    } catch {
      if (request === epoch.current) setError('Не удалось изменить черновик. Проверь вход и доступность хранилища браузера. Ранее сохранённая неделя не перезаписана.');
    } finally {if (request === epoch.current) setBusy(false);}
  }
  if (!isStagingGenerationProbeEnabled()) return null;
  async function generate() {
    if (busy || !supabase) return;
    const client = supabase, request = ++epoch.current;
    setView(null); setDay(0); setError(''); setNotice(''); setBusy(true);
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
    <p className="text-sm">Тест по нашему сборнику. КБЖУ справочные, фактический выход и порции ещё не проверены. Аллергены и личные ограничения не проверяются. В дневник и базу ничего не записывается. Можно сохранить одну тестовую неделю в этом браузере на этом устройстве. Она не синхронизируется; очистка данных браузера удалит её.</p>
    <label className="block text-sm">Тестовая калорийность
      <select aria-label="Калорийность тестовой недели" value={target} onChange={e => {clear(); setTarget(Number(e.target.value));}} className="mt-2 block w-full rounded-lg border p-3">
        {[1400, 1600, 1800, 2000].map(n => <option key={n} value={n}>{n} ккал в день</option>)}
      </select>
    </label>
    <label className="block text-sm">Начало недели
      <input aria-label="Начало тестовой недели" type="date" value={weekStart} onChange={e => {clear(); setWeekStart(e.target.value);}} className="mt-2 block w-full rounded-lg border p-3" />
    </label>
    <button type="button" disabled={busy || !weekStart} onClick={() => {void generate();}} className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50">
      {busy ? 'Подожди…' : 'Сгенерировать неделю из рецептов'}
    </button>
    <div className="space-y-2" aria-label="Сохранение тестовой недели">
      <button type="button" disabled={busy || view?.report.days.length !== 7} onClick={() => {void changeDraft('save');}}
        className="w-full rounded-lg border border-emerald-800 p-3 font-semibold text-emerald-900 disabled:opacity-50">
        {saved ? 'Заменить сохранённую неделю' : 'Сохранить неделю на устройстве'}
      </button>
      <button type="button" disabled={busy} onClick={() => {void reopen();}} className="w-full rounded-lg border p-3">Открыть сохранённую неделю</button>
      <button type="button" disabled={busy} onClick={() => {void changeDraft('remove');}} className="w-full rounded-lg border p-3">Удалить сохранённый черновик</button>
      {saved && <p className="text-sm">На устройстве сохранён тестовый черновик: {saved.target.toLocaleString('ru-RU')} ккал, начало {saved.weekStart}. Сохранён {new Date(saved.savedAt).toLocaleString('ru-RU')} ({saved.timeZone}).</p>}
    </div>
    {busy && <p role="status">Выполняем действие с тестовой неделей…</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm">{error}</p>}
    {view && <>
      <p role="status" className="text-sm">В сборнике {view.sourceRecipes} рецепта; {view.eligibleRecipes} с полными справочными числами для теста.</p>
      {view.minimumWeekCaloriesProvenUnreachable && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        По доступным справочным данным при текущих целых порциях и ограничении повторов не хватает калорий для недельного минимума выбранного коридора. Размеры порций автоматически не меняются.
      </p>}
      <p className="text-sm">Показаны ингредиенты, подготовка и шаги приготовления. Дополнительные заметки автора в этот тест не включены. Ужин тестово выбирается из обедов. Поиск ограничен; допуск и порции автоматически не меняются.</p>
      <AuthoringWeekContent report={view.report} catalog={view.catalog} selectedDay={day} onSelectDay={setDay} />
    </>}
  </section>;
}
