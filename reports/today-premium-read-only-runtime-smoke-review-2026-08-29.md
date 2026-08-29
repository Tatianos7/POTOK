# Today Premium Read-Only Runtime Smoke Review

- Date: 2026-08-29
- Branch: `master`
- HEAD: `5dfa520 today premium today shopping derived read only integration`
- Reviewed commits:
  - `b2d8b16 today premium recipes read only staging integration`
  - `d224c24 today premium today plan list detail read only integration`
  - `35ff026 today premium today day meal detail read only integration`
  - `c73a14b today premium today replacements read only integration`
  - `5dfa520 today premium today shopping derived read only integration`
- Verdict: **TODAY_PREMIUM_READ_ONLY_RUNTIME_SMOKE_REVIEW_READY**

## Verdict

The Premium read-only runtime flow is ready for the next owner commit/deploy decision.

No blocker was found. The reviewed surfaces keep mock/demo data as the default, use Premium catalog data only when `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`, fall back to mock/demo data on unavailable/error/empty reads, and preserve the no-write boundaries.

Readiness marker: **READY_FOR_PREMIUM_READ_ONLY_RUNTIME_COMMIT_DEPLOY_DECISION**.

## Reviewed Files

- `src/pages/PremiumRecipes.tsx`
- `src/pages/Today.tsx`
- `src/services/premiumCatalogService.ts`
- `src/services/premiumTodayAdapter.ts`
- `src/pages/__tests__/PremiumRecipes.test.tsx`
- `src/pages/__tests__/TodayPaidEntry.test.tsx`
- `src/services/__tests__/premiumCatalogService.test.ts`
- `src/services/__tests__/premiumTodayAdapter.test.ts`
- Premium read-only implementation and review reports from 2026-08-28 and 2026-08-29

Scope files checked for unexpected runtime changes:

- `src/App.tsx`
- `src/utils/constants.ts`
- SQL and seed paths

Existing unrelated dirty/untracked files remain outside this smoke review package.

## Surface Coverage

Confirmed reviewed read-only surfaces:

- `/premium-recipes` library uses the Premium catalog service only under the staging read flag and otherwise keeps mock data.
- `/premium-recipes` detail can load catalog recipe detail under the flag and keeps disabled add-to-plan/add-to-diary actions.
- `/today` plan list/detail can use catalog-backed plan data under the flag and keeps `demoPlans` / `buildDemoDays` by default.
- `/today` plan detail renders only returned catalog days; it does not synthesize days 3-14 as staging DB data.
- `/today` day detail can load catalog meal slots under the flag.
- `/today` meal detail can load primary meal recipe detail under the flag and map ingredients, hints, and steps through the Today adapter.
- `/today` replacements can load read-only catalog options under the flag while apply remains local-only.
- `/today` shopping can use derived read-only catalog shopping data under the flag while checkbox state remains local-only.

## Feature Flag / Fallback Review

Confirmed:

- default mode remains mock/demo for `/premium-recipes` and `/today`;
- staging reads are gated by `isPremiumCatalogStagingReadMode()`;
- staging mode requires `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`;
- disabled/read-failed/unavailable/empty catalog results fall back to existing mock/demo state;
- technical Supabase/service errors are caught and are not rendered to users;
- auth, payment, entitlement, routes, dashboard cards, and production config were not changed.

## No-Write Boundary Review

Confirmed:

- no `user_premium_plan_selections` writes;
- no `user_premium_meal_selections` writes;
- no `food_diary_entries` writes;
- no workout writes;
- no `public.recipes` writes;
- no `recipe_ingredients` writes;
- no recipe import;
- no shopping persistence;
- no `premium_shopping_items`;
- no `user_premium_shopping_checks`;
- no AI/runtime writes;
- no voice input;
- no production config or production query;
- no Supabase SQL execution;
- no staging mutation.

The reviewed runtime paths use the existing anon Supabase client through `premiumCatalogService` and keep catalog reads read-only.

## Source Guardrail Results

Static grep was run over:

- `src/pages/Today.tsx`
- `src/pages/PremiumRecipes.tsx`
- `src/services/premiumCatalogService.ts`
- `src/services/premiumTodayAdapter.ts`

Results:

- no `.insert(` calls found;
- no `.update(` calls found;
- no `.upsert(` calls found;
- no `.rpc(` calls found;
- no forbidden user selection, diary, workout, shopping persistence, AI, voice, service-role, or production paths found;
- no database `.delete(` calls found;
- one `.delete(` exists in `src/pages/Today.tsx` as local `Set.delete(productKey)` checkbox state only.

## Tests / Build Results

Today targeted test:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result: passed, `49` tests.

Premium recipes targeted test:

```text
npx tsx --test src/pages/__tests__/PremiumRecipes.test.tsx
```

Result: passed, `9` tests.

Catalog service targeted test:

```text
npx tsx --test src/services/__tests__/premiumCatalogService.test.ts
```

Result: passed, `4` tests.

Today adapter targeted test:

```text
npx tsx --test src/services/__tests__/premiumTodayAdapter.test.ts
```

Result: passed, `9` tests.

Build:

```text
npm run build
```

Result: passed.

Notes:

- Missing Vite Supabase env warning appeared in local tests and remains expected for fallback-safe mode.
- Existing React Router SSR `useLayoutEffect` warnings appeared in static render tests.
- Vite/Browserslist/chunk-size warnings appeared during build.
- No final test or build failure occurred.

Diff check:

```text
git diff --check
```

Result: passed.

## Risks / Limitations

- Staging still has limited seeded Premium plan data compared with a complete production-ready catalog.
- Staging copy/content can remain English/test-like and should not be treated as final nutrition content.
- User Premium selection writes are still intentionally blocked until a separate approved package and behavioral RLS checks.
- Shopping is derived in memory only; checked items are local UI state and are not synced.
- Existing smoke coverage is mostly targeted/static render coverage; mounted async browser coverage would harden the flag-enabled paths before a wider rollout.

## Blockers / Recommended Fixes

No blocker found.

Recommended but non-blocking:

- keep the feature flag opt-in until owner approval for broader staging rollout;
- add mounted async/browser tests for the full `/today` flag-enabled flow;
- keep write-path work separate from read-only catalog rollout;
- run a real staging env visual smoke when the owner is ready to exercise the flag against live staging data.

## Readiness For Commit / Deploy Decision

**READY_FOR_PREMIUM_READ_ONLY_RUNTIME_COMMIT_DEPLOY_DECISION**

The Premium read-only runtime flow can move to the next owner commit/deploy decision. It should not be bundled with Supabase SQL, staging mutation, production changes, user selection writes, diary/workout writes, recipe import, shopping persistence, AI runtime, or voice input.

## Final Verdict

**TODAY_PREMIUM_READ_ONLY_RUNTIME_SMOKE_REVIEW_READY**
