# Food Search Browser Staging Smoke Report

- Timestamp: 2026-07-02T08:55:00Z
- Scope: browser-level read-only Food Core search smoke test
- Final verdict: **BROWSER_SEARCH_STAGING_PASS**
- Target environment: staging
- Target project ref: `ozidryfvhkcbtpnulakq`
- Production/current live ref: `dtsdnhbcwpbfrhcazqkb`

## Environment Safety

`.env.local` points Vite variables at the production/current project, so it was not used as-is for this browser smoke.

The smoke runner explicitly injected only:

- `VITE_SUPABASE_URL = STAGING_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY = STAGING_SUPABASE_ANON_KEY`

Service-role key was not passed into the browser environment.

Loaded browser project ref: `ozidryfvhkcbtpnulakq`.

Production requests detected: `0`.

Service-role exposure detected: `no`.

## Browser Launch

Command:

```bash
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm scripts/browser-smoke-food-search-staging.ts
```

Local URL:

```text
http://127.0.0.1:5178/__food-search-smoke
```

Browser engine used: `webkit`.

Chromium from the local Playwright cache crashed before page load with a native SIGSEGV, so the smoke runner fell back to WebKit. The WebKit run completed successfully.

Environment mode: Vite dev server with explicit staging anon env.

## Network Target Verification

| Check | Result |
| --- | --- |
| Browser loaded staging ref | `ozidryfvhkcbtpnulakq` |
| Production ref requests | 0 |
| Service-role key in browser requests | no |
| Supabase write requests | 0 |
| Failed network requests | 0 |
| Console errors | 0 |

Allowed read-only requests were made to staging Supabase only.

## UI Search Entry Point

Tested UI path:

```text
Vite smoke page
-> real ProductSearch component
-> real foodService.search()
-> public.foods
-> exact public.food_aliases.normalized_alias lookup
```

Protected diary route was not used because no safe authenticated staging user context was provided and no test user was created.

## Canonical Search Results

| Metric | Result |
| --- | ---: |
| Canonical UI tests passed | 10 |
| Canonical UI tests total | 10 |

Queries included:

`яйцо`, `молоко`, `кефир`, `творог`, `сыр`, `курица`, `гречка`, `рис`, `яблоко`, `картофель`.

Each query returned visible product cards with UUID-backed service results.

## Alias Search Results

| Metric | Result |
| --- | ---: |
| Alias UI tests passed | 10 |
| Alias UI tests total | 10 |

Required alias queries passed:

- `ацидофилин 0,1%`
- `ацидофилин 0.1%`
- `баклажаны по-корейски`
- `баклажаны по корейски`
- `кус-кус приготовленный`
- `кус кус приготовленный`
- `кефир 1,5%`
- `кефир 1.5%`
- `кофе по-венски`
- `кофе по венски`

Punctuation variants resolved to the same canonical UUID where paired.

## Unresolved Behavior

| Metric | Result |
| --- | ---: |
| Unresolved tests passed | 5 |
| Unresolved tests total | 5 |

Unknown queries returned empty UI/search results. No product was created.

## Ambiguous Manual Selection Behavior

| Metric | Result |
| --- | ---: |
| Ambiguous/manual selection tests passed | 5 |
| Ambiguous/manual selection tests total | 5 |

The search UI presents candidate lists and does not auto-select or auto-write. This is classified as `SEARCH_LIST_MANUAL_DISAMBIGUATION`, not a centralized resolver status flow.

## Selection Without Write

| Metric | Result |
| --- | ---: |
| Selection tests passed | 10 |
| Selection tests total | 10 |

For selected search results:

- `food.id` was UUID.
- `food.canonical_food_id` was UUID.
- `stable_food_id` was not used as runtime identity.
- name and macros rendered without blank cards.
- no final Add/Save/Confirm action was clicked.
- no DB write request was observed.

## Fiber Null Rendering

Browser UI did not crash and did not render `NaN`.

Follow-up fix completed:

- DB stores Food Core `fiber` as nullable.
- Runtime `foodService.mapSupabaseRowToFood` now preserves `fiber: null`.
- Browser selected Food Core objects now keep `fiber: null`.
- ProductCard does not display fiber, so no unknown fiber value is rendered as confirmed `0`.
- Dedicated regression: `reports/food-fiber-runtime-nullability-report.md`.

## Search Quality Findings

Broad query review:

| Query | Visible results | Classification |
| --- | ---: | --- |
| хлеб | 30 | ACCEPTABLE_WITH_RANKING_WARNING |
| кофе | 15 | ACCEPTABLE |
| чай | 23 | ACCEPTABLE_WITH_RANKING_WARNING |
| йогурт | 0 | MISSING_GENERIC_PRODUCT |
| сыр | 30 | OVER_SPECIFIC_RANKING |
| молоко | 30 | ACCEPTABLE |
| курица | 7 | ACCEPTABLE |
| рыба | 9 | ACCEPTABLE_WITH_RANKING_WARNING |
| рис | 24 | ACCEPTABLE |
| овсянка | 0 | MISSING_GENERIC_PRODUCT |

No duplicated canonical UUIDs were observed in tested visible result sets.

No technical `stable_food_id` or raw `normalized_name` leaked into visible UI text.

## Console And Network Findings

| Finding | Count |
| --- | ---: |
| Console errors | 0 |
| Console warnings during smoke | 0 |
| Failed network requests | 0 |
| 401/403 alias lookup failures | 0 |
| Production requests | 0 |
| Write requests | 0 |

## Post-Test DB Counts

Counts before and after browser smoke were identical:

| Table | Before | After |
| --- | ---: | ---: |
| public.foods | 2199 | 2199 |
| public.food_aliases | 3311 | 3311 |
| public.food_diary_entries | 0 | 0 |
| public.recipes | 0 | 0 |
| public.recipe_ingredients | 0 | 0 |
| public.favorite_products | 0 | 0 |

## Automated Browser Test Status

Automated browser smoke was added and executed:

- `scripts/browser-smoke-food-search-staging.ts`
- JSON artifact: `reports/food-search-browser-staging-smoke-result.json`

It starts a local Vite dev server with explicit staging anon env, opens a browser, blocks/records write requests, and fails on production requests or DB count changes.

## Tests And Build

Importer tests:

```bash
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm --test scripts/import-food-core.test.ts
```

Result: 22 passed, 0 failed.

Pure search smoke tests:

```bash
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm --test scripts/smoke-test-food-search-staging.test.ts
```

Result: 6 passed, 0 failed.

Build:

```bash
npm run build
```

Result: passed with existing Vite/browser-data/chunk-size warnings only.

## Blockers

No browser search blocker found.

Non-blocking follow-ups:

- Verify actual staging `food_diary_entries.fiber` schema before an approved diary write smoke.
- Improve ranking/generic coverage for `йогурт`, `овсянка`, and broad queries like `сыр`, `хлеб`, `чай`.
- A full authenticated diary UI smoke can be run later with an approved staging test user, still stopping before final save unless write testing is explicitly approved.

## Recommended Next Step

Proceed to a read-only resolver/ranking review for the broad query warnings, then plan a separate explicitly-approved diary write smoke if needed. Production rollout remains out of scope.
