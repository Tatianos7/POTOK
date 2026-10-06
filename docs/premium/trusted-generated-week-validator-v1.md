# Pure trusted generated-week validator v1

`validateGeneratedWeekPlanTrustedV1(generatedPlanRaw, pinnedPoliciesRaw,
trustedContextRaw, pinnedWarningEvidenceRaw)` is a pure asynchronous domain API.
All four runtime arguments are primitive JSON strings. Authorities use the existing
TrustedValidationPolicies RawV2 context wrapper and each nested authority payload
passes duplicate-aware validation before JSON.parse and its existing strict decoder.
Only parser-owned data reaches object decoders; no object decoder, seal or builder
is exported by this validator. Objects, String wrappers and Proxy arguments cannot
cross the boundary. JSON.stringify of arbitrary external objects is not a bridge.

The caller independently supplies pinned generation input, manifest, preference,
safety, validation evidence, policies and plan-bound warning evidence. Generator
output supplies none of these authorities. Digests prove integrity, not provenance:
an entirely replaced, internally consistent trusted context cannot establish its
own provenance. The trusted caller must retain/control these independently pinned
inputs. This module implements no authority storage, acquisition or publication.

## Admission and existing semantics

GeneratedWeekPlanV1 is strictly decoded against pinned TrustedGenerationInputV1;
Graph, MealSnapshot, slot and deterministic-content digests are recomputed using
existing domains. The warning RawV1 boundary binds the same explicit evaluated plan
and exact distribution dates, slots, order and meal types. A changed meal state
cannot reuse stale warning evidence, even with freshly signed output plan hashes.
The existing Meal Composition strict decoder requires its normalized ingredient
snapshot representation; this adapter preserves that decoder's admission behavior
(including rejection of differently ordered nested ingredient properties).

Every component is checked against the manifest immutable tuple and eligibility,
publication and component-evidence references. Separate explicit planEligibility
is required. Recipe snapshot equality and manifest-bound component metadata are
also checked by validateWeekSnapshotRawV2. Portion min/max, servings increments
and ingredient discrete increments use exact scale-3 BigInt arithmetic.

Hard preference/safety decisions use validateCandidateAuthoritiesV1. Excluded
ingredient IDs are checked there; no ingredient-ID-to-family inference is made.
The closed preference snapshot has no family-exclusion field. The Balance adapter
therefore supplies no additional family exclusions. Existing dietary pattern and
hard exclusion authorities are forwarded without inference from recipe names.

The original pinned Composition cap and exact ordered role pattern are checked
before Balance admission. Balance's existing fixed cap of 5 is a consumer constraint,
not a rewrite of the independently pinned Composition cap (existing range 1..6).
Its legacy input DTO receives the intersection: fixed Balance cap and only patterns
that can fit that cap. Graph V2 independently admits at most five components. No
companion, pattern, nutrition weight or threshold is generated.

Day and week validation use the existing Balance validators, supplied distribution,
Goal hard bounds and evidence. Target remains an optimization target, not an exact
nutrition requirement. Optional macro/fiber axes apply only when present. Five warning
booleans are supplied unchanged from pinned warning evidence; allowedWarningCodes
only filters emission. No signal calculation or false default is introduced.

The week path is V2: specialty and expensive are independent manifest-bound booleans,
including meals counted in both axes; ACCESSIBILITY_BLOCKED remains invalid. Existing
recipe/day/week, family, specialty/expensive limits and ordinary fallback statuses
are unchanged. No fallback proof is synthesized or computed.

RawV2 Balance now admits the existing Graph V2 canonical timezone domain (including
UTC). A private owned-data day validator avoids reapplying V1's slash-only timezone
boundary. V1 public decoding, validation and digest domains remain unchanged;
noncanonical timezone aliases are still rejected.

## Results and errors

ACCEPTED returns a deeply immutable decoded plan and receipts for Graph, input,
manifest, preference, safety, validation evidence, policies and warning evidence.
Warnings retain existing Balance codes and are deterministically ordered.

REJECTED returns stable code/scope/path records. The small adapter code set covers
GENERATED_PLAN_INVALID, AUTHORITY_BINDING_MISMATCH, MANIFEST_MISMATCH,
PLAN_ELIGIBILITY_FAILURE, VALIDATION_EVIDENCE_MISMATCH, PORTION_FAILURE,
PREFERENCE_SAFETY_FAILURE and COMPOSITION_FAILURE. Existing Balance reason codes
are preserved directly. Component locations include day/slot/component identifiers.
Reasons are deduplicated and lexically ordered by scope/path/code/source/location.

Missing required component, plan eligibility or slot-warning authority returns
BLOCKED/TRUSTED_AUTHORITY_MISSING. Malformed trusted shapes/types, unexpected internal
errors and unavailable hashing remain exceptions. Expected malformed/invalid generated
plans and ordinary semantic failures return REJECTED; child Balance failures remain
structured through day/week aggregation.

No SQL, DB, Supabase, Edge integration, generator, activation, record/activate RPC,
FACT writer, deployment, payments or replacement producer is implemented.
