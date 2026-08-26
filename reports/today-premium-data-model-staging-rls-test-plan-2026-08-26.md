# Today Premium Data Model Staging RLS Test Plan

- Date: 2026-08-26
- Branch: `master`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Prerequisites:
  - `STAGING_BASELINE_RECONCILIATION_APPLY_READY`
  - `TODAY_PREMIUM_DATA_MODEL_STAGING_APPLY_RETRY_READY`
  - `TODAY_PREMIUM_STAGING_APPLY_REPORTS_COMMITTED`
- Verdict: **TODAY_PREMIUM_DATA_MODEL_STAGING_RLS_TEST_PLAN_READY**

## Scope

Prepare a minimal staging-only RLS test plan for the Premium data model.

This is a plan/report only. Do not execute SQL, create seed data, mutate staging, touch production, apply baseline SQL, reapply Premium schema SQL, or involve runtime app writes without a separate explicit owner-approved apply/test task.

## Production Exclusion

Never use production project `dtsdnhbcwpbfrhcazqkb`.

All future test execution must explicitly target staging project `ozidryfvhkcbtpnulakq` and should re-confirm the linked project before running any SQL.

## Prerequisite Status

Ready for a separate RLS test execution package:

- baseline reconciliation has been applied on staging;
- Premium schema has been applied on staging;
- Premium tables exist and are empty after schema-only apply;
- deparsed staging policies already confirm the intended hardened predicates;
- behavioral RLS tests remain pending because no minimal test users/catalog seed were created during schema apply.

## Minimal Seed Objects

Use a tiny, isolated seed set. Prefer deterministic labels or titles such as `rls_test_*` so cleanup can find only test rows.

Required auth/test users:

- `test_user_a`
- `test_user_b`

Required baseline user rows:

- `public.user_goals` for `test_user_a`
- `public.user_goals` for `test_user_b`

Required Premium catalog rows:

- `premium_plan_active_a`
  - `is_active = true`
  - the plan selected by `test_user_a`
- `premium_plan_inactive`
  - `is_active = false`
  - used to test inactive plan blocking
- `premium_plan_other`
  - `is_active = true`
  - contains an out-of-plan meal slot
- `premium_plan_day_active_a`
  - belongs to `premium_plan_active_a`
- `premium_plan_day_other`
  - belongs to `premium_plan_other`
- `premium_meal_slot_allowed`
  - belongs to `premium_plan_day_active_a`
- `premium_meal_slot_outside_plan`
  - belongs to `premium_plan_day_other`
- `premium_recipe_allowed_active`
  - `is_active = true`
- `premium_recipe_disallowed_active`
  - `is_active = true`
- `premium_recipe_allowed_inactive`
  - `is_active = false`
- `premium_meal_recipe_options` row only for:
  - `premium_meal_slot_allowed`
  - `premium_recipe_allowed_active`

User state rows created during tests:

- `user_premium_plan_selection_a`
  - owned by `test_user_a`
  - references `premium_plan_active_a`
  - first create with `user_goal_id null`
  - optionally create/update with `user_goal_id = test_user_a`
- `user_premium_meal_selection_a`
  - owned through `user_premium_plan_selection_a`
  - references `premium_meal_slot_allowed`

Avoid broad content seed, real recipes, diary writes, workout writes, payment rows, AI/runtime rows, and shopping source-of-truth rows.

## Execution Safety

Recommended execution shape for a later approved task:

- Use staging only: `ozidryfvhkcbtpnulakq`.
- Reconfirm production `dtsdnhbcwpbfrhcazqkb` is not linked or used.
- Use dedicated test users and isolated `rls_test_*` catalog titles.
- Prefer a transaction for catalog/test-data setup where possible.
- Use separate authenticated sessions/JWTs for `test_user_a` and `test_user_b`.
- Keep service-role/setup writes separate from authenticated-user RLS assertions.
- Do not run through the runtime app.
- Do not create real content seed.
- Capture every SQL result/error in the execution report.

## Test Matrix

| ID | Actor | Action | Expected |
| --- | --- | --- | --- |
| CATALOG-01 | `test_user_a` | Insert into `premium_plans` | Fail: regular user cannot mutate catalog |
| CATALOG-02 | `test_user_a` | Update `premium_recipes` | Fail: regular user cannot mutate catalog |
| CATALOG-03 | `test_user_a` | Delete from `premium_meal_recipe_options` | Fail: regular user cannot mutate catalog |
| PLAN-01 | `test_user_a` | Insert `user_premium_plan_selection` with `user_goal_id null` and active plan | Pass |
| PLAN-02 | `test_user_a` | Insert selection with `user_goal_id = test_user_a` and active plan | Pass |
| PLAN-03 | `test_user_a` | Insert selection with `user_goal_id = test_user_b` | Fail |
| PLAN-04 | `test_user_a` | Insert selection for `premium_plan_inactive` | Fail |
| PLAN-05 | `test_user_b` | Select `test_user_a` plan selection | Return no rows |
| PLAN-06 | `test_user_b` | Update `test_user_a` plan selection | Fail or affect 0 rows |
| MEAL-01 | `test_user_a` | Insert meal selection for `premium_meal_slot_allowed` with `selected_premium_recipe_id null` | Pass |
| MEAL-02 | `test_user_a` | Insert/update meal selection with `premium_recipe_allowed_active` | Pass |
| MEAL-03 | `test_user_a` | Insert meal selection for `premium_meal_slot_outside_plan` | Fail |
| MEAL-04 | `test_user_a` | Select `premium_recipe_disallowed_active` for allowed slot | Fail |
| MEAL-05 | `test_user_a` | Select `premium_recipe_allowed_inactive` for allowed slot | Fail |
| MEAL-06 | `test_user_b` | Select `test_user_a` meal selection | Return no rows |
| MEAL-07 | `test_user_b` | Update `test_user_a` meal selection | Fail or affect 0 rows |
| MEAL-08 | `test_user_a` | Update meal selection back to `selected_premium_recipe_id null` | Pass |

## Expected PASS / FAIL Criteria

PASS means:

- setup rows are created only by an approved elevated staging setup path;
- authenticated regular-user catalog mutation attempts fail;
- `test_user_a` can create only valid own selection rows;
- cross-user goal references are blocked;
- inactive plan selection is blocked;
- meal slot outside selected plan is blocked;
- recipe outside allowed options is blocked;
- inactive recipe selection is blocked;
- `selected_premium_recipe_id null` works for clear-to-default;
- `test_user_b` cannot read or change `test_user_a` user-owned Premium rows;
- cleanup removes all test rows.

FAIL means:

- any regular user can insert/update/delete catalog rows;
- a user can bind another user's `user_goal_id`;
- inactive Premium plans can be newly selected;
- a meal slot outside the selected plan can be used;
- a recipe outside the allowed options can be selected;
- inactive recipes can be selected;
- user-owned rows are visible or mutable by another user;
- cleanup cannot safely isolate the test rows.

## Cleanup Plan

Cleanup must run only on staging and only for isolated `rls_test_*` rows.

Recommended order:

1. Delete `public.user_premium_meal_selections` test rows.
2. Delete `public.user_premium_plan_selections` test rows.
3. Delete `public.premium_meal_recipe_options` test rows.
4. Delete `public.premium_meal_slots` test rows.
5. Delete `public.premium_plan_days` test rows.
6. Delete `public.premium_recipe_hints` / `premium_recipe_steps` / `premium_recipe_ingredients` test rows if created.
7. Delete `public.premium_recipes` test rows.
8. Delete `public.premium_plans` test rows.
9. Delete `public.user_goals` rows for dedicated test users only if they were created solely for this test.
10. Remove or disable dedicated auth test users only if owner approves auth cleanup.

Never delete existing staging rows that are not clearly marked as test data.

## Risks

- Authenticated RLS tests require valid JWT/session setup for two users; this should be prepared deliberately, not guessed.
- Service-role setup can bypass RLS, so setup and assertion phases must be clearly separated.
- Partial cleanup can leave test catalog rows visible to authenticated users if `is_active = true`.
- The one-active-plan partial unique index can interfere if a reused test user already has an active Premium plan selection.
- Because catalog tables currently have no admin-only mutation policy, setup should use service-role or SQL editor context, not a regular user.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_DATA_MODEL_STAGING_RLS_TEST_EXECUTION_DRAFT`.

Scope:

- prepare exact staging-only SQL/JWT execution instructions;
- include minimal setup SQL and cleanup SQL;
- explicitly separate service-role setup from authenticated-user assertions;
- do not execute until owner approves the test execution task.

## Verification

- `git diff --check`
  - Result: pending after report creation.
- No Supabase SQL execution.
- No staging mutation.
- No production query.

## Final Verdict

**TODAY_PREMIUM_DATA_MODEL_STAGING_RLS_TEST_PLAN_READY**
