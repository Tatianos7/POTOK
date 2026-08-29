import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import Button from '../ui/components/Button';
import { isPremiumCatalogStagingReadMode, premiumCatalogService } from '../services/premiumCatalogService';
import {
  buildTodayPlanFromPremiumCatalog,
  mapDerivedShoppingListToShoppingGroups,
  mapMealRecipeOptionsToReplacementOptions,
  mapPremiumMealSlotsToTodayMeals,
} from '../services/premiumTodayAdapter';

type PlanKind = 'combined' | 'nutrition' | 'workout' | 'time_saver';
type TodayView = 'home' | 'plan_detail' | 'day_detail' | 'meal_detail' | 'replace_meal' | 'shopping_list';
type DayState = 'usual' | 'low_energy' | 'no_time' | 'ready';
type ShoppingPeriod = 1 | 2 | 3 | 7;

interface GoalSummary {
  goalType: string;
  startWeight?: number;
  currentWeight?: number;
  targetWeight?: number;
}

interface DemoPlanDay {
  day: number;
  macros: string;
  calories: string;
  macroDetails: string;
  meals: Array<{
    title: string;
    summary: string;
    calories: string;
    macroDetails: string;
    ingredients: string[];
    portionHints: string[];
    steps: string[];
    catalogSlotId?: string;
    catalogPrimaryRecipeId?: string;
  }>;
  catalogDayId?: string;
  workout: {
    title: string;
    duration: string;
    focus: string;
  } | null;
}

type MealDetail = DemoPlanDay['meals'][number];

interface DemoPlan {
  id: string;
  kind: PlanKind;
  title: string;
  subtitle: string;
  description: string;
  days: DemoPlanDay[];
}

interface ReplacementOption extends MealDetail {
  id: string;
  note: string;
  optionType?: string;
  recipeId?: string;
}

interface ShoppingProduct {
  name: string;
  amount: number;
  unit: string;
  isDerivedCatalogAmount?: boolean;
}

interface ShoppingGroup {
  title: string;
  products: ShoppingProduct[];
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

const replaceMealFilters = ['Проще', 'Меньше калорий', 'Больше белка', 'Без готовки', 'Похожее КБЖУ'];
const shoppingPeriods: ShoppingPeriod[] = [1, 2, 3, 7];

const shoppingGroups: ShoppingGroup[] = [
  {
    title: 'Белок',
    products: [
      { name: 'Курица', amount: 200, unit: 'г' },
      { name: 'Рыба', amount: 150, unit: 'г' },
      { name: 'Творог', amount: 150, unit: 'г' },
    ],
  },
  {
    title: 'Овощи',
    products: [
      { name: 'Овощи', amount: 200, unit: 'г' },
      { name: 'Салат', amount: 100, unit: 'г' },
    ],
  },
  {
    title: 'Крупы',
    products: [
      { name: 'Рис', amount: 80, unit: 'г' },
      { name: 'Овсянка', amount: 50, unit: 'г' },
    ],
  },
  {
    title: 'Фрукты',
    products: [{ name: 'Банан', amount: 1, unit: 'шт' }],
  },
  {
    title: 'Молочные',
    products: [{ name: 'Йогурт', amount: 150, unit: 'г' }],
  },
  {
    title: 'Другое',
    products: [{ name: 'Ягоды', amount: 100, unit: 'г' }],
  },
];

const breakfastReplacementOptions: ReplacementOption[] = [
  {
    id: 'omelet-vegetables',
    title: 'Завтрак',
    summary: 'Омлет с овощами',
    calories: '420 ккал',
    macroDetails: 'Б 28 · Ж 18 · У 32',
    note: 'Тёплый вариант с большим количеством белка.',
    ingredients: ['Яйца — 2 шт', 'Овощи — 150 г', 'Сыр — 20 г'],
    portionHints: ['Яйца 2 шт ≈ обычная порция', 'Овощи 150 г ≈ две горсти', 'Сыр 20 г ≈ тонкий ломтик'],
    steps: ['Взбейте яйца.', 'Добавьте овощи.', 'Готовьте на сковороде несколько минут.'],
  },
  {
    id: 'cottage-cheese-berries',
    title: 'Завтрак',
    summary: 'Творог с ягодами',
    calories: '390 ккал',
    macroDetails: 'Б 32 · Ж 9 · У 42',
    note: 'Без готовки, удобно для быстрого утра.',
    ingredients: ['Творог — 180 г', 'Ягоды — 120 г', 'Мёд — 10 г'],
    portionHints: ['Творог 180 г ≈ небольшая пачка', 'Ягоды 120 г ≈ горсть', 'Мёд 10 г ≈ чайная ложка'],
    steps: ['Выложите творог.', 'Добавьте ягоды.', 'Добавьте мёд по желанию.'],
  },
  {
    id: 'turkey-sandwich',
    title: 'Завтрак',
    summary: 'Сэндвич с индейкой',
    calories: '430 ккал',
    macroDetails: 'Б 30 · Ж 12 · У 48',
    note: 'Можно взять с собой.',
    ingredients: ['Хлеб цельнозерновой — 70 г', 'Индейка — 90 г', 'Овощи — 80 г'],
    portionHints: ['Хлеб 70 г ≈ 2 ломтика', 'Индейка 90 г ≈ ладонь', 'Овощи 80 г ≈ горсть'],
    steps: ['Подсушите хлеб.', 'Добавьте индейку и овощи.', 'Соберите сэндвич.'],
  },
];

function buildDemoDays(workout?: string): DemoPlanDay[] {
  return Array.from({ length: 14 }, (_, index) => {
    const day = index + 1;
    const hasWorkout = Boolean(
      workout && (day === 1 || day === 3 || day === 5 || day === 8 || day === 10 || day === 12)
    );
    return {
      day,
      macros: '1650 ккал · Б 120 · Ж 55 · У 160',
      calories: '1650 ккал',
      macroDetails: 'Б 120 · Ж 55 · У 160',
      meals: [
        {
          title: 'Завтрак',
          summary: 'Овсянка, банан, йогурт',
          calories: '410 ккал',
          macroDetails: 'Б 24 · Ж 10 · У 58',
          ingredients: ['Овсянка — 50 г', 'Банан — 100 г', 'Йогурт — 150 г'],
          portionHints: [
            'Банан 100 г ≈ 1 средний банан',
            'Овсянка 50 г ≈ несколько столовых ложек',
            'Йогурт 150 г ≈ небольшой стакан',
          ],
          steps: [
            'Смешайте овсянку и йогурт.',
            'Добавьте банан.',
            'Оставьте на несколько минут или ешьте сразу.',
          ],
        },
        {
          title: 'Обед',
          summary: 'Курица, рис, овощи',
          calories: '520 ккал',
          macroDetails: 'Б 42 · Ж 12 · У 58',
          ingredients: ['Курица — 140 г', 'Рис — 120 г', 'Овощи — 180 г'],
          portionHints: ['Курица 140 г ≈ ладонь', 'Рис 120 г ≈ небольшая миска', 'Овощи 180 г ≈ две горсти'],
          steps: ['Разогрейте готовый рис.', 'Добавьте курицу и овощи.', 'Перемешайте и подавайте тёплым.'],
        },
        {
          title: 'Ужин',
          summary: 'Рыба, салат',
          calories: '430 ккал',
          macroDetails: 'Б 34 · Ж 18 · У 28',
          ingredients: ['Рыба — 150 г', 'Салат — 200 г', 'Оливковое масло — 10 г'],
          portionHints: ['Рыба 150 г ≈ ладонь', 'Салат 200 г ≈ большая тарелка', 'Масло 10 г ≈ 1 столовая ложка'],
          steps: ['Приготовьте рыбу удобным способом.', 'Смешайте овощи для салата.', 'Добавьте масло и подавайте.'],
        },
        {
          title: 'Перекус',
          summary: 'Творог, ягоды',
          calories: '290 ккал',
          macroDetails: 'Б 20 · Ж 8 · У 30',
          ingredients: ['Творог — 160 г', 'Ягоды — 100 г', 'Орехи — 10 г'],
          portionHints: ['Творог 160 г ≈ небольшая пачка', 'Ягоды 100 г ≈ горсть', 'Орехи 10 г ≈ маленькая щепотка'],
          steps: ['Выложите творог в миску.', 'Добавьте ягоды.', 'Посыпьте орехами.'],
        },
      ],
      workout: hasWorkout
        ? {
            title: 'Тренировка дома',
            duration: workout?.includes('12') ? '12 минут' : '25 минут',
            focus: workout?.includes('корот') ? 'Короткая активность' : 'Ноги и ягодицы',
          }
        : null,
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

function getInitialPlanId(search: string) {
  const params = new URLSearchParams(search);
  const planId = params.get('planDetail') ?? params.get('dayDetail');
  return demoPlans.some((plan) => plan.id === planId) ? planId! : demoPlans[0].id;
}

function getInitialDay(search: string) {
  const day = Number(new URLSearchParams(search).get('day'));
  return Number.isInteger(day) && day >= 1 && day <= 14 ? day : 1;
}

function getInitialMealTitle(search: string) {
  const params = new URLSearchParams(search);
  return params.get('mealDetail') ?? params.get('replaceMeal') ?? 'Завтрак';
}

function getInitialReplacementId(search: string) {
  const params = new URLSearchParams(search);
  const replacementId = params.get('selectedReplacement') ?? null;
  return breakfastReplacementOptions.some((option) => option.id === replacementId) ? replacementId : null;
}

function getInitialShoppingPeriod(search: string): ShoppingPeriod {
  const period = Number(new URLSearchParams(search).get('shoppingPeriod'));
  return shoppingPeriods.includes(period as ShoppingPeriod) ? (period as ShoppingPeriod) : 1;
}

function getInitialMealOverrides(search: string): Record<string, MealDetail> {
  const params = new URLSearchParams(search);
  const replacementId = params.get('replacementApplied');
  const replacement = breakfastReplacementOptions.find((option) => option.id === replacementId);

  if (!replacement) {
    return {};
  }

  return {
    [getInitialMealTitle(search)]: replacement,
  };
}

function getInitialTodayView(search: string): TodayView {
  const params = new URLSearchParams(search);
  if (params.has('shoppingList')) {
    return 'shopping_list';
  }
  if (params.has('replaceMeal')) {
    return 'replace_meal';
  }
  if (params.has('mealDetail')) {
    return 'meal_detail';
  }
  if (params.has('dayDetail')) {
    return 'day_detail';
  }
  return params.has('planDetail') ? 'plan_detail' : 'home';
}

function formatShoppingAmount(product: ShoppingProduct, period: ShoppingPeriod) {
  const total = product.amount * (product.isDerivedCatalogAmount ? 1 : period);
  return `${total} ${product.unit}`;
}

function formatShoppingPeriodLabel(period: ShoppingPeriod) {
  return period === 1 ? '1 день' : `${period} ${period === 7 ? 'дней' : 'дня'}`;
}

const Today = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [todayView, setTodayView] = useState<TodayView>(() => getInitialTodayView(location.search));
  const [goalSummary, setGoalSummary] = useState<GoalSummary | null>(() => getDemoGoalSummary(location.search));
  const [catalogPlans, setCatalogPlans] = useState<DemoPlan[] | null>(null);
  const [catalogDayMeals, setCatalogDayMeals] = useState<Record<string, MealDetail[]>>({});
  const [catalogReplacementOptions, setCatalogReplacementOptions] = useState<Record<string, ReplacementOption[]>>({});
  const [catalogShoppingGroups, setCatalogShoppingGroups] = useState<Record<string, ShoppingGroup[]>>({});
  const [selectedPlanId, setSelectedPlanId] = useState(() => getInitialPlanId(location.search));
  const [selectedDay, setSelectedDay] = useState(() => getInitialDay(location.search));
  const [selectedMealTitle, setSelectedMealTitle] = useState(() => getInitialMealTitle(location.search));
  const [selectedReplacementId, setSelectedReplacementId] = useState<string | null>(() =>
    getInitialReplacementId(location.search)
  );
  const [mealOverrides, setMealOverrides] = useState<Record<string, MealDetail>>(() =>
    getInitialMealOverrides(location.search)
  );
  const [dayState, setDayState] = useState<DayState>('usual');
  const [shoppingPeriod, setShoppingPeriod] = useState<ShoppingPeriod>(() => getInitialShoppingPeriod(location.search));
  const [boughtProducts, setBoughtProducts] = useState<Set<string>>(() => new Set());
  const hasGoal = Boolean(goalSummary);
  const usesCatalogPlanSource =
    todayView === 'home' ||
    todayView === 'plan_detail' ||
    todayView === 'day_detail' ||
    todayView === 'meal_detail' ||
    todayView === 'replace_meal' ||
    todayView === 'shopping_list';
  const activePlans = usesCatalogPlanSource ? catalogPlans ?? demoPlans : demoPlans;

  const selectedPlan = useMemo(
    () => activePlans.find((plan) => plan.id === selectedPlanId) ?? activePlans[0] ?? demoPlans[0],
    [activePlans, selectedPlanId]
  );
  const selectedPlanUsesCatalog = Boolean(catalogPlans?.some((plan) => plan.id === selectedPlan.id));
  const selectedPlanDay = selectedPlan.days.find((day) => day.day === selectedDay) ?? selectedPlan.days[0];
  const selectedCatalogDayKey =
    selectedPlanUsesCatalog && selectedPlanDay?.catalogDayId ? `${selectedPlan.id}:${selectedPlanDay.day}` : null;
  const selectedPlanDayForRender =
    selectedCatalogDayKey && catalogDayMeals[selectedCatalogDayKey]
      ? {
          ...selectedPlanDay,
          meals: catalogDayMeals[selectedCatalogDayKey],
        }
      : selectedPlanDay;
  const fallbackPlanDay = demoPlans[0].days.find((day) => day.day === selectedDay) ?? demoPlans[0].days[0];
  const selectedMeal =
    mealOverrides[selectedMealTitle] ??
    selectedPlanDayForRender.meals.find((meal) => meal.title === selectedMealTitle) ??
    selectedPlanDayForRender.meals[0] ??
    fallbackPlanDay.meals[0];
  const selectedReplacementOptions =
    selectedMeal.catalogSlotId && catalogReplacementOptions[selectedMeal.catalogSlotId]?.length
      ? catalogReplacementOptions[selectedMeal.catalogSlotId]
      : breakfastReplacementOptions;
  const selectedReplacement =
    selectedReplacementOptions.find((option) => option.id === selectedReplacementId) ?? null;
  const selectedShoppingKey =
    selectedPlanUsesCatalog && todayView === 'shopping_list'
      ? `${selectedPlan.id}:${selectedDay}:${shoppingPeriod}`
      : null;
  const selectedShoppingGroups =
    selectedShoppingKey && catalogShoppingGroups[selectedShoppingKey]?.length
      ? catalogShoppingGroups[selectedShoppingKey]
      : shoppingGroups;

  useEffect(() => {
    if (!goalSummary) {
      setGoalSummary(getStoredGoalSummary());
    }
  }, [goalSummary]);

  useEffect(() => {
    let isCancelled = false;

    async function loadCatalogPlans() {
      if (!hasGoal) {
        setCatalogPlans(null);
        setCatalogDayMeals({});
        setCatalogReplacementOptions({});
        setCatalogShoppingGroups({});
        return;
      }

      if (!isPremiumCatalogStagingReadMode()) {
        setCatalogPlans(null);
        setCatalogDayMeals({});
        setCatalogReplacementOptions({});
        setCatalogShoppingGroups({});
        return;
      }

      try {
        const plansResult = await premiumCatalogService.getActivePremiumPlans();
        if (isCancelled) return;

        if (!plansResult.ok || plansResult.data.length === 0) {
          setCatalogPlans(null);
          setCatalogDayMeals({});
          setCatalogReplacementOptions({});
          setCatalogShoppingGroups({});
          return;
        }

        const mappedPlans: DemoPlan[] = [];

        for (const plan of plansResult.data) {
          const detailResult = await premiumCatalogService.getPremiumPlanDetail(plan.id);
          if (isCancelled) return;

          if (!detailResult.ok || !detailResult.data || detailResult.data.days.length === 0) {
            continue;
          }

          mappedPlans.push(
            buildTodayPlanFromPremiumCatalog({
              plan,
              days: detailResult.data.days,
            })
          );
        }

        if (mappedPlans.length === 0) {
          setCatalogPlans(null);
          setCatalogDayMeals({});
          setCatalogReplacementOptions({});
          setCatalogShoppingGroups({});
          return;
        }

        setCatalogPlans(mappedPlans);
        setSelectedPlanId((currentPlanId) =>
          mappedPlans.some((plan) => plan.id === currentPlanId) ? currentPlanId : mappedPlans[0].id
        );
        setSelectedDay((currentDay) => {
          const nextPlan = mappedPlans.find((plan) => plan.id === selectedPlanId) ?? mappedPlans[0];
          return nextPlan.days.some((day) => day.day === currentDay) ? currentDay : nextPlan.days[0]?.day ?? 1;
        });
      } catch {
        if (!isCancelled) {
          setCatalogPlans(null);
          setCatalogDayMeals({});
          setCatalogReplacementOptions({});
          setCatalogShoppingGroups({});
        }
      }
    }

    void loadCatalogPlans();

    return () => {
      isCancelled = true;
    };
  }, [hasGoal, selectedPlanId]);

  useEffect(() => {
    let isCancelled = false;

    async function loadCatalogDayMeals() {
      if (!hasGoal || !isPremiumCatalogStagingReadMode()) {
        return;
      }

      if (todayView !== 'day_detail' && todayView !== 'meal_detail' && todayView !== 'replace_meal') {
        return;
      }

      if (!selectedPlanUsesCatalog || !selectedPlanDay?.catalogDayId || !selectedCatalogDayKey) {
        return;
      }

      if (catalogDayMeals[selectedCatalogDayKey]?.length) {
        return;
      }

      try {
        const slotsResult = await premiumCatalogService.getPremiumMealSlots(selectedPlanDay.catalogDayId);
        if (isCancelled) return;

        if (!slotsResult.ok || slotsResult.data.length === 0) {
          setCatalogPlans(null);
          setCatalogDayMeals({});
          setCatalogReplacementOptions({});
          setCatalogShoppingGroups({});
          return;
        }

        const primaryRecipeBySlotId: Parameters<typeof mapPremiumMealSlotsToTodayMeals>[1] = {};

        for (const slot of slotsResult.data) {
          const optionsResult = await premiumCatalogService.getMealRecipeOptions(slot.id);
          if (isCancelled) return;

          if (!optionsResult.ok) {
            throw new Error('catalog meal options read failed');
          }

          const primaryOption =
            optionsResult.data.find((option) => option.optionType === 'primary') ?? optionsResult.data[0];

          if (!primaryOption?.recipeId) {
            continue;
          }

          const recipeResult = await premiumCatalogService.getPremiumRecipeDetail(primaryOption.recipeId);
          if (isCancelled) return;

          if (!recipeResult.ok || !recipeResult.data) {
            throw new Error('catalog recipe detail read failed');
          }

          primaryRecipeBySlotId[slot.id] = recipeResult.data;
        }

        const meals = mapPremiumMealSlotsToTodayMeals(slotsResult.data, primaryRecipeBySlotId);

        if (meals.length === 0) {
          setCatalogPlans(null);
          setCatalogDayMeals({});
          setCatalogReplacementOptions({});
          setCatalogShoppingGroups({});
          return;
        }

        setCatalogDayMeals((current) => ({
          ...current,
          [selectedCatalogDayKey]: meals,
        }));
        setSelectedMealTitle((currentTitle) =>
          meals.some((meal) => meal.title === currentTitle) ? currentTitle : meals[0]?.title ?? 'Завтрак'
        );
      } catch {
        if (!isCancelled) {
          setCatalogPlans(null);
          setCatalogDayMeals({});
          setCatalogReplacementOptions({});
          setCatalogShoppingGroups({});
        }
      }
    }

    void loadCatalogDayMeals();

    return () => {
      isCancelled = true;
    };
  }, [
    catalogDayMeals,
    hasGoal,
    selectedCatalogDayKey,
    selectedPlanDay?.catalogDayId,
    selectedPlanUsesCatalog,
    todayView,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function loadCatalogReplacementOptions() {
      if (!hasGoal || !isPremiumCatalogStagingReadMode()) {
        return;
      }

      if (todayView !== 'replace_meal') {
        return;
      }

      if (!selectedPlanUsesCatalog || !selectedMeal.catalogSlotId) {
        return;
      }

      if (catalogReplacementOptions[selectedMeal.catalogSlotId]?.length) {
        return;
      }

      try {
        const optionsResult = await premiumCatalogService.getMealRecipeOptions(selectedMeal.catalogSlotId);
        if (isCancelled) return;

        if (!optionsResult.ok || optionsResult.data.length === 0) {
          return;
        }

        const recipeDetailsById: Parameters<typeof mapMealRecipeOptionsToReplacementOptions>[1] = {};

        for (const option of optionsResult.data) {
          if (!option.recipeId) {
            continue;
          }

          const recipeResult = await premiumCatalogService.getPremiumRecipeDetail(option.recipeId);
          if (isCancelled) return;

          if (recipeResult.ok && recipeResult.data) {
            recipeDetailsById[option.recipeId] = recipeResult.data;
          }
        }

        const replacements = mapMealRecipeOptionsToReplacementOptions(optionsResult.data, recipeDetailsById);

        if (replacements.length === 0) {
          return;
        }

        setCatalogReplacementOptions((current) => ({
          ...current,
          [selectedMeal.catalogSlotId!]: replacements,
        }));
        setSelectedReplacementId((currentId) =>
          replacements.some((option) => option.id === currentId) ? currentId : null
        );
      } catch {
        if (!isCancelled) {
          setSelectedReplacementId(null);
        }
      }
    }

    void loadCatalogReplacementOptions();

    return () => {
      isCancelled = true;
    };
  }, [
    catalogReplacementOptions,
    hasGoal,
    selectedMeal.catalogSlotId,
    selectedPlanUsesCatalog,
    todayView,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function loadCatalogShoppingGroups() {
      if (!hasGoal || !isPremiumCatalogStagingReadMode()) {
        return;
      }

      if (todayView !== 'shopping_list') {
        return;
      }

      if (!selectedPlanUsesCatalog || !selectedShoppingKey) {
        return;
      }

      if (catalogShoppingGroups[selectedShoppingKey]?.length) {
        return;
      }

      try {
        const shoppingResult = await premiumCatalogService.buildDerivedShoppingList(selectedPlan.id, {
          startDay: selectedDay,
          endDay: selectedDay + shoppingPeriod - 1,
        });
        if (isCancelled) return;

        if (!shoppingResult.ok || shoppingResult.data.length === 0) {
          return;
        }

        const groups = mapDerivedShoppingListToShoppingGroups(shoppingResult.data);
        if (groups.length === 0) {
          return;
        }

        setCatalogShoppingGroups((current) => ({
          ...current,
          [selectedShoppingKey]: groups,
        }));
      } catch {
        // Keep the existing mock shopping list as a quiet fallback.
      }
    }

    void loadCatalogShoppingGroups();

    return () => {
      isCancelled = true;
    };
  }, [
    catalogShoppingGroups,
    hasGoal,
    selectedDay,
    selectedPlan.id,
    selectedPlanUsesCatalog,
    selectedShoppingKey,
    shoppingPeriod,
    todayView,
  ]);

  const openPlan = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = activePlans.find((item) => item.id === planId);
    setSelectedDay(plan?.days[0]?.day ?? 1);
    setTodayView('plan_detail');
  };

  const openDay = (day: number) => {
    setSelectedDay(day);
    setTodayView('day_detail');
  };

  const openMeal = (mealTitle: string) => {
    setSelectedMealTitle(mealTitle);
    setTodayView('meal_detail');
  };

  const openReplaceMeal = () => {
    setSelectedReplacementId(null);
    setTodayView('replace_meal');
  };

  const openShoppingList = () => {
    setTodayView('shopping_list');
  };

  const toggleBoughtProduct = (productKey: string) => {
    setBoughtProducts((current) => {
      const next = new Set(current);
      if (next.has(productKey)) {
        next.delete(productKey);
      } else {
        next.add(productKey);
      }
      return next;
    });
  };

  const applyReplacement = () => {
    if (!selectedReplacement) {
      return;
    }

    setMealOverrides((current) => ({
      ...current,
      [selectedMealTitle]: selectedReplacement,
    }));
    setTodayView('meal_detail');
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
              {activePlans.map((plan) => (
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

  const renderPlanDetail = () => (
    <div className="min-h-[100dvh] w-full min-w-[320px] bg-white">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-5 pb-40 pt-5">
        <header className="relative flex min-h-10 items-center justify-center">
          <button
            type="button"
            onClick={() => setTodayView('home')}
            className="absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Назад"
          >
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <h1 className="mx-12 max-w-[184px] truncate whitespace-nowrap text-center text-base font-semibold leading-6 text-stone-950 min-[360px]:max-w-[260px] min-[430px]:max-w-[340px]">
            {selectedPlan.title}
          </h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <main className="flex flex-1 flex-col gap-5 py-6">
          <div className="space-y-2 text-center">
            <p className="text-sm font-semibold leading-5 text-stone-900">14 дней</p>
            <p className="text-sm leading-5 text-stone-500">{selectedPlan.subtitle.replace(' · 14 дней', '')}</p>
            <p className="mx-auto max-w-[310px] text-sm leading-5 text-stone-600">
              Питание и тренировки на 14 дней.
            </p>
          </div>

          <div className="space-y-1.5 pb-8">
            {selectedPlan.days.map((day) => {
              const isSelected = day.day === selectedDay;
              return (
                <button
                  key={day.day}
                  type="button"
                  onClick={() => openDay(day.day)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/60'
                      : 'border-stone-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-5 text-stone-950">День {day.day}</span>
                      <span className="flex-shrink-0 text-xs font-medium leading-5 text-stone-500">
                        {day.workout ? 'Питание + тренировка' : 'Питание'}
                      </span>
                    </span>
                    <span className="block whitespace-normal text-xs leading-4 text-stone-500">{day.macros}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-100 bg-white/95 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-[560px]">
          <Button variant="primary" size="md" fullWidth align="center">
            Выбрать план
          </Button>
        </div>
      </div>
    </div>
  );

  const dayStateOptions: Array<{ id: DayState; label: string; hint: string }> = [
    { id: 'usual', label: 'Обычный день', hint: 'План остаётся базовым.' },
    { id: 'low_energy', label: 'Нет сил', hint: 'Пока только отметка состояния.' },
    { id: 'no_time', label: 'Нет времени', hint: 'Пока только отметка состояния.' },
    { id: 'ready', label: 'Готова работать', hint: 'Пока только отметка состояния.' },
  ];

  const selectedDayState = dayStateOptions.find((option) => option.id === dayState) ?? dayStateOptions[0];

  const renderDayDetail = () => (
    <div className="min-h-[100dvh] w-full min-w-[320px] bg-white">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-5 pb-56 pt-5">
        <header className="relative flex min-h-10 items-center justify-center">
          <button
            type="button"
            onClick={() => setTodayView('plan_detail')}
            className="absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Назад к плану"
          >
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <h1 className="mx-12 truncate whitespace-nowrap text-center text-lg font-semibold leading-6 text-stone-950">
            День {selectedPlanDayForRender.day}
          </h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <main className="flex flex-1 flex-col gap-4 py-5">
          <section className="space-y-1 text-center">
            <p className="text-xl font-semibold leading-7 text-stone-950">{selectedPlanDayForRender.calories}</p>
            <p className="text-sm font-medium leading-5 text-stone-500">{selectedPlanDayForRender.macroDetails}</p>
          </section>

          <section className="space-y-1">
            {selectedPlanDayForRender.meals.map((meal) => (
              <button
                key={meal.title}
                type="button"
                onClick={() => openMeal(meal.title)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold leading-5 text-stone-950">{meal.title}</p>
                  <span className="flex-shrink-0 text-xs font-medium leading-5 text-stone-500">{meal.calories}</span>
                </div>
                <p className="text-sm leading-5 text-stone-600">{meal.summary}</p>
              </button>
            ))}
          </section>

          {selectedPlanDayForRender.workout && (
            <section className="rounded-lg border border-stone-200 bg-white px-3 py-1.5">
              <p className="text-sm font-semibold leading-5 text-stone-950">{selectedPlanDayForRender.workout.title}</p>
              <p className="text-sm leading-5 text-stone-600">
                {selectedPlanDayForRender.workout.duration} · {selectedPlanDayForRender.workout.focus}
              </p>
            </section>
          )}

          <section className="space-y-2 pb-12">
            <p className="text-sm font-semibold leading-5 text-stone-950">Состояние дня</p>
            <div className="grid grid-cols-2 gap-1.5">
              {dayStateOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDayState(option.id)}
                  className={`rounded-lg border px-2.5 py-2 text-center text-xs font-medium leading-4 transition ${
                    option.id === dayState
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-emerald-400 hover:bg-emerald-50/40'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs leading-4 text-stone-400">{selectedDayState.hint}</p>
          </section>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-100 bg-white/95 px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-1.5">
          <Button variant="outline" size="sm" onClick={openShoppingList} fullWidth align="center">
            Список покупок
          </Button>
          <Button variant="primary" size="sm" disabled fullWidth align="center">
            Подтвердить день
          </Button>
        </div>
      </div>
    </div>
  );

  const renderShoppingList = () => (
    <div className="min-h-[100dvh] w-full min-w-[320px] bg-white">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-5 pb-12 pt-[max(32px,env(safe-area-inset-top))]">
        <header className="relative flex min-h-10 items-center justify-center">
          <button
            type="button"
            onClick={() => setTodayView('day_detail')}
            className="absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Назад ко дню"
          >
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <h1 className="mx-12 truncate whitespace-nowrap text-center text-lg font-semibold leading-6 text-stone-950">
            Список покупок
          </h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <main className="flex flex-1 flex-col gap-4 py-5">
          <section className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {shoppingPeriods.map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setShoppingPeriod(period)}
                  className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold leading-4 transition ${
                    period === shoppingPeriod
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-emerald-400 hover:bg-emerald-50/40'
                  }`}
                >
                  {formatShoppingPeriodLabel(period)}
                </button>
              ))}
            </div>
            <p className="text-center text-sm leading-5 text-stone-500">
              Выберите дни, для которых собрать продукты.
            </p>
          </section>

          <section className="space-y-3">
            {selectedShoppingGroups.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <p className="text-sm font-semibold leading-5 text-stone-950">{group.title}</p>
                <div className="space-y-1">
                  {group.products.map((product) => {
                    const productKey = `${group.title}:${product.name}`;
                    const isBought = boughtProducts.has(productKey);
                    return (
                      <label
                        key={productKey}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                          isBought ? 'border-emerald-200 bg-emerald-50/60' : 'border-stone-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isBought}
                          onChange={() => toggleBoughtProduct(productKey)}
                          className="h-4 w-4 flex-shrink-0 rounded border-stone-300 text-emerald-600"
                        />
                        <span className="min-w-0 flex-1 text-sm leading-5 text-stone-700">
                          <span className={isBought ? 'text-stone-400 line-through' : undefined}>{product.name}</span>
                          <span className="text-stone-400"> — </span>
                          <span className={isBought ? 'text-stone-400 line-through' : undefined}>
                            {formatShoppingAmount(product, shoppingPeriod)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  );

  const renderMealDetail = () => (
    <div className="min-h-[100dvh] w-full min-w-[320px] bg-white">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-5 pb-60 pt-[max(32px,env(safe-area-inset-top))]">
        <header className="relative flex min-h-10 items-center justify-center">
          <button
            type="button"
            onClick={() => setTodayView('day_detail')}
            className="absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Назад ко дню"
          >
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <h1 className="mx-12 truncate whitespace-nowrap text-center text-lg font-semibold leading-6 text-stone-950">
            {selectedMeal.title}
          </h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <main className="flex flex-1 flex-col gap-4 pb-8 pt-5">
          <section className="space-y-1 text-center">
            <p className="mx-auto max-w-[280px] text-base font-semibold leading-6 text-stone-950">
              {selectedMeal.summary}
            </p>
            <p className="text-sm font-semibold leading-5 text-stone-900">{selectedMeal.calories}</p>
            <p className="text-sm font-medium leading-5 text-stone-500">{selectedMeal.macroDetails}</p>
          </section>

          <section className="space-y-1.5">
            <p className="text-sm font-semibold leading-5 text-stone-950">Ингредиенты</p>
            <div className="space-y-1">
              {selectedMeal.ingredients.map((ingredient) => (
                <p
                  key={ingredient}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm leading-5 text-stone-700"
                >
                  {ingredient}
                </p>
              ))}
            </div>
          </section>

          <section className="space-y-1.5">
            <p className="text-sm font-semibold leading-5 text-stone-950">Подсказки без весов</p>
            <p className="text-sm leading-5 text-stone-500">Без весов: используйте примерный ориентир.</p>
            <div className="space-y-1">
              {selectedMeal.portionHints.map((hint) => (
                <p key={hint} className="rounded-lg bg-stone-50 px-3 py-1.5 text-sm leading-5 text-stone-600">
                  {hint}
                </p>
              ))}
            </div>
          </section>

          <section className="space-y-1.5 pb-16">
            <p className="text-sm font-semibold leading-5 text-stone-950">Способ приготовления</p>
            <ol className="space-y-1">
              {selectedMeal.steps.map((step, index) => (
                <li key={step} className="flex gap-2 text-sm leading-5 text-stone-700">
                  <span className="w-4 flex-shrink-0 text-stone-400">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="pt-1 text-xs leading-4 text-stone-400">
              Добавление в дневник будет доступно после подтверждения.
            </p>
          </section>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-100 bg-white/95 px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-1.5">
          <Button variant="outline" size="sm" onClick={openReplaceMeal} fullWidth align="center">
            Заменить блюдо
          </Button>
          <Button variant="primary" size="sm" disabled fullWidth align="center">
            Добавить в дневник
          </Button>
        </div>
      </div>
    </div>
  );

  const renderReplaceMeal = () => (
    <div className="min-h-[100dvh] w-full min-w-[320px] bg-white">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-5 pb-44 pt-[max(32px,env(safe-area-inset-top))]">
        <header className="relative flex min-h-10 items-center justify-center">
          <button
            type="button"
            onClick={() => setTodayView('meal_detail')}
            className="absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Назад к блюду"
          >
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <h1 className="mx-12 max-w-[220px] truncate whitespace-nowrap text-center text-base font-semibold leading-6 text-stone-950 min-[360px]:max-w-[280px]">
            Заменить {selectedMealTitle.toLowerCase()}
          </h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100"
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <main className="flex flex-1 flex-col gap-4 pb-8 pt-5">
          <p className="text-center text-sm leading-5 text-stone-500">Выберите похожий вариант по КБЖУ.</p>

          <div className="flex flex-wrap justify-center gap-1.5">
            {replaceMealFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium leading-4 text-stone-600"
              >
                {filter}
              </button>
            ))}
          </div>

          <section className="space-y-1.5 pb-8">
            {selectedReplacementOptions.map((option) => {
              const isSelected = option.id === selectedReplacementId;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedReplacementId(option.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/60'
                      : 'border-stone-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40'
                  }`}
                >
                  <span className="block text-sm font-semibold leading-5 text-stone-950">{option.summary}</span>
                  <span className="block text-xs leading-4 text-stone-500">
                    {option.calories} · {option.macroDetails}
                  </span>
                  <span className="block pt-1 text-xs leading-4 text-stone-400">{option.note}</span>
                </button>
              );
            })}
          </section>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-100 bg-white/95 px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
        <div className="mx-auto w-full max-w-[560px]">
          <Button
            variant="primary"
            size="sm"
            disabled={!selectedReplacement}
            onClick={applyReplacement}
            fullWidth
            align="center"
          >
            Выбрать замену
          </Button>
        </div>
      </div>
    </div>
  );

  if (todayView === 'home' && !hasGoal) {
    return renderNoGoalScreen();
  }

  if (!hasGoal) {
    return renderNoGoalScreen();
  }

  if (todayView === 'home' && hasGoal) {
    return renderExistingGoalScreen();
  }

  if (todayView === 'day_detail') {
    return renderDayDetail();
  }

  if (todayView === 'shopping_list') {
    return renderShoppingList();
  }

  if (todayView === 'meal_detail') {
    return renderMealDetail();
  }

  if (todayView === 'replace_meal') {
    return renderReplaceMeal();
  }

  return renderPlanDetail();
};

export default Today;
