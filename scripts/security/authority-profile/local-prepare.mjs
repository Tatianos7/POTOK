import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {catalogFixture,A,B} from './fixture.mjs';
import {target,build} from './build.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const root=process.env.POTOK_PHOTO_AUTH_DIR;assert(root&&path.isAbsolute(root)&&path.basename(root)==='potok-photo-http-acceptance');
assert((await readFile(path.join(root,'supabase/config.toml'),'utf8')).includes('project_id = "potok-photo-http-acceptance"'));
const [mode,a,b]=process.argv.slice(2);assert(['fixture','grant','revoke','verify'].includes(mode));
for(const id of [a,b])assert.match(id??'',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);assert.notEqual(a,b);
const container='supabase_db_potok-photo-http-acceptance';
const inspection=spawnSync('docker',['inspect','--format','{{.State.Running}} {{.State.Health.Status}} {{.Config.Image}}',container],{encoding:'utf8',timeout:10000});assert.equal(inspection.status,0);assert.match(inspection.stdout,/^true healthy .*supabase\/postgres:17\./);
let sql=`DO $$ BEGIN IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR (SELECT count(*) FROM auth.users)<>4
 OR NOT EXISTS(SELECT FROM auth.users WHERE id='${a}' AND email='authority-profile-a@example.test')
 OR NOT EXISTS(SELECT FROM auth.users WHERE id='${b}' AND email='authority-profile-b@example.test')
 THEN RAISE EXCEPTION 'Expected fixed synthetic local project';END IF;END $$;`;
if(mode==='fixture'){
 sql+=`DO $$ BEGIN IF to_regclass('public.user_profiles') IS NOT NULL OR to_regnamespace('potok_control') IS NOT NULL OR to_regnamespace('potok_nutrition') IS NOT NULL THEN RAISE EXCEPTION 'Expected fresh authority/profile fixture';END IF;END $$;`;
 sql+=(await catalogFixture()).replaceAll(A,a).replaceAll(B,b);
 const r=await fetch('https://raw.githubusercontent.com/Tatianos7/POTOK/7f4f7e24fec497a22dea29dd14f4546115439129/supabase/migration_drafts/profile_column_write_containment_v1.sql',{redirect:'error',signal:AbortSignal.timeout(30000)});assert(r.ok);const profile=await r.text();assert.equal(createHash('sha256').update(profile).digest('hex'),'b781e7754732d12359cfff990ca855f75115695c283b08f9f221f785f5d529ea');sql+=profile;
 const draft=await readFile(target,'utf8');assert.equal(draft,await build());sql+=draft.replace(/^ROLLBACK;$/m,'COMMIT;');
 const catalog=await readFile('supabase/migration_drafts/catalog_authority_history_review_v1.sql','utf8');assert.equal((catalog.match(/^ROLLBACK;$/gm)??[]).length,1);sql+=catalog.replace(/^ROLLBACK;$/m,'COMMIT;');
}else if(mode==='grant')sql+=`SELECT potok_control.grant_entitlement_v2('${b}','admin',now()+interval '1 day','synthetic-api-evidence','synthetic-api-test');`;
else if(mode==='revoke')sql+=`SELECT potok_control.revoke_entitlement_v2('${b}','admin','synthetic-api-revoke','synthetic-api-test');`;
else sql+=`DO $$ BEGIN IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass AND attnum>0 AND NOT attisdropped)<>17
 OR (SELECT count(*) FROM potok_control.access_attestations)<>2
 OR NOT EXISTS(SELECT FROM public.user_profiles WHERE id_user='${a}' AND is_admin AND has_premium AND first_name='Saved API' AND coach_settings->>'mode'='off')
 OR NOT EXISTS(SELECT FROM public.user_profiles WHERE id_user='${b}' AND NOT is_admin AND NOT has_premium)
 THEN RAISE EXCEPTION 'Authority/profile final state drift';END IF;END $$;`;
sql+="NOTIFY pgrst,'reload schema';";
const r=spawnSync('docker',['exec','-i',container,'psql','-X','-h','/run/postgresql','-U','postgres','-d','postgres','--set','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:120000});if(r.status!==0)console.error('Disposable authority/profile SQL failed:',r.stderr);assert.equal(r.status,0,'Authority/profile '+mode);console.log('AUTHORITY_PROFILE_LOCAL_'+mode.toUpperCase()+'_OK');
