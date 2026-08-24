# Today Premium Data Model SQL RLS Qualify Review

- Date: 2026-08-24
- Branch: `master`
- Reviewed SQL draft: `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`
- Source reports:
  - `reports/today-premium-data-model-sql-hardening-review-2026-08-23.md`
  - `reports/today-premium-data-model-sql-rls-qualify-fix-2026-08-24.md`
- Verdict: **TODAY_PREMIUM_DATA_MODEL_SQL_RLS_QUALIFY_REVIEW_READY**

## Review Verdict

The final RLS qualify fix is correct.

The previous ambiguity blocker in the nested allowed-option check is closed. The hardened SQL draft is ready for a separately approved staging dry-run plan.

Staging readiness marker: **READY_FOR_STAGING_DRY_RUN_PLAN**.

## RLS Qualify Check

`user_premium_meal_selections_insert_own`:

- Allowed-option check uses `public.user_premium_meal_selections.premium_meal_slot_id`: OK.
- Allowed-option check uses `public.user_premium_meal_selections.selected_premium_recipe_id`: OK.
- `selected_premium_recipe_id is null` remains allowed for clear-to-default: OK.
- Selected recipe active check via `premium_recipes pr` and `pr.is_active = true` is preserved: OK.
- Meal slot belongs to the selected plan through `user_premium_plan_selections` -> `premium_plan_days` -> `premium_meal_slots`: OK.
- Parent ownership through `upps.user_id = auth.uid()` is preserved: OK.

`user_premium_meal_selections_update_own`:

- Same explicit allowed-option qualification is present: OK.
- Clear-to-default remains allowed: OK.
- Active recipe check is preserved: OK.
- Meal slot belongs to selected plan: OK.
- `using` still protects existing row ownership through the parent selected plan: OK.

The nested `premium_meal_recipe_options` subqueries no longer contain the ambiguous unqualified comparisons:

- `pmro.premium_meal_slot_id = premium_meal_slot_id`
- `pmro.premium_recipe_id = selected_premium_recipe_id`

## Remaining Blockers

No blocker found in this final RLS qualify review.

Remaining product decisions are not staging blockers for a schema dry-run plan, but still need owner approval before production application.

## Safety Check

Confirmed by static grep:

- No active DDL/DML touches `public.recipes`.
- No active DDL/DML touches `public.recipe_ingredients`.
- No active DDL/DML touches `public.food_diary_entries`.
- No payment/auth table changes beyond existing FKs to `auth.users`.
- No real shopping source-of-truth table is created.
- Optional `user_premium_shopping_checks` remains comment-only.
- No AI/runtime columns are added.
- Catalog RLS was not changed by the qualify fix.
- Table model, indexes, triggers, nullable MVP fields, and shopping strategy were not changed by the qualify fix.

## Staging Dry-Run Readiness

**READY_FOR_STAGING_DRY_RUN_PLAN**

The SQL draft can move to a separately approved staging dry-run planning step. This review did not connect to Supabase and did not execute the migration.

Suggested staging dry-run plan should include:

- schema apply against staging only;
- policy introspection through `pg_policies`;
- table/constraint/index introspection;
- negative RLS tests for cross-user goal references, inactive plans, unrelated slots, and disallowed recipes;
- confirmation that no rows are inserted into old recipe/diary/payment/shopping/AI surfaces.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_DATA_MODEL_STAGING_DRY_RUN_PLAN`.

Scope:

- Prepare staging-only dry-run instructions and validation SQL.
- Do not apply anything until explicit owner approval.
- Keep production untouched.
- Keep runtime UI on mock data until schema is approved and applied separately.

## Verification

- `git diff --check`
  - Result: passed.
- Static safety grep
  - Result: passed.
- No Supabase connection.
- No migration execution.

## Final Verdict

**TODAY_PREMIUM_DATA_MODEL_SQL_RLS_QUALIFY_REVIEW_READY**
