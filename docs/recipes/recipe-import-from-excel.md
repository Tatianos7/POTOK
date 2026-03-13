# Import Recipe Ingredients From Excel

## What it does
Script: `scripts/import_recipe_ingredients_from_excel.ts`

Flow per recipe:
1. Resolve recipe by `recipe_id`, or find/create by `user_id + recipe_name`.
2. Replace ingredients atomically via RPC `replace_recipe_ingredients_atomic`.
3. Recompute totals via RPC `recompute_recipe_totals(recipe_id)`.
4. Write CSV report with imported/skipped/errors.

Input workbook defaults to:
- `evidence/food_kb_for_diary_and_recipes_template_with_recipe_ingredients_v2.xlsx`
- sheet: `recipe_ingredients_import`

Supported columns:
- `recipe_id` (optional, UUID)
- `recipe_name` (required if no `recipe_id`)
- `ingredient_name` (for report)
- `food_id` (optional UUID, preferred)
- `barcode` / `ingredient_barcode` (optional, used for auto-resolve when `food_id` is empty)
- `brand` / `ingredient_brand` (optional, improves name matching)
- `amount_g` (required > 0)
- `servings` (optional)
- `yield_g` (optional)

## Required env
One of each pair:
- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SERVICE_ROLE_KEY`

Script auto-loads `.env.local` and `.env` from repo root.

## Run
Dry-run:
```bash
npx tsx scripts/import_recipe_ingredients_from_excel.ts \
  --user 696569f6-76a3-45e3-870a-96c52d11d082 \
  --file evidence/food_kb_for_diary_and_recipes_template_with_recipe_ingredients_v2.xlsx \
  --dry-run
```

Write mode:
```bash
npx tsx scripts/import_recipe_ingredients_from_excel.ts \
  --user 696569f6-76a3-45e3-870a-96c52d11d082 \
  --file evidence/food_kb_for_diary_and_recipes_template_with_recipe_ingredients_v2.xlsx
```

Optional sheet override:
```bash
npx tsx scripts/import_recipe_ingredients_from_excel.ts --user <uuid> --sheet recipe_ingredients_import
```

## Output
CSV report:
- `evidence/recipe_import_report_<date>.csv`
- `evidence/recipe_import_unresolved_<date>.csv` (rows where `food_id` was not resolved + SQL hints)

Summary printed to console:
- recipes processed
- ingredients inserted
- skipped rows (+ reasons)
- error rows (+ reasons)

## Safety
- No writes happen in `--dry-run`.
- Ingredient replacement is atomic per recipe via DB function transaction (`delete old -> insert new`).
- Writes are constrained to provided `--user` ownership in script and RPC checks.
