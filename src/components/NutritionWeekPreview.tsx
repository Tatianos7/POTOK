import { useState } from 'react';
import NutritionMealActionPreview from './NutritionMealActionPreview';
import NutritionRecoveryStatus from './NutritionRecoveryStatus';
import { nutritionRecoveryPreviewView, type NutritionRecoveryState } from '../utils/nutritionRecovery';
import type { PremiumNutritionWeek } from '../services/premiumTodayAdapter';
import { DAILY_NUTRITION_STATES, type MealConfirmationChoice } from '../utils/nutritionAdaptation';
import { createWeekPreviewState, reduceWeekPreview, weekPreviewContextKey,
  type WeekPreviewActionPayload, type WeekPreviewContext } from '../utils/nutritionWeekPreview';

export interface NutritionWeekPreviewProps {
  currentUserId?: string;
  today: string;
  weeks: { active: PremiumNutritionWeek; provisional: PremiumNutritionWeek };
  source: 'demo' | 'catalog-preview';
  /** Explicit local/test scenario only; production App does not supply this. */
  recovery?: { state: NutritionRecoveryState; timeZone: string };
}

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const choices: Array<{ id: MealConfirmationChoice; label: string }> = [
  { id: 'ate-as-planned', label: 'Съел(а) по плану' },
  { id: 'ate-with-changes', label: 'Съел(а) с изменениями' },
  { id: 'did-not-eat', label: 'Не ел(а)' },
];
const formatDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;

function WeekContent({ context, source, recoveryView }: { context: WeekPreviewContext; source: NutritionWeekPreviewProps['source'];
  recoveryView?: ReturnType<typeof nutritionRecoveryPreviewView> }) {
  const [state, setState] = useState(() => createWeekPreviewState(context));
  const dispatch = (action: WeekPreviewActionPayload) => {
    setState((current) => reduceWeekPreview(current, { ...action, contextKey: current.contextKey }, context));
  };
  const day = context.week.days.find((item) => item.date === state.selectedDate)!;
  const dayState = state.dayStates[day.date] ?? 'normal';
  const isFuture = day.date > context.today;

  return <main className="mx-auto w-full max-w-[560px] space-y-5 px-4 pb-36 pt-6">
    <header className="space-y-2">
      <p className="text-xs font-medium text-emerald-700">Локальный предпросмотр · {source === 'demo' ? 'демо' : 'каталог'}</p>
      <h1 className="text-2xl font-semibold text-stone-950">Активная неделя</h1>
      <p className="text-sm text-stone-600">{formatDate(context.week.startDate)} — {formatDate(context.week.endDate)}</p>
      <p className="text-sm text-stone-600">План — это рекомендация. Запись о съеденном появится только после вашего подтверждения.</p>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        {source === 'demo' ? 'Демо-блюда показывают устройство недели, а не персональный рацион. ' : 'Рацион пока не проверен под вашу цель. '}
        Здесь можно посмотреть действия; записи в дневник пока недоступны.
      </p>
    </header>
    {recoveryView && <NutritionRecoveryStatus view={recoveryView} />}
    <nav aria-label="Дни активной недели" className="grid grid-cols-7 gap-1">
      {context.week.days.map((item, index) => <button key={item.date} type="button"
        aria-pressed={item.date === day.date} aria-label={`${weekdays[index]} ${formatDate(item.date)}`}
        onClick={() => dispatch({ type: 'select-day', date: item.date })}
        className={`min-h-12 rounded-xl px-1 py-2 text-center text-sm ${item.date === day.date ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-700'}`}>
        <span className="block font-semibold">{weekdays[index]}</span><span className="text-xs">{item.date.slice(8, 10)}</span>
      </button>)}
    </nav>
    <section aria-label="Запланированные блюда" className="space-y-3">
      <h2 className="text-lg font-semibold">План на {formatDate(day.date)}</h2>
      {day.sourceDay?.meals.length ? day.sourceDay.meals.map((meal, index) => <article
        key={meal.catalogSlotId ?? `unlinked-${index}`} className="space-y-3 rounded-2xl border border-stone-200 p-4">
        <div><p className="text-xs text-stone-500">Запланировано · {meal.title}</p>
          <h3 className="font-semibold text-stone-950">{meal.summary}</h3>
          <p className="mt-1 text-sm text-stone-600">{meal.calories} · {meal.macroDetails}</p></div>
        <div className="flex flex-wrap gap-2">{choices.map((choice) => <button key={choice.id} type="button"
          disabled={isFuture || !meal.catalogSlotId}
          onClick={() => dispatch({ type: 'meal-intent', slotId: meal.catalogSlotId ?? null, choice: choice.id })}
          className="min-h-11 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 disabled:opacity-40">{choice.label}</button>)}</div>
      </article>) : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">Блюда на этот день ещё не подготовлены.</p>}
      {isFuture && <p className="text-sm text-stone-500">Будущая еда остаётся планом. Отметить её можно будет в соответствующий день.</p>}
      <button type="button" disabled={isFuture} onClick={() => dispatch({ type: 'meal-intent', slotId: null, choice: 'extra-food' })}
        className="min-h-11 rounded-xl border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-40">+ Было что-то ещё</button>
    </section>
    {state.intent && <NutritionMealActionPreview choice={state.intent.choice} onClose={() => dispatch({ type: 'dismiss-intent' })} />}
    <section className="space-y-3" aria-label="Состояние дня">
      <h2 className="text-lg font-semibold">Как проходит день?</h2>
      <div className="grid grid-cols-2 gap-2">{DAILY_NUTRITION_STATES.map((option) => <button key={option.id} type="button"
        aria-pressed={dayState === option.id} onClick={() => dispatch({ type: 'day-state', value: option.id })}
        className={`min-h-11 rounded-xl border p-3 text-sm ${dayState === option.id ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}>{option.label}</button>)}</div>
      <p className="text-sm text-stone-600">{DAILY_NUTRITION_STATES.find((option) => option.id === dayState)?.hint}</p>
      <p className="text-xs text-stone-500">Выбор остаётся только на этом экране. Изменения питания будут предложены отдельно.</p>
    </section>
    <section className="rounded-2xl border border-dashed border-stone-300 p-4">
      <h2 className="font-semibold">Следующая неделя — предварительная</h2>
      <p className="mt-1 text-sm text-stone-600">Она уточняется после обратной связи и не становится подтверждённым рационом автоматически.</p>
    </section>
  </main>;
}

export default function NutritionWeekPreview(props: NutritionWeekPreviewProps) {
  const context: WeekPreviewContext = { currentUserId: props.currentUserId ?? '', today: props.today, week: props.weeks.active };
  let key: string;
  try { key = weekPreviewContextKey(context); } catch {
    return <p className="p-6 text-sm text-stone-600" role="status">Недельный предпросмотр недоступен для текущего аккаунта или версии плана.</p>;
  }
  const recoveryView = props.recovery ? nutritionRecoveryPreviewView(props.recovery.state, {
    accountId: context.currentUserId, planId: context.week.scope.planId, weekAnchor: context.week.startDate,
    timeZone: props.recovery.timeZone, today: context.today,
  }, { planRevision: context.week.scope.planVersion, goalRevision: context.week.scope.goalVersion,
    slots: context.week.days.flatMap((day) => (day.sourceDay?.meals ?? []).map((meal) => ({ date: day.date,
      slotId: meal.catalogSlotId ?? '', recipeId: meal.catalogPrimaryRecipeId ?? null }))),
  }) : undefined;
  if (recoveryView && !recoveryView.canReview) return <main className="mx-auto max-w-[560px] p-4">
    <NutritionRecoveryStatus view={recoveryView} />
  </main>;
  return <WeekContent key={`${key}:${props.recovery?.state.session ?? 'standalone'}`} context={context} source={props.source} recoveryView={recoveryView} />;
}
