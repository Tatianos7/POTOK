import type { SelectedExercise } from '../types/workout';

export function updateSelectedExerciseField(
  items: SelectedExercise[],
  index: number,
  field: 'sets' | 'reps' | 'weight',
  value: number,
): SelectedExercise[] {
  return items.map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...item,
          [field]: Math.max(0, value),
        }
      : item,
  );
}
