# Reviewed runtime recipe publication evidence v1

Pure review-to-runtime binding, before manifest assembly/publication. This package
is not a second catalog, a review service, an evidence issuer or publication receipt.
It never creates identities, revisions, classifications, portion rules or evidence.
It never reads a workbook or the mutable Premium UI catalog.

## Minimal responsibility

Bind the existing AdaptiveNutritionCandidateManifestEntryV2,
MealCompositionEligibilitySnapshotV1 and separate PlanEligibilityEvidenceV1 to
explicit reviewed source references and exact typed ingredient coverage. Existing
entry/recipe/portion/composition/eligibility shapes and digest authorities are reused.
Extending Manifest would mix catalog state with review prerequisites; extending
PlanEligibility would mix eligibility with publication/content evidence. The bounded
package is therefore separate, without replacing either authority.

The authoring compiler remains a candidate compiler, not a V2 publisher. READY_FOR_REVIEW,
READY_FOR_PUBLICATION and workbook membership cannot supply this contract's reviewed,
published or plan-eligible evidence. Existing SQL publication remains a separate
owner-controlled action; no DB model, grant, SQL change or live publication is added.

## Exact package

`{contract, manifestEntry, compositionEligibility, planEligibility, reviewedSource, digest}`

Contract: `potok-reviewed-runtime-recipe-publication-evidence-v1`.
All fields are required; unknown fields, wrong types and implicit defaults are rejected.

- manifestEntry: existing complete V2 shape, including supplied PUBLISHED state,
  immutable tuple, publication revision, canonical/nutrition evidence revisions and
  digests, allergen/dietary revisions/claims, portion rules, classifications and snapshot.
  Recipe snapshot digest is independently recomputed by the existing decoder.
- compositionEligibility: existing v1.1 shape. Recipe/eligibility revisions match;
  meal types, role/anchor/companions, pairing/incompatibility/repeat/energy/beverage
  content exactly match the entry. Its compositionPolicyRevision is retained;
  the later trusted generation caller must pin the same policy revision.
- planEligibility: existing full tuple, explicit true, evidenceRevision and digest.
  The existing eligibility domain is independently recomputed; membership is insufficient.
- reviewedSource: exact fields reviewStatus (REVIEWED), authoringRecipeId,
  workbookRevision, recipeEvidenceRef, publicationRevision, nutritionEvidenceRef,
  allergenEvidenceRef, dietaryEvidenceRef, foodBindings and nonFoodBindings.
  Publication revision matches the entry. References are explicit nonempty supplied
  strings, not inferred review results, signatures or identities issued by this package.
- foodBindings: sorted by unique componentId, one per canonical_food snapshot ingredient:
  `{componentId, canonicalStatus: "RESOLVED", canonical}`. canonical reuses CuratedRecipeCanonicalPointerV1's exact
  foodStableId/canonicalFoodId/source/sharedCatalogAccessible/evidenceRevision/evidenceDigest
  fields. Existing publication constraints apply: core/brand shared-accessible pointers,
  stable food key, UUID canonical identity, explicit revision and SHA-256 evidence digest.
- nonFoodBindings: sorted by unique componentId, one per approved_non_food ingredient:
  `{componentId, componentDefinitionId, approvedNonFoodEvidenceRef}`. Definition identity
  must exactly match the typed snapshot; the explicit approval reference is required.

Owner decision: ingredientIds is the sorted unique set of canonicalFoodId values from
ALL canonical_food snapshot ingredients, with exact coverage and no extra IDs.
Repeated food identities have one manifest ID but separate component evidence bindings.
approved_non_food.componentDefinitionId never supplies an ingredientIds member. Its
binding is separate and typed; food preference/exclusion semantics are unchanged.
Neither UUID syntax nor a matching UUID value can change an identity's kind.
Empty arrays must be explicit when that kind is absent. No ambiguous/unused binding is admitted.

## Public trust boundary and provenance

Only two new bridge runtime functions are exported:

- decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw, pinnedRaw)
- reviewedRuntimeRecipePublicationEvidenceCanonicalBytesRawV1(raw, pinnedRaw)

Both arguments must be primitive JSON strings. Objects/Proxy/String wrappers are
rejected before reflection/coercion. Each raw argument passes duplicate-aware validation
(including escaped-equivalent/nested duplicates) before JSON.parse. Only parser-owned
values reach private object helpers and existing strict decoders. Internal serialization
of these owned values is not JSON.stringify(arbitraryObject) sanitization.

The existing modules expose two small raw adapters over their unchanged decoders:
decodeAdaptiveNutritionCandidateManifestEntryRawV2 and decodePlanEligibilityEvidenceRawV1.
No synthetic manifest header or fake publication identity is needed to decode an entry.
No arbitrary-object bridge decoder, seal or builder is exported.

The independently trusted caller/source MUST supply pinnedRaw. Both proposed and pinned
packages are strictly decoded and their digests recomputed, then exact package digests
are compared. A self-consistent re-signed proposed substitute cannot replace the pinned
package. If a caller obtains BOTH from untrusted generator output, no trust is established.
REVIEWED/PUBLISHED literals, source references and hashes are assertions that require
external provenance; this package does not authenticate a reviewer or publish anything.

Canonical/nutrition evidence digests and individual canonical pointer digests remain
independently issued reviewed references, not hashes of this new package. Their source
payload domains are not invented, replaced or equated. Allergen/dietary claims remain
those supplied in the pinned entry. The new package binds them and their reviewed source
references but does not perform canonical lookup, clinical review or nutrition calculation.

## Aggregate integrity domain

Digest is SHA-256 of UTF-8 deterministic canonical JSON:
`{contract: "potok-reviewed-runtime-recipe-publication-evidence-v1",
encoding: "potok-reviewed-runtime-recipe-publication-evidence-canonical-json-v1",
evidence: <normalized package without digest>}`.

Object keys sort lexically, arrays preserve their admitted canonical order, decimals
remain existing strict fixed-point strings, numeric snapshot fields are safe integers.
No float arithmetic, UUID/revision issuance or lossy normalization occurs. Output is
recursively frozen. Existing recipe, eligibility, manifest, component and plan validation
digest domains are unchanged; this aggregate is an integrity binding, not provenance.

## Remaining gates

No real recipe data or 120-recipe workbook content is supplied/modified. The next bounded
step is obtain a reviewed real recipe source/evidence export and audit it against this
contract before any manifest assembly or owner-approved publication. Generator, Edge,
Supabase, runtime activation, FACT writer, production and deployment remain outside scope.
