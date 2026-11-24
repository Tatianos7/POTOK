import {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {isStagingGenerationProbeEnabled} from '../services/stagingGenerationProbe';
import {decodeStagingRealWeek, requestStagingRealWeek, type StagingRealWeekView} from '../services/stagingRealWeek';
import {loadStagingWeekDraft, saveStagingWeekDraft, saveStagingWeekSideDishes, removeStagingWeekDraft, type StagingWeekDraft} from '../services/stagingWeekDraft';
import {AuthoringWeekContent} from '../dev/AuthoringWeekViewer';
import {assessReferenceDailyTargetFitV1} from '../dev/referenceDailyTargetFitV1';
import {referenceSideDishes} from '../dev/referenceSideDishScenario';
import {projectStagingSideDishes, stagingChickenPrepPair, stagingSideDishRecipe, type StagingSideDishEdit} from '../services/stagingWeekSideDishes';
import StagingChickenPrepCard from './StagingChickenPrepCard';
import StagingSideDishEditor from './StagingSideDishEditor';
import StagingWeekShopping from './StagingWeekShopping';

import {stagingSideDishTest} from '../dev/stagingSideDishTest';

export default function StagingRealWeekTest({currentUserId}: {currentUserId: string}) {
  const [target, setTarget] = useState(1600), [weekStart, setWeekStart] = useState('2026-11-09');
  const [view, setView] = useState<StagingRealWeekView | null>(null), [day, setDay] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [saved, setSaved] = useState<StagingWeekDraft | null>(null), [notice, setNotice] = useState('');
  const [excluded, setExcluded] = useState<{id: string; name: string}[]>([]);
  const prepPreview = import.meta.env.MODE === 'staging-preview'
    && new URLSearchParams(window.location.search).get('scenario') === 'two-day-prep';
  const draftStorage = useCallback(() => {
    const storage = window.localStorage;
    if (!prepPreview) return storage;
    const keyFor = (key: string) => 'potok-two-day-prep-preview:' + key;
    return {
      getItem: (key: string) => storage.getItem(keyFor(key)),
      setItem: (key: string, value: string) => storage.setItem(keyFor(key), value),
      removeItem: (key: string) => storage.removeItem(keyFor(key)),
    };
  }, [prepPreview]);
  const epoch = useRef(0);
  const generateButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const currentDraft = saved && saved.view.snapshot === view?.snapshot ? saved : null;
  const report = view && currentDraft?.sideDishes.length ? projectStagingSideDishes(view, currentDraft.sideDishes) : view?.report;
  const targetFit = view?.nutritionGoal && report?.days.length === 7
    ? assessReferenceDailyTargetFitV1(report, view.nutritionGoal)
    : null;
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
      const draft = loadStagingWeekDraft(draftStorage(), currentUserId);
      if (draft) {
        setSaved(draft);
        if (!draft.view.testScenario) setExcluded(draft.view.excludedRecipes);
        if (!draft.view.testScenario && !draft.view.savedGoal) setTarget(draft.target);
        if (!draft.view.testScenario) setWeekStart(draft.weekStart);
        setView(draft.view);
        setNotice('Открыта сохранённая тестовая неделя. Повторный подбор не выполнялся.');
      } else setNotice('На этом устройстве нет сохранённой тестовой недели.');
    } catch {
      if (request === epoch.current) setError('Не удалось открыть черновик или подтвердить вход. Сохранённые данные не изменены. Проверь подключение; можно повторить открытие или собрать новую неделю.');
    } finally {if (request === epoch.current) setBusy(false);}
  }, [currentUserId, draftStorage]);
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
        removeStagingWeekDraft(draftStorage(), currentUserId); setSaved(null);
        setNotice('Сохранённый черновик удалён с этого устройства.');
      } else if (view?.report.days.length === 7) {
        const draft = saveStagingWeekDraft(draftStorage(), currentUserId, view.snapshot, Intl.DateTimeFormat().resolvedOptions().timeZone);
        setSaved(draft); setNotice('Тестовая неделя сохранена на этом устройстве.');
      }
    } catch {
      if (request === epoch.current) setError('Не удалось изменить черновик. Проверь вход и доступность хранилища браузера. Ранее сохранённая неделя не перезаписана.');
    } finally {if (request === epoch.current) setBusy(false);}
  }
  async function confirmSideDishes(edits: StagingSideDishEdit[]): Promise<boolean> {
    if (busy || !supabase || !currentDraft) return false;
    const request = ++epoch.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const user = await supabase.auth.getUser();
      if (request !== epoch.current) return false;
      if (user.error || user.data.user?.id !== currentUserId) {setView(null); setSaved(null); throw Error('SESSION_CHANGED');}
      const draft = saveStagingWeekSideDishes(draftStorage(), currentUserId, currentDraft, edits);
      setSaved(draft);
      setNotice('Гарнир обновлён в сохранённой тестовой неделе на этом устройстве.');
      return true;
    } catch (err) {
      if (request === epoch.current) setError(err instanceof Error && err.message === 'STAGING_DRAFT_CHANGED'
        ? 'Сохранённая неделя изменилась. Открой её заново перед заменой.'
        : 'Не удалось сохранить замену гарнира. Проверь вход и доступность хранилища браузера.');
      return false;
    } finally {if (request === epoch.current) setBusy(false);}
  }
  if (!isStagingGenerationProbeEnabled()) return null;
  async function generate(source?: 'SAVED_GOAL' | typeof stagingSideDishTest.id) {
    if (busy || !supabase) return;
    const client = supabase, request = ++epoch.current;
    setView(null); setDay(0); setError(''); setNotice(''); setBusy(true);
    try {
      if (prepPreview) {
        const {stagingChickenPrepPreviewFixture} = await import('../dev/stagingChickenPrepPreviewFixture');
        const user = await client.auth.getUser();
        if (request !== epoch.current) return;
        if (user.error || user.data.user?.id !== currentUserId) throw Error('SESSION_CHANGED');
        setView(decodeStagingRealWeek(stagingChickenPrepPreviewFixture(currentUserId)));
        return;
      }
      const result = await requestStagingRealWeek(currentUserId, target, weekStart, {
        async userId() {const r = await client.auth.getUser(); return r.error ? null : r.data.user?.id ?? null;},
        async token() {const r = await client.auth.getSession(); return r.error ? null : r.data.session?.access_token ?? null;},
        send: (input, init) => fetch(input, init),
      }, excluded.map(r => r.id), source);
      if (request !== epoch.current) return;
      setView(result);
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
    {prepPreview && <p role="status" className="text-sm">Контрольный черновик заготовки. Остальные блюда учебные. Черновик сохраняется отдельно.</p>}
    <div id="side-dish-test" className="space-y-2 rounded-lg border border-emerald-200 p-3">
      <h3 className="font-semibold">Проверка замены гарнира</h3>
      <button type="button" disabled={busy} onClick={() => {void generate(stagingSideDishTest.id);}}
        className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50">{prepPreview ? 'Открыть контрольный черновик' : 'Собрать тестовую неделю на 1703 ккал'}</button>
      {!prepPreview && <p className="text-sm">Сценарий на 23–29 ноября. Цель аккаунта при этом не меняется.</p>}
    </div>
    <div className="space-y-2" aria-label="Сохранение тестовой недели">
      <button type="button" disabled={busy || view?.report.days.length !== 7} onClick={() => {void changeDraft('save');}}
        className="w-full rounded-lg border border-emerald-800 p-3 font-semibold text-emerald-900 disabled:opacity-50">
        {view?.testScenario ? (saved && !currentDraft ? 'Заменить черновик неделей на 1703 ккал' : 'Сохранить тестовую неделю на 1703 ккал')
          : saved ? 'Заменить сохранённую неделю' : 'Сохранить неделю на устройстве'}
      </button>
      <button type="button" disabled={busy} onClick={() => {void reopen();}} className="w-full rounded-lg border p-3">Открыть сохранённую неделю</button>
      <button type="button" disabled={busy} onClick={() => {void changeDraft('remove');}} className="w-full rounded-lg border p-3">Удалить сохранённый черновик</button>
      {saved && <p className="text-sm">На устройстве сохранён тестовый черновик: {saved.target.toLocaleString('ru-RU')} ккал, начало {saved.weekStart}. Сохранён {new Date(saved.savedAt).toLocaleString('ru-RU')} ({saved.timeZone}).</p>}
    </div>
    {view?.testScenario && report?.days.length === 7 && <button type="button" disabled={busy} onClick={() => {
      setDay(4);
      menu.current?.scrollIntoView({block:'start'});
    }} className="w-full rounded-lg border border-emerald-800 px-4 py-3 font-semibold text-emerald-900 disabled:opacity-50">Открыть пятницу, 27 ноября</button>}
    {!prepPreview && <section aria-label="Другие сценарии подбора" className="space-y-3 rounded-lg border p-3">
      <h3 className="font-semibold">Другие сценарии подбора</h3>
      <label className="block text-sm">Калорийность для ручного подбора
        <select aria-label="Калорийность тестовой недели" value={target} onChange={e => {clear(); setTarget(Number(e.target.value));}} className="mt-2 block w-full rounded-lg border p-3">
          {[1400, 1600, 1800, 2000].map(n => <option key={n} value={n}>{n} ккал в день</option>)}
        </select>
      </label>
      <label className="block text-sm">Начало недели
        <input aria-label="Начало тестовой недели" type="date" value={weekStart} onChange={e => {clear(); setWeekStart(e.target.value);}} className="mt-2 block w-full rounded-lg border p-3" />
      </label>
      <button ref={generateButton} type="button" disabled={busy || !weekStart} onClick={() => {void generate();}}
        className="w-full rounded-lg border p-3">{busy ? 'Подожди…' : 'Сгенерировать неделю из рецептов'}</button>
      <button type="button" disabled={busy || !weekStart} onClick={() => {void generate('SAVED_GOAL');}}
        className="w-full rounded-lg border p-3">Собрать по моей сохранённой цели</button>
    </section>}
    {busy && <p role="status">Выполняем действие с тестовой неделей…</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">{notice}</p>}
    {excluded.length > 0 && <div aria-label="Исключённые блюда" className="rounded-lg border p-3 text-sm">
      <p className="font-semibold">Не предлагать в новом подборе:</p>
      <ul className="list-inside list-disc">{excluded.map(r => <li key={r.id}>{r.name}</li>)}</ul>
      <button type="button" disabled={busy} onClick={() => {clear(); setExcluded([]);}} className="mt-2 rounded border p-2">Снять исключения</button>
      <p className="mt-2">Исключены только эти блюда. Это не проверка ингредиентов, аллергии или диеты.</p>
    </div>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm">{error}</p>}
    {view && report && <>
      {view.testScenario && view.excludedRecipes.length > 0 && <details className="rounded-lg border p-3 text-sm">
        <summary>Фильтр этой тестовой недели</summary>
        <ul className="mt-2 list-inside list-disc">{view.excludedRecipes.map(r => <li key={r.id}>{r.name}</li>)}</ul>
      </details>}
      {view.nutritionGoal && <div className="rounded-lg border border-emerald-200 p-3 text-sm" aria-label="Цель и тестовое меню">
        <p className="font-semibold">{view.testScenario ? 'Тестовая цель для замены гарнира' : 'Цель из тестового аккаунта'}: {view.nutritionGoal.calories.toLocaleString('ru-RU')} ккал</p>
        <p>Б {view.nutritionGoal.protein.toLocaleString('ru-RU')} · Ж {view.nutritionGoal.fat.toLocaleString('ru-RU')} · У {view.nutritionGoal.carbs.toLocaleString('ru-RU')} г</p>
        {targetFit && <p className="mt-2" role="status">Совместные допуски по справочным значениям соблюдены в {targetFit.filter(d => d.passed).length} из 7 дней: калории ±50 ккал, белки и жиры ±10%, углеводы ±15%. Это только числовое сравнение; рецепты и порции остаются непроверенными.</p>}
        {view.savedGoal && !view.jointTargetSearch && view.report.days.length===7 && <p className="mt-2">Эта сохранённая неделя создана до совместного поиска по диапазонам всех трёх показателей БЖУ. Создай новую тестовую неделю, чтобы проверить обновлённый подбор.</p>}
        {view.jointTargetSearch && <div className="mt-2" aria-label="Ограниченный совместный поиск БЖУ">
          {view.jointTargetSearch.wholeWeekRebuilt ? <p>При генерации меню пересобрано целиком, чтобы все семь дней уложились в допуски.</p> : <p>При генерации поиск оценивал замены по трём диапазонам БЖУ одновременно. Проверено вариантов блюд: {view.jointTargetSearch.evaluatedCandidates.toLocaleString('ru-RU')}.</p>}
          {targetFit && targetFit.filter(d=>d.passed).length<7 && <p className="mt-2">В пределах поиска полная неделя не найдена. Это не доказывает, что подходящей недели нет в полном каталоге: поиск ограничен по числу вариантов и размеру списка блюд.</p>}
          {!view.jointTargetSearch.wholeWeekRebuilt && view.jointTargetSearch.exhaustedDays.includes(day) && <p className="mt-2">Для выбранного дня достигнут лимит проверки вариантов. Результат не доказывает, что подходящей замены нет.</p>}
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
            {view.savedGoal && !prepPreview && <p>Использована цель, сохранённая в аккаунте на момент подбора: {new Date(view.savedGoal.updatedAt).toLocaleString('ru-RU')}. При открытии черновика цель не перечитывается.</p>}
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
              const values = report.days.map(d => d.referenceNutrition[axis]);
              return <p key={axis}>{label}: {Math.min(...values).toLocaleString('ru-RU')}–{Math.max(...values).toLocaleString('ru-RU')} г в день.</p>;
            })}
          </div>
        </details>
      </div>}
      <div ref={menu}>
      <AuthoringWeekContent emptyReason={view.minimumWeekCaloriesProvenUnreachable ? 'В этом режиме собрать неделю в выбранном коридоре нельзя: не хватает калорий при нынешних порциях и повторах.' : undefined} report={report} catalog={view.catalog} selectedDay={day} onSelectDay={setDay}
        dayTools={currentDraft && <StagingWeekShopping draft={currentDraft} selectedDay={day} />}
        renderSideDish={meal => {
          const sourceDay = view.report.days[day];
          const original = sourceDay?.meals.find(m => m.recipeId === meal.recipeId);
          const binding = original && stagingSideDishRecipe(view, original);
          if (!original || !binding) return null;
          if (!currentDraft) return {editor: <p className="mt-3 text-sm">Сохрани неделю на устройстве, чтобы заменить гарнир.</p>};
          const edit = currentDraft.sideDishes.find(e => e.date === sourceDay.date && e.recipeId === meal.recipeId);
          const prep = stagingChickenPrepPair(view, day, original, currentDraft.sideDishes);
          return {
            title: edit ? binding.main : undefined,
            composition: edit && <div className="mt-3 text-sm">
              <p>Текущий гарнир: {referenceSideDishes[edit.id].name}, {edit.dryGrams} г в сухом виде.</p>
              <details className="mt-2"><summary>Состав основной части по исходнику</summary>
                <ul className="ml-4 list-disc">{binding.ingredients.map(i => <li key={i.id}>{i.name}</li>)}</ul>
              </details>
            </div>,
            editor: <>
              {prep && <StagingChickenPrepCard prep={prep} />}
              <StagingSideDishEditor key={sourceDay.date + ':' + meal.recipeId} view={view}
              date={sourceDay.date} meal={original} edits={currentDraft.sideDishes} busy={busy} onSave={confirmSideDishes} />
            </>,
          };
        }}
        actionsDisabled={prepPreview || busy || excluded.length >= 28} onExcludeRecipe={meal => {
          if (busy || excluded.length >= 28 || excluded.some(r => r.id === meal.recipeId)) return;
          clear();
          setExcluded(previous => [...previous, {id: meal.recipeId, name: meal.name}].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
          setNotice(`«${meal.name}» исключено. Нажми «Сгенерировать неделю из рецептов». Сохранённая неделя пока не изменена.`);
          generateButton.current?.focus();
          generateButton.current?.scrollIntoView({block: 'center'});
        }} />
      </div>
    </>}
  </section>;
}
