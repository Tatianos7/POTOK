import {useState} from 'react';
import type {StagingWeekDraft} from '../services/stagingWeekDraft';
import {deriveStagingWeekShopping} from '../services/stagingWeekShopping';

const formatAmount = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 3});
const formatDate = new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long', timeZone: 'UTC'});

export default function StagingWeekShopping({draft, selectedDay}: {draft: StagingWeekDraft; selectedDay: number}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const date = draft.view.report.days[selectedDay].date;
  const items = open ? deriveStagingWeekShopping(draft.view, draft.sideDishes, period === 'day' ? date : undefined) : null;
  return <details onToggle={event => setOpen(event.currentTarget.open)} className="rounded-lg border p-3">
    <summary className="cursor-pointer font-semibold">Список покупок</summary>
    {open && <div className="mt-3 space-y-3 text-sm">
      <label className="block">Период
        <select value={period} onChange={event => setPeriod(event.target.value === 'week' ? 'week' : 'day')}
          className="mt-1 block w-full rounded-lg border p-2">
          <option value="day">{formatDate.format(new Date(date))}</option>
          <option value="week">Вся неделя</option>
        </select>
      </label>
      <p>Количество рассчитано по порциям из сборника. Похожие продукты из разных рецептов могут идти отдельными строками.</p>
      {!items ? <p>Не удалось собрать список по составу сохранённой недели.</p>
        : items.length === 0 ? <p>На этот период нет продуктов для покупки.</p>
        : <ul className="divide-y">
          {items.map(item => <li key={item.key} className="py-2">
            <div>{item.name} · {item.amount === null ? 'количество нужно уточнить' : `${formatAmount.format(item.amount)} ${item.unit}`}
              {item.optional && ' · по желанию'}</div>
            {item.recipe && <div className="text-neutral-600">{item.recipe}</div>}
          </li>)}
        </ul>}
    </div>}
  </details>;
}
