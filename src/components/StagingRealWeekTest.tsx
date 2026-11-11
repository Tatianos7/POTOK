import {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {isStagingGenerationProbeEnabled} from '../services/stagingGenerationProbe';
import {requestStagingRealWeek, type StagingRealWeekView} from '../services/stagingRealWeek';
import {loadStagingWeekDraft, saveStagingWeekDraft, removeStagingWeekDraft, type StagingWeekDraft} from '../services/stagingWeekDraft';
import {AuthoringWeekContent} from '../dev/AuthoringWeekViewer';
import {assessReferenceDailyTargetFitV1} from '../dev/referenceDailyTargetFitV1';

export default function StagingRealWeekTest({currentUserId}: {currentUserId: string}) {
  const [target, setTarget] = useState(1600), [weekStart, setWeekStart] = useState('2026-11-09');
  const [view, setView] = useState<StagingRealWeekView | null>(null), [day, setDay] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [saved, setSaved] = useState<StagingWeekDraft | null>(null), [notice, setNotice] = useState('');
  const [goalSource, setGoalSource] = useState<'SAVED_GOAL' | undefined>();
  const [excluded, setExcluded] = useState<{id: string; name: string}[]>([]);
  const epoch = useRef(0);
  const generateButton = useRef<HTMLButtonElement>(null);
  const targetFit = view?.savedGoal && view.report.days.length === 7
    ? assessReferenceDailyTargetFitV1(view.report, view.savedGoal)
    : null;
  function clear() {++epoch.current; setView(null); setDay(0); setError(''); setNotice(''); setBusy(false);}
  const reopen = useCallback(async () => {
    const request = ++epoch.current;
    setView(null); setSaved(null); setGoalSource(undefined); setDay(0); setError(''); setNotice('');
    if (!isStagingGenerationProbeEnabled() || !supabase) return;
    setBusy(true);
    try {
      const user = await supabase.auth.getUser();
      if (request !== epoch.current) return;
      if (user.error || user.data.user?.id !== currentUserId) throw Error('SESSION_CHANGED');
      const draft = loadStagingWeekDraft(window.localStorage, currentUserId);
      if (draft) {
        setSaved(draft); setGoalSource(draft.view.savedGoal ? 'SAVED_GOAL' : undefined); setExcluded(draft.view.excludedRecipes); setTarget(draft.target); setWeekStart(draft.weekStart); setView(draft.view);
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
  async function generate(source = goalSource) {
    if (busy || !supabase) return;
    const client = supabase, request = ++epoch.current;
    setView(null); setDay(0); setError(''); setNotice(''); setBusy(true);
    try {
      const result = await requestStagingRealWeek(currentUserId, target, weekStart, {
        async userId() {const r = await client.auth.getUser(); return r.error ? null : r.data.user?.id ?? null;},
        async token() {const r = await client.auth.getSession(); return r.error ? null : r.data.session?.access_token ?? null;},
        send: (input, init) => fetch(input, init),
      }, excluded.map(r => r.id), source);
      if (request === epoch.current) {setView(result); setGoalSource(source); if (result.savedGoal) setTarget(result.report.target);}
    } catch (err) {
      const messages: Record<string, string> = {SAVED_GOAL_MISSING: 'В этом тестовом аккаунте не сохранена цель питания. Можно продолжить с тестовой калорийностью.', SAVED_GOAL_UNAVAILABLE: 'Не удалось прочитать цель. Проверь подключение и повтори. Локальная копия цели не используется.', INVALID_SAVED_GOAL: 'Сохранённая цель неполная или некорректная. Подбор по ней не выполнен.', SAVED_GOAL_CHANGED: 'Цель изменилась во время подбора. Нажми генерацию по сохранённой цели ещё раз.'};
      if (request === epoch.current) setError(err instanceof Error && messages[err.message] ? messages[err.message] : err instanceof Error && ['AUTH_REQUIRED', 'SESSION_CHANGED'].includes(err.message)
        ? 'Тестовый вход изменился. Войди снова и повтори подбор.'
        : 'Не удалось получить тестовую неделю. Старое меню скрыто. Попробуй ещё раз.');
    } finally {if (request === epoch.current) setBusy(false);}
  }
  return <section className="mt-5 space-y-4 rounded-xl border border-emerald-200 bg-white p-4" aria-label="Тест реальных рецептов">
    <h2 className="text-xl font-semibold">Собрать неделю из реальных рецептов</h2>
    <p className="text-sm">Тест по нашему сборнику. КБЖУ справочные, фактический выход и порции ещё не проверены. Аллергены и личные ограничения не проверяются. В дневник и базу ничего не записывается. Можно сохранить одну тестовую неделю в этом браузере на этом устройстве. Она не синхронизируется; очистка данных браузера удалит её.</p>
    <label className="block text-sm">Тестовая калорийность
      <select aria-label="Калорийность тестовой недели" value={target} onChange={e => {clear(); setTarget(Number(e.target.value)); setGoalSource(undefined);}} className="mt-2 block w-full rounded-lg border p-3">
        {![1400, 1600, 1800, 2000].includes(target) && <option disabled value={target}>{target} ккал — сохранённая цель</option>}
        {[1400, 1600, 1800, 2000].map(n => <option key={n} value={n}>{n} ккал в день</option>)}
      </select>
    </label>
    <label className="block text-sm">Начало недели
      <input aria-label="Начало тестовой недели" type="date" value={weekStart} onChange={e => {clear(); setWeekStart(e.target.value);}} className="mt-2 block w-full rounded-lg border p-3" />
    </label>
    <button ref={generateButton} type="button" disabled={busy || !weekStart} onClick={() => {void generate();}} className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50">
      {busy ? 'Подожди…' : 'Сгенерировать неделю из рецептов'}
    </button>
    <button type="button" disabled={busy || !weekStart} onClick={() => {void generate('SAVED_GOAL');}}
      className="w-full rounded-lg border border-emerald-800 px-4 py-3 font-semibold text-emerald-900 disabled:opacity-50">Собрать по моей сохранённой цели</button>
    {goalSource === 'SAVED_GOAL' && <p className="text-sm">Для нового подбора цель будет прочитана из тестового аккаунта заново. Чтобы выбрать тестовый сценарий, измени калорийность.</p>}
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
      {view.savedGoal && <div className="rounded-lg border border-emerald-200 p-3 text-sm" aria-label="Сохранённая цель и меню">
        <p className="font-semibold">Цель из тестового аккаунта: {view.savedGoal.calories.toLocaleString('ru-RU')} ккал</p>
        <p>Б {view.savedGoal.protein.toLocaleString('ru-RU')} · Ж {view.savedGoal.fat.toLocaleString('ru-RU')} · У {view.savedGoal.carbs.toLocaleString('ru-RU')} г</p>
        {targetFit && <p className="mt-2" role="status">Совместные допуски по справочным значениям соблюдены в {targetFit.filter(d => d.passed).length} из 7 дней: калории ±50 ккал, белки и жиры ±10%, углеводы ±15%. Это только числовое сравнение; рецепты и порции остаются непроверенными.</p>}
        {view.macroFit && <div className="mt-2" aria-label="Подбор по белкам и жирам">
          <p>Поиск только приближал белки и жиры к цели; ошибка уменьшилась в {view.macroFit.improvedDays} из 7 дней. Это не означает, что дневные допуски по БЖУ соблюдены.</p>
          {view.macroFit.days[day] && <p className="mt-2">{view.macroFit.days[day].before.protein === view.macroFit.days[day].after.protein && view.macroFit.days[day].before.fat === view.macroFit.days[day].after.fat
            ? 'Для выбранного дня подбор не нашёл замену, которая приблизила бы белок или жир к цели.'
            : 'В выбранном дне замены приблизили белок или жир к цели.'}</p>}
        </div>}
        {view.report.days[day] && targetFit?.[day] && <div className="mt-2" aria-label="Сравнение БЖУ выбранного дня">{(['protein','fat','carbs'] as const).map(axis => {
          const fit = targetFit[day].axes[axis];
          return <p key={axis}>{({protein:'Белок',fat:'Жир',carbs:'Углеводы по рецептам'})[axis]}: цель {fit.target.toLocaleString('ru-RU')} г · допустимо {fit.minimum.toLocaleString('ru-RU')}–{fit.maximum.toLocaleString('ru-RU')} г · меню {fit.actual.toLocaleString('ru-RU')} г · {fit.passed ? 'в пределах допуска' : 'за пределами допуска'}.</p>;
        })}</div>}
        <details className="mt-3">
          <summary>Что ещё важно знать об этом сравнении</summary>
          <div className="mt-2 space-y-2">
            <p>Цифры диапазонов утверждены для проверки подбора, но расчёт здесь остаётся справочным: рецепты и порции ещё не прошли проверку владельца. Попадание в эти окна само по себе не означает допуска недели в продукт.</p>
            <p>Углеводы проверяются по числу, указанному в рецептах. Их семантика может отличаться от сохранённой цели, поэтому этот результат не подтверждает корректность источниковых КБЖУ.</p>
            <p>Использована цель, сохранённая в аккаунте на момент подбора: {new Date(view.savedGoal.updatedAt).toLocaleString('ru-RU')}. При открытии черновика цель не перечитывается.</p>
          </div>
        </details>
      </div>}
      <p role="status" className="text-sm">В сборнике {view.sourceRecipes} рецепта; {view.eligibleRecipes} с полными справочными числами для теста.</p>
      {view.minimumWeekCaloriesProvenUnreachable && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        При текущих целых порциях и ограничении повторов не хватает калорий на неделю. Нужно не меньше {view.capacity.required.toLocaleString('ru-RU')} ккал; даже верхняя оценка доступных сочетаний — {view.capacity.maximum?.toLocaleString('ru-RU')} ккал. Порции и ограничения автоматически не меняются.
      </p>}
      <p className="text-sm">Показаны ингредиенты, подготовка и шаги приготовления. Дополнительные заметки автора в этот тест не включены. Ужин тестово выбирается из обедов. Поиск ограничен; допуск и порции автоматически не меняются.</p>
      {view.report.days.length === 7 && <div className="rounded-lg border p-3 text-sm" aria-label="Проверки тестового меню">
        <p className="font-semibold">Коротко о неделе</p>
        <p>Калорийность в нужном диапазоне все 7 дней. Разных блюд: {view.catalog.recipes.size}; одно блюдо встречается не больше двух раз за неделю и не повторяется в течение дня.</p>
        {targetFit && <p className="mt-2">Дневные допуски калорий и БЖУ по справочным значениям соблюдены в {targetFit.filter(d => d.passed).length} из 7 дней. Проверка проводится совместно для каждого дня и не подтверждает точность рецептов или порций.</p>}
        {view.report.dailyStapleVariety ? <p className="mt-2">Гарниры из круп, картофеля, макарон и бобовых чередуются в течение дня.</p>
          : <p className="mt-2">Эта сохранённая неделя создана до проверки разнообразия гарниров. Сгенерируй новую неделю, чтобы применить правило.</p>}
        <details className="mt-2"><summary>Подробности проверки и справочные значения</summary>
          <div className="mt-2 space-y-2">
            <p>КБЖУ взяты из рецептов. Аллергии, диеты и личные ограничения здесь не проверяются.</p>
            {([['protein','Белок'],['fat','Жир'],['carbs','Углеводы по рецептам'],['fiber','Клетчатка']] as const).map(([axis,label]) => {
              const values = view.report.days.map(d => d.referenceNutrition[axis]);
              return <p key={axis}>{label}: {Math.min(...values).toLocaleString('ru-RU')}–{Math.max(...values).toLocaleString('ru-RU')} г в день.</p>;
            })}
          </div>
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
