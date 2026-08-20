import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ClipboardList,
  Droplets,
  Dumbbell,
  ShieldCheck,
  Sparkles,
  Utensils,
  UserCheck,
  X,
} from 'lucide-react';
import ScreenContainer from '../ui/components/ScreenContainer';
import Card from '../ui/components/Card';
import Button from '../ui/components/Button';
import {
  buildTodayPlanFromDemoDay,
  getDemoTodayPrograms,
  todayNotSuitableReasons,
  updateTodayPlanItemStatus,
} from '../services/demoTodayPlansProvider';
import type { TodayItem, TodayPlan } from '../types/todayPlan';

const DEMO_TODAY_PLAN_STORAGE_KEY = 'potok.today.demoPlan';

const todayModes = [
  {
    id: 'ai',
    title: 'POTOK AI',
    subtitle: 'Адаптивный план под вашу цель',
    icon: Sparkles,
    points: ['Питание и тренировки на день', 'Замены, если пункт не подходит', 'Анализ дня и недели позже'],
    cta: 'Подключить AI',
    enabled: false,
  },
  {
    id: 'plans',
    title: 'Готовые программы',
    subtitle: 'Готовый путь без тренера',
    icon: ClipboardList,
    points: ['План раскрывается по дням', 'Ежедневные карточки в Today', 'Не PDF, а живой план'],
    cta: 'Смотреть программы',
    enabled: true,
  },
  {
    id: 'coach',
    title: 'Персональный тренер',
    subtitle: 'План от проверенного специалиста',
    icon: UserCheck,
    points: ['Тренер назначает план', 'План появляется в Today', 'Контроль и корректировки позже'],
    cta: 'Найти тренера',
    enabled: false,
  },
];

const itemIcons = {
  meal: Utensils,
  workout: Dumbbell,
  water: Droplets,
  steps: Check,
  habit: Check,
  task: Check,
};

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

const Today = () => {
  const navigate = useNavigate();
  const demoPrograms = useMemo(() => getDemoTodayPrograms(), []);
  const [plansPreviewOpen, setPlansPreviewOpen] = useState(false);
  const [selectedProgramId] = useState(demoPrograms[0]?.id ?? '');
  const [selectedDayIndex, setSelectedDayIndex] = useState(1);
  const [activePlan, setActivePlan] = useState<TodayPlan | null>(null);
  const [reasonItemId, setReasonItemId] = useState<string | null>(null);

  const selectedProgram = demoPrograms.find((program) => program.id === selectedProgramId);
  const selectedDay = selectedProgram?.days.find((day) => day.dayIndex === selectedDayIndex);

  useEffect(() => {
    try {
      const savedPlan = window.localStorage.getItem(DEMO_TODAY_PLAN_STORAGE_KEY);
      if (savedPlan) {
        setActivePlan(JSON.parse(savedPlan) as TodayPlan);
      }
    } catch {
      setActivePlan(null);
    }
  }, []);

  useEffect(() => {
    try {
      if (activePlan) {
        window.localStorage.setItem(DEMO_TODAY_PLAN_STORAGE_KEY, JSON.stringify(activePlan));
      }
    } catch {
      // Demo state stays usable in memory if localStorage is unavailable.
    }
  }, [activePlan]);

  const openDemoDay = () => {
    if (!selectedProgram) {
      return;
    }

    setActivePlan(buildTodayPlanFromDemoDay(selectedProgram.id, selectedDayIndex, getTodayDateKey()));
    setReasonItemId(null);
    setPlansPreviewOpen(false);
  };

  const markItemDone = (itemId: string) => {
    if (!activePlan) {
      return;
    }

    setActivePlan(updateTodayPlanItemStatus(activePlan, itemId, 'done'));
    setReasonItemId(null);
  };

  const markItemNotSuitable = (itemId: string, reasonId: Parameters<typeof updateTodayPlanItemStatus>[3]) => {
    if (!activePlan || !reasonId) {
      return;
    }

    setActivePlan(updateTodayPlanItemStatus(activePlan, itemId, 'not_suitable', reasonId));
    setReasonItemId(null);
  };

  const handleItemPrimaryAction = (item: TodayItem) => {
    if (item.type === 'meal') {
      navigate('/nutrition');
      return;
    }

    if (item.type === 'workout') {
      navigate('/workouts');
      return;
    }

    markItemDone(item.id);
  };

  return (
    <ScreenContainer padding="lg" gap="sm">
      <Card
        variant="surface"
        size="md"
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Закрыть">
            <X size={18} />
          </Button>
        }
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">План на день</p>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-tight text-stone-950">Today</h1>
            <p className="text-base font-medium leading-6 text-stone-800">План на день, который ведёт вас к цели</p>
            <p className="text-sm leading-5 text-stone-600">
              Идите самостоятельно в бесплатном POTOK или подключите поддержку: AI, программу или тренера.
            </p>
          </div>
          <div className="flex flex-col gap-2 min-[360px]:flex-row">
            <Button variant="outline" size="sm" onClick={() => navigate('/progress')} align="center">
              Бесплатный Progress
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        {todayModes.map((mode) => {
          const Icon = mode.icon;
          return (
            <Card key={mode.id} variant="default" size="sm">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-800">
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-base font-semibold leading-6 text-stone-950">{mode.title}</h2>
                      <p className="text-sm leading-5 text-stone-600">{mode.subtitle}</p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium leading-none text-stone-600">
                      Скоро
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm leading-5 text-stone-700">
                    {mode.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-[0.45rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={mode.enabled ? 'primary' : 'outline'}
                    size="sm"
                    disabled={!mode.enabled}
                    align="center"
                    onClick={mode.id === 'plans' ? () => setPlansPreviewOpen((isOpen) => !isOpen) : undefined}
                  >
                    {mode.cta}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {plansPreviewOpen && selectedProgram && (
        <Card variant="default" size="sm">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Демо-превью</p>
                <h2 className="text-base font-semibold leading-6 text-stone-950">{selectedProgram.title}</h2>
                <p className="text-sm leading-5 text-stone-600">{selectedProgram.subtitle}</p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium leading-none text-emerald-700">
                Без оплаты
              </span>
            </div>

            <p className="text-sm leading-5 text-stone-700">{selectedProgram.description}</p>

            <div className="grid grid-cols-1 gap-2 text-sm text-stone-700 min-[360px]:grid-cols-3">
              <span className="rounded-lg bg-stone-50 px-3 py-2">Цель: {selectedProgram.goal}</span>
              <span className="rounded-lg bg-stone-50 px-3 py-2">Формат: {selectedProgram.format}</span>
              <span className="rounded-lg bg-stone-50 px-3 py-2">Уровень: {selectedProgram.level}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-4">
              {selectedProgram.days.map((day) => {
                const isSelected = day.dayIndex === selectedDayIndex;
                return (
                  <button
                    key={day.dayIndex}
                    type="button"
                    onClick={() => setSelectedDayIndex(day.dayIndex)}
                    className="rounded-lg border px-3 py-2 text-left text-sm transition"
                    style={{
                      borderColor: isSelected ? '#059669' : '#E7E5E4',
                      backgroundColor: isSelected ? '#ECFDF5' : '#FFFFFF',
                      color: isSelected ? '#065F46' : '#292524',
                    }}
                  >
                    <span className="block font-semibold">{day.title}</span>
                    <span className="block text-xs leading-4 text-stone-500">{day.focus}</span>
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="text-sm font-semibold text-stone-950">Что появится в Today:</p>
                <ul className="mt-2 space-y-1 text-sm leading-5 text-stone-700">
                  {selectedDay.items.map((item) => (
                    <li key={`${item.type}-${item.title}`} className="flex gap-2">
                      <span className="mt-[0.45rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                      <span>
                        {item.title}: {item.subtitle}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="primary" size="sm" onClick={openDemoDay} align="center">
              Открыть день в Today
            </Button>
          </div>
        </Card>
      )}

      {activePlan && (
        <Card variant="default" size="sm">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">ДЕМО-ПЛАН</p>
              <h2 className="text-base font-semibold leading-6 text-stone-950">{activePlan.title}</h2>
              <p className="text-sm leading-5 text-stone-600">
                Это пример готовой программы. В демо действия не записываются в дневник.
              </p>
            </div>

            <div className="space-y-2">
              {activePlan.items.map((item) => {
                const Icon = itemIcons[item.type];
                const isDone = item.status === 'done';
                const isNotSuitable = item.status === 'not_suitable';

                return (
                  <div key={item.id} className="rounded-xl border border-stone-200 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: isDone ? '#ECFDF5' : '#F5F5F4', color: isDone ? '#047857' : '#44403C' }}
                      >
                        <Icon size={17} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="min-w-0 text-sm font-semibold leading-5 text-stone-950">{item.title}</h3>
                            {isDone && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                Выполнено
                              </span>
                            )}
                            {isNotSuitable && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                Не подходит
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-5 text-stone-700">{item.subtitle}</p>
                          {item.note && <p className="mt-1 text-xs leading-4 text-stone-500">{item.note}</p>}
                        </div>

                        <div className="flex flex-col gap-2 min-[360px]:flex-row">
                          <Button variant="outline" size="sm" onClick={() => handleItemPrimaryAction(item)} align="center">
                            {item.actionLabel}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setReasonItemId(item.id)} align="center">
                            Не подходит
                          </Button>
                        </div>

                        {reasonItemId === item.id && (
                          <div className="flex flex-wrap gap-2 rounded-lg bg-stone-50 p-2">
                            {todayNotSuitableReasons.map((reason) => (
                              <button
                                key={reason.id}
                                type="button"
                                onClick={() => markItemNotSuitable(item.id, reason.id)}
                                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700"
                              >
                                {reason.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <Card variant="soft" size="sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 flex-shrink-0 text-emerald-700" size={18} aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold leading-5 text-stone-950">План ≠ запись в дневнике</h2>
            <p className="text-sm leading-5 text-stone-700">
              План не записывается в дневник автоматически. В дневник попадает только то, что вы подтвердили или
              выполнили.
            </p>
          </div>
        </div>
      </Card>
    </ScreenContainer>
  );
};

export default Today;
