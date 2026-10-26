import assert from 'node:assert/strict';
import {PA,PB} from '../program-reads/fixture.mjs';
export const tables=['program_versions','program_adaptations','program_explainability','program_guard_events'];
export function seedSQL(){
 let sql='';
 for(const [id,tag] of [[PA,'a'],[PB,'b']])sql+=`
 INSERT INTO public.program_versions(id,program_id,program_type,version,snapshot,reason) VALUES('${id}','${id}','nutrition',1,'{"synthetic":"history ${tag}"}','synthetic-initial');
 INSERT INTO public.program_adaptations(id,program_id,program_type,from_version,to_version,trigger,summary) VALUES('${id}','${id}','nutrition',1,2,'synthetic-existing','{"synthetic":"history ${tag}"}');
 INSERT INTO public.program_guard_events(id,program_id,program_type,risk_level,flags,blocked_actions) VALUES('${id}','${id}','nutrition','caution',ARRAY['synthetic_${tag}'],ARRAY[]::text[]);`;
 // Deliberately unsafe legacy grant fixture, not a hosted ACL snapshot.
 sql+=`GRANT UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON ${tables.map(t=>'public.'+t).join(',')} TO PUBLIC,anon,authenticated,service_role;
 GRANT UPDATE(version),REFERENCES(id) ON public.program_versions TO PUBLIC,anon,authenticated;`;
 return sql;
}
export function finalSQL(){return `DO $history_final$
BEGIN
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) role_name,
 unnest(ARRAY[${tables.map(t=>"'"+t+"'").join(',')}]) table_name,
 unnest(ARRAY['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege
 WHERE has_table_privilege(role_name,'public.'||table_name,privilege))
 OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,
 unnest(ARRAY['anon','authenticated']) role_name,unnest(ARRAY['UPDATE','REFERENCES']) privilege
 WHERE c.oid IN(${tables.map(t=>"'public."+t+"'::regclass").join(',')}) AND a.attnum>0 AND NOT a.attisdropped
 AND has_column_privilege(role_name,c.oid,a.attnum,privilege))
 THEN RAISE EXCEPTION 'History final effective mutation boundary failed';END IF;
END $history_final$;`;}
export function insertPayload(table,id){
 assert(tables.includes(table));assert([PA,PB].includes(id));
 const base={program_id:id,program_type:'nutrition'};
 if(table==='program_versions')return{...base,version:3,snapshot:{synthetic:'new history'},reason:'synthetic-new'};
 if(table==='program_adaptations')return{...base,from_version:2,to_version:3,trigger:'synthetic-new',summary:{synthetic:'new history'}};
 if(table==='program_guard_events')return{...base,risk_level:'caution',flags:['synthetic_new'],blocked_actions:[]};
 return{...base,version:3,decision_ref:'synthetic:new',guard_notes:{reason_code:'synthetic_reason'}};
}
