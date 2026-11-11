import type {AuthoringMeal, AuthoringReport} from './authoringWeekReport';
import type {AuthoringSearchCatalogV1} from './authoringWeekSearchV1';

type Reference = Record<'calories' | 'protein' | 'fat' | 'carbs' | 'fiber', number | null>;
export interface AuthoringRecipe {
  id: string; name: string; status: string; servings: number | null; declaredYieldG: number | null;
  notes: string | null; nutrition: Reference;
  primaryCategory: string | null; numericReferenceTestInputAvailable: boolean;
  ingredients: {id: string; order: number; name: string; amount: number | null; unit: string | null;
    weightG: number | null; optional: boolean; preparation: string | null; notes: string | null}[];
  steps: {id: string; order: number; instruction: string; duration: number | null; temperature: number | null; notes: string | null}[];
}
export interface AuthoringRecipeCatalog {
  sourceHash: string; source: AuthoringSearchCatalogV1['source']; recipes: ReadonlyMap<string, AuthoringRecipe>;
}
const fail = (): never => {throw new Error('Файл не соответствует формату тестового каталога. Рецепты не открыты.');};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 20000) return fail();
  return value;
}
function optionalText(value: unknown): string | null {
  if (value === null || value === '') return null;
  return text(value);
}
function optionalNumber(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e6) return fail();
  return value;
}
function order(value: unknown): number {
  const n = optionalNumber(value);
  if (n === null || !Number.isInteger(n) || n < 1) return fail();
  return n;
}
function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > 1000) return fail();
  return value.map(record);
}
function sorted<T extends {id: string; order: number}>(items: T[]): T[] {
  if (new Set(items.map(x => x.id)).size !== items.length || new Set(items.map(x => x.order)).size !== items.length) return fail();
  return items.sort((a, b) => a.order - b.order);
}
export function decodeAuthoringRecipeCatalog(value: unknown): AuthoringRecipeCatalog {
  const c = record(value), source = record(c.source);
  if (c.contract !== 'potok-recipe-authoring-test-catalog-v1' || c.usage !== 'OFFLINE_AUTHORING_TEST_INPUT_ONLY'
    || c.runtimePublishable !== false || c.mayActivate !== false || c.referenceNutritionMustNotBePresentedAsVerified !== true
    || c.physicalCookingBlocksDevelopment !== false || typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)) return fail();
  const recipes = new Map<string, AuthoringRecipe>();
  for (const r of rows(c.recipes)) {
    const id = text(r.recipeId), raw = record(r.sourceRecipe), ref = record(r.referenceNutrition), values = record(ref.values);
    if (recipes.has(id) || raw.recipe_id !== id || r.runtimePublishable !== false || r.measuredYieldG !== null
      || r.confirmedServings !== null || r.physicalReview !== 'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING'
      || ref.verified !== false || ref.basis !== 'SOURCE_DECLARED_PER_SERVING'
      || ref.carbohydrateSemantics !== 'UNVERIFIED_SOURCE_REFERENCE' || r.sourceTagsAreVerifiedRestrictions !== false) return fail();
    const status = text(r.sourceStatus);
    if (!['DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'BLOCKED'].includes(status)) return fail();
    const servings = optionalNumber(r.declaredServings);
    if (servings === 0 || typeof r.numericReferenceTestInputAvailable !== 'boolean') return fail();
    recipes.set(id, {id, name: text(r.name), status, servings, declaredYieldG: optionalNumber(r.declaredYieldG),
      primaryCategory: optionalText(raw.meal_type_primary ?? null), numericReferenceTestInputAvailable: r.numericReferenceTestInputAvailable,
      notes: optionalText(raw.owner_notes ?? null),
      nutrition: Object.fromEntries(['calories', 'protein', 'fat', 'carbs', 'fiber'].map(axis => [axis, optionalNumber(values[axis])])) as Reference,
      ingredients: sorted(rows(r.ingredients).map(i => {
        if (i.recipe_id !== id || typeof i.optional !== 'boolean') return fail();
        return {id: text(i.ingredient_row_id), order: order(i.sort_order), name: text(i.ingredient_name_ru),
          amount: optionalNumber(i.amount), unit: optionalText(i.unit), weightG: optionalNumber(i.weight_g),
          optional: i.optional, preparation: optionalText(i.preparation_note), notes: optionalText(i.notes)};
      })),
      steps: sorted(rows(r.steps).map(s => {
        if (s.recipe_id !== id) return fail();
        return {id: text(s.step_id), order: order(s.step_number), instruction: text(s.instruction_ru),
          duration: optionalNumber(s.duration_min), temperature: optionalNumber(s.temperature_c), notes: optionalText(s.notes)};
      })),
    });
  }
  const bytes = optionalNumber(source.bytes);
  if (bytes === null || !Number.isInteger(bytes)) return fail();
  return {sourceHash: source.sha256, source: {fileName: text(source.fileName), sha256: source.sha256, bytes}, recipes};
}

/** Project only validated offline fields. Never imports Node/XLSX or trusted runtime code. */
export function authoringSearchInput(catalog: AuthoringRecipeCatalog): AuthoringSearchCatalogV1 {
  return {contract: 'potok-recipe-authoring-test-catalog-v1', runtimePublishable: false, source: {...catalog.source},
    recipes: [...catalog.recipes.values()].map(r => ({recipeId: r.id, name: r.name, sourceStatus: r.status,
      declaredServings: r.servings, numericReferenceTestInputAvailable: r.numericReferenceTestInputAvailable,
      ingredients: r.ingredients.map(i => ({name: i.name, optional: i.optional})),
      sourceRecipe: {meal_type_primary: r.primaryCategory}, referenceNutrition: {values: {...r.nutrition}}}))};
}

/** Exact local linkage only; never resolve by name or silently use another catalog. */
export function matchAuthoringRecipe(catalog: AuthoringRecipeCatalog | null, report: AuthoringReport, meal: AuthoringMeal):
  {recipe: AuthoringRecipe; error?: never} | {recipe?: never; error: string} {
  if (!catalog) return {error: 'Для открытия рецепта выбери JSON тестового каталога.'};
  if (catalog.sourceHash !== report.sourceHash) return {error: 'Каталог и неделя относятся к разным версиям сборника.'};
  const recipe = catalog.recipes.get(meal.recipeId);
  if (!recipe) return {error: 'Рецепт с этим ID отсутствует в выбранном каталоге.'};
  if (recipe.status === 'BLOCKED') return {error: 'Рецепт помечен BLOCKED в выбранном каталоге.'};
  if (recipe.servings !== meal.sourceDeclaredServings || recipe.name !== meal.name
    || Object.keys(meal.referenceNutrition).some(axis => recipe.nutrition[axis as keyof Reference] !== meal.referenceNutrition[axis as keyof Reference])) {
    return {error: 'Данные рецепта расходятся с сохранённой неделей. Нужен каталог той же версии.'};
  }
  return {recipe};
}
