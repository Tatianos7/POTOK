# Exact Food nutrition evidence V2: representation and trusted-read boundary

Status: unmounted candidate, synthetic control-flow validation only. No real
review issuance, source approval, HTTP endpoint, SQL persistence or activation.
Parent: Draft #342 (`05aa17403daaa08d531b1cccf4177043919209e1`), both CI workflows passed.

## Versioned artifacts

`exactFoodNutritionEvidenceV2.ts` adds a separate revision contract/encoding and
separate revision/event SHA256 domains. Canonical food identity remains the
existing V1 revision. A V2 nutrition revision binds revision/supersession/review
IDs and an immutable V2 source proposal. That embedded proposal retains its
original `NONE / REVIEW_REQUIRED` status: an external approval event reviews that
exact payload rather than rewriting proposal history. The source proposal
continues to verify independent canonical/numeric/full-source pins, retained
bytes, mappings and exact food-state applicability.

| Event | Bound object | Additional checks |
| --- | --- | --- |
| REVIEW_APPROVED | Exact nutrition revision ID/digest/canonical food ID | Event ID equals revision reviewEventId |
| REVIEW_REJECTED | Independently pinned source proposal digest/canonical food ID | Reason required, no fake reviewed revision |
| INVALIDATION | Exact nutrition revision ID/digest/canonical food ID | CORRECTION or SAFETY_CRITICAL and reason required |

Every event requires V1 OWNER_ADMIN_REVIEW authority-context representation,
SERVER timestamp declaration, UUID idempotency reference and request digest.
Representation alone authenticates none of these claims. Reuse the V1 context
validator through an additive export; no new roles, entitlement ledger or
attestation mechanism. Strict exact fields, Unicode/UUID/date checks, bounded
raw duplicate-aware JSON and canonical digest verification apply. Canonical byte
helpers exclude only the artifact's own digest field; they are not issuance APIs.

The shared bounded JSON parser rejects negative zero and unsafe numeric values
before nested JSON serialization. This prevents `byteLength: -0` from being
normalized to zero before the established retained-source validator sees it.
Nutrition remains strings/rationals. Both PER_100_G_FOOD and PER_100_G_EDIBLE
are retained explicitly; neither is silently converted into the other.

## Server read boundary

`resolveExactFoodNutritionReviewedSnapshotV2` requires an independently loaded,
complete **atomic server-owned** snapshot with selected revision heads, current
food state, source mapper pins, both approvals and all events affecting either
revision. Browser/request objects must never supply this snapshot or its pins.

The adapter verifies:

1. Exact revision/source/canonical bindings and requested identity/current heads/state.
2. Canonical V1 approval and exact nutrition V2 approval, with distinct event IDs.
3. Explicit event-time authorization of both approvals and every history event.
4. Complete history includes both exact approval digests, no duplicate IDs or
   substituted payloads under the same ID. Any invalidation blocks regardless of
   severity or event order. Rejected, unrelated, missing and malformed events block.

The existing `ReviewedEvidenceAuthorityV1` port is generic with a V1 default;
its function-property parameter is contravariant under strict TypeScript. A
V1-only implementation cannot silently become a V2 verifier. The V2 adapter
uses the union of existing canonical V1 and new exact nutrition V2 events.
Only literal `true` counts as authorization. There is no default allow verifier.
The positive test double returns true solely to verify adapter control flow.

Raw strings/history are copied before awaiting authorization to avoid mixing
caller-mutated snapshot generations. Histories are dense and bounded to 1024
entries. The result is immutable `REVIEWED_EXACT_V2` with exact numeric input and
revision/approval/source digests, or UNRESOLVED. No legacy REVIEWED coercion or
rounded-decimal fallback is provided. Consumers must preserve the source basis.

An incomplete history with concealed invalidations is not detectable by hashes.
The real store must guarantee completeness and transaction consistency. This read
result is not a write authorization or a proof that no invalidation occurred
later: subsequent use requires the existing transactional currentness gate.
There is no authorization or approval claim for the 19 real pilot recipes.

## Compatibility and integration limits

Existing V1 wire fields, canonical bytes and three-decimal constraints remain.
V1 event/nutrition decoders reject the new artifacts. Authority representation
refactoring and generic port typing do not change V1 runtime behavior. Graph
V1/V2, diary and server resolver contracts remain untouched and do not admit V2
nutrition automatically. Source-basis conversion is not implemented.

Full issuer/attestation/storage code remains in separate unmerged Draft #154
(inspected exact head `b36f55500fc4b142bfa7b3029dc4c511a9d58c75`) and subsequent
integration work. Its JWT/attestation, immutable storage, CAS, receipts, retry and
invalidation controls must be integrated explicitly; this change neither copies
that Draft nor claims it is deployed. No V1 carrier event wraps a V2 payload.

Next integrate exact nutrition into a separately versioned Graph contract and
complete authenticated review/store issuance compatibility over the established
authority model. SQL representation/storage/readback, CAS/idempotent issuance,
real JWT/PostgREST validation and rollout remain outstanding. None of those is
proven by a synthetic port returning true. Cooking/yield checks remain deferred
until owner application testing; unknown data remains unknown.
