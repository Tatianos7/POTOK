import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
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
 const fixture=(await readFile(new URL('../api/fixture.sql',import.meta.url),'utf8')).split('SET ROLE postgres;')[1];
 assert(fixture?.startsWith('\nCREATE TABLE public.user_profiles('));
 const patch=await readFile(new URL('../../../../supabase/migration_drafts/profile_column_write_containment_v1.sql',import.meta.url),'utf8');
 const preflight=`DO $$ BEGIN IF to_regclass('public.user_profiles') IS NOT NULL OR EXISTS(SELECT FROM auth.users) THEN RAISE EXCEPTION 'Expected fresh disposable Supabase'; END IF; END $$;\n`;
 const r=spawnSync('docker',['exec','-i','supabase_db_potok-profile-acceptance','psql','-X','-U','postgres','-d','postgres','--set','ON_ERROR_STOP=1'],{input:preflight+fixture+patch+"\nNOTIFY pgrst, 'reload schema';\n",encoding:'utf8'});
 assert.equal(r.status,0,'Local fixture/candidate setup failed; inspect private runner logs');
 console.log('Fresh local Supabase profile fixture and exact candidate committed');
}
