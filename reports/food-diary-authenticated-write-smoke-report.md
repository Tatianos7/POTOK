# Food Diary Authenticated Write Smoke Report

- Timestamp: 2026-07-03T00:00:00Z
- Scope: controlled authenticated staging diary write smoke
- Target environment: staging
- Target project ref: `ozidryfvhkcbtpnulakq`
- Production/current live ref: `dtsdnhbcwpbfrhcazqkb`
- Final verdict: **DIARY_AUTH_WRITE_SMOKE_PASS**

This report preserves earlier blocked preparation attempts as audit history. The final authenticated browser smoke result is recorded in the "Final Authenticated Diary Smoke" section below.

## Environment Safety

- Target project ref was verified as staging: `ozidryfvhkcbtpnulakq`.
- Production ref `dtsdnhbcwpbfrhcazqkb` was not used.
- Food Core apply was not run.
- SQL migrations were not executed.
- Schema was not changed.
- Main diary write was not attempted.
- No INSERT, UPDATE, UPSERT, DELETE, or TRUNCATE was executed.
- Foods, aliases, recipes, recipe_ingredients, favorite_products, and Excel were not changed.

## Test User Summary

Read-only staging auth lookup was performed with the staging service-role key.

| Check | Result |
| --- | --- |
| Existing staging users found | no |
| Users count | 0 |
| Safe test user exists | no |
| Masked email | n/a |
| User UUID | n/a |
| Auth method | n/a |
| Authenticated session available | no |

No password, OTP, access token, refresh token, service-role key, or JWT was printed.

## Authentication Method

Blocked. There is no existing staging user and no authenticated session available.

The requested smoke requires an authenticated client/session because the main write must pass RLS through:

```text
auth.uid() = user_id
```

Service-role is not allowed for the main write and was not used for it.

## Selected Food

Not selected because the write smoke was blocked before write preparation.

Preferred next candidate remains:

```text
stable_food_id = eggs_fried
```

provided it still satisfies:

- canonical root row;
- `foods.id = foods.canonical_food_id`;
- macros present;
- `fiber IS NULL`;
- visible through the normal search path.

## Exact Test Payload

Not created.

The planned payload template remains:

| Field | Planned value |
| --- | --- |
| weight | 100 g |
| meal_type | breakfast |
| base_unit | г |
| display_unit | г |
| display_amount | 100 |
| fiber expected | NULL |
| idempotency_key | `staging-diary-smoke-<timestamp-or-uuid>` |

## Pre-Write Counts

No pre-write DB count mutation occurred. Latest confirmed state before this blocked step:

| Table | Count |
| --- | ---: |
| public.foods | 2199 |
| public.food_aliases | 3311 |
| public.food_diary_entries | 0 |
| public.recipes | 0 |
| public.recipe_ingredients | 0 |
| public.favorite_products | 0 |

## Write Result

Not attempted.

Reason:

```text
DIARY_WRITE_BLOCKED_NO_STAGING_USER
```

## Snapshot Expected vs Actual

Not applicable. No diary row was created.

## Fiber NULL Result

Not tested by write smoke. Runtime and schema preconditions are ready, but authenticated write validation requires a safe staging user.

## Canonical UUID Result

Not tested by write smoke.

## Idempotency Result

Not tested because the first authenticated create operation was not run.

## RLS Negative Test Result

Not executed. Without an authenticated session, an RLS negative write attempt would not test the intended `auth.uid() != user_id` path.

## Cleanup Target

None.

No row id was created, so no cleanup was required.

## Cleanup Result

Not applicable.

No DELETE was executed.

## Post-Cleanup Counts

No cleanup was needed. `food_diary_entries` remains at the previously confirmed zero-row state.

## Tests And Build

Not rerun in this blocked step. The blocker occurs before write/test execution because no staging auth user exists.

Most recent prerequisite checks before this step:

- Diary schema checker: `DIARY_SCHEMA_CONTRACT_PASS`.
- Schema contract tests: 9/9 passed.
- Diary/fiber runtime tests: 31/31 passed.
- TypeScript: passed.
- Build: passed.

## Blockers And Warnings

| Type | Detail |
| --- | --- |
| Blocker | No existing staging user was found. |
| Blocker | No authenticated staging session is available. |
| Warning | Do not use service-role for the main diary write smoke. |

## Final Verdict

**DIARY_WRITE_BLOCKED_NO_STAGING_USER**

## Exact Next Step

Create or identify one approved staging test user for project `ozidryfvhkcbtpnulakq`, then provide a safe authenticated session for the smoke.

Recommended manual path:

1. Create a staging-only test user in Supabase Auth, or identify an existing safe one.
2. Sign in to the staging app with that user.
3. Provide either explicit permission to use that staging user session locally, or provide temporary staging test credentials through a local uncommitted env file.
4. Re-run the controlled diary write smoke.

Do not use production credentials. Do not commit test credentials.

## Staging Session Verification

- Timestamp: 2026-07-03T00:00:00Z
- Mode: read-only session and startup error classification
- Verdict: **STAGING_AUTH_SESSION_READY_WITH_UNRELATED_WORKOUT_ERRORS**

The user manually completed OTP login in the local staging app at:

```text
http://127.0.0.1:5179/
```

No OTP, access token, refresh token, JWT, confirmation URL, or auth storage was read or printed.

Read-only staging Auth lookup:

| Check | Result |
| --- | --- |
| Project ref | `ozidryfvhkcbtpnulakq` |
| User exists | yes |
| User UUID | staging test user UUID, masked in report |
| Masked email | `p***@bk.ru` |
| Provider | email |
| Last sign-in | `2026-07-03T07:10:03.134589Z` |
| Browser session visible to user | yes |
| Tokens inspected | no |

Target safety:

| Check | Result |
| --- | --- |
| Production ref used | no |
| Service-role in browser | no evidence; service-role was not passed to Vite |
| Staging anon browser env | yes |
| Diary write executed | no |

Read-only diary state:

| Check | Count |
| --- | ---: |
| Current user diary rows | 0 |
| Total `food_diary_entries` rows | 0 |
| foods | 2199 |
| food_aliases | 3311 |
| recipes | 0 |
| recipe_ingredients | 0 |
| favorite_products | 0 |

## Startup Error Classification

Observed browser console errors:

```text
POST /rest/v1/exercise_categories
404 Not Found
PGRST205: Could not find the table 'public.exercise_categories' in the schema cache
```

User-observed category attempts include:

```text
Грудь, Спина, Ноги, Плечи, Кардио
```

Code source:

| File | Function | Behavior |
| --- | --- | --- |
| `src/main.tsx` | module startup | calls `initializeExerciseData()` on app startup |
| `src/utils/initializeExerciseData.ts` | `initializeExerciseData` | calls `exerciseService.getCategories()`, then attempts `.insert()` into `exercise_categories` when no categories are returned |
| `src/pages/Workouts.tsx` | Workouts retry path | can call `initializeExerciseData()` again from workout UI |

Staging OpenAPI finding:

| Check | Result |
| --- | --- |
| `public.exercise_categories` exists | no |
| exercise/workout tables exposed in OpenAPI | none |
| Any workout rows created | no evidence; target tables are absent |

Classification:

```text
STAGING_WORKOUT_SCHEMA_GAP
```

Impact:

| Question | Answer |
| --- | --- |
| Blocks authentication | no |
| Blocks controlled diary smoke | no, if network/write monitoring isolates diary row creation |
| Creates unrelated startup write attempts | yes, failed POST attempts to missing workout schema |
| Can diary smoke be isolated | yes, but monitor and ignore only the known failed `exercise_categories` 404/PGRST205 startup attempts |

## Pre-Diary-Smoke Safety Decision

**STAGING_AUTH_SESSION_READY_WITH_UNRELATED_WORKOUT_ERRORS**

The next diary write smoke may proceed only with strict request monitoring:

- exactly one successful `food_diary_entries` insert is allowed;
- known failed `exercise_categories` 404/PGRST205 startup requests must be classified separately;
- any successful non-diary mutation must abort the smoke;
- cleanup must target only the exact created diary row id, user id, and idempotency key.

## Controlled Write Attempt Status

- Timestamp: 2026-07-03T00:00:00Z
- Requested operation: execute controlled authenticated diary write smoke
- Final execution verdict: **DIARY_WRITE_BLOCKED_SESSION_LOST**

The staging user session is visible in the user's already-open browser, but it is not available to the Codex runtime as a safe authenticated browser context.

Safety decision:

- Do not read or print browser auth storage.
- Do not ask the user to paste tokens.
- Do not use service-role for the main write.
- Do not perform a direct service-role insert.
- Do not create a new login/session through Admin API.

Local session access check:

| Check | Result |
| --- | --- |
| Existing user in staging Auth | yes |
| User UUID | staging test user UUID, masked in report |
| Masked email | `p***@bk.ru` |
| Browser session available to user | yes |
| Authenticated browser context available to Codex runtime | no |
| Auth storage/token inspected | no |
| Main write executed | no |

Because the main write must go through an authenticated client/session and RLS, executing it via service-role would invalidate the smoke. The write was therefore blocked before any create operation.

Write result:

| Step | Result |
| --- | --- |
| Selected food | not selected in this execution step |
| Test payload | not generated |
| Created row id | none |
| Idempotency request | not executed |
| RLS negative write | not executed |
| Cleanup | not required |

Final state:

- `food_diary_entries` remains 0.
- No cleanup/delete/truncate was executed.
- Production was not used.
- Food Core apply was not run.
- Foods, aliases, recipes, favorite_products, and Excel were not changed.

Recommended next step:

Use one of these safe options for the actual authenticated write smoke:

1. Run the smoke from an automation context that owns the login flow end-to-end, with the user manually entering OTP in that browser context.
2. Provide temporary staging-only test credentials in an uncommitted local env file, then run the smoke through `supabase.auth.signInWithPassword`.
3. Add an explicit temporary staging-only test route/script that runs inside the already-authenticated browser and reports only non-secret smoke results.

Do not paste tokens, OTP, JWT, refresh tokens, or browser auth storage into chat.

## Final Authenticated Diary Smoke

- Timestamp: 2026-07-03T00:00:00Z
- Final verdict: **DIARY_AUTH_WRITE_SMOKE_PASS**
- Target environment: staging
- Target project ref: `ozidryfvhkcbtpnulakq`
- Production/current live ref: `dtsdnhbcwpbfrhcazqkb`

The smoke was executed manually in the already-authenticated staging browser session. No OTP, JWT, access token, refresh token, confirmation URL, or browser auth storage was copied into the report.

Test user:

| Field | Value |
| --- | --- |
| User | staging diary test user |
| Masked email | `p***@bk.ru` |
| Session target | staging |
| Production used | no |
| Service-role used for main write | no |

Selected canonical product:

| Field | Value |
| --- | --- |
| stable_food_id | `eggs_fried` |
| foods.id | `d705cb9f-405b-4d4c-87c4-5a85d0836bc9` |
| canonical_food_id | `d705cb9f-405b-4d4c-87c4-5a85d0836bc9` |
| name | Яичница глазунья |
| calories / 100 g | 243 |
| protein / 100 g | 12.9 |
| fat / 100 g | 20.9 |
| carbs / 100 g | 0.9 |
| fiber / 100 g | `NULL` |

Test payload summary:

| Field | Value |
| --- | --- |
| weight | 100 g |
| meal_type | breakfast |
| base_unit | г |
| display_unit | г |
| display_amount | 100 |
| expected fiber snapshot | `NULL` |

Create result:

| Check | Result |
| --- | --- |
| Main create path | authenticated application service path |
| Create POST | 201 |
| Created temporary row id | `e6bb8424-01b7-44cc-9fb7-b3f628853203` |
| Canonical UUID stored | pass |
| Snapshot validation | pass |
| Stored fiber | `NULL` |

Snapshot expected vs actual:

| field | expected | actual | result |
| --- | ---: | ---: | --- |
| calories | 243 | 243 | PASS |
| protein | 12.9 | 12.9 | PASS |
| fat | 20.9 | 20.9 | PASS |
| carbs | 0.9 | 0.9 | PASS |
| fiber | `NULL` | `NULL` | PASS |

Idempotency:

| Check | Result |
| --- | --- |
| Second request with same logical payload | returned/kept existing row |
| Duplicate created | no |
| Row count for test key after second request | 1 |
| Verdict | PASS |

RLS negative check:

| Check | Result |
| --- | --- |
| Request type | authenticated request with mismatched random `user_id` |
| Result | denied |
| HTTP/Postgres result | 403 / 42501 |
| Negative rows created | 0 |
| Verdict | PASS |

Cleanup:

| Check | Result |
| --- | --- |
| Cleanup type | targeted delete only |
| Cleanup condition | exact row id + authenticated user id + idempotency key |
| DELETE result | 200 |
| Deleted row id | `e6bb8424-01b7-44cc-9fb7-b3f628853203` |
| Broad cleanup/delete/truncate | no |
| Verdict | PASS |

Final post-cleanup counts:

| Table / check | Count |
| --- | ---: |
| own diary rows | 0 |
| test key rows | 0 |
| negative key rows | 0 |
| public.foods | 2199 |
| public.food_aliases | 3311 |
| public.recipes | 0 |
| public.recipe_ingredients | 0 |
| public.favorite_products | 0 |

Mutation summary:

| Endpoint / table | Result | Classification |
| --- | --- | --- |
| `public.food_diary_entries` create | 201 | expected main write |
| `public.food_diary_entries` idempotency replay | no duplicate | expected idempotency check |
| `public.food_diary_entries` negative RLS attempt | 403 / 42501 | expected denial |
| `public.food_diary_entries` cleanup | 200 | expected targeted cleanup |
| `public.exercise_categories` startup attempts | 404 / PGRST205 | known unrelated staging workout schema gap |

Known unrelated startup errors:

```text
POST /rest/v1/exercise_categories
404 / PGRST205
classification: KNOWN_STAGING_WORKOUT_SCHEMA_GAP
```

These were not counted as diary failures because the requests failed against absent workout schema, created no workout rows, and did not affect the diary write path.

Temporary harness cleanup:

| Item | Result |
| --- | --- |
| Dev route `/__diary-auth-smoke` | removed after successful smoke |
| Browser harness UI | removed after successful smoke |
| Harness-only analytics suppression | removed after successful smoke |
| Harness instruction report | removed after successful smoke |
| Production bundle contains harness | no |

Safety confirmation:

- Production was not used.
- Food Core apply was not run.
- SQL migrations were not executed.
- Schema was not changed by Codex in this finalization step.
- Foods and aliases were not changed.
- Recipes, recipe_ingredients, and favorite_products were not changed.
- Excel was not changed.
- The temporary diary row was removed by targeted cleanup.
- Final diary count is back to 0.
