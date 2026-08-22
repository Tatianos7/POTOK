import type { FeatureCard } from '../types';

export const features: FeatureCard[] = [
  {
    id: 'workout-nutrition-plan',
    title: 'POTOK Premium',
    subtitle: 'Готовый план питания и тренировок под вашу цель',
    icon: 'clipboard-dumbbell',
    isPremium: false,
    route: '/paywall',
  },
  {
    id: 'goal',
    title: 'ЦЕЛЬ',
    subtitle: 'Создай свою цель',
    icon: 'target',
    isPremium: false,
    route: '/goal',
  },
  {
    id: 'measurements',
    title: 'ЗАМЕРЫ',
    subtitle: 'Замерь себя',
    icon: 'ruler',
    isPremium: false,
    route: '/measurements',
  },
  {
    id: 'nutrition',
    title: 'ПИТАНИЕ',
    subtitle: 'Здесь твой дневник питания',
    icon: 'utensils',
    isPremium: false,
    route: '/nutrition',
  },
  {
    id: 'workouts',
    title: 'ТРЕНИРОВКИ',
    subtitle: 'Здесь дневник твоих тренировок',
    icon: 'dumbbell',
    isPremium: false,
    route: '/workouts',
  },
  {
    id: 'progress',
    title: 'ПРОГРЕСС',
    subtitle: 'Здесь дневник твоего прогресса',
    icon: 'chart-bar',
    isPremium: false,
    route: '/progress',
  },
];
