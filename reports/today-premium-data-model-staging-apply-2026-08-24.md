# Today Premium Data Model Staging Apply

- Date: 2026-08-25
- Branch: `master`
- Staging project ref used: `ozidryfvhkcbtpnulakq`
- Production project ref excluded: `dtsdnhbcwpbfrhcazqkb`
- SQL draft: `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`
- Dry-run plan: `reports/today-premium-data-model-staging-dry-run-plan-2026-08-24.md`
- Verdict: **STAGING_APPLY_REQUIRES_FIXES**

## Scope

Staging-only apply attempt for the POTOK Premium data model SQL draft.

No runtime code changes, production changes, Supabase deploy, payment/auth changes, diary/workout writes, recipe import, real recipe runtime, real shopping list runtime, AI runtime, voice input, commit, push, or PR work was done.

## Preflight Result

- Branch checked: `master`.
- Git status checked.
- Worktree contains unrelated dirty/untracked files from other workstreams.
- No runtime files were changed by this task.
- SQL draft provenance checked:
  - latest commit touching the SQL draft / final review package: `d084c31 today premium data model draft package`;
  - final RLS qualify review marked the draft ready for staging dry-run planning.
- Supabase CLI authorization works after the previous auth blocker.
- Supabase projects list confirmed:
  - staging: `POTOK Staging`, ref `ozidryfvhkcbtpnulakq`, status `ACTIVE_HEALTHY`;
  - production: `POTOK`, ref `dtsdnhbcwpbfrhcazqkb`, status `ACTIVE_HEALTHY`.
- Local Supabase project was linked explicitly to staging ref `ozidryfvhkcbtpnulakq`.
- Local linked ref check returned `ozidryfvhkcbtpnulakq`.
- Production ref `dtsdnhbcwpbfrhcazqkb` was not linked or used for SQL execution.

## Pre-Apply Safety Snapshot

Read-only staging checks before apply:

- `public.recipes`: exists, row count `0`;
- `public.recipe_ingredients`: exists, row count `0`;
- `public.food_diary_entries`: exists, row count `0`;
- `public.premium_shopping_items`: absent;
- `public.user_premium_shopping_checks`: absent;
- `public.premium_plans`: absent.

## Apply Result

Apply was attempted only against linked staging project `ozidryfvhkcbtpnulakq`.

Command shape:

```text
supabase db query --linked --file supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql --output-format json
```

Result: failed.

Observed error:

```text
LegacyDbQueryUnexpectedStatusError: unexpected status 400:
Failed to run sql query: ERROR: 42P01: relation "public.user_goals" does not exist
```

No blind fixes were made. No retry with modified SQL was attempted.

## Validation Result

Because the SQL draft is wrapped in `begin;` / `commit;`, the failed apply rolled back.

Post-failure compact validation on staging:

- `public.premium_plans`: absent;
- `public.user_premium_plan_selections`: absent;
- `public.user_goals`: absent;
- `public.premium_shopping_items`: absent;
- `public.user_premium_shopping_checks`: absent;
- Premium/user Premium policy count in `pg_policies`: `0`.

The 10 Premium tables were not created:

- `premium_plans`: not created;
- `premium_plan_days`: not created;
- `premium_meal_slots`: not created;
- `premium_recipes`: not created;
- `premium_recipe_ingredients`: not created;
- `premium_recipe_steps`: not created;
- `premium_recipe_hints`: not created;
- `premium_meal_recipe_options`: not created;
- `user_premium_plan_selections`: not created;
- `user_premium_meal_selections`: not created.

Constraints, indexes, RLS policies, triggers, and row counts for the new Premium tables could not be validated because the schema apply failed before table creation.

## Safety Validation

Confirmed after the failed apply:

- no Premium tables remain partially created;
- no Premium RLS policies remain partially created;
- `premium_shopping_items` was not created;
- `user_premium_shopping_checks` was not created;
- `public.recipes` remained at row count `0`;
- `public.recipe_ingredients` remained at row count `0`;
- `public.food_diary_entries` remained at row count `0`;
- no production SQL execution was performed.

Local SQL draft still contains no active DDL/DML against:

- `public.recipes`;
- `public.recipe_ingredients`;
- `public.food_diary_entries`;
- workout tables;
- payment/auth tables beyond foreign key references to `auth.users`;
- AI/runtime tables or columns.

## Negative RLS Tests

Not executed.

Reason:

- schema apply failed before Premium tables and policies were created;
- staging currently lacks `public.user_goals`, which blocks the draft FK:
  `user_premium_plan_selections.user_goal_id references public.user_goals(user_id)`.

Pending after schema prerequisite is resolved:

- user cannot select inactive `premium_plan`;
- user cannot insert `user_premium_plan_selection` with another user's `user_goal_id`;
- user cannot insert selection for inactive plan;
- user cannot insert meal selection for slot outside selected plan;
- user cannot insert selected recipe outside allowed options;
- user can insert `selected_premium_recipe_id null` for clear-to-default;
- regular user cannot mutate catalog tables.

## Error Analysis

The draft assumes `public.user_goals` exists, which matched the reviewed project schema snapshot where `user_goals.user_id` is the primary key.

Staging database `ozidryfvhkcbtpnulakq` currently does not have `public.user_goals`, so the Premium draft cannot be applied as-is.

This is a staging schema prerequisite mismatch, not a runtime UI issue.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_DATA_MODEL_STAGING_SCHEMA_PREREQ_REVIEW`.

Scope:

- inspect staging schema baseline for goal tables;
- decide whether staging should first receive the existing `user_goals` schema;
- or update the Premium draft to make the goal link optional without an immediate FK until goal schema parity is restored;
- do not apply to production;
- do not make blind SQL edits during apply.

After owner approval and prerequisite decision, rerun staging apply validation.

## Final Verdict

**STAGING_APPLY_REQUIRES_FIXES**
