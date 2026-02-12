import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { goalService } from '../services/goalService';
import { aiAdviceService } from '../services/aiAdviceService';
import { UserGoalData, AiAdviceResponse } from '../types/aiAdvice';

interface UseAiAdviceReturn {
  nutritionAdvice: string | null;
  trainingAdvice: string | null;
  loading: boolean;
  error: string | null;
  regenerate: () => Promise<void>;
  userGoalData: UserGoalData | null;
}

/**
 * Хук для получения и управления AI-советами
 */
export function useAiAdvice(): UseAiAdviceReturn {
  const { user } = useAuth();
  const [userGoalData, setUserGoalData] = useState<UserGoalData | null>(null);
  const [advice, setAdvice] = useState<AiAdviceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Загружает данные цели пользователя
   */
  const loadGoalData = useCallback(async (): Promise<UserGoalData | null> => {
    if (!user?.id) {
      return null;
    }

    try {
      // Загружаем цель из Supabase (source of truth)
      const supabaseGoal = await goalService.getUserGoal(user.id);
      
      // Загружаем дополнительные данные из localStorage
      const savedGoal = localStorage.getItem(`goal_${user.id}`);
      let goalData: any = {};
      
      if (savedGoal) {
        try {
          goalData = JSON.parse(savedGoal);
        } catch (error) {
          console.error('Ошибка парсинга данных цели:', error);
        }
      }

      // Если есть данные из Supabase, используем их как primary source
      if (supabaseGoal) {
        goalData = {
          ...goalData,
          calories: supabaseGoal.calories,
          proteins: supabaseGoal.protein,
          fats: supabaseGoal.fat,
          carbs: supabaseGoal.carbs,
          goalType: supabaseGoal.goal_type || goalData.goalType,
          currentWeight: supabaseGoal.current_weight ?? goalData.currentWeight,
          targetWeight: supabaseGoal.target_weight ?? goalData.targetWeight,
          age: supabaseGoal.age ?? goalData.age,
          height: supabaseGoal.height ?? goalData.height,
          gender: supabaseGoal.gender ?? goalData.gender,
          lifestyle: supabaseGoal.lifestyle ?? goalData.lifestyle,
          intensity: supabaseGoal.intensity ?? goalData.intensity,
          trainingPlace: supabaseGoal.training_place ?? goalData.trainingPlace ?? 'home',
        };
      }

      // Проверяем, есть ли все необходимые данные
      if (
        goalData.calories &&
        goalData.proteins &&
        goalData.fats &&
        goalData.carbs &&
        goalData.goalType
      ) {
        // Пытаемся получить данные из профиля пользователя
        const userProfile = user.profile;
        
        // Преобразуем goalType в новый формат
        const goal = 
          goalData.goalType === 'Похудение' ? 'lose' :
          goalData.goalType === 'Набор массы' ? 'gain' : 'maintain';

        // Преобразуем lifestyle в activityLevel
        const activityLevel = 
          goalData.lifestyle === 'sedentary' || goalData.lifestyle === 'light' ? 'low' :
          goalData.lifestyle === 'moderate' ? 'medium' : 'high';

        // Формируем UserGoalData
        const userGoalData: UserGoalData = {
          goal,
          trainingPlace: goalData.trainingPlace === 'gym' ? 'gym' : 'home',
          calories: Number(goalData.calories),
          protein: Number(goalData.proteins),
          fat: Number(goalData.fats),
          carbs: Number(goalData.carbs),
          age: parseInt(goalData.age) || userProfile?.age || 25,
          weight: parseFloat(goalData.currentWeight) || parseFloat(goalData.weight) || 70,
          height: parseFloat(goalData.height) || userProfile?.height || 170,
          gender: (goalData.gender as 'male' | 'female') || ((userProfile as any)?.gender as 'male' | 'female') || 'female',
          activityLevel,
          targetWeight: goalData.targetWeight ? parseFloat(goalData.targetWeight) : undefined,
          intensity: goalData.intensity ? parseInt(goalData.intensity) : undefined,
        };

        return userGoalData;
      }
    } catch (error) {
      console.error('Ошибка загрузки данных цели:', error);
    }

    return null;
  }, [user]);

  /**
   * Генерирует советы на основе данных пользователя
   */
  const generateAdvice = useCallback(async (data: UserGoalData) => {
    setLoading(true);
    setError(null);

    try {
      // Валидируем данные
      if (!aiAdviceService.validateUserData(data)) {
        throw new Error('Недостаточно данных для генерации рекомендаций');
      }

      // Генерируем советы через сервис
      const response = await aiAdviceService.generateAdvice(data);
      setAdvice(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Не удалось сгенерировать рекомендации';
      setError(errorMessage);
      console.error('[useAiAdvice] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Загружает данные и генерирует советы
   */
  const loadAndGenerate = useCallback(async () => {
    const data = await loadGoalData();
    if (data) {
      setUserGoalData(data);
      await generateAdvice(data);
    } else {
      setLoading(false);
    }
  }, [loadGoalData, generateAdvice]);

  /**
   * Перегенерирует советы
   */
  const regenerate = useCallback(async () => {
    if (userGoalData) {
      await generateAdvice(userGoalData);
    } else {
      await loadAndGenerate();
    }
  }, [userGoalData, generateAdvice, loadAndGenerate]);

  // Загружаем данные при монтировании
  useEffect(() => {
    loadAndGenerate();
  }, [loadAndGenerate]);

  return {
    nutritionAdvice: advice?.nutrition || null,
    trainingAdvice: advice?.training || null,
    loading,
    error,
    regenerate,
    userGoalData,
  };
}
