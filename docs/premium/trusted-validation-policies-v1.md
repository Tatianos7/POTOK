# Trusted validation policies v1 — raw-only boundary v2

Pure immutable policy contracts; no validator integration, generator, persistence,
RPC, activation, deployment or authority publication is implemented.

## Public trust boundary

All exported runtime functions accept **primitive JSON strings only**, including
all policy, pinned-input and context arguments. Runtime checks reject objects,
arrays, Proxy, String wrappers, null, booleans and numbers without inspecting them.
For every accepted raw payload the sequence is:

`typeof raw === string → assertRawJsonWithoutDuplicateKeysV1 → JSON.parse →
private owned-data shape decoder → canonical bytes / SHA-256 → immutable result`.

Duplicate keys, including escaped-equivalent and nested duplicates, are rejected
before parsing. JSON.parse creates the independently owned plain graph. Proxy
objects are intentionally outside the accepted public boundary; no reflection-based
attempt is made to recover or validate their underlying target. Object decoders are
private implementation details for parsed owned data only. No object-based seal,
build, decoder or canonical-byte function is exported.

**JSON.stringify(arbitraryObject) is not an approved sanitization bridge.** Raw
payloads must come from the appropriate trusted serialization/source boundary,
not from serializing an arbitrary live hostile object. Tests independently build
explicit synthetic owned fixtures; they do not establish production authority.

This is a breaking pre-merge correction to the new PR's runtime API: public
entrypoints are explicitly V2. V1 content shapes and digest domains are unchanged.

## Authority context

Composition and Balance APIs receive `(snapshotRaw, trustedGenerationInputRaw)`.
Aggregate APIs receive `(aggregateRaw, trustedContextRaw)`. The context raw string
encodes exactly this V2 transport wrapper:

```text
{
  contract: "potok-trusted-validation-policies-raw-boundary-v2",
  trustedGenerationInputRaw: <primitive JSON string>,
  candidateManifestRaw: <primitive JSON string>,
  preferenceSnapshotRaw: <primitive JSON string>,
  safetySnapshotRaw: <primitive JSON string>,
  trustedValidationEvidenceRaw: <primitive JSON string>
}
```

The wrapper and each of its five raw payloads are independently duplicate-checked
and parsed. Existing input/evidence/manifest/preference/safety decoders receive only
these parser-owned graphs. No authority input remains a public object parameter.
The existing evidence v1 contract and API in its own module remain unchanged.

## Existing semantic sources

Composition content is exactly `MealCompositionPolicyV1`, decoded by the existing
normalizer exported as `decodeMealCompositionPolicyV1` (only export/rename changed).
Its existing semantics remain explicit revision, maxComponents 1..6, 1..32 unique
patterns, patternId tokens, existing ordered meal-type/role enums, explicit integer
weights 0..1000 with at least one nonzero weight. Pattern array order is retained
because it affects composer selection; no pattern, weight or default is synthesized.

Balance content is exactly `BalancePolicyV1`, decoded by `decodeBalancePolicyV1`.
All fields must be supplied. Only existing numeric values are admitted:
maxComponents=5, exactRecipePerWeek=2, exactRecipePerDay=1, repeatFamilyPerWeek=3,
dominantIngredientFamilyPerWeek=4, specialtyMealsPerWeek=1, expensiveMealsPerWeek=2.
`allowedWarningCodes` is explicitly required, unique, lexically sorted and restricted
to the existing closed enum. Explicit empty warning arrays remain valid.
Unsupported changed limits are rejected; changed admitted warning sets change digest.
Different limits need a separately reviewed policy version. Composition's existing
1..6 range and Balance's separate maxComponents=5 consumer constraint are preserved;
no consumer integration or policy compatibility rollout is claimed here.

## Unchanged snapshot and digest domains

CompositionPolicySnapshotV1 and BalancePolicySnapshotV1 contain exactly contract,
policy, digest. TrustedValidationPoliciesV1 contains exactly contract,
generationInputDigest, validationEvidenceDigest, composition, balance, digest.
Normalized results are deeply frozen. Revisions match pinned composition/validation
input revisions and the independently decoded evidence v1 package. Input/evidence
and snapshot/aggregate digests are independently recomputed, never trusted as supplied.

Each SHA-256 digest covers exact UTF-8 canonical JSON:

- Composition: `{contract: "potok-composition-policy-snapshot-v1",
  encoding: "potok-composition-policy-snapshot-canonical-json-v1",
  policy: <snapshot WITHOUT digest>}`.
- Balance: `{contract: "potok-balance-policy-snapshot-v1",
  encoding: "potok-balance-policy-snapshot-canonical-json-v1",
  policy: <snapshot WITHOUT digest>}`.
- Aggregate: `{contract: "potok-trusted-validation-policies-v1",
  encoding: "potok-trusted-validation-policies-canonical-json-v1",
  policy: <aggregate WITHOUT aggregate digest>}`.

Object keys sort lexically; arrays retain order. Numbers must be safe integers;
negative zero and fractions are rejected. Previous normal golden digests remain
byte-identical. The V2 context wrapper does not introduce a new content digest domain.

## Runtime API and provenance

Exactly seven functions are exported:

- decodeCompositionPolicySnapshotRawV2
- decodeBalancePolicySnapshotRawV2
- decodeTrustedValidationPoliciesRawV2
- compositionPolicySnapshotCanonicalBytesRawV2
- balancePolicySnapshotCanonicalBytesRawV2
- trustedValidationPoliciesCanonicalBytesRawV2
- assertTrustedValidationPoliciesPinnedRawV2(proposedRaw, pinnedRaw, trustedContextRaw)

Canonical-byte APIs take complete snapshots and verify their supplied digest first.
No public seal API exists. Content serialization/hash calculation establishes
**integrity, not provenance**. The trusted caller/source separately supplies and
pins the exact raw authority package/context; no provenance source or storage is
invented here. Never obtain pinnedRaw or trustedContextRaw from generator output.
The comparison API rejects a self-consistent proposed package whose normalized digest
differs from the independently pinned package. Raw strings do not automatically
make an untrusted generator's proposed authorities authoritative.
