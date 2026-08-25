# Staging Baseline Schema Sync Plan

- Date: 2026-08-25
- Branch: `master`
- Staging project ref: `ozidryfvhkcbtpnulakq`
- Production project ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Basis:
  - `TODAY_PREMIUM_STAGING_SCHEMA_PREREQ_AUDIT_READY`
  - Premium staging apply failed with `ERROR: 42P01: relation "public.user_goals" does not exist`
- Verdict: **STAGING_BASELINE_SCHEMA_SYNC_PLAN_READY**

## Scope

Plan-only package for bringing staging schema prerequisites into alignment before retrying the POTOK Premium data model apply.

No runtime code changes, production changes, staging schema mutation, Premium SQL re-apply, baseline migration apply, payment/auth changes, diary/workout writes, recipe import, AI runtime, voice input, commit, push, or PR work was done.

## Root Cause

The Premium SQL draft is correct relative to the repo schema contract because it references `public.user_goals(user_id)`, and local `supabase/schema.sql` defines `user_goals.user_id` as the primary key.

The staging database is not aligned with that baseline. Staging currently lacks `public.user_goals`, so the Premium draft cannot create:

```sql
user_goal_id uuid references public.user_goals (user_id) on delete set null
```

The failure is a staging baseline prerequisite issue, not a Premium runtime issue and not evidence that `user_goals` was renamed.

## Current Staging Schema Summary

Read-only audit of staging ref `ozidryfvhkcbtpnulakq` found current `public` tables:

- `favorite_products`
- `food_aliases`
- `food_diary_entries`
- `foods`
- `recipe_ingredients`
- `recipes`
- `user_profiles`

Missing tables relevant to current Goal/Premium/Progress expectations:

- `user_goals`
- `goal_trajectory`
- `progress_trends`
- `measurement_history`
- `workout_entries`
- `workout_progress_observations`

Staging also correctly did not contain Premium draft tables after the failed transactional apply:

- `premium_plans`
- `premium_shopping_items`
- `user_premium_shopping_checks`

## Expected Repo Baseline Summary

Local baseline sources reviewed:

- `supabase/schema.sql`
- `supabase/foods_schema.sql`
- `supabase/recipes_relations_schema.sql`
- `supabase/profile_schema.sql`
- `supabase/user_profiles_schema.sql`
- `supabase/measurements_schema.sql`
- `supabase/user_measurements_schema.sql`
- `supabase/workout_schema.sql`
- `supabase/reports_schema.sql`
- `supabase/phase3_personalization.sql`
- `supabase/phase7_2_programs.sql`
- `supabase/phase9_goal_training_place.sql`
- `supabase/migrations/*.sql`

Core baseline from `supabase/schema.sql` includes:

- `user_goals`
- `food_diary_entries`
- `favorite_products`
- `recipes`
- `habits`
- `habit_logs`
- `analytics_events`

Nutrition/catalog baseline includes:

- `foods`
- `food_aliases`
- `recipe_ingredients`
- `favorite_recipes`
- `recipe_collections`

Profile/measurements/progress-related baseline includes:

- `user_profiles`
- `user_measurements`
- `measurement_history`
- `measurement_photo_history`
- `progress_trends`
- `report_snapshots`
- `report_aggregates`

Workout/program-related baseline files include:

- workout catalog and diary tables from `supabase/workout_schema.sql`;
- `nutrition_programs`;
- `training_programs`;
- `program_phases`;
- `program_blocks`;
- `program_days`;
- `program_versions`;
- `program_explainability`;
- `program_guard_events`;
- `program_generation_jobs`.

Important review note:

- The repo contains a mix of baseline SQL, phase SQL, migration drafts, production audit SQL, AI-era SQL, and hardening migrations.
- Do not blindly execute every SQL file under `supabase/`.
- Baseline sync should be a curated, ordered, idempotent staging plan.

## Options

### Option A: Apply Full Current Baseline Schema To Staging

Bring staging up to the current approved repo baseline before retrying Premium apply.

Pros:

- Restores staging as a meaningful test environment for current app expectations.
- Preserves the reviewed Premium FK to `user_goals(user_id)`.
- Avoids hiding wider schema drift behind a narrow fix.
- Gives Goal/Today/Progress/Workout services a consistent baseline for future smoke tests.

Risks:

- Existing staging tables already exist and may have drift from local definitions.
- Some repo SQL files are not safe as an unordered bulk apply.
- Older files may contain duplicate/legacy definitions or references to tables not yet present.
- Requires owner-approved migration ordering and validation.

Prerequisites:

- produce a curated baseline reconciliation script or ordered apply list;
- verify existing staging table columns before adding missing columns/constraints;
- take a staging backup/export if any non-empty tables exist;
- explicitly exclude production;
- decide whether AI/coach/program phase tables belong in the staging baseline now.

Validation checks:

- table existence and columns;
- PK/FK/unique constraints;
- RLS enabled and policies;
- critical existing table row counts unchanged unless explicitly approved;
- no Premium apply until baseline validation passes.

### Option B: Apply Only Missing Premium Prerequisite Tables

Create only the minimal missing prerequisite needed by Premium, starting with `public.user_goals`.

Pros:

- Smallest direct unblocker for the current Premium FK error.
- Preserves Premium FK integrity.
- Faster to review than full baseline sync.

Risks:

- Leaves staging partially inconsistent with current app schema.
- Premium apply may pass, while Goal/Progress/Workout validation remains unrealistic.
- `phase9_goal_training_place.sql` metadata fields need a decision too.
- Can create a staging-only patchwork that is hard to reason about later.

Why it may be dangerous:

- Current runtime services already treat `user_goals` and progress-related sources as expected data surfaces.
- Adding only one table fixes the symptom but not the staging baseline drift.

### Option C: Temporarily Remove Or Defer Premium FK To `user_goals`

Modify the Premium SQL draft so `user_goal_id` is nullable without a FK, then add the FK later.

Pros:

- Allows Premium catalog/user selection tables to be tested on the current minimal staging DB.
- Avoids prerequisite baseline work in the immediate Premium schema dry-run.

Risks:

- Weakens the reviewed plan-to-goal integrity model.
- Reopens RLS review for cross-user goal binding.
- Creates a follow-up migration obligation.
- Masks the fact that staging is missing current app baseline tables.

Why this is worse for the current goal:

- The Premium data model intentionally models `Plan != diary fact` and links selected plan state to the user's goal.
- Removing the FK makes staging easier but the schema less representative of the intended architecture.

## Recommended Path

Recommended path: **Option A**, with a curated baseline reconciliation plan rather than a blind bulk apply.

Reason:

- The blocking table `user_goals` is part of the repo's core baseline.
- Staging is missing more than one prerequisite; it is a minimal subset, not a current app-like schema.
- The Premium FK is correct and should not be weakened just to fit an incomplete staging database.

Fallback:

- If owner wants the narrowest unblocker, choose Option B as a documented staging-only prerequisite package.
- Avoid Option C unless owner explicitly accepts weaker temporary integrity.

## Validation SQL For Baseline Sync

Use only after owner approves a baseline sync apply. Run against staging `ozidryfvhkcbtpnulakq` only.

Confirm target and critical tables:

```sql
select current_database() as db, current_user as role;

select table_name, to_regclass('public.' || table_name)::text as regclass
from (
  values
    ('user_goals'),
    ('foods'),
    ('recipes'),
    ('recipe_ingredients'),
    ('food_diary_entries'),
    ('user_profiles'),
    ('favorite_products'),
    ('food_aliases'),
    ('habits'),
    ('habit_logs'),
    ('analytics_events'),
    ('user_measurements'),
    ('measurement_history'),
    ('measurement_photo_history'),
    ('progress_trends'),
    ('workout_entries')
) as t(table_name)
order by table_name;
```

Verify `user_goals` columns and primary key:

```sql
select
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_goals'
order by ordinal_position;

select
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
 and kcu.table_schema = tc.table_schema
 and kcu.table_name = tc.table_name
where tc.table_schema = 'public'
  and tc.table_name = 'user_goals'
  and tc.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
order by tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
```

Expected minimum:

- `user_goals.user_id` exists;
- `user_goals.user_id` is the primary key;
- `user_goals.user_id` references `auth.users(id)`;
- RLS is enabled;
- owner-only policies exist.

Verify RLS and policies:

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'user_goals',
    'food_diary_entries',
    'recipes',
    'recipe_ingredients',
    'user_profiles',
    'measurement_history',
    'progress_trends',
    'workout_entries'
  )
order by c.relname;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'user_goals',
    'food_diary_entries',
    'recipes',
    'recipe_ingredients',
    'user_profiles',
    'measurement_history',
    'progress_trends',
    'workout_entries'
  )
order by tablename, policyname;
```

Verify critical existing staging tables were not damaged:

```sql
select 'foods' as table_name, count(*)::bigint as row_count from public.foods
union all
select 'recipes', count(*)::bigint from public.recipes
union all
select 'recipe_ingredients', count(*)::bigint from public.recipe_ingredients
union all
select 'food_diary_entries', count(*)::bigint from public.food_diary_entries
union all
select 'user_profiles', count(*)::bigint from public.user_profiles
order by table_name;
```

Verify Premium was not accidentally applied during baseline sync:

```sql
select table_name, to_regclass('public.' || table_name)::text as regclass
from (
  values
    ('premium_plans'),
    ('premium_plan_days'),
    ('premium_meal_slots'),
    ('premium_recipes'),
    ('premium_recipe_ingredients'),
    ('premium_recipe_steps'),
    ('premium_recipe_hints'),
    ('premium_meal_recipe_options'),
    ('user_premium_plan_selections'),
    ('user_premium_meal_selections'),
    ('premium_shopping_items'),
    ('user_premium_shopping_checks')
) as t(table_name)
order by table_name;
```

Expected during baseline-only sync:

- Premium tables remain absent until the separate Premium apply retry.
- `premium_shopping_items` remains absent.
- `user_premium_shopping_checks` remains absent.

## Rollback / Safety Notes

- Staging only.
- Never run rollback against production `dtsdnhbcwpbfrhcazqkb`.
- Do not delete existing staging rows without separate owner approval.
- Rollback depends on selected approach:
  - Option A rollback needs an ordered list of newly created baseline tables/columns and should preserve pre-existing tables.
  - Option B rollback can be narrower but must still avoid deleting real staging user data.
  - Option C rollback means restoring the reviewed FK in a later Premium draft migration.
- Prefer transaction-wrapped, idempotent scripts.
- Capture pre-apply row counts for existing critical tables before any baseline apply.

## Risks

- `supabase/schema.sql` is not necessarily a complete current migration chain by itself.
- Several SQL files are phase-specific and may depend on tables from other files.
- Some local SQL files reference AI/coaching/program tables; owner must decide whether these belong in staging baseline now.
- Staging may have schema drift in existing nutrition tables, so `create table if not exists` alone will not repair missing columns.
- Applying a full baseline without a curated order could fail midway or produce partial parity.
- Weakening the Premium FK would make staging pass for the wrong reason.

## Owner Approval Questions

- Should staging be brought to full current app baseline, or only the narrow Premium prerequisite?
- Which SQL files are owner-approved as the canonical baseline for staging?
- Should AI/coach/program phase tables be included in staging baseline now, or deferred?
- Should `phase9_goal_training_place.sql` fields be included with `user_goals` before Premium apply retry?
- Is preserving existing staging row counts mandatory for every table, or only critical tables?
- Should baseline reconciliation be committed as a new migration draft before any staging apply?

## Next Recommended Step

Recommended next package: `STAGING_BASELINE_SCHEMA_RECONCILIATION_DRAFT`.

Scope:

- produce a curated, idempotent staging baseline SQL draft;
- include `user_goals` and approved baseline dependencies;
- include validation SQL and rollback notes;
- review before apply;
- do not touch production;
- do not retry Premium apply until baseline sync passes.

After owner approval and staging baseline validation, retry the Premium data model apply as a separate task.

## Verification

- `git status` checked.
- Repo SQL baseline files reviewed.
- Previous staging prereq audit reviewed.
- No staging schema mutation was performed.
- No production query was executed.
- `git diff --check` pending after report creation.

## Final Verdict

**STAGING_BASELINE_SCHEMA_SYNC_PLAN_READY**
