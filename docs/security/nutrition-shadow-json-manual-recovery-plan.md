# Nutrition Shadow JSON Manual Recovery Plan

## Verdict

Auto-recovery is not safe for the currently unresolved legacy shadow-JSON recipes.

Why:

- food matching is still unresolved
- amount semantics are not reliably grams
- `public.recipe_ingredients.amount_g` requires operator-confirmed gram values

No broad auto-backfill should be run at this stage.

## What is safe now

Only operator-reviewed recovery:

1. candidate search
2. manual mapping fill
3. manual backfill preview
4. only after that, a separate apply SQL

## Why auto-recovery is impossible here

The issue is not only missing canonical food ids.

The legacy shadow JSON stores ingredient values that are not guaranteed to be
compatible with `recipe_ingredients.amount_g`.

Examples:

- `помидора = 3`
- `огурца = 2`
- `куриного яйца = 3`
- `банка гороха = 1`
- `пучок зелени = 1`

These are not safe grams.
They are product/domain quantities and require operator interpretation.

## Manual guidance for gram assumptions

These are guidance notes only, not automatic rules:

- `помидор`
  - usually pieces
  - requires manual conversion to grams
- `огурец`
  - usually pieces
  - requires manual conversion to grams
- `яйцо куриное`
  - usually pieces
  - requires manual conversion to grams
- `банка гороха`
  - container
  - requires manual conversion to grams of drained/used contents
- `пучок зелени`
  - bundle
  - requires manual conversion to grams
- `масло / сметана / грудка / тунец`
  - may already represent grams
  - still require operator confirmation before backfill

## SQL Files

Candidate search:

- `scripts/sql/nutrition_shadow_json_candidate_search_pack.sql`

Manual mapping template:

- `scripts/sql/nutrition_shadow_json_manual_mapping_template.sql`

Manual backfill preview:

- `scripts/sql/nutrition_shadow_json_manual_backfill_preview.sql`

## Recommended working order

1. Run `scripts/sql/nutrition_shadow_json_candidate_search_pack.sql`
2. Review candidate rows per ingredient
3. Copy the template shape from `scripts/sql/nutrition_shadow_json_manual_mapping_template.sql`
4. Fill operator-confirmed:
   - `chosen_food_id`
   - `chosen_food_name`
   - `chosen_amount_g`
   - `mapping_note`
5. Paste the reviewed mapping into `scripts/sql/nutrition_shadow_json_manual_backfill_preview.sql`
6. Confirm every row shows `ready_for_manual_backfill`
7. Only then prepare a separate apply SQL

## Important constraints

Do not:

- insert guessed amounts
- auto-convert pieces/containers/bundles to grams
- overwrite recipe totals manually first
- run the older broad backfill for these recipes
