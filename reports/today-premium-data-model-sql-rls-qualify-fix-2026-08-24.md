# Today Premium Data Model SQL RLS Qualify Fix

- Date: 2026-08-24
- Branch: `master`
- Source review: `reports/today-premium-data-model-sql-hardening-review-2026-08-23.md`
- SQL draft: `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`
- Verdict: **TODAY_PREMIUM_DATA_MODEL_SQL_DRAFT_RLS_QUALIFY_FIX_READY**

## Scope

Fixed the remaining RLS allowed-option predicate issue in the unapplied POTOK Premium SQL draft.

No runtime code changes, DB migration execution, Supabase deploy, payment/auth changes, diary/workout writes, recipe import, real recipe runtime, real shopping list runtime, AI runtime, voice input, commit, push, or PR work was done.

## What Was Fixed

The nested allowed recipe option checks now explicitly reference the outer target table columns:

- `public.user_premium_meal_selections.premium_meal_slot_id`
- `public.user_premium_meal_selections.selected_premium_recipe_id`

This prevents PostgreSQL name resolution from accidentally binding unqualified column names to the inner `premium_meal_recipe_options` alias.

## Policies Changed

- `user_premium_meal_selections_insert_own`
- `user_premium_meal_selections_update_own`

Both policies still preserve:

- parent selection ownership through `auth.uid()`;
- meal slot membership in the selected Premium plan;
- `selected_premium_recipe_id is null` for clear-to-default;
- selected recipe must exist as an allowed option for the selected slot;
- selected recipe must be active.

## Why Explicit Qualification Is Needed

The inner allowed-option subquery reads from `public.premium_meal_recipe_options pmro`, which also has `premium_meal_slot_id`. Without explicit qualification, a condition such as `pmro.premium_meal_slot_id = premium_meal_slot_id` can resolve the right side against the inner table rather than the outer policy row.

Using `public.user_premium_meal_selections.<column>` makes the intended cross-row comparison unambiguous and keeps the RLS predicate tied to the row being inserted or updated.

## What Did Not Change

- Table model.
- Catalog RLS.
- Nullable MVP fields.
- Indexes.
- Triggers.
- Shopping strategy.
- `public.recipes`.
- Diary tables.
- Workout tables.
- Payment/auth tables.
- AI/runtime behavior.

## Readiness Recommendation

The previously identified RLS qualification blocker is fixed. Recommended next step is a final static review of the hardened SQL draft before any separately approved staging dry-run.

## Verification

- `git diff --check`
  - Result: passed.
- Static safety grep
  - Result: passed.
  - Notes: both allowed-option predicates now use explicit `public.user_premium_meal_selections` column references; old recipe/diary/payment/AI/shopping references remain comments only.
- No Supabase connection.
- No migration execution.

## Final Verdict

**TODAY_PREMIUM_DATA_MODEL_SQL_DRAFT_RLS_QUALIFY_FIX_READY**
