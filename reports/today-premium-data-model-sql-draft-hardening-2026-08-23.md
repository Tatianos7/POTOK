# Today Premium Data Model SQL Draft Hardening

- Date: 2026-08-23
- Branch: `master`
- Source review: `reports/today-premium-data-model-sql-draft-review-2026-08-23.md`
- SQL draft: `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`
- Verdict: **TODAY_PREMIUM_DATA_MODEL_SQL_DRAFT_HARDENING_READY**

## Scope

Hardened the unapplied POTOK Premium SQL draft after architecture review.

No runtime code changes, DB migration execution, Supabase deploy, payment/auth changes, diary/workout writes, recipe import, real recipe runtime, real shopping list runtime, AI runtime, voice input, commit, push, or PR work was done.

## What Was Fixed

Updated only RLS policy predicates in:

- `user_premium_plan_selections_insert_own`
- `user_premium_plan_selections_update_own`
- `user_premium_meal_selections_insert_own`
- `user_premium_meal_selections_update_own`

The general table model was not changed.

## Hardened RLS Predicates

`user_premium_plan_selections` insert/update now requires:

- `auth.uid() = user_id`;
- `user_goal_id is null or user_goal_id = auth.uid()`;
- `premium_plan_id` references an active `premium_plans` row.

`user_premium_meal_selections` insert/update now requires:

- parent `user_premium_plan_selection_id` belongs to `auth.uid()`;
- `premium_meal_slot_id` belongs to the selected `premium_plan_id` through `premium_plan_days`;
- `selected_premium_recipe_id is null`, or the selected recipe is allowed through `premium_meal_recipe_options` for that exact meal slot;
- selected replacement recipe is active when present.

These checks close the review blockers where a user could otherwise reference another user's goal, inactive catalog plans, unrelated meal slots, or recipes outside allowed replacement options.

## Why `user_goals(user_id)` Was Kept

The FK remains:

- `user_premium_plan_selections.user_goal_id references public.user_goals(user_id)`

This is correct for the current project because `public.user_goals.user_id` is the primary key in `supabase/schema.sql`. No separate `user_goals.id` primary key exists in the current schema.

The hardened RLS additionally binds `user_goal_id` to `auth.uid()`, so the FK remains structurally correct and user-scoped.

## What Did Not Change

- No catalog table structure changes.
- No seed data.
- No `premium_shopping_items` source-of-truth table.
- No active `user_premium_shopping_checks` table.
- No changes to `public.recipes`.
- No changes to `public.recipe_ingredients`.
- No changes to diary tables.
- No changes to workout tables.
- No payment/auth table changes beyond existing FKs to `auth.users`.
- No AI/runtime columns.
- Catalog read policies remain active-row read only.
- Nullable MVP fields remain nullable.

## Remaining Owner Approval Questions

- Should one active Premium plan per user remain enforced through the partial unique index?
- Should users keep access to already-selected plans if the catalog plan later becomes inactive?
- Should catalog select stay available to all authenticated users until the separate payment/auth phase?
- Should Premium ingredients add `canonical_food_id` now or wait for content QA?
- Should selected day totals be derived from selected recipes or stored as user-specific snapshots later?

## Staging Readiness Verdict

The SQL draft is now materially stronger and ready for a second review pass.

Do not apply to staging yet without explicit owner approval. Recommended next step is a focused SQL review of the hardened predicates, followed by a separate staging dry-run/apply package if approved.

## Verification

- `git diff --check`
  - Result: passed.
- Static safety grep
  - Result: passed.
  - Notes: references to `public.recipes`, `public.recipe_ingredients`, `public.food_diary_entries`, payment/auth safety, AI, and optional shopping checks are comments only; no active DDL/DML touches those surfaces.
- No Supabase connection.
- No migration execution.

## Final Verdict

**TODAY_PREMIUM_DATA_MODEL_SQL_DRAFT_HARDENING_READY**
