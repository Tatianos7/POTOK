# Nutrition Integrity V1 — reviewed adapter security review (Draft PR #176)

Status: isolated pure adapter only; **not approved for production use, storage access, or diary writes**.

## Verified in isolated code

- Strict existing reviewed-evidence decoders validate raw canonical and nutrition revisions, digests, retained-source mappings, exact canonical binding and food-state applicability.
- Exact active canonical and nutrition revision identifiers are checked against adapter-supplied inputs.
- Both approval events are decoded and bound to their exact revision. Authorization callback is called for approvals and all supplied historical events. A supplied invalidation of either selected revision fails closed.
- Empty, duplicate, mismatched, unauthenticated or malformed supplied event sets do not produce REVIEWED.
- Tests use entirely synthetic evidence. No real catalog or reviewer decisions are established.

## Blockers before wiring to Supabase/runtime

1. **Complete invalidation history is not proven by the function.** Supplying only two genuine approvals, while omitting a later invalidation, still yields REVIEWED. The future privileged DB reader must guarantee exhaustive event coverage, correct target linkage, no missing pages, and a transaction-consistent snapshot. Never expose `ReviewedEvidenceSnapshotV1` as caller-supplied HTTP JSON.
2. **Authorization callback is not itself an authorization implementation.** `isAuthorizedEvent` must independently prove trusted server issuance and review authority at the time of each event, including historical changes of roles. Hashes and event-declared OWNER/ADMIN fields alone are insufficient.
3. **Atomicity and currentness.** Head revision IDs, retained revisions, approvals, every invalidation and current food state must come from one consistent authorized server-side read. Evidence can be invalidated after read: a diary write needs a DB-enforced recheck/transactional gate. A mere calculated REVIEWED result is not authority to persist CONFIRMED.
4. **No live storage adapter or conversion authority.** This PR supplies neither the real storage reader nor reviewed conversion applicability; a future implementation must cover both before enabling gram/ml/portion writes.
5. **No production approval from tests.** Node CI covers synthetic cases; direct PostgREST, RLS/privileges, admin recompute, idempotency, historical immutable snapshots and old clients remain separate acceptance gates.

## Current disposition

Safe to consider merging **only as isolated, unused scaffolding**, after current-head CI and owner authorization. **Not safe** to treat as the trusted production Supabase adapter or as completed Issue #170. Leave the PR unmerged until separately approved.
