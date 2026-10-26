export const core=['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs'];
export const tables=[...core,'program_versions','program_adaptations'];
export function finalSQL(){return `DO $final$ BEGIN
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),
 unnest(ARRAY[${tables.map(t=>`'${t}'`).join(',')}]) t(name)
 WHERE has_table_privilege(r.role_name,'public.'||t.name,'INSERT'))
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),
 unnest(ARRAY[${core.map(t=>`'${t}'`).join(',')}]) t(name)
 WHERE has_table_privilege(r.role_name,'public.'||t.name,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,unnest(ARRAY['anon','authenticated']) r(role_name)
 WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY[${tables.map(t=>`'${t}'`).join(',')}]) AND a.attnum>0 AND NOT a.attisdropped
 AND (has_column_privilege(r.role_name,c.oid,a.attnum,'INSERT') OR
 (c.relname=ANY(ARRAY[${core.map(t=>`'${t}'`).join(',')}]) AND (has_column_privilege(r.role_name,c.oid,a.attnum,'REFERENCES') OR
 (has_column_privilege(r.role_name,c.oid,a.attnum,'UPDATE') AND NOT(r.role_name='authenticated' AND
 ((c.relname IN('nutrition_programs','training_programs') AND a.attname='status') OR (c.relname='program_sessions' AND a.attname IN('status','execution_reason')))))))))
 OR NOT has_column_privilege('authenticated','public.nutrition_programs','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.training_programs','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.program_sessions','status','UPDATE')
 OR NOT has_column_privilege('authenticated','public.program_sessions','execution_reason','UPDATE')
 THEN RAISE EXCEPTION 'Legacy plan quarantine final permissions mismatch';END IF;
 END $final$;`;}
