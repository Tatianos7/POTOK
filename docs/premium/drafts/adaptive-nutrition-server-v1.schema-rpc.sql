/*
PROPOSED REVIEW SPECIFICATION v1 — NOT APPROVED / NOT A MIGRATION.
The ENTIRE file is a comment: no executable statements, no installation path.
DDL excerpts and RPC algorithms below are intentionally not an apply-ready patch.
See ../adaptive-nutrition-server-draft-v1.md for gates, consumers and acceptance.
Trusted provisioning, canonical validation and external consumers remain OPEN.

A. EXISTING TABLE EXTENSIONS — PROPOSED

public.user_profiles:
  retain user_id, has_premium, is_admin, ordinary profile fields and legacy IDs;
  ADD premium_provenance_id uuid NULL, premium_valid_until timestamptz NULL,
      admin_provenance_id uuid NULL;
  existing flags retain their values; all new provenance fields start NULL.
  No backfill may infer provenance from old true flags. Owner-controlled grant/revoke
  routine is specified below, not implemented or exposed to application roles.
  Authoritative Premium predicate needs actor's true flag AND approved provenance
  AND valid_until > server time. Until provisioning is approved, predicate DENIES.
  Admin provenance is independent; Premium verification cannot grant admin.

  Candidate ordinary-role permission change (not executable here):
    REVOKE INSERT, UPDATE ON public.user_profiles FROM anon, authenticated;
    GRANT INSERT (user_id, first_name, last_name, middle_name, birth_date, age,
      height, goal, email, phone, avatar_url) ON public.user_profiles TO authenticated;
    GRANT UPDATE (first_name, last_name, middle_name, birth_date, age,
      height, goal, email, phone, avatar_url) ON public.user_profiles TO authenticated;
  Verify PUBLIC/inherited grants before treating this as sufficient. Keep own-row
  RLS. Ordinary INSERT omits all protected columns (server defaults false/NULL);
  UPDATE cannot set/clear/echo protected columns, including equal values.
  Profile DELETE/recreate must also be denied to ordinary users: ownership does
  not authorize destroying privilege provenance. Account erasure is a separate gate.
  Auth bootstrap trigger/default writers are excluded from current export: OPEN.
  Defense-in-depth guards must reject protected updates/forged INSERT, including
  upsert/conflict paths. No bypass based on caller GUC, JWT user_metadata,
  payload role/admin flag, or a client-set provenance UUID.

public.user_goals:
  ADD goal_revision uuid NULL; initialize only via reviewed transition.
  Server assigns a new opaque revision for every committed semantic change;
  client cannot assign it. Timestamp-only updates need not imply semantic change.
  Existing goal writers need one consistent update/CAS boundary. No automatic
  goal-to-plan activation; graph retains exact confirmed goal snapshot.

public.user_premium_plan_selections:
  ADD contract_version smallint NOT NULL DEFAULT 0,
      week_anchor date NULL, timezone text NULL,
      plan_revision uuid NULL, goal_revision uuid NULL,
      history_revision uuid NULL, diary_revision uuid NULL;
  ADD UNIQUE (user_id, id);
  v0 = untouched legacy assignment; v1 = explicitly activated weekly instance.
  v1 CHECK requires all binding/head fields, Monday anchor, valid version/status.
  IANA timezone validated by server; a text NOT NULL check is insufficient.
  Status domain extends active/paused/completed/archived with provisional.
  ADD origin_kind text, origin_lineage jsonb (immutable validated provenance).
  premium_plan_id becomes nullable with tagged checks: legacy_catalog/v0 and
  catalog_template/v1 require real template FK; generated/v1 has NULL reference,
  generator version/config provenance and Goal revision. Existing legacy FK values
  and IDs remain; generated-from-template records real source IDs in lineage.
  Generated branch never bypasses actor/graph validation. No dummy templates.
  Template duration is NOT execution duration. Read joins must preserve generated rows.
  Keep one active selection per account. Candidate unique(user_id, week_anchor)
  WHERE contract_version=1 AND status IN ('active','provisional') prevents two
  current candidates for the same week; timezone rebinding archives old instance.
  week/timezone cannot be edited in place once activated or referenced by history.
  No automatic conversion of nullable legacy start_date or fixed 14-day plans.
  New composite head FK to retained graph is deferred within creation/replacement.
  Direct legacy CRUD restricted to v0 BOTH before and after writes, with no v1
  referenced history; UPDATE cannot flip contract_version or ownership to escape.
  Activation that conflicts with legacy active row is explicit atomic archival,
  not deletion. Existing meal selections/IDs remain retained.

public.user_premium_meal_selections:
  retain legacy catalog selection rows. No second authoritative v1 slot store.
  No direct legacy mutation under a v1 parent; check both OLD and NEW parent.

public.food_diary_entries:
  ADD nutrition_event_id uuid NULL, nutrition_component_id text NULL;
  CHECK both NULL (legacy) OR both NOT NULL (protected projection).
  UNIQUE(user_id, nutrition_event_id, nutrition_component_id) for linked rows;
  composite FK(user_id, nutrition_event_id) -> nutrition events, no cascade deletion.
  Keep existing IDs, amounts, units, nutrient precision and existing legacy key index.
  Adaptive operation key lives in ledger, NOT duplicated onto each component row.
  A protected event owns its complete immutable component manifest; exact event
  snapshot is retained even if catalog changes. Projection reconciliation is atomic.
  Existing canonical_food_id ON DELETE SET NULL is a live pointer, not immutable
  snapshot identity. Compatibility of this FK action with freeze guards is OPEN;
  no canonical-food alteration or migration is part of this draft.

B. NEW LOGICAL RELATIONS — PROPOSED NAMES / COLUMN AND CONSTRAINT CONTRACT

  All new relations: RLS enabled, default deny direct anon/authenticated access;
  no direct caller DML/TRUNCATE or blanket default PUBLIC privileges. Only narrowly
  granted reviewed RPCs expose authorized reads/effects. FORCE RLS/owner-role setup
  must be resolved with the trusted execution role, not assumed to protect definer
  paths. Every definer path independently validates actor and all object ownership.

public.adaptive_nutrition_graph_revisions (
  user_id uuid, selection_id uuid, plan_revision uuid,
  goal_revision uuid, goal_snapshot jsonb, graph_snapshot jsonb,
  snapshot_encoding_version text, content_digest bytea, created_at timestamptz,
  PRIMARY KEY (user_id, selection_id, plan_revision),
  FOREIGN KEY (user_id, selection_id)
    REFERENCES public.user_premium_plan_selections(user_id, id) ON DELETE RESTRICT
);
  Required columns NOT NULL. Graph includes local dates, stable occurrence IDs,
  meal category/order, recipe/portion/composition revision identities and exact
  validated canonical ingredients/quantities/units/nutrients; no guessed UUIDs.
  Explicit coverage records empty/missing slots; never fill from demo defaults.
  Unique dated identities + consistent immutable revision content checked by server.
  Append-only; no caller writes, UPDATE/DELETE/TRUNCATE or cascading replacement.
  Graph revision is a complete snapshot; separate day/recipe copies are unnecessary.

public.adaptive_nutrition_operations (
  user_id uuid, idempotency_key text, operation_id uuid,
  contract_version text, canonical_request jsonb, digest_version text,
  request_digest bytea, outcome text, reason text NULL,
  result_references jsonb, committed_at timestamptz,
  PRIMARY KEY (user_id, idempotency_key), UNIQUE (user_id, operation_id)
);
  Required columns NOT NULL, nonempty key, terminal outcome accepted/conflict/rejected.
  UNKNOWN is a client/lookup state, never a stored successful receipt.
  Scope/FK validation for request/result refs, actor bound to authenticated context.
  Canonical request encoding uses normalized explicit decimal quantities, enum/field
  allowlist, deterministic ordering and explicit missing/null rules. Reject unknown,
  duplicate JSON keys, nonfinite/lossy numeric encodings before digest creation.
  Same digest is not enough: compare canonical business payload as well.
  Versioned hash/encoding must be specified in implementable draft; synthetic JSON
  equality helper is NOT a hash, parser or a server canonicalization implementation.
  Preserve terminal outcome/key tombstone, no silent key reuse after retention expiry.

public.adaptive_nutrition_events (
  user_id uuid, selection_id uuid NULL, event_id uuid, operation_id uuid,
  stream_id uuid, event_sequence bigint, event_index integer, kind text, local_date date,
  slot_id uuid NULL, source_plan_revision uuid NULL, source_goal_revision uuid NULL,
  snapshot jsonb, component_manifest jsonb,
  supersedes_event_id uuid NULL, created_at timestamptz,
  PRIMARY KEY (user_id, event_id), UNIQUE (user_id, operation_id, event_index),
  UNIQUE (user_id, event_sequence),
  FOREIGN KEY (user_id, selection_id)
    REFERENCES public.user_premium_plan_selections(user_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, operation_id)
    REFERENCES public.adaptive_nutrition_operations(user_id, operation_id),
  FOREIGN KEY (user_id, supersedes_event_id)
    REFERENCES public.adaptive_nutrition_events(user_id, event_id)
);
  Required fields NOT NULL except explicitly nullable ones. Kinds FACT, FACT_RETRACTION,
  ANNOTATION, ANNOTATION_RETRACTION, PLAN_REPLACED; tagged snapshot contract per kind.
  Partial unique(user_id, supersedes_event_id) WHERE supersedes_event_id IS NOT NULL
  prevents forks; partial unique(user_id, stream_id) for root events.
  FK alone does not prove same-instance/same-stream/date, no cycle, latest effective
  head or kind compatibility: enforce under lock. Retraction targets a live fact/
  annotation, never a previous retraction. No resurrection, implicit zero fact or DELETE.
  Usually one authoritative event per action; multi-food FACT has many components.
  First explicit correction of a legacy row may atomically append a retained original
  seed event plus its successor (distinct event_index, same operation receipt).
  Preserve legacy row ID, actual stored values and unknown provenance; no guessed
  recipe/canonical state. Link legacy projection once, suppress it only via successor.
  Free standalone FACT has NULL selection/source graph; plan-linked correction keeps
  all original graph references. Tagged checks require either all linked refs or
  standalone Free provenance; partial NULL cannot bypass ownership/FK validation.
  Internal event_sequence allocated under account gate for managed events; it does
  NOT claim revision coverage of unrelated legacy writers. No client ordering oracle.
  Operation/event/receipt cross-references may require deferred FKs, not separate commits.
  Add composite source graph FK(user_id, selection_id, source_plan_revision) to
  graph revisions. Goal identity/content must agree with that immutable source.

C. EFFECTIVE DIARY / WRITE-ACCESS CONTRACT — PROPOSED

  effective_diary(actor, date/range, snapshot barrier) =
    actor's legacy rows (nutrition_event_id IS NULL)
    UNION ALL protected component rows whose same-actor FACT event has no successor.
  An EDIT makes old components historical; UNDO leaf is a retraction, so no old fact
  reappears. SKIPPED/PLAN_REPLACED/annotation retraction never contributes diary rows.
  Exact-receipt history reconstructs events as-of retained receipt event_sequence;
  it must not use current head to label historical FACT projection as exact.
  Head sequence is server internal; opaque revisions are not sorted by clients.

  Existing permissive diary ALL/SELECT policies must be replaced coherently:
    ordinary SELECT = owner AND effective projection predicate;
    history access = dedicated own-history endpoint, including after Premium expiry;
    direct legacy INSERT/UPDATE/DELETE = legacy-only outside activated v1 cohort;
    v1 projection/event/graph/receipt writes = exclusively trusted reviewed RPC boundary.
  Merely adding another permissive policy does NOT narrow existing ALL policies.
  Both OLD and NEW row/provenance/date/parent must pass, including upsert conflict.
  Managed-date barrier is enabled ONLY together with tested Free manual endpoint,
  effective readers/writers and supported-build/queue transition, at cohort enrollment.
  Before readiness no v1 activation/barrier. After enrollment direct old statements
  fail BEFORE row work with CLIENT_UPGRADE_REQUIRED for the whole account, including
  empty/mixed-date bulk; RLS filtering or partial row counts is not atomic rejection.
  The Free endpoint serves ALL manual dates; actor cohort checks are server-derived.
  Retained managed bindings persist after expiry/archive. No marker-free clone bypass.
  Free own FACT read/correction/retraction require no Premium/current plan/Goal CAS;
  only actor ownership, live target-event CAS, explicit payload/confirmation and key.
  No plan/adaptation/offer effects through Free DTO. Ledger is shared, protocol tag
  included in canonical request. Linked event/history revisions advance, graph does not.
  Old-client errors leave queue intact. Verify build handles errors; otherwise block
  enrollment until upgrade. Do not promise server can repair an old UI ignoring errors.
  No silent batch split or automatic cache-to-Free conversion. Preserve key/payload;
  reconcile dispatched intents first, then explicit review of genuinely new intents.
  Table grants do not protect against TRUNCATE/privileged helpers by themselves;
  review least-privilege ACL, inherited roles and all write-capable helpers.

D. RPC SIGNATURE / ALGORITHM SKETCHES — PROPOSED, NO FUNCTIONS CREATED

  adaptive_nutrition_mutate_v1(request_json text) -> versioned outcome envelope
    1. Strict duplicate-aware raw JSON decode before jsonb, authenticate actor.
       Account input is assertion only. No client digest/revision authority.
    2. Acquire transaction-scoped account advisory gate FIRST, before any row locks.
       Namespace/account key server-derived; hash collision only serializes extra work.
       Then account+key lookup; unique key constraint remains authoritative.
       Existing terminal canonical request match: return stored outcome BEFORE new
       entitlement/CAS/calendar checks. Mismatch: conflict, never overwrite receipt.
    3. Lock profile authority, Goal when relevant, sorted instance IDs, sorted stream
       IDs, then sorted diary row IDs. Provisioning and all enrolled writers use this
       order; no row-trigger taking account gate after an already-held row lock.
       Check trusted entitlement after waiting, at effect admission using server clock.
       Revoke uses same gate. Historical replay never creates a new paid effect.
    4. Validate ownership of all refs, explicit
       confirmation, expected plan/goal/history/diary versions, calendar/status,
       exact slot snapshots/actual payload or validated replacement offer.
    5. Effect + event + graph/diary projections + head revisions + terminal receipt
       commit in ONE transaction. No split REST orchestration, out-of-band event
       commit, hidden compensation or autonomous transaction.
    6. Deterministic conflict/rejection may commit receipt ONLY, with no domain effect.
       Unexpected failure rolls back all transaction changes; timeout remains UNKNOWN.
    Refused unauthenticated/foreign actor input exposes no receipt or other user refs.
    Full domain validation/receipt canonicalization/locking bodies are NOT implemented.

  adaptive_nutrition_lookup_v1(idempotency_key text) -> settled receipt | unknown
    Authenticate actor, read original account+key, no writes/claim row/bootstrap.
    No current Premium/active-week requirement. No row => UNKNOWN, not rollback proof.

  adaptive_nutrition_read_v1(selection_id uuid, mode text, operation_id uuid NULL)
    -> coherent graph + history/FACT scoped revisions + coverage + receipt binding
    Current paid plan/catalog reads require verified Premium. Exact receipt recovery
    and own history after expiry return retained owned snapshots, never a catalog
    browse channel/new replacement offer. Atomically read one consistent DB snapshot.
    Exact mode requires owned operation/selection refs and retained graph/history
    revision. A later head is not an implicit successor proof. Return not-ready if
    exact state is unavailable; no client-generated revision oracle.

  adaptive_nutrition_history_v1(selection_id uuid, history_cursor text NULL)
    -> account-owned retained events/snapshots and revision-bound pagination
    Expiry does not remove own FACT/history; no new paid effect and no foreign refs.

  free_diary_mutate_v1(request_json text) -> stream/event receipt, optional plan linkage
    Same account gate/ledger, strict CREATE_FACT/CORRECT_FACT/RETRACT_FACT allowlist.
    No Premium requirement, including after expiry. Exact replay precedes target CAS.
    New correction/retraction uses its own key, live owned event revision; stale fails.
    It never changes plan/Goal/shopping or upgrades a Free request to a paid operation.
    Standalone facts have no dummy instance; linked facts retain source provenance.
    Legacy correction atomically preserves original row/snapshot before supersession.

  free_diary_history_v1(stream_id uuid, event_revision uuid, cursor text NULL)
    -> own FACT stream snapshots/retractions, revision-bound pagination, no Premium
    and no selection requirement for standalone facts. Own operation listing uses
    authenticated cursor-bound reads across Free/paid receipts, never creates actions.

  Separate proposed transition contracts: explicit week activation, Goal confirmation,
  replacement-offer validation. None may route around the
  same revision/history/actor boundary; not implemented as hidden default operations.
  Shopping derives only from one confirmed graph revision; cache keys include it.

E. TRUSTED ROLES / PROVISIONING — RECOMMENDED, NOT CREATED

  potok_nutrition_executor: NOLOGIN/NOSUPERUSER/NOBYPASSRLS, minimal application data
  privileges + role-specific RLS, no access-grant writes. Owns reviewed routines.
  potok_access_provisioner: separate NOLOGIN/NOBYPASSRLS role, only access-attestation
  append and protected profile projection via grant/revoke routine; no diary/PLAN writes.
  Table/schema migration owner separate. App roles have no membership/SET ROLE to
  either role. Function EXECUTE revoked from PUBLIC/anon, scoped to authenticated
  for app routines and verified operator database identity for provisioning ONLY.
  Fixed search_path=pg_catalog, all application refs qualified, no dynamic SQL;
  actor/ownership checks in each definer routine, no reliance on profile is_admin.

  Closed-schema access_attestations stores immutable grant/revoke/account/capability/
  validity/operator/evidence-ref/previous-attestation. Current profile projection is
  updated atomically with attestation under account gate. Premium/admin independent.
  Manual owner-reviewed provisioning without payment; operational channel/operator,
  inherited grants and auth bootstrap evidence OPEN. Existing true flags unverified.
  No service-role workaround, client GUC, JWT metadata or self-provisioning capability.

F. WIRE / RESTART CONTRACT — RECOMMENDED, NOT IMPLEMENTED

  Strict raw JSON duplicate-key rejection BEFORE jsonb, exact tagged field allowlists.
  Positive amount decimal string: ASCII integer part (0 or 1-6 digits without leading
  zero), optional literal dot and 1-2 fraction digits. Normalize to exactly 2 decimals.
  Numeric(8,2) bound is storage, not clinical. Reject rounding/exponent/sign/whitespace/
  overflow/unknown fields; preserve g/ml/state, never infer density/zero nutrients.
  Server exact decimal nutrition arithmetic; one half-up rounding at storage boundary.
  Canonical v1 UTF-8 JSON: ASCII ordered allowlisted keys, arrays ordered, explicit
  null/missing schema, normalized decimals, version prefix + SHA-256 and field equality.
  Full raw parser/digest interoperability still needs local implementation/evidence.

  Proposed account-scoped IndexedDB outbox durably saves original envelope/key BEFORE
  dispatch and sent_unknown BEFORE network. Failed storage -> no dispatch. No secrets.
  Re-authentication -> original key lookup; another account quarantines payload.
  Not-observed is UNKNOWN; exact retry never rebases/rekeys. Terminal receipt plus
  exact graph/FACT recovery precedes settled cleanup. Multi-tab shares original intent.
  Lost outbox -> account-owned cursor-bound operation listing and reconciliation,
  not guessed resubmission. Listing absence does not prove no in-flight transaction.
  Storage/retention/crash tests pending; no IndexedDB/runtime transport code added.

G. IMPLEMENTATION/APPLY GATES

  All names, types and bodies are PROPOSED. Trusted provisioning OPEN; old flags NOT
  evidence. Contract decode, auth/roles, graph validator, canonical access, projection,
  locks, protected writers and rollback must be reviewed together before runnable DDL.
  No role/RPC creation, SQL execution, fixture writes, activation or deployment here.
  In particular do not extract these excerpts and run them as a migration.
*/
