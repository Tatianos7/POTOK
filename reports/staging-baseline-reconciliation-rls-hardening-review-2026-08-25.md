# Staging Baseline Reconciliation RLS Hardening Review

- Date: 2026-08-25
- Branch: `master`
- Reviewed files:
  - `supabase/migration_drafts/staging-baseline-reconciliation-draft-2026-08-25.sql`
  - `reports/staging-baseline-reconciliation-draft-review-2026-08-25.md`
  - `reports/staging-baseline-reconciliation-rls-hardening-2026-08-25.md`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Verdict: **STAGING_BASELINE_RECONCILIATION_RLS_HARDENING_REVIEW_READY**

## Review Verdict

The RLS blocker from the first reconciliation draft review is closed.

`favorite_recipes` and `recipe_collections` now use explicit insert/update policies that require both an own relation row and parent recipe ownership. The draft is ready for a separately approved staging baseline reconciliation apply.

Staging readiness marker: **READY_FOR_STAGING_BASELINE_APPLY**.

## RLS Hardening Check

`favorite_recipes`:

- `favorite_recipes_modify_own` is idempotently dropped: OK.
- `favorite_recipes_select_own` remains own-row only: OK.
- `favorite_recipes_insert_own_recipe` requires `auth.uid() = user_id`: OK.
- `favorite_recipes_insert_own_recipe` requires a parent `public.recipes` row where `r.id = recipe_id` and `r.user_id = auth.uid()`: OK.
- `favorite_recipes_update_own_recipe` protects the existing row with `using (auth.uid() = user_id)`: OK.
- `favorite_recipes_update_own_recipe` requires the updated row to remain owned and reference an own recipe: OK.
- `favorite_recipes_delete_own` remains own-row only: OK.

`recipe_collections`:

- `recipe_collections_modify_own` is idempotently dropped: OK.
- `recipe_collections_select_own` remains own-row only: OK.
- `recipe_collections_insert_own_recipe` requires `auth.uid() = user_id`: OK.
- `recipe_collections_insert_own_recipe` requires a parent `public.recipes` row where `r.id = recipe_id` and `r.user_id = auth.uid()`: OK.
- `recipe_collections_update_own_recipe` protects the existing row with `using (auth.uid() = user_id)`: OK.
- `recipe_collections_update_own_recipe` requires the updated row to remain owned and reference an own recipe: OK.
- `recipe_collections_delete_own` remains own-row only: OK.

## SQL Ambiguity Review

The nested recipe ownership predicate uses:

```sql
where r.id = recipe_id
  and r.user_id = auth.uid()
```

Against the current repo baseline, this is not ambiguous because `public.recipes` has `id` and `user_id`, but no `recipe_id` column. Therefore `recipe_id` resolves to the row being inserted or updated in the relation table.

Non-blocking cleanup before production hardening:

- consider qualifying the outer columns for readability:
  - `r.id = public.favorite_recipes.recipe_id`;
  - `r.id = public.recipe_collections.recipe_id`.

This is not a staging apply blocker for the current schema.

## Safety Check

Confirmed by static review:

- no Premium tables are created;
- Premium SQL is not applied;
- no active `create table public.premium_*` statements are present;
- no `premium_shopping_items` or `user_premium_shopping_checks` table is created;
- `public.recipes` is referenced by FK/RLS only and is not altered, dropped, updated, deleted from, or inserted into;
- `public.recipe_ingredients` is not changed;
- `public.food_diary_entries` is not changed;
- no active destructive `drop table`, `delete from`, or `truncate` statements are present;
- production ref appears only in exclusion notes;
- no Supabase SQL execution was performed.

## Remaining Blockers

No blocker found in this second RLS hardening review.

Remaining non-blocking owner decisions:

- whether read-model tables such as `user_state`, `goal_trajectory`, and `progress_trends` should remain client-writable in staging or become service-only before production;
- whether to qualify relation-table outer columns now for readability, even though the current schema is not ambiguous.

## Staging Apply Readiness

**READY_FOR_STAGING_BASELINE_APPLY**

The reconciliation draft can be applied to staging only after a separate explicit owner approval. It should not be applied to production, and it should not be bundled with Premium SQL apply in the same execution step.

## Next Recommended Step

Recommended next package: `STAGING_BASELINE_RECONCILIATION_APPLY`.

Scope:

- apply `supabase/migration_drafts/staging-baseline-reconciliation-draft-2026-08-25.sql` only to staging ref `ozidryfvhkcbtpnulakq`;
- validate created baseline tables, constraints, indexes, RLS policies, and preserved row counts;
- keep production ref `dtsdnhbcwpbfrhcazqkb` untouched;
- retry Premium apply only in a later separate task after baseline validation passes.

## Verification

- `git diff --check`
  - Result: passed.
- Static safety grep
  - Result: passed.
- No Supabase SQL execution.
- No staging schema mutation.
- No production query.

## Final Verdict

**STAGING_BASELINE_RECONCILIATION_RLS_HARDENING_REVIEW_READY**
