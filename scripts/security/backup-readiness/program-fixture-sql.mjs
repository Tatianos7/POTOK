// Explicit synthetic program fixtures and role checks in one rollback-only transaction.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
export function validateProgramManifest(m){
 assert.equal(m.protocol,'potok-program-fixture-v1');assert.match(m.tag,/^[a-f0-9]{24}$/);assert.equal(m.day,'2199-01-15');assert.equal(m.users.length,2);assert.equal(new Set(m.users).size,2);for(const id of m.users)assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
 assert.equal(m.programs.length,4);assert.equal(new Set(m.programs.map(p=>p.id)).size,4);const keys=new Set();for(const p of m.programs){assert.match(p.id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert(!m.users.includes(p.id));assert([0,1].includes(p.owner));assert(['nutrition','training'].includes(p.type));keys.add(p.owner+':'+p.type);}assert.equal(keys.size,4);
}
export function makeProgramManifest(users){const m={protocol:'potok-program-fixture-v1',tag:randomBytes(12).toString('hex'),day:'2199-01-15',users,programs:[]};for(const owner of [0,1])for(const type of ['nutrition','training'])m.programs.push({id:randomUUID(),owner,type});validateProgramManifest(m);return m;}
export function programFixtureSQL(m){
 validateProgramManifest(m);const lit=s=>"'"+s.replaceAll("'","''")+"'",ids=m.programs.map(p=>lit(p.id)).join(','),payload=p=>JSON.stringify({synthetic_tag:m.tag,program_type:p.type});
 const forbid=statement=>`BEGIN ${statement};RAISE EXCEPTION 'Forbidden write unexpectedly accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;`;
 const noRows=statement=>`${statement};GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>0 THEN RAISE EXCEPTION 'Foreign mutation';END IF;`;
 const claims=id=>`SELECT set_config('request.jwt.claim.sub',${lit(id)},true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claims',${lit(JSON.stringify({sub:id,role:'authenticated'}))},true);`;
 const seed=m.programs.map(p=>{const id=lit(p.id),user=lit(m.users[p.owner]),type=lit(p.type),json=lit(payload(p));return `INSERT INTO public.${p.type}_programs(id,user_id,status,program_version) VALUES(${id},${user},'active',1);
INSERT INTO public.program_phases(id,program_id,program_type,name) VALUES(${id},${id},${type},${lit('POTOK synthetic '+m.tag)});
INSERT INTO public.program_blocks(id,phase_id,block_type) VALUES(${id},${id},'synthetic');
INSERT INTO public.program_days(id,block_id,date,targets,session_plan) VALUES(${id},${id},${lit(m.day)},'{"calories":17}',${json}::jsonb);
INSERT INTO public.program_sessions(id,program_id,date,day_date,session_type,plan_payload,status) VALUES(${id},${id},${lit(m.day)},${lit(m.day)},${lit(p.type==='nutrition'?'meal_plan':'workout_plan')},${json}::jsonb,'planned');
INSERT INTO public.program_explainability(id,program_id,program_type,version,decision_ref,knowledge_refs,confidence,guard_notes) VALUES(${id},${id},${type},1,${lit('synthetic:'+m.tag)},'{"private":"synthetic"}',0.75,'{"reason_code":"synthetic","details":"private"}');`;}).join('\n');
 const checks=m.programs.map(p=>{const id=lit(p.id),own=lit(m.users[p.owner]),type=lit(p.type);return `SET LOCAL ROLE authenticated;
${claims(m.users[p.owner])}
DO $own$ DECLARE changed bigint;action text;r record;BEGIN
 IF current_user<>'authenticated' OR (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) OR auth.uid() IS DISTINCT FROM ${own}::uuid THEN RAISE EXCEPTION 'Wrong ordinary actor';END IF;
 IF (SELECT count(*) FROM public.${p.type}_programs WHERE id=${id})<>1 OR (SELECT count(*) FROM public.program_sessions WHERE id=${id})<>1 OR (SELECT count(*) FROM public.get_program_days(${id}))<>1 THEN RAISE EXCEPTION 'Own program read failed';END IF;
 IF public.get_program_day_details(${id},${lit(m.day)})->'day'->>'id' IS DISTINCT FROM ${id} THEN RAISE EXCEPTION 'Own day details failed';END IF;
 SELECT * INTO r FROM public.get_program_explainability(${id},NULL);
 IF NOT FOUND OR r.knowledge_refs IS NOT NULL OR r.confidence IS NOT NULL OR r.guard_notes IS DISTINCT FROM '{"reason_code":"synthetic"}'::jsonb THEN RAISE EXCEPTION 'Free projection not masked';END IF;
 FOREACH action IN ARRAY ARRAY['planned','completed','skipped'] LOOP
 UPDATE public.program_sessions SET status=action,execution_reason=CASE WHEN action='skipped' THEN 'fatigue' ELSE NULL END WHERE id=${id} AND program_id=${id};GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 OR (SELECT plan_payload FROM public.program_sessions WHERE id=${id}) IS DISTINCT FROM ${lit(payload(p))}::jsonb OR (SELECT day_date FROM public.program_sessions WHERE id=${id}) IS DISTINCT FROM ${lit(m.day)}::date THEN RAISE EXCEPTION 'Bounded annotation failed';END IF;
 END LOOP;
 UPDATE public.${p.type}_programs SET status='paused' WHERE id=${id};GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>1 THEN RAISE EXCEPTION 'Own pause failed';END IF;
 UPDATE public.${p.type}_programs SET status='active' WHERE id=${id};
 ${forbid(`UPDATE public.program_sessions SET plan_payload='{"forged":true}' WHERE id=${id}`)}
 ${forbid(`UPDATE public.program_sessions SET day_date='2199-02-01' WHERE id=${id}`)}
 ${forbid(`UPDATE public.${p.type}_programs SET program_version=99 WHERE id=${id}`)}
 ${forbid(`DELETE FROM public.${p.type}_programs WHERE id=${id}`)}
 ${forbid(`INSERT INTO public.${p.type}_programs(id,user_id) VALUES(${id},${own})`)}
 ${forbid(`INSERT INTO public.program_generation_jobs(id,user_id,program_type) VALUES(${id},${own},${type})`)}
 BEGIN UPDATE public.program_sessions SET execution_reason='forged' WHERE id=${id};RAISE EXCEPTION 'Invalid reason accepted';EXCEPTION WHEN check_violation THEN NULL;END;
END $own$;
${claims(m.users[1-p.owner])}
DO $foreign$ DECLARE changed bigint;BEGIN
 IF (SELECT count(*) FROM public.${p.type}_programs WHERE id=${id})<>0 OR (SELECT count(*) FROM public.program_sessions WHERE id=${id})<>0 OR (SELECT count(*) FROM public.get_program_days(${id}))<>0 OR (SELECT count(*) FROM public.get_program_explainability(${id},NULL))<>0 THEN RAISE EXCEPTION 'Foreign program disclosed';END IF;
 IF (public.get_program_day_details(${id},${lit(m.day)})->'day') IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Foreign details disclosed';END IF;
 ${noRows(`UPDATE public.program_sessions SET status='completed' WHERE id=${id}`)}
 ${noRows(`UPDATE public.${p.type}_programs SET status='paused' WHERE id=${id}`)}
END $foreign$;
RESET ROLE;`;}).join('\n');
 return `BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL timezone='UTC';SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';
DO $guard$ DECLARE name text;n bigint;BEGIN
 IF current_database()<>'postgres' OR inet_server_addr() IS NOT NULL OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'Local superuser socket required';END IF;
 IF (SELECT count(*) FROM auth.users WHERE id IN(${m.users.map(lit).join(',')}))<>2 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.program_sessions'::regclass AND attname='day_date' AND atttypid='date'::regtype AND attgenerated='' AND NOT attisdropped) OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.program_sessions'::regclass AND attname='execution_reason' AND NOT attisdropped) THEN RAISE EXCEPTION 'Expected existing identities and ready session shape';END IF;
 FOREACH name IN ARRAY ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_explainability','program_generation_jobs','program_versions','program_adaptations','program_guard_events','program_feedback'] LOOP
 IF EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.'||name) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'Program RLS required';END IF;
 EXECUTE format('SELECT count(*) FROM public.%I WHERE id=ANY($1)',name) INTO STRICT n USING ARRAY[${ids}]::uuid[];
 IF n<>0 THEN RAISE EXCEPTION 'Fixture id collision';END IF;
 END LOOP;
END $guard$;
CREATE TEMP TABLE potok_program_fact_baseline ON COMMIT DROP AS SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY id),'[]'::jsonb) AS rows FROM public.food_diary_entries d;
${seed}
${checks}
DO $facts$ BEGIN IF (SELECT rows FROM potok_program_fact_baseline) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY id),'[]'::jsonb) FROM public.food_diary_entries d) THEN RAISE EXCEPTION 'PLAN must not become FACT';END IF;RAISE NOTICE 'PROGRAM_FIXTURE_SQL_CHECKS_OK: four programs/two users; rollback follows';END $facts$;
ROLLBACK;`;
}
