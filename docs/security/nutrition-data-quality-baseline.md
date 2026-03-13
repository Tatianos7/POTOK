# Nutrition Data Quality Baseline

## Purpose
`foods` is the source of truth for:
- recipe totals via `recipe_ingredients.food_id -> foods.id`
- diary linkage via `food_diary_entries.canonical_food_id -> foods.id`
- favorites linkage via `favorite_products.canonical_food_id -> foods.id` where available

If `foods` contains incomplete or zero-value nutrient rows, recipe analyzer and diary consistency degrade immediately.

## Required `foods` fields for Recipe Analyzer
- `id`
- `name`
- `source`
- `calories`
- `protein`
- `fat`
- `carbs`

Recommended:
- `fiber`
- `normalized_name`
- `normalized_brand`
- `created_by_user_id` for `source='user'`
- `verified`
- `confidence_score`

## Validation Rules
### Catalog foods (`source in ('core','brand')`)
- `name` required
- `calories/protein/fat/carbs` must be non-null
- row is invalid if all four macros are zero
- `normalized_name` should be present

### User foods (`source='user'`)
- `name` required
- `created_by_user_id` required
- `calories/protein/fat/carbs` should be non-null before recipe use
- row is invalid for analyzer if all four macros are zero or any macro is null

## What counts as invalid food row
- `name` empty
- any of `calories/protein/fat/carbs` is `null`
- all of `calories/protein/fat/carbs` are `0`
- negative macro values
- `source='user'` with missing `created_by_user_id`

## Prevention Rules
- In ingestion: reject or quarantine rows with null macros.
- In custom food creation: require explicit macros before allowing recipe usage.
- In recipe save/recompute: log diagnostic warning if linked foods have zero/null macros.
- In admin data QA: run `scripts/sql/nutrition_zero_macro_audit.sql` before release.

## Operational Policy
Severity:
- `critical`: zero/null macro food is referenced by `recipe_ingredients`
- `medium`: referenced by diary or favorites
- `low`: currently unused

Remediation order:
1. Fix `critical`
2. Fix `medium`
3. Review `low` in batch
