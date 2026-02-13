/**
 * Данные пользователя для генерации AI-советов
 */
export interface UserGoalData {
  goal: 'lose' | 'gain' | 'maintain';
  trainingPlace: 'home' | 'gym';
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  age: number;
  weight: number;
  height: number;
  gender: 'male' | 'female';
  activityLevel: 'low' | 'medium' | 'high';
  targetWeight?: number;
  intensity?: number; // процент дефицита для похудения
}

/**
 * Ответ от AI с рекомендациями
 */
export interface AiAdviceResponse {
  nutrition: string;
  training: string;
}
