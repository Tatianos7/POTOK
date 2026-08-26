# Today Premium Staging RLS Secure Env Guide

- Date: 2026-08-26
- Branch: `master`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Related blocker report: `reports/today-premium-data-model-staging-rls-test-execution-2026-08-26.md`
- Verdict: **TODAY_PREMIUM_STAGING_RLS_SECURE_ENV_GUIDE_READY**

## Scope

Prepare a secret-safe local environment guide for the Premium staging RLS tests.

This guide does not execute SQL, create users, create seed data, mutate staging, touch production, apply baseline SQL, apply Premium schema SQL, or change runtime code. It also does not contain real secrets, JWTs, tokens, passwords, anon keys, or service-role keys.

## Why This Is Needed

The previous RLS test execution stopped with `STAGING_RLS_TEST_EXTERNAL_BLOCKER` because the local secure execution context was missing:

- `TEST_USER_A_UUID`
- `TEST_USER_B_UUID`
- `TEST_USER_A_JWT`
- `TEST_USER_B_JWT`
- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY`

The tests should only be retried after these values are available locally and safely.

## Dedicated Test Users

Use two dedicated staging-only test users:

- `TEST_USER_A`
- `TEST_USER_B`

Recommended rules:

- Create or choose users only in staging project `ozidryfvhkcbtpnulakq`.
- Do not use production users.
- Do not use a real customer/user account.
- Do not reuse users that already have Premium selections unless cleanup is narrowed to recorded test ids.
- Prefer clearly named staging-only emails such as owner-approved `rls-test-a` / `rls-test-b` test accounts.

Auth user creation or deletion is out of scope for this guide and requires separate owner approval.

## Getting User UUIDs Safely

Safe options:

- Use Supabase Dashboard for the staging project and copy each auth user id manually.
- Use an owner-approved staging admin query to read auth user ids.
- Use an approved local admin helper that prints only UUIDs, not tokens.

Do not:

- paste UUIDs mixed with JWTs into reports or chat;
- query production;
- commit generated auth/user dumps;
- include user email/password pairs in repo files.

Local env variables expected later:

```text
TEST_USER_A_UUID=<TEST_USER_A_UUID>
TEST_USER_B_UUID=<TEST_USER_B_UUID>
```

## Getting JWTs Safely

JWTs must be obtained only through a local secure context.

Acceptable approaches:

- Sign in as each dedicated staging test user through a local script or temporary local tool that does not write tokens to disk.
- Use Supabase Auth APIs against staging only and keep returned access tokens in process memory or a local shell env.
- Use a password manager or secure local secret store if the owner already manages staging test credentials there.

Do not:

- commit JWTs;
- paste JWTs into reports, chat, screenshots, terminal transcripts, or issue trackers;
- save JWTs in shell history;
- print JWTs in logs;
- store JWTs in `.env` files that may be committed;
- use production auth/JWTs.

Recommended handling:

- Export JWTs only in the current shell session.
- Disable shell history temporarily if commands could include secrets.
- Prefer `read -s` or a local secret manager over typing tokens inline.
- Clear the shell session after execution.

Local env variables expected later:

```text
TEST_USER_A_JWT=<TEST_USER_A_JWT>
TEST_USER_B_JWT=<TEST_USER_B_JWT>
```

## Staging URL And Anon Key

Use only staging project values for `ozidryfvhkcbtpnulakq`.

Safe sources:

- Supabase Dashboard for the staging project API settings.
- Existing local secure environment manager, if already configured for staging.

Expected local env variables:

```text
SUPABASE_URL=<STAGING_SUPABASE_URL>
SUPABASE_ANON_KEY=<STAGING_SUPABASE_ANON_KEY>
```

Do not use production project `dtsdnhbcwpbfrhcazqkb` values.

## Example Local Env File

If an example file is needed, keep it as documentation only and never put real values in it.

Example content for `.env.local.rls-test.example`:

```dotenv
TEST_USER_A_UUID=<TEST_USER_A_UUID>
TEST_USER_B_UUID=<TEST_USER_B_UUID>
TEST_USER_A_JWT=<TEST_USER_A_JWT>
TEST_USER_B_JWT=<TEST_USER_B_JWT>
SUPABASE_URL=<STAGING_SUPABASE_URL>
SUPABASE_ANON_KEY=<STAGING_SUPABASE_ANON_KEY>
```

Do not create a real `.env.local.rls-test` in the repo. If a real local env file is used, keep it outside git tracking and verify it is ignored before writing any secret values.

## Where Secrets Must Not Go

Never store real secrets/JWT/tokens:

- in the repo;
- in `reports/`;
- in SQL drafts;
- in chat;
- in screenshots;
- in shell history, when avoidable;
- in terminal logs;
- in committed `.env` files;
- in copied command transcripts;
- in browser-visible issue/PR comments.

## Pre-Execution Checklist

Before rerunning owner-approved RLS test execution:

- linked ref is `ozidryfvhkcbtpnulakq`;
- production ref `dtsdnhbcwpbfrhcazqkb` is not linked or used;
- `TEST_USER_A` and `TEST_USER_B` are dedicated staging users;
- test users have no existing Premium selections, or cleanup is narrowed to recorded test ids;
- `TEST_USER_A_UUID` and `TEST_USER_B_UUID` are set locally;
- `TEST_USER_A_JWT` and `TEST_USER_B_JWT` are set locally without printing them;
- `SUPABASE_URL` points to staging;
- `SUPABASE_ANON_KEY` is the staging anon key;
- runtime UI remains on mock data;
- cleanup SQL has been reviewed;
- no diary/workout writes are included;
- no recipe import is included;
- no AI/runtime rows are included;
- no production connection string or key is present in the environment.

## Suggested Local Verification

Run a local env presence check that prints only variable names and readiness, never values.

Example:

```sh
node -e "const required=['TEST_USER_A_UUID','TEST_USER_B_UUID','TEST_USER_A_JWT','TEST_USER_B_JWT','SUPABASE_URL','SUPABASE_ANON_KEY']; const missing=required.filter(k=>!process.env[k]); console.log(missing.length ? 'MISSING '+missing.join(',') : 'READY'); process.exit(missing.length ? 2 : 0);"
```

If it prints `READY`, proceed only with the separately approved staging RLS test execution task.

## Next Recommended Step

After the secure local env is prepared, rerun the owner-approved Premium staging RLS test execution:

- keep staging target `ozidryfvhkcbtpnulakq`;
- keep production `dtsdnhbcwpbfrhcazqkb` untouched;
- do not write secrets into repo/report/logs;
- run service-role setup, authenticated assertions, and cleanup exactly as reviewed or through an approved scripted harness;
- create a sanitized execution report with no secret values.

## Verification

- `git diff --check`
  - Result: pending after report creation.
- No Supabase SQL execution.
- No staging mutation.
- No production query.
- No real secrets/JWT/tokens added.

## Final Verdict

**TODAY_PREMIUM_STAGING_RLS_SECURE_ENV_GUIDE_READY**
