# Food Diary Snapshot Schema Contract Audit

- Timestamp: 2026-07-03T00:00:00Z
- Scope: audit canonical diary write payload against staging `public.food_diary_entries`
- Target environment: staging
- Target project ref: `ozidryfvhkcbtpnulakq`
- Production/current live ref: `dtsdnhbcwpbfrhcazqkb`
- Final verdict: **DIARY_SCHEMA_PATCH_DRAFT_READY**

## Safety

- SQL was not executed.
- Staging DB was not changed.
- Production was not used.
- Diary write was not run.
- Food Core apply was not run.
- Foods and aliases were not changed.
- Recipes, recipe_ingredients, and favorite_products were not changed.
- Excel was not changed.
- Fiber `NULL` was not replaced with `0`.

## Actual Write Path

Canonical UI write flow:

```text
AddFoodToMealModal / FoodSearch selection
-> mealService.addMealEntry(...)
-> mealService.toDiaryCreateRequest(...)
-> mealService.createDiaryEntryWithEnforcement(...)
-> DiaryCreateService.create(...)
-> buildDiaryInsertPayload(...)
-> getDiaryRepositories().diaryRepo.insert(...)
-> supabase.from('food_diary_entries').insert(payload)
```

Read-before-write idempotency lookup:

```text
getDiaryRepositories().diaryRepo.findByUserAndIdempotencyKey(...)
-> select id,user_id,date,meal_type,canonical_food_id,product_name,weight,calories,protein,fat,carbs,fiber,idempotency_key,created_at
```

Canonical food source for snapshot:

```text
getDiaryRepositories().foodsRepo.findById(...)
-> public.foods(id, canonical_food_id, source, created_by_user_id, calories, protein, fat, carbs, fiber)
```

No RPC is used by the current canonical diary create path.

## Payload Contract

`DiaryInsertPayload` currently sends 15 fields.

| payload field | source | TS type | can be null | DB column | DB type observed | DB nullable | DB default | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| user_id | DiaryInsertPayload.user_id | string UUID | no | user_id | uuid | no | none | MATCH |
| date | DiaryInsertPayload.date | YYYY-MM-DD string | no | date | date | no | none | MATCH |
| meal_type | DiaryInsertPayload.meal_type | meal enum | no | meal_type | text | no | none | MATCH |
| canonical_food_id | DiaryInsertPayload.canonical_food_id | string UUID | no | canonical_food_id | uuid | yes | none | MATCH |
| product_name | DiaryInsertPayload.product_name | string | no | product_name | text | no | none | MATCH |
| weight | DiaryInsertPayload.weight | number | no | weight | numeric | no | 0 | MATCH |
| calories | calculateDiarySnapshot.calories | number | no | calories | numeric | no | 0 | MATCH |
| protein | calculateDiarySnapshot.protein | number | no | protein | numeric | no | 0 | MATCH |
| fat | calculateDiarySnapshot.fat | number | no | fat | numeric | no | 0 | MATCH |
| carbs | calculateDiarySnapshot.carbs | number | no | carbs | numeric | no | 0 | MATCH |
| fiber | calculateDiarySnapshot.fiber | number \| null | yes | fiber | missing | n/a | n/a | MISSING_COLUMN |
| idempotency_key | DiaryInsertPayload.idempotency_key | string \| null | yes | idempotency_key | text | yes | none | MATCH |
| base_unit | DiaryInsertPayload.base_unit | string | no | base_unit | text | yes | г | MATCH |
| display_unit | DiaryInsertPayload.display_unit | string \| null | yes | display_unit | text | yes | г | MATCH |
| display_amount | DiaryInsertPayload.display_amount | number \| null | yes | display_amount | numeric | yes | none | MATCH |

DB-generated/read fields:

| field | DB type observed | nullable | default | status |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | MATCH |
| created_at | timestamptz | no | now() | MATCH |

## Actual Staging Schema

Observed through read-only PostgREST OpenAPI for project `ozidryfvhkcbtpnulakq`:

| column | type | nullable | default |
| --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | none |
| date | date | no | none |
| meal_type | text | no | none |
| product_name | text | no | none |
| protein | numeric | no | 0 |
| fat | numeric | no | 0 |
| carbs | numeric | no | 0 |
| calories | numeric | no | 0 |
| weight | numeric | no | 0 |
| canonical_food_id | uuid | yes | none |
| base_unit | text | yes | г |
| display_unit | text | yes | г |
| display_amount | numeric | yes | none |
| idempotency_key | text | yes | none |
| created_at | timestamptz | no | now() |

Read-only select probe result:

```text
42703: column food_diary_entries.fiber does not exist
```

## Mismatches

| category | count | details |
| --- | ---: | --- |
| Missing columns | 1 | `fiber` |
| Type mismatches | 0 | none observed |
| Nullability mismatches | 0 | none observed, after `fiber` is added nullable |
| Default semantic mismatches | 0 | none observed in current schema because `fiber` is absent |
| Constraint/FK blockers | 0 | `canonical_food_id` is UUID-compatible; FK details require manual catalog validation |
| RLS/auth blockers | 0 observed | source draft uses own-row RLS; authenticated insert must be tested later with approved staging user |

## Snapshot Semantics

Confirmed target contract:

- Diary rows store immutable nutrition snapshots at write time.
- Later changes to `public.foods` must not recalculate historical diary rows automatically.
- `calories`, `protein`, `fat`, and `carbs` are required numeric snapshots for canonical food entries.
- `fiber` is numeric nullable and has no default.
- `fiber = NULL` means the source did not provide a reliable fiber value.
- `fiber = 0` means confirmed zero fiber.
- Scaling preserves unknown fiber:

```ts
fiber: food.fiber == null ? null : round2(food.fiber * weightG / 100)
```

- `canonical_food_id` is a UUID and required by the canonical food write service.
- Recipe/legacy rows may use `canonical_food_id = null` only through explicit recipe/legacy flows.
- Ambiguous and unresolved resolver results are rejected before insert.
- `idempotency_key` protects replay of the same logical create request.

## Blocker Classification

| blocker | classification | required now |
| --- | --- | --- |
| `food_diary_entries.fiber` missing | WRITE_BLOCKER and DATA_SEMANTICS_BLOCKER | yes |

No other immediate canonical write blocker was found in the observed PostgREST schema.

## Required Now

Add exactly one diary snapshot column:

```sql
fiber numeric(8,2)
```

Rationale:

- Existing diary snapshot macros use `numeric(8,2)`.
- `DiaryCreateService.calculateDiarySnapshot` rounds to two decimals.
- The column must be nullable.
- The column must not have `DEFAULT 0`.

## Deferred Hardening

These are not required for the next controlled diary write smoke:

- Catalog-level validation of FK names, check constraints, indexes, triggers, and RLS policies through manual SQL validation queries.
- Production/source schema decision for legacy `fiber not null default 0`.
- Resolver audit fields such as `canonical_resolution_source`, `canonical_resolution_status`, or confidence fields.
- Stronger DB check for `weight > 0`.
- Explicit recipe `entry_kind` contract.
- Full authenticated RLS write smoke with an approved staging user.

## SQL Draft

Created:

```text
scripts/sql/staging-align-food-diary-snapshot-contract-draft.sql
```

The draft:

- validates `public.food_diary_entries` exists;
- validates `calories`, `protein`, `fat`, and `carbs` exist and are numeric-compatible;
- validates `public.foods.id` is UUID;
- validates `food_diary_entries.canonical_food_id`, when present, is UUID;
- validates existing `food_diary_entries.fiber`, if present, is numeric-compatible, nullable, and has no default;
- adds only `fiber numeric(8,2)` if missing;
- does not insert, update, backfill, delete, truncate, or recreate any table;
- reloads PostgREST schema cache.

## Full Staging Schema Draft

Updated:

```text
scripts/sql/staging-schema-setup-draft.sql
```

New clean staging setup now creates:

```sql
fiber numeric(8,2)
```

inside `public.food_diary_entries`, with no `NOT NULL` and no default.

## Source Schema Mismatches

Legacy/source files that still contain incompatible or incomplete diary fiber contract:

| file | status |
| --- | --- |
| `supabase/schema.sql` | `food_diary_entries.fiber numeric(8,2) not null default 0` |
| `supabase/schema_fixed.sql` | `food_diary_entries.fiber` absent |
| `supabase/food_kb_2_1.sql` | adds `food_diary_entries.fiber numeric(8,2) not null default 0` |
| `supabase/food_ingestion_schema.sql` | recompute path uses `fiber` and legacy `coalesce`-style semantics |

These were not changed automatically because production migration policy is a separate decision.

## Preflight Checker

Created:

```text
scripts/check-diary-schema-contract-staging.ts
scripts/check-diary-schema-contract-staging.test.ts
```

Checker contract:

- requires staging target;
- requires project ref `ozidryfvhkcbtpnulakq`;
- blocks production ref `dtsdnhbcwpbfrhcazqkb`;
- performs read-only OpenAPI/schema fetch;
- performs read-only select probe;
- does not call insert/update/delete/upsert;
- returns all blockers it can observe.

Current staging result before manual patch:

```text
DIARY_SCHEMA_CONTRACT_FAIL
blocker: food_diary_entries.fiber missing
select probe: 42703 column food_diary_entries.fiber does not exist
```

## Tests

Added contract tests:

- nullable fiber schema is compatible;
- missing fiber is a blocker;
- `fiber NOT NULL` is a blocker;
- `fiber DEFAULT 0` is a semantic blocker;
- non-UUID `canonical_food_id` is a blocker;
- missing required macro is a blocker;
- runtime snapshot `fiber = null` remains null;
- runtime snapshot `fiber = 0` remains zero;
- schema evaluation does not require write methods.

Executed:

| Command | Result |
| --- | --- |
| `TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm --test scripts/check-diary-schema-contract-staging.test.ts` | 9 passed, 0 failed |
| `TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm --test scripts/import-food-core.test.ts` | 22 passed, 0 failed |
| `TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm --test scripts/smoke-test-food-search-staging.test.ts` | 6 passed, 0 failed |
| `ESBUILD_BINARY_PATH=./node_modules/tsx/node_modules/esbuild/bin/esbuild npm run test:diary:bugfix` | 31 passed, 0 failed |

The first `npm run test:diary:bugfix` attempt failed inside the sandbox with `listen EPERM` on a local `tsx` IPC pipe. The same command passed outside the sandbox. No DB writes were involved.

## Build

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | passed |
| `npm run build` | passed |

Build warnings only:

- stale `baseline-browser-mapping` data;
- stale `browserslist/caniuse-lite` data;
- existing Vite dynamic/static import chunk warnings;
- existing large chunk warning.

## Manual Review Checklist

Before any diary write smoke:

1. Review `scripts/sql/staging-align-food-diary-snapshot-contract-draft.sql`.
2. Manually execute it only in staging project `ozidryfvhkcbtpnulakq`.
3. Run the validation queries at the bottom of the SQL draft.
4. Re-run `scripts/check-diary-schema-contract-staging.ts`.
5. Only after PASS, run an explicitly approved diary write smoke with a safe staging user.

## Final Verdict

**DIARY_SCHEMA_PATCH_DRAFT_READY**

Exact next step:

Manually review and apply `scripts/sql/staging-align-food-diary-snapshot-contract-draft.sql` in staging only, then re-run the read-only diary schema checker. Do not run diary write smoke until the checker passes.

## Post-Patch Verification

- Timestamp: 2026-07-03T00:00:00Z
- Mode: read-only verification
- Final post-patch verdict: **DIARY_SCHEMA_CONTRACT_PASS**

Manual staging patch application was reported by the owner, then the read-only checker was rerun against staging.

Checker command:

```bash
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm scripts/check-diary-schema-contract-staging.ts
```

Checker result:

| Check | Result |
| --- | --- |
| Project ref | `ozidryfvhkcbtpnulakq` |
| Mode | read-only |
| Verdict | `DIARY_SCHEMA_CONTRACT_PASS` |
| Payload fields checked | 15 |
| Blockers | 0 |
| Warnings | 0 |
| Select probe error | none |

Observed post-patch `food_diary_entries.fiber` contract:

| column | type | nullable | default |
| --- | --- | --- | --- |
| fiber | numeric | yes | none |

Payload mismatch summary:

| Mismatch type | Count |
| --- | ---: |
| Missing columns | 0 |
| Type mismatches | 0 |
| Nullability mismatches | 0 |
| Default semantic mismatches | 0 |

Read-only table counts after verification:

| Table | Count |
| --- | ---: |
| public.foods | 2199 |
| public.food_aliases | 3311 |
| public.food_diary_entries | 0 |
| public.recipes | 0 |
| public.recipe_ingredients | 0 |
| public.favorite_products | 0 |

Indexes and RLS:

| Item | Result |
| --- | --- |
| `food_diary_entries_idempotency_unique` | confirmed by manual validation |
| `food_diary_entries_user_date_idx` | confirmed by manual validation |
| `food_diary_entries_select_own` | confirmed by manual validation |
| `food_diary_entries_modify_own` | confirmed by manual validation |
| Authenticated write verified | no |

Post-patch tests:

| Command | Result |
| --- | --- |
| `TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm --test scripts/check-diary-schema-contract-staging.test.ts` | 9 passed, 0 failed |
| `ESBUILD_BINARY_PATH=./node_modules/tsx/node_modules/esbuild/bin/esbuild npm run test:diary:bugfix` | 31 passed, 0 failed |
| `npx tsc --noEmit` | passed |
| `npm run build` | passed with existing browser-data/Vite chunk warnings |

Post-patch safety confirmation:

- SQL was not executed by Codex in this verification step.
- Diary write was not executed.
- DB writes were not performed by Codex.
- Production was not used.
- Food Core apply was not run.
- Foods, aliases, recipes, favorite_products, and Excel were not changed by Codex.

Next step:

Run a separate explicitly approved authenticated staging diary write smoke with a safe staging user. That step should create at most one controlled diary entry, validate nullable `fiber` snapshot semantics, then use an owner-approved cleanup policy if cleanup is desired.
