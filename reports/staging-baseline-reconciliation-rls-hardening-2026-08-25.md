# Staging Baseline Reconciliation RLS Hardening

- Date: 2026-08-25
- Branch: `master`
- SQL draft updated: `supabase/migration_drafts/staging-baseline-reconciliation-draft-2026-08-25.sql`
- Source review: `reports/staging-baseline-reconciliation-draft-review-2026-08-25.md`
- Verdict: **STAGING_BASELINE_RECONCILIATION_RLS_HARDENING_READY**

## Scope

SQL draft hardening only.

No runtime code changes, production changes, staging schema mutation, Supabase SQL execution, Premium SQL re-apply, baseline migration apply, payment/auth changes, diary/workout writes, recipe import, AI runtime, voice input, commit, push, or PR work was done.

## What Was Fixed

The review blocker in recipe relation RLS was fixed.

Before hardening, the relation tables checked only:

```sql
auth.uid() = user_id
```

Now insert/update policies also require the referenced user recipe to belong to the authenticated user:

```sql
exists (
  select 1
  from public.recipes r
  where r.id = recipe_id
    and r.user_id = auth.uid()
)
```

## Policies Changed

`favorite_recipes`:

- kept `favorite_recipes_select_own`;
- removed/replaced historical `favorite_recipes_modify_own`;
- added `favorite_recipes_insert_own_recipe`;
- added `favorite_recipes_update_own_recipe`;
- added `favorite_recipes_delete_own`.

`recipe_collections`:

- kept `recipe_collections_select_own`;
- removed/replaced historical `recipe_collections_modify_own`;
- added `recipe_collections_insert_own_recipe`;
- added `recipe_collections_update_own_recipe`;
- added `recipe_collections_delete_own`.

## Why Parent Recipe Ownership Is Needed

`public.recipes` is a user-owned table through `recipes.user_id`.

Without checking parent recipe ownership, a user could create `favorite_recipes` or `recipe_collections` rows pointing to another user's recipe UUID. Even if later recipe reads are hidden by `public.recipes` RLS, the relation row itself would still be invalid user-owned state.

The hardened predicates keep relation rows bound to both:

- the authenticated user;
- a recipe owned by that same user.

## Safety Check

Confirmed by static review:

- Premium tables are not created;
- Premium SQL is not applied;
- production ref appears only in exclusion comments/report context;
- existing staging tables are not dropped or deleted;
- `public.recipes` is referenced only for FK/RLS ownership checks, not altered;
- `public.recipe_ingredients` is not altered;
- `public.food_diary_entries` is not altered;
- `premium_shopping_items` is not created;
- `user_premium_shopping_checks` is not created;
- no AI runtime records or columns are added.

## Readiness For Second Review

Ready for second static review before any staging apply.

Recommended review focus:

- verify insert/update predicates use the intended `recipe_id` relation row;
- verify delete remains own-row only;
- verify old `modify_own` policies are dropped for idempotent replacement;
- verify no Premium or production scope changes were introduced.

## Verification

- `git diff --check`
  - Result: pending after report creation.
- Static safety grep
  - Result: pending after report creation.
- No Supabase SQL execution.

## Final Verdict

**STAGING_BASELINE_RECONCILIATION_RLS_HARDENING_READY**
