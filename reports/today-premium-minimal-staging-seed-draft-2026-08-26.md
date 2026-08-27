# Today Premium Minimal Staging Seed Draft

- Date: 2026-08-26
- Branch: `master`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- SQL draft: `supabase/seed_drafts/today-premium-minimal-staging-seed-draft-2026-08-26.sql`
- Verdict: **TODAY_PREMIUM_MINIMAL_STAGING_SEED_DRAFT_READY**

## Scope

Prepared a minimal staging-only Premium catalog seed draft.

This is a SQL draft/report only. No Supabase SQL was executed, no staging mutation was performed, production was not touched, runtime code was not changed, and no Premium schema/baseline SQL was applied.

## Seed Contents

The draft seeds a small, clearly marked staging catalog with `staging_seed_*` names:

- 1 active Premium plan:
  - `staging_seed_weight_loss_14_day_test_plan`;
  - `goal_type = 'weight_loss'`;
  - `duration_days = 14`;
  - `is_active = true`.
- 2 seeded plan days:
  - day 1;
  - day 2.
- 8 meal slots:
  - breakfast, lunch, dinner, snack for day 1;
  - breakfast, lunch, dinner, snack for day 2.
- 6 Premium recipes:
  - `staging_seed_protein_oats`;
  - `staging_seed_egg_plate`;
  - `staging_seed_chicken_bowl`;
  - `staging_seed_turkey_wrap`;
  - `staging_seed_salmon_plate`;
  - `staging_seed_yogurt_berries`.
- ingredients for each recipe;
- two steps for each recipe;
- one "no scale" hint for each recipe;
- meal recipe options with a primary option and at least one replacement option for every seeded meal slot.

The plan duration is 14 days, while this draft intentionally seeds only the first 2 days as a minimal staging/RLS-support dataset.

## Table Impact

Active seed writes are limited to Premium catalog tables:

- `public.premium_plans`;
- `public.premium_plan_days`;
- `public.premium_meal_slots`;
- `public.premium_recipes`;
- `public.premium_recipe_ingredients`;
- `public.premium_recipe_steps`;
- `public.premium_recipe_hints`;
- `public.premium_meal_recipe_options`.

The draft is idempotent where practical by finding existing `staging_seed_*` plan/recipe rows and using `not exists` guards for child rows/options.

## Excluded Tables

The draft does not write to:

- `public.user_premium_plan_selections`;
- `public.user_premium_meal_selections`;
- `public.recipes`;
- `public.recipe_ingredients`;
- `public.food_diary_entries`;
- diary/workout tables;
- payment/auth tables;
- shopping source-of-truth tables;
- AI/runtime tables.

It does not create:

- `premium_shopping_items`;
- `user_premium_shopping_checks`.

## Validation SQL

The SQL draft includes commented validation queries to check:

- seeded row counts across Premium catalog tables;
- the active 14-day staging plan;
- at least 2 seeded plan days;
- seeded meal slots by meal type;
- seeded recipes, ingredients, steps, hints, and meal recipe options;
- `user_premium_plan_selections` and `user_premium_meal_selections` remain empty;
- `public.recipes`, `public.recipe_ingredients`, and `public.food_diary_entries` row counts remain untouched.

## Cleanup Plan

The SQL draft includes comment-only cleanup instructions in FK-safe order:

1. delete `premium_meal_recipe_options` linked to `staging_seed_*` rows;
2. delete `premium_meal_slots`;
3. delete `premium_plan_days`;
4. delete recipe hints, steps, and ingredients;
5. delete Premium recipes;
6. delete Premium plans.

Cleanup must delete only `staging_seed_*` rows and must never delete non-seed staging rows.

## Risks

- This is test/staging catalog content, not production-quality nutrition content.
- The draft seeds only 2 days of a 14-day plan; this is enough for minimal staging/RLS and UI smoke support, but not a complete 14-day catalog.
- Idempotency depends on stable `staging_seed_*` titles and guarded child inserts; it will not repair arbitrary manual drift.
- A later owner-approved apply should capture before/after counts for preserved tables.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_MINIMAL_STAGING_SEED_DRAFT_REVIEW`.

Scope:

- review the seed draft before any staging apply;
- confirm 2 seeded days are sufficient for the next staging test step;
- confirm no production content naming is needed;
- only after owner approval, apply the seed to staging and validate counts.

## Verification

- `git diff --check`
  - Result: passed.
- Static safety grep
  - Result: no active writes found for `public.recipes`, `public.recipe_ingredients`, `public.food_diary_entries`, user Premium selection tables, Premium shopping tables, or AI/runtime tables.
- No Supabase SQL execution.
- No staging mutation.
- No production query.

## Final Verdict

**TODAY_PREMIUM_MINIMAL_STAGING_SEED_DRAFT_READY**
