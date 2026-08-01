# GitHub Pages SPA Nested Route Fallback

- Timestamp: 2026-08-01T00:00:00Z
- Scope: audit/fix direct nested route 404 on GitHub Pages
- Production URL: `https://tatianos7.github.io/POTOK/`
- Verdict: **GITHUB_PAGES_SPA_FALLBACK_PRODUCTION_READY**

## Safety

- Runtime app routing was not changed.
- DB/schema/storage were not changed.
- Food Core, aliases, and Search Analytics data were not changed.
- No writes were made to `foods`.
- No writes were made to `food_aliases`.
- No aliases or foods were created.
- No import/backfill/recompute was run.
- No PR was created.

## Finding

Direct nested GitHub Pages routes returned HTTP `404`, for example:

- `/POTOK/nutrition`
- `/POTOK/nutrition/search`

Production response body was the app `index.html` copied into `404.html`:

- app root present: yes;
- main asset present: yes;
- route redirect shim: no.

Impact:

- A browser could show a GitHub Pages 404 state or fail to normalize direct nested routes reliably.
- The existing app startup logic in `src/main.tsx` expected `?p=...` redirect state, but production `404.html` did not provide it.

## Root Cause

`public/404.html` already contained the intended GitHub Pages SPA redirect shim:

- preserve nested path/query/hash;
- redirect to `/POTOK/?p=<encoded-route>`;
- let `src/main.tsx` restore the route with `history.replaceState`.

However, `scripts/create-github-pages-fallback.mjs` overwrote `dist/404.html` with a copy of `dist/index.html` during `postbuild`.

Therefore the correct `public/404.html` shim was not deployed.

## Fix

Updated `scripts/create-github-pages-fallback.mjs`:

- validates `dist/index.html` still exists;
- validates `public/404.html` exists and is a file;
- copies `public/404.html` into `dist/404.html`;
- no longer copies `dist/index.html` into `dist/404.html`.

Updated tests:

- `scripts/create-github-pages-fallback.test.mjs`
- verifies missing index failure;
- verifies missing fallback template failure;
- verifies `public/404.html` is copied to `dist/404.html`;
- verifies fallback keeps `/POTOK/` and `?p=` route preservation.

## Local Verification

Targeted tests:

- `npm run test:pages:fallback`: **PASS**, `6/6`.

Build:

- `npm run build`: **PASS**.

Generated `dist/404.html`:

- redirect shim present: **PASS**;
- `repoBase = '/POTOK/'`: **PASS**;
- app root copied into fallback: **NO**, expected.

Build notes:

- Existing browser data warnings were shown.
- Existing Vite dynamic-import/chunk-size warnings were shown.
- No build failure.

## Deploy

- Commit: `4542dfb1ea065a87ea1983c8a30d312c63106ea4`
- GitHub Pages run: `30714970759`
- Deploy status: **PASS**

## Production Verification

Direct route responses after deploy:

| Route | HTTP status | Expected body | Result |
| --- | ---: | --- | --- |
| `/POTOK/` | 200 | app index with main asset | **PASS** |
| `/POTOK/nutrition` | 404 | custom `404.html` redirect shim | **PASS** |
| `/POTOK/workouts` | 404 | custom `404.html` redirect shim | **PASS** |
| `/POTOK/progress/nutrition` | 404 | custom `404.html` redirect shim | **PASS** |
| `/POTOK/profile` | 404 | custom `404.html` redirect shim | **PASS** |
| `/POTOK/admin/search-review` | 404 | custom `404.html` redirect shim | **PASS** |

Expected:

- `/POTOK/` serves app index.
- Nested routes may still return HTTP `404` from GitHub Pages, but the body must be custom `404.html` with the redirect shim.
- In a browser, nested route direct open/refresh should redirect through `/POTOK/?p=...` and restore the intended SPA route.

## Final Status

The GitHub Pages SPA nested-route fallback fix is production-ready. Direct nested routes now receive the custom redirect fallback instead of a copied app index fallback, so browser direct open/refresh can return to the intended SPA route.

No data layer, Food Core, aliases, Search Analytics data, or DB/storage behavior was changed.
