import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ExerciseCategory, Muscle, CreateExerciseData } from '../types/workout';
import { exerciseService } from '../services/exerciseService';

interface CreateExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExerciseCreated: () => void;
  userId: string;
}

const CreateExerciseModal = ({
  isOpen,
  onClose,
  onExerciseCreated,
  userId,
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
  }, [isOpen]);

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
      await exerciseService.createCustomExercise(userId, formData);
      onExerciseCreated();
      onClose();
    } catch (error: any) {
      setError(error.message || 'Ошибка создания упражнения');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 min-[376px]:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-[calc(100vw-16px)] min-[376px]:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white uppercase">
            Создать упражнение
          </h2>
          <button
            onClick={onClose}
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
              {categories.map(cat => (
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
              {muscles.map(muscle => (
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
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm uppercase bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateExerciseModal;

