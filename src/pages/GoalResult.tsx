import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';
import { GoalFormData } from '../components/CreateGoalModal';
import { goalService } from '../services/goalService';
import { profileService } from '../services/profileService';

interface CalculatedResult {
  bmr: number;
  tdee: number;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  monthsToGoal: number;
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

// Расчет калорий с учетом цели
const calculateCalories = (
  bmr: number,
  activityFactor: number,
  goal: string,
  intensity?: string
): { tdee: number; calories: number } => {
  // TDEE = BMR × activityFactor
  const tdee = bmr * activityFactor;

  let calories = tdee;

  if (goal === 'weight-loss') {
    // Похудение: calories = TDEE × (1 - deficitPercent)
    const deficitPercent = intensity ? parseFloat(intensity) / 100 : 0.10; // 10%, 15% или 20%
    calories = tdee * (1 - deficitPercent);
  } else if (goal === 'gain') {
    // Набор массы: calories = TDEE + 15%
    calories = tdee * 1.15;
  }
  // Для 'maintain' оставляем как есть (calories = tdee)

  return {
    tdee: Math.round(tdee),
    calories: Math.round(calories),
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

const GoalResult = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState<GoalFormData | null>(null);
  const [result, setResult] = useState<CalculatedResult | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Получаем данные формы из location.state или localStorage
    const data = location.state?.formData || null;
    if (data) {
      setFormData(data);
      
      // Парсим входные данные
      const age = parseInt(data.age) || 25;
      const weight = parseFloat(data.weight) || 70;
      const height = parseFloat(data.height) || 170;
      
      // Расчет BMR
      const bmr = calculateBMR(data.gender, weight, height, age);
      
      // Получение коэффициента активности
      const activityFactor = getActivityFactor(data.lifestyle);
      
      // Расчет калорий
      const { tdee, calories } = calculateCalories(
        bmr,
        activityFactor,
        data.goal,
        data.intensity
      );
      
      // Расчет макронутриентов
      const { proteins, fats, carbs } = calculateMacros(weight, calories);
      
      // Расчет времени достижения цели (только для похудения)
      let monthsToGoal = 0;
      if (data.goal === 'weight-loss' && data.targetWeight) {
        const targetWeight = parseFloat(data.targetWeight);
        monthsToGoal = calculateMonthsToGoal(weight, targetWeight, tdee, calories);
      }
      
      setResult({
        bmr: Math.round(bmr),
        tdee,
        calories,
        proteins,
        fats,
        carbs,
        monthsToGoal,
      });
    } else {
      // Если данных нет, возвращаемся на страницу цели
      navigate('/goal');
    }
  }, [user, navigate, location]);

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

  const handleSave = async () => {
    if (!user?.id || !formData || !result) return;

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

    // Save goal macros (source of truth)
    await goalService.saveUserGoal(user.id, {
      calories: result.calories,
      protein: result.proteins,
      fat: result.fats,
      carbs: result.carbs,
    });

    // Persist profile fields used across manual flow
    await profileService.saveProfile(user.id, {
      age: Number(formData.age),
      height: Number(formData.height),
      goal: goalTypeMap[formData.goal] || formData.goal,
    });

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
      calories: result.calories.toString(),
      proteins: result.proteins.toString(),
      fats: result.fats.toString(),
      carbs: result.carbs.toString(),
    };

    localStorage.setItem(`goal_${user.id}`, JSON.stringify(goalData));
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

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden" style={{ minWidth: '360px' }}>
      <div className="max-w-[768px] mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1"></div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase">
            ВАШИ РЕЗУЛЬТАТЫ
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
          {/* User Input Summary */}
          <div className="space-y-3 mb-6">
            <div>
              <p className="text-sm text-gray-900 dark:text-white">
                Ваш возраст: <span className="font-medium">{formData.age} лет</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-900 dark:text-white">
                Ваш вес: <span className="font-medium">{formData.weight} кг</span>
              </p>
            </div>
            {formData.goal === 'weight-loss' && formData.targetWeight && (
              <div>
                <p className="text-sm text-gray-900 dark:text-white">
                  Ваша цель: <span className="font-medium">{formData.targetWeight} кг</span>
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-900 dark:text-white">
                Образ жизни: <span className="font-medium">{getLifestyleLabel(formData.lifestyle)}</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-900 dark:text-white">
                Кол-во тренировок в неделю: <span className="font-medium">{getWorkoutsPerWeek(formData.lifestyle)}</span>
              </p>
            </div>
            {formData.goal === 'weight-loss' && formData.intensity && (
              <div>
                <p className="text-sm text-gray-900 dark:text-white">
                  Интенсивность похудения: <span className="font-medium">{formData.intensity}%</span>
                </p>
              </div>
            )}
          </div>

          {/* BMR and TDEE Display */}
          <div className="mb-6 space-y-2">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                BMR (базовый метаболизм): <span className="font-medium text-gray-900 dark:text-white">{result.bmr} ккал</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                TDEE (общий расход энергии): <span className="font-medium text-gray-900 dark:text-white">{result.tdee} ккал</span>
              </p>
            </div>
          </div>

          {/* Goal Achievement Estimate */}
          {formData.goal === 'weight-loss' && result.monthsToGoal > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-900 dark:text-white">
                Для достижения цели: понадобится <span className="font-medium">{result.monthsToGoal} {result.monthsToGoal === 1 ? 'месяц' : result.monthsToGoal < 5 ? 'месяца' : 'месяцев'}</span>
              </p>
            </div>
          )}

          {/* Daily Calorie and Macronutrient Section */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
              Ваш суточный калораж:
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  калории
                </label>
                <div className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center font-semibold text-gray-900 dark:text-white">
                  {result.calories}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  белки
                </label>
                <div className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center font-semibold text-gray-900 dark:text-white">
                  {result.proteins} г
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  жиры
                </label>
                <div className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center font-semibold text-gray-900 dark:text-white">
                  {result.fats} г
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  углеводы
                </label>
                <div className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center font-semibold text-gray-900 dark:text-white">
                  {result.carbs} г
                </div>
              </div>
            </div>
          </div>

          {/* Premium Feature Prompt */}
          <div className="mb-6 space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Советы по питанию
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Советы по тренировкам
            </p>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              при подключении тарифа PREMIUM вы получите персональный план питания и тренировок
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-6 pb-6">
            <button
              onClick={handleSave}
              style={{ height: '45px', minHeight: '45px', maxHeight: '45px', boxSizing: 'border-box' }}
              className="w-full max-w-full min-[768px]:button-limited mx-1 px-2.5 flex items-center justify-center rounded-xl font-semibold text-base uppercase bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-300 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              СОХРАНИТЬ
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default GoalResult;
