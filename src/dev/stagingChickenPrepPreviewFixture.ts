import {referenceWeekFixture} from '../services/__tests__/stagingWeekDraft.fixture';

/** Browser acceptance data for Staging. The surrounding meals are synthetic. */
export function stagingChickenPrepPreviewFixture(accountId: string) {
  const fixture = referenceWeekFixture(1703);
  fixture.catalog.source = fixture.report.source = {
    ...fixture.catalog.source,
    sha256: '9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5',
  };
  Object.assign(fixture.report.scenario, {enforceDailyStapleVariety: true});
  const recipe = fixture.catalog.recipes[1];
  const recipeId = 'chicken_bulgur_zucchini';
  const values = {calories: 489.1, protein: 44.168, fat: 10.341, carbs: 47.524, fiber: 10.25};
  Object.assign(recipe, {
    recipeId,
    name: 'Курица с булгуром и кабачком',
    sourceRecipe: {...recipe.sourceRecipe, recipe_id: recipeId},
    referenceNutrition: {...recipe.referenceNutrition, values},
    ingredients: [
      ['01', 'Куриная грудка', 300, 'G'],
      ['02', 'Булгур medium/coarse', 140, 'G'],
      ['03', 'Кабачок с кожицей', 300, 'G'],
      ['04', 'Масло оливковое', 10, 'G'],
      ['05', 'Вода', 280, 'ML'],
    ].map(([id, name, amount, unit], index) => ({
      recipe_id: recipeId, ingredient_row_id: recipeId + '_ing_' + id, sort_order: index + 1,
      ingredient_name_ru: name, amount, unit, weight_g: amount, optional: false,
      preparation_note: null, notes: null,
    })),
    steps: [],
  });
  const replaced = fixture.report.days[1].meals[1].recipeId;
  fixture.catalog.recipes = fixture.catalog.recipes.filter(item => item.recipeId !== replaced);
  for (const item of fixture.catalog.recipes) {
    item.referenceNutrition.carbohydrateSemantics = 'AVAILABLE_EXCLUDING_FIBER';
  }
  const axes = ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const;
  for (const day of fixture.report.days.slice(0, 2)) {
    day.meals[1] = {...day.meals[1], recipeId, name: recipe.name, referenceNutrition: values};
    for (const meal of day.meals.filter(item => item.recipeId !== recipeId)) {
      const nutrition = {calories: 410, protein: 30, fat: 17, carbs: 31, fiber: 6};
      meal.referenceNutrition = nutrition;
      fixture.catalog.recipes.find(item => item.recipeId === meal.recipeId)!.referenceNutrition.values = nutrition;
    }
    day.referenceNutrition = Object.fromEntries(axes.map(axis =>
      [axis, day.meals.reduce((total, meal) => total + meal.referenceNutrition[axis], 0).toFixed(3)]
    ));
  }
  return {
    ...fixture,
    savedGoal: {
      scope: 'SAVED_POINT_TARGETS_NOT_ADMITTED_POLICY', accountId, calories: 1703, protein: 145,
      fat: 65, carbs: 134, updatedAt: '2026-11-09T11:00:00.000Z', goalRevision: null,
    },
  };
}
