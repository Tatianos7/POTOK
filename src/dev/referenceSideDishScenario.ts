import {assessReferenceDayTargetFitV1, type ReferenceTargetValuesV1} from './referenceDailyTargetFitV1';

// Dry-weight reference rows retained during the November 19 catalog review.
export const referenceSideDishes = {
  rice: {name: 'Белый длиннозёрный рис', source: 'FDC 169756', dryGrams: 60,
    nutrition: {calories: 219, protein: 4.278, fat: 0.396, carbs: 47.97, fiber: 0.78}},
  quinoa: {name: 'Белая киноа', source: 'FDC 168874', dryGrams: 60,
    nutrition: {calories: 220.8, protein: 8.472, fat: 3.642, carbs: 38.496, fiber: 4.2}},
  bulgur: {name: 'Булгур', source: 'NDB 20012', dryGrams: 70,
    nutrition: {calories: 239.4, protein: 8.603, fat: 0.931, carbs: 53.109, fiber: 8.75}},
  soba: {name: 'Пшенично-гречневая лапша соба', source: 'MEXT 01129', dryGrams: 70,
    nutrition: {calories: 240.8, protein: 9.8, fat: 1.61, carbs: 48.51, fiber: 2.59}},
} as const;

// Carbohydrates follow the reference report's total-carbohydrate basis (including fiber).
const goal = {calories: 1703, protein: 145, fat: 65, carbs: 134};
export type SideDishId = keyof typeof referenceSideDishes;
export interface SideDishPortion {id: SideDishId; dryGrams: number}

export const referenceSideDishScenarios = [
  {date: '2026-11-25', main: 'Тофу с брокколи', original: 'rice',
    weekday: 'Среда', dish: {calories: 530.2, protein: 34.458, fat: 19.031, carbs: 62.1},
    day: {calories: 1679.9, protein: 149.058, fat: 58.831, carbs: 153.2}},
  {date: '2026-11-27', main: 'Курица с кабачком', original: 'bulgur',
    weekday: 'Пятница', dish: {calories: 489.1, protein: 44.168, fat: 10.341, carbs: 57.774},
    day: {calories: 1656.9, protein: 130.768, fat: 62.741, carbs: 152.674}},
] as const;

type Scenario = (typeof referenceSideDishScenarios)[number];
type ScenarioDate = Scenario['date'];

interface PreviewState {
  date: ScenarioDate;
  confirmed: Partial<Record<ScenarioDate, SideDishPortion>>;
  pending: SideDishPortion | null;
}

type PreviewAction =
  | {type: 'day'; date: ScenarioDate}
  | {type: 'choose'; id: SideDishId}
  | {type: 'quinoaWeight'; dryGrams: 60 | 65}
  | {type: 'cancel' | 'confirm'};

export const initialSideDishPreview: PreviewState = {
  date: referenceSideDishScenarios[0].date, confirmed: {}, pending: null,
};

export function getSideDishScenario(date: ScenarioDate): Scenario {
  const scenario = referenceSideDishScenarios.find(day => day.date === date);
  if (!scenario) throw Error('UNKNOWN_REFERENCE_SIDE_DISH_DAY');
  return scenario;
}

export function reduceSideDishPreview(state: PreviewState, action: PreviewAction): PreviewState {
  switch (action.type) {
    case 'day':
      return {...state, date: action.date, pending: null};
    case 'choose':
      return {...state, pending: {id: action.id, dryGrams: referenceSideDishes[action.id].dryGrams}};
    case 'quinoaWeight':
      return state.pending?.id === 'quinoa'
        ? {...state, pending: {id: 'quinoa', dryGrams: action.dryGrams}}
        : state;
    case 'cancel':
      return {...state, pending: null};
    case 'confirm': {
      const {date, pending} = state;
      if (!pending || !previewReferenceSideDish(getSideDishScenario(date), pending).day.passed) return state;
      return {...state, confirmed: {...state.confirmed, [date]: pending}, pending: null};
    }
  }
}

export function previewReferenceSideDish(scenario: Scenario, portion: SideDishPortion) {
  if (!referenceSideDishPortionAllowed(portion)) throw Error('UNSUPPORTED_REFERENCE_SIDE_DISH_PORTION');
  const replaceTotals = (total: ReferenceTargetValuesV1): ReferenceTargetValuesV1 => {
    const calculate = (axis: keyof ReferenceTargetValuesV1) =>
      total[axis] + referenceSideDishDelta(scenario.original, portion, axis);
    return {calories: calculate('calories'), protein: calculate('protein'), fat: calculate('fat'), carbs: calculate('carbs')};
  };

  return {
    dish: replaceTotals(scenario.dish),
    day: assessReferenceDayTargetFitV1(scenario.date, replaceTotals(scenario.day), goal),
  };
}

export function referenceSideDishDelta(original: SideDishId, portion: SideDishPortion,
  axis: keyof ReferenceTargetValuesV1 | 'fiber'): number {
  const replacement = referenceSideDishes[portion.id];
  return replacement.nutrition[axis] * portion.dryGrams / replacement.dryGrams - referenceSideDishes[original].nutrition[axis];
}

export function referenceSideDishPortionAllowed(portion: SideDishPortion): boolean {
  return Object.prototype.hasOwnProperty.call(referenceSideDishes, portion.id)
    && (portion.dryGrams === referenceSideDishes[portion.id].dryGrams || (portion.id === 'quinoa' && portion.dryGrams === 65));
}
