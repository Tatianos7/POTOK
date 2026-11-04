# Node worker AAAA mode and one-request test preparation

Continues #308's owner-local acceptance: two real connection-only PASS reports
on macOS / Node 24.11.1. This change prepares the worker transport; it does not
execute a generation, change Staging data, deploy a handler or turn on the generator.

## Worker transport

The worker now separately recognizes `POTOK_GENERATION_WORKER_DNS_MODE=DNS_AAAA`.
Its default remains SYSTEM. The connection-checker's DNS/gate variables do not
enable or choose the worker. An invalid worker mode fails before file/runtime work;
the disabled worker still reads no config, performs no DNS and opens no sockets.

The explicit runtime owns and validates both secret/config snapshots before DNS,
uses the already tested fixed-host resolver once, then constructs the existing
restricted source/gateway pool pair. Only numeric transport changes: logical TLS
servername, CA, verification, channel binding, roles, max-2 pools, transaction and
query bounds remain unchanged. There is no fallback to SYSTEM/Edge/a pooler on error.
Current CA validity is rechecked when the deferred pool factory is invoked.

Abort before/during DNS cannot allocate pools. Abort afterwards closes the same
shared enabled gate; the host retains idempotent shutdown and late-success suppression.
The small fixed-target constant is moved to an independent module so DNS and pool
composition do not create a module cycle. Existing imports remain compatible.

The build manifest records supported/default worker modes. CLI outputs remain the
existing fixed outcome/status contract. The artifact is still disabled by default.
No enabled execution command or actual worker config is issued by this test plan.

## Fresh Staging readiness observation

Administrative SELECT-only inventory on 2026-11-04 returned:

| Required runtime source | Rows |
| --- | ---: |
| Current candidate manifest head | 0 |
| Current generation policy head | 0 |
| Preparation sources | 0 |
| Validation inputs | 0 |
| Final independent warning sources | 0 |

Both request/status SQL functions exist and grant EXECUTE to authenticated.
The project has zero deployed Edge Functions. This does not prove or disprove
ordinary-account PostgREST acceptance: execute grants alone are not an Auth test.
The existing request-only handler may be deployed separately if that is the chosen
test path; the observation does not make Edge deployment a compulsory prerequisite
for a reviewed authenticated SQL-RPC test. No endpoint is deployed by this change.

The metadata queries did not invoke generation functions or return account/request
payloads. The repeatable counts query is in
`scripts/security/generation-node-worker/test-readiness.readonly.sql`; it is for
trusted administrative review. Do not broaden the narrow roles' table privileges
to run it. Counts never confer source admission or activation authority.

Exact sanitized readiness is retained in
`generation-single-test-readiness-20261104.json` beside this document. Status is
**BLOCKED_RUNTIME_SOURCE_ADMISSION**, not runnable or write-approved.

## What must be prepared for one actual test

1. Produce a small independently reviewed runtime catalog and its required evidence.
   The authoring catalog and offline week previews remain usable for development,
   but they do not approve canonical identities, carbohydrate semantics, allergens,
   dietary classifications or meal eligibility. The supplied offline report explicitly
   says those checks were not performed, and LUNCH-as-DINNER was experimental.
   Do not copy authoring data into runtime or reuse synthetic test attestations.
2. Pin the generation/optimization/metric/validation policy revisions and a real
   owner test account's accepted goal, preference and safety context. Do not invent
   convenience evidence, yields, grams or servings. The owner's cooking deferral
   remains in force; cooking every recipe is not a new coding prerequisite.
3. Prepare request-bound preparation/validation and independently admitted warning
   sources under existing contracts, without changing the restricted-role grants.
4. Build a concrete scoped Staging mutation package with actual revision/request
   identities, source provenance, normal-account Auth path, expected writes and
   recovery checks. Only then request the owner's specific write approval.

After that preparation/approval, the intended test scope is one server-created
request for the owner test account, one Node attempt with the explicit DNS mode,
one generated week and activation of that week only. Global app/dispatch activation,
bulk requests and Production are outside that scope. No request UUID is fabricated
in this plan. A request must come through the existing account-authorized protocol.

Acceptance must inspect the actual stored canonical plan through the ordinary account,
then open it in the app; verify days/slots, required safety/target/repeat checks,
zero FACT entries from PLAN, correct request/account binding, final source currentness
and idempotent status/recovery. A lost commit reply remains UNKNOWN until the existing
read-only recovery protocol resolves it. Do not configure automatic retries.

These requirements are not satisfied by this transport change. The existing caller
will fail closed on missing sources; no grant widening, placeholder approval or
weak validator is added to make a test appear successful. Hosting/resource budgets
and 12,000-user capacity remain separate work.

## Validation

Targeted tests cover the real inactive AAAA runtime/pools, secret ownership across
DNS await, CA recheck/expiry, invalid reply/abort, explicit host factory selection,
no fallback on errors, and standalone default-off behavior with DNS mode set.
Existing pool/runtime, read-only checker, resolver and native IPv6 TLS regressions
are included. CI packages both executable tools without secrets or deployment.
