# Today Premium Staging Schema Prerequisite Audit

- Date: 2026-08-25
- Branch: `master`
- Staging project ref used: `ozidryfvhkcbtpnulakq`
- Production project ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Basis:
  - `TODAY_PREMIUM_DATA_MODEL_STAGING_DRY_RUN_PLAN_READY`
  - `TODAY_PREMIUM_DATA_MODEL_SQL_RLS_QUALIFY_REVIEW_READY`
  - staging apply error: `ERROR: 42P01: relation "public.user_goals" does not exist`
- Verdict: **TODAY_PREMIUM_STAGING_SCHEMA_PREREQ_AUDIT_READY**

## Scope

Read-only audit of staging schema prerequisites after the Premium data model SQL draft failed on the missing `public.user_goals` relation.

No runtime code changes, production changes, Premium SQL re-apply, baseline migration apply, schema mutation, payment/auth changes, diary/workout writes, recipe import, AI runtime, voice input, commit, push, or PR work was done.

## Staging Confirmation

- Local Supabase linked ref: `ozidryfvhkcbtpnulakq`.
- Production ref `dtsdnhbcwpbfrhcazqkb` was not used for SQL execution.
- All Supabase queries in this audit were read-only and targeted the linked staging project.

## Found / Missing Tables On Staging

Current staging `public` tables:

- `favorite_products`
- `food_aliases`
- `food_diary_entries`
- `foods`
- `recipe_ingredients`
- `recipes`
- `user_profiles`

Prerequisite table check:

- `public.user_goals`: missing.
- `public.recipes`: exists.
- `public.recipe_ingredients`: exists.
- `public.food_diary_entries`: exists.
- `public.goal_trajectory`: missing.
- `public.progress_snapshots`: missing.
- `public.progress_trends`: missing.
- `public.measurement_history`: missing.
- `public.workout_entries`: missing.
- `public.workout_progress_observations`: missing.
- `public.premium_plans`: missing, expected after failed rolled-back apply.
- `public.premium_shopping_items`: missing, expected.
- `public.user_premium_shopping_checks`: missing, expected.

## Found Columns / Keys On Staging

`public.recipes` exists with user-owned recipe shape:

- PK: `id`.
- Key columns include `user_id`, `name`, `ingredients`, `total_calories`, `protein`, `fat`, `carbs`, `fiber`, `servings`, `yield_g`, `created_at`, `updated_at`.

`public.recipe_ingredients` exists:

- PK: `id`.
- FKs:
  - `recipe_id`;
  - `food_id`.
- Key columns include `recipe_id`, `food_id`, `amount_g`, `created_at`, `updated_at`.

`public.food_diary_entries` exists:

- PK: `id`.
- FK:
  - `canonical_food_id`.
- Key columns include `user_id`, `date`, `meal_type`, `product_name`, `protein`, `fat`, `carbs`, `calories`, `weight`, `canonical_food_id`, `base_unit`, `display_unit`, `display_amount`, `idempotency_key`, `created_at`, `fiber`.

`public.user_goals` columns/PK could not be inspected on staging because the table is absent.

## Local Schema Comparison

Local expected baseline defines `public.user_goals` in `supabase/schema.sql`:

- `user_id uuid primary key references auth.users(id) on delete cascade`;
- `calories integer not null`;
- `protein numeric(6,2) not null`;
- `fat numeric(6,2) not null`;
- `carbs numeric(6,2) not null`;
- `updated_at timestamptz not null default now()`;
- RLS enabled;
- own-row select/upsert policies.

Local follow-up schema expands `public.user_goals` in `supabase/phase9_goal_training_place.sql` with goal metadata:

- `goal_type`;
- `current_weight`;
- `target_weight`;
- `start_date`;
- `end_date`;
- `months_to_goal`;
- `bmr`;
- `tdee`;
- `training_place`;
- `gender`;
- `age`;
- `height`;
- `lifestyle`;
- `intensity`.

Local dependencies also reference `public.user_goals(user_id)`:

- `supabase/phase7_2_programs.sql` uses `goal_id uuid references public.user_goals(user_id)`;
- `src/services/goalService.ts` reads/writes `user_goals`;
- `src/services/programGenerationService.ts` reads `user_goals`;
- `src/services/uiRuntimeAdapter.ts` treats `user_goals` as a runtime data source.

The Premium SQL draft's FK to `public.user_goals(user_id)` is consistent with local expected schema and the previous SQL review finding that `user_goals.user_id` is the primary key.

## Root Cause

Staging is not synchronized with the current local expected baseline schema.

The staging database has a small nutrition/user profile subset, but it lacks the goal/progress/workout baseline tables expected by current app services and by the Premium data model draft.

The immediate apply failure happened because `user_premium_plan_selections.user_goal_id references public.user_goals(user_id)` was evaluated before `public.user_goals` existed on staging.

This does not indicate that `user_goals` was renamed on staging; no replacement goal table was found in the public schema. It is a missing prerequisite/baseline parity issue.

## Options

### Option A: Bring Staging To Current Baseline First

Apply the existing approved baseline schema/migrations to staging before retrying the Premium SQL draft.

Pros:

- Keeps Premium FK integrity exactly as reviewed.
- Makes staging closer to the app's expected runtime data model.
- Avoids weakening the Premium plan-to-goal relationship.
- Reduces future surprises for Goal/Today/Progress services.

Risks:

- Baseline schema apply may uncover older staging drift or migration ordering issues.
- Needs its own owner-approved staging plan and validation.
- Must be staged carefully because existing staging tables already exist.

Recommendation:

- This is the preferred path if staging is intended to represent the current app schema.

### Option B: Defer Premium Goal FK

Change the Premium SQL draft so `user_goal_id` is nullable without an immediate FK, then add the FK later after staging baseline parity is restored.

Pros:

- Allows Premium schema dry-run to proceed on the current minimal staging DB.
- Keeps the user-goal link optional for MVP/no-goal previews.

Risks:

- Weakens data integrity for the plan-to-goal relationship.
- Reopens RLS hardening questions around cross-user goal binding.
- Creates a follow-up migration obligation to restore the FK.
- Can hide the larger staging baseline mismatch.

Recommendation:

- Use only if owner explicitly wants Premium catalog tables tested independently from baseline parity.

### Option C: Add A Narrow Staging Prerequisite Migration

Create and apply a staging-only prerequisite migration for `public.user_goals` that matches the local baseline, then retry the Premium draft.

Pros:

- Minimal fix for the current blocker.
- Preserves the reviewed Premium FK.
- Faster than full baseline parity.

Risks:

- May create partial staging parity: `user_goals` exists, but related Goal/Progress/Workout dependencies still differ from local expectations.
- Phase 9 goal metadata would also need an explicit decision.
- Staging-only schema divergence can become confusing if not followed by full baseline reconciliation.

Recommendation:

- Acceptable only as a short staging unblocker if documented as temporary and followed by a full staging baseline audit.

## Recommended Fix Path

Recommended path: **Option A**, bring staging to the current approved baseline schema before retrying the Premium data model apply.

Reason:

- The problem is not isolated to one FK. Staging lacks multiple current app baseline tables, including `user_goals`, goal trajectory, progress-related tables, measurements history, and workout entries.
- The Premium draft's FK is correct for the local schema contract.
- Keeping the FK avoids weakening `Plan -> User Goal` integrity before the model has even reached staging validation.

If Option A is too broad for the next step, use Option C as a documented staging-only unblocker, not Option B.

## Do-Not-Do List

- Do not remove the `user_goals(user_id)` FK from the Premium draft as a blind fix.
- Do not manually create `public.user_goals` on staging outside an owner-approved prerequisite migration.
- Do not re-apply the Premium SQL draft until the prerequisite decision is made.
- Do not apply baseline migrations without a separate staging plan.
- Do not touch production project `dtsdnhbcwpbfrhcazqkb`.
- Do not store Premium recipes in `public.recipes`.
- Do not touch diary tables or create diary rows.
- Do not add `premium_shopping_items`.
- Do not add AI/runtime columns.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_STAGING_BASELINE_SCHEMA_AUDIT`.

Scope:

- compare staging public schema against the repo's current baseline schema and migrations;
- produce an ordered staging baseline reconciliation plan;
- identify which existing staging tables can be left as-is and which migrations need idempotent repair;
- do not mutate staging until owner approval.

After baseline parity is approved and applied on staging, rerun the Premium data model staging apply validation.

## Verification

- `git status` checked.
- Staging read-only introspection completed against `ozidryfvhkcbtpnulakq`.
- Local schema/migration references scanned.
- No production query was executed.
- `git diff --check` pending after report creation.

## Final Verdict

**TODAY_PREMIUM_STAGING_SCHEMA_PREREQ_AUDIT_READY**
