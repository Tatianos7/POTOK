# Entitlement RPC remediation scope

Status: REVIEW ONLY. No database deployment.

The existing Premium RPC authority draft contains a proposed own-account guard for `get_entitlements(uuid)`. The next patch should isolate that guard from purchase, paywall, explainability and table-grant changes.

The existing client service passes the authenticated user's ID. Disposable local Auth/PostgREST acceptance passed own-account reads and cross-account and anonymous denial. This does not establish production deployment readiness.

Before deployment: verify all callers and the exact deployed function signature; review a standalone forward and rollback migration; rerun disposable acceptance with that exact patch; obtain owner approval for cloud changes.

Production, staging and master are unchanged by this report.
