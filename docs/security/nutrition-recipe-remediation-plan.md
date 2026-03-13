# Nutrition Recipe Remediation Plan

## Current Findings

From `scripts/sql/nutrition_recipe_macro_consistency_audit.sql`:

- `ok = 3`
- `mismatch = 1`
- `no_ingredients = 3`

Mismatch recipe:

- `72656369-7065-45f6-8d65-616c5f313736`
- `Салат не понятный`
- stored totals are materially higher than live totals from `recipe_ingredients + foods`

No-ingredients recipes:

- `72656369-7065-45f3-b137-363733353137` — `Салат Весна`
- `72656369-7065-45f3-9137-363732373731` — `Салат Мемоза 2`
- `72656369-7065-45f3-9137-363733353132` — `Салат Оливье`

## Safe Remediation Strategy

### 1. Mismatch recipes

Safe path:

1. Inspect the recipe ingredients and linked foods.
2. Run a dry-run recompute inside `BEGIN ... ROLLBACK`.
3. If the recomputed totals are correct, repeat the same recompute with `COMMIT`.

Reason:

- the source of truth is `public.recipe_ingredients`
- stored totals in `public.recipes` are derived data
- recompute is a safe correction if ingredient rows are already correct

Do not manually edit totals first.
If inputs are correct, recompute should be the only required fix.

### 2. No-ingredients recipes

These should not be recomputed blindly.

First determine which case applies:

Case A: `recipe_ingredients = 0`, but legacy `recipes.ingredients` JSON still has items.

- This is a backfill/migration candidate.
- The correct action is to reconstruct `recipe_ingredients` first.
- Only after ingredients exist should totals be recomputed.

Case B: `recipe_ingredients = 0`, and `recipes.ingredients` JSON is empty/null.

- The recipe may be intentionally empty or incomplete.
- Totals can remain zero until the user/operator actually adds ingredients.

Case C: `recipe_ingredients = 0`, but stored totals are non-zero.

- Treat as stale derived data.
- Do not overwrite immediately unless product ownership confirms the recipe is truly empty.
- Prefer operator review in UI before correcting.

## SQL Files

Read-only no-ingredients audit:

- `scripts/sql/nutrition_recipe_no_ingredients_audit.sql`

Manual remediation helper:

- `scripts/sql/nutrition_recipe_mismatch_recompute_plan.sql`

Shadow-JSON backfill preview:

- `scripts/sql/nutrition_recipe_shadow_json_backfill_preview.sql`

Shadow-JSON backfill apply:

- `scripts/sql/nutrition_recipe_shadow_json_backfill_apply.sql`

## Recommended Execution Order

1. Run `scripts/sql/nutrition_recipe_no_ingredients_audit.sql`
2. Run `scripts/sql/nutrition_recipe_mismatch_recompute_plan.sql`
3. For the mismatch recipe:
   - use the dry-run transaction first
   - verify totals
   - only then run the commit version
4. For no-ingredients recipes:
   - inspect whether JSON shadow still contains data
   - if yes, run the preview and then the backfill apply script
   - if no, leave unchanged for now

## Interpreting each no-ingredients recipe

Use `scripts/sql/nutrition_recipe_no_ingredients_audit.sql` and classify each row with this rule:

- `has_shadow_ingredients_json = true`
  - interpretation: `legacy shadow-json recipe`
  - remediation class: `backfill candidate`
- `has_shadow_ingredients_json = false` and all stored totals are `0`
  - interpretation: `really empty recipe`
  - remediation class: `leave as-is`
- `has_shadow_ingredients_json = false` and any stored total is non-zero
  - interpretation: `empty recipe with stale derived totals`
  - remediation class: `manual operator review`, no automatic correction

For the three current recipe ids, use that exact rule:

- `72656369-7065-45f3-b137-363733353137`
- `72656369-7065-45f3-9137-363732373731`
- `72656369-7065-45f3-9137-363733353132`

Do not classify them as backfill candidates unless the audit shows
`has_shadow_ingredients_json = true`.

## Safe cleanup plan for really empty recipes

If a recipe is confirmed really empty:

1. Keep the row.
2. Do not auto-delete it.
3. Optionally mark it in ops/manual review as:
   - draft/incomplete recipe
   - user-created shell recipe
4. Only remove or archive later through explicit product behavior, not through DB cleanup.

## Manual UI Checklist

After recomputing the mismatch recipe:

1. Open the recipe in the UI.
2. Confirm ingredient list matches the actual `recipe_ingredients` rows.
3. Confirm displayed calories/protein/fat/carbs match the recomputed totals.
4. Confirm saving the recipe again does not revert totals back to stale values.

For no-ingredients recipes:

1. Open each recipe in the UI.
2. Check whether the recipe appears empty or whether ingredients are only present in legacy JSON/shadow state.
3. If the UI shows ingredients but DB audit shows zero `recipe_ingredients`, flag the recipe for backfill.
4. If the UI is empty and recipe is intentionally incomplete, leave it unchanged.
