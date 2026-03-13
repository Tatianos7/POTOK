# Nutrition Unified Regression Checklist

## Pre-check
- Apply latest migrations.
- Run `scripts/sql/nutrition_graph_audit.sql` and export results.
- Confirm RLS verify script still PASS.

## Food diary
- Add catalog product from search -> entry saved.
- Add product from barcode -> entry saved.
- Add custom product -> entry saved.
- Edit existing entry -> macros and weight update.
- Verify new entries have `canonical_food_id` when product UUID is known.

## Favorites
- Add product to favorites from search result.
- Re-add same product -> no duplicate favorite row.
- Increment usage works for canonical-linked favorite.
- Remove favorite works by canonical id; fallback by name still works.

## Recipes / analyzer
- Save recipe with matched ingredients -> `recipe_ingredients` rows inserted.
- `recompute_recipe_totals` updates recipe totals.
- Recipe list/details display ingredients from `recipe_ingredients` graph.
- If totals are zero with ingredients present, service logs invalid food nutrient diagnostics.

## Backward compatibility
- Old recipes with JSON `ingredients` still render.
- Old favorites (name-only) still resolve in UI.
- Existing diary rows without canonical ID still render and remain editable.

## Security
- User B cannot read/update User A diary/favorites/recipes/recipe_ingredients.
- `food_import_conflicts` remains closed for client roles.
