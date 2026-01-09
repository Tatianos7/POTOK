import { useState, useEffect, useMemo } from 'react';
import { X, Search, Check } from 'lucide-react';
import { Exercise, ExerciseCategory } from '../types/workout';

interface ExerciseListSheetProps {
  isOpen: boolean;
  onClose: () => void;
  category: ExerciseCategory | null;
  exercises: Exercise[];
  onExercisesSelect: (exercises: Exercise[]) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

const ExerciseListSheet = ({
  isOpen,
  onClose,
  category,
  exercises,
  onExercisesSelect,
  searchTerm = '',
  onSearchChange,
}: ExerciseListSheetProps) => {
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

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

  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  // Фильтруем упражнения по поисковому запросу
  const filteredExercises = useMemo(() => {
    if (!localSearchTerm.trim()) {
      return exercises;
    }
    const term = localSearchTerm.toLowerCase();
    return exercises.filter(ex =>
      ex.name.toLowerCase().includes(term) ||
      ex.muscles?.some(m => m.name.toLowerCase().includes(term))
    );
  }, [exercises, localSearchTerm]);

  const handleToggleExercise = (exerciseId: string) => {
    const newSelected = new Set(selectedExercises);
    if (newSelected.has(exerciseId)) {
      newSelected.delete(exerciseId);
    } else {
      newSelected.add(exerciseId);
    }
    setSelectedExercises(newSelected);
  };

  const handleSelect = () => {
    const selected = exercises.filter(ex => selectedExercises.has(ex.id));
    onExercisesSelect(selected);
    setSelectedExercises(new Set());
    setLocalSearchTerm('');
    onClose();
  };

  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl transform transition-transform duration-300 ease-out max-w-[768px] mx-auto overflow-hidden"
        style={{
          maxHeight: '90vh',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white uppercase">
              {category?.name || 'Упражнения'}
            </h2>
            {selectedExercises.size > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Выбрано: {selectedExercises.size}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ml-2"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск упражнений..."
              value={localSearchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>
        </div>

        {/* Exercises List */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {filteredExercises.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {localSearchTerm ? 'Упражнения не найдены' : 'Нет упражнений в этой категории'}
              </p>
            </div>
          ) : (
            <div className="px-4 py-2 space-y-2">
              {filteredExercises.map((exercise) => {
                const isSelected = selectedExercises.has(exercise.id);
                const primaryMuscle = exercise.muscles?.[0]?.name || '';

                return (
                  <button
                    key={exercise.id}
                    onClick={() => handleToggleExercise(exercise.id)}
                    className={`w-full px-4 py-3 text-left rounded-xl transition-colors flex items-center gap-3 ${
                      isSelected
                        ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {exercise.name}
                      </p>
                      {primaryMuscle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                          {primaryMuscle}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Select Button */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <button
            onClick={handleSelect}
            disabled={selectedExercises.size === 0}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Выбрать ({selectedExercises.size})
          </button>
        </div>
      </div>
    </>
  );
};

export default ExerciseListSheet;

