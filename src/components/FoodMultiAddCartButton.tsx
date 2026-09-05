import { ShoppingBasket } from 'lucide-react';
import { FoodDiaryMultiAddTotals } from '../utils/foodDiaryMultiAdd';

interface FoodMultiAddCartButtonProps {
  count: number;
  totals: FoodDiaryMultiAddTotals;
  onClick: () => void;
}

const FoodMultiAddCartButton = ({ count, totals, onClick }: FoodMultiAddCartButtonProps) => {
  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 max-w-[190px] items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 text-sm font-semibold text-green-700 shadow-sm transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30"
    >
      <ShoppingBasket className="w-4 h-4 flex-shrink-0" />
      <span className="whitespace-nowrap">Выбрано {count}</span>
      <span className="hidden text-[11px] font-medium text-green-600 dark:text-green-400 whitespace-nowrap sm:inline">
        {Math.round(totals.calories)} ккал
      </span>
    </button>
  );
};

export default FoodMultiAddCartButton;
