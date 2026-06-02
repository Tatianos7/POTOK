import { muscleLabels } from '../data/muscles/muscleLabels';
import { isMuscleKey, type MuscleKey } from '../data/muscles/types';
import { normalizeMuscleName } from './muscleNormalizer';

export const FULL_BODY_MUSCLE_KEYS: MuscleKey[] = [
  'front_delts',
  'side_delts',
  'rear_delts',
  'chest',
  'upper_chest',
  'biceps',
  'triceps',
  'forearms',
  'lats',
  'trapezoid',
  'rhomboids',
  'lower_back',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'abductors',
  'calves',
];

const workoutMuscleNameAliases: Record<string, MuscleKey | MuscleKey[]> = {
  Бицепс: 'biceps',
  Бицепсы: 'biceps',
  Трицепс: 'triceps',
  Трицепсы: 'triceps',
  Предплечье: 'forearms',
  Предплечья: 'forearms',
  'Передняя дельта': 'front_delts',
  'Передние дельты': 'front_delts',
  'Средняя дельта': 'middle_delts',
  'Средние дельты': 'middle_delts',
  'Задняя дельта': 'rear_delts',
  'Задние дельты': 'rear_delts',
  'Верхний пучок': 'upper_chest',
  'Средний пучок': 'chest',
  'Нижний пучок': 'chest',
  Грудь: 'chest',
  'Грудные мышцы': 'chest',
  Пресс: 'abs',
  'Прямая — верх': 'abs',
  'Прямая — низ': 'abs',
  Косые: 'obliques',
  'Косые мышцы живота': 'obliques',
  Кор: 'core_muscles',
  'Нижний кор': 'core_muscles',
  Квадрицепс: 'quads',
  Квадрицепсы: 'quads',
  'Бицепс бедра': 'hamstrings',
  'Бицепсы бедра': 'hamstrings',
  Приводящие: 'adductors',
  'Приводящие мышцы': 'adductors',
  'Большая ягодичная': 'glutes',
  'Средняя ягодичная': 'glutes',
  'Малая ягодичная': 'glutes',
  Ягодичная: 'glutes',
  'Ягодичная - большая': 'glutes',
  'Ягодичная - средняя': 'glutes',
  'Ягодичная - малая': 'glutes',
  'Ягодичная — большая': 'glutes',
  'Ягодичная — средняя': 'glutes',
  'Ягодичная — малая': 'glutes',
  Ягодицы: 'glutes',
  'Ягодицы-большая': 'glutes',
  'Ягодицы-средняя': 'glutes',
  'Ягодицы-малая': 'glutes',
  'Ягодицы - большая': 'glutes',
  'Ягодицы - средняя': 'glutes',
  'Ягодицы - малая': 'glutes',
  'Ягодицы — большая': 'glutes',
  'Ягодицы — средняя': 'glutes',
  'Ягодицы — малая': 'glutes',
  'Ягодичные мышцы': 'glutes',
  Икры: 'calves',
  Икроножные: 'calves',
  'Икроножные мышцы': 'calves',
  'Отводящие мышцы': 'abductors',
  'Отводящие мышцы бедра': 'abductors',
  Широчайшие: 'lats',
  'Широчайшие мышцы спины': 'lats',
  Трапеция: 'trapezoid',
  'Трапеция — верх': 'traps_upper',
  'Трапеция — средняя': 'traps_middle',
  Трапециевидные: 'trapezoid',
  'Трапециевидная мышца': 'trapezoid',
  Ромбовидные: 'rhomboids',
  'Ромбовидные мышцы': 'rhomboids',
  Поясница: 'lower_back',
  'Разгибатели спины': 'erectors',
  'Все тело': FULL_BODY_MUSCLE_KEYS,
  'Всё тело': FULL_BODY_MUSCLE_KEYS,
  full_body: FULL_BODY_MUSCLE_KEYS,
};

const normalizedWorkoutMuscleNameToKey = new Map<string, MuscleKey[]>();

Object.entries(muscleLabels).forEach(([key, label]) => {
  normalizedWorkoutMuscleNameToKey.set(normalizeMuscleName(label), [key as MuscleKey]);
});

Object.entries(workoutMuscleNameAliases).forEach(([label, value]) => {
  normalizedWorkoutMuscleNameToKey.set(normalizeMuscleName(label), Array.isArray(value) ? value : [value]);
});

export function resolveWorkoutMuscleKeys(values: readonly unknown[]): MuscleKey[] {
  const resolved: MuscleKey[] = [];
  const seen = new Set<MuscleKey>();

  values.forEach((value) => {
    if (typeof value !== 'string') return;

    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    const keys = isMuscleKey(trimmedValue)
      ? [trimmedValue]
      : normalizedWorkoutMuscleNameToKey.get(normalizeMuscleName(trimmedValue));

    if (!keys) return;

    keys.forEach((key) => {
      if (seen.has(key)) return;

      seen.add(key);
      resolved.push(key);
    });
  });

  return resolved;
}
