# Supabase Security Hardening Baseline

## Risks found

Supabase Security Advisor flagged:

- tables without production-safe RLS posture
- a public view that should obey caller permissions
- public functions with mutable `search_path`

The flagged entities were:

- `public.habits`
- `public.user_goals`
- `public.habit_logs`
- `public.analytics_events`
- `public.user_profiles`
- `public.exercises_full_view`

## Why schema-aware policy generation is required

The advisor findings are table-level, but the actual owner column is not guaranteed
to be named the same way across environments.

Examples from this codebase:

- some tables use `user_id`
- some profile flows still support `id_user`
- some environments may expose ownership through `id`
- some child tables can be proven owner-safe only through a join (for example `habit_logs -> habits`)

Because of that, hardcoded policies like:

```sql
auth.uid() = user_id
```

are not production-safe unless the column is confirmed to exist.

The hardening migration now:

- inspects table columns before creating policies
- chooses the real owner column from schema
- uses join-based owner checks where needed
- skips unsafe policy generation with `raise notice` instead of failing mid-migration

This avoids false assumptions and keeps RLS strict.

## Ownership model

### User-owned tables

- `public.habits`
- `public.user_goals`
- `public.habit_logs`
- `public.user_profiles`

Policy model:

- `auth.uid() = user_id`
- RLS enabled
- `FORCE ROW LEVEL SECURITY` enabled
- `anon` revoked
- `authenticated` granted only required operations

### Insert-only client telemetry

- `public.analytics_events`

Policy model:

- client can only `INSERT`
- row must satisfy `auth.uid() = user_id`
- no client `SELECT`
- no anon access

### Read-only authenticated view

- `public.exercises_full_view`

Hardening applied:

- `security_invoker = true`
- `anon` revoked
- `authenticated` gets `SELECT`

This makes the view obey caller permissions instead of relying on default view behavior.

## Functions hardened

Mutable `search_path` was fixed for actively used public functions by setting:

```sql
search_path = public, pg_temp
```

This reduces risk of object shadowing and keeps function resolution deterministic.

## What to run manually in Supabase

1. Apply migration:

- `supabase/migrations/20260311_security_advisor_hardening.sql`

2. Run audits:

- `scripts/sql/security_rls_status_audit.sql`
- `scripts/sql/security_function_search_path_audit.sql`
- `scripts/sql/security_public_access_audit.sql`

## How to verify no cross-user access

Manual checks after migration:

1. Login as user A and create/read/update:
   - habit
   - habit log
   - user goal
   - profile
2. Login as user B and confirm A's rows are not visible
3. Confirm `analytics_events`:
   - insert works for current user
   - select from client does not work
4. Confirm workout flows still read `public.exercises_full_view`
5. Re-run nutrition smoke checks to confirm unrelated flows were not affected

## Notes

This hardening does not:

- remove data
- drop tables
- open any temporary access
- weaken nutrition RLS
