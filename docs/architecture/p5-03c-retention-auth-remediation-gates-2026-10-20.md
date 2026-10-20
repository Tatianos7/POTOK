# P5-03C — retention and Auth/PostgREST remediation gates (2026-10-20)

Status: **REMEDIATION PREPARATION ONLY / NOT APPROVED / NOT DEPLOYED**. Supplements PR #182. Existing SQL drafts remain inactive; no historic revision/event/receipt is rewritten or deleted.

## Verified blockers and why green CI does not close them

1. **Physical account deletion**: `potok_food_evidence.review_events_v1.actor_id`, `review_requests_v1.actor_id`, `potok_nonfood.events_v1.actor_id`, `receipts_v1.actor_id` reference `auth.users(id) ON DELETE RESTRICT`. Linked authority attestations also reference actor UUID. New personal-history rows would block physical Auth deletion, even after evidence invalidation.
2. **Embedded copies**: raw proposal/request bytes, retained-source bytes, snapshot JSON, revision JSON/canonical bytes, event JSON/canonical bytes, receipt JSON and repeated actor/attestation identifiers cannot be erased by removing a single source table. Current immutable guards forbid UPDATE/DELETE/TRUNCATE on historical evidence. No deletion, redaction or cryptographic erasure implementation exists.
3. **Live trust boundary**: disposable PostgreSQL exercises real transactions/grants/RLS with synthetic JWT SQL claims, **not** Supabase Auth JWT verification, actual PostgREST transport or real user lifecycle. Unit transport doubles are not a live end-to-end acceptance.
4. **Unverified external copies**: Auth/profile/Adaptive Graph and diary refs, Storage buckets, local/offline queues, CDN, backups, support logs and account closure orchestration must be inventoried before a live retention policy can be judged complete.
5. **Catalog lifecycle**: archived/shared food roots have existing consumer/importer/write-path risks. A Food-only FK change is not global account closure or archive protection.

## Approved direction vs awaiting owner decision

The POTOK master goals require secure privacy, account deletion and export, and staged, independently authorized migrations. Earlier Phase 2C retention design prefers **physical deletion of accounts with a minimized privacy-safe audit**, explicitly **rejects indefinitely keeping the original account UUID as an unquestioned anchor**, and does **not** choose numerical retention periods.

The following decisions **remain unapproved** (no invented default):
- Retention duration and lawful grounds for raw source bytes, user-origin metadata, immutable personal events, exact receipts/idempotency, trust attestations, backups and support logs; each needs a finite purpose, access scope, exceptions/legal-hold and review cadence.
- Nonpersonal verifiable checkpoint and linkability threat model after erasure; whether/which evidence may survive without retaining direct or indirectly linkable personal identifiers.
- Supported account closure and rollback/recovery procedure across Auth, profiles, Premium plans/FACT, Food/Nonfood, Storage, logs, backup restore and offline clients.
- Whether product publication may proceed with only source candidates while reviewer issuance remains off (**NO** under current safety contracts). No fake reviewer, no provisional authoritative ID.

## Proposed implementable architecture — requires approval before deployment

1. **Account closure gate**: privileged, audited server endpoint marks account `CLOSING`; admission and new Food/Nonfood/Adaptive writes/read paths reject this state. Do not rely on browser sign-out as deletion. A journaled closure job with exact checkpoints and idempotent recovery handles network/worker failures. This is not present yet.
2. **Inventory every copy**: classify roots, sources, revisions, events, receipts, authority ledger, related Adaptive/user content and off-database copies by personal/possibly-identifying/shared public provenance. For each, prove data controller, key dependency, copy path, exposure, approved retention and erasure transition. A root FK inventory alone is insufficient.
3. **Decouple shared nutritional claims from user identity**: after owner-approved policy, keep only minimal independently verifiable **non-personal** provenance/checkpoints; ensure historical event proofs and digest verification remain honest about removed payload. Do not mutate a hash chain, silently null actor IDs or claim full history remains byte-identical after erasure. Document any trade-off where proof cannot survive deletion.
4. **Finite receipt recovery**: preserve exact-byte/idempotency semantics while intent is pending, then use explicit expiry/closure state; deny old key reuse without retaining indefinitely identifying request bytes. No unsafe retry/new-key behavior.
5. **Archive/catalog compatibility**: dedicated all-writer design with lock-order/race acceptance, shared root archive guard, historical diary snapshot preservation and no automatic deletion of shared catalog entries.
6. **Tests first**: disposable PostgreSQL fixtures for first/middle/last account closure, RESTRICT FK negative test, source-in-event/receipt copy audit, concurrent issuance-vs-closure, expired receipt and backup restoration semantics; separate live **STAGING-only** Supabase Auth/JWT/PostgREST acceptance after owner approval. For now, negative test that physical DELETE is blocked is evidence of the defect, not proof of an erasure fix.
7. **Rollout**: owner reviews exact policy and authored SQL changes; separate authorization for live SELECT-only preflight and, later, STAGING apply; canary/rollback acceptance before any Main deployment. Zero changes to live data in this PR.

## Immediate automated review guard

`scripts/contracts/p5-03c-retention-gates-v1.test.ts` performs source-level regression checks that known identity-linked FKs, immutable retained copies and explicit nonapproval remain visible. It rejects accidental CASCADE or an unsupported claim of completed erasure/retention, but **does not prove** data deletion, satisfy legal policy, or authorize deployment.

## Gate status

| Gate | Status |
| --- | --- |
| Source and original schema/FK inventory | VERIFIED IN REPO |
| Full per-copy lifecycle/erasure design | OPEN |
| Numerical periods/rights/legal basis | OWNER DECISION REQUIRED |
| Database-level erasure/closure implementation | NOT IMPLEMENTED |
| Real Supabase JWT/PostgREST | NOT VERIFIED |
| Disposable Food and Nonfood PostgreSQL acceptance | PASS on PR #182 prior verified head; rerun after changes |
| Owner authorization for SQL apply/flags/deploy | NOT GIVEN |
| Merge/release claim | **BLOCKED pending approval and independent review** |

P5-04 generation remains separately gated on real reviewed food/nonfood evidence, recipe yield/servings and trusted publication. Neither green tests nor this document declares the pilot recipe ready.
