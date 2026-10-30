# POTOK current state

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
