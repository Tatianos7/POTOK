# Node execution candidate and unresolved Edge capability

## Verified upstream boundary

On 2026-11-06 the official Edge Runtime release list showed v1.78.1 (2026-11-05). Its vendored Node TLS implementation still has an unimplemented getPeerCertificate method without actual peer raw DER. The source is read directly, not inferred from a generic Deno version:

- https://github.com/supabase/edge-runtime/blob/v1.78.1/ext/node/polyfills/_tls_wrap.ts — blob 510b29475ead1eaba4d03549d55b71276ec1980e.
- https://github.com/supabase/edge-runtime/blob/v1.78.1/deno/Cargo.toml — blob 7d9ff170f4a4ce3d82096705f9a97ee86984fb6b, version 2.1.4.
- https://github.com/supabase/edge-runtime/releases/tag/v1.78.1.

Changing this project's image pin cannot supply a missing upstream capability. No pg authentication/TLS method is patched, no certificate bytes are fabricated, no password/channel-binding fallback is added and no negative test is disabled. The existing Edge full-worker workflow remains unchanged and failing. This stage does not claim that Edge is fixed.

PR350 at b496202e444bd3bb251c80fa1c8fda40afdb64c6 passed PR Checks run42165680437 and PostgreSQL admission run42165680434. Edge run42165680438 failed its valid connection and proper wrong-password authentication cases. The same bundled pg/ephemeral database passed the Node baseline, with peer raw DER available. Negative CA/name tests remain mandatory.

## Explicit supported candidate

The repository already contains the disabled Node 24 worker, strict CA/name validation, pg 8.23.1 with channel binding, narrow reader/gateway logins and bounded transaction/UNKNOWN behavior. The operator host rejects Deno and unsupported Node/platform versions before opening a runtime. Reuse that candidate; there is no automatic Edge-to-Node fallback.

A separate Node CI workflow reuses the exact ephemeral TLS/role fixture, bundled pinned driver and all eight valid/wrong-CA/wrong-name/wrong-password assertions for both roles. It additionally executes the existing 7-meal, 28-meal robust and 28-meal strict worker protocol/profile tests and disabled-factory checks. This distinguishes a passing supported-runtime gate from the unchanged failing Edge gate. The two tests are not substitutes for each other.

This remains synthetic/local CI acceptance. It does not prove a hosted Node machine exists, real Staging TLS/role admission, full exact V3 source/store integration, application acceptance, capacity for 12,000 users or production readiness. No provider is selected/provisioned, account is created, data is transferred to a new service or host is purchased. Supabase remains the existing database/Auth/storage. Any actual new host/service decision must follow the owner's notice rule before dependency, cost or deployment.
