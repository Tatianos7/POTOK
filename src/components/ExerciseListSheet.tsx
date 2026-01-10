import { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Filter } from 'lucide-react';
import { Exercise, ExerciseCategory, Muscle } from '../types/workout';
import { normalizeMuscleName } from '../utils/muscleNormalizer';

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
  const [selectedMuscles, setSelectedMuscles] = useState<Set<string>>(new Set());
  const [tempSelectedMuscles, setTempSelectedMuscles] = useState<Set<string>>(new Set());
  const [availableMuscles, setAvailableMuscles] = useState<Muscle[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIsFilterOpen(false);
      setTempSelectedMuscles(new Set(selectedMuscles));
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, selectedMuscles]);

  // Инициализируем временные выбранные мышцы при открытии фильтра
  useEffect(() => {
    if (isFilterOpen) {
      setTempSelectedMuscles(new Set(selectedMuscles));
    }
  }, [isFilterOpen, selectedMuscles]);


  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  // Загружаем доступные мышцы для категории с нормализацией
  useEffect(() => {
    const loadMuscles = async () => {
      if (category && exercises.length > 0) {
        // Собираем все мышцы из упражнений этой категории и нормализуем их
        const musclesSet = new Map<string, string>(); // Map: normalizedName -> originalName (для отображения)
        
        exercises.forEach(ex => {
          ex.muscles?.forEach(m => {
            if (m.name) {
              const normalized = normalizeMuscleName(m.name);
              // Сохраняем нормализованное название, используя его как ключ
              if (!musclesSet.has(normalized)) {
                musclesSet.set(normalized, normalized);
              }
            }
          });
        });
        
        // Преобразуем в массив Muscle с нормализованными названиями
        const muscles: Muscle[] = Array.from(musclesSet.values())
          .sort()
          .map(name => ({
            id: name, // Используем нормализованное name как id
            name: name, // Отображаем нормализованное название
          }));
        
        setAvailableMuscles(muscles);
      }
    };
    
    loadMuscles();
  }, [category, exercises]);

  // Фильтруем и дедуплицируем упражнения по поисковому запросу и выбранным мышцам
  const filteredExercises = useMemo(() => {
    // Сначала дедуплицируем упражнения по названию
    const exercisesMap = new Map<string, Exercise>();
    
    exercises.forEach((ex) => {
      const exerciseName = ex.name.trim();
      const hasMuscles = ex.muscles && ex.muscles.length > 0;
      
      if (!exercisesMap.has(exerciseName)) {
        // Если упражнения еще нет, добавляем его
        exercisesMap.set(exerciseName, ex);
      } else {
        // Если упражнение уже есть, проверяем версии
        const existing = exercisesMap.get(exerciseName)!;
        const existingHasMuscles = existing.muscles && existing.muscles.length > 0;
        
        // Приоритет: версия с мышцами > версия без мышц
        if (hasMuscles && !existingHasMuscles) {
          // Заменяем версию без мышц на версию с мышцами
          exercisesMap.set(exerciseName, ex);
        } else if (hasMuscles && existingHasMuscles && existing.muscles && ex.muscles) {
          // Если обе версии с мышцами, объединяем уникальные мышцы
          const existingMuscles = existing.muscles; // TypeScript guard
          const exMuscles = ex.muscles; // TypeScript guard
          if (existingMuscles && exMuscles) {
            const existingMuscleNames = new Set(existingMuscles.map(m => m.name || m.id));
            const newMuscles = exMuscles.filter(m => {
              const key = m.name || m.id;
              return key && !existingMuscleNames.has(key);
            });
            
            if (newMuscles.length > 0) {
              exercisesMap.set(exerciseName, {
                ...existing,
                muscles: [...existingMuscles, ...newMuscles],
              });
            }
          }
        }
        // Если новая версия без мышц, а существующая с мышцами - игнорируем новую
      }
    });

    // Конвертируем Map в массив
    let deduplicated = Array.from(exercisesMap.values());
    
    // Фильтруем упражнения без мышц, если есть версии с мышцами
    const exercisesWithMuscles = deduplicated.filter(ex => ex.muscles && ex.muscles.length > 0);
    if (exercisesWithMuscles.length > 0) {
      deduplicated = exercisesWithMuscles;
    }

    // Фильтр по поисковому запросу
    if (localSearchTerm.trim()) {
      const term = localSearchTerm.toLowerCase();
      deduplicated = deduplicated.filter(ex =>
        ex.name.toLowerCase().includes(term) ||
        ex.muscles?.some(m => (m.name || '').toLowerCase().includes(term))
      );
    }

    // Фильтр по выбранным мышцам (с нормализацией)
    if (selectedMuscles.size > 0) {
      deduplicated = deduplicated.filter(ex => {
        if (!ex.muscles || ex.muscles.length === 0) return false;
        return ex.muscles.some(m => {
          const muscleName = m.name || '';
          const normalized = normalizeMuscleName(muscleName);
          // Проверяем как по исходному, так и по нормализованному названию
          return selectedMuscles.has(muscleName) || selectedMuscles.has(normalized);
        });
      });
    }

    return deduplicated;
  }, [exercises, localSearchTerm, selectedMuscles]);

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

  const handleToggleMuscle = (muscleName: string) => {
    const newSelected = new Set(tempSelectedMuscles);
    if (newSelected.has(muscleName)) {
      newSelected.delete(muscleName);
    } else {
      newSelected.add(muscleName);
    }
    setTempSelectedMuscles(newSelected);
  };

  const handleApplyFilter = () => {
    setSelectedMuscles(new Set(tempSelectedMuscles));
    setIsFilterOpen(false);
  };

  const handleCancelFilter = () => {
    setTempSelectedMuscles(new Set(selectedMuscles));
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    setTempSelectedMuscles(new Set());
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Centered */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 min-[376px]:p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
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
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск упражнений..."
                  value={localSearchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
              
              {/* Filter Button */}
              <div className="relative flex-shrink-0">
                <button
                  data-filter-button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`p-2.5 rounded-xl border-2 transition-colors flex items-center justify-center relative ${
                    selectedMuscles.size > 0
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  aria-label="Фильтр по мышцам"
                  title={selectedMuscles.size > 0 ? `Выбрано мышц: ${selectedMuscles.size}` : 'Фильтр по мышцам'}
                >
                  <Filter className="w-5 h-5" />
                  {selectedMuscles.size > 0 && (
                    <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {selectedMuscles.size}
                    </span>
                  )}
                </button>

                {/* Filter Modal - Centered */}
                {isFilterOpen && (
                  <>
                    {/* Overlay for filter modal */}
                    <div
                      className="fixed inset-0 z-[60] bg-black bg-opacity-30"
                      onClick={handleCancelFilter}
                    />
                    {/* Filter Modal */}
                    <div
                      data-filter-dropdown
                      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-sm max-h-[70vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            Фильтр по мышцам
                          </h3>
                          <button
                            onClick={handleCancelFilter}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            aria-label="Закрыть"
                          >
                            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                          </button>
                        </div>
                        
                        {/* Muscles List */}
                        <div className="overflow-y-auto flex-1 p-3">
                          {availableMuscles.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                              Нет доступных мышц
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {availableMuscles.map((muscle) => {
                                const isSelected = tempSelectedMuscles.has(muscle.name);
                                return (
                                  <button
                                    key={muscle.id}
                                    onClick={() => handleToggleMuscle(muscle.name)}
                                    className={`w-full px-3 py-2.5 text-left rounded-lg transition-colors flex items-center gap-2 ${
                                      isSelected
                                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
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
                                    <span className="text-sm break-words overflow-wrap-anywhere">{muscle.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
                          {tempSelectedMuscles.size > 0 && (
                            <button
                              onClick={handleClearFilters}
                              className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                            >
                              Сбросить фильтры
                            </button>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={handleCancelFilter}
                              className="flex-1 px-4 py-2.5 text-sm font-semibold uppercase bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                              Отмена
                            </button>
                            <button
                              onClick={handleApplyFilter}
                              className="flex-1 px-4 py-2.5 text-sm font-semibold uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                            >
                              ОК
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Exercises List */}
          <div className="overflow-y-auto flex-1">
          {filteredExercises.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {localSearchTerm || selectedMuscles.size > 0
                  ? 'Упражнения не найдены'
                  : 'Нет упражнений в этой категории'}
              </p>
              {(localSearchTerm || selectedMuscles.size > 0) && (
                <button
                  onClick={handleClearFilters}
                  className="mt-3 text-sm text-green-600 dark:text-green-400 hover:underline"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            <div className="px-4 py-2 space-y-2">
              {filteredExercises.map((exercise, index) => {
                const isSelected = selectedExercises.has(exercise.id);
                // Используем первую мышцу для отображения (должна быть, так как мы фильтруем)
                const primaryMuscle = exercise.muscles && exercise.muscles.length > 0 
                  ? exercise.muscles[0].name || ''
                  : '';
                
                // Используем уникальный key: название + id + индекс для избежания конфликтов
                const uniqueKey = `${exercise.name}-${exercise.id}-${index}`;

                return (
                  <button
                    key={uniqueKey}
                    onClick={() => handleToggleExercise(exercise.id)}
                    className={`w-full px-3 min-[376px]:px-4 py-2.5 min-[376px]:py-3 text-left rounded-xl transition-colors flex items-start gap-2 min-[376px]:gap-3 ${
                      isSelected
                        ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-5 h-5 min-[376px]:w-6 min-[376px]:h-6 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 min-[376px]:w-4 min-[376px]:h-4 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white break-words overflow-wrap-anywhere">
                        {exercise.name}
                        {primaryMuscle && (
                          <span className="text-gray-500 dark:text-gray-400"> — {primaryMuscle}</span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

          {/* Footer with Select Button */}
          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
            <button
              onClick={handleSelect}
              disabled={selectedExercises.size === 0}
              className="w-full py-3 min-[376px]:py-4 px-4 rounded-xl font-semibold text-sm min-[376px]:text-base uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Далее</span>
              {selectedExercises.size > 0 && (
                <span className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-full px-2 py-0.5 text-xs font-bold">
                  {selectedExercises.size}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExerciseListSheet;

