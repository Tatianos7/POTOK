# Nutrition Invalid Macro Guard

## What is considered an invalid food row

A food row is invalid for catalog ingestion if any of the following is true:

- `calories` is null / missing
- `protein` is null / missing
- `fat` is null / missing
- `carbs` is null / missing
- any of those values is negative
- all four values are `0` at the same time

This guard exists because invalid macro rows break downstream nutrition logic:

- `food_diary_entries`
- `favorite_products`
- `recipe_ingredients`
- `recipes.total_*`
- Recipe Analyzer

## How ingestion handles invalid rows now

Catalog ingestion does not commit such rows into `public.foods` as normal catalog rows.

Instead:

- the row is staged in `public.food_import_staging`
- `status = 'rejected_invalid_macros'`
- `conflict_reason` stores the rejection reason

This keeps operator visibility and preserves auditability without polluting the
catalog used by diary, favorites, and recipes.

## Local ingestion output

`scripts/run_food_ingestion.mjs` now reports:

- `Rows read`
- `Rows valid`
- `Rows rejected invalid macros`
- `Conflicts`
- `Rows committed`

It also writes:

- main report CSV
- rejected-invalid-macros CSV with line / name / reason

## How to inspect rejected rows

### In Supabase

Example:

```sql
select id, batch_id, name, source, status, conflict_reason
from public.food_import_staging
where status = 'rejected_invalid_macros'
order by created_at desc;
```

### Locally

Check the generated CSV report printed by `scripts/run_food_ingestion.mjs`.

## How to fix bad rows

1. Correct the source CSV or Excel file:
   - fill missing macros
   - remove negative values
   - replace all-zero placeholder rows with real nutrition data
2. Re-run ingestion in `--dry-run`
3. Confirm `Rows rejected invalid macros = 0` for the intended rows
4. Run the real ingestion

## User-created foods

User-created foods are also blocked if:

- any required macro is missing
- any macro is negative
- all macros are zero

The client shows a clear validation error before save, and the service repeats
the same validation so invalid rows cannot be inserted through the normal app flow.
