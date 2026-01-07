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
      className="w-full max-w-full flex items-start gap-2 min-[376px]:gap-3 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left overflow-hidden"
      style={{ padding: '6px' }}
    >
      {/* Image */}
      <div className="flex-shrink-0 w-12 h-12 min-[376px]:w-16 min-[376px]:h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        {food.photo ? (
          <img
            src={food.photo}
            alt={food.name}
            className="w-full h-full max-w-full max-h-full object-cover"
            style={{ maxWidth: '100%', height: 'auto' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <Package className="w-6 h-6 min-[376px]:w-8 min-[376px]:h-8 text-gray-400 flex-shrink-0" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 max-w-full overflow-hidden">
        <h3 
          className="text-xs min-[376px]:text-sm font-semibold text-gray-900 dark:text-white break-words overflow-wrap-anywhere line-clamp-2"
          style={{ 
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            hyphens: 'auto'
          }}
        >
          {getFoodDisplayName(food)}
        </h3>
        <div className="grid grid-cols-2 mobile-lg:flex mobile-lg:items-center gap-1 min-[376px]:gap-1.5 mobile-lg:flex-wrap mt-1 w-full max-w-full">
          <span className="text-[10px] min-[376px]:text-xs text-gray-600 dark:text-gray-300 shrink-0">
            {Math.round(food.calories || 0)}
          </span>
          <span className="text-[10px] min-[376px]:text-xs text-gray-500 dark:text-gray-400 shrink-0">
            Б: {(food.protein || 0).toFixed(1)}г
          </span>
          <span className="text-[10px] min-[376px]:text-xs text-gray-500 dark:text-gray-400 shrink-0">
            Ж: {(food.fat || 0).toFixed(1)}г
          </span>
          <span className="text-[10px] min-[376px]:text-xs text-gray-500 dark:text-gray-400 shrink-0">
            У: {(food.carbs || 0).toFixed(1)}г
          </span>
        </div>
        {/* Пометка для продуктов из общей базы */}
        {food.source !== 'user' && (
          <p className="text-[9px] min-[376px]:text-[10px] text-gray-400 dark:text-gray-500 mt-1 italic break-words overflow-wrap-anywhere">
            Данные носят справочный характер
          </p>
        )}
      </div>
    </button>
  );
};

export default ProductCard;

