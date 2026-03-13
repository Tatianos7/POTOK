# Nutrition Shadow JSON Resolution Plan

## Current Situation

Backfill from legacy `recipes.ingredients` JSON is not safe to apply automatically.

Observed preview result:

- `canonical_food_id_from_json = NULL`
- `resolved_food_id = NULL`
- `backfill_status = unresolved_food`

for all currently affected ingredient rows.

This means the legacy JSON does not contain canonical ids and current exact-name
resolution is insufficient.

## Why automatic apply is unsafe

The problem is not only name resolution.

The legacy shadow JSON mixes two independent uncertainties:

1. Food identity uncertainty
   - ingredient names are stored as loose text
   - Russian forms differ from catalog names
   - some rows use packaging/context prefixes such as `банка` or `пучок`

2. Amount semantics uncertainty
   - legacy numeric values are not guaranteed to be grams
   - examples such as `2`, `3`, `1` may represent:
     - pieces
     - bundles
     - containers
     - unknown household units

`public.recipe_ingredients.amount_g` requires grams.
So even if a food match exists, inserting raw legacy values into `amount_g` can
silently corrupt recipe totals.

## What the new audit does

### `scripts/sql/nutrition_shadow_json_resolution_audit.sql`

For every legacy ingredient row in no-ingredients recipes, it:

- normalizes the ingredient name
- removes simple noisy prefixes
- applies conservative Russian-form mappings
- tries matching by:
  - `foods.normalized_name`
  - `lower(foods.name)`
  - `food_aliases.normalized_alias`
- classifies the row as:
  - `auto_resolvable`
  - `needs_manual_food_match`
  - `needs_manual_amount_conversion`
  - `unresolved`

### `scripts/sql/nutrition_shadow_json_manual_review_pack.sql`

This is a narrow manual-review pack only for the three currently known recipe ids.

It shows only rows that still require operator review:

- multiple food candidates
- no food candidate
- amount not confidently interpretable as grams

## Operator decision rule

Only rows with both conditions should ever become auto-backfill candidates:

1. exactly one safe food match
2. amount semantics confidently equal grams

If either condition fails:

- do not insert into `recipe_ingredients`
- do not recompute totals from guessed data

## Safe next step

1. Run `scripts/sql/nutrition_shadow_json_resolution_audit.sql`
2. Run `scripts/sql/nutrition_shadow_json_manual_review_pack.sql`
3. For each ingredient:
   - confirm canonical food manually
   - convert amount to grams manually if needed
4. Only after that prepare a targeted per-recipe backfill script

## Important constraint

This phase is audit/remediation planning only.

Do not:

- run broad backfill apply
- insert guessed `amount_g`
- manually overwrite recipe totals first
