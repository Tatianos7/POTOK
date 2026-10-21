# Real Supabase Auth/PostgREST acceptance — manual gate

Status: **NOT RUN / NOT ACCEPTED**. This test is separate from PostgreSQL simulation CI.

## Preconditions

- An explicitly approved **disposable** Supabase project, never POTOK production (`dtsdnhbcwpbfrhcazqkb`) or existing staging (`ozidryfvhkcbtpnulakq`).
- Apply the proposed least-privilege grants **in that disposable project only** after review. The current review migration is intentionally rollback-only and not deployable.
- Create two distinct test accounts using the project's real Supabase Auth and seed one user_profiles row for each using trusted admin authority.
- Test identities must have no premium/admin rights. Do not use real personal information.
- Ensure payment tables exist and client roles cannot write to them.

## Run

Set `POTOK_TEST_SUPABASE_URL`, `POTOK_TEST_ANON_KEY`,
`POTOK_TEST_USER_A_JWT`, `POTOK_TEST_USER_B_JWT`,
`POTOK_TEST_USER_A_ID`, `POTOK_TEST_USER_B_ID`.
Then execute:

```sh
node scripts/contracts/supabase-auth-postgrest-acceptance.mjs
```

The script deliberately fails closed if any variable is missing or if URL points
at POTOK production/staging. It sends HTTP requests, including test-only profile
updates; therefore it must never run against a live POTOK database.

## Required acceptance

- Both Auth JWTs valid; own profile SELECT succeeds, other profile invisible.
- Cross-user PATCH returns no modified rows.
- Protected profile columns cannot be PATCHed.
- Authenticated client cannot INSERT into subscriptions, entitlements or billing_events.
- Additionally test real PostgREST profile UPSERT, own coach/voice settings,
  INSERT with protected fields, anonymous access, and server-side payment writer
  separately before accepting a deployment. These cases are **not covered** by
  the initial script.

Green GitHub CI on PostgreSQL fixtures does not satisfy this acceptance gate.
No deployment to staging or production is authorized by this document.
