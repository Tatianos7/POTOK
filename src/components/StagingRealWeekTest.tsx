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
  const [excluded, setExcluded] = useState<{id: string; name: string}[]>([]);
  const epoch = useRef(0);
  const generateButton = useRef<HTMLButtonElement>(null);
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
        setSaved(draft); setExcluded(draft.view.excludedRecipes); setTarget(draft.target); setWeekStart(draft.weekStart); setView(draft.view);
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
      }, excluded.map(r => r.id));
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
    <button ref={generateButton} type="button" disabled={busy || !weekStart} onClick={() => {void generate();}} className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50">
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
    {excluded.length > 0 && <div aria-label="Исключённые блюда" className="rounded-lg border p-3 text-sm">
      <p className="font-semibold">Не предлагать в новом подборе:</p>
      <ul className="list-inside list-disc">{excluded.map(r => <li key={r.id}>{r.name}</li>)}</ul>
      <button type="button" disabled={busy} onClick={() => {clear(); setExcluded([]);}} className="mt-2 rounded border p-2">Снять исключения</button>
      <p className="mt-2">Исключены только эти блюда. Это не проверка ингредиентов, аллергии или диеты.</p>
    </div>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm">{error}</p>}
    {view && <>
      <p role="status" className="text-sm">В сборнике {view.sourceRecipes} рецепта; {view.eligibleRecipes} с полными справочными числами для теста.</p>
      {view.minimumWeekCaloriesProvenUnreachable && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        При текущих целых порциях и ограничении повторов не хватает калорий на неделю. Нужно не меньше {view.capacity.required.toLocaleString('ru-RU')} ккал; даже верхняя оценка доступных сочетаний — {view.capacity.maximum?.toLocaleString('ru-RU')} ккал. Порции и ограничения автоматически не меняются.
      </p>}
      <p className="text-sm">Показаны ингредиенты, подготовка и шаги приготовления. Дополнительные заметки автора в этот тест не включены. Ужин тестово выбирается из обедов. Поиск ограничен; допуск и порции автоматически не меняются.</p>
      {view.report.days.length === 7 && <div className="rounded-lg border p-3 text-sm" aria-label="Проверки тестового меню">
        <p className="font-semibold">Что проверено в этом меню</p>
        <p>Все семь дней в коридоре ±50 ккал. Разных блюд: {view.catalog.recipes.size}. Одно блюдо встречается не больше двух раз за неделю, внутри дня не повторяется.</p>
        <p className="mt-2">БЖУ показаны по источнику. Соответствие персональным целям БЖУ, аллергиям и диетам пока не проверяется.</p>
        <details className="mt-2"><summary>Диапазон БЖУ по дням</summary>
          {([['protein','Белки'],['fat','Жиры'],['carbs','Углеводы исходника'],['fiber','Клетчатка']] as const).map(([axis,label]) => {
            const values = view.report.days.map(d => d.referenceNutrition[axis]);
            return <p key={axis}>{label}: {Math.min(...values).toLocaleString('ru-RU')}–{Math.max(...values).toLocaleString('ru-RU')} г в день.</p>;
          })}
        </details>
      </div>}
      <AuthoringWeekContent emptyReason={view.minimumWeekCaloriesProvenUnreachable ? 'В этом режиме собрать неделю в выбранном коридоре нельзя: не хватает калорий при нынешних порциях и повторах.' : undefined} report={view.report} catalog={view.catalog} selectedDay={day} onSelectDay={setDay}
        actionsDisabled={busy || excluded.length >= 28} onExcludeRecipe={meal => {
          if (busy || excluded.length >= 28 || excluded.some(r => r.id === meal.recipeId)) return;
          clear();
          setExcluded(previous => [...previous, {id: meal.recipeId, name: meal.name}].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
          setNotice(`«${meal.name}» исключено. Нажми «Сгенерировать неделю из рецептов». Сохранённая неделя пока не изменена.`);
          generateButton.current?.focus();
          generateButton.current?.scrollIntoView({block: 'center'});
        }} />
    </>}
  </section>;
}
