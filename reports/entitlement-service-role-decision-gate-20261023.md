# Entitlement service-role policy decision gate — 2026-10-23

Status: NO-GO for deploy; review only.

## Verified
- Run 39904704220, job 120253861275: exact isolated entitlement patch and candidate forward → rollback → forward all PASS on disposable Supabase; real Auth/PostgREST own/cross-account/anon acceptance PASS.
- Production SELECT-only pg_proc inspection: among SQL-language/plpgsql public functions, the only other function definition referencing `get_entitlements(` is `get_paywall_state(text,uuid)`. This does not prove no external Edge Function or service-role client calls it.
- Client `src/services/entitlementService.ts` obtains user ID via `auth.getUser()` and calls with the same ID.

## Remaining risk
The forward candidate grants EXECUTE to `service_role` but the function body checks `auth.role() = 'authenticated'`. Therefore a normal service-role JWT cannot call it. A grant alone does not guarantee service-role compatibility. We must not label this compatible without a documented owner decision and dedicated service-role acceptance test.

## Recommended contract (PROPOSED)
- Authenticated user: read own entitlements only; explicit other UUID → SQLSTATE 42501.
- Anon: no EXECUTE; deny.
- Trusted service_role: **decision required**: either explicitly support any-user reads with a guarded service-role branch (only if a legitimate backend use case is demonstrated) OR intentionally deny and remove misleading service_role EXECUTE grant.
- Never accept `p_user_id` from an untrusted caller as authority; backend service keys must never reach clients.
- Paywall inherits the entitlement guard, so anonymous and cross-account paywall calls are denied.
- For failure recovery, prefer a safe corrected forward migration over restoring the vulnerable prior function. Legacy rollback is an emergency-only artifact.

## Next actions
1. Audit actual service-role consumers (Edge Functions, deployment configs, external services) and decide supported behavior.
2. Add explicit service-role positive/negative acceptance and paywall delegation cases.
3. After that, finalize forward migration and a security-preserving rollback strategy.
4. Obtain explicit owner approval before any staging/production write. No cloud DDL executed.
