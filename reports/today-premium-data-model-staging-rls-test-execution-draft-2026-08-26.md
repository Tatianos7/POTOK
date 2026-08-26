# Today Premium Data Model Staging RLS Test Execution Draft

- Date: 2026-08-26
- Branch: `master`
- Source plan: `reports/today-premium-data-model-staging-rls-test-plan-2026-08-26.md`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Verdict: **TODAY_PREMIUM_DATA_MODEL_STAGING_RLS_TEST_EXECUTION_DRAFT_READY**

## Scope

Prepare exact staging-only RLS test execution instructions for the Premium data model.

This is a draft/report only. Do not execute SQL, create test users, create seed data, mutate staging, touch production, apply baseline SQL, reapply Premium schema SQL, or run runtime app writes without a separate explicit owner-approved execution task.

## Placeholders

Use placeholders only in this draft. Do not commit real secrets, JWTs, passwords, service-role keys, or access tokens.

- `<TEST_USER_A_UUID>`
- `<TEST_USER_B_UUID>`
- `<TEST_USER_A_JWT>`
- `<TEST_USER_B_JWT>`
- `<STAGING_SERVICE_ROLE_CONTEXT>`

All SQL snippets below are templates for a later approved staging execution package.

## Execution Safety Checklist

Before any later execution:

- Confirm branch/context is still intended for staging work.
- Confirm linked Supabase ref is `ozidryfvhkcbtpnulakq`.
- Confirm production ref `dtsdnhbcwpbfrhcazqkb` is not linked or used.
- Confirm runtime UI remains on mock data.
- Confirm no diary/workout writes are included.
- Confirm no recipe import or real recipe runtime writes are included.
- Confirm no AI/runtime rows are included.
- Confirm no broad content seed is included.
- Confirm cleanup SQL targets only `rls_test_*` rows and dedicated test users.

## Phase 1: Service-Role Setup

Run only in `<STAGING_SERVICE_ROLE_CONTEXT>` after owner approval. Service-role setup intentionally bypasses RLS so test data can be inserted; authenticated assertions must be run separately with user JWTs.

### 1.1 Test User Prerequisites

Auth users should already exist before SQL setup, or be created through an owner-approved staging auth procedure.

Required user ids:

- `<TEST_USER_A_UUID>`
- `<TEST_USER_B_UUID>`

Do not create or delete auth users from this draft.

### 1.2 Baseline User Goals

Expected result: setup succeeds.

```sql
insert into public.user_goals (
  user_id,
  calories,
  protein,
  fat,
  carbs,
  goal_type
) values
  (
    '<TEST_USER_A_UUID>'::uuid,
    2100,
    140,
    70,
    220,
    'rls_test_goal_a'
  ),
  (
    '<TEST_USER_B_UUID>'::uuid,
    2000,
    130,
    65,
    210,
    'rls_test_goal_b'
  )
on conflict (user_id) do update
set
  calories = excluded.calories,
  protein = excluded.protein,
  fat = excluded.fat,
  carbs = excluded.carbs,
  goal_type = excluded.goal_type,
  updated_at = now();
```

### 1.3 Premium Catalog Seed

Expected result: setup succeeds and returns ids for later assertions.

```sql
with
active_plan as (
  insert into public.premium_plans (
    title,
    subtitle,
    goal_type,
    duration_days,
    difficulty,
    is_active
  ) values (
    'rls_test_premium_plan_active_a',
    'RLS test active plan',
    'rls_test',
    7,
    'test',
    true
  )
  returning id
),
inactive_plan as (
  insert into public.premium_plans (
    title,
    subtitle,
    goal_type,
    duration_days,
    difficulty,
    is_active
  ) values (
    'rls_test_premium_plan_inactive',
    'RLS test inactive plan',
    'rls_test',
    7,
    'test',
    false
  )
  returning id
),
other_plan as (
  insert into public.premium_plans (
    title,
    subtitle,
    goal_type,
    duration_days,
    difficulty,
    is_active
  ) values (
    'rls_test_premium_plan_other',
    'RLS test other plan',
    'rls_test',
    7,
    'test',
    true
  )
  returning id
),
active_day as (
  insert into public.premium_plan_days (
    premium_plan_id,
    day_number,
    calories,
    protein,
    fat,
    carbs
  )
  select id, 1, 2100, 140, 70, 220
  from active_plan
  returning id
),
other_day as (
  insert into public.premium_plan_days (
    premium_plan_id,
    day_number,
    calories,
    protein,
    fat,
    carbs
  )
  select id, 1, 2000, 130, 65, 210
  from other_plan
  returning id
),
allowed_slot as (
  insert into public.premium_meal_slots (
    premium_plan_day_id,
    meal_type,
    title,
    calories,
    protein,
    fat,
    carbs,
    sort_order
  )
  select id, 'breakfast', 'rls_test_meal_slot_allowed', 500, 35, 15, 55, 1
  from active_day
  returning id
),
outside_slot as (
  insert into public.premium_meal_slots (
    premium_plan_day_id,
    meal_type,
    title,
    calories,
    protein,
    fat,
    carbs,
    sort_order
  )
  select id, 'breakfast', 'rls_test_meal_slot_outside_plan', 500, 35, 15, 55, 1
  from other_day
  returning id
),
allowed_recipe as (
  insert into public.premium_recipes (
    title,
    category,
    calories,
    protein,
    fat,
    carbs,
    cooking_time_min,
    difficulty_label,
    is_active
  ) values (
    'rls_test_recipe_allowed_active',
    'breakfast',
    500,
    35,
    15,
    55,
    15,
    'test',
    true
  )
  returning id
),
disallowed_recipe as (
  insert into public.premium_recipes (
    title,
    category,
    calories,
    protein,
    fat,
    carbs,
    cooking_time_min,
    difficulty_label,
    is_active
  ) values (
    'rls_test_recipe_disallowed_active',
    'breakfast',
    520,
    34,
    16,
    58,
    15,
    'test',
    true
  )
  returning id
),
inactive_recipe as (
  insert into public.premium_recipes (
    title,
    category,
    calories,
    protein,
    fat,
    carbs,
    cooking_time_min,
    difficulty_label,
    is_active
  ) values (
    'rls_test_recipe_allowed_inactive',
    'breakfast',
    480,
    32,
    14,
    52,
    15,
    'test',
    false
  )
  returning id
),
allowed_option as (
  insert into public.premium_meal_recipe_options (
    premium_meal_slot_id,
    premium_recipe_id,
    option_type,
    label,
    sort_order
  )
  select allowed_slot.id, allowed_recipe.id, 'primary', 'rls_test_allowed', 1
  from allowed_slot, allowed_recipe
  returning id
)
select
  (select id from active_plan) as active_plan_id,
  (select id from inactive_plan) as inactive_plan_id,
  (select id from other_plan) as other_plan_id,
  (select id from allowed_slot) as allowed_slot_id,
  (select id from outside_slot) as outside_slot_id,
  (select id from allowed_recipe) as allowed_recipe_id,
  (select id from disallowed_recipe) as disallowed_recipe_id,
  (select id from inactive_recipe) as inactive_recipe_id,
  (select id from allowed_option) as allowed_option_id;
```

Record returned ids as execution-local placeholders:

- `<ACTIVE_PLAN_ID>`
- `<INACTIVE_PLAN_ID>`
- `<OTHER_PLAN_ID>`
- `<ALLOWED_SLOT_ID>`
- `<OUTSIDE_SLOT_ID>`
- `<ALLOWED_RECIPE_ID>`
- `<DISALLOWED_RECIPE_ID>`
- `<INACTIVE_RECIPE_ID>`

## Phase 2: Authenticated User A Assertions

Run with `<TEST_USER_A_JWT>`. Do not use service-role for these assertions.

### CATALOG-01: Regular User Cannot Insert Catalog Plan

Expected result: fail with RLS/check/permission error.

```sql
insert into public.premium_plans (title, duration_days, is_active)
values ('rls_test_regular_user_catalog_insert_should_fail', 7, true);
```

### CATALOG-02: Regular User Cannot Update Catalog Recipe

Expected result: fail with RLS/check/permission error or affect 0 rows.

```sql
update public.premium_recipes
set title = 'rls_test_regular_user_catalog_update_should_fail'
where id = '<ALLOWED_RECIPE_ID>'::uuid;
```

### CATALOG-03: Regular User Cannot Delete Catalog Option

Expected result: fail with RLS/check/permission error or affect 0 rows.

```sql
delete from public.premium_meal_recipe_options
where premium_meal_slot_id = '<ALLOWED_SLOT_ID>'::uuid
  and premium_recipe_id = '<ALLOWED_RECIPE_ID>'::uuid;
```

### PLAN-01: User A Can Select Active Plan With Null Goal

Expected result: pass and return `user_premium_plan_selection_id`.

```sql
insert into public.user_premium_plan_selections (
  user_id,
  user_goal_id,
  premium_plan_id,
  status,
  start_date
) values (
  '<TEST_USER_A_UUID>'::uuid,
  null,
  '<ACTIVE_PLAN_ID>'::uuid,
  'active',
  current_date
)
returning id;
```

Record returned id:

- `<USER_A_PLAN_SELECTION_ID>`

### PLAN-02: User A Can Use Own Goal On Active Plan

Expected result: pass as update of own row.

```sql
update public.user_premium_plan_selections
set user_goal_id = '<TEST_USER_A_UUID>'::uuid
where id = '<USER_A_PLAN_SELECTION_ID>'::uuid
returning id, user_goal_id;
```

### PLAN-03: Cross-User Goal Is Blocked

Expected result: fail with RLS/check violation.

```sql
update public.user_premium_plan_selections
set user_goal_id = '<TEST_USER_B_UUID>'::uuid
where id = '<USER_A_PLAN_SELECTION_ID>'::uuid;
```

### PLAN-04: Inactive Plan Is Blocked

Expected result: fail with RLS/check violation. If `PLAN-01` already created an active selection, pause/archive it first or use a dedicated third test selection path to avoid the one-active-plan unique index masking the RLS check.

```sql
insert into public.user_premium_plan_selections (
  user_id,
  user_goal_id,
  premium_plan_id,
  status,
  start_date
) values (
  '<TEST_USER_A_UUID>'::uuid,
  null,
  '<INACTIVE_PLAN_ID>'::uuid,
  'paused',
  current_date
);
```

### MEAL-01: Clear-To-Default Null Is Allowed

Expected result: pass and return `user_premium_meal_selection_id`.

```sql
insert into public.user_premium_meal_selections (
  user_premium_plan_selection_id,
  premium_meal_slot_id,
  selected_premium_recipe_id
) values (
  '<USER_A_PLAN_SELECTION_ID>'::uuid,
  '<ALLOWED_SLOT_ID>'::uuid,
  null
)
returning id;
```

Record returned id:

- `<USER_A_MEAL_SELECTION_ID>`

### MEAL-02: Allowed Active Recipe Is Allowed

Expected result: pass.

```sql
update public.user_premium_meal_selections
set selected_premium_recipe_id = '<ALLOWED_RECIPE_ID>'::uuid
where id = '<USER_A_MEAL_SELECTION_ID>'::uuid
returning id, selected_premium_recipe_id;
```

### MEAL-03: Slot Outside Selected Plan Is Blocked

Expected result: fail with RLS/check violation.

```sql
update public.user_premium_meal_selections
set premium_meal_slot_id = '<OUTSIDE_SLOT_ID>'::uuid
where id = '<USER_A_MEAL_SELECTION_ID>'::uuid;
```

### MEAL-04: Disallowed Recipe Is Blocked

Expected result: fail with RLS/check violation.

```sql
update public.user_premium_meal_selections
set selected_premium_recipe_id = '<DISALLOWED_RECIPE_ID>'::uuid
where id = '<USER_A_MEAL_SELECTION_ID>'::uuid;
```

### MEAL-05: Inactive Recipe Is Blocked

Expected result: fail with RLS/check violation.

```sql
update public.user_premium_meal_selections
set selected_premium_recipe_id = '<INACTIVE_RECIPE_ID>'::uuid
where id = '<USER_A_MEAL_SELECTION_ID>'::uuid;
```

### MEAL-08: Clear Back To Default

Expected result: pass.

```sql
update public.user_premium_meal_selections
set selected_premium_recipe_id = null
where id = '<USER_A_MEAL_SELECTION_ID>'::uuid
returning id, selected_premium_recipe_id;
```

## Phase 3: Authenticated User B Assertions

Run with `<TEST_USER_B_JWT>`. Do not use service-role for these assertions.

### PLAN-05: User B Cannot Read User A Plan Selection

Expected result: return 0 rows.

```sql
select id
from public.user_premium_plan_selections
where id = '<USER_A_PLAN_SELECTION_ID>'::uuid;
```

### PLAN-06: User B Cannot Update User A Plan Selection

Expected result: fail with RLS/check/permission error or affect 0 rows.

```sql
update public.user_premium_plan_selections
set status = 'paused'
where id = '<USER_A_PLAN_SELECTION_ID>'::uuid
returning id;
```

### MEAL-06: User B Cannot Read User A Meal Selection

Expected result: return 0 rows.

```sql
select id
from public.user_premium_meal_selections
where id = '<USER_A_MEAL_SELECTION_ID>'::uuid;
```

### MEAL-07: User B Cannot Update User A Meal Selection

Expected result: fail with RLS/check/permission error or affect 0 rows.

```sql
update public.user_premium_meal_selections
set selected_premium_recipe_id = null
where id = '<USER_A_MEAL_SELECTION_ID>'::uuid
returning id;
```

## Phase 4: Cleanup

Run only in `<STAGING_SERVICE_ROLE_CONTEXT>` after test assertions are captured.

Rules:

- Delete only `rls_test_*` rows and rows connected to the recorded test ids.
- Never delete non-test staging rows.
- Follow FK dependencies.
- Auth test-user cleanup requires separate owner approval.

Expected result: cleanup succeeds and leaves no `rls_test_*` Premium rows.

```sql
begin;

delete from public.user_premium_meal_selections
where user_premium_plan_selection_id in (
  select id
  from public.user_premium_plan_selections
  where user_id in (
    '<TEST_USER_A_UUID>'::uuid,
    '<TEST_USER_B_UUID>'::uuid
  )
);

delete from public.user_premium_plan_selections
where user_id in (
  '<TEST_USER_A_UUID>'::uuid,
  '<TEST_USER_B_UUID>'::uuid
);

delete from public.premium_meal_recipe_options
where premium_meal_slot_id in (
  select pms.id
  from public.premium_meal_slots pms
  join public.premium_plan_days ppd on ppd.id = pms.premium_plan_day_id
  join public.premium_plans pp on pp.id = ppd.premium_plan_id
  where pp.title like 'rls_test_%'
)
or premium_recipe_id in (
  select id
  from public.premium_recipes
  where title like 'rls_test_%'
);

delete from public.premium_meal_slots
where premium_plan_day_id in (
  select ppd.id
  from public.premium_plan_days ppd
  join public.premium_plans pp on pp.id = ppd.premium_plan_id
  where pp.title like 'rls_test_%'
);

delete from public.premium_plan_days
where premium_plan_id in (
  select id
  from public.premium_plans
  where title like 'rls_test_%'
);

delete from public.premium_recipe_hints
where premium_recipe_id in (
  select id
  from public.premium_recipes
  where title like 'rls_test_%'
);

delete from public.premium_recipe_steps
where premium_recipe_id in (
  select id
  from public.premium_recipes
  where title like 'rls_test_%'
);

delete from public.premium_recipe_ingredients
where premium_recipe_id in (
  select id
  from public.premium_recipes
  where title like 'rls_test_%'
);

delete from public.premium_recipes
where title like 'rls_test_%';

delete from public.premium_plans
where title like 'rls_test_%';

delete from public.user_goals
where user_id in (
  '<TEST_USER_A_UUID>'::uuid,
  '<TEST_USER_B_UUID>'::uuid
)
and goal_type like 'rls_test_%';

commit;
```

### Cleanup Verification

Expected result: all counts are `0`.

```sql
select 'premium_plans' as table_name, count(*)::bigint as row_count
from public.premium_plans
where title like 'rls_test_%'
union all
select 'premium_recipes', count(*)::bigint
from public.premium_recipes
where title like 'rls_test_%'
union all
select 'user_premium_plan_selections', count(*)::bigint
from public.user_premium_plan_selections
where user_id in (
  '<TEST_USER_A_UUID>'::uuid,
  '<TEST_USER_B_UUID>'::uuid
)
union all
select 'user_premium_meal_selections', count(*)::bigint
from public.user_premium_meal_selections upms
join public.user_premium_plan_selections upps
  on upps.id = upms.user_premium_plan_selection_id
where upps.user_id in (
  '<TEST_USER_A_UUID>'::uuid,
  '<TEST_USER_B_UUID>'::uuid
);
```

## Coverage Checklist

Covered by this execution draft:

- regular user cannot mutate catalog tables;
- inactive plan is blocked;
- cross-user `user_goal_id` is blocked;
- active plan is allowed;
- `user_goal_id null` is allowed;
- slot outside selected plan is blocked;
- recipe outside allowed options is blocked;
- inactive recipe is blocked;
- `selected_premium_recipe_id null` is allowed;
- user B cannot read/update user A selections.

## Risks

- Real JWT execution details depend on the final approved testing harness.
- The one-active-plan unique index can mask inactive-plan checks if the active selection is not isolated; this draft uses `status = 'paused'` for the inactive-plan negative insert to avoid that collision.
- Service-role setup bypasses RLS, so it must not be confused with authenticated assertions.
- Cleanup must be reviewed before execution because auth-user cleanup is intentionally out of scope.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_DATA_MODEL_STAGING_RLS_TEST_EXECUTION_REVIEW`.

Scope:

- review this execution draft before any SQL is run;
- confirm placeholders and test-user/JWT acquisition path;
- decide whether to execute in SQL editor, CLI, or a small scripted harness;
- only after review and owner approval, run the staging-only RLS tests.

## Verification

- `git diff --check`
  - Result: pending after report creation.
- No Supabase SQL execution.
- No staging mutation.
- No production query.

## Final Verdict

**TODAY_PREMIUM_DATA_MODEL_STAGING_RLS_TEST_EXECUTION_DRAFT_READY**
