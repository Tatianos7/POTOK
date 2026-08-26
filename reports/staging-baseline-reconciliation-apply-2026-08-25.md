# Staging Baseline Reconciliation Apply

- Date: 2026-08-25
- Branch: `master`
- Commit baseline package: `942da76 staging baseline reconciliation package`
- Staging project ref used: `ozidryfvhkcbtpnulakq`
- Production project ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Applied SQL draft: `supabase/migration_drafts/staging-baseline-reconciliation-draft-2026-08-25.sql`
- Verdict: **STAGING_BASELINE_RECONCILIATION_APPLY_READY**

## Scope

Applied the staging baseline reconciliation draft only to Supabase staging project `ozidryfvhkcbtpnulakq`.

No runtime code changes, production changes, Premium SQL apply, Supabase deploy, payment/auth changes beyond baseline FKs to `auth.users`, diary/workout writes, recipe import, AI runtime, voice input, PR, commit, or push work was done in this apply step.

## Preflight

- Branch checked: `master`.
- HEAD checked: `942da76`.
- Git status checked; unrelated dirty/untracked files exist and were not staged or modified for this task.
- Supabase projects list confirmed:
  - staging `POTOK Staging`, ref `ozidryfvhkcbtpnulakq`, linked `true`, status `ACTIVE_HEALTHY`;
  - production `POTOK`, ref `dtsdnhbcwpbfrhcazqkb`, linked `false`, status `ACTIVE_HEALTHY`.
- Local linked ref file confirmed `ozidryfvhkcbtpnulakq`.
- Applied file confirmed as the staging baseline reconciliation draft, not the Premium SQL draft.
- `supabase status` was not used for remote validation because it requires local Docker; remote apply/validation used `supabase db query --linked`.

## Pre-Apply Row Counts

Preserved staging tables before apply:

| Table | Row count |
| --- | ---: |
| `favorite_products` | 0 |
| `food_aliases` | 3320 |
| `food_diary_entries` | 0 |
| `foods` | 2200 |
| `recipe_ingredients` | 0 |
| `recipes` | 0 |
| `user_profiles` | 1 |

## Apply Result

Apply command shape:

```text
supabase db query --linked --file supabase/migration_drafts/staging-baseline-reconciliation-draft-2026-08-25.sql --output-format json
```

Result: passed.

Observed output:

```text
rows: []
```

No SQL errors were returned.

## Created Tables

Validation confirmed all 12 baseline reconciliation tables exist:

- `analytics_events`
- `favorite_recipes`
- `goal_trajectory`
- `habit_logs`
- `habits`
- `measurement_history`
- `measurement_photo_history`
- `progress_trends`
- `recipe_collections`
- `user_goals`
- `user_measurements`
- `user_state`

## Constraints

Constraint summary by table:

| Table | Constraint count |
| --- | ---: |
| `analytics_events` | 2 |
| `favorite_recipes` | 4 |
| `goal_trajectory` | 3 |
| `habit_logs` | 4 |
| `habits` | 3 |
| `measurement_history` | 2 |
| `measurement_photo_history` | 2 |
| `progress_trends` | 3 |
| `recipe_collections` | 4 |
| `user_goals` | 2 |
| `user_measurements` | 2 |
| `user_state` | 2 |

`user_goals` key checks:

- `user_goals_pkey`: present.
- `user_goals_user_id_fkey`: present.
- FK source column: `public.user_goals.user_id`.
- FK target: `auth.users.id`.

This unblocks the Premium draft prerequisite `user_premium_plan_selections.user_goal_id references public.user_goals(user_id)`.

## Indexes

Index validation confirmed primary/unique indexes and expected supporting indexes, including:

- `user_goals_pkey`
- `habits_user_idx`
- `habit_logs_user_date_idx`
- `analytics_events_user_idx`
- `favorite_recipes_user_idx`
- `recipe_collections_user_idx`
- `user_measurements_user_id_unique`
- `measurement_history_user_day_unique`
- `measurement_history_user_date_unique`
- `measurement_history_user_day_idx`
- `measurement_photo_history_user_day_unique`
- `measurement_photo_history_user_date_unique`
- `measurement_photo_history_user_day_idx`
- `goal_trajectory_user_idx`
- `progress_trends_user_idx`

## RLS And Policies

RLS enabled check returned `true` for all 12 baseline reconciliation tables.

Policies were present for:

- `analytics_events`: own select, own insert.
- `favorite_recipes`: own select, own insert with parent recipe ownership, own update with parent recipe ownership, own delete.
- `goal_trajectory`: own select, own modify.
- `habit_logs`: own select, own insert/update/delete with parent habit ownership.
- `habits`: own select, insert, update, delete.
- `measurement_history`: own select, insert, update, delete.
- `measurement_photo_history`: own select, insert, update, delete.
- `progress_trends`: own select, own modify.
- `recipe_collections`: own select, own insert with parent recipe ownership, own update with parent recipe ownership, own delete.
- `user_goals`: own select, insert, update.
- `user_measurements`: own select, insert, update, delete.
- `user_state`: own select, own modify.

Recipe relation RLS detail:

- `favorite_recipes_insert_own_recipe` check:
  - `auth.uid() = user_id`;
  - parent recipe exists with `r.id = favorite_recipes.recipe_id`;
  - parent recipe has `r.user_id = auth.uid()`.
- `favorite_recipes_update_own_recipe`:
  - `using (auth.uid() = user_id)`;
  - same parent recipe ownership `with check`.
- `favorite_recipes_delete_own`:
  - own-row only.
- `recipe_collections_insert_own_recipe` check:
  - `auth.uid() = user_id`;
  - parent recipe exists with `r.id = recipe_collections.recipe_id`;
  - parent recipe has `r.user_id = auth.uid()`.
- `recipe_collections_update_own_recipe`:
  - `using (auth.uid() = user_id)`;
  - same parent recipe ownership `with check`.
- `recipe_collections_delete_own`:
  - own-row only.

Old broad policies were absent from `pg_policies` output:

- `favorite_recipes_modify_own`: absent.
- `recipe_collections_modify_own`: absent.

## Post-Apply Row Counts

Preserved staging tables after apply:

| Table | Row count |
| --- | ---: |
| `favorite_products` | 0 |
| `food_aliases` | 3320 |
| `food_diary_entries` | 0 |
| `foods` | 2200 |
| `recipe_ingredients` | 0 |
| `recipes` | 0 |
| `user_profiles` | 1 |

Result: preserved row counts match the pre-apply snapshot.

New baseline reconciliation tables after apply:

| Table | Row count |
| --- | ---: |
| `analytics_events` | 0 |
| `favorite_recipes` | 0 |
| `goal_trajectory` | 0 |
| `habit_logs` | 0 |
| `habits` | 0 |
| `measurement_history` | 0 |
| `measurement_photo_history` | 0 |
| `progress_trends` | 0 |
| `recipe_collections` | 0 |
| `user_goals` | 0 |
| `user_measurements` | 0 |
| `user_state` | 0 |

No seed/import data was inserted.

## Premium Absence Check

Confirmed absent after baseline reconciliation apply:

- `premium_plans`
- `premium_recipes`
- `user_premium_plan_selections`
- `premium_shopping_items`
- `user_premium_shopping_checks`

Premium SQL was not applied.

## Safety Checks

Confirmed:

- production ref `dtsdnhbcwpbfrhcazqkb` was not linked or used;
- no runtime files were changed;
- `public.recipes` row count remained `0`;
- `public.recipe_ingredients` row count remained `0`;
- `public.food_diary_entries` row count remained `0`;
- no Premium tables were created;
- no shopping source-of-truth table was created;
- no workout tables were created or written by this draft;
- no payment/auth tables were modified beyond baseline foreign key references to `auth.users`;
- no AI/runtime tables were created or written.

## Errors

No SQL apply errors.

Two broader catalog validation queries using heavier metadata expressions hung in the Supabase CLI wrapper and were stopped manually with interrupt. Equivalent smaller validation queries completed successfully and are reflected above.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_DATA_MODEL_STAGING_APPLY_RETRY`.

Scope:

- retry only the Premium data model SQL draft against staging ref `ozidryfvhkcbtpnulakq`;
- confirm production ref `dtsdnhbcwpbfrhcazqkb` remains unused;
- validate the 10 Premium tables, constraints, indexes, RLS policies, triggers, and zero catalog row counts;
- run negative RLS tests if minimal test users/data are available, or record them pending.

## Verification

- `git diff --check`
  - Result: pending after report creation.
- Supabase staging apply
  - Result: passed.
- Supabase validation
  - Result: passed.
- No production query.
- No Premium SQL apply.

## Final Verdict

**STAGING_BASELINE_RECONCILIATION_APPLY_READY**
