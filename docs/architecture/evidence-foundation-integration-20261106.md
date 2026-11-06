# Existing evidence foundation in the exact generator branch

The generator branch previously contained exact evidence consumers and a pure Nonfood model but not the existing Food/Nonfood issuance gateways and SQL acceptance packages from PR154/165. Their omission is a real integration dependency for using reviewed catalog data. This change imports that existing foundation without inventing another permission ledger or approving real input data.

Source heads are PR154 b36f55500fc4b142bfa7b3029dc4c511a9d58c75 and PR165 5054ecb8d9ead892d408f9a778a597928247b54a. The import manifest lists exact upstream blobs. The current foodReviewedEvidenceV1 utility is preserved rather than replaced by an older copy; the existing Nonfood model already matches the upstream blob and is reused. The only imported-workflow adjustment selects the exact PR head for Food PostgreSQL CI. Existing historical review/retention documents retain their original scope and limitations.

## Actual Staging state

Readonly metadata and aggregate counts on 2026-11-06 show the V1 schemas potok_food_evidence and potok_nonfood installed (six and seven tables respectively), all with forced RLS. Canonical/nutrition revisions, definition records, review events and current heads have zero rows. Those separate schemas are not visible to a query restricted to potok_nutrition. The retained metadata snapshot contains no user payloads, credentials or food identities; it is historical evidence, not current permission or approval.

Do not reapply these original installation drafts to Staging: the V1 foundation is already installed, and its deployed code/role/retention state must be reviewed before any later write. The exact V2 nutrition issuer/storage and the exact generation candidate are not thereby installed. This integration performs no hosted mutation, source issuance, publication, real-Auth acceptance, retention approval or activation.

## Compatibility and verification scope

The legacy Food issuer accepts its original three-place format. New exact decimals, V2 revisions and V2 approval events cannot silently become V1 requests/receipts. The existing independently authorized V2 atomic consumer continues to decode exact values. Nonfood V1 remains limited to five explicitly zero nutrition values and cannot issue positive-food nutrition. These cross-version checks run alongside imported unit tests and the current exact source/Graph/admission tests.

Imported Food and Nonfood CI create their own disposable PostgreSQL clusters and use the existing real SQL permission, immutability, currentness, CAS, receipt and transaction checks. The generation workflow uses its separate disposable database. Passing these suites establishes source compatibility and independent database acceptance; it does not prove all schema packages co-installed into one database or the full HTTP/Auth/application flow. Their Auth claims and food/source data are explicitly synthetic. No live database URL is accepted by those runners.

The next implementation must add exact V2 nutrition issuance/storage using the existing authority and retained-source framework. It must preserve canonical identity, exact original nutrition/source bytes, expected-head comparison, independently verifiable event-time authority, invalidation, idempotent recovery and old-reader fail-closed behavior. A decimal decoder or an unadmitted retained packet is not that issuer. Actual source/recipe review and a separately reviewed Staging write remain later steps; cooking/yield measurements stay deferred to owner prelaunch testing and are not invented.
