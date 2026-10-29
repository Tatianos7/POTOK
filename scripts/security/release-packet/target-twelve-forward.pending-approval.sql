-- PENDING SEPARATE EXACT OWNER APPROVAL: managed POTOK permanent SQL installation.
-- Connection must be independently bound to dtsdnhbcwpbfrhcazqkb (reviewed connector or fixed linked CLI).
-- SQL metadata is NOT cryptographic project/connection identity.
-- Four managed ACCESS SHARE locks do not freeze provider writes. Any observed
-- concurrent scope/content/sequence change stops. Do not run during maintenance.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';SET LOCAL datestyle='ISO,YMD';SET LOCAL extra_float_digits=3;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='120s';
SET LOCAL idle_in_transaction_session_timeout='120s';
DO $context$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR (SELECT rolsuper OR NOT rolbypassrls FROM pg_roles WHERE rolname=current_user)
 OR current_setting('server_version_num')::integer<>170006
 OR current_setting('session_replication_role')<>'origin'
 OR current_setting('transaction_isolation')<>'read committed'
 OR EXISTS(SELECT FROM pg_roles WHERE rolname IN('anon','authenticated') AND (rolsuper OR rolbypassrls))
 OR EXISTS(SELECT FROM pg_namespace WHERE nspname IN('potok_control','potok_nutrition','potok_delivery'))
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_CONTEXT_STOPPED'; END IF;
END $context$;

DO $privileges$ BEGIN
 IF EXISTS(SELECT FROM jsonb_to_recordset('[{"schema":"auth","name":"audit_log_entries","all_modes":true},{"schema":"auth","name":"custom_oauth_providers","all_modes":true},{"schema":"auth","name":"flow_state","all_modes":true},{"schema":"auth","name":"identities","all_modes":true},{"schema":"auth","name":"instances","all_modes":true},{"schema":"auth","name":"mfa_amr_claims","all_modes":true},{"schema":"auth","name":"mfa_challenges","all_modes":true},{"schema":"auth","name":"mfa_factors","all_modes":true},{"schema":"auth","name":"mfa_recovery_code_sets","all_modes":true},{"schema":"auth","name":"mfa_recovery_codes","all_modes":true},{"schema":"auth","name":"oauth_authorizations","all_modes":true},{"schema":"auth","name":"oauth_client_states","all_modes":true},{"schema":"auth","name":"oauth_clients","all_modes":true},{"schema":"auth","name":"oauth_consents","all_modes":true},{"schema":"auth","name":"one_time_tokens","all_modes":true},{"schema":"auth","name":"refresh_tokens","all_modes":true},{"schema":"auth","name":"saml_providers","all_modes":true},{"schema":"auth","name":"saml_relay_states","all_modes":true},{"schema":"auth","name":"schema_migrations","all_modes":false},{"schema":"auth","name":"scim_tokens","all_modes":true},{"schema":"auth","name":"scim_users","all_modes":true},{"schema":"auth","name":"sessions","all_modes":true},{"schema":"auth","name":"sso_domains","all_modes":true},{"schema":"auth","name":"sso_providers","all_modes":true},{"schema":"auth","name":"users","all_modes":true},{"schema":"auth","name":"webauthn_challenges","all_modes":true},{"schema":"auth","name":"webauthn_credentials","all_modes":true},{"schema":"public","name":"ai_coaching_events","all_modes":true},{"schema":"public","name":"ai_generation_params","all_modes":true},{"schema":"public","name":"ai_guard_logs","all_modes":true},{"schema":"public","name":"ai_long_term_memory","all_modes":true},{"schema":"public","name":"ai_meal_plans","all_modes":true},{"schema":"public","name":"ai_quality_metrics","all_modes":true},{"schema":"public","name":"ai_recommendations","all_modes":true},{"schema":"public","name":"ai_training_plans","all_modes":true},{"schema":"public","name":"ai_trust_scores","all_modes":true},{"schema":"public","name":"analytics_events","all_modes":true},{"schema":"public","name":"billing_events","all_modes":true},{"schema":"public","name":"entitlements","all_modes":true},{"schema":"public","name":"exercise_categories","all_modes":true},{"schema":"public","name":"exercise_definition_media","all_modes":true},{"schema":"public","name":"exercise_definitions","all_modes":true},{"schema":"public","name":"exercise_muscles","all_modes":true},{"schema":"public","name":"exercises","all_modes":true},{"schema":"public","name":"favorite_products","all_modes":true},{"schema":"public","name":"feature_flags","all_modes":true},{"schema":"public","name":"food_alias_apply_audit","all_modes":true},{"schema":"public","name":"food_aliases","all_modes":true},{"schema":"public","name":"food_diary_entries","all_modes":true},{"schema":"public","name":"food_import_batches","all_modes":true},{"schema":"public","name":"food_import_conflicts","all_modes":true},{"schema":"public","name":"food_import_staging","all_modes":true},{"schema":"public","name":"food_missing_food_drafts","all_modes":true},{"schema":"public","name":"food_missing_review_queue","all_modes":true},{"schema":"public","name":"food_search_events","all_modes":true},{"schema":"public","name":"food_search_review_queue","all_modes":true},{"schema":"public","name":"foods","all_modes":true},{"schema":"public","name":"goal_trajectory","all_modes":true},{"schema":"public","name":"habit_logs","all_modes":true},{"schema":"public","name":"habits","all_modes":true},{"schema":"public","name":"meal_entry_notes","all_modes":true},{"schema":"public","name":"measurement_history","all_modes":true},{"schema":"public","name":"measurement_photo_assets","all_modes":true},{"schema":"public","name":"measurement_photo_deletions","all_modes":true},{"schema":"public","name":"measurement_photo_history","all_modes":true},{"schema":"public","name":"muscles","all_modes":true},{"schema":"public","name":"notification_history","all_modes":true},{"schema":"public","name":"nutrition_programs","all_modes":true},{"schema":"public","name":"pose_3d_angles","all_modes":true},{"schema":"public","name":"pose_3d_joints","all_modes":true},{"schema":"public","name":"pose_3d_metrics","all_modes":true},{"schema":"public","name":"pose_3d_sessions","all_modes":true},{"schema":"public","name":"pose_angles","all_modes":true},{"schema":"public","name":"pose_biomechanics","all_modes":true},{"schema":"public","name":"pose_deviations","all_modes":true},{"schema":"public","name":"pose_feedback_events","all_modes":true},{"schema":"public","name":"pose_frames","all_modes":true},{"schema":"public","name":"pose_guard_flags","all_modes":true},{"schema":"public","name":"pose_joints","all_modes":true},{"schema":"public","name":"pose_load_estimates","all_modes":true},{"schema":"public","name":"pose_quality_scores","all_modes":true},{"schema":"public","name":"pose_risk_assessments","all_modes":true},{"schema":"public","name":"pose_sessions","all_modes":true},{"schema":"public","name":"pose_voice_cues","all_modes":true},{"schema":"public","name":"program_adaptations","all_modes":true},{"schema":"public","name":"program_blocks","all_modes":true},{"schema":"public","name":"program_days","all_modes":true},{"schema":"public","name":"program_explainability","all_modes":true},{"schema":"public","name":"program_feedback","all_modes":true},{"schema":"public","name":"program_generation_jobs","all_modes":true},{"schema":"public","name":"program_guard_events","all_modes":true},{"schema":"public","name":"program_phases","all_modes":true},{"schema":"public","name":"program_sessions","all_modes":true},{"schema":"public","name":"program_versions","all_modes":true},{"schema":"public","name":"recipe_ingredients","all_modes":true},{"schema":"public","name":"recipe_notes","all_modes":true},{"schema":"public","name":"recipes","all_modes":true},{"schema":"public","name":"subscriptions","all_modes":true},{"schema":"public","name":"training_programs","all_modes":true},{"schema":"public","name":"user_exercise_media","all_modes":true},{"schema":"public","name":"user_goals","all_modes":true},{"schema":"public","name":"user_measurements","all_modes":true},{"schema":"public","name":"user_profiles","all_modes":true},{"schema":"public","name":"user_state","all_modes":true},{"schema":"public","name":"workout_day_notes","all_modes":true},{"schema":"public","name":"workout_days","all_modes":true},{"schema":"public","name":"workout_entries","all_modes":true},{"schema":"public","name":"workout_entry_notes","all_modes":true},{"schema":"storage","name":"buckets","all_modes":true},{"schema":"storage","name":"buckets_analytics","all_modes":true},{"schema":"storage","name":"buckets_vectors","all_modes":false},{"schema":"storage","name":"migrations","all_modes":false},{"schema":"storage","name":"objects","all_modes":true},{"schema":"storage","name":"s3_multipart_uploads","all_modes":true},{"schema":"storage","name":"s3_multipart_uploads_parts","all_modes":true},{"schema":"storage","name":"vector_indexes","all_modes":false}]'::jsonb) e(schema text,name text,all_modes boolean)
 LEFT JOIN pg_namespace n ON n.nspname=e.schema LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.name
 WHERE c.oid IS NULL OR NOT has_table_privilege(current_user,c.oid,'SELECT')
 OR has_table_privilege(current_user,c.oid,'MAINTAIN,UPDATE,DELETE,TRUNCATE') IS DISTINCT FROM e.all_modes)
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_LOCK_PRIVILEGES_STOPPED';END IF;
 END $privileges$;

LOCK TABLE "auth"."audit_log_entries" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."custom_oauth_providers" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."flow_state" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."identities" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."instances" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."mfa_amr_claims" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."mfa_challenges" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."mfa_factors" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."mfa_recovery_code_sets" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."mfa_recovery_codes" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."oauth_authorizations" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."oauth_client_states" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."oauth_clients" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."oauth_consents" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."one_time_tokens" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."refresh_tokens" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."saml_providers" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."saml_relay_states" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."schema_migrations" IN ACCESS SHARE MODE;
LOCK TABLE "auth"."scim_tokens" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."scim_users" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."sessions" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."sso_domains" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."sso_providers" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."users" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."webauthn_challenges" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "auth"."webauthn_credentials" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."ai_coaching_events" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."ai_generation_params" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."ai_guard_logs" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."ai_long_term_memory" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."ai_meal_plans" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."ai_quality_metrics" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."ai_recommendations" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."ai_training_plans" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."ai_trust_scores" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."analytics_events" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."billing_events" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."entitlements" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."exercise_categories" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."exercise_definition_media" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."exercise_definitions" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."exercise_muscles" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."exercises" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."favorite_products" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."feature_flags" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."food_alias_apply_audit" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."food_aliases" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."food_diary_entries" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."food_import_batches" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."food_import_conflicts" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."food_import_staging" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."food_missing_food_drafts" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."food_missing_review_queue" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."food_search_events" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."food_search_review_queue" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."foods" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."goal_trajectory" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."habit_logs" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."habits" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."meal_entry_notes" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."measurement_history" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."measurement_photo_assets" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."measurement_photo_deletions" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."measurement_photo_history" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."muscles" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."notification_history" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."nutrition_programs" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_3d_angles" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_3d_joints" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_3d_metrics" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_3d_sessions" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_angles" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_biomechanics" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_deviations" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_feedback_events" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_frames" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_guard_flags" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_joints" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_load_estimates" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_quality_scores" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_risk_assessments" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_sessions" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."pose_voice_cues" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."program_adaptations" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."program_blocks" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."program_days" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."program_explainability" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."program_feedback" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."program_generation_jobs" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."program_guard_events" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."program_phases" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."program_sessions" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."program_versions" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."recipe_ingredients" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."recipe_notes" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."recipes" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."subscriptions" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."training_programs" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."user_exercise_media" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."user_goals" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."user_measurements" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."user_profiles" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."user_state" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."workout_day_notes" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."workout_days" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."workout_entries" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."workout_entry_notes" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "storage"."buckets" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "storage"."buckets_analytics" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "storage"."buckets_vectors" IN ACCESS SHARE MODE;
LOCK TABLE "storage"."migrations" IN ACCESS SHARE MODE;
LOCK TABLE "storage"."objects" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "storage"."s3_multipart_uploads" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "storage"."s3_multipart_uploads_parts" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "storage"."vector_indexes" IN ACCESS SHARE MODE;
DO $metadata$ DECLARE actual text; BEGIN
 WITH relation_state AS (
 SELECT c.oid,c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relkind
 FROM pg_class c WHERE c.relnamespace='public'::regnamespace
), canonical_metadata AS (
 SELECT jsonb_build_object(
  'relations',(SELECT jsonb_agg(jsonb_build_array(c.relname,c.relkind,c.owner,c.relrowsecurity) ORDER BY c.relname) FROM relation_state c),
  'columns',(SELECT jsonb_agg(jsonb_build_array(c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text) ORDER BY c.relname,a.attnum) FROM relation_state c JOIN pg_attribute a ON a.attrelid=c.oid WHERE a.attnum>0 AND NOT a.attisdropped),
  'table_acl',(SELECT jsonb_agg(jsonb_build_array(c.relname,p.relacl::text) ORDER BY c.relname) FROM relation_state c JOIN pg_class p ON p.oid=c.oid),
  'routines',(SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl::text,md5(p.prosrc)) ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
  'policies',(SELECT jsonb_agg(jsonb_build_array(schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check) ORDER BY tablename,policyname) FROM pg_policies WHERE schemaname='public'),
  'defaults',(SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype,d.defaclacl::text) ORDER BY pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname IN('public','extensions'))
 ) AS document
)
 SELECT encode(sha256(convert_to(document::text,'UTF8')),'hex') INTO actual FROM canonical_metadata;
 IF actual IS DISTINCT FROM '427466d34aa57984cb4449a3532ece63ece1d27b61f6ccdfbea86c5cf4c878af' THEN RAISE EXCEPTION 'TARGET_REHEARSAL_METADATA_STOPPED';END IF;
END $metadata$;

DO $scope$ DECLARE actual jsonb; BEGIN
 SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'partition',c.relispartition,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'generated',a.attgenerated) ORDER BY a.attnum)
 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C")
 INTO actual FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('auth','public','storage') AND c.relkind IN('r','p');
 IF actual IS DISTINCT FROM '[{"schema":"auth","name":"audit_log_entries","kind":"r","partition":false,"columns":[{"name":"instance_id","type":"uuid","generated":""},{"name":"id","type":"uuid","generated":""},{"name":"payload","type":"json","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"ip_address","type":"character varying(64)","generated":""}]},{"schema":"auth","name":"custom_oauth_providers","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"provider_type","type":"text","generated":""},{"name":"identifier","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"client_id","type":"text","generated":""},{"name":"client_secret","type":"text","generated":""},{"name":"acceptable_client_ids","type":"text[]","generated":""},{"name":"scopes","type":"text[]","generated":""},{"name":"pkce_enabled","type":"boolean","generated":""},{"name":"attribute_mapping","type":"jsonb","generated":""},{"name":"authorization_params","type":"jsonb","generated":""},{"name":"enabled","type":"boolean","generated":""},{"name":"email_optional","type":"boolean","generated":""},{"name":"issuer","type":"text","generated":""},{"name":"discovery_url","type":"text","generated":""},{"name":"skip_nonce_check","type":"boolean","generated":""},{"name":"cached_discovery","type":"jsonb","generated":""},{"name":"discovery_cached_at","type":"timestamp with time zone","generated":""},{"name":"authorization_url","type":"text","generated":""},{"name":"token_url","type":"text","generated":""},{"name":"userinfo_url","type":"text","generated":""},{"name":"jwks_uri","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"custom_claims_allowlist","type":"text[]","generated":""}]},{"schema":"auth","name":"flow_state","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"auth_code","type":"text","generated":""},{"name":"code_challenge_method","type":"auth.code_challenge_method","generated":""},{"name":"code_challenge","type":"text","generated":""},{"name":"provider_type","type":"text","generated":""},{"name":"provider_access_token","type":"text","generated":""},{"name":"provider_refresh_token","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"authentication_method","type":"text","generated":""},{"name":"auth_code_issued_at","type":"timestamp with time zone","generated":""},{"name":"invite_token","type":"text","generated":""},{"name":"referrer","type":"text","generated":""},{"name":"oauth_client_state_id","type":"uuid","generated":""},{"name":"linking_target_id","type":"uuid","generated":""},{"name":"email_optional","type":"boolean","generated":""}]},{"schema":"auth","name":"identities","kind":"r","partition":false,"columns":[{"name":"provider_id","type":"text","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"identity_data","type":"jsonb","generated":""},{"name":"provider","type":"text","generated":""},{"name":"last_sign_in_at","type":"timestamp with time zone","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"email","type":"text","generated":"s"},{"name":"id","type":"uuid","generated":""}]},{"schema":"auth","name":"instances","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"uuid","type":"uuid","generated":""},{"name":"raw_base_config","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"mfa_amr_claims","kind":"r","partition":false,"columns":[{"name":"session_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"authentication_method","type":"text","generated":""},{"name":"id","type":"uuid","generated":""}]},{"schema":"auth","name":"mfa_challenges","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"factor_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"verified_at","type":"timestamp with time zone","generated":""},{"name":"ip_address","type":"inet","generated":""},{"name":"otp_code","type":"text","generated":""},{"name":"web_authn_session_data","type":"jsonb","generated":""}]},{"schema":"auth","name":"mfa_factors","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"friendly_name","type":"text","generated":""},{"name":"factor_type","type":"auth.factor_type","generated":""},{"name":"status","type":"auth.factor_status","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"secret","type":"text","generated":""},{"name":"phone","type":"text","generated":""},{"name":"last_challenged_at","type":"timestamp with time zone","generated":""},{"name":"web_authn_credential","type":"jsonb","generated":""},{"name":"web_authn_aaguid","type":"uuid","generated":""},{"name":"last_webauthn_challenge_data","type":"jsonb","generated":""}]},{"schema":"auth","name":"mfa_recovery_code_sets","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"mfa_factor_id","type":"uuid","generated":""},{"name":"failed_verification_count","type":"integer","generated":""},{"name":"verification_locked_until","type":"timestamp with time zone","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"mfa_recovery_codes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"mfa_recovery_code_set_id","type":"uuid","generated":""},{"name":"code_hash","type":"text","generated":""},{"name":"consumed_at","type":"timestamp with time zone","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"oauth_authorizations","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"authorization_id","type":"text","generated":""},{"name":"client_id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"redirect_uri","type":"text","generated":""},{"name":"scope","type":"text","generated":""},{"name":"state","type":"text","generated":""},{"name":"resource","type":"text","generated":""},{"name":"code_challenge","type":"text","generated":""},{"name":"code_challenge_method","type":"auth.code_challenge_method","generated":""},{"name":"response_type","type":"auth.oauth_response_type","generated":""},{"name":"status","type":"auth.oauth_authorization_status","generated":""},{"name":"authorization_code","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"expires_at","type":"timestamp with time zone","generated":""},{"name":"approved_at","type":"timestamp with time zone","generated":""},{"name":"nonce","type":"text","generated":""}]},{"schema":"auth","name":"oauth_client_states","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"provider_type","type":"text","generated":""},{"name":"code_verifier","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"oauth_clients","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"client_secret_hash","type":"text","generated":""},{"name":"registration_type","type":"auth.oauth_registration_type","generated":""},{"name":"redirect_uris","type":"text","generated":""},{"name":"grant_types","type":"text","generated":""},{"name":"client_name","type":"text","generated":""},{"name":"client_uri","type":"text","generated":""},{"name":"logo_uri","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""},{"name":"client_type","type":"auth.oauth_client_type","generated":""},{"name":"token_endpoint_auth_method","type":"text","generated":""}]},{"schema":"auth","name":"oauth_consents","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"client_id","type":"uuid","generated":""},{"name":"scopes","type":"text","generated":""},{"name":"granted_at","type":"timestamp with time zone","generated":""},{"name":"revoked_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"one_time_tokens","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"token_type","type":"auth.one_time_token_type","generated":""},{"name":"token_hash","type":"text","generated":""},{"name":"relates_to","type":"text","generated":""},{"name":"created_at","type":"timestamp without time zone","generated":""},{"name":"updated_at","type":"timestamp without time zone","generated":""},{"name":"expires_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"refresh_tokens","kind":"r","partition":false,"columns":[{"name":"instance_id","type":"uuid","generated":""},{"name":"id","type":"bigint","generated":""},{"name":"token","type":"character varying(255)","generated":""},{"name":"user_id","type":"character varying(255)","generated":""},{"name":"revoked","type":"boolean","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"parent","type":"character varying(255)","generated":""},{"name":"session_id","type":"uuid","generated":""}]},{"schema":"auth","name":"saml_providers","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"sso_provider_id","type":"uuid","generated":""},{"name":"entity_id","type":"text","generated":""},{"name":"metadata_xml","type":"text","generated":""},{"name":"metadata_url","type":"text","generated":""},{"name":"attribute_mapping","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"name_id_format","type":"text","generated":""}]},{"schema":"auth","name":"saml_relay_states","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"sso_provider_id","type":"uuid","generated":""},{"name":"request_id","type":"text","generated":""},{"name":"for_email","type":"text","generated":""},{"name":"redirect_to","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"flow_state_id","type":"uuid","generated":""}]},{"schema":"auth","name":"schema_migrations","kind":"r","partition":false,"columns":[{"name":"version","type":"character varying(255)","generated":""}]},{"schema":"auth","name":"scim_tokens","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"sso_provider_id","type":"uuid","generated":""},{"name":"token_hash","type":"text","generated":""},{"name":"prefix","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"expires_at","type":"timestamp with time zone","generated":""},{"name":"revoked_at","type":"timestamp with time zone","generated":""},{"name":"last_used_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"scim_users","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"sso_provider_id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"resource","type":"jsonb","generated":""},{"name":"user_name","type":"text","generated":"s"},{"name":"external_id","type":"text","generated":"s"},{"name":"active","type":"boolean","generated":"s"},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"sessions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"factor_id","type":"uuid","generated":""},{"name":"aal","type":"auth.aal_level","generated":""},{"name":"not_after","type":"timestamp with time zone","generated":""},{"name":"refreshed_at","type":"timestamp without time zone","generated":""},{"name":"user_agent","type":"text","generated":""},{"name":"ip","type":"inet","generated":""},{"name":"tag","type":"text","generated":""},{"name":"oauth_client_id","type":"uuid","generated":""},{"name":"refresh_token_hmac_key","type":"text","generated":""},{"name":"refresh_token_counter","type":"bigint","generated":""},{"name":"scopes","type":"text","generated":""}]},{"schema":"auth","name":"sso_domains","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"sso_provider_id","type":"uuid","generated":""},{"name":"domain","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"sso_providers","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"resource_id","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"disabled","type":"boolean","generated":""}]},{"schema":"auth","name":"users","kind":"r","partition":false,"columns":[{"name":"instance_id","type":"uuid","generated":""},{"name":"id","type":"uuid","generated":""},{"name":"aud","type":"character varying(255)","generated":""},{"name":"role","type":"character varying(255)","generated":""},{"name":"email","type":"character varying(255)","generated":""},{"name":"encrypted_password","type":"character varying(255)","generated":""},{"name":"email_confirmed_at","type":"timestamp with time zone","generated":""},{"name":"invited_at","type":"timestamp with time zone","generated":""},{"name":"confirmation_token","type":"character varying(255)","generated":""},{"name":"confirmation_sent_at","type":"timestamp with time zone","generated":""},{"name":"recovery_token","type":"character varying(255)","generated":""},{"name":"recovery_sent_at","type":"timestamp with time zone","generated":""},{"name":"email_change_token_new","type":"character varying(255)","generated":""},{"name":"email_change","type":"character varying(255)","generated":""},{"name":"email_change_sent_at","type":"timestamp with time zone","generated":""},{"name":"last_sign_in_at","type":"timestamp with time zone","generated":""},{"name":"raw_app_meta_data","type":"jsonb","generated":""},{"name":"raw_user_meta_data","type":"jsonb","generated":""},{"name":"is_super_admin","type":"boolean","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"phone","type":"text","generated":""},{"name":"phone_confirmed_at","type":"timestamp with time zone","generated":""},{"name":"phone_change","type":"text","generated":""},{"name":"phone_change_token","type":"character varying(255)","generated":""},{"name":"phone_change_sent_at","type":"timestamp with time zone","generated":""},{"name":"confirmed_at","type":"timestamp with time zone","generated":"s"},{"name":"email_change_token_current","type":"character varying(255)","generated":""},{"name":"email_change_confirm_status","type":"smallint","generated":""},{"name":"banned_until","type":"timestamp with time zone","generated":""},{"name":"reauthentication_token","type":"character varying(255)","generated":""},{"name":"reauthentication_sent_at","type":"timestamp with time zone","generated":""},{"name":"is_sso_user","type":"boolean","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""},{"name":"is_anonymous","type":"boolean","generated":""}]},{"schema":"auth","name":"webauthn_challenges","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"challenge_type","type":"text","generated":""},{"name":"session_data","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"expires_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"webauthn_credentials","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"credential_id","type":"bytea","generated":""},{"name":"public_key","type":"bytea","generated":""},{"name":"attestation_type","type":"text","generated":""},{"name":"aaguid","type":"uuid","generated":""},{"name":"sign_count","type":"bigint","generated":""},{"name":"transports","type":"jsonb","generated":""},{"name":"backup_eligible","type":"boolean","generated":""},{"name":"backed_up","type":"boolean","generated":""},{"name":"friendly_name","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"last_used_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_coaching_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"type","type":"text","generated":""},{"name":"trigger","type":"text","generated":""},{"name":"confidence","type":"numeric(5,2)","generated":""},{"name":"trust_score_used","type":"numeric(5,2)","generated":""},{"name":"state_snapshot","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_generation_params","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"model_version","type":"text","generated":""},{"name":"prompt_version","type":"text","generated":""},{"name":"params","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_guard_logs","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"ai_type","type":"text","generated":""},{"name":"ai_id","type":"uuid","generated":""},{"name":"status","type":"text","generated":""},{"name":"reasons","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_long_term_memory","kind":"r","partition":false,"columns":[{"name":"user_id","type":"uuid","generated":""},{"name":"user_preferences","type":"jsonb","generated":""},{"name":"rejected_patterns","type":"jsonb","generated":""},{"name":"success_patterns","type":"jsonb","generated":""},{"name":"injury_history","type":"jsonb","generated":""},{"name":"food_intolerances","type":"jsonb","generated":""},{"name":"psychological_triggers","type":"jsonb","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_meal_plans","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"input_hash","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"model_version","type":"text","generated":""},{"name":"prompt_version","type":"text","generated":""},{"name":"confidence_score","type":"numeric(4,3)","generated":""},{"name":"trust_score","type":"integer","generated":""},{"name":"plan","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"dynamic_version","type":"integer","generated":""},{"name":"generation_params","type":"jsonb","generated":""},{"name":"relevance_score","type":"numeric(5,2)","generated":""},{"name":"guard_status","type":"text","generated":""}]},{"schema":"public","name":"ai_quality_metrics","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"ai_type","type":"text","generated":""},{"name":"ai_id","type":"uuid","generated":""},{"name":"confidence_score","type":"numeric(5,2)","generated":""},{"name":"relevance_score","type":"numeric(5,2)","generated":""},{"name":"notes","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_recommendations","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"type","type":"text","generated":""},{"name":"input_hash","type":"text","generated":""},{"name":"model_version","type":"text","generated":""},{"name":"prompt_version","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"result","type":"jsonb","generated":""},{"name":"confidence_score","type":"numeric(4,2)","generated":""},{"name":"relevance_score","type":"numeric(4,2)","generated":""},{"name":"trust_score","type":"numeric(4,2)","generated":""},{"name":"guard_status","type":"text","generated":""},{"name":"outdated","type":"boolean","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"generation_params","type":"jsonb","generated":""},{"name":"request_type","type":"text","generated":""},{"name":"input_context","type":"jsonb","generated":""},{"name":"idempotency_key","type":"text","generated":""}]},{"schema":"public","name":"ai_training_plans","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"input_hash","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"model_version","type":"text","generated":""},{"name":"prompt_version","type":"text","generated":""},{"name":"confidence_score","type":"numeric(4,3)","generated":""},{"name":"trust_score","type":"integer","generated":""},{"name":"plan","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"dynamic_version","type":"integer","generated":""},{"name":"generation_params","type":"jsonb","generated":""},{"name":"relevance_score","type":"numeric(5,2)","generated":""},{"name":"guard_status","type":"text","generated":""},{"name":"input_context","type":"jsonb","generated":""},{"name":"outdated_at","type":"timestamp with time zone","generated":""},{"name":"is_outdated","type":"boolean","generated":""}]},{"schema":"public","name":"ai_trust_scores","kind":"r","partition":false,"columns":[{"name":"user_id","type":"uuid","generated":""},{"name":"trust_score","type":"numeric(5,2)","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"analytics_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"event_name","type":"text","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"billing_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"provider","type":"text","generated":""},{"name":"event_type","type":"text","generated":""},{"name":"idempotency_key","type":"text","generated":""},{"name":"payload","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"entitlements","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"tier","type":"text","generated":""},{"name":"flags","type":"jsonb","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"exercise_categories","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"order","type":"integer","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"exercise_definition_media","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"exercise_id","type":"uuid","generated":""},{"name":"media_type","type":"text","generated":""},{"name":"url","type":"text","generated":""},{"name":"sort_order","type":"integer","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"exercise_definitions","kind":"r","partition":false,"columns":[{"name":"exercise_id","type":"uuid","generated":""},{"name":"description","type":"text","generated":""},{"name":"mistakes","type":"text","generated":""},{"name":"muscle_map_image_url","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"exercise_muscles","kind":"r","partition":false,"columns":[{"name":"exercise_id","type":"uuid","generated":""},{"name":"muscle_id","type":"uuid","generated":""}]},{"schema":"public","name":"exercises","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"category_id","type":"uuid","generated":""},{"name":"description","type":"text","generated":""},{"name":"is_custom","type":"boolean","generated":""},{"name":"created_by_user_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"archived_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"favorite_products","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"product_name","type":"text","generated":""},{"name":"protein","type":"numeric(8,2)","generated":""},{"name":"fat","type":"numeric(8,2)","generated":""},{"name":"carbs","type":"numeric(8,2)","generated":""},{"name":"calories","type":"numeric(8,2)","generated":""},{"name":"usage_count","type":"integer","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"canonical_food_id","type":"uuid","generated":""}]},{"schema":"public","name":"feature_flags","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"feature_key","type":"text","generated":""},{"name":"enabled","type":"boolean","generated":""},{"name":"audience","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_alias_apply_audit","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"source_review_id","type":"uuid","generated":""},{"name":"alias_id","type":"uuid","generated":""},{"name":"alias","type":"text","generated":""},{"name":"normalized_alias","type":"text","generated":""},{"name":"canonical_food_id","type":"uuid","generated":""},{"name":"applied_by","type":"uuid","generated":""},{"name":"applied_at","type":"timestamp with time zone","generated":""},{"name":"result","type":"text","generated":""},{"name":"error","type":"text","generated":""},{"name":"validation","type":"jsonb","generated":""},{"name":"comment","type":"text","generated":""}]},{"schema":"public","name":"food_aliases","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"canonical_food_id","type":"uuid","generated":""},{"name":"alias","type":"text","generated":""},{"name":"normalized_alias","type":"text","generated":""},{"name":"source","type":"text","generated":""},{"name":"verified","type":"boolean","generated":""},{"name":"created_by_user_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_diary_entries","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"meal_type","type":"text","generated":""},{"name":"product_name","type":"text","generated":""},{"name":"protein","type":"numeric(8,2)","generated":""},{"name":"fat","type":"numeric(8,2)","generated":""},{"name":"carbs","type":"numeric(8,2)","generated":""},{"name":"calories","type":"numeric(8,2)","generated":""},{"name":"weight","type":"numeric(8,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"canonical_food_id","type":"uuid","generated":""},{"name":"fiber","type":"numeric(8,2)","generated":""},{"name":"idempotency_key","type":"text","generated":""},{"name":"base_unit","type":"text","generated":""},{"name":"display_unit","type":"text","generated":""},{"name":"display_amount","type":"numeric","generated":""}]},{"schema":"public","name":"food_import_batches","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"source","type":"text","generated":""},{"name":"source_version","type":"text","generated":""},{"name":"filename","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_import_conflicts","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"batch_id","type":"uuid","generated":""},{"name":"staging_id","type":"uuid","generated":""},{"name":"conflict_type","type":"text","generated":""},{"name":"details","type":"jsonb","generated":""},{"name":"status","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_import_staging","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"batch_id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"brand","type":"text","generated":""},{"name":"calories","type":"numeric(8,2)","generated":""},{"name":"protein","type":"numeric(8,2)","generated":""},{"name":"fat","type":"numeric(8,2)","generated":""},{"name":"carbs","type":"numeric(8,2)","generated":""},{"name":"fiber","type":"numeric(8,2)","generated":""},{"name":"unit","type":"text","generated":""},{"name":"aliases","type":"text[]","generated":""},{"name":"allergens","type":"text[]","generated":""},{"name":"intolerances","type":"text[]","generated":""},{"name":"source","type":"text","generated":""},{"name":"source_version","type":"text","generated":""},{"name":"normalized_name","type":"text","generated":""},{"name":"normalized_brand","type":"text","generated":""},{"name":"confidence_score","type":"numeric(4,3)","generated":""},{"name":"verified","type":"boolean","generated":""},{"name":"suspicious","type":"boolean","generated":""},{"name":"status","type":"text","generated":""},{"name":"conflict_reason","type":"text","generated":""},{"name":"raw_data","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_missing_food_drafts","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"source_review_id","type":"uuid","generated":""},{"name":"query","type":"text","generated":""},{"name":"normalized_query","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"normalized_name","type":"text","generated":""},{"name":"category","type":"text","generated":""},{"name":"source","type":"text","generated":""},{"name":"brand","type":"text","generated":""},{"name":"barcode","type":"text","generated":""},{"name":"calories","type":"numeric(8,2)","generated":""},{"name":"protein","type":"numeric(8,2)","generated":""},{"name":"fat","type":"numeric(8,2)","generated":""},{"name":"carbs","type":"numeric(8,2)","generated":""},{"name":"fiber","type":"numeric(8,2)","generated":""},{"name":"unit","type":"text","generated":""},{"name":"data_source","type":"text","generated":""},{"name":"source_url","type":"text","generated":""},{"name":"source_notes","type":"text","generated":""},{"name":"reviewer_notes","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"prepared_by","type":"uuid","generated":""},{"name":"prepared_at","type":"timestamp with time zone","generated":""},{"name":"reviewed_by","type":"uuid","generated":""},{"name":"reviewed_at","type":"timestamp with time zone","generated":""},{"name":"applied_food_id","type":"uuid","generated":""},{"name":"applied_by","type":"uuid","generated":""},{"name":"applied_at","type":"timestamp with time zone","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_missing_review_queue","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"query","type":"text","generated":""},{"name":"normalized_query","type":"text","generated":""},{"name":"context","type":"text","generated":""},{"name":"frequency","type":"integer","generated":""},{"name":"classification","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"source_event_ids","type":"uuid[]","generated":""},{"name":"suggested_name","type":"text","generated":""},{"name":"suggested_category","type":"text","generated":""},{"name":"suggested_source","type":"text","generated":""},{"name":"reviewer_id","type":"uuid","generated":""},{"name":"reviewed_at","type":"timestamp with time zone","generated":""},{"name":"comment","type":"text","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_search_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"session_id_hash","type":"text","generated":""},{"name":"query","type":"text","generated":""},{"name":"normalized_query","type":"text","generated":""},{"name":"context","type":"text","generated":""},{"name":"event_type","type":"text","generated":""},{"name":"result_count","type":"integer","generated":""},{"name":"selected_canonical_food_id","type":"uuid","generated":""},{"name":"no_selection","type":"boolean","generated":""},{"name":"not_found","type":"boolean","generated":""},{"name":"ambiguous","type":"boolean","generated":""},{"name":"candidate_canonical_food_ids","type":"uuid[]","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_search_review_queue","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"query","type":"text","generated":""},{"name":"normalized_query","type":"text","generated":""},{"name":"context","type":"text","generated":""},{"name":"suggested_canonical_food_id","type":"uuid","generated":""},{"name":"frequency","type":"integer","generated":""},{"name":"status","type":"text","generated":""},{"name":"reviewer_id","type":"uuid","generated":""},{"name":"reviewed_at","type":"timestamp with time zone","generated":""},{"name":"comment","type":"text","generated":""},{"name":"source_event_ids","type":"uuid[]","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"applied_alias_id","type":"uuid","generated":""},{"name":"alias_applied_by","type":"uuid","generated":""},{"name":"alias_applied_at","type":"timestamp with time zone","generated":""},{"name":"alias_apply_result","type":"text","generated":""},{"name":"alias_apply_error","type":"text","generated":""}]},{"schema":"public","name":"foods","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"name_original","type":"text","generated":""},{"name":"barcode","type":"text","generated":""},{"name":"calories","type":"numeric(8,2)","generated":""},{"name":"protein","type":"numeric(8,2)","generated":""},{"name":"fat","type":"numeric(8,2)","generated":""},{"name":"carbs","type":"numeric(8,2)","generated":""},{"name":"fiber","type":"numeric(8,2)","generated":""},{"name":"unit","type":"text","generated":""},{"name":"category","type":"text","generated":""},{"name":"brand","type":"text","generated":""},{"name":"source","type":"text","generated":""},{"name":"created_by_user_id","type":"uuid","generated":""},{"name":"canonical_food_id","type":"uuid","generated":""},{"name":"normalized_name","type":"text","generated":""},{"name":"normalized_brand","type":"text","generated":""},{"name":"nutrition_version","type":"integer","generated":""},{"name":"verified","type":"boolean","generated":""},{"name":"suspicious","type":"boolean","generated":""},{"name":"confidence_score","type":"numeric(4,3)","generated":""},{"name":"source_version","type":"text","generated":""},{"name":"allergens","type":"text[]","generated":""},{"name":"intolerances","type":"text[]","generated":""},{"name":"photo","type":"text","generated":""},{"name":"aliases","type":"text[]","generated":""},{"name":"auto_filled","type":"boolean","generated":""},{"name":"popularity","type":"integer","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"search_vector","type":"tsvector","generated":""},{"name":"stable_food_id","type":"text","generated":""},{"name":"product_scope","type":"text","generated":""},{"name":"data_source","type":"text","generated":""},{"name":"cooking_state","type":"text","generated":""}]},{"schema":"public","name":"goal_trajectory","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"goal_type","type":"text","generated":""},{"name":"expected_weight_curve","type":"jsonb","generated":""},{"name":"expected_strength_curve","type":"jsonb","generated":""},{"name":"expected_fat_loss_curve","type":"jsonb","generated":""},{"name":"status","type":"text","generated":""},{"name":"deviation","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"habit_logs","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"habit_id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"completed","type":"boolean","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"habits","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"title","type":"text","generated":""},{"name":"description","type":"text","generated":""},{"name":"frequency","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"is_active","type":"boolean","generated":""}]},{"schema":"public","name":"meal_entry_notes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"meal_entry_id","type":"uuid","generated":""},{"name":"product_id","type":"uuid","generated":""},{"name":"text","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"measurement_history","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"text","generated":""},{"name":"measurements","type":"jsonb","generated":""},{"name":"photos","type":"jsonb","generated":""},{"name":"additional_photos","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"day","type":"date","generated":""},{"name":"id_uuid","type":"uuid","generated":""}]},{"schema":"public","name":"measurement_photo_assets","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"day","type":"date","generated":""},{"name":"slot","type":"text","generated":""},{"name":"storage_path","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"thumb_path","type":"text","generated":""}]},{"schema":"public","name":"measurement_photo_deletions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"day","type":"date","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"measurement_photo_history","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"text","generated":""},{"name":"photos","type":"jsonb","generated":""},{"name":"additional_photos","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"day","type":"date","generated":""},{"name":"id_uuid","type":"uuid","generated":""}]},{"schema":"public","name":"muscles","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"notification_history","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"score_id","type":"uuid","generated":""},{"name":"channel","type":"text","generated":""},{"name":"message_id","type":"text","generated":""},{"name":"message","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"explainability","type":"jsonb","generated":""},{"name":"sent_at","type":"timestamp with time zone","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"nutrition_programs","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"goal_id","type":"uuid","generated":""},{"name":"status","type":"text","generated":""},{"name":"program_version","type":"integer","generated":""},{"name":"knowledge_version_ref","type":"jsonb","generated":""},{"name":"start_date","type":"date","generated":""},{"name":"end_date","type":"date","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_3d_angles","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"angles","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_3d_joints","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"joint_name","type":"text","generated":""},{"name":"x","type":"numeric(10,6)","generated":""},{"name":"y","type":"numeric(10,6)","generated":""},{"name":"z","type":"numeric(10,6)","generated":""},{"name":"confidence","type":"numeric(5,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_3d_metrics","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"metrics","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_3d_sessions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"pose_session_id","type":"uuid","generated":""},{"name":"workout_entry_id","type":"uuid","generated":""},{"name":"canonical_exercise_id","type":"uuid","generated":""},{"name":"started_at","type":"timestamp with time zone","generated":""},{"name":"ended_at","type":"timestamp with time zone","generated":""},{"name":"device_info","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_angles","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_frame_id","type":"uuid","generated":""},{"name":"angles","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_biomechanics","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"metrics","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_deviations","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_frame_id","type":"uuid","generated":""},{"name":"joint","type":"text","generated":""},{"name":"observed","type":"numeric(6,2)","generated":""},{"name":"expected_min","type":"numeric(6,2)","generated":""},{"name":"expected_max","type":"numeric(6,2)","generated":""},{"name":"severity","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_feedback_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_session_id","type":"uuid","generated":""},{"name":"event_type","type":"text","generated":""},{"name":"message","type":"text","generated":""},{"name":"confidence","type":"numeric(5,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_frames","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"quality_score","type":"numeric(6,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_guard_flags","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_session_id","type":"uuid","generated":""},{"name":"flag_type","type":"text","generated":""},{"name":"severity","type":"text","generated":""},{"name":"details","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_joints","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_frame_id","type":"uuid","generated":""},{"name":"joint_name","type":"text","generated":""},{"name":"x","type":"numeric(10,6)","generated":""},{"name":"y","type":"numeric(10,6)","generated":""},{"name":"z","type":"numeric(10,6)","generated":""},{"name":"confidence","type":"numeric(5,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_load_estimates","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"estimates","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_quality_scores","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_session_id","type":"uuid","generated":""},{"name":"pose_quality_score","type":"numeric(6,2)","generated":""},{"name":"stability_score","type":"numeric(6,2)","generated":""},{"name":"symmetry_score","type":"numeric(6,2)","generated":""},{"name":"tempo_score","type":"numeric(6,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_risk_assessments","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"risk_level","type":"text","generated":""},{"name":"guard_flags","type":"text[]","generated":""},{"name":"guard_reason","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_sessions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"workout_entry_id","type":"uuid","generated":""},{"name":"canonical_exercise_id","type":"uuid","generated":""},{"name":"started_at","type":"timestamp with time zone","generated":""},{"name":"ended_at","type":"timestamp with time zone","generated":""},{"name":"device_info","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_voice_cues","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"cue_type","type":"text","generated":""},{"name":"priority","type":"text","generated":""},{"name":"message","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_adaptations","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"from_version","type":"integer","generated":""},{"name":"to_version","type":"integer","generated":""},{"name":"trigger","type":"text","generated":""},{"name":"summary","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_blocks","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"phase_id","type":"uuid","generated":""},{"name":"block_type","type":"text","generated":""},{"name":"block_goal","type":"text","generated":""},{"name":"duration_days","type":"integer","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_days","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"block_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"targets","type":"jsonb","generated":""},{"name":"session_plan","type":"jsonb","generated":""},{"name":"constraints_applied","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_explainability","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"version","type":"integer","generated":""},{"name":"decision_ref","type":"text","generated":""},{"name":"knowledge_refs","type":"jsonb","generated":""},{"name":"confidence","type":"numeric(4,3)","generated":""},{"name":"guard_notes","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_feedback","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"program_session_id","type":"uuid","generated":""},{"name":"energy","type":"integer","generated":""},{"name":"hunger","type":"integer","generated":""},{"name":"difficulty","type":"integer","generated":""},{"name":"pain","type":"integer","generated":""},{"name":"motivation","type":"integer","generated":""},{"name":"notes","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_generation_jobs","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"input_context","type":"jsonb","generated":""},{"name":"output_program_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_guard_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"risk_level","type":"text","generated":""},{"name":"flags","type":"text[]","generated":""},{"name":"blocked_actions","type":"text[]","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_phases","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"phase_type","type":"text","generated":""},{"name":"phase_goal","type":"text","generated":""},{"name":"start_date","type":"date","generated":""},{"name":"end_date","type":"date","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_sessions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"session_type","type":"text","generated":""},{"name":"plan_payload","type":"jsonb","generated":""},{"name":"status","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"day_date","type":"date","generated":""}]},{"schema":"public","name":"program_versions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"version","type":"integer","generated":""},{"name":"snapshot","type":"jsonb","generated":""},{"name":"reason","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"recipe_ingredients","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"recipe_id","type":"uuid","generated":""},{"name":"food_id","type":"uuid","generated":""},{"name":"amount_g","type":"numeric(10,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"recipe_notes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"recipe_id","type":"uuid","generated":""},{"name":"text","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"recipes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"ingredients","type":"jsonb","generated":""},{"name":"total_calories","type":"numeric(10,2)","generated":""},{"name":"protein","type":"numeric(10,2)","generated":""},{"name":"fat","type":"numeric(10,2)","generated":""},{"name":"carbs","type":"numeric(10,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"fiber","type":"numeric(10,2)","generated":""},{"name":"servings","type":"numeric(10,2)","generated":""},{"name":"yield_g","type":"numeric(10,2)","generated":""},{"name":"image","type":"text","generated":""}]},{"schema":"public","name":"subscriptions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"plan","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"current_period_start","type":"timestamp with time zone","generated":""},{"name":"current_period_end","type":"timestamp with time zone","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"training_programs","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"goal_id","type":"uuid","generated":""},{"name":"status","type":"text","generated":""},{"name":"program_version","type":"integer","generated":""},{"name":"knowledge_version_ref","type":"jsonb","generated":""},{"name":"start_date","type":"date","generated":""},{"name":"end_date","type":"date","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"user_exercise_media","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"exercise_id","type":"uuid","generated":""},{"name":"workout_entry_id","type":"uuid","generated":""},{"name":"workout_date","type":"date","generated":""},{"name":"file_path","type":"text","generated":""},{"name":"file_type","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"user_goals","kind":"r","partition":false,"columns":[{"name":"user_id","type":"uuid","generated":""},{"name":"calories","type":"integer","generated":""},{"name":"protein","type":"numeric(6,2)","generated":""},{"name":"fat","type":"numeric(6,2)","generated":""},{"name":"carbs","type":"numeric(6,2)","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"goal_type","type":"text","generated":""},{"name":"current_weight","type":"numeric(8,2)","generated":""},{"name":"target_weight","type":"numeric(8,2)","generated":""},{"name":"start_date","type":"date","generated":""},{"name":"end_date","type":"date","generated":""},{"name":"months_to_goal","type":"integer","generated":""},{"name":"bmr","type":"integer","generated":""},{"name":"tdee","type":"integer","generated":""},{"name":"training_place","type":"text","generated":""},{"name":"gender","type":"text","generated":""},{"name":"age","type":"integer","generated":""},{"name":"height","type":"numeric(6,2)","generated":""},{"name":"lifestyle","type":"text","generated":""},{"name":"intensity","type":"text","generated":""}]},{"schema":"public","name":"user_measurements","kind":"r","partition":false,"columns":[{"name":"user_id","type":"uuid","generated":""},{"name":"measurements","type":"jsonb","generated":""},{"name":"photos","type":"jsonb","generated":""},{"name":"additional_photos","type":"jsonb","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"user_profiles","kind":"r","partition":false,"columns":[{"name":"id_user","type":"uuid","generated":""},{"name":"first_name","type":"text","generated":""},{"name":"last_name","type":"text","generated":""},{"name":"middle_name","type":"text","generated":""},{"name":"birth_date","type":"date","generated":""},{"name":"age","type":"integer","generated":""},{"name":"height","type":"numeric(5,2)","generated":""},{"name":"goal","type":"text","generated":""},{"name":"email","type":"text","generated":""},{"name":"phone","type":"text","generated":""},{"name":"avatar_url","type":"text","generated":""},{"name":"has_premium","type":"boolean","generated":""},{"name":"is_admin","type":"boolean","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"coach_settings","type":"jsonb","generated":""},{"name":"voice_settings","type":"jsonb","generated":""}]},{"schema":"public","name":"user_state","kind":"r","partition":false,"columns":[{"name":"user_id","type":"uuid","generated":""},{"name":"current_weight","type":"numeric(6,2)","generated":""},{"name":"trend_weight_7d","type":"numeric(6,2)","generated":""},{"name":"trend_weight_30d","type":"numeric(6,2)","generated":""},{"name":"avg_calories","type":"numeric(8,2)","generated":""},{"name":"avg_protein","type":"numeric(8,2)","generated":""},{"name":"training_load_index","type":"numeric(8,2)","generated":""},{"name":"fatigue_index","type":"numeric(8,2)","generated":""},{"name":"adherence_score","type":"numeric(5,2)","generated":""},{"name":"recovery_score","type":"numeric(5,2)","generated":""},{"name":"consistency_score","type":"numeric(5,2)","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"workout_day_notes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"workout_day_id","type":"uuid","generated":""},{"name":"text","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"workout_days","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"workout_entries","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"workout_day_id","type":"uuid","generated":""},{"name":"exercise_id","type":"uuid","generated":""},{"name":"sets","type":"integer","generated":""},{"name":"reps","type":"integer","generated":""},{"name":"weight","type":"numeric(10,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"base_unit","type":"text","generated":""},{"name":"display_unit","type":"text","generated":""},{"name":"display_amount","type":"numeric","generated":""},{"name":"idempotency_key","type":"text","generated":""},{"name":"metric_type","type":"text","generated":""},{"name":"exercise_name_snapshot","type":"text","generated":""},{"name":"exercise_category_id_snapshot","type":"uuid","generated":""},{"name":"exercise_category_name_snapshot","type":"text","generated":""},{"name":"canonical_exercise_id_snapshot","type":"uuid","generated":""},{"name":"primary_muscles_snapshot","type":"text[]","generated":""},{"name":"secondary_muscles_snapshot","type":"text[]","generated":""},{"name":"muscles_snapshot","type":"jsonb","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""},{"name":"deleted_by_user_id","type":"uuid","generated":""}]},{"schema":"public","name":"workout_entry_notes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"workout_entry_id","type":"uuid","generated":""},{"name":"text","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"storage","name":"buckets","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"owner","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"public","type":"boolean","generated":""},{"name":"avif_autodetection","type":"boolean","generated":""},{"name":"file_size_limit","type":"bigint","generated":""},{"name":"allowed_mime_types","type":"text[]","generated":""},{"name":"owner_id","type":"text","generated":""},{"name":"type","type":"storage.buckettype","generated":""},{"name":"versioning_status","type":"text","generated":""},{"name":"lifecycle_configuration","type":"jsonb","generated":""},{"name":"lifecycle_configuration_generation","type":"uuid","generated":""}]},{"schema":"storage","name":"buckets_analytics","kind":"r","partition":false,"columns":[{"name":"name","type":"text","generated":""},{"name":"type","type":"storage.buckettype","generated":""},{"name":"format","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"id","type":"uuid","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""}]},{"schema":"storage","name":"buckets_vectors","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"type","type":"storage.buckettype","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"storage","name":"migrations","kind":"r","partition":false,"columns":[{"name":"id","type":"integer","generated":""},{"name":"name","type":"character varying(100)","generated":""},{"name":"hash","type":"character varying(40)","generated":""},{"name":"executed_at","type":"timestamp without time zone","generated":""}]},{"schema":"storage","name":"objects","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"bucket_id","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"owner","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"last_accessed_at","type":"timestamp with time zone","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"path_tokens","type":"text[]","generated":"s"},{"name":"version","type":"text","generated":""},{"name":"owner_id","type":"text","generated":""},{"name":"user_metadata","type":"jsonb","generated":""},{"name":"archived_at","type":"timestamp with time zone","generated":""},{"name":"is_delete_marker","type":"boolean","generated":""},{"name":"is_versioned","type":"boolean","generated":""}]},{"schema":"storage","name":"s3_multipart_uploads","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"in_progress_size","type":"bigint","generated":""},{"name":"upload_signature","type":"text","generated":""},{"name":"bucket_id","type":"text","generated":""},{"name":"key","type":"text","generated":""},{"name":"version","type":"text","generated":""},{"name":"owner_id","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"user_metadata","type":"jsonb","generated":""},{"name":"metadata","type":"jsonb","generated":""}]},{"schema":"storage","name":"s3_multipart_uploads_parts","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"upload_id","type":"text","generated":""},{"name":"size","type":"bigint","generated":""},{"name":"part_number","type":"integer","generated":""},{"name":"bucket_id","type":"text","generated":""},{"name":"key","type":"text","generated":""},{"name":"etag","type":"text","generated":""},{"name":"owner_id","type":"text","generated":""},{"name":"version","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"storage","name":"vector_indexes","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"bucket_id","type":"text","generated":""},{"name":"data_type","type":"text","generated":""},{"name":"dimension","type":"integer","generated":""},{"name":"distance_metric","type":"text","generated":""},{"name":"metadata_configuration","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]}]'::jsonb OR EXISTS(SELECT FROM jsonb_to_recordset('[{"schema":"auth","name":"audit_log_entries","owner":"supabase_auth_admin"},{"schema":"auth","name":"custom_oauth_providers","owner":"supabase_auth_admin"},{"schema":"auth","name":"flow_state","owner":"supabase_auth_admin"},{"schema":"auth","name":"identities","owner":"supabase_auth_admin"},{"schema":"auth","name":"instances","owner":"supabase_auth_admin"},{"schema":"auth","name":"mfa_amr_claims","owner":"supabase_auth_admin"},{"schema":"auth","name":"mfa_challenges","owner":"supabase_auth_admin"},{"schema":"auth","name":"mfa_factors","owner":"supabase_auth_admin"},{"schema":"auth","name":"mfa_recovery_code_sets","owner":"supabase_auth_admin"},{"schema":"auth","name":"mfa_recovery_codes","owner":"supabase_auth_admin"},{"schema":"auth","name":"oauth_authorizations","owner":"supabase_auth_admin"},{"schema":"auth","name":"oauth_client_states","owner":"supabase_auth_admin"},{"schema":"auth","name":"oauth_clients","owner":"supabase_auth_admin"},{"schema":"auth","name":"oauth_consents","owner":"supabase_auth_admin"},{"schema":"auth","name":"one_time_tokens","owner":"supabase_auth_admin"},{"schema":"auth","name":"refresh_tokens","owner":"supabase_auth_admin"},{"schema":"auth","name":"saml_providers","owner":"supabase_auth_admin"},{"schema":"auth","name":"saml_relay_states","owner":"supabase_auth_admin"},{"schema":"auth","name":"schema_migrations","owner":"supabase_auth_admin"},{"schema":"auth","name":"scim_tokens","owner":"supabase_auth_admin"},{"schema":"auth","name":"scim_users","owner":"supabase_auth_admin"},{"schema":"auth","name":"sessions","owner":"supabase_auth_admin"},{"schema":"auth","name":"sso_domains","owner":"supabase_auth_admin"},{"schema":"auth","name":"sso_providers","owner":"supabase_auth_admin"},{"schema":"auth","name":"users","owner":"supabase_auth_admin"},{"schema":"auth","name":"webauthn_challenges","owner":"supabase_auth_admin"},{"schema":"auth","name":"webauthn_credentials","owner":"supabase_auth_admin"},{"schema":"public","name":"ai_coaching_events","owner":"postgres"},{"schema":"public","name":"ai_generation_params","owner":"postgres"},{"schema":"public","name":"ai_guard_logs","owner":"postgres"},{"schema":"public","name":"ai_long_term_memory","owner":"postgres"},{"schema":"public","name":"ai_meal_plans","owner":"postgres"},{"schema":"public","name":"ai_quality_metrics","owner":"postgres"},{"schema":"public","name":"ai_recommendations","owner":"postgres"},{"schema":"public","name":"ai_training_plans","owner":"postgres"},{"schema":"public","name":"ai_trust_scores","owner":"postgres"},{"schema":"public","name":"analytics_events","owner":"postgres"},{"schema":"public","name":"billing_events","owner":"postgres"},{"schema":"public","name":"entitlements","owner":"postgres"},{"schema":"public","name":"exercise_categories","owner":"postgres"},{"schema":"public","name":"exercise_definition_media","owner":"postgres"},{"schema":"public","name":"exercise_definitions","owner":"postgres"},{"schema":"public","name":"exercise_muscles","owner":"postgres"},{"schema":"public","name":"exercises","owner":"postgres"},{"schema":"public","name":"favorite_products","owner":"postgres"},{"schema":"public","name":"feature_flags","owner":"postgres"},{"schema":"public","name":"food_alias_apply_audit","owner":"postgres"},{"schema":"public","name":"food_aliases","owner":"postgres"},{"schema":"public","name":"food_diary_entries","owner":"postgres"},{"schema":"public","name":"food_import_batches","owner":"postgres"},{"schema":"public","name":"food_import_conflicts","owner":"postgres"},{"schema":"public","name":"food_import_staging","owner":"postgres"},{"schema":"public","name":"food_missing_food_drafts","owner":"postgres"},{"schema":"public","name":"food_missing_review_queue","owner":"postgres"},{"schema":"public","name":"food_search_events","owner":"postgres"},{"schema":"public","name":"food_search_review_queue","owner":"postgres"},{"schema":"public","name":"foods","owner":"postgres"},{"schema":"public","name":"goal_trajectory","owner":"postgres"},{"schema":"public","name":"habit_logs","owner":"postgres"},{"schema":"public","name":"habits","owner":"postgres"},{"schema":"public","name":"meal_entry_notes","owner":"postgres"},{"schema":"public","name":"measurement_history","owner":"postgres"},{"schema":"public","name":"measurement_photo_assets","owner":"postgres"},{"schema":"public","name":"measurement_photo_deletions","owner":"postgres"},{"schema":"public","name":"measurement_photo_history","owner":"postgres"},{"schema":"public","name":"muscles","owner":"postgres"},{"schema":"public","name":"notification_history","owner":"postgres"},{"schema":"public","name":"nutrition_programs","owner":"postgres"},{"schema":"public","name":"pose_3d_angles","owner":"postgres"},{"schema":"public","name":"pose_3d_joints","owner":"postgres"},{"schema":"public","name":"pose_3d_metrics","owner":"postgres"},{"schema":"public","name":"pose_3d_sessions","owner":"postgres"},{"schema":"public","name":"pose_angles","owner":"postgres"},{"schema":"public","name":"pose_biomechanics","owner":"postgres"},{"schema":"public","name":"pose_deviations","owner":"postgres"},{"schema":"public","name":"pose_feedback_events","owner":"postgres"},{"schema":"public","name":"pose_frames","owner":"postgres"},{"schema":"public","name":"pose_guard_flags","owner":"postgres"},{"schema":"public","name":"pose_joints","owner":"postgres"},{"schema":"public","name":"pose_load_estimates","owner":"postgres"},{"schema":"public","name":"pose_quality_scores","owner":"postgres"},{"schema":"public","name":"pose_risk_assessments","owner":"postgres"},{"schema":"public","name":"pose_sessions","owner":"postgres"},{"schema":"public","name":"pose_voice_cues","owner":"postgres"},{"schema":"public","name":"program_adaptations","owner":"postgres"},{"schema":"public","name":"program_blocks","owner":"postgres"},{"schema":"public","name":"program_days","owner":"postgres"},{"schema":"public","name":"program_explainability","owner":"postgres"},{"schema":"public","name":"program_feedback","owner":"postgres"},{"schema":"public","name":"program_generation_jobs","owner":"postgres"},{"schema":"public","name":"program_guard_events","owner":"postgres"},{"schema":"public","name":"program_phases","owner":"postgres"},{"schema":"public","name":"program_sessions","owner":"postgres"},{"schema":"public","name":"program_versions","owner":"postgres"},{"schema":"public","name":"recipe_ingredients","owner":"postgres"},{"schema":"public","name":"recipe_notes","owner":"postgres"},{"schema":"public","name":"recipes","owner":"postgres"},{"schema":"public","name":"subscriptions","owner":"postgres"},{"schema":"public","name":"training_programs","owner":"postgres"},{"schema":"public","name":"user_exercise_media","owner":"postgres"},{"schema":"public","name":"user_goals","owner":"postgres"},{"schema":"public","name":"user_measurements","owner":"postgres"},{"schema":"public","name":"user_profiles","owner":"postgres"},{"schema":"public","name":"user_state","owner":"postgres"},{"schema":"public","name":"workout_day_notes","owner":"postgres"},{"schema":"public","name":"workout_days","owner":"postgres"},{"schema":"public","name":"workout_entries","owner":"postgres"},{"schema":"public","name":"workout_entry_notes","owner":"postgres"},{"schema":"storage","name":"buckets","owner":"supabase_storage_admin"},{"schema":"storage","name":"buckets_analytics","owner":"supabase_storage_admin"},{"schema":"storage","name":"buckets_vectors","owner":"supabase_storage_admin"},{"schema":"storage","name":"migrations","owner":"supabase_storage_admin"},{"schema":"storage","name":"objects","owner":"supabase_storage_admin"},{"schema":"storage","name":"s3_multipart_uploads","owner":"supabase_storage_admin"},{"schema":"storage","name":"s3_multipart_uploads_parts","owner":"supabase_storage_admin"},{"schema":"storage","name":"vector_indexes","owner":"supabase_storage_admin"}]'::jsonb) e(schema text,name text,owner text)
 LEFT JOIN pg_namespace n ON n.nspname=e.schema LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.name
 WHERE c.oid IS NULL OR pg_get_userbyid(c.relowner) IS DISTINCT FROM e.owner)
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_SCOPE_STOPPED';END IF;
END $scope$;

CREATE TEMP TABLE potok_release_sequence_v1(schema_name text,sequence_name text,value bigint,called boolean,PRIMARY KEY(schema_name,sequence_name)) ON COMMIT DROP;
 CREATE TEMP TABLE potok_release_sequence_catalog_v1 ON COMMIT DROP AS SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.seqrelid),'[]'::jsonb) FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage');
 DO $sequence_before$ DECLARE r record;v bigint;b boolean;BEGIN
 FOR r IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage') AND c.relkind='S' ORDER BY n.nspname,c.relname LOOP
 EXECUTE format('SELECT last_value,is_called FROM %I.%I',r.nspname,r.relname) INTO v,b;
 INSERT INTO pg_temp.potok_release_sequence_v1 VALUES(r.nspname,r.relname,v,b);
 END LOOP;END $sequence_before$;

-- REVIEW FRAGMENT: requires approved outer BEGIN and all named table locks.
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';SET LOCAL datestyle='ISO,YMD';SET LOCAL extra_float_digits=3;
CREATE TEMP TABLE potok_release_rows_v1(table_schema text,table_name text,column_sql text NOT NULL,n bigint NOT NULL,h text NOT NULL,PRIMARY KEY(table_schema,table_name)) ON COMMIT DROP;
DO $row_before$ DECLARE r record;cols text;total bigint;digest text;BEGIN
 FOR r IN SELECT * FROM jsonb_to_recordset($scope$[{"schema":"auth","name":"audit_log_entries"},{"schema":"auth","name":"custom_oauth_providers"},{"schema":"auth","name":"flow_state"},{"schema":"auth","name":"identities"},{"schema":"auth","name":"instances"},{"schema":"auth","name":"mfa_amr_claims"},{"schema":"auth","name":"mfa_challenges"},{"schema":"auth","name":"mfa_factors"},{"schema":"auth","name":"mfa_recovery_code_sets"},{"schema":"auth","name":"mfa_recovery_codes"},{"schema":"auth","name":"oauth_authorizations"},{"schema":"auth","name":"oauth_client_states"},{"schema":"auth","name":"oauth_clients"},{"schema":"auth","name":"oauth_consents"},{"schema":"auth","name":"one_time_tokens"},{"schema":"auth","name":"refresh_tokens"},{"schema":"auth","name":"saml_providers"},{"schema":"auth","name":"saml_relay_states"},{"schema":"auth","name":"schema_migrations"},{"schema":"auth","name":"scim_tokens"},{"schema":"auth","name":"scim_users"},{"schema":"auth","name":"sessions"},{"schema":"auth","name":"sso_domains"},{"schema":"auth","name":"sso_providers"},{"schema":"auth","name":"users"},{"schema":"auth","name":"webauthn_challenges"},{"schema":"auth","name":"webauthn_credentials"},{"schema":"public","name":"ai_coaching_events"},{"schema":"public","name":"ai_generation_params"},{"schema":"public","name":"ai_guard_logs"},{"schema":"public","name":"ai_long_term_memory"},{"schema":"public","name":"ai_meal_plans"},{"schema":"public","name":"ai_quality_metrics"},{"schema":"public","name":"ai_recommendations"},{"schema":"public","name":"ai_training_plans"},{"schema":"public","name":"ai_trust_scores"},{"schema":"public","name":"analytics_events"},{"schema":"public","name":"billing_events"},{"schema":"public","name":"entitlements"},{"schema":"public","name":"exercise_categories"},{"schema":"public","name":"exercise_definition_media"},{"schema":"public","name":"exercise_definitions"},{"schema":"public","name":"exercise_muscles"},{"schema":"public","name":"exercises"},{"schema":"public","name":"favorite_products"},{"schema":"public","name":"feature_flags"},{"schema":"public","name":"food_alias_apply_audit"},{"schema":"public","name":"food_aliases"},{"schema":"public","name":"food_diary_entries"},{"schema":"public","name":"food_import_batches"},{"schema":"public","name":"food_import_conflicts"},{"schema":"public","name":"food_import_staging"},{"schema":"public","name":"food_missing_food_drafts"},{"schema":"public","name":"food_missing_review_queue"},{"schema":"public","name":"food_search_events"},{"schema":"public","name":"food_search_review_queue"},{"schema":"public","name":"foods"},{"schema":"public","name":"goal_trajectory"},{"schema":"public","name":"habit_logs"},{"schema":"public","name":"habits"},{"schema":"public","name":"meal_entry_notes"},{"schema":"public","name":"measurement_history"},{"schema":"public","name":"measurement_photo_assets"},{"schema":"public","name":"measurement_photo_deletions"},{"schema":"public","name":"measurement_photo_history"},{"schema":"public","name":"muscles"},{"schema":"public","name":"notification_history"},{"schema":"public","name":"nutrition_programs"},{"schema":"public","name":"pose_3d_angles"},{"schema":"public","name":"pose_3d_joints"},{"schema":"public","name":"pose_3d_metrics"},{"schema":"public","name":"pose_3d_sessions"},{"schema":"public","name":"pose_angles"},{"schema":"public","name":"pose_biomechanics"},{"schema":"public","name":"pose_deviations"},{"schema":"public","name":"pose_feedback_events"},{"schema":"public","name":"pose_frames"},{"schema":"public","name":"pose_guard_flags"},{"schema":"public","name":"pose_joints"},{"schema":"public","name":"pose_load_estimates"},{"schema":"public","name":"pose_quality_scores"},{"schema":"public","name":"pose_risk_assessments"},{"schema":"public","name":"pose_sessions"},{"schema":"public","name":"pose_voice_cues"},{"schema":"public","name":"program_adaptations"},{"schema":"public","name":"program_blocks"},{"schema":"public","name":"program_days"},{"schema":"public","name":"program_explainability"},{"schema":"public","name":"program_feedback"},{"schema":"public","name":"program_generation_jobs"},{"schema":"public","name":"program_guard_events"},{"schema":"public","name":"program_phases"},{"schema":"public","name":"program_sessions"},{"schema":"public","name":"program_versions"},{"schema":"public","name":"recipe_ingredients"},{"schema":"public","name":"recipe_notes"},{"schema":"public","name":"recipes"},{"schema":"public","name":"subscriptions"},{"schema":"public","name":"training_programs"},{"schema":"public","name":"user_exercise_media"},{"schema":"public","name":"user_goals"},{"schema":"public","name":"user_measurements"},{"schema":"public","name":"user_profiles"},{"schema":"public","name":"user_state"},{"schema":"public","name":"workout_day_notes"},{"schema":"public","name":"workout_days"},{"schema":"public","name":"workout_entries"},{"schema":"public","name":"workout_entry_notes"},{"schema":"storage","name":"buckets"},{"schema":"storage","name":"buckets_analytics"},{"schema":"storage","name":"buckets_vectors"},{"schema":"storage","name":"migrations"},{"schema":"storage","name":"objects"},{"schema":"storage","name":"s3_multipart_uploads"},{"schema":"storage","name":"s3_multipart_uploads_parts"},{"schema":"storage","name":"vector_indexes"}]$scope$::jsonb) AS x(schema text,name text) LOOP
  SELECT string_agg(format('%I',a.attname),',' ORDER BY a.attnum) INTO cols FROM pg_attribute a WHERE a.attrelid=to_regclass(format('%I.%I',r.schema,r.name)) AND a.attnum>0 AND NOT a.attisdropped;
  IF cols IS NULL THEN RAISE EXCEPTION 'RELEASE_ROW_SCOPE_STOPPED';END IF;
  EXECUTE format($digest$SELECT count(*),encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex') FROM (SELECT encode(sha256(convert_to(to_jsonb(row_data)::text,'UTF8')),'hex') h FROM (SELECT %s FROM %I.%I) row_data) fingerprints$digest$,cols,r.schema,r.name) INTO total,digest;
  INSERT INTO pg_temp.potok_release_rows_v1 VALUES(r.schema,r.name,cols,total,digest);
 END LOOP;
END $row_before$;

-- Reviewed candidate: truncate
-- REVIEW CANDIDATE ONLY. Never run automatically against a hosted project.
-- Atomic containment for existing public tables and postgres/public defaults.
-- Does NOT change supabase_admin defaults; see the accompanying runbook.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Expected effective role postgres';
  END IF;
  IF to_regnamespace('public') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Required schema or client roles missing';
  END IF;
  IF has_schema_privilege('anon', 'public', 'CREATE')
     OR has_schema_privilege('authenticated', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Client schema CREATE requires separate containment';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')) THEN
    RAISE EXCEPTION 'No public tables; wrong or incomplete target';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
               AND c.relowner <> 'postgres'::regrole) THEN
    RAISE EXCEPTION 'Unexpected public table owner; review before applying';
  END IF;
  -- Per-schema REVOKE cannot subtract a global default grant. Do not silently
  -- broaden this public-only patch to other schemas.
  IF EXISTS (
    SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 0
      AND d.defaclobjtype = 'r' AND a.privilege_type = 'TRUNCATE'
      AND CASE WHEN a.grantee = 0 THEN true ELSE
        pg_has_role('anon', a.grantee, 'USAGE')
        OR pg_has_role('authenticated', a.grantee, 'USAGE') END
  ) THEN
    RAISE EXCEPTION 'Unsafe global default TRUNCATE requires separate review';
  END IF;
END
$preflight$;

DO $revoke$
DECLARE t record;
BEGIN
  FOR t IN SELECT n.nspname, c.relname FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
           ORDER BY c.oid
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON TABLE %I.%I FROM PUBLIC, anon, authenticated',
                   t.nspname, t.relname);
  END LOOP;
END
$revoke$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM PUBLIC, anon, authenticated;

DO $verify$
DECLARE residual bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND (has_table_privilege('anon', c.oid, 'TRUNCATE')
           OR has_table_privilege('authenticated', c.oid, 'TRUNCATE'))
  ) THEN
    RAISE EXCEPTION 'Effective client TRUNCATE remains; transaction will roll back';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole = 'postgres'::regrole
      AND d.defaclnamespace IN (0, 'public'::regnamespace)
      AND d.defaclobjtype = 'r' AND a.privilege_type = 'TRUNCATE'
      AND CASE WHEN a.grantee = 0 THEN true ELSE
        pg_has_role('anon', a.grantee, 'USAGE')
        OR pg_has_role('authenticated', a.grantee, 'USAGE') END
  ) THEN
    RAISE EXCEPTION 'Effective postgres default TRUNCATE remains; transaction will roll back';
  END IF;
  SELECT count(*) INTO residual
  FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole <> 'postgres'::regrole
    AND d.defaclnamespace IN (0, 'public'::regnamespace)
    AND d.defaclobjtype = 'r' AND a.privilege_type = 'TRUNCATE'
    AND CASE WHEN a.grantee = 0 THEN true ELSE
      pg_has_role('anon', a.grantee, 'USAGE')
      OR pg_has_role('authenticated', a.grantee, 'USAGE') END;
  RAISE NOTICE 'Remaining other-owner default client TRUNCATE entries: %. Separate platform/owner remediation required.', residual;
END
$verify$;

-- Reviewed candidate: profile
-- REVIEW CANDIDATE ONLY. Direct profile column writes, not trusted authority.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, pg_temp;
CREATE TEMP TABLE potok_profile_allowed(name text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO potok_profile_allowed VALUES ('id_user'),('first_name'),('last_name'),('middle_name'),
  ('birth_date'),('age'),('height'),('goal'),('email'),('phone'),('avatar_url'),
  ('coach_settings'),('voice_settings');
CREATE TEMP TABLE potok_profile_protected(name text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO potok_profile_protected VALUES ('is_admin'),('has_premium'),('created_at'),('updated_at');
DO $preflight$
DECLARE t record;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Expected effective role postgres'; END IF;
  SELECT * INTO t FROM pg_class WHERE oid=to_regclass('public.user_profiles');
  IF NOT FOUND OR t.relkind <> 'r' OR t.relowner <> 'postgres'::regrole OR NOT t.relrowsecurity THEN
    RAISE EXCEPTION 'Profile table ownership or RLS drift requires review';
  END IF;
  IF EXISTS ((SELECT name FROM potok_profile_allowed UNION SELECT name FROM potok_profile_protected)
    EXCEPT SELECT attname FROM pg_attribute WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped)
    OR EXISTS (SELECT attname FROM pg_attribute WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped
    EXCEPT (SELECT name FROM potok_profile_allowed UNION SELECT name FROM potok_profile_protected)) THEN
    RAISE EXCEPTION 'Profile columns changed; review the allowlist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=t.oid AND attname='id_user'
    AND atttypid='uuid'::regtype AND attnotnull) THEN
    RAISE EXCEPTION 'Expected non-null UUID profile key';
  END IF;
  IF (SELECT count(*) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=t.oid AND a.attname IN ('is_admin','has_premium') AND a.atttypid='boolean'::regtype
      AND a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='false') <> 2 THEN
    RAISE EXCEPTION 'Privilege defaults must be non-null false';
  END IF;
  IF NOT has_table_privilege('authenticated',t.oid,'SELECT') OR EXISTS (
    SELECT 1 FROM potok_profile_allowed c WHERE
      NOT has_column_privilege('authenticated',t.oid,c.name,'INSERT')
      OR NOT has_column_privilege('authenticated',t.oid,c.name,'UPDATE')) THEN
    RAISE EXCEPTION 'Ordinary profile writes or SELECT require baseline review';
  END IF;
  -- id_user UPDATE is required by PostgREST upsert. Require the exact bounded
  -- ownership policy shape before preserving that column privilege.
  IF (SELECT count(*) FROM pg_policy WHERE polrelid=t.oid) <> 3 OR EXISTS (
    SELECT 1 FROM pg_policy p WHERE p.polrelid=t.oid AND (
      NOT p.polpermissive OR p.polroles <> ARRAY['authenticated'::regrole::oid]
      OR p.polcmd NOT IN ('r','a','w')
      OR CASE p.polcmd
        WHEN 'r' THEN p.polwithcheck IS NOT NULL OR regexp_replace(pg_get_expr(p.polqual,p.polrelid),'[[:space:]()]','','g') IS DISTINCT FROM 'auth.uid=id_user'
        WHEN 'a' THEN p.polqual IS NOT NULL OR regexp_replace(pg_get_expr(p.polwithcheck,p.polrelid),'[[:space:]()]','','g') IS DISTINCT FROM 'auth.uid=id_user'
        WHEN 'w' THEN regexp_replace(pg_get_expr(p.polqual,p.polrelid),'[[:space:]()]','','g') IS DISTINCT FROM 'auth.uid=id_user'
          OR regexp_replace(pg_get_expr(p.polwithcheck,p.polrelid),'[[:space:]()]','','g') IS DISTINCT FROM 'auth.uid=id_user'
        ELSE true END
    )) OR (SELECT count(DISTINCT polcmd) FROM pg_policy WHERE polrelid=t.oid) <> 3 THEN
    RAISE EXCEPTION 'Profile ownership policy shape requires review';
  END IF;
END
$preflight$;
CREATE TEMP TABLE potok_profile_service ON COMMIT DROP AS
  SELECT a.attname, has_column_privilege('service_role',a.attrelid,a.attname,'INSERT') AS ins,
    has_column_privilege('service_role',a.attrelid,a.attname,'UPDATE') AS upd
  FROM pg_attribute a WHERE a.attrelid='public.user_profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped;
CREATE TEMP TABLE potok_profile_baseline ON COMMIT DROP AS
  SELECT md5(string_agg(to_jsonb(p)::text,',' ORDER BY p.oid)) AS policies,
    has_table_privilege('authenticated','public.user_profiles','SELECT') AS authenticated_select
  FROM pg_policy p WHERE polrelid='public.user_profiles'::regclass;
REVOKE INSERT, UPDATE ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated;
DO $columns$
DECLARE c record;
BEGIN
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass
    AND attnum>0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated',c.attname,c.attname);
  END LOOP;
END
$columns$;
GRANT INSERT (id_user,first_name,last_name,middle_name,birth_date,age,height,goal,email,phone,avatar_url,coach_settings,voice_settings)
  ON public.user_profiles TO authenticated;
GRANT UPDATE (id_user,first_name,last_name,middle_name,birth_date,age,height,goal,email,phone,avatar_url,coach_settings,voice_settings)
  ON public.user_profiles TO authenticated;
DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM potok_profile_protected c WHERE
    has_column_privilege('authenticated','public.user_profiles',c.name,'INSERT')
    OR has_column_privilege('authenticated','public.user_profiles',c.name,'UPDATE')) THEN
    RAISE EXCEPTION 'Effective protected column write remains; transaction will roll back';
  END IF;
  IF EXISTS (SELECT 1 FROM potok_profile_allowed c WHERE
    NOT has_column_privilege('authenticated','public.user_profiles',c.name,'INSERT')
    OR NOT has_column_privilege('authenticated','public.user_profiles',c.name,'UPDATE'))
    OR EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.user_profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped
      AND (has_column_privilege('anon',a.attrelid,a.attname,'INSERT') OR has_column_privilege('anon',a.attrelid,a.attname,'UPDATE')))
    OR EXISTS (SELECT 1 FROM potok_profile_service c WHERE
      has_column_privilege('service_role','public.user_profiles',c.attname,'INSERT') IS DISTINCT FROM c.ins
      OR has_column_privilege('service_role','public.user_profiles',c.attname,'UPDATE') IS DISTINCT FROM c.upd)
    OR (SELECT md5(string_agg(to_jsonb(p)::text,',' ORDER BY p.oid)) FROM pg_policy p WHERE polrelid='public.user_profiles'::regclass)
      IS DISTINCT FROM (SELECT policies FROM potok_profile_baseline)
    OR has_table_privilege('authenticated','public.user_profiles','SELECT') IS DISTINCT FROM
      (SELECT authenticated_select FROM potok_profile_baseline) THEN
    RAISE EXCEPTION 'Required profile access changed; transaction will roll back';
  END IF;
END
$verify$;

-- Reviewed candidate: anonymous
-- REVIEW CANDIDATE ONLY. Existing RPC grants; no body/role/default changes.
-- Does not repair authenticated authorization or billing authority.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, pg_temp;
DO $actor$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Expected effective role postgres'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated')
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    RAISE EXCEPTION 'Required API roles missing';
  END IF;
END
$actor$;
CREATE TEMP TABLE potok_rpc_targets (signature text PRIMARY KEY, oid oid,
  authenticated_allowed boolean, service_allowed boolean, definition_hash text) ON COMMIT DROP;
INSERT INTO potok_rpc_targets(signature) VALUES
  ('public.apply_admin_approved_food_alias(uuid,text,text)'),
  ('public.apply_owner_approved_missing_food_draft(uuid)'),
  ('public.get_entitlements(uuid)'),
  ('public.get_paywall_state(text,uuid)'),
  ('public.recompute_food_entries_for_food_ids(uuid[])'),
  ('public.restore_purchase(uuid,text,text,text)'),
  ('public.rls_auto_enable()'),
  ('public.start_purchase(uuid,text,text,text)');
UPDATE potok_rpc_targets SET oid=to_regprocedure(signature);
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM potok_rpc_targets t LEFT JOIN pg_proc p ON p.oid=t.oid
    WHERE p.oid IS NULL OR p.proowner <> 'postgres'::regrole
      OR p.prokind <> 'f' OR NOT p.prosecdef) THEN
    RAISE EXCEPTION 'RPC inventory, ownership or SECURITY DEFINER drift requires review';
  END IF;
END
$preflight$;
UPDATE potok_rpc_targets t SET
  authenticated_allowed=has_function_privilege('authenticated',t.oid,'EXECUTE'),
  service_allowed=has_function_privilege('service_role',t.oid,'EXECUTE'),
  definition_hash=md5(pg_get_functiondef(t.oid));
DO $revoke$
DECLARE t record;
BEGIN
  FOR t IN SELECT oid FROM potok_rpc_targets ORDER BY oid LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',t.oid::regprocedure);
  END LOOP;
END
$revoke$;
DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM potok_rpc_targets t
    WHERE has_function_privilege('anon',t.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Effective anonymous EXECUTE remains; transaction will roll back';
  END IF;
  IF EXISTS (SELECT 1 FROM potok_rpc_targets t
    WHERE has_function_privilege('authenticated',t.oid,'EXECUTE') IS DISTINCT FROM t.authenticated_allowed
      OR has_function_privilege('service_role',t.oid,'EXECUTE') IS DISTINCT FROM t.service_allowed
      OR md5(pg_get_functiondef(t.oid)) <> t.definition_hash) THEN
    RAISE EXCEPTION 'Required role access or RPC definition changed; transaction will roll back';
  END IF;
END
$verify$;

-- Reviewed candidate: photos
-- REVIEW ONLY. Rehearsal rolls back. Not a deployment migration.
-- Historical migrations remain unchanged; a separately reviewed forward migration
-- must accompany any future creation of these tables with auto-exposure disabled.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE t text; p record; expected_count integer;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Expected postgres owner actor';
  END IF;
  FOREACH t IN ARRAY ARRAY['measurement_photo_assets','measurement_photo_deletions'] LOOP
    IF NOT EXISTS (
      SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relkind='r'
        AND c.relowner='postgres'::regrole AND c.relrowsecurity
    ) THEN RAISE EXCEPTION 'Table owner/type/RLS drift: %', t; END IF;
    IF NOT EXISTS (
      SELECT FROM pg_attribute WHERE attrelid=format('public.%I',t)::regclass
        AND attname='user_id' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped
    ) THEN RAISE EXCEPTION 'Owner column drift: %', t; END IF;
    expected_count := CASE WHEN t='measurement_photo_assets' THEN 4 ELSE 3 END;
    IF (SELECT count(*) FROM pg_policy WHERE polrelid=format('public.%I',t)::regclass
        AND polname<> 'measurement_photo_deletions_update_own_explicit_v1') <> expected_count THEN
      RAISE EXCEPTION 'Policy set drift: %', t;
    END IF;
    FOR p IN SELECT *,
      regexp_replace(coalesce(pg_get_expr(polqual,polrelid),''),'[[:space:]()]','','g') AS q,
      regexp_replace(coalesce(pg_get_expr(polwithcheck,polrelid),''),'[[:space:]()]','','g') AS w
      FROM pg_policy WHERE polrelid=format('public.%I',t)::regclass
    LOOP
      IF NOT p.polpermissive OR
        NOT (p.polroles=ARRAY[0::oid] OR p.polroles=ARRAY['authenticated'::regrole::oid]) OR
        p.polcmd NOT IN ('r','a','w','d') OR
        (p.polcmd IN ('r','w','d') AND p.q NOT IN ('user_id=auth.uid','auth.uid=user_id')) OR
        (p.polcmd IN ('a','w') AND p.w NOT IN ('user_id=auth.uid','auth.uid=user_id')) THEN
        RAISE EXCEPTION 'Owner policy semantics drift: %.%',t,p.polname;
      END IF;
    END LOOP;
    -- One policy for each required command; duplicates cannot mask a missing one.
    IF NOT (SELECT array_agg(polcmd::text ORDER BY polcmd::text)=
      CASE WHEN t='measurement_photo_assets' THEN ARRAY['a','d','r','w']
           WHEN count(*)=4 THEN ARRAY['a','d','r','w'] ELSE ARRAY['a','d','r'] END
      FROM pg_policy WHERE polrelid=format('public.%I',t)::regclass) THEN
      RAISE EXCEPTION 'Policy command coverage drift: %',t;
    END IF;
  END LOOP;
END
$preflight$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_photo_assets TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.measurement_photo_deletions TO authenticated;
-- PostgREST upsert updates all supplied fields on conflict, including its key.
GRANT UPDATE (user_id, day, deleted_at) ON public.measurement_photo_deletions TO authenticated;
DROP POLICY IF EXISTS measurement_photo_deletions_update_own_explicit_v1
  ON public.measurement_photo_deletions;
CREATE POLICY measurement_photo_deletions_update_own_explicit_v1
  ON public.measurement_photo_deletions FOR UPDATE TO authenticated
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);


-- Reviewed candidate: finance
-- REVIEW ONLY: source-baseline candidate, not an apply migration.
-- Hashes below are derived only from tracked phase7_3_2_monetization.sql.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
DECLARE t text; f record;
BEGIN
  IF current_user<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'Expected postgres on PostgreSQL 17';
  END IF;
  FOREACH t IN ARRAY ARRAY['entitlements','subscriptions','billing_events'] LOOP
    IF NOT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relkind='r'
      AND c.relowner='postgres'::regrole AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'Finance table owner/type/RLS drift: %',t;
    END IF;
    IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid=to_regclass('public.'||t)
      AND attname='user_id' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Finance owner column drift: %',t;
    END IF;
    IF (SELECT count(*) FROM pg_policy WHERE polrelid=to_regclass('public.'||t))<>1
      OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid=to_regclass('public.'||t)
        AND polcmd='*' AND polpermissive
        AND (polroles=ARRAY[0::oid] OR polroles=ARRAY['authenticated'::regrole::oid])
        AND regexp_replace(pg_get_expr(polqual,polrelid),'[[:space:]()]','','g')='auth.uid=user_id'
        AND regexp_replace(pg_get_expr(polwithcheck,polrelid),'[[:space:]()]','','g')='auth.uid=user_id') THEN
      RAISE EXCEPTION 'Finance owner policy drift: %',t;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT FROM pg_index i JOIN pg_attribute a
    ON a.attrelid=i.indrelid AND a.attname='user_id' AND a.attnum=i.indkey[0]
    WHERE i.indrelid='public.entitlements'::regclass AND i.indisunique
      AND i.indisvalid AND i.indisready AND i.indnkeyatts=1
      AND i.indexprs IS NULL AND i.indpred IS NULL) THEN
    RAISE EXCEPTION 'Expected unique entitlement user index';
  END IF;
  FOR f IN SELECT * FROM (VALUES
    ('public.get_entitlements(uuid)','7bdf53d5c9120c74748815544df9387d'),
    ('public.get_paywall_state(text,uuid)','0ee06a885f411da3e3f5f9382ca82eb7'),
    ('public.start_purchase(uuid,text,text,text)','6a5da0c1dc1c3a1046fd07f51a6934ff'),
    ('public.restore_purchase(uuid,text,text,text)','e3d65717b7e25e5fe06ee59bb9a911d1')
  ) AS expected(signature,body_md5) LOOP
    IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure(f.signature)
      AND proowner='postgres'::regrole AND prosecdef AND prorettype='jsonb'::regtype
      AND md5(prosrc)=f.body_md5) THEN
      RAISE EXCEPTION 'Public source RPC baseline drift: %',f.signature;
    END IF;
  END LOOP;
END
$preflight$;

CREATE TEMP TABLE potok_finance_preserved ON COMMIT DROP AS
SELECT c.oid AS relation, r.role_name,
  has_table_privilege(r.role_name,c.oid,'SELECT') AS can_select,
  has_table_privilege(r.role_name,c.oid,'INSERT') AS can_insert,
  has_table_privilege(r.role_name,c.oid,'UPDATE') AS can_update,
  has_table_privilege(r.role_name,c.oid,'DELETE') AS can_delete
FROM pg_class c CROSS JOIN (VALUES('anon'),('authenticated'),('service_role')) r(role_name)
WHERE c.oid IN ('public.entitlements'::regclass,'public.subscriptions'::regclass,'public.billing_events'::regclass);
CREATE TEMP TABLE potok_purchase_preserved ON COMMIT DROP AS
SELECT p.oid AS function_oid,has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p WHERE p.oid IN (
  'public.start_purchase(uuid,text,text,text)'::regprocedure,
  'public.restore_purchase(uuid,text,text,text)'::regprocedure);

REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON
  public.entitlements,public.subscriptions,public.billing_events FROM PUBLIC,anon,authenticated;
DO $columns$
DECLARE a record;
BEGIN
  FOR a IN SELECT attrelid,attname FROM pg_attribute
    WHERE attrelid IN ('public.entitlements'::regclass,'public.subscriptions'::regclass,'public.billing_events'::regclass)
    AND attnum>0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE INSERT (%I),UPDATE (%I),REFERENCES (%I) ON %s FROM PUBLIC,anon,authenticated',
      a.attname,a.attname,a.attname,a.attrelid::regclass);
  END LOOP;
END
$columns$;

-- Preserve the existing public endpoint/signature, default argument and JSON DTO.
-- No deprecated auth.role(), user_metadata or profile flags participate in authority.
CREATE OR REPLACE FUNCTION public.get_entitlements(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $entitlements$
DECLARE caller uuid := auth.uid(); resolved_user uuid; row_ent public.entitlements;
BEGIN
  IF caller IS NULL OR (auth.jwt()->>'role') IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
  END IF;
  resolved_user := coalesce(p_user_id,caller);
  IF resolved_user<>caller THEN
    RAISE EXCEPTION 'cross-account entitlement access denied' USING ERRCODE='42501';
  END IF;
  SELECT * INTO row_ent FROM public.entitlements WHERE user_id=resolved_user;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('tier','free','flags',jsonb_build_object(
      'can_view_plan',true,'can_adapt',false,'can_explain',false,
      'can_voice',false,'can_spatial',false));
  END IF;
  RETURN jsonb_build_object('tier',row_ent.tier,'flags',row_ent.flags);
END
$entitlements$;
REVOKE ALL ON FUNCTION public.get_entitlements(uuid),public.get_paywall_state(text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_entitlements(uuid),public.get_paywall_state(text,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_purchase(uuid,text,text,text),public.restore_purchase(uuid,text,text,text)
  FROM PUBLIC,anon,authenticated;
-- No service grant is added. Existing server capability/body is preserved, not
-- promoted into receipt verification or a trusted payment implementation.

DO $verify$
DECLARE t text; r text; f text; saved record;
BEGIN
  FOREACH t IN ARRAY ARRAY['entitlements','subscriptions','billing_events'] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(r,'public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR has_any_column_privilege(r,'public.'||t,'INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Effective finance writer remains: %.%',r,t;
      END IF;
    END LOOP;
  END LOOP;
  FOR saved IN SELECT * FROM potok_finance_preserved LOOP
    IF has_table_privilege(saved.role_name,saved.relation,'SELECT')<>saved.can_select
      OR (saved.role_name='service_role' AND (
        has_table_privilege(saved.role_name,saved.relation,'INSERT')<>saved.can_insert
        OR has_table_privilege(saved.role_name,saved.relation,'UPDATE')<>saved.can_update
        OR has_table_privilege(saved.role_name,saved.relation,'DELETE')<>saved.can_delete)) THEN
      RAISE EXCEPTION 'Finance read/service capability changed';
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.get_entitlements(uuid)','public.get_paywall_state(text,uuid)'] LOOP
    IF NOT has_function_privilege('authenticated',f,'EXECUTE')
      OR has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('service_role',f,'EXECUTE') THEN
      RAISE EXCEPTION 'Entitlement RPC effective grants mismatch';
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.start_purchase(uuid,text,text,text)','public.restore_purchase(uuid,text,text,text)'] LOOP
    IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE') THEN
      RAISE EXCEPTION 'Client purchase RPC remains executable';
    END IF;
  END LOOP;
  IF EXISTS(SELECT FROM potok_purchase_preserved
    WHERE has_function_privilege('service_role',function_oid,'EXECUTE')<>service_execute) THEN
    RAISE EXCEPTION 'Existing server purchase capability changed';
  END IF;
END
$verify$;

-- Reviewed candidate: authority
-- REVIEW ONLY. Fresh id_user authority adaptation. Always ROLLBACK.
-- Derived from existing trusted v2 ledger/readers and later shared-account gate.
-- No profile mutation/projection/backfill, authority issuance, payments or activation.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
DO $preflight$
DECLARE names text[]; p record;
BEGIN
 IF SESSION_USER<>'postgres' OR CURRENT_USER<>'postgres'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
  OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls)
 THEN RAISE EXCEPTION 'Expected existing nonsuperuser postgres/BYPASSRLS owner SQL channel';END IF;
 IF to_regnamespace('potok_control') IS NOT NULL OR to_regnamespace('potok_nutrition') IS NOT NULL
  OR to_regprocedure('public.has_verified_entitlement_v1(text)') IS NOT NULL
  OR to_regprocedure('public.has_verified_entitlement_v2(text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Fresh authority install only; existing infrastructure requires separate compatibility review';END IF;
 IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE')
  THEN RAISE EXCEPTION 'Client schema CREATE requires separate containment';END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.user_profiles') AND relkind='r' AND relowner='postgres'::regrole AND relrowsecurity)
  THEN RAISE EXCEPTION 'Profile ownership/RLS drift';END IF;
 SELECT array_agg(attname::text ORDER BY attname) INTO names FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass AND attnum>0 AND NOT attisdropped;
 IF names IS DISTINCT FROM ARRAY['age','avatar_url','birth_date','coach_settings','created_at','email','first_name','goal','has_premium','height','id_user','is_admin','last_name','middle_name','phone','updated_at','voice_settings']::text[]
  THEN RAISE EXCEPTION 'Expected unchanged 17-column id_user profile contract';END IF;
 IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass AND attname='id_user' AND atttypid='uuid'::regtype AND attnotnull)
  OR NOT EXISTS(SELECT FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attname='id_user' WHERE i.indrelid='public.user_profiles'::regclass AND i.indisprimary AND i.indisvalid AND i.indnkeyatts=1 AND i.indkey[0]=a.attnum)
  THEN RAISE EXCEPTION 'Expected UUID profile primary key';END IF;
 IF (SELECT count(*) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.user_profiles'::regclass AND a.attname IN('is_admin','has_premium') AND a.atttypid='boolean'::regtype AND a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='false')<>2
  THEN RAISE EXCEPTION 'Expected false protected defaults';END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role),unnest(ARRAY['is_admin','has_premium','created_at','updated_at']) c(col) WHERE has_column_privilege(r.role,'public.user_profiles',c.col,'INSERT') OR has_column_privilege(r.role,'public.user_profiles',c.col,'UPDATE'))
  THEN RAISE EXCEPTION 'Apply reviewed profile column containment before authority installation';END IF;
 IF NOT has_table_privilege('authenticated','public.user_profiles','SELECT') OR EXISTS(SELECT FROM unnest(ARRAY['id_user','first_name','last_name','middle_name','birth_date','age','height','goal','email','phone','avatar_url','coach_settings','voice_settings']) c(col) WHERE NOT has_column_privilege('authenticated','public.user_profiles',c.col,'INSERT') OR NOT has_column_privilege('authenticated','public.user_profiles',c.col,'UPDATE'))
  THEN RAISE EXCEPTION 'Ordinary profile access drift';END IF;
 IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.user_profiles'::regclass)<>3 THEN RAISE EXCEPTION 'Expected three profile ownership policies';END IF;
 FOR p IN SELECT *,regexp_replace(coalesce(pg_get_expr(polqual,polrelid),''),'[[:space:]()]','','g') q,regexp_replace(coalesce(pg_get_expr(polwithcheck,polrelid),''),'[[:space:]()]','','g') w FROM pg_policy WHERE polrelid='public.user_profiles'::regclass LOOP
  IF NOT p.polpermissive OR p.polroles<>ARRAY['authenticated'::regrole::oid] OR p.polcmd NOT IN('r','a','w')
   OR (p.polcmd IN('r','w') AND p.q<>'auth.uid=id_user') OR (p.polcmd IN('a','w') AND p.w<>'auth.uid=id_user')
   THEN RAISE EXCEPTION 'Profile ownership policy semantics drift';END IF;
 END LOOP;
 IF (SELECT count(DISTINCT polcmd) FROM pg_policy WHERE polrelid='public.user_profiles'::regclass)<>3 THEN RAISE EXCEPTION 'Missing profile command policy';END IF;
END
$preflight$;
CREATE SCHEMA potok_control;
REVOKE ALL ON SCHEMA potok_control FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_control
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_control
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE potok_control.access_attestations (
  attestation_id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  capability text NOT NULL,
  effect text NOT NULL,
  previous_attestation_id uuid NULL,
  lineage_sequence bigint NOT NULL,
  issued_at timestamptz NOT NULL,
  valid_until timestamptz NULL,
  operator_db_role name NOT NULL,
  evidence_ref text NOT NULL,
  reason text NOT NULL,
  CONSTRAINT access_attestations_account_fk
    FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT access_attestations_capability_check
    CHECK (capability IN ('premium', 'admin')),
  CONSTRAINT access_attestations_effect_check
    CHECK (effect IN ('GRANT', 'REVOKE')),
  CONSTRAINT access_attestations_sequence_check
    CHECK (lineage_sequence > 0),
  CONSTRAINT access_attestations_validity_check
    CHECK (
      (effect = 'GRANT' AND (valid_until IS NULL OR valid_until > issued_at))
      OR (effect = 'REVOKE' AND valid_until IS NULL)
    ),
  CONSTRAINT access_attestations_evidence_check
    CHECK (evidence_ref <> '' AND evidence_ref = pg_catalog.btrim(evidence_ref)),
  CONSTRAINT access_attestations_reason_check
    CHECK (reason <> '' AND reason = pg_catalog.btrim(reason)),
  CONSTRAINT access_attestations_scope_id_unique
    UNIQUE (account_id, capability, attestation_id),
  CONSTRAINT access_attestations_account_id_unique
    UNIQUE (account_id, attestation_id),
  CONSTRAINT access_attestations_scope_sequence_unique
    UNIQUE (account_id, capability, lineage_sequence),
  CONSTRAINT access_attestations_previous_fk
    FOREIGN KEY (account_id, capability, previous_attestation_id)
    REFERENCES potok_control.access_attestations (account_id, capability, attestation_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX access_attestations_one_successor_idx
  ON potok_control.access_attestations (account_id, capability, previous_attestation_id)
  WHERE previous_attestation_id IS NOT NULL;

ALTER TABLE potok_control.access_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_control.access_attestations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_control.access_attestations FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION potok_control.validate_access_attestation_insert_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_head potok_control.access_attestations%ROWTYPE;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF NEW.capability NOT IN ('premium', 'admin') OR NEW.effect NOT IN ('GRANT', 'REVOKE') THEN
    RAISE EXCEPTION 'invalid entitlement capability/effect' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || NEW.account_id::text || ':' || NEW.capability, 0)
  );
  SELECT a.*
    INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = NEW.account_id
     AND a.capability = NEW.capability
   ORDER BY a.lineage_sequence DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    IF NEW.lineage_sequence <> v_head.lineage_sequence + 1
       OR NEW.previous_attestation_id IS DISTINCT FROM v_head.attestation_id
       OR NEW.issued_at < v_head.issued_at THEN
      RAISE EXCEPTION 'invalid entitlement lineage successor' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.lineage_sequence <> 1 OR NEW.previous_attestation_id IS NOT NULL THEN
    RAISE EXCEPTION 'invalid entitlement lineage root' USING ERRCODE = '23514';
  END IF;

  IF NEW.operator_db_role IS DISTINCT FROM SESSION_USER::name THEN
    RAISE EXCEPTION 'operator identity must be derived from session_user' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION potok_control.validate_access_attestation_insert_v2()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER validate_access_attestation_insert_v2
BEFORE INSERT ON potok_control.access_attestations
FOR EACH ROW EXECUTE FUNCTION potok_control.validate_access_attestation_insert_v2();

CREATE FUNCTION potok_control.reject_access_attestation_mutation_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'entitlement attestations are append-only' USING ERRCODE = '42501';
END
$function$;
REVOKE ALL ON FUNCTION potok_control.reject_access_attestation_mutation_v2()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER reject_access_attestation_update_delete_v2
BEFORE UPDATE OR DELETE ON potok_control.access_attestations
FOR EACH ROW EXECUTE FUNCTION potok_control.reject_access_attestation_mutation_v2();
CREATE TRIGGER reject_access_attestation_truncate_v2
BEFORE TRUNCATE ON potok_control.access_attestations
FOR EACH STATEMENT EXECUTE FUNCTION potok_control.reject_access_attestation_mutation_v2();

CREATE SCHEMA potok_nutrition;
REVOKE ALL ON SCHEMA potok_nutrition FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_nutrition REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION potok_nutrition.acquire_shared_account_gate_v1(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account gate requires account identity' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-shared-account-gate-v1:' || p_account_id::text, 0)
  );
END
$function$;
REVOKE ALL ON FUNCTION potok_nutrition.acquire_shared_account_gate_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION potok_control.grant_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_valid_until timestamptz,
  p_evidence_ref text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_head potok_control.access_attestations%ROWTYPE;
  v_attestation_id uuid := pg_catalog.gen_random_uuid();
  v_sequence bigint;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_capability IS NULL OR p_capability NOT IN ('premium', 'admin') THEN
    RAISE EXCEPTION 'invalid entitlement scope' USING ERRCODE = '22023';
  END IF;
  IF p_valid_until IS NOT NULL AND p_valid_until <= v_now THEN
    RAISE EXCEPTION 'grant expiry must be in the future' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_ref IS NULL OR p_evidence_ref = '' OR p_evidence_ref <> pg_catalog.btrim(p_evidence_ref)
     OR p_reason IS NULL OR p_reason = '' OR p_reason <> pg_catalog.btrim(p_reason) THEN
    RAISE EXCEPTION 'evidence and reason are required' USING ERRCODE = '22023';
  END IF;

  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);
  -- Require the existing profile without modifying its legacy fields.
  PERFORM 1 FROM public.user_profiles WHERE id_user=p_account_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'existing account profile required' USING ERRCODE='23503';END IF;
  -- Preserve the capability lineage lock, now strictly secondary.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || p_account_id::text || ':' || p_capability, 0)
  );
  SELECT a.* INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability
   ORDER BY a.lineage_sequence DESC LIMIT 1 FOR UPDATE;
  v_sequence := COALESCE(v_head.lineage_sequence, 0::bigint) + 1::bigint;

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v_attestation_id, p_account_id, p_capability, 'GRANT', v_head.attestation_id,
    v_sequence, v_now, p_valid_until, SESSION_USER::name, p_evidence_ref, p_reason
  );

  RETURN v_attestation_id;
END
$function$;
CREATE FUNCTION potok_control.revoke_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_evidence_ref text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_head potok_control.access_attestations%ROWTYPE;
  v_attestation_id uuid := pg_catalog.gen_random_uuid();
  v_sequence bigint;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_capability IS NULL OR p_capability NOT IN ('premium', 'admin') THEN
    RAISE EXCEPTION 'invalid entitlement scope' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_ref IS NULL OR p_evidence_ref = '' OR p_evidence_ref <> pg_catalog.btrim(p_evidence_ref)
     OR p_reason IS NULL OR p_reason = '' OR p_reason <> pg_catalog.btrim(p_reason) THEN
    RAISE EXCEPTION 'evidence and reason are required' USING ERRCODE = '22023';
  END IF;

  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);
  -- Preserve the capability lineage lock, now strictly secondary.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || p_account_id::text || ':' || p_capability, 0)
  );
  SELECT a.* INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability
   ORDER BY a.lineage_sequence DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cannot revoke entitlement without prior lineage' USING ERRCODE = '23514';
  END IF;
  v_sequence := v_head.lineage_sequence + 1;

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v_attestation_id, p_account_id, p_capability, 'REVOKE', v_head.attestation_id,
    v_sequence, v_now, NULL, SESSION_USER::name, p_evidence_ref, p_reason
  );

  RETURN v_attestation_id;
END
$function$;
REVOKE ALL ON FUNCTION potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text),potok_control.revoke_entitlement_v2(uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION potok_control.is_effective_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_count bigint;
  v_max_sequence bigint;
  v_root_count bigint;
  v_effect text;
  v_valid_until timestamptz;
BEGIN
  IF p_account_id IS NULL OR p_capability NOT IN ('premium', 'admin') OR p_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT pg_catalog.count(*), pg_catalog.max(a.lineage_sequence),
         pg_catalog.count(*) FILTER (
           WHERE a.lineage_sequence = 1 AND a.previous_attestation_id IS NULL
         )
    INTO v_count, v_max_sequence, v_root_count
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability;

  IF v_count = 0 OR v_count <> v_max_sequence OR v_root_count <> 1 THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM potok_control.access_attestations a
      LEFT JOIN potok_control.access_attestations predecessor
        ON predecessor.account_id = a.account_id
       AND predecessor.capability = a.capability
       AND predecessor.attestation_id = a.previous_attestation_id
     WHERE a.account_id = p_account_id
       AND a.capability = p_capability
       AND (
         (a.lineage_sequence = 1 AND a.previous_attestation_id IS NOT NULL)
         OR (a.lineage_sequence > 1 AND (
           predecessor.attestation_id IS NULL
           OR predecessor.lineage_sequence <> a.lineage_sequence - 1
           OR predecessor.issued_at > a.issued_at
         ))
       )
  ) THEN
    RETURN false;
  END IF;

  SELECT a.effect, a.valid_until
    INTO v_effect, v_valid_until
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id
     AND a.capability = p_capability
     AND a.issued_at <= p_at
   ORDER BY a.lineage_sequence DESC
   LIMIT 1;

  IF NOT FOUND OR v_effect <> 'GRANT' THEN
    RETURN false;
  END IF;
  RETURN v_valid_until IS NULL OR v_valid_until > p_at;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END
$function$;
CREATE FUNCTION public.has_verified_entitlement_v2(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE potok_control.is_effective_entitlement_v2(
      auth.uid(), p_capability, pg_catalog.statement_timestamp()
    )
  END
$function$;
CREATE FUNCTION public.has_verified_entitlement_v1(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public.has_verified_entitlement_v2(p_capability)
$function$;
REVOKE ALL ON FUNCTION potok_control.is_effective_entitlement_v2(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.has_verified_entitlement_v1(text),public.has_verified_entitlement_v2(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.has_verified_entitlement_v1(text),public.has_verified_entitlement_v2(text) TO authenticated;
COMMENT ON TABLE potok_control.access_attestations IS 'Existing trusted v2 append-only authority contract; id_user adapter has no legacy flag projections or payment source.';
DO $verify$
BEGIN
 IF EXISTS(SELECT FROM potok_control.access_attestations) THEN RAISE EXCEPTION 'Installer must not issue authority';END IF;
 IF EXISTS(SELECT FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND (has_schema_privilege(r.oid,'potok_control','USAGE,CREATE') OR has_schema_privilege(r.oid,'potok_nutrition','USAGE,CREATE') OR has_table_privilege(r.oid,'potok_control.access_attestations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_function_privilege(r.oid,'potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text)','EXECUTE') OR has_function_privilege(r.oid,'potok_control.revoke_entitlement_v2(uuid,text,text,text)','EXECUTE')))
  THEN RAISE EXCEPTION 'Private authority API boundary drift';END IF;
END
$verify$;

-- Reviewed candidate: catalog
-- REVIEW ONLY. Integrates the existing verified-entitlement contract; installs
-- no attestation store, issuer, grants to users, generator or background jobs.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE t text; f record;
BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
   OR to_regprocedure('public.has_catalog_admin_access_v1()') IS NOT NULL THEN
   RAISE EXCEPTION 'Expected unmodified PostgreSQL 17 owner baseline';
 END IF;
 IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE') THEN
   RAISE EXCEPTION 'Client CREATE on public must be closed first';
 END IF;
 FOREACH t IN ARRAY ARRAY['foods','food_aliases','food_search_events','food_search_review_queue','food_alias_apply_audit','food_missing_review_queue','food_missing_food_drafts','food_diary_entries'] LOOP
   IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.'||t)
     AND relowner='postgres'::regrole AND relkind='r' AND relrowsecurity) THEN
     RAISE EXCEPTION 'Catalog owner/type/RLS drift: %',t;
   END IF;
 END LOOP;
 FOR f IN SELECT * FROM (VALUES
   ('public.apply_admin_approved_food_alias(uuid,text,text)','18ec8da84a796d29ffd3f3988af35a6b'),
   ('public.apply_owner_approved_missing_food_draft(uuid)','ee21ab1332bf40b467a33bd5c42600e3'),
   ('public.recompute_food_entries_for_food_ids(uuid[])','2f7f4343e9d22dac706f6d3494568f1a')
 ) x(signature,source_md5) LOOP
   IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure(f.signature)
     AND proowner='postgres'::regrole AND prosecdef AND md5(prosrc)=f.source_md5) THEN
     RAISE EXCEPTION 'Public source function drift: %',f.signature;
   END IF;
 END LOOP;
END
$preflight$;

-- Invoker wrapper: neither it nor user-editable profile/JWT metadata can issue
-- authority. An absent/failed verified predicate denies access until separately
-- reviewed attestation infrastructure and owner decisions are available.
CREATE FUNCTION public.has_catalog_admin_access_v1() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $gate$
DECLARE target oid; allowed boolean;
BEGIN
 IF auth.uid() IS NULL OR (auth.jwt()->>'role') IS DISTINCT FROM 'authenticated' THEN RETURN false; END IF;
 target:=to_regprocedure('public.has_verified_entitlement_v1(text)');
 IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
   WHERE p.oid=target AND p.prorettype='boolean'::regtype
     AND r.rolname IN ('postgres','potok_entitlement_owner')) THEN RETURN false; END IF;
 EXECUTE 'SELECT public.has_verified_entitlement_v1($1)' INTO allowed USING 'admin';
 RETURN allowed IS TRUE;
EXCEPTION WHEN OTHERS THEN RETURN false;
END
$gate$;
REVOKE ALL ON FUNCTION public.has_catalog_admin_access_v1() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.has_catalog_admin_access_v1() TO authenticated;

DO $rpc_guard$
DECLARE f text; original text; definition text; legacy text := $legacy$if v_admin_id is null or not exists (
    select 1
    from public.user_profiles
    where id_user = v_admin_id
      and is_admin = true
  ) then$legacy$;
BEGIN
 FOREACH f IN ARRAY ARRAY['public.apply_admin_approved_food_alias(uuid,text,text)','public.apply_owner_approved_missing_food_draft(uuid)'] LOOP
   SELECT prosrc,pg_get_functiondef(oid) INTO original,definition FROM pg_proc WHERE oid=f::regprocedure;
   IF (length(original)-length(replace(original,legacy,'')))/length(legacy)<>1 THEN
     RAISE EXCEPTION 'Expected single legacy admin guard: %',f;
   END IF;
   EXECUTE replace(definition,legacy,'if not public.has_catalog_admin_access_v1() then');
   IF (SELECT prosrc FROM pg_proc WHERE oid=f::regprocedure)
     <>replace(original,legacy,'if not public.has_catalog_admin_access_v1() then') THEN
     RAISE EXCEPTION 'Unexpected admin body modification';
   END IF;
 END LOOP;
END
$rpc_guard$;
REVOKE EXECUTE ON FUNCTION public.apply_admin_approved_food_alias(uuid,text,text),public.apply_owner_approved_missing_food_draft(uuid)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.apply_admin_approved_food_alias(uuid,text,text),public.apply_owner_approved_missing_food_draft(uuid) TO authenticated;
ALTER FUNCTION public.apply_admin_approved_food_alias(uuid,text,text) SET search_path='';
ALTER FUNCTION public.apply_owner_approved_missing_food_draft(uuid) SET search_path='';

-- Replace only reviewed administrative policies. Ordinary own-search-event
-- insertion and reading policies remain intact.
DO $policies$
DECLARE p record; existing record; condition text := 'public.has_catalog_admin_access_v1()';
BEGIN
 FOR p IN SELECT * FROM (VALUES
   ('food_search_events','food_search_events_admin_all','*'),
   ('food_search_review_queue','food_search_review_queue_admin_all','*'),
   ('food_alias_apply_audit','food_alias_apply_audit_admin_select','r'),
   ('food_alias_apply_audit','food_alias_apply_audit_admin_insert','a'),
   ('food_missing_review_queue','food_missing_review_queue_admin_all','*'),
   ('food_missing_food_drafts','food_missing_food_drafts_admin_all','*')
 ) expected(table_name,policy_name,command) LOOP
   SELECT * INTO existing FROM pg_policy WHERE polrelid=to_regclass('public.'||p.table_name) AND polname=p.policy_name;
   IF NOT FOUND OR existing.polcmd::text<>p.command OR NOT existing.polpermissive
      OR existing.polroles<>ARRAY['authenticated'::regrole::oid]
      OR (p.command<>'a' AND coalesce(pg_get_expr(existing.polqual,existing.polrelid),'') !~ 'is_admin')
      OR (p.command<>'r' AND coalesce(pg_get_expr(existing.polwithcheck,existing.polrelid),'') !~ 'is_admin') THEN
     RAISE EXCEPTION 'Reviewed admin policy drift: %.%',p.table_name,p.policy_name;
   END IF;
   EXECUTE format('ALTER POLICY %I ON public.%I%s%s',p.policy_name,p.table_name,
     CASE WHEN p.command<>'a' THEN ' USING ('||condition||')' ELSE '' END,
     CASE WHEN p.command<>'r' THEN ' WITH CHECK ('||condition||')' ELSE '' END);
 END LOOP;
END
$policies$;

-- Restrictive source boundaries cannot be bypassed by an older permissive own
-- policy. They add no new catalog-wide write grants or user-private read access.
CREATE POLICY catalog_food_read_boundary_v1 ON public.foods AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(source IN ('core','brand') OR (source='user' AND created_by_user_id=auth.uid()));
CREATE POLICY catalog_food_insert_boundary_v1 ON public.foods AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()));
CREATE POLICY catalog_food_update_boundary_v1 ON public.foods AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()))
 WITH CHECK((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()));
CREATE POLICY catalog_food_delete_boundary_v1 ON public.foods AS RESTRICTIVE FOR DELETE TO anon,authenticated
 USING((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()));
CREATE POLICY catalog_alias_read_boundary_v1 ON public.food_aliases AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING((source IN ('core','brand') OR (source='user' AND created_by_user_id=auth.uid()))
   AND EXISTS(SELECT FROM public.foods f WHERE f.id=food_aliases.canonical_food_id));
CREATE POLICY catalog_alias_insert_boundary_v1 ON public.food_aliases AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK(((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()))
   AND EXISTS(SELECT FROM public.foods f WHERE f.id=food_aliases.canonical_food_id));
CREATE POLICY catalog_alias_update_boundary_v1 ON public.food_aliases AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()))
 WITH CHECK(((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()))
   AND EXISTS(SELECT FROM public.foods f WHERE f.id=food_aliases.canonical_food_id));
CREATE POLICY catalog_alias_delete_boundary_v1 ON public.food_aliases AS RESTRICTIVE FOR DELETE TO anon,authenticated
 USING((source='user' AND created_by_user_id=auth.uid()) OR (source IN ('core','brand') AND public.has_catalog_admin_access_v1()));

-- Audit rows are written by the reviewed definer RPCs, never forged directly.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.food_alias_apply_audit FROM PUBLIC,anon,authenticated;
DO $audit_columns$ DECLARE a record; BEGIN
 FOR a IN SELECT attname FROM pg_attribute WHERE attrelid='public.food_alias_apply_audit'::regclass AND attnum>0 AND NOT attisdropped LOOP
   EXECUTE format('REVOKE INSERT (%I),UPDATE (%I) ON public.food_alias_apply_audit FROM PUBLIC,anon,authenticated',a.attname,a.attname);
 END LOOP;
END $audit_columns$;

-- An ACL-only revoke does not stop owner/definer chains. Keep the legacy
-- signature but retire its body for every caller, including the owner.
CREATE OR REPLACE FUNCTION public.recompute_food_entries_for_food_ids(food_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $retired$
BEGIN
 RAISE EXCEPTION 'Historical nutrition snapshots cannot be recomputed from catalog revisions' USING ERRCODE='42501';
END
$retired$;
REVOKE EXECUTE ON FUNCTION public.recompute_food_entries_for_food_ids(uuid[]) FROM PUBLIC,anon,authenticated,service_role;

DO $verify$
BEGIN
 IF EXISTS(SELECT FROM pg_policies WHERE schemaname='public'
   AND tablename IN ('food_search_events','food_search_review_queue','food_alias_apply_audit','food_missing_review_queue','food_missing_food_drafts')
   AND (coalesce(qual,'') ~ 'is_admin' OR coalesce(with_check,'') ~ 'is_admin')) THEN
   RAISE EXCEPTION 'Unreviewed legacy admin policy remains';
 END IF;
 IF has_table_privilege('authenticated','public.food_alias_apply_audit','INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_any_column_privilege('authenticated','public.food_alias_apply_audit','INSERT,UPDATE')
   OR has_function_privilege('anon','public.apply_admin_approved_food_alias(uuid,text,text)','EXECUTE')
   OR has_function_privilege('service_role','public.apply_owner_approved_missing_food_draft(uuid)','EXECUTE')
   OR has_function_privilege('authenticated','public.recompute_food_entries_for_food_ids(uuid[])','EXECUTE') THEN
   RAISE EXCEPTION 'Effective catalog authority grant mismatch';
 END IF;
END
$verify$;

-- Reviewed candidate: trgm
-- LOCAL RESTORED DATABASE ONLY. Rehearses relocation and ALWAYS ROLLS BACK.
-- Not an apply migration. psql must use ON_ERROR_STOP=1.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, pg_temp;

DO $preflight$
DECLARE e record; f record; names text; has_path boolean; code text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Expected effective role postgres'; END IF;
  SELECT x.*, n.nspname INTO e FROM pg_extension x
    JOIN pg_namespace n ON n.oid = x.extnamespace WHERE x.extname = 'pg_trgm';
  IF NOT FOUND OR NOT e.extrelocatable OR e.nspname NOT IN ('public', 'extensions') THEN
    RAISE EXCEPTION 'Expected relocatable pg_trgm in public or extensions';
  END IF;
  IF to_regnamespace('extensions') IS NULL THEN RAISE EXCEPTION 'Target schema missing'; END IF;
  IF has_schema_privilege('anon', 'extensions', 'CREATE')
     OR has_schema_privilege('authenticated', 'extensions', 'CREATE') THEN
    RAISE EXCEPTION 'Client CREATE on target schema requires separate review';
  END IF;
  IF NOT has_schema_privilege('postgres', 'extensions', 'USAGE')
     OR NOT has_schema_privilege('anon', 'extensions', 'USAGE')
     OR NOT has_schema_privilege('authenticated', 'extensions', 'USAGE') THEN
    RAISE EXCEPTION 'Target schema USAGE requires separate review';
  END IF;
  SELECT string_agg(p.proname, '|') INTO names FROM pg_proc p
    JOIN pg_depend d ON d.classid = 'pg_proc'::regclass AND d.objid = p.oid
      AND d.deptype = 'e' AND d.refobjid = e.oid;
  IF names IS NULL THEN RAISE EXCEPTION 'Extension routines missing'; END IF;
  -- Conservative source scan, not a complete SQL dependency parser. Dynamic
  -- and external callers still need the application-level rehearsal checklist.
  FOR f IN SELECT p.oid, p.prosrc, p.proconfig FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid AND d.deptype = 'e')
  LOOP
    -- Ignore only a simple, line-start RAISE message literal. Its '%' tokens
    -- are formatting placeholders. Keep the argument expressions unchanged:
    -- they may contain real extension calls/operators. Other string forms
    -- remain conservatively subject to review; this is not a PL/pgSQL parser.
    code := regexp_replace(f.prosrc,
      $raise$(^[[:blank:]]*RAISE[[:blank:]]+(DEBUG|LOG|INFO|NOTICE|WARNING|EXCEPTION)[[:blank:]]+)'([^']|'')*'$raise$,
      $message$\1'<message>'$message$, 'gin');
    IF code ~* ('\mpublic\s*\.\s*(' || names || ')\s*\(')
       OR code ~* 'OPERATOR\s*\(\s*public\s*\.' THEN
      RAISE EXCEPTION 'Explicit public extension reference requires review: %', f.oid::regprocedure;
    END IF;
    IF code ~* ('\m(' || names || ')\s*\(')
       OR code ~ '(^|[[:space:](])(%|<%|%>|<<%|%>>|<->|<<->|<->>)([[:space:](]|$)' THEN
      SELECT EXISTS (SELECT 1 FROM unnest(f.proconfig) s
        WHERE s LIKE 'search_path=%'
          AND replace(s, '"', '') !~ '(^|[ ,=])extensions([ ,]|$)') INTO has_path;
      IF has_path THEN
        RAISE EXCEPTION 'Restricted search_path requires review: %', f.oid::regprocedure;
      END IF;
    END IF;
  END LOOP;
END
$preflight$;

CREATE TEMP TABLE potok_trgm_members ON COMMIT DROP AS
  SELECT d.classid, d.objid, d.objsubid FROM pg_depend d
  WHERE d.refobjid = (SELECT oid FROM pg_extension WHERE extname = 'pg_trgm') AND d.deptype = 'e';
CREATE TEMP TABLE potok_trgm_acl ON COMMIT DROP AS
  SELECT p.oid, p.proacl::text AS acl FROM pg_proc p JOIN potok_trgm_members m
  ON m.classid = 'pg_proc'::regclass AND m.objid = p.oid;
CREATE TEMP TABLE potok_trgm_indexes ON COMMIT DROP AS
  SELECT i.indexrelid, i.indrelid, i.indclass::text AS classes,
         i.indisvalid, i.indisready, pg_relation_filenode(i.indexrelid) AS filenode
  FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
  WHERE c.relnamespace = 'public'::regnamespace;
CREATE TEMP TABLE potok_trgm_rows (relid oid PRIMARY KEY, rows bigint) ON COMMIT DROP;
DO $counts$
DECLARE t record; n bigint;
BEGIN
  FOR t IN SELECT c.oid FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %s', t.oid::regclass) INTO n;
    INSERT INTO potok_trgm_rows VALUES (t.oid, n);
  END LOOP;
END
$counts$;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

DO $verify$
DECLARE t record; n bigint;
BEGIN
  IF (SELECT extnamespace FROM pg_extension WHERE extname = 'pg_trgm') <> 'extensions'::regnamespace THEN
    RAISE EXCEPTION 'Extension did not move';
  END IF;
  IF EXISTS (
    (SELECT classid, objid, objsubid FROM potok_trgm_members EXCEPT
     SELECT classid, objid, objsubid FROM pg_depend WHERE deptype = 'e'
       AND refobjid = (SELECT oid FROM pg_extension WHERE extname = 'pg_trgm'))
    UNION ALL
    (SELECT classid, objid, objsubid FROM pg_depend WHERE deptype = 'e'
       AND refobjid = (SELECT oid FROM pg_extension WHERE extname = 'pg_trgm')
     EXCEPT SELECT classid, objid, objsubid FROM potok_trgm_members)
  ) THEN RAISE EXCEPTION 'Extension object identities changed'; END IF;
  IF EXISTS (SELECT 1 FROM potok_trgm_acl a LEFT JOIN pg_proc p ON p.oid = a.oid
             WHERE p.oid IS NULL OR p.proacl::text IS DISTINCT FROM a.acl) THEN
    RAISE EXCEPTION 'Extension routine grants changed';
  END IF;
  IF EXISTS (SELECT 1 FROM potok_trgm_indexes b LEFT JOIN pg_index i ON i.indexrelid = b.indexrelid
    WHERE i.indexrelid IS NULL OR i.indrelid <> b.indrelid
      OR i.indclass::text <> b.classes OR i.indisvalid <> b.indisvalid
      OR i.indisready <> b.indisready
      OR pg_relation_filenode(i.indexrelid) IS DISTINCT FROM b.filenode) THEN
    RAISE EXCEPTION 'Index identity or state changed';
  END IF;
  FOR t IN SELECT * FROM potok_trgm_rows LOOP
    EXECUTE format('SELECT count(*) FROM %s', t.relid::regclass) INTO n;
    IF n <> t.rows THEN RAISE EXCEPTION 'Row count changed for %', t.relid::regclass; END IF;
  END LOOP;
  IF extensions.similarity('apple', 'apple') <> 1 THEN RAISE EXCEPTION 'Search smoke failed'; END IF;
  RAISE NOTICE 'TRGM_REHEARSAL_OK: extension objects, grants, indexes and table counts preserved. ROLLBACK follows.';
END
$verify$;

-- Reviewed follow-up: paywall
-- Review-only follow-up to #196/#201/#205. Never apply this wrapper to hosted.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
DECLARE r record; p pg_proc;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 THEN RAISE EXCEPTION 'Expected reviewed nonsuperuser postgres PG17 actor';END IF;
 FOR r IN SELECT * FROM (VALUES
  ('public.get_paywall_state(text,uuid)','0ee06a885f411da3e3f5f9382ca82eb7','jsonb'::regtype,false),
  ('public.get_entitlements(uuid)','2173a704a6e15eaba9a85e138537780b','jsonb'::regtype,false),
  ('public.has_verified_entitlement_v1(text)','a5b600b1f2306b6bb95015c0aeee77a3','boolean'::regtype,true),
  ('public.has_verified_entitlement_v2(text)','0228404d5b3f9b8e00d36ea12a00922a','boolean'::regtype,true),
  ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d','boolean'::regtype,true)
 ) v(signature,source_md5,result_type,pinned_path) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(r.signature);
  IF NOT FOUND OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef
   OR p.prorettype<>r.result_type OR p.proretset OR md5(p.prosrc)<>r.source_md5
   OR (r.pinned_path AND p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog'])
   OR (r.signature='public.get_paywall_state(text,uuid)' AND p.proconfig IS NOT NULL AND p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp'])
   OR (r.signature='public.get_entitlements(uuid)' AND p.proconfig IS DISTINCT FROM ARRAY['search_path=""'])
  THEN RAISE EXCEPTION 'Server Premium source contract requires review: %',r.signature;END IF;
 END LOOP;
 IF NOT has_function_privilege('authenticated','public.get_paywall_state(text,uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.get_entitlements(uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.has_verified_entitlement_v1(text)','EXECUTE')
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','service_role']) role_name
  WHERE has_function_privilege(role_name,'public.get_paywall_state(text,uuid)','EXECUTE')
     OR has_function_privilege(role_name,'public.get_entitlements(uuid)','EXECUTE')
     OR has_function_privilege(role_name,'public.has_verified_entitlement_v1(text)','EXECUTE'))
 THEN RAISE EXCEPTION 'Expected existing authenticated-only reader boundary';END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('potok_control.access_attestations')
  AND relrowsecurity AND relforcerowsecurity AND pg_get_userbyid(relowner)='postgres')
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated','service_role']) role_name
  WHERE has_schema_privilege(role_name,'potok_control','USAGE,CREATE')
   OR has_table_privilege(role_name,'potok_control.access_attestations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
   OR has_function_privilege(role_name,'potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text)','EXECUTE')
   OR has_function_privilege(role_name,'potok_control.revoke_entitlement_v2(uuid,text,text,text)','EXECUTE'))
 THEN RAISE EXCEPTION 'Private authority boundary requires review';END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.get_paywall_state(p_feature text,p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $paywall$
DECLARE ent jsonb; flag_name text; required_tier text;
BEGIN
 -- Existing guarded reader enforces signed identity and exact own-account ID.
 ent := public.get_entitlements(p_user_id);
 flag_name := CASE p_feature WHEN 'adaptation' THEN 'can_adapt'
   WHEN 'explainability' THEN 'can_explain' WHEN 'spatial' THEN 'can_spatial' END;
 required_tier := CASE WHEN p_feature='spatial' THEN 'vision_pro' ELSE 'pro' END;
 IF flag_name IS NULL THEN
  RETURN pg_catalog.jsonb_build_object('locked',true,'required_tier',required_tier,'reason','unsupported_feature');
 END IF;
 IF NOT coalesce(public.has_verified_entitlement_v1('premium'),false)
 OR (ent->'flags'->flag_name) IS DISTINCT FROM 'true'::jsonb THEN
  RETURN pg_catalog.jsonb_build_object('locked',true,'required_tier',required_tier,'reason',p_feature||'_locked');
 END IF;
 RETURN pg_catalog.jsonb_build_object('locked',false,'tier',ent->>'tier');
END
$paywall$;
REVOKE ALL ON FUNCTION public.get_paywall_state(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_paywall_state(text,uuid) TO authenticated;
DO $verify$
BEGIN
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.get_paywall_state(text,uuid)'::regprocedure)
 OR NOT has_function_privilege('authenticated','public.get_paywall_state(text,uuid)','EXECUTE')
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','service_role']) role_name
  WHERE has_function_privilege(role_name,'public.get_paywall_state(text,uuid)','EXECUTE'))
 THEN RAISE EXCEPTION 'Paywall final boundary verification failed';END IF;
END
$verify$;

-- Reviewed follow-up: programRead
-- Review-only program explanation projection. Separate follow-up to #206.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE r record; p pg_proc;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT rolsuper OR NOT rolbypassrls FROM pg_roles WHERE rolname=current_user)
 OR to_regnamespace('potok_delivery') IS NOT NULL
 THEN RAISE EXCEPTION 'Expected reviewed PG17 nonsuperuser postgres BYPASSRLS and fresh delivery namespace';END IF;
 FOR r IN SELECT * FROM (VALUES
  ('public.get_program_explainability(uuid,integer)','7eff577b1b0303ff564d552e11169523',false,NULL::text[]),
  ('public.get_program_days(uuid)','2c6a2a82f326cd95d0d5a1eb16fdf838',false,NULL::text[]),
  ('public.get_program_day_details(uuid,date)','86340608de1ed6dca3e4ebb4ddb4d952',false,NULL::text[]),
  ('public.get_paywall_state(text,uuid)','31b744a14d51ce1c5016ea442aa9edd9',false,ARRAY['search_path=""']),
  ('public.get_entitlements(uuid)','2173a704a6e15eaba9a85e138537780b',true,ARRAY['search_path=""']),
  ('public.has_verified_entitlement_v1(text)','a5b600b1f2306b6bb95015c0aeee77a3',true,ARRAY['search_path=pg_catalog']),
  ('public.has_verified_entitlement_v2(text)','0228404d5b3f9b8e00d36ea12a00922a',true,ARRAY['search_path=pg_catalog']),
  ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d',true,ARRAY['search_path=pg_catalog'])
 ) v(signature,source_md5,definer,config) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(r.signature);
  IF NOT FOUND OR pg_get_userbyid(p.proowner)<>'postgres' OR p.prosecdef<>r.definer
  OR md5(p.prosrc)<>r.source_md5 OR (p.proconfig IS DISTINCT FROM r.config AND NOT
   (r.config IS NULL AND r.signature IN('public.get_program_explainability(uuid,integer)','public.get_program_days(uuid)','public.get_program_day_details(uuid,date)')
    AND p.proconfig=ARRAY['search_path=public, pg_temp']))
  THEN RAISE EXCEPTION 'Program read source contract requires review: %',r.signature;END IF;
 END LOOP;
 FOR r IN SELECT unnest(ARRAY['nutrition_programs','training_programs','program_explainability','program_phases','program_blocks','program_days','program_sessions']) AS name LOOP
  IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.'||r.name) AND relkind='r' AND relrowsecurity AND pg_get_userbyid(relowner)='postgres')
  THEN RAISE EXCEPTION 'Program table ownership/RLS requires review: %',r.name;END IF;
 END LOOP;
 IF (SELECT array_agg(attname::text ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.program_explainability'::regclass AND attnum>0 AND NOT attisdropped)
 IS DISTINCT FROM ARRAY['id','program_id','program_type','version','decision_ref','knowledge_refs','confidence','guard_notes','created_at']
 THEN RAISE EXCEPTION 'Unexpected explanation shape';END IF;
 IF EXISTS(SELECT FROM (VALUES ('id','uuid'),('program_id','uuid'),('program_type','text'),('version','integer'),('decision_ref','text'),('knowledge_refs','jsonb'),('confidence','numeric(4,3)'),('guard_notes','jsonb'),('created_at','timestamp with time zone')) v(name,type_name)
  LEFT JOIN pg_attribute a ON a.attrelid='public.program_explainability'::regclass AND a.attname=v.name
  WHERE a.attnum IS NULL OR format_type(a.atttypid,a.atttypmod)<>v.type_name)
 THEN RAISE EXCEPTION 'Unexpected explanation column types';END IF;
 IF NOT has_function_privilege('authenticated','public.get_paywall_state(text,uuid)','EXECUTE')
 OR NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('potok_control.access_attestations') AND relrowsecurity AND relforcerowsecurity AND pg_get_userbyid(relowner)='postgres')
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated','service_role']) role_name
  WHERE has_schema_privilege(role_name,'potok_control','USAGE,CREATE')
  OR has_table_privilege(role_name,'potok_control.access_attestations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'))
 THEN RAISE EXCEPTION 'Expected existing verified authority boundary';END IF;
END
$preflight$;
CREATE TEMP TABLE program_read_preserved_caps ON COMMIT DROP AS
 SELECT role_name,privilege,has_table_privilege(role_name,'public.program_explainability',privilege) AS allowed
 FROM unnest(ARRAY['authenticated','service_role']) role_name,
 unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege;
CREATE TEMP TABLE program_read_service_columns ON COMMIT DROP AS
 SELECT attname,has_column_privilege('service_role','public.program_explainability',attname,'SELECT') AS allowed
 FROM pg_attribute WHERE attrelid='public.program_explainability'::regclass AND attnum>0 AND NOT attisdropped;

CREATE SCHEMA potok_delivery AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA potok_delivery FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA potok_delivery TO authenticated;
-- Private privileged projection boundary. Public facades remain invokers.
CREATE FUNCTION potok_delivery.program_scope_v1(p_program_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $scope$
DECLARE caller uuid:=auth.uid(); n bigint; kind text; owned boolean;
BEGIN
 IF caller IS NULL OR (auth.jwt()->>'role') IS DISTINCT FROM 'authenticated'
 THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';END IF;
 SELECT count(*),min(x.kind),bool_and(x.user_id=caller) INTO n,kind,owned FROM (
  SELECT 'nutrition'::text AS kind,np.user_id FROM public.nutrition_programs np WHERE np.id=p_program_id
  UNION ALL SELECT 'training',tp.user_id FROM public.training_programs tp WHERE tp.id=p_program_id
 ) x;
 -- UUID-only legacy signatures cannot disambiguate overlapping program types.
 IF n<>1 OR owned IS DISTINCT FROM true THEN RETURN NULL;END IF;
 RETURN kind;
END
$scope$;
CREATE FUNCTION potok_delivery.read_program_explainability_v1(p_program_id uuid,p_version integer)
RETURNS SETOF public.program_explainability
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $read$
DECLARE kind text; full_access boolean;
BEGIN
 kind:=potok_delivery.program_scope_v1(p_program_id);
 IF kind IS NULL THEN RETURN;END IF;
 full_access:=coalesce((public.get_paywall_state('explainability',auth.uid())->'locked')='false'::jsonb,false);
 RETURN QUERY SELECT e.id,e.program_id,e.program_type,e.version,e.decision_ref,
  CASE WHEN full_access THEN e.knowledge_refs ELSE NULL::jsonb END,
  (CASE WHEN full_access THEN e.confidence ELSE NULL::numeric END)::numeric(4,3),
  CASE WHEN full_access THEN e.guard_notes
   WHEN pg_catalog.jsonb_typeof(e.guard_notes->'reason_code')='string'
    THEN pg_catalog.jsonb_build_object('reason_code',e.guard_notes->>'reason_code')
   ELSE NULL::jsonb END,e.created_at
 FROM public.program_explainability e
 WHERE e.program_id=p_program_id AND e.program_type=kind AND (p_version IS NULL OR e.version=p_version)
 ORDER BY e.created_at DESC;
END
$read$;
REVOKE ALL ON FUNCTION potok_delivery.program_scope_v1(uuid),potok_delivery.read_program_explainability_v1(uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION potok_delivery.program_scope_v1(uuid),potok_delivery.read_program_explainability_v1(uuid,integer) TO authenticated;

REVOKE SELECT ON public.program_explainability FROM PUBLIC,anon,authenticated;
DO $columns$
DECLARE col record;
BEGIN
 FOR col IN SELECT attname FROM pg_attribute WHERE attrelid='public.program_explainability'::regclass AND attnum>0 AND NOT attisdropped LOOP
  EXECUTE format('REVOKE SELECT (%I) ON public.program_explainability FROM PUBLIC,anon,authenticated',col.attname);
 END LOOP;
END
$columns$;
GRANT SELECT(id,program_id,program_type,version,decision_ref,created_at) ON public.program_explainability TO authenticated;
CREATE POLICY program_explanation_read_scope_v1 ON public.program_explainability AS RESTRICTIVE FOR SELECT TO authenticated
 USING(potok_delivery.program_scope_v1(program_id)=program_type);

create or replace function public.get_program_explainability(p_program_id uuid, p_version integer default null)
returns setof public.program_explainability
language sql
security invoker
set search_path = ''
as $$
  select * from potok_delivery.read_program_explainability_v1(p_program_id,p_version);
$$;

create or replace function public.get_program_days(p_program_id uuid)
returns table (
  date date,
  block_id uuid,
  phase_id uuid,
  phase_type text,
  block_type text,
  targets jsonb,
  session_plan jsonb,
  session_status text,
  explainability_summary jsonb
)
language sql
security invoker
set search_path = ''
as $$
  with latest_explain as (
    select pe.program_id, pe.version, pe.decision_ref, pe.guard_notes
    from potok_delivery.read_program_explainability_v1(p_program_id,NULL) pe
    join public.nutrition_programs np on np.id = pe.program_id
    where pe.program_id = p_program_id and pe.program_type='nutrition' and pe.version = np.program_version
    union all
    select pe.program_id, pe.version, pe.decision_ref, pe.guard_notes
    from potok_delivery.read_program_explainability_v1(p_program_id,NULL) pe
    join public.training_programs tp on tp.id = pe.program_id
    where pe.program_id = p_program_id and pe.program_type='training' and pe.version = tp.program_version
  ),
  latest_days as (
    select distinct on (pd.date) pd.*
    from public.program_days pd
    join public.program_blocks pb on pb.id = pd.block_id
    join public.program_phases pp on pp.id = pb.phase_id
    where pp.program_id = p_program_id and pp.program_type=potok_delivery.program_scope_v1(p_program_id)
    order by pd.date asc, pd.created_at desc
  ),
  latest_sessions as (
    select distinct on (ps.date) ps.*
    from public.program_sessions ps
    where ps.program_id = p_program_id and ((potok_delivery.program_scope_v1(p_program_id)='nutrition' and ps.session_type='meal_plan') or (potok_delivery.program_scope_v1(p_program_id)='training' and ps.session_type='workout_plan'))
    order by ps.date asc, ps.created_at desc
  )
  select ld.date,
         ld.block_id,
         pb.phase_id,
         pp.phase_type,
         pb.block_type,
         ld.targets,
         ld.session_plan,
         ls.status as session_status,
         jsonb_build_object('decision_ref', le.decision_ref, 'reason_code', le.guard_notes->>'reason_code') as explainability_summary
  from latest_days ld
  join public.program_blocks pb on pb.id = ld.block_id
  join public.program_phases pp on pp.id = pb.phase_id
  left join latest_sessions ls on ls.program_id = p_program_id and ls.date = ld.date
  left join latest_explain le on le.program_id = p_program_id
  order by ld.date asc;
$$;

create or replace function public.get_program_day_details(p_program_id uuid, p_date date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with day_row as (
    select pd.*, pb.block_type, pp.phase_type, pp.phase_goal
    from public.program_days pd
    join public.program_blocks pb on pb.id = pd.block_id
    join public.program_phases pp on pp.id = pb.phase_id
    where pp.program_id = p_program_id and pp.program_type=potok_delivery.program_scope_v1(p_program_id) and pd.date = p_date
    order by pd.created_at desc
    limit 1
  ),
  session_row as (
    select ps.*
    from public.program_sessions ps
    where ps.program_id = p_program_id and ((potok_delivery.program_scope_v1(p_program_id)='nutrition' and ps.session_type='meal_plan') or (potok_delivery.program_scope_v1(p_program_id)='training' and ps.session_type='workout_plan')) and ps.date = p_date
    order by ps.created_at desc
    limit 1
  ),
  explain_row as (
    select pe.*
    from potok_delivery.read_program_explainability_v1(p_program_id,NULL) pe
    join public.nutrition_programs np on np.id = pe.program_id
    where pe.program_id = p_program_id and pe.program_type='nutrition' and pe.version = np.program_version
    union all
    select pe.*
    from potok_delivery.read_program_explainability_v1(p_program_id,NULL) pe
    join public.training_programs tp on tp.id = pe.program_id
    where pe.program_id = p_program_id and pe.program_type='training' and pe.version = tp.program_version
  )
  select jsonb_build_object(
    'day', (select to_jsonb(day_row) from day_row),
    'session', (select to_jsonb(session_row) from session_row),
    'explainability', (select jsonb_agg(to_jsonb(explain_row)) from explain_row)
  );
$$;

REVOKE ALL ON FUNCTION public.get_program_explainability(uuid,integer),public.get_program_days(uuid),public.get_program_day_details(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_program_explainability(uuid,integer),public.get_program_days(uuid),public.get_program_day_details(uuid,date) TO authenticated;
DO $verify$
BEGIN
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),unnest(ARRAY['knowledge_refs','confidence','guard_notes']) c(col)
  WHERE has_column_privilege(r.role_name,'public.program_explainability',c.col,'SELECT'))
 OR EXISTS(SELECT FROM program_read_preserved_caps c WHERE c.allowed IS DISTINCT FROM has_table_privilege(c.role_name,'public.program_explainability',c.privilege))
 OR EXISTS(SELECT FROM program_read_service_columns c WHERE c.allowed IS DISTINCT FROM has_column_privilege('service_role','public.program_explainability',c.attname,'SELECT'))
 OR has_schema_privilege('authenticated','potok_delivery','CREATE')
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','service_role']) role_name WHERE has_schema_privilege(role_name,'potok_delivery','USAGE,CREATE')
  OR has_function_privilege(role_name,'potok_delivery.program_scope_v1(uuid)','EXECUTE')
  OR has_function_privilege(role_name,'potok_delivery.read_program_explainability_v1(uuid,integer)','EXECUTE'))
 THEN RAISE EXCEPTION 'Program read final privilege boundary failed';END IF;
END
$verify$;

-- Reviewed follow-up: history
-- Review-only client history containment. No plan generation/activation.
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE r record; names text[];
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 THEN RAISE EXCEPTION 'Expected reviewed nonsuperuser postgres PG17 actor';END IF;
 FOR r IN SELECT * FROM (VALUES
  ('program_versions',ARRAY['id','program_id','program_type','version','snapshot','reason','created_at']),
  ('program_adaptations',ARRAY['id','program_id','program_type','from_version','to_version','trigger','summary','created_at']),
  ('program_explainability',ARRAY['id','program_id','program_type','version','decision_ref','knowledge_refs','confidence','guard_notes','created_at']),
  ('program_guard_events',ARRAY['id','program_id','program_type','risk_level','flags','blocked_actions','created_at'])
 ) v(name,columns) LOOP
  IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.'||r.name) AND relkind='r' AND relrowsecurity AND pg_get_userbyid(relowner)='postgres')
  THEN RAISE EXCEPTION 'History table ownership/RLS requires review: %',r.name;END IF;
  SELECT array_agg(attname::text ORDER BY attnum) INTO names FROM pg_attribute
   WHERE attrelid=to_regclass('public.'||r.name) AND attnum>0 AND NOT attisdropped;
  IF names IS DISTINCT FROM r.columns THEN RAISE EXCEPTION 'History shape requires review: %',r.name;END IF;
 END LOOP;
END
$preflight$;

CREATE TEMP TABLE history_preserved_table_caps ON COMMIT DROP AS
 SELECT role_name,table_name,privilege,has_table_privilege(role_name,'public.'||table_name,privilege) AS allowed
 FROM unnest(ARRAY['anon','authenticated','service_role']) role_name,
 unnest(ARRAY['program_versions','program_adaptations','program_explainability','program_guard_events']) table_name,
 unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege
 WHERE role_name='service_role' OR privilege IN('SELECT','INSERT');
CREATE TEMP TABLE history_preserved_column_caps ON COMMIT DROP AS
 SELECT role_name,c.relname AS table_name,a.attname AS col,privilege,
 has_column_privilege(role_name,c.oid,a.attnum,privilege) AS allowed
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,
 unnest(ARRAY['anon','authenticated','service_role']) role_name,
 unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) privilege
 WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass)
 AND a.attnum>0 AND NOT a.attisdropped AND (role_name='service_role' OR privilege IN('SELECT','INSERT'));

REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON
 public.program_versions,public.program_adaptations,public.program_explainability,public.program_guard_events
 FROM PUBLIC,anon,authenticated;
DO $column_revoke$
DECLARE r record;
BEGIN
 FOR r IN SELECT c.relname,a.attname FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
 WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass)
 AND a.attnum>0 AND NOT a.attisdropped LOOP
  EXECUTE format('REVOKE UPDATE(%I),REFERENCES(%I) ON public.%I FROM PUBLIC,anon,authenticated',r.attname,r.attname,r.relname);
 END LOOP;
END
$column_revoke$;
DO $verify$
BEGIN
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) role_name,
  unnest(ARRAY['program_versions','program_adaptations','program_explainability','program_guard_events']) table_name,
  unnest(ARRAY['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege
  WHERE has_table_privilege(role_name,'public.'||table_name,privilege))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,
  unnest(ARRAY['anon','authenticated']) role_name,unnest(ARRAY['UPDATE','REFERENCES']) privilege
  WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass)
   AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(role_name,c.oid,a.attnum,privilege))
 THEN RAISE EXCEPTION 'History client mutation boundary requires role/owner review';END IF;
 IF EXISTS(SELECT FROM history_preserved_table_caps c WHERE c.allowed IS DISTINCT FROM has_table_privilege(c.role_name,'public.'||c.table_name,c.privilege))
 OR EXISTS(SELECT FROM history_preserved_column_caps c WHERE c.allowed IS DISTINCT FROM has_column_privilege(c.role_name,'public.'||c.table_name,c.col,c.privilege))
 THEN RAISE EXCEPTION 'History read/insert/service compatibility would change';END IF;
END
$verify$;

-- Reviewed follow-up: quarantine
-- Review-only retirement of unsafe legacy table-by-table generation/replanning.
-- Existing plan reads and bounded execution annotations remain; Graph runtime stays OFF.
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE r record;p pg_proc;session_columns text[];
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.program_sessions'::regclass AND attname='execution_reason' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Expected reviewed PG17 actor and original session shape';END IF;
 FOR r IN SELECT unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) AS name LOOP
  IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.'||r.name) AND relkind='r' AND relrowsecurity AND pg_get_userbyid(relowner)='postgres')
  THEN RAISE EXCEPTION 'Legacy plan table ownership/RLS requires review: %',r.name;END IF;
 END LOOP;
 SELECT array_agg(attname::text ORDER BY attnum) INTO session_columns
 FROM pg_attribute WHERE attrelid='public.program_sessions'::regclass AND attnum>0 AND NOT attisdropped;
 -- Both exact compatibility shapes retain every pre-existing column unchanged.
 -- day_date is a read field used by the public Progress client, never a new write grant.
 IF NOT(session_columns=ARRAY['id','program_id','date','session_type','plan_payload','status','created_at']
 OR (session_columns=ARRAY['id','program_id','date','session_type','plan_payload','status','created_at','day_date']
 AND EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.program_sessions'::regclass
  AND attname='day_date' AND atttypid='date'::regtype AND NOT attisdropped)))
 OR EXISTS(SELECT FROM unnest(ARRAY['nutrition_programs','training_programs','program_sessions']) t(name)
  WHERE NOT has_column_privilege('authenticated','public.'||t.name,'status','UPDATE') OR NOT has_table_privilege('authenticated','public.'||t.name,'SELECT'))
 THEN RAISE EXCEPTION 'Expected existing bounded execution capability and session shape';END IF;
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('potok_delivery.program_scope_v1(uuid)');
 IF NOT FOUND OR pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
 OR md5(p.prosrc)<>'b05c7dd8e77f3c5cba77fd73236e01af' OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION 'Reviewed scoped program reader from #207 required';END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) grantee(role_name),
  unnest(ARRAY['program_versions','program_adaptations','program_explainability','program_guard_events']) t(name)
  WHERE has_table_privilege(grantee.role_name,'public.'||t.name,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,unnest(ARRAY['anon','authenticated']) grantee(role_name)
  WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass)
  AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(grantee.role_name,c.oid,a.attnum,'UPDATE,REFERENCES'))
 THEN RAISE EXCEPTION 'Prior history containment from #208 required';END IF;
END
$preflight$;
CREATE TEMP TABLE legacy_plan_keep_table_caps ON COMMIT DROP AS
 SELECT r.role_name,t.table_name,p.privilege,has_table_privilege(r.role_name,'public.'||t.table_name,p.privilege) AS allowed
 FROM unnest(ARRAY['anon','authenticated','service_role']) r(role_name),
 unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) t(table_name),
 unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p(privilege)
 WHERE r.role_name='service_role' OR p.privilege='SELECT';
CREATE TEMP TABLE legacy_plan_keep_column_caps ON COMMIT DROP AS
 SELECT r.role_name,c.relname AS table_name,a.attname AS col,p.privilege,has_column_privilege(r.role_name,c.oid,a.attnum,p.privilege) AS allowed
 FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,
 unnest(ARRAY['anon','authenticated','service_role']) r(role_name),unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) p(privilege)
 WHERE c.oid IN('public.nutrition_programs'::regclass,'public.training_programs'::regclass,'public.program_phases'::regclass,'public.program_blocks'::regclass,'public.program_days'::regclass,'public.program_sessions'::regclass,'public.program_generation_jobs'::regclass,'public.program_versions'::regclass,'public.program_adaptations'::regclass)
 AND a.attnum>0 AND NOT a.attisdropped AND (r.role_name='service_role' OR p.privilege='SELECT');

ALTER TABLE public.program_sessions ADD COLUMN execution_reason text
 CHECK(execution_reason IS NULL OR execution_reason IN('fatigue','pose_risk','user_override'));
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON
 public.nutrition_programs,public.training_programs,public.program_phases,public.program_blocks,public.program_days,public.program_sessions,public.program_generation_jobs
 FROM PUBLIC,anon,authenticated;
REVOKE INSERT ON public.program_versions,public.program_adaptations FROM PUBLIC,anon,authenticated;
DO $columns$
DECLARE r record;
BEGIN
 FOR r IN SELECT c.relname,a.attname FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
 WHERE c.oid IN('public.nutrition_programs'::regclass,'public.training_programs'::regclass,'public.program_phases'::regclass,'public.program_blocks'::regclass,'public.program_days'::regclass,'public.program_sessions'::regclass,'public.program_generation_jobs'::regclass)
 AND a.attnum>0 AND NOT a.attisdropped LOOP
  EXECUTE format('REVOKE INSERT(%I),UPDATE(%I),REFERENCES(%I) ON public.%I FROM PUBLIC,anon,authenticated',r.attname,r.attname,r.attname,r.relname);
 END LOOP;
 FOR r IN SELECT c.relname,a.attname FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
 WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass) AND a.attnum>0 AND NOT a.attisdropped LOOP
  EXECUTE format('REVOKE INSERT(%I) ON public.%I FROM PUBLIC,anon,authenticated',r.attname,r.relname);
 END LOOP;
END
$columns$;
GRANT UPDATE(status) ON public.nutrition_programs,public.training_programs TO authenticated;
GRANT UPDATE(status,execution_reason) ON public.program_sessions TO authenticated;
CREATE POLICY legacy_session_scope_read_v1 ON public.program_sessions AS RESTRICTIVE FOR SELECT TO authenticated
 USING(potok_delivery.program_scope_v1(program_id)=CASE session_type WHEN 'meal_plan' THEN 'nutrition' WHEN 'workout_plan' THEN 'training' END);
CREATE POLICY legacy_session_scope_update_v1 ON public.program_sessions AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(potok_delivery.program_scope_v1(program_id)=CASE session_type WHEN 'meal_plan' THEN 'nutrition' WHEN 'workout_plan' THEN 'training' END)
 WITH CHECK(potok_delivery.program_scope_v1(program_id)=CASE session_type WHEN 'meal_plan' THEN 'nutrition' WHEN 'workout_plan' THEN 'training' END);
DO $verify$
BEGIN
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),
  unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) t(name)
  WHERE has_table_privilege(r.role_name,'public.'||t.name,'INSERT'))
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),
  unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs']) t(name)
  WHERE has_table_privilege(r.role_name,'public.'||t.name,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,unnest(ARRAY['anon','authenticated']) r(role_name)
  WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass)
  AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(r.role_name,c.oid,a.attnum,'INSERT'))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,unnest(ARRAY['anon','authenticated']) r(role_name)
  WHERE c.oid IN('public.nutrition_programs'::regclass,'public.training_programs'::regclass,'public.program_phases'::regclass,'public.program_blocks'::regclass,'public.program_days'::regclass,'public.program_sessions'::regclass,'public.program_generation_jobs'::regclass)
  AND a.attnum>0 AND NOT a.attisdropped AND (
   has_column_privilege(r.role_name,c.oid,a.attnum,'INSERT,REFERENCES') OR
   (has_column_privilege(r.role_name,c.oid,a.attnum,'UPDATE') AND NOT(r.role_name='authenticated' AND ((c.relname IN('nutrition_programs','training_programs') AND a.attname='status') OR (c.relname='program_sessions' AND a.attname IN('status','execution_reason')))))))
 OR EXISTS(SELECT FROM legacy_plan_keep_table_caps c WHERE c.allowed IS DISTINCT FROM has_table_privilege(c.role_name,'public.'||c.table_name,c.privilege))
 OR EXISTS(SELECT FROM legacy_plan_keep_column_caps c WHERE c.allowed IS DISTINCT FROM has_column_privilege(c.role_name,'public.'||c.table_name,c.col,c.privilege))
 OR NOT has_column_privilege('authenticated','public.nutrition_programs','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.training_programs','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.program_sessions','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.program_sessions','execution_reason','UPDATE')
 THEN RAISE EXCEPTION 'Legacy quarantine effective permission or compatibility verification failed';END IF;
END
$verify$;

DO $history_final$
BEGIN
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) role_name,
 unnest(ARRAY['program_versions','program_adaptations','program_explainability','program_guard_events']) table_name,
 unnest(ARRAY['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege
 WHERE has_table_privilege(role_name,'public.'||table_name,privilege))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,
 unnest(ARRAY['anon','authenticated']) role_name,unnest(ARRAY['UPDATE','REFERENCES']) privilege
 WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass) AND a.attnum>0 AND NOT a.attisdropped
 AND has_column_privilege(role_name,c.oid,a.attnum,privilege))
 THEN RAISE EXCEPTION 'History final effective mutation boundary failed';END IF;
END $history_final$;DO $final$ BEGIN
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),
 unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) t(name)
 WHERE has_table_privilege(r.role_name,'public.'||t.name,'INSERT'))
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),
 unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs']) t(name)
 WHERE has_table_privilege(r.role_name,'public.'||t.name,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,unnest(ARRAY['anon','authenticated']) r(role_name)
 WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) AND a.attnum>0 AND NOT a.attisdropped
 AND (has_column_privilege(r.role_name,c.oid,a.attnum,'INSERT') OR
 (c.relname=ANY(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs']) AND (has_column_privilege(r.role_name,c.oid,a.attnum,'REFERENCES') OR
 (has_column_privilege(r.role_name,c.oid,a.attnum,'UPDATE') AND NOT(r.role_name='authenticated' AND
 ((c.relname IN('nutrition_programs','training_programs') AND a.attname='status') OR (c.relname='program_sessions' AND a.attname IN('status','execution_reason')))))))))
 OR NOT has_column_privilege('authenticated','public.nutrition_programs','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.training_programs','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.program_sessions','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.program_sessions','execution_reason','UPDATE')
 THEN RAISE EXCEPTION 'Legacy plan quarantine final permissions mismatch';END IF;
 END $final$;DO $final$ DECLARE r record;p pg_proc;BEGIN
 FOR r IN SELECT * FROM (VALUES ('potok_delivery.program_scope_v1(uuid)','b05c7dd8e77f3c5cba77fd73236e01af',true),('potok_delivery.read_program_explainability_v1(uuid,integer)','a5d9b147eb16c0b22dfcb320b21ccfea',true),('public.get_program_explainability(uuid,integer)','14dac242eb7fec9531805407f42371b1',false),('public.get_program_days(uuid)','ad6ab3fd77eaeae87f93400a838bb9f1',false),('public.get_program_day_details(uuid,date)','e6058cd9aeea79c5b9b91c191a995b8d',false)) v(sig,hash,definer) LOOP
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(r.sig);
 IF NOT FOUND OR md5(p.prosrc)<>r.hash OR p.prosecdef<>r.definer OR pg_get_userbyid(p.proowner)<>'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
 OR NOT has_function_privilege('authenticated',r.sig,'EXECUTE')
 OR has_function_privilege('anon',r.sig,'EXECUTE') OR has_function_privilege('service_role',r.sig,'EXECUTE')
 THEN RAISE EXCEPTION 'Program read final source contract mismatch';END IF;END LOOP;
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) role_name,unnest(ARRAY['knowledge_refs','confidence','guard_notes']) col WHERE has_column_privilege(role_name,'public.program_explainability',col,'SELECT'))
 OR NOT has_schema_privilege('authenticated','potok_delivery','USAGE') OR has_schema_privilege('authenticated','potok_delivery','CREATE')
 OR has_schema_privilege('anon','potok_delivery','USAGE,CREATE') OR has_schema_privilege('service_role','potok_delivery','USAGE,CREATE')
 THEN RAISE EXCEPTION 'Program read final permissions mismatch';END IF;END $final$;
DO $review_final$ DECLARE checks jsonb;verdict text;BEGIN
 SELECT to_jsonb(q) INTO checks FROM (SELECT
 NOT EXISTS(SELECT FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','p') AND (has_table_privilege('anon',c.oid,'TRUNCATE') OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))) AS trunc,
 NOT EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role),unnest(ARRAY['is_admin','has_premium','created_at','updated_at']) c(col)
 WHERE has_column_privilege(r.role,'public.user_profiles',c.col,'INSERT') OR has_column_privilege(r.role,'public.user_profiles',c.col,'UPDATE')) AS profile,
 has_column_privilege('authenticated','public.user_profiles','first_name','UPDATE') AS ordinary_profile,
 NOT EXISTS(SELECT FROM unnest(ARRAY['public.apply_admin_approved_food_alias(uuid,text,text)','public.apply_owner_approved_missing_food_draft(uuid)','public.get_entitlements(uuid)','public.get_paywall_state(text,uuid)','public.recompute_food_entries_for_food_ids(uuid[])','public.restore_purchase(uuid,text,text,text)','public.rls_auto_enable()','public.start_purchase(uuid,text,text,text)']) s(signature)
 WHERE has_function_privilege('anon',s.signature,'EXECUTE')) AS anon_rpc,
 has_function_privilege('authenticated','public.get_entitlements(uuid)','EXECUTE') AS own_read,
 NOT has_function_privilege('service_role','public.get_entitlements(uuid)','EXECUTE') AS service_read_denied,
 NOT has_function_privilege('authenticated','public.start_purchase(uuid,text,text,text)','EXECUTE') AS client_purchase_denied,
 has_function_privilege('service_role','public.start_purchase(uuid,text,text,text)','EXECUTE') AS server_event_retained,
 NOT EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role),unnest(ARRAY['public.entitlements','public.subscriptions','public.billing_events']) t(name)
 WHERE has_table_privilege(r.role,t.name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')) AS finance,
 NOT has_function_privilege('service_role','public.apply_admin_approved_food_alias(uuid,text,text)','EXECUTE') AS server_admin_denied,
 NOT has_function_privilege('authenticated','public.recompute_food_entries_for_food_ids(uuid[])','EXECUTE') AS history,
 has_table_privilege('authenticated','public.measurement_photo_assets','INSERT') AS photo,
 has_column_privilege('authenticated','public.measurement_photo_deletions','deleted_at','UPDATE') AS photo_upsert,
 (SELECT extnamespace='extensions'::regnamespace FROM pg_extension WHERE extname='pg_trgm') AS trgm,
 EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('potok_control.access_attestations') AND relowner='postgres'::regrole AND relrowsecurity AND relforcerowsecurity) AS authority_store,
 NOT EXISTS(SELECT FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND (has_schema_privilege(r.oid,'potok_control','USAGE,CREATE') OR has_schema_privilege(r.oid,'potok_nutrition','USAGE,CREATE') OR has_table_privilege(r.oid,'potok_control.access_attestations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_function_privilege(r.oid,'potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text)','EXECUTE') OR has_function_privilege(r.oid,'potok_control.revoke_entitlement_v2(uuid,text,text,text)','EXECUTE'))) AS private_api,
 has_function_privilege('authenticated','public.has_verified_entitlement_v1(text)','EXECUTE') AND NOT has_function_privilege('anon','public.has_verified_entitlement_v1(text)','EXECUTE') AND NOT has_function_privilege('service_role','public.has_verified_entitlement_v1(text)','EXECUTE') AS verified_reader,
 NOT EXISTS(SELECT FROM (VALUES
 ('public.has_verified_entitlement_v1(text)','a5b600b1f2306b6bb95015c0aeee77a3',true,'boolean'),
 ('public.has_verified_entitlement_v2(text)','0228404d5b3f9b8e00d36ea12a00922a',true,'boolean'),
 ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d',true,'boolean'),
 ('potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text)','0508a0dd9629ce2cb60edc488a557b53',true,'uuid'),
 ('potok_control.revoke_entitlement_v2(uuid,text,text,text)','176be1520ab2fbe62de42b31bb2be826',true,'uuid'),
 ('potok_nutrition.acquire_shared_account_gate_v1(uuid)','0a7fc0c24f7bc22f6792781636ac2387',false,'void')) e(signature,hash,definer,result)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 WHERE p.oid IS NULL OR md5(p.prosrc)<>e.hash OR p.proowner<>'postgres'::regrole OR p.prosecdef<>e.definer OR p.prorettype<>e.result::regtype OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) AS authority_source_contract) q;
 IF EXISTS(SELECT FROM jsonb_each(checks) e WHERE e.value IS DISTINCT FROM 'true'::jsonb)
 THEN RAISE EXCEPTION 'Final effective permission review failed';END IF;
 IF EXISTS(SELECT FROM potok_control.access_attestations)
 THEN RAISE EXCEPTION 'Authority must remain empty';END IF;
 SELECT q.verdict INTO verdict FROM (-- Read-only public application-schema boundary check. Never an apply script.
-- A SQL pass is not evidence about HTTP exposed schemas, full app behavior or hosted release.

WITH app_defaults AS (
 SELECT count(*)::integer AS own_client_truncate_defaults
 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 WHERE d.defaclrole='postgres'::regrole AND d.defaclobjtype='r'
 AND d.defaclnamespace IN(0,'public'::regnamespace) AND a.privilege_type='TRUNCATE'
 AND CASE WHEN a.grantee=0 THEN true ELSE
  pg_has_role('anon',a.grantee,'USAGE') OR pg_has_role('authenticated',a.grantee,'USAGE') END
), platform_defaults AS (
 SELECT count(*)::integer AS platform_public_truncate_defaults
 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclobjtype='r'
 AND d.defaclnamespace='public'::regnamespace AND a.privilege_type='TRUNCATE'
 AND a.grantee IN('anon'::regrole,'authenticated'::regrole)
), objects AS (
 SELECT 'pg_class'::regclass AS classid,c.oid AS objid
 FROM pg_class c WHERE c.relnamespace='public'::regnamespace
 AND c.relowner='supabase_admin'::regrole AND c.relkind IN('r','p','v','m','f','S')
 UNION ALL
 SELECT 'pg_proc'::regclass,p.oid FROM pg_proc p
 WHERE p.pronamespace='public'::regnamespace AND p.proowner='supabase_admin'::regrole
), boundary AS (
 SELECT app_defaults.*,platform_defaults.*,
 (SELECT count(*)::integer FROM pg_class c WHERE c.relnamespace='public'::regnamespace
  AND c.relkind IN('r','p') AND (has_table_privilege('anon',c.oid,'TRUNCATE')
  OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))) AS existing_client_truncate_tables,
 (SELECT count(*)::integer FROM pg_extension WHERE extnamespace='public'::regnamespace) AS extensions_in_public,
 (SELECT count(*)::integer FROM objects) AS platform_public_objects,
 (SELECT count(*)::integer FROM objects o WHERE NOT EXISTS(
  SELECT FROM pg_depend d WHERE d.classid=o.classid AND d.objid=o.objid
  AND d.refclassid='pg_extension'::regclass AND d.deptype='e')) AS platform_objects_without_extension,
 has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE')
  OR has_schema_privilege('anon','extensions','CREATE') OR has_schema_privilege('authenticated','extensions','CREATE') AS client_schema_create
 FROM app_defaults CROSS JOIN platform_defaults
)
SELECT CASE WHEN own_client_truncate_defaults=0 AND existing_client_truncate_tables=0
 AND extensions_in_public=0 AND platform_public_objects=0 AND NOT client_schema_create
 THEN 'SQL_BOUNDARY_VERIFIED' ELSE 'NEEDS_REVIEW' END AS verdict,boundary.*
FROM boundary) q;
 IF verdict IS DISTINCT FROM 'SQL_BOUNDARY_VERIFIED'
 THEN RAISE EXCEPTION 'SQL boundary review failed';END IF;
END $review_final$;
DO $scope$ DECLARE actual jsonb; BEGIN
 SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'partition',c.relispartition,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'generated',a.attgenerated) ORDER BY a.attnum)
 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C")
 INTO actual FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('auth','public','storage') AND c.relkind IN('r','p');
 IF actual IS DISTINCT FROM '[{"schema":"auth","name":"audit_log_entries","kind":"r","partition":false,"columns":[{"name":"instance_id","type":"uuid","generated":""},{"name":"id","type":"uuid","generated":""},{"name":"payload","type":"json","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"ip_address","type":"character varying(64)","generated":""}]},{"schema":"auth","name":"custom_oauth_providers","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"provider_type","type":"text","generated":""},{"name":"identifier","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"client_id","type":"text","generated":""},{"name":"client_secret","type":"text","generated":""},{"name":"acceptable_client_ids","type":"text[]","generated":""},{"name":"scopes","type":"text[]","generated":""},{"name":"pkce_enabled","type":"boolean","generated":""},{"name":"attribute_mapping","type":"jsonb","generated":""},{"name":"authorization_params","type":"jsonb","generated":""},{"name":"enabled","type":"boolean","generated":""},{"name":"email_optional","type":"boolean","generated":""},{"name":"issuer","type":"text","generated":""},{"name":"discovery_url","type":"text","generated":""},{"name":"skip_nonce_check","type":"boolean","generated":""},{"name":"cached_discovery","type":"jsonb","generated":""},{"name":"discovery_cached_at","type":"timestamp with time zone","generated":""},{"name":"authorization_url","type":"text","generated":""},{"name":"token_url","type":"text","generated":""},{"name":"userinfo_url","type":"text","generated":""},{"name":"jwks_uri","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"custom_claims_allowlist","type":"text[]","generated":""}]},{"schema":"auth","name":"flow_state","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"auth_code","type":"text","generated":""},{"name":"code_challenge_method","type":"auth.code_challenge_method","generated":""},{"name":"code_challenge","type":"text","generated":""},{"name":"provider_type","type":"text","generated":""},{"name":"provider_access_token","type":"text","generated":""},{"name":"provider_refresh_token","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"authentication_method","type":"text","generated":""},{"name":"auth_code_issued_at","type":"timestamp with time zone","generated":""},{"name":"invite_token","type":"text","generated":""},{"name":"referrer","type":"text","generated":""},{"name":"oauth_client_state_id","type":"uuid","generated":""},{"name":"linking_target_id","type":"uuid","generated":""},{"name":"email_optional","type":"boolean","generated":""}]},{"schema":"auth","name":"identities","kind":"r","partition":false,"columns":[{"name":"provider_id","type":"text","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"identity_data","type":"jsonb","generated":""},{"name":"provider","type":"text","generated":""},{"name":"last_sign_in_at","type":"timestamp with time zone","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"email","type":"text","generated":"s"},{"name":"id","type":"uuid","generated":""}]},{"schema":"auth","name":"instances","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"uuid","type":"uuid","generated":""},{"name":"raw_base_config","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"mfa_amr_claims","kind":"r","partition":false,"columns":[{"name":"session_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"authentication_method","type":"text","generated":""},{"name":"id","type":"uuid","generated":""}]},{"schema":"auth","name":"mfa_challenges","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"factor_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"verified_at","type":"timestamp with time zone","generated":""},{"name":"ip_address","type":"inet","generated":""},{"name":"otp_code","type":"text","generated":""},{"name":"web_authn_session_data","type":"jsonb","generated":""}]},{"schema":"auth","name":"mfa_factors","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"friendly_name","type":"text","generated":""},{"name":"factor_type","type":"auth.factor_type","generated":""},{"name":"status","type":"auth.factor_status","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"secret","type":"text","generated":""},{"name":"phone","type":"text","generated":""},{"name":"last_challenged_at","type":"timestamp with time zone","generated":""},{"name":"web_authn_credential","type":"jsonb","generated":""},{"name":"web_authn_aaguid","type":"uuid","generated":""},{"name":"last_webauthn_challenge_data","type":"jsonb","generated":""}]},{"schema":"auth","name":"mfa_recovery_code_sets","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"mfa_factor_id","type":"uuid","generated":""},{"name":"failed_verification_count","type":"integer","generated":""},{"name":"verification_locked_until","type":"timestamp with time zone","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"mfa_recovery_codes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"mfa_recovery_code_set_id","type":"uuid","generated":""},{"name":"code_hash","type":"text","generated":""},{"name":"consumed_at","type":"timestamp with time zone","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"oauth_authorizations","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"authorization_id","type":"text","generated":""},{"name":"client_id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"redirect_uri","type":"text","generated":""},{"name":"scope","type":"text","generated":""},{"name":"state","type":"text","generated":""},{"name":"resource","type":"text","generated":""},{"name":"code_challenge","type":"text","generated":""},{"name":"code_challenge_method","type":"auth.code_challenge_method","generated":""},{"name":"response_type","type":"auth.oauth_response_type","generated":""},{"name":"status","type":"auth.oauth_authorization_status","generated":""},{"name":"authorization_code","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"expires_at","type":"timestamp with time zone","generated":""},{"name":"approved_at","type":"timestamp with time zone","generated":""},{"name":"nonce","type":"text","generated":""}]},{"schema":"auth","name":"oauth_client_states","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"provider_type","type":"text","generated":""},{"name":"code_verifier","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"oauth_clients","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"client_secret_hash","type":"text","generated":""},{"name":"registration_type","type":"auth.oauth_registration_type","generated":""},{"name":"redirect_uris","type":"text","generated":""},{"name":"grant_types","type":"text","generated":""},{"name":"client_name","type":"text","generated":""},{"name":"client_uri","type":"text","generated":""},{"name":"logo_uri","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""},{"name":"client_type","type":"auth.oauth_client_type","generated":""},{"name":"token_endpoint_auth_method","type":"text","generated":""}]},{"schema":"auth","name":"oauth_consents","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"client_id","type":"uuid","generated":""},{"name":"scopes","type":"text","generated":""},{"name":"granted_at","type":"timestamp with time zone","generated":""},{"name":"revoked_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"one_time_tokens","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"token_type","type":"auth.one_time_token_type","generated":""},{"name":"token_hash","type":"text","generated":""},{"name":"relates_to","type":"text","generated":""},{"name":"created_at","type":"timestamp without time zone","generated":""},{"name":"updated_at","type":"timestamp without time zone","generated":""},{"name":"expires_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"refresh_tokens","kind":"r","partition":false,"columns":[{"name":"instance_id","type":"uuid","generated":""},{"name":"id","type":"bigint","generated":""},{"name":"token","type":"character varying(255)","generated":""},{"name":"user_id","type":"character varying(255)","generated":""},{"name":"revoked","type":"boolean","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"parent","type":"character varying(255)","generated":""},{"name":"session_id","type":"uuid","generated":""}]},{"schema":"auth","name":"saml_providers","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"sso_provider_id","type":"uuid","generated":""},{"name":"entity_id","type":"text","generated":""},{"name":"metadata_xml","type":"text","generated":""},{"name":"metadata_url","type":"text","generated":""},{"name":"attribute_mapping","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"name_id_format","type":"text","generated":""}]},{"schema":"auth","name":"saml_relay_states","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"sso_provider_id","type":"uuid","generated":""},{"name":"request_id","type":"text","generated":""},{"name":"for_email","type":"text","generated":""},{"name":"redirect_to","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"flow_state_id","type":"uuid","generated":""}]},{"schema":"auth","name":"schema_migrations","kind":"r","partition":false,"columns":[{"name":"version","type":"character varying(255)","generated":""}]},{"schema":"auth","name":"scim_tokens","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"sso_provider_id","type":"uuid","generated":""},{"name":"token_hash","type":"text","generated":""},{"name":"prefix","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"expires_at","type":"timestamp with time zone","generated":""},{"name":"revoked_at","type":"timestamp with time zone","generated":""},{"name":"last_used_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"scim_users","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"sso_provider_id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"resource","type":"jsonb","generated":""},{"name":"user_name","type":"text","generated":"s"},{"name":"external_id","type":"text","generated":"s"},{"name":"active","type":"boolean","generated":"s"},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"sessions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"factor_id","type":"uuid","generated":""},{"name":"aal","type":"auth.aal_level","generated":""},{"name":"not_after","type":"timestamp with time zone","generated":""},{"name":"refreshed_at","type":"timestamp without time zone","generated":""},{"name":"user_agent","type":"text","generated":""},{"name":"ip","type":"inet","generated":""},{"name":"tag","type":"text","generated":""},{"name":"oauth_client_id","type":"uuid","generated":""},{"name":"refresh_token_hmac_key","type":"text","generated":""},{"name":"refresh_token_counter","type":"bigint","generated":""},{"name":"scopes","type":"text","generated":""}]},{"schema":"auth","name":"sso_domains","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"sso_provider_id","type":"uuid","generated":""},{"name":"domain","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"sso_providers","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"resource_id","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"disabled","type":"boolean","generated":""}]},{"schema":"auth","name":"users","kind":"r","partition":false,"columns":[{"name":"instance_id","type":"uuid","generated":""},{"name":"id","type":"uuid","generated":""},{"name":"aud","type":"character varying(255)","generated":""},{"name":"role","type":"character varying(255)","generated":""},{"name":"email","type":"character varying(255)","generated":""},{"name":"encrypted_password","type":"character varying(255)","generated":""},{"name":"email_confirmed_at","type":"timestamp with time zone","generated":""},{"name":"invited_at","type":"timestamp with time zone","generated":""},{"name":"confirmation_token","type":"character varying(255)","generated":""},{"name":"confirmation_sent_at","type":"timestamp with time zone","generated":""},{"name":"recovery_token","type":"character varying(255)","generated":""},{"name":"recovery_sent_at","type":"timestamp with time zone","generated":""},{"name":"email_change_token_new","type":"character varying(255)","generated":""},{"name":"email_change","type":"character varying(255)","generated":""},{"name":"email_change_sent_at","type":"timestamp with time zone","generated":""},{"name":"last_sign_in_at","type":"timestamp with time zone","generated":""},{"name":"raw_app_meta_data","type":"jsonb","generated":""},{"name":"raw_user_meta_data","type":"jsonb","generated":""},{"name":"is_super_admin","type":"boolean","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"phone","type":"text","generated":""},{"name":"phone_confirmed_at","type":"timestamp with time zone","generated":""},{"name":"phone_change","type":"text","generated":""},{"name":"phone_change_token","type":"character varying(255)","generated":""},{"name":"phone_change_sent_at","type":"timestamp with time zone","generated":""},{"name":"confirmed_at","type":"timestamp with time zone","generated":"s"},{"name":"email_change_token_current","type":"character varying(255)","generated":""},{"name":"email_change_confirm_status","type":"smallint","generated":""},{"name":"banned_until","type":"timestamp with time zone","generated":""},{"name":"reauthentication_token","type":"character varying(255)","generated":""},{"name":"reauthentication_sent_at","type":"timestamp with time zone","generated":""},{"name":"is_sso_user","type":"boolean","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""},{"name":"is_anonymous","type":"boolean","generated":""}]},{"schema":"auth","name":"webauthn_challenges","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"challenge_type","type":"text","generated":""},{"name":"session_data","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"expires_at","type":"timestamp with time zone","generated":""}]},{"schema":"auth","name":"webauthn_credentials","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"credential_id","type":"bytea","generated":""},{"name":"public_key","type":"bytea","generated":""},{"name":"attestation_type","type":"text","generated":""},{"name":"aaguid","type":"uuid","generated":""},{"name":"sign_count","type":"bigint","generated":""},{"name":"transports","type":"jsonb","generated":""},{"name":"backup_eligible","type":"boolean","generated":""},{"name":"backed_up","type":"boolean","generated":""},{"name":"friendly_name","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"last_used_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_coaching_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"type","type":"text","generated":""},{"name":"trigger","type":"text","generated":""},{"name":"confidence","type":"numeric(5,2)","generated":""},{"name":"trust_score_used","type":"numeric(5,2)","generated":""},{"name":"state_snapshot","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_generation_params","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"model_version","type":"text","generated":""},{"name":"prompt_version","type":"text","generated":""},{"name":"params","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_guard_logs","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"ai_type","type":"text","generated":""},{"name":"ai_id","type":"uuid","generated":""},{"name":"status","type":"text","generated":""},{"name":"reasons","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_long_term_memory","kind":"r","partition":false,"columns":[{"name":"user_id","type":"uuid","generated":""},{"name":"user_preferences","type":"jsonb","generated":""},{"name":"rejected_patterns","type":"jsonb","generated":""},{"name":"success_patterns","type":"jsonb","generated":""},{"name":"injury_history","type":"jsonb","generated":""},{"name":"food_intolerances","type":"jsonb","generated":""},{"name":"psychological_triggers","type":"jsonb","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_meal_plans","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"input_hash","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"model_version","type":"text","generated":""},{"name":"prompt_version","type":"text","generated":""},{"name":"confidence_score","type":"numeric(4,3)","generated":""},{"name":"trust_score","type":"integer","generated":""},{"name":"plan","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"dynamic_version","type":"integer","generated":""},{"name":"generation_params","type":"jsonb","generated":""},{"name":"relevance_score","type":"numeric(5,2)","generated":""},{"name":"guard_status","type":"text","generated":""}]},{"schema":"public","name":"ai_quality_metrics","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"ai_type","type":"text","generated":""},{"name":"ai_id","type":"uuid","generated":""},{"name":"confidence_score","type":"numeric(5,2)","generated":""},{"name":"relevance_score","type":"numeric(5,2)","generated":""},{"name":"notes","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"ai_recommendations","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"type","type":"text","generated":""},{"name":"input_hash","type":"text","generated":""},{"name":"model_version","type":"text","generated":""},{"name":"prompt_version","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"result","type":"jsonb","generated":""},{"name":"confidence_score","type":"numeric(4,2)","generated":""},{"name":"relevance_score","type":"numeric(4,2)","generated":""},{"name":"trust_score","type":"numeric(4,2)","generated":""},{"name":"guard_status","type":"text","generated":""},{"name":"outdated","type":"boolean","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"generation_params","type":"jsonb","generated":""},{"name":"request_type","type":"text","generated":""},{"name":"input_context","type":"jsonb","generated":""},{"name":"idempotency_key","type":"text","generated":""}]},{"schema":"public","name":"ai_training_plans","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"input_hash","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"model_version","type":"text","generated":""},{"name":"prompt_version","type":"text","generated":""},{"name":"confidence_score","type":"numeric(4,3)","generated":""},{"name":"trust_score","type":"integer","generated":""},{"name":"plan","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"dynamic_version","type":"integer","generated":""},{"name":"generation_params","type":"jsonb","generated":""},{"name":"relevance_score","type":"numeric(5,2)","generated":""},{"name":"guard_status","type":"text","generated":""},{"name":"input_context","type":"jsonb","generated":""},{"name":"outdated_at","type":"timestamp with time zone","generated":""},{"name":"is_outdated","type":"boolean","generated":""}]},{"schema":"public","name":"ai_trust_scores","kind":"r","partition":false,"columns":[{"name":"user_id","type":"uuid","generated":""},{"name":"trust_score","type":"numeric(5,2)","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"analytics_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"event_name","type":"text","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"billing_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"provider","type":"text","generated":""},{"name":"event_type","type":"text","generated":""},{"name":"idempotency_key","type":"text","generated":""},{"name":"payload","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"entitlements","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"tier","type":"text","generated":""},{"name":"flags","type":"jsonb","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"exercise_categories","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"order","type":"integer","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"exercise_definition_media","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"exercise_id","type":"uuid","generated":""},{"name":"media_type","type":"text","generated":""},{"name":"url","type":"text","generated":""},{"name":"sort_order","type":"integer","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"exercise_definitions","kind":"r","partition":false,"columns":[{"name":"exercise_id","type":"uuid","generated":""},{"name":"description","type":"text","generated":""},{"name":"mistakes","type":"text","generated":""},{"name":"muscle_map_image_url","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"exercise_muscles","kind":"r","partition":false,"columns":[{"name":"exercise_id","type":"uuid","generated":""},{"name":"muscle_id","type":"uuid","generated":""}]},{"schema":"public","name":"exercises","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"category_id","type":"uuid","generated":""},{"name":"description","type":"text","generated":""},{"name":"is_custom","type":"boolean","generated":""},{"name":"created_by_user_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"archived_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"favorite_products","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"product_name","type":"text","generated":""},{"name":"protein","type":"numeric(8,2)","generated":""},{"name":"fat","type":"numeric(8,2)","generated":""},{"name":"carbs","type":"numeric(8,2)","generated":""},{"name":"calories","type":"numeric(8,2)","generated":""},{"name":"usage_count","type":"integer","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"canonical_food_id","type":"uuid","generated":""}]},{"schema":"public","name":"feature_flags","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"feature_key","type":"text","generated":""},{"name":"enabled","type":"boolean","generated":""},{"name":"audience","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_alias_apply_audit","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"source_review_id","type":"uuid","generated":""},{"name":"alias_id","type":"uuid","generated":""},{"name":"alias","type":"text","generated":""},{"name":"normalized_alias","type":"text","generated":""},{"name":"canonical_food_id","type":"uuid","generated":""},{"name":"applied_by","type":"uuid","generated":""},{"name":"applied_at","type":"timestamp with time zone","generated":""},{"name":"result","type":"text","generated":""},{"name":"error","type":"text","generated":""},{"name":"validation","type":"jsonb","generated":""},{"name":"comment","type":"text","generated":""}]},{"schema":"public","name":"food_aliases","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"canonical_food_id","type":"uuid","generated":""},{"name":"alias","type":"text","generated":""},{"name":"normalized_alias","type":"text","generated":""},{"name":"source","type":"text","generated":""},{"name":"verified","type":"boolean","generated":""},{"name":"created_by_user_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_diary_entries","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"meal_type","type":"text","generated":""},{"name":"product_name","type":"text","generated":""},{"name":"protein","type":"numeric(8,2)","generated":""},{"name":"fat","type":"numeric(8,2)","generated":""},{"name":"carbs","type":"numeric(8,2)","generated":""},{"name":"calories","type":"numeric(8,2)","generated":""},{"name":"weight","type":"numeric(8,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"canonical_food_id","type":"uuid","generated":""},{"name":"fiber","type":"numeric(8,2)","generated":""},{"name":"idempotency_key","type":"text","generated":""},{"name":"base_unit","type":"text","generated":""},{"name":"display_unit","type":"text","generated":""},{"name":"display_amount","type":"numeric","generated":""}]},{"schema":"public","name":"food_import_batches","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"source","type":"text","generated":""},{"name":"source_version","type":"text","generated":""},{"name":"filename","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_import_conflicts","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"batch_id","type":"uuid","generated":""},{"name":"staging_id","type":"uuid","generated":""},{"name":"conflict_type","type":"text","generated":""},{"name":"details","type":"jsonb","generated":""},{"name":"status","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_import_staging","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"batch_id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"brand","type":"text","generated":""},{"name":"calories","type":"numeric(8,2)","generated":""},{"name":"protein","type":"numeric(8,2)","generated":""},{"name":"fat","type":"numeric(8,2)","generated":""},{"name":"carbs","type":"numeric(8,2)","generated":""},{"name":"fiber","type":"numeric(8,2)","generated":""},{"name":"unit","type":"text","generated":""},{"name":"aliases","type":"text[]","generated":""},{"name":"allergens","type":"text[]","generated":""},{"name":"intolerances","type":"text[]","generated":""},{"name":"source","type":"text","generated":""},{"name":"source_version","type":"text","generated":""},{"name":"normalized_name","type":"text","generated":""},{"name":"normalized_brand","type":"text","generated":""},{"name":"confidence_score","type":"numeric(4,3)","generated":""},{"name":"verified","type":"boolean","generated":""},{"name":"suspicious","type":"boolean","generated":""},{"name":"status","type":"text","generated":""},{"name":"conflict_reason","type":"text","generated":""},{"name":"raw_data","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_missing_food_drafts","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"source_review_id","type":"uuid","generated":""},{"name":"query","type":"text","generated":""},{"name":"normalized_query","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"normalized_name","type":"text","generated":""},{"name":"category","type":"text","generated":""},{"name":"source","type":"text","generated":""},{"name":"brand","type":"text","generated":""},{"name":"barcode","type":"text","generated":""},{"name":"calories","type":"numeric(8,2)","generated":""},{"name":"protein","type":"numeric(8,2)","generated":""},{"name":"fat","type":"numeric(8,2)","generated":""},{"name":"carbs","type":"numeric(8,2)","generated":""},{"name":"fiber","type":"numeric(8,2)","generated":""},{"name":"unit","type":"text","generated":""},{"name":"data_source","type":"text","generated":""},{"name":"source_url","type":"text","generated":""},{"name":"source_notes","type":"text","generated":""},{"name":"reviewer_notes","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"prepared_by","type":"uuid","generated":""},{"name":"prepared_at","type":"timestamp with time zone","generated":""},{"name":"reviewed_by","type":"uuid","generated":""},{"name":"reviewed_at","type":"timestamp with time zone","generated":""},{"name":"applied_food_id","type":"uuid","generated":""},{"name":"applied_by","type":"uuid","generated":""},{"name":"applied_at","type":"timestamp with time zone","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_missing_review_queue","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"query","type":"text","generated":""},{"name":"normalized_query","type":"text","generated":""},{"name":"context","type":"text","generated":""},{"name":"frequency","type":"integer","generated":""},{"name":"classification","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"source_event_ids","type":"uuid[]","generated":""},{"name":"suggested_name","type":"text","generated":""},{"name":"suggested_category","type":"text","generated":""},{"name":"suggested_source","type":"text","generated":""},{"name":"reviewer_id","type":"uuid","generated":""},{"name":"reviewed_at","type":"timestamp with time zone","generated":""},{"name":"comment","type":"text","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_search_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"session_id_hash","type":"text","generated":""},{"name":"query","type":"text","generated":""},{"name":"normalized_query","type":"text","generated":""},{"name":"context","type":"text","generated":""},{"name":"event_type","type":"text","generated":""},{"name":"result_count","type":"integer","generated":""},{"name":"selected_canonical_food_id","type":"uuid","generated":""},{"name":"no_selection","type":"boolean","generated":""},{"name":"not_found","type":"boolean","generated":""},{"name":"ambiguous","type":"boolean","generated":""},{"name":"candidate_canonical_food_ids","type":"uuid[]","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"food_search_review_queue","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"query","type":"text","generated":""},{"name":"normalized_query","type":"text","generated":""},{"name":"context","type":"text","generated":""},{"name":"suggested_canonical_food_id","type":"uuid","generated":""},{"name":"frequency","type":"integer","generated":""},{"name":"status","type":"text","generated":""},{"name":"reviewer_id","type":"uuid","generated":""},{"name":"reviewed_at","type":"timestamp with time zone","generated":""},{"name":"comment","type":"text","generated":""},{"name":"source_event_ids","type":"uuid[]","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"applied_alias_id","type":"uuid","generated":""},{"name":"alias_applied_by","type":"uuid","generated":""},{"name":"alias_applied_at","type":"timestamp with time zone","generated":""},{"name":"alias_apply_result","type":"text","generated":""},{"name":"alias_apply_error","type":"text","generated":""}]},{"schema":"public","name":"foods","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"name_original","type":"text","generated":""},{"name":"barcode","type":"text","generated":""},{"name":"calories","type":"numeric(8,2)","generated":""},{"name":"protein","type":"numeric(8,2)","generated":""},{"name":"fat","type":"numeric(8,2)","generated":""},{"name":"carbs","type":"numeric(8,2)","generated":""},{"name":"fiber","type":"numeric(8,2)","generated":""},{"name":"unit","type":"text","generated":""},{"name":"category","type":"text","generated":""},{"name":"brand","type":"text","generated":""},{"name":"source","type":"text","generated":""},{"name":"created_by_user_id","type":"uuid","generated":""},{"name":"canonical_food_id","type":"uuid","generated":""},{"name":"normalized_name","type":"text","generated":""},{"name":"normalized_brand","type":"text","generated":""},{"name":"nutrition_version","type":"integer","generated":""},{"name":"verified","type":"boolean","generated":""},{"name":"suspicious","type":"boolean","generated":""},{"name":"confidence_score","type":"numeric(4,3)","generated":""},{"name":"source_version","type":"text","generated":""},{"name":"allergens","type":"text[]","generated":""},{"name":"intolerances","type":"text[]","generated":""},{"name":"photo","type":"text","generated":""},{"name":"aliases","type":"text[]","generated":""},{"name":"auto_filled","type":"boolean","generated":""},{"name":"popularity","type":"integer","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"search_vector","type":"tsvector","generated":""},{"name":"stable_food_id","type":"text","generated":""},{"name":"product_scope","type":"text","generated":""},{"name":"data_source","type":"text","generated":""},{"name":"cooking_state","type":"text","generated":""}]},{"schema":"public","name":"goal_trajectory","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"goal_type","type":"text","generated":""},{"name":"expected_weight_curve","type":"jsonb","generated":""},{"name":"expected_strength_curve","type":"jsonb","generated":""},{"name":"expected_fat_loss_curve","type":"jsonb","generated":""},{"name":"status","type":"text","generated":""},{"name":"deviation","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"habit_logs","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"habit_id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"completed","type":"boolean","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"habits","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"title","type":"text","generated":""},{"name":"description","type":"text","generated":""},{"name":"frequency","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"is_active","type":"boolean","generated":""}]},{"schema":"public","name":"meal_entry_notes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"meal_entry_id","type":"uuid","generated":""},{"name":"product_id","type":"uuid","generated":""},{"name":"text","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"measurement_history","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"text","generated":""},{"name":"measurements","type":"jsonb","generated":""},{"name":"photos","type":"jsonb","generated":""},{"name":"additional_photos","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"day","type":"date","generated":""},{"name":"id_uuid","type":"uuid","generated":""}]},{"schema":"public","name":"measurement_photo_assets","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"day","type":"date","generated":""},{"name":"slot","type":"text","generated":""},{"name":"storage_path","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"thumb_path","type":"text","generated":""}]},{"schema":"public","name":"measurement_photo_deletions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"day","type":"date","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"measurement_photo_history","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"text","generated":""},{"name":"photos","type":"jsonb","generated":""},{"name":"additional_photos","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"day","type":"date","generated":""},{"name":"id_uuid","type":"uuid","generated":""}]},{"schema":"public","name":"muscles","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"notification_history","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"score_id","type":"uuid","generated":""},{"name":"channel","type":"text","generated":""},{"name":"message_id","type":"text","generated":""},{"name":"message","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"explainability","type":"jsonb","generated":""},{"name":"sent_at","type":"timestamp with time zone","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"nutrition_programs","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"goal_id","type":"uuid","generated":""},{"name":"status","type":"text","generated":""},{"name":"program_version","type":"integer","generated":""},{"name":"knowledge_version_ref","type":"jsonb","generated":""},{"name":"start_date","type":"date","generated":""},{"name":"end_date","type":"date","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_3d_angles","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"angles","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_3d_joints","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"joint_name","type":"text","generated":""},{"name":"x","type":"numeric(10,6)","generated":""},{"name":"y","type":"numeric(10,6)","generated":""},{"name":"z","type":"numeric(10,6)","generated":""},{"name":"confidence","type":"numeric(5,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_3d_metrics","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"metrics","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_3d_sessions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"pose_session_id","type":"uuid","generated":""},{"name":"workout_entry_id","type":"uuid","generated":""},{"name":"canonical_exercise_id","type":"uuid","generated":""},{"name":"started_at","type":"timestamp with time zone","generated":""},{"name":"ended_at","type":"timestamp with time zone","generated":""},{"name":"device_info","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_angles","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_frame_id","type":"uuid","generated":""},{"name":"angles","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_biomechanics","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"metrics","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_deviations","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_frame_id","type":"uuid","generated":""},{"name":"joint","type":"text","generated":""},{"name":"observed","type":"numeric(6,2)","generated":""},{"name":"expected_min","type":"numeric(6,2)","generated":""},{"name":"expected_max","type":"numeric(6,2)","generated":""},{"name":"severity","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_feedback_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_session_id","type":"uuid","generated":""},{"name":"event_type","type":"text","generated":""},{"name":"message","type":"text","generated":""},{"name":"confidence","type":"numeric(5,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_frames","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"quality_score","type":"numeric(6,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_guard_flags","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_session_id","type":"uuid","generated":""},{"name":"flag_type","type":"text","generated":""},{"name":"severity","type":"text","generated":""},{"name":"details","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_joints","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_frame_id","type":"uuid","generated":""},{"name":"joint_name","type":"text","generated":""},{"name":"x","type":"numeric(10,6)","generated":""},{"name":"y","type":"numeric(10,6)","generated":""},{"name":"z","type":"numeric(10,6)","generated":""},{"name":"confidence","type":"numeric(5,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_load_estimates","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"estimates","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_quality_scores","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_session_id","type":"uuid","generated":""},{"name":"pose_quality_score","type":"numeric(6,2)","generated":""},{"name":"stability_score","type":"numeric(6,2)","generated":""},{"name":"symmetry_score","type":"numeric(6,2)","generated":""},{"name":"tempo_score","type":"numeric(6,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_risk_assessments","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"frame_index","type":"integer","generated":""},{"name":"ts","type":"timestamp with time zone","generated":""},{"name":"risk_level","type":"text","generated":""},{"name":"guard_flags","type":"text[]","generated":""},{"name":"guard_reason","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_sessions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"workout_entry_id","type":"uuid","generated":""},{"name":"canonical_exercise_id","type":"uuid","generated":""},{"name":"started_at","type":"timestamp with time zone","generated":""},{"name":"ended_at","type":"timestamp with time zone","generated":""},{"name":"device_info","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"pose_voice_cues","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"pose_3d_session_id","type":"uuid","generated":""},{"name":"cue_type","type":"text","generated":""},{"name":"priority","type":"text","generated":""},{"name":"message","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_adaptations","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"from_version","type":"integer","generated":""},{"name":"to_version","type":"integer","generated":""},{"name":"trigger","type":"text","generated":""},{"name":"summary","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_blocks","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"phase_id","type":"uuid","generated":""},{"name":"block_type","type":"text","generated":""},{"name":"block_goal","type":"text","generated":""},{"name":"duration_days","type":"integer","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_days","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"block_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"targets","type":"jsonb","generated":""},{"name":"session_plan","type":"jsonb","generated":""},{"name":"constraints_applied","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_explainability","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"version","type":"integer","generated":""},{"name":"decision_ref","type":"text","generated":""},{"name":"knowledge_refs","type":"jsonb","generated":""},{"name":"confidence","type":"numeric(4,3)","generated":""},{"name":"guard_notes","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_feedback","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"program_session_id","type":"uuid","generated":""},{"name":"energy","type":"integer","generated":""},{"name":"hunger","type":"integer","generated":""},{"name":"difficulty","type":"integer","generated":""},{"name":"pain","type":"integer","generated":""},{"name":"motivation","type":"integer","generated":""},{"name":"notes","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_generation_jobs","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"input_context","type":"jsonb","generated":""},{"name":"output_program_id","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_guard_events","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"risk_level","type":"text","generated":""},{"name":"flags","type":"text[]","generated":""},{"name":"blocked_actions","type":"text[]","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_phases","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"phase_type","type":"text","generated":""},{"name":"phase_goal","type":"text","generated":""},{"name":"start_date","type":"date","generated":""},{"name":"end_date","type":"date","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"program_sessions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"session_type","type":"text","generated":""},{"name":"plan_payload","type":"jsonb","generated":""},{"name":"status","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"day_date","type":"date","generated":""},{"name":"execution_reason","type":"text","generated":""}]},{"schema":"public","name":"program_versions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"program_id","type":"uuid","generated":""},{"name":"program_type","type":"text","generated":""},{"name":"version","type":"integer","generated":""},{"name":"snapshot","type":"jsonb","generated":""},{"name":"reason","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"recipe_ingredients","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"recipe_id","type":"uuid","generated":""},{"name":"food_id","type":"uuid","generated":""},{"name":"amount_g","type":"numeric(10,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"recipe_notes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"recipe_id","type":"uuid","generated":""},{"name":"text","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"recipes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"name","type":"text","generated":""},{"name":"ingredients","type":"jsonb","generated":""},{"name":"total_calories","type":"numeric(10,2)","generated":""},{"name":"protein","type":"numeric(10,2)","generated":""},{"name":"fat","type":"numeric(10,2)","generated":""},{"name":"carbs","type":"numeric(10,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"fiber","type":"numeric(10,2)","generated":""},{"name":"servings","type":"numeric(10,2)","generated":""},{"name":"yield_g","type":"numeric(10,2)","generated":""},{"name":"image","type":"text","generated":""}]},{"schema":"public","name":"subscriptions","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"plan","type":"text","generated":""},{"name":"status","type":"text","generated":""},{"name":"current_period_start","type":"timestamp with time zone","generated":""},{"name":"current_period_end","type":"timestamp with time zone","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"training_programs","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"goal_id","type":"uuid","generated":""},{"name":"status","type":"text","generated":""},{"name":"program_version","type":"integer","generated":""},{"name":"knowledge_version_ref","type":"jsonb","generated":""},{"name":"start_date","type":"date","generated":""},{"name":"end_date","type":"date","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"user_exercise_media","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"exercise_id","type":"uuid","generated":""},{"name":"workout_entry_id","type":"uuid","generated":""},{"name":"workout_date","type":"date","generated":""},{"name":"file_path","type":"text","generated":""},{"name":"file_type","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"user_goals","kind":"r","partition":false,"columns":[{"name":"user_id","type":"uuid","generated":""},{"name":"calories","type":"integer","generated":""},{"name":"protein","type":"numeric(6,2)","generated":""},{"name":"fat","type":"numeric(6,2)","generated":""},{"name":"carbs","type":"numeric(6,2)","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"goal_type","type":"text","generated":""},{"name":"current_weight","type":"numeric(8,2)","generated":""},{"name":"target_weight","type":"numeric(8,2)","generated":""},{"name":"start_date","type":"date","generated":""},{"name":"end_date","type":"date","generated":""},{"name":"months_to_goal","type":"integer","generated":""},{"name":"bmr","type":"integer","generated":""},{"name":"tdee","type":"integer","generated":""},{"name":"training_place","type":"text","generated":""},{"name":"gender","type":"text","generated":""},{"name":"age","type":"integer","generated":""},{"name":"height","type":"numeric(6,2)","generated":""},{"name":"lifestyle","type":"text","generated":""},{"name":"intensity","type":"text","generated":""}]},{"schema":"public","name":"user_measurements","kind":"r","partition":false,"columns":[{"name":"user_id","type":"uuid","generated":""},{"name":"measurements","type":"jsonb","generated":""},{"name":"photos","type":"jsonb","generated":""},{"name":"additional_photos","type":"jsonb","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"user_profiles","kind":"r","partition":false,"columns":[{"name":"id_user","type":"uuid","generated":""},{"name":"first_name","type":"text","generated":""},{"name":"last_name","type":"text","generated":""},{"name":"middle_name","type":"text","generated":""},{"name":"birth_date","type":"date","generated":""},{"name":"age","type":"integer","generated":""},{"name":"height","type":"numeric(5,2)","generated":""},{"name":"goal","type":"text","generated":""},{"name":"email","type":"text","generated":""},{"name":"phone","type":"text","generated":""},{"name":"avatar_url","type":"text","generated":""},{"name":"has_premium","type":"boolean","generated":""},{"name":"is_admin","type":"boolean","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"coach_settings","type":"jsonb","generated":""},{"name":"voice_settings","type":"jsonb","generated":""}]},{"schema":"public","name":"user_state","kind":"r","partition":false,"columns":[{"name":"user_id","type":"uuid","generated":""},{"name":"current_weight","type":"numeric(6,2)","generated":""},{"name":"trend_weight_7d","type":"numeric(6,2)","generated":""},{"name":"trend_weight_30d","type":"numeric(6,2)","generated":""},{"name":"avg_calories","type":"numeric(8,2)","generated":""},{"name":"avg_protein","type":"numeric(8,2)","generated":""},{"name":"training_load_index","type":"numeric(8,2)","generated":""},{"name":"fatigue_index","type":"numeric(8,2)","generated":""},{"name":"adherence_score","type":"numeric(5,2)","generated":""},{"name":"recovery_score","type":"numeric(5,2)","generated":""},{"name":"consistency_score","type":"numeric(5,2)","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"workout_day_notes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"workout_day_id","type":"uuid","generated":""},{"name":"text","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"workout_days","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"date","type":"date","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"public","name":"workout_entries","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"workout_day_id","type":"uuid","generated":""},{"name":"exercise_id","type":"uuid","generated":""},{"name":"sets","type":"integer","generated":""},{"name":"reps","type":"integer","generated":""},{"name":"weight","type":"numeric(10,2)","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"base_unit","type":"text","generated":""},{"name":"display_unit","type":"text","generated":""},{"name":"display_amount","type":"numeric","generated":""},{"name":"idempotency_key","type":"text","generated":""},{"name":"metric_type","type":"text","generated":""},{"name":"exercise_name_snapshot","type":"text","generated":""},{"name":"exercise_category_id_snapshot","type":"uuid","generated":""},{"name":"exercise_category_name_snapshot","type":"text","generated":""},{"name":"canonical_exercise_id_snapshot","type":"uuid","generated":""},{"name":"primary_muscles_snapshot","type":"text[]","generated":""},{"name":"secondary_muscles_snapshot","type":"text[]","generated":""},{"name":"muscles_snapshot","type":"jsonb","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""},{"name":"deleted_by_user_id","type":"uuid","generated":""}]},{"schema":"public","name":"workout_entry_notes","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"user_id","type":"uuid","generated":""},{"name":"workout_entry_id","type":"uuid","generated":""},{"name":"text","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"storage","name":"buckets","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"owner","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"public","type":"boolean","generated":""},{"name":"avif_autodetection","type":"boolean","generated":""},{"name":"file_size_limit","type":"bigint","generated":""},{"name":"allowed_mime_types","type":"text[]","generated":""},{"name":"owner_id","type":"text","generated":""},{"name":"type","type":"storage.buckettype","generated":""},{"name":"versioning_status","type":"text","generated":""},{"name":"lifecycle_configuration","type":"jsonb","generated":""},{"name":"lifecycle_configuration_generation","type":"uuid","generated":""}]},{"schema":"storage","name":"buckets_analytics","kind":"r","partition":false,"columns":[{"name":"name","type":"text","generated":""},{"name":"type","type":"storage.buckettype","generated":""},{"name":"format","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"id","type":"uuid","generated":""},{"name":"deleted_at","type":"timestamp with time zone","generated":""}]},{"schema":"storage","name":"buckets_vectors","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"type","type":"storage.buckettype","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]},{"schema":"storage","name":"migrations","kind":"r","partition":false,"columns":[{"name":"id","type":"integer","generated":""},{"name":"name","type":"character varying(100)","generated":""},{"name":"hash","type":"character varying(40)","generated":""},{"name":"executed_at","type":"timestamp without time zone","generated":""}]},{"schema":"storage","name":"objects","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"bucket_id","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"owner","type":"uuid","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""},{"name":"last_accessed_at","type":"timestamp with time zone","generated":""},{"name":"metadata","type":"jsonb","generated":""},{"name":"path_tokens","type":"text[]","generated":"s"},{"name":"version","type":"text","generated":""},{"name":"owner_id","type":"text","generated":""},{"name":"user_metadata","type":"jsonb","generated":""},{"name":"archived_at","type":"timestamp with time zone","generated":""},{"name":"is_delete_marker","type":"boolean","generated":""},{"name":"is_versioned","type":"boolean","generated":""}]},{"schema":"storage","name":"s3_multipart_uploads","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"in_progress_size","type":"bigint","generated":""},{"name":"upload_signature","type":"text","generated":""},{"name":"bucket_id","type":"text","generated":""},{"name":"key","type":"text","generated":""},{"name":"version","type":"text","generated":""},{"name":"owner_id","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"user_metadata","type":"jsonb","generated":""},{"name":"metadata","type":"jsonb","generated":""}]},{"schema":"storage","name":"s3_multipart_uploads_parts","kind":"r","partition":false,"columns":[{"name":"id","type":"uuid","generated":""},{"name":"upload_id","type":"text","generated":""},{"name":"size","type":"bigint","generated":""},{"name":"part_number","type":"integer","generated":""},{"name":"bucket_id","type":"text","generated":""},{"name":"key","type":"text","generated":""},{"name":"etag","type":"text","generated":""},{"name":"owner_id","type":"text","generated":""},{"name":"version","type":"text","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""}]},{"schema":"storage","name":"vector_indexes","kind":"r","partition":false,"columns":[{"name":"id","type":"text","generated":""},{"name":"name","type":"text","generated":""},{"name":"bucket_id","type":"text","generated":""},{"name":"data_type","type":"text","generated":""},{"name":"dimension","type":"integer","generated":""},{"name":"distance_metric","type":"text","generated":""},{"name":"metadata_configuration","type":"jsonb","generated":""},{"name":"created_at","type":"timestamp with time zone","generated":""},{"name":"updated_at","type":"timestamp with time zone","generated":""}]}]'::jsonb OR EXISTS(SELECT FROM jsonb_to_recordset('[{"schema":"auth","name":"audit_log_entries","owner":"supabase_auth_admin"},{"schema":"auth","name":"custom_oauth_providers","owner":"supabase_auth_admin"},{"schema":"auth","name":"flow_state","owner":"supabase_auth_admin"},{"schema":"auth","name":"identities","owner":"supabase_auth_admin"},{"schema":"auth","name":"instances","owner":"supabase_auth_admin"},{"schema":"auth","name":"mfa_amr_claims","owner":"supabase_auth_admin"},{"schema":"auth","name":"mfa_challenges","owner":"supabase_auth_admin"},{"schema":"auth","name":"mfa_factors","owner":"supabase_auth_admin"},{"schema":"auth","name":"mfa_recovery_code_sets","owner":"supabase_auth_admin"},{"schema":"auth","name":"mfa_recovery_codes","owner":"supabase_auth_admin"},{"schema":"auth","name":"oauth_authorizations","owner":"supabase_auth_admin"},{"schema":"auth","name":"oauth_client_states","owner":"supabase_auth_admin"},{"schema":"auth","name":"oauth_clients","owner":"supabase_auth_admin"},{"schema":"auth","name":"oauth_consents","owner":"supabase_auth_admin"},{"schema":"auth","name":"one_time_tokens","owner":"supabase_auth_admin"},{"schema":"auth","name":"refresh_tokens","owner":"supabase_auth_admin"},{"schema":"auth","name":"saml_providers","owner":"supabase_auth_admin"},{"schema":"auth","name":"saml_relay_states","owner":"supabase_auth_admin"},{"schema":"auth","name":"schema_migrations","owner":"supabase_auth_admin"},{"schema":"auth","name":"scim_tokens","owner":"supabase_auth_admin"},{"schema":"auth","name":"scim_users","owner":"supabase_auth_admin"},{"schema":"auth","name":"sessions","owner":"supabase_auth_admin"},{"schema":"auth","name":"sso_domains","owner":"supabase_auth_admin"},{"schema":"auth","name":"sso_providers","owner":"supabase_auth_admin"},{"schema":"auth","name":"users","owner":"supabase_auth_admin"},{"schema":"auth","name":"webauthn_challenges","owner":"supabase_auth_admin"},{"schema":"auth","name":"webauthn_credentials","owner":"supabase_auth_admin"},{"schema":"public","name":"ai_coaching_events","owner":"postgres"},{"schema":"public","name":"ai_generation_params","owner":"postgres"},{"schema":"public","name":"ai_guard_logs","owner":"postgres"},{"schema":"public","name":"ai_long_term_memory","owner":"postgres"},{"schema":"public","name":"ai_meal_plans","owner":"postgres"},{"schema":"public","name":"ai_quality_metrics","owner":"postgres"},{"schema":"public","name":"ai_recommendations","owner":"postgres"},{"schema":"public","name":"ai_training_plans","owner":"postgres"},{"schema":"public","name":"ai_trust_scores","owner":"postgres"},{"schema":"public","name":"analytics_events","owner":"postgres"},{"schema":"public","name":"billing_events","owner":"postgres"},{"schema":"public","name":"entitlements","owner":"postgres"},{"schema":"public","name":"exercise_categories","owner":"postgres"},{"schema":"public","name":"exercise_definition_media","owner":"postgres"},{"schema":"public","name":"exercise_definitions","owner":"postgres"},{"schema":"public","name":"exercise_muscles","owner":"postgres"},{"schema":"public","name":"exercises","owner":"postgres"},{"schema":"public","name":"favorite_products","owner":"postgres"},{"schema":"public","name":"feature_flags","owner":"postgres"},{"schema":"public","name":"food_alias_apply_audit","owner":"postgres"},{"schema":"public","name":"food_aliases","owner":"postgres"},{"schema":"public","name":"food_diary_entries","owner":"postgres"},{"schema":"public","name":"food_import_batches","owner":"postgres"},{"schema":"public","name":"food_import_conflicts","owner":"postgres"},{"schema":"public","name":"food_import_staging","owner":"postgres"},{"schema":"public","name":"food_missing_food_drafts","owner":"postgres"},{"schema":"public","name":"food_missing_review_queue","owner":"postgres"},{"schema":"public","name":"food_search_events","owner":"postgres"},{"schema":"public","name":"food_search_review_queue","owner":"postgres"},{"schema":"public","name":"foods","owner":"postgres"},{"schema":"public","name":"goal_trajectory","owner":"postgres"},{"schema":"public","name":"habit_logs","owner":"postgres"},{"schema":"public","name":"habits","owner":"postgres"},{"schema":"public","name":"meal_entry_notes","owner":"postgres"},{"schema":"public","name":"measurement_history","owner":"postgres"},{"schema":"public","name":"measurement_photo_assets","owner":"postgres"},{"schema":"public","name":"measurement_photo_deletions","owner":"postgres"},{"schema":"public","name":"measurement_photo_history","owner":"postgres"},{"schema":"public","name":"muscles","owner":"postgres"},{"schema":"public","name":"notification_history","owner":"postgres"},{"schema":"public","name":"nutrition_programs","owner":"postgres"},{"schema":"public","name":"pose_3d_angles","owner":"postgres"},{"schema":"public","name":"pose_3d_joints","owner":"postgres"},{"schema":"public","name":"pose_3d_metrics","owner":"postgres"},{"schema":"public","name":"pose_3d_sessions","owner":"postgres"},{"schema":"public","name":"pose_angles","owner":"postgres"},{"schema":"public","name":"pose_biomechanics","owner":"postgres"},{"schema":"public","name":"pose_deviations","owner":"postgres"},{"schema":"public","name":"pose_feedback_events","owner":"postgres"},{"schema":"public","name":"pose_frames","owner":"postgres"},{"schema":"public","name":"pose_guard_flags","owner":"postgres"},{"schema":"public","name":"pose_joints","owner":"postgres"},{"schema":"public","name":"pose_load_estimates","owner":"postgres"},{"schema":"public","name":"pose_quality_scores","owner":"postgres"},{"schema":"public","name":"pose_risk_assessments","owner":"postgres"},{"schema":"public","name":"pose_sessions","owner":"postgres"},{"schema":"public","name":"pose_voice_cues","owner":"postgres"},{"schema":"public","name":"program_adaptations","owner":"postgres"},{"schema":"public","name":"program_blocks","owner":"postgres"},{"schema":"public","name":"program_days","owner":"postgres"},{"schema":"public","name":"program_explainability","owner":"postgres"},{"schema":"public","name":"program_feedback","owner":"postgres"},{"schema":"public","name":"program_generation_jobs","owner":"postgres"},{"schema":"public","name":"program_guard_events","owner":"postgres"},{"schema":"public","name":"program_phases","owner":"postgres"},{"schema":"public","name":"program_sessions","owner":"postgres"},{"schema":"public","name":"program_versions","owner":"postgres"},{"schema":"public","name":"recipe_ingredients","owner":"postgres"},{"schema":"public","name":"recipe_notes","owner":"postgres"},{"schema":"public","name":"recipes","owner":"postgres"},{"schema":"public","name":"subscriptions","owner":"postgres"},{"schema":"public","name":"training_programs","owner":"postgres"},{"schema":"public","name":"user_exercise_media","owner":"postgres"},{"schema":"public","name":"user_goals","owner":"postgres"},{"schema":"public","name":"user_measurements","owner":"postgres"},{"schema":"public","name":"user_profiles","owner":"postgres"},{"schema":"public","name":"user_state","owner":"postgres"},{"schema":"public","name":"workout_day_notes","owner":"postgres"},{"schema":"public","name":"workout_days","owner":"postgres"},{"schema":"public","name":"workout_entries","owner":"postgres"},{"schema":"public","name":"workout_entry_notes","owner":"postgres"},{"schema":"storage","name":"buckets","owner":"supabase_storage_admin"},{"schema":"storage","name":"buckets_analytics","owner":"supabase_storage_admin"},{"schema":"storage","name":"buckets_vectors","owner":"supabase_storage_admin"},{"schema":"storage","name":"migrations","owner":"supabase_storage_admin"},{"schema":"storage","name":"objects","owner":"supabase_storage_admin"},{"schema":"storage","name":"s3_multipart_uploads","owner":"supabase_storage_admin"},{"schema":"storage","name":"s3_multipart_uploads_parts","owner":"supabase_storage_admin"},{"schema":"storage","name":"vector_indexes","owner":"supabase_storage_admin"}]'::jsonb) e(schema text,name text,owner text)
 LEFT JOIN pg_namespace n ON n.nspname=e.schema LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.name
 WHERE c.oid IS NULL OR pg_get_userbyid(c.relowner) IS DISTINCT FROM e.owner)
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_SCOPE_STOPPED';END IF;
END $scope$;

-- REVIEW FRAGMENT: preserve old columns; approved nullable additions do not rewrite old data.
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';SET LOCAL datestyle='ISO,YMD';SET LOCAL extra_float_digits=3;
DO $row_after$ DECLARE r record;total bigint;digest text;BEGIN
 IF (SELECT count(*) FROM pg_temp.potok_release_rows_v1)<>116 OR EXISTS(
 SELECT schema,name FROM jsonb_to_recordset($scope$[{"schema":"auth","name":"audit_log_entries"},{"schema":"auth","name":"custom_oauth_providers"},{"schema":"auth","name":"flow_state"},{"schema":"auth","name":"identities"},{"schema":"auth","name":"instances"},{"schema":"auth","name":"mfa_amr_claims"},{"schema":"auth","name":"mfa_challenges"},{"schema":"auth","name":"mfa_factors"},{"schema":"auth","name":"mfa_recovery_code_sets"},{"schema":"auth","name":"mfa_recovery_codes"},{"schema":"auth","name":"oauth_authorizations"},{"schema":"auth","name":"oauth_client_states"},{"schema":"auth","name":"oauth_clients"},{"schema":"auth","name":"oauth_consents"},{"schema":"auth","name":"one_time_tokens"},{"schema":"auth","name":"refresh_tokens"},{"schema":"auth","name":"saml_providers"},{"schema":"auth","name":"saml_relay_states"},{"schema":"auth","name":"schema_migrations"},{"schema":"auth","name":"scim_tokens"},{"schema":"auth","name":"scim_users"},{"schema":"auth","name":"sessions"},{"schema":"auth","name":"sso_domains"},{"schema":"auth","name":"sso_providers"},{"schema":"auth","name":"users"},{"schema":"auth","name":"webauthn_challenges"},{"schema":"auth","name":"webauthn_credentials"},{"schema":"public","name":"ai_coaching_events"},{"schema":"public","name":"ai_generation_params"},{"schema":"public","name":"ai_guard_logs"},{"schema":"public","name":"ai_long_term_memory"},{"schema":"public","name":"ai_meal_plans"},{"schema":"public","name":"ai_quality_metrics"},{"schema":"public","name":"ai_recommendations"},{"schema":"public","name":"ai_training_plans"},{"schema":"public","name":"ai_trust_scores"},{"schema":"public","name":"analytics_events"},{"schema":"public","name":"billing_events"},{"schema":"public","name":"entitlements"},{"schema":"public","name":"exercise_categories"},{"schema":"public","name":"exercise_definition_media"},{"schema":"public","name":"exercise_definitions"},{"schema":"public","name":"exercise_muscles"},{"schema":"public","name":"exercises"},{"schema":"public","name":"favorite_products"},{"schema":"public","name":"feature_flags"},{"schema":"public","name":"food_alias_apply_audit"},{"schema":"public","name":"food_aliases"},{"schema":"public","name":"food_diary_entries"},{"schema":"public","name":"food_import_batches"},{"schema":"public","name":"food_import_conflicts"},{"schema":"public","name":"food_import_staging"},{"schema":"public","name":"food_missing_food_drafts"},{"schema":"public","name":"food_missing_review_queue"},{"schema":"public","name":"food_search_events"},{"schema":"public","name":"food_search_review_queue"},{"schema":"public","name":"foods"},{"schema":"public","name":"goal_trajectory"},{"schema":"public","name":"habit_logs"},{"schema":"public","name":"habits"},{"schema":"public","name":"meal_entry_notes"},{"schema":"public","name":"measurement_history"},{"schema":"public","name":"measurement_photo_assets"},{"schema":"public","name":"measurement_photo_deletions"},{"schema":"public","name":"measurement_photo_history"},{"schema":"public","name":"muscles"},{"schema":"public","name":"notification_history"},{"schema":"public","name":"nutrition_programs"},{"schema":"public","name":"pose_3d_angles"},{"schema":"public","name":"pose_3d_joints"},{"schema":"public","name":"pose_3d_metrics"},{"schema":"public","name":"pose_3d_sessions"},{"schema":"public","name":"pose_angles"},{"schema":"public","name":"pose_biomechanics"},{"schema":"public","name":"pose_deviations"},{"schema":"public","name":"pose_feedback_events"},{"schema":"public","name":"pose_frames"},{"schema":"public","name":"pose_guard_flags"},{"schema":"public","name":"pose_joints"},{"schema":"public","name":"pose_load_estimates"},{"schema":"public","name":"pose_quality_scores"},{"schema":"public","name":"pose_risk_assessments"},{"schema":"public","name":"pose_sessions"},{"schema":"public","name":"pose_voice_cues"},{"schema":"public","name":"program_adaptations"},{"schema":"public","name":"program_blocks"},{"schema":"public","name":"program_days"},{"schema":"public","name":"program_explainability"},{"schema":"public","name":"program_feedback"},{"schema":"public","name":"program_generation_jobs"},{"schema":"public","name":"program_guard_events"},{"schema":"public","name":"program_phases"},{"schema":"public","name":"program_sessions"},{"schema":"public","name":"program_versions"},{"schema":"public","name":"recipe_ingredients"},{"schema":"public","name":"recipe_notes"},{"schema":"public","name":"recipes"},{"schema":"public","name":"subscriptions"},{"schema":"public","name":"training_programs"},{"schema":"public","name":"user_exercise_media"},{"schema":"public","name":"user_goals"},{"schema":"public","name":"user_measurements"},{"schema":"public","name":"user_profiles"},{"schema":"public","name":"user_state"},{"schema":"public","name":"workout_day_notes"},{"schema":"public","name":"workout_days"},{"schema":"public","name":"workout_entries"},{"schema":"public","name":"workout_entry_notes"},{"schema":"storage","name":"buckets"},{"schema":"storage","name":"buckets_analytics"},{"schema":"storage","name":"buckets_vectors"},{"schema":"storage","name":"migrations"},{"schema":"storage","name":"objects"},{"schema":"storage","name":"s3_multipart_uploads"},{"schema":"storage","name":"s3_multipart_uploads_parts"},{"schema":"storage","name":"vector_indexes"}]$scope$::jsonb) AS x(schema text,name text)
 EXCEPT SELECT table_schema,table_name FROM pg_temp.potok_release_rows_v1)
 THEN RAISE EXCEPTION 'RELEASE_ROW_SCOPE_STOPPED';END IF;
 FOR r IN SELECT * FROM pg_temp.potok_release_rows_v1 ORDER BY table_schema,table_name LOOP
  EXECUTE format($digest$SELECT count(*),encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex') FROM (SELECT encode(sha256(convert_to(to_jsonb(row_data)::text,'UTF8')),'hex') h FROM (SELECT %s FROM %I.%I) row_data) fingerprints$digest$,r.column_sql,r.table_schema,r.table_name) INTO total,digest;
  IF total IS DISTINCT FROM r.n OR digest IS DISTINCT FROM r.h THEN RAISE EXCEPTION 'RELEASE_ROW_CONTENT_STOPPED';END IF;
 END LOOP;
 RAISE NOTICE 'TARGET_ROWS_PRESERVED_OK';
END $row_after$;

DO $sequence_after$ DECLARE r record;v bigint;b boolean;actual jsonb;BEGIN
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.seqrelid),'[]'::jsonb) FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage') INTO actual;
 IF actual IS DISTINCT FROM (SELECT * FROM pg_temp.potok_release_sequence_catalog_v1)
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_SEQUENCE_CATALOG_STOPPED';END IF;
 FOR r IN SELECT * FROM pg_temp.potok_release_sequence_v1 ORDER BY schema_name,sequence_name LOOP
 EXECUTE format('SELECT last_value,is_called FROM %I.%I',r.schema_name,r.sequence_name) INTO v,b;
 IF v IS DISTINCT FROM r.value OR b IS DISTINCT FROM r.called THEN RAISE EXCEPTION 'TARGET_REHEARSAL_SEQUENCE_VALUE_STOPPED';END IF;
 END LOOP;RAISE NOTICE 'TARGET_SEQUENCES_PRESERVED_OK';END $sequence_after$;

DO $annotation$ BEGIN
 IF EXISTS(SELECT FROM public.program_sessions WHERE execution_reason IS NOT NULL)
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_NEW_ANNOTATION_STOPPED';END IF;
END $annotation$;
DO $done$ BEGIN RAISE NOTICE 'TARGET_TWELVE_PRECOMMIT_CHECKS_OK';END $done$;
COMMIT;
