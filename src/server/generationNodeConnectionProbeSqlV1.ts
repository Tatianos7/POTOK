// Exact existing SELECT-only metadata probe; parity is enforced in tests.
export const generationNodeConnectionProbeSqlV1 = `-- Connection-only probe. No business rows, credentials, writers or source locks.
WITH expected(role_name,signature) AS (VALUES
 ('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)'),
 ('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)'),
 ('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_producer_source_v1(uuid,text,bytea,uuid,bytea,bytea,bytea)'),
 ('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_goal_preparation_source_v1(uuid)'),
 ('potok_generation_gateway_v1','potok_nutrition.load_generation_request_v2(uuid)'),
 ('potok_generation_gateway_v1','potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)'),
 ('potok_generation_gateway_v1','potok_nutrition.activate_generated_week_gateway_v2(uuid)')
),checks(label,ok) AS (
 SELECT 'session_identity',current_user=session_user AND current_user IN ('potok_generation_reader_v1','potok_generation_gateway_v1')
 UNION ALL
 SELECT 'role_attributes',EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND rolcanlogin AND rolconnlimit=2 AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
 UNION ALL
 SELECT 'memberships',NOT EXISTS(SELECT FROM pg_auth_members WHERE member=to_regrole(current_user)) AND NOT EXISTS(SELECT FROM pg_auth_members WHERE roleid=to_regrole(current_user) AND member NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('postgres','supabase_admin')))
 UNION ALL
 SELECT 'function_allowlist',COALESCE((SELECT bool_and(has_function_privilege(current_user,e.signature,'EXECUTE')) FROM expected e WHERE e.role_name=current_user),false)
   AND (SELECT count(*) FROM expected WHERE role_name=current_user)=(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition' AND has_function_privilege(current_user,p.oid,'EXECUTE'))
 UNION ALL
 SELECT 'table_access',NOT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','potok_nutrition','potok_control','potok_food_evidence','potok_nonfood','potok_delivery') AND c.relkind IN('r','p','v','m','S','f') AND CASE WHEN c.relkind='S' THEN has_sequence_privilege(current_user,c.oid,'USAGE,SELECT,UPDATE') ELSE has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') END)
 UNION ALL
 SELECT 'ownership',NOT EXISTS(SELECT FROM pg_class WHERE relowner=to_regrole(current_user)) AND NOT EXISTS(SELECT FROM pg_proc WHERE proowner=to_regrole(current_user)) AND NOT EXISTS(SELECT FROM pg_namespace WHERE nspowner=to_regrole(current_user))
 UNION ALL
 SELECT 'schema_access',has_schema_privilege(current_user,'potok_nutrition','USAGE') AND NOT has_schema_privilege(current_user,'potok_nutrition','CREATE')
 UNION ALL
 SELECT 'tls',COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false)
 UNION ALL
 SELECT 'timeouts',current_setting('statement_timeout')::interval>interval '0s' AND current_setting('statement_timeout')::interval<=interval '30s'
   AND current_setting('lock_timeout')::interval>interval '0s' AND current_setting('lock_timeout')::interval<=interval '5s'
   AND current_setting('idle_in_transaction_session_timeout')::interval>interval '0s' AND current_setting('idle_in_transaction_session_timeout')::interval<=interval '10s'
 UNION ALL
 SELECT 'read_only_probe',current_setting('transaction_read_only')='on'
)
SELECT jsonb_build_object('contract','potok-generation-connection-observation-v1','role',current_user,
 'checks',jsonb_object_agg(label,ok),'connectionChecksPassed',bool_and(ok),'mayActivate',false) FROM checks;
`;
