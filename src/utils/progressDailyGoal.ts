export type ProgressDailyGoalItemId = 'nutrition' | 'activity' | 'water' | 'progress';

export interface ProgressDailyGoalInput {
  caloriesLogged: number;
  calorieTarget?: number | null;
  hasWorkoutEntries: boolean;
  progressViewed: boolean;
  waterGlasses?: number | null;
  waterEnabled?: boolean;
  periodMetrics?: ProgressDailyGoalPeriodMetrics | null;
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

function isObjectiveDayCompleted(day: ProgressDailyGoalPeriodDay): boolean {
  return isNutritionWithinGoal(day.caloriesLogged, day.calorieTarget) && day.hasWorkoutEntries;
}

function hasObjectiveData(day: ProgressDailyGoalPeriodDay): boolean {
  return day.caloriesLogged > 0 || day.hasWorkoutEntries;
}

export function deriveProgressDailyGoalPeriodMetrics(days: ProgressDailyGoalPeriodDay[]): ProgressDailyGoalPeriodMetrics {
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const monthDays = sortedDays.slice(-30);
  const weekDays = sortedDays.slice(-7);
  const completedDates = new Set(monthDays.filter(isObjectiveDayCompleted).map((day) => day.date));

  const weekCompletedDays = weekDays.filter((day) => completedDates.has(day.date)).length;
  const monthCompletedDays = monthDays.filter((day) => completedDates.has(day.date)).length;
  const objectiveDataDays = monthDays.filter(hasObjectiveData).length;
  const monthNutritionDays = monthDays.filter((day) => isNutritionWithinGoal(day.caloriesLogged, day.calorieTarget)).length;
  const monthWorkoutDays = monthDays.filter((day) => day.hasWorkoutEntries).length;

  const lastDayIndex = monthDays.length - 1;
  const streakStartIndex =
    lastDayIndex >= 0 && isObjectiveDayCompleted(monthDays[lastDayIndex])
      ? lastDayIndex
      : lastDayIndex > 0 && isObjectiveDayCompleted(monthDays[lastDayIndex - 1])
        ? lastDayIndex - 1
        : -1;

  let streakDays = 0;
  for (let index = streakStartIndex; index >= 0; index -= 1) {
    if (!isObjectiveDayCompleted(monthDays[index])) break;
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
  const waterEnabled = Boolean(input.waterEnabled);
  const waterCompleted = waterEnabled && Number(input.waterGlasses ?? 0) > 0;
  const nutritionItem = deriveNutritionItem(input);

  const items: ProgressDailyGoalItem[] = [
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

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const availableItems = items.filter((item) => !item.disabled);
  const isComplete = availableItems.length > 0 && availableItems.every((item) => item.completed);
  const hasAnyFacts = input.caloriesLogged > 0 || input.hasWorkoutEntries || waterCompleted || input.progressViewed;

  return {
    title: 'Цель дня',
    subtitle: 'Держаться в рамках питания и выполнить активность',
    items,
    periodMetrics: input.periodMetrics ?? null,
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
