import {useState} from 'react';
import {ReferenceSideDishComparison} from '../dev/ReferenceSideDishPreview';
import {assessReferenceDayTargetFitV1} from '../dev/referenceDailyTargetFitV1';
import {referenceSideDishes, type SideDishId, type SideDishPortion} from '../dev/referenceSideDishScenario';
import type {AuthoringMeal} from '../dev/authoringWeekReport';
import {checkStagingSideDishes, stagingSideDishRecipe, type StagingSideDishEdit} from '../services/stagingWeekSideDishes';
import type {StagingRealWeekView} from '../services/stagingRealWeek';

export default function StagingSideDishEditor({view, date, meal, edits, busy, onSave}: {
  view: StagingRealWeekView; date: string; meal: AuthoringMeal; edits: StagingSideDishEdit[]; busy: boolean;
  onSave: (next: StagingSideDishEdit[]) => Promise<boolean>;
}) {
  const [pending, setPending] = useState<SideDishPortion | null>(null);
  const binding = stagingSideDishRecipe(view, meal);
  const day = view.report.days.find(d => d.date === date);
  if (!binding || !day || !view.savedGoal) return null;
  const current = edits.find(e => e.date === date && e.recipeId === meal.recipeId);
  const originalFit = assessReferenceDayTargetFitV1(date, day.referenceNutrition, view.savedGoal);
  const before = checkStagingSideDishes(view, edits).find(d => d.date === date)?.fit ?? originalFit;
  const next = edits.filter(e => !(e.date === date && e.recipeId === meal.recipeId));
  if (pending && pending.id !== binding.original) next.push({date, recipeId: meal.recipeId, ...pending});
  const check = pending ? checkStagingSideDishes(view, next).find(d => d.date === date) : null;
  const after = check?.fit ?? originalFit;
  const afterMeal = check?.meals.find(item => item.recipeId === meal.recipeId) ?? meal;
  const canConfirm = after.passed && check?.variety !== false;

  async function save() {
    if (pending && canConfirm && await onSave(next)) setPending(null);
  }

  return <section className="mt-3 space-y-3 border-t pt-3" aria-label="Замена гарнира">
    <label className="block text-sm">Новый гарнир
      <select className="mt-1 block min-h-11 w-full rounded-lg border p-2" value={pending?.id ?? ''} disabled={busy}
        onChange={event => {
          const id = event.target.value as SideDishId;
          setPending(id ? {id, dryGrams: referenceSideDishes[id].dryGrams} : null);
        }}>
        <option value="">Выбрать гарнир</option>
        {Object.entries(referenceSideDishes).filter(([id]) => id !== (current?.id ?? binding.original)).map(([id, side]) =>
          <option key={id} value={id}>{side.name}</option>)}
      </select>
    </label>
    {pending && <>
      {pending.id === 'quinoa' ? <label className="block text-sm">Вес сухой киноа
        <select className="ml-2 min-h-11 rounded border p-2" disabled={busy} value={pending.dryGrams}
          onChange={event => setPending({...pending, dryGrams: event.target.value === '65' ? 65 : 60})}>
          <option value={60}>60 г</option><option value={65}>65 г</option>
        </select>
      </label> : <p className="text-sm">{pending.dryGrams} г в сухом виде</p>}
      <p className="text-sm">Приём пищи после замены: {afterMeal.referenceNutrition.calories.toLocaleString('ru-RU')} ккал</p>
      <ReferenceSideDishComparison before={before} after={after} />
      <p className="text-sm" role="status">
        {check?.variety === false ? 'Этот гарнир повторяет другой гарнир дня.'
          : canConfirm ? 'Все дневные показатели в пределах цели.' : 'Эта порция выводит день за пределы цели.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} disabled={busy || !canConfirm}
          className="min-h-11 rounded-lg bg-emerald-800 px-3 text-sm text-white disabled:opacity-50">Подтвердить и сохранить</button>
        <button type="button" disabled={busy} onClick={() => setPending(null)}
          className="min-h-11 rounded-lg border px-3 text-sm">Отмена</button>
      </div>
    </>}
  </section>;
}
