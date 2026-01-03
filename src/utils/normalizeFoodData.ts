/**
 * Утилита для нормализации данных продуктов из внешних источников
 * Приводит все макросы к значениям на 100 г
 */

import { Food, FoodSource } from '../types';

export interface RawFoodData {
  name: string;
  name_original?: string;
  barcode?: string | null;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  category?: string;
  brand?: string | null;
  photo?: string | null;
  aliases?: string[];
  serving_size?: number; // Размер порции в граммах (если указан)
  calories_per_serving?: number; // Калории на порцию (если указан)
  protein_per_serving?: number;
  fat_per_serving?: number;
  carbs_per_serving?: number;
}

/**
 * Нормализует данные продукта, приводя все макросы к значениям на 100 г
 * Если данные отсутствуют или некорректны, возвращает null
 */
export function normalizeFoodData(
  rawFood: RawFoodData,
  source: FoodSource,
  createdByUserId?: string | null
): Food | null {
  // Проверка обязательных полей
  if (!rawFood.name || !rawFood.name.trim()) {
    return null;
  }

  let calories = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;

  // Если указан размер порции и макросы на порцию - пересчитываем на 100г
  if (rawFood.serving_size && rawFood.serving_size > 0) {
    const multiplier = 100 / rawFood.serving_size;
    
    if (rawFood.calories_per_serving !== undefined) {
      calories = (rawFood.calories_per_serving || 0) * multiplier;
    } else if (rawFood.calories !== undefined) {
      calories = (rawFood.calories || 0) * multiplier;
    }

    if (rawFood.protein_per_serving !== undefined) {
      protein = (rawFood.protein_per_serving || 0) * multiplier;
    } else if (rawFood.protein !== undefined) {
      protein = (rawFood.protein || 0) * multiplier;
    }

    if (rawFood.fat_per_serving !== undefined) {
      fat = (rawFood.fat_per_serving || 0) * multiplier;
    } else if (rawFood.fat !== undefined) {
      fat = (rawFood.fat || 0) * multiplier;
    }

    if (rawFood.carbs_per_serving !== undefined) {
      carbs = (rawFood.carbs_per_serving || 0) * multiplier;
    } else if (rawFood.carbs !== undefined) {
      carbs = (rawFood.carbs || 0) * multiplier;
    }
  } else {
    // Если данные уже на 100г или не указан размер порции
    calories = rawFood.calories || 0;
    protein = rawFood.protein || 0;
    fat = rawFood.fat || 0;
    carbs = rawFood.carbs || 0;
  }

  // Проверка: если все макросы равны нулю, не импортируем продукт
  if (calories === 0 && protein === 0 && fat === 0 && carbs === 0) {
    return null;
  }

  // Ограничение значений (защита от некорректных данных)
  calories = Math.max(0, Math.min(1000, calories)); // Максимум 1000 ккал на 100г
  protein = Math.max(0, Math.min(100, protein)); // Максимум 100г белка на 100г
  fat = Math.max(0, Math.min(100, fat)); // Максимум 100г жира на 100г
  carbs = Math.max(0, Math.min(100, carbs)); // Максимум 100г углеводов на 100г

  const now = new Date().toISOString();

  return {
    id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: rawFood.name.trim(),
    name_original: rawFood.name_original?.trim() || undefined,
    barcode: rawFood.barcode || null,
    calories: Math.round(calories * 100) / 100, // Округляем до 2 знаков
    protein: Math.round(protein * 100) / 100,
    fat: Math.round(fat * 100) / 100,
    carbs: Math.round(carbs * 100) / 100,
    category: rawFood.category || undefined,
    brand: rawFood.brand || null,
    source,
    created_by_user_id: createdByUserId || null,
    photo: rawFood.photo || null,
    aliases: rawFood.aliases || [],
    autoFilled: false,
    popularity: 0,
    createdAt: now,
    updatedAt: now,
  };
}
