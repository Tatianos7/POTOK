# Today Premium Data Model SQL Hardening Review

- Date: 2026-08-23
- Branch: `master`
- Reviewed files:
  - `supabase/migration_drafts/today-premium-data-model-draft-2026-08-23.sql`
  - `reports/today-premium-data-model-sql-draft-review-2026-08-23.md`
  - `reports/today-premium-data-model-sql-draft-hardening-2026-08-23.md`
- Verdict: **REQUIRES_FIXES**

## Review Verdict

The hardening closed most first-review blockers: plan selections now bind goal ownership and active plans, and meal selections now check parent ownership, selected-plan slot membership, allowed recipe options, and active recipe intent.

One SQL-quality/RLS blocker remains before staging dry-run: the nested allowed-option predicate should explicitly qualify the outer `user_premium_meal_selections.premium_meal_slot_id` reference to avoid ambiguous name resolution.

## Blockers Remaining

1. `selected recipe allowed through premium_meal_recipe_options` is not fully safe as written.

Current predicate inside both insert/update policies:

- `where pmro.premium_meal_slot_id = premium_meal_slot_id`

Because the nested subquery includes `public.premium_meal_recipe_options pmro`, which also has a `premium_meal_slot_id` column, the unqualified right-hand side can resolve to the inner `pmro.premium_meal_slot_id`, making this comparison effectively self-referential. That would weaken the check to "recipe is allowed for some slot" instead of "recipe is allowed for this selected slot."

Required fix before staging:

- Qualify outer target-table columns in the nested exists:
  - `pmro.premium_meal_slot_id = public.user_premium_meal_selections.premium_meal_slot_id`
  - `pmro.premium_recipe_id = public.user_premium_meal_selections.selected_premium_recipe_id`
- Apply this to both insert and update `with check` policies.

No other critical blocker was found in this static review.

## RLS Hardening Review

`user_premium_plan_selections`:

- Insert/update now require `auth.uid() = user_id`: OK.
- Insert/update now require `user_goal_id is null or user_goal_id = auth.uid()`: OK.
- Insert/update now require an active referenced `premium_plans` row: OK.
- Select/delete remain own-row only: OK.
- Update `using` prevents editing rows not owned by current user: OK.

`user_premium_meal_selections`:

- Select/delete check ownership through parent selected plan: OK.
- Update `using` checks ownership of the existing row through parent selected plan: OK.
- Insert/update `with check` verify parent selected plan belongs to `auth.uid()`: OK.
- Insert/update verify meal slot belongs to selected Premium plan: OK.
- Insert/update allow `selected_premium_recipe_id is null` for clear-to-default: OK.
- Insert/update require selected recipe active when present: OK.
- Insert/update intended to require allowed option for this exact slot, but needs outer-column qualification: requires fix.

Catalog:

- Catalog rows remain readable only through active plan/recipe predicates: OK.
- No regular-user catalog mutation policies are present: OK.
- Future entitlement/payment enforcement is not mixed into this draft: OK.

## Product Edge Cases

- `selected_premium_recipe_id null` remains allowed and supports clear-to-default: OK.
- Inactive plan behavior remains an owner question:
  - current draft blocks creating/updating user selections to inactive plans;
  - historical behavior for already-selected plans needs owner approval before staging.
- One active plan per user remains enforced by partial unique index:
  - acceptable for MVP if owner confirms one active Premium plan at a time;
  - needs owner approval if multiple simultaneous plans are expected.
- Payment/entitlement is intentionally deferred:
  - authenticated catalog read remains separate from future subscription enforcement;
  - no payment/auth mutation is added here.

## SQL / Static Quality Notes

- Overall syntax shape looks valid for PostgreSQL/Supabase draft style.
- Idempotency pattern is preserved:
  - `create table if not exists`;
  - `create index if not exists`;
  - named check constraints through guarded `DO` blocks;
  - `drop policy if exists` + `create policy`;
  - `drop trigger if exists` + `create trigger`;
  - `begin;` / `commit;`.
- Optional shopping checks remain comment-only.
- No active references modify old user recipes, diary, payment/auth, workout, or AI surfaces.
- Static safety grep found old recipe/diary/payment/AI/shopping references only in comments and safety notes.
- Non-blocking: catalog policies are RLS-only. If staging later shows PostgREST permission issues, explicit grants may need review, but this is not a security blocker in the draft itself.

## Staging Dry-Run Readiness

**REQUIRES_FIXES** before staging dry-run.

After qualifying outer `user_premium_meal_selections` columns in the nested allowed-option check, the draft should be ready for another small static review and then a separately approved staging dry-run.

No Supabase connection was made and no migration was executed.

## Owner Approval Questions

- Keep one active Premium plan per user, or allow multiple active plan selections?
- Should users retain read/use access to already-selected plans if the catalog plan later becomes inactive?
- Should active catalog reads remain available to all authenticated users until the separate payment/auth phase?
- Should Premium recipe ingredients add `canonical_food_id` before first staging seed, or wait for content QA?
- Should selected day totals remain derived after replacements, or be stored as user-specific planned snapshots later?

## Verification

- `git diff --check`
  - Result: passed.
- Static safety grep
  - Result: old recipe/diary/payment/AI/shopping references are comments only.
- No Supabase connection.
- No migration execution.

## Next Recommended Step

Recommended next package: `TODAY_PREMIUM_DATA_MODEL_SQL_DRAFT_RLS_QUALIFY_FIX`.

Scope:

- Update only the SQL draft.
- Qualify outer `user_premium_meal_selections` columns in insert/update allowed-option predicates.
- Keep all table model, catalog RLS, nullable MVP fields, and safety boundaries unchanged.
- Run `git diff --check`.
- Do not apply the migration until a separate staging dry-run approval.

## Final Verdict

**REQUIRES_FIXES**
