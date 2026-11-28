import { useEffect, useMemo, useState } from 'react';
import { GenerationRequestFlowEntryV2 } from './GenerationRequestFlowV2';
import { GenerationRequestFlowV2 } from '../services/generationRequestFlowV2';
import { isGenerationEnabled } from '../services/generationAvailabilityV2';
import { GenerationProvisionEntryV1 } from './GenerationProvisionEntryV1';
import { supabase } from '../lib/supabaseClient';
import { AdaptiveNutritionRuntimeWeekView } from './AdaptiveNutritionRuntimeWeekPreview';
import {
  AdaptiveNutritionReadOnlyEntryController,
  type AdaptiveNutritionReadOnlyEntryState,
} from '../services/adaptiveNutritionReadOnlyEntry';
import type { AdaptiveNutritionTodayState } from '../services/adaptiveNutritionTodayRuntime';
import type { PremiumNutritionWeek } from '../services/premiumTodayAdapter';
import { nutritionWeekDates } from '../utils/nutritionWeek';

export interface AdaptiveNutritionReadOnlyEntryProps {
  currentUserId: string;
  today: string;
  timeZone: string;
  controller?: AdaptiveNutritionReadOnlyEntryController;
}

function weekForState(state: AdaptiveNutritionReadOnlyEntryState): PremiumNutritionWeek | null {
  if (state.phase !== 'ready' || !state.accountId || !state.selectionId || !state.today || !state.model) return null;
  const dates = nutritionWeekDates(state.today);
  return {
    scope: {
      userId: state.accountId,
      planId: state.selectionId,
      planVersion: state.model.planRevision,
      goalVersion: state.model.goalRevision,
    },
    status: 'active',
    startDate: dates[0],
    endDate: dates[6],
    contentStatus: state.slots.length > 0 ? 'complete' : 'incomplete',
    targetValidation: 'not-validated',
    days: dates.map((date) => ({ date, kind: 'planned', sourceDay: null })),
  };
}

export function AdaptiveNutritionReadOnlyEntryView({ state, selectedDate, onSelectDate = () => undefined }: {
  state: AdaptiveNutritionReadOnlyEntryState;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}) {
  if (state.phase === 'pending_generation') {
    return <main className="mx-auto w-full max-w-[560px] px-5 py-10">
      <h1 className="text-xl font-semibold text-stone-950">Мой Поток</h1>
      <p className="mt-3 rounded-xl bg-stone-50 p-4 text-sm text-stone-600" role="status">
        План ожидает подготовки
      </p>
    </main>;
  }
  if (state.phase === 'no_active_plan') {
    return <main className="mx-auto w-full max-w-[560px] px-5 py-10">
      <h1 className="text-xl font-semibold text-stone-950">Активная неделя</h1>
      <p className="mt-3 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
        Персональный недельный план ещё не создан
      </p>
    </main>;
  }
  if (state.phase === 'ambiguous') {
    return <p className="mx-auto max-w-[560px] p-6 text-sm text-stone-600" role="alert">
      Недельный план временно недоступен: найдено несколько активных версий.
    </p>;
  }
  if (state.phase === 'denied') {
    return <p className="mx-auto max-w-[560px] p-6 text-sm text-stone-600" role="status">
      Premium-доступ к недельному плану сейчас не подтверждён.
    </p>;
  }
  if (state.phase === 'unavailable') {
    return <p className="mx-auto max-w-[560px] p-6 text-sm text-stone-600" role="status">
      Подтверждённый недельный план сейчас недоступен.
    </p>;
  }
  const week = weekForState(state);
  if (!week || !state.model || !state.accountId || !state.selectionId || !state.today) {
    return <p className="mx-auto max-w-[560px] p-6 text-sm text-stone-600" role="status">
      Загружаем подтверждённый недельный план…
    </p>;
  }
  const runtimeState: AdaptiveNutritionTodayState = {
    phase: 'ready',
    accountId: state.accountId,
    selectionId: state.selectionId,
    today: state.today,
    model: state.model,
    slots: state.slots,
    pending: null,
    notice: null,
  };
  const noop = () => undefined;
  return <AdaptiveNutritionRuntimeWeekView
    state={runtimeState}
    today={state.today}
    week={week}
    selectedDate={selectedDate ?? state.today}
    readOnly
    onSelectDate={onSelectDate}
    onSkip={noop}
    onUndo={noop}
    onReplace={noop}
    onResolveUnknown={noop}
    onAcknowledgeConflict={noop}
  />;
}

export default function AdaptiveNutritionReadOnlyEntry({
  currentUserId,
  today,
  timeZone,
  controller: suppliedController,
}: AdaptiveNutritionReadOnlyEntryProps) {
  const controller = useMemo(
    () => suppliedController ?? new AdaptiveNutritionReadOnlyEntryController(),
    [suppliedController],
  );
  const generation = useMemo(
    () => new GenerationRequestFlowV2(supabase, isGenerationEnabled, undefined, () => window.sessionStorage),
    [],
  );
  const [state, setState] = useState(() => controller.snapshot());
  const [selectedDate, setSelectedDate] = useState(today);
  useEffect(() => controller.subscribe(setState), [controller]);
  useEffect(() => setSelectedDate(today), [today, currentUserId]);
  useEffect(() => {
    void controller.start(currentUserId, today, timeZone);
    return () => controller.stop();
  }, [controller, currentUserId, timeZone, today]);
  if (isGenerationEnabled() && state.phase === 'no_active_plan'
      && state.accountId === currentUserId && state.today === today && state.timeZone === timeZone) {
    return <GenerationProvisionEntryV1 accountId={currentUserId} today={today}
      timeZone={timeZone} controller={controller} />;
  }
  if (isGenerationEnabled() && state.phase === 'pending_generation'
      && state.accountId === currentUserId && state.today === today && state.timeZone === timeZone) {
    return <GenerationRequestFlowEntryV2 accountId={currentUserId} today={today}
      timeZone={timeZone} controller={generation} />;
  }
  return <AdaptiveNutritionReadOnlyEntryView state={state} selectedDate={selectedDate} onSelectDate={setSelectedDate} />;
}
