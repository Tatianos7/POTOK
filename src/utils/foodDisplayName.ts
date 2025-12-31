import { Food } from '../types';

/**
 * Форматирует название продукта для отображения
 * Если у продукта есть марка, возвращает "Название (Марка)"
 * Иначе возвращает просто "Название"
 */
export const getFoodDisplayName = (food: Food | null | undefined): string => {
  if (!food) return '';
  
  if (food.brand && food.brand.trim()) {
    return `${food.name} (${food.brand.trim()})`;
  }
  
  return food.name;
};

