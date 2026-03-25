import { Food } from '../types';

interface FoodSourceBadgeProps {
  food: Pick<Food, 'source'>;
  className?: string;
}

const badgeBySource: Partial<Record<Food['source'], string>> = {
  user: 'Мой',
  brand: 'Бренд',
};

const colorBySource: Partial<Record<Food['source'], string>> = {
  user: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/70',
  brand: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-700',
};

const FoodSourceBadge = ({ food, className = '' }: FoodSourceBadgeProps) => {
  const label = badgeBySource[food.source];
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ring-1 ring-inset ${colorBySource[food.source]} ${className}`.trim()}
    >
      {label}
    </span>
  );
};

export default FoodSourceBadge;
