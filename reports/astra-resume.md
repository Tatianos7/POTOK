# POTOK resume — 2026-09-22

**POTOK_PREMIUM_ADAPTIVE_NUTRITION_V1_IN_PROGRESS. NOT LAUNCH READY.**

## HEAD / authorization

- Worktree: `/Users/urijurij/Desktop/POTOK/.worktrees/workout-muscle-map-foundation`.
- Branch `master`; Git checkpoint started from old HEAD
  `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`.
- Local commits already ahead before this checkpoint: `4fed6b3`, `4c441db`,
  `38f2e68`, `b0e9bd5`.
- New bounded commits created during this checkpoint:
  `a6b7166` (`feat: enforce verified entitlement boundaries`, 25 exact paths) and
  `a854f9e` (`feat: wire adaptive nutrition persistence runtime`, 20 exact paths).
  The retained-smoke/evidence/handoff paths, including this report, are committed as
  the final bounded checkpoint commit immediately after `a854f9e`; use
  `git log origin/master..HEAD` for its non-self-referential exact hash.
- Every commit used an explicit path allowlist, printed cached names, passed cached
  diff check, contained zero owner-baseline paths and zero detected credentials.
- The only remaining working-tree entries after the checkpoint are the preserved
  229 owner paths recorded in the baseline manifest; they are intentionally neither
  staged nor modified by this work.
- Baseline manifest: `/tmp/potok-launch-audit-2026-09-18/baseline.json` (229 files).
- NO PUSH / DEPLOY / browser smoke / production activation. No Supabase or SQL action
  was performed during this Git checkpoint. The owner-reported retained STAGING
  setup remains applied; its browser smoke has not run.

## Active contract / accepted owner decisions

Adaptive Nutrition v1 replaces fixed-14-day nutrition as the target. Active week
is local Monday–Sunday; next week remains provisional. Legacy IDs/routes retained.

Owner confirmed PLAN/FACT/persistence **domain semantics** on 2026-09-20:
consumed-as-planned requires explicit confirmation of the exact plan snapshot;
modified/extra food requires actual payload; skipped is annotation only; replacement
mutates PLAN, never FACT; shopping follows confirmed graph revision. No punitive
compensation. Stale revisions conflict; idempotency and non-destructive supersession
history are required. Do not ask the owner to reconfirm these same semantics.

This does not approve server implementation, schema, endpoint, SQL or writes.
Contract/details: `docs/premium/plan-fact-persistence-domain-v1.md`.

Owner clarification **2026-09-21**, after the completed review pass:
- Different accounts are used for checks. Legacy flag assignment, trusted operator
  and grant/revoke channel remain unknown; no old Premium/admin flag is verified.
- Development only, no mass launch or permanent users/testers; introductory link
  visits occurred. Owner knows only Supabase. This does not prove absence of
  external writers, old clients, pending queues or existing data.
- **APPROVED product behavior:** logout does not delete the server diary;
  unresolved operations do not silently disappear or become available to another
  account. Account deletion is a separate process deleting related data, history
  and local queue. These product questions are closed; retention periods, backup
  retention and technical erasure protocol remain OPEN. No deletion authorized.
- Schema/RPC/roles/DTO implementation choices remain PROPOSED, not APPROVED.
- **OWNER-APPROVED interim entitlement rule, 2026-09-21:** until payment integration,
  Premium grant/revoke may come only from a protected owner-controlled server
  authority with audit. Premium/admin capabilities remain separate; client flags
  are never authority and old true flags remain unverified. The actual protected
  operator/channel and deployed enforcement remain OPEN; no DB apply authorized.
- Owner-supplied read-only staging evidence: no trusted Premium provisioning channel,
  Edge Functions or public business security-definer entitlement RPC was found;
  authenticated currently has INSERT/UPDATE on `user_profiles.has_premium/is_admin`;
  Premium catalog RLS checks active content, not verified entitlement. `service_role`
  bypasses RLS and is explicitly forbidden as a client provisioning path.

## Completed foundation (committed)

- Compatible Goal/training/preferences/safety/cycle types and advanced macro math
  preview; no new clinical thresholds or Goal activation.
- Seven-day projection through the existing Premium/Today adapter. Local weekly
  preview with planned meals, four food actions and six daily states. Missing days
  remain missing. Production App does not enable it; legacy routes preserved.
- Approved-only curated filters cut/bulk/vegan/high_protein/high_carb/keto.
  Free shows only current-account private user recipes; old relations retained.
- Scoped replacement arithmetic preview and occurrence/portion-aware shopping;
  canonical/portion/safety evidence is still required before application.
- 120 owner-review names (30 per meal) preserved unchanged. No ingredients, grams,
  instructions, UUID expansion or import. Evidence register remains preliminary.

## Completed PLAN/FACT package (committed)

- Versioned domain context: account, plan/goal revisions, local week/timezone,
  dated slot, recipe/portion/snapshot revisions and idempotency key.
- Pure `PROPOSE → PREVIEW → CONFIRM` simulation with explicit confirmation,
  account/version/content checks, exact replay no-op and changed-key-payload conflict.
  Future consumption and provisional active-week input fail closed.
- As-planned copies the exact snapshot; modified/extra requires actual payload.
  Skip and skip undo only append annotation events. Extra food leaves graph intact.
- Replacement confirmation changes only the simulated graph. Revision-bound shopping
  selection sees the new snapshot; pending proposals and diary actions do not alter
  it. Earlier consumed snapshots remain intact after later replacements.
- Edit/undo appends supersession/retraction history. Original events remain; stale
  history targets reject. Plan restoration is a fresh replacement with retained
  snapshots. No destructive deletion or silent resurrection.
- Contradictory content under the same snapshot/portion revision fails closed.
- Weekly action-preview UX explains separate consequences and keeps saving disabled.

**Simulation is not persistence.** `networkWritesEnabled: false`; local sequence
numbers are never authoritative server revisions. No writer, storage, RPC, transport
or real diary facts are created. Real server confirmation is not integrated. Synthetic read-model reconciliation
and optional preview integration are implemented below; this is not complete
end-to-end adaptive execution.

## Completed recovery/read-model package (committed)

- Pure adapter against synthetic inputs: account/calendar/timezone binding, session
  and request/attempt generations, late/foreign response rejection, current graph
  validation, preview invalidation on plan/goal revision changes. No new endpoint.
- Cross-read plan/snapshot/portion immutability and known-retired-revision rejection.
  Opaque revisions are not ordered by guessed numbers, timestamps or lexical order.
- Timeout remains UNKNOWN, neither success nor failure. New key/action is blocked
  while unresolved; explicit retry preserves original payload, expected revisions
  and idempotency key. A fresh-looking graph alone never proves mutation outcome.
- Accepted outcome requires matching fresh read identifiers/revisions; replacement
  also requires a new plan revision and exact confirmed slot snapshot. Old reads
  cannot overwrite the receipt constraint. Conflict requires refresh and new review.
- Unknown operations survive A→B→A in account-scoped memory quarantine and reattach
  under a fresh session. Another week/timezone keeps unresolved work blocked pending
  proper reconciliation. Foreign account view exposes neither payload nor outcome.
  Settled keys also remain account scoped. No restart persistence is claimed.
- Optional recovery input wired into existing Today weekly preview only. It checks
  account/date/week/timezone, plan/goal revisions and dated slot/recipe identity set.
  Loading/unknown/conflict/mismatch hide stale meal content/actions. No request or
  diary write controls enabled; App production routes do not supply this input.

## Server contract evidence package — ready for owner evidence

New document: `docs/premium/adaptive-nutrition-server-contract-required-v1.md`.
Prepared from local runtime, relevant historical SQL/contracts/reports and the
accepted domain contract. No server connection, metadata retry, SQL or write.

- Covers authoritative plan/dated slot/snapshot identity, atomic request/receipt,
  accepted/conflict/rejected/unknown outcomes, account-key lookup, timeout/replay,
  concurrency, history, per-action PLAN/FACT transaction matrix, auth/Premium checks
  and exact/successor read freshness.
- Adds explicit FACT event/diary revision requirement: unchanged/fresh plan graph
  cannot prove a consumed diary snapshot was committed.
- Evidence matrix distinguishes REQUIRED, FOUND_IN_REPO,
  NEEDS_DEPLOYED_VERIFICATION and BLOCKS_IMPLEMENTATION. Source registry R1–R9.
- Repo evidence is partial: catalog/user selections, Goal reads/upserts, individual
  diary snapshot/idempotency paths, entitlement RPC callers and historical policies.
  No current deployed adaptive operation/lookup/freshness contract is proven.
- Safest next option A: existing owner-exported redacted metadata/protocol bundle.
  B: owner Dashboard read-only export. C: an already existing safe authenticated
  read-only channel only after scope review. Neither B nor C was attempted.
- Metadata alone cannot prove concurrency/rollback/auth behavior; existing approved
  behavioral evidence is requested, not authorization to execute new write tests.

## Owner-run metadata export prepared — not executed by agent

Owner requested preparation of the Dashboard export, not agent execution/access.

- SQL: `scripts/sql/adaptive-nutrition-server-contract-owner-readonly.sql`.
- Instructions: `docs/premium/adaptive-nutrition-server-contract-owner-export-instructions.md`.
- SHA-256: `655edd04ca8d6956ddcaa15373b6b6a94ff425c3e9bef39c5b3bfce64bebc032`.
- One SELECT with SELECT-only CTEs; 16 numbered sections in one result, row counts
  and explicit empty markers. Catalog-only source and built-in call allowlists,
  forbidden statement tokens and balanced structure checked locally; no PostgreSQL
  execution/parser or live compatibility claim. Static report:
  `/tmp/potok-launch-audit-2026-09-18/adaptive-owner-export-static-check.json`.
- Covers candidate tables/columns/types/precision, constraints/indexes, ownership/
  revision/history fields, RLS/policies, table/column/schema/function ACL, relevant
  RPC definitions, triggers and catalog dependencies. Inventories expose unknown
  names for owner mapping; heuristics and catalog visibility are not absence proof.
- Manual STAGING project verification required: `ozidryfvhkcbtpnulakq`.
  Expected-ref label/current_database do not independently attest project identity.
  No application rows selected, discovered RPC/trigger execution, secrets requested,
  CLI, staging connection, SQL execution, mutation or real persistence work.
- Definitions/defaults may contain embedded secrets: owner inspects/redacts with a
  manifest before sharing. Full export required; metadata alone is not behavior proof.
- Canonical export / recipe atomic metadata / recipe expansion remain PARKED.

## Owner export received / factual staging gap analysis complete

Owner verified STAGING `ozidryfvhkcbtpnulakq`, run date 2026-09-20. Input:
`/Users/urijurij/Desktop/adaptive-nutrition-metadata-staging-2026-09-20.csv`.
CSV SHA-256 `e662c2328d9d5b061a5d01fe991b9482c82f066903b1b0edf011ca37615f1251`.
1693 rows, sections 0–15, every count/JSON record verified locally. SQL hash matches
the reviewed artifact. Export timestamp `2026-09-20T11:43:45.637523+00:00`, role
postgres. No agent connection/SQL/DB write and no authenticated actor test.

New report: `docs/premium/adaptive-nutrition-staging-gap-analysis-v1.md`.

- Confirmed catalog graph, account-owned plan/meal selections, goals, diary nutrient
  fields and server partial unique(user_id, idempotency_key). These are reusable
  pieces, not a versioned execution/receipt/history contract.
- Confirmed deployed staging gap: authenticated catalog SELECT policies check
  activity, not Premium entitlement. Profile own-row ALL + broad grants permit
  has_premium/is_admin modification; only timestamp trigger protects no such field.
- Scoped columns lack plan/goal/snapshot revisions, week/timezone and receipt/event
  linkage. Public inventory has no entitlements/subscriptions or get_entitlements/
  get_paywall_state, adaptive action/read/lookup RPC. External protocols remain
  unknown. Two exported function bodies only maintain timestamps.
- Diary/selection owner UPDATE/DELETE, broad ACL and missing atomic/CAS/history
  boundary block safe integration. Unknown timeout cannot be resolved from graph.
- Proposed minimal design: extend existing personal selection into explicit weekly
  instance; add immutable graph revisions, account-key receipt ledger and append-only
  events; retain catalog and diary with protected effective-history compatibility.
  Exact receipt revision reads first; no invented successor freshness. Entitlement
  authority and all relevant legacy write paths must be protected before activation.
- Design only. No schema/RPC patch, migrations, SQL apply, tests with writes,
  persistence activation or owner dataset expansion.

## Schema/RPC/DTO review package complete — PROPOSED, NOT APPROVED

- Review entry point: `docs/premium/adaptive-nutrition-server-draft-v1.md`.
- Comment-only schema/RPC specification in `docs/premium/drafts/`; not a migration,
  installer or executable RPC implementation. Includes key/FK/permission contracts,
  transaction/read/lookup algorithms, consumer compatibility and future apply gates.
- Review DTOs and 18 synthetic cases in `scripts/contracts/`, outside runtime.
  Reuse existing domain context/snapshot types; no network/storage/persistence port.
- Proposed basis: existing selection→versioned week, immutable graph revisions,
  durable account-key receipt, append-only FACT/history and existing effective diary.
- Profile INSERT/UPDATE allowlist omits protected flags/provenance, including upsert
  echo; DELETE/recreate denied for ordinary profile flow. Trusted provisioning OPEN,
  existing true flags unverified. No grants/policies changed.
- Own history/FACT correction/retraction through common Free boundary remain available
  after expiry; lookup/exact replay also preserved. No new paid plan/adaptation effect
  without verified authority. Shared ledger, Free event CAS independent of current
  Goal/plan revision; no dummy instance for standalone facts. Still PROPOSED.
- Effective projection retains original facts, excludes superseded/retracted rows;
  same-stream validation, no branches/resurrection, exact component coverage.
  Managed-date barrier activates only together with verified Free endpoint/readers/
  writers/queues. Enrolled cohort rejects direct legacy statements before any row work
  (including empty/mixed bulk); queue retained, no silent prefix/split/key regeneration.
  Old builds that ignore errors cannot be enrolled until verified upgrade transition.
- Repo consumer review found profile queued upserts/setters, direct diary reads,
  bulk delete/upsert and Goal upsert. Baseline owner files only read. Unknown external
  consumers/bootstrap/provisioning/privileged helpers remain OPEN.
- Recommended origin_kind + nullable template FK for generated v1 plans, required
  genuine FK for legacy/catalog origin, immutable source lineage. No dummy template,
  mass legacy FK rewrite or fixed-14-day execution. External nullable/join consumers OPEN.
- Recommended NOLOGIN/NOBYPASSRLS executor separate from access provisioner, fixed
  search_path and narrow grants. Owner-controlled attestation/revoke audit without
  payment. Operational channel/bootstrap/source evidence OPEN; old flags unverified.
- Refined lock order: account gate first, ledger replay, authority/Goal, sorted
  instances/streams/rows. Revoke uses same gate; no row-trigger lock inversion.
- Strict raw duplicate-aware JSON validation before jsonb; versioned canonical bytes,
  exact positive amount decimal strings scale 2 bounded by numeric(8,2), not clinical
  thresholds. Parsed fixture helper only; full server parser/digest not implemented.
- Proposed durable pre-dispatch outbox, sent_unknown before dispatch, original-key
  lookup after authentication, foreign-account quarantine. Lost intent remains an
  evidence/reconciliation boundary; no new key guessed. No storage/transport enabled.
- Compatibility/rollback sequence and future DB actor/race/rollback acceptance matrix
  are in the review document. No SQL execution, fixture/write tests or DB access.
- P01–P11 now map technical recommendations/external evidence, not 11 owner questions.
  Only authority/source, client transition ownership and retention/erasure policy
  need owner operational inputs. All proposals remain PROPOSED, not APPROVED.
  All PARKED blockers retained.

## Verification — current review package

Source evidence preserved; 229 baseline owner hashes unchanged; index empty.
No production src changes or runtime imports of draft module. No local commit.

**Latest owner-response documentation pass, 2026-09-21:** only draft and resume
updated. Re-read known flag consumers from the existing map: SubscriptionManagement
→ scoped profile Premium setter; AdminPanel → AuthContext target-user admin setter;
profile pending/save upserts echo cached flags. Default inserts set false;
adminAccessService reads a bool, not grant provenance. No historical issuance or
successful staging writes inferred. No general audit or live access.
Fresh checks for this pass: documentation diff/links, **229/229 owner hashes and
statuses unchanged**, empty index. No tests/lint/build/broad suite run for docs.
This documentation pass was followed by the bounded lifecycle implementation below.

**Bounded lifecycle package complete, 2026-09-21:** exact four paths changed:
`scripts/contracts/adaptive-nutrition-server-v1.ts`, its targeted test,
`docs/premium/adaptive-nutrition-server-draft-v1.md` and this resume. Pure reducer
retains UNKNOWN intent/key/envelope over logout; A→B exposes only quarantine and
B→A resumes lookup of the original key. Erasure request records an idempotent
account-scoped pending marker, blocks that account and never clears intent or
declares completion. Unsupported lifecycle events fail closed. No storage,
transport, auth/runtime hook, persistence, deletion or server guarantee added.

Fresh scoped checks: **20/20 targeted synthetic tests PASS**, standalone strict
TypeScript **PASS**, targeted ESLint `--max-warnings 0` **PASS**. Broad suite/build
not run because runtime was unchanged. Exact four-path diff check **PASS**;
**229/229 owner hashes and statuses unchanged**; index empty.

**Strict raw wire + canonical digest v1 package complete, 2026-09-21:** same four
local review paths changed. `decodeAdaptiveNutritionWireV1(raw)` scans duplicate
keys before full object decode, applies exact tagged field schemas and validates
action enums, real dates/Monday anchor, canonical IANA timezone and UUID refs.
Actual amounts use the existing string-only integer scale-2 normalization; lossy
numbers, exponent/sign/comma/whitespace/leading zeros/excess scale/overflow reject.
Canonical UTF-8 envelope contains encoding v1 + protocol ID + normalized payload;
keys sort ordinal ASCII, arrays retain order and explicit null remains. SHA-256 is
computed locally from canonical bytes with Node crypto. Unknown root fields,
including client digest, reject; client digest is never trusted.

Fresh scoped checks: **24/24 targeted synthetic tests PASS** (4 new wire cases),
strict TypeScript **PASS**, targeted ESLint `--max-warnings 0` **PASS**. No runtime
transport, Supabase/RPC/storage/auth, production src, SQL or migration change.
Broad suite/build not run. Exact four-path diff check **PASS**; **229/229 owner
hashes and statuses unchanged**; index empty. Local codec PASS is not server
interoperability evidence.

**Trusted-entitlement local contract complete, 2026-09-21:** same four review paths
changed. Append-only `EntitlementAttestationV1` models separate Premium/admin grant
and revoke with exact account scope, canonical server time/expiry, operator/evidence,
sequence and predecessor. Effective predicate validates a continuous deterministic
lineage, computes canonical SHA-256 audit lineage, applies grant/expiry/revoke by
server time and fails closed on invalid chains. Cross-account/capability events do
not authorize each other. Old `has_premium/is_admin=true` only produces an explicit
unverified denial and never restores expired/revoked access.

Fresh scoped checks: **30/30 targeted synthetic tests PASS** (6 entitlement cases),
strict TypeScript **PASS**, targeted ESLint `--max-warnings 0` **PASS**. No payment,
runtime UI, Supabase/DB/RLS, executable migration or production source integration.
Broad suite/build not run. Exact four-path diff check **PASS**; **229/229 owner
hashes and statuses unchanged**; index empty. Local authority literal is not proof
of protected server execution; operator/channel/deployed enforcement remain OPEN.

**Trusted-entitlement runnable server patch prepared, NOT APPLIED, 2026-09-21:**

- `docs/premium/drafts/20260921_trusted_entitlement_v1.sql` is a transactional
  STAGING-only review draft. It creates closed append-only attestation storage,
  separate Premium/admin lineages, protected grant/revoke routines, fail-closed
  effective predicate, profile protected columns/guard, restrictive verified-Premium
  policies for all 8 catalog tables and least-privilege roles/grants.
  SHA-256: `9e2ff944103a2e15783529c13a82c61985e9ca3c790b6e9ce2c1c41378998b2d`.
- Old rows/IDs/flag values remain; provenance starts NULL and no backfill occurs.
  `service_role` gets no provisioning schema/function/membership path and protected
  direct profile writes are blocked. Provisioner is NOLOGIN and has no members;
  operator binding is deliberately absent. Payment is absent.
- `docs/premium/drafts/20260921_trusted_entitlement_v1.acceptance.sql` is an
  unexecuted rollback-only fixture draft for Free/old flag, verified Premium,
  expiry, revoke, admin separation, foreign account, profile guard, audit lineage
  and service_role denial. Sentinel UUID preflight requires three explicit staging
  test accounts; active catalog fixture is required. It ends in `ROLLBACK`.
  SHA-256: `ecccca449d046c540cf83a7bb177bf9998e0398a0c000e68e306af8c2b977cae`.
- Static-only review PASS: transaction endings, dollar tags/parentheses, 5 SECURITY
  DEFINER paths and 2 invoker triggers all use fixed `search_path=pg_catalog`; no
  provisioner membership binding. PostgreSQL did not parse/execute either file, so
  syntax/behavior are not claimed as server evidence.
- Exact four-path diff check **PASS**; both recorded SHA-256 values reverified;
  **229/229 owner hashes and statuses unchanged**; index empty; review package is
  now 12 paths. No app tests/build were run for this SQL/docs-only package.

**Completion check, 2026-09-21:** compared resume, git status and only the six
latest-package file diffs. All requested refinements were already present; no
implementation rewritten. Fresh checks: **18/18 synthetic contract tests PASS**
(`node --import tsx --test scripts/contracts/adaptive-nutrition-server-v1.test.ts`),
standalone strict TypeScript for draft DTO/tests **PASS**, ESLint for those two
files with `--max-warnings 0` **PASS**. Six-file diff/whitespace/relative links and
comment-only SQL draft check **PASS**; **229/229 owner SHA-256 hashes match** and
index is empty. Only this handoff and the review report receive completion notes.
No server guarantees were tested. Broad suite, build and full-repo lint were
**not rerun in this completion pass**: no runtime or implementation changes.

**Earlier recorded checks (not fresh runs on 2026-09-21):**

- Focused **57 PASS** (18 synthetic contract cases + PLAN/FACT/recovery). Four new
  cases only for Free correction/replay, decimal injection/loss, restart and mixed bulk.
- Broad **153 files; 1178 PASS; 0 failed; 0 skipped**. One live diary integration
  file explicitly excluded (not run, not counted as PASS); no DB acceptance tests.
- Draft DTO/tests standalone strict TypeScript **PASS**; focused lint **PASS**.
- Build **PASS**: TypeScript, Vite, Pages fallback.
- Lint **FAIL: 121 existing errors / 491 warnings; 0 added diagnostics** versus
  recovery baseline, comparing full file/line/message diagnostic sets. No mass cleanup.
- New SQL draft verified entirely comment-only; DTO fixtures are not server guarantees.
- Diff/links/whitespace, empty index, owner baseline and preserved recipe names checked.
  Logs: `/tmp/potok-launch-audit-2026-09-18/server-refined-{focused,tests,build,lint}.log`;
  test selection: `server-draft-test-files.json` in that same temp directory.
- Initial tsx CLI runner hit local IPC EPERM; rerun with `node --import tsx --test`
  passed without escalation/network. No Supabase CLI attempted.
- Browser gap **NOT_TESTED_BROWSER / EXTERNAL_TOOL_UNAVAILABLE** retained.
  Previous discovery returned `[]`; not retried. SSR/reducer tests are not mobile QA.

## Parked dependencies / real checkpoints

- Canonical export: **OPEN_EXTERNAL_DEPENDENCY / PARKED**. No retry, invented UUID,
  service role, import or production catalog-readiness claim.
- Recipe atomic metadata: **PARKED**. No SQL/CLI retry. Earlier authorized metadata
  attempt unexpectedly initialized login role and failed HTTP 544; no metadata
  received and absence of side effects was not proven. Evidence remains in
  `reports/recipe-resolver-safety-checkpoint-2026-09-19.md`.
- Actual transport/persistence needs verified schema/read-model metadata and an
  approved authenticated atomic/idempotent endpoint contract, including server-owned
  revisions and history identity mapping. Exact storage remains undecided.
- Recipe ingredient expansion waits for owner review of the preserved 120-name list.
- Numerical adaptation/safety policy needs authoritative evidence review; deployment,
  import, payment and production activation are separately unauthorized.

## Remaining boundary / exact next safe task

Owner responses are incorporated; see section 9 of
`docs/premium/adaptive-nutrition-server-draft-v1.md`. Closed: development/testing
context, product logout/account-isolation/separate-account-deletion behavior, and
the interim entitlement admission rule. Still OPEN: actual trusted operator/channel,
deployed enforcement and independent old-rights evidence;
external writer inventory and verified build/queue transition; retention periods,
backup retention and technical erasure protocol. These gate their server/rollout/
purge steps, not isolated local helpers. Do not repeat the whole design review.

The bounded lifecycle, strict wire/canonical v1 and trusted-entitlement local
packages plus the first runnable entitlement review draft are complete; details are
in draft §2, §3 and §9. No SQL/apply scope is inferred. Before staging apply owner
must separately approve the exact SQL hash/window and rollback procedure, name and
bind a non-app/non-service-role operator channel, approve a compatible profile-writer
transition, and authorize rollback-only acceptance writes with exact test accounts.
Independent evidence is required before re-attesting any old grant; no mass backfill.
Deployed authority, raw-decoder/hash interoperability, external-writer/client
transition evidence and technical retention/erasure protocol remain the precise
checkpoints before their respective server, rollout or purge work.
No SQL execution/apply, live actor/write tests, transport or activation performed.
Parked canonical/recipe blockers remain gates for real snapshot validation.
No repeated metadata/CLI/browser discovery. No secrets requested.

Canonical export, recipe atomic metadata and ingredient expansion remain PARKED.
Browser gap persists; do not rediscover in the unchanged environment. No payment,
SQL execution/database schema/RPC creation, write tests, imports or production activation authorized.
MASTER PROMPT remains incomplete. All existing local work preserved.

## Profile-writer transition package complete — 2026-09-21

- Current HEAD remains `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`; no commit or push.
- Current bounded package is 10 runtime/test paths plus this resume:
  `src/services/profileService.ts`, `src/services/adminAccessService.ts`,
  `src/context/AuthContext.tsx`, `src/hooks/useAdminAccess.ts`,
  `src/utils/premiumAccess.ts`, `src/types/index.ts`,
  `src/services/__tests__/profileService.account-scope.test.ts`,
  `src/services/__tests__/adminAccessService.test.ts`,
  `src/components/__tests__/PremiumRoute.test.tsx`, and
  `src/pages/__tests__/AdminAccessRouteGuard.test.ts`.
- Ordinary profile create/save/upsert/avatar-insert and pending sync now use an
  explicit benign-field allowlist. They do not send `has_premium`, `is_admin`,
  known provenance/expiry columns or unknown future fields.
- Pending format v2 contains only account identity plus ordinary fields. A legacy
  queued payload is rewritten without losing its benign fields; omitted privilege
  field names are retained in an account-scoped durable local quarantine marker,
  without retaining their values. Account-mismatched queue data is not synced.
- Direct Premium/admin profile setters now reject with
  `ProfilePrivilegeWriteBlockedError`; SubscriptionManagement/AdminPanel therefore
  cannot report a protected flag write as successful through those old paths.
- Legacy profile booleans normalize to non-authoritative false. Premium route/UI
  requires `premiumAccessVerified`; admin pages no longer short-circuit on local
  `user/profile` flags. Capability reads bind the current auth account and call only
  `public.has_verified_entitlement_v1`; missing/error/malformed responses fail closed.
  A second session check discards results if the account changes during the reads.
  Until the separately reviewed server patch is applied, verified Premium/admin UI
  access is intentionally unavailable except the existing explicit demo mechanism.
- Fresh verification: targeted runtime/security tests **22/22 PASS**; strict
  TypeScript `npx tsc --noEmit --pretty false` **PASS**; targeted ESLint for all
  changed paths except the pre-existing AuthContext debt **PASS** with
  `--max-warnings 0`. Current and HEAD AuthContext each report the same 1 error +
  3 warnings under the same rules, so this package adds no lint diagnostic.
  `npm run build` **PASS** (existing chunk/browser-data warnings only).
- All package paths are outside the 229-file owner baseline; fresh hash verification
  found **229/229 unchanged** and no intentional baseline change.
- No entitlement SQL/draft modification or apply, Supabase access, DB/RLS write,
  PLAN/FACT persistence, payment, push, deploy or production activation occurred.
  Trusted-entitlement staging apply still requires separate owner approval and its
  acceptance run. Canonical export, recipe atomic metadata and ingredient expansion
  remain PARKED; external writers and erasure protocol remain OPEN.

## Supabase-compatible trusted-entitlement v2 prepared — 2026-09-21

- HEAD remains `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`; no commit/push.
- Owner-reported STAGING evidence: applying v1 through the Supabase migration
  channel failed with `permission denied to alter role`; its transaction rolled
  back completely. Owner verified no `potok_control` schema/table and no
  `potok_entitlement_owner` / `potok_access_provisioner` roles exist afterward.
  This was not rechecked locally and is recorded as owner-supplied live evidence.
- v1 remains incident traceability only and is not the next apply candidate.
- New exact artifacts, all **NOT APPLIED**:
  - `docs/premium/drafts/20260921_trusted_entitlement_v2.sql`
    SHA-256 `ffef9a7de1b1540a4511751614c170a1269bc16dc97c5e663c0475dda0065029`;
  - `docs/premium/drafts/20260921_trusted_entitlement_v2.preflight.sql`
    SHA-256 `1028f9b45f8db7f06925e092ffaad7dcd877c053d9fc2e9152de05b3dded3412`;
  - `docs/premium/drafts/20260921_trusted_entitlement_v2.acceptance.sql`
    SHA-256 `2b6f9bb156ad96dc8b9ec44a1d9d19a8dfdef42041de70d3354ee8582a203d2b`.
- v2 removes all custom-role creation/alter/membership/ownership transfer. Closed
  append-only audit, separate Premium/admin lineage, expiry/revoke fail-closed,
  protected profile ACL+trigger, own-account predicate and restrictive catalog RLS
  remain enforced in DB objects. Legacy flags remain unverified. The public v1
  predicate name is a compatibility wrapper over v2 for the prepared runtime.
- Provisioning has no PUBLIC/anon/authenticated/service_role EXECUTE/USAGE path and
  additionally requires the existing postgres owner SQL session. Dashboard/migration
  access, human review/audit and any future delegation are external operator controls;
  v2 neither creates nor silently substitutes a client/service_role authority.
- SELECT-only preflight checks rollback state, required objects/columns/policies,
  exact account existence/profile counts and active catalog count. Acceptance maps
  Free=`d6eb4e97-90d0-470f-bc4a-2f3e401e1fde`, Premium=
  `88c26f6b-ebc8-4bff-864d-9194fbd27f8d`, admin=
  `8f82ff67-39d1-4bb1-9d55-028af99d5cca`. Missing profiles are conditionally inserted
  with `user_id` only inside the final-ROLLBACK transaction; no profile data invented.
- Fresh static checks only: 8/8 migration functions have fixed `search_path`;
  executable migration has no role-management statements or provisioning client
  grants; preflight is SELECT-only; acceptance has exact UUIDs, one BEGIN/ROLLBACK,
  no COMMIT and balanced dollar tags. No SQL parser/server, Supabase connection,
  preflight, apply, fixture or acceptance case was run. App tests/build not rerun
  because this package changes SQL/docs only.
- Next owner checkpoint: separately authorize the exact preflight hash on STAGING;
  after reviewing its output, separately authorize v2 apply hash/window/rollback in
  a postgres owner SQL session. Apply failure must roll back its single transaction
  and be followed by read-only absence verification; after COMMIT use fail-closed
  forward repair, not a destructive audit drop. Rollback-only acceptance writes need another explicit
  authorization. Production, service_role provisioning and legacy grant backfill
  remain forbidden. All PARKED dependencies remain PARKED.

## Trusted-entitlement v2.1 minimal repair prepared — 2026-09-21

- Owner reports the exact STAGING v2 migration is now applied successfully. This
  supersedes the earlier `NOT APPLIED` handoff state; production remains untouched.
- First rollback-only acceptance run reached deployed
  `potok_control.grant_entitlement_v2` and failed with PostgreSQL `42883` because
  `pg_catalog.coalesce(bigint, integer)` is invalid: `COALESCE` is a SQL special
  form and cannot be schema-qualified.
- Owner manually issued `ROLLBACK;` successfully. Subsequent owner-run read-only
  verification found zero acceptance attestations and profile counts Free=0,
  Premium=1, Admin=0. Therefore the temporary Free/Admin `user_id` fixtures and
  all acceptance effects were rolled back; this is owner-supplied staging evidence.
- Prepared one minimal, **NOT APPLIED** repair artifact:
  `docs/premium/drafts/20260921_trusted_entitlement_v2_1_repair.sql`, SHA-256
  `949a155479c002c37b54a733ac7e16c21b1cb3c10ebc5cdb06afcf460f69f47c`.
- Repair preflights the deployed function owner/security/search_path, then uses one
  `CREATE OR REPLACE FUNCTION` and reasserts the existing denial for
  PUBLIC/anon/authenticated/service_role. It does not recreate schema/tables, change
  data, roles, grants to clients, RLS or policies. Owner-only provisioning,
  append-only audit and the existing transaction/locking behavior are unchanged.
- The only function-body difference from deployed v2 is:
  `COALESCE(v_head.lineage_sequence, 0::bigint) + 1::bigint`; explicit bigint typing
  removes the same-class overload hazard. Full v2 `pg_catalog.*` review found no
  other invalid qualification: `count`/`max` are valid qualified aggregates and all
  remaining names are ordinary catalog functions with compatible inputs.
- Existing rollback-only acceptance
  `20260921_trusted_entitlement_v2.acceptance.sql` remains the exact required test;
  it already exercises first grant, expiry, revoke, separation, ACL/RLS and rollback.
  It was not copied or changed, so its SHA-256 remains
  `2b6f9bb156ad96dc8b9ec44a1d9d19a8dfdef42041de70d3354ee8582a203d2b`.
- Fresh static-only checks: repair is an exact minimal function replacement; fixed
  search_path/SECURITY DEFINER and client revoke are present; no schema/table/policy/
  role recreation, client EXECUTE grant or DROP; dollar tags/transaction shape PASS.
  No SQL parser/server, staging apply, acceptance rerun, app tests or build executed.
- Next owner checkpoint: separately approve applying the exact v2.1 repair hash to
  STAGING owner SQL session. After successful apply, separately authorize rerunning
  the unchanged rollback-only acceptance and repeat its read-only clean-state check.
  All 229 owner baseline files and all PARKED dependencies must remain unchanged.

## Trusted-entitlement v2.2 time-semantics repair prepared — 2026-09-21

- Owner reports STAGING v2 and the exact v2.1 repair are applied successfully.
  Exact rollback-only acceptance was rerun after v2.1 and progressed through grant
  creation, then failed in `$premium_case$`: one or both public verified predicates
  returned false for the newly granted Premium account.
- Owner manually rolled back and read-only verified a clean fixture state:
  acceptance attestations=0; Free profile=0; Premium profile=1; Admin profile=0.
  `auth.uid()` under authenticated returned the Premium UUID. Attestation owner is
  postgres, RLS+FORCE RLS are enabled, and postgres has `rolbypassrls=true`.
- Minimal root cause: grant/revoke write `issued_at=clock_timestamp()`, while the
  stable public predicate evaluates `p_at=statement_timestamp()`. Supabase SQL Editor
  can execute the full acceptance as one command message, so its statement timestamp
  can predate a later clock timestamp in the same batch. Then
  `issued_at <= p_at` hides the just-created grant. Revoke had the same latent issue.
- SECURITY DEFINER/RLS is not the indicated cause: effective/public functions are
  owned by postgres with fixed search_path, postgres bypasses RLS, same-transaction
  prior commands are visible, `auth.uid()` is correct, and v1 is a direct v2 alias.
  `is_effective_entitlement_v2` intentionally fails closed, but static review found
  no separate exception path needed to explain this observed false.
- Prepared one minimal, **NOT APPLIED** artifact:
  `docs/premium/drafts/20260921_trusted_entitlement_v2_2_repair.sql`, SHA-256
  `38781cda4f22e7b6c341fb32e9829b9e04e1eacd1f893bfac9e0a066ec951a77`.
- v2.2 uses `CREATE OR REPLACE` for only grant/revoke and changes only each writer's
  `v_now` from `clock_timestamp()` to `statement_timestamp()`. Equal timestamps in
  one batch are already valid because lineage sequence is authoritative and the
  insert guard rejects only decreasing time. Predicate, alias, tables, data, RLS,
  policies, grants and append-only audit structure are unchanged. Existing client/
  service_role EXECUTE denial is reasserted.
- Existing rollback-only acceptance remains unchanged and is the correct regression:
  SHA-256 `2b6f9bb156ad96dc8b9ec44a1d9d19a8dfdef42041de70d3354ee8582a203d2b`.
- Fresh static-only checks: grant body equals deployed v2.1 except its clock line;
  revoke body equals deployed v2 except its clock line; both preserve SECURITY
  DEFINER/fixed search_path and ACL revokes. No schema/table/data/RLS/policy/role
  operation; transaction/dollar tags PASS. No staging apply or acceptance rerun.
- Next owner checkpoint: separately approve exact v2.2 hash for STAGING owner SQL
  apply, then separately authorize the unchanged rollback-only acceptance rerun and
  repeat the same clean-state verification. Production and PARKED work remain untouched.

## Trusted entitlement gate complete / Adaptive persistence v1 prepared — 2026-09-21

- Current HEAD remains `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`; no commit,
  push or deploy.
- Owner-confirmed live state supersedes the earlier v2.2 `NOT APPLIED` checkpoint:
  trusted entitlement v2, v2.1 and v2.2 are applied on **STAGING**. The unchanged
  rollback-only acceptance SHA-256
  `2b6f9bb156ad96dc8b9ec44a1d9d19a8dfdef42041de70d3354ee8582a203d2b`
  completed successfully through its final `ROLLBACK`. Owner post-check reported
  test attestations=0, Free profile=0, Premium profile=1, Admin profile=0.
  Status is **APPLIED_STAGING / ACCEPTANCE_PASS**. Production is untouched.
- Prepared one bounded runnable-but-not-applied persistence package:
  - `docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.sql`, SHA-256
    `2c905977dba43d8679a78582738b6224e38ccd71226932961392c80f2b8fa0d4`;
  - `docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.preflight.sql`,
    SHA-256 `4bbd4c6037812230a8a39319e58ca133db06a6692c878fac7feb75e1556bd96b`;
  - `docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.acceptance.sql`,
    SHA-256 `2482729c9652f4a5bcd9c5f17be50957c95b03fe45651626fbc91bc9bf185117`;
  - `scripts/contracts/adaptive-nutrition-persistence-sql-v1.test.ts`, SHA-256
    `93ba9ae710b77dec4cb68e16b3df1f7c8d351c22353983021b4ab1db293f0de1`.
- Migration reuses `user_goals`, `user_premium_plan_selections`,
  `user_premium_meal_selections` and `food_diary_entries`; preserves existing IDs
  and legacy rows; adds server-owned Goal revisions, versioned Monday-Sunday instance
  fields, nullable generated origin, immutable graph revisions, durable account-key
  receipts, append-only events and protected diary projection links.
- Internal atomic boundary implements account gate, exact replay/mismatch, effective
  Premium admission, selection/Goal CAS, graph/event/head/receipt commit. Public lookup
  and coherent current/exact read foundations are present. All runtime EXECUTE remains
  revoked from PUBLIC/anon/authenticated/service_role; no public mutation decoder,
  enrollment or transport was enabled.
- FACT/component projection writes intentionally remain disabled: canonical food/
  recipe evidence, server raw decoder interoperability, effective-diary/legacy-writer
  transition and external-consumer evidence are still required. The managed-date
  barrier is absent. This is a bounded foundation, not a production PLAN/FACT API.
- Fresh local checks: targeted SQL contract tests **4/4 PASS**; standalone strict
  TypeScript **PASS**; targeted ESLint with `--max-warnings 0` **PASS**; balanced SQL
  dollar tags/parentheses/transaction and file whitespace checks **PASS**. Preflight
  is SELECT-only; acceptance has one BEGIN/final ROLLBACK and no COMMIT. No PostgreSQL
  parser/server, preflight, migration, acceptance, Supabase call, broad app suite or
  build ran. Local static PASS is not a deployed server guarantee.
- Exact paths changed by this package: the three SQL artifacts and targeted test
  above, `docs/premium/adaptive-nutrition-server-draft-v1.md`, and this resume.
  Fresh baseline check: **229/229 owner files unchanged**; git index empty.
- Next owner checkpoint: review the exact hashes, then separately authorize only the
  SELECT-only preflight on STAGING. Its output must confirm the expected base schema,
  dependencies and absence of adaptive objects before any separate migration apply
  approval. Rollback-only acceptance requires another explicit authorization after
  apply. Do not grant runtime EXECUTE or activate/enroll v1 in this package.
- Canonical food export, recipe atomic metadata and recipe ingredient expansion remain
  **PARKED**. Browser gap remains; payment is out of scope. No production, SQL/DB/RLS
  execution, service-role shortcut, push or deploy occurred in this local preparation.

## Adaptive persistence v1 applied / behavioral acceptance prepared — 2026-09-21

- Current HEAD remains `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`; no commit,
  push or deploy.
- Owner-confirmed live state supersedes the previous persistence `NOT APPLIED` state:
  migration SHA-256
  `2c905977dba43d8679a78582738b6224e38ccd71226932961392c80f2b8fa0d4`
  is **APPLIED_STAGING**. Structural rollback-only acceptance SHA-256
  `2482729c9652f4a5bcd9c5f17be50957c95b03fe45651626fbc91bc9bf185117`
  passed through final `ROLLBACK`; owner post-check found operations=0,
  graph_revisions=0 and events=0. Trusted entitlement remains
  **APPLIED_STAGING / ACCEPTANCE_PASS**. Production is untouched.
- Prepared, but did not execute, exact behavioral artifacts:
  - `docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.behavioral-acceptance.sql`,
    SHA-256 `eb4bd86563a4c13e3462fb82b9c1491cd77eb4ac4837d751420f2d32805a137e`;
  - `docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.behavioral-postcheck.sql`,
    SHA-256 `00ae37b43fdc80c6345a198ae603b4da0eb718549c310d900fbef2a26fbc0e6d`.
- Behavioral acceptance uses only the known empty staging fixture accounts
  `d6eb4e97-90d0-470f-bc4a-2f3e401e1fde` and
  `8f82ff67-39d1-4bb1-9d55-028af99d5cca`. Its preflight fails if either account has
  profile/Goal/plan/diary/attestation data or if adaptive tables are not globally
  empty. It creates only synthetic profile IDs, Goals, generated weekly instances,
  graph/event/receipt fixtures and attestations inside one transaction.
- Covered cases: authenticated generated-instance denial; temporary owner Premium
  grant; atomic accepted graph/event/head/receipt; same-key replay and payload
  mismatch; stale plan/history/diary vectors and separately advanced authoritative
  Goal; foreign selection/read/lookup; revoke and historical expiry with new-effect
  denial plus original replay/lookup; injected post-operation/graph failure with no
  fragment; receipt-bound exact read; graph/event/receipt update/delete/truncate
  guards; and one-successor rejection. `SET CONSTRAINTS ALL IMMEDIATE` validates
  deferred FKs before the mandatory final `ROLLBACK`.
- FACT/diary projection writes, canonical food/recipe access, runtime EXECUTE grants,
  public mutation transport and production paths are absent. The postcheck is
  SELECT-only and all returned counts must be zero.
- Fresh local static checks: targeted SQL contract tests **7/7 PASS**; standalone
  strict TypeScript **PASS**; targeted ESLint `--max-warnings 0` **PASS**; behavioral
  SQL has one BEGIN, no COMMIT, one final ROLLBACK, balanced dollar tags/parentheses,
  no trailing whitespace and final newline. No PostgreSQL parser/server, staging
  connection, SQL execution, runtime tests, broad suite or build ran. These local
  checks do not prove deployed behavior.
- Applied migration file was not changed. Static review found no proved applied-SQL
  defect requiring a repair before behavioral acceptance; therefore **repair is not
  required at this checkpoint** and no repair draft was created. Any live failure
  must be rolled back and analyzed before preparing a minimal repair.
- Exact changed paths in this package: the behavioral acceptance SQL, SELECT-only
  postcheck SQL, `scripts/contracts/adaptive-nutrition-persistence-sql-v1.test.ts`,
  and this resume. Fresh 229-file baseline/index verification is recorded by the
  final checks for this package.
- Next owner checkpoint: separately approve the exact behavioral acceptance hash for
  one unchanged run in the STAGING postgres owner SQL session. Success requires no
  exception and reaching the final `ROLLBACK`. Then run the exact SELECT-only
  postcheck hash and require every count to be zero. On any error, issue `ROLLBACK;`,
  return the exact error and do not retry or alter staging automatically.
- Canonical food export, recipe atomic metadata and ingredient expansion remain
  **PARKED**. Runtime EXECUTE and FACT writer remain disabled; payment and production
  remain out of scope.

## Runtime read/lookup + bounded PLAN mutation package prepared — 2026-09-21

- Current HEAD remains `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`; no commit,
  push or deploy. Owner-confirmed live STAGING state supersedes the prior behavioral
  checkpoint: trusted entitlement is **APPLIED_STAGING / ACCEPTANCE_PASS**;
  persistence v1 is **APPLIED_STAGING**; structural acceptance passed; behavioral
  acceptance SHA-256
  `eb4bd86563a4c13e3462fb82b9c1491cd77eb4ac4837d751420f2d32805a137e`
  passed through final `ROLLBACK`. Owner-reported SELECT-only postcheck is zero for
  operations, graph revisions, events, profiles, Goals, selections, diary rows,
  attestations and behavioral markers. Production is untouched.
- Prepared one **NOT APPLIED** runtime activation draft:
  `docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.sql`,
  SHA-256 `89d747579ce890d031b82e2244f4415e2179bede744db363307f5b07d543305e`.
  It grants authenticated EXECUTE only for own-account lookup, current/exact read
  and a new raw-text mutation RPC. No grant goes to PUBLIC, anon or service_role.
- The server draft parses raw `json`, recursively rejects duplicate keys before its
  only request `jsonb` conversion, checks exact fields/UUID/date/timezone/revisions,
  derives account from `auth.uid()`, reconstructs versioned canonical bytes and
  recomputes SHA-256 with `extensions.digest`. There is no client digest parameter.
  Settled same-key replay is checked before entitlement/current-head admission;
  mismatched payload conflicts. New effects still pass the applied Premium gate and
  atomic plan/Goal/history/diary CAS boundary.
- Runtime mutation is limited to `REPLACE`→`PLAN_REPLACED`, `SKIPPED`→`ANNOTATION`
  and `UNDO_ANNOTATION`→`ANNOTATION_RETRACTION`. FACT/CONSUMED/EXTRA actions fail
  before transport and at the server boundary; component manifests remain empty and
  no diary projection writer was added.
- Replacement never accepts a client graph. It requires an owned, unexpired,
  immutable private validated-offer row bound to the full expected vector and dated
  slot snapshot. The patch provides no client/server writer for those offers, so
  PLAN replacement remains fail closed until a separately reviewed engine can prove
  canonical recipe/food validation. Canonical blockers are not bypassed.
- Added shared browser-safe strict wire codec and runtime service. The existing
  synthetic Node contract now reuses the codec for duplicate-aware parsing,
  validation and canonical bytes. Runtime SHA-256 uses Web Crypto and is compared
  with the server receipt. The service exposes session-generation-bound lookup,
  current read, receipt-bound exact read and bounded mutation; pre/post authenticated
  account checks reject logout/account-switch/A→B→A late responses. Exact read must
  match receipt operation plus plan/Goal/history/diary revisions; no local freshness
  oracle was introduced.
- Exact package paths: `src/utils/adaptiveNutritionWireV1.ts`,
  `src/services/adaptiveNutritionPersistenceService.ts`,
  `src/services/__tests__/adaptiveNutritionPersistenceService.test.ts`,
  `scripts/contracts/adaptive-nutrition-server-v1.ts`,
  `scripts/contracts/adaptive-nutrition-runtime-activation-sql-v1.test.ts`, the SQL
  draft above, `docs/premium/adaptive-nutrition-server-draft-v1.md`, and this resume.
- Fresh checks: targeted runtime/wire/SQL contracts **43/43 PASS**; project strict
  TypeScript **PASS**; standalone strict TypeScript for all touched TS/tests **PASS**;
  targeted ESLint with `--max-warnings 0` **PASS**; production build **PASS** with
  only existing browser-data/chunk-size/dynamic-import warnings. SQL static checks
  confirm one BEGIN/COMMIT, balanced dollar tags, fixed search_path on all four new
  functions, server-only digest/account derivation, private immutable offers and no
  diary writes. No PostgreSQL parser/server, Supabase connection, SQL execution or
  live acceptance ran; local checks are not deployed guarantees.
- Final workspace checks: SQL SHA-256 reverified; package files have final newlines
  and no trailing whitespace; `git diff --check` passed; **229/229 baseline owner
  file hashes and statuses unchanged**; git index empty.
- Next owner checkpoint: review the exact activation SQL/hash, then separately
  authorize that exact hash for **STAGING-only** postgres-owner apply. On success,
  runtime/UI activation must remain off until a separately reviewed rollback-only
  acceptance proves duplicate raw rejection, digest parity, own-account lookup,
  current-vs-exact entitlement behavior, exact replay, CAS and the three bounded
  actions. Any live defect requires rollback/minimal repair review; production needs
  its own later approval.
- Canonical food export, recipe atomic metadata and recipe ingredient expansion stay
  **PARKED**. The validated-offer producer, FACT/diary writer, payment, UI activation,
  production, service-role shortcut, push and deploy remain absent.

## Runtime activation applied / behavioral acceptance prepared — 2026-09-21

- Current HEAD remains `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`; no commit,
  push or deploy. Owner-confirmed live state supersedes the prior activation
  checkpoint: runtime activation v1 SHA-256
  `89d747579ce890d031b82e2244f4415e2179bede744db363307f5b07d543305e`
  is **APPLIED_STAGING**. Mutate/lookup/read EXECUTE is authenticated-only;
  anon/service_role mutation is denied; the private offer table has RLS+FORCE RLS;
  all runtime tables were empty. Entitlement and persistence gates retain their
  owner-confirmed acceptance-pass status. Production is untouched.
- Prepared, but did not execute:
  - `docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.behavioral-acceptance.sql`,
    SHA-256 `7eedaba4f574262faf6376c264d47dc7a172d034ba2cae2c82c8b375eea59504`;
  - `docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.behavioral-postcheck.sql`,
    SHA-256 `43afe8b749cca5cb59eb2060630f96c4f7d8e3b1561dc21b500ce0df2a995d4a`.
- The acceptance uses the two confirmed empty staging fixture accounts, one
  transaction and mandatory final `ROLLBACK`. Public calls run under
  `SET LOCAL ROLE authenticated` plus the matching JWT subject; fixture creation
  and assertions run as postgres owner. No service_role actor path is used.
- Covered: own and foreign lookup/read isolation; escaped duplicate keys and extra
  fields; account override denial; local-TS/server canonical SHA-256 golden parity;
  SKIPPED receipt/replay/payload conflict; independently stale plan, Goal, history
  and diary revisions; annotation retraction and one-successor guard; private offer
  valid/expired/mismatched/foreign admission; revoke/expiry admission failure;
  replay/lookup/exact read after entitlement loss with current-read denial; all FACT
  actions rejected; and no diary/component effects. Denied operations must leave no
  receipt fragments. Deferred constraints are forced before rollback.
- The postcheck is SELECT-only and requires zero runtime rows, replacement offers,
  fixture profiles/Goals/selections/legacy meal rows/diary rows/attestations and all
  acceptance markers.
- Fresh local checks: targeted runtime/wire/server/SQL contracts **49/49 PASS**;
  targeted standalone strict TypeScript **PASS**; targeted ESLint **PASS**. Static
  checks confirm one BEGIN/no COMMIT/final ROLLBACK, balanced blocks, no direct diary
  writes and unchanged applied activation hash. No PostgreSQL parser/server,
  Supabase connection, SQL execution, broad suite or build ran. Local checks do not
  prove deployed behavior.
- Static review found no proved defect in the applied runtime activation; **no repair
  is needed before this acceptance** and no repair draft was created. A live failure
  must be rolled back and reviewed before any repair is prepared or applied.
- Exact paths changed by this package: the acceptance SQL, SELECT-only postcheck SQL,
  `scripts/contracts/adaptive-nutrition-runtime-activation-sql-v1.test.ts`, and this
  resume. Final workspace checks: SQL/package whitespace and `git diff --check`
  **PASS**; **229/229 baseline owner hashes and statuses unchanged**; index empty;
  activation SQL hash remains exactly the owner-confirmed applied hash.
- Next owner checkpoint: approve the exact acceptance hash for one unchanged run in
  the **STAGING-only postgres owner SQL Editor**. Success requires reaching its final
  `ROLLBACK`. Then run the exact SELECT-only postcheck hash and require every count
  to be zero. On any error, issue `ROLLBACK;`, return the exact error and do not retry
  or modify staging automatically. Production remains forbidden.
- FACT/diary writer, canonical food/recipe validation and replacement-offer producer
  remain disabled. Canonical export, recipe atomic metadata and recipe expansion stay
  **PARKED**; payment, push and deployment remain out of scope.

## Client runtime integration behind OFF gate — 2026-09-21

- Current HEAD remains `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`; no commit,
  push or deploy. Owner-confirmed live state supersedes the preceding checkpoint:
  runtime behavioral acceptance SHA-256
  `7eedaba4f574262faf6376c264d47dc7a172d034ba2cae2c82c8b375eea59504`
  passed on STAGING and its SELECT-only postcheck returned zero for every runtime,
  fixture and marker count. Entitlement, persistence and runtime activation retain
  their applied/acceptance-pass statuses. Production is untouched.
- `adaptiveNutritionPersistenceService` is now physically bound to the existing
  browser Supabase client and the applied public RPC names for mutate, account-key
  lookup and current/exact read. Each operation authenticates with `getUser()` before
  dispatch and again before accepting the response; request account/session and
  generation must match. No service_role path or account override was added.
- The mutation RPC receives the original `p_request_text` string byte-for-byte after
  strict local validation and local digest calculation. The client sends no digest,
  parsed replacement graph or account parameter. REPLACE accepts only the strict
  `replacementOfferId` wire shape; canonical/offer authority remains server-side.
- Runtime gate `VITE_ADAPTIVE_NUTRITION_RUNTIME_V1` is exact-`true` only and defaults
  OFF. It has no localStorage override. With the gate OFF, mutate/lookup/read return
  unavailable before auth or RPC, proving zero network calls. No page, component or
  production UI flow imports the singleton, so no user action is enabled.
- Server settled receipts retain their terminal outcome; explicit unknown/denied/
  conflict kinds and PostgreSQL `40001`/`42501` errors map to the existing recovery
  result union. Other transport errors remain UNKNOWN. Timeout lookup and exact replay
  reuse the original key/raw envelope; logout/session restart and A→B→A generations
  reject late or foreign authenticated responses.
- FACT, CONSUMED_AS_PLANNED, CONSUMED_MODIFIED and EXTRA_FOOD all reject before auth/
  RPC. No diary projection writer, FACT component, storage/outbox hook or UI action
  was introduced. Existing pure recovery/lifecycle retention remains unchanged.
- Exact paths changed by this package:
  `src/services/adaptiveNutritionPersistenceService.ts`,
  `src/services/__tests__/adaptiveNutritionPersistenceService.test.ts`, and this
  resume. Applied persistence/runtime SQL files are unchanged and their SHA-256
  values remain `2c905977dba43d8679a78582738b6224e38ccd71226932961392c80f2b8fa0d4`
  and `89d747579ce890d031b82e2244f4415e2179bede744db363307f5b07d543305e`.
- Fresh checks: targeted runtime/recovery/server/SQL contracts **78/78 PASS**;
  project build/strict TypeScript **PASS**; targeted standalone strict TypeScript
  **PASS**; targeted ESLint `--max-warnings 0` **PASS**. Build emitted only the known
  browser-data age, mixed import and chunk-size warnings. No Supabase call, SQL/DB
  write, staging mutation, production change, push or deploy occurred.
- Final workspace checks: `git diff --check` and package whitespace **PASS**;
  **229/229 baseline owner hashes and statuses unchanged**; git index empty; no
  runtime/UI consumer imports the singleton outside its service and targeted tests.
- No new DB checkpoint is required for this OFF-gated client package. The next gate
  is local/client review of these exact paths. Any later staging UI/preview wiring or
  setting the runtime flag to true requires a separate bounded owner-approved task;
  production activation remains separately forbidden.
- Canonical food export, recipe atomic metadata and recipe expansion remain
  **PARKED**. Validated-offer production, FACT/diary projection, payment and account
  erasure protocol remain disabled or OPEN as previously recorded.

## STAGING-only Premium Today UI wiring behind OFF gate — 2026-09-22

- Current HEAD remains `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`; no commit,
  push, deploy, SQL, Supabase call or environment activation. Owner-confirmed live
  status: trusted entitlement, persistence v1 and runtime activation v1 are
  **APPLIED_STAGING / ACCEPTANCE_PASS** (including both persistence acceptances and
  runtime behavioral acceptance). Production remains untouched.
- `NutritionWeekPreview` now selects a new runtime view only when the existing
  `VITE_ADAPTIVE_NUTRITION_RUNTIME_V1` gate is exact `true`. The default/OFF path is
  the prior local weekly UI and performs no runtime request. No production env or
  caller was changed; the regular Today route still needs an explicit, account-owned
  weekly preview/selection input before a real STAGING smoke can start.
- The runtime controller loads `adaptive_nutrition_read_v1` current state and accepts
  only a structurally valid active Monday–Sunday graph. Server dates, slot IDs and
  immutable snapshot references drive the view. Local recipe title is shown only
  when slot and recipe revision identities match exactly; local portion/macros are
  not treated as server evidence.
- Physically wired mutations are only `SKIPPED`, `UNDO_ANNOTATION`, and `REPLACE`
  when a server-created offer ID is supplied. The UI has no offer producer. FACT,
  consumed-as-planned, consumed-modified, extra-food and diary projection controls
  do not exist in this runtime branch.
- Accepted mutation is never shown as success until receipt-bound `readExact`
  returns the exact server graph. Timeout/transport ambiguity remains UNKNOWN;
  controls stay blocked and lookup uses the original idempotency key. Conflict/stale
  refreshes current state and requires explicit review. Denied state blocks new
  Premium mutations while an unresolved original operation can still use lookup and
  exact read after entitlement loss.
- UNKNOWN request text/key is quarantined in account-scoped process memory across
  logout and A→B→A within the same browser process; B cannot see or act on A's
  pending payload. This is not durable restart storage and does not close the
  existing durable-outbox/restart boundary. Session generations discard late reads
  and mutation responses.
- UI states cover loading, submitting, unknown, conflict, denied and unavailable
  without displaying UUIDs or digests. A server graph lacking presentation fields
  uses neutral copy rather than guessed recipe/nutrition content.
- Exact paths changed by this bounded package:
  `src/components/NutritionWeekPreview.tsx`,
  `src/components/AdaptiveNutritionRuntimeWeekPreview.tsx`,
  `src/components/__tests__/AdaptiveNutritionRuntimeWeekPreview.test.tsx`,
  `src/pages/__tests__/TodayNutritionWeekPreview.test.tsx`,
  `src/services/adaptiveNutritionTodayRuntime.ts`,
  `src/services/__tests__/adaptiveNutritionTodayRuntime.test.ts`, and this resume.
- Fresh checks: focused UI/runtime/service tests **30/30 PASS**; expanded relevant
  adaptive/recovery/server/SQL contract set **127/127 PASS**; project strict
  TypeScript and production build **PASS**; targeted ESLint with zero warnings
  **PASS**. Build emitted only the existing browser-data age, mixed-import and chunk
  size warnings. Local tests do not prove a live browser/STAGING flow.
- Final workspace checks: `git diff --check` and new-file whitespace **PASS**; git
  index empty; **229/229 baseline owner hashes and statuses unchanged**. Applied
  persistence/runtime SQL hashes remain exactly
  `2c905977dba43d8679a78582738b6224e38ccd71226932961392c80f2b8fa0d4` and
  `89d747579ce890d031b82e2244f4415e2179bede744db363307f5b07d543305e`.
- Next owner checkpoint: review this exact local client package, then separately
  authorize a STAGING-only flag-on browser smoke with one authenticated Premium test
  account and its real own active selection ID. That smoke needs an approved safe
  preview-input path because the normal Today route does not discover a personal
  selection. Keep the flag OFF until that input and smoke steps are reviewed. No new
  DB checkpoint is required for the present package.
- Canonical food export, recipe atomic metadata and recipe expansion remain
  **PARKED**. Validated-offer production, FACT/diary writes, payment, production
  activation, push and deploy remain disabled or out of scope.

## Persistent STAGING smoke fixture request — BLOCKED by append-only contract (2026-09-22)

- Fresh owner read-only evidence: Premium test auth account
  `88c26f6b-ebc8-4bff-864d-9194fbd27f8d` currently has no row in
  `public.user_premium_plan_selections`; browser smoke therefore has no own active v1
  selection. No agent Supabase connection or SQL execution occurred.
- A current-read fixture necessarily needs a selection, a bootstrap operation receipt
  and an immutable graph revision because the selection head has a deferred FK to
  `adaptive_nutrition_graph_revisions`, whose row in turn requires a creating
  operation. SKIPPED and UNDO would add settled operations plus annotation and
  retraction events.
- The applied persistence contract intentionally prevents the requested cleanup:
  `potok_graph_revisions_immutable_v1` and `potok_events_immutable_v1` reject
  UPDATE/DELETE/TRUNCATE; `potok_operations_delete_guard_v1` rejects DELETE/TRUNCATE.
  These guards call `potok_nutrition.reject_immutable_change_v1` without a postgres
  bypass. Selection FKs from graph revisions, operations and events use
  `ON DELETE RESTRICT`, so the selection cannot be deleted while those immutable
  rows remain.
- The trusted entitlement audit is also append-only. A temporary Premium grant can
  be closed only by appending a matching owner-controlled revoke; grant/revoke audit
  rows intentionally remain. This part is compatible with audit semantics, but it
  cannot solve persistence fixture cleanup.
- A single rollback transaction cannot support the requested browser smoke: browser
  RPCs, refresh and logout/login use separate database transactions/connections and
  cannot read another session's uncommitted fixture. Disabling triggers, deleting
  append-only history, using service_role or weakening FKs would violate approved
  contracts and was not drafted.
- Therefore no setup, cleanup, preflight or post-smoke SQL artifact was created; no
  fixture UUID/build-time selection override was invented; and no preview-input code
  was changed in this package. Tests/build/lint were not rerun because only this
  factual handoff section changed.
- **OPEN OWNER CHECKPOINT:** choose a contract-compatible smoke environment before
  implementation: (A) a disposable isolated Supabase branch/project whose entire
  database can be discarded after smoke, or (B) explicitly approve a retained,
  clearly marked append-only STAGING smoke lineage with archive + entitlement revoke
  instead of deletion. Option B changes the requested cleanup acceptance criterion;
  it does not authorize any SQL yet. A delete-capable cleanup path is not compatible
  with the currently applied append-only persistence v1 contract.
- Runtime and smoke flags remain default OFF. Production, FACT/diary writes,
  canonical food/recipe data, validated-offer production, SQL/apply, push and deploy
  remain untouched. All previously PARKED blockers stay PARKED.

## Disposable branch browser-smoke package prepared — 2026-09-22

- Current HEAD remains `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`; no commit,
  push, deploy, Supabase connection, branch creation or SQL execution occurred.
  The owner selected a disposable Supabase branch/project instead of any retained
  fixture on main STAGING. The prior retained-fixture blocker remains factual and is
  resolved for the proposed smoke only by deleting the entire disposable branch.
- Review workflow: `docs/premium/adaptive-nutrition-disposable-branch-smoke-v1.md`.
  It requires a branch from STAGING `ozidryfvhkcbtpnulakq`, **Include data OFF**,
  one new branch-local Auth test user, no copied user data, preflight before fixture,
  no merge, and whole-branch deletion immediately after evidence capture. Branch
  capability/billing and actual schema inheritance remain owner/live checkpoints.
- Prepared SQL, not executed:
  - SELECT-only preflight SHA-256
    `c711bc760cbf8d277dffc3450aab83b96303d982f938a7afcef6dfc5123f12d1`;
  - one-time transactional fixture SHA-256
    `4dc1657cfeaea883de0ff71a41d132b33c3dbcc7fdea12b95cc549675bca57e4`;
  - SELECT-only post-smoke check SHA-256
    `8ed5a7313718a7dd4e7448af7e9e9a927a865a28fd323b4b9af3a26ff3817d78`.
- Fixture fails closed unless the branch has exactly one Auth user, at most one clean
  profile, and zero Goals, selections, legacy meal rows, diary rows, attestations,
  operations, graph revisions, events and replacement offers. It creates a minimal
  profile only if absent, a synthetic Goal, owner-controlled 24-hour Premium grant,
  one active generated contract-v1 Monday–Sunday selection, bootstrap receipt and
  one immutable graph with seven synthetic slots/snapshot identities. Recipe
  revisions are null; no canonical food/recipe, legacy meal selection, FACT/diary
  row or replacement offer is created.
- Ordered branch-only fallback is pinned to the reviewed entitlement v2, v2.1,
  v2.2, persistence v1 and runtime activation v1 artifacts and their existing
  hashes. It is used only when all five packages are absent on an otherwise exact
  legacy STAGING schema. A partial/drifted branch must be deleted/reset or reviewed;
  no installer is layered over unknown existing objects. If preflight passes, no
  migration is reapplied.
- Added smoke preview input through build-time environment only. It requires the
  existing runtime gate and a separate smoke gate, exact non-base branch ref/URL,
  branch public key presence, fixed selection ID and an exact authenticated-account
  match. It contains no query-param, localStorage or manual runtime UUID override.
  The checked-in `.env.example` is inert; a populated `.env.adaptive-smoke.local` is
  gitignored. Production/default builds remain OFF.
- Browser scope is authoritative current read, SKIPPED, receipt-bound exact read,
  refresh, UNDO, refresh and same-account logout/login. FACT controls must remain
  absent; REPLACE is excluded because no validated-offer producer exists. The
  postcheck expects bootstrap+SKIP+UNDO receipts, annotation+retraction history,
  zero live annotations, zero diary/FACT rows and exact fixture ownership.
- Exact package paths: `src/pages/Today.tsx`,
  `src/services/adaptiveNutritionSmokePreview.ts`,
  `src/services/__tests__/adaptiveNutritionSmokePreview.test.ts`, the three
  `20260922_adaptive_nutrition_disposable_smoke_v1.*.sql` files,
  `docs/premium/drafts/adaptive-nutrition-disposable-smoke-v1.env.example`, the
  workflow document, `scripts/contracts/adaptive-nutrition-disposable-smoke-v1.test.ts`,
  and this resume.
- Fresh checks: targeted smoke/runtime/Today contracts **28/28 PASS**; project strict
  TypeScript **PASS**; targeted ESLint with zero warnings **PASS**; production build
  **PASS** with only existing browser-data age, mixed-import and chunk-size warnings.
  Static SQL checks prove pre/post files are SELECT-only and fixture scope/order;
  they do not prove PostgreSQL or live Supabase behavior.
- Next owner checkpoint, in order: approve branch creation/cost with Include data
  OFF; create it; run exact preflight; create one isolated branch-local Auth user and
  rerun preflight; return the preflight evidence and branch/account identifiers
  without credentials. Only then review/approve the exact fixture hash for execution
  on that disposable branch. Browser config/smoke, postcheck and whole-branch deletion
  follow as separate owner actions. Main STAGING and production remain untouched.
- Canonical food export, recipe atomic metadata and recipe expansion remain
  **PARKED**. FACT/diary writer, validated-offer producer, payment, production,
  service-role shortcut, push and deploy remain disabled or out of scope.

## Disposable smoke fixture local scope repair — 2026-09-22

- Static review found that the separate `$verify_fixture$` block referenced
  `v_selection` and `v_plan_revision` declared only inside the preceding `$fixture$`
  block. PL/pgSQL `DO` blocks have independent local scopes, so the prepared fixture
  would fail before COMMIT. Nothing had been created or executed in Supabase.
- Minimal repair: `$verify_fixture$` now declares the same exact constant selection
  `9a220000-0000-4000-8000-000000000001` and plan revision
  `9a220000-0000-4000-8000-000000000011` in its own scope. Architecture, data set,
  transaction boundaries, identities and whole-branch teardown are unchanged.
- New fixture SHA-256:
  `4dc1657cfeaea883de0ff71a41d132b33c3dbcc7fdea12b95cc549675bca57e4`.
  Preflight remains
  `c711bc760cbf8d277dffc3450aab83b96303d982f938a7afcef6dfc5123f12d1`;
  postcheck remains
  `8ed5a7313718a7dd4e7448af7e9e9a927a865a28fd323b4b9af3a26ff3817d78`.
- Added a targeted static regression that extracts each PL/pgSQL `DO` block and
  requires every `v_` local referenced in its declarations/body to be declared in
  that same block. It also checks one BEGIN/COMMIT, verification and deferred-FK
  checks before COMMIT, and absence of exception swallowing.
- No local PostgreSQL parser was available; no parser/server PASS is claimed. No SQL,
  Supabase, branch creation, apply, deploy or push occurred. Owner approval for
  disposable branch creation may proceed.
- Fresh repair checks: targeted disposable-smoke contracts **8/8 PASS**, including
  per-DO local-scope regression; project strict TypeScript **PASS**; targeted ESLint
  with zero warnings **PASS**; `git diff --check` **PASS**; index empty; all
  **229/229 baseline owner hashes and statuses unchanged**. Static checks reconfirm
  one BEGIN/COMMIT, every verification/failure point before COMMIT, no swallowed
  exception path, no FACT/diary/canonical write, fixed selection identity, and
  whole-disposable-branch teardown. These checks are not a PostgreSQL execution.

## Retained append-only main-STAGING smoke package prepared — 2026-09-22

- Owner decision: Supabase Branching is unavailable on the current Free plan without
  Pro upgrade. The disposable-branch workflow is marked **SUPERSEDED / NOT EXECUTED**.
  The authorized replacement is a retained append-only fixture on STAGING project
  `ozidryfvhkcbtpnulakq` only. Current HEAD remains
  `b0e9bd5e9dda33911dd796bc9f1b728c78dd231d`; no SQL, Supabase connection,
  branch/create/apply, push or deploy occurred.
- Review workflow: `docs/premium/adaptive-nutrition-retained-staging-smoke-v1.md`.
  Exact retained identity uses account `88c26f6b-ebc8-4bff-864d-9194fbd27f8d`,
  selection `7e710000-0000-4000-8000-000000000001`, a distinct `7e71…` UUID
  namespace, lineage `potok-retained-staging-smoke-v1`, matching idempotency/evidence
  refs and explicit discovery policy `explicit-smoke-selection-only`. Disposable
  `9a22…` fixture identities are not reused.
- Reviewed artifacts and hashes. The setup is owner-reported applied; Codex did not
  execute any of them:
  - SELECT-only preflight SHA-256
    `a776fae4843c46898652e4fb548422eba4582c49c0637e63b362fc6a93162a8f`;
  - one-time setup SHA-256
    `b935cf9ec1aa40a0b0e34bc05bf3d899db98251b9683c4f756ff442bf56314b0`;
  - SELECT-only post-smoke SHA-256
    `8a64d64514fc2b54d913c6701311f0e93f96e6b1e3f381c26d671d7737d1f1ff`;
  - retirement (not cleanup) SHA-256
    `750a8ef69582f39b1573eb3b4268fbb4454829895b306f5e0c496836adf4a3ba`;
  - SELECT-only post-retirement SHA-256
    `74a793f8aa21c64803804545bc37a04a653373b4bd9b9df894497fbeb5ab19bf`.
- Preflight returns one fail-closed readiness verdict for the exact account/profile,
  empty Goal/plan/runtime/diary/entitlement/offer state, unused lineage/IDs, applied
  repaired entitlement objects, runtime grants, forced RLS and immutable guards.
  Dashboard project-ref verification remains manual because SQL database identity
  cannot independently attest the Supabase project ref.
- Setup repeats material admission under one owner transaction. It creates only a
  synthetic Goal, 24-hour owner-controlled Premium grant, active generated v1 week,
  bootstrap receipt and immutable seven-day graph with null recipe revisions. No
  canonical food/recipe, meal selection, event, FACT/diary row or replacement offer
  is created. Any check/deferred-FK/verification failure occurs before COMMIT and
  rolls back the full fixture.
- Expected browser result is exactly three accepted receipts (bootstrap, SKIPPED,
  UNDO), one annotation, one retraction, no live annotation, no FACT/PLAN_REPLACED,
  no diary/offer/foreign fixture row and no digest mismatch. REPLACE remains excluded.
- Retirement requires that exact post-smoke state. It appends the protected exact
  Premium REVOKE and changes only the exact fixture selection from active to archived
  in one transaction. Re-execution after exact completion is a no-op; partial or
  foreign lineage fails closed. Receipts, graph, events, Goal and entitlement audit
  remain retained. Revocation denies new paid effects/current read while preserved
  material supports exact replay/lookup/operation-bound historical read.
- Smoke client config now accepts only exact main-STAGING ref/URL, exact account and
  retained selection through build-time environment with both runtime and smoke
  gates exact true. There is no query/localStorage/manual UUID override; production
  and default configs remain OFF. Any future normal discovery must exclude the
  retained lineage regardless of status and must exclude archived selections.
- Exact local package paths: the five
  `20260922_adaptive_nutrition_retained_staging_smoke_v1.*.sql` artifacts,
  `docs/premium/adaptive-nutrition-retained-staging-smoke-v1.md`, its retained
  `.env.example`, `src/services/adaptiveNutritionSmokePreview.ts` and targeted test,
  the retained static contract test, the superseded disposable workflow/static test,
  and this resume. Existing `Today.tsx` integration is reused unchanged by this package.
- Fresh checks: focused retained/disposable/config/Today/runtime set **36/36 PASS**;
  project strict TypeScript **PASS**; targeted ESLint with zero warnings **PASS**;
  production build **PASS** with only existing browser-data age, mixed-import and
  chunk-size warnings. Static SQL checks cover SELECT-only artifacts, transaction
  shape, per-DO local scope, write allowlists, exact retirement scope and unchanged
  applied SQL hashes. No local PostgreSQL parser/server was available; no parser or
  deployed behavior PASS is claimed.
- Final workspace checks: `git diff --check` **PASS**; index empty; all **229/229
  baseline owner hashes and statuses unchanged**. Production build remains gate-OFF
  unless the exact smoke mode/environment is deliberately supplied.
- Current next checkpoint is the owner-run browser procedure in
  `docs/premium/adaptive-nutrition-retained-staging-browser-smoke-runbook-v1.md`.
  Browser evidence must return before post-smoke verification or retirement.
- Canonical food export, recipe atomic metadata and recipe expansion remain
  **PARKED**. FACT/diary writer, replacement-offer producer, payment, production,
  service-role shortcut, push and deploy remain disabled or out of scope.

## Retained STAGING browser-smoke owner runbook — 2026-09-22

- Owner reports the retained setup successfully applied on STAGING project
  `ozidryfvhkcbtpnulakq` for exact account
  `88c26f6b-ebc8-4bff-864d-9194fbd27f8d` and selection
  `7e710000-0000-4000-8000-000000000001`. This report records owner evidence; Codex
  did not connect to Supabase or independently execute/verify SQL.
- Added the exact owner procedure at
  `docs/premium/adaptive-nutrition-retained-staging-browser-smoke-runbook-v1.md`.
  It pins the ignored `.env.adaptive-smoke.local`, public anon/publishable-key-only
  boundary, Vite `adaptive-smoke` mode on strict local port 5173, exact OTP login,
  authoritative Today SKIPPED/reconciliation/refresh/UNDO/logout-login sequence,
  PASS/FAIL criteria, credential-safe evidence and fail-closed stop conditions.
- The runbook requires Dashboard verification of the existing login identifier
  before requesting OTP because the current login flow permits creation for an
  unknown identifier. It forbids Google/demo access, service_role/secret keys,
  query/localStorage UUID overrides and all production configuration.
- UNKNOWN preserves the original operation only within the current browser process:
  the owner must use **Проверить результат** once and must not refresh/logout/restart
  while the result remains unknown. An unresolved result is a stop condition.
- No browser smoke, Supabase request, SQL, post-smoke check, retirement, production
  change, deploy or push was performed. This documentation-only update did not rerun
  application tests/build; prior results are not presented as fresh evidence.
- Next exact checkpoint: owner follows the browser runbook and returns its sanitized
  ten-step PASS/FAIL evidence. Post-smoke SELECT-only verification and retirement
  remain later explicit checkpoints. All PARKED blockers and disabled FACT/diary,
  REPLACE producer, payment, production, push and deploy boundaries remain unchanged.

## Safe Git checkpoint before browser smoke — 2026-09-22

- Audited all 293 working-tree status entries: exactly 229 match the preserved owner
  baseline and exactly 64 belonged to the completed Adaptive Nutrition package.
  The 64 paths were reviewed, secret-scanned and assigned to three coherent commits:
  verified entitlement/profile/server evidence; persistence/runtime client; and
  retained smoke/evidence/handoff. Superseded disposable smoke artifacts remain in
  the final commit because they document the rejected Free-plan branch path and its
  static repair; they are not an active execution path.
- Fresh focused contracts: **122/122 PASS**. After removing one pre-existing useless
  `try/catch` exposed by targeted lint, the affected entitlement/profile subset is
  **22/22 PASS** and the persistence SQL static subset is **7/7 PASS**.
- Strict TypeScript `npx tsc --noEmit` **PASS**. Targeted ESLint has **0 errors**;
  its normal output retains three pre-existing `AuthContext.tsx` warnings
  (`exhaustive-deps`, `no-explicit-any`, `only-export-components`). The scoped
  `--quiet` error gate passes. No warning was hidden by a source suppression.
- Production `npm run build` **PASS**. It emitted the existing browser-data age,
  mixed static/dynamic `mealService` import and chunk-size warnings. Runtime and
  smoke feature flags remain default OFF; no production environment changed.
- Whole candidate secret scan found no actual Supabase secret/publishable key, JWT,
  OTP/password/token assignment, private key, GitHub token or AWS key.
  `.env.adaptive-smoke.local` does not exist, is not tracked and remains ignored by
  `.gitignore:13:*.local`.
- `git diff --check` and each cached diff check pass. The baseline recheck reports
  **229/229 owner hashes and statuses unchanged**; no owner path entered any commit.
- No push, deploy, browser smoke, Supabase request/write, production activation or
  runtime production-flag change occurred. The exact proposed next Git action is
  `git push origin master`, requiring separate owner authorization.
