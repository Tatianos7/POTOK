# Today Premium Minimal Staging Seed Apply

- Date: 2026-08-27
- Branch: `master`
- Commit seed package: `68f1401 today premium minimal staging seed package`
- Staging project ref used: `ozidryfvhkcbtpnulakq`
- Production project ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Applied SQL draft: `supabase/seed_drafts/today-premium-minimal-staging-seed-draft-2026-08-26.sql`
- Verdict: **TODAY_PREMIUM_MINIMAL_STAGING_SEED_APPLY_READY**

## Scope

Applied the minimal Premium staging seed draft only to Supabase staging project `ozidryfvhkcbtpnulakq`.

No runtime code changes, production changes, baseline SQL apply, Premium schema apply, diary/workout writes, `public.recipes` writes, recipe import, real shopping list runtime, AI runtime, voice input, PR, commit, or push work was done in this apply step.

## Preflight

- Branch checked: `master`.
- HEAD checked: `68f1401 today premium minimal staging seed package`.
- Git status checked; unrelated dirty/untracked files exist and were not modified by this task.
- Local linked ref file confirmed `ozidryfvhkcbtpnulakq`.
- Production ref `dtsdnhbcwpbfrhcazqkb` was not linked or used for SQL execution.
- Applied file confirmed as the minimal staging seed draft, not a schema/migration draft.
- Premium schema was already present on staging before apply.
- Runtime UI was not changed and remains out of scope.

## Pre-Apply Counts

Premium catalog and user selection tables before apply:

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

Preserved legacy tables before apply:

| Table | Row count |
| --- | ---: |
| `public.food_diary_entries` | 0 |
| `public.recipe_ingredients` | 0 |
| `public.recipes` | 0 |

## Apply Result

Apply command shape:

```text
supabase db query --linked --file supabase/seed_drafts/today-premium-minimal-staging-seed-draft-2026-08-26.sql --output-format json
```

Result: passed.

Observed output:

```text
rows: []
```

No SQL errors were returned.

## Seeded Catalog Counts

Premium catalog and user selection tables after apply:

| Table | Row count |
| --- | ---: |
| `premium_meal_recipe_options` | 16 |
| `premium_meal_slots` | 8 |
| `premium_plan_days` | 2 |
| `premium_plans` | 1 |
| `premium_recipe_hints` | 6 |
| `premium_recipe_ingredients` | 18 |
| `premium_recipe_steps` | 12 |
| `premium_recipes` | 6 |
| `user_premium_meal_selections` | 0 |
| `user_premium_plan_selections` | 0 |

## Validation Result

Active plan validation:

| Field | Value |
| --- | --- |
| `title` | `staging_seed_weight_loss_14_day_test_plan` |
| `duration_days` | `14` |
| `goal_type` | `weight_loss` |
| `is_active` | `true` |

Seeded meal slots by type:

| Meal type | Slot count |
| --- | ---: |
| `breakfast` | 2 |
| `dinner` | 2 |
| `lunch` | 2 |
| `snack` | 2 |

Seeded meal recipe options by type:

| Option type | Option count |
| --- | ---: |
| `primary` | 8 |
| `replacement` | 8 |

Validation passed:

- active staging seed plan exists;
- `duration_days = 14`;
- `goal_type = weight_loss`;
- seeded days count is `2`;
- breakfast/lunch/dinner/snack slots exist;
- seeded recipes count is `6`;
- ingredients exist;
- steps exist;
- no-scale hints exist;
- primary and replacement meal recipe options exist;
- user Premium selection tables remain empty.

## Preserved Table Counts

Preserved legacy tables after apply:

| Table | Before | After |
| --- | ---: | ---: |
| `public.food_diary_entries` | 0 | 0 |
| `public.recipe_ingredients` | 0 | 0 |
| `public.recipes` | 0 | 0 |

Result: preserved row counts match the pre-apply snapshot.

## Safety Checks

Confirmed:

- production ref `dtsdnhbcwpbfrhcazqkb` was not used;
- baseline SQL was not applied;
- Premium schema SQL was not applied;
- runtime files were not changed;
- no user Premium selections were created;
- `public.recipes` row count remained `0`;
- `public.recipe_ingredients` row count remained `0`;
- `public.food_diary_entries` row count remained `0`;
- no diary/workout writes were performed by this seed;
- no recipe import was performed;
- no real shopping list runtime was created;
- no AI/runtime rows were created.

Confirmed absent after apply:

- `premium_shopping_items`;
- `user_premium_shopping_checks`.

## Errors

No SQL apply errors.

Two broader parallel validation queries through the Supabase CLI wrapper hung and were manually interrupted before being replaced with smaller sequential validation queries. The smaller queries completed successfully and are reflected in this report.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_STAGING_SEED_POST_APPLY_REVIEW`.

Scope:

- review this seed apply report;
- decide whether the minimal 2-day seed is enough for the next staging UI/RLS task;
- if RLS behavioral tests are retried, use the existing secure env/JWT guidance and keep test-user cleanup separate from seed cleanup;
- keep production untouched and keep runtime UI integration under a separate owner-approved package.

## Verification

- `git diff --check`
  - Result: passed.
- Staging seed apply
  - Result: passed.
- Staging validation
  - Result: passed with smaller sequential validation queries.
- No production query.
- No runtime code changes.

## Final Verdict

**TODAY_PREMIUM_MINIMAL_STAGING_SEED_APPLY_READY**
