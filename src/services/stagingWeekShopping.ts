import {authoringUnitLabel, matchAuthoringRecipe, type AuthoringRecipe} from '../dev/authoringRecipeCatalog';
import {referenceSideDishes} from '../dev/referenceSideDishScenario';
import type {StagingRealWeekView} from './stagingRealWeek';
import {stagingSideDishRecipe, type StagingSideDishEdit} from './stagingWeekSideDishes';

type Ingredient = AuthoringRecipe['ingredients'][number];

interface ShoppingItem {
  name: string;
  recipes: string[];
  amount: number | null;
  unit: string | null;
  optional: boolean;
}

const dryQuinoa = referenceSideDishes.quinoa.name + ' (сухой вес)';
const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');

function sourceQuantity(ingredient: Ingredient, portion: number) {
  if (ingredient.amount !== null && ingredient.amount > 0 && ingredient.unit) {
    return {amount: ingredient.amount * portion, unit: authoringUnitLabel(ingredient.unit)};
  }
  if (ingredient.weightG !== null && ingredient.weightG > 0) {
    return {amount: ingredient.weightG * portion, unit: 'г'};
  }
  return {amount: null, unit: null};
}

/** Sum matching source labels and measures for this reference preview. */
export function deriveStagingWeekShopping(view: StagingRealWeekView, edits: readonly StagingSideDishEdit[], date?: string) {
  const items = new Map<string, ShoppingItem>();
  const days = view.report.days.filter(day => !date || day.date === date);
  if (!days.length) return null;

  function add(item: ShoppingItem, measuredCooked = false) {
    const key = JSON.stringify([normalizeName(item.name), item.unit, item.optional, measuredCooked]);
    const previous = items.get(key);
    if (!previous) {
      items.set(key, {...item, recipes: [...item.recipes]});
      return;
    }
    if (previous.amount !== null && item.amount !== null) previous.amount += item.amount;
    for (const recipe of item.recipes) {
      if (!previous.recipes.includes(recipe)) previous.recipes.push(recipe);
    }
  }

  for (const day of days) {
    for (const meal of day.meals) {
      const {recipe} = matchAuthoringRecipe(view.catalog, view.report, meal);
      if (!recipe?.servings || !recipe.ingredients.length) return null;
      const edit = edits.find(edit => edit.date === day.date && edit.recipeId === meal.recipeId);
      const binding = stagingSideDishRecipe(view, meal);
      if (edit && !binding) return null;

      const portion = meal.assignedSourceServings / recipe.servings;
      const recipes = [binding?.main ?? recipe.name];
      for (const ingredient of (edit && binding ? binding.ingredients : recipe.ingredients)) {
        const name = normalizeName(ingredient.name);
        if (name === 'вода') continue;
        const preparation = normalizeName(ingredient.preparation ?? '');
        const whiteQuinoa = (name === 'киноа белая' || name === 'белая киноа') && preparation.startsWith('сухой вес');
        const measuredCooked = /^(?:(?:вес|масса) (?:после приготовления|готов|вар[её]н)|(?:готовый|готовая|вар[её]ный|вар[её]ная)(?: |$))/u.test(preparation);
        add({
          name: whiteQuinoa ? dryQuinoa : ingredient.name, recipes, optional: ingredient.optional,
          ...sourceQuantity(ingredient, portion),
        }, measuredCooked);
      }
      if (edit) {
        add({name: referenceSideDishes[edit.id].name + ' (сухой вес)',
          recipes, amount: edit.dryGrams, unit: 'г', optional: false});
      }
    }
  }
  return [...items.entries()].map(([key, item]) => ({key, ...item}));
}
