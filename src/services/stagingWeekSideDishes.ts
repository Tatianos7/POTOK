import type {AuthoringMeal} from '../dev/authoringWeekReport';
import {assessReferenceDayTargetFitV1} from '../dev/referenceDailyTargetFitV1';
import {
  referenceSideDishes, referenceSideDishDelta, referenceSideDishPortionAllowed, type SideDishPortion,
} from '../dev/referenceSideDishScenario';
import {referenceDayHasDistinctStaples} from '../dev/referenceStapleVarietyV1';
import type {StagingRealWeekView} from './stagingRealWeek';

const reviewedRecipes = {
  chicken_bulgur_zucchini: {main: 'Курица с кабачком', original: 'bulgur', sideName: 'Булгур medium/coarse',
    nutrition: {calories: 489.1, protein: 44.168, fat: 10.341, carbs: 57.774, fiber: 10.25}},
  tofu_rice_broccoli: {main: 'Тофу с брокколи', original: 'rice', sideName: 'Рис белый длиннозёрный',
    nutrition: {calories: 530.2, protein: 34.458, fat: 19.031, carbs: 62.1, fiber: 8.13}},
} as const;
const axes = ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const;
const reviewedSource = '9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5';
type Nutrition = AuthoringMeal['referenceNutrition'];
export type StagingSideDishEdit = SideDishPortion & {date: string; recipeId: string};

export function stagingSideDishRecipe(view: StagingRealWeekView, meal: AuthoringMeal) {
  if (!view.savedGoal || !view.report.dailyStapleVariety || view.report.sourceHash !== reviewedSource
    || !Object.prototype.hasOwnProperty.call(reviewedRecipes, meal.recipeId)) return null;
  const binding = reviewedRecipes[meal.recipeId as keyof typeof reviewedRecipes];
  const recipe = view.catalog.recipes.get(meal.recipeId);
  const side = recipe?.ingredients.find(i => i.id === meal.recipeId + '_ing_02');
  const water = recipe?.ingredients.find(i => i.id === meal.recipeId + '_ing_05');
  if (recipe?.servings !== 2 || meal.assignedSourceServings !== 1
    || side?.name !== binding.sideName || side.optional || side.weightG !== 2 * referenceSideDishes[binding.original].dryGrams
    || water?.name !== 'Вода' || water.optional
    || axes.some(axis => meal.referenceNutrition[axis] !== binding.nutrition[axis])) return null;
  return {...binding, ingredients: recipe.ingredients.filter(i => i !== side && i !== water)};
}

export function projectStagingSideDishes(view: StagingRealWeekView, edits: readonly StagingSideDishEdit[]) {
  const report = {...view.report, days: view.report.days.map(day => {
    const dayEdits = edits.filter(edit => edit.date === day.date);
    if (!dayEdits.length) return day;
    const meals = day.meals.map(meal => {
      const edit = dayEdits.find(e => e.recipeId === meal.recipeId);
      if (!edit) return meal;
      const binding = stagingSideDishRecipe(view, meal);
      if (!binding) throw Error('INVALID_STAGING_SIDE_DISH_RECIPE');
      const referenceNutrition = Object.fromEntries(axes.map(axis => [axis, Math.round(
        (meal.referenceNutrition[axis] + referenceSideDishDelta(binding.original, edit, axis)) * 1000
      ) / 1000])) as Nutrition;
      return {...meal, referenceNutrition};
    });
    const referenceNutrition = Object.fromEntries(axes.map(axis => [axis, meals.reduce(
      (total, meal) => total + Math.round(meal.referenceNutrition[axis] * 1000), 0) / 1000])) as Nutrition;
    return {...day, referenceNutrition, meals};
  })};
  return report;
}

export function checkStagingSideDishes(view: StagingRealWeekView, edits: readonly StagingSideDishEdit[]) {
  const report = projectStagingSideDishes(view, edits);
  return report.days.flatMap((day, index) => {
    const dayEdits = edits.filter(edit => edit.date === day.date);
    if (!dayEdits.length || !view.savedGoal) return [];
    const fit = assessReferenceDayTargetFitV1(day.date, day.referenceNutrition, view.savedGoal);
    const variety = referenceDayHasDistinctStaples(view.report.days[index].meals.map(meal => {
      const edit = dayEdits.find(e => e.recipeId === meal.recipeId);
      if (!edit) return view.catalog.recipes.get(meal.recipeId)!;
      const binding = stagingSideDishRecipe(view, meal)!;
      return {name: binding.main, ingredients: [...binding.ingredients, {name: referenceSideDishes[edit.id].name, optional: false}]};
    }));
    return [{date: day.date, fit, variety, meals: day.meals}];
  });
}

export function decodeStagingSideDishes(view: StagingRealWeekView, value: unknown): StagingSideDishEdit[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 28) throw Error('INVALID_STAGING_SIDE_DISHES');
  const seen = new Set<string>();
  const edits = value.map((edit: StagingSideDishEdit) => {
    if (!edit || Object.keys(edit).sort().join(',') !== 'date,dryGrams,id,recipeId'
      || typeof edit.date !== 'string' || typeof edit.recipeId !== 'string' || typeof edit.id !== 'string'
      || !referenceSideDishPortionAllowed(edit)) throw Error('INVALID_STAGING_SIDE_DISH');
    const meal = view.report.days.find(day => day.date === edit.date)?.meals.find(m => m.recipeId === edit.recipeId);
    const binding = meal && stagingSideDishRecipe(view, meal);
    const key = edit.date + ':' + edit.recipeId;
    if (!binding || binding.original === edit.id || seen.has(key)) throw Error('INVALID_STAGING_SIDE_DISH');
    seen.add(key);
    return {date: edit.date, recipeId: edit.recipeId, id: edit.id, dryGrams: edit.dryGrams};
  });
  if (checkStagingSideDishes(view, edits).some(day => !day.fit.passed || !day.variety)) throw Error('INVALID_STAGING_SIDE_DISH_TARGET');
  return edits;
}
