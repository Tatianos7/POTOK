import { useEffect, useMemo, useState } from 'react';
import type { PremiumNutritionWeek, TodayMealDetail } from '../services/premiumTodayAdapter';
import {
  activeAdaptiveNutritionAnnotations,
  AdaptiveNutritionTodayRuntimeController,
  type AdaptiveNutritionTodayState,
  type AdaptiveNutritionTodaySlot,
} from '../services/adaptiveNutritionTodayRuntime';
import { nutritionWeekDates } from '../utils/nutritionWeek';

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const formatDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;

export interface AdaptiveNutritionRuntimeWeekPreviewProps {
  currentUserId: string;
  today: string;
  week: PremiumNutritionWeek;
  replacementOfferIds?: Readonly<Record<string, string>>;
  controller?: AdaptiveNutritionTodayRuntimeController;
}

interface RuntimeWeekViewProps {
  state: AdaptiveNutritionTodayState;
  today: string;
  week: PremiumNutritionWeek;
  selectedDate: string;
  replacementOfferIds?: Readonly<Record<string, string>>;
  onSelectDate: (date: string) => void;
  onSkip: (slotId: string) => void;
  onUndo: (eventId: string) => void;
  onReplace: (slotId: string, offerId: string) => void;
  onResolveUnknown: () => void;
  onAcknowledgeConflict: () => void;
}

function compatibleLocalMeal(
  week: PremiumNutritionWeek,
  slot: AdaptiveNutritionTodaySlot,
): TodayMealDetail | null {
  const localDay = week.days.find((day) => day.date === slot.date);
  const localMeal = localDay?.sourceDay?.meals.find((meal) => meal.catalogSlotId === slot.slotId);
  return localMeal?.catalogPrimaryRecipeId
      && localMeal.catalogPrimaryRecipeId === slot.snapshot.recipeRevision
    ? localMeal
    : null;
}

function RuntimeStatus({ state, onResolveUnknown, onAcknowledgeConflict }: Pick<RuntimeWeekViewProps,
  'state' | 'onResolveUnknown' | 'onAcknowledgeConflict'>) {
  if (state.phase === 'loading' || state.phase === 'idle') {
    return <p role="status" className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Загружаем подтверждённый план…</p>;
  }
  if (state.phase === 'submitting') {
    return <p role="status" className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Сохраняем изменение и сверяем план…</p>;
  }
  if (state.phase === 'unknown') {
    return <div role="status" className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
      <p>Результат операции пока неизвестен. Повторное действие заблокировано, чтобы не создать дубль.</p>
      <button type="button" onClick={onResolveUnknown}
        className="min-h-11 rounded-lg border border-amber-700 px-3 py-2 font-medium">Проверить результат</button>
    </div>;
  }
  if (state.phase === 'conflict') {
    return <div role="status" className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
      <p>План изменился. Проверьте обновлённую версию перед новым действием.</p>
      {state.model && <button type="button" onClick={onAcknowledgeConflict}
        className="min-h-11 rounded-lg border border-amber-700 px-3 py-2 font-medium">Показать обновлённый план</button>}
    </div>;
  }
  if (state.phase === 'denied') {
    return <p role="status" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
      Premium-доступ сейчас не подтверждён. Новые изменения плана недоступны; проверка результата уже начатой операции сохраняется.
    </p>;
  }
  if (state.phase === 'unavailable') {
    return <p role="status" className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
      Подтверждённый серверный план сейчас недоступен. Изменения не отправлялись.
    </p>;
  }
  if (state.notice === 'confirmed') {
    return <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
      Изменение подтверждено сервером, план обновлён.
    </p>;
  }
  return null;
}

export function AdaptiveNutritionRuntimeWeekView({
  state,
  today,
  week,
  selectedDate,
  replacementOfferIds,
  onSelectDate,
  onSkip,
  onUndo,
  onReplace,
  onResolveUnknown,
  onAcknowledgeConflict,
}: RuntimeWeekViewProps) {
  const dates = nutritionWeekDates(today);
  const selected = dates.includes(selectedDate) ? selectedDate : dates[0];
  const slots = state.slots.filter((slot) => slot.date === selected);
  const annotations = state.model ? activeAdaptiveNutritionAnnotations(state.model) : [];
  const actionsEnabled = state.phase === 'ready' && selected <= today;

  return <main className="mx-auto w-full max-w-[560px] space-y-5 px-4 pb-36 pt-6">
    <header className="space-y-2">
      <h1 className="text-2xl font-semibold text-stone-950">Активная неделя</h1>
      <p className="text-sm text-stone-600">{formatDate(dates[0])} — {formatDate(dates[6])}</p>
      <p className="text-sm text-stone-600">План — это рекомендация. Отметка «Не ел(а)» меняет только плановую историю и не создаёт запись о съеденном.</p>
    </header>

    <RuntimeStatus state={state} onResolveUnknown={onResolveUnknown}
      onAcknowledgeConflict={onAcknowledgeConflict} />

    {state.model && <>
      <nav aria-label="Дни активной недели" className="grid grid-cols-7 gap-1">
        {dates.map((date, index) => <button key={date} type="button"
          aria-pressed={date === selected} aria-label={`${weekdays[index]} ${formatDate(date)}`}
          onClick={() => onSelectDate(date)}
          className={`min-h-12 rounded-xl px-1 py-2 text-center text-sm ${date === selected ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-700'}`}>
          <span className="block font-semibold">{weekdays[index]}</span><span className="text-xs">{date.slice(8, 10)}</span>
        </button>)}
      </nav>

      <section aria-label="Запланированные блюда" className="space-y-3">
        <h2 className="text-lg font-semibold">План на {formatDate(selected)}</h2>
        {slots.length ? slots.map((slot) => {
          const meal = compatibleLocalMeal(week, slot);
          const annotation = annotations.find((item) => item.slotId === slot.slotId && item.date === slot.date);
          const offerId = replacementOfferIds?.[slot.slotId];
          return <article key={slot.slotId} className="space-y-3 rounded-2xl border border-stone-200 p-4">
            <div>
              <p className="text-xs text-stone-500">Запланировано</p>
              <h3 className="font-semibold text-stone-950">{meal?.summary ?? 'Блюдо подтверждено сервером'}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {annotation ? <button type="button" disabled={!actionsEnabled}
                onClick={() => onUndo(annotation.eventId)}
                className="min-h-11 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 disabled:opacity-40">
                Отменить отметку
              </button> : <button type="button" disabled={!actionsEnabled}
                onClick={() => onSkip(slot.slotId)}
                className="min-h-11 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 disabled:opacity-40">
                Не ел(а)
              </button>}
              {offerId && <button type="button" disabled={!actionsEnabled}
                onClick={() => onReplace(slot.slotId, offerId)}
                className="min-h-11 rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-800 disabled:opacity-40">
                Заменить блюдо
              </button>}
            </div>
          </article>;
        }) : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">На этот день сервер не вернул запланированных блюд.</p>}
        {selected > today && <p className="text-sm text-stone-500">Будущая еда остаётся планом. Изменить её можно будет в соответствующий день.</p>}
      </section>
    </>}
  </main>;
}

export default function AdaptiveNutritionRuntimeWeekPreview({
  currentUserId,
  today,
  week,
  replacementOfferIds,
  controller: suppliedController,
}: AdaptiveNutritionRuntimeWeekPreviewProps) {
  const controller = useMemo(() => suppliedController ?? new AdaptiveNutritionTodayRuntimeController(), [suppliedController]);
  const [state, setState] = useState<AdaptiveNutritionTodayState>(() => controller.snapshot());
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => controller.subscribe(setState), [controller]);
  useEffect(() => {
    void controller.start(currentUserId, week.scope.planId, today);
    return () => controller.stop();
  }, [controller, currentUserId, today, week.scope.planId]);

  const runtimeToday = state.today ?? today;
  return <AdaptiveNutritionRuntimeWeekView state={state} today={runtimeToday} week={week}
    selectedDate={selectedDate} replacementOfferIds={replacementOfferIds}
    onSelectDate={setSelectedDate}
    onSkip={(slotId) => { void controller.skip(slotId); }}
    onUndo={(eventId) => { void controller.undoAnnotation(eventId); }}
    onReplace={(slotId, offerId) => { void controller.replace(slotId, offerId); }}
    onResolveUnknown={() => { void controller.resolveUnknown(); }}
    onAcknowledgeConflict={() => controller.acknowledgeConflict()} />;
}
