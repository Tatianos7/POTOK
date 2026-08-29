# Today Premium Read-Only Runtime Final Status

- Date: 2026-08-29
- Branch: `master`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Verdict: **TODAY_PREMIUM_READ_ONLY_RUNTIME_FINAL_STATUS_READY**

## Final Verdict

The Premium read-only runtime block is implemented behind the staging read-only feature flag and is ready for the next owner decision.

The runtime remains no-write. Default behavior remains mock/demo. Live authenticated browser visual smoke and behavioral RLS verification are still pending before any production rollout decision.

## Implemented Commits

- `52cfdec today premium read only catalog service`
- `b2d8b16 today premium recipes read only staging integration`
- `5fce76c today premium today read only adapter`
- `d224c24 today premium today plan list detail read only integration`
- `35ff026 today premium today day meal detail read only integration`
- `c73a14b today premium today replacements read only integration`
- `5dfa520 today premium today shopping derived read only integration`
- `523c712 today premium read only runtime smoke review`
- `3dc94ce today premium read only flag visual smoke blocker`
- `e80b96e today premium read only flag visual smoke retry plan`

## What Is Implemented

Implemented read-only surfaces:

- `/premium-recipes` library can read Premium catalog recipes under the feature flag.
- `/premium-recipes` detail can read recipe ingredients, steps, and hints under the feature flag.
- `/today` plan list/detail can read active Premium catalog plans and returned plan days under the feature flag.
- `/today` day detail can read Premium meal slots under the feature flag.
- `/today` meal detail can read primary meal recipe details under the feature flag.
- `/today` replacements can read allowed catalog replacement options under the feature flag.
- `/today` shopping can build a derived, in-memory shopping list from Premium catalog data under the feature flag.
- Today adapter/mappers translate Premium catalog DTOs into current UI-compatible shapes.
- Existing mock/demo fallback remains available across the flow.

No user selection, diary, workout, recipe import, shopping persistence, AI runtime, or voice-input writes were enabled.

## Feature Flag Behavior

Feature flag:

```text
VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly
```

Behavior:

- without the flag, `/premium-recipes` and `/today` stay on existing mock/demo data;
- with the flag, the runtime attempts read-only catalog reads through `premiumCatalogService`;
- the UI does not import service-role keys or raw production config;
- auth, payment, entitlement, routes, dashboard cards, and paywall behavior are not changed by the flag;
- technical Supabase/service errors are not shown to users.

## Default / Fallback Behavior

Default:

- `/premium-recipes` uses mock recipe data;
- `/today` uses `demoPlans`, `buildDemoDays`, mock replacement options, and mock shopping groups;
- no Premium catalog service calls are expected in default mode.

Fallback:

- Supabase unavailable returns typed fallback results;
- read errors fall back to mock/demo data;
- empty catalog results fall back to mock/demo data;
- incomplete catalog detail falls back safely;
- shopping derived empty/error/unavailable falls back to mock shopping groups;
- replacements empty/error/unavailable fall back to mock replacement options;
- fallback avoids user-facing technical errors.

## Staging Data Dependency

The read-only runtime depends on staging catalog data and RLS visibility for:

- `premium_plans`;
- `premium_plan_days`;
- `premium_meal_slots`;
- `premium_recipes`;
- `premium_recipe_ingredients`;
- `premium_recipe_steps`;
- `premium_recipe_hints`;
- `premium_meal_recipe_options`.

Known staging caveats:

- only limited plan days have been seeded;
- staging content is not production-approved nutrition content;
- catalog visibility depends on staging RLS/auth session behavior;
- anon staging probe returned empty catalog counts in the previous smoke attempt.

## Visual Smoke Status

Static/source smoke and targeted tests passed.

Authenticated route-level browser visual smoke is still pending.

Current blocker:

- local Playwright Chromium failed before loading the app;
- protected routes require a staging-only authenticated session/test user;
- seeded catalog UI could not be visually confirmed through anon-only access.

Committed blocker/retry artifacts:

- `3dc94ce today premium read only flag visual smoke blocker`
- `e80b96e today premium read only flag visual smoke retry plan`

## External Blockers

Pending external prerequisites:

- browser-capable runner where Playwright Chromium launches;
- staging-only authenticated test user/session;
- owner-approved secure handling of any JWT/session material;
- staging RLS visibility for active Premium catalog rows;
- separate owner-approved elevated verification only if before/after write-table counts cannot be confirmed through read-only anon/authenticated access.

## No-Write Guarantees

Confirmed no-write boundaries:

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
- no production config/query;
- no Supabase SQL execution;
- no staging mutation.

The only shopping checked-state behavior remains local React state.

## Tests / Build Summary

Latest committed smoke review recorded:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result: passed, `49` tests.

```text
npx tsx --test src/pages/__tests__/PremiumRecipes.test.tsx
```

Result: passed, `9` tests.

```text
npx tsx --test src/services/__tests__/premiumCatalogService.test.ts
```

Result: passed, `4` tests.

```text
npx tsx --test src/services/__tests__/premiumTodayAdapter.test.ts
```

Result: passed, `9` tests.

```text
npm run build
```

Result: passed.

Known non-failing warnings:

- missing Vite Supabase env warning in local fallback-safe tests;
- React Router SSR `useLayoutEffect` warnings in static render tests;
- Vite/Browserslist/chunk-size warnings during build.

## Known Limitations

- Authenticated browser visual smoke is not complete.
- Behavioral RLS tests are still pending.
- User Premium selection writes are not enabled.
- Real shopping persistence is not enabled.
- Production rollout is not approved.
- Production catalog/content is not ready.
- Staging seed coverage is partial.
- Browser coverage is still weaker than targeted/source tests for async flag-enabled flows.

## What Must Not Be Done Next

Do not proceed with:

- production rollout;
- production config changes;
- Supabase SQL execution;
- staging mutation;
- service-role keys in frontend/browser env;
- user Premium selection writes;
- diary/workout writes;
- `public.recipes` writes;
- recipe import;
- shopping persistence;
- `premium_shopping_items`;
- `user_premium_shopping_checks`;
- AI runtime writes;
- voice input;
- broad refactors bundled with Premium read-only verification.

## Recommended Next Safe Steps

Option A: retry visual smoke with auth browser/session.

- Use a browser-capable runner.
- Use a staging-only authenticated test session.
- Keep `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`.
- Keep production excluded.
- Keep service-role keys out of frontend/browser env.

Option B: prepare mounted async/browser test package for flag-enabled flows.

- Add tests around effect resolution and fallback behavior.
- Cover `/premium-recipes`, `/today`, replacements, and derived shopping.
- Keep tests no-write and staging-independent unless explicitly approved.

Option C: return to behavioral RLS tests with secure env/test users.

- Use staging-only users.
- Verify catalog read visibility and user-selection isolation.
- Keep secrets out of reports/logs.
- Treat any elevated verification as a separate owner-approved step.

Option D: continue Premium UX polish while keeping read-only/no-write.

- Improve copy/layout or empty states without enabling writes.
- Keep feature flag behavior and fallback contracts intact.
- Keep production rollout blocked until visual smoke, RLS, and content readiness are complete.

## Verification

- `git diff --check`
  - Result: passed.
- No runtime code changes.
- No Supabase SQL execution.
- No staging mutation.
- No production query.
- No user/JWT/secrets collection.

## Final Verdict

**TODAY_PREMIUM_READ_ONLY_RUNTIME_FINAL_STATUS_READY**
