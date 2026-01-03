/**
 * Маппинг английских меток ML-модели на продукты из базы
 * Используется для сопоставления результатов распознавания с локальной базой продуктов
 */

import { Food } from '../types';
import { foodService } from '../services/foodService';

export interface LabelMapping {
  label: string; // Английская метка от ML-модели
  russianName: string; // Русское название для поиска
  searchTerms: string[]; // Дополнительные термины для поиска
  defaultWeight?: number; // Оценочный вес по умолчанию (г)
  confidence?: number; // Уверенность в маппинге
}

/**
 * Таблица маппинга меток на продукты
 * Ключ - английская метка (lowercase), значение - информация для поиска
 */
const LABEL_TO_FOOD_MAP: Record<string, LabelMapping> = {
  // Мясо
  'chicken': { russianName: 'Курица', searchTerms: ['курица', 'куриная грудка', 'куриное филе'], defaultWeight: 150 },
  'chicken breast': { russianName: 'Куриная грудка', searchTerms: ['курица', 'куриная грудка'], defaultWeight: 150 },
  'beef': { russianName: 'Говядина', searchTerms: ['говядина', 'говяжий'], defaultWeight: 150 },
  'pork': { russianName: 'Свинина', searchTerms: ['свинина', 'свиной'], defaultWeight: 150 },
  'turkey': { russianName: 'Индейка', searchTerms: ['индейка', 'индюшка'], defaultWeight: 150 },
  
  // Рыба
  'salmon': { russianName: 'Лосось', searchTerms: ['лосось', 'семга'], defaultWeight: 150 },
  'fish': { russianName: 'Рыба', searchTerms: ['рыба', 'рыбное филе'], defaultWeight: 150 },
  'tuna': { russianName: 'Тунец', searchTerms: ['тунец'], defaultWeight: 150 },
  
  // Гарниры
  'rice': { russianName: 'Рис', searchTerms: ['рис', 'рис отварной'], defaultWeight: 200 },
  'pasta': { russianName: 'Макароны', searchTerms: ['макароны', 'паста'], defaultWeight: 200 },
  'noodles': { russianName: 'Лапша', searchTerms: ['лапша', 'вермишель'], defaultWeight: 200 },
  'potato': { russianName: 'Картофель', searchTerms: ['картофель', 'картошка'], defaultWeight: 200 },
  'potatoes': { russianName: 'Картофель', searchTerms: ['картофель', 'картошка'], defaultWeight: 200 },
  'bread': { russianName: 'Хлеб', searchTerms: ['хлеб', 'хлеб белый'], defaultWeight: 50 },
  
  // Овощи
  'tomato': { russianName: 'Помидор', searchTerms: ['помидор', 'томат'], defaultWeight: 150 },
  'tomatoes': { russianName: 'Помидор', searchTerms: ['помидор', 'томат'], defaultWeight: 150 },
  'cucumber': { russianName: 'Огурец', searchTerms: ['огурец'], defaultWeight: 100 },
  'carrot': { russianName: 'Морковь', searchTerms: ['морковь'], defaultWeight: 100 },
  'carrots': { russianName: 'Морковь', searchTerms: ['морковь'], defaultWeight: 100 },
  'bell pepper': { russianName: 'Перец болгарский', searchTerms: ['перец', 'болгарский перец'], defaultWeight: 150 },
  'pepper': { russianName: 'Перец', searchTerms: ['перец'], defaultWeight: 100 },
  'onion': { russianName: 'Лук', searchTerms: ['лук', 'лук репчатый'], defaultWeight: 100 },
  'salad': { russianName: 'Салат', searchTerms: ['салат', 'салат листовой'], defaultWeight: 100 },
  'lettuce': { russianName: 'Салат', searchTerms: ['салат', 'салат листовой'], defaultWeight: 100 },
  'broccoli': { russianName: 'Брокколи', searchTerms: ['брокколи'], defaultWeight: 150 },
  'cabbage': { russianName: 'Капуста', searchTerms: ['капуста', 'капуста белокочанная'], defaultWeight: 150 },
  
  // Фрукты
  'apple': { russianName: 'Яблоко', searchTerms: ['яблоко'], defaultWeight: 150 },
  'banana': { russianName: 'Банан', searchTerms: ['банан'], defaultWeight: 120 },
  'orange': { russianName: 'Апельсин', searchTerms: ['апельсин'], defaultWeight: 150 },
  'avocado': { russianName: 'Авокадо', searchTerms: ['авокадо'], defaultWeight: 150 },
  
  // Молочные продукты
  'cheese': { russianName: 'Сыр', searchTerms: ['сыр', 'сыр твердый'], defaultWeight: 50 },
  'milk': { russianName: 'Молоко', searchTerms: ['молоко'], defaultWeight: 200 },
  'yogurt': { russianName: 'Йогурт', searchTerms: ['йогурт'], defaultWeight: 150 },
  'egg': { russianName: 'Яйцо', searchTerms: ['яйцо', 'яйцо куриное'], defaultWeight: 60 },
  'eggs': { russianName: 'Яйцо', searchTerms: ['яйцо', 'яйцо куриное'], defaultWeight: 60 },
  
  // Блюда
  'pizza': { russianName: 'Пицца', searchTerms: ['пицца'], defaultWeight: 300 },
  'burger': { russianName: 'Бургер', searchTerms: ['бургер', 'гамбургер'], defaultWeight: 250 },
  'sandwich': { russianName: 'Сэндвич', searchTerms: ['сэндвич', 'бутерброд'], defaultWeight: 150 },
  'soup': { russianName: 'Суп', searchTerms: ['суп'], defaultWeight: 300 },
};

/**
 * Находит продукт в базе по метке ML-модели
 */
export async function mapLabelToFood(
  label: string,
  confidence: number = 0.5,
  userId?: string
): Promise<{ food: Food | null; estimatedWeight: number }> {
  const normalizedLabel = label.toLowerCase().trim();
  const mapping = LABEL_TO_FOOD_MAP[normalizedLabel];

  if (!mapping) {
    // Если нет точного маппинга, пробуем найти по метке как есть
    const searchResults = await foodService.search(label, { limit: 5, userId });
    if (searchResults.length > 0) {
      return {
        food: searchResults[0],
        estimatedWeight: estimateWeightByLabel(normalizedLabel, confidence),
      };
    }
    return { food: null, estimatedWeight: estimateWeightByLabel(normalizedLabel, confidence) };
  }

  // Ищем продукт по русскому названию и синонимам
  const searchTerms = [mapping.russianName, ...mapping.searchTerms];
  let foundFood: Food | null = null;

  for (const term of searchTerms) {
    const results = await foodService.search(term, { limit: 3, userId });
    if (results.length > 0) {
      foundFood = results[0];
      break;
    }
  }

  return {
    food: foundFood,
    estimatedWeight: mapping.defaultWeight || estimateWeightByLabel(normalizedLabel, confidence),
  };
}

/**
 * Оценка веса на основе метки и уверенности
 * Использует эвристики для разных категорий продуктов
 */
export function estimateWeightByLabel(label: string, confidence: number = 0.5): number {
  const normalizedLabel = label.toLowerCase().trim();
  const mapping = LABEL_TO_FOOD_MAP[normalizedLabel];

  if (mapping?.defaultWeight) {
    // Корректируем вес на основе уверенности (confidence)
    const baseWeight = mapping.defaultWeight;
    const confidenceMultiplier = 0.7 + (confidence * 0.3); // От 70% до 100% от базового веса
    return Math.round(baseWeight * confidenceMultiplier);
  }

  // Эвристики по категориям
  const meatKeywords = ['chicken', 'beef', 'pork', 'turkey', 'meat', 'fish', 'salmon', 'tuna'];
  const sideKeywords = ['rice', 'pasta', 'noodles', 'potato', 'potatoes'];
  const soupKeywords = ['soup', 'stew'];
  const fruitKeywords = ['apple', 'banana', 'orange', 'avocado'];
  const vegetableKeywords = ['tomato', 'cucumber', 'carrot', 'pepper', 'salad', 'lettuce', 'broccoli', 'cabbage'];

  if (meatKeywords.some(k => normalizedLabel.includes(k))) {
    return Math.round(120 + (confidence * 60)); // 120-180 г
  }
  if (sideKeywords.some(k => normalizedLabel.includes(k))) {
    return Math.round(150 + (confidence * 50)); // 150-200 г
  }
  if (soupKeywords.some(k => normalizedLabel.includes(k))) {
    return Math.round(250 + (confidence * 100)); // 250-350 г
  }
  if (fruitKeywords.some(k => normalizedLabel.includes(k))) {
    return Math.round(100 + (confidence * 50)); // 100-150 г
  }
  if (vegetableKeywords.some(k => normalizedLabel.includes(k))) {
    return Math.round(100 + (confidence * 50)); // 100-150 г
  }

  // Дефолт: средняя порция
  return Math.round(150 + (confidence * 50)); // 150-200 г
}

