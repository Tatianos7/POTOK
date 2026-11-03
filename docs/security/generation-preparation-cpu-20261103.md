# Attempt-scoped preparation validation and Edge TLS diagnosis

Continues #304. No deployment, Staging mutation, source admission or activation.

## Preparation CPU

The CPU profile showed repeated raw parsing, canonical serialization, digest
validation and timezone construction. One avoidable source was the prepared-meal
warning boundary: it decoded the same pinned input, manifest, preference, safety,
evidence and policies for every candidate meal.

`createPreparedMealWarningDecoderRawV2(policiesRaw, contextRaw)` now admits that
immutable raw snapshot once. Its private closure retains only parser-owned values.
Every call still independently parses and checks the warning and meal, recomputes
their digests and verifies slot, type, goal, composition-policy and evidence bindings.
The existing one-shot API wraps this same implementation.

`generationDayOptionsV1` creates one decoder inside each preparation invocation.
There is no process-wide cache, shared request state, skipped warning-source read,
retry, synthetic warning or source publication. Final validation still performs
fresh authority reads and checks the complete plan/set before storage. PLAN != FACT.

The server storage loader also uses native hex conversion after its unchanged
strict lowercase/even/nonempty descriptor admission. It reuses the owned bytes
after checking their storage hash, keeping fatal UTF-8, BOM, duplicate-key and
exact canonical-byte validation. No input is silently normalized by Buffer's
otherwise permissive hex decoder.

Tests cover single/batch equivalence, concurrent independent meals, swapped entries,
tampered digests, duplicate raw keys, hostile objects, fresh invalid contexts and
all four stored descriptor fields with odd, uppercase, whitespace, empty, prefix
and invalid hex. Existing final-source revocation, identity and write-flow tests
remain in the targeted run.

## TLS diagnosis

The CI-only pg client now observes whether the actual TLS stream exposes a
nonempty DER `getPeerCertificate().raw`, without replacing the stream or method.
This supplies evidence before authentication; it does not manufacture certificate
bytes or disable channel binding. The Node and Edge runs use the same observer.

Primary source: Deno v2.1.4 `_tls_wrap.ts` has an unimplemented
`getPeerCertificate()` returning a placeholder with no `raw` member:
https://github.com/denoland/deno/blob/v2.1.4/ext/node/polyfills/_tls_wrap.ts
Pinned pg 8.23.1 `lib/crypto/sasl.js` reads the actual peer certificate's raw DER
for `SCRAM-SHA-256-PLUS`, then passes it into its certificate signature parser.
Missing raw DER is consistent with the previously observed index-'0' TypeError.
The actual official Edge observation must confirm capability absence; generic
Deno source alone is not sufficient to prove which Edge failure path ran.

No production pg method, authentication setting, CA/name verification or CPU limit
is patched. Successful compute cases would still not make this runtime acceptable
without successful strict database connection. The full Edge gate remains strict.

## Observed official Edge result

Run [41666087058](https://github.com/Tatianos7/POTOK/actions/runs/41666087058), job
126021663902, code commit `b521edcbae5ef782b4b25224a8f936fec1e6ce70`.
Exact synthetic JSON is retained in `generation-preparation-cpu-observation-20261103.json`.

| Diagnostic | Result |
| --- | --- |
| 7-meal worker | Completed; measured worker wall interval about 537 ms |
| 28-meal robust worker | Completed; about 1,639 ms wall interval |
| 28-meal strict worker | Completed; about 1,699 ms wall interval |
| All successful generation outputs | Expected meal count, zero facts, one record/activation protocol call, two final-authority reads |
| Intentional CPU overrun | Cancelled by the runtime at the unchanged CPU limit |
| Node TLS baseline, both roles | All eight checks pass; actual peer raw DER available on valid and wrong-password connections |
| Edge TLS, both roles | Actual peer raw DER unavailable; valid acquisition still fails with the same TypeError |
| Edge negative TLS tests | Wrong CA and wrong DNS name rejected for their proper reasons |

Both previously cancelled 28-meal fixtures now complete with the same 2,000 ms
local user-worker CPU limit, 256 MB memory limit and cold per-request isolates.
Reported wall intervals exclude fixture setup, while limits still include setup
and module loading. This is one sample of each synthetic case, not a margin,
worst-case, sustained-load or hosted-accounting guarantee. No exact CPU/RSS value
is claimed where the runtime does not supply one.

The missing peer raw-DER capability is now observed in the actual official image,
not merely inferred from generic Deno. Combined with the pinned pg PLUS-auth code
and upstream Deno stub, it localizes the compatibility blocker. We have not disabled
channel binding, supplied pretend peer bytes or replaced TLS methods to force a
successful connection. Wrong-password authentication in Edge remains unproven
because acquisition fails before that expected server response.

The full Edge gate remains **failing** on required valid connection. General PR
checks, the separate Edge CA workflow and PostgreSQL admission workflow pass on
the tested commit. Local validation: 122 initial targeted tests; then the expanded
32-test storage-loader suite, TypeScript, targeted lint, production build/postbuild
and diagnostic bundle build passed. Final commit only records observations.

## Execution placement implication

The existing strict Node runtime composition is the supported candidate for the
database-connected worker while the pinned Edge runtime lacks this TLS capability.
There is no automatic fallback from Edge to Node. This does not select, purchase,
provision or claim access to a Node host; any hosting/provider decision must follow
the owner's existing service-notice rule. Supabase remains the existing database,
Auth and request/status infrastructure. No hosted generator is activated.

Synthetic local timings are not a 12,000-user load test or hosted acceptance.
