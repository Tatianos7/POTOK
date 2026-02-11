import { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';
import { GoalFormData } from '../components/CreateGoalModal';
import { goalService } from '../services/goalService';
import { profileService } from '../services/profileService';
import { uiRuntimeAdapter } from '../services/uiRuntimeAdapter';

interface CalculatedResult {
  bmr: number;
  tdee: number;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  monthsToGoal: number;
  surplusPerDay?: number;
  kgPerWeek?: number;
}

// Расчет BMR по формуле Харриса-Бенедикта
const calculateBMR = (gender: 'male' | 'female', weight: number, height: number, age: number): number => {
  if (gender === 'male') {
    // Мужчина: BMR = 88.362 + (13.397 × вес) + (4.799 × рост) – (5.677 × возраст)
    return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
  } else {
    // Женщина: BMR = 447.593 + (9.247 × вес) + (3.098 × рост) – (4.330 × возраст)
    return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
  }
};

// Получение коэффициента активности
const getActivityFactor = (lifestyle: string): number => {
  const factors: Record<string, number> = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'high': 1.725,
    'very-high': 1.9,
  };
  return factors[lifestyle] || 1.2;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

// Расчет калорий с учетом цели
const calculateCalories = (
  bmr: number,
  activityFactor: number,
  goal: string,
  intensity?: string
): { tdee: number; calories: number; surplusPerDay?: number } => {
  // TDEE = BMR × activityFactor
  const tdee = bmr * activityFactor;

  let calories = tdee;
  let surplusPerDay: number | undefined;

  if (goal === 'weight-loss') {
    // Похудение: calories = TDEE × (1 - deficitPercent)
    const deficitPercent = intensity ? parseFloat(intensity) / 100 : 0.10; // 10%, 15% или 20%
    calories = tdee * (1 - deficitPercent);
  } else if (goal === 'gain') {
    // Набор массы: calories = TDEE + профицит (200-500 ккал)
    const surplusPercent = 0.15;
    const dailySurplusTarget = clamp(tdee * surplusPercent, 200, 500);
    calories = tdee + dailySurplusTarget;
    surplusPerDay = dailySurplusTarget;
  }
  // Для 'maintain' оставляем как есть (calories = tdee)

  return {
    tdee: Math.round(tdee),
    calories: Math.round(calories),
    surplusPerDay: surplusPerDay ? Math.round(surplusPerDay) : undefined,
  };
};

// Расчет макронутриентов
const calculateMacros = (weight: number, totalCalories: number): { proteins: number; fats: number; carbs: number } => {
  // Белки: 2 г на кг веса (точное значение)
  const proteinsExact = weight * 2;
  
  // Жиры: 0.9 г на кг веса (точное значение)
  const fatsExact = weight * 0.9;
  
  // Округляем белки и жиры
  const proteins = Math.round(proteinsExact);
  const fats = Math.round(fatsExact);

  // Калории от округленных белков и жиров
  const caloriesProtein = proteins * 4;
  const caloriesFat = fats * 9;
  
  // Рассчитываем калории для углеводов так, чтобы сумма точно совпадала с totalCalories
  const caloriesForCarbs = totalCalories - caloriesProtein - caloriesFat;
  
  // Рассчитываем углеводы (точное значение)
  const carbsExact = caloriesForCarbs / 4;
  
  // Пробуем оба варианта округления и выбираем лучший
  const carbsFloor = Math.floor(carbsExact);
  const carbsCeil = Math.ceil(carbsExact);
  
  const totalWithFloor = caloriesProtein + caloriesFat + (carbsFloor * 4);
  const totalWithCeil = caloriesProtein + caloriesFat + (carbsCeil * 4);
  
  const diffFloor = Math.abs(totalWithFloor - totalCalories);
  const diffCeil = Math.abs(totalWithCeil - totalCalories);
  
  // Выбираем вариант с минимальной разницей
  let carbs: number;
  if (diffFloor <= diffCeil) {
    carbs = carbsFloor;
  } else {
    carbs = carbsCeil;
  }
  
  // Финальная проверка суммы (для отладки, если нужно)
  // При работе с целыми граммами точное совпадение не всегда возможно
  // (например, если остаток 515 ккал, то 515/4 = 128.75, и любое округление даст погрешность)

  return {
    proteins,
    fats,
    carbs,
  };
};

// Расчет времени достижения цели
const calculateMonthsToGoal = (
  currentWeight: number,
  targetWeight: number,
  tdee: number,
  calories: number
): number => {
  const weightToLose = currentWeight - targetWeight;
  
  if (weightToLose <= 0) return 0;
  
  // Дефицит калорий в день
  const deficit = tdee - calories;
  
  if (deficit <= 0) return 0;
  
  // 1 кг жира = ~7700 ккал
  // Дефицит в день * 30 дней = дефицит в месяц
  const monthlyDeficit = deficit * 30;
  // Сколько кг можно потерять в месяц
  const kgPerMonth = monthlyDeficit / 7700;
  
  if (kgPerMonth <= 0) return 0;
  
  const months = Math.ceil(weightToLose / kgPerMonth);
  return Math.max(1, Math.min(months, 12)); // От 1 до 12 месяцев
};

const calculateMonthsToGain = (
  currentWeight: number,
  targetWeight: number,
  tdee: number,
  calories: number
): number => {
  const surplus = calories - tdee;
  if (surplus <= 0) return 0;

  const kgToGain = targetWeight - currentWeight;
  if (kgToGain <= 0) return 0;

  const kgPerWeek = (surplus * 7) / 7700;
  if (kgPerWeek <= 0) return 0;

  const weeks = kgToGain / kgPerWeek;
  const months = weeks / 4.345;
  return Math.max(1, Math.ceil(months));
};

const GoalResult = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState<GoalFormData | null>(null);
  const [result, setResult] = useState<CalculatedResult | null>(null);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Получаем данные формы из location.state или localStorage
    const data = location.state?.formData || null;
    if (data) {
      const weight = parseFloat(data.weight) || 70;
      let targetWeight = parseFloat(data.targetWeight || '');

      if (data.goal === 'gain') {
        if (!Number.isFinite(targetWeight) || targetWeight <= weight) {
          targetWeight = Math.min(weight + 5, 150);
        }
      }

      setFormData({
        ...data,
        targetWeight: Number.isFinite(targetWeight) ? String(targetWeight) : data.targetWeight,
      });
    } else {
      // Если данных нет, возвращаемся на страницу цели
      navigate('/goal');
    }
  }, [user, navigate, location]);

  useEffect(() => {
    if (!formData) return;

    const age = parseInt(formData.age) || 25;
    const weight = parseFloat(formData.weight) || 70;
    const height = parseFloat(formData.height) || 170;

    const bmr = calculateBMR(formData.gender, weight, height, age);
    const activityFactor = getActivityFactor(formData.lifestyle);

    const { tdee, calories, surplusPerDay } = calculateCalories(
      bmr,
      activityFactor,
      formData.goal,
      formData.intensity
    );

    const { proteins, fats, carbs } = calculateMacros(weight, calories);

    let monthsToGoal = 0;
    let kgPerWeek: number | undefined;
    const parsedTargetWeight = parseFloat(formData.targetWeight || '');

    if (formData.goal === 'weight-loss' && Number.isFinite(parsedTargetWeight)) {
      monthsToGoal = calculateMonthsToGoal(weight, parsedTargetWeight, tdee, calories);
    }

    if (formData.goal === 'gain' && Number.isFinite(parsedTargetWeight)) {
      monthsToGoal = calculateMonthsToGain(weight, parsedTargetWeight, tdee, calories);
      if (surplusPerDay && surplusPerDay > 0) {
        kgPerWeek = (surplusPerDay * 7) / 7700;
      }
    }

    setResult({
      bmr: Math.round(bmr),
      tdee,
      calories,
      proteins,
      fats,
      carbs,
      monthsToGoal,
      surplusPerDay,
      kgPerWeek,
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

  const handleSave = () => {
    if (!user?.id || !formData || !result) return;
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;

    const goalTypeMap: Record<string, string> = {
      'weight-loss': 'Похудение',
      'maintain': 'Поддержка формы',
      'gain': 'Набор массы',
    };

    const startDate = new Date().toISOString().split('T')[0];
    
    // Рассчитываем дату окончания на основе месяцев до цели
    let endDate = '';
    if (formData.goal === 'weight-loss' && result.monthsToGoal > 0) {
      const endDateObj = new Date();
      endDateObj.setMonth(endDateObj.getMonth() + result.monthsToGoal);
      endDate = endDateObj.toISOString().split('T')[0];
    }

    // Save additional goal data to localStorage (goalType, dates, etc.)
    const goalData = {
      goalType: goalTypeMap[formData.goal] || formData.goal,
      gender: formData.gender, // Сохраняем пол
      age: formData.age, // Сохраняем возраст
      weight: formData.weight, // Сохраняем вес
      currentWeight: formData.weight, // Сохраняем текущий вес
      height: formData.height, // Сохраняем рост
      lifestyle: formData.lifestyle, // Сохраняем образ жизни
      targetWeight: formData.targetWeight || formData.weight,
      intensity: formData.intensity, // Сохраняем интенсивность
      startDate: startDate,
      endDate: endDate, // Сохраняем дату окончания
      monthsToGoal: result.monthsToGoal, // Сохраняем месяцы до цели
      bmr: Math.round(result.bmr),
      tdee: Math.round(result.tdee),
      surplusPerDay: result.surplusPerDay,
      kgPerWeek: result.kgPerWeek,
      calories: result.calories.toString(),
      proteins: result.proteins.toString(),
      fats: result.fats.toString(),
      carbs: result.carbs.toString(),
    };

    localStorage.setItem(`goal_${user.id}`, JSON.stringify(goalData));

    // Fire-and-forget: do not block UI transition on network calls
    void goalService.saveUserGoal(user.id, {
      calories: result.calories,
      protein: result.proteins,
      fat: result.fats,
      carbs: result.carbs,
    });

    void profileService.saveProfile(user.id, {
      age: Number(formData.age),
      height: Number(formData.height),
      goal: goalTypeMap[formData.goal] || formData.goal,
    });

    navigate('/goal');
  };

  const handleClose = () => {
    navigate('/goal');
  };

  if (!formData || !result) {
    return (
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden" style={{ minWidth: '360px' }}>
        <div className="max-w-[768px] mx-auto w-full flex flex-col h-full items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  const isPremium = Boolean(user?.hasPremium ?? profile?.has_premium ?? false);

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
            {formData.targetWeight && (
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
          </div>

          {formData.goal === 'weight-loss' && result.monthsToGoal > 0 && (
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

          {!isPremium && (
            <button
              type="button"
              onClick={() => navigate('/paywall')}
              className="mt-4 text-sm font-medium text-green-600 dark:text-green-400 break-words text-left cursor-pointer"
            >
              при подключении тарифа PREMIUM вы получите план питания и тренировок под вашу цель
            </button>
          )}
        </main>

        <div
          className="px-5 pb-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          <button
            onClick={handleSave}
            className="w-full rounded-full border border-gray-900 dark:border-gray-300 py-3 text-sm font-semibold uppercase text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            СОХРАНИТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoalResult;
