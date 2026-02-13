import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';
import CreateGoalModal, { GoalFormData } from '../components/CreateGoalModal';
import EditGoalModal from '../components/EditGoalModal';
import { goalService } from '../services/goalService';
import AiAdviceBlock from '../components/AiAdviceBlock';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import { calculateGoalTimeline, type GoalMode } from '../utils/goalProjection';

const normalizeGoalMode = (goalType?: string): GoalMode => {
  const value = (goalType || '').toLowerCase();
  if (value.includes('похуд') || value === 'weight-loss') return 'weight-loss';
  if (value.includes('набор') || value === 'gain') return 'gain';
  return 'maintain';
};

const computeDerivedGoal = (goal: GoalData) => {
  const currentWeight = Number(goal.currentWeight);
  const targetWeight = Number(goal.targetWeight);
  const tdee = Number(goal.tdee);
  const calories = Number(goal.calories);
  const goalMode = normalizeGoalMode(goal.goalType);
  const timeline = calculateGoalTimeline({
    goal: goalMode,
    currentWeight,
    targetWeight,
    tdee,
    calories,
  });

  return {
    isGain: goalMode === 'gain',
    isLoss: goalMode === 'weight-loss',
    surplusPerDay: timeline.surplusPerDay,
    deficitPerDay: timeline.deficitPerDay,
    kgPerWeek: timeline.kgPerWeek,
    monthsToGoal: timeline.monthsToGoal,
    daysToGoal: timeline.daysToGoal,
  };
};

interface GoalData {
  goalType: string;
  currentWeight?: string;
  targetWeight: string;
  startDate: string;
  endDate?: string;
  trainingPlace?: 'home' | 'gym';
  monthsToGoal?: number;
  bmr?: number;
  tdee?: number;
  surplusPerDay?: number;
  kgPerWeek?: number;
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
    trainingPlace: 'home',
    calories: '',
    proteins: '',
    fats: '',
    carbs: '',
  });
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null);
  const [trustMessage, setTrustMessage] = useState<string | null>(null);
  const [isWhyOpen, setIsWhyOpen] = useState(false);
  const [isSaveSubmitting, setIsSaveSubmitting] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadGoalState = useCallback(async () => {
    if (!user?.id) return;
    setRuntimeStatus('loading');
    setRuntimeMessage(null);
    setTrustMessage(null);
    try {
      const state = await uiRuntimeAdapter.getGoalState(user.id);
      setRuntimeStatus(state.status);
      setRuntimeMessage(state.message || null);
      setTrustMessage(state.trust?.message ?? null);
      const stored = localStorage.getItem(`goal_${user.id}`);
      const parsed = stored ? JSON.parse(stored) : {};
      const hasRemoteGoal = Boolean(state.goal && (state.goal.calories || state.goal.protein || state.goal.fat || state.goal.carbs));
      const allowLocalFallback = !hasRemoteGoal && (state.status === 'offline' || state.status === 'error' || state.status === 'recovery');
      setGoalData((prev) => {
        const source = hasRemoteGoal ? state.goal ?? null : null;
        const fallback = allowLocalFallback ? parsed : {};
        const merged: GoalData = {
          ...prev,
          ...fallback,
          goalType: source?.goal_type ?? fallback.goalType ?? prev.goalType ?? '',
          currentWeight: source?.current_weight != null ? String(source.current_weight) : fallback.currentWeight ?? prev.currentWeight ?? '',
          targetWeight: source?.target_weight != null ? String(source.target_weight) : fallback.targetWeight ?? prev.targetWeight ?? '',
          startDate: source?.start_date ?? fallback.startDate ?? prev.startDate ?? '',
          endDate: source?.end_date ?? fallback.endDate ?? prev.endDate ?? '',
          trainingPlace:
            source?.training_place === 'gym'
              ? 'gym'
              : (fallback.trainingPlace as 'home' | 'gym' | undefined) ?? prev.trainingPlace ?? 'home',
          bmr: source?.bmr ?? fallback.bmr ?? prev.bmr,
          tdee: source?.tdee ?? fallback.tdee ?? prev.tdee,
          monthsToGoal: source?.months_to_goal ?? fallback.monthsToGoal ?? prev.monthsToGoal,
          calories: source?.calories?.toString() ?? fallback.calories ?? prev.calories ?? '',
          proteins: source?.protein?.toString() ?? fallback.proteins ?? fallback.protein ?? prev.proteins ?? '',
          fats: source?.fat?.toString() ?? fallback.fats ?? fallback.fat ?? prev.fats ?? '',
          carbs: source?.carbs?.toString() ?? fallback.carbs ?? prev.carbs ?? '',
        };
        const nextDerived = computeDerivedGoal(merged);
        const enriched = {
          ...merged,
          surplusPerDay: nextDerived.surplusPerDay,
          kgPerWeek: nextDerived.kgPerWeek,
          monthsToGoal: nextDerived.monthsToGoal,
        };
        localStorage.setItem(`goal_${user.id}`, JSON.stringify(enriched));
        return enriched;
      });
    } catch (error) {
      setRuntimeStatus('error');
      setRuntimeMessage('Не удалось загрузить цель.');
      setTrustMessage('Проверьте соединение и попробуйте снова.');
    }
  }, [user?.id]);

  const bmrValue = Number(goalData.bmr);
  const tdeeValue = Number(goalData.tdee);
  const caloriesValue = Number(goalData.calories);
  const derived = useMemo(() => computeDerivedGoal(goalData), [goalData]);
  const monthsValue = derived.monthsToGoal;
  const daysToGoalValue = derived.daysToGoal;
  const surplusValue = derived.surplusPerDay;
  const deficitValue = derived.deficitPerDay;
  const kgPerWeekValue = derived.kgPerWeek;
  const isGainGoal = derived.isGain;
  const showWhyBlock =
    Number.isFinite(bmrValue) &&
    Number.isFinite(tdeeValue) &&
    Number.isFinite(caloriesValue) &&
    bmrValue > 0 &&
    tdeeValue > 0 &&
    caloriesValue > 0;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    loadGoalState();
  }, [user, navigate, loadGoalState]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug('[goal:projection][goal-screen]', {
      weight: Number(goalData.currentWeight),
      targetWeight: Number(goalData.targetWeight),
      tdee: Number(goalData.tdee),
      calories: Number(goalData.calories),
      deficitPerDay: derived.deficitPerDay,
      surplusPerDay: derived.surplusPerDay,
      rateKgPerWeek: derived.kgPerWeek,
      daysToGoal: derived.daysToGoal,
      monthsToGoal: derived.monthsToGoal,
    });
  }, [goalData, derived]);

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
    setSaveNotice(null);
    try {
      await goalService.saveUserGoal(user.id, {
        calories: Number(data.calories),
        protein: Number(data.proteins),
        fat: Number(data.fats),
        carbs: Number(data.carbs),
        goal_type: goalData.goalType || undefined,
        current_weight: goalData.currentWeight ? Number(goalData.currentWeight) : undefined,
        target_weight: goalData.targetWeight ? Number(goalData.targetWeight) : undefined,
        start_date: goalData.startDate || undefined,
        end_date: goalData.endDate || undefined,
        months_to_goal: goalData.monthsToGoal,
        bmr: goalData.bmr,
        tdee: goalData.tdee,
        training_place: goalData.trainingPlace ?? 'home',
      });

      const updatedGoalData: GoalData = {
        ...goalData,
        calories: data.calories,
        proteins: data.proteins,
        fats: data.fats,
        carbs: data.carbs,
      };

      const nextDerived = computeDerivedGoal(updatedGoalData);
      updatedGoalData.surplusPerDay = nextDerived.surplusPerDay;
      updatedGoalData.kgPerWeek = nextDerived.kgPerWeek;
      updatedGoalData.monthsToGoal = nextDerived.monthsToGoal;

      localStorage.setItem(`goal_${user.id}`, JSON.stringify(updatedGoalData));
      if (import.meta.env.DEV) {
        console.debug('[goal:projection][edit-save]', {
          weight: Number(updatedGoalData.currentWeight),
          targetWeight: Number(updatedGoalData.targetWeight),
          tdee: Number(updatedGoalData.tdee),
          calories: Number(updatedGoalData.calories),
          deficitPerDay: nextDerived.deficitPerDay,
          surplusPerDay: nextDerived.surplusPerDay,
          rateKgPerWeek: nextDerived.kgPerWeek,
          daysToGoal: nextDerived.daysToGoal,
          monthsToGoal: nextDerived.monthsToGoal,
        });
      }
      setGoalData(updatedGoalData);
      setSaveNotice({ type: 'success', text: 'Цель сохранена' });
      setIsEditGoalModalOpen(false);
    } catch (error) {
      setSaveNotice({ type: 'error', text: 'Не удалось сохранить цель. Повторите попытку.' });
      throw error;
    }
  };

  const handleClose = () => {
    navigate('/');
  };

  const handleSaveGoal = async () => {
    if (!user?.id || isSaveSubmitting) return;
    setIsSaveSubmitting(true);
    setSaveNotice(null);
    try {
      await goalService.saveUserGoal(user.id, {
        calories: Number(goalData.calories || 0),
        protein: Number(goalData.proteins || 0),
        fat: Number(goalData.fats || 0),
        carbs: Number(goalData.carbs || 0),
        goal_type: goalData.goalType || undefined,
        current_weight: goalData.currentWeight ? Number(goalData.currentWeight) : undefined,
        target_weight: goalData.targetWeight ? Number(goalData.targetWeight) : undefined,
        start_date: goalData.startDate || undefined,
        end_date: goalData.endDate || undefined,
        months_to_goal: goalData.monthsToGoal,
        bmr: goalData.bmr,
        tdee: goalData.tdee,
        training_place: goalData.trainingPlace ?? 'home',
      });
      setSaveNotice({ type: 'success', text: 'Цель сохранена' });
    } catch (error) {
      setSaveNotice({ type: 'error', text: 'Не удалось сохранить цель. Повторите попытку.' });
    } finally {
      setIsSaveSubmitting(false);
    }
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
  const hasDaysToGoal = Number.isFinite(daysToGoalValue) && daysToGoalValue > 0;
  const hasMonthsToGoal = Number.isFinite(monthsValue) && monthsValue > 0;
  const remainingLabel =
    hasDaysToGoal && daysToGoalValue < 31
      ? formatDays(Math.ceil(daysToGoalValue))
      : hasMonthsToGoal
        ? `~${Math.ceil(monthsValue)} месяцев`
        : null;

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
      <div className="max-w-[768px] mx-auto w-full flex flex-col h-full max-w-full overflow-hidden">
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
          {runtimeStatus === 'loading' && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Загрузка цели...
            </div>
          )}
          {runtimeStatus === 'offline' && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Работаем офлайн. Данные могут быть неактуальны.
              <button
                onClick={() => {
                  uiRuntimeAdapter.revalidate().finally(loadGoalState);
                }}
                className="ml-3 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                Обновить
              </button>
            </div>
          )}
          {runtimeStatus === 'recovery' && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Идёт восстановление данных. Продолжаем безопасно.
            </div>
          )}
          {runtimeStatus === 'error' && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="flex flex-col gap-2">
                <span>{runtimeMessage || 'Не удалось загрузить данные.'}</span>
                {trustMessage && <span className="text-xs text-red-700">{trustMessage}</span>}
                <button
                  onClick={() => {
                    uiRuntimeAdapter.recover().finally(loadGoalState);
                  }}
                  className="w-fit rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}
          {runtimeStatus === 'empty' && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Цель ещё не задана. Начните с расчёта.
            </div>
          )}
          {/* Goal Summary Section */}
          <div className="space-y-3 min-[376px]:space-y-4 mb-4 min-[376px]:mb-6 w-full max-w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 w-full max-w-full overflow-hidden">
              <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">Цель:</p>
              <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
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
            <div className="flex items-center justify-between gap-2 w-full max-w-full overflow-hidden">
              <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">Тренировки:</p>
              <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
                {goalData.trainingPlace === 'gym' ? 'В зале' : 'Дома / на улице'}
              </p>
            </div>
            <div className="grid grid-cols-1 min-[376px]:grid-cols-2 gap-3 min-[376px]:gap-4 w-full max-w-full">
              <div className="flex items-center justify-between gap-2 w-full max-w-full overflow-hidden">
                <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">Начало:</p>
                <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
                  {formatDate(goalData.startDate)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 w-full max-w-full overflow-hidden">
                <p className="text-xs min-[376px]:text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">Осталось:</p>
                <p className="text-sm min-[376px]:text-base font-medium text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
                  {remainingLabel ?? (goalData.endDate ? formatDays(daysRemaining) : '-')}
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
          {showWhyBlock && (
            <div className="mb-4 w-full max-w-full">
              <button
                type="button"
                onClick={() => setIsWhyOpen((prev) => !prev)}
                className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-200 transition-colors"
              >
                Почему так?
              </button>
              {isWhyOpen && (
                <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-gray-700">
                  {isGainGoal ? (
                    surplusValue > 0 ? (
                      <>
                        <p>Ваш базовый обмен — {Math.round(bmrValue)} ккал.</p>
                        <p>С учётом активности вы тратите примерно {Math.round(tdeeValue)} ккал в день.</p>
                        <p>
                          Для набора массы мы добавили безопасный профицит: +{Math.round(surplusValue)} ккал/день →{' '}
                          {Math.round(caloriesValue)} ккал/день.
                        </p>
                        <p>
                          Это даёт темп около ~{Number.isFinite(kgPerWeekValue) ? kgPerWeekValue.toFixed(2) : '0.00'} кг/нед — без резкого набора жира.
                        </p>
                        {Number.isFinite(monthsValue) && monthsValue > 0 && (
                          <p>При стабильном соблюдении режима вы выйдете на цель примерно за ~{Math.ceil(monthsValue)} мес.</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p>Сейчас калораж не даёт профицит относительно вашего расхода.</p>
                        <p>Чтобы набирать массу, нужно быть в плюсе: хотя бы +150–300 ккал/день.</p>
                        <p>Попробуйте увеличить калории или выбрать более активный режим тренировок.</p>
                      </>
                    )
                  ) : (
                    <>
                      <p>Мы рассчитали ваш базовый обмен — {Math.round(bmrValue)} ккал.</p>
                      <p>С учётом активности ваш расход — {Math.round(tdeeValue)} ккал.</p>
                      {deficitValue > 0 ? (
                        <>
                          <p>
                            Чтобы снижать вес без стресса, мы заложили дефицит: {Math.round(deficitValue)} ккал/день →{' '}
                            {Math.round(caloriesValue)} ккал/день.
                          </p>
                          {caloriesValue < bmrValue ? (
                            <>
                              <p className="text-red-600">
                                Обратите внимание: калории ниже вашего базового обмена.
                              </p>
                              <p className="text-red-600">
                                Мы не рекомендуем выходить на калории ниже вашего обмена — это может навредить здоровью.
                              </p>
                              <p className="text-red-600">
                                При плохом самочувствии обратитесь к врачу.
                              </p>
                            </>
                          ) : (
                            <p>
                              Это даёт темп около ~{Number.isFinite(kgPerWeekValue) ? kgPerWeekValue.toFixed(2) : '0.00'} кг/нед —
                              без резких скачков.
                            </p>
                          )}
                          {Number.isFinite(monthsValue) && monthsValue > 0 && (
                            <p>При стабильном соблюдении режима вы выйдете на цель примерно за ~{Math.ceil(monthsValue)} мес.</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p>Сейчас калораж не даёт дефицит относительно вашего расхода.</p>
                          <p>Чтобы снижать вес, нужен минус: хотя бы 150–300 ккал/день.</p>
                          <p>Попробуйте уменьшить калории или выбрать более активный режим тренировок.</p>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Advice Block */}
          <AiAdviceBlock />

          {/* Action Buttons */}
          <div className="pt-4 min-[376px]:pt-6 pb-4 min-[376px]:pb-6 w-full max-w-full overflow-hidden">
            {saveNotice && (
              <div
                className={`mb-3 rounded-lg px-3 py-2 text-xs ${
                  saveNotice.type === 'success'
                    ? 'border border-green-200 bg-green-50 text-green-700'
                    : 'border border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {saveNotice.text}
              </div>
            )}
            <button
              onClick={handleSetGoal}
              style={{ height: '40px', minHeight: '40px', maxHeight: '40px', boxSizing: 'border-box' }}
              className="w-full max-w-full min-[768px]:button-limited px-2 min-[376px]:px-2.5 flex items-center justify-center rounded-xl font-semibold text-xs min-[376px]:text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors mb-2 min-[376px]:mb-3"
            >
              ЗАДАТЬ ЦЕЛЬ
            </button>
            <button
              onClick={handleEditGoal}
              style={{ height: '40px', minHeight: '40px', maxHeight: '40px', boxSizing: 'border-box' }}
              className="w-full max-w-full min-[768px]:button-limited px-2 min-[376px]:px-2.5 flex items-center justify-center rounded-xl font-semibold text-xs min-[376px]:text-base uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors mb-2 min-[376px]:mb-3 break-words overflow-wrap-anywhere"
            >
              РЕДАКТИРОВАТЬ ЦЕЛЬ
            </button>
            <button
              onClick={handleSaveGoal}
              disabled={isSaveSubmitting}
              style={{ height: '40px', minHeight: '40px', maxHeight: '40px', boxSizing: 'border-box' }}
              className="w-full max-w-full min-[768px]:button-limited px-2 min-[376px]:px-2.5 flex items-center justify-center rounded-xl font-semibold text-xs min-[376px]:text-base uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaveSubmitting ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
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
        bmr={Number.isFinite(bmrValue) ? bmrValue : null}
        weight={Number.isFinite(Number(goalData.currentWeight)) ? Number(goalData.currentWeight) : null}
      />
    </div>
  );
};

export default Goal;
