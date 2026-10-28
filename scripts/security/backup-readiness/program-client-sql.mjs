// Lifecycle for exact synthetic fixtures only. No schema/grant/authority changes.
import assert from 'node:assert/strict';
import {validateProgramManifest,programFixtureSQL} from './program-fixture-sql.mjs';
const literal=s=>"'"+s.replaceAll("'","''")+"'";
export function fixtureTables(m){validateProgramManifest(m);return ['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_explainability'].map(name=>({name,ids:m.programs.filter(p=>!name.endsWith('_programs')||name===p.type+'_programs').map(p=>p.id)}));}
export function fixtureObservationSQL(m){return 'SELECT jsonb_build_object('+fixtureTables(m).map(t=>literal(t.name)+",(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public."+t.name+' t WHERE id IN('+t.ids.map(literal).join(',')+'))').join(',')+')';}
export function seedProgramSQL(m){
 const sql=programFixtureSQL(m),start=sql.indexOf('CREATE TEMP TABLE potok_program_fact_baseline'),end=sql.indexOf('SET LOCAL ROLE authenticated;');assert(start>0&&end>start);
 const inserts=sql.slice(sql.indexOf('\nINSERT INTO public.',start)+1,end);assert.equal((inserts.match(/^INSERT INTO public\./gm)||[]).length,24);
 return sql.slice(0,start)+inserts+'\nCOMMIT;';
}
export function validateFixtureObservation(m,rows){
 const tables=fixtureTables(m);assert.deepEqual(Object.keys(rows).sort(),tables.map(t=>t.name).sort());
 for(const t of tables){assert.equal(rows[t.name].length,t.ids.length);assert.deepEqual(rows[t.name].map(r=>r.id).sort(),[...t.ids].sort());}
 for(const p of m.programs){const find=t=>rows[t].find(r=>r.id===p.id),parent=find(p.type+'_programs');assert.equal(parent.user_id,m.users[p.owner]);assert.equal(parent.status,'active');assert.equal(parent.program_version,1);assert.equal(find('program_phases').program_id,p.id);assert.equal(find('program_phases').program_type,p.type);assert.equal(find('program_phases').name,'POTOK synthetic '+m.tag);assert.equal(find('program_blocks').phase_id,p.id);assert.equal(find('program_days').block_id,p.id);assert.equal(find('program_days').date,m.day);const s=find('program_sessions');assert.equal(s.program_id,p.id);assert.equal(s.date,m.day);assert.equal(s.day_date,m.day);assert.equal(s.status,'planned');assert.deepEqual(s.plan_payload,{synthetic_tag:m.tag,program_type:p.type});assert.equal(find('program_explainability').decision_ref,'synthetic:'+m.tag);}
}
export function cleanupProgramSQL(m,seeded){
 validateFixtureObservation(m,seeded);const tables=fixtureTables(m),canonical=rows=>Object.fromEntries(Object.entries(rows).map(([name,list])=>[name,list.map(row=>{const r={...row};if(name==='program_sessions')for(const k of ['status','execution_reason','updated_at'])delete r[k];return r;})]));
 const expected=literal(JSON.stringify(canonical(seeded))),observation=fixtureObservationSQL(m);
 return `BEGIN;SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';
DO $guard$ DECLARE actual jsonb;BEGIN
IF current_database()<>'postgres' OR inet_server_addr() IS NOT NULL OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'Local superuser socket required';END IF;
${observation} INTO actual;
actual:=jsonb_set(actual,'{program_sessions}',(SELECT jsonb_agg(v-'status'-'execution_reason'-'updated_at' ORDER BY v->>'id') FROM jsonb_array_elements(actual->'program_sessions') v));
IF actual IS DISTINCT FROM ${expected}::jsonb THEN RAISE EXCEPTION 'Fixture identity/content changed; cleanup stopped';END IF;
END $guard$;
${['program_explainability','program_sessions','program_days','program_blocks','program_phases','nutrition_programs','training_programs'].map(name=>{const t=tables.find(t=>t.name===name);return 'DELETE FROM public.'+name+' WHERE id IN('+t.ids.map(literal).join(',')+');';}).join('\n')}
COMMIT;`;
}
