# Food Search Resolver Staging Smoke Report

- Timestamp: 2026-07-02T08:20:00Z
- Scope: Food Core staging search/resolver read-only smoke test
- Target environment: staging
- Target project ref: `ozidryfvhkcbtpnulakq`
- Production/current live project ref: `dtsdnhbcwpbfrhcazqkb`
- Final verdict: **SEARCH_RESOLVER_PARTIAL_PASS**

## Safety

- Food Core apply was not run.
- SQL was not executed.
- DB writes were not performed.
- Production was not used.
- Staging foods were not changed.
- Staging aliases were not changed.
- Excel was not changed.
- Diary was not changed.
- Recipes were not changed.
- Favorites were not changed.
- Cleanup/delete/truncate was not performed.

## Current Staging State

| Table | Count |
| --- | ---: |
| public.foods | 2199 |
| public.food_aliases | 3311 |
| public.food_diary_entries | 0 |
| public.recipes | 0 |
| public.recipe_ingredients | 0 |
| public.favorite_products | 0 |

Data integrity:

| Check | Count |
| --- | ---: |
| Food identity violations | 0 |
| Alias integrity violations | 0 |
| Orphan alias targets | 0 |

Alias coverage:

| Bucket | Foods |
| --- | ---: |
| Without aliases | 0 |
| 1 alias | 1204 |
| 2-5 aliases | 995 |
| More than 5 aliases | 0 |
| Max aliases for one food | 5 |

Foods with maximum alias coverage include `egg_chicken`, `chicken_breast`, `chicken_fillet`, `tomato`, `potato`, `cucumber`, and `apple`.

## Actual Search Architecture

| Context | Entry component/service | DB source | Alias-aware | Resolver-aware | Visibility-aware |
| --- | --- | --- | --- | --- | --- |
| diary | `FoodSearch` -> `ProductSearch` -> `foodService.search` | `foods`, `food_aliases` | yes, exact `normalized_alias` lookup | partially, selected `Food` carries UUID `canonical_food_id` | yes for own user foods; public core/brand |
| add modal | `AddFoodToMealModal` | selected `Food` object | inherited from search | yes, submit requires UUID `canonical_food_id` or UUID `id` | n/a |
| favorites | `favoritesService.resolveCanonicalFavoriteId` -> `foodService.search` fallback | `foods`, `food_aliases` through search | yes through search fallback | partially, picks exact/first UUID | yes for own favorites/user foods |
| recipe ingredient | `recipesService.resolveCanonicalFoodId` | `foods.normalized_name`, `food_aliases.normalized_alias` | yes | partially, returns UUID or null | not user-scoped in resolver helper |
| custom food precheck | `foodService.search` paths | `foods`, local user foods | yes through public search | no explicit ambiguity contract | own user foods only when userId present |
| import precheck | `scripts/import-food-core.ts` | `foods`, `food_aliases` | yes, DB-normalized aliases | yes for stable id -> UUID mapping | staging service-role only |

Main runtime search path: `foodService.search()`.

Static findings:

- Runtime search uses `public.food_aliases` by querying `.eq('normalized_alias', normalizeFoodText(query))`.
- Runtime search returns `Food.id` and `Food.canonical_food_id` UUIDs from `public.foods`.
- `stable_food_id` is not part of frontend runtime identity; it remains import/semantic identity.
- Recipe ingredient resolver also uses aliases, but only `limit(1)` and has no explicit ambiguity status.
- There is no fully centralized resolver returning `resolved | ambiguous | unresolved` across all runtime paths.
- `foodService.mapSupabaseRowToFood` maps `fiber: null` to `0` in runtime `Food`; this is a nutrition-display semantics warning, not a search resolver blocker.

## Resolver Contract

Observed runtime support:

| Requirement | Status |
| --- | --- |
| deterministic lookup | partial |
| no guessing | partial |
| no auto-create on unresolved | yes in search path |
| no write on ambiguous | static yes for search; no explicit ambiguity object |
| no write on unresolved | diary write path requires UUID canonical id |
| core/brand + own user foods only | yes in `foodService.search` |
| foreign user foods hidden | static yes where `userId` is used |
| alias resolves to UUID canonical food | yes |
| returned `stable_food_id` | no runtime contract |
| statuses `resolved/ambiguous/unresolved` | DB smoke only; not centralized in runtime |

Diary write static readiness: **DIARY_WRITE_READY_FOR_MANUAL_SELECTION**, because `FoodSearch`/`AddFoodToMealModal` require a UUID canonical id before write. No diary insert was executed.

## Smoke Test Matrix

Read-only script: `scripts/smoke-test-food-search-staging.ts`.

Matrix result:

| Category | Total | Passed | Failed |
| --- | ---: | ---: | ---: |
| Exact canonical name | 10 | 10 | 0 |
| Normalized punctuation/case variation | 10 | 10 | 0 |
| Alias exact match | 10 | 10 | 0 |
| Alias punctuation equivalents | 16 | 16 | 0 |
| Short/common alias | 5 | 5 | 0 |
| Misspelling probes | 5 | 5 | 0 |
| Unknown query | 5 | 5 | 0 |
| Ambiguity candidates | 5 | 5 | 0 |
| Total | 66 | 66 | 0 |

DB-level result: **PASS**.

Runtime service result: **not executed end-to-end**. The actual browser service depends on Vite `import.meta.env`, singleton Supabase client, and localStorage cache writes. Runtime architecture was audited statically and matched the DB-level alias contract.

DB/runtime mismatch count: `0 observed`, but full browser runtime comparison remains **not tested**.

## Required Alias Punctuation Tests

All required punctuation pairs resolved to the same canonical UUID/stable target with no ambiguity:

| Input pair | Result |
| --- | --- |
| `ацидофилин 0,1%` / `ацидофилин 0.1%` | `acidophilus_0_1` |
| `ацидофилин 3,2%` / `ацидофилин 3.2%` | `acidophilus_3_2` |
| `баклажаны по-корейски` / `баклажаны по корейски` | `korean_style_eggplant` |
| `кус-кус приготовленный` / `кус кус приготовленный` | `cooked_couscous` |
| `булочки для хот-догов` / `булочки для хот догов` | `hot_dog_buns` |
| `кефир 1,5%` / `кефир 1.5%` | `kefir_1_5` |
| `кофе по-венски` / `кофе по венски` | `viennese_coffee` |
| `копчёно-варёная грудинка` / `копчёно варёная грудинка` | resolved consistently |

## Search Quality Audit

20 common queries were checked for top 10 DB-level results:

`яйцо`, `молоко`, `кефир`, `творог`, `сыр`, `курица`, `гречка`, `рис`, `овсянка`, `яблоко`, `банан`, `хлеб`, `картофель`, `помидор`, `огурец`, `кофе`, `чай`, `рыба`, `говядина`, `йогурт`.

Summary:

- Most core queries had relevant top results.
- No technical/service names were observed in top results.
- No exact duplicate result rows were observed in the smoke script.
- Potential ranking warning: broad queries such as `хлеб`, `кофе`, `чай`, and `йогурт` return many specific products above a generic/base product when no exact base row exists in the imported catalog.
- Classification: **ACCEPTABLE_WITH_RANKING_WARNINGS**.

## Visibility/RLS

Read-only visibility check:

| Role/key | foods visible | aliases visible | Error |
| --- | ---: | ---: | --- |
| staging service-role | 2199 | 3311 | none |
| staging anon | 2199 | 3311 | none |

Authenticated visibility: `AUTHENTICATED_VISIBILITY_NOT_TESTED`, because no safe existing staging user context was provided and no test user was created.

RLS verdict: **PASS_FOR_PUBLIC_CORE_READS**.

## Tests

Importer tests:

```bash
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm --test scripts/import-food-core.test.ts
```

Result: 22 passed, 0 failed.

Search smoke pure tests:

```bash
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm --test scripts/smoke-test-food-search-staging.test.ts
```

Result: 6 passed, 0 failed.

Read-only staging smoke:

```bash
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm scripts/smoke-test-food-search-staging.ts
```

Result: 66 smoke cases passed, 0 failed.

## Build

```bash
npm run build
```

Result: passed.

Warnings only:

- baseline-browser-mapping data is old.
- browserslist/caniuse-lite data is old.
- existing Vite dynamic/static import warnings.
- existing large chunk warning.

## Blockers

No DB-level blocker was found.

Runtime gaps to address before full pass:

- No centralized runtime resolver object with explicit `resolved | ambiguous | unresolved` status.
- Browser `foodService.search()` was not executed end-to-end in this smoke step.
- Runtime maps nullable DB `fiber` to `0` in `mapSupabaseRowToFood`; this should be reviewed separately because it weakens the nullable fiber semantics in display/service objects.

## Recommended Next Step

Run a browser-level staging smoke test with Vite configured to staging anon env, exercising `ProductSearch` / `foodService.search()` directly from the app UI for representative canonical, alias, punctuation, unknown, and broad queries. Keep it read-only and do not create diary entries.
