-- POTOK Adaptive Nutrition runtime read/lookup + bounded PLAN mutation activation v1.
-- RUNNABLE REVIEW DRAFT, NOT APPLIED. STAGING ozidryfvhkcbtpnulakq only after approval.
-- Requires applied persistence v1 and trusted-entitlement v2. FACT/diary writes stay OFF.

BEGIN;

DO $preflight$
DECLARE
  v_owner name;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regprocedure(
       'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'
     ) IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_lookup_v1(text)') IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_read_v1(uuid,uuid)') IS NULL
     OR pg_catalog.to_regprocedure(
       'potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'
     ) IS NULL THEN
    RAISE EXCEPTION 'applied persistence v1 and trusted entitlement v2 are required';
  END IF;
  IF pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'extensions.digest(bytea,text) is required for server SHA-256';
  END IF;
  IF pg_catalog.to_regclass('potok_nutrition.validated_plan_replacement_offers_v1') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_mutate_v1(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'runtime activation v1 already exists; inspect instead of rerunning';
  END IF;
  SELECT r.rolname INTO v_owner
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
   WHERE n.nspname = 'potok_nutrition'
     AND p.proname = 'commit_prevalidated_plan_transition_v1';
  IF v_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'internal persistence boundary owner drift';
  END IF;
END
$preflight$;

-- Replacement graphs never arrive from the client. A separately reviewed trusted
-- plan engine may later create these immutable offers after canonical recipe/food
-- validation. This patch creates no writer routine or application grant for offers.
CREATE TABLE potok_nutrition.validated_plan_replacement_offers_v1 (
  account_id uuid NOT NULL,
  selection_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  expected_plan_revision uuid NOT NULL,
  expected_goal_revision uuid NOT NULL,
  expected_history_revision uuid NOT NULL,
  expected_diary_revision uuid NOT NULL,
  local_date date NOT NULL,
  slot_id uuid NOT NULL,
  expected_snapshot_revision uuid NOT NULL,
  expected_recipe_revision uuid NULL,
  expected_portion_revision uuid NOT NULL,
  new_plan_revision uuid NOT NULL,
  new_history_revision uuid NOT NULL,
  goal_snapshot jsonb NOT NULL,
  graph_snapshot jsonb NOT NULL,
  snapshot_encoding_version text NOT NULL,
  graph_digest bytea NOT NULL,
  event_snapshot jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT validated_plan_replacement_offers_v1_pkey PRIMARY KEY (account_id, offer_id),
  CONSTRAINT validated_plan_replacement_offers_v1_selection_fk
    FOREIGN KEY (account_id, selection_id)
    REFERENCES public.user_premium_plan_selections(user_id, id) ON DELETE RESTRICT,
  CONSTRAINT validated_plan_replacement_offers_v1_source_graph_fk
    FOREIGN KEY (account_id, selection_id, expected_plan_revision)
    REFERENCES public.adaptive_nutrition_graph_revisions(user_id, selection_id, plan_revision)
    ON DELETE RESTRICT,
  CONSTRAINT validated_plan_replacement_offers_v1_digest_check
    CHECK (pg_catalog.octet_length(graph_digest) = 32),
  CONSTRAINT validated_plan_replacement_offers_v1_json_check CHECK (
    pg_catalog.jsonb_typeof(goal_snapshot) = 'object'
    AND pg_catalog.jsonb_typeof(graph_snapshot) = 'object'
    AND pg_catalog.jsonb_typeof(event_snapshot) = 'object'
  ),
  CONSTRAINT validated_plan_replacement_offers_v1_revision_check CHECK (
    new_plan_revision <> expected_plan_revision
    AND new_history_revision <> expected_history_revision
  )
);

CREATE UNIQUE INDEX validated_plan_replacement_offers_v1_new_plan_idx
  ON potok_nutrition.validated_plan_replacement_offers_v1
  (account_id, selection_id, new_plan_revision);

ALTER TABLE potok_nutrition.validated_plan_replacement_offers_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.validated_plan_replacement_offers_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_nutrition.validated_plan_replacement_offers_v1
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER potok_validated_plan_offers_immutable_v1
BEFORE UPDATE OR DELETE OR TRUNCATE
ON potok_nutrition.validated_plan_replacement_offers_v1
FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v1();

-- json retains duplicate members. This recursive check runs before any jsonb cast.
CREATE FUNCTION potok_nutrition.json_has_duplicate_keys_v1(p_value json)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_child json;
BEGIN
  IF pg_catalog.json_typeof(p_value) = 'object' THEN
    IF EXISTS (
      SELECT 1 FROM pg_catalog.json_each(p_value)
       GROUP BY key HAVING pg_catalog.count(*) > 1
    ) THEN
      RETURN true;
    END IF;
    FOR v_child IN SELECT value FROM pg_catalog.json_each(p_value) LOOP
      IF potok_nutrition.json_has_duplicate_keys_v1(v_child) THEN RETURN true; END IF;
    END LOOP;
  ELSIF pg_catalog.json_typeof(p_value) = 'array' THEN
    FOR v_child IN SELECT value FROM pg_catalog.json_array_elements(p_value) LOOP
      IF potok_nutrition.json_has_duplicate_keys_v1(v_child) THEN RETURN true; END IF;
    END LOOP;
  END IF;
  RETURN false;
END
$function$;

CREATE FUNCTION potok_nutrition.jsonb_has_exact_keys_v1(p_value jsonb, p_keys text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
  SELECT pg_catalog.jsonb_typeof(p_value) = 'object'
     AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_value))
         = pg_catalog.cardinality(p_keys)
     AND NOT EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_object_keys(p_value) key
        WHERE NOT (key = ANY (p_keys))
     )
$function$;

CREATE FUNCTION potok_nutrition.canonical_jsonb_text_v1(p_value jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_result text;
BEGIN
  CASE pg_catalog.jsonb_typeof(p_value)
    WHEN 'object' THEN
      SELECT '{' || COALESCE(pg_catalog.string_agg(
        pg_catalog.to_jsonb(entry.key)::text || ':' ||
        potok_nutrition.canonical_jsonb_text_v1(entry.value), ',' ORDER BY entry.key COLLATE "C"
      ), '') || '}' INTO v_result
        FROM pg_catalog.jsonb_each(p_value) entry;
    WHEN 'array' THEN
      SELECT '[' || COALESCE(pg_catalog.string_agg(
        potok_nutrition.canonical_jsonb_text_v1(item.value), ',' ORDER BY item.ordinality
      ), '') || ']' INTO v_result
        FROM pg_catalog.jsonb_array_elements(p_value) WITH ORDINALITY item(value, ordinality);
    WHEN 'string' THEN RETURN pg_catalog.to_jsonb(p_value #>> '{}')::text;
    WHEN 'boolean' THEN RETURN p_value::text;
    WHEN 'null' THEN RETURN 'null';
    ELSE RETURN p_value::text;
  END CASE;
  RETURN v_result;
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.json_has_duplicate_keys_v1(json)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION potok_nutrition.jsonb_has_exact_keys_v1(jsonb, text[])
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION potok_nutrition.canonical_jsonb_text_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.adaptive_nutrition_mutate_v1(p_request_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_raw json;
  v_request jsonb;
  v_expected jsonb;
  v_action jsonb;
  v_action_name text;
  v_action_type text;
  v_account_id uuid;
  v_selection_id uuid;
  v_idempotency_key text;
  v_expected_plan_revision uuid;
  v_expected_goal_revision uuid;
  v_expected_history_revision uuid;
  v_expected_diary_revision uuid;
  v_week_anchor date;
  v_timezone text;
  v_canonical_text text;
  v_canonical_bytes bytea;
  v_request_digest bytea;
  v_existing public.adaptive_nutrition_operations%ROWTYPE;
  v_selection public.user_premium_plan_selections%ROWTYPE;
  v_graph jsonb;
  v_offer potok_nutrition.validated_plan_replacement_offers_v1%ROWTYPE;
  v_target public.adaptive_nutrition_events%ROWTYPE;
  v_new_plan_revision uuid;
  v_new_history_revision uuid := pg_catalog.gen_random_uuid();
  v_goal_snapshot jsonb;
  v_new_graph jsonb;
  v_snapshot_encoding_version text;
  v_graph_digest bytea;
  v_event jsonb;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR p_request_text IS NULL OR p_request_text = '' THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'denied');
  END IF;

  BEGIN
    v_raw := p_request_text::json;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid raw JSON request' USING ERRCODE = '22023';
  END;
  IF potok_nutrition.json_has_duplicate_keys_v1(v_raw) THEN
    RAISE EXCEPTION 'duplicate JSON key' USING ERRCODE = '22023';
  END IF;
  v_request := v_raw::jsonb;

  IF NOT potok_nutrition.jsonb_has_exact_keys_v1(
       v_request, ARRAY['contract','expected','idempotencyKey','explicitConfirmation','action']
     )
     OR v_request ->> 'contract' <> 'adaptive-nutrition-v1-proposed'
     OR v_request -> 'explicitConfirmation' IS DISTINCT FROM 'true'::jsonb
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(
       v_request -> 'expected', ARRAY['accountId','planId','planRevision','goalRevision',
       'historyRevision','diaryRevision','weekAnchor','timeZone']
     ) THEN
    RAISE EXCEPTION 'invalid adaptive nutrition request fields' USING ERRCODE = '22023';
  END IF;

  v_expected := v_request -> 'expected';
  v_action := v_request -> 'action';
  IF NOT ((v_expected ->> 'accountId') ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (v_expected ->> 'planId') ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (v_expected ->> 'planRevision') ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (v_expected ->> 'goalRevision') ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (v_expected ->> 'historyRevision') ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (v_expected ->> 'diaryRevision') ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (v_request ->> 'idempotencyKey') ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (v_expected ->> 'weekAnchor') ~ '^\d{4}-\d{2}-\d{2}$') THEN
    RAISE EXCEPTION 'invalid UUID/date revision references' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_account_id := (v_expected ->> 'accountId')::uuid;
    v_selection_id := (v_expected ->> 'planId')::uuid;
    v_expected_plan_revision := (v_expected ->> 'planRevision')::uuid;
    v_expected_goal_revision := (v_expected ->> 'goalRevision')::uuid;
    v_expected_history_revision := (v_expected ->> 'historyRevision')::uuid;
    v_expected_diary_revision := (v_expected ->> 'diaryRevision')::uuid;
    v_week_anchor := (v_expected ->> 'weekAnchor')::date;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid UUID/date revision references' USING ERRCODE = '22023';
  END;
  v_idempotency_key := v_request ->> 'idempotencyKey';
  v_timezone := v_expected ->> 'timeZone';
  IF v_account_id <> v_actor OR EXTRACT(isodow FROM v_week_anchor) <> 1
     OR v_timezone IS NULL OR v_timezone = '' OR v_timezone <> pg_catalog.btrim(v_timezone)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = v_timezone) THEN
    RAISE EXCEPTION 'invalid authenticated account or calendar binding' USING ERRCODE = '42501';
  END IF;

  v_action_name := v_action ->> 'type';
  v_action_type := CASE v_action_name
    WHEN 'REPLACE' THEN 'PLAN_REPLACED'
    WHEN 'SKIPPED' THEN 'ANNOTATION'
    WHEN 'UNDO_ANNOTATION' THEN 'ANNOTATION_RETRACTION'
    ELSE NULL
  END;
  IF v_action_type IS NULL THEN
    RAISE EXCEPTION 'FACT/component action is not enabled' USING ERRCODE = '0A000';
  END IF;

  v_canonical_text := '{"encoding":"potok-adaptive-nutrition-canonical-json-v1","payload":'
    || potok_nutrition.canonical_jsonb_text_v1(v_request)
    || ',"protocol":"adaptive-nutrition-v1-proposed"}';
  v_canonical_bytes := pg_catalog.convert_to(v_canonical_text, 'UTF8');
  v_request_digest := extensions.digest(v_canonical_bytes, 'sha256');

  -- Replay/lookup precedes entitlement and mutable-head checks. The server compares
  -- its own canonical bytes/digest; no client digest parameter exists.
  SELECT o.* INTO v_existing
    FROM public.adaptive_nutrition_operations o
   WHERE o.user_id = v_actor AND o.idempotency_key = v_idempotency_key;
  IF FOUND THEN
    IF v_existing.selection_id IS DISTINCT FROM v_selection_id
       OR v_existing.action_type <> v_action_type
       OR v_existing.canonical_request <> v_canonical_bytes
       OR v_existing.digest_version <> 'potok-adaptive-nutrition-canonical-json-v1'
       OR v_existing.request_digest <> v_request_digest THEN
      RAISE EXCEPTION 'idempotency key payload mismatch' USING ERRCODE = '40001';
    END IF;
    IF v_existing.outcome = 'in_progress' THEN
      RETURN pg_catalog.jsonb_build_object('kind', 'unknown');
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'kind', 'settled', 'operation_id', v_existing.operation_id,
      'idempotency_key', v_existing.idempotency_key,
      'digest_version', v_existing.digest_version,
      'request_digest_hex', pg_catalog.encode(v_existing.request_digest, 'hex'),
      'outcome', v_existing.outcome, 'reason', v_existing.reason,
      'result', v_existing.result_references, 'committed_at', v_existing.committed_at
    );
  END IF;

  SELECT s.* INTO v_selection
    FROM public.user_premium_plan_selections s
   WHERE s.user_id = v_actor AND s.id = v_selection_id AND s.contract_version = 1;
  IF NOT FOUND OR v_selection.week_anchor <> v_week_anchor OR v_selection.timezone <> v_timezone THEN
    RAISE EXCEPTION 'owned adaptive plan/calendar binding required' USING ERRCODE = '42501';
  END IF;
  SELECT g.graph_snapshot INTO v_graph
    FROM public.adaptive_nutrition_graph_revisions g
   WHERE g.user_id = v_actor AND g.selection_id = v_selection_id
     AND g.plan_revision = v_expected_plan_revision;
  IF NOT FOUND THEN RAISE EXCEPTION 'expected graph revision unavailable' USING ERRCODE = '40001'; END IF;

  IF v_action_name IN ('SKIPPED', 'REPLACE') THEN
    IF NOT potok_nutrition.jsonb_has_exact_keys_v1(
         v_action, CASE WHEN v_action_name = 'REPLACE'
           THEN ARRAY['type','slot','replacementOfferId'] ELSE ARRAY['type','slot'] END
       ) OR NOT potok_nutrition.jsonb_has_exact_keys_v1(
         v_action -> 'slot', ARRAY['slotId','date','snapshot']
       ) OR NOT potok_nutrition.jsonb_has_exact_keys_v1(
         v_action #> '{slot,snapshot}', ARRAY['snapshotRevision','recipeRevision','portionRevision']
       ) THEN
      RAISE EXCEPTION 'invalid dated slot fields' USING ERRCODE = '22023';
    END IF;
    IF NOT ((v_action #>> '{slot,slotId}') ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND (v_action #>> '{slot,snapshot,snapshotRevision}') ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND (v_action #>> '{slot,snapshot,portionRevision}') ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND (v_action #>> '{slot,date}') ~ '^\d{4}-\d{2}-\d{2}$'
      AND ((v_action #> '{slot,snapshot,recipeRevision}') = 'null'::jsonb
        OR (v_action #>> '{slot,snapshot,recipeRevision}') ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')) THEN
      RAISE EXCEPTION 'invalid dated slot identity' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM pg_catalog.jsonb_array_elements(v_graph -> 'days') day(day_item)
        CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(day.day_item -> 'slots') slot(slot_item)
       WHERE day.day_item ->> 'date' = v_action #>> '{slot,date}'
         AND slot.slot_item ->> 'slotId' = v_action #>> '{slot,slotId}'
         AND slot.slot_item #>> '{snapshot,snapshotRevision}' = v_action #>> '{slot,snapshot,snapshotRevision}'
         AND slot.slot_item #> '{snapshot,recipeRevision}' = v_action #> '{slot,snapshot,recipeRevision}'
         AND slot.slot_item #>> '{snapshot,portionRevision}' = v_action #>> '{slot,snapshot,portionRevision}'
    ) THEN
      RAISE EXCEPTION 'dated slot snapshot is not in expected graph' USING ERRCODE = '40001';
    END IF;
  END IF;

  IF v_action_name = 'SKIPPED' THEN
    IF EXISTS (
      SELECT 1 FROM public.adaptive_nutrition_events e
       WHERE e.user_id = v_actor AND e.selection_id = v_selection_id
         AND e.kind = 'ANNOTATION'
         AND e.local_date = (v_action #>> '{slot,date}')::date
         AND e.slot_id = (v_action #>> '{slot,slotId}')::uuid
         AND NOT EXISTS (
           SELECT 1 FROM public.adaptive_nutrition_events successor
            WHERE successor.user_id = e.user_id AND successor.supersedes_event_id = e.event_id
         )
    ) THEN
      RAISE EXCEPTION 'meal slot already has a live annotation' USING ERRCODE = '40001';
    END IF;
    v_event := pg_catalog.jsonb_build_object(
      'event_id', pg_catalog.gen_random_uuid(), 'stream_id', pg_catalog.gen_random_uuid(),
      'kind', 'ANNOTATION', 'local_date', v_action #>> '{slot,date}',
      'slot_id', v_action #>> '{slot,slotId}',
      'snapshot', pg_catalog.jsonb_build_object('annotation', 'skipped',
        'planned_snapshot', v_action #> '{slot,snapshot}'),
      'component_manifest', '[]'::jsonb, 'supersedes_event_id', NULL
    );
  ELSIF v_action_name = 'UNDO_ANNOTATION' THEN
    IF NOT potok_nutrition.jsonb_has_exact_keys_v1(v_action, ARRAY['type','targetEventId'])
       OR NOT ((v_action ->> 'targetEventId') ~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
      RAISE EXCEPTION 'invalid annotation target' USING ERRCODE = '22023';
    END IF;
    SELECT e.* INTO v_target
      FROM public.adaptive_nutrition_events e
     WHERE e.user_id = v_actor AND e.selection_id = v_selection_id
       AND e.event_id = (v_action ->> 'targetEventId')::uuid AND e.kind = 'ANNOTATION'
       AND NOT EXISTS (
         SELECT 1 FROM public.adaptive_nutrition_events successor
          WHERE successor.user_id = e.user_id AND successor.supersedes_event_id = e.event_id
       );
    IF NOT FOUND THEN RAISE EXCEPTION 'live owned annotation required' USING ERRCODE = '40001'; END IF;
    v_event := pg_catalog.jsonb_build_object(
      'event_id', pg_catalog.gen_random_uuid(), 'stream_id', v_target.stream_id,
      'kind', 'ANNOTATION_RETRACTION', 'local_date', v_target.local_date,
      'slot_id', v_target.slot_id, 'snapshot', pg_catalog.jsonb_build_object('retracted', true),
      'component_manifest', '[]'::jsonb, 'supersedes_event_id', v_target.event_id
    );
  ELSE
    IF NOT ((v_action ->> 'replacementOfferId') ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
      RAISE EXCEPTION 'invalid replacement offer identity' USING ERRCODE = '22023';
    END IF;
    SELECT offer.* INTO v_offer
      FROM potok_nutrition.validated_plan_replacement_offers_v1 offer
     WHERE offer.account_id = v_actor AND offer.selection_id = v_selection_id
       AND offer.offer_id = (v_action ->> 'replacementOfferId')::uuid
       AND offer.expires_at > pg_catalog.statement_timestamp()
       AND ROW(offer.expected_plan_revision, offer.expected_goal_revision,
               offer.expected_history_revision, offer.expected_diary_revision)
           = ROW(v_expected_plan_revision, v_expected_goal_revision,
                 v_expected_history_revision, v_expected_diary_revision)
       AND offer.local_date = (v_action #>> '{slot,date}')::date
       AND offer.slot_id = (v_action #>> '{slot,slotId}')::uuid
       AND offer.expected_snapshot_revision = (v_action #>> '{slot,snapshot,snapshotRevision}')::uuid
       AND offer.expected_recipe_revision IS NOT DISTINCT FROM
           NULLIF(v_action #>> '{slot,snapshot,recipeRevision}', '')::uuid
       AND offer.expected_portion_revision = (v_action #>> '{slot,snapshot,portionRevision}')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'live validated replacement offer required' USING ERRCODE = '40001'; END IF;
    v_new_plan_revision := v_offer.new_plan_revision;
    v_new_history_revision := v_offer.new_history_revision;
    v_goal_snapshot := v_offer.goal_snapshot;
    v_new_graph := v_offer.graph_snapshot;
    v_snapshot_encoding_version := v_offer.snapshot_encoding_version;
    v_graph_digest := v_offer.graph_digest;
    v_event := pg_catalog.jsonb_build_object(
      'event_id', pg_catalog.gen_random_uuid(), 'stream_id', pg_catalog.gen_random_uuid(),
      'kind', 'PLAN_REPLACED', 'local_date', v_offer.local_date,
      'slot_id', v_offer.slot_id, 'snapshot', v_offer.event_snapshot,
      'component_manifest', '[]'::jsonb, 'supersedes_event_id', NULL
    );
  END IF;

  v_result := potok_nutrition.commit_prevalidated_plan_transition_v1(
    v_actor, v_selection_id, v_idempotency_key, 'adaptive-nutrition-v1',
    v_action_type, v_canonical_bytes, 'potok-adaptive-nutrition-canonical-json-v1',
    v_request_digest, v_expected_plan_revision, v_expected_goal_revision,
    v_expected_history_revision, v_expected_diary_revision,
    v_new_plan_revision, v_new_history_revision, v_goal_snapshot, v_new_graph,
    v_snapshot_encoding_version, v_graph_digest, v_event
  );

  SELECT o.* INTO STRICT v_existing
    FROM public.adaptive_nutrition_operations o
   WHERE o.user_id = v_actor AND o.idempotency_key = v_idempotency_key;
  RETURN pg_catalog.jsonb_build_object(
    'kind', 'settled', 'operation_id', v_existing.operation_id,
    'idempotency_key', v_existing.idempotency_key,
    'digest_version', v_existing.digest_version,
    'request_digest_hex', pg_catalog.encode(v_existing.request_digest, 'hex'),
    'outcome', v_existing.outcome, 'reason', v_existing.reason,
    'result', v_result, 'committed_at', v_existing.committed_at
  );
END
$function$;

REVOKE ALL ON FUNCTION public.adaptive_nutrition_mutate_v1(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.adaptive_nutrition_lookup_v1(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.adaptive_nutrition_read_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.adaptive_nutrition_mutate_v1(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adaptive_nutrition_lookup_v1(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adaptive_nutrition_read_v1(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.adaptive_nutrition_mutate_v1(text) IS
  'Authenticated duplicate-aware raw wire boundary for PLAN_REPLACED/ANNOTATION/ANNOTATION_RETRACTION only; server recomputes canonical SHA-256; FACT disabled.';
COMMENT ON TABLE potok_nutrition.validated_plan_replacement_offers_v1 IS
  'Private immutable replacement offers. No runtime writer is granted; canonical recipe/food validation remains a prerequisite for future offer creation.';

COMMIT;

-- Deliberately absent:
-- * FACT/CONSUMED_AS_PLANNED/CONSUMED_MODIFIED/EXTRA_FOOD and diary projection writes;
-- * client/service_role provisioning or EXECUTE grants;
-- * client account override or client digest input;
-- * replacement graph input from authenticated callers;
-- * canonical food/recipe validation bypass, production activation, payment or deploy.
