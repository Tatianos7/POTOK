import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const root=process.env.POTOK_PHOTO_AUTH_DIR;
assert(root && path.isAbsolute(root) && path.basename(root)==='potok-photo-http-acceptance');
assert((await readFile(path.join(root,'supabase/config.toml'),'utf8')).includes('project_id = "potok-photo-http-acceptance"'));
const mode=process.argv[2];assert(['fixture','seed','candidate','verify'].includes(mode));
const container='supabase_db_potok-photo-http-acceptance';
const inspect=spawnSync('docker',['inspect','--format','{{.State.Running}} {{.State.Health.Status}} {{.Config.Image}}',container],{encoding:'utf8',timeout:10000});
assert.equal(inspect.status,0);assert.match(inspect.stdout,/^true healthy .*supabase\/postgres:17\./);
const ids=process.argv.slice(3);if(mode!=='fixture'){assert.equal(ids.length,2);for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);assert.notEqual(ids[0],ids[1]);}
const [a,b]=ids;
let sql=`DO $$ BEGIN IF current_user<>'postgres' OR current_database()<>'postgres'
  OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
  THEN RAISE EXCEPTION 'Expected fixed non-superuser local actor'; END IF; END $$;\n`;
if(mode==='fixture'){
 sql+=`DO $$ BEGIN IF EXISTS(SELECT FROM pg_class WHERE relnamespace='public'::regnamespace
   AND relname IN ('entitlements','subscriptions','billing_events','feature_flags'))
   OR (SELECT count(*) FROM auth.users)<>2
   OR (SELECT count(*) FROM public.measurement_photo_assets)<>0
   OR (SELECT count(*) FROM public.measurement_photo_deletions)<>0
   THEN RAISE EXCEPTION 'Expected completed disposable photo fixture'; END IF; END $$;`;
 sql+=await readFile('supabase/phase7_3_2_monetization.sql','utf8');
 sql+='GRANT ALL ON public.entitlements,public.subscriptions,public.billing_events TO PUBLIC,anon,authenticated,service_role;';
 for(const signature of ['get_entitlements(uuid)','get_paywall_state(text,uuid)','start_purchase(uuid,text,text,text)','restore_purchase(uuid,text,text,text)'])sql+=`GRANT EXECUTE ON FUNCTION public.${signature} TO anon,authenticated,service_role;`;
}else{
 sql+=`DO $$ BEGIN IF (SELECT count(*) FROM auth.users)<>4
   OR NOT EXISTS(SELECT FROM auth.users WHERE id='${a}' AND email='premium-a@example.test')
   OR NOT EXISTS(SELECT FROM auth.users WHERE id='${b}' AND email='premium-b@example.test')
   THEN RAISE EXCEPTION 'Expected independent synthetic Premium identities'; END IF; END $$;`;
 if(mode==='seed')sql+=`INSERT INTO public.entitlements(user_id,tier,flags) VALUES('${a}','free','{"can_adapt":false}'),('${b}','pro','{"can_adapt":true}');
   INSERT INTO public.subscriptions(user_id,plan,status) VALUES('${a}','free','active'),('${b}','pro','active');
   INSERT INTO public.billing_events(user_id,provider,event_type,idempotency_key) VALUES('${a}','play_store','fixture','seed-a'),('${b}','play_store','fixture','seed-b');`;
 else if(mode==='candidate'){
   sql+=`DO $$ BEGIN IF (SELECT tier FROM public.entitlements WHERE user_id='${a}')<>'pro'
     OR NOT EXISTS(SELECT FROM public.billing_events WHERE user_id='${b}' AND idempotency_key='forged-by-anon')
     THEN RAISE EXCEPTION 'Legacy HTTP reproductions missing'; END IF; END $$;
     UPDATE public.entitlements SET tier='free',flags='{"can_adapt":false}' WHERE user_id='${a}';
     DELETE FROM public.billing_events WHERE idempotency_key='forged-by-anon';`;
   const draft=await readFile('supabase/migration_drafts/premium_finance_authority_review_v1.sql','utf8');
   assert.equal((draft.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((draft.match(/^ROLLBACK;$/gm)??[]).length,1);assert.doesNotMatch(draft,/^COMMIT;$/m);
   sql+=draft.replace(/^ROLLBACK;$/m,'COMMIT;');
 }else sql+=`DO $$ BEGIN
   IF (SELECT count(*) FROM public.entitlements)<>2 OR (SELECT count(*) FROM public.subscriptions)<>2
   OR (SELECT count(*) FROM public.billing_events)<>3
   OR (SELECT tier FROM public.entitlements WHERE user_id='${a}')<>'pro'
   OR NOT EXISTS(SELECT FROM public.billing_events WHERE idempotency_key='trusted-after')
   OR EXISTS(SELECT FROM public.billing_events WHERE idempotency_key IN ('forged-by-anon','forged-after','client-insert'))
   OR has_table_privilege('authenticated','public.entitlements','INSERT,UPDATE,DELETE')
   OR has_any_column_privilege('authenticated','public.entitlements','INSERT,UPDATE')
   OR has_function_privilege('anon','public.get_entitlements(uuid)','EXECUTE')
   OR has_function_privilege('service_role','public.get_entitlements(uuid)','EXECUTE')
   OR has_function_privilege('authenticated','public.start_purchase(uuid,text,text,text)','EXECUTE')
   THEN RAISE EXCEPTION 'Premium HTTP final state mismatch'; END IF; END $$;`;
}
sql+="\nNOTIFY pgrst,'reload schema';";
const r=spawnSync('docker',['exec','-i',container,'psql','-X','-h','/run/postgresql','-U','postgres','-d','postgres','--set','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:120000});
if(r.status!==0)console.error('Disposable Premium fixture SQL failed:',r.stderr);
assert.equal(r.status,0,'Premium fixture '+mode+' failed');console.log('PREMIUM_LOCAL_'+mode.toUpperCase()+'_OK');
