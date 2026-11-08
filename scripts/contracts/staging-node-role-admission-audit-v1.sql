-- Staging Node generator roles: repeatable, read-only privilege audit.
-- Source of truth is effective PostgreSQL grants, not role names or JWT/GUC claims.
-- Project: ozidryfvhkcbtpnulakq. Never grants privileges or activates a worker.
WITH identities AS (
 SELECT count(*)=2 AND bool_and(rolcanlogin AND rolconnlimit=2 AND NOT rolsuper AND NOT rolbypassrls
   AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit) AS restricted
 FROM pg_catalog.pg_roles
 WHERE rolname IN ('potok_generation_reader_v1','potok_generation_gateway_v1')
), grants AS (
 SELECT
  has_schema_privilege('potok_generation_reader_v1','potok_nutrition','USAGE')
   AND has_function_privilege('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)','EXECUTE')
   AND has_function_privilege('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)','EXECUTE')
   AND has_function_privilege('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_producer_source_v1(uuid,text,bytea,uuid,bytea,bytea,bytea)','EXECUTE')
   AND has_function_privilege('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)','EXECUTE')
   AS reader_can_read,
  has_schema_privilege('potok_generation_gateway_v1','potok_nutrition','USAGE')
   AND has_function_privilege('potok_generation_gateway_v1','potok_nutrition.load_generation_request_v2(uuid)','EXECUTE')
   AND has_function_privilege('potok_generation_gateway_v1','potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)','EXECUTE')
   AND has_function_privilege('potok_generation_gateway_v1','potok_nutrition.activate_generated_week_gateway_v2(uuid)','EXECUTE')
   AS gateway_can_process,
  NOT has_function_privilege('potok_generation_reader_v1','potok_nutrition.load_generation_request_v2(uuid)','EXECUTE')
   AND NOT has_function_privilege('potok_generation_reader_v1','potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)','EXECUTE')
   AND NOT has_function_privilege('potok_generation_reader_v1','potok_nutrition.activate_generated_week_gateway_v2(uuid)','EXECUTE')
   AND NOT has_function_privilege('potok_generation_reader_v1','potok_nutrition.publish_candidate_manifest_v2(bytea,uuid,uuid,uuid)','EXECUTE')
   AS reader_cannot_process_or_publish,
  NOT has_function_privilege('potok_generation_gateway_v1','potok_nutrition.publish_candidate_manifest_v2(bytea,uuid,uuid,uuid)','EXECUTE')
   AS gateway_cannot_publish
), state AS (
 SELECT
  (SELECT count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2) AS manifest_heads,
  (SELECT count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2) AS candidate_entries,
  (SELECT count(*) FROM potok_nutrition.adaptive_nutrition_generation_policy_head_v2) AS policy_heads,
  (SELECT count(*) FROM potok_nutrition.adaptive_nutrition_goal_targets_v1) AS goal_targets
)
SELECT jsonb_build_object(
 'contract','potok-staging-node-role-admission-audit-v1','read_only',true,
 'roles_restricted',identities.restricted,
 'reader_can_read',grants.reader_can_read,
 'gateway_can_process',grants.gateway_can_process,
 'reader_cannot_process_or_publish',grants.reader_cannot_process_or_publish,
 'gateway_cannot_publish',grants.gateway_cannot_publish,
 'grants_ready',(identities.restricted AND grants.reader_can_read AND grants.gateway_can_process
   AND grants.reader_cannot_process_or_publish AND grants.gateway_cannot_publish),
 'live_tls_connectivity_proven',false,
 'worker_activation_permitted',false,
 'state',jsonb_build_object('manifest_heads',state.manifest_heads,
   'candidate_entries',state.candidate_entries,'policy_heads',state.policy_heads,
   'goal_targets',state.goal_targets)
) AS audit FROM identities CROSS JOIN grants CROSS JOIN state;
