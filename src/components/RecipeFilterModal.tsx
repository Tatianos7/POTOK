import { X } from 'lucide-react';

export type RecipeFilter = 'all' | 'protein' | 'carbs' | 'keto' | 'vegetarian' | 'fish';

interface RecipeFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilter: RecipeFilter;
  onFilterChange: (filter: RecipeFilter) => void;
}

const filterOptions: Array<{ value: RecipeFilter; label: string }> = [
  { value: 'all', label: 'Все рецепты' },
  { value: 'protein', label: 'Белковые' },
  { value: 'carbs', label: 'Углеводные' },
  { value: 'keto', label: 'Жировые (кето)' },
  { value: 'vegetarian', label: 'Вегетарианские' },
  { value: 'fish', label: 'Рыба' },
];

const RecipeFilterModal = ({ isOpen, onClose, activeFilter, onFilterChange }: RecipeFilterModalProps) => {
  if (!isOpen) return null;

  const handleFilterSelect = (filter: RecipeFilter) => {
    onFilterChange(filter);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Фильтр рецептов
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Filter Options */}
        <div className="p-4 space-y-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleFilterSelect(option.value)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                activeFilter === option.value
                  ? 'bg-green-500 text-white font-medium'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecipeFilterModal;

