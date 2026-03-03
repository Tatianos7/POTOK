# Food/Nutrition RLS Release Checklist (Final Gate)

This checklist is **audit-only** and **read-only**.
The source of truth is SQL output from `supabase/verify_food_rls.sql`.

## What Is Covered
`verify_food_rls.sql` now auto-discovers and checks:
- Nutrition/food domain tables by name patterns and explicit list.
- All `public` tables with user-bound columns:
  - `user_id uuid`
  - `created_by_user_id uuid`

It explicitly includes (when present):
- `food_diary_entries`, `meal_entry_notes`, `foods`, `food_aliases`, `favorite_products`
- `food_import_batches`, `food_import_conflicts`, `food_import_staging`
- any `food_ingestion_*`
- `recipes`, `recipe_notes`, `favorite_recipes`, `recipe_collections`
- any `recipes_relations_*`

## How To Run (Supabase SQL Editor)
1. Open SQL Editor for target env (staging/prod).
2. Paste and run full contents of `supabase/verify_food_rls.sql`.
3. Save the output of all sections (A/B/C/D) as release evidence.

## How To Interpret Results

### Section B (Per-table gate)
Required columns:
- `table_name`
- `rls_enabled`
- `policies_count`
- `has_select`, `has_insert`, `has_update`, `has_delete`
- `has_owner_guard`
- `guard_column` (`user_id` / `created_by_user_id` / `none`)
- `issues` (text[])
- `verdict` (`PASS` / `FAIL`)

`FAIL` means release-blocking for that table.

### Section C (Public catalog diagnostics)
Use this to verify mixed-access tables (e.g. `foods`):
- Is table `public_only` or `user_owned`.
- Is there select policy for authenticated/public without owner guard.
- Is there owner guard on `created_by_user_id` when relevant.

### Section D (Global verdict)
- `global_verdict = PASS` => release gate passed.
- `global_verdict = FAIL` => do not release.
- Check `fail_tables` for exact blocking list.

## PASS Criteria
- Section D `global_verdict = PASS`.
- Section B has no `FAIL` rows.
- For user-owned tables (`guard_column != 'none'`):
  - RLS enabled
  - policies exist
  - owner guard (`auth.uid()` binding) present
  - required policy coverage present.

## FAIL Handling
If any table fails:
1. **Do not release** nutrition/food changes.
2. Inspect Section B `issues` and policy text from Section A/B output.
3. Fix in dedicated migration (outside this audit script).
4. Re-run `verify_food_rls.sql`.
5. Release only after `global_verdict = PASS`.

## Non-negotiable Rule
Access through Table Editor as `postgres` is **not** proof of correct RLS.
Only `verify_food_rls.sql` output is accepted as release evidence.
