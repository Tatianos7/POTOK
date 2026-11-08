/** Owner-selected acceptance window for the reference menu test, not a medical
 * recommendation, portion approval or a change to trusted Graph contracts. */
export interface ReferenceCalorieCorridorV1 {
  contract: 'potok-reference-calorie-corridor-v1'; minimumKcal: number; maximumKcal: number;
}
export function referenceCalorieCorridorV1(target: number): ReferenceCalorieCorridorV1 {
  if (!Number.isInteger(target) || target <= 50 || target > 10000) throw Error('INVALID_REFERENCE_CALORIE_TARGET');
  return {contract: 'potok-reference-calorie-corridor-v1', minimumKcal: target - 50, maximumKcal: target + 50};
}
export function referenceCaloriesFitCorridorV1(target: number, actual: number): boolean {
  const range = referenceCalorieCorridorV1(target);
  return Number.isFinite(actual) && actual >= range.minimumKcal && actual <= range.maximumKcal;
}
export function constrainReferenceWeekToCorridorV1<T extends {
  scenario: {dailyCalorieTarget: number}; status: string; days: {referenceNutrition: Record<string, string>}[];
}>(candidate: T) {
  const calorieCorridor = referenceCalorieCorridorV1(candidate.scenario.dailyCalorieTarget);
  const fits = candidate.status === 'REFERENCE_WEEK_PREVIEW' && candidate.days.length === 7
    && candidate.days.every(d => referenceCaloriesFitCorridorV1(candidate.scenario.dailyCalorieTarget, Number(d.referenceNutrition.calories)));
  return {...candidate, calorieCorridor,
    status: candidate.status === 'REFERENCE_WEEK_PREVIEW' && !fits ? 'NO_REFERENCE_WEEK_IN_CALORIE_CORRIDOR' : candidate.status,
    days: fits ? candidate.days : []};
}
