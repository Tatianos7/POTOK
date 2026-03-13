# Supabase Security Advisor Warning Hardening

## What this step addresses

After the critical Security Advisor errors are resolved, the remaining warnings
typically come from two classes of objects:

- public functions with mutable `search_path`
- public views without explicit `security_invoker`

This step hardens those objects without changing business logic, table data, or
RLS policies.

## What changed

### 1. Public functions

All non-extension functions in `public` are hardened with:

```sql
search_path = public, pg_temp
```

This avoids object shadowing and makes function name resolution deterministic.

The migration does not:

- change function signatures
- change function bodies
- switch security mode
- bypass RLS

### 2. Public client-facing view

`public.exercises_full_view` is re-asserted as:

```sql
security_invoker = true
```

This makes the view obey caller permissions instead of relying on default view behavior.

## Why this is production-safe

- idempotent
- non-destructive
- no data rewrite
- no privilege broadening
- no `SECURITY DEFINER` shortcuts added

## What to run manually

1. Apply migration:

- `supabase/migrations/20260311_security_advisor_warning_hardening.sql`

2. Run audits:

- `scripts/sql/security_advisor_remaining_warnings_audit.sql`
- `scripts/sql/security_function_search_path_audit.sql`
- `scripts/sql/security_public_access_audit.sql`

## Expected outcome

- no remaining mutable `search_path` warnings for public functions
- `exercises_full_view` remains readable through authenticated workout flows
- no change in nutrition, diary, favorites, recipes, analytics, or auth behavior

## Smoke-check focus

After applying the migration, verify:

1. workout exercise search/list still works
2. recipe recompute RPC still works
3. habit toggle RPC still works
4. purchase/program RPCs still execute as before
