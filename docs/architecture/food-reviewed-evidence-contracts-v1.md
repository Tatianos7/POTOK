# Food reviewed evidence contracts v1 — Phase 1

`src/utils/foodReviewedEvidenceV1.ts` provides pure representation, strict raw JSON
validation, canonical bytes and SHA-256 integrity. It does not issue evidence,
authorize reviewers, determine historical/current validity, or change catalog,
resolver, importer or Premium behavior. A valid hash is not provenance. Test
fixtures are synthetic and are not production evidence.

## Identity and revisions

The existing `foods.id`, `canonical_food_id`, and `stable_food_id` remain the only
operational food identities. Canonical revisions require a shared core/brand root:
`foodId === canonicalFoodId`, an existing stable key and explicit
`sharedCatalogAccessible: true`. Artifact UUIDs identify revisions, events and
retained source snapshots only. Aliases are exact snapshot strings, not IDs.

The identity snapshot explicitly retains name, nullable original name, normalized
name, nullable brand/normalized brand/barcode, and aliases. No normalization is
performed by the decoder. Array order is significant; duplicate aliases reject.
Food state uses the existing Graph v1 vocabulary. Applicability v1 is exactly
`{kind: 'EXACT_FOOD_STATE', foodState}` and must match the revision's state.

Both revision classes require an explicit nullable supersedes pointer. Self
supersession rejects. The pointer does not claim that a predecessor exists or is
invalidated; this phase has no history reader. Supersession and invalidation are
independent.

Nutrition is exclusively `PER_100_G_EDIBLE` with explicit kcal/g units and all five
fields, including fiber. Values are non-negative decimal strings with exactly
three fractional digits and at most nine integer digits, without leading zeroes
except zero itself. Null/missing/number/exponent values reject. The separate
source normalization helper accepts only strings and discards only trailing zeroes
beyond scale 3; it never rounds or performs floating-point nutrient arithmetic.

## Raw boundary and bindings

All artifact APIs accept primitive JSON strings, use the existing duplicate-aware
parser before JSON.parse, reject unknown and missing fields at every object level,
and validate all values before returning an owned, deeply frozen graph. Text must
be valid Unicode without unpaired surrogates. UUIDs are lowercase RFC variant UUIDs
with versions 1–8. Timestamps use exact UTC `YYYY-MM-DDTHH:mm:ss.sssZ` and must
round-trip without calendar normalization. No implicit defaults are supplied.

`decodeNutritionReviewedRevisionRawV1(raw, canonicalRaw)` verifies the canonical
revision itself and binds its ID, digest, food root and state/applicability.
`decodeFoodEvidenceReviewEventRawV1(raw, targetRaw, canonicalRaw?)` verifies the
exact target kind/revision/digest/root and retained source applicability for approval
and invalidation. Nutrition revision targets require canonicalRaw as well. Approvals bind eventId to the revision's reviewEventId; invalidations have their
own independent event ID. Rejections never require or produce a reviewed revision.
The event kind is an exact discriminated union; only invalidations accept severity
(`CORRECTION` or `SAFETY_CRITICAL`) and only rejection/invalidation accept reason.

## Retained source

A snapshot retains artifact ID, provider/document identities, explicit nullable
source revision, locator, captured timestamp, media type, exactly one of UTF-8 text
or canonical padded base64 bytes, numeric safe-integer byte length, SHA-256 of the
actual source bytes, and explicit field/applicability mappings. Empty byte payloads
are representable; absent payloads are not. Malformed or noncanonical base64,
length/hash mismatch and text+bytes reject. Arbitrary binary sources are supported.
Canonical events map identitySnapshot; nutrition events map each of the five fields
exactly once. The locator is an opaque reference and never triggers a network read.
The decoder retains source text/bytes exactly and freezes the complete snapshot.

## Digests

Three distinct versioned SHA-256 domains cover canonical revision, nutrition
revision and review event respectively. Canonical UTF-8 JSON is the existing
sorted-key primitive serializer with an explicit SAFE_INTEGER policy only for
validated Food Evidence graphs (the only numeric field is retained-source byteLength).
The default policy remains DENY, preserving Adaptive Nutrition V1 encoder semantics.
The envelope is `{domain, payload}`; payload includes contract and encoding and
excludes only the artifact's own digest. Source hashes and bound revision digests
remain included. Arrays retain order. Recipe/manifest/PlanEligibility domains are
not reused.

The `*CanonicalBytesRawV1` and `*DigestRawV1` functions validate local shape and
source byte integrity but intentionally do not verify their own digest or external
bindings. They require a syntactically valid digest slot, which is excluded from
the bytes. Callers must use the `decode*RawV1` functions to verify integrity and
bindings. Neither function family supplies authority, provenance or live status.

No persistence, SQL, migration, endpoint, transaction, recipe aggregation,
generator admission, acquisition or production evidence is part of Phase 1.

## Event review boundary and rejected proposals

Each event requires authorityContext with exact boundary OWNER_ADMIN_REVIEW,
actorId (existing account UUID), role OWNER or ADMIN, and nonempty authorityReference
identifying the existing owner/admin review authorization context. This is retained
representation, not a privilege grant. No importer/public authority variant exists.
The server issuance boundary must independently verify the actor and that reference;
this Phase 1 decoder cannot authenticate authority or prove who supplied the JSON.

occurredAt is a server-issued UTC timestamp representation with mandatory
timestampOrigin: SERVER. No client-time variant, clock access or generated timestamp
exists. All events require an explicit UUID idempotencyReference (request reference,
not a food identity) and exact SHA-256 requestDigest supplied by the caller.
These fields, authorityContext and all variant bindings are part of the event digest.
Digest integrity alone does not prove server issuance or authorize a replay.

REVIEW_APPROVED targets an existing canonical/nutrition immutable revision and
requires retainedSource. INVALIDATION also targets an existing revision, requires
retainedSource and reason, and has CORRECTION or SAFETY_CRITICAL severity.
Neither generates a revision or implies supersession.

REVIEW_REJECTED targets CANONICAL_PROPOSAL or NUTRITION_PROPOSAL with canonicalFoodId,
proposalDigest and explicit applicability. There is no revisionId or revision digest.
proposalDigest hashes the exact proposal; requestDigest hashes the exact review
request, so the two need not be equal. This module does not define a proposal builder
or recompute either external digest. decodeFoodEvidenceReviewEventRawV1 receives
an independently pinned raw proposal context as targetRaw for rejection and checks
all its fields against the event. No canonicalRaw or reviewed artifact is required.
The pinned context must come from the caller's trusted retained request/proposal,
not be copied from an untrusted event. Rejection requires explicit retainedSource:
null if no source is applicable, otherwise a fully verified snapshot with exact
field coverage/applicability. Missing retainedSource is never defaulted to null.

The event variant itself is the typed outcome; foreign outcome/revision fields
reject. Request/proposal digests refer to pre-event inputs and must not contain the
resulting event digest. Revisions contain only reviewEventId, never event digest:
canonical -> nutrition -> event dependencies have no digest cycle.
This completes the unissued Phase 1 V1 shape before any persistence adoption;
previous experimental event fixtures are intentionally incompatible.

## Runtime prerequisites

Production browser/Capacitor WebView execution requires TextEncoder, atob, btoa,
and WebCrypto crypto.subtle.digest with SHA-256 in a secure context (HTTPS or a
runtime-provided secure origin). No Node Buffer, Node crypto import, network lookup,
polyfill or alternate hashing/encoding fallback is used by the runtime module.
Missing WebCrypto fails with SHA-256 unavailable; the hosting runtime must provide
these standard APIs, not change the canonical bytes.

The repository deployment workflow selects Node 18 for its build. Node 18 tests
must expose global WebCrypto (where required, Node's --experimental-global-webcrypto
startup flag) as well as TextEncoder/atob/btoa. Building alone does not verify these
runtime APIs. The current Cloud verification uses Node 24.19.0 with native globals;
Node 18 execution is NOT_VERIFIED because that runtime is unavailable here.
Browser/WebView execution is not claimed by the Node-only test run.
