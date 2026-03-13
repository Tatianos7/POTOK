# Recipe Recompute Trigger

## Why this trigger exists

`public.recipe_ingredients` is the source of truth for recipe composition.

Recipe totals in `public.recipes` must stay in sync when ingredients change. A
database trigger guarantees that recalculation happens automatically after:

- ingredient insert
- ingredient update
- ingredient delete

This avoids stale `total_calories`, `protein`, `fat`, and `carbs` values when:

- a user edits ingredient grams
- an ingredient is replaced with another `food_id`
- an ingredient is removed
- an ingredient is moved from one recipe to another

## What events are covered

The trigger `trg_recipe_ingredients_recompute` runs `AFTER INSERT OR UPDATE OR DELETE`
on `public.recipe_ingredients`.

Behavior:

- `INSERT` -> recompute `NEW.recipe_id`
- `DELETE` -> recompute `OLD.recipe_id`
- `UPDATE` -> recompute `NEW.recipe_id`
- `UPDATE` with changed `recipe_id` -> recompute both `OLD.recipe_id` and `NEW.recipe_id`

If the last ingredient is removed from a recipe, the trigger zeros recipe totals
instead of leaving stale values behind.

## RLS / security

The trigger function runs with invoker permissions and does not use
`SECURITY DEFINER`.

It does not weaken RLS:

- writes to `recipe_ingredients` still require existing table permissions/policies
- recomputation reuses `public.recompute_recipe_totals(...)`
- zeroing totals after the last ingredient is removed still updates only the
  recipe visible to the same caller context

## Manual verification in Supabase SQL Editor

Use:

- `scripts/sql/recipe_ingredients_trigger_smoke.sql`

What it does:

1. picks one existing ingredient row backed by a food with non-zero macros
2. stores current recipe totals
3. increases `amount_g`
4. reads recipe totals again
5. shows whether totals changed automatically
6. rolls the test back

Expected result:

- `totals_changed_automatically = true`

If the script raises `No eligible recipe_ingredients row found for trigger smoke check`,
seed or import at least one recipe ingredient linked to a food with non-zero macros.
