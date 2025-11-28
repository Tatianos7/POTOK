import { FeatureCard } from '../types';
import { 
  ClipboardList, 
  Target, 
  Ruler, 
  UtensilsCrossed, 
  Dumbbell, 
  CheckSquare, 
  BarChart3 
} from 'lucide-react';

export const FEATURE_CARDS: FeatureCard[] = [
  {
    id: '1',
    icon: 'ClipboardList',
    title: 'План тренировок и питания',
    subtitle: 'Здесь курсы по тренировкам и питанию',
    isPremium: false,
    route: '/plans',
  },
  {
    id: '2',
    icon: 'Target',
    title: 'ЦЕЛЬ',
    subtitle: 'Создай свою цель',
    isPremium: false,
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
    isPremium: true,
    premiumColor: 'green',
    route: '/workouts',
  },
  {
    id: '6',
    icon: 'CheckSquare',
    title: 'ПРИВЫЧКИ',
    subtitle: 'Здесь твой трекер-привычек',
    isPremium: true,
    premiumColor: 'yellow',
    route: '/habits',
  },
  {
    id: '7',
    icon: 'BarChart3',
    title: 'ПРОГРЕСС',
    subtitle: 'Здесь дневник твоего прогресса',
    isPremium: true,
    premiumColor: 'yellow',
    route: '/progress',
  },
];

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardList,
  Target,
  Ruler,
  UtensilsCrossed,
  Dumbbell,
  CheckSquare,
  BarChart3,
};

