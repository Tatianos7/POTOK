import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const PA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',PB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export async function seedSQL(a,b){
 for(const id of [a,b])assert.match(id,/^[0-9a-f-]{36}$/);
 let sql="CREATE TABLE public.user_goals(user_id uuid PRIMARY KEY);";
 for(const p of ['phase7_2_programs.sql','phase7_2_2_adaptation.sql','phase7_2_3_delivery.sql'])sql+=await readFile('supabase/'+p,'utf8');
 sql+=`GRANT SELECT,INSERT,UPDATE,DELETE ON public.nutrition_programs,public.training_programs,public.program_phases,public.program_blocks,public.program_days,public.program_versions,public.program_explainability,public.program_guard_events,public.program_generation_jobs,public.program_adaptations,public.program_sessions,public.program_feedback TO authenticated,service_role;`;
 for(const [id,user,suffix] of [[PA,a,'a'],[PB,b,'b']])sql+=`
 INSERT INTO public.nutrition_programs(id,user_id,status) VALUES('${id}','${user}','active');
 INSERT INTO public.program_phases(id,program_id,program_type,name) VALUES('${id}','${id}','nutrition','synthetic phase ${suffix}');
 INSERT INTO public.program_blocks(id,phase_id,block_type) VALUES('${id}','${id}','synthetic');
 INSERT INTO public.program_days(id,block_id,date,targets,session_plan) VALUES('${id}','${id}','2026-10-26','{"calories":123}','{"plan":"synthetic ${suffix}"}');
 INSERT INTO public.program_sessions(id,program_id,date,session_type) VALUES('${id}','${id}','2026-10-26','meal_plan');
 INSERT INTO public.program_explainability(id,program_id,program_type,version,decision_ref,knowledge_refs,confidence,guard_notes)
 VALUES('${id}','${id}','nutrition',1,'synthetic:decision:${suffix}','{"evidence":"synthetic full ${suffix}"}',0.75,'{"reason_code":"synthetic_reason","details":"synthetic full ${suffix}","nested":{"private":"synthetic ${suffix}"}}');`;
 return sql;
}
export async function finalSQL(){
 const s=await readFile('scripts/security/program-reads/review.sql','utf8');
 const specs=[];
 for(const [name,args,tag] of [['program_scope_v1','uuid','scope'],['read_program_explainability_v1','uuid,integer','read']]){
  const match=s.match(new RegExp('AS \\$'+tag+'\\$([\\s\\S]*?)\\$'+tag+'\\$'));assert(match);
  specs.push([`potok_delivery.${name}(${args})`,createHash('md5').update(match[1]).digest('hex'),true]);
 }
 for(const [name,args] of [['get_program_explainability','uuid,integer'],['get_program_days','uuid'],['get_program_day_details','uuid,date']]){
  const match=s.match(new RegExp('create or replace function public\\.'+name+'\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;'));assert(match);
  specs.push([`public.${name}(${args})`,createHash('md5').update(match[1]).digest('hex'),false]);
 }
 return `DO $final$ DECLARE r record;p pg_proc;BEGIN
 FOR r IN SELECT * FROM (VALUES ${specs.map(([sig,hash,def])=>`('${sig}','${hash}',${def})`).join(',')}) v(sig,hash,definer) LOOP
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(r.sig);
 IF NOT FOUND OR md5(p.prosrc)<>r.hash OR p.prosecdef<>r.definer OR pg_get_userbyid(p.proowner)<>'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
 OR NOT has_function_privilege('authenticated',r.sig,'EXECUTE')
 OR has_function_privilege('anon',r.sig,'EXECUTE') OR has_function_privilege('service_role',r.sig,'EXECUTE')
 THEN RAISE EXCEPTION 'Program read final source contract mismatch';END IF;END LOOP;
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) role_name,unnest(ARRAY['knowledge_refs','confidence','guard_notes']) col WHERE has_column_privilege(role_name,'public.program_explainability',col,'SELECT'))
 OR NOT has_schema_privilege('authenticated','potok_delivery','USAGE') OR has_schema_privilege('authenticated','potok_delivery','CREATE')
 OR has_schema_privilege('anon','potok_delivery','USAGE,CREATE') OR has_schema_privilege('service_role','potok_delivery','USAGE,CREATE')
 THEN RAISE EXCEPTION 'Program read final permissions mismatch';END IF;END $final$;`;
}
