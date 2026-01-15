import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ExerciseCategory } from '../types/workout';

interface ExerciseCategorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExerciseCategory[];
  onCategorySelect: (category: ExerciseCategory) => void;
  onCreateExercise?: () => void;
}

const ExerciseCategorySheet = ({
  isOpen,
  onClose,
  categories,
  onCategorySelect,
  onCreateExercise,
}: ExerciseCategorySheetProps) => {
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

  const handleCategoryClick = (category: ExerciseCategory) => {
    onCategorySelect(category);
    onClose();
  };

  const handleMyExercisesClick = () => {
    // "МОИ УПРАЖНЕНИЯ" - это не категория, а специальная опция
    // Можно обработать отдельно или просто закрыть модальное окно
    if (onCreateExercise) {
      onCreateExercise();
    }
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[60] transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Centered */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 min-[376px]:p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <div className="flex-1"></div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white uppercase flex-1 text-center">
              УПРАЖНЕНИЯ
            </h2>
            <div className="flex-1 flex justify-end">
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="px-4 py-4 overflow-y-auto flex-1">
          {categories.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Категории не найдены
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                Возможно, упражнения еще не импортированы.
              </p>
              <a
                href="/import-exercises"
                className="inline-block px-4 py-2 rounded-lg font-medium text-sm bg-green-500 text-white hover:bg-green-600 transition-colors"
              >
                Импортировать упражнения
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4">
              {/* Первая строка: ПЛЕЧИ, РУКИ, ГРУДЬ */}
              {categories.slice(0, 3).map((category, index) => {
                const isLastInRow = index === 2;
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category)}
                    className={`px-3 min-[376px]:px-4 py-3 min-[376px]:py-4 text-xs min-[376px]:text-sm font-semibold text-gray-900 dark:text-white border-r border-b border-gray-200 dark:border-gray-700 transition-colors bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      isLastInRow ? 'border-r-0' : ''
                    }`}
                  >
                    {category.name.toUpperCase()}
                  </button>
                );
              })}
              
              {/* Вторая строка: СПИНА, НОГИ, ПРЕСС */}
              {categories.slice(3, 6).map((category, index) => {
                const isLastInRow = index === 2;
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category)}
                    className={`px-3 min-[376px]:px-4 py-3 min-[376px]:py-4 text-xs min-[376px]:text-sm font-semibold text-gray-900 dark:text-white border-r border-b border-gray-200 dark:border-gray-700 transition-colors bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      isLastInRow ? 'border-r-0' : ''
                    }`}
                  >
                    {category.name.toUpperCase()}
                  </button>
                );
              })}
              
              {/* Третья строка: КАРДИО (1 колонка), МОИ УПРАЖНЕНИЯ (2 колонки) */}
              {categories.length >= 7 ? (
                <>
                  <button
                    onClick={() => handleCategoryClick(categories[6])}
                    className="px-3 min-[376px]:px-4 py-3 min-[376px]:py-4 text-xs min-[376px]:text-sm font-semibold text-gray-900 dark:text-white border-r border-b-0 border-gray-200 dark:border-gray-700 transition-colors bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {categories[6].name.toUpperCase()}
                  </button>
                  <button
                    onClick={handleMyExercisesClick}
                    className="col-span-2 px-3 min-[376px]:px-4 py-3 min-[376px]:py-4 text-xs min-[376px]:text-sm font-semibold text-gray-900 dark:text-white border-r-0 border-b-0 border-gray-200 dark:border-gray-700 transition-colors bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    МОИ УПРАЖНЕНИЯ
                  </button>
                </>
              ) : (
                // Если категорий меньше 7, показываем только "МОИ УПРАЖНЕНИЯ" на всю ширину
                <button
                  onClick={handleMyExercisesClick}
                  className="col-span-3 px-3 min-[376px]:px-4 py-3 min-[376px]:py-4 text-xs min-[376px]:text-sm font-semibold text-gray-900 dark:text-white border-r-0 border-b-0 border-gray-200 dark:border-gray-700 transition-colors bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  МОИ УПРАЖНЕНИЯ
                </button>
              )}
            </div>
          )}
        </div>

          {/* Action Buttons */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2 flex-shrink-0">
            {onCreateExercise && (
              <button
                onClick={onCreateExercise}
                className="w-full py-3 px-4 rounded-xl font-semibold text-xs min-[376px]:text-sm uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                СОЗДАТЬ УПРАЖНЕНИЕ
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl font-semibold text-xs min-[376px]:text-sm uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              СОХРАНИТЬ
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExerciseCategorySheet;

