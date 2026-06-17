import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ExerciseCategory, Muscle, CreateExerciseData, Exercise } from '../types/workout';
import { exerciseService } from '../services/exerciseService';
import { muscleLabels } from '../data/muscles/muscleLabels';
import { normalizeMuscleName } from '../utils/muscleNormalizer';
import type { CreateExerciseModalCloseReason } from '../utils/workoutAddFlowNavigation';

export const FULL_BODY_CATEGORY_NAME = 'Все тело';

interface CreateExerciseModalProps {
  isOpen: boolean;
  onClose: (reason?: CreateExerciseModalCloseReason) => void;
  onExerciseSaved: () => Promise<void> | void;
  userId: string;
  mode?: 'create' | 'edit';
  initialExercise?: Exercise | null;
}

function normalizeTargetMuscleOptionLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[—–−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ');
}

const HIDDEN_TARGET_MUSCLE_OPTION_LABELS = [
  'Брахиалис',
  'Большая ягодичная',
  'Грудь',
  'Грудь- верх',
  'Грудь- низ',
  'Грудь- середина',
  'Грудь — верх',
  'Грудь — низ',
  'Грудь — середина',
  'Грудь (верх)',
  'Грудь (низ)',
  'Грудь (середина)',
  'Верхний пучок',
  'Средний пучок',
  'Нижний пучок',
  'Икроножные',
  'Кор',
  'Косая',
  'Косые',
  'Косые мышцы',
  'Малая ягодичная',
  'Нижний кор',
  'Поперечная',
  'Поперечные',
  'Приводящие мышцы',
  'Прямая',
  'Прямая - верх',
  'Прямая - низ',
  'Прямая — верх',
  'Прямая — низ',
  'Прямая (верхняя часть)',
  'Прямая (нижняя часть)',
  'Прямая мышца - верх',
  'Прямая мышца - низ',
  'Прямая мышца живота',
  'Прямая мышца живота - верх',
  'Прямая мышца живота - низ',
  'Прямая мышца живота-верх',
  'Прямая мышца живота-низ',
  'Средняя ягодичная',
  'Ягодицы-большая',
  'Ягодицы-малая',
  'Ягодицы-средняя',
  'Ягодичная',
  'Ягодичная - большая',
  'Ягодичная - средняя',
  'Ягодичная - малая',
];

const TARGET_MUSCLE_OPTION_LABEL_OVERRIDES = [
  ['Грудь', muscleLabels.chest],
  ['chest', muscleLabels.chest],
  [muscleLabels.chest, muscleLabels.chest],
  ['Косые', muscleLabels.obliques],
  ['Косая', muscleLabels.obliques],
  ['Косые мышцы', muscleLabels.obliques],
  [muscleLabels.obliques, muscleLabels.obliques],
  ['Отводящие мышцы', muscleLabels.abductors],
  ['abductors', muscleLabels.abductors],
  ['hip_abductors', muscleLabels.abductors],
  [muscleLabels.abductors, muscleLabels.abductors],
  ['Большая ягодичная', muscleLabels.glutes],
  ['Малая ягодичная', muscleLabels.glutes],
  ['Средняя ягодичная', muscleLabels.glutes],
  ['Ягодицы', muscleLabels.glutes],
  ['Ягодицы-большая', muscleLabels.glutes],
  ['Ягодицы-малая', muscleLabels.glutes],
  ['Ягодицы-средняя', muscleLabels.glutes],
  ['Ягодицы - большая', muscleLabels.glutes],
  ['Ягодицы - средняя', muscleLabels.glutes],
  ['Ягодицы - малая', muscleLabels.glutes],
  ['Ягодицы — большая', muscleLabels.glutes],
  ['Ягодицы — средняя', muscleLabels.glutes],
  ['Ягодицы — малая', muscleLabels.glutes],
  ['Ягодичная', muscleLabels.glutes],
  ['Ягодичная - большая', muscleLabels.glutes],
  ['Ягодичная - средняя', muscleLabels.glutes],
  ['Ягодичная - малая', muscleLabels.glutes],
  ['glutes', muscleLabels.glutes],
] as const;

const hiddenTargetMuscleOptionLabels = new Set(
  HIDDEN_TARGET_MUSCLE_OPTION_LABELS.map(normalizeTargetMuscleOptionLabel),
);

const targetMuscleOptionLabelOverrides = new Map(
  TARGET_MUSCLE_OPTION_LABEL_OVERRIDES.map(([from, to]) => [
    normalizeTargetMuscleOptionLabel(from),
    to,
  ]),
);

function getTargetMuscleOptionCandidates(muscle: Muscle, rawName: string): string[] {
  return [
    rawName,
    normalizeMuscleName(rawName),
    muscle.canonical_muscle_id ?? '',
    muscle.id ?? '',
  ].filter((value): value is string => Boolean(value.trim()));
}

function getTargetMuscleOptionDisplayName(muscle: Muscle, rawName: string): string | null {
  const candidates = getTargetMuscleOptionCandidates(muscle, rawName);

  for (const candidate of candidates) {
    const override = targetMuscleOptionLabelOverrides.get(normalizeTargetMuscleOptionLabel(candidate));
    if (override) {
      return override;
    }
  }

  if (candidates.some((candidate) => hiddenTargetMuscleOptionLabels.has(normalizeTargetMuscleOptionLabel(candidate)))) {
    return null;
  }

  return rawName;
}

export function buildTargetMuscleOptions(muscles: Muscle[]): Muscle[] {
  const optionsByName = new Map<string, Muscle>();

  muscles.forEach((muscle) => {
    const rawName = muscle.name?.trim();
    if (!rawName) return;

    const displayName = getTargetMuscleOptionDisplayName(muscle, rawName);
    if (!displayName) return;

    const existingOption = optionsByName.get(displayName);
    if (!existingOption || rawName === displayName) {
      optionsByName.set(displayName, { ...muscle, name: displayName });
    }
  });

  return Array.from(optionsByName.values());
}

export function buildCreateExerciseCategoryOptions(categories: ExerciseCategory[]): ExerciseCategory[] {
  return categories;
}

const CreateExerciseModal = ({
  isOpen,
  onClose,
  onExerciseSaved,
  userId,
  mode = 'create',
  initialExercise = null,
}: CreateExerciseModalProps) => {
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [formData, setFormData] = useState<CreateExerciseData>({
    name: '',
    category_id: '',
    description: '',
    muscle_ids: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      loadData();
      setFormData({
        name: initialExercise?.name || '',
        category_id: initialExercise?.category_id || '',
        description: initialExercise?.description || '',
        muscle_ids: initialExercise?.muscles?.map((muscle) => muscle.id).filter(Boolean) || [],
      });
    } else {
      document.body.style.overflow = '';
      // Сброс формы при закрытии
      setFormData({
        name: '',
        category_id: '',
        description: '',
        muscle_ids: [],
      });
      setError(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialExercise]);

  const loadData = async () => {
    try {
      const [cats, mus] = await Promise.all([
        exerciseService.getCategories(),
        exerciseService.getMuscles(),
      ]);
      setCategories(cats);
      setMuscles(mus);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setError('Не удалось загрузить данные');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Введите название упражнения');
      return;
    }

    if (!formData.category_id) {
      setError('Выберите категорию');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'edit' && initialExercise?.id) {
        await exerciseService.updateCustomExercise(userId, initialExercise.id, formData);
      } else {
        await exerciseService.createCustomExercise(userId, formData);
      }
      await onExerciseSaved();
      onClose('saved');
    } catch (error: any) {
      setError(error.message || (mode === 'edit' ? 'Ошибка обновления упражнения' : 'Ошибка создания упражнения'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMuscleToggle = (muscleId: string) => {
    setFormData(prev => ({
      ...prev,
      muscle_ids: prev.muscle_ids.includes(muscleId)
        ? prev.muscle_ids.filter(id => id !== muscleId)
        : [...prev.muscle_ids, muscleId],
    }));
  };

  if (!isOpen) return null;

  const targetMuscleOptions = buildTargetMuscleOptions(muscles);
  const categoryOptions = buildCreateExerciseCategoryOptions(categories);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 min-[376px]:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-[calc(100vw-16px)] min-[376px]:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white uppercase">
            {mode === 'edit' ? 'Редактировать упражнение' : 'Создать упражнение'}
          </h2>
          <button
            onClick={() => onClose('cancel')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Название упражнения *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Введите название"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Категория *
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Выберите категорию</option>
              {categoryOptions.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Описание (необязательно)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              rows={3}
              placeholder="Описание упражнения"
            />
          </div>

          {/* Muscles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Целевые мышцы
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-xl p-2 space-y-2">
              {targetMuscleOptions.map(muscle => (
                <label
                  key={muscle.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.muscle_ids.includes(muscle.id)}
                    onChange={() => handleMuscleToggle(muscle.id)}
                    className="w-4 h-4 text-green-500 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {muscle.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onClose('cancel')}
              className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm uppercase bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (mode === 'edit' ? 'Сохранение...' : 'Создание...') : mode === 'edit' ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateExerciseModal;
