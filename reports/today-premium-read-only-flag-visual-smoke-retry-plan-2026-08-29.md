# Today Premium Read-Only Flag Visual Smoke Retry Plan

- Date: 2026-08-29
- Branch: `master`
- Source blocker commit: `3dc94ce today premium read only flag visual smoke blocker`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Target package: `TODAY_PREMIUM_READ_ONLY_FLAG_VISUAL_SMOKE_RETRY_WITH_AUTH_BROWSER`
- Verdict: **TODAY_PREMIUM_READ_ONLY_FLAG_VISUAL_SMOKE_RETRY_PLAN_READY**

## Scope

Prepare a retry plan for Premium read-only flag visual smoke with an authenticated staging browser/session.

This is a plan/report only. No new visual smoke was run, no staging users were created, no JWT/secrets were collected, no runtime code was changed, no Supabase SQL was executed, staging was not mutated, production was not touched, no PR was created, and no commit/push work was done in this step.

## Blocker Summary

The previous flag visual smoke ended with **STAGING_EXTERNAL_BLOCKER**.

Blocking conditions:

- local Playwright Chromium failed before loading the app;
- `/today` and `/premium-recipes` are protected routes and require an authenticated staging session for route-level browser checks;
- staging anon read probe returned empty Premium catalog counts, so catalog-backed UI could not be visually confirmed through anon-only access;
- no staging user JWT/password/session was available for the visual smoke.

Non-blocking confirmations from the blocker attempt:

- local Vite app served under `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`;
- staging ref was confirmed as `ozidryfvhkcbtpnulakq`;
- production ref `dtsdnhbcwpbfrhcazqkb` was excluded;
- service-role keys were not passed to the frontend runtime env;
- targeted tests and production build passed.

## Retry Prerequisites

Required before retry:

- browser-capable runner where Playwright Chromium launches successfully;
- staging-only authenticated test user or pre-created staging session;
- `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`;
- `VITE_SUPABASE_URL` points to staging ref `ozidryfvhkcbtpnulakq`;
- `VITE_SUPABASE_ANON_KEY` is the staging anon key only;
- no service-role keys in frontend/browser env;
- production ref `dtsdnhbcwpbfrhcazqkb` excluded from local env and runner config;
- no SQL execution as part of the visual smoke;
- no staging writes during route interaction.

## Secure Env Rules

Frontend/browser env may include only:

```text
VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly
VITE_SUPABASE_URL=<staging Supabase URL for ozidryfvhkcbtpnulakq>
VITE_SUPABASE_ANON_KEY=<staging anon key>
```

Frontend/browser env must not include:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`;
- production `VITE_SUPABASE_URL`;
- production anon/service-role keys;
- user passwords;
- JWT values written to repo files;
- secrets in reports, logs, screenshots, or command transcripts.

If a local secure env file is used, verify it is ignored by git before placing secrets there.

## Auth / Session Requirements

Use a dedicated staging-only test user/session.

Requirements:

- user exists only in staging project `ozidryfvhkcbtpnulakq`;
- user is not a real customer account;
- user has enough access/session state to pass `ProtectedRoute`;
- user state is known before the run;
- user Premium selection rows are either absent before the run or counted before/after for verification;
- authentication artifacts remain in memory or local secure storage only;
- no JWT/password values are committed or copied into reports.

Acceptable session setup options:

- sign in manually in the browser on staging-only env and run the route checklist;
- inject a staging-only auth session into browser storage from a secure local secret manager;
- use an owner-approved local auth helper that obtains a session without printing tokens.

Do not create staging users, request OTPs, collect JWTs, or modify auth data inside this retry-plan package.

## Browser Runner Requirements

Runner must:

- launch Playwright Chromium successfully;
- capture screenshots or traces without exposing secrets;
- run against a local/preview app configured with staging-only Vite env;
- avoid service-role keys in the browser process;
- avoid production URLs in browser network requests;
- record route URL, visible surface, and disabled button state;
- record console/page errors while redacting tokens and URLs if needed.

Suggested preflight:

```text
node -e "require('playwright').chromium.launch({ headless: true }).then(b => b.close()).then(() => console.log('BROWSER_READY'))"
```

Proceed only if the browser preflight succeeds.

## Route Checklist

Run under `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly` with authenticated staging session.

`/premium-recipes` library:

- route opens after auth;
- recipe library is visible;
- staging recipes are visible if RLS exposes catalog rows;
- if catalog rows are unavailable, mock fallback remains usable;
- no technical errors are rendered.

`/premium-recipes` detail:

- recipe detail opens;
- nutrition, ingredients, steps, and hints render when service data is available;
- `Добавить в план` remains disabled/no-write;
- `Добавить в дневник` remains disabled/no-write.

`/today` plan list:

- route opens after auth;
- plan list is visible;
- staging plan is visible if RLS exposes active plan rows;
- if catalog rows are unavailable, `demoPlans` fallback remains usable;
- default copy/layout remains intact.

`/today` plan detail:

- plan detail opens;
- returned staging days render only as returned;
- day 1 and day 2 are visible when staging seed/RLS exposes them;
- days 3-14 are not presented as real DB data unless returned by the catalog;
- `Выбрать план` remains no-write.

`/today` day detail:

- day detail opens for returned staging day;
- meal slots render from staging when available;
- day macros render without layout breakage;
- `Подтвердить день` remains disabled/no-write;
- day state controls remain local-only.

`/today` meal detail:

- meal detail opens from staging meal slot;
- primary recipe detail loads through read-only catalog service;
- ingredients, steps, and hints render;
- incomplete/unavailable recipe data falls back safely;
- `Добавить в дневник` remains disabled/no-write.

`/today` replacements:

- replacements view opens;
- replacement options render from staging when available;
- empty/error/unavailable options fall back to mock replacement options;
- selection state remains local;
- apply replacement updates only local UI state;
- no `user_premium_meal_selections` write occurs.

`/today` shopping:

- shopping list opens;
- derived shopping groups render from staging when available;
- empty/error/unavailable derived shopping falls back to mock shopping groups;
- shopping period `1`, `2`, `3`, and `7` days remains usable;
- checkbox toggle updates only local UI state;
- no shopping persistence is created.

## No-Write Verification Plan

Before and after the browser smoke, compare counts for:

- `user_premium_plan_selections`;
- `user_premium_meal_selections`;
- `food_diary_entries`;
- `public.recipes`;
- `recipe_ingredients`.

Also verify absence or non-use of:

- `premium_shopping_items`;
- `user_premium_shopping_checks`.

Recommended read-only verification:

- use staging anon/authenticated read access where RLS permits;
- collect only counts and status, not row payloads with secrets or user data;
- record before/after deltas in the execution report;
- expected delta is `0` for every write/control table.

If elevated verification is required:

- treat it as a separate owner-approved step;
- do not include service-role keys in frontend/browser env;
- keep service-role use out of screenshots, logs, reports, and shell history;
- run only read-only count verification, not cleanup or mutation, unless separately approved.

## Fallback / Default Checklist

Flag enabled with authenticated staging session:

- staging catalog rows should be visible if RLS allows the test user to read active catalog data;
- if staging rows remain unavailable, the UI should fall back to mock/demo without technical errors.

Flag enabled with unavailable/empty catalog:

- `/premium-recipes` falls back to mock recipe library/detail behavior;
- `/today` falls back to `demoPlans` / `buildDemoDays`, mock replacements, and mock shopping groups as needed.

Without the flag:

- app remains mock/demo only;
- no Premium catalog service calls are expected from default mode;
- disabled/no-write action behavior remains unchanged.

## Risks

- Browser environment may still fail to launch Chromium unless retried on a browser-capable runner.
- Staging RLS/auth may still prevent catalog rows from being visible to the selected test user.
- Staging catalog has limited seeded content and may not represent final production nutrition copy.
- Authenticated visual smoke could create unrelated auth/session metadata outside Premium catalog scope; reports should separate auth setup from Premium no-write verification.
- Elevated count verification can expose sensitive privileges if not handled as a separate owner-approved step.

## Next Recommended Execution Step

Recommended next package: **TODAY_PREMIUM_READ_ONLY_FLAG_VISUAL_SMOKE_RETRY_EXECUTION_WITH_AUTH_BROWSER**.

Execution should:

- use a browser-capable runner;
- use a staging-only authenticated test session;
- run the route checklist under `VITE_PREMIUM_CATALOG_READ_MODE=staging_readonly`;
- verify before/after write-table counts with read-only queries;
- keep production excluded;
- keep service-role keys out of frontend/browser env;
- create a sanitized execution report with verdict:
  - `TODAY_PREMIUM_READ_ONLY_FLAG_VISUAL_SMOKE_READY`;
  - `REQUIRES_FIXES`;
  - or `STAGING_EXTERNAL_BLOCKER`.

## Verification

- `git diff --check`
  - Result: passed.
- No runtime code changes.
- No Supabase SQL execution.
- No staging mutation.
- No production query.
- No user/JWT/secrets collection.

## Final Verdict

**TODAY_PREMIUM_READ_ONLY_FLAG_VISUAL_SMOKE_RETRY_PLAN_READY**
