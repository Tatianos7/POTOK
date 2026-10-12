-- DRAFT / DISPOSABLE compile fixture for the two effective function definitions.
-- The runner extracts both function bodies byte-for-byte from their reviewed
-- source files; these objects exist only so PostgreSQL can compile their rowtypes.

CREATE SCHEMA auth;
CREATE SCHEMA potok_nutrition;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';

CREATE TABLE public.adaptive_nutrition_operations (
  user_id uuid, idempotency_key text, operation_id uuid, selection_id uuid,
  contract_version text, action_type text, canonical_request bytea,
  digest_version text, request_digest bytea, outcome text, reason text,
  result_references jsonb, committed_at timestamptz
);
CREATE TABLE public.user_premium_plan_selections (
  user_id uuid, id uuid, contract_version smallint, status text,
  week_anchor date, timezone text, plan_revision uuid, goal_revision uuid,
  history_revision uuid, diary_revision uuid
);
CREATE TABLE public.adaptive_nutrition_graph_revisions (
  user_id uuid, selection_id uuid, plan_revision uuid, goal_revision uuid,
  goal_snapshot jsonb, graph_snapshot jsonb, snapshot_encoding_version text,
  content_digest bytea, created_by_operation_id uuid
);
CREATE TABLE public.adaptive_nutrition_events (
  user_id uuid, selection_id uuid, event_id uuid, operation_id uuid,
  stream_id uuid, event_sequence bigint, event_index integer, kind text,
  local_date date, slot_id uuid, source_plan_revision uuid,
  source_goal_revision uuid, snapshot jsonb, component_manifest jsonb,
  supersedes_event_id uuid
);
CREATE TABLE public.user_goals (user_id uuid, goal_revision uuid);
CREATE TABLE potok_nutrition.validated_plan_replacement_offers_v1 (
  account_id uuid, selection_id uuid, offer_id uuid, expires_at timestamptz,
  expected_plan_revision uuid, expected_goal_revision uuid,
  expected_history_revision uuid, expected_diary_revision uuid,
  local_date date, slot_id uuid, expected_snapshot_revision uuid,
  expected_recipe_revision uuid, expected_portion_revision uuid,
  new_plan_revision uuid, new_history_revision uuid, goal_snapshot jsonb,
  graph_snapshot jsonb, snapshot_encoding_version text, graph_digest bytea,
  event_snapshot jsonb
);

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'p5_02_function_owner') THEN CREATE ROLE p5_02_function_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'p5_02_observer') THEN CREATE ROLE p5_02_observer NOLOGIN; END IF;
END
$roles$;

CREATE TABLE public.p5_02_function_metadata_before AS
SELECT p.oid::regprocedure::text AS identity,
       p.proowner, p.prosecdef, p.proconfig, p.proacl
  FROM pg_catalog.pg_proc p
 WHERE false;

CREATE TABLE public.p5_02_serializable_counter (
  id integer PRIMARY KEY,
  value integer NOT NULL
);
INSERT INTO public.p5_02_serializable_counter VALUES (1, 0);
