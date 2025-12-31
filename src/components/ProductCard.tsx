import { Food } from '../types';
import { Package } from 'lucide-react';
import { getFoodDisplayName } from '../utils/foodDisplayName';

interface ProductCardProps {
  food: Food;
  onClick: () => void;
}

const ProductCard = ({ food, onClick }: ProductCardProps) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
    >
      {/* Image */}
      <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        {food.photo ? (
          <img
            src={food.photo}
            alt={food.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <Package className="w-8 h-8 text-gray-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {getFoodDisplayName(food)}
        </h3>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {Math.round(food.calories || 0)} ккал
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Б: {(food.protein || 0).toFixed(1)}г
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Ж: {(food.fat || 0).toFixed(1)}г
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            У: {(food.carbs || 0).toFixed(1)}г
          </span>
        </div>
      </div>

    </button>
  );
};

export default ProductCard;

