import {useEffect,useMemo,useState} from 'react';
import {GenerationPlanEntryControllerV2,type GenerationPlanEntryStateV2} from '../services/generationPlanEntryV2';
const meals = {breakfast:'Завтрак',lunch:'Обед',dinner:'Ужин',snack:'Перекус'};
const number = (value: string) => Number(value).toLocaleString('ru-RU',{maximumFractionDigits:1});
export function GenerationPlanMenuViewV2({state}: {state: GenerationPlanEntryStateV2}) {
  if (state.phase !== 'ready' || !state.model) {
    const text = state.phase === 'pending' ? 'Меню ещё готовится. Готовый план пока не подтверждён.'
      : state.phase === 'denied' ? 'Premium-доступ к меню сейчас не подтверждён.'
      : state.phase === 'unavailable' ? 'Не удалось загрузить подтверждённое меню.'
      : 'Загружаем подтверждённое меню…';
    return <p role="status" className="mx-auto max-w-xl p-6 text-stone-600 dark:text-stone-300">{text}</p>;
  }
  return <section aria-label="Недельное меню" className="mx-auto max-w-xl space-y-4 p-5 text-stone-950 dark:text-stone-100">
    <h1 className="text-2xl font-semibold">Моё меню на неделю</h1>
    <p className="text-sm text-stone-600 dark:text-stone-300">Это план питания. Приёмы пищи пока не записаны в дневник. КБЖУ рассчитаны по составу.</p>
    {state.model.graph.days.map(day => <details key={day.date} className="rounded-2xl border border-stone-200 p-4 dark:border-stone-700">
      <summary className="cursor-pointer font-semibold">{new Date(`${day.date}T12:00:00Z`).toLocaleDateString('ru-RU',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'})}</summary>
      <ul className="mt-4 space-y-4">{day.slots.map(slot => <li key={slot.slotId}>
        <h2 className="font-medium">{meals[slot.mealType]}</h2>
        <ul className="mt-1 space-y-2">{slot.mealSnapshot.components.map(component => <li key={component.mealComponentId}>
          <p>{component.recipe.displayNameSnapshot}</p>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {number(component.assignedPortion.assignedServings)} порц.
            {component.assignedPortion.assignedGrams === null ? ' · вес порции не указан' : ` · ${number(component.assignedPortion.assignedGrams)} г`}
          </p>
        </li>)}</ul>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{number(slot.mealSnapshot.nutrition.calories)} ккал · Б {number(slot.mealSnapshot.nutrition.protein)} · Ж {number(slot.mealSnapshot.nutrition.fat)} · У {number(slot.mealSnapshot.nutrition.carbs)} г</p>
      </li>)}</ul>
    </details>)}
  </section>;
}
/** Prepared entry only; no route, feature flag or generator is enabled by importing this component. */
export function GenerationPlanMenuV2({accountId,requestOperationId,today,timeZone,controller}: {
  accountId:string; requestOperationId:string; today:string; timeZone:string; controller?:GenerationPlanEntryControllerV2;
}) {
  const active = useMemo(() => controller ?? new GenerationPlanEntryControllerV2(),[controller]);
  const scope = JSON.stringify([accountId,requestOperationId,today,timeZone]);
  const [bound,setBound] = useState<{scope:string;state:GenerationPlanEntryStateV2} | null>(null);
  useEffect(() => {
    active.stop();
    const unsubscribe = active.subscribe(state => setBound({scope,state}));
    void active.open(accountId,requestOperationId,today,timeZone);
    return () => {unsubscribe();active.stop();};
  },[active,accountId,requestOperationId,today,timeZone,scope]);
  // Render cannot expose a previous account/day while the new effect is still pending.
  const state: GenerationPlanEntryStateV2 = bound?.scope === scope ? bound.state : {phase:'loading',model:null,slots:[]};
  return <GenerationPlanMenuViewV2 state={state}/>;
}
