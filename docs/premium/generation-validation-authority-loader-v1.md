# Generation validation authority source projection v1

Status: **INACTIVE LOADER LOGIC / DATABASE SNAPSHOT READER NOT IMPLEMENTED**.
Base: #245 at `a1690a85dd5240c2e2869cf16f7d72b939e744c2`.
This package implements source decoding/assembly; it does not claim a connected
Supabase loader, current entitlement proof or working generation.

## Read-only live findings — 30 October 2026

The saved observation and catalog query accompany this document. Queries used
`BEGIN READ ONLY` and `ROLLBACK`; only system catalogs/function definitions and
eight aggregate Staging counts were read. No user rows, account IDs, tokens,
personal preferences, requests, recipes or private bytes were selected.

- POTOK: no relations in `potok_nutrition` or matching public `adaptive_nutrition%`
  relation scope; only `acquire_shared_account_gate_v1` in the inspected function
  scope. The two named public request/status functions are absent. This is a
  generation prerequisite gap, not a reopening of completed security acceptance.
- POTOK Staging: request/manifest/preference/safety/policy-head/goal-target tables
  and generation gateways exist. Counts of requests, policy heads, goal targets,
  authority heads, preference/safety snapshots and manifests/manifest heads are all
  zero. No generation or evidence publication was tested.
- `load_generation_request_v2(uuid)` is **not a read-only loader**. Inspection of
  its actual definition shows request row locking, attempt-ledger insertion and
  status changes. It was not invoked. Do not call it from read-only inventory or
  reuse it as the atomic source reader merely because its name starts with load.
- The inspected `potok_nutrition` catalog has no separate store for the full
  validation policy body, trusted per-component/distribution evidence or
  evaluated-plan warning evidence. The policy head holds revision identifiers,
  not those full payloads. No absence claim is made about every other schema or
  external unpublished service.

## Implemented source-to-consumer boundary

`createGenerationValidationAuthorityLoaderV1(store)` implements the authority
port consumed by #245. Its dependency is a **future trusted atomic snapshot
reader**, `GenerationValidationSourceStoreV1.readSnapshotRaw(requestId, proposalSha)`.
No database client, credentials, RPC name, schema creation, secret, query executor
or live implementation of that store is provided.

The source raw package binds the exact durable request/account and evaluated
proposal SHA. Input carries stored `canonicalHex` and its existing
`generationInputDigest`; manifest, preference and safety carry stored
`canonicalHex` plus `storageSha256`. Existing raw validation evidence, policies
and warnings remain separate. Every prerequisite must be explicit; a null
source yields unavailable, never a default policy or fabricated publication.
Malformed supplied shapes/hex/raw JSON raise errors. No successful source cache
is retained; exceptions propagate without hidden retries.

For complete sources, verify strict UTF-8/duplicate JSON and the appropriate
existing digest domain. Manifest/preference/safety storage SHA is verified before
interpretation; the typed input digest is checked after strict decoding. Only JSON.parse-owned data reaches existing
domain decoders/seal functions. Manifest/preference/safety content without digest
is projected to the existing strict consumer snapshot, and existing canonical
encoders must reproduce the original bytes exactly. The normalized generation
input must also match its existing canonical JSON representation. Rehashed
noncanonical content is rejected rather than silently normalized.

The request/account/input, manifest identity/digest, preference/safety revisions
and accounts are cross-checked. The existing RawV2 policy/evidence decoder checks
the assembled context. Warning content is passed unchanged to #245's actual
plan-bound warning/whole-week validator; the loader does not compute signals.

## Storage hashes and consumer domains are distinct

Actual Staging authority and manifest writer definitions store canonical JSON
content **without** a top-level `digest` and separately SHA256 those bytes.
Consumer decoders expect their existing computed digest fields. The loader
computes these using existing domains only after checking stored source integrity;
it issues no review, publication, UUID, revision or receipt.

The actual `adaptive_nutrition_request_generation_v2` definition was also inspected.
Its `generation_input_digest` already hashes the existing `{contract,input}`
envelope, matching `trustedGenerationInputDigestV1`. Verify that stored digest
directly; a raw byte SHA cannot substitute for it. The raw-storage SHA domain
applies to manifest/preference/safety, not to this request input field. No new
input checksum column or DB digest/domain rewrite is required.

A prior draft in this PR incorrectly described the input checksum as raw-byte
SHA. The correction follows the actual Staging writer definition and adds the
regression that rejects a raw SHA substituted for the stored typed-input digest.

Integrity is not provenance: replacing an entire trusted source and its hashes
can produce consistent data. The future store must authenticate the actor,
authorize the exact durable request, independently obtain/pin every source,
verify publication/current heads and source receipts, and return a single
consistent read. It must not trust raw client/generator assertions or combine
paginated browser reads. Nothing in this module proves that these DB conditions
already hold. Final writes must repeat entitlement/currentness/CAS in their own
transactions; loader output is not a database capability.

## Validation and remaining work

Tests use existing synthetic full-week fixtures and the actual domain encoders
and validator. They cover stored-byte and consumer-digest domains, missing seven
prerequisites, bad storage hashes, canonical drift despite rehashing, substituted
request/account/revisions, duplicate JSON, self-declared digest fields, blocked
warnings, malformed data, loader exceptions and reload after a source disappears.
No native PostgreSQL storage-reader or live issuance acceptance is claimed.

Before implementing or deploying the actual DB reader, prepare the missing
reviewed policy-body, validation-evidence and plan-warning storage/publication
contracts, with their provenance and retention. Reuse existing immutable request
and content identities. Do not repurpose an ID-only policy head as a full policy,
write invented entries into empty tables, or treat source fixture construction as
publication. Then test the real reader/security boundary on a disposable database,
followed by separately authorized exact Staging installation and end-to-end tests.
Real recipe source review, measured yield/servings and weekly catalog feasibility
remain necessary before any real weekly plan. Production generation remains off.
