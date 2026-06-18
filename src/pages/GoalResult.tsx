import { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';
import { GoalFormData } from '../components/CreateGoalModal';
import { goalService, type GoalTrainingPlace } from '../services/goalService';
import { profileService } from '../services/profileService';
import { uiRuntimeAdapter } from '../services/uiRuntimeAdapter';
import { computeGoalPlan } from '../utils/goalProjection';
import { aiRecommendationsService, type DayAnalysisContext } from '../services/aiRecommendationsService';
import { getLocalDayKey } from '../utils/dayKey';
import { validateGoalInput } from '../utils/goalValidation';

interface CalculatedResult {
  bmr: number;
  tdee: number;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  monthsToGoal: number;
  daysToGoal: number;
  deficitPerDay?: number;
  surplusPerDay?: number;
  kgPerWeek?: number;
}

const normalizeGoal = (goal: string) => (goal === 'weight-loss' || goal === 'gain' ? goal : 'maintain');

const getEffectiveTargetWeight = (data: GoalFormData): number => {
  const weight = Number(data.weight);
  const targetWeight = Number(data.targetWeight);
  return normalizeGoal(data.goal) === 'maintain' || !Number.isFinite(targetWeight) ? weight : targetWeight;
};

const GoalResult = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState<GoalFormData | null>(null);
  const [result, setResult] = useState<CalculatedResult | null>(null);
  const [saveNotice, setSaveNotice] = useState<{ type: 'warning' | 'error'; text: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Получаем данные формы из location.state или localStorage
    const data = location.state?.formData || null;
    if (data) {
      setFormData({
        ...data,
        trainingPlace: data.trainingPlace ?? 'home',
      });
    } else {
      // Если данных нет, возвращаемся на страницу цели
      navigate('/goal');
    }
  }, [user, navigate, location]);

  useEffect(() => {
    if (!formData) return;

    const validation = validateGoalInput(formData);
    if (!validation.isValid) {
      setResult(null);
      setValidationError('Проверьте данные цели и попробуйте рассчитать её снова.');
      return;
    }

    setValidationError(null);
    const age = Number(formData.age);
    const weight = Number(formData.weight);
    const height = Number(formData.height);
    const normalizedGoal = normalizeGoal(formData.goal);
    const effectiveTargetWeight = getEffectiveTargetWeight(formData);
    const computed = computeGoalPlan({
      gender: formData.gender,
      age,
      weight,
      height,
      lifestyle: formData.lifestyle,
      goal: normalizedGoal,
      intensity: formData.intensity,
      targetWeight: effectiveTargetWeight,
    });

    if (import.meta.env.DEV) {
      console.debug('[goal:projection][result]', {
        weight,
        targetWeight: effectiveTargetWeight,
        tdee: computed.tdee,
        calories: computed.calories,
        deficitPerDay: computed.timeline.deficitPerDay,
        surplusPerDay: computed.timeline.surplusPerDay,
        rateKgPerWeek: computed.timeline.kgPerWeek,
        daysToGoal: computed.timeline.daysToGoal,
        monthsToGoal: computed.timeline.monthsToGoal,
      });
    }

    setResult({
      bmr: computed.bmr,
      tdee: computed.tdee,
      calories: computed.calories,
      proteins: computed.proteins,
      fats: computed.fats,
      carbs: computed.carbs,
      monthsToGoal: computed.timeline.monthsToGoal,
      daysToGoal: computed.timeline.daysToGoal,
      deficitPerDay: computed.timeline.deficitPerDay,
      surplusPerDay: computed.timeline.surplusPerDay,
      kgPerWeek: computed.timeline.kgPerWeek,
    });
  }, [formData]);

  useEffect(() => {
    if (!user || !result) return;
    void uiRuntimeAdapter.getDecisionSupport({
      decision_type: 'goal_change',
      emotional_state: 'neutral',
      trust_level: 50,
      history_pattern: `Оценка срока: ${result.monthsToGoal} мес.`,
      user_mode: 'Manual',
      screen: 'GoalResult',
      subscription_state: user.hasPremium ? 'Premium' : 'Free',
      safety_flags: [],
    });
  }, [user, result]);

  // Маппинг образа жизни
  const getLifestyleLabel = (lifestyle: string): string => {
    const labels: Record<string, string> = {
      'sedentary': 'Сидячий и малоподвижный',
      'light': 'Легкая активность',
      'moderate': 'Средняя активность',
      'high': 'Высокая активность',
      'very-high': 'Очень высокая активность',
    };
    return labels[lifestyle] || lifestyle;
  };

  // Маппинг количества тренировок
  const getWorkoutsPerWeek = (lifestyle: string): string => {
    const workouts: Record<string, string> = {
      'sedentary': '0',
      'light': '1-3',
      'moderate': '2-3',
      'high': '4-5',
      'very-high': '6-7',
    };
    return workouts[lifestyle] || '-';
  };

  const getTrainingPlaceLabel = (trainingPlace: GoalTrainingPlace | string): string => {
    if (trainingPlace === 'none') return 'Без тренировок';
    if (trainingPlace === 'gym') return 'В зале';
    return 'Дома / на улице';
  };

  const handleSave = async () => {
    if (!user?.id || !formData || !result) return;
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaveNotice(null);
    try {
      const effectiveTargetWeight = getEffectiveTargetWeight(formData);

      const goalTypeMap: Record<string, string> = {
        'weight-loss': 'Похудение',
        'maintain': 'Поддержка формы',
        'gain': 'Набор массы',
      };

      const startDate = getLocalDayKey();
      const isMaintainGoal = normalizeGoal(formData.goal) === 'maintain';
      
      // Рассчитываем дату окончания на основе месяцев до цели
      let endDate: string | null = null;
      if (!isMaintainGoal && result.monthsToGoal > 0) {
        const endDateObj = new Date();
        endDateObj.setMonth(endDateObj.getMonth() + result.monthsToGoal);
        endDate = getLocalDayKey(endDateObj);
      }

      if (import.meta.env.DEV) {
        console.debug('[goal:projection][save]', {
          weight: Number(formData.weight),
          targetWeight: effectiveTargetWeight,
          tdee: result.tdee,
          calories: result.calories,
          deficitPerDay: result.deficitPerDay ?? 0,
          surplusPerDay: result.surplusPerDay ?? 0,
          rateKgPerWeek: result.kgPerWeek ?? 0,
          daysToGoal: result.daysToGoal,
          monthsToGoal: result.monthsToGoal,
        });
      }

      const saveResult = await goalService.saveUserGoal(user.id, {
        calories: result.calories,
        protein: result.proteins,
        fat: result.fats,
        carbs: result.carbs,
        goal_type: goalTypeMap[formData.goal] || formData.goal,
        current_weight: Number(formData.weight),
        target_weight: effectiveTargetWeight,
        start_date: startDate,
        end_date: isMaintainGoal ? null : endDate || undefined,
        months_to_goal: isMaintainGoal ? 0 : result.monthsToGoal,
        bmr: Math.round(result.bmr),
        tdee: Math.round(result.tdee),
        training_place: formData.trainingPlace || 'home',
        gender: formData.gender,
        age: Number(formData.age),
        height: Number(formData.height),
        lifestyle: formData.lifestyle,
        intensity: formData.intensity,
      });

      if (saveResult.status === 'failed') {
        setSaveNotice({ type: 'error', text: 'Не удалось сохранить цель.' });
        return;
      }

      if (saveResult.status === 'success_local_only') {
        setSaveNotice({
          type: 'warning',
          text: 'Цель сохранена только на этом устройстве. Подключитесь к интернету и попробуйте сохранить снова.',
        });
        return;
      }

      navigate('/goal');

      const today = getLocalDayKey();
      const context: DayAnalysisContext = {
        date: today,
        totals: { calories: 0, protein: 0, fat: 0, carbs: 0, weight: 0 },
        meals: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
        goals: {
          calories: Math.round(result.calories),
          protein: result.proteins,
          fat: result.fats,
          carbs: result.carbs,
        },
      };
      void aiRecommendationsService
        .queueDayRecommendation(user.id, context, `goal-${user.id}-${today}`)
        .catch(() => {});

      void profileService.saveProfile(user.id, {
        age: Number(formData.age),
        height: Number(formData.height),
        goal: goalTypeMap[formData.goal] || formData.goal,
      });
    } catch (error) {
      setSaveNotice({ type: 'error', text: 'Не удалось сохранить цель.' });
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const handleClose = () => {
    navigate('/goal');
  };

  if (validationError) {
    return (
      <div
        className="flex flex-col bg-white dark:bg-gray-900 overflow-hidden"
        style={{ minWidth: '320px', maxHeight: '90dvh', height: 'auto' }}
      >
        <div className="mx-auto w-full flex flex-col" style={{ maxWidth: 480, maxHeight: '90dvh' }}>
          <header className="px-4 py-3 flex items-center justify-between">
            <div className="w-6" />
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              ВАШИ РЕЗУЛЬТАТЫ
            </h1>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </header>
          <main className="px-5 pb-5">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {validationError}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 w-full rounded-full border border-gray-900 dark:border-gray-300 py-3 text-sm font-semibold uppercase text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Вернуться к цели
            </button>
          </main>
        </div>
      </div>
    );
  }

  if (!formData || !result) {
    return (
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden" style={{ minWidth: '360px' }}>
        <div className="max-w-[768px] mx-auto w-full flex flex-col h-full items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-white dark:bg-gray-900 overflow-hidden"
      style={{ minWidth: '320px', maxHeight: '90dvh', height: 'auto' }}
    >
      <div className="mx-auto w-full flex flex-col" style={{ maxWidth: 480, maxHeight: '90dvh' }}>
        <header className="px-4 py-3 flex items-center justify-between">
          <div className="w-6" />
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
            ВАШИ РЕЗУЛЬТАТЫ
          </h1>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0 px-5 pb-4">
          <div className="space-y-3 text-sm text-gray-900 dark:text-white">
            <p>
              Ваш возраст: <span className="font-medium">{formData.age} лет</span>
            </p>
            <p>
              Ваш вес: <span className="font-medium">{formData.weight} кг</span>
            </p>
            {normalizeGoal(formData.goal) !== 'maintain' && formData.targetWeight && (
              <p>
                Ваша цель: <span className="font-medium">{formData.targetWeight} кг</span>
              </p>
            )}
            <p>
              Образ жизни: <span className="font-medium">{getLifestyleLabel(formData.lifestyle)}</span>
            </p>
            <p>
              Кол-во тренировок в неделю: <span className="font-medium">{getWorkoutsPerWeek(formData.lifestyle)}</span>
            </p>
            <p>
              Тренировки: <span className="font-medium">{getTrainingPlaceLabel(formData.trainingPlace)}</span>
            </p>
          </div>

          {result.monthsToGoal > 0 && (
            <p className="mt-4 text-sm text-gray-900 dark:text-white">
              Для достижения цели: понадобится{' '}
              <span className="font-medium">
                {result.monthsToGoal} {result.monthsToGoal === 1 ? 'месяц' : result.monthsToGoal < 5 ? 'месяца' : 'месяцев'}
              </span>
            </p>
          )}
          <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>
              BMR (базовый метаболизм):{' '}
              <span className="font-medium text-gray-900 dark:text-white">{Math.round(result.bmr)} ккал</span>
            </p>
            <p>
              TDEE (общий расход энергии):{' '}
              <span className="font-medium text-gray-900 dark:text-white">{Math.round(result.tdee)} ккал</span>
            </p>
          </div>

          <div className="mt-4 text-sm text-gray-700 dark:text-gray-300">
            Ваш суточный калораж:
          </div>

          <div className="mt-2 grid grid-cols-2 min-[360px]:grid-cols-4 gap-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-gray-600 dark:text-gray-400">калории</span>
              <div className="w-full rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1 text-center text-sm font-medium text-gray-900 dark:text-white">
                {result.calories}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-gray-600 dark:text-gray-400">белки</span>
              <div className="w-full rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1 text-center text-sm font-medium text-gray-900 dark:text-white">
                {result.proteins}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-gray-600 dark:text-gray-400">жиры</span>
              <div className="w-full rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1 text-center text-sm font-medium text-gray-900 dark:text-white">
                {result.fats}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-gray-600 dark:text-gray-400">углеводы</span>
              <div className="w-full rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1 text-center text-sm font-medium text-gray-900 dark:text-white">
                {result.carbs}
              </div>
            </div>
          </div>

        </main>

        <div
          className="px-5 pt-2 pb-4 border-t border-gray-100 dark:border-gray-800"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          <button
            onClick={handleSave}
            className="w-full rounded-full border border-gray-900 dark:border-gray-300 py-3 text-sm font-semibold uppercase text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            СОХРАНИТЬ
          </button>
          {saveNotice && (
            <p
              className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                saveNotice.type === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {saveNotice.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalResult;
