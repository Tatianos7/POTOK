# Adaptive Nutrition accessibility axes v2

This pure contract records the owner decision following the trusted-validator
preflight on master `c5f82084560e963878c8c8d27fec60e08f1aa5c9`.
It does not implement or integrate the full trusted validator.

## Reviewed gap and authoritative semantics

Before this change, CandidateManifestV2 admitted both
`COMMON_RU_RETAIL + specialty=true + expensive=true` and
`SPECIALTY_PRODUCT_REQUIRED + specialty=true + expensive=true`.
MealComponentEvidenceV1 carried only `accessibility`, and Week Balance v1 counted
specialty/expensive by that single enum. No consistency or precedence rule linked
the three manifest fields.

`accessibility` remains the existing availability classification. `specialty`
and `expensive` are independent boolean classification axes. They are explicit
trusted manifest data, never inferred from the enum or generator output.

Manifest consistency now requires:

| accessibility | specialty | expensive |
| --- | --- | --- |
| COMMON_RU_RETAIL | either explicit boolean | either explicit boolean |
| SEASONAL_BUT_COMMON | either explicit boolean | either explicit boolean |
| SPECIALTY_PRODUCT_REQUIRED | true | either explicit boolean |
| EXPENSIVE_OPTIONAL | either explicit boolean | true |
| ACCESSIBILITY_BLOCKED | either explicit boolean | either explicit boolean |

There is no inverse implication. `specialty=true` does not require
SPECIALTY_PRODUCT_REQUIRED, and `expensive=true` does not require
EXPENSIVE_OPTIONAL. Both can be true. ACCESSIBILITY_BLOCKED remains hard invalid
regardless of the flags, using the existing ACCESSIBILITY_BLOCKED reason.

## Versioned evidence and raw-only boundary

MealComponentEvidenceV2 uses contract
`potok-adaptive-meal-candidate-evidence-v2`. It includes every V1 field plus:
`recipeId`, `portionRevision`, `eligibilityRevision`, `manifestRevision`,
`manifestDigest`, `specialty`, `expensive`. Exact allowlists, explicit boolean
types and existing strict V1 field decoding apply; unknown/missing fields and
coercion are rejected.

`decodeMealComponentEvidenceRawV2(evidenceRaw, pinnedManifestRaw, mealSnapshotRaw)`
accepts primitive JSON strings only. Every payload passes duplicate-aware parsing
before JSON.parse; only parser-owned values reach internal object helpers.
Arbitrary objects, Proxy objects and String wrappers are outside the boundary.
JSON.stringify(arbitraryObject) is not a supported trust bridge.

The manifest is independently decoded and its digest recomputed. Evidence binds
to its exact revision/digest and recipe/revision/portion/eligibility tuple, and
to the component identity in an independently decoded MealSnapshot. Recipe
snapshot, meal-type admission, publication/evidence revisions, accessibility,
allergen/dietary claims, family metadata and serving range must match the manifest.
Both flags must equal the pinned entry. The normalized evidence is deeply frozen.
This is a bounded classification contract; it does not prove plan eligibility or
replace the separately pinned ingredient-family, source and portion-policy
evidence required by the future full trusted validator.

Digest proves integrity, not provenance. The caller remains responsible for
obtaining the separately pinned manifest from an independently trusted source.
Re-signing a substitute does not authorize it. No provenance source/storage is
introduced here.

## Weekly counters and compatibility

`validateWeekSnapshotRawV2(weekRaw, pinnedManifestRaw)` accepts primitive JSON
strings only. Its root contract is `potok-adaptive-week-validator-input-v2`;
the existing day/meal/policy shapes remain unchanged, except each component
evidence must be V2. Every component must bind to the supplied manifest. Exact
component coverage and unambiguous weekly slot identities are required.

For each meal, specialty is the OR of all component specialty flags; expensive
is the independent OR of all expensive flags. A meal increments each counter at
most once. A meal with both axes participates in both counters. The existing
limits remain specialtyMealsPerWeek=1 and expensiveMealsPerWeek=2. Existing
SPECIALTY_LIMIT_EXCEEDED and EXPENSIVE_LIMIT_EXCEEDED reasons are preserved.
Other repetition, diversity, nutrition, composition and warning rules are
unchanged. In particular, existing optional accessibility warning emission is
not redefined as a boolean-signal policy by this artifact.

V2 delegates meal/day validation and the remaining week checks to the existing
Balance implementation. Its result contains the complete V2 subject in the
existing result digest envelope, so classification fields are included without
changing any existing content digest domain.

The existing object-based validateWeekSnapshotV1 remains a legacy compatibility
API with its original enum-only interpretation. New trusted-validator callers
must use RawV2 for independent manifest axes. There is no fallback from missing
V2 flags to V1 enum inference. No runtime caller is migrated in this PR.

## Ordinary fallback

Existing OrdinaryFallbackProofV1 and OrdinaryFallbackEvidenceV1 are unchanged:
VALID requires an explicit ordinaryWeekDigest; unavailable states require null.
UNAVAILABLE_SPECIALTY blocks the specialty dependency, UNAVAILABLE_EXPENSIVE
blocks expensive dependency, and UNAVAILABLE_BOTH yields both existing dependency
reasons. These checks are independent of the two counter limits; limits passing
does not make an unavailable proof valid. No proof is computed or defaulted.
The future full validator must retain existing evidence/policy/manifest pinning
before forwarding the proof. This bounded week API does not establish fallback
provenance or compute candidatePoolDigest.

No SQL, Supabase, Edge, Graph v1, generator, FACT writer, activation, deployment,
threshold or full trusted-validator integration is included.
