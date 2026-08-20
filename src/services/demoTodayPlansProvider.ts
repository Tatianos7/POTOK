import type {
  TodayItem,
  TodayItemStatus,
  TodayItemType,
  TodayNotSuitableReason,
  TodayPlan,
} from '../types/todayPlan';

export interface DemoTodayProgramDayItem {
  type: TodayItemType;
  title: string;
  subtitle: string;
  note?: string;
  actionLabel: string;
}

export interface DemoTodayProgramDay {
  dayIndex: number;
  title: string;
  focus: string;
  items: DemoTodayProgramDayItem[];
}

export interface DemoTodayProgram {
  id: string;
  title: string;
  goal: string;
  format: string;
  level: string;
  durationDays: number;
  subtitle: string;
  description: string;
  days: DemoTodayProgramDay[];
}

const baseDayItems: DemoTodayProgramDayItem[] = [
  {
    type: 'meal',
    title: 'Завтрак',
    subtitle: 'Овсянка, банан, йогурт',
    note: 'Проверьте состав перед добавлением в дневник',
    actionLabel: 'Перейти в дневник',
  },
  {
    type: 'workout',
    title: 'Тренировка дома · 25 минут',
    subtitle: 'Ноги и ягодицы',
    actionLabel: 'Начать тренировку',
  },
  {
    type: 'water',
    title: 'Вода',
    subtitle: 'Держите ориентир по воде в течение дня',
    actionLabel: 'Выполнено',
  },
];

const demoHomeWeightLossDays: DemoTodayProgramDay[] = [
  { dayIndex: 1, title: 'День 1', focus: 'Мягкий старт', items: baseDayItems },
  { dayIndex: 2, title: 'День 2', focus: 'Ритм питания и прогулка', items: baseDayItems },
  { dayIndex: 3, title: 'День 3', focus: 'Домашняя активность', items: baseDayItems },
  { dayIndex: 4, title: 'День 4', focus: 'Спокойное восстановление', items: baseDayItems },
  { dayIndex: 5, title: 'День 5', focus: 'Ноги и корпус', items: baseDayItems },
  { dayIndex: 6, title: 'День 6', focus: 'Лёгкая активность', items: baseDayItems },
  { dayIndex: 7, title: 'День 7', focus: 'Закрепить неделю', items: baseDayItems },
];

export const demoTodayPrograms: DemoTodayProgram[] = [
  {
    id: 'demo-home-weight-loss-7-days',
    title: 'Похудение дома · 7 дней',
    goal: 'снижение веса',
    format: 'дома',
    level: 'начинающий',
    durationDays: 7,
    subtitle: 'Питание + активность без оборудования',
    description: 'Демо-превью: программа показывает, как готовый план раскрывается по дням в Today.',
    days: demoHomeWeightLossDays,
  },
];

export const todayNotSuitableReasons: Array<{ id: TodayNotSuitableReason; label: string }> = [
  { id: 'no_products', label: 'Нет продуктов' },
  { id: 'no_time', label: 'Нет времени' },
  { id: 'too_hard', label: 'Слишком сложно' },
  { id: 'other', label: 'Другое' },
];

export function getDemoTodayPrograms(): DemoTodayProgram[] {
  return demoTodayPrograms;
}

export function getDemoTodayProgram(programId: string): DemoTodayProgram | undefined {
  return demoTodayPrograms.find((program) => program.id === programId);
}

export function getDemoTodayProgramDay(programId: string, dayIndex: number): DemoTodayProgramDay | undefined {
  return getDemoTodayProgram(programId)?.days.find((day) => day.dayIndex === dayIndex);
}

export function buildTodayPlanFromDemoDay(programId: string, dayIndex: number, date: string): TodayPlan {
  const program = getDemoTodayProgram(programId);
  const day = getDemoTodayProgramDay(programId, dayIndex);

  if (!program || !day) {
    throw new Error('Demo Today program day not found');
  }

  const now = new Date().toISOString();
  const planId = `today-demo-${program.id}-day-${day.dayIndex}`;
  const items: TodayItem[] = day.items.map((item, index) => ({
    id: `${planId}-item-${index + 1}`,
    planId,
    source: 'purchased_plan',
    type: item.type,
    title: item.title,
    subtitle: item.subtitle,
    note: item.note,
    actionLabel: item.actionLabel,
    status: 'planned',
  }));

  return {
    id: planId,
    source: 'purchased_plan',
    title: `${program.title} · ${day.title}`,
    date,
    status: 'active',
    demoProgramId: program.id,
    demoDayIndex: day.dayIndex,
    items,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTodayPlanItemStatus(
  plan: TodayPlan,
  itemId: string,
  status: TodayItemStatus,
  notSuitableReason?: TodayNotSuitableReason
): TodayPlan {
  const now = new Date().toISOString();
  const items = plan.items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          status,
          notSuitableReason: status === 'not_suitable' ? notSuitableReason : undefined,
        }
      : item
  );
  const doneCount = items.filter((item) => item.status === 'done').length;
  const nextStatus = doneCount === items.length ? 'completed' : doneCount > 0 ? 'partially_completed' : 'active';

  return {
    ...plan,
    status: nextStatus,
    items,
    updatedAt: now,
  };
}
