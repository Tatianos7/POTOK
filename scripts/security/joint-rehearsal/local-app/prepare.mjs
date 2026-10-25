import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {SOURCES,downloadSources,transactionBody} from '../run.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Combined persistent fixture is CI-only');
const root=process.env.POTOK_LOCAL_AUTH_DIR;
assert(root && path.isAbsolute(root) && path.basename(root)==='potok-profile-acceptance');
const config=path.join(root,'supabase/config.toml');
if(process.argv[2]==='config'){
 let text=await readFile(config,'utf8');
 assert(!text.includes('[auth.email.template.magic_link]'));
 text=text.replace(/^project_id = .*$/m,'project_id = "potok-profile-acceptance"')
  .replace('site_url = "http://127.0.0.1:3000"','site_url = "http://127.0.0.1:55440"')
  .replace('additional_redirect_urls = ["https://127.0.0.1:3000"]','additional_redirect_urls = ["http://127.0.0.1:55440/auth/callback"]')
  .replace('enable_confirmations = false','enable_confirmations = true')
  .replace('email_sent = 2','email_sent = 20');
 assert(text.includes('major_version = 17'));
 text+='\n[auth.email.template.magic_link]\nsubject = "POTOK isolated acceptance"\ncontent_path = "./supabase/templates/otp.html"\n\n[auth.email.template.confirmation]\nsubject = "POTOK isolated acceptance"\ncontent_path = "./supabase/templates/otp.html"\n';
 await mkdir(path.join(root,'supabase/templates'),{recursive:true});
 await writeFile(path.join(root,'supabase/templates/otp.html'),'<p>POTOK_TEST_CODE={{ .Token }}</p>\n',{mode:0o600});
 // Static template contains only a placeholder. Kong's nginx worker must read
 // the bind-mounted file; configuration/status and actual OTPs stay private.
 await chmod(path.join(root,'supabase/templates/otp.html'),0o644);
 await writeFile(config,text,{mode:0o600});
 console.log('Isolated local Auth configuration prepared');
}else{
 assert.equal(process.argv[2],'database');
 const text=await readFile(config,'utf8');
 assert(text.includes('project_id = "potok-profile-acceptance"'));
 const fixture=await readFile(new URL('./fixture.sql',import.meta.url),'utf8');
 const sources=await downloadSources();
 const signatures=['apply_admin_approved_food_alias(uuid,text,text)','apply_owner_approved_missing_food_draft(uuid)','get_entitlements(uuid)','get_paywall_state(text,uuid)','recompute_food_entries_for_food_ids(uuid[])','restore_purchase(uuid,text,text,text)','rls_auto_enable()','start_purchase(uuid,text,text,text)'];
 const extras=`
 CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
 CREATE TABLE public.food_fixture(id integer PRIMARY KEY,name text NOT NULL);
 INSERT INTO public.food_fixture VALUES(1,'apple'),(2,'oatmeal');
 CREATE INDEX food_name_trgm_idx ON public.food_fixture USING gin(name public.gin_trgm_ops);
 ALTER TABLE public.food_fixture ENABLE ROW LEVEL SECURITY;
 CREATE POLICY catalog_read ON public.food_fixture FOR SELECT TO anon,authenticated USING(true);
 GRANT SELECT ON public.food_fixture TO anon,authenticated;
 GRANT TRUNCATE ON public.food_fixture,public.user_profiles TO PUBLIC,anon,authenticated;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon,authenticated;
 `+signatures.map(signature=>`CREATE FUNCTION public.${signature} RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT NULL::text';GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated,service_role;`).join('\n');
 const bodies=SOURCES.map(source=>transactionBody(sources[source.key],source.key==='trgm'?'ROLLBACK':'COMMIT'));
 const verifiers=['truncate','profile','rpc'].map(key=>{
  const blocks=sources[key].match(/DO \$verify\$[\s\S]*?\$verify\$;/g);assert.equal(blocks?.length,1);return blocks[0];
 });
 const preflight=`DO $$ BEGIN IF current_database()<>'postgres' OR current_user<>'postgres'
  OR to_regclass('public.user_profiles') IS NOT NULL OR EXISTS(SELECT FROM auth.users)
  THEN RAISE EXCEPTION 'Expected fresh disposable Supabase'; END IF; END $$;\n`;
 const combined='BEGIN;\n'+bodies.join('\n')+'\n'+verifiers.join('\n')+'\nCOMMIT;\n';
 assert.equal((combined.match(/^COMMIT;$/gm)||[]).length,1);
 const r=spawnSync('docker',['exec','-i','supabase_db_potok-profile-acceptance','psql','-X','-h','/run/postgresql','-p','5432','-U','postgres','-d','postgres','--set','ON_ERROR_STOP=1'],{input:preflight+fixture+extras+combined+"\nNOTIFY pgrst, 'reload schema';\n",encoding:'utf8',timeout:120000});
 if(r.status!==0)console.error('Disposable fixture SQL error:',r.stderr);
 assert.equal(r.status,0,'Combined disposable fixture setup failed');
 // Verify committed state on a new connection, before Auth/browser sessions.
 const post=`DO $$ BEGIN
 IF (SELECT extnamespace FROM pg_extension WHERE extname='pg_trgm')<>'extensions'::regnamespace
 OR has_column_privilege('authenticated','public.user_profiles','is_admin','UPDATE')
 OR has_column_privilege('authenticated','public.user_profiles','has_premium','INSERT')
 OR has_table_privilege('anon','public.user_profiles','TRUNCATE')
 OR has_table_privilege('authenticated','public.food_fixture','TRUNCATE')
 OR has_function_privilege('anon','public.get_entitlements(uuid)','EXECUTE')
 OR (SELECT count(*) FROM public.food_fixture)<>2
 OR (SELECT count(*) FROM public.user_profiles)<>0
 OR NOT (SELECT indisvalid AND indisready FROM pg_index WHERE indexrelid='public.food_name_trgm_idx'::regclass)
 THEN RAISE EXCEPTION 'Combined committed fixture state mismatch'; END IF;
 END $$;`;
 const verified=spawnSync('docker',['exec','-i','supabase_db_potok-profile-acceptance','psql','-X','-h','/run/postgresql','-p','5432','-U','postgres','-d','postgres','--set','ON_ERROR_STOP=1'],{input:post,encoding:'utf8',timeout:30000});
 assert.equal(verified.status,0,'Separate-connection committed state check failed');
 console.log('COMBINED_FIXTURE_COMMITTED: four candidates verified on a new connection');
}
