# Stage 3: private exact retained proposals on PostgreSQL

This continues PR351's retained-snapshot protocol with a fixed SQL transaction adapter and a disposable-only private storage candidate. It does not activate a menu, convert an exact graph to Graph V2, change request/selection workflow state or create nutrition FACT. Production/source/metric issuers and UI deployment remain separate.

## One connection and existing authority

The adapter acquires one exclusive already authenticated connection, begins READ COMMITTED, proves the exact narrow gateway session identity and supplies that same fenced connection to the optimizer's source/metric adapters. Only a copied server-configured statement allowlist is exposed to those adapters. There is no client SQL selector, SET ROLE, service-role/owner fallback, cross-session read, process cache or automatic retry. Callbacks/capabilities close before COMMIT. Work failure rolls back and discards; an uncertain COMMIT or committed-release failure preserves the existing UNKNOWN protocol.

READ COMMITTED plus the existing request/account/head locks lets a concurrent duplicate observe the committed retained row after waiting. SERIALIZABLE could retain a pre-wait snapshot and require an explicit recovery/retry; this adapter does not silently retry. Source/metric adapters must lock all additional current heads and preserve immutable source history on the same connection. The real protected V3 source/metric issuer/readers are still integration dependencies; a caller-supplied JSON packet is not their implementation.

Private SQL functions use the existing assert_generation_request_current_v2, effective Premium/account gate and canonical JSON primitives, checked against pinned owner/body/security metadata before disposable installation. The effective caller must be postgres only as the function's definer and the real session must be the unprivileged exact gateway login with no inherited roles/memberships. Direct owner/SET ROLE/JWT labels do not establish the session. Durable request account/input/selection bindings, status and canonical input digest are rechecked; no new permission ledger is introduced.

## Immutable artifact storage

The new internal table contains one retained, unadmitted proposal per existing durable request, with a restrictive FK, canonical raw bytes, input/owner identity and generated storage hash. It has forced RLS, no client/service/gateway table grants and no UPDATE/DELETE/TRUNCATE path. Only the three guarded current/read/retain functions receive narrow gateway EXECUTE. No sequences or public Data API endpoint are added. Existing requests/selections retain their status.

The retained artifact must preserve NONE/false write/activation flags and empty facts in both parent and child graph. SQL verifies canonical JSON, owner/input/proposed revision, actual proposal/admission hashes and retained/proposal/graph/optimization hash domains. Those checks protect retention integrity; they are not an independent food/recipe/metric approval or a replacement for the full exact optimizer. A privileged backend can retain an unadmitted artifact only; future activation must still independently admit all required evidence.

All SQL is guarded to the exact disposable database/session/GUC and is not a live migration. It is not applied to Staging/production. A later installation package and source-authority/role review are still required before real runtime use.

## Native verification

A new PostgreSQL CI matrix suite uses actual pinned node-postgres leases and the real exact optimizer/admission protocol. Its packet table/function and metric assessor are explicitly synthetic test-only sources, accessed and locked through the same narrow connection. The fixture reuses the real existing Premium/currentness definitions and real PostgreSQL locking/ACL behavior; it does not issue approvals for the real catalog.

The native scenario deliberately holds the first INSERT, starts a concurrent duplicate, proves the uncommitted row is invisible, then loses the first actual COMMIT reply. It expects one stored row, UNKNOWN for the lost reply, replay for the waiting duplicate and read-only recovery/opening. It also checks immutable bytes/FK/RLS, owner/client/service/SET ROLE denials and stale Premium/selection/safety heads without modifying retained history. Hosted TLS is not inferred from a loopback native test; Node TLS CI remains separate.

Native results are pending the new CI run. Local adapter tests, strict TypeScript, lint/build and inherited regressions are verified separately. PR351 passed main PR Checks, all PostgreSQL suites and Node TLS/protocol; the unchanged Edge diagnostic remains failing because of the documented upstream peer-certificate capability gap.
