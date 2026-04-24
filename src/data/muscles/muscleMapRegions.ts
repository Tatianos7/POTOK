import type { MuscleKey, MuscleMapRegionMap } from './types';

export const muscleMapRegions: Record<MuscleKey, MuscleMapRegionMap> = {
  front_neck: { front: ['front_neck'] },
  front_delts: { front: ['front_delts'] },
  middle_delts: { front: ['side_delts'] },
  side_delts: { front: ['side_delts'] },
  rear_delts: { back: ['rear_delts'] },
  chest: { front: ['chest'] },
  upper_chest: { front: ['upper_chest'] },
  biceps: { front: ['biceps'] },
  triceps: { back: ['triceps'] },
  forearms: { front: ['forearms'] },
  forearms_back: { back: ['forearms_back'] },
  abs: { front: ['abs'] },
  obliques: { front: ['obliques_front'], back: ['obliques_back'] },
  hip_flexors: { front: ['hip_flexors'] },
  core: { front: ['core_front'], back: ['core_back'] },
  core_muscles: { front: ['core_front'], back: ['core_back'] },
  quads: { front: ['quads'] },
  hamstrings: { back: ['hamstrings'] },
  glutes: { back: ['glutes'] },
  adductors: { front: ['adductors'] },
  abductors: { back: ['abductors'] },
  calves_front: { front: ['calves_front'] },
  calves: { back: ['calves'] },
  tibialis_anterior: { front: ['tibialis_anterior'] },
  lats: { back: ['lats'] },
  teres_major: { back: ['teres_major'] },
  trapezoid: { back: ['trapezoid'] },
  traps_upper: { back: ['traps_upper'] },
  upper_traps: { back: ['traps_upper'] },
  traps_middle: { back: ['traps_middle'] },
  middle_traps: { back: ['traps_middle'] },
  erectors: { back: ['erectors'] },
  lower_back: { back: ['lower_back'] },
  serratus: { front: ['serratus'] },
  supraspinatus: { back: ['supraspinatus'] },
  rhomboids: { back: ['rhomboids'] },
};

export const FRONT_MUSCLE_KEYS = Object.keys(muscleMapRegions).filter((key) => {
  return Boolean(muscleMapRegions[key as MuscleKey].front?.length);
}) as MuscleKey[];

export const BACK_MUSCLE_KEYS = Object.keys(muscleMapRegions).filter((key) => {
  return Boolean(muscleMapRegions[key as MuscleKey].back?.length);
}) as MuscleKey[];
