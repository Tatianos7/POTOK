import { pieceWeights, unitConversions } from '../data/unitConversions';

export type FoodDisplayUnit = 'г' | 'мл' | 'л' | 'шт' | 'ст.л' | 'ч.л' | 'порция';

const DEFAULT_PORTION_GRAMS = 100;

export const foodDisplayUnits: FoodDisplayUnit[] = ['г', 'мл', 'л', 'шт', 'ст.л', 'ч.л', 'порция'];

export const convertDisplayToGrams = (
  amount: number,
  unit: FoodDisplayUnit,
  foodName?: string
): number => {
  const safeAmount = Number(amount) || 0;
  if (unit === 'порция') {
    return safeAmount * DEFAULT_PORTION_GRAMS;
  }

  if (unit === 'шт') {
    const normalizedName = (foodName || '').toLowerCase();
    const pieceWeight =
      Object.entries(pieceWeights).find(([key]) => normalizedName.includes(key))?.[1] ?? unitConversions['шт'];
    return safeAmount * (pieceWeight || DEFAULT_PORTION_GRAMS);
  }

  const conversion = unitConversions[unit] ?? 1;
  return safeAmount * conversion;
};

export const formatDisplayAmount = (amount?: number, unit?: string): string => {
  if (amount === undefined || amount === null || !unit) {
    return '';
  }
  const rounded = Number.isFinite(amount) ? amount : 0;
  return `${rounded % 1 === 0 ? Math.round(rounded) : Number(rounded.toFixed(2))} ${unit}`;
};
