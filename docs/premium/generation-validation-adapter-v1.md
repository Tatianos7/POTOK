# Request-bound generation validation adapter v1

Status: **INACTIVE PURE ADAPTER; NO LIVE AUTHORITY LOADER / EDGE WIRING**.
Base: generation checkpoint #244, published-client chain at
`1976b330111a802942af7e29161050e316990f99`.

## Implemented boundary

`createGenerationValidationAdapterV1(trustedPort).validate(requestOperationId, generatedPlanRaw)`
accepts only a canonical request UUID and primitive proposal JSON text. It computes
SHA-256 of that exact UTF-8 text, loads a request/proposal-bound authority package,
checks its request/account/input binding and calls the existing
`validateGeneratedWeekPlanTrustedV1` with independently supplied policy, context and
warning raw strings. It adds no nutrition calculation or policy defaults.

The trusted port returns either `null` (explicit unavailable/BLOCKED) or a primitive
JSON string with exactly the fields of `GenerationValidationAuthorityV1`. Its
`requestOperationId`, `accountId` and `generationInputDigest` must be loaded from the
durable protected request; `evaluatedPlanRawSha256` binds the exact evaluated proposal.
The context's generation input must independently match all three request bindings.
Nested raw context/input are duplicate-checked before parsing. The existing validator
independently checks the remaining context, policy, manifest, preference, safety,
component, eligibility, nutrition and warning evidence.

This port is a **trusted server dependency**. Its implementation must acquire/pin
authorities independently of the client and generator, with appropriate actor/access
checks. A self-consistent replacement of the entire port/package can forge provenance;
this pure adapter cannot detect a compromised trusted source. Neither a hash nor a
typed interface authenticates that source. No database loader, authority store or
new RPC is implemented by this package. The port must not copy generator-supplied
policy/context/warning values into the trusted package or calculate missing warning
signals as false. Async port exceptions (including failed Promise resolution) propagate.

## Result and failure semantics

- ACCEPTED returns the exact unchanged proposal text, its raw SHA-256, request ID and
  the existing immutable trusted-validator result. There is no record/activate method.
- REJECTED/BLOCKED validator results preserve their structured reasons and expose no
  accepted proposal text. Missing port data returns an explicit BLOCKED reason.
- Wrong request/proposal/input binding and malformed trusted packages throw;
  unexpected validator/platform/loader errors are not swallowed or retried.
- No successful validation cache is retained across requests or retries.
- Raw hashes bind transport bytes, not the Graph's canonical digest. Whitespace or
  key-order changes require a package for the new raw bytes even if semantic content
  is unchanged. Existing Graph/content/evidence digest domains are untouched.
- Lone UTF-16 surrogate characters that TextEncoder would replace are rejected before
  hashing. JSON-escaped Unicode remains normal raw JSON for the existing decoder.

ACCEPTED proves pure validation against the supplied trusted inputs only. It is not
a database capability, write receipt, entitlement/currentness check or ACTIVE plan.
Future record/activate integration must repeat the protected request actor, live
entitlement, revisions and CAS checks at its actual database transaction boundaries.
The returned data can be copied; callers must never treat TypeScript result shape as
cryptographic authorization.

## Tests and preserved scope

The adapter tests invoke the actual strict week validator using the existing synthetic
seven-day fixtures. Those helpers were moved into a test-only module shared with the
unchanged original validator scenarios. They are not published recipe data, clinical
rules or real authority issuance. No production module imports the fixture module.

Cases cover accepted exact bytes/receipts, absent authority, raw-only arguments,
request/account/input/proposal substitution, duplicate JSON, missing/extra authority,
re-signed policy substitution, allergies, malformed/FACT-contaminated output, missing
warnings, async failures, concurrent independent requests and no cached acceptance.
The PR workflow runs adapter and policy/evidence/warning/validator regression suites.

The old Edge `TrustedGenerationValidatorV2` interface and null entrypoint remain
unchanged: they cannot obtain this richer trusted package yet. The next integration
step is a reviewed protected authority-loader transport, followed by proposal-provider
and record/activate recovery acceptance. Real source evidence, measured recipe yield,
weekly catalog feasibility, staging and separately approved deployment remain open.
No SQL, schema, grants, FACT writes, flags, generator activation, AI, payment or
hosted database operations are introduced here.
