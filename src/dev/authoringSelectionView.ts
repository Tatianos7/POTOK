import scenario from '../../docs/premium/authoring-week-scenario-20261103.json';
import {authoringSearchInput, type AuthoringRecipeCatalog} from './authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1, type AuthoringWeekScenarioV1} from './authoringWeekSearchV1';
import {decodeAuthoringWeekReport} from './authoringWeekReport';

export const authoringTestTargets = [1400, 1600, 1800, 2000] as const;
export const defaultAuthoringWeekStart = scenario.weekStart;
export function selectAuthoringWeek(catalog: AuthoringRecipeCatalog, target: number, weekStart: string) {
  if (!(authoringTestTargets as readonly number[]).includes(target)) throw new Error('Неизвестный тестовый сценарий.');
  const input: AuthoringWeekScenarioV1 = {...scenario, contract: 'potok-authoring-week-scenario-v1', dailyCalorieTarget: target, weekStart};
  // The same bounded producer as the CLI; its output crosses the existing viewer decoder.
  return decodeAuthoringWeekReport(previewRecipeAuthoringWeekV1(authoringSearchInput(catalog), input));
}
