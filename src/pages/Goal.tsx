import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';

interface GoalData {
  goalType: string;
  targetWeight: string;
  targetWaist: string;
  targetHips: string;
  startDate: string;
  calories: string;
  proteins: string;
  fats: string;
  carbs: string;
}

const Goal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [goalData, setGoalData] = useState<GoalData>({
    goalType: '',
    targetWeight: '',
    targetWaist: '',
    targetHips: '',
    startDate: '',
    calories: '',
    proteins: '',
    fats: '',
    carbs: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Загружаем сохраненную цель из localStorage
    const savedGoal = localStorage.getItem(`goal_${user.id}`);
    if (savedGoal) {
      try {
        const parsed = JSON.parse(savedGoal);
        setGoalData(parsed);
        setIsEditing(false); // Показываем режим просмотра, если цель уже создана
      } catch (error) {
        console.error('Ошибка загрузки цели:', error);
      }
    }
  }, [user, navigate]);

  const handleChange = (field: keyof GoalData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setGoalData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSetGoal = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!user?.id) return;
    
    // Сохраняем цель в localStorage
    localStorage.setItem(`goal_${user.id}`, JSON.stringify(goalData));
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleClose = () => {
    navigate('/');
  };

  const fieldClasses = 'w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500';

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col" style={{ minWidth: '360px' }}>
      <div className="max-w-[1024px] mx-auto flex flex-col flex-1 w-full">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1"></div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase">
            ТВОЯ ЦЕЛЬ
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        <main className="px-4 py-6 flex-1 overflow-y-auto">
          {!isEditing ? (
            <>
              {/* Set Goal Button */}
              {!goalData.goalType && (
                <button
                  onClick={handleSetGoal}
                  className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors mb-6"
                >
                  ЗАДАТЬ ЦЕЛЬ
                </button>
              )}

              {/* Goal Details Display */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Цель:</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      {goalData.goalType || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">До цели:</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">-</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Вес:</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      {goalData.targetWeight || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Осталось:</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">-</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Талия:</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {goalData.targetWaist || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Бедра:</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {goalData.targetHips || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Начало:</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {goalData.startDate || '-'}
                  </p>
                </div>
              </div>

              {/* Daily Calorie Intake Display */}
              <div className="mb-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  Суточный калораж для достижения цели:
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      калории
                    </label>
                    <div className={`${fieldClasses} ${!goalData.calories ? 'text-gray-400' : ''}`}>
                      {goalData.calories || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      белки
                    </label>
                    <div className={`${fieldClasses} ${!goalData.proteins ? 'text-gray-400' : ''}`}>
                      {goalData.proteins || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      жиры
                    </label>
                    <div className={`${fieldClasses} ${!goalData.fats ? 'text-gray-400' : ''}`}>
                      {goalData.fats || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      углеводы
                    </label>
                    <div className={`${fieldClasses} ${!goalData.carbs ? 'text-gray-400' : ''}`}>
                      {goalData.carbs || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips Section */}
              <div className="mb-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  Советы
                </h2>
                {/* Tips content can be added here */}
              </div>

              {/* Edit Button */}
              {goalData.goalType && (
                <div className="space-y-3 pb-6">
                  <button
                    onClick={handleEdit}
                    className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    РЕДАКТИРОВАТЬ ЦЕЛЬ
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Goal Form */}
              <form className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Цель
                  </label>
                  <select
                    className={fieldClasses}
                    value={goalData.goalType}
                    onChange={handleChange('goalType')}
                  >
                    <option value="">Выберите цель</option>
                    <option value="Похудение">Похудение</option>
                    <option value="Поддержание формы">Поддержание формы</option>
                    <option value="Набор массы">Набор массы</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Вес (кг)
                    </label>
                    <input
                      type="number"
                      className={fieldClasses}
                      value={goalData.targetWeight}
                      onChange={handleChange('targetWeight')}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Талия (см)
                    </label>
                    <input
                      type="number"
                      className={fieldClasses}
                      value={goalData.targetWaist}
                      onChange={handleChange('targetWaist')}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Бедра (см)
                  </label>
                  <input
                    type="number"
                    className={fieldClasses}
                    value={goalData.targetHips}
                    onChange={handleChange('targetHips')}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Начало
                  </label>
                  <input
                    type="date"
                    className={fieldClasses}
                    value={goalData.startDate}
                    onChange={handleChange('startDate')}
                  />
                </div>

                {/* Daily Calorie Intake */}
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                    Суточный калораж для достижения цели:
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        калории
                      </label>
                      <input
                        type="number"
                        className={fieldClasses}
                        value={goalData.calories}
                        onChange={handleChange('calories')}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        белки
                      </label>
                      <input
                        type="number"
                        className={fieldClasses}
                        value={goalData.proteins}
                        onChange={handleChange('proteins')}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        жиры
                      </label>
                      <input
                        type="number"
                        className={fieldClasses}
                        value={goalData.fats}
                        onChange={handleChange('fats')}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        углеводы
                      </label>
                      <input
                        type="number"
                        className={fieldClasses}
                        value={goalData.carbs}
                        onChange={handleChange('carbs')}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Tips Section */}
                <div className="mb-6">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                    Советы
                  </h2>
                  {/* Tips content can be added here */}
                </div>

                {/* Save Button */}
                <div className="pb-6">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                  >
                    СОХРАНИТЬ
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Goal;

