# P5-03C — retention and Auth/PostgREST remediation gates (2026-10-20)

Status: **REMEDIATION PREPARATION ONLY / NOT APPROVED / NOT DEPLOYED**. Supplements PR #182. Existing SQL drafts remain inactive; no historic revision/event/receipt is rewritten or deleted.

## Verified blockers and why green CI does not close them

1. **Physical account deletion**: `potok_food_evidence.review_events_v1.actor_id`, `review_requests_v1.actor_id`, `potok_nonfood.events_v1.actor_id`, `receipts_v1.actor_id` reference `auth.users(id) ON DELETE RESTRICT`. Linked authority attestations also reference actor UUID. New personal-history rows would block physical Auth deletion, even after evidence invalidation.
2. **Embedded copies**: raw proposal/request bytes, retained-source bytes, snapshot JSON, revision JSON/canonical bytes, event JSON/canonical bytes, receipt JSON and repeated actor/attestation identifiers cannot be erased by removing a single source table. Current immutable guards forbid UPDATE/DELETE/TRUNCATE on historical evidence. No deletion, redaction or cryptographic erasure implementation exists.
3. **Live trust boundary**: disposable PostgreSQL exercises real transactions/grants/RLS with synthetic JWT SQL claims, **not** Supabase Auth JWT verification, actual PostgREST transport or real user lifecycle. Unit transport doubles are not a live end-to-end acceptance.
4. **Unverified external copies**: Auth/profile/Adaptive Graph and diary refs, Storage buckets, local/offline queues, CDN, backups, support logs and account closure orchestration must be inventoried before a live retention policy can be judged complete.
5. **Catalog lifecycle**: archived/shared food roots have existing consumer/importer/write-path risks. A Food-only FK change is not global account closure or archive protection.

## Owner decision — approved 2026-10-20 (principle only)

**APPROVED:** Personal account data (including private diary, private/unpublished foods and recipes, personal inputs, and identifiable reviewer/upload attribution) must be erased as part of an authorized account-deletion lifecycle. A separately reviewed and published *shared catalog product* may remain available to other users **only if** its remaining record and all reachable retained source/evidence/receipt/event/history/backup copies no longer permit identifying or reasonably re-linking the former account holder. Product nutrition must remain supported by independently verifiable product/source/version evidence, not merely orphaned macro numbers. No automatic promotion of user submissions.

**FAIL CLOSED:** If safe separation, third-party source rights or verifiable independent provenance cannot be demonstrated, the shared record cannot be retained on the strength of this approval alone. Evaluate withdrawal/re-review and dependent diary snapshot integrity separately; never silently alter historical FACT.

**NOT APPROVED BY THIS DECISION:** any numeric retention window, legal basis or legal hold, blanket deletion of immutable evidence, severing existing FKs, keeping original user UUID in hidden audit, anonymization technique, data-processing migration, running deletion/erasure jobs, live Auth/PostgREST tests, staging/production apply, activation, publication of candidate products, or merge. All remain gated on a reviewable end-to-end design and explicit permission.

Acceptance criteria for follow-up implementation:
1. After deletion, no user-identifying/re-linkable data in surviving catalog root, aliases, source snapshots, revisions, event payloads, exact raw receipts, entitlement references, backup/Storage/offline mirrors, or external operational logs under the approved threat model.
2. Shared products retained only when an independent nonpersonal source of truth can reproduce identity, nutritional values and source/version mappings; no user-provided brand claim automatically becomes public.
3. A single account-closure fence blocks new writes and serializes closure against concurrent approval/replay; retries do not resurrect personal data or create duplicate evidence.
4. The system distinguishes **personal erasure**, **shared catalog preservation**, and **diary FACT snapshot preservation** with explicit evidence and tests; never equate sign-out with account deletion.
5. Deletion failure is recoverable and visible as pending/blocked, not falsely marked complete. Real Supabase/Auth, RLS, Storage and backup lifecycle acceptance must be separately executed.

## Approved direction vs awaiting owner decision

The POTOK master goals require secure privacy, account deletion and export, and staged, independently authorized migrations. Earlier Phase 2C retention design prefers **physical deletion of accounts with a minimized privacy-safe audit**, explicitly **rejects indefinitely keeping the original account UUID as an unquestioned anchor**, and does **not** choose numerical retention periods.

The following implementation and policy details **remain unapproved** despite the approved separation principle (no invented default):
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

## Implemented in Draft PR — admission-only contract (2026-10-20)

`src/server/accountClosureFenceV1.ts` adds an **unmounted, read-only** admission classifier and injected read port. Verified `ACTIVE` observation returns a revision-bound **preliminary** ALLOW; `CLOSING`, `CLOSED`, absent/foreign/malformed data or read failures all fail closed. `src/server/__tests__/accountClosureFenceV1.test.ts` covers those cases in PR CI.

**Security scope:** the read port MUST be backed by trusted server storage and Auth authority; an arbitrary client-generated observation is not a trusted state. Even trusted `ACTIVE` does **not** grant permission to issue an evidence mutation: issuance and the `CLOSING` transition still require a single serialized, commit-checked database write-side fence and a recoverable closure journal. No database tables, endpoints, account deletion worker or runtime imports were added. Hence **ACCOUNT_CLOSURE_IMPLEMENTED=false**, **LIVE_ERASURE_VERIFIED=false**. The owner-approved preservation principle does not authorize retention dates, wiping evidence, changes to FKs or live rollout.

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
