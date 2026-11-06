# Exact typed Food / water / salt preparation V3

Status: unmounted candidate and synthetic evidence tests only. No real water/salt
source approval, IDs, issuance, recipe publication, Graph, SQL or runtime binding.

## Reuse, not a parallel issuer

The existing request/receipt verifier from Draft #165 is imported **verbatim**:

- Inspected head: `5054ecb8d9ead892d408f9a778a597928247b54a`.
- Path: `src/server/nonFoodEvidenceV1.ts`.
- Git blob: `21a757a648bd8dc68de486ef84d4b9dbe1459fa8`.

Only that read/validation module is transferred. No gateway, HTTP handler,
attestation issuer, SQL, migrations, grants, receipts store or retention policy is
copied or applied. The reused verifier retains strict raw request/actor/digest/
source binding and separately linked definition/nutrition revisions. Its V1
nutrition accepts five explicitly evidenced zero tracked macro values only;
positive calories/protein/fat/carbs/fiber cannot bypass Food review.
This does not mean salt has no sodium or that safety/dietary checks can be skipped.

## Trusted complete snapshot reader

`resolveNonFoodReviewedSnapshotV1` consumes selected definition/nutrition approval
operations, atomic current heads/state and **complete** relevant operations from
a trusted server-owned store. Each operation carries the original request bytes,
actor and raw receipt; the unchanged verifier checks all of them. The wrapper
first applies bounded duplicate-aware JSON, safe-number and negative-zero checks
before nested serialization. Read limits are deliberately narrower than the
old request's 1MiB maximum: each raw packet <=262144 UTF8 bytes, depth <=12, history
2..128 dense entries. Oversized data blocks, never truncates.

The independently pinned recipe mapping selects an existing definition ID, stable
key, exact definition/nutrition revisions/digests and applicability state. Typed
water/salt kind comes from that trusted mapping, never a display-name heuristic.
The reader verifies selected revisions, full linked definition equality, distinct
approval event IDs, current heads/state and exact approval digests in history.
Every event must receive literal `true` from the existing generic event-time
issuance/authorization port. Nonfood V1 event shape remains unchanged. A Food-only
verifier is not implicitly a mixed-event verifier. No default allow callback is
provided outside explicitly synthetic tests.

Missing, duplicate, substituted or malformed histories fail closed. Either
invalidation blocks regardless of severity, order or timestamp. An event ID with
a different payload/digest cannot replace the selected approval. Hashes alone do
not establish authenticity or history completeness. A real atomic store and
V1-capable trusted authority implementation remain required; hiding invalidations
from a supplied snapshot is outside what a hash can detect.

## Separately versioned mixed preparation

V3 wraps the existing immutable V2 authoring request and explicit nonfood bindings
covering every typed row, with its own request/snapshot domains. V2's existing
FOOD-only decoder/calculator remain unchanged and still block typed Nonfood.
No V2 acceptance rule or Graph V1/V2 decoder is widened. The wrapper is a source
composition request, not a fake V1 approval-carrier artifact.

The server owns all ingredient snapshots before awaiting any digest/authorization.
FOOD rows reuse the exact reviewed Food V2 adapter; typed rows reuse the new
read-only wrapper around unchanged Nonfood V1 receipts. Every row must match its
selected identity/revisions/state/basis. Any missing or revoked ingredient blocks
the whole preparation, never emits partial totals.

| Recorded row | Contribution | Mass |
| --- | --- | --- |
| FOOD g | Exact source vector * grams / 100 | Recorded grams |
| Reviewed water g | Explicitly evidenced zero tracked vector scaled by grams | Recorded grams |
| Reviewed water ml | Explicitly evidenced zero tracked vector; no density | Unknown, null |
| Reviewed salt g | Explicitly evidenced zero tracked vector scaled by grams | Recorded grams |

The snapshot separates `knownInputMassGrams`, `unknownMassRowIds` and nullable
`inputMassGrams`. Any unknown mass keeps total mass null; known mass is not
mislabelled as total. Volume remains recorded. Exact whole/conditional serving
nutrition is available without asserting measured cooked yield, nutrient retention
or physical serving size. Missing declared servings stay null; cooked yield always
stays null. All results retain authority NONE / INPUT_COMPONENTS_NO_COOKING_RETENTION_CLAIM.

Readback reruns receipt/authority checks and recomputes all fields rather than
trusting output hashes. A prepared snapshot is not authorization for a later write:
transactional currentness/receipt/CAS gates must still be integrated.

## Limits and next work

No real source bytes, workbook, Food IDs or Nonfood events are altered or minted.
Synthetic complete chains demonstrate control flow, not actual review or JWT/
PostgREST validity. The 19 real pilot recipes still lack the required real identity/
source/publication approvals and are not admitted by this change. Recipe source,
allergen/dietary/portion/eligibility/publication review remains separate. Owner
cooking/yield checks remain deferred; unknowns are not invented.

Parent #344 head `3c8cfd72004489bba1d071560d4a27a9c78da10d` passed PR checks and
PostgreSQL admission. Its separate Edge workflow run42154740585 failed; the known
strict TLS/peer-DER compatibility gate remains blocking, with no authentication or
CPU-limit relaxation. No new service, live DB connection, migration, deploy,
merge, diary/FACT write or generator activation is performed.

Next: exact meal/week composition over these typed input snapshots, separately
versioned Graph/validator/storage/readback compatibility and real authenticated
store/issuer integration under the established authority model.
