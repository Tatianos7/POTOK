# Today Premium Minimal Staging Seed Draft Review

- Date: 2026-08-27
- Branch: `master`
- Reviewed files:
  - `supabase/seed_drafts/today-premium-minimal-staging-seed-draft-2026-08-26.sql`
  - `reports/today-premium-minimal-staging-seed-draft-2026-08-26.md`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Verdict: **TODAY_PREMIUM_MINIMAL_STAGING_SEED_DRAFT_REVIEW_READY**

## Verdict

The minimal Premium staging seed draft is ready for a separately owner-approved staging seed apply.

No blocker was found. The draft is scoped to staging, seeds only Premium catalog tables with `staging_seed_*` markers, avoids user selections and legacy recipe/diary surfaces, and includes validation plus comment-only cleanup instructions.

Readiness marker: **READY_FOR_OWNER_APPROVED_STAGING_SEED_APPLY**.

## Scope Review

Confirmed:

- draft is explicitly staging-only for `ozidryfvhkcbtpnulakq`;
- production ref `dtsdnhbcwpbfrhcazqkb` appears only in exclusion notes;
- no runtime code is changed;
- no Supabase SQL was executed during this review;
- no staging mutation was performed during this review;
- no active writes to `public.recipes`;
- no active writes to `public.recipe_ingredients`;
- no active writes to `public.food_diary_entries`;
- no user Premium selections are created;
- no shopping source-of-truth table/rows are created;
- no AI/runtime rows are created.

## Seed Content Review

Confirmed:

- 1 active Premium plan is seeded:
  - `staging_seed_weight_loss_14_day_test_plan`;
  - `goal_type = 'weight_loss'`;
  - `duration_days = 14`;
  - `is_active = true`.
- 2 plan days are seeded:
  - day 1;
  - day 2.
- meal slots include breakfast, lunch, dinner, and snack for both seeded days.
- 6 Premium recipes are seeded:
  - protein oats;
  - egg plate;
  - chicken bowl;
  - turkey wrap;
  - salmon plate;
  - yogurt berries.
- every recipe has ingredients.
- every recipe has two preparation steps.
- every recipe has a no-scale portion hint.
- every meal slot has a primary option and one replacement option.

The content is clearly staging/test-labeled and does not look like final production catalog naming.

## Idempotency Review

Generally OK:

- the plan is found by stable `staging_seed_*` title before insert;
- recipes are found by stable `staging_seed_*` title before insert;
- plan days are guarded by `(premium_plan_id, day_number)`;
- meal slots are guarded by `(premium_plan_day_id, sort_order)`;
- ingredients are guarded by `(premium_recipe_id, ingredient_name)`;
- steps are guarded by `(premium_recipe_id, step_number)`;
- hints are guarded by `(premium_recipe_id, hint_text)`;
- meal recipe options are guarded by `(premium_meal_slot_id, premium_recipe_id)`;
- no destructive active cleanup is included.

Non-blocking note:

- if staging already contains manually duplicated `staging_seed_*` plan/recipe titles, the draft selects one row with `limit 1` and does not repair drift. That is acceptable for a seed draft, but the apply report should validate counts after execution.

## Schema Compatibility Review

Compatible with the applied Premium data model draft:

- `premium_plans` columns used by the seed exist.
- `duration_days = 14` satisfies the positive duration check.
- `premium_plan_days` columns used by the seed exist.
- `day_number` values `1` and `2` satisfy the positive day check and should not conflict with the unique `(premium_plan_id, day_number)` index on rerun.
- `premium_meal_slots` columns used by the seed exist.
- `meal_type` values `breakfast`, `lunch`, `dinner`, and `snack` satisfy the meal type check.
- meal slot `sort_order` values are unique within each seeded day.
- `premium_recipes` columns used by the seed exist.
- recipe titles are non-blank and cooking times are positive.
- ingredient amounts are positive and compatible with `numeric(10,2)`.
- recipe step numbers are positive and unique per seeded recipe.
- hint text is non-blank.
- `premium_meal_recipe_options` columns used by the seed exist.
- `option_type` values `primary` and `replacement` are compatible with the current free-form MVP column.
- meal recipe options avoid duplicate `(premium_meal_slot_id, premium_recipe_id)` pairs.

This draft does not rely on user-owned selection tables and does not require test users/JWTs.

## Cleanup Review

Cleanup is comment-only and FK-safe for seed-only cleanup:

1. delete `premium_meal_recipe_options`;
2. delete `premium_meal_slots`;
3. delete `premium_plan_days`;
4. delete recipe hints;
5. delete recipe steps;
6. delete recipe ingredients;
7. delete Premium recipes;
8. delete Premium plans.

Confirmed:

- cleanup targets `staging_seed_*` rows only;
- cleanup does not actively execute as part of the seed;
- cleanup does not delete non-seed staging rows;
- cleanup does not delete user Premium selections.

Non-blocking caution:

- if this seed is later used by user selection/RLS tests, selection rows must be cleaned first in that execution package before seed catalog cleanup is attempted.

## Validation Review

Validation SQL is sufficient for a first staging seed apply report:

- counts seeded Premium catalog rows by table;
- confirms the 14-day active plan row;
- confirms at least the 2 seeded plan days;
- groups seeded meal slots by meal type;
- checks user Premium selection tables remain empty;
- checks `public.recipes`, `public.recipe_ingredients`, and `public.food_diary_entries` row counts.

Recommended for apply report:

- capture preserved table counts before and after seed apply;
- record whether `user_premium_plan_selections` and `user_premium_meal_selections` were `0` before apply as well as after apply;
- keep validation output sanitized and staging-only.

## Risks / Product Notes

- Two seeded days are enough for minimal staging smoke/RLS support, but not enough for full 14-day user experience validation.
- English staging labels are acceptable now because the seed is test-only and intentionally not production content.
- More replacement options should be added before real UI/content integration if the Premium UX expects richer substitutions.
- Nutrition values are suitable for staging test shape, not production nutrition approval.

## Blockers / Recommended Fixes

No blocker found.

Recommended but non-blocking before apply:

- confirm owner accepts the minimal 2-day seed inside a 14-day plan;
- confirm seed should remain English/test-labeled for staging;
- decide whether the apply report should include before/after counts for all preserved baseline tables.

## Staging Apply Readiness

**READY_FOR_OWNER_APPROVED_STAGING_SEED_APPLY**

The seed draft can be applied to staging only in a separate explicit owner-approved task. It must not be applied to production and must not be bundled with runtime UI changes.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_MINIMAL_STAGING_SEED_APPLY`.

Scope:

- apply only `supabase/seed_drafts/today-premium-minimal-staging-seed-draft-2026-08-26.sql` to staging ref `ozidryfvhkcbtpnulakq`;
- confirm production ref `dtsdnhbcwpbfrhcazqkb` is not linked or used;
- validate Premium catalog counts and preserved legacy table counts;
- keep user selection tables empty unless a later RLS test package explicitly creates test selections.

## Verification

- `git diff --check`
  - Result: passed.
- Static safety grep
  - Result: passed; no active forbidden writes found for `public.recipes`, `public.recipe_ingredients`, `public.food_diary_entries`, user Premium selection tables, Premium shopping tables, or AI/runtime tables.
- No Supabase SQL execution.
- No staging mutation.
- No production query.

## Final Verdict

**TODAY_PREMIUM_MINIMAL_STAGING_SEED_DRAFT_REVIEW_READY**
