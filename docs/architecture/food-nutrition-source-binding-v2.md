# Exact Food nutrition source binding proposal V2

Status: implemented pure representation; unmounted, **not reviewed evidence**.

The exact numeric input V2 retains a declared source hash. This boundary checks
that declaration against actual retained bytes and binds the packet to one exact
canonical identity revision, retained snapshot and mapper output selected by the
caller. Every result is `authority: NONE`, `status: REVIEW_REQUIRED`.

## Inputs and checks

`captureFoodNutritionSourceBindingRawV2(canonicalRaw, sourceRaw, inputRaw, pinsRaw)`
accepts raw JSON, not mutable objects. `decodeFoodNutritionSourceBindingRawV2`
requires the proposal plus the same independently obtained pins.

| Input | Validation |
| --- | --- |
| Canonical revision | Existing strict V1 revision decoder, self digest, independent revision digest pin |
| Retained snapshot | Existing V1 decoder for shape, text/base64 exclusivity, bytes/length/hash, unique mappings; domain-separated digest over the entire snapshot |
| Numeric input | Existing V2 decoder, exact fractions equal preserved mapped decimal text; independent digest includes record, policy, basis, units and text |
| Cross linkage | Numeric declared retained hash equals actual source hash; exactly five nutrient mappings; every applicability equals canonical exact food state |

Pins are three lowercase SHA256 strings: `canonicalRevisionDigest`,
`numericInputDigest`, `retainedSnapshotDigest`. The caller must obtain them from
its independently selected identity/source/mapper context, never trust pins
supplied by the packet being checked. Recomputing a forged packet's own digest
cannot bypass the original context. Replacing both packet **and** trusted context
is outside this integrity boundary; hashes are not credentials.

The retained snapshot digest covers metadata and source field mappings as well
as bytes, so changing a document identifier or mapping while keeping the byte
hash is detectable. Literal mapping paths remain declarations: validating JSON
path extraction or primary-source mapping requires the existing dedicated mapper.
The numeric pin must represent its selected output. This module cannot infer
whether arbitrary retained bytes substantiate a nutrient value or food identity.

`PER_100_G_FOOD` and `PER_100_G_EDIBLE` remain distinct. No basis normalization,
retention factor, yield, density or missing fiber is inferred. Exact values keep
all digits; display-only projections are not accepted. A decoded canonical V1
revision is integrity checked, not asserted live/approved by this module.

## Wire and compatibility

The proposal has its own contract, encoding and SHA256 domain. Its digest excludes
only its own digest field. Canonical JSON reuses the established V1 canonicalizer
with safe integers permitted solely for retained byte length; nutrition remains
rational strings. Source and proposal digest domains differ from numeric/reviewed
evidence domains. Results own frozen copies, including nested source mappings.
Raw entry points bound UTF8 bytes (262144) and depth (12) before the existing
duplicate-aware scanner. Numeric input retains its tighter V2 limits.

The only V1 change exports a wrapper around its existing private retained-source
validator and freeze/parser. Existing V1 events and revisions retain the same
wire shape, digests, decimal constraints and acceptance rules. The new proposal
is rejected by V1 nutrition/event decoders. No new approval event, issuer,
currentness store, signature or authority context is created.

Synthetic tests cover text/base64, both bases, exact values, independent hashing,
immutable ownership, independently pinned substitution, byte integrity, missing
axes, state mismatch, duplicate keys/mappings, limits and failed promotion into
legacy evidence. They do not establish readiness of the 19 real recipes.

## Next boundary

Reuse the existing authenticated server review/authority and retained-source
mapper mechanisms for a separately versioned exact nutrition revision and its
review lifecycle. Do not put a V2 proposal inside a fake V1 carrier event or widen
legacy decoders. Then integrate exact Graph/publication, server validation,
storage and readback under separately reviewed versions. Real source applicability,
identity approval and eventual owner cooking measurements remain outstanding.
No Supabase call, runtime binding, source mutation, issuance or activation occurs.
