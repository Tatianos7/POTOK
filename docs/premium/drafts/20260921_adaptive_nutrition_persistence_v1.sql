-- POTOK Adaptive Nutrition persistence v1 — RUNNABLE REVIEW DRAFT, NOT APPLIED.
-- Target after separate owner approval: Supabase STAGING ozidryfvhkcbtpnulakq only.
-- Additive weekly-plan/receipt/history foundation. Runtime EXECUTE stays disabled.
-- FACT projection writes stay disabled until canonical snapshot validation is proven.

BEGIN;

DO $preflight$
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regprocedure(
       'potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'
     ) IS NULL THEN
    RAISE EXCEPTION 'trusted entitlement v2 is required';
  END IF;
  IF pg_catalog.to_regclass('public.user_goals') IS NULL
     OR pg_catalog.to_regclass('public.user_premium_plan_selections') IS NULL
     OR pg_catalog.to_regclass('public.user_premium_meal_selections') IS NULL
     OR pg_catalog.to_regclass('public.food_diary_entries') IS NULL THEN
    RAISE EXCEPTION 'required legacy goal/selection/meal/diary tables are missing';
  END IF;
  IF pg_catalog.to_regnamespace('potok_nutrition') IS NOT NULL
     OR pg_catalog.to_regclass('public.adaptive_nutrition_graph_revisions') IS NOT NULL
     OR pg_catalog.to_regclass('public.adaptive_nutrition_operations') IS NOT NULL
     OR pg_catalog.to_regclass('public.adaptive_nutrition_events') IS NOT NULL THEN
    RAISE EXCEPTION 'adaptive persistence objects already exist; inspect instead of rerunning';
  END IF;
END
$preflight$;

CREATE SCHEMA potok_nutrition;
REVOKE ALL ON SCHEMA potok_nutrition FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_nutrition
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.user_goals
  ADD COLUMN goal_revision uuid NULL;

UPDATE public.user_goals
   SET goal_revision = pg_catalog.gen_random_uuid()
 WHERE goal_revision IS NULL;

ALTER TABLE public.user_goals
  ALTER COLUMN goal_revision SET NOT NULL;

CREATE FUNCTION potok_nutrition.advance_goal_revision_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_semantic_change boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.goal_revision := pg_catalog.gen_random_uuid();
    RETURN NEW;
  END IF;

  v_semantic_change := ROW(
    NEW.calories, NEW.protein, NEW.fat, NEW.carbs, NEW.goal_type,
    NEW.current_weight, NEW.target_weight, NEW.start_date, NEW.end_date,
    NEW.months_to_goal, NEW.bmr, NEW.tdee, NEW.training_place,
    NEW.gender, NEW.age, NEW.height, NEW.lifestyle, NEW.intensity
  ) IS DISTINCT FROM ROW(
    OLD.calories, OLD.protein, OLD.fat, OLD.carbs, OLD.goal_type,
    OLD.current_weight, OLD.target_weight, OLD.start_date, OLD.end_date,
    OLD.months_to_goal, OLD.bmr, OLD.tdee, OLD.training_place,
    OLD.gender, OLD.age, OLD.height, OLD.lifestyle, OLD.intensity
  );
  NEW.goal_revision := CASE
    WHEN v_semantic_change THEN pg_catalog.gen_random_uuid()
    ELSE OLD.goal_revision
  END;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.advance_goal_revision_v1()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER potok_advance_goal_revision_v1
BEFORE INSERT OR UPDATE ON public.user_goals
FOR EACH ROW EXECUTE FUNCTION potok_nutrition.advance_goal_revision_v1();

ALTER TABLE public.user_premium_plan_selections
  ADD COLUMN contract_version smallint NOT NULL DEFAULT 0,
  ADD COLUMN week_anchor date NULL,
  ADD COLUMN timezone text NULL,
  ADD COLUMN plan_revision uuid NULL,
  ADD COLUMN goal_revision uuid NULL,
  ADD COLUMN history_revision uuid NULL,
  ADD COLUMN diary_revision uuid NULL,
  ADD COLUMN origin_kind text NULL,
  ADD COLUMN origin_lineage jsonb NULL;

ALTER TABLE public.user_premium_plan_selections
  ALTER COLUMN premium_plan_id DROP NOT NULL,
  DROP CONSTRAINT user_premium_plan_selections_status_check,
  ADD CONSTRAINT user_premium_plan_selections_status_check
    CHECK (status IN ('active', 'provisional', 'paused', 'completed', 'archived')),
  ADD CONSTRAINT user_premium_plan_selections_contract_check CHECK (
    (
      contract_version = 0
      AND week_anchor IS NULL AND timezone IS NULL
      AND plan_revision IS NULL AND goal_revision IS NULL
      AND history_revision IS NULL AND diary_revision IS NULL
      AND origin_kind IS NULL AND origin_lineage IS NULL
      AND premium_plan_id IS NOT NULL
    )
    OR
    (
      contract_version = 1
      AND week_anchor IS NOT NULL
      AND EXTRACT(isodow FROM week_anchor) = 1
      AND timezone IS NOT NULL AND timezone <> ''
      AND plan_revision IS NOT NULL AND goal_revision IS NOT NULL
      AND history_revision IS NOT NULL AND diary_revision IS NOT NULL
      AND user_goal_id IS NOT NULL AND user_goal_id = user_id
      AND origin_kind IN ('catalog_template', 'generated')
      AND origin_lineage IS NOT NULL
      AND pg_catalog.jsonb_typeof(origin_lineage) = 'object'
      AND (
        (origin_kind = 'catalog_template' AND premium_plan_id IS NOT NULL)
        OR (origin_kind = 'generated' AND premium_plan_id IS NULL)
      )
    )
  );

ALTER TABLE public.user_premium_plan_selections
  ADD CONSTRAINT user_premium_plan_selections_user_id_id_unique
    UNIQUE (user_id, id);

CREATE UNIQUE INDEX user_premium_plan_selections_week_candidate_v1_idx
  ON public.user_premium_plan_selections (user_id, week_anchor)
  WHERE contract_version = 1 AND status IN ('active', 'provisional');

CREATE FUNCTION potok_nutrition.protect_selection_v1_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF CURRENT_USER = 'postgres' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.contract_version = 1 THEN
      RAISE EXCEPTION 'adaptive plan instance cannot be deleted' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.contract_version <> 0 OR NEW.week_anchor IS NOT NULL
       OR NEW.timezone IS NOT NULL OR NEW.plan_revision IS NOT NULL
       OR NEW.goal_revision IS NOT NULL OR NEW.history_revision IS NOT NULL
       OR NEW.diary_revision IS NOT NULL OR NEW.origin_kind IS NOT NULL
       OR NEW.origin_lineage IS NOT NULL THEN
      RAISE EXCEPTION 'adaptive plan fields are server-managed' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.contract_version = 1
     OR ROW(NEW.contract_version, NEW.user_id, NEW.week_anchor, NEW.timezone,
            NEW.plan_revision, NEW.goal_revision, NEW.history_revision,
            NEW.diary_revision, NEW.origin_kind, NEW.origin_lineage,
            NEW.premium_plan_id)
        IS DISTINCT FROM
        ROW(OLD.contract_version, OLD.user_id, OLD.week_anchor, OLD.timezone,
            OLD.plan_revision, OLD.goal_revision, OLD.history_revision,
            OLD.diary_revision, OLD.origin_kind, OLD.origin_lineage,
            OLD.premium_plan_id) THEN
    RAISE EXCEPTION 'adaptive plan fields are server-managed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.protect_selection_v1_fields()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER potok_protect_selection_v1_fields
BEFORE INSERT OR UPDATE OR DELETE ON public.user_premium_plan_selections
FOR EACH ROW EXECUTE FUNCTION potok_nutrition.protect_selection_v1_fields();

CREATE FUNCTION potok_nutrition.validate_selection_calendar_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.contract_version = 1 AND NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names zone WHERE zone.name = NEW.timezone
  ) THEN
    RAISE EXCEPTION 'recognized IANA timezone required' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.validate_selection_calendar_v1()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER potok_validate_selection_calendar_v1
BEFORE INSERT OR UPDATE ON public.user_premium_plan_selections
FOR EACH ROW EXECUTE FUNCTION potok_nutrition.validate_selection_calendar_v1();

CREATE FUNCTION potok_nutrition.protect_legacy_meal_selection_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_old_version smallint;
  v_new_version smallint;
BEGIN
  IF CURRENT_USER = 'postgres' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    SELECT s.contract_version INTO v_old_version
      FROM public.user_premium_plan_selections s
     WHERE s.id = OLD.user_premium_plan_selection_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT s.contract_version INTO v_new_version
      FROM public.user_premium_plan_selections s
     WHERE s.id = NEW.user_premium_plan_selection_id;
  END IF;
  IF COALESCE(v_old_version, 0) = 1 OR COALESCE(v_new_version, 0) = 1 THEN
    RAISE EXCEPTION 'legacy meal selections cannot mutate a v1 plan' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.protect_legacy_meal_selection_v1()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER potok_protect_legacy_meal_selection_v1
BEFORE INSERT OR UPDATE OR DELETE ON public.user_premium_meal_selections
FOR EACH ROW EXECUTE FUNCTION potok_nutrition.protect_legacy_meal_selection_v1();

CREATE TABLE public.adaptive_nutrition_operations (
  user_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  operation_id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  selection_id uuid NULL,
  contract_version text NOT NULL,
  action_type text NOT NULL,
  canonical_request bytea NOT NULL,
  digest_version text NOT NULL,
  request_digest bytea NOT NULL,
  outcome text NOT NULL,
  reason text NULL,
  result_references jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  committed_at timestamptz NULL,
  CONSTRAINT adaptive_nutrition_operations_pkey
    PRIMARY KEY (user_id, idempotency_key),
  CONSTRAINT adaptive_nutrition_operations_operation_unique
    UNIQUE (user_id, operation_id),
  CONSTRAINT adaptive_nutrition_operations_user_fk
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT adaptive_nutrition_operations_selection_fk
    FOREIGN KEY (user_id, selection_id)
    REFERENCES public.user_premium_plan_selections(user_id, id) ON DELETE RESTRICT,
  CONSTRAINT adaptive_nutrition_operations_key_check
    CHECK (idempotency_key <> '' AND idempotency_key = pg_catalog.btrim(idempotency_key)),
  CONSTRAINT adaptive_nutrition_operations_digest_check
    CHECK (pg_catalog.octet_length(request_digest) = 32),
  CONSTRAINT adaptive_nutrition_operations_outcome_check
    CHECK (outcome IN ('in_progress', 'accepted', 'conflict', 'rejected')),
  CONSTRAINT adaptive_nutrition_operations_terminal_check CHECK (
    (outcome = 'in_progress' AND committed_at IS NULL AND result_references IS NULL)
    OR (outcome <> 'in_progress' AND committed_at IS NOT NULL AND result_references IS NOT NULL)
  )
);

CREATE TABLE public.adaptive_nutrition_graph_revisions (
  user_id uuid NOT NULL,
  selection_id uuid NOT NULL,
  plan_revision uuid NOT NULL,
  goal_revision uuid NOT NULL,
  goal_snapshot jsonb NOT NULL,
  graph_snapshot jsonb NOT NULL,
  snapshot_encoding_version text NOT NULL,
  content_digest bytea NOT NULL,
  created_by_operation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT adaptive_nutrition_graph_revisions_pkey
    PRIMARY KEY (user_id, selection_id, plan_revision),
  CONSTRAINT adaptive_nutrition_graph_revisions_selection_fk
    FOREIGN KEY (user_id, selection_id)
    REFERENCES public.user_premium_plan_selections(user_id, id) ON DELETE RESTRICT,
  CONSTRAINT adaptive_nutrition_graph_revisions_operation_fk
    FOREIGN KEY (user_id, created_by_operation_id)
    REFERENCES public.adaptive_nutrition_operations(user_id, operation_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT adaptive_nutrition_graph_revisions_digest_check
    CHECK (pg_catalog.octet_length(content_digest) = 32),
  CONSTRAINT adaptive_nutrition_graph_revisions_json_check
    CHECK (pg_catalog.jsonb_typeof(goal_snapshot) = 'object'
       AND pg_catalog.jsonb_typeof(graph_snapshot) = 'object')
);

ALTER TABLE public.user_premium_plan_selections
  ADD CONSTRAINT user_premium_plan_selections_graph_head_fk
  FOREIGN KEY (user_id, id, plan_revision)
  REFERENCES public.adaptive_nutrition_graph_revisions(user_id, selection_id, plan_revision)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.adaptive_nutrition_events (
  user_id uuid NOT NULL,
  selection_id uuid NULL,
  event_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  stream_id uuid NOT NULL,
  event_sequence bigint NOT NULL,
  event_index integer NOT NULL,
  kind text NOT NULL,
  local_date date NOT NULL,
  slot_id uuid NULL,
  source_plan_revision uuid NULL,
  source_goal_revision uuid NULL,
  snapshot jsonb NOT NULL,
  component_manifest jsonb NOT NULL,
  supersedes_event_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT adaptive_nutrition_events_pkey PRIMARY KEY (user_id, event_id),
  CONSTRAINT adaptive_nutrition_events_operation_index_unique
    UNIQUE (user_id, operation_id, event_index),
  CONSTRAINT adaptive_nutrition_events_sequence_unique
    UNIQUE (user_id, event_sequence),
  CONSTRAINT adaptive_nutrition_events_selection_fk
    FOREIGN KEY (user_id, selection_id)
    REFERENCES public.user_premium_plan_selections(user_id, id) ON DELETE RESTRICT,
  CONSTRAINT adaptive_nutrition_events_operation_fk
    FOREIGN KEY (user_id, operation_id)
    REFERENCES public.adaptive_nutrition_operations(user_id, operation_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT adaptive_nutrition_events_supersedes_fk
    FOREIGN KEY (user_id, supersedes_event_id)
    REFERENCES public.adaptive_nutrition_events(user_id, event_id) ON DELETE RESTRICT,
  CONSTRAINT adaptive_nutrition_events_source_graph_fk
    FOREIGN KEY (user_id, selection_id, source_plan_revision)
    REFERENCES public.adaptive_nutrition_graph_revisions(user_id, selection_id, plan_revision)
    ON DELETE RESTRICT,
  CONSTRAINT adaptive_nutrition_events_sequence_check CHECK (event_sequence > 0),
  CONSTRAINT adaptive_nutrition_events_index_check CHECK (event_index >= 0),
  CONSTRAINT adaptive_nutrition_events_kind_check CHECK (
    kind IN ('PLAN_ACTIVATED', 'PLAN_REPLACED', 'FACT', 'FACT_RETRACTION',
             'ANNOTATION', 'ANNOTATION_RETRACTION')
  ),
  CONSTRAINT adaptive_nutrition_events_json_check CHECK (
    pg_catalog.jsonb_typeof(snapshot) = 'object'
    AND pg_catalog.jsonb_typeof(component_manifest) = 'array'
  ),
  CONSTRAINT adaptive_nutrition_events_plan_link_check CHECK (
    (selection_id IS NULL AND source_plan_revision IS NULL AND source_goal_revision IS NULL)
    OR (selection_id IS NOT NULL AND source_plan_revision IS NOT NULL AND source_goal_revision IS NOT NULL)
  )
);

CREATE UNIQUE INDEX adaptive_nutrition_events_one_successor_idx
  ON public.adaptive_nutrition_events (user_id, supersedes_event_id)
  WHERE supersedes_event_id IS NOT NULL;
CREATE UNIQUE INDEX adaptive_nutrition_events_one_root_idx
  ON public.adaptive_nutrition_events (user_id, stream_id)
  WHERE supersedes_event_id IS NULL;
CREATE INDEX adaptive_nutrition_events_selection_date_idx
  ON public.adaptive_nutrition_events (user_id, selection_id, local_date, event_sequence);

ALTER TABLE public.food_diary_entries
  ADD COLUMN nutrition_event_id uuid NULL,
  ADD COLUMN nutrition_component_id text NULL,
  ADD CONSTRAINT food_diary_entries_nutrition_link_check CHECK (
    (nutrition_event_id IS NULL AND nutrition_component_id IS NULL)
    OR (nutrition_event_id IS NOT NULL AND nutrition_component_id IS NOT NULL
        AND nutrition_component_id <> '')
  ),
  ADD CONSTRAINT food_diary_entries_nutrition_event_fk
    FOREIGN KEY (user_id, nutrition_event_id)
    REFERENCES public.adaptive_nutrition_events(user_id, event_id) ON DELETE RESTRICT,
  ADD CONSTRAINT food_diary_entries_nutrition_component_unique
    UNIQUE (user_id, nutrition_event_id, nutrition_component_id);

CREATE FUNCTION potok_nutrition.protect_diary_projection_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF CURRENT_USER = 'postgres' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.nutrition_event_id IS NOT NULL OR NEW.nutrition_component_id IS NOT NULL THEN
      RAISE EXCEPTION 'adaptive diary projection is server-managed' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.nutrition_event_id IS NOT NULL
     OR (TG_OP = 'UPDATE' AND (NEW.nutrition_event_id IS NOT NULL
                              OR NEW.nutrition_component_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'adaptive diary projection is server-managed' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.protect_diary_projection_v1()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER potok_protect_diary_projection_v1
BEFORE INSERT OR UPDATE OR DELETE ON public.food_diary_entries
FOR EACH ROW EXECUTE FUNCTION potok_nutrition.protect_diary_projection_v1();

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.user_goals, public.user_premium_plan_selections,
     public.user_premium_meal_selections, public.food_diary_entries
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION potok_nutrition.reject_immutable_change_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.reject_immutable_change_v1()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER potok_graph_revisions_immutable_v1
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.adaptive_nutrition_graph_revisions
FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v1();
CREATE TRIGGER potok_events_immutable_v1
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.adaptive_nutrition_events
FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v1();

CREATE FUNCTION potok_nutrition.protect_operation_receipt_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'operation receipts cannot be deleted or truncated' USING ERRCODE = '55000';
  END IF;
  IF OLD.outcome <> 'in_progress' OR NEW.outcome = 'in_progress'
     OR ROW(NEW.user_id, NEW.idempotency_key, NEW.operation_id, NEW.selection_id,
            NEW.contract_version, NEW.action_type, NEW.canonical_request,
            NEW.digest_version, NEW.request_digest, NEW.created_at)
        IS DISTINCT FROM
        ROW(OLD.user_id, OLD.idempotency_key, OLD.operation_id, OLD.selection_id,
            OLD.contract_version, OLD.action_type, OLD.canonical_request,
            OLD.digest_version, OLD.request_digest, OLD.created_at) THEN
    RAISE EXCEPTION 'operation receipt is immutable after settlement' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.protect_operation_receipt_v1()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER potok_operations_update_guard_v1
BEFORE UPDATE ON public.adaptive_nutrition_operations
FOR EACH ROW EXECUTE FUNCTION potok_nutrition.protect_operation_receipt_v1();
CREATE TRIGGER potok_operations_delete_guard_v1
BEFORE DELETE OR TRUNCATE ON public.adaptive_nutrition_operations
FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v1();

ALTER TABLE public.adaptive_nutrition_graph_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_nutrition_graph_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_nutrition_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_nutrition_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_nutrition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_nutrition_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.adaptive_nutrition_graph_revisions,
  public.adaptive_nutrition_operations, public.adaptive_nutrition_events
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION potok_nutrition.commit_prevalidated_plan_transition_v1(
  p_account_id uuid,
  p_selection_id uuid,
  p_idempotency_key text,
  p_contract_version text,
  p_action_type text,
  p_canonical_request bytea,
  p_digest_version text,
  p_request_digest bytea,
  p_expected_plan_revision uuid,
  p_expected_goal_revision uuid,
  p_expected_history_revision uuid,
  p_expected_diary_revision uuid,
  p_new_plan_revision uuid,
  p_new_history_revision uuid,
  p_goal_snapshot jsonb,
  p_graph_snapshot jsonb,
  p_snapshot_encoding_version text,
  p_graph_digest bytea,
  p_event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_existing public.adaptive_nutrition_operations%ROWTYPE;
  v_selection public.user_premium_plan_selections%ROWTYPE;
  v_operation_id uuid := pg_catalog.gen_random_uuid();
  v_event_id uuid;
  v_stream_id uuid;
  v_event_sequence bigint;
  v_result jsonb;
BEGIN
  -- No application role has EXECUTE. A future duplicate-aware wire decoder may call
  -- this internal boundary only after validating and canonicalizing every field.
  IF p_account_id IS NULL OR p_selection_id IS NULL
     OR p_idempotency_key IS NULL OR p_idempotency_key = ''
     OR p_idempotency_key <> pg_catalog.btrim(p_idempotency_key)
     OR p_contract_version <> 'adaptive-nutrition-v1'
     OR p_action_type NOT IN ('PLAN_REPLACED', 'ANNOTATION', 'ANNOTATION_RETRACTION')
     OR p_canonical_request IS NULL OR p_digest_version IS NULL
     OR pg_catalog.octet_length(p_request_digest) <> 32 THEN
    RAISE EXCEPTION 'invalid prevalidated transition envelope' USING ERRCODE = '22023';
  END IF;
  IF p_action_type = 'PLAN_REPLACED' AND (
       p_new_plan_revision IS NULL OR p_goal_snapshot IS NULL OR p_graph_snapshot IS NULL
       OR p_snapshot_encoding_version IS NULL OR pg_catalog.octet_length(p_graph_digest) <> 32
       OR pg_catalog.jsonb_typeof(p_goal_snapshot) <> 'object'
       OR pg_catalog.jsonb_typeof(p_graph_snapshot) <> 'object'
       OR pg_catalog.jsonb_array_length(COALESCE(p_graph_snapshot -> 'days', '[]'::jsonb)) <> 7
     ) THEN
    RAISE EXCEPTION 'complete seven-day graph revision is required' USING ERRCODE = '22023';
  END IF;
  IF p_action_type = 'PLAN_REPLACED' AND EXISTS (
    SELECT 1
      FROM (
        SELECT pg_catalog.count(*) AS total,
               pg_catalog.count(DISTINCT (day_item ->> 'date')::date) AS distinct_dates,
               pg_catalog.min((day_item ->> 'date')::date) AS first_date,
               pg_catalog.max((day_item ->> 'date')::date) AS last_date
          FROM pg_catalog.jsonb_array_elements(p_graph_snapshot -> 'days') AS day(day_item)
      ) coverage
     WHERE coverage.total <> 7 OR coverage.distinct_dates <> 7
        OR coverage.first_date <> (
          SELECT s.week_anchor FROM public.user_premium_plan_selections s
           WHERE s.user_id = p_account_id AND s.id = p_selection_id
        )
        OR coverage.last_date <> (
          SELECT s.week_anchor + 6 FROM public.user_premium_plan_selections s
           WHERE s.user_id = p_account_id AND s.id = p_selection_id
        )
  ) THEN
    RAISE EXCEPTION 'graph must cover the bound Monday-Sunday week exactly' USING ERRCODE = '22023';
  END IF;
  IF p_action_type IN ('ANNOTATION', 'ANNOTATION_RETRACTION')
     AND (p_new_plan_revision IS NOT NULL OR p_graph_snapshot IS NOT NULL) THEN
    RAISE EXCEPTION 'annotation cannot replace the plan graph' USING ERRCODE = '22023';
  END IF;
  IF p_event IS NULL OR pg_catalog.jsonb_typeof(p_event) <> 'object'
     OR COALESCE(p_event ->> 'kind', '') <> p_action_type THEN
    RAISE EXCEPTION 'one matching event is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-adaptive-v1:' || p_account_id::text, 0)
  );

  SELECT o.* INTO v_existing
    FROM public.adaptive_nutrition_operations o
   WHERE o.user_id = p_account_id AND o.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.canonical_request <> p_canonical_request
       OR v_existing.request_digest <> p_request_digest
       OR v_existing.digest_version <> p_digest_version
       OR v_existing.contract_version <> p_contract_version
       OR v_existing.action_type <> p_action_type
       OR v_existing.selection_id IS DISTINCT FROM p_selection_id THEN
      RAISE EXCEPTION 'idempotency key payload mismatch' USING ERRCODE = '40001';
    END IF;
    IF v_existing.outcome = 'in_progress' THEN
      RAISE EXCEPTION 'operation result is unresolved' USING ERRCODE = '40001';
    END IF;
    RETURN v_existing.result_references;
  END IF;

  IF NOT potok_control.is_effective_entitlement_v2(
      p_account_id, 'premium', pg_catalog.statement_timestamp()
    ) THEN
    RAISE EXCEPTION 'verified Premium entitlement required' USING ERRCODE = '42501';
  END IF;

  SELECT s.* INTO v_selection
    FROM public.user_premium_plan_selections s
   WHERE s.user_id = p_account_id AND s.id = p_selection_id
   FOR UPDATE;
  IF NOT FOUND OR v_selection.contract_version <> 1 THEN
    RAISE EXCEPTION 'owned adaptive plan instance required' USING ERRCODE = '42501';
  END IF;
  IF ROW(v_selection.plan_revision, v_selection.goal_revision,
         v_selection.history_revision, v_selection.diary_revision)
     IS DISTINCT FROM ROW(p_expected_plan_revision, p_expected_goal_revision,
                          p_expected_history_revision, p_expected_diary_revision) THEN
    RAISE EXCEPTION 'stale adaptive plan revision' USING ERRCODE = '40001';
  END IF;
  IF (p_event ->> 'local_date')::date < v_selection.week_anchor
     OR (p_event ->> 'local_date')::date > v_selection.week_anchor + 6 THEN
    RAISE EXCEPTION 'event date is outside the bound week' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_typeof(COALESCE(p_event -> 'component_manifest', '[]'::jsonb)) <> 'array'
     OR pg_catalog.jsonb_array_length(COALESCE(p_event -> 'component_manifest', '[]'::jsonb)) <> 0 THEN
    RAISE EXCEPTION 'FACT/component writes are not enabled by this boundary' USING ERRCODE = '0A000';
  END IF;
  IF p_action_type = 'ANNOTATION_RETRACTION' THEN
    IF NULLIF(p_event ->> 'supersedes_event_id', '') IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.adaptive_nutrition_events target
       WHERE target.user_id = p_account_id
         AND target.selection_id = p_selection_id
         AND target.event_id = (p_event ->> 'supersedes_event_id')::uuid
         AND target.stream_id = (p_event ->> 'stream_id')::uuid
         AND target.kind = 'ANNOTATION'
         AND target.local_date = (p_event ->> 'local_date')::date
    ) THEN
      RAISE EXCEPTION 'annotation retraction must supersede its live owned annotation' USING ERRCODE = '40001';
    END IF;
  ELSIF NULLIF(p_event ->> 'supersedes_event_id', '') IS NOT NULL THEN
    RAISE EXCEPTION 'only annotation retraction may supersede in this bounded package' USING ERRCODE = '0A000';
  END IF;
  IF p_new_history_revision IS NULL
     OR p_new_history_revision = p_expected_history_revision THEN
    RAISE EXCEPTION 'new history revision required' USING ERRCODE = '22023';
  END IF;
  IF p_expected_goal_revision <> v_selection.goal_revision
     OR NOT EXISTS (
       SELECT 1 FROM public.user_goals g
        WHERE g.user_id = p_account_id AND g.goal_revision = p_expected_goal_revision
     ) THEN
    RAISE EXCEPTION 'goal revision is no longer authoritative' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.adaptive_nutrition_operations (
    user_id, idempotency_key, operation_id, selection_id, contract_version,
    action_type, canonical_request, digest_version, request_digest, outcome
  ) VALUES (
    p_account_id, p_idempotency_key, v_operation_id, p_selection_id,
    p_contract_version, p_action_type, p_canonical_request, p_digest_version,
    p_request_digest, 'in_progress'
  );

  IF p_new_plan_revision IS NOT NULL THEN
    INSERT INTO public.adaptive_nutrition_graph_revisions (
      user_id, selection_id, plan_revision, goal_revision, goal_snapshot,
      graph_snapshot, snapshot_encoding_version, content_digest,
      created_by_operation_id
    ) VALUES (
      p_account_id, p_selection_id, p_new_plan_revision,
      p_expected_goal_revision, p_goal_snapshot, p_graph_snapshot,
      p_snapshot_encoding_version, p_graph_digest, v_operation_id
    );
  END IF;

  v_event_id := (p_event ->> 'event_id')::uuid;
  v_stream_id := (p_event ->> 'stream_id')::uuid;
  SELECT COALESCE(pg_catalog.max(e.event_sequence), 0::bigint) + 1::bigint
    INTO v_event_sequence
    FROM public.adaptive_nutrition_events e
   WHERE e.user_id = p_account_id;

  INSERT INTO public.adaptive_nutrition_events (
    user_id, selection_id, event_id, operation_id, stream_id,
    event_sequence, event_index, kind, local_date, slot_id,
    source_plan_revision, source_goal_revision, snapshot, component_manifest,
    supersedes_event_id
  ) VALUES (
    p_account_id, p_selection_id, v_event_id, v_operation_id, v_stream_id,
    v_event_sequence, 0, p_action_type, (p_event ->> 'local_date')::date,
    NULLIF(p_event ->> 'slot_id', '')::uuid,
    COALESCE(p_new_plan_revision, p_expected_plan_revision),
    p_expected_goal_revision,
    COALESCE(p_event -> 'snapshot', '{}'::jsonb),
    COALESCE(p_event -> 'component_manifest', '[]'::jsonb),
    NULLIF(p_event ->> 'supersedes_event_id', '')::uuid
  );

  UPDATE public.user_premium_plan_selections
     SET plan_revision = COALESCE(p_new_plan_revision, plan_revision),
         history_revision = p_new_history_revision,
         updated_at = pg_catalog.statement_timestamp()
   WHERE user_id = p_account_id AND id = p_selection_id;

  v_result := pg_catalog.jsonb_build_object(
    'contract', 'adaptive-nutrition-receipt-v1',
    'outcome', 'accepted',
    'operation_id', v_operation_id,
    'selection_id', p_selection_id,
    'plan_revision', COALESCE(p_new_plan_revision, p_expected_plan_revision),
    'goal_revision', p_expected_goal_revision,
    'history_revision', p_new_history_revision,
    'diary_revision', p_expected_diary_revision,
    'event_ids', pg_catalog.jsonb_build_array(v_event_id)
  );

  UPDATE public.adaptive_nutrition_operations
     SET outcome = 'accepted', result_references = v_result,
         committed_at = pg_catalog.statement_timestamp()
   WHERE user_id = p_account_id AND idempotency_key = p_idempotency_key;
  RETURN v_result;
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.commit_prevalidated_plan_transition_v1(
  uuid, uuid, text, text, text, bytea, text, bytea,
  uuid, uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, text, bytea, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.adaptive_nutrition_lookup_v1(p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_operation public.adaptive_nutrition_operations%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'denied');
  END IF;
  SELECT o.* INTO v_operation
    FROM public.adaptive_nutrition_operations o
   WHERE o.user_id = v_actor AND o.idempotency_key = p_idempotency_key;
  IF NOT FOUND OR v_operation.outcome = 'in_progress' THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'unknown');
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'kind', 'settled', 'operation_id', v_operation.operation_id,
    'idempotency_key', v_operation.idempotency_key,
    'digest_version', v_operation.digest_version,
    'request_digest_hex', pg_catalog.encode(v_operation.request_digest, 'hex'),
    'outcome', v_operation.outcome, 'reason', v_operation.reason,
    'result', v_operation.result_references,
    'committed_at', v_operation.committed_at
  );
END
$function$;

CREATE FUNCTION public.adaptive_nutrition_read_v1(
  p_selection_id uuid,
  p_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_selection public.user_premium_plan_selections%ROWTYPE;
  v_operation public.adaptive_nutrition_operations%ROWTYPE;
  v_plan_revision uuid;
  v_goal_revision uuid;
  v_history_revision uuid;
  v_diary_revision uuid;
  v_graph jsonb;
  v_events jsonb;
BEGIN
  IF v_actor IS NULL THEN RETURN pg_catalog.jsonb_build_object('kind', 'denied'); END IF;
  SELECT s.* INTO v_selection
    FROM public.user_premium_plan_selections s
   WHERE s.user_id = v_actor AND s.id = p_selection_id AND s.contract_version = 1;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('kind', 'denied'); END IF;

  IF p_operation_id IS NULL THEN
    IF NOT potok_control.is_effective_entitlement_v2(
        v_actor, 'premium', pg_catalog.statement_timestamp()
      ) THEN RETURN pg_catalog.jsonb_build_object('kind', 'denied'); END IF;
    v_plan_revision := v_selection.plan_revision;
    v_history_revision := v_selection.history_revision;
    v_diary_revision := v_selection.diary_revision;
  ELSE
    SELECT o.* INTO v_operation
      FROM public.adaptive_nutrition_operations o
     WHERE o.user_id = v_actor AND o.operation_id = p_operation_id
       AND o.selection_id = p_selection_id AND o.outcome = 'accepted';
    IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('kind', 'denied'); END IF;
    v_plan_revision := (v_operation.result_references ->> 'plan_revision')::uuid;
    v_history_revision := (v_operation.result_references ->> 'history_revision')::uuid;
    v_diary_revision := (v_operation.result_references ->> 'diary_revision')::uuid;
  END IF;

  SELECT pg_catalog.jsonb_build_object(
           'plan_revision', g.plan_revision,
           'goal_revision', g.goal_revision,
           'goal_snapshot', g.goal_snapshot,
           'graph_snapshot', g.graph_snapshot,
           'snapshot_encoding_version', g.snapshot_encoding_version,
           'content_digest_hex', pg_catalog.encode(g.content_digest, 'hex')
         ), g.goal_revision
    INTO v_graph, v_goal_revision
    FROM public.adaptive_nutrition_graph_revisions g
   WHERE g.user_id = v_actor AND g.selection_id = p_selection_id
     AND g.plan_revision = v_plan_revision;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('kind', 'not-ready', 'reason', 'graph-missing'); END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'event_id', e.event_id, 'operation_id', e.operation_id,
      'stream_id', e.stream_id, 'sequence', e.event_sequence,
      'kind', e.kind, 'local_date', e.local_date, 'slot_id', e.slot_id,
      'source_plan_revision', e.source_plan_revision,
      'source_goal_revision', e.source_goal_revision,
      'snapshot', e.snapshot, 'component_manifest', e.component_manifest,
      'supersedes_event_id', e.supersedes_event_id
    ) ORDER BY e.event_sequence), '[]'::jsonb)
    INTO v_events
    FROM public.adaptive_nutrition_events e
   WHERE e.user_id = v_actor AND e.selection_id = p_selection_id
     AND e.event_sequence <= COALESCE((
       SELECT pg_catalog.max(boundary.event_sequence)
         FROM public.adaptive_nutrition_events boundary
        WHERE boundary.user_id = v_actor
          AND (p_operation_id IS NULL OR boundary.operation_id = p_operation_id)
     ), 0::bigint);

  RETURN pg_catalog.jsonb_build_object(
    'kind', 'ready', 'selection_id', p_selection_id,
    'week_anchor', v_selection.week_anchor, 'timezone', v_selection.timezone,
    'status', v_selection.status, 'origin_kind', v_selection.origin_kind,
    'origin_lineage', v_selection.origin_lineage,
    'plan_revision', v_plan_revision, 'goal_revision', v_goal_revision,
    'history_revision', v_history_revision, 'diary_revision', v_diary_revision,
    'graph', v_graph, 'events', v_events,
    'exact_operation_id', p_operation_id
  );
END
$function$;

REVOKE ALL ON FUNCTION public.adaptive_nutrition_lookup_v1(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.adaptive_nutrition_read_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION potok_nutrition.commit_prevalidated_plan_transition_v1(
  uuid, uuid, text, text, text, bytea, text, bytea,
  uuid, uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, text, bytea, jsonb
) IS 'Internal owner-only atomic graph/history/receipt boundary. Not a wire decoder; FACT writes disabled.';
COMMENT ON TABLE public.adaptive_nutrition_operations IS
  'Durable account-scoped idempotency receipts; terminal rows are retained.';
COMMENT ON TABLE public.adaptive_nutrition_events IS
  'Append-only nutrition plan/fact history foundation; FACT projection writer is not enabled by this patch.';

COMMIT;

-- Deliberately absent:
-- * EXECUTE grants for runtime lookup/read/mutation;
-- * public raw-wire mutation RPC or trust in a client digest;
-- * FACT/component diary writes, effective-diary replacement or managed-date barrier;
-- * canonical food/recipe validation, activation/backfill, payment or production work.
