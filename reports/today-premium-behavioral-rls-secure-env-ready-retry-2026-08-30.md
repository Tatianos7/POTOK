# Today Premium Behavioral RLS Secure Env Ready Retry

- Date: 2026-08-30
- Branch: `master`
- Source blocker commit: `2bfe60f today premium behavioral rls secure preflight blocker`
- Staging ref: `ozidryfvhkcbtpnulakq`
- Production ref excluded: `dtsdnhbcwpbfrhcazqkb`
- Target package: `TODAY_PREMIUM_BEHAVIORAL_RLS_SECURE_ENV_READY_RETRY`
- Verdict: **TODAY_PREMIUM_BEHAVIORAL_RLS_SECURE_ENV_READY_RETRY_READY**

## Scope

Prepare a secure local env readiness checklist for the owner before retrying Today Premium behavioral RLS tests.

This is a plan/report-only package. No RLS behavior tests were run, no SQL was executed, no table reads were made, no network calls were made, no staging users were created, no JWT/password/secrets were requested or collected, staging was not mutated, production was not touched, runtime/config/dependency files were not changed, and no PR was created.

## Source Materials Reviewed

- `reports/today-premium-behavioral-rls-tests-reentry-plan-2026-08-30.md`
- `reports/today-premium-behavioral-rls-secure-preflight-2026-08-30.md`
- `reports/today-premium-staging-rls-secure-env-guide-2026-08-26.md`

## Previous Blocker Summary

The latest secure preflight ended with **STAGING_EXTERNAL_BLOCKER**.

Missing required local secure env values:

- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY`;
- `TEST_USER_A_UUID`;
- `TEST_USER_B_UUID`;
- `TEST_USER_A_JWT`;
- `TEST_USER_B_JWT`.

Confirmed during that preflight:

- local linked Supabase ref file pointed to staging `ozidryfvhkcbtpnulakq`;
- production ref `dtsdnhbcwpbfrhcazqkb` was not found in the current process env;
- no `VITE_*` service-role variable names were present;
- no SQL, RLS behavior tests, table reads, network calls, staging mutation, production query, or secret printing occurred.

## Required Env Checklist

The owner should prepare these values only in a local secure context:

```text
SUPABASE_URL=<staging Supabase URL for ozidryfvhkcbtpnulakq>
SUPABASE_ANON_KEY=<staging anon key>
TEST_USER_A_UUID=<staging test user A UUID>
TEST_USER_B_UUID=<staging test user B UUID>
TEST_USER_A_JWT=<staging test user A JWT>
TEST_USER_B_JWT=<staging test user B JWT>
```

Requirements:

- `SUPABASE_URL` must point to staging ref `ozidryfvhkcbtpnulakq`;
- production ref `dtsdnhbcwpbfrhcazqkb` must not appear in env or runner config;
- `TEST_USER_A_UUID` and `TEST_USER_B_UUID` must both be present;
- user A and user B UUIDs must be different;
- `TEST_USER_A_JWT` and `TEST_USER_B_JWT` must both be present;
- JWT values must never be printed, committed, or copied into reports/logs/chat;
- no service-role key should be used for anon/authenticated RLS behavior assertions;
- no service-role key may be placed in frontend/browser env.

## Owner Local Setup Checklist

Recommended local setup path:

- use a dedicated staging-only shell/session for the RLS retry;
- disable shell history temporarily if commands may include secrets;
- load values from a secure local secret manager or type them into the current shell without echoing;
- keep any real local env file outside the repo, or confirm it is git-ignored before writing values;
- use dedicated staging test users only;
- do not use real customer accounts;
- do not use production users;
- do not create staging users inside this package;
- do not request OTP/password/JWT values in chat or reports;
- clear the shell/session after the execution package finishes.

Suggested value-safe presence check:

```sh
node -e "const required=['SUPABASE_URL','SUPABASE_ANON_KEY','TEST_USER_A_UUID','TEST_USER_B_UUID','TEST_USER_A_JWT','TEST_USER_B_JWT']; const missing=required.filter(k=>!process.env[k]); console.log(missing.length ? 'MISSING '+missing.join(',') : 'READY'); process.exit(missing.length ? 2 : 0);"
```

Suggested staging/production boundary check without printing values:

```sh
node -e "const staging='ozidryfvhkcbtpnulakq'; const prod='dtsdnhbcwpbfrhcazqkb'; const env=process.env; const url=env.SUPABASE_URL||''; const prodHits=Object.entries(env).filter(([,v])=>String(v||'').includes(prod)).map(([k])=>k); const serviceRoleVite=Object.keys(env).filter(k=>k.startsWith('VITE_') && /SERVICE.*ROLE|SERVICE_ROLE/i.test(k)); const usersOk=env.TEST_USER_A_UUID && env.TEST_USER_B_UUID && env.TEST_USER_A_UUID!==env.TEST_USER_B_UUID; console.log(JSON.stringify({stagingUrlPresent:!!url, stagingUrlMatches:url.includes(staging), productionRefPresent:prodHits.length>0, productionRefEnvNames:prodHits, userUuidsDistinct:!!usersOk, frontendServiceRoleEnvClear:serviceRoleVite.length===0, frontendServiceRoleEnvNames:serviceRoleVite})); process.exit(url.includes(staging)&&prodHits.length===0&&usersOk&&serviceRoleVite.length===0 ? 0 : 2);"
```

These commands print only status, variable names, and booleans. They must not be modified to print secret values.

## Gitignore / Secret Safety Checklist

Before running any retry:

- run scoped git status for env files;
- confirm no real `.env`, `.env.local`, `.env.production`, `.env.staging`, or RLS secret file is tracked or staged;
- confirm no secret values appear in `git diff`;
- confirm no JWT-like token values were written to reports;
- confirm no production URL/key was added to local tracked files;
- confirm any local secret file is ignored by git before storing values.

Suggested checks:

```sh
git status --short -- .env .env.local .env.production .env.staging
git diff --check
git diff --cached --check
```

Do not run broad commands that print env values.

## Retry Preflight Steps

After owner prepares the local secure env:

1. Confirm branch is `master`.
2. Confirm linked staging ref is `ozidryfvhkcbtpnulakq`.
3. Confirm production ref `dtsdnhbcwpbfrhcazqkb` is absent from env/runner config.
4. Confirm all required env variables are present without printing values.
5. Confirm user A and user B UUIDs are distinct.
6. Confirm JWTs are present without decoding or printing payloads unless an owner-approved sanitized decode is required.
7. Confirm no `VITE_*` service-role variable exists.
8. Confirm no env files are staged.
9. Confirm no secrets are present in git diff.
10. Stop before any table read, SQL, RLS behavior assertion, or network call.

Expected retry-preflight result:

- `TODAY_PREMIUM_BEHAVIORAL_RLS_SECURE_PREFLIGHT_READY` if env and boundaries are ready;
- `STAGING_EXTERNAL_BLOCKER` if any required env/session prerequisite is still missing;
- `REQUIRES_FIXES` if repo/config safety is compromised.

## What Is Approved In This Package

Approved:

- documenting required env variables;
- documenting safe local storage options;
- documenting value-safe presence checks;
- documenting gitignore/secret safety checks;
- documenting retry preflight steps;
- using placeholders and status labels only;
- running `git diff --check`.

## What Is Still Not Approved

Not approved in this package:

- running RLS behavior tests;
- executing SQL;
- reading real tables;
- making network calls;
- creating staging users;
- requesting OTP/password/JWT/secrets;
- printing or decoding JWT payloads into logs/reports;
- using service-role keys;
- placing service-role keys in frontend/browser env;
- changing RLS policies;
- enabling user Premium selection writes;
- mutating staging;
- touching production;
- changing runtime code;
- changing config/dependency files;
- creating a PR.

## Next Execution Package

Proceed only after env readiness passes.

Recommended next package: **TODAY_PREMIUM_BEHAVIORAL_RLS_SECURE_PREFLIGHT_RETRY_WITH_ENV**.

Scope for that package:

- rerun env-only secure preflight;
- confirm staging URL/ref and production exclusion;
- confirm required env is present without printing values;
- confirm test users/sessions are ready;
- confirm no frontend/browser service-role env;
- confirm no env files or secrets are staged;
- do not run RLS table checks yet unless separately approved.

After that package returns ready, move to a separate owner-approved execution package for:

- anon read-only behavior checks;
- authenticated user A read-only behavior checks;
- authenticated user B read-only behavior checks;
- cross-user isolation checks;
- optional write-denial checks only if explicitly approved;
- optional elevated count verification only as a separate owner-approved boundary.

## Safety Confirmation

Confirmed for this package:

- no runtime code changes;
- no config/dependency changes;
- no Supabase SQL execution;
- no staging mutation;
- no production query or mutation;
- no RLS behavior tests;
- no real table reads;
- no network calls;
- no secrets printed;
- no secrets committed;
- no service-role keys in frontend/browser env;
- no RLS policy changes;
- no user Premium selections writes;
- no diary/workout writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI runtime;
- no voice input;
- no PR.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**TODAY_PREMIUM_BEHAVIORAL_RLS_SECURE_ENV_READY_RETRY_READY**
