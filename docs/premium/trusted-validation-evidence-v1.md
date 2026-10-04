# Trusted validation evidence v1

This is a pure immutable contract, not a validator, publisher, generator, RPC or
activation path. Values are supplied by a trusted caller. A self-consistent digest
proves integrity, not provenance. `assertTrustedValidationEvidencePinnedV1` compares
proposed evidence against a separately trusted pinned package; never obtain both
arguments from generator output.

## Existing semantic sources

- `adaptiveNutritionMealBalanceV1.ts`: scale-3 nonnegative decimal strings (at most
  nine integer digits), inclusive minimum/target/maximum ordering, meal requirements,
  ingredient-family tokens, required slots, distribution bounds and fallback states.
- `adaptiveNutritionAuthoritiesV1.ts`: exact manifest identity, publication and
  canonical/nutrition/allergen/dietary revisions, dominant ingredient family,
  allowed meal types, preference/safety immutable bytes and digests.
- `adaptiveNutritionGraphV2.ts`: trusted input, account/selection/local Monday week,
  canonical timezone and pinned revision vector. The aggregate also binds the exact
  existing generation-input digest; no Goal target or policy thresholds are derived.

## Distribution snapshot

`MealDistributionPolicySnapshotV1` contains contract, `policyRevision` (the pinned
validation revision), `compositionPolicyRevision`, and seven contiguous `days`.
Each day explicitly contains `date`, `requiredSlots`, `nutritionBounds`,
`requirements`, and `distributionBounds`. Slots use existing slotId/mealType/sortOrder
semantics. Bounds and requirements arrays correspond one-to-one, in slot order.
Slot IDs are unique across the week. Nutrition bounds contain all five existing
axes and explicit minimum/target/maximum values. Required source booleans are explicit.
No percentages, bounds, slots, requirements or numeric defaults are synthesized.

Completeness here means coverage of the supplied trusted slot policy. Empty slot
lists are representable as in the existing contracts; this package does not decide
whether such a week is nutritionally valid.

## Component evidence and its Graph digest

Each component pins slotId, mealComponentId, recipeId/recipeRevisionId,
portionRevisionId/eligibilityRevisionId, publicationRevision, ingredientFamilies,
proteinSource/produceSource, portionPolicyRevision, canonicalEvidenceRevision/digest,
nutritionEvidenceRevision/digest, allergenEvidenceRevision and dietaryEvidenceRevision.
Canonical/nutrition evidence and publication/allergen/dietary revisions must match
the separately pinned manifest entry exactly. Ingredient families include its
dominant family. Booleans, full families and portion-policy provenance are supplied
trusted evidence, not inferred from roles, names or macros.

Exactly one component record exists per slot/component identity; mealComponentIds
are globally unique. Duplicate recipe identity within a slot is ambiguous and
rejected. The same immutable recipe may appear in separate slots; repetition limits
belong to the later Balance validator. Component sets use ascending
`slotId:mealComponentId` order. Plan-eligibility sets use ascending full recipe tuple.

The sole Graph component evidence digest domain is SHA-256 of UTF-8 canonical JSON:

```text
{
  contract: "potok-component-validation-evidence-v1",
  encoding: "potok-component-validation-evidence-canonical-json-v1",
  evidence: <strict component content WITHOUT digest>
}
```

Object keys sort lexically; fixed ASCII field names have the same order as SQL C
collation. Arrays retain order. Numbers are safe integers; nutrition values are
exact strings, never floating point. Raw entrypoints reject duplicate keys before
JSON.parse, including escaped equivalents. All objects reject unknown/missing fields.
Future Graph `componentEvidence[].evidenceDigest` must equal this envelope digest,
not canonicalEvidenceDigest or nutritionEvidenceDigest. No Graph consumer is wired.

## Explicit plan eligibility

`PlanEligibilityEvidenceV1` pins the full manifest recipe tuple, `planEligible=true`,
an independently supplied `evidenceRevision`, and its own digest. Manifest membership
alone is insufficient. Every used recipe requires eligibility evidence; duplicate
or unused eligibility records are rejected. `false` is never accepted for Adaptive
Plan use. Its domain is `{contract, encoding, evidence}` using
`potok-plan-eligibility-evidence-v1` and
`potok-plan-eligibility-evidence-canonical-json-v1`; evidence excludes digest.

This is a contract-level revision, not a DB schema proposal. A future separately
reviewed owner-controlled publication/eligibility authority must supply and pin the
record. No current table, grant, RPC or publisher is assumed to provide it.

## Fallback and aggregate

Fallback requires explicit candidatePoolDigest/status/ordinaryWeekDigest and binds
validation policy plus manifest revision/digest. Existing states are preserved:
VALID requires an ordinaryWeekDigest; UNAVAILABLE_SPECIALTY, UNAVAILABLE_EXPENSIVE
and UNAVAILABLE_BOTH require null. No proof is manufactured. The pool digest is
separately supplied; it is not assumed equal to the manifest digest.

The aggregate binds account, selection, week/timezone, generationInputDigest,
validation/composition/optimization revisions, manifest revision/digest,
preference revision/digest and safety revision/digest. Context snapshots are decoded
and integrity-checked independently. Distribution, components, fallback and plan
eligibility are required. Every required slot needs component evidence, and every
component must reference a declared slot and an allowed manifest recipe/meal type.

Aggregate SHA-256 uses `{contract, encoding, evidence}` with
`potok-trusted-validation-evidence-v1` and
`potok-trusted-validation-evidence-canonical-json-v1`; evidence excludes aggregate
digest but includes component/eligibility digests. Returned normalized copies are
recursively frozen; caller-owned objects are not frozen or modified.

Future authorities must separately supply reviewed distribution snapshots, component
classification/portion-policy records and fallback proof. Integrity checks do not
verify culinary classification or truth of fallback evidence. No nutrition, safety,
diversity or full-validator orchestration is implemented by this package.
