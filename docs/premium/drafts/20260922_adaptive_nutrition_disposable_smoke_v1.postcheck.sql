-- POTOK Adaptive Nutrition disposable-branch smoke v1 — SELECT-ONLY POST-SMOKE CHECK.
-- Run only after SKIPPED + receipt-bound exact read + refresh + UNDO + refresh +
-- logout/login checks complete in the disposable branch. No function/RPC is called.

WITH sole_auth_user AS (
  SELECT pg_catalog.min(u.id) AS account_id, pg_catalog.count(*) AS account_count
    FROM auth.users u
), fixture AS (
  SELECT a.account_id, s.*
    FROM sole_auth_user a
    JOIN public.user_premium_plan_selections s ON s.user_id = a.account_id
   WHERE s.id = '9a220000-0000-4000-8000-000000000001'::uuid
     AND s.origin_lineage ->> 'source' = 'potok-disposable-branch-smoke-v1'
)
SELECT 'fixture_identity' AS section,
       (SELECT account_count FROM sole_auth_user) AS auth_users,
       (SELECT pg_catalog.count(*) FROM fixture) AS exact_selections,
       (SELECT pg_catalog.count(*) FROM public.user_goals g
         JOIN sole_auth_user a ON a.account_id = g.user_id
        WHERE g.goal_type = 'disposable_branch_smoke_v1') AS goals,
       (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g
         JOIN fixture f ON f.account_id = g.user_id AND f.id = g.selection_id) AS graph_revisions,
       (SELECT pg_catalog.count(*) FROM potok_nutrition.validated_plan_replacement_offers_v1)
         AS replacement_offers;

WITH sole_auth_user AS (
  SELECT pg_catalog.min(u.id) AS account_id FROM auth.users u
), fixture_operations AS (
  SELECT o.* FROM public.adaptive_nutrition_operations o
  JOIN sole_auth_user a ON a.account_id = o.user_id
  WHERE o.selection_id = '9a220000-0000-4000-8000-000000000001'::uuid
)
SELECT 'receipts' AS section,
       pg_catalog.count(*) AS total_operations,
       pg_catalog.count(*) FILTER (WHERE idempotency_key = 'disposable-branch-smoke-v1/bootstrap')
         AS bootstrap_operations,
       pg_catalog.count(*) FILTER (WHERE action_type = 'ANNOTATION' AND outcome = 'accepted')
         AS accepted_skips,
       pg_catalog.count(*) FILTER (WHERE action_type = 'ANNOTATION_RETRACTION' AND outcome = 'accepted')
         AS accepted_undos,
       pg_catalog.count(*) FILTER (WHERE outcome <> 'accepted') AS nonaccepted_operations,
       pg_catalog.count(*) FILTER (WHERE request_digest <> extensions.digest(canonical_request, 'sha256'))
         AS digest_mismatches
  FROM fixture_operations;

WITH sole_auth_user AS (
  SELECT pg_catalog.min(u.id) AS account_id FROM auth.users u
), fixture_events AS (
  SELECT e.* FROM public.adaptive_nutrition_events e
  JOIN sole_auth_user a ON a.account_id = e.user_id
  WHERE e.selection_id = '9a220000-0000-4000-8000-000000000001'::uuid
)
SELECT 'annotation_history' AS section,
       pg_catalog.count(*) AS total_events,
       pg_catalog.count(*) FILTER (WHERE e.kind = 'ANNOTATION') AS annotations,
       pg_catalog.count(*) FILTER (WHERE e.kind = 'ANNOTATION_RETRACTION') AS retractions,
       pg_catalog.count(*) FILTER (WHERE e.kind IN ('FACT', 'FACT_RETRACTION', 'PLAN_REPLACED'))
         AS forbidden_events,
       pg_catalog.count(*) FILTER (
         WHERE e.kind = 'ANNOTATION'
           AND NOT EXISTS (
             SELECT 1 FROM fixture_events successor
              WHERE successor.supersedes_event_id = e.event_id
           )
       ) AS live_annotations,
       pg_catalog.count(*) FILTER (
         WHERE e.kind = 'ANNOTATION'
           AND (SELECT pg_catalog.count(*) FROM fixture_events successor
                 WHERE successor.supersedes_event_id = e.event_id) <> 1
       ) AS wrong_successor_counts
  FROM fixture_events e;

WITH sole_auth_user AS (
  SELECT pg_catalog.min(u.id) AS account_id FROM auth.users u
)
SELECT 'isolation_and_fact_absence' AS section,
       (SELECT pg_catalog.count(*) FROM public.user_profiles) AS profiles,
       (SELECT pg_catalog.count(*) FROM public.user_goals) AS goals,
       (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections) AS selections,
       (SELECT pg_catalog.count(*) FROM public.user_premium_meal_selections) AS legacy_meal_rows,
       (SELECT pg_catalog.count(*) FROM public.food_diary_entries) AS diary_rows,
       (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
         WHERE o.user_id IS DISTINCT FROM a.account_id) AS foreign_operations,
       (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
         WHERE e.user_id IS DISTINCT FROM a.account_id) AS foreign_events
  FROM sole_auth_user a;

WITH sole_auth_user AS (
  SELECT pg_catalog.min(u.id) AS account_id FROM auth.users u
), latest_premium AS (
  SELECT e.* FROM potok_control.access_attestations e
  JOIN sole_auth_user a ON a.account_id = e.account_id
  WHERE e.capability = 'premium'
  ORDER BY e.lineage_sequence DESC
  LIMIT 1
)
SELECT 'entitlement_lineage' AS section,
       (SELECT pg_catalog.count(*) FROM potok_control.access_attestations) AS attestations,
       (SELECT effect FROM latest_premium) AS latest_effect,
       (SELECT valid_until > pg_catalog.statement_timestamp() FROM latest_premium) AS latest_not_expired,
       (SELECT evidence_ref FROM latest_premium) AS latest_evidence_ref,
       (SELECT p.premium_provenance_id = e.attestation_id
          FROM public.user_profiles p
          JOIN latest_premium e ON e.account_id = p.user_id) AS profile_matches_lineage;

-- Expected after exactly one successful SKIPPED and its UNDO:
-- fixture_identity: auth_users=1, exact_selections=1, goals=1, graph_revisions=1,
--   replacement_offers=0.
-- receipts: total_operations=3, bootstrap_operations=1, accepted_skips=1,
--   accepted_undos=1, nonaccepted_operations=0, digest_mismatches=0.
-- annotation_history: total_events=2, annotations=1, retractions=1,
--   forbidden_events=0, live_annotations=0, wrong_successor_counts=0.
-- isolation_and_fact_absence: profiles=1, goals=1, selections=1,
--   legacy_meal_rows=0, diary_rows=0, foreign_operations=0, foreign_events=0.
-- entitlement_lineage: attestations=1, latest_effect=GRANT, latest_not_expired=true,
--   latest_evidence_ref=adaptive-nutrition/disposable-branch-smoke-v1/grant,
--   profile_matches_lineage=true.
