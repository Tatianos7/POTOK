import {useReducer} from 'react';
import type {ReferenceDailyTargetFitV1} from './referenceDailyTargetFitV1';
import {
  getSideDishScenario, initialSideDishPreview, previewReferenceSideDish,
  reduceSideDishPreview, referenceSideDishScenarios, referenceSideDishes, type SideDishId,
} from './referenceSideDishScenario';

const labels = {calories: 'Калории', protein: 'Белки', fat: 'Жиры', carbs: 'Углеводы'} as const;
const axes = Object.keys(labels) as (keyof typeof labels)[];
const format = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 3});
const amount = (value: number, axis: keyof typeof labels) =>
  `${format.format(value)} ${axis === 'calories' ? 'ккал' : 'г'}`;

export function ReferenceSideDishComparison({before, after}: {before: ReferenceDailyTargetFitV1; after: ReferenceDailyTargetFitV1}) {
  return <table className="w-full text-left text-sm">
        <caption className="mb-2 text-left font-semibold">КБЖУ за день</caption>
        <thead><tr><th scope="col">Показатель</th><th scope="col">Сейчас</th><th scope="col">После замены</th></tr></thead>
        <tbody>{axes.map(axis => <tr key={axis} className="border-t align-top">
          <th scope="row" className="py-2 font-normal">{labels[axis]}</th>
          <td className="py-2">{amount(before.axes[axis].actual, axis)}</td>
          <td className="py-2">{amount(after.axes[axis].actual, axis)}
            {!after.axes[axis].passed && <span className="block text-rose-800">Вне допуска</span>}
          </td>
        </tr>)}</tbody>
      </table>;
}

export default function ReferenceSideDishPreview() {
  const [{date, confirmed, pending}, dispatch] = useReducer(reduceSideDishPreview, initialSideDishPreview);
  const scenario = getSideDishScenario(date);
  const current = confirmed[scenario.date]
    ?? {id: scenario.original, dryGrams: referenceSideDishes[scenario.original].dryGrams};
  const before = previewReferenceSideDish(scenario, current);
  const after = pending ? previewReferenceSideDish(scenario, pending) : null;

  return <main className="mx-auto max-w-xl space-y-5 px-4 py-6 sm:px-6">
    <h1 className="text-2xl font-semibold">Замена гарнира</h1>
    <p className="text-sm">Локальный тест на справочных КБЖУ. После обновления страницы откроется исходный вариант.</p>
    <label className="block">День тестовой недели
      <select className="mt-1 block min-h-11 w-full rounded-lg border p-3" value={date} onChange={event =>
        dispatch({type: 'day', date: event.target.value as typeof date})}>
        {referenceSideDishScenarios.map(day => <option key={day.date} value={day.date}>{day.weekday}</option>)}
      </select>
    </label>
    <section className="space-y-1 rounded-xl border p-4" aria-label="Текущий приём пищи" aria-live="polite">
      <h2 className="font-semibold">{scenario.main}</h2>
      <p>Текущий гарнир: {referenceSideDishes[current.id].name}, {current.dryGrams} г в сухом виде</p>
      <p className="text-sm">За день: {amount(before.day.axes.calories.actual, 'calories')}</p>
    </section>
    <label className="block">Новый гарнир
      <select className="mt-1 block min-h-11 w-full rounded-lg border p-3" value={pending?.id ?? ''} onChange={event => {
        if (event.target.value === '') dispatch({type: 'cancel'});
        else dispatch({type: 'choose', id: event.target.value as SideDishId});
      }}>
        <option value="">Выбрать гарнир</option>
        {Object.entries(referenceSideDishes).filter(([id]) => id !== current.id).map(([id, side]) =>
          <option key={id} value={id}>{side.name}</option>)}
      </select>
    </label>
    {pending && after && <section aria-label="Предпросмотр замены" className="space-y-4 rounded-xl border p-4">
      <h2 className="font-semibold">{referenceSideDishes[pending.id].name}</h2>
      {pending.id === 'quinoa' ? <label className="block">Вес сухой киноа
        <select className="ml-2 min-h-11 rounded border p-2" value={pending.dryGrams} onChange={event =>
          dispatch({type: 'quinoaWeight', dryGrams: event.target.value === '65' ? 65 : 60})}>
          <option value={60}>60 г</option>
          <option value={65}>65 г</option>
        </select>
      </label> : <p>{pending.dryGrams} г в сухом виде</p>}
      <p className="text-sm">Приём пищи после замены: {amount(after.dish.calories, 'calories')}</p>
      <ReferenceSideDishComparison before={before.day} after={after.day} />
      <p role="status">{after.day.passed ? 'Все дневные показатели в пределах цели.' : 'Эта порция выводит день за пределы цели.'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => dispatch({type: 'confirm'})} disabled={!after.day.passed}
          className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-white disabled:opacity-50">Подтвердить замену</button>
        <button type="button" onClick={() => dispatch({type: 'cancel'})} className="min-h-11 rounded-lg border px-4 py-2">Отмена</button>
      </div>
    </section>}
  </main>;
}
