import {
  ALL_MUSCLE_KEYS,
  BACK_MUSCLE_KEYS,
  FRONT_MUSCLE_KEYS,
  type MuscleKey,
} from '../constants/muscles';

const ALL_MUSCLE_KEY_SET = new Set<string>(ALL_MUSCLE_KEYS);
const FRONT_MUSCLE_KEY_SET = new Set<string>(FRONT_MUSCLE_KEYS);
const BACK_MUSCLE_KEY_SET = new Set<string>(BACK_MUSCLE_KEYS);

export interface ExerciseMuscleConfigInput {
  primary?: readonly unknown[];
  secondary?: readonly unknown[];
}

export interface ExerciseMuscleConfig {
  primary: MuscleKey[];
  secondary: MuscleKey[];
}

export interface SplitMusclesByViewResult {
  front: ExerciseMuscleConfig;
  back: ExerciseMuscleConfig;
}

export function isValidMuscleKey(value: unknown): value is MuscleKey {
  return typeof value === 'string' && ALL_MUSCLE_KEY_SET.has(value);
}

export function normalizeMuscleKeys(values?: readonly unknown[] | null): MuscleKey[] {
  if (!values || values.length === 0) {
    return [];
  }

  const seen = new Set<MuscleKey>();
  const result: MuscleKey[] = [];

  values.forEach((value) => {
    if (!isValidMuscleKey(value) || seen.has(value)) {
      return;
    }

    seen.add(value);
    result.push(value);
  });

  return result;
}

export function buildExerciseMuscleConfig(input?: ExerciseMuscleConfigInput | null): ExerciseMuscleConfig {
  const primary = normalizeMuscleKeys(input?.primary);
  const primarySet = new Set<MuscleKey>(primary);
  const secondary = normalizeMuscleKeys(input?.secondary).filter((key) => !primarySet.has(key));

  return {
    primary,
    secondary,
  };
}

export function splitMusclesByView(config: ExerciseMuscleConfig): SplitMusclesByViewResult {
  return {
    front: {
      primary: config.primary.filter((key) => FRONT_MUSCLE_KEY_SET.has(key)),
      secondary: config.secondary.filter((key) => FRONT_MUSCLE_KEY_SET.has(key)),
    },
    back: {
      primary: config.primary.filter((key) => BACK_MUSCLE_KEY_SET.has(key)),
      secondary: config.secondary.filter((key) => BACK_MUSCLE_KEY_SET.has(key)),
    },
  };
}
