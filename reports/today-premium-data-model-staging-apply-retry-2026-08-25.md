# Today Premium Data Model Staging Apply Retry

- Date: 2026-08-26
- Branch: `master`
- Staging project ref used: `ozidryfvhkcbtpnulakq`
- Production project ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Premium SQL draft applied: `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`
- Baseline prerequisite: `STAGING_BASELINE_RECONCILIATION_APPLY_READY`
- Verdict: **TODAY_PREMIUM_DATA_MODEL_STAGING_APPLY_RETRY_READY**

## Scope

Retried the POTOK Premium data model SQL draft after successful staging baseline reconciliation.

The apply targeted only Supabase staging project `ozidryfvhkcbtpnulakq`. Production project `dtsdnhbcwpbfrhcazqkb` was not linked or used. Baseline reconciliation SQL was not reapplied.

No runtime code changes, production changes, payment/auth changes beyond declared FKs, diary/workout writes, recipe import, real recipe runtime, real shopping list runtime, AI runtime, voice input, PR, commit, or push work was done.

## Preflight

- Branch checked: `master`.
- Git status checked; unrelated dirty/untracked files exist and were not modified by this task.
- Local linked ref file confirmed `ozidryfvhkcbtpnulakq`.
- Supabase projects list confirmed:
  - staging `POTOK Staging`, ref `ozidryfvhkcbtpnulakq`, linked `true`, status `ACTIVE_HEALTHY`;
  - production `POTOK`, ref `dtsdnhbcwpbfrhcazqkb`, linked `false`, status `ACTIVE_HEALTHY`.
- Applied file confirmed as the Premium data model SQL draft, not the baseline reconciliation draft.
- `public.user_goals` existed before apply.
- `user_goals_pkey` existed before apply.
- Before apply, the only table found from the Premium/prerequisite check set was `user_goals`; Premium and shopping tables were absent.

## Apply Result

Apply command shape:

```text
supabase db query --linked --file supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql --output-format json
```

Result: passed.

Observed output:

```text
rows: []
```

No SQL errors were returned.

## Created Premium Tables

Validation by direct row-count queries confirmed all 10 Premium tables exist:

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

## Constraints

Constraint summary by table:

| Table | Constraint count |
| --- | ---: |
| `premium_meal_recipe_options` | 3 |
| `premium_meal_slots` | 4 |
| `premium_plan_days` | 4 |
| `premium_plans` | 3 |
| `premium_recipe_hints` | 3 |
| `premium_recipe_ingredients` | 4 |
| `premium_recipe_steps` | 4 |
| `premium_recipes` | 3 |
| `user_premium_meal_selections` | 4 |
| `user_premium_plan_selections` | 5 |

## Indexes

Key indexes were confirmed with `to_regclass`:

- `premium_plans_active_goal_type_idx`
- `premium_meal_recipe_options_slot_recipe_unique_idx`
- `user_premium_plan_selections_one_active_idx`
- `user_premium_meal_selections_selection_slot_unique_idx`

Other supporting indexes are included in the applied SQL draft and are covered by the successful transaction plus constraint/index spot checks above.

## Triggers

Expected `updated_at` triggers were confirmed:

- `update_premium_plan_days_updated_at`
- `update_premium_plans_updated_at`
- `update_premium_recipes_updated_at`
- `update_user_premium_meal_selections_updated_at`
- `update_user_premium_plan_selections_updated_at`

## RLS And Policies

Catalog policies:

- `pg_policy` confirmed 8 catalog select policies, one per catalog table.
- No regular-user catalog mutation policies were added by the draft.

User plan selection policies:

- `user_premium_plan_selections_select_own`: present.
- `user_premium_plan_selections_insert_own`: present.
- `user_premium_plan_selections_update_own`: present.
- `user_premium_plan_selections_delete_own`: present.

The insert/update `with_check` predicates were deparsed on staging and confirmed:

- `auth.uid() = user_id`;
- `user_goal_id is null or user_goal_id = auth.uid()`;
- referenced `premium_plan_id` must point to an active `premium_plans` row.

User meal selection policies:

- `user_premium_meal_selections_select_own`: present.
- `user_premium_meal_selections_insert_own`: present.
- `user_premium_meal_selections_update_own`: present.
- `user_premium_meal_selections_delete_own`: present.

The insert/update `with_check` predicates were deparsed on staging and confirmed:

- parent `user_premium_plan_selections` row must belong to `auth.uid()`;
- `premium_meal_slot_id` must belong to the selected Premium plan;
- `selected_premium_recipe_id is null` is allowed for clear-to-default;
- if `selected_premium_recipe_id` is not null, the selected recipe must be an allowed option through `premium_meal_recipe_options`;
- the selected recipe must be active through `premium_recipes.pr.is_active = true`.

The final deparse explicitly qualifies outer user meal selection references:

- `pmro.premium_meal_slot_id = user_premium_meal_selections.premium_meal_slot_id`;
- `pmro.premium_recipe_id = user_premium_meal_selections.selected_premium_recipe_id`.

## Row Counts

Premium tables after schema-only apply:

| Table | Row count |
| --- | ---: |
| `premium_meal_recipe_options` | 0 |
| `premium_meal_slots` | 0 |
| `premium_plan_days` | 0 |
| `premium_plans` | 0 |
| `premium_recipe_hints` | 0 |
| `premium_recipe_ingredients` | 0 |
| `premium_recipe_steps` | 0 |
| `premium_recipes` | 0 |
| `user_premium_meal_selections` | 0 |
| `user_premium_plan_selections` | 0 |

No seed data was inserted.

Preserved staging tables after Premium apply:

| Table | Row count |
| --- | ---: |
| `favorite_products` | 0 |
| `food_aliases` | 3320 |
| `food_diary_entries` | 0 |
| `foods` | 2200 |
| `recipe_ingredients` | 0 |
| `recipes` | 0 |
| `user_profiles` | 1 |

## Premium Shopping Absence Check

Confirmed absent:

- `premium_shopping_items`
- `user_premium_shopping_checks`

The optional shopping checkbox table remains comment-only in the draft and was not created.

## Safety Checks

Confirmed:

- production ref `dtsdnhbcwpbfrhcazqkb` was not linked or used;
- baseline reconciliation SQL was not reapplied;
- runtime files were not changed;
- `public.recipes` row count remained `0`;
- `public.recipe_ingredients` row count remained `0`;
- `public.food_diary_entries` row count remained `0`;
- no workout tables were created or written by this Premium draft;
- no payment/auth table mutation occurred beyond FKs to `auth.users`;
- no AI/runtime tables or records were created;
- no real recipe runtime, recipe import, or shopping source-of-truth runtime was created.

## Negative RLS Tests

Not executed as data/user-level behavioral tests in this task.

Reason:

- staging currently has schema-only Premium tables with no Premium catalog seed;
- no minimal dedicated test users/test data package was created in this task;
- the task explicitly avoided big seed/test setup.

Pending minimal test package should verify:

- user cannot select inactive `premium_plan`;
- user cannot insert `user_premium_plan_selection` with another user's `user_goal_id`;
- user cannot insert meal selection for slot outside selected plan;
- user cannot choose a recipe outside allowed options;
- user can clear a replacement with `selected_premium_recipe_id null`;
- regular authenticated user cannot mutate catalog tables.

Static/deparsed RLS validation for those predicates passed, as described above.

## Errors

No SQL apply errors.

Several broader metadata listing/count queries through the Supabase CLI wrapper hung and were manually interrupted. Equivalent smaller validation queries completed successfully and are reflected in this report.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_DATA_MODEL_STAGING_RLS_TEST_PLAN`.

Scope:

- create a minimal staging-only seed/test-user plan for Premium RLS negative tests;
- avoid broad content seed;
- do not touch production;
- keep runtime UI on mock data until owner separately approves runtime integration.

## Verification

- `git diff --check`
  - Result: pending after report creation.
- Premium staging apply
  - Result: passed.
- Staging validation
  - Result: passed with smaller validation queries.
- No production query.
- No baseline SQL re-apply.

## Final Verdict

**TODAY_PREMIUM_DATA_MODEL_STAGING_APPLY_RETRY_READY**
