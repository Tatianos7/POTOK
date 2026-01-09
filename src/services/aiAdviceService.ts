import { UserGoalData, AiAdviceResponse } from '../types/aiAdvice';
import { generateAdvice } from '../api/generateAdvice';

/**
 * Сервис для генерации AI-советов
 * 
 * Единая точка входа для получения персональных рекомендаций.
 * В будущем здесь может быть кэширование, обработка ошибок и т.д.
 * 
 * TODO: replace stub with OpenAI / Claude / Gemini
 */
export class AiAdviceService {
  /**
   * Генерирует персональные советы по питанию и тренировкам
   * 
   * @param data - Данные пользователя для генерации советов
   * @returns Promise с рекомендациями
   */
  async generateAdvice(data: UserGoalData): Promise<AiAdviceResponse> {
    try {
      // Вызываем API endpoint
      const response = await generateAdvice(data);
      return response;
    } catch (error) {
      console.error('[AiAdviceService] Error generating advice:', error);
      throw new Error('Не удалось сгенерировать рекомендации. Попробуйте позже.');
    }
  }

  /**
   * Валидирует данные пользователя перед генерацией советов
   */
  validateUserData(data: Partial<UserGoalData>): data is UserGoalData {
    return (
      typeof data.goal === 'string' &&
      typeof data.calories === 'number' &&
      typeof data.protein === 'number' &&
      typeof data.fat === 'number' &&
      typeof data.carbs === 'number' &&
      typeof data.age === 'number' &&
      typeof data.weight === 'number' &&
      typeof data.height === 'number' &&
      typeof data.gender === 'string' &&
      typeof data.activityLevel === 'string'
    );
  }
}

export const aiAdviceService = new AiAdviceService();

