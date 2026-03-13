# Recipe Analyzer Baseline (MVP)

## Schema
- `public.recipes`
  - Stores recipe header and shadow JSON `ingredients` (compatibility only).
  - Nutrient totals columns: `total_calories`, `protein`, `fat`, `carbs`.
- `public.recipe_ingredients` (source of truth)
  - `id uuid pk`
  - `recipe_id uuid fk -> recipes(id) on delete cascade`
  - `food_id uuid fk -> foods(id)`
  - `amount_g numeric(10,2) > 0`
  - `created_at`, `updated_at`

## Formulas
For each ingredient row:
- `ingredient_calories = foods.calories * amount_g / 100`
- `ingredient_protein = foods.protein * amount_g / 100`
- `ingredient_fat = foods.fat * amount_g / 100`
- `ingredient_carbs = foods.carbs * amount_g / 100`

Recipe totals:
- `total_calories = sum(ingredient_calories)`
- `protein = sum(ingredient_protein)`
- `fat = sum(ingredient_fat)`
- `carbs = sum(ingredient_carbs)`

Rounded to 2 decimals in `recompute_recipe_totals(recipe_id uuid)`.

## MVP Rules
- Input unit for persistence: grams only (`amount_g`).
- Recipe save flow:
  1. upsert/insert `recipes` row,
  2. replace `recipe_ingredients` rows for recipe,
  3. call `recompute_recipe_totals` RPC,
  4. keep `recipes.ingredients` JSON as shadow for backward compatibility.
- Backfill path from existing JSON:
  - use `scripts/sql/recipe_ingredients_backfill.sql` (best-effort, non-destructive).

## Foods Requirements
`public.foods` must provide per-100g nutrients:
- `calories`
- `protein`
- `fat`
- `carbs`

For ingredient persistence, each item must be matched to `foods.id` (`food_id`).

## RLS Rules
`recipe_ingredients` policies allow only owner of parent recipe (`recipes.user_id = auth.uid()`):
- `SELECT`: only own recipe ingredients.
- `INSERT`: only into own recipe.
- `UPDATE`: only own recipe ingredients with own recipe check.
- `DELETE`: only own recipe ingredients.

`recompute_recipe_totals(recipe_id)`:
- executes as invoker (no `security definer`),
- explicitly verifies `recipes.user_id = auth.uid()` before write.

## Client Integration (short)
1. Save recipe header to `recipes` (existing flow).
2. Save normalized ingredients to `recipe_ingredients` with fields:
   - `recipe_id`
   - `food_id` (`foods.id`)
   - `amount_g`
3. Call RPC:
   - `supabase.rpc('recompute_recipe_totals', { recipe_id })`
4. Re-read `recipes` row to show authoritative totals from DB.
