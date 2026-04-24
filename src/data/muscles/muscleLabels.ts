import type { MuscleKey } from './types';

export const muscleLabels: Record<MuscleKey, string> = {
  front_neck: 'Передняя поверхность шеи',
  front_delts: 'Передние дельты',
  middle_delts: 'Средние дельты',
  side_delts: 'Средние дельты',
  rear_delts: 'Задние дельты',
  chest: 'Грудные мышцы',
  upper_chest: 'Верх грудных мышц',
  biceps: 'Бицепсы',
  triceps: 'Трицепсы',
  forearms: 'Предплечья',
  forearms_back: 'Предплечья',
  abs: 'Пресс',
  obliques: 'Косые мышцы живота',
  hip_flexors: 'Сгибатели бедра',
  core: 'Мышцы кора',
  core_muscles: 'Мышцы кора',
  quads: 'Квадрицепсы',
  hamstrings: 'Бицепсы бедра',
  glutes: 'Ягодичные мышцы',
  adductors: 'Приводящие мышцы бедра',
  abductors: 'Отводящие мышцы бедра',
  calves_front: 'Передняя поверхность голени',
  calves: 'Икры',
  tibialis_anterior: 'Передняя большеберцовая мышца',
  lats: 'Широчайшие мышцы спины',
  teres_major: 'Большая круглая мышца',
  trapezoid: 'Трапециевидная мышца',
  traps_upper: 'Верх трапеций',
  upper_traps: 'Верх трапеций',
  traps_middle: 'Средняя часть трапеций',
  middle_traps: 'Средняя часть трапеций',
  erectors: 'Разгибатели спины',
  lower_back: 'Поясница',
  serratus: 'Передняя зубчатая мышца',
  supraspinatus: 'Надостная мышца',
  rhomboids: 'Ромбовидные мышцы',
};

export function getMuscleLabel(key: string): string {
  return muscleLabels[key as MuscleKey] ?? key;
}
