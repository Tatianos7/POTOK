/**
 * Локальный анализатор еды по фото
 * Работает полностью на устройстве, без отправки фото на серверы
 * 
 * Архитектура:
 * 1. Анализ фото (локальная ML-модель или эвристики)
 * 2. Сопоставление с базой продуктов
 * 3. Оценка веса
 * 4. Расчет КБЖУ
 */

import { Food } from '../types';
import { mapLabelToFood } from '../utils/foodLabelMapper';
import { estimatePortionByCategory, estimateWeightWithConfidence } from '../utils/portionEstimator';

export interface PhotoAnalysisResult {
  food: Food | null; // Найденный продукт в базе
  detectedLabel: string; // Метка, распознанная моделью
  confidence: number; // Уверенность модели (0-1)
  estimatedWeight: number; // Оценочный вес (г)
  calories: number; // Калории на оценочный вес
  protein: number; // Белки на оценочный вес
  fat: number; // Жиры на оценочный вес
  carbs: number; // Углеводы на оценочный вес
  photoDataUrl?: string; // Base64 изображение (опционально, для предпросмотра)
}

/**
 * Простой анализатор фото продуктов
 * В будущем здесь можно подключить ONNX/TensorFlow.js модели
 */
class PhotoFoodAnalyzer {
  /**
   * Анализирует фото и возвращает результат с продуктом и КБЖУ
   * 
   * @param file - Файл изображения
   * @param userId - ID пользователя для поиска в базе
   * @returns Результат анализа с продуктом и КБЖУ
   */
  async analyzePhoto(file: File, userId?: string): Promise<PhotoAnalysisResult> {
    if (!file || file.size === 0) {
      throw new Error('Не удалось загрузить фото. Попробуйте другое изображение.');
    }

    // 1. Распознавание продукта (локальная модель или эвристика)
    const { label, confidence } = await this.detectFoodLabel(file);

    // 2. Сопоставление с базой продуктов
    const { food, estimatedWeight } = await mapLabelToFood(label, confidence, userId);

    // 3. Расчет КБЖУ на основе оценочного веса
    const macros = this.calculateMacros(food, estimatedWeight);

    // 4. Создаем preview изображения (опционально, только в памяти)
    const photoDataUrl = await this.createPreview(file);

    return {
      food,
      detectedLabel: label,
      confidence,
      estimatedWeight,
      ...macros,
      photoDataUrl,
    };
  }

  /**
   * Распознавание продукта на фото
   * Сейчас использует эвристики, в будущем можно подключить ONNX модель
   */
  private async detectFoodLabel(file: File): Promise<{ label: string; confidence: number }> {
    // TODO: Здесь можно подключить реальную ONNX модель (YOLOv8, Food-101)
    // Пока используем простую эвристику на основе анализа изображения
    
    // Попытка использовать существующий анализатор, если доступен
    try {
      const { localAIFoodAnalyzer } = await import('./localAIFoodAnalyzer');
      const result = await localAIFoodAnalyzer.analyzeImageLocal(file);
      
      if (result.ingredients && result.ingredients.length > 0) {
        // Берем первый ингредиент как основной продукт
        const mainIngredient = result.ingredients[0];
        return {
          label: mainIngredient.name.toLowerCase(),
          confidence: 0.7, // Средняя уверенность для локального анализа
        };
      }
    } catch (error) {
      console.warn('[PhotoFoodAnalyzer] Local AI analyzer not available, using fallback', error);
    }

    // Fallback: простая эвристика на основе размера и типа файла
    // В реальном приложении здесь должна быть ML-модель
    return {
      label: 'food', // Общая метка
      confidence: 0.5, // Низкая уверенность для fallback
    };
  }

  /**
   * Расчет КБЖУ на основе продукта и веса
   */
  private calculateMacros(food: Food | null, weight: number): {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  } {
    if (!food) {
      // Если продукт не найден, возвращаем нули
      return {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
      };
    }

    const multiplier = weight / 100;

    return {
      calories: Math.round(food.calories * multiplier),
      protein: Math.round((food.protein * multiplier) * 10) / 10,
      fat: Math.round((food.fat * multiplier) * 10) / 10,
      carbs: Math.round((food.carbs * multiplier) * 10) / 10,
    };
  }

  /**
   * Создает preview изображения в формате base64
   * Изображение хранится только в памяти, не сохраняется на диск
   */
  private async createPreview(file: File): Promise<string | undefined> {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.warn('[PhotoFoodAnalyzer] Failed to create preview', error);
      return undefined;
    }
  }

  /**
   * Пересчитывает КБЖУ при изменении веса
   */
  recalculateMacros(food: Food | null, weight: number): {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  } {
    return this.calculateMacros(food, weight);
  }
}

export const photoFoodAnalyzer = new PhotoFoodAnalyzer();

