# Nutrition Data Flow And Recipe Analyzer (Audit)

## Data Flow Map (Food)
- Search/selection:
  - UI: `src/pages/FoodSearch.tsx` -> `foodService.search(...)` / `foodService.findByBarcode(...)`
  - Data sources: local cache + `public.foods` + `public.food_aliases` (OpenFoodFacts/USDA currently disabled in `foodService` path)
- Add to diary:
  - UI: `src/pages/FoodDiary.tsx`, `src/pages/FoodSearch.tsx`
  - Service: `mealService.addMealEntry(...)` -> local snapshot -> `mealService.saveMealsForDate(...)`
  - DB: `public.food_diary_entries` (`upsert` by `user_id,idempotency_key`, plus stale-row cleanup `delete`)
- Custom food:
  - UI paths call `foodService.createUserFood(...)` / `foodService.createCustomFood(...)`
  - DB: `public.foods` (`insert source='user', created_by_user_id=sessionUserId`)
- Favorites:
  - UI -> `favoritesService.addToFavorites/removeFromFavorites/incrementFavoriteUsage`
  - DB: `public.favorite_products`
- Recipes:
  - UI: `src/pages/RecipeAnalyzer.tsx`, `src/pages/RecipeDetails.tsx`
  - Service: `recipesService.saveRecipe/createRecipeFromMeal/createRecipeFromAnalyzer`
  - DB: `public.recipes` (ingredients stored as JSON), `public.favorite_recipes`, `public.recipe_collections`, `public.recipe_notes`
- Notes for meal entries:
  - `mealEntryNotesService` -> `public.meal_entry_notes`
- Ingestion/admin flow:
  - `foodIngestionService` -> `food_import_batches/staging/conflicts`, `foods`, `food_aliases`, RPC `recompute_food_entries_for_food_ids`

## Where user-entered food is stored
- Canonical place for user-created products: `public.foods` rows with:
  - `source='user'`
  - `created_by_user_id=<user_uuid>`
- User meal logs: `public.food_diary_entries` rows with `user_id`.
- User favorites: `public.favorite_products` rows with `user_id`.
- User recipe data:
  - recipes: `public.recipes` (`user_id`)
  - recipe notes/favorites/collections: `recipe_notes`, `favorite_recipes`, `recipe_collections` with `user_id`.
- User meal notes: `public.meal_entry_notes` with `user_id` + `meal_entry_id`.
- Also cached locally:
  - meals snapshot: `potok_daily_meals_<userId>`
  - favorites cache and some recipe notes cache.

## Write Operations Audit (INSERT/UPDATE/UPSERT/DELETE)

## `food_diary_entries`
- `src/services/mealService.ts` `saveMealsForDate`:
  - `delete` by `user_id + date` when day empty.
  - `delete` stale rows by `user_id + date + idempotency_key[]`.
  - `delete` stale legacy rows by `user_id + date + id[]`.
  - `upsert` fields: `user_id,date,meal_type,product_name,protein,fat,carbs,fiber,calories,weight,base_unit,display_unit,display_amount,canonical_food_id,idempotency_key`.
- `src/services/mealService.ts` `removeMealEntry`: best-effort `delete` by `id + user_id` (UUID-only).
- `src/services/mealService.ts` `clearMealType`: best-effort `delete` by `user_id + date + meal_type`.
- `src/services/foodIngestionService.ts` `requeueAiRecommendations`: read only.

## `foods`
- `src/services/foodService.ts` `createUserFood`:
  - `insert` user food fields: `name,name_original,barcode,calories,protein,fat,carbs,fiber,unit,category,brand,source='user',created_by_user_id,canonical_food_id,normalized_name,normalized_brand,nutrition_version,verified,suspicious,confidence_score,source_version,allergens,intolerances,photo,aliases,auto_filled,popularity`.
- `src/services/foodService.ts` `updateUserFood`:
  - `update` by `id + created_by_user_id + source='user'`.
- `src/services/foodService.ts` `deleteUserFood`:
  - `delete` by `id + created_by_user_id + source='user'`.
- `src/services/foodIngestionService.ts` `commitBatch`:
  - `upsert` catalog rows by `normalized_name,normalized_brand`.

## `favorite_products`
- `src/services/favoritesService.ts` `addToFavorites`: `upsert` by `user_id,product_name`.
- `src/services/favoritesService.ts` `removeFromFavorites`: `delete` by `user_id,product_name`.
- `src/services/favoritesService.ts` `incrementFavoriteUsage`: `update usage_count` by `user_id,product_name`.

## `food_aliases`
- `src/services/foodIngestionService.ts` `commitBatch`: `upsert` alias rows (`canonical_food_id,alias,source,verified`) on `normalized_alias`.

## `recipes`
- `src/services/recipesService.ts` `saveRecipe`:
  - `upsert` (if UUID id) or `insert` payload with `user_id,name,ingredients,total_calories,protein,fat,carbs,updated_at`.
- `src/services/recipesService.ts` `deleteRecipe`:
  - `delete` by `id + user_id`.

## `recipe_notes`
- `src/services/recipeNotesService.ts` `saveNote`:
  - existing note -> `update text,updated_at` by `user_id + recipe_id`.
  - new note -> `insert user_id,recipe_id,text`.
- `src/services/recipeNotesService.ts` `deleteNote`: `delete` by `user_id + recipe_id`.

## `meal_entry_notes`
- `src/services/mealEntryNotesService.ts` `saveNote`:
  - `upsert user_id,meal_entry_id,text,updated_at` on conflict `meal_entry_id`.
- `src/services/mealEntryNotesService.ts` `deleteNote`: `delete` by `user_id + meal_entry_id`.

## Other `food_/meal_/recipe_` writes
- `src/services/recipesService.ts`: `favorite_recipes` upsert/delete, `recipe_collections` upsert/delete.
- `src/services/foodIngestionService.ts`:
  - `food_import_batches` insert/update(status)
  - `food_import_staging` insert/upsert/update
  - `food_import_conflicts` insert/update
  - RPC `recompute_food_entries_for_food_ids` (server-side recompute)

## Supabase/RPC/External Calls Grouped By User Flow

## Поиск/выбор продукта
- `foodService.search`, `foodService.searchGrouped`, `foodService.findByBarcode`:
  - Supabase read: `foods`, `food_aliases`.
  - No writes.

## Добавление продукта в дневник
- `mealService.addMealEntry` -> `mealService.saveMealsForDate`:
  - Supabase write: `food_diary_entries` (`upsert` + selective `delete`).

## Создание своего продукта
- `foodService.createUserFood`, `updateUserFood`, `deleteUserFood`:
  - Supabase write: `foods`.

## Избранное
- `favoritesService.addToFavorites/removeFromFavorites/incrementFavoriteUsage`:
  - Supabase write: `favorite_products`.

## Создание/анализ рецепта
- Analyze text:
  - `recipeAnalyzerService` -> `recipeAnalyzerReal|Demo`.
  - Real mode: `foodService.search(name)` for ingredient matching.
- Save recipe:
  - `recipesService.createRecipeFromAnalyzer|createRecipeFromMeal` -> `saveRecipe`.
  - Supabase write: `recipes`.
- Recipe metadata:
  - `recipeNotesService` -> `recipe_notes`.
  - `recipesService` -> `favorite_recipes`, `recipe_collections`.

## Ownership & RLS assumptions
- Ownership columns in writes:
  - `user_id`: `food_diary_entries`, `favorite_products`, `recipes`, `recipe_notes`, `meal_entry_notes`, `food_import_batches/staging`, favorites/collections relations.
  - `created_by_user_id`: user rows in `foods`.
- Current client-side anti-leak posture (code level):
  - `mealService` uses strict `requireSessionUser(expectedUserId)` before write flows.
  - `foodService`/`favoritesService`/`recipesService`/`recipeNotesService` fetch session user and write with session id (passed `userId` is not authoritative).
- Residual write-risk notes:
  - `foodService`/`favoritesService`/`recipesService` mismatch handling is warn-only; functional safety depends on replacing with session id (which code currently does).
  - `foodIngestionService.commitBatch` can write to `foods` without forcing `created_by_user_id`; if a staged row carries `source='user'`, ownership semantics can degrade.
  - Final protection remains RLS policies in DB; client checks are supplemental.

## Recipe Analyzer: inputs / processing / outputs

## Inputs
- Text analyzer (`RecipeAnalyzer` page): free-form ingredient text.
- Optional photo (stored as base64 preview; analysis itself not used in DB writes directly in this page).
- Parsed ingredient fields (from `recipeParser`):
  - `name`, `amount`, `unit`, `amountGrams`, display fields.

## Processing
- `recipeAnalyzerService`:
  - Demo mode: `analyzeRecipeTextDemo` uses `demoProducts` alias matching.
  - Real mode: `analyzeRecipeTextReal` uses `foodService.search(name)` and first result.
- Nutrient math:
  - per ingredient: `k = grams/100`; macros = `food_macro_per100 * k`.
  - totals: sum proteins/fats/carbs/calories.
  - per100: `total_macro * 100 / total_weight_g` (fallback weight=100 if 0).
- Parser assumptions:
  - Unit normalization supports `g/ml/pcs`, spoon mappings, range parsing.
  - `ml -> grams` currently ~1:1 assumption.
  - `pcs` uses heuristic `pieceWeights` by name substring.

## Outputs
- Saved recipe in `public.recipes`:
  - `ingredients` stored as JSON array (no `recipe_ingredients` table yet).
  - `total_calories/protein/fat/carbs` stored as totals.
- Matching enrichment during save:
  - each ingredient gets optional `canonical_food_id` via `foods.normalized_name` then `food_aliases.normalized_alias`.

## Gaps + plan

## Minimal (safe, low-cost)
1. Enforce hard auth mismatch guard in all nutrition write services (`foodService`, `favoritesService`, `recipesService`, `recipeNotesService`) to mirror `mealService.requireSessionUser` behavior.
2. Add explicit validator in ingestion commit: prevent `source='user'` rows unless `created_by_user_id` is set to session user.
3. Add runtime check in recipe save: reject ingredient rows with non-finite grams/macros before persist (partially exists; keep strict).

## Ideal (architecture-grade)
1. Introduce normalized `recipe_ingredients` table (1 row per ingredient) while keeping current `recipes.ingredients` as compatibility shadow during migration.
2. Move final recipe nutrient calculation to server-side RPC/Edge (deterministic, audited, same formula for all clients).
3. Add versioned nutrition snapshots for recipe ingredients (so historical totals remain reproducible when `foods` data changes).

