# Live entitlement RPC compatibility gate — 2026-10-23

Status: REVIEW ONLY; production SELECT audit, no DDL.

## CI evidence
At commit `b9cd6cf5e57c9f4ebd95f485c0a4fd5b479ae65c`, all four GitHub Actions workflows passed. Local Supabase Auth/PostgREST run 39899604462, job 120237872143, explicitly logged:
- `PASS: exact isolated entitlement review SQL replay in disposable local Supabase`
- `PASS: Premium RPC own reads, cross-account denial, anonymous denial, purchase RPC client denial`

## Production metadata verified read-only
Project `dtsdnhbcwpbfrhcazqkb`, `pg_proc`:
- Signature `public.get_entitlements(p_user_id uuid DEFAULT NULL::uuid)`; return `jsonb`.
- `SECURITY DEFINER`; `search_path=public, pg_temp`.
- Effective EXECUTE: `anon=true`, `authenticated=true`, `service_role=true`.
- Deployed function resolves `coalesce(p_user_id,auth.uid())` without an ownership guard; for null resolved identity it returns Free with empty flags; missing entitlement row returns Free with five explicit capability flags.

## Compatibility and open issues
The isolated review patch preserves signature, JSON return type and five-flag missing-row default, but intentionally changes unauthorized behavior to SQLSTATE 42501 and removes anonymous EXECUTE. The existing client entitlement service passes its own authenticated ID. **Other callers and service-role invocation patterns remain a release gate.**

The current patch changes anonymous/default-null behavior compared with deployed SQL; that is an intentional security change requiring product/API error-contract review. Do not assert drop-in compatibility for all clients. The isolated SQL is rollback guarded, not deployable.

## Release gate
Complete checked-out-HEAD caller inventory, inspect paywall delegation and service-role needs, review a standalone forward/rollback migration and validate its exact contents on disposable Supabase. Obtain explicit approval before any staging or production changes.
