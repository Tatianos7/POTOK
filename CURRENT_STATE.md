# POTOK current state

## Closed Nonfood Staging installer — 2026-10-30

- Added a separate inactive Staging installer with all application RPC access revoked. Original disposable SQL is unchanged; table/issuer/history bodies are byte-identical, except the removed client EXECUTE opening.
- Pins all 13 referenced/transitive Food helper bodies plus owner/security/search_path metadata, checks role isolation and refuses existing namespace/orphan RPCs. Target markers are acknowledgments, not authorization.
- Closed-install postcheck requires empty tables, FORCE RLS, RESTRICT dependencies and closed client RPCs. Native CI verifies denial/atomic drift handling, then opens only the disposable fixture to run the existing full issuer/closure/registration scenarios.
- No Supabase apply, real evidence, catalog publication, client gateway binding or generator activation. Retention/legal approval, live Auth/OTP/PostgREST and reviewed runtime opening are unresolved; this package is not a production rollout or erasure implementation.

## Staging food-schema compatibility — 2026-10-30

- Live read-only inventory found 12/14 required food identity columns; is_searchable/needs_review are absent. Existing Food/Nonfood evidence, closure and registration packages are not installed.
- Added an inactive guarded two-column schema draft. Both nullable booleans have no default: existing/new products receive no inferred search/review approval. No backfill, client permission, policy, source, nutrition or diary mutation is included.
- Registration-mode native CI starts from that missing-column shape and checks atomic target/owner/drift rejection, preservation and denial by the actual evidence reader. Other original matrix modes remain enabled.
- Nonfood still has a disposable-only installer. Persistent rollout, real Auth/OTP/PostgREST, existing-account decisions and retention/erasure remain separate unresolved gates. No Supabase write, rollout, merge or generator activation occurred.

## Trusted registration preparation — 2026-10-30

- Prepared a separate inactive registration draft: new Auth INSERT provenance and an SQL-owner-only reviewed permit path for existing accounts, with no bulk backfill or client registration endpoint.
- Preserves CLOSING, admin/Premium authority and existing issuer arithmetic; no real permits or ACTIVE decisions were authored.
- Prepared read-only Auth trigger/role/schema inventory and a concrete [Staging review/acceptance packet](docs/architecture/p5-03c-registration-staging-packet-20261030.md).
- Native CI retains #255's candidate/persistent regression modes and adds registration-draft scenarios. Exact-head CI is the native verification authority.
- No live SQL, Auth hook installation, Staging/production write, merge, activation or PLAN-to-FACT change.

## Persistent admission preparation — 2026-10-30

- Prepared an inactive SQL draft for private trusted account state, owner-only ACTIVE-to-CLOSING requests and admission inside the original Food/Nonfood public issuers.
- Pinned prerequisite: #254 at `8a0e362caeb9b67b2feaadf9b275facba4ac6a43`, all four CI workflows passed; native matrix 49/49 with zero skips.
- New CI tests the actual persistent draft and preserves the existing disposable candidate as a separate regression mode.
- No automatic ACTIVE backfill, real source approval, live SQL, app endpoint, merge, deployment or generator activation. Global closure and erasure remain incomplete.
- See [persistent draft scope and release gates](docs/architecture/p5-03c-persistent-admission-draft-20261030.md).

## P5-03C implementation checkpoint — 2026-10-30

- Generator/source preparation PR #253 passed both exact-head CI workflows at `a166717d8d139323b45e6fdf691b6adf4d15d510`.
- This separate branch continues the existing issuer dependency #183; it is not a merge of the generation stack.
- Implemented a native disposable matrix over real Food/Nonfood issuers and existing trusted-entitlement prerequisites; corrected the old two-authority-check source transformer.
- Real SQL drafts, live account state, source approvals and runtime remain unchanged. ACCOUNT_CLOSURE_IMPLEMENTED=false; LIVE_ERASURE_VERIFIED=false.
- Local native execution is unavailable; native results must be read from exact-head CI. See [matrix scope and next gate](docs/architecture/p5-03c-real-issuer-matrix-20261030.md).
- Generator inactive, PLAN != FACT; real purchase verification stays after generation (#198).

## Historical checkpoint

Checkpoint date: 2026-10-03

- GitHub `master` at this checkpoint: `25166665fee11465af867d1731e6818549c2bca0`.
- Cloud environment `POTOK`: **published and operational**.
- Cloud workflow branch → PR → review → owner approval → merge: **verified end-to-end**.
- `WORKFLOW.md` is in `master`; PR **#142 merged**.
- The protected execution binding is accepted on STAGING.
- Rollback-only behavioral acceptance: **PASS**.
- Final SELECT-only postcheck: **15/15 PASS**.
- Acceptance fixture residue: **zero**.
- Auth-contract and schema-USAGE repairs are applied on STAGING.
- GitHub Pages build and deploy for the checkpoint: **PASS** (run `37141713000`).
- Edge Function: **NOT DEPLOYED**.
- Trusted generator: **NOT ACTIVATED**.
- Production database: **untouched**.
- Existing local future work: **72 paths remain uncommitted**; owner baseline paths remain separate and preserved.
- Next technical phase: protected execution runtime / Edge orchestration integration, without generator activation or production rollout.
