import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {catalogFixture,A,B} from '../authority-profile/fixture.mjs';
import {loadInputs,combined} from '../accumulated/inputs.mjs';
import {permissionQuery} from '../accumulated/checks.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const root=process.env.POTOK_PHOTO_AUTH_DIR;assert(root&&path.isAbsolute(root)&&path.basename(root)==='potok-photo-http-acceptance');
assert((await readFile(path.join(root,'supabase/config.toml'),'utf8')).includes('project_id = "potok-photo-http-acceptance"'));
const [mode,...ids]=process.argv.slice(2);assert(['config','fixture','grant','revoke','verify-api','ui-grant','ui-revoke','premium-grant','premium-revoke','verify-app'].includes(mode));
if(mode==='config'){
 assert.equal(ids.length,0);const config=path.join(root,'supabase/config.toml');let s=await readFile(config,'utf8');
 s=s.replace(/^site_url = .*$/m,'site_url = "http://127.0.0.1:55440"').replace(/^additional_redirect_urls = .*$/m,'additional_redirect_urls = ["http://127.0.0.1:55440/auth/callback"]');
 assert(s.includes('site_url = "http://127.0.0.1:55440"'));await writeFile(config,s,{mode:0o600});console.log('EIGHT_LOCAL_CONFIG_OK');process.exit(0);
}
for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
assert.equal(ids.length,mode==='fixture'?2:['grant','revoke','ui-grant','ui-revoke','premium-grant','premium-revoke'].includes(mode)?1:0);
const container='supabase_db_potok-photo-http-acceptance';
const inspect=spawnSync('docker',['inspect','--format','{{.State.Running}} {{.State.Health.Status}} {{.Config.Image}}',container],{encoding:'utf8',timeout:10000});assert.equal(inspect.status,0);assert.match(inspect.stdout,/^true healthy .*supabase\/postgres:17\./);
const expectedUsers=mode.startsWith('ui-')||mode==='verify-app'?6:4;
let sql=`DO $$ BEGIN IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR (SELECT count(*) FROM auth.users)<>${expectedUsers}
 OR EXISTS(SELECT FROM auth.users WHERE email NOT IN('combined-a@example.test','combined-b@example.test','combined-ui-a@example.test','combined-ui-b@example.test'))
 THEN RAISE EXCEPTION 'Expected fixed synthetic Supabase fixture';END IF;END $$;`;
if(mode==='fixture'){
 const [a,b]=ids;assert.notEqual(a,b);
 sql+=`DO $$ BEGIN IF to_regclass('public.user_profiles') IS NOT NULL OR to_regnamespace('potok_control') IS NOT NULL OR to_regnamespace('potok_nutrition') IS NOT NULL
 OR NOT EXISTS(SELECT FROM auth.users WHERE id='${a}' AND email='combined-a@example.test') OR NOT EXISTS(SELECT FROM auth.users WHERE id='${b}' AND email='combined-b@example.test')
 THEN RAISE EXCEPTION 'Expected fresh combined fixture';END IF;END $$;`;
 let legacy=await catalogFixture();const broad='GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;';assert(legacy.includes(broad));legacy=legacy.replace(broad,'');
 sql+=legacy.replaceAll(A,a).replaceAll(B,b);
 sql+=await readFile('supabase/phase7_3_2_monetization.sql','utf8');
 sql+=`CREATE FUNCTION public.rls_auto_enable() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN NULL;END $$;
 DO $$ DECLARE t record;BEGIN FOR t IN SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname NOT IN('measurement_photo_assets','measurement_photo_deletions') LOOP
 EXECUTE format('GRANT ALL ON public.%I TO anon,authenticated,service_role',t.relname);END LOOP;END $$;
 GRANT ALL ON public.entitlements,public.subscriptions,public.billing_events TO PUBLIC;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon,authenticated;
 INSERT INTO public.entitlements(user_id,tier,flags) VALUES('${a}','free','{"can_adapt":false}'),('${b}','pro','{"can_adapt":true,"can_explain":true,"can_spatial":true}');
 INSERT INTO public.subscriptions(user_id,plan,status) VALUES('${a}','free','active'),('${b}','pro','active');
 INSERT INTO public.billing_events(user_id,provider,event_type,idempotency_key) VALUES('${a}','play_store','fixture','seed-a'),('${b}','play_store','fixture','seed-b');
 CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
 CREATE INDEX fixture_food_trgm ON public.foods USING gin(name public.gin_trgm_ops);
 CREATE TEMP TABLE original_rows AS SELECT jsonb_build_object('profile',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id_user) FROM public.user_profiles p),'diary',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM public.food_diary_entries d)) AS data;
 BEGIN;
 ${combined(await loadInputs())}
 DO $$ DECLARE checks jsonb;BEGIN SELECT to_jsonb(q) INTO checks FROM (${permissionQuery()}) q;
 IF EXISTS(SELECT FROM jsonb_each(checks) e WHERE e.value IS DISTINCT FROM 'true'::jsonb) OR EXISTS(SELECT FROM potok_control.access_attestations)
 OR (SELECT data FROM original_rows) IS DISTINCT FROM jsonb_build_object('profile',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id_user) FROM public.user_profiles p),'diary',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM public.food_diary_entries d))
 THEN RAISE EXCEPTION 'Combined committed installation checks failed';END IF;END $$;
 COMMIT;
 `;
}else if(['grant','revoke','ui-grant','ui-revoke','premium-grant','premium-revoke'].includes(mode)){
 const capability=mode.startsWith('premium-')?'premium':'admin';
 const email=mode.startsWith('ui-')?'combined-ui-b@example.test':'combined-b@example.test';const id=ids[0];
 sql+=`DO $$ BEGIN IF NOT EXISTS(SELECT FROM auth.users WHERE id='${id}' AND email='${email}') THEN RAISE EXCEPTION 'Wrong synthetic issuance target';END IF;END $$;`;
 sql+=mode.endsWith('grant')?`SELECT potok_control.grant_entitlement_v2('${id}','${capability}',now()+interval '1 day','synthetic-combined-evidence','synthetic-combined-test');`:`SELECT potok_control.revoke_entitlement_v2('${id}','${capability}','synthetic-combined-revoke','synthetic-combined-test');`;
}else{
 sql+=`DO $$ DECLARE checks jsonb;BEGIN SELECT to_jsonb(q) INTO checks FROM (${permissionQuery()}) q;
 IF EXISTS(SELECT FROM jsonb_each(checks) e WHERE e.value IS DISTINCT FROM 'true'::jsonb)
 OR (SELECT count(*) FROM potok_control.access_attestations)<>${mode==='verify-app'?6:4}
 OR NOT EXISTS(SELECT FROM public.user_profiles p JOIN auth.users u ON p.id_user=u.id WHERE u.email='combined-a@example.test' AND p.is_admin AND p.has_premium AND p.first_name='Saved API')
 OR EXISTS(SELECT FROM public.user_profiles p JOIN auth.users u ON p.id_user=u.id WHERE u.email IN('combined-b@example.test','combined-ui-a@example.test','combined-ui-b@example.test') AND (p.is_admin OR p.has_premium))
 OR (SELECT count(*) FROM public.food_diary_entries)<>2
 OR EXISTS(SELECT FROM public.food_diary_entries d JOIN auth.users u ON d.user_id=u.id WHERE (u.email='combined-a@example.test' AND (d.calories<>17 OR d.fiber IS NOT NULL)) OR (u.email='combined-b@example.test' AND d.calories<>29))
 OR NOT EXISTS(SELECT FROM pg_index WHERE indexrelid='public.fixture_food_trgm'::regclass AND indisvalid AND indisready)
 THEN RAISE EXCEPTION 'Combined final state mismatch';END IF;END $$;`;
}
sql+="NOTIFY pgrst,'reload schema';";
const r=spawnSync('docker',['exec','-i',container,'psql','-X','-h','/run/postgresql','-U','postgres','-d','postgres','--set','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:180000});if(r.status!==0)console.error('Disposable combined SQL error:',r.stderr);assert.equal(r.status,0,'Combined local '+mode);console.log('EIGHT_LOCAL_'+mode.toUpperCase().replaceAll('-','_')+'_OK');
