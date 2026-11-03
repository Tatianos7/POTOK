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

Official Edge results will be appended after the measured run. Synthetic local
CPU timings are not a 12,000-user load test or hosted acceptance.
