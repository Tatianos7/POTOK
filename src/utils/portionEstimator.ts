/**
 * Утилиты для оценки веса порции на основе типа продукта
 * Используются эвристики, основанные на типичных порциях
 */

export interface PortionEstimate {
  min: number; // Минимальный вес (г)
  max: number; // Максимальный вес (г)
  average: number; // Средний вес (г)
  category: 'meat' | 'side' | 'soup' | 'fruit' | 'vegetable' | 'dairy' | 'grain' | 'other';
}

/**
 * Оценка веса порции на основе категории продукта
 */
export function estimatePortionByCategory(category: string): PortionEstimate {
  const normalizedCategory = category.toLowerCase().trim();

  // Мясо и рыба
  if (['meat', 'fish', 'chicken', 'beef', 'pork', 'turkey', 'salmon', 'tuna'].some(k => normalizedCategory.includes(k))) {
    return {
      min: 120,
      max: 180,
      average: 150,
      category: 'meat',
    };
  }

  // Гарниры
  if (['rice', 'pasta', 'noodles', 'potato', 'grains', 'grain'].some(k => normalizedCategory.includes(k))) {
    return {
      min: 150,
      max: 200,
      average: 175,
      category: 'side',
    };
  }

  // Супы
  if (['soup', 'stew', 'broth'].some(k => normalizedCategory.includes(k))) {
    return {
      min: 250,
      max: 350,
      average: 300,
      category: 'soup',
    };
  }

  // Фрукты
  if (['fruit', 'apple', 'banana', 'orange', 'avocado'].some(k => normalizedCategory.includes(k))) {
    return {
      min: 100,
      max: 150,
      average: 125,
      category: 'fruit',
    };
  }

  // Овощи
  if (['vegetable', 'vegetables', 'tomato', 'cucumber', 'carrot', 'pepper', 'salad', 'lettuce', 'broccoli', 'cabbage'].some(k => normalizedCategory.includes(k))) {
    return {
      min: 100,
      max: 150,
      average: 125,
      category: 'vegetable',
    };
  }

  // Молочные продукты
  if (['dairy', 'cheese', 'milk', 'yogurt', 'egg', 'eggs'].some(k => normalizedCategory.includes(k))) {
    return {
      min: 50,
      max: 150,
      average: 100,
      category: 'dairy',
    };
  }

  // Хлеб и выпечка
  if (['bread', 'grain', 'bakery'].some(k => normalizedCategory.includes(k))) {
    return {
      min: 30,
      max: 80,
      average: 50,
      category: 'grain',
    };
  }

  // Дефолт
  return {
    min: 100,
    max: 200,
    average: 150,
    category: 'other',
  };
}

/**
 * Оценка веса с учетом уверенности модели
 */
export function estimateWeightWithConfidence(
  baseEstimate: PortionEstimate,
  confidence: number
): number {
  // confidence от 0 до 1
  // При низкой уверенности используем среднее значение
  // При высокой уверенности можем скорректировать в сторону min или max
  const confidenceMultiplier = 0.7 + (confidence * 0.3); // От 70% до 100%
  return Math.round(baseEstimate.average * confidenceMultiplier);
}

