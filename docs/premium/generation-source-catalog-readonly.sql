BEGIN READ ONLY;
SELECT jsonb_build_object(
'relations',COALESCE((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname) ORDER BY n.nspname,c.relname)
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE (n.nspname='potok_nutrition' OR (n.nspname='public' AND c.relname LIKE 'adaptive_nutrition%'))
 AND c.relkind IN ('r','p','v')),'[]'::jsonb),
'functions',COALESCE((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
 'owner',pg_catalog.pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'definition_md5',md5(pg_catalog.pg_get_functiondef(p.oid))) ORDER BY n.nspname,p.proname)
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='potok_nutrition' OR (n.nspname='public' AND p.proname IN ('adaptive_nutrition_request_generation_v2','adaptive_nutrition_generation_status_v2'))),'[]'::jsonb)
) AS generation_catalog;
ROLLBACK;
