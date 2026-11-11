import type {AuthoringReport} from './authoringWeekReport';
import type {ReferenceSavedGoal} from './referenceSavedGoalV1';

export type ReferenceTargetAxisV1 = 'calories' | 'protein' | 'fat' | 'carbs';
export interface ReferenceDailyTargetFitV1 {
  date: string;
  passed: boolean;
  axes: Record<ReferenceTargetAxisV1, {
    target: number;
    actual: number;
    minimum: number;
    maximum: number;
    passed: boolean;
  }>;
}

const tolerancePercent: Record<Exclude<ReferenceTargetAxisV1, 'calories'>, number> = {
  protein: 10,
  fat: 10,
  carbs: 15,
};
const SCALE = 1_000_000;
const micros = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) throw Error('INVALID_REFERENCE_TARGET_FIT');
  return Math.round(value * SCALE);
};
const display = (value: number): number => Math.round(value * SCALE) / SCALE;

/**
 * Applies the approved daily tolerance windows to reference recipe totals.
 * A pass is only a numeric comparison: it does not admit the recipes, portions,
 * source data, or the week into the trusted generator.
 */
export function assessReferenceDailyTargetFitV1(
  report: AuthoringReport,
  goal: ReferenceSavedGoal,
): ReferenceDailyTargetFitV1[] {
  if (report.days.length !== 7 || report.target !== goal.calories) throw Error('INVALID_REFERENCE_TARGET_FIT');
  const targets: Record<ReferenceTargetAxisV1, number> = {
    calories: goal.calories,
    protein: goal.protein,
    fat: goal.fat,
    carbs: goal.carbs,
  };
  for (const axis of Object.keys(targets) as ReferenceTargetAxisV1[]) micros(targets[axis]);

  return report.days.map(day => {
    const axes = Object.fromEntries((Object.keys(targets) as ReferenceTargetAxisV1[]).map(axis => {
      const target = targets[axis];
      const actual = day.referenceNutrition[axis];
      const targetUnits = micros(target);
      const actualUnits = micros(actual);
      let minimumUnits: number;
      let maximumUnits: number;
      let passed: boolean;
      if (axis === 'calories') {
        minimumUnits = Math.max(0, targetUnits - 50 * SCALE);
        maximumUnits = targetUnits + 50 * SCALE;
        passed = actualUnits >= minimumUnits && actualUnits <= maximumUnits;
      } else {
        const percent = tolerancePercent[axis];
        minimumUnits = Math.floor(targetUnits * (100 - percent) / 100);
        maximumUnits = Math.ceil(targetUnits * (100 + percent) / 100);
        passed = Math.abs(actualUnits - targetUnits) * 100 <= targetUnits * percent;
      }
      return [axis, {
        target: display(target),
        actual: display(actual),
        minimum: display(minimumUnits / SCALE),
        maximum: display(maximumUnits / SCALE),
        passed,
      }];
    })) as ReferenceDailyTargetFitV1['axes'];
    return {date: day.date, axes, passed: Object.values(axes).every(axis => axis.passed)};
  });
}
