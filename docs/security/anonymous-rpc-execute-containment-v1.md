# Anonymous RPC EXECUTE containment: review candidate

Eight named public SECURITY DEFINER entry points should not be callable by an unauthenticated API role. This candidate revokes EXECUTE from anon and PUBLIC on only their exact signatures. It never edits routine bodies, changes role membership, alters defaults or revokes authenticated/service_role access.

It is deliberately outside automatic migrations. No hosted apply is authorized by this document; the exact candidate must be reviewed and separately approved under AGENTS.md. This does not make the remaining authenticated entry points safe.

## Candidate behavior

- Require effective postgres and existing anon/authenticated/service_role roles.
- Resolve the eight full signatures, requiring postgres-owned SECURITY DEFINER functions. Missing/changed signatures, owners or definer mode abort before revocation.
- Record effective authenticated/service access and a definition hash in a temporary table.
- Revoke EXECUTE from PUBLIC and anon, then check effective anon denial, preserved required access and identical definitions.
- Unresolved inherited anon access or loss of PUBLIC-only authenticated/service access aborts the whole transaction; no memberships or compensating grants are manufactured.
- Unrelated functions/default ACLs are unchanged. PUBLIC removal can also remove implicit access for other custom roles, so inventory legitimate non-client consumers before apply.

Functions: apply_admin_approved_food_alias(uuid,text,text), apply_owner_approved_missing_food_draft(uuid), get_entitlements(uuid), get_paywall_state(text,uuid), recompute_food_entries_for_food_ids(uuid[]), restore_purchase(uuid,text,text,text), rls_auto_enable(), start_purchase(uuid,text,text,text), all in public.

## Caller and acceptance boundary

The repository entitlementService calls auth.getUser() before get_entitlements/get_paywall_state and rejects a missing/mismatched session. Alias/owner-draft operations belong to authenticated administration flows. No runtime source caller was found for start_purchase/restore_purchase in the inspected master tree. Historical/unknown external callers are not ruled out by a source search. The ingestion recompute call still exists in master and is removed by separate Draft PR186; this candidate preserves authenticated access and does not replace that fix.

Before hosted apply, rehearse on the restored database as postgres, exercise actual anonymous PostgREST calls with fixture inputs (must be denied before entry), and exercise legitimate authenticated application flows. Do not call privileged mutation RPCs with real identifiers merely to test permissions. Use a disposable database or known test fixtures. Verify required backend/custom roles and retain private pre-apply ACLs with grantors/options for an exact reversal. Do not publish private ACLs or database definitions.

A candidate that preserves SQL EXECUTE does not prove that the HTTP caller has a valid JWT or correct row authorization. Native role tests supplement, rather than replace, the restored Supabase/PostgREST acceptance.

## Unresolved release blockers

- Authenticated cross-account checks inside get_entitlements/get_paywall_state.
- Forged or self-assigned admin/Premium fields and direct client billing/entitlement writes.
- Receipt/provider verification and idempotency in purchase/restore writers.
- Historical diary mutation through recompute and verified nutrition/recipe contracts.
- Future functions still receive PostgreSQL PUBLIC EXECUTE unless their creator defaults are separately hardened with an explicit caller inventory.

Do not present this patch as complete RPC authorization, a verified payment system or full application security clearance. A valid logged-in user is still an untrusted caller.

## Verification

The dedicated workflow provisions native PostgreSQL 17 and an isolated pg driver, with no Supabase credentials or app dependency changes. Eleven scenarios reproduce anonymous SECURITY DEFINER invocation, deny all eight calls after apply, preserve authenticated/service calls, keep unrelated RPC access, replay, and roll back inherited privileges, missing functions, owner/definer drift, PUBLIC-only required access and wrong actors.

The runner destroys public and creates cluster roles. It only accepts a loopback URL whose database is potok_rpc_test; never use it on a restored user database. Optional SQL_TEST_PGLITE_MODULE runs the same suite on an installed PostgreSQL 17 PGlite module.

Reference: [Supabase securing API functions](https://supabase.com/docs/guides/database/functions#function-privileges).

## Rollback-only restored database rehearsal

`scripts/security/anonymous-rpc/rehearsal.sql` runs the candidate checks and revokes in a transaction, prints ANON_RPC_REHEARSAL_OK and the eight effective permission results, then ends in ROLLBACK instead of COMMIT. Run it only on the restored Docker copy as non-superuser postgres with ON_ERROR_STOP=1. On any failure, disconnect/ROLLBACK and stop. It does not invoke any of the mutation RPC bodies. The existing 112-table row-count verification can run afterward.

Within the transaction, anon_execute must be false; authenticated_execute and service_execute must retain their pre-apply values. After ROLLBACK the original grants return, so this proves rehearsal behavior, not a permanent security fix. The suite checks exact pre/post ACLs and definition hashes for all public fixture functions and temporary evidence cleanup.
