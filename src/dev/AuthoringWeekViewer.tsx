import {useRef, useState} from 'react';
import {decodeAuthoringWeekReport, MAX_AUTHORING_FILE_BYTES, type AuthoringReport} from './authoringWeekReport';
import {decodeAuthoringRecipeCatalog, matchAuthoringRecipe, type AuthoringRecipeCatalog} from './authoringRecipeCatalog';
import AuthoringRecipeDetails from './AuthoringRecipeDetails';

const number = (n: number) => n.toLocaleString('ru-RU', {maximumFractionDigits: 1});
const dateLabel = (date: string) => new Date(date + 'T00:00:00Z').toLocaleDateString('ru-RU', {weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'});
const emptyMessages: Record<string, string> = {
  INCOMPLETE_CATEGORY_POOL: 'В исходных категориях не хватает рецептов.',
  NO_REFERENCE_DAY_IN_EVALUATED_SHORTLISTS: 'В проверенных списках не найден подходящий день.',
  WEEK_SEARCH_LIMIT_REACHED: 'Достигнут лимит поиска недели.',
  NO_REFERENCE_WEEK_IN_RETAINED_POOL: 'В сохранённых вариантах дней подходящая неделя не найдена.',
};

export function AuthoringWeekContent({report, selectedDay, onSelectDay, catalog = null}: {
  report: AuthoringReport; selectedDay: number; onSelectDay: (day: number) => void;
  catalog?: AuthoringRecipeCatalog | null;
}) {
  const day = report.days[selectedDay];
  return <section aria-label="Тестовая неделя" className="space-y-5">
    <h2 className="text-xl font-semibold">Сценарий {number(report.target)} ккал в день</h2>
    <p className="text-sm">Техническая цель для проверки подбора. Не персональная рекомендация.</p>
    {!day ? <p role="status">{emptyMessages[report.status]} Это не доказывает невозможность подбора по всему каталогу.</p> : <>
      <nav aria-label="Дни недели" className="flex flex-wrap gap-2">
        {report.days.map((d, i) => <button key={d.date} type="button" aria-pressed={selectedDay === i}
          onClick={() => onSelectDay(i)} className="rounded-lg border border-stone-300 px-3 py-2 aria-pressed:bg-stone-100">
          {dateLabel(d.date)}
        </button>)}
      </nav>
      <h3 className="text-lg font-semibold">{dateLabel(day.date)}</h3>
      <p className="rounded-xl bg-stone-100 p-4" aria-label="Справочная сумма за день">
        Справочно: {number(day.referenceNutrition.calories)} ккал · Б {number(day.referenceNutrition.protein)} · Ж {number(day.referenceNutrition.fat)} · У исходника {number(day.referenceNutrition.carbs)} · Клетчатка {number(day.referenceNutrition.fiber)} г
      </p>
      <div className="grid gap-3 sm:grid-cols-2">{day.meals.map(meal => {
        const match = matchAuthoringRecipe(catalog, report, meal);
        return <article key={`${day.date}:${meal.slot}:${meal.recipeId}`} className="min-w-0 rounded-xl border border-stone-200 p-4">
        <p className="text-sm text-stone-600">{meal.slot}</p>
        <h4 className="mt-1 font-semibold">{meal.name}</h4>
        <p className="mt-3 text-sm">1 порция по источнику · граммы не подтверждены</p>
        <p className="mt-2 text-sm">Справочно: {number(meal.referenceNutrition.calories)} ккал · Б {number(meal.referenceNutrition.protein)} · Ж {number(meal.referenceNutrition.fat)} · У исходника {number(meal.referenceNutrition.carbs)} · Клетчатка {number(meal.referenceNutrition.fiber)} г</p>
        <details className="mt-3 text-sm"><summary className="cursor-pointer">Данные исходника</summary>
          <p className="break-all">ID: {meal.recipeId}</p><p>В рецепте заявлено порций: {number(meal.sourceDeclaredServings)}. В меню назначена одна; справочные значения уже на порцию.</p>
        </details>
        {match.recipe ? <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Открыть рецепт</summary>
          <AuthoringRecipeDetails recipe={match.recipe} />
        </details> : <p className="mt-3 text-sm" role="status">{match.error}</p>}
      </article>;})}</div>
    </>}
    <details className="rounded-xl border border-stone-200 p-4 text-sm"><summary className="cursor-pointer">Источник и ограничения проверки</summary>
      <p className="mt-3 break-all">{report.sourceName} · SHA-256 {report.sourceHash}</p>
      <p>Хеш указан в файле отчёта; подлинность исходника этим просмотром не подтверждается.</p>
      {report.scope && <p>Результат ограничен проверенными вариантами; глобальный оптимум не подтверждён.</p>}
      <ul className="my-3 list-disc pl-5">{report.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
      <p>Не проверены: аллергены, диетическая безопасность, семантика углеводов, фактический выход, удобство порций, семейства повторов и нутриентные цели.</p>
      <p className="mt-2 break-words">Метки отчёта: {report.notAssessed.join(', ')}</p>
    </details>
  </section>;
}

export default function AuthoringWeekViewer() {
  const [report, setReport] = useState<AuthoringReport | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<AuthoringRecipeCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const catalogGeneration = useRef(0);
  const generation = useRef(0);
  async function loadCatalog(file?: File) {
    const request = ++catalogGeneration.current;
    setCatalog(null); setCatalogError(''); setCatalogLoading(Boolean(file));
    if (!file) return;
    try {
      if (file.size > MAX_AUTHORING_FILE_BYTES) throw new Error('Размер файла превышает 2 МБ.');
      const decoded = decodeAuthoringRecipeCatalog(JSON.parse(await file.text()));
      if (request === catalogGeneration.current) setCatalog(decoded);
    } catch (err) {
      if (request === catalogGeneration.current) setCatalogError(err instanceof SyntaxError ? 'Не удалось прочитать JSON каталога.' : err instanceof Error ? err.message : 'Не удалось открыть каталог.');
    } finally {if (request === catalogGeneration.current) setCatalogLoading(false);}
  }
  async function load(file?: File) {
    const request = ++generation.current;
    setReport(null); setSelectedDay(0); setError(''); setLoading(Boolean(file));
    if (!file) return;
    try {
      if (file.size > MAX_AUTHORING_FILE_BYTES) throw new Error('Размер файла превышает 2 МБ.');
      const decoded = decodeAuthoringWeekReport(JSON.parse(await file.text()));
      if (request === generation.current) setReport(decoded);
    } catch (err) {
      if (request === generation.current) setError(err instanceof SyntaxError ? 'Не удалось прочитать JSON. Меню не открыто.' : err instanceof Error ? err.message : 'Не удалось открыть файл.');
    } finally { if (request === generation.current) setLoading(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-6 p-5 pb-12 text-stone-950">
    <header><p className="text-sm font-semibold tracking-widest">POTOK / ТЕСТОВЫЙ ПРОСМОТР</p><h1 className="mt-2 text-2xl font-semibold">Неделя из сборника</h1></header>
    <aside className="rounded-xl border border-stone-300 bg-stone-50 p-4 text-sm">
      Черновые справочные данные. Порции и выход пока не проверены приготовлением. Это план, а не съеденная еда. Генератор выключен.
    </aside>
    <label className="block rounded-xl border border-stone-200 p-4">Открыть JSON тестовой недели
      <input className="mt-3 block w-full text-sm" type="file" accept=".json,application/json" onChange={e => {void load(e.currentTarget.files?.[0]);}} />
    </label>
    <label className="block rounded-xl border border-stone-200 p-4">Открыть JSON тестового каталога рецептов
      <input className="mt-3 block w-full text-sm" type="file" accept=".json,application/json" onChange={e => {void loadCatalog(e.currentTarget.files?.[0]);}} />
    </label>
    {catalogLoading && <p role="status">Чтение каталога…</p>}
    {catalogError && <p role="alert">{catalogError}</p>}
    {catalog && <p role="status">Каталог загружен: {catalog.recipes.size} рецептов. Данные черновые.</p>}
    <p className="text-sm text-stone-600">Файл обрабатывается в памяти этой страницы. Меню и дневник приложения не изменяются.</p>
    {loading && <p role="status">Чтение файла…</p>}
    {error && <p role="alert">{error}</p>}
    {report && <AuthoringWeekContent report={report} selectedDay={selectedDay} onSelectDay={setSelectedDay} catalog={catalog} />}
  </main>;
}
