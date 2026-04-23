const MUSCLE_LABELS: Record<string, string> = {
  front_delts: 'Передние дельты',
  side_delts: 'Средние дельты',
  rear_delts: 'Задние дельты',
  middle_delts: 'Средние дельты',
  trapezoid: 'Трапеции',
  traps_upper: 'Верх трапеций',
  traps_middle: 'Средняя часть трапеций',
  upper_traps: 'Верх трапеций',
  middle_traps: 'Средняя часть трапеций',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  chest: 'Грудные',
  upper_chest: 'Верх грудных',
  lats: 'Широчайшие',
  abs: 'Пресс',
  glutes: 'Ягодичные',
  quads: 'Квадрицепсы',
  hamstrings: 'Бицепс бедра',
  calves: 'Икры',
  forearms: 'Предплечья',
  serratus: 'Передняя зубчатая мышца',
  supraspinatus: 'Надостная мышца',
  rhomboids: 'Ромбовидные',
  erectors: 'Разгибатели спины',
  core: 'Мышцы кора',
  core_muscles: 'Мышцы кора',
};

export function getMuscleLabel(key: string): string {
  return MUSCLE_LABELS[key] ?? key;
}
