import type { FeatureCard } from '../types';

export const features: FeatureCard[] = [
  {
    id: 'workout-nutrition-plan',
    title: 'План тренировок и питания',
    subtitle: 'Здесь курсы по тренировкам и питанию',
    icon: 'clipboard-dumbbell',
    isPremium: false,
    route: '/plan',
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
    isPremium: true,
    route: '/workouts',
  },
  {
    id: 'habits',
    title: 'ПРИВЫЧКИ',
    subtitle: 'Здесь твой трекер-привычек',
    icon: 'clipboard-check',
    isPremium: true,
    route: '/habits',
  },
  {
    id: 'progress',
    title: 'ПРОГРЕСС',
    subtitle: 'Здесь дневник твоего прогресса',
    icon: 'chart-bar',
    isPremium: true,
    route: '/progress',
  },
];

