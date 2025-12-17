/**
 * ВРЕМЕННАЯ БАЗА ПРОДУКТОВ-ЗАГЛУШКА
 * 
 * Используется для тестирования логики дневника питания.
 * Это НЕ финальная база. Это ВРЕМЕННАЯ заглушка.
 * 
 * Все значения КБЖУ указаны НА 100 г.
 * Никаких штрих-кодов, внешних источников, нулевых КБЖУ.
 */

import { Food } from '../types';

export interface MockFoodProduct {
  id: string;
  name: string;
  category: 'Мясо' | 'Рыба' | 'Молочные' | 'Яйца' | 'Овощи' | 'Фрукты' | 'Гарниры' | 'Жиры';
  macrosPer100g: {
    calories: number;
    proteins: number;
    fats: number;
    carbs: number;
  };
  availableUnits: string[];
}

// Конвертация MockFoodProduct в Food для использования в приложении
export const convertMockFoodToFood = (mock: MockFoodProduct): Food => {
  const now = new Date().toISOString();
  return {
    id: mock.id,
    name: mock.name,
    calories: mock.macrosPer100g.calories,
    protein: mock.macrosPer100g.proteins,
    fat: mock.macrosPer100g.fats,
    carbs: mock.macrosPer100g.carbs,
    category: mock.category,
    source: 'local',
    barcode: null,
    brand: null,
    photo: null,
    aliases: [],
    autoFilled: false,
    popularity: 0,
    createdAt: now,
    updatedAt: now,
  };
};

export const mockFoodDatabase: MockFoodProduct[] = [
  // МЯСО
  {
    id: 'mock_meat_001',
    name: 'Куриная грудка (сырая)',
    category: 'Мясо',
    macrosPer100g: {
      calories: 120,
      proteins: 22,
      fats: 2,
      carbs: 0,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_meat_002',
    name: 'Индейка (филе)',
    category: 'Мясо',
    macrosPer100g: {
      calories: 135,
      proteins: 29,
      fats: 1,
      carbs: 0,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_meat_003',
    name: 'Говядина постная',
    category: 'Мясо',
    macrosPer100g: {
      calories: 170,
      proteins: 26,
      fats: 8,
      carbs: 0,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_meat_004',
    name: 'Свинина нежирная',
    category: 'Мясо',
    macrosPer100g: {
      calories: 242,
      proteins: 27,
      fats: 14,
      carbs: 0,
    },
    availableUnits: ['g'],
  },

  // РЫБА
  {
    id: 'mock_fish_001',
    name: 'Лосось',
    category: 'Рыба',
    macrosPer100g: {
      calories: 208,
      proteins: 20,
      fats: 13,
      carbs: 0,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_fish_002',
    name: 'Треска',
    category: 'Рыба',
    macrosPer100g: {
      calories: 82,
      proteins: 18,
      fats: 0.7,
      carbs: 0,
    },
    availableUnits: ['g'],
  },

  // ЯЙЦА
  {
    id: 'mock_eggs_001',
    name: 'Яйцо куриное',
    category: 'Яйца',
    macrosPer100g: {
      calories: 155,
      proteins: 13,
      fats: 11,
      carbs: 1,
    },
    availableUnits: ['g', 'pcs'],
  },

  // МОЛОЧНЫЕ
  {
    id: 'mock_dairy_001',
    name: 'Молоко 2.5%',
    category: 'Молочные',
    macrosPer100g: {
      calories: 52,
      proteins: 3,
      fats: 2.5,
      carbs: 5,
    },
    availableUnits: ['g', 'ml'],
  },
  {
    id: 'mock_dairy_002',
    name: 'Кефир 2.5%',
    category: 'Молочные',
    macrosPer100g: {
      calories: 53,
      proteins: 3,
      fats: 2.5,
      carbs: 4,
    },
    availableUnits: ['g', 'ml'],
  },
  {
    id: 'mock_dairy_003',
    name: 'Творог 5%',
    category: 'Молочные',
    macrosPer100g: {
      calories: 121,
      proteins: 17,
      fats: 5,
      carbs: 3,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_dairy_004',
    name: 'Сыр твёрдый',
    category: 'Молочные',
    macrosPer100g: {
      calories: 350,
      proteins: 25,
      fats: 28,
      carbs: 2,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_dairy_005',
    name: 'Йогурт натуральный',
    category: 'Молочные',
    macrosPer100g: {
      calories: 59,
      proteins: 10,
      fats: 0.4,
      carbs: 3.6,
    },
    availableUnits: ['g', 'ml'],
  },

  // ОВОЩИ
  {
    id: 'mock_veg_001',
    name: 'Огурец',
    category: 'Овощи',
    macrosPer100g: {
      calories: 15,
      proteins: 0.8,
      fats: 0.1,
      carbs: 2.8,
    },
    availableUnits: ['g', 'pcs'],
  },
  {
    id: 'mock_veg_002',
    name: 'Помидор',
    category: 'Овощи',
    macrosPer100g: {
      calories: 18,
      proteins: 0.9,
      fats: 0.2,
      carbs: 3.9,
    },
    availableUnits: ['g', 'pcs'],
  },
  {
    id: 'mock_veg_003',
    name: 'Болгарский перец',
    category: 'Овощи',
    macrosPer100g: {
      calories: 27,
      proteins: 1.3,
      fats: 0.1,
      carbs: 6,
    },
    availableUnits: ['g', 'pcs'],
  },
  {
    id: 'mock_veg_004',
    name: 'Морковь',
    category: 'Овощи',
    macrosPer100g: {
      calories: 41,
      proteins: 1.3,
      fats: 0.1,
      carbs: 10,
    },
    availableUnits: ['g', 'pcs'],
  },
  {
    id: 'mock_veg_005',
    name: 'Кабачок',
    category: 'Овощи',
    macrosPer100g: {
      calories: 17,
      proteins: 1.2,
      fats: 0.3,
      carbs: 3.1,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_veg_006',
    name: 'Брокколи',
    category: 'Овощи',
    macrosPer100g: {
      calories: 34,
      proteins: 2.8,
      fats: 0.4,
      carbs: 7,
    },
    availableUnits: ['g'],
  },

  // ФРУКТЫ
  {
    id: 'mock_fruit_001',
    name: 'Яблоко',
    category: 'Фрукты',
    macrosPer100g: {
      calories: 52,
      proteins: 0.3,
      fats: 0.2,
      carbs: 14,
    },
    availableUnits: ['g', 'pcs'],
  },
  {
    id: 'mock_fruit_002',
    name: 'Банан',
    category: 'Фрукты',
    macrosPer100g: {
      calories: 96,
      proteins: 1.5,
      fats: 0.5,
      carbs: 21,
    },
    availableUnits: ['g', 'pcs'],
  },
  {
    id: 'mock_fruit_003',
    name: 'Апельсин',
    category: 'Фрукты',
    macrosPer100g: {
      calories: 47,
      proteins: 0.9,
      fats: 0.1,
      carbs: 12,
    },
    availableUnits: ['g', 'pcs'],
  },
  {
    id: 'mock_fruit_004',
    name: 'Груша',
    category: 'Фрукты',
    macrosPer100g: {
      calories: 57,
      proteins: 0.4,
      fats: 0.1,
      carbs: 15,
    },
    availableUnits: ['g', 'pcs'],
  },
  {
    id: 'mock_fruit_005',
    name: 'Киви',
    category: 'Фрукты',
    macrosPer100g: {
      calories: 61,
      proteins: 1.1,
      fats: 0.5,
      carbs: 15,
    },
    availableUnits: ['g', 'pcs'],
  },

  // ГАРНИРЫ
  {
    id: 'mock_side_001',
    name: 'Рис белый варёный',
    category: 'Гарниры',
    macrosPer100g: {
      calories: 130,
      proteins: 2.5,
      fats: 0.3,
      carbs: 28,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_side_002',
    name: 'Гречка варёная',
    category: 'Гарниры',
    macrosPer100g: {
      calories: 110,
      proteins: 4,
      fats: 1,
      carbs: 21,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_side_003',
    name: 'Макароны варёные',
    category: 'Гарниры',
    macrosPer100g: {
      calories: 131,
      proteins: 5,
      fats: 1.1,
      carbs: 25,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_side_004',
    name: 'Картофель варёный',
    category: 'Гарниры',
    macrosPer100g: {
      calories: 82,
      proteins: 2,
      fats: 0.4,
      carbs: 17,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_side_005',
    name: 'Пюре картофельное',
    category: 'Гарниры',
    macrosPer100g: {
      calories: 88,
      proteins: 2,
      fats: 3,
      carbs: 14,
    },
    availableUnits: ['g'],
  },

  // ЖИРЫ
  {
    id: 'mock_fat_001',
    name: 'Масло сливочное',
    category: 'Жиры',
    macrosPer100g: {
      calories: 717,
      proteins: 0.5,
      fats: 81,
      carbs: 0.1,
    },
    availableUnits: ['g'],
  },
  {
    id: 'mock_fat_002',
    name: 'Масло оливковое',
    category: 'Жиры',
    macrosPer100g: {
      calories: 884,
      proteins: 0,
      fats: 100,
      carbs: 0,
    },
    availableUnits: ['g', 'ml'],
  },
];

// Экспорт конвертированной базы для использования в foodService
export const mockFoodDatabaseAsFood: Food[] = mockFoodDatabase.map(convertMockFoodToFood);

