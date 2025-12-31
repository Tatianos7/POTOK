import { RecipeBadge as BadgeType } from '../utils/recipeBadges';

interface RecipeBadgeProps {
  badge: BadgeType;
  size?: 'sm' | 'md';
}

const badgeColors: Record<BadgeType['type'], string> = {
  protein: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  carbs: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
  keto: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  vegetarian: 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300 border-lime-300 dark:border-lime-700',
  fish: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700',
  cutting: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
  bulking: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
  maintenance: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
};

const RecipeBadge = ({ badge, size = 'sm' }: RecipeBadgeProps) => {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';
  
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-medium ${badgeColors[badge.type]} ${sizeClasses}`}
    >
      <span>{badge.emoji}</span>
      <span>{badge.label}</span>
    </span>
  );
};

export default RecipeBadge;

