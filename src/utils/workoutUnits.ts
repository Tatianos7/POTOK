export type WeightUnit = 'кг' | 'lb';
export type DurationUnit = 'сек' | 'мин';

export const convertWeightToKg = (amount: number, unit: WeightUnit): number => {
  const value = Number(amount) || 0;
  if (unit === 'lb') {
    return value * 0.453592;
  }
  return value;
};

export const convertDurationToSeconds = (amount: number, unit: DurationUnit): number => {
  const value = Number(amount) || 0;
  if (unit === 'мин') {
    return value * 60;
  }
  return value;
};

export const formatWeight = (amount?: number, unit: WeightUnit = 'кг'): string => {
  if (amount === undefined || amount === null) {
    return '';
  }
  const rounded = Number.isFinite(amount) ? amount : 0;
  return `${rounded % 1 === 0 ? Math.round(rounded) : Number(rounded.toFixed(1))} ${unit}`;
};
