# Food Ingestion (CSV -> Supabase)

Script: `scripts/run_food_ingestion.mjs`

## What is supported
- CSV delimiter auto-detect: `,` or `;`
- UTF-8 with BOM (`UTF-8-sig`)
- Numeric parsing for both `12.5` and `12,5`
- Dry-run mode with skip reasons

## Required env
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_USER_ID`

## Run with npm/npx
Dry-run:
```bash
npx node scripts/run_food_ingestion.mjs --csv="/full/path/to/foods_import.csv" --dry-run
```

Write mode:
```bash
npx node scripts/run_food_ingestion.mjs --csv="/full/path/to/foods_import.csv"
```

Commit mode (default is `safe_upsert`):
```bash
npx node scripts/run_food_ingestion.mjs --csv="/full/path/to/foods_import.csv" --commit-mode=safe_upsert
```
```bash
npx node scripts/run_food_ingestion.mjs --csv="/full/path/to/foods_import.csv" --commit-mode=insert_only
```

## Output
- Console summary: rows read/valid/skipped, staged/conflicts/committed
- Console summary includes: `inserted`, `updated`, `skipped_catalog`, `conflicts_written`
- Skip report CSV: `evidence/food_ingestion_report_<timestamp>.csv`

## Notes
- `--dry-run` does not write to database.
- Write mode uses existing staging/conflict pipeline and commits accepted rows to `public.foods`.
