# Today Premium Data Model SQL Draft

- Date: 2026-08-23
- Branch: `master`
- Source spec: `reports/today-premium-data-model-spec-2026-08-23.md`
- Verdict: **TODAY_PREMIUM_DATA_MODEL_SQL_DRAFT_READY**

## Scope

Created an idempotent SQL draft migration for the future POTOK Premium data model.

No runtime code changes, DB migration execution, Supabase deploy, payment/auth changes, diary/workout writes, recipe import, real recipe runtime, real shopping list runtime, AI runtime, voice input, commit, push, or PR work was done.

## Files Created

- `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`
- `reports/today-premium-data-model-sql-draft-2026-08-23.md`

## Tables Included

Catalog tables:

- `premium_plans`
- `premium_plan_days`
- `premium_meal_slots`
- `premium_recipes`
- `premium_recipe_ingredients`
- `premium_recipe_steps`
- `premium_recipe_hints`
- `premium_meal_recipe_options`

User state tables:

- `user_premium_plan_selections`
- `user_premium_meal_selections`

The draft keeps MVP fields nullable where the data model spec recommended flexibility:

- `goal_type`
- `difficulty`
- `meal_type`
- recipe `category`
- recipe macro/time metadata
- ingredient `amount_g`
- selected plan `user_goal_id`
- selected plan `start_date`
- selected replacement recipe id

## RLS Included

Catalog RLS:

- RLS enabled on all Premium catalog tables.
- Authenticated users can select active catalog rows.
- Child catalog rows are selectable only when their parent plan or recipe is active.
- No regular-user insert/update/delete policies are created for catalog tables.
- Service/admin management is intentionally left to controlled scripts or future admin tooling.

User state RLS:

- Users can select/insert/update/delete only their own `user_premium_plan_selections`.
- Users can select/insert/update/delete `user_premium_meal_selections` only through ownership of the parent `user_premium_plan_selections` row.
- No policy allows regular users to mutate catalog plans or recipes.

## Indexes Included

Catalog indexes:

- active/goal lookup for `premium_plans`;
- plan/day lookup for `premium_plan_days`;
- day/sort and meal type lookup for `premium_meal_slots`;
- active/category, title, and created date lookup for `premium_recipes`;
- recipe/sort and ingredient name lookup for `premium_recipe_ingredients`;
- recipe/step lookup for `premium_recipe_steps`;
- recipe/sort lookup for `premium_recipe_hints`;
- slot/sort, recipe, option type, and slot/recipe uniqueness for `premium_meal_recipe_options`.

User state indexes:

- user/status lookup and one-active-plan partial unique index for `user_premium_plan_selections`;
- plan, goal, selected plan, meal slot, and selected recipe indexes for user selection tables;
- one selection per selected-plan/meal-slot uniqueness for `user_premium_meal_selections`.

## What Was Intentionally Not Included

- No `premium_shopping_items` source-of-truth table.
- No active `user_premium_shopping_checks` table; an optional future section is commented only.
- No seed data.
- No changes to `public.recipes`.
- No changes to `public.recipe_ingredients`.
- No changes to `/nutrition/recipes`.
- No changes to `food_diary_entries` or other diary tables.
- No changes to workout tables.
- No payment/auth/entitlement table changes.
- No AI-generated records or AI runtime columns.
- No triggers or functions that write diary, recipe, shopping, payment, or auth data.

## Known Review Points

- Confirm whether catalog select should be open to all authenticated users or later gated by Premium entitlement in a separate payment/auth phase.
- Confirm whether `user_premium_plan_selections` should allow one active plan per user or multiple active plans.
- Confirm final taxonomy for:
  - `goal_type`;
  - `meal_type`;
  - recipe `category`;
  - `difficulty`;
  - replacement `option_type`.
- Decide whether Premium recipe ingredients need `canonical_food_id` in a later content QA migration.
- Decide whether recipe/day macros should be stored as source values or derived from ingredients after content normalization.
- Review whether selected plan should reference `user_goals(user_id)` directly or a future immutable goal snapshot table.

## Dry-Run / Readiness Notes

- The draft is wrapped in `begin;` / `commit;`.
- Tables use `create table if not exists`.
- Indexes use `create index if not exists`.
- Check constraints are added through safe `DO` blocks that verify existing constraint names first.
- RLS policies are recreated idempotently with `drop policy if exists` then `create policy`.
- The SQL file includes commented post-apply validation queries for future approved execution.
- This task did not connect to Supabase and did not execute the migration.

## Verification

- `git diff --check`
  - Result: passed.
- Static safety grep over the SQL draft
  - Result: active statements create/alter only the new Premium tables from this draft.
  - Notes: `public.recipes`, `public.recipe_ingredients`, `public.food_diary_entries`, `premium_shopping_items`, and `user_premium_shopping_checks` appear only in safety comments or commented optional future notes, not active DDL.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_DATA_MODEL_SQL_DRAFT_REVIEW`.

Scope:

- Review the SQL draft without applying it.
- Optionally run a local/static SQL parser if available.
- Confirm RLS policy shape and taxonomy nullable fields.
- Prepare a tiny seed-data draft only after schema review approval.

## Final Verdict

**TODAY_PREMIUM_DATA_MODEL_SQL_DRAFT_READY**
