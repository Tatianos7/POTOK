import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { getRecommendedFiltersByGoal, isRecommendedFilter } from '../utils/recipeFilterRecommendations';

export type RecipeTypeFilter = 'all' | 'protein' | 'carbs' | 'keto' | 'vegetarian' | 'fish';
export type RecipeGoalFilter = 'all' | 'cutting' | 'bulking' | 'maintenance';

interface RecipeFilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  typeFilter: RecipeTypeFilter;
  goalFilter: RecipeGoalFilter;
  onTypeFilterChange: (filter: RecipeTypeFilter) => void;
  onGoalFilterChange: (filter: RecipeGoalFilter) => void;
  onReset: () => void;
  userGoal?: string;
  onApplyRecommendation?: () => void;
}

const typeFilterOptions: Array<{ value: RecipeTypeFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'protein', label: 'Белковые' },
  { value: 'carbs', label: 'Углеводные' },
  { value: 'keto', label: 'Жировые (кето)' },
  { value: 'vegetarian', label: 'Вегетарианские' },
  { value: 'fish', label: 'Рыба' },
];

const goalFilterOptions: Array<{ value: RecipeGoalFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'cutting', label: 'Сушка' },
  { value: 'bulking', label: 'Набор' },
  { value: 'maintenance', label: 'Поддержание' },
];

const RecipeFilterDropdown = ({
  isOpen,
  onClose,
  anchorEl,
  typeFilter,
  goalFilter,
  onTypeFilterChange,
  onGoalFilterChange,
  onReset,
  userGoal,
  onApplyRecommendation,
}: RecipeFilterDropdownProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Получаем рекомендации на основе цели пользователя
  const recommendation = getRecommendedFiltersByGoal(userGoal);
  const hasRecommendation = !!(recommendation.typeFilter || recommendation.goalFilter);
  const isCurrentlyRecommended = isRecommendedFilter(typeFilter, goalFilter, userGoal);
  
  // Отладка (можно убрать после проверки)
  useEffect(() => {
    if (isOpen && userGoal) {
      console.log('[RecipeFilterDropdown] User goal:', userGoal);
      console.log('[RecipeFilterDropdown] Recommendation:', recommendation);
      console.log('[RecipeFilterDropdown] Has recommendation:', hasRecommendation);
    }
  }, [isOpen, userGoal, recommendation, hasRecommendation]);

  // Закрытие по клику вне меню
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorEl &&
        !anchorEl.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorEl]);

  if (!isOpen || !anchorEl) return null;

  // Позиционирование меню относительно кнопки
  const rect = anchorEl.getBoundingClientRect();
  const positionStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    right: `${window.innerWidth - rect.right}px`,
    zIndex: 1000,
    minWidth: '256px', // w-64 = 256px
  };

  const hasActiveFilters = typeFilter !== 'all' || goalFilter !== 'all';

  return (
    <>
      {/* Overlay для затемнения фона (опционально) */}
      <div
        className="fixed inset-0 z-[999]"
        onClick={onClose}
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
      />

      {/* Dropdown Menu */}
      <div
        ref={dropdownRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-64 max-h-[80vh] overflow-y-auto"
        style={positionStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Фильтр рецептов</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Кнопка применения рекомендации */}
        {hasRecommendation && !isCurrentlyRecommended && onApplyRecommendation && (
          <div className="p-[10px] border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                if (recommendation.typeFilter) {
                  onTypeFilterChange(recommendation.typeFilter);
                }
                if (recommendation.goalFilter) {
                  onGoalFilterChange(recommendation.goalFilter);
                }
                onApplyRecommendation();
              }}
              className="w-full text-sm font-medium text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <span>🎯</span>
              <span>Применить рекомендованный фильтр под вашу цель</span>
            </button>
          </div>
        )}

        {/* Тип рецепта */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
            🔹 Тип рецепта
          </div>
          <div className="space-y-1">
            {typeFilterOptions.map((option) => {
              const isRecommended = recommendation.typeFilter === option.value;
              const isActive = typeFilter === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    onTypeFilterChange(option.value);
                    // Не закрываем меню при выборе фильтра
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-green-500 text-white font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span>
                      {isActive ? '✓ ' : '□ '}
                      {option.label}
                    </span>
                    {isRecommended && !isActive && (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                        Рекомендуем
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Цель */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
            🎯 Цель
          </div>
          <div className="space-y-1">
            {goalFilterOptions.map((option) => {
              const isRecommended = recommendation.goalFilter === option.value;
              const isActive = goalFilter === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    onGoalFilterChange(option.value);
                    // Не закрываем меню при выборе фильтра
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-green-500 text-white font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span>
                      {isActive ? '✓ ' : '□ '}
                      {option.label}
                    </span>
                    {isRecommended && !isActive && (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                        Рекомендуем
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Кнопка сброса */}
        {hasActiveFilters && (
          <div className="p-3">
            <button
              onClick={() => {
                onReset();
                onClose();
              }}
              className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default RecipeFilterDropdown;

