# Canonical Food Backfill Fix

## What failed

Two PostgreSQL-specific issues caused the original backfill scripts to fail in Supabase SQL Editor.

### 1. CTE scope is one statement only

The original audit scripts defined one `WITH` chain and then tried to reuse it across two separate `SELECT` statements:

- summary
- details

In PostgreSQL, a CTE exists only for the statement that immediately follows it. When Supabase SQL Editor executed the second `SELECT`, it failed with errors such as:

- `relation "fav_scope" does not exist`
- `relation "diary_scope" does not exist`

### 2. `min(uuid)` is not supported

The original apply scripts used:

```sql
min(food_id)
```

For `uuid`, PostgreSQL does not provide a direct `min(uuid)` aggregate, so execution failed with:

- `function min(uuid) does not exist`

## How it was fixed

### Audit scripts

Each section now has its own complete `WITH` chain:

- `SECTION A` summary -> own `WITH`
- `SECTION B` details -> own `WITH`

This keeps the scripts valid in PostgreSQL and Supabase SQL Editor without changing matching logic.

### Apply scripts

The unique-match reducer now uses:

```sql
min(food_id::text)::uuid
```

This preserves the same business behavior:

- only rows with exactly one distinct candidate match are updated
- ambiguous rows are still skipped
- already-linked rows are still untouched

## Safe run order

Run the scripts in this order:

1. Run the audit script
2. Review counts and detail rows
3. Run the apply script
4. Run the audit script again to verify the result

### favorite_products

1. `scripts/sql/favorite_products_canonical_backfill_audit.sql`
2. `scripts/sql/favorite_products_canonical_backfill_apply.sql`
3. `scripts/sql/favorite_products_canonical_backfill_audit.sql`

### food_diary_entries

1. `scripts/sql/food_diary_entries_canonical_backfill_audit.sql`
2. `scripts/sql/food_diary_entries_canonical_backfill_apply.sql`
3. `scripts/sql/food_diary_entries_canonical_backfill_audit.sql`

## Safety properties

The scripts remain production-safe:

- audit scripts are read-only
- apply scripts update only rows where `canonical_food_id is null`
- apply scripts update only rows with exactly one distinct candidate `foods.id`
- ambiguous matches are not applied
- existing canonical links are not overwritten
