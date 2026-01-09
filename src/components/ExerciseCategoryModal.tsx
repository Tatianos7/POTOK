import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ExerciseCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategorySelect: (category: string) => void;
  onCreateExercise: () => void;
}

const ExerciseCategoryModal = ({ 
  isOpen, 
  onClose, 
  onCategorySelect,
  onCreateExercise 
}: ExerciseCategoryModalProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = [
    'ПЛЕЧИ',
    'РУКИ',
    'ГРУДЬ',
    'СПИНА',
    'НОГИ',
    'ПРЕСС',
    'КАРДИО',
    'МОИ УПРАЖНЕНИЯ',
  ];

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    onCategorySelect(category);
  };

  const handleSave = () => {
    if (selectedCategory) {
      onCategorySelect(selectedCategory);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 min-[376px]:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-[calc(100vw-16px)] min-[376px]:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <header className="px-2 min-[376px]:px-4 py-3 min-[376px]:py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10 w-full max-w-full overflow-hidden">
          <div className="flex-1"></div>
          <h1 className="text-base min-[376px]:text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase whitespace-nowrap">
            УПРАЖНЕНИЯ
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5 min-[376px]:w-6 min-[376px]:h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        {/* Categories Grid */}
        <div className="px-2 min-[376px]:px-4 py-4 min-[376px]:py-6 w-full max-w-full overflow-hidden">
          <div className="grid grid-cols-3 gap-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4 min-[376px]:mb-6">
            {/* Первая строка: ПЛЕЧИ, РУКИ, ГРУДЬ */}
            {categories.slice(0, 3).map((category, index) => {
              const isLastInRow = index === 2;
              const isSelected = selectedCategory === category;
              
              return (
                <button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className={`
                    px-3 min-[376px]:px-4 py-3 min-[376px]:py-4 
                    text-xs min-[376px]:text-sm font-semibold 
                    text-gray-900 dark:text-white 
                    border-r border-b border-gray-200 dark:border-gray-700
                    transition-colors
                    ${isLastInRow ? 'border-r-0' : ''}
                    ${isSelected 
                      ? 'bg-gray-100 dark:bg-gray-800' 
                      : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }
                    whitespace-nowrap
                  `}
                >
                  {category}
                </button>
              );
            })}
            
            {/* Вторая строка: СПИНА, НОГИ, ПРЕСС */}
            {categories.slice(3, 6).map((category, index) => {
              const isLastInRow = index === 2;
              const isSelected = selectedCategory === category;
              
              return (
                <button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className={`
                    px-3 min-[376px]:px-4 py-3 min-[376px]:py-4 
                    text-xs min-[376px]:text-sm font-semibold 
                    text-gray-900 dark:text-white 
                    border-r border-b border-gray-200 dark:border-gray-700
                    transition-colors
                    ${isLastInRow ? 'border-r-0' : ''}
                    ${isSelected 
                      ? 'bg-gray-100 dark:bg-gray-800' 
                      : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }
                    whitespace-nowrap
                  `}
                >
                  {category}
                </button>
              );
            })}
            
            {/* Третья строка: КАРДИО (1 колонка), МОИ УПРАЖНЕНИЯ (2 колонки) */}
            <button
              onClick={() => handleCategoryClick(categories[6])}
              className={`
                px-3 min-[376px]:px-4 py-3 min-[376px]:py-4 
                text-xs min-[376px]:text-sm font-semibold 
                text-gray-900 dark:text-white 
                border-r border-b-0 border-gray-200 dark:border-gray-700
                transition-colors
                ${selectedCategory === categories[6]
                  ? 'bg-gray-100 dark:bg-gray-800' 
                  : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                }
                whitespace-nowrap
              `}
            >
              {categories[6]}
            </button>
            <button
              onClick={() => handleCategoryClick(categories[7])}
              className={`
                col-span-2
                px-3 min-[376px]:px-4 py-3 min-[376px]:py-4 
                text-xs min-[376px]:text-sm font-semibold 
                text-gray-900 dark:text-white 
                border-r-0 border-b-0 border-gray-200 dark:border-gray-700
                transition-colors
                ${selectedCategory === categories[7]
                  ? 'bg-gray-100 dark:bg-gray-800' 
                  : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                }
                whitespace-nowrap
              `}
            >
              {categories[7]}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 min-[376px]:space-y-3 w-full max-w-full">
            <button
              onClick={onCreateExercise}
              className="w-full max-w-full min-[768px]:button-limited px-3 min-[376px]:px-4 py-2.5 min-[376px]:py-3 rounded-xl font-semibold text-xs min-[376px]:text-sm uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              style={{ boxSizing: 'border-box' }}
            >
              СОЗДАТЬ УПРАЖНЕНИЕ
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedCategory}
              className="w-full max-w-full min-[768px]:button-limited px-3 min-[376px]:px-4 py-2.5 min-[376px]:py-3 rounded-xl font-semibold text-xs min-[376px]:text-sm uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxSizing: 'border-box' }}
            >
              СОХРАНИТЬ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseCategoryModal;

