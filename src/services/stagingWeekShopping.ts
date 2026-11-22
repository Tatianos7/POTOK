import {authoringUnitLabel, matchAuthoringRecipe, type AuthoringRecipe} from '../dev/authoringRecipeCatalog';
import {referenceSideDishes} from '../dev/referenceSideDishScenario';
import type {StagingRealWeekView} from './stagingRealWeek';
import {stagingSideDishRecipe, type StagingSideDishEdit} from './stagingWeekSideDishes';

type Ingredient = AuthoringRecipe['ingredients'][number];

interface ShoppingItem {
  name: string;
  recipe: string | null;
  amount: number | null;
  unit: string | null;
  optional: boolean;
}

function sourceQuantity(ingredient: Ingredient, portion: number) {
  if (ingredient.amount !== null && ingredient.amount > 0 && ingredient.unit) {
    return {amount: ingredient.amount * portion, unit: authoringUnitLabel(ingredient.unit)};
  }
  if (ingredient.weightG !== null && ingredient.weightG > 0) {
    return {amount: ingredient.weightG * portion, unit: 'г'};
  }
  return {amount: null, unit: null};
}

/** Only source rows with a shared identity are combined in the reference preview. */
export function deriveStagingWeekShopping(view: StagingRealWeekView, edits: readonly StagingSideDishEdit[], date?: string) {
  const items = new Map<string, ShoppingItem>();
  const days = view.report.days.filter(day => !date || day.date === date);
  if (!days.length) return null;

  function add(key: string, item: ShoppingItem) {
    const previous = items.get(key);
    items.set(key, previous?.amount != null && item.amount !== null
      ? {...item, amount: previous.amount + item.amount}
      : item);
  }

  for (const day of days) {
    for (const meal of day.meals) {
      const {recipe} = matchAuthoringRecipe(view.catalog, view.report, meal);
      if (!recipe?.servings || !recipe.ingredients.length) return null;
      const edit = edits.find(edit => edit.date === day.date && edit.recipeId === meal.recipeId);
      const binding = stagingSideDishRecipe(view, meal);
      if (edit && !binding) return null;

      const portion = meal.assignedSourceServings / recipe.servings;
      for (const ingredient of (edit && binding ? binding.ingredients : recipe.ingredients)) {
        if (ingredient.name === 'Вода') continue;
        add(JSON.stringify([recipe.id, ingredient.id]), {
          name: ingredient.name, recipe: binding?.main ?? recipe.name, optional: ingredient.optional,
          ...sourceQuantity(ingredient, portion),
        });
      }
      if (edit) {
        add(edit.id, {name: referenceSideDishes[edit.id].name + ' (сухой вес)',
          recipe: null, amount: edit.dryGrams, unit: 'г', optional: false});
      }
    }
  }
  return [...items.entries()].map(([key, item]) => ({key, ...item}));
}
