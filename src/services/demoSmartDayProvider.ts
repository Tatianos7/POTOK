import type { TodayDayState, TodayItem, TodayPlan } from '../types/todayPlan';

export interface SmartDayStateOption {
  id: TodayDayState;
  label: string;
  subtitle: string;
}

export const smartDayStateOptions: SmartDayStateOption[] = [
  {
    id: 'low_energy',
    label: 'Нет сил',
    subtitle: 'Мягкий день без давления',
  },
  {
    id: 'normal',
    label: 'Обычный день',
    subtitle: 'Сбалансированный план',
  },
  {
    id: 'ready',
    label: 'Готова работать',
    subtitle: 'Больше структуры и фокуса',
  },
];

const smartDayTemplates: Record<TodayDayState, Array<Omit<TodayItem, 'id' | 'planId' | 'source' | 'status'>>> = {
  low_energy: [
    {
      type: 'meal',
      title: 'Питание',
      subtitle: 'Простой завтрак, тёплый обед и лёгкий ужин',
      note: 'Без сложной готовки: выберите понятные продукты и подтвердите в дневнике отдельно.',
    },
    {
      type: 'workout',
      title: 'Тренировка',
      subtitle: '10–15 минут лёгкой активности дома',
      note: 'Если есть боль или сильная усталость, замените на восстановление.',
    },
    {
      type: 'water',
      title: 'Вода / активность',
      subtitle: 'Держите воду рядом и сделайте короткую прогулку, если получится',
    },
    {
      type: 'task',
      title: 'Рекомендации',
      subtitle: 'Сегодня цель — сохранить ритм, а не давить на себя.',
    },
  ],
  normal: [
    {
      type: 'meal',
      title: 'Питание',
      subtitle: 'Завтрак, обед, ужин и перекус под дневную цель',
      note: 'План питания остаётся планом, запись в дневник делается только после подтверждения.',
    },
    {
      type: 'workout',
      title: 'Тренировка',
      subtitle: '25 минут: ноги, ягодицы и корпус',
    },
    {
      type: 'water',
      title: 'Вода / активность',
      subtitle: 'Ориентир по воде и спокойная активность в течение дня',
    },
    {
      type: 'task',
      title: 'Рекомендации',
      subtitle: 'Закройте базу дня и вечером проверьте, что реально выполнено.',
    },
  ],
  ready: [
    {
      type: 'meal',
      title: 'Питание',
      subtitle: 'Белковый завтрак, плотный обед и контролируемый ужин',
      note: 'Если блюдо не подходит, замените питание до подтверждения.',
    },
    {
      type: 'workout',
      title: 'Тренировка',
      subtitle: '35 минут: силовой фокус и добивка на корпус',
    },
    {
      type: 'water',
      title: 'Вода / активность',
      subtitle: 'Вода по ходу дня и дополнительная прогулка после еды',
    },
    {
      type: 'task',
      title: 'Рекомендации',
      subtitle: 'День можно сделать насыщеннее, но без резких скачков нагрузки.',
    },
  ],
};

export function getSmartDayStateOption(stateId: TodayDayState): SmartDayStateOption {
  return smartDayStateOptions.find((option) => option.id === stateId) ?? smartDayStateOptions[1];
}

export function buildDemoSmartDayPlan(stateId: TodayDayState, date: string): TodayPlan {
  const state = getSmartDayStateOption(stateId);
  const now = new Date().toISOString();
  const planId = `today-smart-day-${stateId}-${date}`;
  const items: TodayItem[] = smartDayTemplates[stateId].map((item, index) => ({
    ...item,
    id: `${planId}-item-${index + 1}`,
    planId,
    source: 'smart_day',
    status: 'planned',
  }));

  return {
    id: planId,
    source: 'smart_day',
    title: `Сегодня готово · ${state.label}`,
    date,
    status: 'active',
    dayState: stateId,
    items,
    createdAt: now,
    updatedAt: now,
  };
}
