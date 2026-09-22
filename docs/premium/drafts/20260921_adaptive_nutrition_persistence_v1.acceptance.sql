-- POTOK Adaptive Nutrition persistence v1 — ROLLBACK-ONLY ACCEPTANCE DRAFT.
-- NOT RUN. STAGING-only after migration apply and separate owner authorization.
-- This file intentionally contains no COMMIT and ends in ROLLBACK.

BEGIN;

DO $structural_cases$
DECLARE
  v_count integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required';
  END IF;

  SELECT pg_catalog.count(*) INTO v_count
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'adaptive_nutrition_graph_revisions',
       'adaptive_nutrition_operations',
       'adaptive_nutrition_events'
     )
     AND c.relrowsecurity AND c.relforcerowsecurity;
  IF v_count <> 3 THEN RAISE EXCEPTION 'adaptive tables must use RLS + FORCE RLS'; END IF;

  IF has_table_privilege('anon', 'public.adaptive_nutrition_operations', 'SELECT')
     OR has_table_privilege('authenticated', 'public.adaptive_nutrition_operations', 'INSERT')
     OR has_table_privilege('service_role', 'public.adaptive_nutrition_operations', 'SELECT') THEN
    RAISE EXCEPTION 'direct operation ledger privileges leaked';
  END IF;
  IF has_table_privilege('authenticated', 'public.user_premium_plan_selections', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.food_diary_entries', 'TRUNCATE') THEN
    RAISE EXCEPTION 'structural legacy-table privileges remain available to an app role';
  END IF;
  IF has_function_privilege(
       'authenticated',
       'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)',
       'EXECUTE'
     ) OR has_function_privilege(
       'service_role',
       'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'internal atomic boundary leaked to an application role';
  END IF;
  IF has_function_privilege('authenticated', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'read-model runtime activation is premature';
  END IF;

  SELECT pg_catalog.count(*) INTO v_count
    FROM pg_catalog.pg_proc p
   WHERE p.oid IN (
     'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'::regprocedure,
     'public.adaptive_nutrition_lookup_v1(text)'::regprocedure,
     'public.adaptive_nutrition_read_v1(uuid,uuid)'::regprocedure
   )
     AND p.prosecdef
     AND COALESCE('search_path=pg_catalog' = ANY(p.proconfig), false);
  IF v_count <> 3 THEN RAISE EXCEPTION 'definer functions need fixed search_path'; END IF;
END
$structural_cases$;

DO $legacy_cases$
DECLARE
  v_selection_count bigint;
  v_diary_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO v_selection_count
    FROM public.user_premium_plan_selections WHERE contract_version <> 0;
  IF v_selection_count <> 0 THEN
    RAISE EXCEPTION 'migration must not activate legacy selections';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_premium_plan_selections
     WHERE contract_version = 0 AND (
       week_anchor IS NOT NULL OR timezone IS NOT NULL OR plan_revision IS NOT NULL
       OR goal_revision IS NOT NULL OR history_revision IS NOT NULL
       OR diary_revision IS NOT NULL OR origin_kind IS NOT NULL OR origin_lineage IS NOT NULL
     )
  ) THEN RAISE EXCEPTION 'legacy selection received invented adaptive state'; END IF;
  SELECT pg_catalog.count(*) INTO v_diary_count
    FROM public.food_diary_entries
   WHERE nutrition_event_id IS NOT NULL OR nutrition_component_id IS NOT NULL;
  IF v_diary_count <> 0 THEN RAISE EXCEPTION 'legacy diary was linked without an event'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_goals WHERE goal_revision IS NULL) THEN
    RAISE EXCEPTION 'goal revision backfill incomplete';
  END IF;
END
$legacy_cases$;

-- Future separately reviewed behavioral cases after an exact fixture is approved:
-- 1. owner-only creation of one generated v1 instance linked to one real goal row;
-- 2. temporary verified Premium grant inside this transaction;
-- 3. accepted graph transition stores graph + event + head + terminal receipt atomically;
-- 4. same account/key/payload returns exact original receipt after entitlement expiry;
-- 5. same key/different payload, stale revisions and foreign account fail closed;
-- 6. injected failure leaves no graph/event/head/receipt fragment;
-- 7. exact read binds graph/history/diary revisions from the receipt;
-- 8. append-only guards reject update/delete/truncate and one-successor forks;
-- 9. FACT/diary cases remain intentionally unavailable until canonical evidence and
--    the effective-diary/legacy-writer transition receive a separate package.

ROLLBACK;
