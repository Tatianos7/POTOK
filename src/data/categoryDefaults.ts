// Средние значения КБЖУ по категориям для автозаполнения
export interface CategoryDefaults {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export const CATEGORY_DEFAULTS: Record<string, CategoryDefaults> = {
  vegetables: {
    calories: 25,
    protein: 1.5,
    fat: 0.2,
    carbs: 5.0,
  },
  fruits: {
    calories: 50,
    protein: 0.5,
    fat: 0.2,
    carbs: 12.0,
  },
  meat: {
    calories: 200,
    protein: 25.0,
    fat: 10.0,
    carbs: 0.0,
  },
  fish: {
    calories: 150,
    protein: 22.0,
    fat: 5.0,
    carbs: 0.0,
  },
  dairy: {
    calories: 100,
    protein: 8.0,
    fat: 5.0,
    carbs: 4.0,
  },
  grains: {
    calories: 350,
    protein: 10.0,
    fat: 2.0,
    carbs: 70.0,
  },
  eggs: {
    calories: 157,
    protein: 12.7,
    fat: 11.5,
    carbs: 0.7,
  },
  fastfood: {
    calories: 300,
    protein: 12.0,
    fat: 15.0,
    carbs: 30.0,
  },
  beverages: {
    calories: 40,
    protein: 0.0,
    fat: 0.0,
    carbs: 10.0,
  },
  bread: {
    calories: 265,
    protein: 9.0,
    fat: 3.2,
    carbs: 49.0,
  },
  canned: {
    calories: 80,
    protein: 5.0,
    fat: 2.0,
    carbs: 10.0,
  },
  snacks: {
    calories: 500,
    protein: 8.0,
    fat: 30.0,
    carbs: 50.0,
  },
  desserts: {
    calories: 400,
    protein: 5.0,
    fat: 20.0,
    carbs: 50.0,
  },
  sports: {
    calories: 350,
    protein: 30.0,
    fat: 5.0,
    carbs: 40.0,
  },
  oils: {
    calories: 884,
    protein: 0.0,
    fat: 100.0,
    carbs: 0.0,
  },
  nuts: {
    calories: 600,
    protein: 20.0,
    fat: 50.0,
    carbs: 20.0,
  },
};
