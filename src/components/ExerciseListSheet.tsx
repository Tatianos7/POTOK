import { useState, useEffect, useMemo, type MouseEvent } from 'react';
import { Archive, RotateCcw, X, Search, Check, Filter, Edit } from 'lucide-react';
import { Exercise, ExerciseCategory } from '../types/workout';
import { deriveAvailableMuscles, filterExercisesForList } from '../utils/exerciseListFilters';
import { dedupeExercisesForUi } from '../utils/exerciseDedup';
import { getExerciseContentForExercise } from '../utils/exerciseContentLookup';
import { getMuscleLabel } from '../utils/muscleLabels';
import ExerciseDefinitionSheet from './ExerciseDefinitionSheet';
import { exerciseService } from '../services/exerciseService';

interface ExerciseListSheetProps {
  isOpen: boolean;
  onClose: () => void;
  category: ExerciseCategory | null;
  exercises: Exercise[];
  onExercisesSelect: (exercises: Exercise[]) => void;
  onEditExercise?: (exercise: Exercise) => void;
  onArchiveExercise?: (exercise: Exercise) => Promise<void> | void;
  onRestoreExercise?: (exercise: Exercise) => Promise<void> | void;
  customExerciseView?: 'active' | 'archived';
  onCustomExerciseViewChange?: (view: 'active' | 'archived') => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export const toggleExerciseSelection = (selected: Set<string>, exerciseId: string) => {
  const next = new Set(selected);
  if (next.has(exerciseId)) {
    next.delete(exerciseId);
  } else {
    next.add(exerciseId);
  }
  return next;
};

export const addExerciseSelectionFromCard = (selected: Set<string>, exerciseId: string) => {
  if (selected.has(exerciseId)) {
    return new Set(selected);
  }

  const next = new Set(selected);
  next.add(exerciseId);
  return next;
};

export const removeExerciseSelection = (selected: Set<string>, exerciseId: string) => {
  const next = new Set(selected);
  next.delete(exerciseId);
  return next;
};

export function dedupeExercisesForList(exercises: Exercise[]) {
  return dedupeExercisesForUi(exercises);
}

export function getExerciseMusclesForList(exercise: Exercise) {
  const content = getExerciseContentForExercise({
    id: exercise.id,
    exercise_id: exercise.canonical_exercise_id ?? null,
    canonical_exercise_id: exercise.canonical_exercise_id ?? null,
    name: exercise.name,
    normalized_name: exercise.normalized_name ?? null,
  });

  const primaryMuscles = content?.primary_muscles
    ?.map((muscleKey) => getMuscleLabel(muscleKey))
    .filter((label): label is string => Boolean(label?.trim()));

  if (primaryMuscles?.length) {
    return primaryMuscles.join(', ');
  }

  return (exercise.muscles ?? [])
    .map((muscle) => muscle.name)
    .filter((name): name is string => Boolean(name?.trim()))
    .join(', ');
}

export function buildClearedExerciseListFilterState() {
  return {
    localSearchTerm: '',
    selectedMuscles: new Set<string>(),
    tempSelectedMuscles: new Set<string>(),
    isFilterOpen: false,
  };
}

const ExerciseListSheet = ({
  isOpen,
  onClose,
  category,
  exercises,
  onExercisesSelect,
  onEditExercise,
  onArchiveExercise,
  onRestoreExercise,
  customExerciseView,
  onCustomExerciseViewChange,
  searchTerm = '',
  onSearchChange,
}: ExerciseListSheetProps) => {
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [selectedMuscles, setSelectedMuscles] = useState<Set<string>>(new Set());
  const [tempSelectedMuscles, setTempSelectedMuscles] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [activeExerciseDefinition, setActiveExerciseDefinition] = useState<Exercise | null>(null);
  const [isDefinitionLoading, setIsDefinitionLoading] = useState(false);
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [exercisePendingArchive, setExercisePendingArchive] = useState<Exercise | null>(null);
  const [isArchivingExercise, setIsArchivingExercise] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [restoringExerciseId, setRestoringExerciseId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const isArchivedCustomView = customExerciseView === 'archived';
  const showCustomExerciseTabs = Boolean(customExerciseView && onCustomExerciseViewChange);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      const clearedFilters = buildClearedExerciseListFilterState();
      document.body.style.overflow = '';
      setIsFilterOpen(clearedFilters.isFilterOpen);
      setLocalSearchTerm(clearedFilters.localSearchTerm);
      setSelectedMuscles(clearedFilters.selectedMuscles);
      setTempSelectedMuscles(clearedFilters.tempSelectedMuscles);
      setActiveExercise(null);
      setActiveExerciseDefinition(null);
      setDefinitionError(null);
      setIsDefinitionLoading(false);
      setExercisePendingArchive(null);
      setIsArchivingExercise(false);
      setArchiveError(null);
      setRestoringExerciseId(null);
      setRestoreError(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Инициализируем временные выбранные мышцы при открытии фильтра
  useEffect(() => {
    if (isFilterOpen) {
      setTempSelectedMuscles(new Set(selectedMuscles));
    }
  }, [isFilterOpen, selectedMuscles]);


  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);
  const availableMuscles = useMemo(() => deriveAvailableMuscles(exercises, category), [category, exercises]);

  // Фильтруем и дедуплицируем упражнения по поисковому запросу и выбранным мышцам
  const filteredExercises = useMemo(
    () => dedupeExercisesForList(filterExercisesForList(exercises, localSearchTerm, selectedMuscles, category)),
    [category, exercises, localSearchTerm, selectedMuscles],
  );

  const handleToggleExercise = (exerciseId: string) => {
    if (isArchivedCustomView) return;
    setSelectedExercises((current) => toggleExerciseSelection(current, exerciseId));
  };

  const handleEditExercise = (event: MouseEvent, exercise: Exercise) => {
    event.stopPropagation();
    onEditExercise?.(exercise);
  };

  const handleRequestArchiveExercise = (event: MouseEvent, exercise: Exercise) => {
    event.stopPropagation();
    setArchiveError(null);
    setExercisePendingArchive(exercise);
  };

  const handleRestoreExercise = async (event: MouseEvent, exercise: Exercise) => {
    event.stopPropagation();
    if (!onRestoreExercise || restoringExerciseId) return;

    setRestoreError(null);
    setRestoringExerciseId(exercise.id);

    try {
      await onRestoreExercise(exercise);
      setSelectedExercises((current) => removeExerciseSelection(current, exercise.id));
      if (activeExercise?.id === exercise.id) {
        handleCloseExerciseCard();
      }
    } catch (error: any) {
      setRestoreError(error?.message || 'Не удалось восстановить упражнение');
    } finally {
      setRestoringExerciseId(null);
    }
  };

  const handleCancelArchiveExercise = () => {
    if (isArchivingExercise) return;
    setExercisePendingArchive(null);
    setArchiveError(null);
  };

  const handleConfirmArchiveExercise = async () => {
    if (!exercisePendingArchive || !onArchiveExercise || isArchivingExercise) return;

    setIsArchivingExercise(true);
    setArchiveError(null);

    try {
      await onArchiveExercise(exercisePendingArchive);
      setSelectedExercises((current) => removeExerciseSelection(current, exercisePendingArchive.id));
      if (activeExercise?.id === exercisePendingArchive.id) {
        handleCloseExerciseCard();
      }
      setExercisePendingArchive(null);
    } catch (error: any) {
      setArchiveError(error?.message || 'Не удалось архивировать упражнение');
    } finally {
      setIsArchivingExercise(false);
    }
  };

  const handleOpenExerciseCard = async (exercise: Exercise) => {
    setActiveExercise(exercise);
    setActiveExerciseDefinition(exercise);
    setDefinitionError(null);
    setIsDefinitionLoading(true);

    try {
      const definition = await exerciseService.getExerciseDefinitionCard(exercise.id);
      setActiveExerciseDefinition(definition ?? exercise);
    } catch (error: any) {
      console.error('Ошибка загрузки карточки упражнения:', error);
      setDefinitionError(error?.message || 'Не удалось загрузить карточку упражнения');
      setActiveExerciseDefinition(exercise);
    } finally {
      setIsDefinitionLoading(false);
    }
  };

  const handleSelect = () => {
    const selected = exercises.filter(ex => selectedExercises.has(ex.id) && !ex.archived_at);
    onExercisesSelect(selected);
    setSelectedExercises(new Set());
    setLocalSearchTerm('');
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

  const handleClearTempMuscleFilters = () => {
    setTempSelectedMuscles(new Set());
  };

  const handleClearAppliedFilters = () => {
    const clearedFilters = buildClearedExerciseListFilterState();
    setLocalSearchTerm(clearedFilters.localSearchTerm);
    setSelectedMuscles(clearedFilters.selectedMuscles);
    setTempSelectedMuscles(clearedFilters.tempSelectedMuscles);
    setIsFilterOpen(clearedFilters.isFilterOpen);
    onSearchChange?.(clearedFilters.localSearchTerm);
  };

  const handleCloseExerciseCard = () => {
    setActiveExercise(null);
    setActiveExerciseDefinition(null);
    setDefinitionError(null);
    setIsDefinitionLoading(false);
  };

  const handleAddToWorkoutFromCard = () => {
    if (!activeExercise) return;
    if (activeExercise.archived_at) {
      handleCloseExerciseCard();
      return;
    }
    if (!selectedExercises.has(activeExercise.id)) {
      setSelectedExercises((current) => addExerciseSelectionFromCard(current, activeExercise.id));
    }
    handleCloseExerciseCard();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[70] transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Centered */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 min-[376px]:p-4">
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

          {showCustomExerciseTabs && (
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                {(['active', 'archived'] as const).map((view) => {
                  const isActive = customExerciseView === view;
                  return (
                    <button
                      key={view}
                      type="button"
                      onClick={() => {
                        setSelectedExercises(new Set());
                        setRestoreError(null);
                        setArchiveError(null);
                        onCustomExerciseViewChange?.(view);
                      }}
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                          : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                      }`}
                    >
                      {view === 'active' ? 'Активные' : 'Архивные'}
                    </button>
                  );
                })}
              </div>
              {restoreError && (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {restoreError}
                </p>
              )}
            </div>
          )}

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
                              onClick={handleClearTempMuscleFilters}
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
                  : isArchivedCustomView
                    ? 'Архивных упражнений пока нет'
                    : 'Нет упражнений в этой категории'}
              </p>
              {(localSearchTerm || selectedMuscles.size > 0) && (
                <button
                  onClick={handleClearAppliedFilters}
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
                const exerciseMuscles = getExerciseMusclesForList(exercise);
                const isExerciseArchived = Boolean(exercise.archived_at);
                
                // Используем уникальный key: название + id + индекс для избежания конфликтов
                const uniqueKey = `${exercise.name}-${exercise.id}-${index}`;

                return (
                  <div
                    key={uniqueKey}
                    className={`w-full px-3 min-[376px]:px-4 py-2.5 min-[376px]:py-3 text-left rounded-xl transition-colors flex items-start gap-2 min-[376px]:gap-3 ${
                      isSelected
                        ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                        : isExerciseArchived
                          ? 'bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'
                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                    }`}
                  >
                    {isExerciseArchived ? (
                      <div
                        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-gray-300 text-gray-400 min-[376px]:h-6 min-[376px]:w-6 dark:border-gray-600 dark:text-gray-500"
                        title="Архивное упражнение нельзя добавить до восстановления"
                      >
                        <Archive className="w-3 h-3 min-[376px]:w-4 min-[376px]:h-4" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleExercise(exercise.id)}
                        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 min-[376px]:h-6 min-[376px]:w-6 ${
                          isSelected
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                        aria-label={`${isSelected ? 'Убрать' : 'Выбрать'} ${exercise.name}`}
                        aria-pressed={isSelected}
                      >
                        {isSelected && <Check className="w-3 h-3 min-[376px]:w-4 min-[376px]:h-4 text-white" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleOpenExerciseCard(exercise)}
                      className="flex-1 min-w-0 text-left"
                      aria-label={`Открыть карточку упражнения ${exercise.name}`}
                    >
                      <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white break-words overflow-wrap-anywhere">
                        {exercise.name}
                      </p>
                      {exerciseMuscles && (
                        <p className="mt-1 text-xs min-[376px]:text-sm leading-5 text-gray-500 dark:text-gray-400 break-words overflow-wrap-anywhere">
                          {exerciseMuscles}
                        </p>
                      )}
                    </button>
                    {exercise.is_custom && (onEditExercise || onArchiveExercise || onRestoreExercise) && (
                      <div className="flex flex-shrink-0 flex-col items-center gap-1">
                        {!isExerciseArchived && onEditExercise && (
                          <button
                            type="button"
                            onClick={(event) => handleEditExercise(event, exercise)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900/60 dark:hover:text-white"
                            aria-label={`Редактировать ${exercise.name}`}
                            title="Редактировать упражнение"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {!isExerciseArchived && onArchiveExercise && (
                          <button
                            type="button"
                            onClick={(event) => handleRequestArchiveExercise(event, exercise)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                            aria-label={`Архивировать ${exercise.name}`}
                            title="Архивировать упражнение"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                        {isExerciseArchived && onRestoreExercise && (
                          <button
                            type="button"
                            onClick={(event) => handleRestoreExercise(event, exercise)}
                            disabled={restoringExerciseId === exercise.id}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-green-50 hover:text-green-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-green-950/30 dark:hover:text-green-300"
                            aria-label={`Восстановить ${exercise.name}`}
                            title="Восстановить упражнение"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

          {/* Footer with Select Button */}
          {!isArchivedCustomView && (
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
          )}
        </div>
      </div>

      <ExerciseDefinitionSheet
        isOpen={activeExercise !== null}
        exercise={activeExerciseDefinition}
        isLoading={isDefinitionLoading}
        error={definitionError}
        isSelected={activeExercise ? selectedExercises.has(activeExercise.id) : false}
        canAddToWorkout={!activeExercise?.archived_at}
        addToWorkoutDisabledLabel="Сначала восстановите"
        onClose={handleCloseExerciseCard}
        onAddToWorkout={handleAddToWorkoutFromCard}
      />

      {exercisePendingArchive && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-2xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Архивировать упражнение?
            </h3>
            <p className="mt-2 text-sm leading-5 text-gray-600 dark:text-gray-300">
              Упражнение исчезнет из списка "Мои упражнения" и выбора для новых тренировок. История тренировок и медиа останутся доступны.
            </p>
            {archiveError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {archiveError}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleCancelArchiveExercise}
                disabled={isArchivingExercise}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold uppercase text-gray-900 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmArchiveExercise}
                disabled={isArchivingExercise}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold uppercase text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isArchivingExercise ? 'Архивация...' : 'Архивировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExerciseListSheet;
