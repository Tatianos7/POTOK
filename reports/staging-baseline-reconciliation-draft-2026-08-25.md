# Staging Baseline Reconciliation Draft

- Date: 2026-08-25
- Branch: `master`
- Staging project ref: `ozidryfvhkcbtpnulakq`
- Production project ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Source plan: `reports/staging-baseline-schema-sync-plan-2026-08-25.md`
- SQL draft: `supabase/migration_drafts/staging-baseline-reconciliation-draft-2026-08-25.sql`
- Verdict: **STAGING_BASELINE_RECONCILIATION_DRAFT_READY**

## Scope

Draft/report-only staging baseline reconciliation package before retrying the POTOK Premium data model apply.

No runtime code changes, production changes, staging schema mutation, Supabase migration execution, Premium SQL re-apply, baseline migration apply, payment/auth changes, diary/workout writes, recipe import, AI runtime, voice input, commit, push, or PR work was done.

## Source Plan

This draft follows the recommendation from `STAGING_BASELINE_SCHEMA_SYNC_PLAN_READY`:

- do not weaken the reviewed Premium FK to `public.user_goals(user_id)`;
- bring staging closer to the current repo baseline first;
- do not blindly execute all SQL files under `supabase/`;
- keep production untouched.

## Current Staging Mismatch

Previous read-only staging audit found staging public schema is minimal:

- existing: `foods`, `food_aliases`, `food_diary_entries`, `favorite_products`, `recipes`, `recipe_ingredients`, `user_profiles`;
- missing: `user_goals`, `goal_trajectory`, `progress_trends`, measurements history, workout-related baseline tables, and other app baseline tables.

The Premium data model apply failed because staging lacks:

```sql
public.user_goals
```

while the Premium draft correctly references:

```sql
user_premium_plan_selections.user_goal_id references public.user_goals(user_id)
```

## Objects Included

The SQL draft is phased and idempotent where practical.

Included Phase 1 core baseline:

- `user_goals`
- `habits`
- `habit_logs`
- `analytics_events`

Included recipe relation tables:

- `favorite_recipes`
- `recipe_collections`

Included measurements baseline:

- `user_measurements`
- `measurement_history`
- `measurement_photo_history`

Included goal/progress read-model baseline:

- `user_state`
- `goal_trajectory`
- `progress_trends`

The `user_goals` draft includes the current local baseline plus goal metadata from `phase9_goal_training_place.sql`, including `goal_type`, body metrics, dates, BMR/TDEE, and `training_place`.

## Objects Intentionally Not Included

Existing staging tables are preserved and not altered by this draft:

- `foods`
- `food_aliases`
- `food_diary_entries`
- `favorite_products`
- `recipes`
- `recipe_ingredients`
- `user_profiles`

Premium tables are intentionally not included:

- `premium_plans`
- `premium_plan_days`
- `premium_meal_slots`
- `premium_recipes`
- `premium_recipe_ingredients`
- `premium_recipe_steps`
- `premium_recipe_hints`
- `premium_meal_recipe_options`
- `user_premium_plan_selections`
- `user_premium_meal_selections`
- `premium_shopping_items`
- `user_premium_shopping_checks`

Workout/catalog/program/AI-heavy baseline is intentionally not included in this first reconciliation draft:

- workout catalog and diary tables such as `exercises`, `muscles`, `exercise_muscles`, `workout_entries`;
- program tables such as `nutrition_programs`, `training_programs`, `program_days`;
- report tables that depend on AI recommendations, such as `report_snapshots` and `report_aggregates`;
- `ai_*` tables/runtime surfaces.

Reason:

- the repo contains multiple phase-specific SQL files with ordering dependencies;
- staging currently has no workout catalog baseline;
- full workout/program/AI baseline needs a separate owner-approved review.

## Risks

- This is not full baseline parity; it is a phased reconciliation draft.
- Existing staging table drift is not repaired because preserved tables are not altered.
- Measurement schema has multiple historical local variants; this draft uses UUID IDs plus nullable `day`/`date` columns to support current canonical direction without deleting legacy compatibility.
- Workout-related service paths may still lack staging DB backing after this draft.
- Applying this draft would make the Premium `user_goals` FK possible, but it would not make staging a complete production mirror.

## Validation SQL

Run only after owner-approved staging apply against `ozidryfvhkcbtpnulakq`.

Table existence:

```sql
select table_name, to_regclass('public.' || table_name)::text as regclass
from (
  values
    ('user_goals'),
    ('habits'),
    ('habit_logs'),
    ('analytics_events'),
    ('favorite_recipes'),
    ('recipe_collections'),
    ('user_measurements'),
    ('measurement_history'),
    ('measurement_photo_history'),
    ('user_state'),
    ('goal_trajectory'),
    ('progress_trends'),
    ('premium_plans'),
    ('premium_shopping_items'),
    ('user_premium_shopping_checks')
) as t(table_name)
order by table_name;
```

`user_goals` primary key and FK:

```sql
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

RLS/policies:

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'user_goals',
    'habits',
    'habit_logs',
    'analytics_events',
    'favorite_recipes',
    'recipe_collections',
    'user_measurements',
    'measurement_history',
    'measurement_photo_history',
    'user_state',
    'goal_trajectory',
    'progress_trends'
  )
order by c.relname;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'user_goals',
    'habits',
    'habit_logs',
    'analytics_events',
    'favorite_recipes',
    'recipe_collections',
    'user_measurements',
    'measurement_history',
    'measurement_photo_history',
    'user_state',
    'goal_trajectory',
    'progress_trends'
  )
order by tablename, policyname;
```

Existing staging table row counts:

```sql
select 'foods' as table_name, count(*)::bigint as row_count from public.foods
union all
select 'food_aliases', count(*)::bigint from public.food_aliases
union all
select 'food_diary_entries', count(*)::bigint from public.food_diary_entries
union all
select 'favorite_products', count(*)::bigint from public.favorite_products
union all
select 'recipes', count(*)::bigint from public.recipes
union all
select 'recipe_ingredients', count(*)::bigint from public.recipe_ingredients
union all
select 'user_profiles', count(*)::bigint from public.user_profiles
order by table_name;
```

Premium absence during baseline-only sync:

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

Expected:

- included baseline tables exist;
- `user_goals.user_id` is PK and references `auth.users(id)`;
- included baseline tables have RLS enabled and owner policies;
- existing critical staging row counts do not change;
- Premium tables remain absent until the separate Premium apply retry.

## Rollback Notes

Rollback is instruction-only and must not be executed without owner approval.

Staging-only rollback order for tables created by this draft:

1. `progress_trends`
2. `goal_trajectory`
3. `user_state`
4. `measurement_photo_history`
5. `measurement_history`
6. `user_measurements`
7. `recipe_collections`
8. `favorite_recipes`
9. `analytics_events`
10. `habit_logs`
11. `habits`
12. `user_goals`

Safety notes:

- never run rollback on production;
- do not drop any table that existed before apply;
- do not delete existing staging rows without separate approval;
- capture pre-apply and post-apply table existence/counts.

## Readiness For Review

Ready for architecture/DB review as a draft.

Not ready for staging apply until owner approves:

- whether this phased subset is enough before Premium retry;
- whether workout/program/AI baseline should be handled now or later;
- whether measurement schema shape is acceptable for staging reconciliation;
- whether existing staging table drift should be repaired in the same package or separately.

## Next Recommended Step

Recommended next package: `STAGING_BASELINE_RECONCILIATION_DRAFT_REVIEW`.

Scope:

- review the SQL draft for FK/RLS/idempotency/scope;
- decide if Phase 1 reconciliation is acceptable;
- do not apply to staging until a separate explicit apply task;
- keep production untouched.

## Verification

- Repo baseline SQL reviewed.
- Existing staging mismatch report reviewed.
- SQL draft created only under `supabase/migration_drafts/`.
- No Supabase SQL was executed for this task.
- No runtime code changed.
- `git diff --check` pending after report creation.

## Final Verdict

**STAGING_BASELINE_RECONCILIATION_DRAFT_READY**
