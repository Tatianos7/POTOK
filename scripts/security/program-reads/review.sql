-- Review-only program explanation projection. Separate follow-up to #206.
BEGIN;
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
ROLLBACK;
