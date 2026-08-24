# Today Premium Data Model Staging Dry-Run Plan

- Date: 2026-08-24
- Branch: `master`
- SQL draft: `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`
- Staging project ref: `ozidryfvhkcbtpnulakq`
- Production project ref: `dtsdnhbcwpbfrhcazqkb`
- Status basis:
  - `TODAY_PREMIUM_DATA_MODEL_SQL_RLS_QUALIFY_REVIEW_READY`
  - `READY_FOR_STAGING_DRY_RUN_PLAN`
- Verdict: **TODAY_PREMIUM_DATA_MODEL_STAGING_DRY_RUN_PLAN_READY**

## Scope

Plan-only dry-run instructions and validation SQL for the future POTOK Premium data model migration.

No runtime code changes, DB migration execution, Supabase connection, Supabase deploy, production changes, payment/auth changes, diary/workout writes, recipe import, real recipe runtime, real shopping list runtime, AI runtime, voice input, commit, push, or PR work was done.

## Dry-Run Goal

The staging dry-run should verify that the Premium schema draft can be applied only to staging:

- apply schema only against staging project `ozidryfvhkcbtpnulakq`;
- keep production project `dtsdnhbcwpbfrhcazqkb` untouched;
- keep runtime UI on current mock data;
- validate tables, constraints, indexes, RLS, policies, triggers, and initial row counts;
- run negative RLS checks against staging after apply.

## Preconditions

Do not apply anything until explicit owner approval is given for a separate staging apply task.

Before any apply:

- Confirm the target project is staging: `ozidryfvhkcbtpnulakq`.
- Confirm the target project is not production: `dtsdnhbcwpbfrhcazqkb`.
- Confirm the SQL file is the reviewed draft: `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`.
- Confirm git status is clean or contains only expected scoped files.
- Confirm no runtime deployment is planned in the same task.
- Recommended: export/backup staging schema or take a staging snapshot if the environment contains valuable manual data.

## Apply Plan

Instruction only. Do not execute during this planning task.

1. Open the Supabase staging SQL editor or a CLI session explicitly pointed at staging project `ozidryfvhkcbtpnulakq`.
2. Confirm again that the active project ref is not production `dtsdnhbcwpbfrhcazqkb`.
3. Paste the full SQL draft from `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`.
4. Execute only after owner approval in a separate task.
5. Save the SQL editor output, errors, notices, and timestamps.
6. If apply fails, stop immediately and do not retry with edits in the SQL editor; capture the exact error and return to draft review.

## Validation SQL

Run only after an approved staging apply.

### Tables

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'premium_plans',
    'premium_plan_days',
    'premium_meal_slots',
    'premium_recipes',
    'premium_recipe_ingredients',
    'premium_recipe_steps',
    'premium_recipe_hints',
    'premium_meal_recipe_options',
    'user_premium_plan_selections',
    'user_premium_meal_selections'
  )
order by table_name;
```

Expected: exactly 10 rows.

### Constraints

```sql
select
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'premium_plans',
    'premium_plan_days',
    'premium_meal_slots',
    'premium_recipes',
    'premium_recipe_ingredients',
    'premium_recipe_steps',
    'premium_recipe_hints',
    'premium_meal_recipe_options',
    'user_premium_plan_selections',
    'user_premium_meal_selections'
  )
order by c.relname, con.conname;
```

Expected: primary keys, foreign keys, and named check constraints from the draft are present.

### Indexes

```sql
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'premium_plans',
    'premium_plan_days',
    'premium_meal_slots',
    'premium_recipes',
    'premium_recipe_ingredients',
    'premium_recipe_steps',
    'premium_recipe_hints',
    'premium_meal_recipe_options',
    'user_premium_plan_selections',
    'user_premium_meal_selections'
  )
order by tablename, indexname;
```

Expected: lookup indexes and unique indexes from the draft are present, including one active plan partial unique index.

### RLS Enabled

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'premium_plans',
    'premium_plan_days',
    'premium_meal_slots',
    'premium_recipes',
    'premium_recipe_ingredients',
    'premium_recipe_steps',
    'premium_recipe_hints',
    'premium_meal_recipe_options',
    'user_premium_plan_selections',
    'user_premium_meal_selections'
  )
order by c.relname;
```

Expected: `rls_enabled = true` for all 10 tables.

### Policies

```sql
select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    tablename like 'premium_%'
    or tablename like 'user_premium_%'
  )
order by tablename, policyname;
```

Expected:

- catalog tables have authenticated select policies only;
- user plan selections have own select/insert/update/delete policies;
- user meal selections have parent-owned select/insert/update/delete policies;
- hardened `with_check` predicates are visible for user insert/update policies.

### Triggers

```sql
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in (
    'premium_plans',
    'premium_plan_days',
    'premium_recipes',
    'user_premium_plan_selections',
    'user_premium_meal_selections'
  )
order by event_object_table, trigger_name;
```

Expected: `updated_at` triggers exist for the five tables that include `updated_at` trigger coverage in the draft.

### Initial Row Counts

```sql
select 'premium_plans' as table_name, count(*) from public.premium_plans
union all
select 'premium_plan_days', count(*) from public.premium_plan_days
union all
select 'premium_meal_slots', count(*) from public.premium_meal_slots
union all
select 'premium_recipes', count(*) from public.premium_recipes
union all
select 'premium_recipe_ingredients', count(*) from public.premium_recipe_ingredients
union all
select 'premium_recipe_steps', count(*) from public.premium_recipe_steps
union all
select 'premium_recipe_hints', count(*) from public.premium_recipe_hints
union all
select 'premium_meal_recipe_options', count(*) from public.premium_meal_recipe_options
union all
select 'user_premium_plan_selections', count(*) from public.user_premium_plan_selections
union all
select 'user_premium_meal_selections', count(*) from public.user_premium_meal_selections;
```

Expected: all counts are `0` immediately after schema-only apply.

## Negative RLS Test Plan

Run only on staging after approved apply. Use staging test users and staging-only catalog fixture rows.

Required negative checks:

- User cannot select inactive `premium_plans` rows through regular authenticated access.
- User cannot insert `user_premium_plan_selections` with another user's `user_goal_id`.
- User cannot insert `user_premium_plan_selections` for an inactive `premium_plan_id`.
- User cannot insert `user_premium_meal_selections` for a meal slot outside the selected Premium plan.
- User cannot insert `user_premium_meal_selections` with `selected_premium_recipe_id` outside allowed `premium_meal_recipe_options`.
- User cannot insert `user_premium_meal_selections` with inactive selected recipe.
- User can insert `user_premium_meal_selections` with `selected_premium_recipe_id = null` for clear-to-default.
- User cannot insert/update/delete catalog rows as a regular authenticated user.

Suggested capture for each RLS test:

- auth user id;
- attempted SQL or client operation;
- expected result;
- actual result;
- error code/message if blocked;
- rows affected if allowed.

## Safety Checks

Run only after approved staging apply.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'recipes',
    'recipe_ingredients',
    'food_diary_entries',
    'premium_shopping_items',
    'user_premium_shopping_checks'
  )
order by table_name;
```

Expected:

- existing `recipes`, `recipe_ingredients`, and `food_diary_entries` may exist but must have unchanged row counts from pre-apply;
- `premium_shopping_items` must be absent;
- `user_premium_shopping_checks` must be absent.

Recommended pre/post count checks:

```sql
select 'recipes' as table_name, count(*) from public.recipes
union all
select 'recipe_ingredients', count(*) from public.recipe_ingredients
union all
select 'food_diary_entries', count(*) from public.food_diary_entries;
```

Expected: counts unchanged before vs after schema-only apply.

Also confirm manually:

- payment/auth tables are untouched except FK references to `auth.users`;
- no diary/workout writes occurred;
- no recipe import occurred;
- no real shopping runtime was created;
- no AI/runtime columns were added.

## Rollback Plan

Rollback is staging-only. Never run rollback in production.

Use only if the approved staging apply fails validation and owner approves cleanup.

Suggested drop order:

```sql
begin;

drop table if exists public.user_premium_meal_selections;
drop table if exists public.user_premium_plan_selections;
drop table if exists public.premium_meal_recipe_options;
drop table if exists public.premium_recipe_hints;
drop table if exists public.premium_recipe_steps;
drop table if exists public.premium_recipe_ingredients;
drop table if exists public.premium_meal_slots;
drop table if exists public.premium_plan_days;
drop table if exists public.premium_recipes;
drop table if exists public.premium_plans;

drop function if exists public.update_premium_updated_at();

commit;
```

Before rollback:

- confirm project ref is staging `ozidryfvhkcbtpnulakq`;
- confirm project ref is not production `dtsdnhbcwpbfrhcazqkb`;
- capture validation failure output;
- confirm no seed/user test data needs to be preserved.

## Expected Outcomes

PASS criteria:

- all 10 Premium tables exist;
- expected constraints, indexes, RLS policies, and triggers exist;
- initial row counts are zero without seed data;
- catalog reads expose active rows only;
- regular users cannot mutate catalog tables;
- user selection rows are own-only;
- hardened negative RLS tests pass;
- old recipe, diary, payment/auth, shopping, workout, and AI surfaces remain unchanged.

FAIL criteria:

- SQL apply error;
- missing table/constraint/index/policy/trigger;
- RLS disabled on any new table;
- regular user can mutate catalog rows;
- cross-user goal selection is allowed;
- inactive plan selection is allowed;
- unrelated meal slot selection is allowed;
- disallowed or inactive recipe replacement is allowed;
- old recipe/diary/payment/shopping/AI surfaces change.

If dry-run fails, capture:

- exact SQL output/error;
- project ref;
- timestamp;
- failing validation query;
- expected vs actual result;
- whether rollback was run.

## Next Recommended Step

Owner reviews this dry-run plan.

If approved, run a separate staging-only task:

- `TODAY_PREMIUM_DATA_MODEL_STAGING_APPLY_READY`
- or `REQUIRES_FIXES`

That task should apply only to staging `ozidryfvhkcbtpnulakq`, never to production `dtsdnhbcwpbfrhcazqkb`.

## Verification

- `git diff --check`
  - Result: passed.
- No Supabase connection.
- No migration execution.

## Final Verdict

**TODAY_PREMIUM_DATA_MODEL_STAGING_DRY_RUN_PLAN_READY**
