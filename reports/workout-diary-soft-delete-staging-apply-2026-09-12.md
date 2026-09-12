# Workout Diary Soft Delete Staging Apply

- Date: 2026-09-12
- Branch: `master`
- HEAD: `8fbce15 draft workout diary soft delete schema`
- Staging project ref: `ozidryfvhkcbtpnulakq`
- Production project ref: `dtsdnhbcwpbfrhcazqkb`
- SQL draft: `supabase/sql_drafts/workout-diary-soft-delete-draft-2026-09-12.sql`
- Target package: `WORKOUT_DIARY_SOFT_DELETE_STAGING_APPLY`
- Verdict: **WORKOUT_DIARY_SOFT_DELETE_STAGING_APPLY_REQUIRES_FIXES**

## Scope

Attempt staging-only pre-check and, only if safe, apply the committed Workout Diary soft-delete SQL draft to Supabase staging.

This package did not apply SQL because the required staging base tables were not present. Runtime code was not changed, UI was not changed, Supabase SQL draft was not applied, production was not touched, Premium write paths were not touched, DB schema/RLS were not changed, API keys/secrets were not requested in chat, no PR was created, and no commit was created.

## Executive Summary

Staging target was confirmed locally as:

- project ref: `ozidryfvhkcbtpnulakq`;
- project name: `POTOK Staging`;
- source: `supabase/.temp/project-ref` and `supabase/.temp/linked-project.json`.

Pre-check blocker:

- `public.workout_entries` was not found on linked staging;
- `public.workout_days` was not found on linked staging.

Because the draft is intentionally additive to existing Workout Diary tables, applying it when the base tables are absent is not safe. The draft includes a guarded column block, but its index statements target `public.workout_entries` directly and expect the base table to exist.

Result:

- staging apply was not attempted;
- SQL was not executed beyond read-only pre-check queries;
- no schema/index changes were made;
- no data rows were updated, backfilled, cleaned, or deleted;
- production was untouched.

## SQL File

Reviewed but not applied:

- `supabase/sql_drafts/workout-diary-soft-delete-draft-2026-09-12.sql`

Reason not applied:

- required base tables `public.workout_entries` and `public.workout_days` are missing in the linked staging database.

## Pre-Check Results

### Target Project

Local linked project:

- expected staging ref: `ozidryfvhkcbtpnulakq`;
- actual linked ref: `ozidryfvhkcbtpnulakq`;
- linked name: `POTOK Staging`.

Production ref:

- `dtsdnhbcwpbfrhcazqkb`;
- not used.

### Tables

Read-only query:

```sql
select to_regclass('public.workout_entries')::text as workout_entries_regclass,
       to_regclass('public.workout_days')::text as workout_days_regclass;
```

Result:

- `workout_entries_regclass = null`;
- `workout_days_regclass = null`.

Assessment:

- blocker for this apply package;
- the soft-delete SQL draft depends on existing Workout Diary base tables;
- do not apply this draft until staging has the Workout Diary schema.

### Columns

Column verification could not proceed because `public.workout_entries` does not exist on linked staging.

Expected after a future successful apply:

- `public.workout_entries.deleted_at timestamptz null`;
- `public.workout_entries.deleted_by_user_id uuid null`.

### Indexes

Index pre-check for target soft-delete index names returned no rows.

Assessment:

- absence is expected if `public.workout_entries` is missing;
- index creation cannot be safely attempted until the base table exists.

Expected after a future successful apply:

- `workout_entries_active_day_created_at_idx`;
- `workout_entries_active_day_exercise_idx`;
- `workout_entries_deleted_cleanup_idx`.

### RLS / Policies

RLS and policy verification could not be meaningfully completed because `public.workout_entries` and `public.workout_days` are absent.

Limitation:

- no runtime authenticated user smoke was run;
- no RLS mutation was performed;
- owner UPDATE behavior through `workout_days.user_id = auth.uid()` remains to be verified after staging Workout Diary tables exist.

## Apply Result

Apply status:

- not applied.

Reason:

- pre-check failed because required base tables were absent.

No additional SQL changes were executed outside read-only pre-check queries.

## Data Mutation Confirmation

Confirmed:

- no workout rows were updated;
- no `deleted_at` values were set;
- no backfill was performed;
- no cleanup was performed;
- no hard delete was performed;
- no scheduled job was created.

## Production Untouched Confirmation

Confirmed:

- production project ref `dtsdnhbcwpbfrhcazqkb` was not targeted;
- no production SQL was executed;
- no production schema/data was mutated.

## Runtime / UI Confirmation

Confirmed:

- runtime code was not changed;
- UI was not changed;
- Premium write paths were not changed;
- no automatic diary writes from Premium planned workouts were added.

## Risks / Non-Blockers

Blocker:

- staging is missing `public.workout_entries` and `public.workout_days`, so the soft-delete draft cannot be applied safely.

Non-blockers:

- Supabase CLI initially failed in sandbox because it tried to write telemetry under the user home directory; running the CLI with approved escalation resolved CLI access.
- Multi-statement `supabase db query --linked` returned only one visible result set, so pre-checks were rerun as separate queries.
- Parallel linked queries were slow/hung, so they were stopped and rerun sequentially.

## Recommended Next Package

Recommended next small package:

- `WORKOUT_DIARY_STAGING_SCHEMA_BASELINE_AUDIT_READY`

Scope:

- read-only staging audit for Workout Diary base tables;
- confirm whether staging intentionally lacks Workout Diary schema;
- compare staging against required workout schema files and migrations;
- recommend one owner-approved staging schema sync/apply package.

After staging base schema exists:

- rerun `WORKOUT_DIARY_SOFT_DELETE_STAGING_APPLY`;
- verify columns, indexes, and RLS on staging;
- then proceed to `WORKOUT_DIARY_SOFT_DELETE_RUNTIME_IMPLEMENTATION_READY`.

## Verification

- `git diff --check`
  - Result: passed.

## Safety Confirmation

Confirmed for this package:

- staging-only target was checked;
- SQL draft was not applied because pre-check failed;
- no production mutation;
- no runtime code changes;
- no UI changes;
- no Premium writes;
- no payment enforcement;
- no API keys/secrets requested in chat;
- no data backfill;
- no workout row mutation;
- no cleanup job;
- no hard delete;
- no PR;
- no commit.

## Final Verdict

**WORKOUT_DIARY_SOFT_DELETE_STAGING_APPLY_REQUIRES_FIXES**
