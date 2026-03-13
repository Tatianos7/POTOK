# Nutrition Data Integrity Audit Report

## Scope

This audit pack validates the current nutrition graph without modifying data.

Tables covered:

- `public.foods`
- `public.favorite_products`
- `public.food_diary_entries`
- `public.recipes`
- `public.recipe_ingredients`

## What is being checked

1. Canonical food linkage
2. Recipe totals consistency against live ingredient sums
3. Orphan references
4. Missing canonical links in diary/favorites/foods
5. Potential duplicate foods by normalized key

## Audit SQL Files

- `scripts/sql/nutrition_orphan_rows_audit.sql`
- `scripts/sql/nutrition_recipe_macro_consistency_audit.sql`
- `scripts/sql/nutrition_foods_canonical_reference_audit.sql`
- `scripts/sql/nutrition_diary_missing_food_refs_audit.sql`
- `scripts/sql/nutrition_recipe_ingredients_missing_food_refs_audit.sql`
- `scripts/sql/nutrition_duplicate_foods_audit.sql`

## Run Order

1. `scripts/sql/nutrition_orphan_rows_audit.sql`
2. `scripts/sql/nutrition_recipe_macro_consistency_audit.sql`
3. `scripts/sql/nutrition_foods_canonical_reference_audit.sql`
4. `scripts/sql/nutrition_diary_missing_food_refs_audit.sql`
5. `scripts/sql/nutrition_recipe_ingredients_missing_food_refs_audit.sql`
6. `scripts/sql/nutrition_duplicate_foods_audit.sql`

## How to interpret results

### Orphan rows

Expected result:

- all summary counters should be `0`

If not:

- references exist to missing `foods` or `recipes`
- do not fix manually before reviewing whether the parent rows were deleted or whether the child rows were created outside the canonical flow

### Recipe macro consistency

Expected result:

- `consistency_status = ok` for recipes with ingredients

Important cases:

- `mismatch`: stored totals differ from live sums from `recipe_ingredients + foods`
- `no_ingredients`: recipe has no ingredient rows; totals may still be `0` and this is not automatically wrong
- `zero_macro_food_rows > 0`: totals may be mathematically correct but still operationally weak because input foods have zero macros

This query is the practical validation layer for recompute trigger behavior.

### Foods canonical reference audit

Expected result:

- catalog/user foods should usually be `self_canonical`
- `broken_canonical_pointer` should be `0`

Important cases:

- `missing_canonical_food_id`
- `points_to_other_food`
- rows with `inbound_reference_count = 0` may be safe, but they can also indicate dead catalog rows

### Diary and recipe ingredient missing refs

Expected result:

- no `broken_food_reference`

Important cases:

- diary rows with `missing_canonical_food_id` are legacy rows, not necessarily broken rows
- recipe ingredients with missing foods are structural errors for analyzer consistency

### Duplicate foods

Expected result:

- duplicates should be minimal

Important cases:

- duplicate normalized keys with active inbound references
- duplicate rows where one row is referenced and another is not

These cases should be reviewed before any dedupe/backfill plan.

## Current decision boundary

This audit pack is read-only.

It is intended to answer:

- whether nutrition graph integrity is good enough to proceed
- where cleanup/backfill work is still needed
- whether recipe totals rely on weak food records

It does not perform any repair or migration.
