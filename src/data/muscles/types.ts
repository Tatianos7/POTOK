export const MUSCLE_KEYS = [
  'front_neck',
  'front_delts',
  'middle_delts',
  'side_delts',
  'rear_delts',
  'chest',
  'upper_chest',
  'biceps',
  'triceps',
  'forearms',
  'forearms_back',
  'abs',
  'obliques',
  'hip_flexors',
  'core',
  'core_muscles',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves_front',
  'calves',
  'tibialis_anterior',
  'lats',
  'teres_major',
  'trapezoid',
  'traps_upper',
  'upper_traps',
  'traps_middle',
  'middle_traps',
  'erectors',
  'lower_back',
  'serratus',
  'supraspinatus',
  'rhomboids',
] as const;

export type MuscleKey = (typeof MUSCLE_KEYS)[number];

export type MuscleMapView = 'auto' | 'front' | 'back' | 'split';

export type MuscleMapRegionMap = Partial<Record<'front' | 'back', readonly string[]>>;

const MUSCLE_KEY_SET = new Set<string>(MUSCLE_KEYS);

export function isMuscleKey(value: unknown): value is MuscleKey {
  return typeof value === 'string' && MUSCLE_KEY_SET.has(value);
}

export function normalizeMuscleKeys(values?: readonly unknown[] | null): MuscleKey[] {
  if (!values || values.length === 0) {
    return [];
  }

  const seen = new Set<MuscleKey>();
  const result: MuscleKey[] = [];

  values.forEach((value) => {
    if (!isMuscleKey(value) || seen.has(value)) {
      return;
    }

    seen.add(value);
    result.push(value);
  });

  return result;
}
