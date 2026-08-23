import { FeatureCard } from '../types';
import { 
  BookOpen,
  ClipboardList, 
  Target, 
  Ruler, 
  UtensilsCrossed, 
  Dumbbell, 
  BarChart3 
} from 'lucide-react';

export const FEATURE_CARDS: FeatureCard[] = [
  {
    id: '1',
    icon: 'ClipboardList',
    title: 'POTOK Premium',
    subtitle: 'Готовый план питания и тренировок под вашу цель',
    isPremium: false,
    route: '/paywall',
  },
  {
    id: '2',
    icon: 'Target',
    title: 'ЦЕЛЬ',
    subtitle: 'Создай свою цель',
    isPremium: false,
    route: '/goals',
  },
  {
    id: '3',
    icon: 'Ruler',
    title: 'ЗАМЕРЫ',
    subtitle: 'Замерь себя',
    isPremium: false,
    route: '/measurements',
  },
  {
    id: '4',
    icon: 'UtensilsCrossed',
    title: 'ПИТАНИЕ',
    subtitle: 'Здесь твой дневник питания',
    isPremium: false,
    route: '/nutrition',
  },
  {
    id: '5',
    icon: 'Dumbbell',
    title: 'ТРЕНИРОВКИ',
    subtitle: 'Здесь дневник твоих тренировок',
    isPremium: false,
    route: '/workouts',
  },
  {
    id: '7',
    icon: 'BarChart3',
    title: 'ПРОГРЕСС',
    subtitle: 'Здесь дневник твоего прогресса',
    isPremium: false,
    route: '/progress',
  },
];

export function getHomeFeatureCards({ hasPremium }: { hasPremium: boolean }): FeatureCard[] {
  const premiumEntry: FeatureCard = hasPremium
    ? {
        id: '1',
        icon: 'ClipboardList',
        title: 'Мой Поток',
        subtitle: 'Ваше питание, тренировки и рекомендации на сегодня',
        isPremium: false,
        route: '/today',
      }
    : FEATURE_CARDS[0];

  const baseCards = FEATURE_CARDS.slice(1);

  if (!hasPremium) {
    return [premiumEntry, ...baseCards];
  }

  const premiumRecipesEntry: FeatureCard = {
    id: 'premium-recipes',
    icon: 'BookOpen',
    title: 'Сборник рецептов',
    subtitle: 'Готовые рецепты с КБЖУ и граммовками',
    isPremium: false,
    route: '/premium-recipes',
  };

  return [premiumEntry, premiumRecipesEntry, ...baseCards];
}

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  ClipboardList,
  Target,
  Ruler,
  UtensilsCrossed,
  Dumbbell,
  BarChart3,
};
