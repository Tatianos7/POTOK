# POTOK current state

## Existing-email test steering — 2026-10-30

- Owner has no additional email and recognized an existing masked Staging address. The phone screen now defaults to existing login with shouldCreateUser=false; it cannot silently create a new account when an address is absent.
- Existing admin/Premium booleans are read and shown as existing rights, not interpreted as newly granted privileges. New-signup checks remain separate and are not marked passed by an existing-login result. No email or OTP is embedded in source/results.

## Phone-based Auth transport check preparation — 2026-10-30

- Owner can test only on a phone. Prepared a standalone Staging-only screen outside the main app build, using the existing locked Supabase SDK with session persistence, auto-refresh and URL session detection disabled.
- Explicit user email/signup consent and code entry precede server getUser validation, ordinary entitlement checks and GET-only closed-RPC probes. No email/code/session/user identifier is included in the result summary; errors are sanitized. Server account registration remains an independent check, not a client assertion.
- Added single-file offline packaging with hashed CSP, so a separate host may be avoidable. CI checks both served and file-based flows; actual Android file-handler compatibility remains to be confirmed on the owner's phone. No hosting/provider, real email request, Auth user, RPC opening or database change is performed by preparation. Current GitHub Pages must not be republished from the stacked backend branch.

## Closed package installed in Staging — 2026-10-30

- After explicit owner approval, applied PR #259 code at `69b948a683ea4c047ea7b78d6e033401da610d12` only to POTOK Staging `ozidryfvhkcbtpnulakq`. Migration history records `20261030165008_evidence_closed_staging_bundle_v1`; SQL SHA256 `a9a1e0852c1b13ec717fbde5227e08c911898944e2832dbbc9c00fd1e572d572`.
- Live postcheck: all 38 function bodies/owners/security/search paths match the approved package; all 16 new tables are empty with ENABLE/FORCE RLS and no client table/column access. All seven application RPCs have zero effective EXECUTE grants for anon/authenticated/service_role.
- New registration hook is installed/enabled and bound to the exact function. Existing three Auth accounts received no state, provenance, permits or privilege changes. Recovery was not required or executed.
- Before/after counts and SHA256 content aggregates match for all nine checked existing relations: Auth users/sessions, foods, aliases, diary, recipes, ingredients, favorites and profiles. All 2,200 foods have unknown admission flags; none was approved or published.
- Security advisors introduced no new WARN/ERROR findings. Thirteen additional INFO notices reflect intentionally policy-free private Food/Nonfood tables protected by FORCE RLS and denied client access; existing warnings remain separate work.
- Earlier checkpoints below describe preparation before this approved apply. Production, merge/deploy, real source review, evidence issuance, runtime opening and generator activation were not part of the action.
- Actual Supabase Auth signup/OTP and signed-JWT PostgREST acceptance remain NOT VERIFIED. Next: controlled real-transport acceptance without blanket RPC opening or legacy ACTIVE backfill; then actual product/water evidence and the selected recipe pilot. ACCOUNT_CLOSURE_IMPLEMENTED=false; LIVE_ERASURE_VERIFIED=false.

## Atomic closed evidence package — 2026-10-30

- Added an offline composer and explicit SHA256 component manifest, plus reproducible reviewable SQL for admission columns, Food, closed Nonfood, account admission and Auth-state registration in one transaction.
- Original component bodies stay unchanged; only their verified outer transaction wrappers are removed. All seven Food/Nonfood/owner-closure RPCs are revoked before the single COMMIT, preventing any client-opening interval between component installs.
- Separate bundle-draft native mode reproduces missing food columns and three synthetic legacy accounts, checks late/final rollback, actual cross-session visibility, closed endpoints, signup coexistence/rollback and replay. Other 49/54/76-test modes remain active.
- Prepared a separately authorized recovery candidate: bind the exact registration hook and suspend its owned function body while retaining closed RPCs/all data. Native bundle mode reproduces Staging's non-superuser SQL actor with TRIGGER rights but no Auth-table ownership. New Auth users then have missing account state; no ACTIVE fallback is introduced.
- No live Supabase application, existing-account approval, source approval, generator activation or retention/erasure completion. Real Auth/OTP/PostgREST remains unverified; installing the hook requires explicit owner review because failure can block signup.

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
