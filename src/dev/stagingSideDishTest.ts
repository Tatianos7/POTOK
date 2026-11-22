import type {ReferenceTargetValuesV1} from './referenceDailyTargetFitV1';

/** Fixed reference scenario for checking a side-dish replacement in Staging. */
export const stagingSideDishTest = {
  id: 'SIDE_DISH_REPLACEMENT_V1',
  weekStart: '2026-11-23',
  goal: {calories: 1703, protein: 145, fat: 65, carbs: 134} satisfies ReferenceTargetValuesV1,
  excludedIds: ['eggs_wholegrain_toast_cucumber', 'lemon_shelled_edamame', 'rabbit_potatoes_carrots',
    'ref_2000_gnocchi_lemon_chive_pesto', 'ref_2000_healthy_gnocchi', 'salmon_brown_rice',
    'salmon_frozen_spinach', 'shrimp_rice_vegetables', 'shrimp_zucchini', 'squid_mixed_vegetables',
    'trout_broccoli', 'trout_green_beans'],
} as const;
