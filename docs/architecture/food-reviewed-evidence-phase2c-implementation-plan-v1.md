# Phase 2C — final implementation plan A/B/C

Source commit: `23ec8015c3433b81cbd0f63885fed69cb0388388`.
Branch: `codex/food-reviewed-evidence-v1-phase2b`.
Status: **PLAN ONLY**; not migration apply, not runtime activation, not approval of account-flow changes.
Prepared 2026-10-09. Existing decisions: retryable global account lifecycle,
durable shared-food archive, PII minimization, no archived identity reuse,
no automatic evidence CASCADE. Original-UUID audit-subject anchor remains NOT APPROVED.

## 1. Decision and dependency graph

| Gate | Decision now | Exact reason |
|---|---|---|
| Isolated disposable DB testing | **GO — architecture**; execution here **BLOCKED / NOT VERIFIED** | Synthetic actors/data, own socket-only cluster; B/C are not needed to prove existing A enforcement. This environment has Node 24.19.0 but no initdb/pg_ctl/psql. |
| Persistent Staging rollout | **BLOCKED** | Actual PostgreSQL acceptance and real JWT/PostgREST tests missing; retention/erasure and new FK account impact unresolved; archive/importer concurrency and lifecycle integration unverified. No apply authorization. |
| Production / Main | **BLOCKED** | Main lacks required trusted infrastructure; no is_admin fallback; A Staging-first package cannot be deployed to Main. B/C, privacy policy, external lifecycle and rollout approval also missing. |

A baseline DB tests -> A security acceptance -> A integration review.
B policy decisions -> B design/security acceptance -> account lifecycle integration.
C lock/identity/privacy decisions -> C acceptance -> importer/resolver integration.
A+B+C integration -> separately approved Staging apply -> controlled synthetic
Staging acceptance -> separate runtime/production decisions.

Full B is not a dependency of A's pure or synthetic DB tests. C is not needed to
demonstrate current RESTRICT/hidden-root guards. Neither baseline test proves
physical account deletion or durable archive. Do not remove FK, relax grants,
disable immutability/RLS or stub entitlement authorization to make tests pass.

Persistent Staging cannot bypass B/C by calling its data “test”: real reviewer
UUID/attestations remain personal data and immutable receipts retain them.
A temporary disposable project/clone would need its own explicit creation,
teardown and data authorization; this plan authorizes no such operation.
“Runtime unmounted” also does not prove RPC inertness once EXECUTE is granted.

### Facts inherited from read-only inventory, not newly queried here

- Staging: 109 catalog FK, seven direct auth.users RESTRICT dependencies:
  access_attestations, adaptive_nutrition_operations,
  adaptive_nutrition_generation_requests_v2, adaptive_nutrition_goal_targets_v1,
  nutrition_authority_heads_v1, nutrition_preference_snapshots_v1,
  nutrition_safety_snapshots_v1.
- Existing Adaptive graph/selection/event relationships are cyclic and guarded;
  deleting only Food references cannot implement account deletion.
- Main: 117 FK; no direct auth.users RESTRICT in that snapshot, but personal
  columns such as profile.id_user, diary.user_id and measurement.user_id lack FK.
  Absence of FK is not absence of personal data or cleanup work.
- Food Evidence tables and archive guards were absent in both snapshots.
- Staging profile uses user_id + admin provenance/expiry; Main uses id_user/is_admin.
- Both foods SELECT policy sets do not filter is_searchable. Main DELETE policy
  uses ownership without source=user; Staging foods admin writes use legacy flag.
  New security boundaries must not rely on those policies as trusted authority.
- Database owner/privileged DDL and external deletion jobs are not protected by
  client RLS. Function behavior, outside-Git runbooks, Storage objects, backups
  and offline devices remain separate verification requirements.

## 2. A — Food Evidence: before persistent Staging rollout

### A1. Freeze existing security and wire baseline

Existing exact implementation files:
- `docs/architecture/food-reviewed-evidence-contracts-v1.md` — Phase 1 wire authority.
- `src/server/foodEvidenceReviewRequestV1.ts`
- `src/server/foodEvidenceReviewGatewayV1.ts`
- `src/utils/foodReviewedEvidenceV1.ts`
- `src/utils/adaptiveNutritionWireV1.ts` — compatibility reference, no planned semantics change.
- `src/server/__tests__/foodEvidenceFixturesV1.ts`
- `src/server/__tests__/foodEvidenceReviewServerV1.test.ts`
- `src/utils/__tests__/foodReviewedEvidenceV1.test.ts`
- `scripts/contracts/food-evidence-disposable-db-v1.test.ts`

Existing unapplied drafts, not automatically active migrations:
- `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql`
- `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.preflight.sql`
- `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.postcheck.sql`
- `supabase/migration_drafts/food_reviewed_evidence_v1_retention_inventory.sql`

Mandatory invariants: checked JWT actor/session; effective existing admin
attestation, no client actor/authority/time and no is_admin fallback; six private
ENABLE/FORCE RLS tables, closed direct ACL, qualified SECURITY DEFINER RPCs,
restricted EXECUTE; exact raw/duplicate boundary and domains; no importer trust.
Approvals/rejections/invalidations atomic; rejection has no fake revision.
Five immutable tables remain immutable, current heads only guarded projection.
All sixteen FK retain RESTRICT; do not replace with CASCADE or hashed SET NULL.

### A2. Execute real local PostgreSQL acceptance and repair only proven failures

Run current baseline suite from section 7. Check PostgreSQL parsing/constraints,
actual roles/ACL/RLS, source integrity, digest agreement, rollback, real parallel
sessions and exact retries. Re-run relevant Phase 1/Adaptive/Food regressions
after any justified A repair; an exit 0 with skip is not acceptance.

Mandatory additional acceptance coverage before rollout, if not already proven:
- Canonical/proposal/source/digest mismatch, unknown/duplicate/raw negative zero.
- Actor/key conflict vs exact retry; two different reviewers racing same head.
- JWT/session expiry after lock wait; authority revocation and grant/review
  serialization; verify same actor ADMIN gate matches actual trusted package.
- Read/receipt isolation, anonymous/non-admin, direct table/helper/EXECUTE denial.
- Both invalidation severities, monotonic SAFETY_CRITICAL, no historical head rollback.
- SQL output bytes match TypeScript Phase 1; Adaptive deny-default number policy unchanged.
- Phase 1 artifacts contain no generated decoder defaults; server generation
  belongs only to authenticated issuance.
- Existing food/alias/diary/history snapshots unchanged by A.
- Missing/wrong Main infrastructure fails before any partial object creation.

For a real JWT/PostgREST boundary a separate, unmounted test harness is proposed:
`src/server/__tests__/foodEvidenceReviewPostgrestV1.integration.test.ts`
and `docs/architecture/food-reviewed-evidence-staging-acceptance-v1.md`.
These paths do not exist as part of this plan. It must use an approved isolated
Auth/PostgREST environment or separately authorized synthetic Staging actors.
No public route, service-role substitution or real reviewed evidence issuance.
Locally injected request.jwt.claims tests cannot prove signature verification.

### A3. Operational/privacy integration gates, no schema shortcut

Before apply, agree bounded retained-source/request sizes, reason/text/mapping
limits and resource/rate/time limits. Existing gateway AND SQL review RPC reject
requests above 1 MiB; the SQL check is before JSON parsing. Direct RPC access is
therefore already byte-capped, but byte cap is not rate, recursive-depth or per-field
resource protection. Verify exact-limit/over-limit behavior through both boundaries;
reject explicitly without source/decimal normalization or silently changing
Phase 1 wire. Any additional approved budget enforcement belongs in A SQL/tests,
not only the unmounted HTTP wrapper. Rate/concurrency budget needs its own decision.

A needs B's approved retention model and a plan for all original actor/source/
receipt copies before persistent issuance. No unconditional audit-subject anchor.
If B introduces closure fence, integrate it in authority/review/receipt/current
and recheck after lock waits, without granting new entitlement capabilities.
If C is added, integrate its archive usability and common lock order in A;
receipt recovery remains historical, not current permission or food usability.

Potential subsequent A integration draft, **proposed only**:
`supabase/migration_drafts/food_reviewed_evidence_v1_lifecycle_integration.sql`.
It must not contain a guessed B/C schema. Required references and triggers are
implemented only after their designs/retention and apply scopes are approved.
No Phase 1 wire fields/domain are silently rewritten to remove PII.

A readiness: zero mandatory skips/failures, real JWT verification evidence,
metadata/behavioral postcheck, privacy/closure/archive prerequisites accepted,
resource budget approved, no regression or data mutation to legacy foods/diary,
explicit Staging apply approval. A may be independently reviewed/committed and
tested locally; permanent rollout is gated above. Migration installation and
RPC activation are separate approvals, not automatic after test PASS.

## 3. B — global account deletion lifecycle (separate architecture)

### Boundaries and exact work packages

B spans Auth, trusted-entitlement, Adaptive, ordinary personal records,
Storage, support flows, offline queues, backups/replicas/exports. It is not a
Food-only migration and does not create a second entitlement grant ledger.

Existing dependency files for analysis/integration, not approved changes:
- `src/context/AuthContext.tsx`, `src/pages/Profile.tsx`
- `src/services/profileService.ts`, `src/services/measurementsService.ts`
- `src/services/recipeImagesService.ts`, `src/services/userExerciseMediaService.ts`
- `src/services/foodService.ts`, `src/services/supportService.ts`
- `docs/premium/drafts/20260921_trusted_entitlement_v2.sql`
- `docs/premium/drafts/20260921_trusted_entitlement_v2_1_repair.sql`
- `docs/premium/drafts/20260921_trusted_entitlement_v2_2_repair.sql`
- `docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.sql`
- `docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.sql`
- `docs/premium/adaptive-nutrition-server-draft-v1.md`

Proposed future paths (NOT created/implemented now):
- `docs/architecture/account-deletion-lifecycle-v1.md`
- `src/server/accountDeletionLifecycleV1.ts`
- `src/server/__tests__/accountDeletionLifecycleV1.test.ts`
- `scripts/contracts/account-deletion-disposable-db-v1.test.ts`
- `supabase/migration_drafts/account_deletion_lifecycle_v1.sql`
- `supabase/migration_drafts/trusted_entitlement_v2_account_closure.sql`
- `supabase/migration_drafts/adaptive_nutrition_account_retention_v1.sql`
- `supabase/migration_drafts/food_reviewed_evidence_v1_retention_protocol.sql`

These are distinct reviewed packages, not replacements for already applied
historical migrations. Active timestamped migrations are chosen only at approved
rollout; no Main compatibility inferred from Staging drafts.

### Lifecycle and dependencies

1. REQUESTED: verify ownership/identity server-side; explicit key + exact digest;
   private bounded target mapping, typed minimal receipt, conflicts rejected.
2. ACCESS_CLOSED: existing admin->premium gates + approved global closure fence;
   revoke through trusted writers; deny new grant/issuance/Adaptive writes and
   recheck after waits. Revoke alone cannot prevent a later grant.
3. DATA_CLEANUP: dependency manifest includes seven deployed auth RESTRICT blockers,
   Adaptive cycles/triggers and non-FK personal columns. Each data class gets
   approved cleanup/retention disposition. No unauthorized ALTER/trigger disable.
4. STORAGE_CLEANUP: supported Storage API + derivatives/CDN cleanup; bounded
   retries and per-object completion. SQL metadata DELETE is not blob deletion.
5. AUTH_DELETE_PENDING -> AUTH_DELETED: only supported, approved Auth Admin flow
   after all FK/trigger blockers handled by agreed protocol. Retry after response
   loss must not delete a new/different account. SignOut is not deletion.
6. RETENTION_PENDING -> COMPLETE: online erasure verification, bounded mapping
   cleanup, backup expiry/restore deny and offline residual status. A delayed
   cleanup step never restores access. AUTH_DELETED != full erasure complete.

Original-UUID anchor is not an accepted B implementation. First resolve whether
original personal envelopes have legally justified finite restricted retention
or an approved auditable erasure/checkpoint protocol. Preserve authority proof
and cryptographic commitment chain; do not present an unverified hash as
provenance. A new retention certificate is a separately versioned artifact,
not a rewritten original Phase 1 event. If plaintext is deleted, old plaintext
byte-verification cannot remain available: owner must explicitly accept that
proof boundary or justified retention exception. No certificate schema/signing
or key management is selected by this plan.

Minimal long-lived duplicate-deny/restore fence can itself identify a subject;
choose privacy-safe scope, access, identifiers and lifetime before implementation.
No infinite raw UUID registry or remapping historical digests by default.

Tests: exact retry/conflict and partial-step recovery; concurrent grant/review/
generation vs closure; stale JWT/session/refresh; Auth response-loss recovery;
all FK paths/cycles and statement triggers; no cross-account/tenant cleanup;
Storage derivative failure; no offline resync resurrection; backup restore
reconciliation; no loss/mutation of remaining food authority/history;
personal-copy manifest coverage; audited retention expiry/legal-hold cases.

B readiness: approved retention/proof policy and durations; known complete
dependency/owner manifest; reviewed Auth/storage/support runbook; real disposable
schema acceptance and later separately permitted Auth/Storage acceptance;
all failures leave access closed; no indefinite account-delete blocker introduced.
B design/tests can proceed separately. Existing account/UI deletion flow or
trusted/Adaptive schemas may change only after separate owner approval.
A full B rollout can be broader than Food and must have independent review.

## 4. C — durable shared-food archive guard (separate component)

Existing integration files:
- `scripts/import-food-core.ts`, `scripts/import-food-core.test.ts`
- `src/services/foodService.ts` and catalog/resolver tests actually affected.
- A SQL review/current RPCs and disposable suite paths from section 2.
- `supabase/foods_schema.sql` is reference, not a silent rewrite of deployed schema.

Proposed future paths, not created now:
- `docs/architecture/shared-food-archive-guard-v1.md`
- `supabase/migration_drafts/shared_food_archive_guard_v1.sql`
- `supabase/migration_drafts/shared_food_archive_guard_v1.preflight.sql`
- `supabase/migration_drafts/shared_food_archive_guard_v1.postcheck.sql`
- `src/server/sharedFoodArchiveRequestV1.ts`
- `src/server/__tests__/sharedFoodArchiveGuardV1.test.ts`
- `scripts/contracts/shared-food-archive-disposable-db-v1.test.ts`

Private durable marker binds existing foods.id + exact stable_food_id, server
archive time and approved minimal checkpoint reference. No new food identity.
Personal actor/authority/reason/receipt audit is separated and bounded by B policy;
its integrity binding must be designed, not omitted as an enforcement claim.
Only trusted-attestation archive RPC can create marker. Exact actor/key retry
has one terminal result, conflicting bytes reject. Archive is not INVALIDATION
or automatic safety evidence; Phase 1 union remains unchanged.

Guard requirements:
- OLD shared scope cannot become private to bypass DELETE; protect identity/key
  reassignment. Preserve ordinary owned user-food deletion where not shared history.
- Marked root cannot regain searchable status, even by importer/admin upsert.
  Fail entire mutation, no silent coercion; importer handles typed terminal error.
- Block delete/reinsert and creation of different ID with archived stable key.
  Marker must remain independently durable; no expiry/delete/unarchive shortcut.
- Protect TRUNCATE and guard/marker ACL. Superuser/DDL remains trusted operational
  boundary, not something RLS can make impossible.
- Preserve aliases, diary and historical nutrition; archive is catalog usability,
  not removal of old records. Direct-ID/alias/cache readers need explicit semantics:
  current SELECT policies still expose non-searchable rows.
- Solve lock order across importer UPDATE (row lock first), A (food gate then row),
  archive and entitlement gates. A row trigger taking a gate after row lock can
  deadlock with existing A. Choose reviewed unified ordering/pre-lock API or
  row-lock-first architecture; do not silently patch all legacy writers.
- Main archive cannot use an is_admin-only authority fallback. Either separately
  approved trusted Main infrastructure or fail-closed unavailability.

Tests: archive/archive retry + conflict; archive/approval/invalidation races;
importer reactivation; OLD source reassignment escape; same-ID/stable-key reuse;
TRUNCATE/direct privilege denial; hidden unmarked root distinction; history hashes
unchanged; private-food deletion; alias/direct-ID/cache usability; concurrent lock
ordering/deadlock recovery; expired/revoked reviewer; failed archive transaction
leaves no marker or partial food change; bounded audit copy retention.

C can be designed/tested with synthetic identities without full B. It can be
installed independently of Food Evidence only when trusted authority, archive
audit retention, all legacy write semantics and lock ordering are approved.
An immutable marker storing raw actor forever is not an acceptable independent
shortcut. Applying foods triggers/importer changes still requires separate approval.

## 5. Retention matrix — proposed disposition, no cleanup executed

“PII possible” is based on shape/metadata, not reading production payloads.
No numeric duration is inferred; immutable does not mean infinite legal retention.
Parameters must be explicit approved values with purpose/owner/legal holds and
review deadlines. “Minimum” describes necessity, not a made-up number of days.

| Category | PII/linkability | Purpose | Minimum necessary retention | Removal mechanism to approve | Owner decision |
|---|---|---|---|---|---|
| Shared food revisions and canonical bytes | Possible names/free text; reviewEventId links reviewer | Historical food identity/nutrition and dependency integrity | Non-personal history while dependent artifacts remain valid; bounded personal envelope | Keep non-personal bindings; no rewrite of original hashes; approved retention protocol for personal portions | What is truly non-personal, historical proof requirement |
| Retained sources: snapshot + bytes | High possibility: text/images/document IDs/URLs/tokens | Reproduce exact reviewed source | Raw bytes only for justified review/audit window or explicit exception | All-copy auditable erasure or approved encrypted envelope expiry; no silent SET NULL/cascade | raw_source_retention_max; lawful exceptions; proof after byte removal |
| Event snapshot + canonical bytes + actor/authority + reason | Stable UUID, exact times, free reason, embedded source | Review/rejection/invalidation provenance | Minimal verified decision/authority proof; raw identity only justified finite term | New retention/checkpoint protocol, controlled expiry of every original copy | raw_event_retention_max; minimal_audit_retention; signer/proof semantics |
| Requests/proposal bytes/idempotency/receipts | Proposal/free text, source copies, actor/key; receipt embeds event/revisions | Exact retry/conflict + rejection provenance | Approved retry window, then minimized duplicate-deny proof | Manifested expiry after terminal reconciliation, no UUID/key reuse loophole | idempotency_window, receipt_retention_max, privacy-safe deny mechanism |
| Current heads and archive marker | Food IDs/key usually non-personal; checkpoint link may identify | Current usability and permanent identity reuse denial | Operational non-personal identity guard while catalog identity may be reused | No automatic marker purge; personal audit separate | Marker fields and linkability; explicit unarchive policy, if ever |
| Trusted entitlement ledger | account_id, evidence_ref/reason, operator role/time/lineage | Historical proof of effective admin/premium authority | Minimal verifiable authority chain; bounded identifying envelope | Separate trusted immutable retention protocol; never ad hoc UPDATE/delete | entitlement_raw_retention_max, authority audit proof/exception |
| Adaptive operations/events/graphs/snapshots/receipts | Health/preference/goal data and account links | Plan history, PLAN != FACT and idempotent processing | Approved personal/health retention only; minimized required provenance | Separate retirement protocol for cycles/immutable triggers and all copies | adaptive_retention_max; health-data/legal purpose; lifecycle integration |
| Profile/Auth sessions/identities and personal app rows | Direct identity/health/contact | Active account functionality | Until approved closure/cleanup plus finite necessary exceptions | Supported Auth deletion, scoped application cleanup including no-FK fields | cleanup_sla; account-flow approval; owned vs shared-content rule |
| Storage/photos/derivatives/CDN | Personal images, paths/metadata | User assets | Account-owned assets until closure/justified exception and bounded cache expiry | Supported Storage API + object/derivative manifest, not SQL metadata deletion | storage_cleanup_sla, ownership rules and cache expiry |
| Closure mapping/support/logs/exports | Re-identifies prior actor/audit artifacts | Retry, reconciliation, security obligations | Finite retry/support/audit purpose, restricted minimum | Policy expiry and external system acknowledgment | mapping_ttl >= approved reconciliation window; support/log terms |
| Backups/replicas | Original UUID/plaintext may persist | Disaster recovery | Explicit bounded backup window and reviewed holds | Backup expiry and restore-time deletion reconciliation; encryption only if actually reviewed | backup_retention_max; who verifies restored data cannot reactivate |
| localStorage/IndexedDB/offline queues/cache | Profile/measurements/food/notes and stale credentials | Offline UX and sync | Purge available devices on closure; explicit unreachable-device residual | Device/account-scoped purge on contact + server rejects retired-account replay | Offline residual disclosure, key manifest, reconnect/deny policy |

All source copies include retained_sources.snapshot/source_bytes, events.snapshot/
canonical_bytes, request canonical_request/original_proposal_bytes/receipt, exported
receipts and backups. Source-table removal alone is not erasure.
Hashes/opaque IDs can remain linkable; no claim of irreversible anonymity from UUID
unlinking. Crypto-erasure is not implemented and cannot destroy shared-source
verification for other subjects without dependency analysis.
Retain/revoke proof cannot be replaced by client-declared authorityReference.
Legal holds must have scope, owner and review/expiry; no default forever.

## 6. Independent deployment and sequencing

1. Freeze source/ref and run A pure + DB baseline in disposable environment.
2. Fix actual A SQL failures under separate bounded repair, without weakening guards.
3. Approve B retention/proof/closure and C privacy/lock designs. Implement/test
   independent drafts, then combined deployed-schema-shaped fixtures without PII.
4. Run A+B+C compatibility across real Staging metadata-shaped Auth/profile/
   entitlement/Adaptive schema; test deletion and archive paths, not just bare A fixtures.
5. Separate owner apply review: exact project/versions, backup/cleanup/retention,
   role/access/resource budget, operator responsibilities and pass evidence.
6. Only after explicit approval: controlled Staging apply/postcheck and separately
   authorized synthetic integration. No user runtime/generator activation by default.
7. Main requires its own trusted migration/preflight and production review; never
   roll the Staging draft into Main based on matching flag/table names.

Pre-write failure rollback and preflight all-or-nothing are testable. Once original
events exist, rollback is not DROP/CASCADE/purge evidence. A failed rollout stays
fail-closed/inactive while compatible forward repair is reviewed; capture a
concrete recovery runbook before apply. Permanent archive must not be “rolled back”
by deleting markers, nor deletion by reactivating retired subjects.

## 7. Exact disposable PostgreSQL launch plan

Architecture GO, not an assertion this environment can execute it. No binaries
are installed and no containers/network/project writes are launched by this plan.

Prerequisites in an authorized local/disposable Linux/macOS environment:
- non-root OS user, Node 24 and installed locked project dependencies;
- PostgreSQL 17+ initdb/pg_ctl/psql from one installation on PATH; pgcrypto available;
- writable private temporary directory, local process/Unix socket permission,
  enough time/disk for cluster, no shared production data directory;
- exact source commit 23ec8015... (or reviewed repair ref), no working-tree source changes;
- no Supabase credentials, URLs or external database are required.
The runner strips PG/credential environment for PostgreSQL subprocesses and has
no external DB URL option. Do not substitute a remote connection when missing tools.

Read-only prerequisite checks, run separately:

```sh
git rev-parse HEAD
git status --short
node --version
id -u
initdb --version
pg_ctl --version
psql --version
```

From the isolated worktree/repository root, using existing dependencies:

```sh
node --import tsx --test --test-isolation=none \
  src/utils/__tests__/foodReviewedEvidenceV1.test.ts \
  src/server/__tests__/foodEvidenceReviewServerV1.test.ts
```

Required DB gate, not default SKIP mode:

```sh
POTOK_FOOD_EVIDENCE_REQUIRE_DB=1 node --import tsx --test --test-isolation=none \
  scripts/contracts/food-evidence-disposable-db-v1.test.ts
```

Runner creates own tmpdir cluster, Unix-socket-only/0700, no TCP listener,
pgcrypto + synthetic auth/users/sessions/catalog/diary; loads actual reviewed
trusted-entitlement v2/v2.1/v2.2 and two Adaptive duplicate/canonical SQL helpers,
then the actual Food SQL draft. Uses psql -X/ON_ERROR_STOP and parallel real sessions.
Local trust authentication is confined to the private disposable socket; client
database roles and protected RPC/table ACL remain actually tested, not disabled.
Synthetic auth.jwt()/auth.uid() simulate verified PostgREST claims only. This is
not real JWT cryptographic verification and not a deployed-schema deletion suite.

Capture complete command/version/source and TAP results outside repository;
redact fixture tokens even from failure logs before sharing. On SQL error retain
logs only as needed for review and report FAIL, not unverified success.
The runner stops its cluster and removes its own tmpdir in finally. If a crash
leaves resources, inspect its exact local pid/data directory first; never stop
a shared server or delete a wildcard directory.

Baseline acceptance gates:
- exit 0, top-level DB test actually executed, every required subtest passes,
  no SKIP/TODO, no weakened fixture authority or changed constraints;
- all real races and sixteen-FK conservation cases run, no partial receipt/events;
- pure TypeScript receipt/digest validation agrees with SQL output;
- git status shows no source mutation after run.
Then run existing scoped typecheck/lint and related regressions for any actual
code repair. Full authorization/JWT/Auth/Storage and B/C claims remain NOT VERIFIED
until their distinct suites run; isolated A PASS alone cannot lift Staging gate.

## 8. Open approvals, not an implementation license

1. Exact post-erasure authority/integrity proof, signing/key/access model and
   finite original personal-data retention/exception — no original-UUID anchor approval.
2. Numeric matrix policy, legal holds, external/backups/offline verification owner.
3. Global closure fence and supported Auth/support flow change; trusted/Adaptive repair.
4. C actual foods/trigger/importer/resolver scope, identity reuse and lock order;
   minimized personal archive audit, not indefinite embedded actor fields.
5. Resource budgets and separately authorized Staging apply/integration environment.
6. Main trusted authority architecture and separate production go/no-go.

Current deliverable is this document only. No SQL executed, Supabase contacted,
runtime/account flow/schema changed, migration applied, commit, push or merge.
