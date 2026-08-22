import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  Dumbbell,
  ShoppingBasket,
  Utensils,
  X,
} from 'lucide-react';
import ScreenContainer from '../ui/components/ScreenContainer';
import Card from '../ui/components/Card';
import Button from '../ui/components/Button';

type PlanKind = 'combined' | 'nutrition' | 'workout' | 'time_saver';
type TodayView = 'home' | 'plan_preview' | 'day_preview';

interface GoalSummary {
  goalType: string;
  startWeight?: number;
  currentWeight?: number;
  targetWeight?: number;
}

interface DemoPlanDay {
  day: number;
  macros: string;
  meals: {
    breakfast: string;
    lunch: string;
    dinner: string;
    snack: string;
  };
  workout?: string;
}

interface DemoPlan {
  id: string;
  kind: PlanKind;
  title: string;
  subtitle: string;
  description: string;
  days: DemoPlanDay[];
}

const demoPlans: DemoPlan[] = [
  {
    id: 'nutrition-training-home-start',
    kind: 'combined',
    title: 'Питание + тренировки',
    subtitle: 'Дом · простой старт · 14 дней',
    description: 'Базовый план на 14 дней: простое питание, домашние тренировки и спокойная нагрузка без резких скачков.',
    days: buildDemoDays('Домашняя тренировка · 25 минут'),
  },
  {
    id: 'simple-food-no-hard-cooking',
    kind: 'nutrition',
    title: 'Питание без сложной готовки',
    subtitle: 'Быстрые блюда · список покупок · 14 дней',
    description: 'План для дней, когда хочется меньше готовить: понятные продукты, простые блюда и заготовки на несколько приёмов.',
    days: buildDemoDays(),
  },
  {
    id: 'home-workouts-beginner',
    kind: 'workout',
    title: 'Тренировки дома',
    subtitle: 'Без оборудования · 3 раза в неделю',
    description: 'Лёгкий тренировочный план без оборудования. Питание остаётся ориентиром, тренировки идут по выбранным дням.',
    days: buildDemoDays('Тренировка дома · ноги и корпус'),
  },
  {
    id: 'no-time-short-days',
    kind: 'time_saver',
    title: 'Быстрое питание и короткие тренировки',
    subtitle: 'Для дней с плотным графиком · 14 дней',
    description:
      'План для режима с плотным графиком: быстрые блюда, перекусы с собой и короткая активность вместо длинных тренировок.',
    days: buildDemoDays('Короткая активность · 12 минут'),
  },
];

function buildDemoDays(workout?: string): DemoPlanDay[] {
  return Array.from({ length: 14 }, (_, index) => {
    const day = index + 1;
    return {
      day,
      macros: '1650 ккал · Б 120 · Ж 55 · У 160',
      meals: {
        breakfast: day % 2 === 0 ? 'Омлет, овощи, тост' : 'Овсянка, банан, йогурт',
        lunch: day % 3 === 0 ? 'Индейка, гречка, салат' : 'Курица, рис, овощи',
        dinner: day % 2 === 0 ? 'Рыба, картофель, зелень' : 'Творог, ягоды, орехи',
        snack: day % 4 === 0 ? 'Йогурт и яблоко' : 'Банан и творог',
      },
      workout: workout && (day === 1 || day === 3 || day === 5 || day === 8 || day === 10 || day === 12) ? workout : undefined,
    };
  });
}

function getGoalLabel(goalType: string) {
  const normalized = goalType.toLowerCase();
  if (normalized.includes('похуд') || normalized === 'weight-loss') {
    return 'Похудение';
  }
  if (normalized.includes('набор') || normalized === 'gain') {
    return 'Набор массы';
  }
  return 'Поддержание';
}

function toWeight(value: unknown): number | undefined {
  const weight = Number(value);
  return Number.isFinite(weight) && weight > 0 ? weight : undefined;
}

function parseGoalSummary(raw: string | null): GoalSummary | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const goalType = String(parsed.goalType ?? parsed.goal_type ?? '');
    const currentWeight = toWeight(parsed.currentWeight ?? parsed.current_weight);
    const targetWeight = toWeight(parsed.targetWeight ?? parsed.target_weight);
    const startWeight = toWeight(parsed.startWeight ?? parsed.start_weight ?? parsed.initialWeight) ?? currentWeight;
    const hasGoalPayload = Boolean(goalType || currentWeight || targetWeight || parsed.calories || parsed.proteins || parsed.protein);

    if (!hasGoalPayload) {
      return null;
    }

    return {
      goalType: goalType || 'maintain',
      startWeight,
      currentWeight,
      targetWeight,
    };
  } catch {
    return null;
  }
}

function getStoredGoalSummary(): GoalSummary | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const goalKeys = Object.keys(window.localStorage).filter((key) => key.startsWith('goal_'));
    for (const key of goalKeys) {
      const summary = parseGoalSummary(window.localStorage.getItem(key));
      if (summary) {
        return summary;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getDemoGoalSummary(search: string): GoalSummary | null {
  if (search.includes('demoGoalAtTarget=1')) {
    return {
      goalType: 'weight-loss',
      startWeight: 70,
      currentWeight: 50,
      targetWeight: 50,
    };
  }

  if (search.includes('demoGoalNoCurrent=1')) {
    return {
      goalType: 'weight-loss',
      targetWeight: 50,
    };
  }

  if (search.includes('demoGoalMid=1')) {
    return {
      goalType: 'weight-loss',
      startWeight: 70,
      currentWeight: 63,
      targetWeight: 50,
    };
  }

  if (search.includes('demoGoal=1')) {
    return {
      goalType: 'weight-loss',
      startWeight: 70,
      currentWeight: 70,
      targetWeight: 50,
    };
  }

  return null;
}

function getGoalMarkerPosition(startWeight?: number, currentWeight?: number, targetWeight?: number) {
  if (!startWeight || !currentWeight || !targetWeight || startWeight === targetWeight) {
    return 50;
  }

  const rawProgress = (currentWeight - startWeight) / (targetWeight - startWeight);
  const clampedProgress = Math.min(1, Math.max(0, rawProgress));
  return Math.round(8 + clampedProgress * 84);
}

const Today = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [todayView, setTodayView] = useState<TodayView>('home');
  const [goalSummary, setGoalSummary] = useState<GoalSummary | null>(() => getDemoGoalSummary(location.search));
  const [selectedPlanId, setSelectedPlanId] = useState(demoPlans[0].id);
  const [selectedDay, setSelectedDay] = useState(1);

  const selectedPlan = useMemo(
    () => demoPlans.find((plan) => plan.id === selectedPlanId) ?? demoPlans[0],
    [selectedPlanId]
  );
  const selectedPlanDay = selectedPlan.days.find((day) => day.day === selectedDay) ?? selectedPlan.days[0];
  const hasGoal = Boolean(goalSummary);

  useEffect(() => {
    if (!goalSummary) {
      setGoalSummary(getStoredGoalSummary());
    }
  }, [goalSummary]);

  const openPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setSelectedDay(1);
    setTodayView('plan_preview');
  };

  const openDay = (day: number) => {
    setSelectedDay(day);
    setTodayView('day_preview');
  };

  const renderNoGoalScreen = () => (
    <div className="min-h-[100dvh] w-full min-w-[320px] bg-white">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-5 pb-32 pt-5">
        <header className="relative flex min-h-10 items-center justify-center">
          <h1 className="whitespace-nowrap text-center text-xl font-semibold leading-6 text-stone-950">Мой Поток</h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <main className="flex flex-1 items-center justify-center pb-8">
          <p className="max-w-[220px] text-center text-sm font-medium leading-5 text-stone-400">
            Рассчитайте свою цель
            <br />и здесь появится ваш план
          </p>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-100 bg-white/95 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2">
          <Button variant="primary" size="lg" onClick={() => navigate('/goal')} fullWidth align="center">
            Рассчитать цель
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate('/measurements')} fullWidth align="center">
            Создать замеры
          </Button>
        </div>
      </div>
    </div>
  );

  const renderHeader = () => (
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
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">TODAY Premium</p>
        <h1 className="text-2xl font-semibold leading-tight text-stone-950">Мой Поток</h1>
        <p className="text-sm leading-5 text-stone-600">Ваше питание, тренировки и рекомендации на сегодня</p>
      </div>
    </Card>
  );

  const renderExistingGoalScreen = () => {
    if (!goalSummary) {
      return null;
    }

    const goalLabel = getGoalLabel(goalSummary.goalType);
    const startWeight = goalSummary.startWeight ?? goalSummary.currentWeight;
    const currentWeight = goalSummary.currentWeight;
    const targetWeight = goalSummary.targetWeight;
    const markerPosition = getGoalMarkerPosition(startWeight, currentWeight, targetWeight);
    const markerStyle = { left: `${markerPosition}%` };
    const shouldShowCurrentWeightLabel =
      Boolean(currentWeight) && currentWeight !== startWeight && currentWeight !== targetWeight;

    return (
      <div className="min-h-[100dvh] w-full min-w-[320px] bg-white">
        <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-5 pb-56 pt-5">
          <header className="relative flex min-h-10 items-center justify-center">
            <h1 className="whitespace-nowrap text-center text-xl font-semibold leading-6 text-stone-950">Мой Поток</h1>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
              aria-label="Закрыть"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <main className="flex flex-1 flex-col justify-center gap-4 py-6">
            <div className="space-y-3 text-center">
              <div className="space-y-1">
                <p className="text-lg font-semibold leading-6 text-stone-900">{goalLabel}</p>
              </div>

              <div className="mx-auto max-w-[340px] space-y-1 pt-2">
                <div className="relative h-5">
                  {shouldShowCurrentWeightLabel && (
                    <span
                      className="absolute top-0 -translate-x-1/2 text-xs font-medium text-stone-600"
                      style={markerStyle}
                    >
                      {currentWeight} кг
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <span className="whitespace-nowrap">{startWeight ? `${startWeight} кг` : 'Старт'}</span>
                  <div className="relative h-4 flex-1">
                    <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-stone-200" />
                    <span
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-700"
                      style={markerStyle}
                    >
                      ●
                    </span>
                  </div>
                  <span className="whitespace-nowrap">{targetWeight ? `${targetWeight} кг` : 'Цель'}</span>
                </div>
                <p className="sr-only">
                  {startWeight ? `${startWeight} кг ` : ''}━━━━━●━━━━ {targetWeight ? `${targetWeight} кг` : 'цель'}
                </p>
              </div>

              <p className="mx-auto max-w-[300px] text-sm leading-5 text-stone-500">
                Дополните данные, чтобы POTOK точнее подобрал план.
              </p>
            </div>

            <div className="space-y-1.5">
              {demoPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => openPlan(plan.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-left transition hover:border-emerald-500 hover:bg-emerald-50/40"
                >
                  <span className="text-sm font-semibold leading-5 text-stone-950">{plan.title}</span>
                  <span className="text-xs font-medium text-stone-400">14 дней</span>
                </button>
              ))}
            </div>
          </main>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-100 bg-white/95 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2">
            <Button variant="primary" size="md" fullWidth align="center">
              Дополнить данные
            </Button>
            <Button variant="outline" size="md" onClick={() => navigate('/goal')} fullWidth align="center">
              Изменить цель
            </Button>
            <Button variant="outline" size="md" onClick={() => navigate('/measurements')} fullWidth align="center">
              Создать замеры
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderPlanPreview = () => (
    <Card variant="default" size="md">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Демо-план</p>
            <h2 className="text-xl font-semibold leading-tight text-stone-950">{selectedPlan.title}</h2>
            <p className="text-sm leading-5 text-stone-600">{selectedPlan.subtitle}</p>
          </div>
          <span className="flex-shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
            14 дней
          </span>
        </div>

        <p className="text-sm leading-5 text-stone-700">{selectedPlan.description}</p>

        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <Button variant="primary" size="sm" onClick={() => openDay(1)} align="center">
            Выбрать план
          </Button>
          <Button variant="outline" size="sm" onClick={() => openDay(selectedDay)} align="center">
            Посмотреть дни
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-4">
          {selectedPlan.days.map((day) => (
            <button
              key={day.day}
              type="button"
              onClick={() => openDay(day.day)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-left transition hover:border-emerald-500 hover:bg-emerald-50"
            >
              <span className="block text-sm font-semibold leading-5 text-stone-950">День {day.day}</span>
              <span className="block text-xs leading-4 text-stone-500">{day.workout ? 'С тренировкой' : 'Питание'}</span>
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={() => setTodayView('home')} align="start">
          <ChevronLeft size={16} className="mr-1" aria-hidden="true" />
          Назад к планам
        </Button>
      </div>
    </Card>
  );

  const renderDayPreview = () => (
    <Card variant="default" size="md">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">{selectedPlan.title}</p>
            <h2 className="text-xl font-semibold leading-tight text-stone-950">День {selectedPlanDay.day}</h2>
            <p className="text-sm font-medium leading-5 text-stone-700">{selectedPlanDay.macros}</p>
          </div>
          <CalendarDays className="flex-shrink-0 text-emerald-700" size={22} aria-hidden="true" />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <MealRow title="Завтрак" value={selectedPlanDay.meals.breakfast} />
          <MealRow title="Обед" value={selectedPlanDay.meals.lunch} />
          <MealRow title="Ужин" value={selectedPlanDay.meals.dinner} />
          <MealRow title="Перекус" value={selectedPlanDay.meals.snack} />
          {selectedPlanDay.workout && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <div className="flex items-start gap-2">
                <Dumbbell className="mt-0.5 flex-shrink-0 text-stone-700" size={16} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold leading-5 text-stone-950">Тренировка</p>
                  <p className="text-sm leading-5 text-stone-600">{selectedPlanDay.workout}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" disabled align="center">
          <ShoppingBasket size={16} className="mr-2" aria-hidden="true" />
          Список покупок
        </Button>

        <div className="flex flex-col gap-2 min-[360px]:flex-row">
          <Button variant="ghost" size="sm" onClick={() => setTodayView('plan_preview')} align="center">
            <ChevronLeft size={16} className="mr-1" aria-hidden="true" />
            К дням плана
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setTodayView('home')} align="center">
            Все планы
          </Button>
        </div>
      </div>
    </Card>
  );

  if (todayView === 'home' && !hasGoal) {
    return renderNoGoalScreen();
  }

  if (todayView === 'home' && hasGoal) {
    return renderExistingGoalScreen();
  }

  return (
    <ScreenContainer padding="lg" gap="sm">
      {renderHeader()}

      {todayView === 'plan_preview' && renderPlanPreview()}
      {todayView === 'day_preview' && renderDayPreview()}
    </ScreenContainer>
  );
};

interface MealRowProps {
  title: string;
  value: string;
}

const MealRow = ({ title, value }: MealRowProps) => (
  <div className="rounded-lg border border-stone-200 bg-white p-3">
    <div className="flex items-start gap-2">
      <Utensils className="mt-0.5 flex-shrink-0 text-stone-700" size={16} aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold leading-5 text-stone-950">{title}</p>
        <p className="text-sm leading-5 text-stone-600">{value}</p>
      </div>
    </div>
  </div>
);

export default Today;
