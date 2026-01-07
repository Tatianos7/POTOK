import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';
import CreateGoalModal, { GoalFormData } from '../components/CreateGoalModal';
import EditGoalModal from '../components/EditGoalModal';
import { goalService } from '../services/goalService';

interface GoalData {
  goalType: string;
  currentWeight?: string;
  targetWeight: string;
  startDate: string;
  endDate?: string;
  monthsToGoal?: number;
  calories: string;
  proteins: string;
  fats: string;
  carbs: string;
}

const Goal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCreateGoalModalOpen, setIsCreateGoalModalOpen] = useState(false);
  const [isEditGoalModalOpen, setIsEditGoalModalOpen] = useState(false);
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

    // Load goal from Supabase first, then localStorage for additional data
    goalService.getUserGoal(user.id).then((supabaseGoal) => {
      if (supabaseGoal) {
        // Update goalData with Supabase data
        setGoalData((prev) => ({
          ...prev,
          calories: supabaseGoal.calories.toString(),
          proteins: supabaseGoal.protein.toString(),
          fats: supabaseGoal.fat.toString(),
          carbs: supabaseGoal.carbs.toString(),
        }));
      }
    });

    // Загружаем дополнительные данные цели из localStorage (goalType, dates, etc.)
    const savedGoal = localStorage.getItem(`goal_${user.id}`);
    if (savedGoal) {
      try {
        const parsed = JSON.parse(savedGoal);
        setGoalData((prev) => ({
          ...prev,
          ...parsed,
        }));
      } catch (error) {
        console.error('Ошибка загрузки цели:', error);
      }
    }
  }, [user, navigate]);

  const handleSetGoal = () => {
    setIsCreateGoalModalOpen(true);
  };

  const handleCalculate = (formData: GoalFormData) => {
    // Перенаправляем на страницу результатов с данными формы
    setIsCreateGoalModalOpen(false);
    navigate('/goal/result', { state: { formData } });
  };

  const handleEditGoal = () => {
    // Проверяем, есть ли сохраненная цель
    if (!goalData.calories && !goalData.proteins && !goalData.fats && !goalData.carbs) {
      // Если цели нет, можно показать сообщение или открыть модальное окно создания цели
      return;
    }
    setIsEditGoalModalOpen(true);
  };

  const handleSaveEdit = async (data: { calories: string; proteins: string; fats: string; carbs: string }) => {
    if (!user?.id) return;

    // Save to Supabase
    await goalService.saveUserGoal(user.id, {
      calories: Number(data.calories),
      protein: Number(data.proteins),
      fat: Number(data.fats),
      carbs: Number(data.carbs),
    });

    // Обновляем данные цели
    const updatedGoalData = {
      ...goalData,
      calories: data.calories,
      proteins: data.proteins,
      fats: data.fats,
      carbs: data.carbs,
    };

    // Сохраняем в localStorage (для дополнительных данных)
    localStorage.setItem(`goal_${user.id}`, JSON.stringify(updatedGoalData));
    setGoalData(updatedGoalData);
    setIsEditGoalModalOpen(false);
  };

  const handleClose = () => {
    navigate('/');
  };

  // Расчет оставшихся дней до цели
  const calculateDaysRemaining = (): number => {
    if (!goalData.endDate) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Сбрасываем время для точного сравнения дней
    
    const endDate = new Date(goalData.endDate);
    endDate.setHours(0, 0, 0, 0);
    
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays); // Не показываем отрицательные значения
  };

  const daysRemaining = calculateDaysRemaining();

  // Форматирование дней с правильным склонением
  const formatDays = (days: number): string => {
    if (days === 0) return '0 дней';
    
    const lastDigit = days % 10;
    const lastTwoDigits = days % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return `${days} дней`;
    }
    if (lastDigit === 1) {
      return `${days} день`;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return `${days} дня`;
    }
    return `${days} дней`;
  };

  // Расчет разницы в весе до цели
  const calculateWeightDifference = (): string => {
    if (!goalData.currentWeight || !goalData.targetWeight) return '-';
    
    const current = parseFloat(goalData.currentWeight);
    const target = parseFloat(goalData.targetWeight);
    
    if (isNaN(current) || isNaN(target)) return '-';
    
    const difference = Math.abs(current - target);
    
    // Округляем до одного знака после запятой
    return difference.toFixed(1);
  };

  const weightDifference = calculateWeightDifference();

  // Форматирование даты из YYYY-MM-DD в DD.MM.YYYY
  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    
    try {
      const [year, month, day] = dateString.split('-');
      if (year && month && day) {
        return `${day}.${month}.${year}`;
      }
      return dateString;
    } catch (error) {
      return dateString;
    }
  };

  const fieldClasses = 'w-full max-w-full px-2 min-[376px]:px-4 py-2 min-[376px]:py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500';

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden w-full min-w-[320px] max-w-full">
      <div className="max-w-[1024px] mx-auto w-full flex flex-col h-full max-w-full overflow-hidden">
        {/* Header */}
        <header className="px-2 min-[376px]:px-4 py-3 min-[376px]:py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 flex-shrink-0 w-full max-w-full overflow-hidden">
          <div className="flex-1"></div>
          <h1 className="text-base min-[376px]:text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase break-words overflow-wrap-anywhere">
            ТВОЯ ЦЕЛЬ
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleClose}
              className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5 min-[376px]:w-6 min-[376px]:h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0 px-2 min-[376px]:px-4 py-4 min-[376px]:py-6 w-full max-w-full overflow-hidden">
          {/* Goal Summary Section */}
          <div className="space-y-3 min-[376px]:space-y-4 mb-4 min-[376px]:mb-6 w-full max-w-full overflow-hidden">
            <div className="flex items-center gap-2 w-full max-w-full overflow-hidden">
              <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">Цель:</p>
              <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white break-words overflow-wrap-anywhere flex-1 min-w-0"
                style={{ 
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  hyphens: 'auto'
                }}
              >
                {goalData.goalType || '-'}
              </p>
            </div>
            <div className="grid grid-cols-1 min-[376px]:grid-cols-2 gap-3 min-[376px]:gap-4 w-full max-w-full">
              <div className="flex items-center justify-between gap-2 w-full max-w-full overflow-hidden">
                <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">Вес:</p>
                <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
                  {goalData.targetWeight || '-'}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 w-full max-w-full overflow-hidden">
                <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">До цели:</p>
                <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
                  {weightDifference !== '-' ? `${weightDifference} кг` : '-'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 min-[376px]:grid-cols-2 gap-3 min-[376px]:gap-4 w-full max-w-full">
              <div className="flex items-center gap-2 w-full max-w-full overflow-hidden">
                <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">Начало:</p>
                <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white break-words overflow-wrap-anywhere flex-1 min-w-0">
                  {formatDate(goalData.startDate)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 w-full max-w-full overflow-hidden">
                <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">Осталось:</p>
                <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
                  {goalData.endDate ? formatDays(daysRemaining) : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Daily Calorie and Macronutrient Section */}
          <div className="mb-4 min-[376px]:mb-6 w-full max-w-full overflow-hidden">
            <h2 className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 mb-3 min-[376px]:mb-4 break-words overflow-wrap-anywhere">
              Суточный калораж для достижения цели:
            </h2>
            <div className="grid grid-cols-2 gap-2 min-[376px]:gap-4 w-full max-w-full">
              <div className="w-full max-w-full overflow-hidden">
                <label className="block text-[10px] min-[376px]:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 break-words overflow-wrap-anywhere">
                  калории
                </label>
                <div className={`${fieldClasses} ${!goalData.calories ? 'text-gray-400' : ''} text-xs min-[376px]:text-sm w-full max-w-full`} style={{ boxSizing: 'border-box' }}>
                  {goalData.calories || '-'}
                </div>
              </div>
              <div className="w-full max-w-full overflow-hidden">
                <label className="block text-[10px] min-[376px]:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 break-words overflow-wrap-anywhere">
                  белки
                </label>
                <div className={`${fieldClasses} ${!goalData.proteins ? 'text-gray-400' : ''} text-xs min-[376px]:text-sm w-full max-w-full`} style={{ boxSizing: 'border-box' }}>
                  {goalData.proteins || '-'}
                </div>
              </div>
              <div className="w-full max-w-full overflow-hidden">
                <label className="block text-[10px] min-[376px]:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 break-words overflow-wrap-anywhere">
                  жиры
                </label>
                <div className={`${fieldClasses} ${!goalData.fats ? 'text-gray-400' : ''} text-xs min-[376px]:text-sm w-full max-w-full`} style={{ boxSizing: 'border-box' }}>
                  {goalData.fats || '-'}
                </div>
              </div>
              <div className="w-full max-w-full overflow-hidden">
                <label className="block text-[10px] min-[376px]:text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 break-words overflow-wrap-anywhere">
                  углеводы
                </label>
                <div className={`${fieldClasses} ${!goalData.carbs ? 'text-gray-400' : ''} text-xs min-[376px]:text-sm w-full max-w-full`} style={{ boxSizing: 'border-box' }}>
                  {goalData.carbs || '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 min-[376px]:pt-6 pb-4 min-[376px]:pb-6 w-full max-w-full overflow-hidden">
            <button
              onClick={handleSetGoal}
              style={{ height: '40px', minHeight: '40px', maxHeight: '40px', boxSizing: 'border-box' }}
              className="w-full max-w-full px-2 min-[376px]:px-2.5 flex items-center justify-center rounded-xl font-semibold text-xs min-[376px]:text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors mb-2 min-[376px]:mb-3"
            >
              ЗАДАТЬ ЦЕЛЬ
            </button>
            <button
              onClick={handleEditGoal}
              style={{ height: '40px', minHeight: '40px', maxHeight: '40px', boxSizing: 'border-box' }}
              className="w-full max-w-full px-2 min-[376px]:px-2.5 flex items-center justify-center rounded-xl font-semibold text-xs min-[376px]:text-base uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors mb-2 min-[376px]:mb-3 break-words overflow-wrap-anywhere"
            >
              РЕДАКТИРОВАТЬ ЦЕЛЬ
            </button>
            <button
              style={{ height: '40px', minHeight: '40px', maxHeight: '40px', boxSizing: 'border-box' }}
              className="w-full max-w-full px-2 min-[376px]:px-2.5 flex items-center justify-center rounded-xl font-semibold text-xs min-[376px]:text-base uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              СОХРАНИТЬ
            </button>
          </div>
        </main>
      </div>

      {/* Create Goal Modal */}
      <CreateGoalModal
        isOpen={isCreateGoalModalOpen}
        onClose={() => setIsCreateGoalModalOpen(false)}
        onCalculate={handleCalculate}
      />

      {/* Edit Goal Modal */}
      <EditGoalModal
        isOpen={isEditGoalModalOpen}
        onClose={() => setIsEditGoalModalOpen(false)}
        onSave={handleSaveEdit}
        initialData={{
          calories: goalData.calories || '',
          proteins: goalData.proteins || '',
          fats: goalData.fats || '',
          carbs: goalData.carbs || '',
        }}
      />
    </div>
  );
};

export default Goal;

