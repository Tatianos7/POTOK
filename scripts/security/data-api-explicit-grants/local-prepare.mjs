// Fixed disposable CI container only. Never accepts a hosted project or URL.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const root=process.env.POTOK_PHOTO_AUTH_DIR;
assert(root && path.isAbsolute(root) && path.basename(root)==='potok-photo-http-acceptance');
const mode=process.argv[2];
assert(['config','database','grants-only','candidate','verify'].includes(mode));
const configPath=path.join(root,'supabase/config.toml');
let config=await readFile(configPath,'utf8');
if(mode==='config') {
  assert(!config.includes('[auth.email.template.magic_link]'));
  config=config.replace(/^project_id = .*$/m,'project_id = "potok-photo-http-acceptance"')
    .replace('enable_confirmations = false','enable_confirmations = true')
    .replace('email_sent = 2','email_sent = 20');
  assert(config.includes('major_version = 17'));
  config+='\n[auth.email.template.magic_link]\nsubject = "POTOK photo acceptance"\ncontent_path = "./supabase/templates/otp.html"\n\n[auth.email.template.confirmation]\nsubject = "POTOK photo acceptance"\ncontent_path = "./supabase/templates/otp.html"\n';
  await mkdir(path.join(root,'supabase/templates'),{recursive:true});
  const template=path.join(root,'supabase/templates/otp.html');
  await writeFile(template,'<p>POTOK_TEST_CODE={{ .Token }}</p>\n',{mode:0o600});
  await chmod(template,0o644); // Static placeholder, readable by Kong's worker.
  await writeFile(configPath,config,{mode:0o600});
  console.log('PHOTO_HTTP_CONFIG_OK');
} else {
  assert(config.includes('project_id = "potok-photo-http-acceptance"'));
  const container='supabase_db_potok-photo-http-acceptance';
  const inspect=spawnSync('docker',['inspect','--format','{{.State.Running}} {{.State.Health.Status}} {{.Config.Image}}',container],{encoding:'utf8',timeout:10000});
  assert.equal(inspect.status,0);
  assert.match(inspect.stdout,/^true healthy .*supabase\/postgres:17\./);
  const guard=`DO $$ BEGIN IF current_user<>'postgres' OR current_database()<>'postgres'
    OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
    THEN RAISE EXCEPTION 'Expected non-superuser disposable actor'; END IF; END $$;\n`;
  const noAccess=`DO $$ DECLARE r text; t text; BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      FOREACH t IN ARRAY ARRAY['measurement_photo_assets','measurement_photo_deletions'] LOOP
        IF has_table_privilege(r,'public.'||t,'SELECT,INSERT,UPDATE,DELETE')
          OR has_any_column_privilege(r,'public.'||t,'SELECT,INSERT,UPDATE')
        THEN RAISE EXCEPTION 'Expected absent API grants'; END IF;
      END LOOP;
    END LOOP;
    END $$;\n`;
  let sql=guard;
  if(mode==='database') {
    sql+=`DO $$ BEGIN IF EXISTS(SELECT FROM auth.users)
      OR to_regclass('public.measurement_photo_assets') IS NOT NULL
      OR to_regclass('public.measurement_photo_deletions') IS NOT NULL
      THEN RAISE EXCEPTION 'Expected fresh disposable project'; END IF; END $$;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;
    `;
    for(const filename of ['20260224_measurements_photo_assets.sql','20260225_measurement_photo_deletions.sql'])
      sql+=await readFile('supabase/migrations/'+filename,'utf8');
    sql+=noAccess;
  } else if(mode==='grants-only') {
    sql+=noAccess+'GRANT SELECT,INSERT,UPDATE,DELETE ON public.measurement_photo_deletions TO authenticated;';
  } else if(mode==='candidate') {
    const draft=await readFile('supabase/migration_drafts/measurement_photo_explicit_grants_review_v1.sql','utf8');
    assert.equal((draft.match(/^BEGIN;$/gm)??[]).length,1);
    assert.equal((draft.match(/^ROLLBACK;$/gm)??[]).length,1);
    assert.doesNotMatch(draft,/^COMMIT;$/m);
    // Remove the temporary broad grant used to reproduce the missing-policy defect.
    // Commit the exact candidate body only in this disposable project.
    sql+='REVOKE ALL ON public.measurement_photo_deletions FROM authenticated;'+noAccess;
    sql+=draft.replace(/^ROLLBACK;$/m,'COMMIT;');
  } else {
    sql+=`DO $$ BEGIN
      IF NOT has_table_privilege('authenticated','public.measurement_photo_assets','SELECT')
      OR NOT has_column_privilege('authenticated','public.measurement_photo_deletions','deleted_at','UPDATE')
      OR has_column_privilege('authenticated','public.measurement_photo_deletions','id','UPDATE')
      OR has_table_privilege('anon','public.measurement_photo_assets','SELECT')
      OR has_table_privilege('service_role','public.measurement_photo_deletions','SELECT')
      OR (SELECT count(*) FROM public.measurement_photo_assets)<>0
      OR (SELECT count(*) FROM public.measurement_photo_deletions)<>0
      OR (SELECT count(*) FROM auth.users)<>2
      THEN RAISE EXCEPTION 'Final HTTP fixture mismatch'; END IF;
      END $$;`;
  }
  sql+="\nNOTIFY pgrst, 'reload schema';\n";
  const r=spawnSync('docker',['exec','-i',container,'psql','-X','-h','/run/postgresql','-p','5432','-U','postgres','-d','postgres','--set','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:120000});
  if(r.status!==0) console.error('Disposable SQL failed:',r.stderr);
  assert.equal(r.status,0,'Photo HTTP fixture '+mode+' failed');
  console.log('PHOTO_HTTP_FIXTURE_'+mode.toUpperCase()+'_OK');
}
