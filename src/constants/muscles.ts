export const FRONT_MUSCLE_KEYS = [
  'front_neck',
  'front_delts',
  'side_delts',
  'chest',
  'upper_chest',
  'biceps',
  'forearms',
  'abs',
  'obliques',
  'hip_flexors',
  'quads',
  'adductors',
  'tibialis_anterior',
  'calves_front',
] as const;

export const BACK_MUSCLE_KEYS = [
  'traps_upper',
  'traps_middle',
  'rear_delts',
  'lats',
  'teres_major',
  'triceps',
  'erectors',
  'lower_back',
  'glutes',
  'hamstrings',
  'abductors',
  'calves',
  'forearms_back',
] as const;

export const ALL_MUSCLE_KEYS = [
  ...FRONT_MUSCLE_KEYS,
  ...BACK_MUSCLE_KEYS,
] as const;

export type MuscleKey = (typeof ALL_MUSCLE_KEYS)[number];

export type PrimaryMuscles = readonly MuscleKey[];
export type SecondaryMuscles = readonly MuscleKey[];
