# Staging Baseline Reconciliation Draft Review

- Date: 2026-08-25
- Branch: `master`
- Reviewed files:
  - `reports/staging-baseline-schema-sync-plan-2026-08-25.md`
  - `supabase/migration_drafts/staging-baseline-reconciliation-draft-2026-08-25.sql`
  - `reports/staging-baseline-reconciliation-draft-2026-08-25.md`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Verdict: **REQUIRES_FIXES**

## Review Verdict

The draft is correctly scoped as a staging baseline reconciliation draft and should unblock the immediate Premium FK requirement by creating `public.user_goals(user_id)`.

Before staging apply, one RLS/data-integrity blocker should be fixed: `favorite_recipes` and `recipe_collections` currently allow a user-owned relation row to reference another user's recipe if the recipe UUID is known.

## Scope Review

Confirmed:

- draft is staging-only by comments and intent;
- no active Premium table creation is present;
- Premium SQL is not applied;
- production ref appears only in exclusion notes;
- no active `drop table`, `delete from`, or `truncate` statements are present;
- existing staging tables are not actively altered:
  - `foods`;
  - `food_aliases`;
  - `food_diary_entries`;
  - `favorite_products`;
  - `recipes`;
  - `recipe_ingredients`;
  - `user_profiles`.

The draft creates only missing baseline-style tables and leaves larger workout/program/AI-heavy baseline as an explicit unresolved follow-up.

## FK Review

OK:

- `user_goals.user_id` is `primary key references auth.users(id) on delete cascade`.
- `habit_logs.habit_id` references `public.habits(id) on delete cascade`.
- `habit_logs.user_id` references `auth.users(id) on delete cascade`.
- `favorite_recipes.recipe_id` references existing `public.recipes(id) on delete cascade`.
- `recipe_collections.recipe_id` references existing `public.recipes(id) on delete cascade`.
- Measurements and progress/read-model tables reference `auth.users(id)`.
- No FK references Premium, workout, or AI tables.

Compatibility:

- The `user_goals(user_id)` PK matches `supabase/schema.sql` and is enough to unblock the Premium draft FK.
- Including the phase 9 goal metadata columns in the initial `user_goals` create is compatible with the current goal service direction.

## RLS Review

OK:

- `user_goals` select/insert/update are own-row only.
- `habits` select/insert/update/delete are own-row only.
- `habit_logs` insert/update/delete check both row owner and parent habit ownership.
- `analytics_events` allows own select and own insert only; no update/delete policy is created.
- Measurements tables are own-row only.
- `user_state`, `goal_trajectory`, and `progress_trends` use own-row policies.

Blocker:

- `favorite_recipes_modify_own` checks only `auth.uid() = user_id`.
- `recipe_collections_modify_own` checks only `auth.uid() = user_id`.
- Because `public.recipes` is user-owned via `recipes.user_id`, these relation tables should also require:
  - `exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())`.

Why it matters:

- Without the parent recipe ownership predicate, a user can create a favorite/collection relation to another user's recipe if the UUID is known.
- The later read through `public.recipes` RLS may hide the recipe row, but the relation row still leaks/corrupts user-owned relation state and should be blocked before staging apply.

Recommended fix:

- Split relation policies into explicit select/insert/update/delete policies, or harden the current `for all` policy with parent recipe ownership in both `using` and `with check`.
- Prefer explicit policies:
  - select own relation rows;
  - insert/update only when `auth.uid() = user_id` and the referenced recipe belongs to `auth.uid()`;
  - delete only own relation rows, optionally also checking the parent recipe when it exists.

Non-blocking RLS note:

- `user_state`, `goal_trajectory`, and `progress_trends` regular-user modify policies match current local service paths where the client upserts these read models.
- For production hardening, owner should decide whether these should become service-only writes later.

## Idempotency Review

Included and generally OK:

- `begin;` / `commit;`;
- `create extension if not exists pgcrypto`;
- `create table if not exists`;
- `create index if not exists`;
- `drop policy if exists` + `create policy`;
- no destructive data statements.

Review note:

- `create table if not exists` will not repair existing drift if one of these tables exists with a different shape. That is acceptable for current staging because the included tables were found missing, but it should remain in validation notes.

## Compatibility Review

`user_goals`:

- Compatible with `supabase/schema.sql`.
- Keeps `user_id` as PK.
- Includes phase 9 metadata columns from `supabase/phase9_goal_training_place.sql`.
- Enough to unblock Premium FK to `public.user_goals(user_id)`.

Measurements:

- Local repo has historical variants:
  - `measurements_schema.sql` has legacy text `id`/text `date`;
  - `user_measurements_schema.sql` and canonical migration trend toward UUID `id` and date/day support.
- Draft uses UUID `id` plus nullable `day` and `date` date columns.
- This is reasonable for staging reconciliation, but should be validated against current `measurementsService` behavior before broader staging smoke.

Recipe relations:

- Table shape matches local `supabase/recipes_relations_schema.sql`.
- RLS should be hardened beyond the local historical file before apply.

Workout/program/AI:

- Intentionally excluded due ordering and scope. This is acceptable for a phased baseline draft, but means staging will still not be a complete production mirror after this draft.

## Blockers / Recommended Fixes

Critical blocker before staging apply:

1. Harden `favorite_recipes` and `recipe_collections` RLS so relation rows cannot point to recipes owned by another user.

Required predicates for insert/update:

```sql
auth.uid() = user_id
and exists (
  select 1
  from public.recipes r
  where r.id = recipe_id
    and r.user_id = auth.uid()
)
```

Recommended but non-blocking:

- Add comments noting `user_state`/`progress_trends` client-write policy is staging-compatible but may need service-only production hardening.
- Add validation SQL for relation-table parent ownership policies.
- Consider a small static syntax review after RLS changes, especially around qualified outer references in nested predicates.

## Staging Apply Readiness

**REQUIRES_FIXES**

Do not apply this draft to staging until recipe relation RLS is hardened.

After that fix and a small second review, the draft should be a reasonable candidate for a separately approved staging baseline apply.

## Safety Review

Confirmed by static grep/review:

- no active Premium table creation;
- no `premium_shopping_items`;
- no `user_premium_shopping_checks`;
- no Premium SQL apply;
- no active `drop table`, `delete from`, or `truncate`;
- no active mutation of `public.recipes`, `public.recipe_ingredients`, or `public.food_diary_entries`;
- no AI runtime records;
- no production usage beyond exclusion notes.

## Next Recommended Step

Recommended next package: `STAGING_BASELINE_RECONCILIATION_RLS_HARDENING`.

Scope:

- update only the staging baseline reconciliation SQL draft;
- harden `favorite_recipes` and `recipe_collections` RLS parent recipe ownership checks;
- keep scope, object list, and no-Premium/no-production boundaries unchanged;
- run `git diff --check`;
- do not apply to staging until a separate explicit apply task.

## Verification

- `git diff --check`
  - Result: pending after report creation.
- Static safety grep
  - Result: no active Premium apply/table creation or destructive data statements found.
- No Supabase SQL execution.
- No staging schema mutation.
- No production query.

## Final Verdict

**REQUIRES_FIXES**
