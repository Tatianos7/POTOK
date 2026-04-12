import type { WorkoutMetricType, WorkoutMetricUnit } from '../types/workout';

export const WORKOUT_METRIC_OPTIONS: Array<{ value: WorkoutMetricType; label: string }> = [
  { value: 'weight', label: 'Вес' },
  { value: 'bodyweight', label: 'Свой вес' },
  { value: 'distance', label: 'Дистанция' },
  { value: 'time', label: 'Время' },
  { value: 'none', label: 'Без метрики' },
];

export const DEFAULT_WORKOUT_METRIC_TYPE: WorkoutMetricType = 'weight';

export const WORKOUT_TIME_UNIT_OPTIONS: Array<{ value: WorkoutMetricUnit; label: string }> = [
  { value: 'сек', label: 'сек' },
  { value: 'мин', label: 'мин' },
];

export const WORKOUT_DISTANCE_UNIT_OPTIONS: Array<{ value: WorkoutMetricUnit; label: string }> = [
  { value: 'м', label: 'м' },
  { value: 'км', label: 'км' },
];

export function normalizeWorkoutMetricType(value: unknown): WorkoutMetricType {
  if (value === 'bodyweight' || value === 'time' || value === 'distance' || value === 'none') {
    return value;
  }
  return 'weight';
}

export function getWorkoutMetricLabel(metricType: WorkoutMetricType): string {
  return WORKOUT_METRIC_OPTIONS.find((item) => item.value === metricType)?.label ?? 'Вес';
}

export function normalizeWorkoutMetricUnit(metricType: WorkoutMetricType, value: unknown): WorkoutMetricUnit {
  switch (metricType) {
    case 'time':
      return value === 'мин' ? 'мин' : 'сек';
    case 'distance':
      return value === 'м' ? 'м' : 'км';
    case 'weight':
      return 'кг';
    case 'bodyweight':
      return 'св. вес';
    case 'none':
      return null;
    default:
      return 'кг';
  }
}

export function getWorkoutMetricUnit(metricType: WorkoutMetricType, metricUnit?: unknown): string {
  return normalizeWorkoutMetricUnit(metricType, metricUnit) ?? '';
}

export function getWorkoutMetricUnitOptions(metricType: WorkoutMetricType): Array<{ value: WorkoutMetricUnit; label: string }> {
  if (metricType === 'time') {
    return WORKOUT_TIME_UNIT_OPTIONS;
  }
  if (metricType === 'distance') {
    return WORKOUT_DISTANCE_UNIT_OPTIONS;
  }
  return [];
}

export function supportsWorkoutMetricUnitSelection(metricType: WorkoutMetricType): boolean {
  return metricType === 'time' || metricType === 'distance';
}

export function isWorkoutMetricValueEditable(metricType: WorkoutMetricType): boolean {
  return metricType !== 'none';
}

export function normalizeWorkoutMetricValue(metricType: WorkoutMetricType, value: number): number {
  if (metricType === 'none') {
    return 0;
  }
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function formatWorkoutMetricValue(
  value: number,
  metricType: WorkoutMetricType,
  metricUnit?: unknown,
): string {
  const safeMetricType = normalizeWorkoutMetricType(metricType);
  const safeValue = normalizeWorkoutMetricValue(safeMetricType, Number(value) || 0);

  if (safeMetricType === 'none') {
    return '—';
  }

  const unit = getWorkoutMetricUnit(safeMetricType, metricUnit);
  if (safeMetricType === 'bodyweight') {
    return safeValue > 0 ? `${safeValue} ${unit}` : unit;
  }

  return unit ? `${safeValue} ${unit}` : String(safeValue);
}
