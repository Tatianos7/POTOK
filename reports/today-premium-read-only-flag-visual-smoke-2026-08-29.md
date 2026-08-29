# Today Premium Read-Only Flag Visual Smoke

- Date: 2026-08-29
- Branch: `master`
- Source commit: `523c712 today premium read only runtime smoke review`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Verdict: **STAGING_EXTERNAL_BLOCKER**

## Scope

Run a local/staging smoke check for the Premium read-only runtime flow under:

```text
VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly
```

This was a smoke/check-only task. No runtime code was changed, no Supabase SQL was executed, no staging mutation was performed, production was not touched, no user Premium selections, diary/workout writes, recipe import, shopping persistence, AI runtime, voice input, PR, commit, or push work was done.

## Env Mode Used

Attempted local Vite dev server with:

- `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`;
- `VITE_SUPABASE_URL` mapped from local staging-only `STAGING_SUPABASE_URL`;
- `VITE_SUPABASE_ANON_KEY` mapped from local staging-only `STAGING_SUPABASE_ANON_KEY`;
- staging ref confirmed as `ozidryfvhkcbtpnulakq`;
- production ref `dtsdnhbcwpbfrhcazqkb` was not used for this smoke attempt;
- service-role variables were removed from the Vite process environment before server launch.

The local app served successfully at:

```text
http://127.0.0.1:4175/
```

HTTP probes for `/`, `/today?demoGoal=1`, and `/premium-recipes` returned the Vite app shell.

## Surfaces Checked

Target surfaces requested:

- `/premium-recipes` library;
- `/premium-recipes` detail;
- `/today` plan list/detail;
- `/today` day detail;
- `/today` meal detail;
- `/today` replacements;
- `/today` shopping derived read-only;
- disabled/no-write actions;
- fallback/default mock mode.

The route-level browser visual portion could not be completed because Chromium failed before page load.

## Visual Smoke Result

Result: blocked by local browser environment.

Playwright Chromium failed during launch before loading the app:

```text
browserType.launch: Target page, context or browser has been closed
```

This matches the earlier local visual-smoke blocker pattern captured in prior Today Premium smoke work. Because the browser never reached the app, the requested route-level visual confirmations for `/premium-recipes` and `/today` could not be honestly marked as passed.

Additional access limitation:

- `/today` and `/premium-recipes` are protected routes.
- A full route-level staging visual smoke requires an authenticated staging session/test user.
- No staging user JWT/password/session was provided in this task.

## Staging Read-Only Probe Result

A read-only staging probe was run with the staging anon key only.

Mode:

```text
read-only select/count
```

Results:

- staging ref confirmed: `ozidryfvhkcbtpnulakq`;
- role used: anon;
- Premium catalog and control tables were queried with read-only count/select paths only;
- no SQL execution occurred;
- no service-role key was used.

Observed anon results:

- `premium_plans`: `0`;
- `premium_plan_days`: `0`;
- `premium_meal_slots`: `0`;
- `premium_recipes`: `0`;
- `premium_recipe_ingredients`: `0`;
- `premium_recipe_steps`: `0`;
- `premium_recipe_hints`: `0`;
- `premium_meal_recipe_options`: `0`;
- `user_premium_plan_selections`: `0`;
- `user_premium_meal_selections`: `0`;
- `food_diary_entries`: `0`;
- `recipes`: `0`;
- `recipe_ingredients`: read returned `401`;
- `premium_shopping_items`: read returned `204` with no count;
- `user_premium_shopping_checks`: read returned `204` with no count.

Interpretation:

- anon read access does not currently expose the seeded Premium catalog rows in this local staging probe;
- the frontend should therefore fall back to mock/demo data in this unauthenticated/anon condition;
- no user/write rows were created by this smoke attempt.

## Fallback / Default Mode Result

Default mock/demo behavior was confirmed by targeted tests rather than browser visual inspection because Chromium launch is blocked in this environment.

Confirmed by tests/source contracts:

- default `/premium-recipes` mode uses mock recipes and makes no catalog service call;
- default `/today` mode uses `demoPlans` / `buildDemoDays`;
- default replacement options remain mock;
- default shopping groups remain mock;
- fallback behavior remains mock/demo on unavailable, error, or empty catalog reads;
- technical Supabase/service errors are not rendered to users.

Because anon staging reads returned empty catalog counts, the expected flag-enabled behavior in this local unauthenticated context is fallback to mock/demo.

## No-Write Verification

Confirmed:

- no Supabase SQL execution;
- no staging mutation;
- no production query or production mutation;
- no service-role key in frontend runtime env;
- no user Premium selection write path exercised;
- no diary/workout write path exercised;
- no `public.recipes` write path exercised;
- no recipe import path exercised;
- no shopping persistence path exercised;
- no AI runtime path exercised;
- no voice input path exercised.

Control-table read-only probe did not show new rows through anon-visible counts for:

- `user_premium_plan_selections`;
- `user_premium_meal_selections`;
- `food_diary_entries`;
- `recipes`.

`recipe_ingredients` returned `401` under anon, and `premium_shopping_items` / `user_premium_shopping_checks` returned `204` with no count. No write verification with elevated privileges was performed because service-role usage and SQL execution were out of scope.

## Tests / Build Result

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

## Issues Found

Blocking for requested visual smoke:

- Playwright Chromium cannot launch in the current local environment.
- No authenticated staging session/test user is available for protected route visual checks.
- Staging anon read probe returned empty Premium catalog counts, so seeded catalog UI cannot be visually confirmed through anon-only access.

No application runtime blocker was proven by this attempt.

## Next Recommended Step

Recommended next package: **TODAY_PREMIUM_READ_ONLY_FLAG_VISUAL_SMOKE_RETRY_WITH_AUTH_BROWSER**.

Before retry:

- provide or prepare a staging-only authenticated test session;
- keep production ref `dtsdnhbcwpbfrhcazqkb` excluded;
- keep service-role keys out of the frontend environment;
- use a browser-capable local runner or CI visual-smoke environment where Playwright Chromium launches successfully;
- rerun the same `/premium-recipes` and `/today` route checklist under `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`.

## Final Verdict

**STAGING_EXTERNAL_BLOCKER**
