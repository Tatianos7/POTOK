# Trusted meal warning evidence v1

Pure immutable supplied evidence only. No signals are computed, and no full
validator, generator, DB, Edge, record/activation or deployment path is integrated.

## Authority and coverage

`MealWarningEvidenceV1` contains exactly `contract`, `slotId`,
`validationPolicyRevision`, `validationEvidenceDigest`, `signals`,
`evidenceRevision`, and `digest`. `signals` contains exactly five explicit booleans:
`softTargetFitDeviation`, `longPreparationBurden`, `shoppingListBurden`,
`lowerConvenienceScore`, and `repetitionApproachingLimit`.

The slot must occur in the independently pinned evidence distribution's required
slots. The validation revision must match both that evidence and the pinned Balance
policy. The full validation evidence digest binds account, selection, week/timezone,
manifest, preference/safety and composition/validation/optimization revisions;
these bindings are not duplicated or inferred in the per-slot record.
`evidenceRevision` is a supplied immutable contract-level revision, not an invented
DB record or publishing API.

`TrustedMealWarningEvidenceSetV1` contains exactly `contract`,
`validationEvidenceDigest`, `validationPoliciesDigest`, `entries`, and `digest`.
There must be one record for every required slot across the seven-day distribution,
no duplicate or unknown slots, with entries in ascending lexical `slotId` order.
Noncanonical order is rejected, not silently normalized. An explicitly empty set
is valid only when the pinned distribution has no required slots; this does not
prove nutrition or plan validity. Individual record decoding does not claim set
coverage; consumers needing coverage must decode the aggregate.

## Public raw-only boundary

Every argument to every runtime function must be a primitive JSON string. For
each warning/input/context/manifest/preference/safety/evidence payload:

`typeof raw === string → duplicate-aware scan → JSON.parse → owned strict decoder`.

Objects, arrays, Proxy, String wrappers and coercible values are rejected without
inspecting traps. Private object helpers consume parser-owned or normalized data
only. No object decoder, seal or builder is exported. `JSON.stringify(arbitraryObject)`
is not a sanitization bridge. Normalized results are deeply immutable.

The policy/context arguments use the existing `TrustedValidationPolicies` RawV2
boundary and its exact versioned context wrapper, unchanged. Policies are always
decoded using `decodeTrustedValidationPoliciesRawV2`; its private object helpers
are not accessible. Each nested raw authority is independently duplicate-checked
before parsing. All policy/evidence/input digests and revision bindings are checked
independently through the accepted contracts.

## Exact digest domains

SHA-256 covers UTF-8 canonical JSON. Keys sort lexically; arrays preserve order.
Domain content contains only exact strings/booleans/objects/arrays, with no numbers
or floating-point operations. No implicit values are inserted.

Per-slot envelope:

```text
{
  contract: "potok-meal-warning-evidence-v1",
  encoding: "potok-meal-warning-evidence-canonical-json-v1",
  evidence: <strict per-slot record WITHOUT digest>
}
```

Aggregate envelope:

```text
{
  contract: "potok-trusted-meal-warning-evidence-set-v1",
  encoding: "potok-trusted-meal-warning-evidence-set-canonical-json-v1",
  evidence: <strict set WITHOUT aggregate digest, INCLUDING entry digests>
}
```

All supplied digests are recomputed and checked. Changing any signal changes both
the entry and aggregate digest. Canonical-byte APIs require complete digest-verified
records; they do not seal unsigned proposals.

## Integrity, provenance and policy roles

The trusted caller/source independently supplies and pins the policy raw package,
raw authority context and warning evidence. Serialization/hashing proves integrity,
not provenance. A generator must not supply its own warning authority package.
`assertTrustedMealWarningEvidenceSetPinnedRawV1` compares a proposed set against a
separately pinned set, rejecting even a self-consistent re-signed substitution.
Do not obtain both sets from generator output.

Signals are trusted evidence, not `allowedWarningCodes` membership. Explicit true
signals remain true even when their code is absent from the allowed warning list.
The future validator will apply that list as the existing emission filter. No
percentages, preparation-time thresholds, burden/convenience thresholds or
repetition-near-limit rules are defined here; no signal defaults to false.

## Runtime exports

- `decodeMealWarningEvidenceRawV1(raw, policiesRaw, trustedContextRaw)`
- `decodeTrustedMealWarningEvidenceSetRawV1(raw, policiesRaw, trustedContextRaw)`
- `mealWarningEvidenceCanonicalBytesRawV1(raw, policiesRaw, trustedContextRaw)`
- `trustedMealWarningEvidenceSetCanonicalBytesRawV1(raw, policiesRaw, trustedContextRaw)`
- `assertTrustedMealWarningEvidenceSetPinnedRawV1(proposedRaw, pinnedRaw, policiesRaw, trustedContextRaw)`

Four contract/encoding constants and three readonly interfaces are also exported.
Existing Graph, evidence v1, policy v1/RawV2, Composition, Balance limits and warning
enum remain unchanged. Tests use explicit synthetic fixture values, not production
defaults or authority publication.
