import assert from 'node:assert/strict';
export function permissionQuery(authority=true){return `SELECT
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
 (SELECT extnamespace='extensions'::regnamespace FROM pg_extension WHERE extname='pg_trgm') AS trgm${authority?`,
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
 WHERE p.oid IS NULL OR md5(p.prosrc)<>e.hash OR p.proowner<>'postgres'::regrole OR p.prosecdef<>e.definer OR p.prorettype<>e.result::regtype OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]) AS authority_source_contract`:""}`;}
export function assertPermissions(row){assert(Object.values(row).every(x=>x===true),'Accumulated effective permissions failed: '+JSON.stringify(row));}
