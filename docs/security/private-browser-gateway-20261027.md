# Restricted local browser gateway

This prepares a transport boundary for restored-copy application acceptance. It does not launch a browser on the owner's Mac, open Docker ports, resume SMTP capture, create users, grant authority or change any database. The owner browser controller/runtime bundle and scoped preservation proof remain to be implemented and tested before issuing a command.

## Fixed endpoints

`scripts/security/combined-api/private-gateway.mjs` listens only on `127.0.0.1:13004`. Default private mode connects directly to loopback Auth 13002 and REST 33001, stripping `/auth/v1` and `/rest/v1` client prefixes. It owns no database password, signing key, service-role credential or OTP capture. Ordinary browser Authorization/apikey headers pass through to existing service checks. Its HTTP client uses a fresh direct connection (`agent: false`), not an environment proxy or redirect follower.

The CI-only mode requires GITHUB_ACTIONS=true and maps these same client paths to fixed disposable Supabase on loopback 54321. It accepts no arbitrary upstream URL or hostname. This guard selects a synthetic fixture; it is not a security boundary against an operator changing the environment.

| Prefix | Suffixes | Methods |
| --- | --- | --- |
| /auth/v1 | /otp, /verify, /token, /logout | POST |
| /auth/v1 | /user, /health, /settings | GET |
| /rest/v1 | /user_profiles | GET, POST, PATCH |
| /rest/v1 | /foods | GET |
| /rest/v1/rpc | /has_verified_entitlement_v1, /get_entitlements, /get_paywall_state | POST |

These are current profile harness routes, not a general Supabase replacement. Storage, Realtime, admin user APIs, signup, password mutation, program writes, authority issuance and unknown resources are unavailable. Profile writes still require actual user JWT/column privileges/RLS; this gateway does not substitute for those controls.

Canonical matching rejects absolute URLs, encoded/ambiguous paths, unknown suffixes and methods. CORS accepts only harness origin `http://127.0.0.1:55440` with explicit route/method/header preflight. Hop-by-hop, Connection-nominated and forwarding headers are removed; Host is reconstructed for fixed loopback. Upstream redirects are rejected, cookies removed, upstream CORS replaced by the local policy. CONNECT/WebSocket tunnelling is closed. Header size/time and bodies are bounded; a complete body of at most 2 MiB is read before contacting a mutation endpoint. Local failures produce generic errors without printing headers, bodies or credentials.

This process alone does not create network isolation or block a separate browser's outbound network. The future private controller must place gateway/browser/capture in the captured network-none namespace, validate identities/ports/runtime and block non-local browser traffic. It must retain original-row/schema/security postconditions from #215 and scope changed test profiles to exact captured synthetic IDs. No network-none guarantee is inferred from a host-side CI test.

## Validation and integration

Nine native tests/subtests cover exact routes/methods, header filtering/CI admission, real HTTP forwarding, bounded CORS, rejected paths/origins/redirects, no upstream request for oversized bodies, CONNECT/WebSocket closure and generic failed-upstream errors. Tests bind their own synthetic servers before contacting those ports and fail if ports are occupied. They do not query Docker or hosted services.

The actual browser harness now uses the gateway as its only API origin. Its request guard allows only harness/gateway origins; direct browser calls to the old disposable Supabase origin are blocked. The Node-side mail reader uses fixed synthetic local Mailpit and never exposes codes through the gateway. Existing Login/Profile/AuthProvider/profileService, avatar/refresh/offline/account/authority and #216 recovery assertions must still pass. `PRIVATE_GATEWAY_BROWSER_OK` requires final `EIGHT_COMBINED_BROWSER_OK` and `EIGHT_LOCAL_VERIFY_APP_OK` on the same head.

Local protocol tests pass. Exact-head real browser CI must pass before accepting transport. This is still synthetic CI, not full restored-copy UI acceptance or hosted release approval.
