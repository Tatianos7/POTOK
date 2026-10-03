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

## Retained STAGING smoke evidence / retirement v1.1 review — 2026-09-22

- Current HEAD remains `de2f45486597d41af57617d3d4bcaac22156fc96`. Owner reports
  the browser smoke and exact SELECT-only post-smoke check completed against STAGING
  `ozidryfvhkcbtpnulakq`, account `88c26f6b-ebc8-4bff-864d-9194fbd27f8d`, selection
  `7e710000-0000-4000-8000-000000000001`. This is owner evidence; Codex did not
  connect to Supabase or execute SQL.
- Live evidence is clean but contains two complete action pairs: five accepted
  receipts (one bootstrap, two SKIPPED, two UNDO), four events (two annotations,
  two retractions), zero live annotations, digest mismatches, wrong successor counts,
  FACT/PLAN_REPLACED, diary, meal-selection, replacement-offer or foreign fixture
  rows. Premium was effective at the time of that read-only check.
- The committed post-smoke/retirement/post-retirement artifacts hard-required one
  pair (`3` receipts / `2` events). Existing retirement would therefore fail safely
  before revoke/archive on the current state; it is not safe to run as-is because it
  cannot complete the intended retirement.
- Prepared local v1.1 review changes only. The checks and retirement now accept one
  exact bootstrap plus `N >= 1` fully paired accepted SKIPPED/UNDO histories, require
  every annotation to have exactly one same-fixture retraction, reject orphaned,
  live, second-successor, unexpected or nonaccepted history, preserve digest and
  exact account/selection/Goal/graph/lineage checks, and require zero prohibited or
  foreign effects. Retirement still appends only the exact protected revoke and
  archives only the exact retained selection under one BEGIN/COMMIT transaction;
  exact successful replay remains a no-op and later entitlement lineage fails closed.
- Revised hashes: post-smoke
  `5ae171d262ecd77f0caa2bf5e975da03572f3bfa7f609bc9aebdd52e6f9fc38d`;
  retirement
  `9f5bd64325f65afe11b6bf42f769452d0050cc46b8d544f9f8c249d163d8208f`;
  post-retirement
  `90c6ac1baa87af1c56b6087c9e2fa81f396a209b2f21edf0e2beb61ce6e0f084`.
  Preflight/setup hashes remain unchanged.
- Fresh local verification: retained static contracts **9/9 PASS**; strict TypeScript
  **PASS**; targeted ESLint with zero warnings **PASS**; `git diff --check` **PASS**.
  Static checks are not deployed/server behavior proof; no PostgreSQL parser/server
  execution was performed.
- Next checkpoint: owner first approves and runs only revised SELECT-only post-smoke
  hash and requires `retained_smoke_acceptance_pass=true`; only then separately
  approves the exact v1.1 retirement hash. Post-retirement SELECT-only verification
  follows retirement. No SQL was executed and no Supabase, production, push, deploy
  or append-only cleanup occurred. All PARKED blockers remain PARKED.

## Adaptive Nutrition read-only entry foundation — 2026-09-22

- Current HEAD remains `b079cf9f605c64f634613e2fad2d35aececcfa3c`; production remains on that
  commit. This package is local and uncommitted. No SQL was applied, and no push,
  deploy, production environment or Supabase data changed.
- Added independent build-time gate `VITE_ADAPTIVE_NUTRITION_READ_V1`, default OFF.
  Existing `VITE_ADAPTIVE_NUTRITION_RUNTIME_V1` remains the independent mutation
  gate, also default OFF. Read/lookup RPC methods use only the read gate; mutation
  dispatch still requires the mutation gate. A targeted regression proves read ON +
  mutation OFF makes no mutation RPC call.
- Prepared runnable-but-not-applied STAGING discovery draft
  `docs/premium/drafts/20260922_adaptive_nutrition_read_only_entry_v1.sql`, SHA-256
  `9ae90f023875bde8dd86fc99cff1c63c8b9860a48fb1d07b8ef75f3b411ed580`.
  It derives the actor from `auth.uid()`, validates IANA timezone, derives the local
  Monday anchor, requires verified Premium, selects only own active
  `contract_version=1` rows, excludes retained-smoke lineage, returns explicit
  no-plan/ambiguous states, grants EXECUTE only to authenticated, and performs no
  plan/data creation or mutation.
- Added an isolated client discovery/current-read service and an account-bound
  controller with generation checks. It accepts no client account override, storage
  selection override or retained-smoke identity. Discovery/read disagreement,
  archived/multiple results and late account responses fail closed.
- `TodayEntry` now has a dormant route for server-verified Premium + read gate ON:
  discovery -> authoritative current read -> read-only 7-day UI. Free, demo Premium
  and verified Premium with read gate OFF keep existing legacy behavior. A verified
  Premium account with no active selection sees `Персональный недельный план ещё не
  создан`; it does not receive a demo plan or auto-created plan.
- Read-only weekly mode keeps Monday-Sunday navigation and server plan cards while
  removing SKIPPED, UNDO, REPLACE, FACT and extra-food controls. It imports no
  mutation controller and exposes no mutation method. Historical smoke configuration
  now requires the read gate explicitly as well as its separate smoke/mutation gates.
- Fresh verification: focused entry/runtime/security tests **123/123 PASS**;
  retained/disposable static smoke contracts **16/16 PASS**; strict TypeScript
  **PASS**; targeted ESLint with zero warnings **PASS**; production build **PASS**;
  `git diff --check` and cached diff checks **PASS**; index empty; all **229/229
  baseline owner hashes and statuses unchanged**. Build emitted only the existing
  browser-data age, mixed `mealService` import and chunk-size warnings.
- Next owner checkpoint: review and separately approve applying the exact discovery
  SQL hash to STAGING, followed by authenticated read-only acceptance. Only after
  deployed discovery evidence and a real non-smoke active weekly selection exist can
  a separate STAGING read-gate activation be reviewed. Production read activation
  remains a later explicit checkpoint; mutation/FACT/REPLACE stay OFF.
- Canonical food export, recipe atomic metadata and recipe expansion remain
  **PARKED**. Goal/plan generation, selection auto-create, FACT/diary writes,
  replacement-offer production, payment and service-role provisioning remain absent
  or out of scope.

## Adaptive Nutrition read-only entry STAGING acceptance package — 2026-09-22

- Current HEAD remains `b079cf9f605c64f634613e2fad2d35aececcfa3c`. The package is local and
  uncommitted. No SQL was executed, and no Supabase, production, commit, push,
  deploy, feature flag or persisted data changed.
- Reverified the unchanged discovery draft at
  `docs/premium/drafts/20260922_adaptive_nutrition_read_only_entry_v1.sql`, SHA-256
  `9ae90f023875bde8dd86fc99cff1c63c8b9860a48fb1d07b8ef75f3b411ed580`.
  Static review confirms `auth.uid()` is the only account authority, fixed-search-path
  SECURITY DEFINER execution, verified-Premium enforcement, local Monday week
  binding, active v1 ownership filtering, retained-smoke/archived exclusion, explicit
  zero/one/multiple outcomes, SELECT-only body and authenticated-only EXECUTE. It
  grants no mutation RPC and performs no auto-create or data write.
- Added SELECT-only preflight
  `docs/premium/drafts/20260922_adaptive_nutrition_read_only_entry_v1.preflight.sql`,
  SHA-256 `154a4197220f9ecd1aca6b862011c9e5f2b8355d65452dee7ea690dd6de82ad1`.
  It requires discovery to be absent before apply and checks entitlement, persistence,
  read RPC, selection columns/index/constraints, RLS/FORCE RLS, immutable guards and
  grants. The Supabase project ref remains an explicit Dashboard/operator assertion;
  PostgreSQL metadata alone cannot prove it.
- Added rollback-only behavioral acceptance
  `docs/premium/drafts/20260922_adaptive_nutrition_read_only_entry_v1.behavioral-acceptance.sql`,
  SHA-256 `05f6626dd6fdedd117426ae2e52f1791fa3cef2ff690c613db46348d60ea5a57`.
  It uses only preverified auth accounts `d6eb4e97-90d0-470f-bc4a-2f3e401e1fde`
  (Premium fixture) and `8f82ff67-39d1-4bb1-9d55-028af99d5cca` (Free/foreign
  fixture), fails closed if either has conflicting state, creates all fixture rows in
  one `BEGIN` transaction and ends with mandatory `ROLLBACK`. It does not use the
  retained smoke account, invoke grant/revoke, mutation/read/lookup runtime RPCs, or
  create canonical food, recipe, FACT, diary, meal-selection or replacement-offer
  rows.
- Behavioral cases cover missing auth actor, invalid timezone, Free denial, literal
  zero-selection `no_active_plan`, foreign/archived/retained-lineage/wrong-week/
  wrong-timezone exclusion, exact one-selection `ready`, exact owner binding and
  absence of discovery side effects. The deployed unique active-week index makes two
  eligible selections structurally unreachable: acceptance proves a second insert
  raises `unique_violation`, keeps the first row intact, and verifies the deployed
  function retains the defensive `v_match_count > 1 -> ambiguous` branch. It does not
  weaken/drop that invariant merely to manufacture an ambiguous runtime state.
- Added SELECT-only rollback residue check
  `docs/premium/drafts/20260922_adaptive_nutrition_read_only_entry_v1.postcheck.sql`,
  SHA-256 `089d3cf816b11738a7caf07b74f57e92cd9c4b62ded7778c6d91915fd23e5a5c`.
  It checks exact fixture accounts/markers have zero residue while the discovery RPC
  remains deployed.
- Fresh local verification: acceptance/static contracts **12/12 PASS**; complete
  relevant read-entry/runtime/security set **131/131 PASS**; strict TypeScript
  **PASS**; targeted ESLint with zero warnings **PASS**; production build **PASS**.
  Build emitted only the existing browser-data age, mixed `mealService` import and
  chunk-size warnings. `git diff --check` and cached diff checks **PASS**; index is
  empty; all **229/229 baseline owner hashes and statuses are unchanged**. No local
  PostgreSQL parser/server was available, so no parser or deployed-behavior PASS is
  claimed.
- Exact next safe task is owner-authorized execution of the SELECT-only preflight on
  STAGING `ozidryfvhkcbtpnulakq` and return of its complete result. Applying the
  discovery draft and running rollback-only acceptance remain later, separate owner
  checkpoints. All PARKED blockers remain PARKED.

## Adaptive Nutrition read-only entry behavioral acceptance v1.1 — 2026-09-22

- Owner-provided STAGING evidence: the applied discovery contract was reached, but
  rollback-only behavioral acceptance stopped after `SET LOCAL ROLE authenticated`
  with `ERROR 42501: permission denied for table
  potok_read_entry_acceptance_config`. No discovery/schema/client/gate change was
  required for this harness-only failure.
- Prepared a minimal local repair in
  `docs/premium/drafts/20260922_adaptive_nutrition_read_only_entry_v1.behavioral-acceptance.sql`:
  `GRANT SELECT ON TABLE pg_temp.potok_read_entry_acceptance_config TO authenticated`.
  This is the only GRANT in the executable harness, gives no write privilege, affects
  no permanent relation or public-schema ACL, and disappears with the temp table at
  mandatory final `ROLLBACK`.
- Reviewed every `postgres -> authenticated -> postgres` transition. Only the config
  temp table is referenced while authenticated (two DO blocks); the effect-baseline
  temp table is read only after `RESET ROLE`, so it needs no grant. The harness still
  has one `BEGIN`, no `COMMIT`, the same two fixture accounts/cases, no mutation/FACT/
  REPLACE call and mandatory final `ROLLBACK`.
- New behavioral acceptance SHA-256:
  `ab427b2aa1673eeb20552c14b8db3b9d97112b3e8599e1e8034c80681fbc749d`.
  Applied discovery draft remains byte-identical at
  `9ae90f023875bde8dd86fc99cff1c63c8b9860a48fb1d07b8ef75f3b411ed580`.
  SELECT-only postcheck remains byte-identical and valid at
  `089d3cf816b11738a7caf07b74f57e92cd9c4b62ded7778c6d91915fd23e5a5c`.
- Targeted static contracts **13/13 PASS**; strict TypeScript and targeted ESLint with
  zero warnings **PASS**; `git diff --check` and cached diff check pass; index remains
  empty; **229/229 owner baseline files are unchanged**. No SQL was executed by
  Codex; no commit, push, deploy, production or Supabase mutation occurred. All
  PARKED blockers remain PARKED.
- Exact next checkpoint: separate owner approval to execute only the repaired
  rollback-only behavioral acceptance v1.1 on STAGING, followed by the unchanged
  SELECT-only postcheck.

## Adaptive Nutrition read-only entry behavioral acceptance v1.2 — 2026-09-22

- Owner-provided STAGING evidence: v1.1 passed the temp-config ACL point but failed
  inside `$premium_zero_selection$` with `ERROR 42501: permission denied for table
  adaptive_nutrition_operations`. The unchanged SELECT-only postcheck subsequently
  reported `read_entry_acceptance_rollback_clean=true`, zero fixture/residue counts
  and `discovery_still_applied=true`. This confirms a harness assertion-boundary
  defect, not a discovery RPC defect.
- Prepared a minimal local v1.2 harness repair. Removed the now-unnecessary temp-table
  SELECT grant. The authenticated zero-selection block now calls only
  `adaptive_nutrition_discover_current_v1` and checks its returned JSON; operations,
  graph, event and diary state checks run in a new owner block after `RESET ROLE`.
  The ready block likewise no longer reads temp/permanent tables: expected transaction
  values are bound before role transition, the returned RPC fields are checked while
  authenticated, and exact selection/account ownership is checked by postgres after
  `RESET ROLE`.
- Audited all nine `SET LOCAL ROLE authenticated` segments. Each invokes discovery
  and checks only its returned value; none reads `public`, `potok_control`,
  `potok_nutrition`, `pg_temp`, either temp fixture table, or performs a write/grant.
  No permanent/table SELECT privileges were added.
- The harness retains one `BEGIN`, zero `COMMIT`, mandatory final `ROLLBACK`, the same
  fixture accounts and denied/no-plan/ready/exclusion coverage, the unique-index
  ambiguity invariant, and no mutation/FACT/REPLACE RPC. New behavioral acceptance
  SHA-256: `d3869387d37435e7c84cc7d991456bd3910713abe7bffbf6f9de4a18f23bbd1d`.
- Applied discovery remains byte-identical at
  `9ae90f023875bde8dd86fc99cff1c63c8b9860a48fb1d07b8ef75f3b411ed580`.
  The postcheck contract remains byte-identical and valid at
  `089d3cf816b11738a7caf07b74f57e92cd9c4b62ded7778c6d91915fd23e5a5c`.
- Targeted static contracts **13/13 PASS** and the explicit nine-segment privilege
  audit **9/9 PASS**; strict TypeScript, targeted ESLint with zero warnings and diff
  checks **PASS**; index is empty; **229/229 owner baseline files are unchanged**.
  No SQL was executed by Codex; no commit, push, deploy, production, schema, RLS,
  grant, client or feature-gate change occurred. All PARKED blockers remain PARKED.
- Exact next checkpoint: owner approval to execute only rollback-only behavioral
  acceptance v1.2 on STAGING, followed by the unchanged SELECT-only postcheck.

## Adaptive Nutrition owner development visibility — 2026-09-23

- Goal/Plan Engine development remains stopped. Current worktree is
  `/Users/urijurij/Desktop/POTOK/.worktrees/workout-muscle-map-foundation`, branch
  `master`, HEAD `b079cf9f605c64f634613e2fad2d35aececcfa3c`. No commit, push, deploy, SQL,
  Supabase write or production flag change occurred.
- Exact legacy cause: ordinary `/today` has no preview query; local `.env.local` and
  `.env.staging.local` contain no `VITE_ADAPTIVE_NUTRITION_READ_V1`, so the independent
  read gate is OFF. With no active smoke config and no DEV preview query,
  `TodayEntry` reaches legacy `<Today />`, whose local `demoPlans` provide the four
  14-day cards. No email/account special case exists or was added.
- Existing DEV-only `/today?weeklyPreview=demo` was close but insufficient: it used
  the shared `NutritionWeekPreview` and seven-day data, yet exposed local consumed,
  SKIPPED, extra-food and adaptation intent controls. Prepared the minimal local fix:
  the query route passes a `readOnly` display contract to the same shared component;
  read-only mode hides all meal intents, extra food and day adaptation controls and
  cannot enter `AdaptiveNutritionRuntimeWeekPreview` even if a mutation environment
  flag were accidentally present. Normal preview behavior remains available to its
  existing explicit callers.
- The preview remains behind `import.meta.env.DEV === true`, inside the existing
  authenticated/Premium route. It does not use email as authority, bypass verified
  server entitlement, create a selection, read the retired fixture or call Supabase.
  Production build inspection found no DEV query lookup, `local-demo-v1` or
  `unvalidated-demo`, so GitHub Pages cannot activate this path.
- Exact owner route after login: `http://localhost:5173/today?weeklyPreview=demo`.
  The existing Vite process PID `58945` runs from this exact worktree and returned
  HTTP 200; served HMR modules contain the DEV guard, read-only route and runtime
  exclusion. The browser-control surface was unavailable, so no authenticated browser
  action was performed; rendered UI behavior is covered by the targeted React test.
- Local visibility delta: `src/components/NutritionWeekPreview.tsx`,
  `src/pages/Today.tsx`, and
  `src/pages/__tests__/TodayNutritionWeekPreview.test.tsx`. Focused tests **18/18
  PASS**; strict TypeScript and targeted ESLint with zero warnings **PASS**;
  production build **PASS**; diff/index checks and visibility-diff secret scan
  **PASS**; index empty; **229/229 owner baseline files unchanged**. Existing build
  warnings remain browser-data age, mixed `mealService` import and chunk size.
- Next checkpoint is owner visual review of the local URL. Mutation runtime, FACT,
  SKIPPED/UNDO, REPLACE, extra food and production activation remain OFF/unreachable.

## Premium entry routing fix — local only — 2026-09-23

- Normal application routing no longer exposes the fixed 14-day Premium UI. Free
  `/today` remains protected by `PremiumRoute` and resolves to `/paywall`; the Free
  no-goal dashboard no longer embeds `Today`. Explicit demo access resolves to
  `/today?weeklyPreview=demo` and renders the shared seven-day
  `NutritionWeekPreview` in strict read-only mode. Demo access is kept separate from
  verified Premium and is never accepted as server entitlement.
- Verified Premium now has one entry path. With the independent read gate enabled it
  performs authenticated discovery followed by authoritative current read and renders
  the seven-day read-only entry. Zero selection shows `Персональный недельный план ещё
  не создан`; discovery ambiguity and account-switch/late-response conditions remain
  fail closed. With the read gate disabled it shows a neutral unavailable state and
  never falls back to legacy or demo content.
- The fixed 14-day implementation remains as the explicitly named/deprecated
  `LegacyFixed14DayToday` export solely for isolated compatibility tests. `TodayEntry`
  has no path that renders it. There is no email/account special case. The paywall
  copy now describes an active Monday-Sunday week rather than 14 days.
- Read-only rendering hides consumed, extra-food, SKIPPED, UNDO, adaptation and
  REPLACE controls and cannot enter the mutation runtime component. FACT and diary
  writes, mutation runtime, replacement producer, plan generation and auto-create
  remain unavailable.
- Local owner verification uses ignored mode-600 `.env.development.local` with the
  protected STAGING URL/public anon configuration and only
  `VITE_ADAPTIVE_NUTRITION_READ_V1=true`; no service-role field or mutation flag is
  present. Vite PID `60220` is running from this worktree on port 5173. Exact routes:
  `http://localhost:5173/today`, `http://localhost:5173/paywall`, and explicit demo
  `http://localhost:5173/today?weeklyPreview=demo` all return HTTP 200.
- Fresh verification after the routing change: targeted entry/security/runtime set
  **135/135 PASS**; strict TypeScript **PASS**; targeted ESLint with zero warnings
  **PASS**; production build **PASS**; diff checks **PASS**. Existing non-blocking
  output is limited to missing Supabase env notices in isolated tests, React SSR
  `useLayoutEffect` test warnings, stale browser-data notices, the mixed
  `mealService` import warning and the existing large-chunk warning. Scoped secret
  scan is clean, index is empty, the local env is ignored/untracked/unstaged, and all
  **229/229 owner baseline files remain unchanged**.
- Production/default env inputs contain none of the Adaptive read, mutation or smoke
  activation values. This verified local package is the exact scope of the
  owner-authorized selective commit; push, deploy, SQL, Supabase writes and production
  flag changes remain prohibited. Legacy fixed-14-day physical deletion remains
  **LATER**. The next implementation task after the local checkpoint is Goal/Plan
  Engine foundation.

## Goal/Plan Engine foundation v1 — review package — 2026-09-23

- Current HEAD is `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`. This package is
  uncommitted and not applied. No push, deploy, SQL execution, Supabase write,
  production flag change or runtime activation occurred.
- Added the PROPOSED architecture contract at
  `docs/premium/goal-plan-engine-foundation-v1.md`. Provisioning is an explicit
  authenticated/user-confirmed command after server-verified Premium and an own
  revisioned Goal; login, entitlement grant, discovery and read remain side-effect
  free. Inputs are only IANA timezone and UUID idempotency key; account, Monday week,
  Goal revision and all result revisions are server-derived.
- Selected the honest pre-generation state: one authoritative
  `pending_generation` weekly identity with `plan_revision=null`, exact Goal revision,
  generated lineage and durable settled receipt. It creates no graph, meal, recipe,
  canonical food, event, FACT, diary, shopping, SKIPPED/UNDO or REPLACE state. Current
  discovery therefore continues to return `no_active_plan` until a separately
  validated graph is atomically created and activated; no demo/legacy fallback.
- Reuse is limited to `user_goals`, `user_premium_plan_selections`,
  `adaptive_nutrition_operations`, the future graph table and existing read
  foundation. No new table is needed. The applied selection constraints cannot
  represent a graph-free v1 instance, so a minimal schema/RPC draft is required.
- Added the runnable-but-not-applied review draft
  `docs/premium/drafts/20260923_adaptive_nutrition_plan_provision_v1.sql`, SHA-256
  `7839dedb8adcb784de92971d48089c1c12e52313c1b7cbc307a1d9bbd5a9245e`.
  It adds `pending_generation`, permits null plan revision only in that state,
  strengthens the v1 week index to one immutable identity across every status and
  adds a fixed-search-path, authenticated-only provisioning RPC. Exact replay is
  checked before entitlement; a new paid effect after expiry/revoke is denied.
- Lifecycle contract: Monday never causes a hidden write; next-week provisional is
  permitted later but not created here; timezone never rewrites an existing identity;
  Goal change never rewrites a started week. Active Goal changes require a future
  proposal/confirmation plus immutable graph revision, while a stale pending Goal
  requires a separate explicit rebase operation.
- Added `scripts/contracts/adaptive-nutrition-plan-provision-v1.test.ts`. Fresh
  targeted static tests **14/14 PASS**, strict TypeScript **PASS**, targeted ESLint
  with zero warnings **PASS**, SQL tag/transaction static checks and `git diff
  --check` **PASS**. No local PostgreSQL parser or server behavior PASS is claimed.
  Index is empty and **229/229 baseline owner paths remain byte/status identical**.
- OPEN/PARKED: canonical food export, validated canonical recipe source, recipe atomic
  metadata and recipe expansion. Persisted nutrition preferences and authoritative
  training schedule/load are not confirmed, so neither is a v1 required input.
- Exact next safe checkpoint: owner review/approval of explicit provisioning,
  `pending_generation`, immutable one-instance-per-week identity, and no silent
  Monday/timezone/Goal rewrite. After approval, prepare SELECT-only STAGING preflight
  and rollback-only behavioral acceptance for the exact SQL hash above. SQL apply and
  client CTA/transport remain later separate checkpoints.

## Goal/Plan provisioning v1 acceptance package — 2026-09-23

- Owner approved explicit authenticated provisioning, graph-free
  `pending_generation` with null plan revision, one immutable identity per
  account/week/version and no silent Goal/timezone/Monday rewrite. Architecture status
  now records **PRODUCT CONTRACT APPROVED / SERVER SQL NOT APPLIED**.
- Owner-approved UX requirement remains **LATER**: after real client wiring, a pending
  instance must render a distinct `План формируется` equivalent and must not be
  collapsed into `Персональный недельный план ещё не создан`. No client CTA/UI/runtime
  change was made in this package.
- Main review SQL remains byte-identical:
  `docs/premium/drafts/20260923_adaptive_nutrition_plan_provision_v1.sql`, SHA-256
  `7839dedb8adcb784de92971d48089c1c12e52313c1b7cbc307a1d9bbd5a9245e`.
- Added SELECT-only STAGING preflight
  `docs/premium/drafts/20260923_adaptive_nutrition_plan_provision_v1.preflight.sql`,
  SHA-256 `57a02a72ca7f00b7531ba80bd1591983f091f1b489f8c71c411cbd0c0e749757`.
  It checks trusted entitlement v2, protected Goal revision, current selection
  constraints/index, no all-state v1 duplicates, v0 compatibility, operation/graph
  foundation, discovery/read RPCs, provisioning absence, current grants, selection
  RLS state, FORCE RLS internal tables and immutable/profile/selection guards. It
  returns one `ready_for_plan_provision_v1_apply` verdict and performs no write.
- Added rollback-only behavioral acceptance
  `docs/premium/drafts/20260923_adaptive_nutrition_plan_provision_v1.behavioral-acceptance.sql`,
  SHA-256 `741adc340ab3681eb91be9cc6a3f51832f4794315f667666428ee8811f955b04`.
  It uses only previously verified empty STAGING Auth accounts
  `d6eb4e97-90d0-470f-bc4a-2f3e401e1fde` and
  `8f82ff67-39d1-4bb1-9d55-028af99d5cca`, has one BEGIN/no COMMIT/final ROLLBACK,
  adds no permanent grant, and keeps every authenticated segment limited to the
  provisioning RPC plus returned-JSON assertions.
- Acceptance covers missing auth, expired/effectively-Free denial despite a stale
  true flag, Premium without Goal, invalid timezone/null key, initial pending
  selection and one receipt, exact replay, same-key mismatch, different-key same-week
  convergence, immutable timezone conflict, Goal revision drift without selection
  rewrite, revoke denial with original replay, all-state uniqueness including archived
  identity, retained-smoke blocking and zero graph/event/FACT/diary/meal/offer writes.
  Internal assertions execute only after RESET ROLE as postgres.
- Added SELECT-only rollback postcheck
  `docs/premium/drafts/20260923_adaptive_nutrition_plan_provision_v1.postcheck.sql`,
  SHA-256 `b566985491adf54310147aaf385f1cd6b5870db5f57fe5a4156c08adcc5e834d`.
  It requires zero fixture account and marker residue while the provisioning RPC
  remains applied.
- Static contracts **25/25 PASS**; strict TypeScript **PASS**; targeted ESLint with
  zero warnings **PASS**; SQL transaction/tag/role-boundary checks and diff checks
  **PASS**; index empty. No local PostgreSQL parser/server is available, so no parser
  or deployed behavior PASS is claimed. All **229/229 baseline owner paths remain
  byte/status identical**.
- Nothing was executed in Supabase. No commit, push, deploy, graph generation,
  FACT/REPLACE/mutation, client CTA or production change occurred. PARKED canonical
  food/recipe and recipe metadata/expansion blockers remain PARKED.
- Exact next checkpoint: owner authorization to run only the SELECT-only preflight on
  STAGING `ozidryfvhkcbtpnulakq` and return its complete single-row output. SQL apply
  and rollback-only acceptance remain later separate approvals.

## Pending-generation read state and UI — local, not applied — 2026-09-23

- Owner-confirmed live STAGING baseline: trusted weekly provisioning v1 is deployed,
  semantically matches the reviewed contract, rollback-only behavioral acceptance
  reached its final `ROLLBACK`, and its SELECT-only postcheck returned zero residue
  with `provisioning_still_applied=true`. Production remains untouched.
- The current discovery RPC is active-only, so an own current-week
  `pending_generation` identity currently collapses to `no_active_plan`. Prepared a
  bounded `CREATE OR REPLACE FUNCTION` draft that preserves `auth.uid()` ownership,
  verified Premium, current local Monday/timezone binding, retained-smoke exclusion,
  defensive ambiguity and the existing active `ready` DTO. Pending returns only
  selection/week/timezone/status/contract/Goal-revision metadata and no graph payload.
- Client discovery now decodes that exact strict pending DTO. The read-only entry
  terminates before `adaptive_nutrition_read_v1`, retains account-switch/late-response
  protection and renders `Персональный недельный план формируется` without week cards,
  progress, demo/legacy fallback or mutation controls. Active and `no_active_plan`
  paths remain unchanged; read and mutation gates remain independent and default OFF.
- Review artifacts, all **NOT APPLIED**:
  `20260923_adaptive_nutrition_pending_generation_read_v1.sql`, SELECT-only preflight,
  rollback-only behavioral acceptance and SELECT-only postcheck under
  `docs/premium/drafts/`. The acceptance uses only transaction-local synthetic state,
  calls discovery only under `authenticated`, verifies pending/active/no-plan,
  Premium/ownership/retained-lineage boundaries and finishes with `ROLLBACK`.
- Exact SHA-256 values: apply draft
  `2f801862d7f49dd2eaeabd168417bc9fdde9c2b2b4ad3c2be22bf3e2ac76c839`;
  preflight `014e64ed7a711b3a18fca1bd6f874394de44ea04e54e69e45d341e036ddaca72`;
  behavioral acceptance
  `0a44db39c143188a3e8d740a43d09e674768ad3ab00166e5bb9d4cd6f4c46b`;
  postcheck `01fa1177b1e632da16795eba906cebb765249f3021f8a45b92b0176d8e32db9c`.
- First owner-run preflight returned every prerequisite true except
  `all_state_week_unique`. Existing deployed-state evidence already proves the named
  index is unique/valid/ready/live btree on exact ordered keys
  `(user_id, week_anchor)` with sole predicate `contract_version = 1`; the false result
  was exact `pg_get_expr` parentheses/formatting sensitivity. Classification:
  **INDEX_SEMANTICALLY_CORRECT_PREFLIGHT_TOO_STRICT**. Added SELECT-only index audit
  `20260923_adaptive_nutrition_pending_generation_read_v1.index-audit.sql`, SHA-256
  `779212db046ce0ed52ac3f8ff8b9401b47c24f7d682fc336c3bf660f628586c1`.
  The repaired preflight now checks btree, all four index state flags, exact key count
  and ordered column array, then normalizes only whitespace/parentheses in the sole
  predicate. Apply SQL remains byte-identical.
- Fresh local verification: relevant targeted regression **56/56 PASS**; strict
  TypeScript **PASS**; targeted ESLint with zero warnings **PASS**; production build
  **PASS**. Build output contains only the existing stale browser-data, mixed
  `mealService` import and large-chunk warnings.
- No Supabase execution, commit, push, deploy, production flag, FACT/diary,
  SKIPPED/UNDO, replacement, payment, canonical food/recipe or persistent graph action
  occurred. Next external checkpoint is owner authorization to run only the exact
  SELECT-only preflight; SQL apply and rollback-only acceptance require later separate
  approvals.

## Goal / Plan Engine architecture audit — 2026-09-23

- Completed a focused repository/schema audit at HEAD
  `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`; findings are recorded in
  `docs/premium/goal-plan-engine-architecture-audit-v1.md`. This was documentation
  only: no SQL execution, Supabase write, commit, push, deploy, production flag,
  fixture, FACT/diary or replacement action occurred.
- Reusable authoritative inputs are the own revisioned `user_goals` row, trusted
  Premium predicate, server-derived timezone/Monday binding and durable idempotency
  key. Persisted nutrition preferences/allergies and detailed training context are not
  confirmed server inputs. Client/localStorage Goal data cannot authorize generation.
- Reusable persistence is `user_premium_plan_selections`,
  `adaptive_nutrition_operations`, immutable graph revisions/events and the applied
  discovery/read contract. Existing read UI requires one active seven-day graph with
  stable slot and snapshot/recipe/portion identities.
- Legacy `programGenerationService` and `aiMealPlansService` are separate client-side
  writers with unreviewed formulas/authorization/atomicity and are not suitable for
  trusted weekly provisioning. The Premium catalog has legacy plan/recipe display
  data but no confirmed immutable recipe/portion revisions or canonical ingredient
  completeness.
- Minimal architecture is two-phase: explicit authenticated provisioning creates one
  idempotent `pending_generation` weekly identity; a protected server worker later
  validates real curated/canonical content and atomically inserts one graph revision,
  advances the same selection to `active` and settles its receipt. Reads never create
  plans; activation writes no FACT, diary, event, replacement or shopping state.
- Safe work independent of canonical content is limited to the pending provisioning
  gate, pending UI state, graph-v1 schema/pure validators, execution DTOs and atomic
  activation design. Real recipe/portion choice, active graph generation and nutrient
  optimization remain **BLOCKED** by PARKED canonical food/recipe evidence, immutable
  recipe/portion metadata, preference/allergy policy and a trusted generator channel.
- Exact next checkpoint remains owner authorization to run only the prepared
  SELECT-only provisioning preflight on STAGING. Applying the pending RPC, its
  rollback-only acceptance, graph contract approval, generator authority and future
  activation SQL are separate checkpoints.

## Adaptive Nutrition Graph v1 contract — local only — 2026-09-23

- Added the exact immutable graph, recipe snapshot, component identity, Collection
  scaling and POTOK-assigned portion contract at
  `docs/premium/adaptive-nutrition-graph-v1.md`. Premium Recipe Collection selected
  servings remain presentation-only; Adaptive assigned portions are generator-owned
  graph state. Day/week planned totals are derived from immutable slot snapshots.
- Added pure strict validators and fixed-scale BigInt arithmetic in
  `src/utils/adaptiveNutritionGraphV1.ts`. Canonical Graph v1 uses exactly seven
  Monday-Sunday days, immutable UUID links, scale-3 decimal strings, ordered arrays,
  strict unknown-field rejection, canonical UTF-8 JSON and server-recomputable
  SHA-256 bytes. No runtime, Supabase, storage, UI or mutation wiring was added.
- The 120 recipe names remain **0/120 generator-ready**: stable recipe/revision and
  portion identities, base yield, canonical components, reproducible nutrition/fiber,
  reviewed classification and safety evidence are absent. The owner workbook is not
  present locally; the contract records a non-destructive four-sheet mapping and
  minimal proposed fields without changing or generating that workbook.
- Schema verdict: **EXISTING_SCHEMA_SUFFICIENT** for storage because the existing
  immutable JSONB graph revision envelope already provides revision, Goal, digest and
  operation linkage. Trusted generation/validation and atomic pending-to-active
  activation remain separate future boundaries and are not prepared or enabled here.
- Fresh targeted synthetic tests **17/17 PASS**; strict TypeScript **PASS**; targeted
  ESLint with zero warnings **PASS**. No SQL, Supabase call, commit, push, deploy,
  production change, FACT/diary/replacement/shopping/payment action or fake persistent
  recipe identity was created. All **229/229 owner baseline paths remain unchanged**.
- Owner finalized **HYBRID** for Adaptive assigned portions: continuous quantities
  scale decimal-safe and countable quantities must satisfy recipe-specific reviewed
  increments. Collection previews remain a separate proportional cooking contract and
  may show exact fractional pieces such as `0.250 piece`; they never create a recipe,
  portion revision or graph state. Targeted tests cover both valid Collection
  fractional pieces and Adaptive accept/reject increment behavior.
- Added `docs/premium/adaptive-nutrition-trusted-generator-activation-v1.md`. The local
  design defines server-built generator input/output DTOs, pinned Goal and catalog
  manifests, server canonical digest recomputation, entitlement and CAS rechecks,
  event-free atomic graph insert plus same-selection pending-to-active transition,
  durable receipt/replay behavior and full rollback. No SQL draft or runtime worker
  was created.
- Existing tables are sufficient for the minimal atomic transaction; a new protected
  internal activation function/service is required because the current plan-transition
  boundary always writes an event. Trusted execution/restart authority, exact Goal
  snapshot allowlist and real curated/canonical recipe/portion evidence remain OPEN.
- Exact next checkpoint: owner review of the generator DTO, event-free activation
  semantics, operation/receipt naming, locking/CAS order, Goal snapshot approach and
  trusted execution channel. Only after approval should a runnable-but-not-applied
  activation draft and acceptance plan be prepared.

## Trusted generator activation v1 — runnable local review package — 2026-09-23

- Owner approved Graph v1, distinct Collection proportional fractional-piece scaling,
  Adaptive HYBRID assigned portions, conceptual generator DTOs, event-free
  `PLAN_ACTIVATED`, exact lock/CAS order, exact Goal allowlisting and a protected
  durable server execution principle. The worker technology remains intentionally
  undecided. Status: **DURABLE_CHANNEL_REQUIREMENTS_READY**.
- `PotokAdaptiveGoalSnapshotV1` is now executable and exact: account ID, Goal revision,
  nullable verbatim `goal_type`, and positive calories/non-negative protein/fat/carbs,
  all scale-3. Fiber target, allergies/preferences, clinical data, authoritative
  training schedule/load and normalized Goal taxonomy remain blocked; unrelated
  Goal/profile/date/body/training fields are excluded from the activation snapshot.
- Added pure strict Goal/manifest/activation/receipt/replay contracts in
  `src/utils/adaptiveNutritionActivationV1.ts`, including deterministic canonical
  Goal/catalog/activation bytes, SHA-256, Graph/Goal/manifest binding, exact replay,
  mismatch conflict, snake-case SQL receipt decoding and the event-free effect list.
- Final design: `docs/premium/adaptive-nutrition-trusted-generator-activation-v1.md`.
  Existing tables/columns are sufficient. A future worker must durably preserve the
  input, idempotency key and proposed plan revision across restart, remain server-only
  and account-isolated, use bounded retries and auditable lineage, and receive only a
  separately reviewed narrow execution authority. No Edge Function/backend choice is
  made.
- Runnable-but-not-applied function draft:
  `docs/premium/drafts/20260923_adaptive_nutrition_plan_activate_v1.sql`, SHA-256
  `e6c99863ecbd34ca07010e88ac3376340a906b3c74295a72360c6697b674cfb9`.
  It adds only the protected fixed-search-path activation function, grants no runtime
  role, recomputes and compares Graph/manifest digests, rebuilds the locked Goal
  snapshot, enforces Premium/ownership/CAS/current-week/manifest/HYBRID rules, inserts
  one graph and advances the same pending selection atomically, then settles one
  accepted empty-event receipt. It writes no event/FACT/diary/replacement/shopping.
- SELECT-only preflight:
  `docs/premium/drafts/20260923_adaptive_nutrition_plan_activate_v1.preflight.sql`,
  SHA-256 `a41d1fe48cc3e2b77ad9e48b687ec0b16fd956cad3b08b43b500a0dfd50c7b25`.
  It checks the expected schema, entitlement/provisioning/read foundation, columns,
  all-state week uniqueness, deferred FKs, RLS/FORCE, immutable guards and absence of
  a conflicting activation function. Its explicit external real-recipe gate is false,
  so `ready_for_plan_activate_v1_apply` cannot be true in this package.
- Rollback-only acceptance draft:
  `docs/premium/drafts/20260923_adaptive_nutrition_plan_activate_v1.behavioral-acceptance.sql`,
  SHA-256 `a0fff41fc3053e35f15e53a04554f4b60b79c7619030c04cd55d6a4d35c234e2`.
  It has one BEGIN/no COMMIT/final ROLLBACK, uses two previously verified empty Auth
  fixture accounts, creates no recipe/canonical rows, and covers Premium activation,
  exact stored graph/digest/receipt, unchanged selection ID, exact replay, uniqueness/
  stale CAS and zero event/diary/meal/offer effects. Fail-closed cases cover expired
  Free, foreign selection, active/archived, stale Goal, changed timezone/week, bad
  digest/shape, non-manifest recipe, invalid increment, changed same-key payload,
  retained smoke lineage and replay/new-effect behavior after revoke.
- Fresh focused pure/static tests **32/32 PASS**; strict TypeScript **PASS**; targeted
  ESLint with zero diagnostics **PASS**. No PostgreSQL parser/server execution or DB
  behavioral PASS is claimed. SQL was not executed; Supabase was not contacted.
- **STAGING APPLY IS NOT ALLOWED.** It remains blocked until at least one real curated
  recipe passes stable identity, immutable recipe/portion revisions, canonical
  component identity, complete nutrition including fiber, reviewed base yield,
  reviewed HYBRID rules and generator eligibility. Canonical food/recipe and recipe
  metadata blockers remain PARKED. No commit, push, deploy or production change.

## Trusted generator activation authority repair — local only — 2026-09-23

- Owner review found two real defects in the preceding draft: comparing caller bytes
  with a caller digest did not prove canonicalization, and a manifest supplied by the
  generator made recipe authorization circular. That preceding hash must not be
  applied. No Supabase or SQL execution occurred during this repair.
- Exact Graph byte authority is now a separately protected trusted canonical-validator
  service boundary. It reuses the raw recursive duplicate-key scanner before
  `JSON.parse`, strict-decodes the exact Graph v1 envelope, reconstructs bytes with
  `encodeAdaptiveNutritionGraphCanonicalV1`, rejects noncanonical raw bytes and
  computes SHA-256 itself. Caller digest fields are rejected by the strict DTO.
  PostgreSQL adds duplicate-key/shape defense and computes the received-byte digest;
  it is not claimed to reproduce the Graph serializer.
- Catalog audit verdict: **CATALOG_MANIFEST_AUTHORITY_NEEDS_NEW_STORAGE**. Mutable
  legacy recipe/catalog rows do not prove immutable recipe/portion/eligibility
  revisions or historical snapshots. The repaired draft adds one protected,
  append-only `potok_nutrition.adaptive_catalog_manifests_v1` table with canonical
  bytes/digest/evidence, RLS+FORCE, application-role revokes and immutable guards.
  It creates no publisher and grants no generator/application access.
- Activation now accepts Graph bytes plus `manifestRevision` only, no caller Graph
  digest, manifest bytes or manifest digest. After account lock, operation lookup,
  selection lock and Goal lock, it reads the exact published manifest `FOR SHARE`,
  verifies stored bytes/digest/snapshot integrity and independently enforces manifest
  membership/HYBRID rules. Generator and app roles cannot call the function; a future
  canonical-validator execution identity remains a separate review checkpoint.
- Repaired runnable-but-not-applied SQL:
  `docs/premium/drafts/20260923_adaptive_nutrition_plan_activate_v1.sql`, SHA-256
  `2410d6fe6d3a170bf606087ab5aae3e335e67f87616b19c6fe179808968cfbe8`.
  Repaired SELECT-only preflight SHA-256
  `62fb436f18e3835b42df3e93f31983f5ebe55c9c3d892264821cd7b366a413ca`;
  its real curated recipe gate remains deliberately false. Repaired rollback-only
  acceptance SHA-256
  `bd4951c133a0feab6e02f7c9aff91a51f1a1389dd287da5f0bd20ec1ff201fcd`.
- Acceptance now publishes only transaction-local synthetic manifest rows and covers
  raw duplicate keys, unpublished manifest revision, corrupt stored digest, absent
  recipe, modified snapshot under valid IDs, HYBRID failure, DB-computed changed-byte
  idempotency conflict and the existing entitlement/CAS/replay/event-free cases. One
  BEGIN, no COMMIT, final ROLLBACK remain. Exact noncanonical serialization is covered
  by pure canonical-validator tests, not misrepresented as PostgreSQL proof.
- Fresh focused pure/static tests **38/38 PASS** after the final SQL/static update;
  strict TypeScript **PASS**; targeted ESLint with zero diagnostics **PASS**;
  production build **PASS** with only the pre-existing stale browser-data, mixed
  `mealService` import and large-chunk warnings. `git diff --check` and index checks
  pass; **229/229 owner baseline paths remain byte-identical**.
- Excel remains authoring-only. Required future path is reviewed compiler → canonical
  ingredient resolution → immutable recipe/portion/eligibility revisions → canonical
  manifest publication → generator read → activation re-read. No workbook import,
  real recipe IDs, publisher, worker credential or runtime wiring was added.
- **STAGING APPLY: NO.** Real curated/canonical recipe evidence, reviewed publication
  process, manifest publisher authority and a separated durable canonical-validator
  execution identity remain blockers. Canonical food/recipe and atomic recipe metadata
  dependencies stay PARKED. Index remains empty; no commit, push or deploy occurred.

## Curated Recipe Publication Foundation v1 — local only — 2026-09-24

- Added the pure authoring/readiness/compiler contract in
  `src/utils/curatedRecipePublicationV1.ts` and its review note in
  `docs/premium/curated-recipe-publication-v1.md`. Excel remains authoring-only;
  the seven current sheet names are mapped without restructuring. No workbook parser,
  publisher, persistence, network or Supabase path was added.
- Readiness is deterministic and fail closed. It separates Collection and Adaptive
  scopes while keeping canonical identity, complete reviewed nutrition including
  fiber, source evidence and safety review common. Collection may display exact
  fractional pieces; Adaptive continues to require HYBRID discrete increments.
- The compiler accepts only caller-supplied publication UUIDs and never mints or
  persists identities. A ready DTO compiles to strict `GraphRecipeSnapshotV1`,
  immutable recipe/portion/eligibility candidates and the exact existing
  `AdaptiveCatalogManifestRecipeV1` tuple. BigInt scale-3 arithmetic and the existing
  Graph/manifest decoders enforce nutrition sums, order and HYBRID compatibility.
- Repository audit found no exact local record or recipe-master workbook for
  `protein_tortilla_envelope_cottage_cheese_5_cheese_40`. Remembered prompt values
  were not treated as evidence. The vertical slice remains **BLOCKED** by missing
  reviewed source/nutrition/fiber/basis, canonical pointers/evidence, portion
  increments, tags and allergen/dietary evidence. No manifest tuple was produced.
- No schema change or SQL draft is needed for this pure phase. Persistent immutable
  recipe/portion/eligibility storage and protected manifest publication remain later
  review boundaries. The activation apply gate stays false and its SQL remains not
  applied.
- Fresh synthetic targeted tests cover complete compilation, manifest compatibility,
  Collection `0.250 piece`, Adaptive increment rejection and all requested blocker
  classes. Strict TypeScript, targeted ESLint, production build and diff/baseline
  checks are recorded in the final task report. No commit, push or deploy occurred;
  index remains empty and the 229 owner baseline is preserved.
- Exact next checkpoint: owner provides a reviewed, non-secret export of one recipe's
  existing workbook rows plus reviewed canonical-food evidence. Re-audit comes before
  any schema, publisher, manifest insertion or activation approval.

## Adaptive Meal Composition Contract v1 — local only — 2026-09-24

- Added the pure deterministic composition contract in
  `src/utils/adaptiveNutritionMealCompositionV1.ts`, its 16-case focused suite in
  `src/utils/__tests__/adaptiveNutritionMealCompositionV1.test.ts`, and the architecture,
  workbook-impact and boundary note in
  `docs/premium/adaptive-nutrition-meal-composition-v1.md`.
- Existing Graph v1 remains unchanged. Its slot pins one recipe/portion snapshot and
  cannot losslessly carry several recipe revisions. The new immutable, separately
  digested `MealSnapshotV1` is additive; a future reviewed Graph v2/additive envelope
  is required before composed meals can enter activation or runtime reads.
- V1 uses the exact eight reviewed roles `COMPLETE_MEAL`, `MAIN_PROTEIN`, `CARB_SIDE`,
  `VEGETABLE_SIDE`, `SALAD`, `EXTRA`, `SAUCE`, `BEVERAGE`. Completeness, companion
  sets, pairing, repeats, energy class and beverage class come from immutable reviewed
  eligibility metadata, never names or AI guesses.
- Composition is deterministic and fail closed: reviewed role patterns, one anchor,
  required companions, unique recipe revisions, bidirectional incompatibility checks,
  Adaptive HYBRID portion validation, BigInt scale-3 nutrition totals and hard maxima.
  Exact nutrition fit ranks first; Goal energy class only breaks equal scores.
- Caloric beverages are included in nutrition. A non-caloric beverage requires an
  explicitly reviewed all-zero nutrition snapshot. Premium Recipe Collection remains
  separate and keeps proportional fractional-piece presentation semantics.
- The authoritative workbook was not modified. Composition metadata should first be
  carried by the reviewed publication layer; role, completeness, companion/pairing,
  repeat, energy and beverage classification need content/owner review. The current
  120 names and recipe drafts are not promoted to generator-ready content.
- Fresh focused meal tests **16/16 PASS**; Graph/publication/meal relevant regression
  **43/43 PASS**; strict TypeScript **PASS**; targeted ESLint with zero diagnostics
  **PASS**; production build **PASS** with only existing browser-data, mixed
  `mealService` import and large-chunk warnings. Diff/whitespace and secret-pattern
  checks pass; git index is empty. No owner-baseline path was touched by this package,
  so the recorded **229/229 owner baseline remains preserved**.
- No SQL, Supabase, workbook write, generator/runtime activation, commit, push or
  deploy occurred. Canonical food/recipe and atomic recipe metadata blockers remain
  PARKED. Exact next checkpoint is review of this composition contract, followed by a
  representative owner-classified curated batch before any Graph/storage integration.

## Representative Meal Classification v1 — local review — 2026-09-24

- Read the current authoritative workbook
  `/Users/urijurij/Desktop/POTOK_recipe_master_v1_007.xlsx` without modifying it;
  SHA-256 remained
  `7bae79a23b93e74bb6e41341d6713a26dbc14aa4a24c546e03d7b4f6e1dbfb6f`.
  It contains 19 populated recipe rows: two explicit demonstration examples, twelve
  real DRAFT rows and five `READY_FOR_REVIEW` breakfast rows. There are no APPROVED
  rows; ingredient resolution is 160 UNRESOLVED / 1 AMBIGUOUS.
- Added the classification report
  `docs/premium/adaptive-nutrition-representative-meal-classification-v1.md`.
  Real evidence covers complete porridge/breakfast candidates, complete lunch/casserole
  candidates, a snack wrap, one unresolved salad classification and one caloric
  smoothie candidate. The workbook has no real reviewed standalone fish/cutlet/side,
  tofu/legume/hummus component or zero-calorie beverage; those contract probes remain
  explicitly SYNTHETIC/NAMES_ONLY and have no invented identities.
- Verdict: **ANCHOR_TAXONOMY_GAP_FOUND**. Complete recipes and animal-protein partial
  meals fit v1, but the rule limiting anchors to `COMPLETE_MEAL` or `MAIN_PROTEIN`
  forces artificial classification for hummus/toast/grain/dairy partial anchors. A
  complete caloric smoothie also cannot retain beverage semantics and be an anchor
  because v1 couples beverage role and completeness.
- Proposed, not implemented: generic `MAIN_COMPONENT`/`MEAL_ANCHOR`, orthogonal
  `anchorKind = COMPLETE | PARTIAL | NONE`, and orthogonal beverage class. Preserve
  exactly one anchor and require companion sets for partial anchors. Owner review is
  required before any contract/Graph code change.
- Recommendation: keep composition metadata in the publication eligibility layer
  now. Do not modify workbook columns/sheets. Role, anchor kind, companion/pairing,
  repeat, energy and beverage class require explicit content review and must not be
  inferred from names/macros.
- Focused existing composition tests were rerun for this review; final result is
  recorded in the task report. Git index remains empty; this package touched only the
  new report and this resume addition, outside the 229 owner baseline. No Supabase,
  SQL, workbook, Graph, runtime, generator, commit, push or deploy action occurred.

## Adaptive Meal Composition Contract v1.1 — local only — 2026-09-24

- Owner confirmed the representative anchor-taxonomy gap. The pure composition
  implementation in `src/utils/adaptiveNutritionMealCompositionV1.ts` now uses protocol,
  eligibility and canonical encoding IDs ending in `v1.1`; no runtime consumer is
  wired to it.
- Final minimal roles are `MAIN_COMPONENT`, `CARB_SIDE`, `VEGETABLE_SIDE`, `SALAD`,
  `EXTRA`, `SAUCE`, `BEVERAGE`. `COMPLETE_MEAL` and `MAIN_PROTEIN` role semantics were
  removed. Eligibility now carries independent
  `anchorKind = COMPLETE | PARTIAL | NONE` instead of `isCompleteMeal`.
- Exactly one non-NONE anchor is mandatory. COMPLETE has no required companions;
  PARTIAL requires reviewed companion sets and is complete only when every set is
  satisfied; NONE cannot declare companions. Role patterns no longer imply an anchor.
- Beverage class is orthogonal to anchor kind while remaining consistent with
  beverage role. A caloric smoothie can be `BEVERAGE + COMPLETE`; an optional drink is
  `BEVERAGE + NONE`. Caloric totals and all-zero non-caloric validation are unchanged.
- Added `docs/premium/adaptive-nutrition-meal-composition-v1-1.md`; marked the v1 note
  as superseded and the representative gap report as resolved by this local contract.
  The outer `MealSnapshotV1` shape remains stable; its nested eligibility uses
  `anchorKind`, and v1.1 canonical IDs prevent old bytes from being silently accepted.
- Focused v1.1 suite: **22/22 PASS**, including the fifteen owner-required representative
  cases. Graph/publication/composition relevant regression: **49/49 PASS**. Strict
  TypeScript and targeted ESLint pass; final build/diff checks are recorded in the
  task report.
- Graph v1 and the authoritative workbook are unchanged. No Supabase, SQL, workbook,
  Graph integration, generator activation, commit, push or deploy occurred. Real
  curated classification/publication and canonical recipe/food evidence remain the
  blockers before future Graph integration design.

## Curated recipes 6–15 — workbook write + local review — 2026-09-24

- Owner authorized an exact write of recipes 6–10 to the authoritative external
  workbook `/Users/urijurij/Desktop/POTOK_recipe_master_v1_007.xlsx`. A byte-for-byte
  pre-write backup was created at
  `/Users/urijurij/Desktop/POTOK_recipe_master_v1_007.backup-before-recipes6-10-2026-09-24.xlsx`.
  Source/backup SHA-256 was
  `7bae79a23b93e74bb6e41341d6713a26dbc14aa4a24c546e03d7b4f6e1dbfb6f`; verified
  post-write SHA-256 is
  `633ca82c86679c42d9f2aca89581a874ad94cacafa74c9b02d5ef9bc282c8606`.
- Exact written ranges: `01_Рецепты!A21:G25`, `I21:J25`, `L21:X25`;
  `02_Ингредиенты!A163:M191`; `03_Шаги!A91:G111`; `04_Теги!A36:D46`.
  Existing formulas in recipe columns H/K and every pre-existing owner cell were
  preserved. The seven-sheet structure, formula integrity, recalculated checks,
  workbook ZIP integrity and rendered recipe/ingredient/step/tag/check views passed.
- Recipes 6–10 are `READY_FOR_REVIEW` with the exact owner note
  `READY_FOR_OWNER_REVIEW; not APPROVED; not TEST_COOKED; not canonical-ready`.
  Cooked/serving yield fields remain NULL. The 29 new ingredient rows are all
  `UNRESOLVED`; USDA FDC is `REVIEWED_REFERENCE` only, with no canonical/stable/runtime
  identity created.
- Added the local, non-workbook review
  `docs/premium/curated-recipes-11-15-evidence-review-v1.md` for recipes 11–15. It
  records at least two culinary references where available, exact raw/edible bases,
  original POTOK steps, component-to-full-to-serving KBJU/fibre arithmetic,
  DISCRETE egg/bread handling, test-cooking uncertainties, goal candidates and
  proposed Meal Composition v1.1 metadata. These five recipes were not written to
  the workbook; their 28 proposed ingredient identities remain unresolved.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Diff/whitespace and scoped secret checks pass; the git index is empty.
  This package changed no path in the recorded 229-file owner baseline, so all
  **229/229 remain preserved**. Owner review is required before any write of
  recipes 11–15.

## Curated recipes 11–20 — workbook write + local review — 2026-09-24

- Owner authorized recipes 11–15 only. The actual current authoritative workbook was
  located at `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.xlsx`;
  its pre-write SHA-256 matched the prior recipes 6–10 output exactly:
  `633ca82c86679c42d9f2aca89581a874ad94cacafa74c9b02d5ef9bc282c8606`.
  A byte-identical backup is preserved beside it as
  `POTOK_recipe_master_v1_007.backup-before-recipes11-15-2026-09-24.xlsx`.
- Recipes 11–15 were written only to `01_Рецепты!A26:G30`, `I26:J30`, `L26:X30`;
  `02_Ингредиенты!A192:M219`; `03_Шаги!A112:G136`; and `04_Теги!A47:D59`.
  Composition v1.1 proposals were deliberately excluded from workbook cells. The
  final authoritative/output SHA-256 is
  `93b42c504e86b8bd1f8b1578bc32227170fc6aed9fe37268cb81edce7b322b2b`.
- Workbook verification passed: exact seven-sheet structure; all pre-existing owner
  cells and formulas unchanged; H/K formulas preserved; zero formula errors; ZIP
  integrity and rendered recipe/ingredient/step/tag/check ranges valid. Added counts:
  five recipes, 28 ingredients, 25 steps, 13 tags. All 28 added ingredients are
  `UNRESOLVED`; no canonical/stable/runtime/revision identity was created. Recipes are
  `READY_FOR_REVIEW`; yield fields remain NULL pending test-cooking.
- Added `docs/premium/curated-recipes-16-20-evidence-review-v1.md`. Recipes 16–20 were
  **not** written. The review contains exact formulations, independent culinary
  evidence, raw/edible bases, original POTOK steps, component/full/serving KBJU and
  fibre arithmetic, DISCRETE egg policy, test-cooking plans, goal candidates and
  Meal Composition v1.1 proposals. Its central open evidence item is the provisional
  Russian-style dry tvorog 5% authoring average; it is not canonical or an exact USDA
  FDC product. The 20 proposed ingredient rows remain unresolved.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. The git index remains empty. Task changes are outside the recorded
  229-file owner baseline, which remains **229/229 preserved**. Next checkpoint is
  owner review of recipes 16–20 and a separate explicit authorization before any
  workbook write.

## Curated recipes 16–25 — workbook write + local review — 2026-09-24

- Owner approved recipes 16–20 and the provisional authoring-only dry-tvorog 5%
  profile (121 kcal / P17 / F5 / C1.8 per 100 g). This remains
  `REVIEWED_REFERENCE`, not canonical production authority.
- Pre-write authoritative/backup SHA-256:
  `93b42c504e86b8bd1f8b1578bc32227170fc6aed9fe37268cb81edce7b322b2b`.
  Backup: `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes16-20-2026-09-24.xlsx`.
- Exact writes were limited to `01_Рецепты!A31:G35`, `I31:J35`, `L31:X35`;
  `02_Ингредиенты!A220:M237`; `03_Шаги!A137:G162`; and
  `04_Теги!A60:D69`. Final authoritative SHA-256:
  `02f8ae387e1e6d758696ed3eca946cd9b99c895a1d07a64a204bbc2dda169ad4`.
  Composition v1.1 metadata stayed outside the workbook.
- Verification passed: seven exact sheets, all existing owner values/formulas
  unchanged, H/K formulas present, zero formula errors, ZIP integrity and visual
  recipe/ingredient/step/check renders. Added: 5 recipes, 18 ingredients, 26 steps,
  10 tags. All 18 added ingredients remain `UNRESOLVED`; yield fields remain NULL.
  Workbook checks now show 32 recipes, 229 ingredients, 228 UNRESOLVED, 1 AMBIGUOUS
  and 156 preparation steps.
- Added `docs/premium/curated-recipes-21-25-evidence-review-v1.md`; recipes 21–25 were
  not written. It records independent sources, exact formulations, raw/dry/cooked
  bases, original POTOK steps, reproducible component/full/serving nutrition
  arithmetic, countable policies, test-cooking plans, goal candidates and v1.1
  composition proposals. Twenty-five proposed ingredient rows remain unresolved.
- Main review blockers for 21–25: recipe 23 still uses white-pita FDC only as a
  transparent nutrition proxy pending exact lavash evidence; recipe 24's 100%
  buckwheat batter and recipes 24/25 finished counts require test-cooking. No previous
  ingredient formulations existed in the repository, only approved names.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Git index remains empty and no recorded owner-baseline path was changed;
  **229/229 owner baseline is preserved**. Next checkpoint is owner content review of
  recipes 21–25 and separate write authorization.

## Curated recipes 21–30 — workbook write + local review — 2026-09-24

- Owner authorized the exact approved recipes 21–25 only. Pre-write authoritative
  SHA-256 was `02f8ae387e1e6d758696ed3eca946cd9b99c895a1d07a64a204bbc2dda169ad4`.
  A byte-identical backup was created at
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes21-25-2026-09-24.xlsx`.
- Exact writes were limited to `01_Рецепты!A36:G40`, `I36:J40`, `L36:X40`;
  `02_Ингредиенты!A238:M262`; `03_Шаги!A163:G187`; and
  `04_Теги!A70:D79`. Final authoritative SHA-256 is
  `9c1cf40cf0a3b9be04638a013de579819ec606e9872856d6f378109327eb58a5`.
  Recipes 1–20, owner cells, formulas, seven-sheet structure and demo/example content
  are unchanged. Composition v1.1 proposals remain outside the workbook.
- Workbook verification passed: exact append-range guard; five recipe rows; 25
  ingredient rows; 25 step rows; ten tag rows; H/K formulas present; zero formula
  errors; ZIP integrity; and visual recipe/ingredient/step/tag/check renders. The 25
  added ingredient identities are all `UNRESOLVED`; no stable/canonical/runtime or
  revision identity was written. Yield fields remain NULL. Recipe 23 retains the
  explicit white-pita nutrition proxy and `PUBLICATION_BLOCKED` marker.
- Added `docs/premium/curated-recipes-26-30-evidence-review-v1.md`. Recipes 26–30 were
  **not written**. The report contains independent culinary evidence, exact
  formulations and state bases, original POTOK preparation, component/full/serving
  KBJU and fibre arithmetic, test-cooking plans, goal candidates and Meal Composition
  v1.1 proposals. Twenty proposed ingredient rows remain `UNRESOLVED`; no IDs were
  invented. Recipe 29 is publication-blocked until an exact plain-hummus product or
  reviewed house formulation replaces the generic commercial-hummus reference.
- Open content decisions: approve/revise recipes 26–30; confirm recipe 28 as a
  one-serving savory breakfast rather than a side; choose the exact hummus basis for
  recipe 29. All five require measured test-cooking yield. A separate owner approval
  is required before any workbook write of recipes 26–30.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. The git index remains empty. Task edits are limited to the two curated
  review documents and this resume, outside the recorded owner baseline; **229/229
  owner baseline files remain preserved**.

## Curated recipes 26–35 — workbook write + local review — 2026-09-24

- Owner authorized the exact recipes 26–30. Pre-write authoritative/backup SHA-256
  was `9c1cf40cf0a3b9be04638a013de579819ec606e9872856d6f378109327eb58a5`.
  Byte-identical backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes26-30-2026-09-24.xlsx`.
- Exact writes were limited to `01_Рецепты!A41:G45`, `I41:J45`, `L41:X45`;
  `02_Ингредиенты!A263:M282`; `03_Шаги!A188:G211`; and
  `04_Теги!A80:D89`. Final authoritative SHA-256:
  `5a552a9073e8557f4647ceaffb79fb521c203e9e9daee9eb797764796becd7cd`.
  Recipes 1–25, owner cells, formulas, examples and seven-sheet structure are
  unchanged. Composition v1.1 proposals remain outside the workbook.
- Workbook verification passed: exact append guard; five recipe rows, 20 ingredient
  rows, 24 step rows and ten tag rows; H/K formulas; zero formula errors; ZIP
  integrity; and visual recipe/ingredient/step/tag/check renders. All 20 new
  ingredient identities are `UNRESOLVED`; no stable/canonical/runtime/revision ID was
  created. Yield fields remain NULL. Recipe 28 retains breakfast-only review use;
  recipe 29 retains its commercial-hummus proxy and `PUBLICATION_BLOCKED` marker.
- Updated `docs/premium/curated-recipes-26-30-evidence-review-v1.md` with the factual
  workbook lifecycle and added
  `docs/premium/curated-recipes-31-35-evidence-review-v1.md`. Recipes 31–35 were not
  written. Their review provides independent culinary sources, exact raw/dry bases,
  original POTOK steps, component/full/serving KBJU and fiber arithmetic,
  test-cooking uncertainties, goal candidates and composition v1.1 proposals.
  Twenty-two proposed ingredient rows remain unresolved.
- Material owner decisions before any write of 31–35: accept each formulation;
  decide whether recipe 31 is COMPLETE without a substantial non-starchy vegetable;
  confirm the long-grain white rice basis, wild rainbow trout basis and Atlantic cod
  basis. Canonical resolution and measured yield remain later blockers.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Git index is empty. The stored tracked owner-baseline diff remains
  byte-identical, and no owner-baseline path was touched; **229/229 remain preserved**.

## Curated recipes 31–40 — workbook write + local review — 2026-09-25

- Owner authorized recipes 31–35 only. Pre-write authoritative and byte-identical
  backup SHA-256:
  `5a552a9073e8557f4647ceaffb79fb521c203e9e9daee9eb797764796becd7cd`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes31-35-2026-09-25.xlsx`.
- Exact writes: `01_Рецепты!A46:G50`, `I46:J50`, `L46:X50` with H/K formulas;
  `02_Ингредиенты!A283:M304`; `03_Шаги!A212:G236`;
  `04_Теги!A90:D99`. Final authoritative SHA-256:
  `8a7c377e932f1e9faf8ede717df609a7cc9c69c6ef796948dbec877a4cb07682`.
- Verification passed: exact seven-sheet structure; all prior owner cells/formulas
  unchanged; five recipe rows, 22 ingredient rows, 25 steps, ten tags; H/K formulas;
  zero formula errors; ZIP integrity; rendered ranges; composition metadata excluded
  from workbook. All 22 added identities remain `UNRESOLVED`; yields remain NULL.
- Updated `docs/premium/curated-recipes-31-35-evidence-review-v1.md` to the factual
  written state. Added `docs/premium/curated-recipes-36-40-evidence-review-v1.md`;
  recipes 36–40 were not written. It contains exact raw/dry bases, culinary evidence,
  original POTOK steps, component/full/serving KBJU and fiber arithmetic,
  test-cooking plans, goal candidates and Meal Composition v1.1 proposals.
- Recipes 36–40 propose 27 unresolved ingredient rows. Material review points:
  Pacific whiting is only the authoring reference for hake; couscous is ordinary fine
  couscous, not pearl; barley is unsoaked with a 1:3 absorption method; rabbit uses
  300 g raw boneless edible domesticated-rabbit composite cuts (FDC 172521), never
  bone-in package weight. Canonical identities and finished yields remain unresolved.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy.
  Next checkpoint: owner content decisions for recipes 36–40 before any workbook
  write. PARKED canonical/recipe metadata blockers remain open.

## Curated recipes 36–45 — workbook write + local review — 2026-09-25

- Owner authorized the exact reviewed formulations for recipes 36–40. The current
  authoritative workbook was
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.xlsx`.
  Pre-write SHA-256 was
  `8a7c377e932f1e9faf8ede717df609a7cc9c69c6ef796948dbec877a4cb07682`;
  a byte-identical backup is preserved beside it as
  `POTOK_recipe_master_v1_007.backup-before-recipes36-40-2026-09-25.xlsx`.
- Exact writes were limited to `01_Рецепты!A51:G55`, `I51:J55`, `L51:X55` with
  H/K formulas; `02_Ингредиенты!A305:M331`; `03_Шаги!A237:G261`; and
  `04_Теги!A100:D109`. Final authoritative SHA-256 is
  `000934d99f84ecb466190f937eb6bf19be4d37344bb4c04923827c79cc8b7c7d`.
- Verification passed: exact seven-sheet structure; all previous owner cells and
  formulas unchanged; five recipes, 27 ingredient rows, 25 steps and ten tags added;
  H/K formulas present; zero formula errors; ZIP integrity and rendered-range checks
  passed. All 27 added ingredient rows remain `UNRESOLVED`; cooked and serving yields
  remain NULL. Pacific-whiting and rabbit product/cut publication blockers remain
  explicit in owner notes.
- Updated `docs/premium/curated-recipes-36-40-evidence-review-v1.md` to the factual
  written state. Added `docs/premium/curated-recipes-41-45-evidence-review-v1.md`;
  recipes 41–45 were **not written**. The new review records independent culinary
  evidence, exact raw/dry/drained bases, original POTOK steps, component/full/serving
  KBJU and fiber arithmetic, test-cooking plans, goal candidates and Meal Composition
  v1.1 proposals. Its 26 proposed ingredient rows remain unresolved.
- Material decisions for 41–45: confirm the farmed-Atlantic-salmon authoring basis;
  Alaska-pollock proxy and exact commercial product; 100% whole-wheat pasta; tuna in
  water at exactly 240 g measured drained solids; and raw peeled/deveined shrimp
  reference/product. Recipes 41 and 43 are proposed as PARTIAL anchors requiring a
  reviewed vegetable or salad companion; 42, 44 and 45 are proposed COMPLETE.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Composition metadata was not written to the workbook. Canonical food and
  recipe metadata blockers remain PARKED. Git/index, secret-pattern and recorded
  owner-baseline verification results are recorded in the final task report.

## Curated recipes 41–50 — workbook write + local review — 2026-09-25

- Owner authorized only recipes 41–45. The authoritative workbook pre-write SHA-256
  was `000934d99f84ecb466190f937eb6bf19be4d37344bb4c04923827c79cc8b7c7d`.
  A byte-identical backup is preserved as
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes41-45-2026-09-25.xlsx`.
- Exact writes were limited to `01_Рецепты!A56:G60`, `I56:J60`, `L56:X60` with
  H/K formulas; `02_Ингредиенты!A332:M357`; `03_Шаги!A262:G283`; and
  `04_Теги!A110:D119`. The final authoritative SHA-256 is
  `01423033af92fdd93d9b8dbde9c959644dc70873397e923cd9a184627d4ba5d1`.
- Workbook verification passed against the authoritative file: seven exact sheets;
  all previous owner values and formulas unchanged; five recipes, 26 ingredient
  rows, 22 steps and ten tags; H/K formulas present; zero formula errors; workbook
  checks, ZIP integrity and rendered views valid. Composition metadata stayed outside
  workbook cells. All 26 new identities remain `UNRESOLVED`; yields remain NULL and
  all product/proxy publication blockers are preserved.
- Updated `docs/premium/curated-recipes-41-45-evidence-review-v1.md` to the factual
  written state. Recipes 41 and 43 retain PARTIAL composition proposals requiring a
  vegetable or salad companion outside the workbook; recipes 42, 44 and 45 remain
  COMPLETE proposals only.
- Added `docs/premium/curated-recipes-46-50-evidence-review-v1.md`. Recipes 46–50 were
  **not written**. It records independent culinary evidence where available, exact
  raw/dry/drained bases, original POTOK preparation, component/full/serving KBJU and
  fiber arithmetic, safety/product constraints, test-cooking plans, goal candidates
  and Meal Composition v1.1 proposals. Its 34 proposed ingredient rows remain
  `UNRESOLVED`; no identifiers were invented.
- Material next decisions: approve/revise each formulation; confirm chicken-liver
  edible-trim and organ-meat publication handling; accept the exact canned-bean and
  canned-tomato bases; confirm recipes 48/49 as COMPLETE; and decide whether recipe
  50 remains conservative PARTIAL or becomes COMPLETE after content/test-cooking
  review. Canonical/product resolution and measured yields remain later blockers.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Git index remains empty. The stored tracked owner-baseline diff is
  byte-identical to its recorded baseline, and this package touched no owner-baseline
  path; **229/229 owner baseline files remain preserved**.

## Curated recipes 46–55 — workbook write + local review — 2026-09-25

- Owner authorized only recipes 46–50. Authoritative pre-write SHA-256 was
  `01423033af92fdd93d9b8dbde9c959644dc70873397e923cd9a184627d4ba5d1`;
  the byte-identical backup is
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes46-50-2026-09-25.xlsx`.
- Exact writes were limited to `01_Рецепты!A61:G65`, `I61:J65`, `L61:X65`
  with H/K formulas; `02_Ингредиенты!A358:M391`;
  `03_Шаги!A284:G304`; and `04_Теги!A120:D129`. Final authoritative
  SHA-256 is
  `a13543b3e93dac225febfedc304e96f411ebaec691656970b217487e2dc7a785`.
- Verification passed: seven-sheet structure; all prior owner values/formulas
  unchanged; five recipe rows, 34 ingredient rows, 21 steps and ten tags; H/K
  formulas; zero formula errors; workbook checks; ZIP integrity; and visual range
  review. All 34 written identities remain `UNRESOLVED`; yields remain NULL.
  Chicken-liver exact product/canonical/organ-meat metadata blockers remain explicit.
  Recipes 46 and 50 remain PARTIAL composition proposals outside the workbook.
- Updated `docs/premium/curated-recipes-46-50-evidence-review-v1.md` to the factual
  written state. Added `docs/premium/curated-recipes-51-55-evidence-review-v1.md`;
  recipes 51–55 were **not written**. It contains independent culinary evidence,
  exact raw/dry/drained/product bases, original POTOK steps, component/full/serving
  KBJU and fiber arithmetic, test-cooking plans, goal candidates and Meal Composition
  v1.1 proposals. Its 37 proposed ingredient rows remain `UNRESOLVED`.
- Material owner decisions before any write of 51–55: accept each exact formulation;
  for recipe 52 accept the MUSO NDL030 100%-buckwheat product reference or provide
  the intended exact noodle product for recalculation; confirm recipes 53–55 as
  four-serving BATCH soups with NULL yield until test-cooking. Exact products,
  canonical identities and measured yields remain later publication blockers.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Git index remains empty. Package edits do not intersect the recorded
  229-file owner baseline; **229/229 owner baseline files remain preserved**.

## Curated recipes 51–60 — accessibility policy, subset write and review — 2026-09-25

- Owner-approved accessibility policy is recorded in
  `docs/premium/curated-recipe-accessibility-policy-v1.md` for recipes 51–120
  and future catalog work.
- Recipe 52 decision is `REVISION_REQUIRED_BEFORE_WRITE`. Reviewed Russian retail
  examples were wheat/buckwheat blends, so a generic 100% buckwheat soba baseline
  was not established. Recipe 52 was not written or silently substituted.
- Owner-authorized unaffected recipes 51 and 53–55 were written as
  `READY_FOR_REVIEW`. Authoritative pre-write and byte-identical backup SHA-256:
  `a13543b3e93dac225febfedc304e96f411ebaec691656970b217487e2dc7a785`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes51-55-subset-2026-09-25.xlsx`.
- Exact writes: `01_Рецепты!A66:G69,H66:H69,I66:J69,K66:K69,L66:X69`;
  `02_Ингредиенты!A392:M422`; `03_Шаги!A305:G324`;
  `04_Теги!A130:D137`. Final authoritative SHA-256:
  `4f279b447e50ea3147206d0ec7a65b39869cb6d751de5c332475dcee23b72a48`.
- Verification passed: seven sheets, all prior owner values/formulas unchanged,
  four recipe rows, 31 ingredient rows, 20 steps, eight tags, H/K formulas, zero
  formula errors, ZIP integrity, byte-identical authoritative copy and rendered
  changed ranges. Recipe 52 is absent. All 31 added identities remain
  `UNRESOLVED`; yield fields remain NULL.
- Added `docs/premium/curated-recipes-56-60-evidence-review-v1.md`; recipes
  56–60 were not written. Accessibility results: 56 and 59
  `COMMON_RU_RETAIL`; 57 `SEASONAL_BUT_COMMON`; 58
  `EXPENSIVE_OPTIONAL`; 60 `COMMON_RU_RETAIL` with exact whole-wheat pasta
  product unresolved. The five drafts have 36 proposed unresolved rows.
- Exact owner decisions remain: approve an accessible recipe-52 blended-soba
  revision and nutrition basis; decide recipe 57 PARTIAL versus COMPLETE after
  test-cooking; retain recipe 58 only as limited expensive variety or replace its
  catalog slot; approve/revise formulations 56 and 59–60 before any write.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Canonical blockers remain PARKED.

## Curated recipes 52 and 56–65 — accessible evidence gate, workbook write and review — 2026-09-25

- Recipe 52 accessible mixed wheat/buckwheat soba direction is owner-approved, but
  the reviewed ordinary Russian-retail product pages did not provide dietary fiber.
  Complete authoring kcal/P/F/C/fiber therefore cannot be established without an
  invented average. Recipe 52 is `EVIDENCE_BLOCKED`, remains absent from the
  workbook and retains unresolved canonical identity.
- Owner-authorized recipes 56–60 were appended as `READY_FOR_REVIEW`. Authoritative
  pre-write and byte-identical backup SHA-256:
  `4f279b447e50ea3147206d0ec7a65b39869cb6d751de5c332475dcee23b72a48`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes56-60-2026-09-25.xlsx`.
- Exact writes: `01_Рецепты!A70:G74,H70:H74,I70:J74,K70:K74,L70:X74`;
  `02_Ингредиенты!A423:M458`; `03_Шаги!A325:G349`;
  `04_Теги!A138:D147`. Final authoritative SHA-256:
  `a9c4ddb68a327f90288c21a01275a559f54e875202c5c2e167d18e51303fbda9`.
- Verification passed: exact seven-sheet structure; all prior owner cells/formulas
  unchanged; five recipes, 36 ingredients, 25 steps and ten tags; H/K formulas;
  zero formula errors; ZIP integrity; byte-identical authoritative copy and visual
  range review. All 36 new identities remain `UNRESOLVED`; yields remain NULL.
  Recipe 57 is owner-approved `MAIN_COMPONENT / COMPLETE` without a required carb
  companion. Recipe 58 remains `EXPENSIVE_OPTIONAL` limited variety and must not be
  required for successful Adaptive generation.
- Added `docs/premium/curated-recipes-61-65-evidence-review-v1.md`; recipes 61–65
  were not written. It records exact raw bases, independent culinary evidence where
  available, original POTOK steps, component/full/serving kcal/P/F/C/fiber,
  accessibility, test-cooking uncertainties and Meal Composition v1.1 proposals.
  Its 31 proposed ingredient rows remain `UNRESOLVED`.
- Owner decisions before any 61–65 write: accept the exact formulations; confirm
  recipes 61–64 as PARTIAL anchors requiring a carb side; retain trout as optional
  expensive variety; decide whether cod is optional expensive variety or should be
  replaced later by a distinct cheaper fish recipe. No species or product may be
  silently substituted.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Canonical food and recipe metadata blockers remain PARKED.

## Curated recipes 61–70 and recipe 52 bounded evidence pass — 2026-09-25

- Owner-approved recipes 61–65 were appended to the authoritative workbook as
  `READY_FOR_REVIEW`. Pre-write and byte-identical backup SHA-256:
  `a9c4ddb68a327f90288c21a01275a559f54e875202c5c2e167d18e51303fbda9`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes61-65-and52-2026-09-25.xlsx`.
- Exact writes: `01_Рецепты!A75:G79,H75:H79,I75:J79,K75:K79,L75:X79`;
  `02_Ингредиенты!A459:M489`; `03_Шаги!A350:G374`;
  `04_Теги!A148:D157`. Current authoritative SHA-256:
  `435327691393fdb2eaec6647a8aa18689b4fc12ff54de878ff8da2a342f2663d`.
- Workbook verification passed: seven sheets, all prior owner values/formulas
  unchanged, five recipes, 31 ingredient rows, 25 steps, ten tags, H/K formulas,
  zero formula errors, ZIP integrity, byte-identical installed copy and rendered
  changed ranges. All new identities remain `UNRESOLVED`; yield fields remain NULL.
- Owner-fixed composition stays outside the workbook: recipes 61–65 are
  `MAIN_COMPONENT / COMPLETE` with no required carb companion. Recipes 64–65 are
  `EXPENSIVE_OPTIONAL` and never required for successful generation. Recipe 63
  retains `AFFORDABLE_BEEF_CUT_REVIEW_REQUIRED`.
- Recipe 52 bounded evidence pass found an official complete dry profile: MEXT item
  01129 `Buckwheat/dried noodles, uncooked` = 344 kcal / P 14.0 / F 2.3 /
  total C 66.7 / fiber 3.7 g per 100 g. Kikkoman independently describes common
  soba as 35% buckwheat / 65% wheat. Recipe 52 is now
  `ACCESSIBLE_EVIDENCE_READY`: full recipe 1064.0 kcal / P 73.5 / F 39.9 /
  C 113.8 / fiber 16.3; per serving 532.0 / 36.8 / 20.0 / 56.9 / 8.1.
  It was **not written**; an exact separate owner checkpoint is required before the
  append. Canonical/product identity remains unresolved.
- Added `docs/premium/curated-recipes-66-70-evidence-review-v1.md`. Recipes 66–70
  remain review-only and unwritten. Accessibility proposals: 66 and 68
  `COMMON_RU_RETAIL`; 67 and 69 `EXPENSIVE_OPTIONAL`; 70
  `COMMON_RU_RETAIL` pending exact product/price/glaze confirmation. All five are
  proposed `MAIN_COMPONENT / COMPLETE` with no mandatory carb side; these composition
  fields remain outside the workbook and are not publication-approved.
- Next owner decisions: explicitly authorize or decline the evidence-backed recipe
  52 append; review exact formulations/classifications 66–70; confirm recipe 70
  accessibility and recipe 67 `BALANCED` energy class. Test-cooking, exact products,
  canonical identity and publication review remain blockers.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Git index remains empty and the 229-file owner baseline remains preserved.

## Curated recipe 52 and recipes 66–75 — authorized write and review — 2026-09-25

- Owner separately authorized recipe 52 and approved recipes 66–70 for authoring.
  The authoritative pre-write SHA-256 was
  `435327691393fdb2eaec6647a8aa18689b4fc12ff54de878ff8da2a342f2663d`;
  a byte-identical backup is preserved as
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipe52-and-recipes66-70-2026-09-25.xlsx`.
- Recipe 52 was appended after existing recipe 65; no prior recipe row was inserted,
  moved or reordered. Recipes 66–70 follow it. Exact write ranges:
  `01_Рецепты!A80:G85,H80:H85,I80:J85,K80:K85,L80:X85`;
  `02_Ингредиенты!A490:M523`; `03_Шаги!A375:G404`;
  `04_Теги!A158:D169`. Final authoritative SHA-256:
  `a01c7d682965ddce1c5c10a9648e101441bdafbf1e5da6a6506d6b86e89437e0`.
- Workbook checks passed: exact seven sheets; all pre-existing values/formulas
  unchanged; six recipe rows, 34 ingredient rows, 30 steps and 12 tags; H/K
  formulas; zero formula errors; ZIP integrity and visual recipe/ingredient/step/
  tag/check review. All added ingredient rows remain `UNRESOLVED`; yield fields are
  NULL; composition/accessibility metadata remains outside workbook fields.
- Recipe 52 and recipes 66, 68 and 70 are `COMMON_RU_RETAIL`; recipes 67 and 69 are
  `EXPENSIVE_OPTIONAL` and must never be required for generator coverage. Every
  written row is `READY_FOR_REVIEW`, not approved, not test-cooked and not
  canonical-ready.
- Added `docs/premium/curated-recipes-71-75-evidence-review-v1.md`; recipes 71–75
  were **not written**. The review fixes raw/dry bases, exact component/full/serving
  nutrition arithmetic, original POTOK steps, explicit minced-meat/patty mixture and
  piece counts, no hidden oil, test-cooking measurements, goal candidates and Meal
  Composition v1.1 proposals. All 35 proposed ingredient rows are unresolved.
- Material owner decisions before writing 71–75: accept the egg-free chicken
  meatball binder; confirm rice as a separate side for recipe 72; accept the
  potato/carrot/egg pollock-patty binder; confirm 90/10 ground-beef basis and
  COMPLETE versus PARTIAL for recipe 74; accept seasonal pumpkin and no-added-water
  recipe 75. Finished yields and canonical/product matches remain blockers.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. PARKED blockers remain open.

## Curated recipes 71–80 — authorized workbook write and evidence review — 2026-09-25

- Owner-authorized recipes 71–75 were appended to the authoritative workbook as
  `READY_FOR_REVIEW`, not approved, not test-cooked and not canonical-ready. The
  pre-write SHA-256 and byte-identical backup SHA-256 are
  `a01c7d682965ddce1c5c10a9648e101441bdafbf1e5da6a6506d6b86e89437e0`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes71-75-2026-09-25.xlsx`.
- Exact writes: `01_Рецепты!A86:G90,H86:H90,I86:J90,K86:K90,L86:X90`;
  `02_Ингредиенты!A524:M558`; `03_Шаги!A405:G429`;
  `04_Теги!A170:D179`. Current authoritative SHA-256:
  `81ccc11ecac14f147001da147e3d8e30d3ec52ecef1d4836f32ed9edda3a066e`.
- Workbook verification passed: exact seven-sheet structure; all prior owner
  values/formulas unchanged; recipe 52 remains in row 80; five recipes, 35
  ingredients, 25 steps and ten tags added; H/K formulas preserved; zero formula
  errors; composition metadata excluded; ZIP integrity and visual range review
  passed. All 35 added identities remain `UNRESOLVED`; cooked and serving yields
  remain NULL. The installed workbook is byte-identical to the verified artifact.
- Updated `docs/premium/curated-recipes-71-75-evidence-review-v1.md` to record the
  factual authoring write. Added
  `docs/premium/curated-recipes-76-80-evidence-review-v1.md`; recipes 76–80 remain
  review-only and were not written. It records independent culinary evidence,
  explicit raw/frozen/drained/product bases, original POTOK preparation, exact
  component/full/serving kcal/P/F/C/fiber arithmetic, accessibility, test-cooking
  plans, goal candidates and Meal Composition v1.1 proposals. Static review passed
  for all five nutrition vectors and 11 evidence URLs. Its 29 proposed ingredient
  rows remain `UNRESOLVED`.
- Owner decisions before any 76–80 write: accept recipe 76 seasonal label and exact
  turkey/eggplant/tomato ratios; accept recipe 77 four-egg milk-free batch; accept
  recipe 78 frozen broccoli, 100 ml milk and no cheese/flour; accept recipe 79
  provisional 5% tvorog basis, unsalted zucchini squeezing and three servings;
  accept recipe 80 frozen cauliflower and sauce-free tofu formulation. Proposed
  COMPLETE/energy classifications remain content-review metadata outside the
  workbook.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Git index remains empty. The stored tracked owner-baseline diff remains
  byte-identical to its recorded baseline and this package touched no baseline path;
  **229/229 owner baseline files remain preserved**. Canonical/product identity and
  measured-yield blockers remain open.

## Curated recipes 76–85 — authorized workbook write and evidence review — 2026-09-26

- Owner-authorized recipes 76–80 were appended to the authoritative workbook as
  `READY_FOR_REVIEW`, not approved, not test-cooked and not canonical-ready. The
  pre-write and byte-identical backup SHA-256 are
  `81ccc11ecac14f147001da147e3d8e30d3ec52ecef1d4836f32ed9edda3a066e`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes76-80-2026-09-26.xlsx`.
- Exact writes: `01_Рецепты!A91:G95,H91:H95,I91:J95,K91:K95,L91:X95`;
  `02_Ингредиенты!A559:M587`; `03_Шаги!A430:G454`;
  `04_Теги!A180:D189`. Current authoritative SHA-256:
  `efdca8ebb1b076c0069fe2b067e0a2e575ac967a1158bd13681826816736faec`.
- Workbook verification passed: exact seven-sheet structure, all prior owner
  values/formulas unchanged, five recipe rows, 29 ingredient rows, 25 steps and ten
  tags, H/K formulas, zero formula errors, ZIP integrity and rendered range review.
  All 29 new identities remain `UNRESOLVED`; yield fields remain NULL. Recipe 79
  retains `EXACT_TVOROG_PRODUCT_AND_NUTRITION_REVIEW_REQUIRED`; its 121/17/5/1.8/0
  profile remains a provisional reviewed reference. Eggs in recipes 77–79 remain
  whole-piece `DISCRETE` inputs and recipes 77–79 retain whole-batch semantics.
- Updated `docs/premium/curated-recipes-76-80-evidence-review-v1.md` to record the
  factual write. Added `docs/premium/curated-recipes-81-85-evidence-review-v1.md`;
  recipes 81–85 remain review-only and were not written. It records 13 culinary
  evidence URLs, explicit dry/frozen/rinsed-drained bases, original POTOK steps,
  component/full/serving kcal/P/F/C/fiber arithmetic, accessibility, test-cooking
  plans, goal candidates and Meal Composition v1.1 proposals. Static recalculation
  passed for all five nutrition vectors. Its 36 proposed ingredient rows remain
  `UNRESOLVED`.
- Owner decisions before any 81–85 write: accept recipe 81 generic tofu/champignon
  sauce-free formulation; recipe 82 200 g dry whole green lentils and exact
  four-serving vegetable tray; recipe 83 480 g rinsed/drained canned chickpeas with
  frozen spinach and canned tomatoes; recipe 84 red kidney beans as the fixed type
  at 480 g rinsed/drained solids; recipe 85 160 g dry buckwheat plus carrot, frozen
  peas, onion and four whole `DISCRETE` eggs for four servings. Composition/energy
  proposals remain content-review metadata outside the workbook.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Git index remains empty. The stored tracked owner-baseline diff remains
  byte-identical to its recorded baseline and this package touched no baseline path;
  **229/229 owner baseline files remain preserved**. Canonical/product identity and
  measured-yield blockers remain open.

## Curated recipes 81–95 — authorized workbook write and evidence review — 2026-09-26

- Owner-authorized recipes 81–85 are now appended to the authoritative workbook as
  `READY_FOR_REVIEW`, not approved, not test-cooked and not canonical-ready. The
  pre-write SHA-256 and byte-identical backup SHA-256 are
  `efdca8ebb1b076c0069fe2b067e0a2e575ac967a1158bd13681826816736faec`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes81-85-2026-09-26.xlsx`.
- Exact writes: `01_Рецепты!A96:G100,H96:H100,I96:J100,K96:K100,L96:X100`;
  `02_Ингредиенты!A588:M623`; `03_Шаги!A455:G479`;
  `04_Теги!A190:D199`. Current authoritative SHA-256:
  `b924460b4bb11888a3d5e0851b31e4784b8ab7716e0d16517ad1585fee9ed05c`.
- Installed-workbook verification passed: exact seven-sheet structure; all previous
  owner values/formulas unchanged; five recipe rows, 36 ingredient rows, 25 steps
  and ten tags; H/K formulas; zero formula errors; ZIP integrity; byte-identical
  candidate/authoritative copies; rendered recipe, ingredient, step, tag and check
  ranges reviewed. All 36 added identities remain `UNRESOLVED`; yields remain NULL.
  Whole-green-lentil and rinsed/drained legume bases and one whole `DISCRETE` cooked
  egg per recipe-85 serving are preserved.
- Owner-authorized recipes 86–90 are now appended as `READY_FOR_REVIEW`, not
  approved, not test-cooked and not canonical-ready. Pre-write and byte-identical
  backup SHA-256:
  `b924460b4bb11888a3d5e0851b31e4784b8ab7716e0d16517ad1585fee9ed05c`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes86-90-2026-09-26.xlsx`.
- Exact writes: `01_Рецепты!A101:G105,H101:H105,I101:J105,K101:K105,L101:X105`;
  `02_Ингредиенты!A624:M659`; `03_Шаги!A480:G504`;
  `04_Теги!A200:D209`. Final authoritative SHA-256:
  `00c1fc169f451dd44da563b58f035c9b53d5779c310c2ab7d6d9b4e83d907f8e`.
- Installed-workbook verification passed: exact seven-sheet structure, every prior
  owner cell/formula unchanged, five recipes, 36 ingredients, 25 steps and ten
  tags, H/K formulas, zero formula errors, ZIP integrity, rendered range review and
  byte identity with the verified candidate. All 36 identities remain `UNRESOLVED`;
  yield fields remain NULL. Recipes 86 and 89 are `EXPENSIVE_OPTIONAL`; 87, 88 and
  90 are `COMMON_RU_RETAIL`. Recipe 87 retains the exact-tvorog blocker and recipe
  89 retains one whole `DISCRETE` egg per serving. Dinner recipes 61–90 are now
  authoring-complete in the master, subject to review/test-cooking/publication gates.
- Updated `docs/premium/curated-recipes-86-90-evidence-review-v1.md` with the factual
  write record. Added `docs/premium/curated-recipes-91-95-evidence-review-v1.md`;
  recipes 91–95 remain review-only and were not written. It explicitly expands the
  shorthand owner names for confirmation, fixes a proposed one-serving basis,
  provides independent culinary references, exact fruit states/grams, component and
  full/serving kcal/P/F/C/fiber arithmetic, preparation, assembly checks, goal
  candidates and Meal Composition v1.1 proposals. The review proposes generic plain
  natural yogurt 2% for 91–93 and generic plain Greek-style yogurt 2% for 94–95,
  both as `REVIEWED_REFERENCE`, never as branded or canonical identity.
- Exact next owner decisions: confirm/correct the five inferred display names;
  approve or replace recipe 91's proposed 50 g frozen strawberry + 50 g frozen
  blackcurrant basis; confirm the two 2%-fat dairy classes, one-serving model and
  exact edible fruit weights; review the composition proposals. All 11 proposed
  ingredient identities remain `UNRESOLVED`. Exact dairy/product matching,
  canonical identity and measured assembly yield remain publication blockers.
- Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`. No Supabase,
  SQL, Graph integration, generator activation, commit, push or deploy occurred.
  Git index remains empty; no stored owner-baseline path was touched and the
  **229/229 owner baseline remains preserved**.

## Curated snacks 91–100 — authorized workbook write and evidence review — 2026-09-26

- Owner-authorized recipes 91–95 were appended to the authoritative workbook as
  `READY_FOR_REVIEW`, not approved, not assembly-tested and not canonical-ready.
  Pre-write and byte-identical backup SHA-256:
  `00c1fc169f451dd44da563b58f035c9b53d5779c310c2ab7d6d9b4e83d907f8e`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes91-95-2026-09-26.xlsx`.
- Exact writes: `01_Рецепты!A106:G110,H106:H110,I106:J110,K106:K110,L106:X110`;
  `02_Ингредиенты!A660:M670`; `03_Шаги!A505:G524`;
  `04_Теги!A210:D219`. Final authoritative SHA-256:
  `52d5a161d7799ff8b8695f3c04de5ab6ee822083c219d80055e17781ea4846a5`.
- Installed-workbook verification passed: exact seven-sheet structure; all prior
  owner cells/formulas unchanged; five recipes, 11 ingredients, 20 steps and ten
  tags; H/K formulas; zero formula errors; ZIP integrity; byte-identical installed
  and verified candidate artifacts; rendered recipe/ingredient/step/tag/check ranges
  reviewed. All 11 identities remain `UNRESOLVED`; yield fields remain NULL;
  composition/accessibility metadata remains outside the workbook. Owner correction
  for recipe 92 is preserved as `SEASONAL_BUT_COMMON`; 91 and 93–95 are
  `COMMON_RU_RETAIL`. Every dairy row retains
  `EXACT_DAIRY_CLASS_OR_PRODUCT_MAPPING_REQUIRED`.
- Updated `docs/premium/curated-recipes-91-95-evidence-review-v1.md` with the factual
  write record and owner-approved names/berry basis. Added
  `docs/premium/curated-recipes-96-100-evidence-review-v1.md`; recipes 96–100 remain
  review-only and unwritten. It explicitly resolves the shorthand names for review,
  proposes one-serving formulations, exact raw/frozen states and grams, independent
  culinary evidence, component/full/serving kcal/P/F/C/fiber arithmetic, original
  POTOK assembly instructions, accessibility, assembly checks, goal candidates and
  Meal Composition v1.1 proposals.
- Proposed 96–99 basis: ordinary dry-style tvorog 5%, 200 g, using the existing
  provisional 121/17/5/1.8/0 reviewed vector only. Recipe 96 adds 100 g frozen
  blueberry; 97 adds 100 g frozen raspberry; 98 adds 150 g fresh edible apricot and
  is `SEASONAL_BUT_COMMON`; 99 adds 150 g cucumber, 10 g dill and 1 g salt. Recipe
  100 proposes 250 g generic plain kefir 2.5% plus 50 g frozen strawberry and 50 g
  frozen blackcurrant, fork-mashed and stirred without a blender; its provisional
  vector is 50/2.8/2.5/3.9/0 per 100 g. It is proposed as
  `BEVERAGE / COMPLETE / CALORIC` under Meal Composition v1.1.
- Exact next owner decisions: confirm/correct names 96–100; approve 200 g tvorog,
  exact fruit/berry/cucumber/dill/salt quantities; approve the generic 2.5% kefir
  vector, repeated 50/50 berry mix and no-blender method; review accessibility and
  composition proposals. All 13 proposed ingredient identities remain `UNRESOLVED`.
  Exact dairy/product mapping, canonical identities and measured assembly weights
  remain publication blockers.
- Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`. No Supabase,
  SQL, Graph integration, generator activation, commit, push or deploy occurred.
  Git index remains empty; no stored owner-baseline path was touched and the
  **229/229 owner baseline remains preserved**.

## Curated snacks 96–105 — authorized write and next review — 2026-09-26

- This section supersedes the earlier 96–100 review-only handoff. After explicit
  owner approval, recipes 96–100 were written to the authoritative workbook as
  `READY_FOR_REVIEW`, not approved, not assembly-tested and not canonical-ready.
  Pre-write/backup SHA-256:
  `52d5a161d7799ff8b8695f3c04de5ab6ee822083c219d80055e17781ea4846a5`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes96-100-2026-09-26.xlsx`.
  Final authoritative SHA-256:
  `aafbc39e0884ac351b6577bd100706008c092bf59ade8f4befa6352ef12877aa`.
- Exact writes: `01_Рецепты!A111:G115,H111:H115,I111:J115,K111:K115,L111:X115`;
  `02_Ингредиенты!A671:M683`; `03_Шаги!A525:G544`;
  `04_Теги!A220:D229`. Verification passed for the exact seven-sheet structure,
  every earlier value/formula, H/K formulas, zero formula errors, ZIP integrity,
  byte-identical candidate/install and rendered ranges. Counts: five recipes,
  13 ingredients, 20 steps, ten tags and 13 `UNRESOLVED` identities. Yield fields
  remain NULL. The four tvorog and one kefir publication blockers are preserved.
- `docs/premium/curated-recipes-96-100-evidence-review-v1.md` now records the
  completed write and only remaining publication/assembly blockers. Added
  `docs/premium/curated-recipes-101-105-evidence-review-v1.md` with review-only
  evidence, exact formulations, ingredient-basis arithmetic, preparation,
  accessibility/allergen notes, assembly uncertainties, goal candidates and Meal
  Composition v1.1 proposals for 101–104 plus both 105 paths.
- Proposed 101–104 bases: ryazhenka 2.5% 200 g + pear 180 g; apple 180 g + smooth
  unsalted peanut butter 20 g; pear 180 g + raw unsalted almonds 20 g; natural
  yogurt 2% 200 g + banana 120 g + unsweetened cocoa 5 g. All are review-only.
- Recipe 105 remains `RECIPE_105_HUMMUS_PATH_REVIEW`: A is 60 g commercial plain
  hummus proxy + 150 g carrot, accessibility-first but exact-product blocked; B is
  a two-serving house candidate using 120 g drained chickpeas, 20 g tahini, 15 g
  lemon juice, 5 g oil, 20 g water, 1 g salt and 300 g carrot, reproducible but
  requiring tahini, equipment and test-cooking. Nothing from 101–105 was written.
- Exact next owner decisions: approve/correct formulations 101–104 and their
  provisional product-class vectors; select 105 path A or B; review composition
  proposals. Canonical/product mappings and measured assembly yields remain open.
- Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`. No Supabase,
  SQL, Graph integration, generator activation, commit, push or deploy occurred.
- Targeted workbook and review-document checks passed; `git diff --check` passed;
  the stored owner tracked-baseline diff remains byte-identical, no baseline path
  was written, the **229/229 owner baseline remains preserved**, and the Git index
  remains empty.

## Curated snacks 101–110 — authorized write and next review — 2026-09-26

- This section supersedes the earlier 101–105 review-only handoff. Owner-authorized
  recipes 101–105 were appended to the authoritative workbook as `READY_FOR_REVIEW`,
  not approved, not assembly-tested and not canonical-ready. Recipe 105 uses the
  owner-selected `COMMERCIAL_GENERIC_PROXY`; the rejected house-hummus path was not
  written.
- Pre-write authoritative and byte-identical backup SHA-256:
  `aafbc39e0884ac351b6577bd100706008c092bf59ade8f4befa6352ef12877aa`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes101-105-2026-09-26.xlsx`.
  Current authoritative SHA-256:
  `91ecb6a54ed496b28cc708d02c22739e539492a58d34c422cb3a5dfbf50e9e4a`.
- Exact writes: `01_Рецепты!A116:G120,H116:H120,I116:J120,K116:K120,L116:X120`;
  `02_Ингредиенты!A684:M694`; `03_Шаги!A545:G564`;
  `04_Теги!A230:D239`. Installed-file verification passed for the exact seven-sheet
  structure, every prior owner value/formula, H/K formulas, zero formula errors,
  ZIP integrity, candidate/install byte identity and rendered ranges. Counts are five
  recipes, 11 ingredients, 20 steps and ten tags; all 11 identities are
  `UNRESOLVED`; yield fields remain NULL. The ryazhenka, peanut-butter, yogurt and
  commercial-hummus exact-product publication blockers are preserved.
- `docs/premium/curated-recipes-101-105-evidence-review-v1.md` now records the factual
  write and selected recipe-105 path. Added
  `docs/premium/curated-recipes-106-110-evidence-review-v1.md`; recipes 106–110 remain
  review-only and were not written. It provides independent culinary evidence,
  exact grams and state bases, component/full/serving kcal/P/F/C/fiber arithmetic,
  assembly methods, allergens, accessibility, testing requirements, goal candidates
  and Meal Composition v1.1 proposals.
- Proposed 106–110 bases: commercial plain hummus 60 g + red pepper 150 g; whole-grain
  rye crispbread 26 g + plain cream-style tvorozhny cheese 50 g; the same reviewed
  crispbread class 26 g + light tuna in water 100 g fully drained solids; whole-grain
  bread 80 g + raw turkey breast 120 g + cucumber 60 g; two whole `DISCRETE` eggs +
  cucumber 150 g. Crispbread/cheese vectors are exact authoring proxies, never generic
  truth; product variability is explicit and blocks publication. Tuna is
  `EXPENSIVE_OPTIONAL`; the other four are `COMMON_RU_RETAIL` candidates.
- Exact next owner decisions: accept/correct each formulation; accept reuse of the
  recipe-105 hummus class for 106; accept both explicit proxy blockers for 107;
  accept tuna accessibility and drained basis for 108; accept raw-basis home-cooked
  turkey rather than deli meat for 109; accept two eggs for 110; review composition
  proposals; separately authorize any future exact-range workbook write. All 11
  proposed ingredient identities remain `UNRESOLVED`.
- Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`. No Supabase,
  SQL, Graph integration, generator activation, commit, push or deploy occurred.

## Curated snacks 106–115 — authorized write and next review — 2026-09-26

- This section supersedes the 106–110 review-only handoff. Recipes 106–110 were
  appended to the authoritative workbook after explicit owner approval as
  `READY_FOR_REVIEW`; none is approved, assembly-tested or canonical-ready.
- Pre-write authoritative and byte-identical backup SHA-256:
  `91ecb6a54ed496b28cc708d02c22739e539492a58d34c422cb3a5dfbf50e9e4a`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes106-110-2026-09-26.xlsx`.
  Post-write authoritative SHA-256:
  `f1c65c343922dae07b83c24ae6aad066cc577c08a7066ebc89d82fee80c12b5d`.
- Exact writes: `01_Рецепты!A121:G125,H121:H125,I121:J125,K121:K125,L121:X125`;
  `02_Ингредиенты!A695:M705`; `03_Шаги!A565:G584`;
  `04_Теги!A240:D249`. Installed-file verification passed: seven sheets, all prior
  owner cells/formulas unchanged, five recipes, 11 ingredients, 20 steps, ten tags,
  H/K formulas, zero formula errors, ZIP integrity, candidate/install byte identity
  and rendered review. All 11 identities remain `UNRESOLVED`; yield fields remain
  NULL. Hummus, crispbread, cream-style cheese, tuna, bread and turkey product/class
  blockers and whole-egg `DISCRETE` semantics remain explicit.
- `docs/premium/curated-recipes-106-110-evidence-review-v1.md` records the factual
  write. Added `docs/premium/curated-recipes-111-115-evidence-review-v1.md`; recipes
  111–115 remain review-only and were not written. Proposed bases: two whole eggs +
  150 g cherry tomatoes; 200 g baked edible apple + 100 g 5% tvorog + 1 g cinnamon;
  150 g tvorog + 50 g natural yogurt + 50 g each frozen strawberry/blackcurrant;
  40 g dry rolled oats + 200 g natural yogurt overnight; 75 g each apple/banana/pear
  + 100 g natural yogurt. The review includes sources, exact component arithmetic,
  assembly methods, accessibility, equipment, tests and composition v1.1 proposals.
- Owner review is required before any 111–115 write. Decisive content checkpoints:
  fork-only recipe 113 must actually merit “cream” or return for an explicit blender/
  naming decision; recipe 114 must prove yogurt-only overnight pudding texture or
  return with an exact measured liquid correction. Canonical/product mappings and
  measured yields remain blocked. The 15 proposed ingredient rows remain
  `UNRESOLVED`.
- No Supabase, SQL, Graph integration, generator activation, commit, push or deploy
  occurred. Git index remains empty; the **229/229 owner baseline remains preserved**.

## Curated snacks 111–120 — authorized write and final-name review — 2026-09-26

- This section supersedes the 111–115 review-only handoff. Recipes 111–115 were
  appended to the authoritative workbook after explicit owner authorization as
  `READY_FOR_REVIEW`; none is approved, assembly-tested or canonical-ready.
- Pre-write authoritative and byte-identical backup SHA-256:
  `f1c65c343922dae07b83c24ae6aad066cc577c08a7066ebc89d82fee80c12b5d`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes111-115-2026-09-26.xlsx`.
  Post-write authoritative SHA-256:
  `1bc6889018bc1a07fcb7b87ad3586ac66dc1303fbf614b639c0e06326ff28b26`.
- Exact writes: `01_Рецепты!A126:G130,H126:H130,I126:J130,K126:K130,L126:X130`;
  `02_Ингредиенты!A706:M720`; `03_Шаги!A585:G604`;
  `04_Теги!A250:D259`. Installed-file verification passed for seven sheets, every
  prior owner cell/formula, H/K formulas, zero formula errors, ZIP integrity,
  candidate/install byte identity and rendered ranges. Counts: five recipes,
  15 ingredients, 20 steps and ten tags; all 15 identities are `UNRESOLVED`.
  Recipe 113 retains `CREAM_TEXTURE_VALIDATION_REQUIRED`; recipe 114 retains
  `PUDDING_TEXTURE_VALIDATION_REQUIRED`; yield fields remain NULL.
- `docs/premium/curated-recipes-111-115-evidence-review-v1.md` now records the
  factual authorized write. Added
  `docs/premium/curated-recipes-116-120-evidence-review-v1.md`; recipes 116–120
  remain review-only and were not written.
- Name resolution proposes `Соевый йогурт с грушей` for the incomplete source
  fragment `с грушей`; owner confirmation is required. Plain unsweetened soy yogurt
  and frozen shelled edamame are classified `SPECIALTY_PRODUCT_REQUIRED` because
  broad ordinary-supermarket availability was not established. Recipes 119 and 120
  remain `COMMON_RU_RETAIL` candidates.
- Proposed bases: 200 g plain unsweetened soy-yogurt proxy + 50 g each frozen
  strawberry/blackcurrant; the same yogurt 200 g + pear 180 g; prepared shelled
  edamame 150 g + lemon juice 10 g; drained canned cannellini 120 g + lemon 10 g +
  oil 5 g + water 15 g + salt 0.5 g + rye crispbread 26 g; drained firm tofu 150 g
  + cucumber 120 g + dill/parsley 5 g each + salt 1 g. All 18 proposed ingredient
  identities remain `UNRESOLVED`; exact soy-yogurt, edamame, bean, crispbread and
  tofu product/class mapping and measured yields remain publication gates.
- Recipe 119 retains an explicit owner decision: fork-only is evidence-backed for
  a rustic bean spread and likely requires renaming; blender use better supports
  the current `паштет` name. Recipe 120 deliberately has no sauce/oil and requires
  assembly validation; any acid/oil correction must return with exact grams.
- Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`. No Supabase,
  SQL, Graph integration, generator activation, commit, push or deploy occurred.

## Original 120 authoring complete — 2026-09-26

- This section supersedes the 116–120 review-only state above. The owner-approved
  recipes 116–120 were appended to the authoritative workbook as
  `READY_FOR_REVIEW`; none is approved, test-cooked/assembly-tested,
  canonical-ready, publication-ready or generator-ready.
- Authoritative pre-write and byte-identical backup SHA-256:
  `1bc6889018bc1a07fcb7b87ad3586ac66dc1303fbf614b639c0e06326ff28b26`.
  Backup:
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_master_v1_007.backup-before-recipes116-120-2026-09-26.xlsx`.
  Installed authoritative SHA-256:
  `9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5`.
- Exact final writes: `01_Рецепты!A131:G135,H131:H135,I131:J135,K131:K135,L131:X135`;
  `02_Ингредиенты!A721:M738`; `03_Шаги!A605:G624`;
  `04_Теги!A260:D269`. Counts: five recipes, 18 ingredients, 20 steps, ten tags;
  all 18 new ingredient identities remain `UNRESOLVED`.
- Verification passed: seven sheets, every earlier value/formula unchanged, recipe
  52 still at row 80, H/K formulas, zero formula errors, ZIP integrity, rendered
  review and candidate/install byte identity. The original source catalog maps to
  120/120 unique authoring identities: 30 Breakfast, 30 Lunch, 30 Dinner, 30 Snack.
  All 120 statuses are `READY_FOR_REVIEW`, zero are `APPROVED`, measured yield count
  is zero, and all 606 ingredient rows across the 120 remain `UNRESOLVED`.
- Recipes 116–118 retain `SPECIALTY_PRODUCT_REQUIRED` and optional-variety-only
  generator notes. Recipe 119 uses the owner-selected blender-required smooth pâté
  path without rename. Recipe 120 retains the exact sauce-free assembly gate.
- Final integrity and next-gates inventory:
  `docs/premium/curated-recipes-120-authoring-integrity-and-next-gates-v1.md`.
  It records 91 test-cooking items, 29 no-cook assembly items, 43 explicit
  product/class blockers, six texture blockers, three specialty items, eight
  `EXPENSIVE_OPTIONAL` items and 24 recipes with `DISCRETE` ingredients.
- The source 30×4 grouping is intact. Historical operational workbook meal tags
  remain 35 BREAKFAST / 56 LUNCH / 29 SNACK / 0 DINNER and require later publication
  metadata reconciliation. Five display-title variants are recorded; #22 remains a
  title-fidelity review because its workbook label is shorter than its batch doc.
- `TEST_COOKING_NOT_COMPLETE`; `CANONICAL_MAPPING_NOT_COMPLETE`;
  `PUBLICATION_NOT_COMPLETE`; `GENERATOR_NOT_READY`. No Supabase, SQL, Graph/Meal
  Composer/Balance Validator integration, generator activation, commit, push or
  deploy occurred. Git index remains empty and the **229/229 owner baseline remains
  preserved**.

## Test Cooking + Assembly Validation Protocol v1 ready — 2026-09-26

- Added read-only design package:
  `docs/premium/curated-recipe-test-cooking-assembly-protocol-v1.md`.
- Authoritative workbook was rechecked at SHA-256
  `9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5`
  and was not modified. The evidence-based split remains exactly 91
  `TEST_COOKING` / 29 `ASSEMBLY_VALIDATION`; no discrepancy was found.
- Protocol defines immutable authoring-hash lineage, ingredient/session/process/
  yield/quality/result fields, special state handling, whole-piece rules, factual
  yield authority, nutrition-versus-water/yield semantics and owner-controlled
  correction workflow. It introduces no unreviewed acceptance thresholds.
- Full plan covers all 120 unique recipe numbers once in 17 batches of 5–9 recipes.
  Proposed first pilot `TCV1-B01-PILOT` is #17, #18, #102, #103 and #110 (one test
  cooking, four assembly); it was not executed. It avoids specialty, expensive and
  named texture blockers while testing fruit trim, dairy drainage, product-label
  evidence, whole-piece mass, boiling and final serving measurement.
- Preserved blocker inventory: texture #6/#16/#104/#113/#114/#119; separate #120
  sauce-free cohesion; specialty #116–118; expensive optional #58/#64/#65/#67/#69/
  #86/#89/#108; 24 `DISCRETE`; 43 explicit product/class; 606 unresolved ingredient
  rows across all 120 recipes.
- `MEAL_TAG_RECONCILIATION_REQUIRED`: operational meal tags come from
  `01_Рецепты.meal_type` and `04_Теги` MEAL rows and remain 35 BREAKFAST / 56 LUNCH /
  29 SNACK / 0 DINNER versus the original 30×4 groups. Evidence does not prove why;
  later publication review must preserve source group separately and approve v1.1
  `allowedMealTypes` rather than guessing.
- `RECIPE_22_TITLE_REVIEW_REQUIRED`: owner list says `Цельнозерновой тост с яйцом и
  авокадо`; workbook says `Тост с яйцом и авокадо`; stable ID remains
  `wholegrain_toast_egg_avocado` and the ingredient still uses whole-grain toast.
  Owner later chooses full versus shorter display title; no workbook change now.
- `WORKBOOK_UNCHANGED`; `TEST_RESULTS_NOT_WRITTEN`;
  `CANONICAL_MAPPING_NOT_STARTED`; `GENERATOR_NOT_STARTED`. No Supabase, SQL,
  canonical work, Graph/Meal Composer/Balance Validator implementation, commit,
  push or deploy. Git index remains empty; 229/229 owner baseline preserved.

## TCV1-B01-PILOT measurement package ready — 2026-09-26

- Owner approved the working protocol as
  `TEST_COOKING_ASSEMBLY_PROTOCOL_V1_APPROVED`. The protocol document now records
  that approval and the bounded pilot package; no physical validation was executed.
- Created the separate measurement workbook
  `/Users/urijurij/Desktop/ПОТОК база рецептов /POTOK_recipe_validation_TCV1-B01-PILOT_v1.xlsx`
  with SHA-256
  `fecf6079afe393b8de1b9031fa38b06713179caaa453efad7106b52a7e6fcab8`.
  Its eight sheets are `00_Инструкция`, `01_Свод`, `02_R017`, `03_R018`,
  `04_R102`, `05_R103`, `06_R110` and `07_Справочник_результатов`.
- The five recipe sheets contain exact master identities for #17/#18/#102/#103/#110,
  11 authored ingredient rows and 20 authored steps. All owner measurement,
  observation and result fields remain blank. Product evidence, tare/gross food-only
  mass, discrete counts, allergen notes, result vocabulary and non-decisional
  spreadsheet checks are present; no macro or external connection is present.
- Structural import, formula/error scan, ZIP integrity and rendered review passed.
  Candidate and installed files are byte-identical. The authoritative master remains
  unchanged at SHA-256
  `9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5`.
- Recipe #22 owner decision is recorded only: later restore display title
  `Цельнозерновой тост с яйцом и авокадо`, retaining
  `wholegrain_toast_egg_avocado`. No master cell or meal tag was changed.
- `TCV1_B01_PILOT_MEASUREMENT_PACKAGE_READY`;
  `PHYSICAL_TESTS_NOT_EXECUTED`; `TEST_RESULTS_NOT_WRITTEN_TO_MASTER`;
  `RECIPE_22_TITLE_DECISION_RECORDED_NOT_APPLIED`;
  `MEAL_TAG_RECONCILIATION_REQUIRED`; `CANONICAL_MAPPING_NOT_STARTED`;
  `GENERATOR_NOT_STARTED`. No Supabase, SQL, Graph/Meal Composer/Balance Validator
  implementation, commit, push or deploy occurred.

## Meal Composer + Balance Validator v1 design — 2026-09-27

- Added the architecture-only package
  `docs/premium/adaptive-nutrition-meal-composer-balance-validator-v1.md`. It extends
  Meal Composition v1.1 without changing its roles, anchor model, Graph v1, runtime,
  database or curated content.
- The hybrid contract has two deterministic paths: one reviewed `COMPLETE` recipe,
  or one reviewed `PARTIAL` anchor plus policy-authorized `NONE` companions. Exactly
  one anchor remains mandatory; grain/starch is never universally required.
- Candidate gates cover immutable publication/canonical/nutrition evidence,
  allergens/dietary restrictions, user exclusions, accessibility, meal type,
  portions, `repeatFamily` and optional-only specialty/expensive content. The design
  recommends normal immutable recipe revisions with component metadata as the one
  component-library authority.
- Meal/day/week validators, stable statuses/reason codes, repetition layers,
  `allowedMealTypes[]` reconciliation, unified PLAN meal-snapshot proposal,
  deterministic generation pipeline and an 18-case synthetic test matrix are
  specified. Validation is fail closed and remains separate from optimization.
- Product decisions remain open for component count, optional-side patterns,
  repetition limits, shopping reuse versus diversity, lunch/dinner semantics,
  warning policy, convenience weights and optional specialty/expensive frequency.
- `MEAL_COMPOSER_BALANCE_VALIDATOR_V1_DESIGN_READY`;
  `HYBRID_MEAL_GENERATION_CONTRACT_READY`;
  `MEAL_BALANCE_VALIDATOR_CONTRACT_READY`;
  `DAY_BALANCE_VALIDATOR_CONTRACT_READY`;
  `WEEK_BALANCE_VALIDATOR_CONTRACT_READY`; `IMPLEMENTATION_NOT_STARTED`;
  `GENERATOR_NOT_ACTIVATED`. No Supabase, SQL, workbook, Graph integration, runtime,
  FACT/diary writer, commit, push or deploy action occurred.

## Meal Composer + Balance Validator pure contract v1 — 2026-09-27

- Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`; the Git index is
  empty. Added the bounded pure implementation
  `src/utils/adaptiveNutritionMealBalanceV1.ts` and synthetic tests
  `src/utils/__tests__/adaptiveNutritionMealBalanceV1.test.ts`; updated
  `docs/premium/adaptive-nutrition-meal-composer-balance-validator-v1.md` with the
  owner-approved v1 policy and actual implementation state.
- Strict DTOs now cover immutable component evidence, user constraints, balance and
  optimization policies, meal/day/week validator inputs, fallback proof, stable
  validator results and deterministic optimization results. Unknown fields/enums,
  duplicate identities, stale revisions, contradictory validation status, invalid
  scale-3 decimals and noncanonical ordered sets fail closed.
- Meal/day/week validation preserves Meal Composition v1.1 and Graph v1 contracts.
  It applies `maxComponents=5`, exact recipe 1/day and 2/week, repeat family 3/week,
  dominant ingredient family 4/week, specialty 1/week and expensive optional
  2/week. Ordinary fallback proof is mandatory; safety/evidence/structure/portion/
  revision failures cannot be warnings.
- Optimization uses only validated candidates and exact scale-3 BigInt arithmetic:
  target fit 0.400, diversity 0.250, convenience 0.200 and shopping reuse 0.150.
  Equal valid scores use complete recipe, policy pattern and canonical component
  identity tie-breaks; input order does not affect the result digest.
- Focused tests: **43/43 PASS** (22 existing Meal Composition v1.1 cases, owner cases
  21–40, and strict reason-code decoding). Strict TypeScript `npx tsc --noEmit`
  **PASS**; targeted ESLint for the two implementation/test files **PASS**;
  `git diff --check` **PASS**. No broad build was required for this isolated pure
  module.
- No real recipe was classified, published or made generator-eligible. There is no
  import from runtime/UI/service code and no database, network, Graph binding, PLAN
  or FACT writer. Generator activation remains off. Supabase, SQL, the authoritative
  workbook, production, commits, pushes and deploys were untouched.
- The recorded owner baseline diff remains byte-identical at SHA-256
  `b095d79bac22f6e2c784870e25b4d8af29dc256e152964072e05762cdb0a8936`;
  **229/229 owner baseline paths remain preserved**. Next checkpoint is owner review
  of this pure contract and synthetic evidence before any separate Graph-binding or
  trusted-generator integration design.

## Goal target/bounds pure contract v1 — 2026-09-27

- Extended `src/utils/adaptiveNutritionMealBalanceV1.ts` with strict
  `GoalNutritionTargetV1`, target-fit input/result DTOs and canonical result digest.
  Calories require exact scale-3 `target/min/max`; protein, fat, carbs and fiber use
  the same structure only when supplied. Every axis enforces
  `min <= target <= max`; missing calorie bounds, malformed decimals, stale target
  policy and contradictory Goal bindings fail closed.
- Day validation now binds `goalRevision` and `targetPolicyRevision` to the supplied
  Goal target. The calorie corridor and any supplied macro/fiber corridors are hard,
  inclusive validation bounds. Exact equality with the target is not required.
  Missing complete Goal evidence remains `BLOCKED_MISSING_EVIDENCE`; no target or
  range is inferred.
- Added deterministic calorie target-fit evidence using scale-3 BigInt arithmetic.
  The target scores `1.000`; distance is normalized against the applicable side of
  the approved corridor. The example 1650 target with 1600–1700 bounds gives 1648 a
  score of `0.960` and 1675 `0.500`. This is optimization evidence only; there is no
  universal ±50 rule.
- No-filler remains a hard composition/portion boundary: exact calorie equality
  cannot authorize an optional component, arbitrary oil/sauce/snack fragment or a
  fractional DISCRETE quantity. Meal distribution remains separately supplied
  policy evidence and is never derived as an implicit percentage of daily calories.
- Added owner cases 44–57. Focused Meal Composition + Balance/Goal tests are now
  **57/57 PASS**. Strict TypeScript `npx tsc --noEmit` **PASS**; targeted ESLint
  **PASS**; `git diff --check` and cached checks **PASS**. No Graph binding, database,
  network, runtime/UI, real recipe, catalog publication, PLAN/FACT write or generator
  activation was added.
- Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`; no commit,
  push, deploy, SQL, Supabase or workbook action occurred. The Git index remains
  empty. The owner baseline diff remains byte-identical at SHA-256
  `b095d79bac22f6e2c784870e25b4d8af29dc256e152964072e05762cdb0a8936`;
  **229/229 owner baseline paths are preserved**. Next checkpoint remains owner
  review of the expanded pure contract before any separate Graph-binding design.

## Graph binding + trusted generator integration audit — 2026-09-27

- Added
  `docs/premium/adaptive-nutrition-graph-binding-trusted-generator-v1.md` and updated
  the Meal Composer design with a factual cross-contract blocker. No TypeScript,
  Graph, activation, database or runtime contract was changed.
- Current Graph v1 is a strict one-recipe-per-slot structure: one recipe revision,
  one portion revision and an assigned ingredient list that must exactly scale that
  recipe. Current activation also authorizes each slot through one published
  recipe/revision/portion tuple. `MealSnapshotV1` for `COMPOSED_MEAL` instead contains
  multiple independent recipe, portion and eligibility revisions.
- A complete recipe can bind one-to-one. A composed meal cannot bind losslessly
  without changing the Graph contract/encoding, adding a sibling persisted snapshot,
  or restricting generation to complete recipes. Anchor-only projection, slot
  splitting and invented composite recipe identities were rejected as unsafe.
- The design note specifies proposed immutable generation input, protected eligible
  manifest, generated-week evidence, trusted sequence, CAS vector, idempotency,
  deterministic digest rules, failure statuses/reasons, real-content gate and the
  25-case synthetic matrix. Cases 2, 3 and 23 cannot honestly pass against Graph v1,
  so no false `SYNTHETIC_GRAPH_BINDING_PASS` is claimed and no partial DTO was added.
- Owner checkpoint: approve a separately versioned lossless slot representation
  embedding existing `MealSnapshotV1` (recommended), a sibling atomic composition
  snapshot, or an explicitly complete-recipe-only first generator. Until then:
  `GRAPH_BINDING_TRUSTED_GENERATOR_V1_DESIGN_BLOCKED`;
  `GENERATED_WEEK_PLAN_SNAPSHOT_V1_BLOCKED`; `GENERATOR_NOT_ACTIVATED`.
- Focused cross-contract regression (Graph, activation, composition and balance/Goal)
  is **86/86 PASS**; strict TypeScript and targeted ESLint are **PASS**. These checks
  confirm each existing contract independently and do not claim the missing composed
  Graph binding or the requested 25-case integration matrix.
- No Supabase, SQL, migration, real recipe, catalog publication, PLAN/FACT write,
  runtime/UI, commit, push or deploy action occurred. Current HEAD remains
  `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`; the Git index remains empty and the
  229-file owner baseline remains preserved.

## Adaptive Nutrition Graph v2 pure contract — 2026-09-27

- Owner approved a separately versioned Graph v2 that embeds the existing immutable
  `MealSnapshotV1` per slot. Added `src/utils/adaptiveNutritionGraphV2.ts` and
  `src/utils/__tests__/adaptiveNutritionGraphV2.test.ts`; updated the Graph-binding
  and Meal Composer design notes to record the implemented pure boundary. Graph v1
  source, decoder, digest and activation semantics were not edited or widened.
- `AdaptiveNutritionGraphV2` explicitly binds selection/plan/week/timezone,
  Goal target and hard bounds, all policy revisions, catalog revision/manifest
  digest, seven ordered days and ordered meal slots. Each slot retains the exact
  `MealSnapshotV1`, validation/decision evidence and ordered per-component immutable
  evidence. `COMPLETE_RECIPE` requires one `COMPLETE` component;
  `COMPOSED_MEAL` requires one `PARTIAL` anchor plus only `NONE` companions, with a
  maximum of five components. No synthetic wrapper recipe, anchor-only projection
  or component-to-slot split exists.
- Added a separate v2 canonical JSON domain and SHA-256 helper, strict decoder,
  graph sealer, strict `TrustedGenerationInputV1`, lossless `GeneratedWeekPlanV1`
  binding, full authority CAS recheck and idempotency/recovery resolver. The CAS
  vector includes account, selection, week/timezone, pending/null plan head,
  entitlement evidence, Goal/target, preference/safety, manifest and all policy
  revisions. Unknown outcome retains the original key and digest; key/payload
  mismatch fails closed.
- New Graph v2 synthetic suite: **30/30 PASS**. It covers the requested 26 Graph and
  binding cases plus strict generation input, entitlement revoke/expiry, account/
  selection/week CAS and idempotency/unknown/exact replay. Combined Graph v1,
  activation, Meal Composition, Balance/Goal and Graph v2 regression: **116/116
  PASS**. Strict TypeScript and targeted ESLint **PASS**; `git diff --check` and
  cached diff checks **PASS**.
- Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`; no commit,
  push or deploy occurred and the index remains empty. No Supabase, SQL, migration,
  persistence, endpoint, runtime/UI, real candidate manifest, real recipe, PLAN DB
  write or FACT write was added. Generator remains OFF. The owner baseline diff is
  byte-identical at SHA-256
  `b095d79bac22f6e2c784870e25b4d8af29dc256e152964072e05762cdb0a8936`;
  **229/229 owner baseline paths remain preserved**.
- Next checkpoint: owner review of the pure Graph v2/GeneratedWeekPlan/CAS contract.
  A later separately approved package may design persistence and activation for the
  new graph version; real generation remains blocked by the existing publication,
  canonical evidence and protected candidate-manifest gates.

## Graph v2 persistence + atomic activation design v1 — 2026-09-27

- Added the documentation-only review package
  `docs/premium/adaptive-nutrition-graph-v2-persistence-activation-design-v1.md`.
  It recommends canonical Graph v2 bytes plus an immutable verified JSON snapshot
  and indexed evidence columns on the existing graph-revision authority. Fully
  normalized day/slot/component tables are rejected as a second source of truth;
  future projections may only be derived and non-authoritative.
- The proposal reuses `user_premium_plan_selections`,
  `adaptive_nutrition_graph_revisions`, `adaptive_nutrition_operations`, Goal
  revisions, active-head FK and immutable history guards. Meal snapshots remain
  embedded once in Graph v2. Additive conceptual bindings cover graph contract/
  version, canonical bytes, Graph/GeneratedWeekPlan/input digests, complete policy/
  manifest revisions, generation and activation receipts, and same-selection
  predecessor history.
- Refined the weekly state model: `pending_generation` is the persisted pre-plan
  state; `generated` belongs to a durable generation receipt, so no weekly row can
  claim a generated plan without an atomic committed graph/head. `superseded` is a
  graph-revision relation. Initial activation atomically inserts one immutable Graph
  v2 row, moves the same selection head and settles one receipt; it emits no event,
  diary row or FACT.
- Defined the full CAS vector, account-scoped idempotency/exact replay/UNKNOWN
  behavior, version-dispatched reads, immutable successor history, PLAN/FACT
  separation, fixed lock order, least-privilege boundary and stable activation
  statuses/reasons. The synthetic transaction matrix contains **25/25 specified
  scenarios** as review cases; these are not claimed as live database evidence.
- Static document check confirms all eight required status markers, exactly 25
  transaction scenarios and no executable DDL/DML/transaction statements. Focused
  Graph v2 regression remains **30/30 PASS** and strict TypeScript **PASS**.
- No SQL/migration/RPC/Edge Function/runtime code was created or applied. No
  Supabase connection, candidate manifest, real recipe eligibility, PLAN/FACT write,
  commit, push or deploy occurred. Current HEAD remains
  `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`; the Git index remains empty.
- Before a runnable draft, owner review and fresh deployed evidence are required for
  additive schema compatibility, Graph-v2 manifest storage, preference/safety
  revision authority, the shared entitlement/PLAN account lock and the protected
  canonical-validator execution role/channel. Generator activation remains OFF.

## Graph v2 persistence STAGING metadata preflight v1 — 2026-09-27

- Prepared the owner-run SELECT-only artifact
  `docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_persistence_metadata_preflight_v1.sql`
  for the explicitly labelled STAGING project `ozidryfvhkcbtpnulakq`. SHA-256:
  `3851027f73548815571969f9ee059d49f26a3f63a7c10af31f2701b3e827db92`.
  It was **not executed** and PostgreSQL parser/runtime compatibility is not claimed.
- The export has one deterministic result shape (`section_id`, `section_name`,
  `object_name`, `record_kind`, `payload_json`) and 18 numbered sections. It covers
  exact weekly-selection/graph/receipt/event/Goal metadata; preference and safety
  candidates; entitlement function definitions and advisory-lock evidence;
  manifest candidates; Graph-v1 read/activation definitions; RLS/policies; table,
  column and function ACLs; triggers; catalog dependencies and visible writer bodies.
  Every empty section emits an explicit `NOT_FOUND_IN_SCOPED_METADATA` row.
- Added
  `scripts/contracts/adaptive-nutrition-graph-v2-persistence-metadata-preflight-v1.test.ts`.
  Static checks are **5/5 PASS**: exactly one SELECT-only statement, no executable
  mutation/DDL/transaction/role statements, no direct application-table query or
  application-RPC call, exact STAGING label/output shape, all 18 sections and
  balanced delimiters. Strict TypeScript and targeted ESLint are **PASS**;
  `git diff --check` and cached diff check are **PASS**.
- The preflight reads no application row values and invokes no discovered business
  function. It returns function/trigger definitions only as catalog text. Matching
  preference/safety/manifest names remain candidates until post-export semantic
  review; absence is never upgraded beyond `NOT_FOUND_IN_SCOPED_METADATA`.
- No Supabase connection, SQL execution, migration/RPC draft, DB/RLS/grant change,
  runtime wiring, candidate publication, recipe eligibility, PLAN/FACT write,
  commit, push or deploy occurred. Graph v2 runnable schema work has not started.
  Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef` and the index
  remains empty. The 229-file owner baseline remains byte-identical.
- Next checkpoint: owner may manually run only the exact preflight SQL in the
  Supabase Dashboard SQL Editor after verifying STAGING project ref
  `ozidryfvhkcbtpnulakq`, export all rows without truncation and return the result
  without credentials. That authorization does not include any mutation or draft apply.

## Graph v2 missing server authorities design v1 — 2026-09-27

- Owner-supplied STAGING metadata results confirm that weekly selections, immutable
  graph revisions and the operations ledger are reusable; Graph v1 deployed
  functions remain unchanged. No versioned preference authority, user safety
  authority or protected Graph-v2 candidate-manifest authority was found. The
  entitlement and Adaptive PLAN writers use different advisory-lock namespaces.
- Added the pure-contract/design package
  `docs/premium/adaptive-nutrition-graph-v2-missing-authorities-design-v1.md` and
  `src/utils/adaptiveNutritionAuthoritiesV1.ts`. It defines immutable, digest-bound
  `NutritionPreferenceSnapshotV1`, `NutritionSafetySnapshotV1`, a protected
  `AdaptiveNutritionCandidateManifestV2`, strict hard-safety versus soft-preference
  behavior, canonical ordering/bytes, exact component membership and current-head/
  historical-read concepts. A dedicated manifest authority is recommended; the
  replacement-offer table is explicitly rejected as publication authority.
- Refined `TrustedGenerationInputV1` and its final CAS recheck to pin
  `potok-shared-account-gate-v1`, exact preference/safety revisions and the candidate
  manifest revision/digest. Graph v2's existing `catalogManifestRevision` field is
  retained as the wire-compatible graph binding. No Graph v1 function or Graph v2
  structure changed.
- The shared-lock repair design requires entitlement grant/revoke, provisioning,
  activation and future adaptation/replacement to acquire the same account-scoped
  gate first. Capability locks are secondary and lexically ordered. A future reviewed
  migration may replace existing function bodies atomically while preserving
  signatures, grants and audit semantics; no executable repair was created.
- Added 22 exact synthetic authority cases. Focused authorities + Graph v2 tests are
  **52/52 PASS**. The broader Graph v1/activation/composition/balance/Graph v2/
  authority set plus the existing metadata-preflight static suite is **143/143
  PASS**. Strict TypeScript and targeted ESLint are **PASS**. These local tests do not
  prove PostgreSQL locks, RLS, rollback or deployed grants.
- No Supabase connection, SQL execution, runnable migration, schema/RPC/runtime
  change, real snapshot/manifest/publication, recipe eligibility, PLAN/FACT write,
  commit, push or deploy occurred. The current 120 authoring recipes remain
  ineligible and the generator remains OFF. Current HEAD is
  `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`; the Git index remains empty.
- Next checkpoint: owner review of the authority and shared-lock design. Only after
  explicit authorization may a bounded runnable-but-not-applied schema/lock-repair
  draft, SELECT-only preflight, rollback-only acceptance and postcheck be prepared.
  Any STAGING apply would require another separate approval.

## Graph v2 runnable authority/activation review package — 2026-09-27

- Prepared, but did not apply, the bounded Graph v2 server package:
  `docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql`
  (`372b47e424336d9e5d31361d436855f06c0e4efe2df5d3c2fccce5d9c0764483`),
  its SELECT-only preflight
  (`9a52995543ab37000481c32c94d486df047397cda2f39cc2a3283ead4261fe8f`),
  rollback-only acceptance
  (`e1710370a594e8e54824bd1abb7e3507b8ecf0f6a9da82b9ae8f5a4776ca27be`)
  and SELECT-only postcheck
  (`adc6e0abef58f60b58098ecce86702e0556d1e4c31335124c4e15b35e57b3804`).
- The migration is one transaction and adds immutable preference/safety authorities,
  protected manifest v2 storage, Graph v2/receipt fields, version-aware constraints,
  own-account exact reads and protected generation/activation writers. Entitlement,
  provisioning and v1 transition writers retain their signatures/business semantics
  while acquiring the shared account gate first. Protected writers remain unavailable
  to `PUBLIC`, `anon`, `authenticated` and `service_role`; the execution channel is
  explicitly `PROTECTED_EXECUTION_CHANNEL_NOT_YET_BOUND`.
- Server digest checks now match the pure TypeScript boundaries: trusted input wrapper,
  Graph v2 canonical envelope and GeneratedWeekPlan deterministic content are all
  recomputed. Generation receipt creation and activation both recheck entitlement
  evidence, weekly selection/Goal/calendar CAS, preference/safety heads, manifest
  revision/digest and exact manifest component membership. Initial activation writes
  PLAN graph/head/receipt only and emits no event, FACT, diary or replacement effect.
- Added
  `scripts/contracts/adaptive-nutrition-graph-v2-authorities-activation-v1.test.ts`.
  Focused SQL static tests are **11/11 PASS**; authorities, Graph v2 and both SQL
  contract suites are **68/68 PASS**. Strict TypeScript, targeted ESLint and diff
  checks pass. No local PostgreSQL parser is available, so parser/runtime PASS is not
  claimed and none of the SQL artifacts was executed.
- Acceptance uses only rollback-scoped synthetic recipe evidence and the two previously
  verified empty STAGING Auth test accounts. It covers the requested 25 scenarios;
  actual cross-session lock blocking still requires a future explicit two-session
  STAGING acceptance because one rollback transaction can prove common lock-resource
  use and ordering, but cannot create real concurrent sessions.
- No Supabase connection, SQL apply/acceptance, real authority snapshot/manifest,
  recipe eligibility, PLAN/FACT write, runtime wiring, commit, push or deploy occurred.
  Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`; generator and
  protected execution channel remain OFF. Next owner checkpoint is review of the four
  exact hashes, then separate authorization to run only the SELECT-only preflight on
  STAGING `ozidryfvhkcbtpnulakq`. Migration apply requires a later distinct approval.

## Protected execution channel and trusted generation binding design — 2026-09-30

- Owner confirms the Graph v2 authorities/activation package is accepted on STAGING:
  behavioral acceptance PASS, repaired postcheck 41/41, rollback residue zero, Graph
  v1 preserved, shared account gate and FORCE RLS checks PASS. Production remains
  untouched and the generator remains OFF.
- Repository discovery found no `supabase/functions` deployment, backend route,
  worker, queue or scheduler. The product runtime is a Vite SPA/Capacitor client plus
  static GitHub Pages. `src/api/generateAdvice.ts` is a browser stub, not a protected
  backend. Earlier owner evidence found no deployed Edge Function; unknown external
  consumers remain OPEN.
- No product runtime currently invokes the protected Graph v2 mutations. The six
  protected authority/generation functions are postgres-owned, fixed-search-path
  `SECURITY DEFINER` functions with no `PUBLIC`, `anon`, `authenticated` or
  `service_role` EXECUTE path. Both Graph writers additionally require
  `SESSION_USER = CURRENT_USER = postgres`, so a direct service-role grant is neither
  sufficient nor acceptable.
- Added `docs/premium/adaptive-nutrition-protected-execution-channel-v1.md`. The
  recommended minimal architecture is one user-authenticated Supabase Edge Function
  orchestrator, a durable generation request in the existing operations ledger,
  server-derived authority bindings, an unprivileged deterministic generator, trusted
  validation, separate durable record and atomic activation transactions, and an
  exact receipt-bound read after activation.
- Record and activation remain separate because the settled generation receipt is the
  crash-recovery checkpoint. Retry preserves the original request/phase keys; stale
  entitlement, Goal, preference, safety, manifest, policy, selection or plan-head
  evidence fails closed. A background task may improve latency but is not treated as
  durable authority.
- Runtime binding needs a separately reviewed local contract package: authenticated
  request/status RPCs deriving `auth.uid()`, narrow server-only authority-load/record/
  activate gateways, and a safe replacement for the postgres-session sentinel. The
  internal writers keep no direct application-role or service-role grants. Proposed
  reuse of the operations ledger must first pass a deployed constraint preflight.
- Existing writer validation, shared gate, authority rechecks, graph insert, selection
  CAS and receipt settlement do not need redesign. Real generation remains blocked by
  the absence of the orchestrator/channel and by the lack of a proven real published
  candidate manifest containing canonical generator-eligible recipes. Synthetic
  acceptance content is not product content.
- No SQL/Supabase call, DB/Edge/runtime activation, production change, commit, push or
  deploy occurred. The next bounded package is local DTO/lifecycle/gateway SQL design
  plus synthetic tests. Any STAGING apply or Edge deployment requires a later,
  separate owner checkpoint.

## Protected execution binding local review package — 2026-09-30

- Current HEAD remains `4a0e47a8f41cb13aa01218139e5193ade0ae32ef`. Prepared the
  local-only Edge request/status DTO and recovery orchestrator under
  `supabase/functions/adaptive-nutrition-generate-v2/`; the real generator and trusted
  validator are explicitly `null`, so no record or activation call is reachable.
- Prepared the runnable-but-not-applied protected binding migration
  `docs/premium/drafts/20260930_adaptive_nutrition_protected_execution_binding_v1.sql`
  (`dabee8eee73060ce04ab02ba78168c26c739c2c4c944440aad66631088cd232d`),
  SELECT-only preflight
  (`4b5693accf35d9e3695fc3d8a4ff1808bfe1b15e281bb2f8e604e8f91cf4c887`),
  rollback-only acceptance
  (`291ce5670cdc79d4bf08e803c71adb7a4b005e613f1c752abe1bd335369c440a`)
  and SELECT-only postcheck
  (`390e375201d34b81992ea9027f91983351aab9f6cb5d0f7a4e207982368a5feb`).
  None was executed and no PostgreSQL parser/runtime PASS is claimed.
- The package adds authenticated request/status boundaries, a protected durable
  lifecycle projection and exactly three `service_role` gateways. The six internal
  authority/Graph functions retain no application or direct `service_role` EXECUTE.
  The two Graph writers become fixed-search-path `SECURITY INVOKER` functions with a
  `CURRENT_USER=postgres` sentinel, so only an owner session or reviewed postgres-owned
  definer gateway can cross the internal boundary.
- Goal nutrition corridors are not inferred from `user_goals`. An immutable reviewed
  `GoalNutritionTargetV1` authority binds exact account, Goal revision and target-policy
  revision; the migration publishes neither target nor policy rows. Real requests
  therefore remain fail closed until separate evidence publication. The acceptance
  uses only rollback-scoped synthetic target/policy/manifest data.
- Owner-run preflight exposed invalid schema qualification of SQL-special-form
  `COALESCE` (`ERROR 42883`). Local repair removed only `pg_catalog.` from five
  preflight, six postcheck and two migration expressions; acceptance had no
  same-class occurrence. Query and migration semantics are otherwise unchanged.
- Focused protected-channel plus existing Graph-v2 SQL regression: **79/79 PASS**.
  Broader Graph v1, activation, Meal Composition, Balance/Goal, authorities and Graph
  v2 regression: **164/164 PASS**. Full project TypeScript, strict standalone Edge/test
  TypeScript and targeted ESLint pass. Preflight/postcheck are one SELECT-only statement;
  acceptance has one `BEGIN`, no `COMMIT` and final `ROLLBACK`. Diff and secret scans pass.
- No Supabase call, SQL apply, Edge deploy, generator activation, manifest/policy/target
  publication, PLAN/FACT/diary/replacement write, commit, push or production change
  occurred. The Git index remains empty. The 229-file owner baseline is byte-identical
  at SHA-256 `b095d79bac22f6e2c784870e25b4d8af29dc256e152964072e05762cdb0a8936`.
- OPEN blockers: deployed ledger preflight evidence, reviewed real policy/Goal-target
  publication, real canonical generator-eligible manifest, real generator implementation,
  trusted-validator binding and live PostgreSQL/Edge acceptance. Next owner checkpoint is
  authorization to run only the exact SELECT-only preflight on STAGING
  `ozidryfvhkcbtpnulakq`; migration apply and Edge deployment remain separate approvals.

## Protected execution binding accepted on STAGING — 2026-10-03

- Owner-run STAGING evidence for project `ozidryfvhkcbtpnulakq` closes the protected
  execution server checkpoint: migration applied, auth-contract repair applied,
  schema-USAGE repair applied, rollback-only behavioral acceptance reached its final
  `ROLLBACK`, and the final SELECT-only postcheck passed **15/15** with zero fixture
  residue. Graph v2 exact receipt-bound read passed, Graph v1 remained preserved,
  `service_role` retained exactly three narrow gateway EXECUTE paths, and direct
  EXECUTE on the internal six functions remained denied.
- Final local artifacts matching that accepted checkpoint are: protected binding
  migration SHA-256
  `dabee8eee73060ce04ab02ba78168c26c739c2c4c944440aad66631088cd232d`,
  preflight `4b5693accf35d9e3695fc3d8a4ff1808bfe1b15e281bb2f8e604e8f91cf4c887`,
  behavioral acceptance
  `c3d64119cba5cfdb821d6c0d81ee90d42bbd852196270371305b97cecf985069`,
  postcheck `525af330cb018600928d1a9c3ab38def3d090c96e9f8bac529d2181152018050`,
  auth-contract repair
  `0cf5bb96c64fcf5da8be978b0017b28e08d1241b5c1b5d2eb4021c825b160a53`,
  and schema-USAGE repair
  `f15ce100b65a8c61e00ff6ed2c3f206d5bb30803df2369e85cbae805ca7b0463`.
- The accepted Graph v2 persistence/authority foundation remains represented by the
  migration SHA-256
  `372b47e424336d9e5d31361d436855f06c0e4efe2df5d3c2fccce5d9c0764483`;
  its latest repaired SELECT-only postcheck is
  `198048a1a4e7abc012442ae8ab4c28bb32cf50f8e21913c29187ec2f75a9bc5d`.
- Edge remains **NOT DEPLOYED**, the real generator and trusted validator remain
  **NOT ACTIVATED**, no real candidate manifest/policy/Goal-target publication was
  performed, and production remains untouched. The local Edge skeleton keeps both
  generator and validator bindings disabled and is not runtime evidence.
- Current Git checkpoint preparation is read-only apart from this resume update:
  no staging, commit, push, Supabase call, Edge deploy or production change. The Git
  index remains empty and the recorded 229-file owner baseline remains byte-identical
  at SHA-256 `b095d79bac22f6e2c784870e25b4d8af29dc256e152964072e05762cdb0a8936`.
- Remaining product blockers are real generator implementation, reviewed trusted
  validator binding, and publication of real policy/Goal-target/canonical recipe
  manifest evidence. They are future work and are not part of this accepted server
  checkpoint.
