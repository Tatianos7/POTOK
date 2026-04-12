import type { SelectedExercise } from '../types/workout';
import {
  normalizeWorkoutMetricType,
  normalizeWorkoutMetricUnit,
  normalizeWorkoutMetricValue,
} from './workoutEntryMetric';

export function updateSelectedExerciseField(
  items: SelectedExercise[],
  index: number,
  field: 'sets' | 'reps' | 'weight' | 'metricUnit',
  value: number | SelectedExercise['metricUnit'],
): SelectedExercise[] {
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    if (field === 'metricUnit') {
      return {
        ...item,
        metricUnit: value as SelectedExercise['metricUnit'],
      };
    }
    return {
      ...item,
      [field]: Math.max(0, value as number),
    };
  });
}

export function updateSelectedExerciseMetricType(
  items: SelectedExercise[],
  index: number,
  nextMetricType: SelectedExercise['metricType'],
): SelectedExercise[] {
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) return item;

    const metricType = normalizeWorkoutMetricType(nextMetricType);
    return {
      ...item,
      metricType,
      metricUnit: normalizeWorkoutMetricUnit(metricType, item.metricUnit),
      weight: normalizeWorkoutMetricValue(metricType, item.weight),
    };
  });
}
