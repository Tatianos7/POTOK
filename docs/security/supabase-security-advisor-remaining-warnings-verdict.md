# Supabase Security Advisor Remaining Warnings Verdict

## Scope

This document covers the remaining warnings confirmed after critical Security Advisor errors were closed:

- `Extension in Public -> public.pg_trgm`
- `RLS Policy Always True -> public.exercise_categories`
- `Leaked Password Protection Disabled -> Auth`

## Warning Verdicts

### `public.pg_trgm`

What it means:

- the `pg_trgm` extension is installed in the `public` schema
- Security Advisor flags this as a hardening warning because shared extension objects in `public` are less isolated than a dedicated extension schema

Criticality:

- low

Should we fix it now:

- no

Why not:

- moving an installed extension can affect operators, indexes, expression references, generated SQL, and future migrations
- this is infrastructure hygiene, not an active data-exposure issue in current app flows
- the regression surface is larger than the value of doing it inside the current hardening batch

Verdict:

- keep `pg_trgm` in `public` for now
- track relocation as a deferred infra/DBA task

Optional future plan:

1. Inventory all dependencies on `pg_trgm` operators/functions/indexes.
2. Create a dedicated schema such as `extensions`.
3. Test `alter extension pg_trgm set schema extensions;` in a staging clone.
4. Re-run search/index smoke tests before any production rollout.

### `public.exercise_categories`

What it means:

- the table currently has a read policy shape that Security Advisor classifies as "always true"
- the table is used by workout flows as a read-only reference catalog

Criticality:

- low to medium

Should we fix it now:

- yes, if the dedicated migration has not yet been applied

Why:

- the current behavior is intentional read-only catalog access, but the policy shape is broader than necessary
- the safer posture is explicit authenticated read-only access, not a generic permissive read policy

Verdict:

- `exercise_categories` should remain a read-only catalog
- it does not need user-owned policies
- it should not be writable by client roles
- the recommended state is:
  - RLS disabled
  - read access only for `authenticated`
  - no client insert/update/delete

Migration:

- `supabase/migrations/20260312_exercise_categories_shared_catalog_access.sql`

### `Leaked Password Protection Disabled`

What it means:

- Supabase Auth leaked password protection is not enabled
- password set/reset flows may accept passwords that are known from breach datasets

Criticality:

- medium

Should we fix it now:

- yes, if the project plan supports it
- but this is a dashboard/platform setting, not a code or SQL fix

Platform note:

- according to Supabase docs, leaked password protection is available on Pro plan and above
- on Free plan this warning may remain as a platform limitation

Why it is not fixed in code:

- the control lives in Supabase Auth settings
- there is no production-safe repo-side SQL/code change that enables it

Manual action when available:

1. Open Supabase Dashboard.
2. Go to `Authentication`.
3. Open password security settings.
4. Enable leaked password / compromised password protection.

Risk of regression:

- low for existing signed-in users
- moderate for sign-up, password reset, and password change flows if users choose compromised passwords

Recommended follow-up:

- after upgrading to Pro, enable the setting
- manually test sign-in, password reset, and password change flows

## What To Do Now

1. Keep `pg_trgm` as-is and track it as deferred infra work.
2. Apply the `exercise_categories` hardening migration if it is not already applied.
3. If the project is on Pro or moves to Pro, enable leaked password protection in Auth settings.

## Manual Apply Order

1. Run audit:
   - `scripts/sql/security_exercise_categories_audit.sql`
2. Apply migration:
   - `supabase/migrations/20260312_exercise_categories_shared_catalog_access.sql`
3. Re-run audits:
   - `scripts/sql/security_exercise_categories_audit.sql`
   - `scripts/sql/security_advisor_remaining_warnings_audit.sql`
   - `scripts/sql/security_public_access_audit.sql`

## Smoke Checks

1. Open workout flows that load exercise categories.
2. Confirm category list still loads for an authenticated user.
3. Confirm exercise search/list flows using `exercises_full_view` still work.
4. Confirm anon/public access is not required anywhere in the app.
5. If/when leaked password protection is enabled, test:
   - sign in
   - password reset
   - password change
