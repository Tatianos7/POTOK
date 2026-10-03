# Adaptive Nutrition Graph v2 missing server authorities design v1

Date: 2026-09-27
Status: **PROPOSED / REVIEW READY / PURE CONTRACT ONLY / NOT APPLIED**

This note closes the design gap exposed by the owner-run STAGING metadata preflight.
It does not contain executable SQL, create a manifest, make any recipe eligible, or
activate generation. The current 120 recipe authoring records remain ineligible.

## 1. Confirmed boundary

The deployed weekly selection, immutable graph revision and durable operation-ledger
concepts are reusable additively. Graph v1 functions remain unchanged. The scoped
STAGING evidence did not find a versioned user preference authority, a versioned user
safety authority, or a protected Graph v2 candidate-manifest authority. It also proved
that entitlement and Adaptive PLAN writers currently acquire different advisory-lock
resources. Local pure contracts cannot prove PostgreSQL locking, RLS, rollback, grants
or deployed function behavior.

## 2. Shared account gate repair

Every transaction that can change verified entitlement or an Adaptive PLAN head must
first acquire one shared account resource:

```text
contract: potok-shared-account-gate-v1
resource: potok-shared-account-gate-v1:<authoritative account UUID>
```

The account UUID is derived by the protected server boundary. The browser never
chooses it. The same gate is required by Premium/admin grant and revoke, initial PLAN
provisioning, pending-to-active activation, and future replacement/adaptation.

Entitlement may retain a capability-specific secondary lock, with these rules:

```text
shared account gate
-> capability locks sorted lexically (admin before premium when both are required)
-> operation receipt
-> entitlement lineage or weekly selection/head
-> remaining mutable rows in stable identity order
```

A transaction must never take a capability lock before the account gate and must
never acquire a second account gate. Cross-account batch work is split into separate
transactions; if a later administrative boundary truly needs several accounts, it
must sort account UUIDs and receive a separate review.

The future repair should replace the existing entitlement and Adaptive writer
function bodies in one reviewed migration transaction while preserving signatures,
ownership, grants, audit semantics and business results. A small protected helper may
compute/acquire the resource so the byte-for-byte namespace cannot drift again. The
repair must not map authenticated or service-role callers into provisioning authority.
Preflight must compare all relevant writer bodies, and rollback-only acceptance must
race revoke against activation for one account and prove different accounts do not
share the same resource. No executable repair is part of this package.

## 3. NutritionPreferenceSnapshotV1

`NutritionPreferenceSnapshotV1` is an immutable account-owned input revision. Its
canonical snapshot contains:

- contract, account ID, revision ID and nullable predecessor revision;
- hard dietary pattern (`UNSPECIFIED`, `VEGETARIAN`, `VEGAN`);
- hard excluded meal types, ingredient identities and recipe identities;
- soft liked/disliked ingredient identities;
- nullable convenience preference and meal-style preference tokens;
- server timestamp and SHA-256 of the strict canonical snapshot.

Arrays are sorted and unique. Unknown fields, invalid identities and digest mismatch
fail closed. A dislike is soft unless a validated write explicitly places the identity
in the hard exclusion collection. Missing data is not an empty preference: a valid
default is a real immutable revision whose lists are empty and dietary pattern is
`UNSPECIFIED`.

## 4. NutritionSafetySnapshotV1

`NutritionSafetySnapshotV1` is separate immutable user safety authority. Its v1
content is limited to product semantics already approved:

- contract, account ID, revision ID and nullable predecessor revision;
- declared allergen codes;
- declared intolerance codes;
- dietary hard-exclusion codes;
- server timestamp and canonical SHA-256.

The food catalog's allergen/intolerance evidence describes a product; it cannot stand
in for this user snapshot. Pregnancy, diagnoses, medicine interaction and other
clinical states are outside v1. A user with no declared constraints still needs a real
explicit empty revision. Missing, wrong-account, stale or digest-invalid safety
authority blocks generation.

## 5. Preference and safety boundary

Safety is always a hard candidate-eligibility gate. Preference is a hard gate only
for the explicit hard fields; its soft fields affect deterministic optimization but
cannot independently reject a candidate. A future user change boundary may create a
successor for either authority, but it cannot edit history or silently translate a
soft dislike into a safety exclusion.

The recommended storage is:

- immutable `nutrition_preference_snapshots_v1` revisions;
- immutable `nutrition_safety_snapshots_v1` revisions;
- one protected `nutrition_authority_heads_v1` row per account, pointing to the exact
  current preference and safety revisions and carrying a head/CAS revision.

Each history table has an account-scoped predecessor FK and at most one direct
successor. Canonical bytes/digest are the authority; indexed columns are verified
projections. Creating the first authority head atomically creates explicit empty
snapshots when the user has not supplied values. A missing half-initialized head is
invalid rather than inferred.

## 6. AdaptiveNutritionCandidateManifestV2

Use a new dedicated, protected, immutable publication authority. No existing generic
structure was proven suitable, and `validated_plan_replacement_offers_v1` is a private
replacement artifact rather than content-publication authority.

Each manifest entry binds exactly:

- recipe, recipe-revision, portion-revision and eligibility-revision IDs;
- publication revision and `PUBLISHED` state;
- canonical and nutrition evidence revisions plus digests;
- allergen and dietary evidence revisions;
- the exact ingredient identities and reviewed allergen, intolerance and dietary
  claims resolved by those evidence revisions;
- allowed meal types, component role, anchor kind and companion-role sets;
- pairing and incompatibility tags, repeat family and dominant ingredient family;
- the established energy class and beverage class from composition v1.1;
- accessibility class and explicit specialty/expensive flags;
- reviewed HYBRID serving range/increment and all discrete-component increments;
- the complete immutable Graph recipe snapshot and its independently recomputed
  digest.

The manifest header binds contract/encoding, manifest revision, nullable predecessor,
published state, server publication time, canonical bytes and SHA-256. Entries have a
unique four-revision identity and canonical order. A draft or mutable catalog row is
not eligible merely because its identity resembles a published entry.

Recommended storage uses an immutable manifest-header row as the sole authority plus
immutable entry projections written and verified in the same publication transaction.
The projections support exact membership checks; they cannot be updated separately or
authorize content if their header bytes/digest do not verify. A protected singleton
head points to the current published manifest. This is one source of truth rather than
a second mutable catalog.

## 7. Content pipeline gate

Only this chain may add an entry:

```text
AUTHORING
-> OWNER REVIEW
-> TEST/ASSEMBLY
-> approved corrections
-> canonical mapping
-> nutrition/publication evidence
-> composition/eligibility review
-> immutable publication revision
-> candidate manifest inclusion
```

There is no auto-publication. The current 120 names/formulations have not completed
that chain and remain outside every published candidate manifest. No UUID, evidence
revision or eligibility may be invented to move them forward.

## 8. Trusted generation input and CAS

`TrustedGenerationInputV1` now carries the explicit shared-account-gate contract and
pins real `preferenceRevision`, `safetyRevision`, `candidateManifestRevision` and
`candidateManifestDigest`. The manifest revision maps to Graph v2's existing
`catalogManifestRevision` field for wire compatibility; this does not create a second
catalog authority. Explicit empty preference/safety states still reference real
snapshot revisions.

Before settling generation and again inside atomic activation, the server compares:

- authoritative account and shared gate contract;
- selection identity/revision, pending state and null head;
- week anchor/timezone and Goal/target revisions;
- effective verified entitlement and its evidence;
- current preference and safety heads;
- current published manifest revision and recomputed digest;
- composition, validation, optimization and generation policy revisions.

Any mismatch is `CONFLICT_STALE_INPUT`; the server does not rebase, regenerate or
silently adopt a newer authority in that request. Candidate membership requires an
exact four-ID manifest entry and a matching recipe snapshot digest. Safety checks
consume only the claims bound inside that protected entry; generator/client claims
cannot suppress an allergen or hard-exclusion match.

## 9. Reads and immutable history

Future narrow server reads are:

- own current preference snapshot and exact own historical preference revision;
- own current safety snapshot and exact own historical safety revision;
- protected generator/activation read of the current published manifest;
- protected exact manifest revision plus digest read;
- receipt-bound Graph reads that expose the exact authority revisions already pinned
  by the Graph.

Historical Graph and future FACT records retain the exact preference, safety and
manifest revisions used at generation. Moving current heads never rewrites them and
historical nutrition is never recomputed from current policy or catalog data.

## 10. Security

All three authority families are server-owned. Snapshot and manifest history is
append-only with RLS enabled and forced, no direct authenticated DML, immutable guards,
fixed search paths and narrow grants. Browser code cannot publish a manifest, edit
history, choose another account, set heads, or bypass safety with local state. Future
preference/safety submissions enter narrow validated server boundaries that derive
`auth.uid()`, create one successor and advance the matching head atomically. Manifest
publication requires a separately approved owner-controlled operator boundary and
audit; neither authenticated nor service role becomes a client publication shortcut.

## 11. Synthetic contract matrix

| # | Case | Required result |
|---:|---|---|
| 1 | Explicit empty preference snapshot | valid real revision/digest |
| 2 | Explicit empty safety snapshot | valid real revision/digest |
| 3 | Missing required safety snapshot | blocked |
| 4 | Preference revision changes mid-generation | `CONFLICT_STALE_INPUT` |
| 5 | Safety revision changes mid-generation | `CONFLICT_STALE_INPUT` |
| 6 | Soft dislike matches candidate | eligible; optimization signal only |
| 7 | Hard ingredient exclusion matches | blocked |
| 8 | Declared allergen matches product evidence | blocked |
| 9 | Product allergen evidence but no user safety snapshot | blocked |
| 10 | Exact published manifest component | eligible |
| 11 | Candidate missing from exact manifest | blocked |
| 12 | Duplicate four-ID manifest identity | manifest rejected |
| 13 | Unpublished recipe entry | manifest rejected |
| 14 | Current manifest revision changed | `CONFLICT_STALE_INPUT` |
| 15 | Manifest digest mismatch | strict decode rejected |
| 16 | Replacement offer supplied as manifest | contract rejected |
| 17 | Entitlement revoke and activation, same account | same gate serializes |
| 18 | Capability lock before account gate | lock order rejected |
| 19 | Concurrent activation/revoke, same account | deterministic serialized result |
| 20 | Work on different accounts | different gate resources |
| 21 | Current heads advance after activation | historical Graph pins old revisions |
| 22 | Current 120 authoring recipes | absent from manifest; ineligible |

The TypeScript cases prove strict local DTO/digest/ordering logic only. Future
rollback-only database acceptance must prove table immutability, current-head CAS,
RLS/grants, shared advisory-lock serialization and atomic rollback.

## 12. Remaining checkpoint

The next safe checkpoint is owner review of this design and explicit authorization to
prepare, but not apply, one bounded runnable schema/repair draft for: the shared lock
helper and writer replacements; preference/safety histories and head; candidate
manifest history/head/projections; exact reads; preflight; rollback-only acceptance;
and postcheck. Before any STAGING apply, that future package needs separate owner
approval. Generator activation remains off throughout.

Status markers:

- `GRAPH_V2_MISSING_AUTHORITIES_DESIGN_READY`
- `SHARED_ACCOUNT_LOCK_REPAIR_DESIGN_READY`
- `NUTRITION_PREFERENCE_SNAPSHOT_V1_READY`
- `NUTRITION_SAFETY_SNAPSHOT_V1_READY`
- `CANDIDATE_MANIFEST_V2_CONTRACT_READY`
- `GRAPH_V2_RUNNABLE_SCHEMA_DRAFT_STILL_NOT_STARTED`
- `GENERATOR_NOT_ACTIVATED`
