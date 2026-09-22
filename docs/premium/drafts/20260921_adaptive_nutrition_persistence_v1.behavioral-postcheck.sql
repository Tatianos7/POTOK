-- POTOK Adaptive Nutrition persistence v1 — READ-ONLY POSTCHECK.
-- Target: STAGING ozidryfvhkcbtpnulakq, only after the behavioral acceptance ends
-- at its final ROLLBACK. Every returned count must be zero.

SELECT 'adaptive_tables' AS section,
       (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations) AS operations,
       (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions) AS graph_revisions,
       (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events) AS events;

SELECT 'fixture_accounts' AS section,
       (SELECT pg_catalog.count(*) FROM public.user_profiles p
         WHERE p.user_id IN (
           'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
           '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid
         )) AS profiles,
       (SELECT pg_catalog.count(*) FROM public.user_goals g
         WHERE g.user_id IN (
           'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
           '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid
         )) AS goals,
       (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
         WHERE s.user_id IN (
           'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
           '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid
         )) AS selections,
       (SELECT pg_catalog.count(*) FROM public.food_diary_entries d
         WHERE d.user_id IN (
           'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
           '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid
         )) AS diary_rows,
       (SELECT pg_catalog.count(*) FROM potok_control.access_attestations a
         WHERE a.account_id IN (
           'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
           '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid
         )) AS attestations;

SELECT 'fixture_markers' AS section,
       (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
         WHERE o.idempotency_key LIKE 'behavioral/%') AS operation_markers,
       (SELECT pg_catalog.count(*) FROM potok_control.access_attestations a
         WHERE a.evidence_ref LIKE 'behavioral-acceptance/%') AS attestation_markers;
