import { Food } from '../types';
import { FoodDisplayUnit } from './foodUnits';
import { pieceWeights } from '../data/unitConversions';

export interface FoodQuickPreset {
  quantity: number;
  unit: FoodDisplayUnit;
  label: string;
}

const LIQUID_CATEGORY_KEYS = new Set([
  'beverages',
  'drinks',
  'oils',
  'Напитки',
  'Жиры и масла',
]);

const LIQUID_NAME_PARTS = [
  'вода',
  'сок',
  'морс',
  'компот',
  'квас',
  'кефир',
  'молоко',
  'айран',
  'ряженка',
  'сливки',
  'бульон',
  'суп',
  'чай',
  'кофе',
  'напит',
  'йогурт пить',
  'масло',
];

const SPOON_NAME_PARTS = [
  'масло',
  'соус',
  'кетчуп',
  'майонез',
  'мёд',
  'мед',
  'варенье',
  'джем',
  'сироп',
  'сметана',
  'сливки',
  'паста',
];

const PIECE_NAME_PARTS = [
  ...Object.keys(pieceWeights),
  'яйцо',
  'банан',
  'яблоко',
  'груша',
  'апельсин',
  'мандарин',
  'помидор',
  'огурец',
  'авокадо',
];

const PIECE_CATEGORIES = new Set([
  'fruits',
  'vegetables',
  'Фрукты',
  'Овощи',
  'Яйца',
]);

const normalize = (value?: string | null): string => (value || '').toLowerCase().trim();

export const isLiquidLikeFood = (food: Pick<Food, 'name' | 'category' | 'unit'>): boolean => {
  const name = normalize(food.name);
  const category = (food.category || '').trim();
  const unit = normalize(food.unit);

  if (unit === 'ml' || unit === 'мл' || unit === 'l' || unit === 'л') {
    return true;
  }

  if (LIQUID_CATEGORY_KEYS.has(category)) {
    return true;
  }

  return LIQUID_NAME_PARTS.some((part) => name.includes(part));
};

export const supportsPieceUnit = (food: Pick<Food, 'name' | 'category'>): boolean => {
  const name = normalize(food.name);
  const category = (food.category || '').trim();

  if (PIECE_CATEGORIES.has(category)) {
    return true;
  }

  return PIECE_NAME_PARTS.some((part) => name.includes(part));
};

export const supportsSpoonUnits = (food: Pick<Food, 'name' | 'category' | 'unit'>): boolean => {
  if (isLiquidLikeFood(food) && normalize(food.name).includes('масло')) {
    return true;
  }

  const name = normalize(food.name);
  return SPOON_NAME_PARTS.some((part) => name.includes(part));
};

export const getSupportedFoodDisplayUnits = (
  food: Pick<Food, 'name' | 'category' | 'unit'>
): FoodDisplayUnit[] => {
  const units: FoodDisplayUnit[] = ['г'];

  if (isLiquidLikeFood(food)) {
    units.push('мл', 'л');
  }

  if (supportsPieceUnit(food)) {
    units.push('шт');
  }

  if (supportsSpoonUnits(food)) {
    units.push('ст.л', 'ч.л');
  }

  return units;
};

export const getSafeDisplayUnit = (
  requestedUnit: FoodDisplayUnit | null | undefined,
  supportedUnits: FoodDisplayUnit[]
): FoodDisplayUnit => {
  if (requestedUnit && supportedUnits.includes(requestedUnit)) {
    return requestedUnit;
  }

  return 'г';
};

export const getQuickFoodPresets = (
  food: Pick<Food, 'name' | 'category' | 'unit'>
): FoodQuickPreset[] => {
  const presets: FoodQuickPreset[] = [
    { quantity: 100, unit: 'г', label: '100 г' },
  ];

  if (supportsPieceUnit(food)) {
    presets.push({ quantity: 1, unit: 'шт', label: '1 шт' });
  }

  if (isLiquidLikeFood(food)) {
    presets.push({ quantity: 100, unit: 'мл', label: '100 мл' });
  }

  if (supportsSpoonUnits(food)) {
    presets.push(
      { quantity: 1, unit: 'ст.л', label: '1 ст.л' },
      { quantity: 1, unit: 'ч.л', label: '1 ч.л' }
    );
  }

  return presets;
};
