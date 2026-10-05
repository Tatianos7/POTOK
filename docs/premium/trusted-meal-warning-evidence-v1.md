# Trusted meal warning evidence v1

Pure immutable supplied evidence only. No signals are computed, and no full
validator, generator, DB, Edge, record/activation or deployment path is integrated.

## Authority and coverage

`MealWarningEvidenceV1` contains exactly `contract`, `slotId`,
`validationPolicyRevision`, `validationEvidenceDigest`, `mealSnapshotDigest`, `signals`,
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

`mealSnapshotDigest` must equal the independently verified digest of the exact
evaluated slot's `MealSnapshotV1`. Every public function additionally requires
`evaluatedPlanRaw`, a primitive JSON string containing the evaluated
`GeneratedWeekPlanV1`. It is duplicate-checked and parsed, then decoded against the
separately pinned generation input using `decodeGeneratedWeekPlanV1`. Existing
decoders recompute meal/slot/Graph/generation-input/content digests; supplied hashes
are not trusted. Evaluated Graph slots must exactly match the pinned distribution's
day/date/slot/order/meal-type coverage before warning records can be admitted.

The reused reviewed Meal Composition v1.1 SHA-256 domain is exactly:

```text
{
  encoding: "potok-adaptive-meal-composition-canonical-json-v1.1",
  contract: "potok-adaptive-meal-composition-v1.1",
  meal: <strict MealSnapshotV1 WITHOUT digest>
}
```

Its existing canonical UTF-8 payload includes mealSlotId, mealSnapshotRevision,
Goal/composition revisions, ordered components, recipe/eligibility/portion
snapshots, assigned servings/multiplier/grams, ingredient state/quantities and
nutrition totals. Changed servings, nutrition or component/meal content therefore
changes the independently recomputed meal digest. An authority/slot-only warning
record cannot be replayed on that changed state, even if every pinned authority
and component evidence record stays identical. No new meal digest domain is added.
This binding does not claim full manifest/nutrition/Balance semantic validation.
Meal digests intentionally avoid a circular dependency on validation result digests.

This is a required pre-merge correction to PR #149's new contract/API: records
without `mealSnapshotDigest`, or calls without `evaluatedPlanRaw`, are rejected.

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
The evaluated plan follows the same raw-only boundary, including nested duplicate
key rejection. No caller-supplied JS plan/meal object is accepted.

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
`mealSnapshotDigest` is part of each strict entry's canonical content, hence of both
warning digest layers. Updating the evaluated meal binding changes both warning
digests. Existing Graph/MealSnapshot digest domains and semantics are unchanged.

## Integrity, provenance and policy roles

The trusted caller/source independently supplies and pins the policy raw package,
raw authority context and warning evidence. Serialization/hashing proves integrity,
not provenance. A generator must not supply its own warning authority package.
`assertTrustedMealWarningEvidenceSetPinnedRawV1` compares a proposed set against a
separately pinned set, rejecting even a self-consistent re-signed substitution.
Do not obtain both sets from generator output.
Both sets are also checked against the same explicit evaluated plan. A stale set
for another meal state fails before pinned comparison can return success. The
evaluated plan is untrusted candidate data; independently pinned warning evidence,
policy and context remain trusted-caller responsibilities. Replacing a warning's
meal digest and re-signing it establishes integrity only, not trusted evaluation.

Signals are trusted evidence, not `allowedWarningCodes` membership. Explicit true
signals remain true even when their code is absent from the allowed warning list.
The future validator will apply that list as the existing emission filter. No
percentages, preparation-time thresholds, burden/convenience thresholds or
repetition-near-limit rules are defined here; no signal defaults to false.

## Runtime exports

- `decodeMealWarningEvidenceRawV1(raw, policiesRaw, trustedContextRaw, evaluatedPlanRaw)`
- `decodeTrustedMealWarningEvidenceSetRawV1(raw, policiesRaw, trustedContextRaw, evaluatedPlanRaw)`
- `mealWarningEvidenceCanonicalBytesRawV1(raw, policiesRaw, trustedContextRaw, evaluatedPlanRaw)`
- `trustedMealWarningEvidenceSetCanonicalBytesRawV1(raw, policiesRaw, trustedContextRaw, evaluatedPlanRaw)`
- `assertTrustedMealWarningEvidenceSetPinnedRawV1(proposedRaw, pinnedRaw, policiesRaw, trustedContextRaw, evaluatedPlanRaw)`

Four contract/encoding constants and three readonly interfaces are also exported.
Existing Graph, evidence v1, policy v1/RawV2, Composition, Balance limits and warning
enum remain unchanged. Tests use explicit synthetic fixture values, not production
defaults or authority publication.
