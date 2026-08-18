export type ProgressDailyGoalItemId = 'nutrition' | 'activity' | 'water' | 'progress';

export const PROGRESS_DAILY_GOAL_DEFAULT_SELECTED_ITEM_IDS: ProgressDailyGoalItemId[] = [
  'nutrition',
  'activity',
  'water',
  'progress',
];

export interface ProgressDailyGoalPreferences {
  enabled: boolean;
  selectedItemIds: ProgressDailyGoalItemId[];
}

export interface ProgressDailyGoalInput {
  caloriesLogged: number;
  calorieTarget?: number | null;
  hasWorkoutEntries: boolean;
  progressViewed: boolean;
  waterGlasses?: number | null;
  waterEnabled?: boolean;
  periodMetrics?: ProgressDailyGoalPeriodMetrics | null;
  preferences?: ProgressDailyGoalPreferences | null;
}

export interface ProgressDailyGoalItem {
  id: ProgressDailyGoalItemId;
  label: string;
  completed: boolean;
  disabled?: boolean;
  note?: string;
}

export interface ProgressDailyGoalState {
  title: string;
  subtitle: string;
  enabled: boolean;
  selectedItemIds: ProgressDailyGoalItemId[];
  items: ProgressDailyGoalItem[];
  periodMetrics: ProgressDailyGoalPeriodMetrics | null;
  completedCount: number;
  totalCount: number;
  progressText: string;
  messageTitle: string;
  messageBody: string;
  isComplete: boolean;
}

export interface ProgressDailyGoalPeriodDay {
  date: string;
  caloriesLogged: number;
  calorieTarget?: number | null;
  hasWorkoutEntries: boolean;
}

export interface ProgressDailyGoalPeriodMetrics {
  streakDays: number;
  weekCompletedDays: number;
  weekTotalDays: number;
  monthCompletedDays: number;
  monthTotalDays: number;
  conclusion: string;
}

const NUTRITION_LOWER_BOUND_RATIO = 0.9;
const NUTRITION_UPPER_BOUND_RATIO = 1.1;
const OBJECTIVE_HISTORICAL_ITEM_IDS = new Set<ProgressDailyGoalItemId>(['nutrition', 'activity']);
const ALL_ITEM_IDS = new Set<ProgressDailyGoalItemId>(PROGRESS_DAILY_GOAL_DEFAULT_SELECTED_ITEM_IDS);

export function normalizeProgressDailyGoalPreferences(input: unknown): ProgressDailyGoalPreferences {
  const raw = input && typeof input === 'object' ? (input as Partial<ProgressDailyGoalPreferences>) : {};
  const selectedItemIds = Array.isArray(raw.selectedItemIds)
    ? raw.selectedItemIds.filter((itemId): itemId is ProgressDailyGoalItemId => ALL_ITEM_IDS.has(itemId as ProgressDailyGoalItemId))
    : PROGRESS_DAILY_GOAL_DEFAULT_SELECTED_ITEM_IDS;
  const uniqueSelectedItemIds = Array.from(new Set(selectedItemIds));
  const hasHistoricalObjectiveItem = uniqueSelectedItemIds.some((itemId) => OBJECTIVE_HISTORICAL_ITEM_IDS.has(itemId));

  return {
    enabled: raw.enabled !== false,
    selectedItemIds:
      uniqueSelectedItemIds.length > 0 && hasHistoricalObjectiveItem
        ? uniqueSelectedItemIds
        : PROGRESS_DAILY_GOAL_DEFAULT_SELECTED_ITEM_IDS,
  };
}

function formatCalories(value: number): string {
  return `${Math.round(value)} ккал`;
}

function deriveNutritionItem(input: ProgressDailyGoalInput): ProgressDailyGoalItem {
  const caloriesLogged = Number.isFinite(input.caloriesLogged) ? Math.max(0, input.caloriesLogged) : 0;
  const calorieTarget = Number(input.calorieTarget);

  if (!Number.isFinite(calorieTarget) || calorieTarget <= 0) {
    return {
      id: 'nutrition',
      label: 'Питание в рамках цели',
      completed: false,
      note: 'Недостаточно данных',
    };
  }

  if (caloriesLogged <= 0) {
    return {
      id: 'nutrition',
      label: 'Питание в рамках цели',
      completed: false,
      note: `Цель ${formatCalories(calorieTarget)}`,
    };
  }

  const lowerBound = calorieTarget * NUTRITION_LOWER_BOUND_RATIO;
  const upperBound = calorieTarget * NUTRITION_UPPER_BOUND_RATIO;
  const isWithinTarget = caloriesLogged >= lowerBound && caloriesLogged <= upperBound;

  return {
    id: 'nutrition',
    label: 'Питание в рамках цели',
    completed: isWithinTarget,
    note: `Записано ${formatCalories(caloriesLogged)} из ${formatCalories(calorieTarget)}`,
  };
}

function isNutritionWithinGoal(caloriesLogged: number, calorieTarget?: number | null): boolean {
  const safeCaloriesLogged = Number.isFinite(caloriesLogged) ? Math.max(0, caloriesLogged) : 0;
  const safeCalorieTarget = Number(calorieTarget);

  if (!Number.isFinite(safeCalorieTarget) || safeCalorieTarget <= 0 || safeCaloriesLogged <= 0) {
    return false;
  }

  return (
    safeCaloriesLogged >= safeCalorieTarget * NUTRITION_LOWER_BOUND_RATIO &&
    safeCaloriesLogged <= safeCalorieTarget * NUTRITION_UPPER_BOUND_RATIO
  );
}

function getSelectedHistoricalObjectiveItemIds(selectedItemIds?: ProgressDailyGoalItemId[]): ProgressDailyGoalItemId[] {
  const normalized = normalizeProgressDailyGoalPreferences({ enabled: true, selectedItemIds }).selectedItemIds;
  return normalized.filter((itemId) => OBJECTIVE_HISTORICAL_ITEM_IDS.has(itemId));
}

function isObjectiveDayCompleted(day: ProgressDailyGoalPeriodDay, selectedItemIds?: ProgressDailyGoalItemId[]): boolean {
  const objectiveItemIds = getSelectedHistoricalObjectiveItemIds(selectedItemIds);
  if (objectiveItemIds.length === 0) return false;

  return objectiveItemIds.every((itemId) => {
    if (itemId === 'nutrition') return isNutritionWithinGoal(day.caloriesLogged, day.calorieTarget);
    if (itemId === 'activity') return day.hasWorkoutEntries;
    return false;
  });
}

function hasObjectiveData(day: ProgressDailyGoalPeriodDay): boolean {
  return day.caloriesLogged > 0 || day.hasWorkoutEntries;
}

export function deriveProgressDailyGoalPeriodMetrics(
  days: ProgressDailyGoalPeriodDay[],
  selectedItemIds: ProgressDailyGoalItemId[] = PROGRESS_DAILY_GOAL_DEFAULT_SELECTED_ITEM_IDS,
): ProgressDailyGoalPeriodMetrics {
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const monthDays = sortedDays.slice(-30);
  const weekDays = sortedDays.slice(-7);
  const completedDates = new Set(monthDays.filter((day) => isObjectiveDayCompleted(day, selectedItemIds)).map((day) => day.date));

  const weekCompletedDays = weekDays.filter((day) => completedDates.has(day.date)).length;
  const monthCompletedDays = monthDays.filter((day) => completedDates.has(day.date)).length;
  const objectiveDataDays = monthDays.filter(hasObjectiveData).length;
  const monthNutritionDays = monthDays.filter((day) => isNutritionWithinGoal(day.caloriesLogged, day.calorieTarget)).length;
  const monthWorkoutDays = monthDays.filter((day) => day.hasWorkoutEntries).length;

  const lastDayIndex = monthDays.length - 1;
  const streakStartIndex =
    lastDayIndex >= 0 && isObjectiveDayCompleted(monthDays[lastDayIndex], selectedItemIds)
      ? lastDayIndex
      : lastDayIndex > 0 && isObjectiveDayCompleted(monthDays[lastDayIndex - 1], selectedItemIds)
        ? lastDayIndex - 1
        : -1;

  let streakDays = 0;
  for (let index = streakStartIndex; index >= 0; index -= 1) {
    if (!isObjectiveDayCompleted(monthDays[index], selectedItemIds)) break;
    streakDays += 1;
  }

  let conclusion = 'Каждый закрытый день помогает видеть реальный прогресс.';
  if (monthCompletedDays === 0) {
    conclusion = 'Начните закрывать дни — здесь появится прогресс за месяц.';
  } else if (objectiveDataDays < 3) {
    conclusion = 'За месяц пока мало данных — продолжайте вести дневник.';
  } else if (monthCompletedDays >= 20) {
    conclusion = 'Месяц идёт ровно. Продолжайте без рывков.';
  } else if (monthNutritionDays < monthWorkoutDays) {
    conclusion = 'Питание чаще всего мешает закрыть день.';
  } else if (monthWorkoutDays < monthNutritionDays) {
    conclusion = 'Добавьте хотя бы короткую активность.';
  }

  return {
    streakDays,
    weekCompletedDays,
    weekTotalDays: weekDays.length,
    monthCompletedDays,
    monthTotalDays: monthDays.length,
    conclusion,
  };
}

export function deriveProgressDailyGoalState(input: ProgressDailyGoalInput): ProgressDailyGoalState {
  const preferences = normalizeProgressDailyGoalPreferences(input.preferences);
  const selectedItemIds = new Set(preferences.selectedItemIds);
  const waterEnabled = Boolean(input.waterEnabled);
  const waterCompleted = waterEnabled && Number(input.waterGlasses ?? 0) > 0;
  const nutritionItem = deriveNutritionItem(input);

  const allItems: ProgressDailyGoalItem[] = [
    nutritionItem,
    {
      id: 'activity',
      label: 'Провести тренировку / активность',
      completed: input.hasWorkoutEntries,
    },
    {
      id: 'water',
      label: 'Выпить воду',
      completed: waterCompleted,
      disabled: !waterEnabled,
      note: waterEnabled
        ? input.waterGlasses && input.waterGlasses > 0
          ? `${input.waterGlasses} ст.`
          : undefined
        : 'Скоро',
    },
    {
      id: 'progress',
      label: 'Проверить Progress',
      completed: input.progressViewed,
      note: 'UI-only',
    },
  ];
  const items = allItems.filter((item) => selectedItemIds.has(item.id));

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const availableItems = items.filter((item) => !item.disabled);
  const isComplete = availableItems.length > 0 && availableItems.every((item) => item.completed);
  const hasAnyFacts = input.caloriesLogged > 0 || input.hasWorkoutEntries || waterCompleted || input.progressViewed;

  return {
    title: 'Цель дня',
    subtitle: 'Держаться в рамках питания и выполнить активность',
    enabled: preferences.enabled,
    selectedItemIds: preferences.selectedItemIds,
    items,
    periodMetrics: preferences.enabled ? input.periodMetrics ?? null : null,
    completedCount,
    totalCount,
    progressText: `Выполнено ${completedCount} из ${totalCount}`,
    messageTitle: isComplete ? 'Цель дня выполнена' : 'Мягкий фокус на сегодня',
    messageBody: isComplete
      ? 'Отлично. Сегодня вы закрыли основные действия.'
      : hasAnyFacts
        ? 'Продолжайте в том же темпе — каждый пункт помогает видеть реальный прогресс.'
        : 'Начните с простого: добавьте питание или активность.',
    isComplete,
  };
}
