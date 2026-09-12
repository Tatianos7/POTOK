# Workout Diary Soft Delete SQL Draft Review

- Date: 2026-09-12
- Branch: `master`
- HEAD: `7d36084 plan workout diary soft delete retention`
- Reviewed SQL draft: `supabase/sql_drafts/workout-diary-soft-delete-draft-2026-09-12.sql`
- Reviewed report: `reports/workout-diary-soft-delete-sql-draft-2026-09-12.md`
- Target package: `WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_REVIEW`
- Verdict: **WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_REVIEW_READY**

## Scope

Review the Workout Diary soft-delete SQL draft before commit and any later owner-approved staging apply.

This is review-only. Runtime code was not changed, UI was not changed, SQL was not executed, Supabase was not mutated, staging was not mutated, production was not touched, Premium write paths were not touched, DB schema/RLS were not actually changed, API keys/secrets were not used, no PR was created, and no commit was created.

## Executive Summary

No blocker was found for committing the SQL draft and review report.

The draft matches the owner decision:

- Workout Diary user-facing delete will later become soft-delete through `deleted_at`;
- active diary, default history, Progress, MuscleMap inputs, and Repeat should use only `deleted_at is null`;
- `workout_days` is not changed for the MVP;
- restore UI is not included;
- retention cleanup is documented for later only;
- cleanup job is not created;
- no active RLS policy changes are included.

Staging apply readiness:

- ready for owner review as a draft;
- apply only after explicit approval;
- before apply, confirm `public.workout_entries` exists in the target environment and current RLS still allows owner UPDATE through the `workout_days.user_id = auth.uid()` policy.

## Blockers

No blockers.

## Non-Blockers

### 1. Pre-apply table-existence check should be explicit

The column block checks whether `public.workout_entries` exists before `alter table`.

The index statements are normal top-level `create index if not exists ... on public.workout_entries ...` statements. This is acceptable for a targeted draft where the workout schema is expected to exist, and it matches existing project style in `supabase/perf_indexes_1_5_1.sql`.

Severity: non-blocker.

Recommendation:

- before staging apply, run a pre-check that `public.workout_entries` exists;
- if the draft is later intended for partially bootstrapped environments, wrap index creation in the same table-existence guard.

### 2. Production apply may prefer concurrent index strategy later

The draft uses ordinary `create index if not exists` inside a transaction. This is fine for a draft and likely fine for staging/small tables.

Severity: non-blocker.

Recommendation:

- before production apply, decide whether regular index creation is acceptable or whether a production-specific script should use `create index concurrently`;
- if using `concurrently`, it must not run inside a transaction block.

## Columns Assessment

Draft columns:

- `workout_entries.deleted_at timestamptz null`;
- `workout_entries.deleted_by_user_id uuid null`.

Assessment:

- uses `alter table public.workout_entries add column if not exists`;
- fields are nullable and additive;
- no backfill is included;
- no destructive schema change is included;
- `deleted_at` semantics are documented with a column comment;
- `deleted_by_user_id` semantics are documented with a column comment;
- no `archived_at` or status enum is added, which matches the selected MVP model.

`deleted_by_user_id` FK assessment:

- no FK is added in the draft;
- this is acceptable for MVP because production/staging auth FK pattern and spoofing protection should be reviewed before enforcing the lifecycle field;
- runtime must set `deleted_by_user_id` from the authenticated session user, not from arbitrary client payload.

## Indexes Assessment

Draft indexes:

- `workout_entries_active_day_created_at_idx`
  - `(workout_day_id, created_at)`
  - `where deleted_at is null`
- `workout_entries_active_day_exercise_idx`
  - `(workout_day_id, exercise_id)`
  - `where deleted_at is null`
- `workout_entries_deleted_cleanup_idx`
  - `(deleted_at, id)`
  - `where deleted_at is not null`

Assessment:

- indexes are partial and scoped to the soft-delete semantics;
- active day index supports current selected-day reads and repeat source reads after runtime adds `deleted_at is null`;
- active day/exercise index supports history/progress aggregation patterns that fetch day IDs first and then read entries;
- cleanup index supports later retention scans by `deleted_at`;
- no unsafe or destructive index is included;
- no full-table cleanup index without a predicate is added.

Known query support:

- `getWorkoutEntries` / `getWorkoutEntriesPersisted`: covered by `workout_day_id` plus active predicate;
- `getWorkoutHistoryDays`: covered for active entry aggregation by day IDs;
- `getWorkoutProgressObservations`: covered for active rows by day IDs;
- `copyWorkoutEntriesToDate`: covered because repeat should read through active source entries;
- Workout Diary MuscleMap: covered indirectly because it uses active page entries.

## RLS Assessment

Current tracked `supabase/workout_schema.sql` includes:

- `workout_days` RLS enabled;
- `workout_entries` RLS enabled;
- `Users can manage their workout entries` policy on `workout_entries FOR ALL`;
- policy ownership check through `workout_days.user_id = auth.uid()`.

Assessment:

- if target Supabase matches the tracked broad owner policy, owner update of `deleted_at` should be permitted;
- the draft does not add active RLS policy changes;
- stricter policy support is present only as a commented proposal;
- this is appropriate because actual production/staging RLS should be verified before adding new active policies.

Spoofing assessment:

- `deleted_by_user_id` can be spoofed if runtime lets clients supply arbitrary values;
- the draft correctly documents that runtime must set it from the authenticated user;
- a later DB trigger/RPC can be considered if owner wants DB-enforced assignment.

## Retention Assessment

The SQL draft and report correctly carry the retention addendum:

- retention period is 12 months after `deleted_at`;
- future cleanup eligibility is `deleted_at is not null` and `deleted_at < now() - interval '12 months'`;
- active rows where `deleted_at is null` are never eligible;
- cleanup is later only;
- cleanup job is not created;
- future cleanup must be batched and must review notes/media/FK dependencies first.

The cleanup index is appropriate for the future retention path:

- `workout_entries_deleted_cleanup_idx on (deleted_at, id) where deleted_at is not null`.

## Apply Readiness

Ready for commit as a draft.

Ready for staging apply only after:

- explicit owner approval;
- pre-check confirms `public.workout_entries` exists;
- target RLS is checked for owner UPDATE on `workout_entries`;
- owner accepts nullable `deleted_by_user_id` without FK for MVP;
- apply operator understands no runtime reads will use the fields until runtime package lands.

Not production-ready as-is without a separate production apply package:

- production may need concurrent index strategy;
- production needs backup/rollback and row-count pre/post validation;
- runtime package must land before user-facing delete semantics change.

## Final Recommendation

Commit the SQL draft and this review report as the SQL draft package.

Recommended next implementation package after commit/review:

- `WORKOUT_DIARY_SOFT_DELETE_RUNTIME_IMPLEMENTATION_READY`

Runtime package should:

- update reads to filter `deleted_at is null`;
- replace physical delete with soft-delete updates;
- make day-level delete update active entries, not delete `workout_days`;
- update local fallback behavior;
- update tests for diary, history, Progress, MuscleMap inputs, and Repeat.

## Verification

- `git diff --check`
  - Result: passed.

## Safety Confirmation

Confirmed for this package:

- review-only;
- no SQL execution;
- no Supabase mutation;
- no staging mutation;
- no production mutation;
- no runtime code changes;
- no UI changes;
- no actual DB schema changes;
- no actual RLS changes;
- no Premium writes;
- no API keys;
- no secrets;
- no PR;
- no commit.

## Final Verdict

**WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_REVIEW_READY**
