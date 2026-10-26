-- SELECT-only metadata diagnostics. No user rows or user-defined function calls.
-- Not an installer, behavioral acceptance, authority issuance or release approval.
-- All body fingerprints below are derived from tracked public source files.
WITH expected(signature,source_hash,client_execute) AS (VALUES
 ('public.has_verified_entitlement_v1(text)','a5b600b1f2306b6bb95015c0aeee77a3',true),
 ('public.has_verified_entitlement_v2(text)','0228404d5b3f9b8e00d36ea12a00922a',true),
 ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d',false)
), readers AS (
 SELECT e.signature,p.oid IS NOT NULL AND p.proowner='postgres'::regrole AND p.prosecdef
  AND p.prorettype='boolean'::regtype AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
  AND md5(p.prosrc)=e.source_hash
  AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
  AND has_function_privilege('authenticated',p.oid,'EXECUTE')=e.client_execute
  AND NOT has_function_privilege('service_role',p.oid,'EXECUTE') AS reviewed
 FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
), writers(signature,graph_hash,clock_hash) AS (VALUES
 ('potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text)','13144fe9c00e070d9f4fdacb893f82a1','8958660d38d8661f0fa977f199df6ba3'),
 ('potok_control.revoke_entitlement_v2(uuid,text,text,text)','d7b7ae496da1518dd7219c9cb5753430','548ffb949641f3ed59d531ac8656326e')
), writer_state AS (
 SELECT w.signature,CASE WHEN p.oid IS NULL THEN 'absent'
  WHEN md5(p.prosrc)=w.graph_hash THEN 'graph-v2-account-gate'
  WHEN md5(p.prosrc)=w.clock_hash THEN 'v2.2-statement-clock-without-account-gate'
  ELSE 'other-source-review-required' END AS version,
  coalesce(p.proowner='postgres'::regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
   AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
   AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
   AND NOT has_function_privilege('service_role',p.oid,'EXECUTE'),false) AS owner_only
 FROM writers w LEFT JOIN pg_proc p ON p.oid=to_regprocedure(w.signature)
), store AS (
 SELECT c.oid,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relnamespace FROM pg_class c
 WHERE c.oid=to_regclass('potok_control.access_attestations') AND c.relkind='r'
)
SELECT jsonb_build_object(
 'scope','metadata diagnostics only; behavioral, provenance, retention and release gates remain',
 'owner_session',current_user='postgres' AND session_user='postgres',
 'postgres_17',current_setting('server_version_num')::int BETWEEN 170000 AND 179999,
 'profile_key',CASE WHEN EXISTS(SELECT FROM pg_attribute WHERE attrelid=to_regclass('public.user_profiles') AND attname='id_user' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped)
  THEN 'id_user' WHEN EXISTS(SELECT FROM pg_attribute WHERE attrelid=to_regclass('public.user_profiles') AND attname='user_id' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped)
  THEN 'user_id' ELSE 'unreviewed' END,
 'profile_column_count',(SELECT count(*) FROM pg_attribute WHERE attrelid=to_regclass('public.user_profiles') AND attnum>0 AND NOT attisdropped),
 'authority_store_present',EXISTS(SELECT FROM store),
 'authority_store_forced_rls',coalesce((SELECT relowner='postgres'::regrole AND relrowsecurity AND relforcerowsecurity FROM store),false),
 'private_store_denies_api_roles',coalesce((SELECT NOT EXISTS(SELECT FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND
  (has_schema_privilege(r.oid,s.relnamespace,'USAGE,CREATE') OR has_table_privilege(r.oid,s.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'))) FROM store s),false),
 'readers',(SELECT jsonb_agg(to_jsonb(r) ORDER BY signature) FROM readers r),
 'writers',(SELECT jsonb_agg(to_jsonb(w) ORDER BY signature) FROM writer_state w),
 'extension_core_owner_authorized',coalesce((SELECT pg_has_role(e.extowner,'USAGE') OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) FROM pg_extension e WHERE extname='pg_trgm'),false),
 'supautils_privileged_extension_hint',coalesce('pg_trgm'=ANY(regexp_split_to_array(current_setting('supautils.privileged_extensions',true),'[[:space:]]*,[[:space:]]*')),false)
  AND CASE WHEN to_regrole(current_setting('supautils.privileged_role',true)) IS NULL THEN false
      ELSE pg_has_role(to_regrole(current_setting('supautils.privileged_role',true)),'USAGE') END,
 'extension_set_schema_evidence','not executed; metadata does not prove managed-platform DDL authorization',
 'legacy_target_count',(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('apply_admin_approved_food_alias','apply_owner_approved_missing_food_draft','get_entitlements','get_paywall_state','start_purchase','restore_purchase','recompute_food_entries_for_food_ids','rls_auto_enable'))
) AS readiness;
