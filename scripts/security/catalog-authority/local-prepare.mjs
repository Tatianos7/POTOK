import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {legacySchema,verifiedReaders,A,B,FOOD,GRANT} from './fixture.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const root=process.env.POTOK_PHOTO_AUTH_DIR;assert(root&&path.isAbsolute(root)&&path.basename(root)==='potok-photo-http-acceptance');
assert((await readFile(path.join(root,'supabase/config.toml'),'utf8')).includes('project_id = "potok-photo-http-acceptance"'));
const [mode,a,b]=process.argv.slice(2);assert(['fixture','candidate','revoke','verify'].includes(mode));
for(const id of [a,b])assert.match(id??'',/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);assert.notEqual(a,b);
const container='supabase_db_potok-photo-http-acceptance';
const inspect=spawnSync('docker',['inspect','--format','{{.State.Running}} {{.State.Health.Status}} {{.Config.Image}}',container],{encoding:'utf8',timeout:10000});assert.equal(inspect.status,0);assert.match(inspect.stdout,/^true healthy .*supabase\/postgres:17\./);
let sql=`DO $$ BEGIN IF current_user<>'postgres' OR current_database()<>'postgres'
 OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR (SELECT count(*) FROM auth.users)<>4
 OR NOT EXISTS(SELECT FROM auth.users WHERE id='${a}' AND email='catalog-a@example.test')
 OR NOT EXISTS(SELECT FROM auth.users WHERE id='${b}' AND email='catalog-b@example.test')
 THEN RAISE EXCEPTION 'Expected fixed synthetic local project';END IF;END $$;`;
if(mode==='fixture'){
 sql+=`DO $$ BEGIN IF to_regclass('public.foods') IS NOT NULL OR to_regclass('public.user_profiles') IS NOT NULL
 OR to_regnamespace('potok_control') IS NOT NULL THEN RAISE EXCEPTION 'Expected fresh catalog fixture';END IF;END $$;
 CREATE SCHEMA potok_control AUTHORIZATION postgres;`;
 sql+=(await legacySchema()).replaceAll(A,a).replaceAll(B,b);
 sql+=(await verifiedReaders()).replaceAll(A,a).replaceAll(B,b);
}else if(mode==='candidate'){
 sql+=`DO $$ BEGIN IF NOT EXISTS(SELECT FROM public.foods WHERE name='forged-core')
   OR NOT EXISTS(SELECT FROM public.food_aliases WHERE alias='Fixture alias')
   OR (SELECT fiber FROM public.food_diary_entries WHERE user_id='${a}') IS NULL
   THEN RAISE EXCEPTION 'Legacy HTTP reproductions missing';END IF;END $$;
 DELETE FROM public.food_alias_apply_audit;
 UPDATE public.food_search_review_queue SET applied_alias_id=NULL,alias_applied_by=NULL,alias_applied_at=NULL,alias_apply_result=NULL,alias_apply_error=NULL;
 DELETE FROM public.food_aliases;DELETE FROM public.foods WHERE name='forged-core';
 UPDATE public.food_diary_entries SET calories=17,protein=1,fat=2,carbs=3,fiber=NULL WHERE user_id='${a}';
 UPDATE public.food_diary_entries SET calories=29,protein=4,fat=5,carbs=6,fiber=7 WHERE user_id='${b}';`;
 const draft=await readFile('supabase/migration_drafts/catalog_authority_history_review_v1.sql','utf8');assert.equal((draft.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((draft.match(/^ROLLBACK;$/gm)??[]).length,1);assert.doesNotMatch(draft,/^COMMIT;$/m);
 sql+=draft.replace(/^ROLLBACK;$/m,'COMMIT;');
}else if(mode==='revoke')sql+=`INSERT INTO potok_control.access_attestations VALUES(gen_random_uuid(),'${b}','admin','REVOKE','${GRANT}',2,now(),NULL);`;
else sql+=`DO $$ BEGIN IF (SELECT count(*) FROM public.foods WHERE source='core')<>2
 OR (SELECT count(*) FROM public.food_aliases WHERE source='core')<>1
 OR (SELECT fiber FROM public.food_diary_entries WHERE user_id='${a}') IS NOT NULL
 OR (SELECT calories FROM public.food_diary_entries WHERE user_id='${a}')<>17
 OR (SELECT calories FROM public.food_diary_entries WHERE user_id='${b}')<>29
 OR (SELECT canonical_food_id FROM public.favorite_products WHERE id=1)<>'${FOOD}'
 OR (SELECT food_id FROM public.recipe_ingredients WHERE id=1)<>'${FOOD}'
 THEN RAISE EXCEPTION 'Catalog final state mismatch';END IF;END $$;`;
sql+="NOTIFY pgrst,'reload schema';";
const r=spawnSync('docker',['exec','-i',container,'psql','-X','-h','/run/postgresql','-U','postgres','-d','postgres','--set','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:120000});if(r.status!==0)console.error('Disposable catalog SQL failed:',r.stderr);assert.equal(r.status,0,'Catalog fixture '+mode);console.log('CATALOG_LOCAL_'+mode.toUpperCase()+'_OK');
