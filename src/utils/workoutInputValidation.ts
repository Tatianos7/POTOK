import type { SelectedExercise } from '../types/workout';
import { normalizeWorkoutMetricType, normalizeWorkoutMetricValue } from './workoutEntryMetric';

const MAX_WORKOUT_EDITOR_SETS = 50;
const MAX_WORKOUT_EDITOR_REPS = 200;
const MAX_WORKOUT_EDITOR_METRIC_VALUE = 500;

export function validateSelectedWorkoutExercisesForSave(items: SelectedExercise[]): string | null {
  for (const item of items) {
    const exerciseName = item.exercise.name || 'Упражнение';
    const metricType = normalizeWorkoutMetricType(item.metricType);
    const metricValue = normalizeWorkoutMetricValue(metricType, item.weight);

    if (!Number.isFinite(item.sets) || item.sets < 1) {
      return `${exerciseName}: укажите минимум 1 подход`;
    }

    if (item.sets > MAX_WORKOUT_EDITOR_SETS) {
      return `${exerciseName}: слишком много подходов`;
    }

    if (!Number.isFinite(item.reps) || item.reps < 1) {
      return `${exerciseName}: укажите минимум 1 повтор`;
    }

    if (item.reps > MAX_WORKOUT_EDITOR_REPS) {
      return `${exerciseName}: слишком много повторов`;
    }

    if (!Number.isFinite(metricValue) || metricValue < 0) {
      return `${exerciseName}: проверьте значение метрики`;
    }

    if (metricValue > MAX_WORKOUT_EDITOR_METRIC_VALUE) {
      return `${exerciseName}: слишком большое значение метрики`;
    }

    if (
      metricType !== 'none' &&
      metricType !== 'bodyweight' &&
      metricValue <= 0
    ) {
      return `${exerciseName}: укажите значение метрики больше 0`;
    }
  }

  return null;
}
