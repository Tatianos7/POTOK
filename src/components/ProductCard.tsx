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
      className="w-full flex items-center gap-2 min-[376px]:gap-3 p-2 min-[376px]:p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
    >
      {/* Image */}
      <div className="flex-shrink-0 w-12 h-12 min-[376px]:w-16 min-[376px]:h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
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
          <Package className="w-6 h-6 min-[376px]:w-8 min-[376px]:h-8 text-gray-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-xs min-[376px]:text-sm font-semibold text-gray-900 dark:text-white truncate">
          {getFoodDisplayName(food)}
        </h3>
        <div className="flex items-center gap-1.5 min-[376px]:gap-2 flex-wrap mt-1">
          <span className="text-[10px] min-[376px]:text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
            {Math.round(food.calories || 0)}
          </span>
          <span className="text-[10px] min-[376px]:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Б: {(food.protein || 0).toFixed(1)}г
          </span>
          <span className="text-[10px] min-[376px]:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Ж: {(food.fat || 0).toFixed(1)}г
          </span>
          <span className="text-[10px] min-[376px]:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            У: {(food.carbs || 0).toFixed(1)}г
          </span>
        </div>
        {/* Пометка для продуктов из общей базы */}
        {food.source !== 'user' && (
          <p className="text-[9px] min-[376px]:text-[10px] text-gray-400 dark:text-gray-500 mt-1 italic">
            Данные носят справочный характер
          </p>
        )}
      </div>

    </button>
  );
};

export default ProductCard;

