# Trusted validation policies v1

Pure immutable policy contracts; no validator integration, generator, persistence,
RPC, activation, deployment or authority publication is implemented.

## Semantic sources

Composition content is exactly `MealCompositionPolicyV1`, decoded by the existing
Meal Composition normalizer, now exported as `decodeMealCompositionPolicyV1`.
Its semantics are unchanged: explicit revision, maxComponents 1..6, 1..32 unique
patterns, patternId tokens, existing ordered meal-type/role enums, explicit integer
weights 0..1000 with at least one nonzero weight. Patterns retain their supplied
array order because the composer uses pattern order for deterministic selection.
No pattern or weight is synthesized. Role/meal-type arrays retain the existing
strict enum ordering. Object keys sort lexically in canonical JSON.

Balance content is exactly `BalancePolicyV1`, decoded by `decodeBalancePolicyV1`.
All fields must be supplied. Existing v1 limits are the only admitted numeric
values: maxComponents=5, exactRecipePerWeek=2, exactRecipePerDay=1,
repeatFamilyPerWeek=3, dominantIngredientFamilyPerWeek=4, specialtyMealsPerWeek=1,
expensiveMealsPerWeek=2. These are existing contract constants, not new defaults.
`allowedWarningCodes` must be explicitly supplied, unique and lexically sorted;
the existing closed warning enum is reused. Explicit empty warning arrays are valid.

The requested changed-limit digest case has a strict v1 admission boundary:
unsupported changed numeric limits are rejected, rather than sealed as another
accepted v1 policy. Changing an admitted warning set changes the policy digest.
Supporting different numeric limits requires a separately reviewed policy version.
The composition contract's 1..6 range is preserved; the existing Balance consumer
separately requires maxComponents=5. This package does not integrate consumers or
claim every structurally valid composition policy is usable by Balance v1.

## Snapshots and canonical domains

`CompositionPolicySnapshotV1` and `BalancePolicySnapshotV1` contain exactly:
`contract`, `policy`, `digest`. The nested policy is the complete existing shape.
The snapshot decoders require the matching composition/validation revision from a
separately trusted `TrustedGenerationInputV1`. Normalized copies are deeply frozen;
caller data remains untouched. Missing/unknown fields, coercion, sparse arrays,
accessors, symbols, fractional numbers and negative zero are rejected. Raw JSON
entrypoints reject duplicate keys (including escaped equivalents) before parsing.

Digests are SHA-256 of exact UTF-8 canonical JSON envelopes:

- Composition: `{contract: "potok-composition-policy-snapshot-v1",
  encoding: "potok-composition-policy-snapshot-canonical-json-v1",
  policy: <snapshot WITHOUT digest>}`.
- Balance: `{contract: "potok-balance-policy-snapshot-v1",
  encoding: "potok-balance-policy-snapshot-canonical-json-v1",
  policy: <snapshot WITHOUT digest>}`.
- Aggregate: `{contract: "potok-trusted-validation-policies-v1",
  encoding: "potok-trusted-validation-policies-canonical-json-v1",
  policy: <aggregate WITHOUT aggregate digest>}`.

Arrays retain order; object keys sort lexically; safe integer numbers are encoded
exactly. No floating-point nutrition calculation is introduced. Each decoder
recomputes the digest independently; supplied digests are never trusted.

## Separate aggregate and provenance

`TrustedValidationPoliciesV1` contains exactly contract, generationInputDigest,
validationEvidenceDigest, composition, balance, digest. Both snapshots are required.
The context supplies trusted input, manifest, preference, safety and evidence.
The existing evidence package is strictly decoded against those authorities.
The aggregate binds the independently recomputed input/evidence digests and both
policy revisions. No fields or digest domains of `TrustedValidationEvidenceV1` change.
A separate additive contract preserves the accepted v1 evidence bytes and callers.

Hash integrity does not establish provenance. A trusted caller must independently
obtain/pin the full aggregate, input, evidence and context. Use
`assertTrustedValidationPoliciesPinnedV1(proposed, pinned, context)` to reject a
self-consistent proposed substitute. Never source `pinned` or context from generator
output. Sealing is serialization/integrity checking, not publishing an authority.
No production snapshot or synthetic default is created by this module. Tests use
explicit synthetic authorities only.
