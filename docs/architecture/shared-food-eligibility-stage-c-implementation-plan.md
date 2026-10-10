# Stage C implementation / verification / rollout plan

DESIGN ONLY, no implementation/apply approval implied. Companion specification:
[Stage C design and writer matrix](shared-food-eligibility-stage-c-design.md).
Pinned #156 HEAD d45b3fefbb9358438391d28a14e73c03e5621aa4. Preserve frozen #154/#155/#156.
GO: design and future isolated implementation review. BLOCKED: all-writer compatibility,
Staging/Main/production, runtime activation and persistent rollout.

## C0 — Deployed read-only inventory (BLOCKED, not executed)

Owner must identify each environment/project and explicitly authorize metadata-only
access. Main and Staging are separate inventories; never infer parity. Use approved
read-only principal, BEGIN READ ONLY with short statement timeout set by the owner,
no RPC execution or DDL. Do not export payloads, credentials, JWTs or user identifiers.
Exact inspection queries below are proposals, NOT commands run in this task.

```sql
SELECT current_database(), current_user, current_setting('server_version'),
       current_setting('default_transaction_isolation');
SELECT c.oid::regclass AS relation, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c WHERE c.oid IN (to_regclass('public.foods'),
  to_regclass('public.user_profiles'), to_regclass('auth.users'),
  to_regclass('auth.sessions'));
SELECT policyname, roles, cmd, permissive, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN ('foods','user_profiles');
SELECT r.rolname, r.rolsuper, r.rolbypassrls, r.rolinherit,
       has_table_privilege(r.oid,'public.foods','SELECT') AS can_select,
       has_table_privilege(r.oid,'public.foods','INSERT') AS can_insert,
       has_table_privilege(r.oid,'public.foods','UPDATE') AS can_update,
       has_table_privilege(r.oid,'public.foods','DELETE') AS can_delete,
       has_table_privilege(r.oid,'public.foods','TRUNCATE') AS can_truncate
FROM pg_roles r WHERE r.rolname !~ '^pg_';
SELECT grantor, grantee, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='foods';
SELECT pg_get_userbyid(roleid) AS role, pg_get_userbyid(member) AS member,
       admin_option FROM pg_auth_members;
SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='foods';
SELECT conname,conrelid::regclass,confrelid::regclass,
       pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.foods'::regclass OR confrelid='public.foods'::regclass
   OR confrelid='auth.users'::regclass;
SELECT t.tgrelid::regclass,t.tgname,t.tgenabled,t.tgisinternal,
       t.tgfoid::regprocedure,pg_get_triggerdef(t.oid)
FROM pg_trigger t WHERE t.tgrelid IN ('public.foods'::regclass,'auth.users'::regclass,
  'public.user_profiles'::regclass);
SELECT p.oid::regprocedure, n.nspname, p.prosecdef, p.provolatile,
       pg_get_userbyid(p.proowner) AS owner, p.proacl,
       md5(pg_get_functiondef(p.oid)) AS definition_checksum
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prokind='f' AND n.nspname IN ('public','potok_control','potok_food_evidence',
  'potok_shared_food_eligibility');
SELECT p.oid::regprocedure,r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE')
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
WHERE p.prokind='f' AND n.nspname IN ('public','potok_control','potok_food_evidence',
  'potok_shared_food_eligibility') AND r.rolname IN ('anon','authenticated','service_role');
SELECT d.datname, r.rolname, setting
FROM pg_db_role_setting s LEFT JOIN pg_database d ON d.oid=s.setdatabase
LEFT JOIN pg_roles r ON r.oid=s.setrole CROSS JOIN LATERAL unnest(s.setconfig) setting
WHERE split_part(setting,'=',1) IN ('default_transaction_isolation','statement_timeout','lock_timeout');
SELECT schemaname,tablename,pubname FROM pg_publication_tables
WHERE schemaname='public' AND tablename='foods';
```

Checksums do not replace body review: authorized reviewer inspects sanitized local
function definitions (including recompute_food_entries_for_food_ids, owner-apply,
derived triggers, account deletion, transitive dynamic SQL). Never paste raw bodies
containing embedded secrets. Inspect relevant function proconfig locally for
search_path/isolation; report only allowlisted settings. Internal FK triggers and
indirect writes must be followed beyond initial foods triggers.

Operator inventory additionally needs PostgREST exposed schemas/roles/version,
transaction settings and supported error fields, scheduled jobs, external ETL/COPY,
logical replication subscribers/writers, trigger-disable/maintenance scripts and
Auth deletion flow. Inspect statement templates/aggregates only if logging/pg_stat
access is already approved; no raw query payloads or invented proof from absent logs.
A finite observation interval is not proof a dormant writer cannot run.

Deliverables: per-environment exact function/index/policy signatures; effective
permissions including inheritance/column grants; writer owner/job registry and
transaction-entry evidence. Unknown writer or missing function = BLOCKED.

## C1 — Contract and authority design gate (separate approval)

Files to implement after approval: the two SQL drafts in #156 (in a new implementation
branch), typed private/catalog batch server adapters and their tests. Proposed new
server files: src/server/catalogWriterRequestV1.ts and src/server/catalogWriterGatewayV1.ts;
reuse scripts/contracts/catalogTransactionRetryV1.ts semantics after driver review.
Do not add new wire/digest changes to Phase1. No new runtime imports at this stage.

Decide typed create/update/delete and insert/id-upsert/normalized-upsert/DO NOTHING
modes, allowed fields, batch cap, per-operation authority, ownership collision
behavior, durable receipt versus fail-stop reconciliation. Do not use is_admin or
service_role as sole proof. Unknown machine authorization remains BLOCKED.
Map actual conflict index exactly, including expression/NULL semantics; never fix
index/global private uniqueness implicitly. Owner-apply dependent draft lock must
follow catalog gate consistently with all related RPCs. C0 findings may block this
part rather than justify changing legacy RPCs without approval.

## C2 — Disposable implementation and acceptance

Use own Unix-socket-only PostgreSQL17+ with Node24, no external DB URL. Start from
pinned implementation objects plus sanitized exact schema/ACL/trigger signatures
from C0; no copying personal rows. Existing #156 synthetic schema is insufficient
to prove expression-index/role parity. Run required DB=1 with zero SKIP/TODO.

Acceptance matrix (all must be real PostgreSQL where labeled DB):

| Area | Scenarios | PASS criterion |
|---|---|---|
| Lock order DB | existing-ID/fresh-ID/normalized-key upsert; opposing bulk, overlapping roots/keys; owner draft interactions | deterministic multi-session barriers, no 40P01/hangs on supported routes |
| Identity DB | ABA, key reuse/collisions, shared root source/owner invariants | monotonic epoch, no stale evidence usable, no duplicate claims |
| Private DB | A/B ownership, anonymous, actor spoof, source promotion, foreign ID/normalized collision | no foreign mutation/PII leak; create+self-root atomic; private food never auto-shared |
| Actual index DB | NULL/empty brand, expression conflict target, duplicates within batch | exact deployed semantics, deterministic validation, no silent normalization |
| CAS/replay DB | same actor/key/request, conflicting payload, concurrent approvals/decisions | one result/receipt, conflicting payload/head not retried or refreshed |
| Retry DB + adapter | native deadlock rollback/retry, business40001, auth denial, missing metadata, 4 attempts/15s | complete rollback verified, bounded fresh transactions, no duplicate committed result |
| Serialization | native engine40001 classifier outside supported RC | real separate harness or explicitly NOT VERIFIED; no fabricated PASS |
| Commit ambiguity | disconnect before/during/after commit, response loss | no blind retry; proven receipt recovery or UNKNOWN/fail-stop, no false rollback claim |
| Authorization DB | expiry/revoke while waiting gate/auth/catalog locks | fresh authority required, no post-expiry issuance; serialization of revoke documented |
| Immutability DB | direct writes/ACL/TRUNCATE/delete/key changes, unknown writer attempts | denied even with empty registry; Phase1 bytes/digests unchanged |
| Account/maintenance DB | real dependent lock topology, retryable deletion/archive policy | independent lifecycle approval first; no evidence CASCADE/guard removal |
| Consumers | resolver/search/diary/recipes/favorites, importer reports/cache handling | relevant regressions pass, historical nutrition unchanged |

Security acceptance must prove direct DML is no longer a supported bypass for relevant
roles AFTER prospective ACL cutover, while ordinary read privileges remain. Superuser,
replication and maintenance exemptions cannot be certified by application RLS tests.
Keep unsupported-path counterexamples separately labeled, not counted as repair proof.

## C3 — Transport/driver and performance verification

Disposable HTTP integration against approved local PostgREST or authorized future
Staging: real signed/expired/revoked JWT, role spoof attempts, session checks,
transaction BEGIN/COMMIT behavior, RC, error field fidelity, timeout/connection loss.
Synthetic auth.jwt fixtures prove SQL binding only, not JWT cryptography. If routine
metadata is unavailable, use fail-stop or separately reviewed trusted driver; no
unsafe string-only retry. Do not deploy dormant handler to users for testing.

Load tests from design matrix, fixed data and repeatable runs; record gate wait/hold
p50/p95/p99, throughput, error/retry/exhaustion counts and starvation, including private
writes/current reads against importer bursts. No network I/O while gate held. No FIFO
fairness assumption. Prove deadline/cancellation and UNKNOWN COMMIT handling under
pool pressure. Starting max200 rows, lock2s, statement5s and 15s overall are trial
limits only. Owner-approved latency/throughput/error budgets REQUIRED before GO;
absence of budgets or exceeding them means BLOCKED, not a fabricated pass threshold.

## C4 — Writer adapters, dormant deployment, fail-closed cutover

Exact adapter files: foodService.ts; import-food-core.ts; run_food_ingestion.mjs;
foodIngestionService.ts; foodImportPipeline.ts; seedFoods.ts; missingFoodDraftService.ts;
owner-apply SQL only after separate approval; four nutrition_zero_macro SQL drafts;
build_nutrition_repo_reference.mjs. Preserve client read/resolver semantics and private
privacy. Existing jobs use pinned compatible versions; inventory/reject old callers.

Do not gradually activate guards while unadapted writers continue unrestricted.
First prepare dormant compatible adapters/typed RPCs and verify them in isolation.
Then, only under separate Staging apply approval: pause relevant writes/jobs, drain
in-flight transactions, inventory active prepared sessions, install reviewed
entrypoints/guards, revoke unsafe table/column/inherited direct-write and EXECUTE
paths, verify effective privileges, enable adapted writers, and monitor. Coordinate
DB/client versions; old clients receive a controlled write failure/update requirement,
not privileged fallback. All entrypoints must use the same gate before first root.
Do not revoke legitimate SELECT or break unrelated consumers.

No real SQL migration file is created in this PR. Future migration packaging must
follow repository/CLI conventions AFTER exact deployed inventory; required content
includes reviewed ownership/ACL, typed entrypoints, gate protocol and effective
privilege tests. Apply order must cover Phase2B+Registry+C dependencies atomically
within the maintenance window, with explicit Staging target and Main fail-closed.

## C5 — Operational/lifecycle approval and rollout verdicts

Shared archive/irreversible identity tombstone rules, retention/minimal audit PII,
finite account erasure, receipt lifetime, maintenance and external writers require
independent decisions. Do not declare Staging ready merely because C2 is green.

Rollback exercise: disable newly activated write endpoints/jobs, preserve guards,
claims, receipts/evidence and epoch, keep safe reads available; no unsafe direct
ACL restoration, DROP-trigger reset, CASCADE, TRUNCATE, epoch rewind or old importer
fallback. Forward repair only. Unknown/committed batches reconcile explicitly.

| Gate | Current verdict | Evidence needed |
|---|---|---|
| Docs/design review | GO | this docs-only proposal, owner review |
| New disposable C implementation | BLOCKED pending C1 choices/C0 schema evidence | no production use; targeted scopes may proceed after explicit decisions |
| All-writer compatibility | BLOCKED | complete adapted/disabled writer coverage + actual ACL/role verification |
| Future Staging testing/apply | BLOCKED | C0–C4, owner authorization, live Auth/transport, performance and lifecycle gates |
| Main/production | BLOCKED | separate Main architecture, complete rollout and retention approvals |

## Required owner decisions

1. Exact supported writer set; disable/quarantine unknown paths and old clients.
2. Private CRUD entrypoint/role ownership and normalized-key collision policy; do not
   silently change foods uniqueness or visibility.
3. Shared importer operator/machine authorization and owner-apply trusted boundary.
4. Bounded batch/partial-job semantics and durable receipt versus fail-stop UNKNOWN.
5. Gate latency/throughput SLOs, operational limits and backpressure.
6. Archive/maintenance, privacy retention/receipt lifetime, account deletion lifecycle.
7. Separate future per-environment read-only access, Staging apply and cutover window.

Nothing in this document authorizes changes to deployed databases or existing flows.
