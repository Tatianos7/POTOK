# P5-03C persistent admission — inactive SQL draft

This follows PR #254 (`8a0e362caeb9b67b2feaadf9b275facba4ac6a43`), whose real
PostgreSQL matrix passed 49/49 with no skips. It prepares persistent server code;
it does not install that code on Supabase or activate issuance.

## Implemented boundary

`supabase/migration_drafts/account_closure_admission_v1.sql` creates a private,
FORCE-RLS account-state table, with an explicit SQL-owner policy and all client
table/schema privileges revoked. There is no ACTIVE backfill or signup hook.
Only trusted, separately reviewed registration may create ACTIVE state. Missing
state blocks issuance. The SQL owner remains an operational trust boundary.

The draft supplies explicit definitions of the two existing public issuer bodies in one atomic transaction,
after verifying their exact source hashes, SECURITY DEFINER metadata, fixed search
path and owner. It inserts a private no-argument admission call after the first
trusted authority check. The later authority check, signatures, owners, privileges,
nutrient arithmetic, receipts and source bytes remain unchanged. Direct calls to
the original public issuers therefore use the same admission gate.
An exact byte comparison removes the added admission call and proves the remaining
definitions equal the original source; no source-text rewriting runs at installation.

`public.account_closure_begin_v1(text)` accepts the existing two-field owner
request contract. It derives the target exclusively from live `auth.uid()` and
the matching unexpired Auth session, ignoring no caller-supplied target because
target/role fields are rejected. An ordinary owner needs no admin entitlement.
The shared reviewer-entitlement advisory gate is acquired for lock ordering only,
then live Auth row locks, then the common account advisory lock and state row lock.
Both issuance and closure hold these locks until transaction completion.

ACTIVE transitions to CLOSING with the original closure key and a monotonically
increased revision. A repeated equivalent UUID key returns the existing receipt;
a different key conflicts without making a new transition. UUID case differences
are normalized for storage and the request spelling is preserved in the response.
No public key-changing, reopening or CLOSED operation exists. State retirement is
blocked until separately designed. A deferred trigger rechecks fresh owner/session
authority when a new transition commits; explicit failures roll back the state.

The five-field receipt matches `verifyClosureCommittedReceiptV1`. This is a SQL
contract, not a registered application route or a mounted Auth transport adapter.
RPC EXECUTE is explicitly granted only to authenticated, with PUBLIC/anon/service
revoked. All private helpers remain inaccessible to client roles.

## Verification

The existing real-issuer matrix has two independent native modes: the unchanged
disposable candidate (regression) and installation of the actual persistent SQL
draft. Both begin with the original Food/Nonfood acceptance suites and baseline
issuer definitions. Draft installation rejects an unmarked target and a drifted
issuer atomically. The same real multi-session races run in both modes.

The draft mode additionally tests ordinary non-admin self-closure, foreign target
and claim spoofing, lost-response exact-key recovery, different-key conflicts,
explicit privileges and FORCE RLS, missing state, expired/revoked Auth, duplicate
JSON keys, concurrent owner requests, prohibited reopening, COMMIT-time expiry,
and forced rollback. Source guards pin the reviewed issuer hashes; focused
TypeScript is required in CI. Native results must be read at the exact PR head.

## Deliberately open release gates

- SQL is a review draft outside automatic migrations; the exact Staging target
  acknowledgement is a guard, not permission to execute. No live SQL was run.
- Owner-approved state registration/backfill and lifecycle integration remain
  required; do not create implicit ACTIVE records to make a test or release pass.
- Food/Nonfood issuance is the bounded integration scope. Other global writers,
  existing receipt/current readers, Adaptive/Storage/Auth deletion orchestration
  and off-device mirrors need coordinated lifecycle review before rollout.
- CLOSING is a durable pending request, not proof of erasure. Retention periods,
  evidence erasure, FK remediation and independently verifiable nonpersonal
  catalog preservation remain unresolved; no policy or deletion is invented.
- Real Supabase JWT/PostgREST, SQL-owner privileges and final target postchecks
  remain a separately approved Staging acceptance.
- No real product/water approval, recipe publication, generator activation,
  payment integration, production change or PLAN-to-FACT write is included.

`ACCOUNT_CLOSURE_IMPLEMENTED=false`, `LIVE_ERASURE_VERIFIED=false`.
The historical intentionally RED source gate continues to describe the unchanged
original issuer drafts; the new patch is tested by actual native installation.
