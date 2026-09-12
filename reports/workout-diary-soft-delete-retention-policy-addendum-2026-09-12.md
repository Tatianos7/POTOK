# Workout Diary Soft Delete Retention Policy Addendum

- Date: 2026-09-12
- Branch: `master`
- HEAD: `a99b526 plan workout diary soft delete archive`
- Base plan: `reports/workout-diary-soft-delete-archive-plan-2026-09-12.md`
- Target package: `WORKOUT_DIARY_SOFT_DELETE_RETENTION_POLICY_ADDENDUM`
- Verdict: **WORKOUT_DIARY_SOFT_DELETE_RETENTION_POLICY_ADDENDUM_READY**

## Scope

Add a retention-policy addendum to the committed Workout Diary soft-delete/archive plan.

This addendum records the owner decision that soft-deleted workout entries should not accumulate forever. Hard cleanup is allowed only after a retention period, only for already soft-deleted rows, and only through safe batched maintenance.

This is plan/report-only. Runtime code was not changed, UI was not changed, SQL migration was not created, Supabase SQL was not executed, staging was not mutated, production was not touched, Premium write paths were not touched, DB schema/RLS were not changed, API keys/secrets were not used, no PR was created, and no commit was created.

## Executive Summary

The base soft-delete plan has been committed:

- `WORKOUT_DIARY_SOFT_DELETE_ARCHIVE_PLAN_COMMITTED`
- commit: `a99b526af390aa0def60c7131edb05bf1ab6a7b3`

Owner addendum:

- the archive/soft-delete layer should not grow forever;
- user delete remains soft-delete via `deleted_at`;
- active diary hides deleted entries;
- Workout Progress does not count deleted entries;
- MuscleMap does not use deleted entries;
- Repeat does not copy deleted entries;
- hard cleanup is permitted later, but only after retention eligibility is met.

Accepted retention decision:

- keep soft-deleted workout entries for 12 months after `deleted_at`;
- after 12 months, a maintenance cleanup may permanently delete eligible rows;
- cleanup must target only rows where `deleted_at is not null`;
- cleanup must never touch active rows where `deleted_at is null`;
- cleanup must run in bounded batches;
- cleanup is not part of the first soft-delete runtime MVP.

Recommended next package remains:

- `WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_READY`

The SQL draft must now include retention/index considerations.

## Retention Policy

Retention period:

- `12 months` after `workout_entries.deleted_at`.

Cleanup eligibility:

- `deleted_at is not null`;
- `deleted_at < now() - interval '12 months'`.

Never eligible:

- active rows where `deleted_at is null`;
- rows deleted less than 12 months ago;
- rows whose note/media/FK retention rules have not been reviewed for hard cleanup.

Important product rule:

- do not delete "the last half-year";
- do not delete rows by workout date alone;
- delete only old soft-deleted rows by `deleted_at`, for example `deleted_at < now() - interval '12 months'`.

Cleanup semantics:

- cleanup is a background or maintenance operation;
- cleanup is not the user-facing delete action;
- user-facing delete only marks a row as deleted;
- restore is possible only before hard cleanup.

## Batch Cleanup Requirement

Hard cleanup must be deliberately bounded.

Requirements:

- no full-table mass delete;
- no unbounded `delete from workout_entries where deleted_at is not null`;
- cleanup must run in batches;
- recommended batch size: 500 to 1000 rows per run;
- the job should be safe to stop and retry;
- the job should be idempotent;
- each run should log or report how many rows were eligible and how many were removed;
- indexes must support efficient lookup by `deleted_at`.

Recommended future schedule:

- monthly job for normal load; or
- weekly job if deleted-row volume becomes high.

Operational safety:

- run a dry-run count before enabling deletion;
- verify batch query plan before production scheduling;
- monitor duration, lock behavior, and row counts;
- avoid cleanup during peak user activity if table size becomes large.

## Data Safety

Active diary:

- active rows where `deleted_at is null` are never eligible for cleanup;
- active diary behavior is unaffected by cleanup.

Workout Progress:

- Progress should already exclude deleted entries before any hard cleanup exists;
- cleanup only removes rows that have already been invisible and inactive for at least the retention period.

MuscleMap:

- current/day MuscleMap should already use only active entries;
- cleanup should not change active MuscleMap behavior because eligible rows are already excluded.

Repeat:

- Repeat should already exclude deleted entries;
- cleanup should not change normal repeat behavior because eligible rows are already unavailable as repeat source rows.

Notes and media:

- entry notes, day notes, and user exercise media need explicit retention/FK rules before hard cleanup is enabled;
- hard-deleting workout entries can affect linked entry notes and media depending on FK behavior;
- cleanup must not be activated until note/media retention behavior is reviewed and documented;
- preserving `workout_days` remains recommended unless a later day-level cleanup decision is explicitly approved.

## SQL Draft Impact

The future SQL draft package should include retention-aware schema and indexes.

Required schema fields to consider:

- `workout_entries.deleted_at timestamptz null`;
- optional `workout_entries.deleted_by_user_id uuid null`.

Required index considerations:

- active read index for `deleted_at is null`;
- cleanup lookup index for rows where `deleted_at is not null`;
- efficient support for eligibility queries by `deleted_at`.

Example index requirements in prose only:

- active reads should remain fast for diary/history/progress queries;
- cleanup should be able to locate old deleted rows without a full table scan;
- index design should be reviewed against existing `workout_day_id`, date, and user filters.

No SQL is created in this addendum.

No Supabase SQL is executed in this addendum.

## Runtime Impact

Future runtime implementation must follow these rules:

- delete action only sets `deleted_at`;
- delete action does not immediately hard-delete;
- no cleanup runs in the user request path;
- no cleanup runs during normal diary save/edit/repeat actions;
- cleanup is a separate maintenance job or owner-approved operational process;
- restore UI, if added, can restore only rows that have not yet been hard-cleaned.

Runtime filters from the base plan still apply:

- active diary filters `deleted_at is null`;
- Workout History filters `deleted_at is null` by default;
- Workout Progress filters `deleted_at is null`;
- Workout Diary MuscleMap receives only active entries;
- Repeat source entries are active-only.

## Cleanup Later Phase

Add later phase:

### Phase 5A: Retention Cleanup Job

Later only, after soft-delete runtime is stable and note/media retention is reviewed.

Scope:

- design retention cleanup SQL/job;
- verify FK dependencies for entry notes, day notes, user exercise media, and any future linked tables;
- dry-run count eligible rows;
- delete only rows where `deleted_at is not null` and `deleted_at < now() - interval '12 months'`;
- delete in batches of 500 to 1000 rows;
- log cleanup counts;
- monitor performance and lock behavior;
- document rollback/backup expectations before production enablement.

Not in Phase 5A:

- no change to active diary behavior;
- no Progress or MuscleMap rebuild;
- no Premium workout write path.

## What Not To Do Now

Do not:

- implement cleanup now;
- create SQL migration now;
- apply SQL;
- create a scheduled job;
- hard-delete current deleted rows;
- touch active workout entries;
- change runtime delete behavior in this package;
- change UI copy or layout;
- change Workout Progress;
- change MuscleMap;
- change Repeat;
- mutate staging;
- touch production;
- change Premium write paths;
- change DB schema/RLS;
- create payment enforcement changes.

## Risks

Cleaning too early:

- can remove recoverable workout history before the user has had a reasonable restore window;
- can make future restore UI less useful if eligibility logic is wrong.

Missing FK rules:

- hard cleanup can break or detach entry notes, day notes, or user exercise media if FK behavior is not reviewed;
- note/media retention may require separate cleanup rules.

Unbounded cleanup:

- a full-table delete can overload the database;
- large deletes can lock rows for too long;
- retry behavior can become unsafe without idempotent batch design.

Missing indexes:

- cleanup eligibility scans can become slow without a `deleted_at` index;
- active reads can slow down if every query filters `deleted_at` without supporting indexes.

Policy/legal changes:

- legal or privacy requirements may later require shorter retention, explicit immediate deletion, export-before-delete behavior, or owner/admin tooling;
- this addendum records current product policy, not a legal/compliance final decision.

## Final Recommendation

Keep the recommended next package:

- `WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_READY`

Add to that package:

- retention fields and index review;
- cleanup eligibility definition;
- explicit note/media FK retention review;
- no cleanup job implementation;
- no SQL apply.

Hard cleanup should be planned only after:

- soft-delete runtime is implemented and verified;
- Progress, MuscleMap, History, and Repeat exclude deleted rows;
- restore behavior is either implemented or consciously deferred;
- note/media retention rules are approved.

## Safety Confirmation

Confirmed for this package:

- plan/report-only;
- no runtime code changes;
- no UI changes;
- no SQL migration created;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no Premium writes;
- no DB schema changes;
- no RLS policy changes;
- no payment enforcement;
- no API keys;
- no secrets;
- no PR;
- no commit.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**WORKOUT_DIARY_SOFT_DELETE_RETENTION_POLICY_ADDENDUM_READY**
