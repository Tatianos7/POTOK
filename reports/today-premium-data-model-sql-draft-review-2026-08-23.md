# Today Premium Data Model SQL Draft Review

- Date: 2026-08-23
- Branch: `master`
- Reviewed files:
  - `reports/today-premium-data-model-spec-2026-08-23.md`
  - `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`
  - `reports/today-premium-data-model-sql-draft-2026-08-23.md`
- Verdict: **REQUIRES_FIXES**

## Review Verdict

The SQL draft is safe as an unapplied draft and matches the broad Premium data model direction: Premium catalog tables are separate from user recipes, plan data is separate from diary facts, and no shopping source-of-truth table is created.

Before staging apply, the draft needs RLS/integrity hardening for user-owned selection rows. The required fixes are scoped and do not require changing the overall table model.

## Critical Blockers

1. `user_premium_plan_selections` can reference another user's `user_goals` row if the UUID is known.

Current FK is structurally valid because `public.user_goals.user_id` is the primary key in `supabase/schema.sql`. However, the insert/update RLS only checks `auth.uid() = user_id`; it does not check that `user_goal_id is null or user_goal_id = auth.uid()`.

Required before staging:

- Add `with check (auth.uid() = user_id and (user_goal_id is null or user_goal_id = auth.uid()))` to insert/update policies.

2. `user_premium_plan_selections` can select inactive catalog plans by FK if an inactive `premium_plan_id` is known.

Catalog read policies hide inactive rows, but the user selection insert/update policy does not require the referenced `premium_plans.is_active = true`.

Required before staging:

- Add an insert/update `with check` predicate requiring `premium_plan_id` to reference an active `premium_plans` row, unless owner explicitly wants users to preserve inactive/archived plan selections.

3. `user_premium_meal_selections` can reference a meal slot outside the selected plan.

The parent ownership check is good, but it does not verify that `premium_meal_slot_id` belongs to the plan selected by `user_premium_plan_selection_id`.

Required before staging:

- Add insert/update `with check` logic that joins:
  - `user_premium_plan_selections`;
  - `premium_plan_days`;
  - `premium_meal_slots`;
  - and confirms the meal slot belongs to the selected plan.

4. `user_premium_meal_selections` can reference a recipe that is not an allowed option for that meal slot.

The FK verifies that the recipe exists, but not that it is connected through `premium_meal_recipe_options`.

Required before staging:

- Add insert/update `with check` logic requiring either:
  - `selected_premium_recipe_id is null`; or
  - an active `premium_meal_recipe_options` row exists for `(premium_meal_slot_id, selected_premium_recipe_id)`.

## Recommended Fixes

- Rename or document `user_goal_id` clearly as a reference to `user_goals.user_id`. The FK is correct for the current project, but the column name can imply a separate goal id.
- Consider adding `force row level security` on the new tables for consistency with newer hardened migrations.
- Consider splitting catalog admin mutation policies into a future admin-only migration if regular admin UI is expected; current draft relies on service-role bypass/controlled scripts, which is acceptable for now.
- Consider adding `created_at` / `updated_at` to `premium_meal_slots`, `premium_recipe_ingredients`, `premium_recipe_steps`, `premium_recipe_hints`, and `premium_meal_recipe_options` later if admin audit/history needs them. Not required for MVP read paths.
- Consider replacing the duplicate non-unique index on `(premium_plan_id, day_number)` with only the unique index; PostgreSQL can use the unique index for lookup. Same note applies to `premium_recipe_steps`.

## Non-Blocking Notes

- `create table if not exists` is fine for first apply, but it will not repair a partially-created table with missing columns. Before staging, run against a clean staging DB or add explicit column existence checks if partial drift is possible.
- The shared function name `public.update_premium_updated_at()` does not conflict with known current project functions from this review. It is reasonably scoped, though a more explicit name such as `update_today_premium_updated_at` would reduce future ambiguity.
- The one-active-plan partial unique index is a product decision. It is safe if the intended MVP is one active Premium plan per user; owner approval is needed if multiple simultaneous Premium plans may be allowed.
- The draft intentionally keeps `goal_type`, `category`, `difficulty`, `meal_type`, `option_type`, and ingredient food-catalog mapping flexible. This matches the spec and avoids over-strict MVP enums.

## RLS Review

Catalog tables:

- `premium_plans` select policy exposes only `is_active = true`.
- Plan child tables are selectable only when parent plan is active.
- Recipe child tables are selectable only when parent recipe is active.
- `premium_meal_recipe_options` requires both active parent plan and active recipe.
- No insert/update/delete policies are created for regular users on catalog tables.

User tables:

- `user_premium_plan_selections` ownership is checked by `auth.uid() = user_id`.
- `user_premium_meal_selections` ownership is checked through parent `user_premium_plan_selections`.

RLS gaps to fix before staging:

- bind `user_goal_id` to `auth.uid()`;
- require selected plan to be active;
- require selected meal slot to belong to the selected plan;
- require selected replacement recipe to be allowed for that meal slot.

## FK Review

Catalog FK chain:

- `premium_plan_days.premium_plan_id -> premium_plans.id`: OK, `on delete cascade` is appropriate for catalog children.
- `premium_meal_slots.premium_plan_day_id -> premium_plan_days.id`: OK, `on delete cascade` is appropriate.
- `premium_recipe_ingredients.premium_recipe_id -> premium_recipes.id`: OK, `on delete cascade` is appropriate.
- `premium_recipe_steps.premium_recipe_id -> premium_recipes.id`: OK, `on delete cascade` is appropriate.
- `premium_recipe_hints.premium_recipe_id -> premium_recipes.id`: OK, `on delete cascade` is appropriate.
- `premium_meal_recipe_options.premium_meal_slot_id -> premium_meal_slots.id`: OK, `on delete cascade` is appropriate.
- `premium_meal_recipe_options.premium_recipe_id -> premium_recipes.id`: OK, `on delete restrict` is safe to prevent deleting recipes that are used by plan options.

User FK chain:

- `user_premium_plan_selections.user_id -> auth.users.id`: OK, `on delete cascade` is appropriate.
- `user_premium_plan_selections.user_goal_id -> user_goals.user_id`: OK for this project because `user_goals.user_id` is the primary key. No `user_goals.id` primary key exists in current schema.
- `user_premium_plan_selections.premium_plan_id -> premium_plans.id`: OK, `on delete restrict` is safe.
- `user_premium_meal_selections.user_premium_plan_selection_id -> user_premium_plan_selections.id`: OK, `on delete cascade` is appropriate.
- `user_premium_meal_selections.premium_meal_slot_id -> premium_meal_slots.id`: OK, `on delete restrict` is safe.
- `user_premium_meal_selections.selected_premium_recipe_id -> premium_recipes.id`: OK, `on delete restrict` is safe.

## Idempotency Review

Included and OK:

- `create table if not exists`;
- `create index if not exists`;
- named check constraints added through `DO` blocks;
- policies recreated with `drop policy if exists` then `create policy`;
- triggers recreated with `drop trigger if exists` then `create trigger`;
- migration wrapped in `begin;` / `commit;`.

Review note:

- `create or replace function public.update_premium_updated_at()` is idempotent, but would replace any existing function with the same name/signature. No current conflict was found in this review.

## Safety Review

Confirmed:

- no active DDL/DML touches `public.recipes`;
- no active DDL/DML touches `public.recipe_ingredients`;
- no active DDL/DML touches `public.food_diary_entries`;
- no diary/workout write path is created;
- no payment/auth tables are changed, except FKs to `auth.users`;
- no `/nutrition/recipes` path is involved;
- no `premium_shopping_items` table is created;
- optional `user_premium_shopping_checks` is comment-only;
- no AI/runtime columns are created.

## Staging Readiness

Not ready for staging as-is.

Staging apply can become reasonable after the RLS/integrity fixes above are applied and reviewed. No Supabase connection or migration execution was performed during this review.

Owner approval questions before staging:

- Should one active Premium plan per user be enforced?
- Should inactive plans remain selectable for users who already selected them, or only readable through historical user selections?
- Should regular authenticated users be allowed to read the catalog before payment enforcement, or should entitlement checks wait for a later payment/auth phase?
- Should Premium ingredient rows add `canonical_food_id` now, or defer until content QA?

## Verification

- `git diff --check`
  - Result: passed.
- Static/local review only.
- No Supabase connection.
- No migration execution.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_DATA_MODEL_SQL_DRAFT_HARDENING`.

Scope:

- Update the SQL draft only.
- Harden user selection RLS `with check` predicates.
- Keep catalog tables and safety boundaries unchanged.
- Run `git diff --check`.
- Do not apply the migration until a separate staging-apply approval.

## Final Verdict

**REQUIRES_FIXES**
