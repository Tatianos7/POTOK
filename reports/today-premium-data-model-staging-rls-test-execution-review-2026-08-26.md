# Today Premium Data Model Staging RLS Test Execution Review

- Date: 2026-08-26
- Branch: `master`
- Reviewed file: `reports/today-premium-data-model-staging-rls-test-execution-draft-2026-08-26.md`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Verdict: **TODAY_PREMIUM_DATA_MODEL_STAGING_RLS_TEST_EXECUTION_REVIEW_READY**

## Verdict

The Premium staging RLS test execution draft is ready for owner-approved execution planning.

No blocker was found. The draft is correctly scoped as staging-only, uses placeholders instead of secrets, separates service-role setup from authenticated assertions, covers the required RLS scenarios, and includes FK-safe cleanup guidance.

Readiness marker: **READY_FOR_OWNER_APPROVED_RLS_TEST_EXECUTION**.

## Scope Review

Confirmed:

- draft is explicitly staging-only for `ozidryfvhkcbtpnulakq`;
- production ref `dtsdnhbcwpbfrhcazqkb` appears only as an exclusion;
- no real JWT, token, service-role key, password, or secret value is present;
- all sensitive values are placeholders;
- no runtime app writes are included;
- no diary/workout writes are included;
- no recipe import is included;
- no AI/runtime rows are included;
- SQL snippets are documented as templates and are not self-executing.

## Setup Review

Confirmed:

- service-role/setup phase is separate from authenticated assertions;
- test users are prerequisites and are not created/deleted by the draft;
- auth user cleanup is explicitly out of scope unless owner approves;
- seed is minimal and limited to user goals, three Premium plans, two plan days, two meal slots, three Premium recipes, and one allowed option;
- catalog rows use `rls_test_*` labels/titles;
- user goals use `rls_test_*` goal types;
- setup avoids broad content seed, diary writes, workout writes, payment rows, AI/runtime rows, and shopping source-of-truth rows.

Non-blocking note:

- The setup uses fixed `sort_order = 1` under different plan days, so it should not conflict with the unique `(premium_plan_day_id, sort_order)` index.

## Assertions Review

Covered and OK:

- regular user cannot mutate catalog tables:
  - `premium_plans` insert;
  - `premium_recipes` update;
  - `premium_meal_recipe_options` delete.
- active plan with `user_goal_id null` is allowed;
- own `user_goal_id` is allowed;
- cross-user `user_goal_id` is blocked;
- inactive plan is blocked;
- clear-to-default `selected_premium_recipe_id null` is allowed;
- allowed active recipe is allowed;
- slot outside selected plan is blocked;
- disallowed recipe is blocked;
- inactive recipe is blocked;
- user B cannot read user A plan/meal selections;
- user B cannot update user A plan/meal selections.

Expected results are present for each assertion: pass, fail with RLS/check/permission error, or return/affect 0 rows.

## SQL Correctness Review

OK:

- `PLAN-01` creates the active selection used by later meal tests.
- `MEAL-01` uses `<USER_A_PLAN_SELECTION_ID>` and `<ALLOWED_SLOT_ID>` from the selected plan.
- `MEAL-02` uses the only recipe connected through `premium_meal_recipe_options`.
- `MEAL-03` updates to `<OUTSIDE_SLOT_ID>`, which belongs to another plan and should be blocked by the hardened RLS predicate.
- `MEAL-04` uses an active recipe that is not in allowed options and should be blocked.
- `MEAL-05` uses an inactive recipe and should be blocked.
- `MEAL-08` verifies clear-to-default by setting `selected_premium_recipe_id = null`.

One-active-plan unique index:

- The draft correctly notes the possible masking risk.
- `PLAN-04` uses `status = 'paused'`, so it should not collide with the partial unique index `where status = 'active'`.
- Therefore the inactive-plan test should reach the active-plan RLS/check predicate instead of being masked by the unique index.

Execution nuance:

- SQL Editor or `supabase db query --linked` are appropriate for service-role/setup and cleanup contexts.
- They are not sufficient for authenticated-user assertions unless the execution method truly runs with `authenticated` role and the user JWT claims that make `auth.uid()` equal to the target user.

## Cleanup Review

OK:

- cleanup is service-role only;
- cleanup order follows FK dependencies:
  - user meal selections;
  - user plan selections;
  - meal recipe options;
  - meal slots;
  - plan days;
  - recipe children;
  - recipes;
  - plans;
  - test user goals.
- cleanup targets `rls_test_*` catalog rows and dedicated test-user ids;
- cleanup warns not to delete non-test staging rows;
- auth test-user cleanup requires separate owner approval.

Non-blocking caution:

- `delete from public.user_premium_plan_selections where user_id in (...)` deletes all Premium selections for the two dedicated test users. This is acceptable only if the users are dedicated to this test package. If reused users are ever used, cleanup should narrow to recorded test ids.

## Execution Method Recommendation

Recommended path:

1. Use SQL Editor or Supabase CLI only for service-role setup and cleanup.
2. Use a small local scripted harness for authenticated assertions.
3. The harness should accept JWTs from environment variables only:
   - `TEST_USER_A_JWT`;
   - `TEST_USER_B_JWT`;
   - staging URL/anon key from local secure env.
4. The harness should not write secrets to repo files, reports, logs, screenshots, or command history.
5. Run each assertion as the intended user through Supabase client/PostgREST with the `Authorization: Bearer <JWT>` header.
6. Capture only sanitized outcomes:
   - statement id;
   - pass/fail;
   - SQLSTATE/error category;
   - affected row count;
   - returned row count.

Alternative path:

- A SQL-only harness can be used only if it explicitly sets the equivalent authenticated role/JWT claims in a way that accurately exercises `auth.uid()` and RLS. This should be reviewed separately before use.

Not recommended:

- Running user assertions directly in Supabase SQL Editor as an elevated role, because that would not faithfully test regular authenticated-user RLS behavior.

## Blockers / Recommended Fixes

No blocker before owner-approved execution planning.

Recommended before actual execution:

- Add exact harness choice and secret-handling steps to the execution task.
- Confirm the two auth test users are dedicated and have no existing Premium selections.
- If users are not dedicated, update cleanup to delete only recorded test ids.
- Decide whether to treat `affect 0 rows` and explicit RLS errors as equivalent pass cases for each negative assertion.

## Readiness For Owner-Approved Execution

**READY_FOR_OWNER_APPROVED_RLS_TEST_EXECUTION**

The draft can move to a separate execution task after owner approval, with the recommended scripted authenticated assertion harness.

Execution must remain staging-only and must not touch production.

## Verification

- `git diff --check`
  - Result: pending after report creation.
- Static review only.
- No Supabase SQL execution.
- No staging mutation.
- No production query.

## Final Verdict

**TODAY_PREMIUM_DATA_MODEL_STAGING_RLS_TEST_EXECUTION_REVIEW_READY**
