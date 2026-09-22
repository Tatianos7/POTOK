-- POTOK Adaptive Nutrition runtime activation v1 — SELECT-ONLY POSTCHECK.
-- Target: STAGING ozidryfvhkcbtpnulakq, only after the behavioral acceptance reaches
-- its final ROLLBACK. Every returned count must be zero. No writes or RPC calls.

SELECT 'runtime_tables' AS section,
       (SELECT pg_catalog.count(*)
          FROM public.adaptive_nutrition_operations) AS operations,
       (SELECT pg_catalog.count(*)
          FROM public.adaptive_nutrition_graph_revisions) AS graph_revisions,
       (SELECT pg_catalog.count(*)
          FROM public.adaptive_nutrition_events) AS events,
       (SELECT pg_catalog.count(*)
          FROM potok_nutrition.validated_plan_replacement_offers_v1) AS replacement_offers;

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
       (SELECT pg_catalog.count(*) FROM public.user_premium_meal_selections m
         WHERE m.user_premium_plan_selection_id IN (
           '71000000-0000-4000-8000-000000000001'::uuid,
           '71000000-0000-4000-8000-000000000002'::uuid
         )) AS legacy_meal_selections,
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
         WHERE o.idempotency_key LIKE 'runtime-acceptance/%') AS operation_markers,
       (SELECT pg_catalog.count(*) FROM public.user_goals g
         WHERE g.goal_type = 'runtime_acceptance_fixture') AS goal_markers,
       (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
         WHERE s.origin_lineage ->> 'source' = 'runtime-acceptance-v1') AS selection_markers,
       (SELECT pg_catalog.count(*) FROM potok_control.access_attestations a
         WHERE a.evidence_ref LIKE 'runtime-acceptance/%') AS attestation_markers,
       (SELECT pg_catalog.count(*)
          FROM potok_nutrition.validated_plan_replacement_offers_v1 offer
         WHERE offer.event_snapshot ->> 'fixture' IN (
           'valid-private-offer', 'expired-offer',
           'mismatched-offer', 'foreign-offer'
         )) AS offer_markers;
