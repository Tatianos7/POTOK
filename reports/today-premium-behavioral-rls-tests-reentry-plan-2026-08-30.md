# Today Premium Behavioral RLS Tests Reentry Plan

- Date: 2026-08-30
- Branch: `master`
- Source status commit: `d69e982 today premium mounted async test layer final status`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Target package: `TODAY_PREMIUM_BEHAVIORAL_RLS_TESTS_REENTRY`
- Verdict: **TODAY_PREMIUM_BEHAVIORAL_RLS_TESTS_REENTRY_PLAN_READY**

## Scope

Prepare a reentry plan for Today Premium behavioral RLS tests on staging.

This is a plan/report only. No RLS tests were run, no staging users were created, no JWT/secrets were requested or collected, no SQL was executed, staging was not mutated, production was not touched, runtime/config/dependency files were not changed, and no PR was created.

## Source Materials Reviewed

- `reports/today-premium-read-only-runtime-final-status-2026-08-29.md`
- `reports/today-premium-read-only-mounted-async-test-layer-final-status-2026-08-30.md`
- `reports/today-premium-data-model-staging-rls-test-plan-2026-08-26.md`
- `reports/today-premium-data-model-staging-rls-test-execution-draft-2026-08-26.md`
- `reports/today-premium-data-model-staging-rls-test-execution-review-2026-08-26.md`
- `reports/today-premium-data-model-staging-rls-test-execution-2026-08-26.md`
- `reports/today-premium-staging-rls-secure-env-guide-2026-08-26.md`
- `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`
- `supabase/seed_drafts/today-premium-minimal-staging-seed-draft-2026-08-26.sql`

## Goal Of RLS Verification

The goal is to verify actual staging RLS behavior for the Today Premium data model with real actor contexts:

- anonymous client;
- authenticated staging test user A;
- authenticated staging test user B;
- optional elevated read-only verification, only as a separate owner-approved step.

The checks should prove that catalog reads are exposed only as intended, user-owned Premium selection rows are isolated per user, regular authenticated users cannot mutate catalog tables, and the current read-only runtime cannot accidentally open diary, workout, recipe import, or shopping persistence paths.

## Current Status

Ready:

- Premium catalog service exists and is read-only in runtime.
- `/premium-recipes` and `/today` Premium surfaces are behind `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`.
- Default mode remains mock/demo.
- Mounted async/read-only testing layer covers fixtures, source wiring, fallback contracts, adapter mappings, and no-write guardrails.
- No user Premium selection writes are enabled in runtime.
- Shopping remains derived/in-memory; no shopping source-of-truth runtime is enabled.

Pending:

- behavioral RLS tests with real staging actor contexts;
- authenticated staging browser visual smoke;
- production catalog/content readiness;
- production rollout approval.

Previous blocker:

- `STAGING_RLS_TEST_EXTERNAL_BLOCKER` because dedicated staging test users/JWTs and staging client env were unavailable.

## Why RLS Tests Are Required Before Writes / Production

Behavioral RLS tests are required before enabling any user Premium writes or production rollout because static SQL review and source guardrails cannot prove runtime actor isolation.

They must confirm:

- anonymous users cannot access user-owned Premium rows;
- user A cannot read or change user B selections;
- user B cannot read or change user A selections;
- regular authenticated users cannot mutate Premium catalog tables;
- future user selection writes, if later approved, are constrained to valid own user/goal/plan/meal/recipe relationships;
- diary, workout, `public.recipes`, recipe import, and shopping persistence paths remain outside the Premium read-only rollout.

Until these checks pass, Premium write paths and production rollout must remain blocked.

## Prerequisites

Required before any execution package:

- staging-only target confirmed as `ozidryfvhkcbtpnulakq`;
- production ref `dtsdnhbcwpbfrhcazqkb` excluded from CLI, local env, browser env, and scripts;
- dedicated staging-only test user A exists;
- dedicated staging-only test user B exists;
- test users are not real customer accounts;
- test users have known pre-test Premium selection state;
- staging anon key and URL are available through local secure env only;
- user A and user B authenticated sessions/JWTs are available through local secure env only;
- no secrets are printed, committed, or copied into reports;
- RLS execution harness is reviewed before use;
- any setup/cleanup/elevated verification is separately owner-approved.

Do not create staging users, request OTPs, request JWTs, collect secrets, or run SQL in this reentry-plan package.

## Secure Env Rules

Staging only:

```text
SUPABASE_URL=<staging Supabase URL for ozidryfvhkcbtpnulakq>
SUPABASE_ANON_KEY=<staging anon key>
TEST_USER_A_UUID=<staging test user A UUID>
TEST_USER_B_UUID=<staging test user B UUID>
TEST_USER_A_JWT=<staging test user A JWT>
TEST_USER_B_JWT=<staging test user B JWT>
```

Rules:

- do not use production project `dtsdnhbcwpbfrhcazqkb`;
- do not place service-role keys in frontend/browser env;
- do not commit JWT/password/session values;
- do not print secrets in reports, logs, screenshots, traces, terminal transcripts, or chat;
- do not store real env values in repo files;
- verify any local secret file is git-ignored before use;
- prefer current-shell env or secure local secret manager;
- clear shell/session state after execution.

Frontend/browser env, if used later for visual smoke, may include only:

```text
VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly
VITE_SUPABASE_URL=<staging Supabase URL for ozidryfvhkcbtpnulakq>
VITE_SUPABASE_ANON_KEY=<staging anon key>
```

No service-role key belongs in frontend/browser env.

## Test Users / Session Requirements

Use two dedicated staging-only users:

- `TEST_USER_A`;
- `TEST_USER_B`.

Requirements:

- both users exist only in staging;
- neither user is a real customer account;
- UUIDs are known locally without printing JWTs;
- JWT/session values remain local and secret;
- users have either no pre-existing Premium selections or their pre-existing rows are counted and excluded from test cleanup;
- any auth user creation/deletion is separate owner-approved work;
- any password/OTP/session acquisition is separate owner-approved work.

The RLS assertions must run with actual user contexts so `auth.uid()` resolves to user A or user B. Running user assertions from SQL Editor as an elevated role is not sufficient.

## Tables In Scope

Catalog/read tables:

- `premium_plans`;
- `premium_plan_days`;
- `premium_meal_slots`;
- `premium_recipes`;
- `premium_recipe_ingredients`;
- `premium_recipe_steps`;
- `premium_recipe_hints`;
- `premium_meal_recipe_options`.

User tables:

- `user_premium_plan_selections`;
- `user_premium_meal_selections`.

Control/no-write related:

- `food_diary_entries`;
- `public.recipes`;
- `recipe_ingredients`.

Absent/not-enabled shopping persistence:

- `premium_shopping_items`;
- `user_premium_shopping_checks`.

Out of scope:

- workouts;
- payment/entitlement mutation;
- AI/runtime rows;
- voice input;
- production data.

## Expected Behavior Matrix

| Actor | Catalog Reads | User Premium Selection Reads | User Premium Selection Writes | Catalog Writes | Diary / Recipe Writes | Shopping Persistence |
| --- | --- | --- | --- | --- | --- | --- |
| Anon | Follow current policy for active catalog visibility; record whether rows are visible or hidden | Must not read user-owned rows | Must fail | Must fail | Not part of Premium read-only flow; must not be exercised | Not enabled |
| Auth user A | Can read allowed active catalog rows if policy permits | Can read only own rows if any exist | Must remain disabled for current runtime; negative RLS attempts only if approved | Must fail | Must not be created through Premium flow | Not enabled |
| Auth user B | Same as user A | Cannot read user A rows; can read only own rows if any exist | Must remain disabled for current runtime; negative RLS attempts only if approved | Must fail | Must not be created through Premium flow | Not enabled |
| Elevated verifier | Separate owner-approved read-only verification only | May compare sanitized before/after counts if approved | No mutation except separately approved setup/cleanup | No mutation except separately approved setup/cleanup | Read-only counts only unless separately approved | Read-only existence/count status only |

Pass criteria:

- catalog visibility matches the active staging RLS policy and is recorded per actor;
- user-owned Premium rows are isolated;
- regular authenticated users cannot mutate catalog tables;
- no unauthorized user selection write succeeds;
- no diary, workout, public recipe, recipe import, or shopping persistence row is created by the Premium flow;
- production is never queried.

## Read-Only Checks

Read-only checks can run first because they should not mutate staging:

- confirm staging ref/environment points to `ozidryfvhkcbtpnulakq` without printing secrets;
- confirm production ref `dtsdnhbcwpbfrhcazqkb` is absent from env and runner config;
- anon read behavior for active catalog tables;
- anon denial/empty result for user-owned selection tables;
- authenticated user A catalog read behavior;
- authenticated user B catalog read behavior;
- user A cannot read user B selection rows;
- user B cannot read user A selection rows;
- read status for `premium_shopping_items` and `user_premium_shopping_checks`, if tables exist, without using them as runtime source-of-truth.

Record only:

- table name;
- actor;
- result category;
- row count/status;
- sanitized error category.

Do not record row payloads that contain user data or secrets.

## Write-Denial Checks

Write-denial checks are useful but must be explicitly approved before execution because they intentionally attempt negative writes.

If approved, regular authenticated user contexts should verify:

- insert/update/delete on `premium_plans` fails;
- insert/update/delete on `premium_recipes` fails;
- insert/update/delete on `premium_meal_recipe_options` fails;
- user A cannot create a selection for user B;
- user B cannot create or update user A Premium selections;
- inactive plan selection is blocked if user selection writes are being tested in an approved RLS package;
- meal slot outside selected plan is blocked if user selection writes are being tested in an approved RLS package;
- recipe outside allowed options is blocked if user selection writes are being tested in an approved RLS package;
- inactive recipe selection is blocked if user selection writes are being tested in an approved RLS package.

Expected result:

- RLS/check/permission error; or
- affected row count `0` where the client/API reports denial as no-op.

Do not run cleanup mutations unless setup/negative tests are separately approved and scoped to isolated test ids.

## Cross-User Isolation Checks

Required cross-user assertions:

- user A cannot read user B `user_premium_plan_selections`;
- user A cannot read user B `user_premium_meal_selections`;
- user B cannot read user A `user_premium_plan_selections`;
- user B cannot read user A `user_premium_meal_selections`;
- user A cannot update/delete user B Premium selections;
- user B cannot update/delete user A Premium selections;
- cross-user `user_goal_id` binding is blocked if write tests are approved.

For read-only reentry, if no selection rows exist, record that a separate approved setup package is needed to seed isolated user-owned rows before isolation can be fully proven.

## Anon / Authenticated Behavior

Anon:

- catalog visibility should be recorded according to current staging RLS policy;
- if active catalog rows are hidden from anon, the runtime fallback expectation remains mock/demo for unauthenticated access;
- user selection tables must not expose user-owned rows;
- Premium read-only flow must not create diary/public recipe rows.

Authenticated user A:

- can read allowed active catalog rows if RLS permits;
- cannot read user B selections;
- cannot mutate catalog tables;
- cannot create diary/public recipe rows through Premium read-only flow;
- cannot write Premium selections unless a separate approved policy/test package explicitly enables and verifies that behavior.

Authenticated user B:

- same as user A;
- cannot read user A selections;
- cannot mutate catalog tables;
- cannot create diary/public recipe rows through Premium read-only flow.

## Elevated Verification Boundary

Elevated verification may be needed to compare before/after counts or prepare isolated test rows. It is not part of this plan package.

If elevated verification is required:

- treat it as a separate owner-approved step;
- do not include service-role keys in frontend/browser env;
- do not print service-role values;
- keep setup, assertions, and cleanup separated;
- use elevated context only for setup/cleanup/read-only count verification;
- run authenticated-user assertions with user JWTs, not elevated role;
- record only sanitized counts/status/errors;
- never touch production.

## What Not To Do

Do not:

- run SQL in this package;
- create staging users in this package;
- request OTPs, passwords, JWTs, or secrets in this package;
- mutate staging;
- query or mutate production;
- change runtime code;
- change config/dependency files;
- change RLS policies;
- add service-role keys to frontend/browser env;
- enable user Premium selection writes;
- write diary/workout rows;
- write `public.recipes`;
- import recipes;
- create shopping persistence;
- add/use `premium_shopping_items`;
- add/use `user_premium_shopping_checks`;
- add AI runtime;
- add voice input;
- create a PR.

## Execution Phases

Phase 0: environment preflight only

- confirm branch/context;
- confirm staging ref `ozidryfvhkcbtpnulakq`;
- confirm production ref `dtsdnhbcwpbfrhcazqkb` is excluded;
- confirm required local env variables exist without printing values;
- confirm no service-role key is present in frontend/browser env;
- stop if any secure env prerequisite is missing.

Phase 1: anon read behavior

- read active catalog visibility according to current RLS policy;
- verify user Premium selection tables are not readable/writable by anon;
- record sanitized counts/status/errors only.

Phase 2: authenticated user A read behavior

- verify user A can read allowed active catalog rows if policy allows;
- verify user A sees only own Premium selection rows, if any;
- verify user A cannot read user B rows;
- record fallback implication if catalog rows are hidden.

Phase 3: authenticated user B isolation

- repeat catalog read visibility for user B;
- verify user B cannot read user A rows;
- compare user A/user B row visibility;
- record sanitized outcomes.

Phase 4: write-denial checks, only if approved

- attempt safe negative writes with authenticated user contexts;
- verify catalog mutation denial;
- verify cross-user selection denial;
- verify invalid plan/meal/recipe selection denial if owner-approved seed exists;
- do not run cleanup mutations unless separately approved.

Phase 5: before/after counts and sanitized report

- compare counts where RLS permits read-only verification;
- if elevated counts are needed, run only in separate owner-approved context;
- expected delta is `0` for no-write control tables;
- create sanitized execution report with no secrets.

## Risks

- Dedicated staging test users/JWTs may still be unavailable.
- Staging RLS may hide catalog rows from anon or from selected test users, causing runtime fallback instead of catalog-backed UI.
- Without isolated user-owned selection rows, cross-user isolation can only be partially proven.
- Negative write-denial tests intentionally attempt writes and therefore require explicit owner approval and safe cleanup boundaries.
- Elevated setup/verification can mask RLS if user assertions are not run with real authenticated JWTs.
- Cleanup can be dangerous if users are not dedicated or test ids are not recorded.
- Production exclusion must be reconfirmed in every execution package.

## Next Recommended Execution Package

Recommended next package: **TODAY_PREMIUM_BEHAVIORAL_RLS_TESTS_SECURE_PREFLIGHT**.

Scope:

- confirm staging-only env readiness without printing values;
- confirm two dedicated test users/sessions exist;
- confirm production is excluded;
- choose the exact harness for anon/authenticated read-only checks;
- do not run SQL;
- do not mutate staging;
- do not collect secrets into repo/reports/logs.

After secure preflight passes, a separate owner-approved execution package can run:

- anon/authenticated read-only checks;
- cross-user isolation checks;
- optional write-denial checks;
- optional elevated count verification.

## Verification

- `git diff --check`
  - Result: passed.
- No runtime code changes.
- No config/dependency changes.
- No Supabase SQL execution.
- No staging mutation.
- No production query.
- No real Supabase calls in this plan package.
- No user/JWT/secrets collection.
- No service-role keys.
- No RLS policy changes.

## Final Verdict

**TODAY_PREMIUM_BEHAVIORAL_RLS_TESTS_REENTRY_PLAN_READY**
