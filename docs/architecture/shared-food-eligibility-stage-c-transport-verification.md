# Stage C disposable PostgREST/JWT and COMMIT verification

Base: PR158 `682d2c83dacec50f621297ffbac7914ec472637d`, review5479762049.
Separate branch/stacked Draft PR. NO POTOK runtime wiring, Supabase operations,
persistent ACL/migration apply, production, merge or changes to PR154–158.

## Executable boundary

Required transport entry invokes the existing OWN Unix-socket-only disposable PG17+
cluster, all57 predecessor tests, then real loopback PostgREST13.0.7. CI verifies
its official static-asset SHA256 (4153f81ccc40e7b735edc89cd84b49da25ba27eb37d57c7f6a82c9005a0b762b).
No external PG/PostgREST URL option. The Node PG wire proxy connects ONLY to that
cluster's private socket and binds loopback. Fixtures are synthetic, not copied data.

PostgREST authenticator LOGIN/NOINHERIT/NOBYPASSRLS can switch ONLY to anon or
 authenticated. Ephemeral random HS256 key exists only in memory and mode0600 test
config, removed with cluster. No injected/live JWT/key/credential is read or logged.
JWT signature and expiry are verified by actual PostgREST, session/user/authority
by unchanged SQL RPCs. Protected request.jwt.claims is not caller-supplied authority.
Signed fixtures simulate issuer identity; this does NOT prove real Supabase JWKS,
key rotation, issuer/audience policy or actual deployed role graph.

Exposed schema is public only. No arbitrary SQL RPC. Private probes are non-exposed
trigger code. One bounded SECURITY INVOKER, owner-A-only typed serialization probe
(integer1/2, fixed SQL/private synthetic table) intentionally obtains SERIALIZABLE
native errors outside catalog writes. It is created ONLY by test setup, never in SQL
drafts/migrations or runtime. No exposed set_config/admin-entitlement bypass.
Function isolation metadata is exercised by real PostgREST; catalog remains RC.

## Transaction and error matrix

| Check | Mechanism | Claim / limitation |
|---|---|---|
| Signed authenticated/anon/invalid role, tampering/unsigned/expiry | HTTP/JWT through actual PostgREST | cryptographic boundary, no signing-key logging |
| Revoked/expired/mismatched session; anonymous user | actual SQL session check | live DB-backed boundary, not JWT alone |
| Private RPC and trusted importer | existing SQL, real HTTP | fixed actor/source; no is_admin/service_role authority |
| Direct foods writes / ordinary reads | prospective ACL + ownership RLS | denies client writes, preserves SELECT; not all legacy SECURITY DEFINER paths |
| Catalog gate before first root lock | held gate, observed HTTP backend waiter, root NOWAIT | actual ordering, not timing assumption |
| Whole RPC transaction / rollback | late batch error and held protocol COMMIT | no visible partial rows; RC guards actually execute |
| 40P01 | real two-backend advisory deadlock, triggered through private create | no hand-raised fake engine error |
| Engine40001 | real two SERIALIZABLE snapshots/write skew, fixed test-only probe | outside catalog; RC catalog guard is NOT relaxed |
| Business40001 | stale CAS / foreign collision | details=POTOK_BUSINESS_CONFLICT_V1 |
| 42501 | actual session/ACL denial | native HTTP error fields retained |
| 57014 | actual statement_timeout | complete rollback; not success |

PostgREST error fields code/message/details/hint lack native routine. This adapter
NEVER reconstructs routine from message text or assumes code40001 means engine
serialization. Native retry helper remains unchanged and fails closed without routine.
No HTTP automatic retries, including 40P01/40001, auth, timeout and ambiguous COMMIT.
A structured PostgREST database error can prove rollback only for the originating
statement/transaction, not a previous HTTP request. Connection503/PGRST errors are
not reclassified as confirmed rollback.

## Fault / outcome matrix

| Scenario | Injection/barrier | Client result | Independent test observer |
|---|---|---|---|
| SQL result before COMMIT | protocol COMMIT held after CommandComplete | not acknowledgement; request pending | row invisible until release |
| Disconnect before COMMIT | intercept COMMIT, close connection without forwarding | UNKNOWN, no retry | ABORTED only after backend termination + no row |
| COMMIT in flight / commit ACK lost | forward COMMIT, observe backend COMMIT completion, drop before forwarding acknowledgement | UNKNOWN, no retry | COMMITTED; lost backend ACK is not a client proof |
| Reset after SQL result | drop PG stream on RPC CommandComplete before COMMIT | UNKNOWN, no retry | ABORTED after confirmed backend termination |
| COMMIT succeeds, HTTP response lost | consume upstream complete200, destroy downstream without headers/body | UNKNOWN, no retry | COMMITTED; observer alone saw HTTP acknowledgement |
| Client timeout after accepted request | wait for actual gated PostgREST backend, abort HTTP client, release gate | UNKNOWN, no retry | backend may abort or commit; observed state recorded |

In-flight injection covers the commit-ack window, not every OS/power/network schedule.
No claim that an arbitrary disconnect before a timestamp proves rollback. No receipt
or status is inferred from text messages. Caller HTTP200 counts only after complete
body verification and fixed db-tx-end=commit (no tx preference override). SQL result
alone, unverified/truncated body or ambiguous COMMIT never qualifies.

## Read-only reconciliation: bounded conclusion

Food ID + stable binding + exact opaque digest can identify FINAL STATE, not operation
causality/history. Identical state may already exist, another writer may produce it,
a later write may replace it, and absence may occur while original request is running.
Private CREATE generates ID inside transaction; lost response can lose that ID.
Imported explicit IDs help locate rows but do not prove one batch committed or who
caused it. Sequential independent SELECTs are not an atomic batch receipt.

Therefore MATCH / ABSENT / DIFFERENT all keep operationStatus=UNKNOWN and
retryAllowed=false. Tests must not call this exactly-once reconciliation. No durable
receipt table is added. Receipt/operation-token design is a separate owner decision
if persistent jobs require exactly-once/replayable outcomes; unresolved causal
reconciliation and unknown-COMMIT retry remain BLOCKED.

## Compatibility / readiness

| Area | This stage | Persistent rollout gate |
|---|---|---|
| Private/create/import SQL & Phase1 wire | unchanged | production ownership/grants/full-schema parity |
| New local PostgREST/JWT/fault suite | executable, actual counts in PR/run | issuer/JWKS/key rotation, real JWT deployment |
| Native bounded transaction retry | unchanged, HTTP lacks routine | no automatic HTTP retry; reliable discriminator needed |
| Existing consumers/foodService | no imports/endpoints/activation | separate controlled client cutover |
| Legacy/owner-apply/external writers | not adapted | all-writer integration |
| Performance, archive/retention/account deletion | not solved | remain BLOCKED |

GO only for actually passing disposable verification. Persistent Staging/Main/runtime
and production remain BLOCKED. A green test validates fail-stop semantics, not a
solution to UNKNOWN. Exact CI HEAD/counts must be taken from real logs; no SKIP/TODO
allowed in required suite. Next safe action: independent review of evidence and
separate design for durable operation reconciliation before persistent transport.
