import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';

interface GoalData {
  goalType: string;
  targetWeight: string;
  startDate: string;
  calories: string;
  proteins: string;
  fats: string;
  carbs: string;
}

const Goal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [goalData, setGoalData] = useState<GoalData>({
    goalType: '',
    targetWeight: '',
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
      } catch (error) {
        console.error('Ошибка загрузки цели:', error);
      }
    }
  }, [user, navigate]);

  const handleSetGoal = () => {
    // Пока ничего не делаем
  };

  const handleClose = () => {
    navigate('/');
  };

  const fieldClasses = 'w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500';

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden" style={{ minWidth: '360px' }}>
      <div className="max-w-[1024px] mx-auto w-full flex flex-col h-full">
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

        <main className="flex-1 overflow-y-auto min-h-0 px-4 py-6">
          {/* Set Goal Button */}
          {!goalData.goalType && (
            <button
              onClick={handleSetGoal}
              className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors mb-6"
            >
              ЗАДАТЬ ЦЕЛЬ
            </button>
          )}

          {/* Goal Summary Section */}
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
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Начало:</p>
              <p className="text-base font-medium text-gray-900 dark:text-white">
                {goalData.startDate || '-'}
              </p>
            </div>
          </div>

          {/* Daily Calorie and Macronutrient Section */}
          <div className="mb-6">
            <h2 className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
          </div>

          {/* Action Buttons */}
          <div className="pt-6 pb-6">
            <button
              className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors mb-3"
            >
              РЕДАКТИРОВАТЬ ЦЕЛЬ
            </button>
            <button
              className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              СОХРАНИТЬ
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Goal;

