import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import { actor, id } from '../../src/server/__tests__/foodEvidenceFixturesV1';
interface Fixture {
 sql:(s:string)=>Promise<string>;
 asUser:(s:string,user?:string,overrides?:Record<string,unknown>)=>Promise<string>;
 session:()=>{send:(s:string)=>Promise<void>;close:()=>Promise<void>};
}
const q=(s:string)=>`'${s.replace(/'/g,"''")}'`;
export async function stageCCatalogAcceptance(t:TestContext,{sql,asUser,session}:Fixture) {
 // Synthetic rows only. Reconcile earlier synthetic duplicate normalized fixtures,
 // NOT deployed data. Exact supplied Staging expression index/ownership predicates.
 await sql(`ALTER TABLE public.foods ADD calories numeric(8,2) NOT NULL DEFAULT 0,ADD protein numeric(8,2) NOT NULL DEFAULT 0,
  ADD fat numeric(8,2) NOT NULL DEFAULT 0,ADD carbs numeric(8,2) NOT NULL DEFAULT 0,ADD fiber numeric, ADD search_vector tsvector;
  CREATE FUNCTION public.normalize_food_text(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $normalize$
   SELECT trim(regexp_replace(lower(coalesce(value,'')),'[^a-z0-9а-яё]+',' ','g'));
  $normalize$;
  CREATE FUNCTION public.foods_update_search_vector() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $trigger$
  BEGIN
   NEW.normalized_name:=public.normalize_food_text(NEW.name);
   NEW.normalized_brand:=public.normalize_food_text(NEW.brand);
   IF NEW.canonical_food_id IS NULL THEN NEW.canonical_food_id:=NEW.id; END IF;
   NEW.search_vector:=setweight(to_tsvector('russian',coalesce(NEW.name,'')),'A') ||
    setweight(to_tsvector('russian',coalesce(NEW.name_original,'')),'B') ||
    setweight(to_tsvector('russian',coalesce(array_to_string(NEW.aliases,' '),'')),'C');
   RETURN NEW;
  END $trigger$;
  CREATE TRIGGER foods_search_vector_update BEFORE INSERT OR UPDATE ON public.foods FOR EACH ROW EXECUTE FUNCTION public.foods_update_search_vector();
  UPDATE public.foods SET name='Synthetic fixture '||id::text;
  CREATE UNIQUE INDEX foods_normalized_unique ON public.foods(normalized_name,coalesce(normalized_brand,''));
  ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
  CREATE POLICY stage_c_private_select ON public.foods FOR SELECT TO authenticated USING(source='user' AND created_by_user_id=auth.uid());
  CREATE POLICY stage_c_shared_select ON public.foods FOR SELECT TO anon,authenticated USING(source IN ('core','brand'));
  CREATE POLICY stage_c_private_insert ON public.foods FOR INSERT TO authenticated WITH CHECK(source='user' AND created_by_user_id=auth.uid());
  CREATE POLICY stage_c_private_update ON public.foods FOR UPDATE TO authenticated USING(source='user' AND created_by_user_id=auth.uid()) WITH CHECK(source='user' AND created_by_user_id=auth.uid());
  CREATE POLICY stage_c_private_delete ON public.foods FOR DELETE TO authenticated USING(source='user' AND created_by_user_id=auth.uid());
  CREATE POLICY stage_c_legacy_admin_insert ON public.foods FOR INSERT TO authenticated WITH CHECK(source IN ('core','brand') AND EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=auth.uid() AND is_admin));
  GRANT SELECT,INSERT,UPDATE,DELETE ON public.foods TO anon,authenticated,service_role;
  GRANT UPDATE(name) ON public.foods TO authenticated;`);
 await sql("SET potok_shared_food_eligibility.test_target='disposable-postgresql-only';"+await readFile('supabase/migration_drafts/shared_food_stage_c_disposable_v1.sql','utf8'));
 await sql(`SELECT potok_control.grant_entitlement_v2(${q(id(2))},'admin',NULL,'synthetic-stage-c','synthetic second reviewer')`);
 const payload=(name:string)=>({name,brand:null,calories:'10.25',protein:'1.23',fat:'2.00',carbs:'3.00',fiber:'0.00'});
 const create=(name:string)=>({contract:'potok-private-food-request-v1',kind:'CREATE',payload:payload(name)});
 type Receipt={food:{id:string;canonical_food_id:string;created_by_user_id:string;source:string;name:string;fiber:number|null;normalized_name:string;normalized_brand:string};rowDigest:string};
 const privateCall=async(v:object,user=actor)=>JSON.parse(await asUser(`SELECT public.catalog_private_food_v1(${q(JSON.stringify(v))})`,user)) as Receipt;
 const batch=(rows:object[],mode='INSERT')=>({contract:'potok-catalog-batch-request-v1',mode,rows});
 const row=(n:number,name:string)=>({foodId:id(n),foodStableId:`stage_c_${n}`,source:'core',payload:payload(name)});
 const importCall=async(v:object,user=actor)=>JSON.parse(await asUser(`SELECT public.catalog_import_batch_v1(${q(JSON.stringify(v))})`,user)) as {rowsApplied:number;targets:{requestedFoodId:string;foodId:string}[]};

 await t.test('Stage C fiber nullable without default, private transitions and CAS null/zero distinction',async()=>{
  const metadata=JSON.parse(await sql("SELECT jsonb_build_object('nullable',is_nullable,'default',column_default,'type',data_type) FROM information_schema.columns WHERE table_schema='public' AND table_name='foods' AND column_name='fiber'"));
  assert.deepEqual(metadata,{nullable:'YES',default:null,type:'numeric'});
  const base={...payload('nullable private'),fiber:null};
  const first=await privateCall({...create('nullable private'),payload:base});assert.equal(first.food.fiber,null);
  const update=async(r:Receipt,fiber:string|null)=>privateCall({contract:'potok-private-food-request-v1',kind:'UPDATE',foodId:r.food.id,expectedDigest:r.rowDigest,payload:{...base,fiber}});
  const zero=await update(first,'0.00');assert.equal(zero.food.fiber,0);assert.notEqual(zero.rowDigest,first.rowDigest);
  const unknown=await update(zero,null);assert.equal(unknown.food.fiber,null);assert.equal(unknown.rowDigest,first.rowDigest);
  await assert.rejects(update(zero,'1.25'),/FOOD_CONFLICT/);
  const number=await update(unknown,'1.25');assert.equal(number.food.fiber,1.25);
 });
 await t.test('Stage C importer preserves unknown fiber distinctly from zero',async()=>{
  const item={...row(9300,'nullable import'),payload:{...payload('nullable import'),fiber:null}};
  await importCall(batch([item]));
  const read=async()=>JSON.parse(await sql(`SELECT jsonb_build_object('fiber',fiber,'digest',potok_catalog_writer.row_digest_v1(to_jsonb(f))) FROM public.foods f WHERE id=${q(id(9300))}`));
  const unknown=await read();assert.equal(unknown.fiber,null);
  await importCall(batch([{...item,payload:{...item.payload,fiber:'0.00'}}],'UPSERT_ID'));
  const zero=await read();assert.equal(zero.fiber,0);assert.notEqual(zero.digest,unknown.digest);
  await importCall(batch([item],'UPSERT_ID'));assert.equal((await read()).fiber,null);
 });
 await t.test('Stage C rejects caller normalized fields; DB trigger defeats forged keys and preserves index semantics',async()=>{
  for(const fake of ['fake-one','fake-two']){
   await assert.rejects(privateCall({...create('MiXeD... Case!!'),payload:{...payload('MiXeD... Case!!'),normalizedName:fake,normalizedBrand:fake}}),/EXACT_FIELDS_REQUIRED/);
   await assert.rejects(importCall(batch([{...row(9310,'MiXeD... Case!!'),payload:{...payload('MiXeD... Case!!'),normalizedName:fake,normalizedBrand:fake}}])),/EXACT_FIELDS_REQUIRED/);
  }
  const first=await privateCall({...create('MiXeD... Case!!'),payload:{...payload('MiXeD... Case!!'),brand:'BrAnD!!'}});
  assert.equal(first.food.normalized_name,'mixed case');assert.equal(first.food.normalized_brand,'brand');
  await assert.rejects(privateCall({...create('mixed CASE'),payload:{...payload('mixed CASE'),brand:'brand'}},id(3)),/FOOD_CONFLICT/);
  await sql(`INSERT INTO public.foods(id,name,brand,normalized_name,normalized_brand,source,created_by_user_id) VALUES(${q(id(9311))},'TRIGGER... Name!',NULL,'forged','forged','user',${q(actor)})`);
  assert.equal(await sql(`SELECT normalized_name||':'||normalized_brand FROM public.foods WHERE id=${q(id(9311))}`),'trigger name:');
  await assert.rejects(sql(`INSERT INTO public.foods(id,name,brand,normalized_name,normalized_brand,source,created_by_user_id) VALUES(${q(id(9312))},'trigger NAME','', 'different','different','user',${q(actor)})`),/duplicate key/);
 });
 await t.test('Stage C normalized importer uses DB case/punctuation/brand semantics and rejects duplicate derived targets',async()=>{
  const original={...row(9320,'ImPoRt... Root!'),payload:{...payload('ImPoRt... Root!'),brand:'MiXeD... BRAND!'}};
  await importCall(batch([original]));
  const candidate={...row(9321,'import ROOT'),foodStableId:'stage_c_9320',payload:{...payload('import ROOT'),brand:'mixed brand'}};
  assert.deepEqual((await importCall(batch([candidate],'UPSERT_NORMALIZED'))).targets,[{requestedFoodId:id(9321),foodId:id(9320)}]);
  assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id=${q(id(9321))}`),'0');
  await assert.rejects(importCall(batch([row(9322,'Duplicate... Derived!'),{...row(9323,'duplicate DERIVED'),payload:{...payload('duplicate DERIVED'),brand:''}}])),/DUPLICATE_BATCH_TARGET/);
  assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id IN (${q(id(9322))},${q(id(9323))})`),'0');
 });
 let a:Receipt;
 await t.test('Stage C private create is atomic self-root; A/B ownership, no promotion or foreign disclosure',async()=>{
  a=await privateCall(create('private-A'));
  assert.equal(a.food.id,a.food.canonical_food_id);assert.equal(a.food.created_by_user_id,actor);assert.equal(a.food.source,'user');
  assert.equal(await asUser(`SELECT count(*) FROM public.foods WHERE id=${q(a.food.id)}`,id(3)),'0');
  for(const kind of ['UPDATE','DELETE']) {
   const input={contract:'potok-private-food-request-v1',kind,foodId:a.food.id,expectedDigest:a.rowDigest,...kind==='UPDATE'?{payload:payload('stolen')}: {}};
   await assert.rejects(privateCall(input,id(3)),/FOOD_CONFLICT/);
  }
  await assert.rejects(privateCall({...create('promote'),source:'core'}),/EXACT_FIELDS_REQUIRED/);
  await assert.rejects(privateCall({...create('promote'),payload:{...payload('promote'),created_by_user_id:id(3)}}),/EXACT_FIELDS_REQUIRED/);
  const updated=await privateCall({contract:'potok-private-food-request-v1',kind:'UPDATE',foodId:a.food.id,expectedDigest:a.rowDigest,payload:payload('private-A-updated')});
  assert.equal(updated.food.name,'private-A-updated');
  await assert.rejects(privateCall({contract:'potok-private-food-request-v1',kind:'UPDATE',foodId:a.food.id,expectedDigest:a.rowDigest,payload:payload('stale')}),/FOOD_CONFLICT/);
  a=updated;
 });
 await t.test('Stage C null/empty brand foreign collision returns only generic conflict',async()=>{
  const b={...create('private-A-updated'),payload:{...payload('private-A-updated'),brand:''}};
  const result=await asUser(`SELECT public.catalog_private_food_v1(${q(JSON.stringify(b))})`,id(3)).then(()=>null,(e:unknown)=>e && typeof e==='object' && 'stderr' in e ? String(e.stderr):String(e));
  assert.ok(result);assert.match(result,/FOOD_CONFLICT/);assert.doesNotMatch(result,/private-A-updated|Key \(|already exists/);
  assert.equal(await sql("SELECT count(*) FROM public.foods WHERE normalized_name='private a updated'"),'1');
  await privateCall(create('private-B'),id(3));
 });
 await t.test('Stage C explicit outer rollback removes private create and root together',async()=>{
  await assert.rejects(asUser(`SELECT public.catalog_private_food_v1(${q(JSON.stringify(create('rollback-private')))}); SELECT 1/0`),/division by zero/);
  assert.equal(await sql("SELECT count(*) FROM public.foods WHERE normalized_name='rollback private'"),'0');
 });
 await t.test('Stage C prospective ACL closes table/column/direct role bypass while reads survive',async()=>{
  for(const role of ['anon','authenticated','service_role']) {
   for(const statement of [`UPDATE public.foods SET name='bypass'`,`DELETE FROM public.foods`,`INSERT INTO public.foods(id,source,name) VALUES(${q(id(9500))},'core','bypass')`,'TRUNCATE public.foods']) {
    await assert.rejects(sql(`BEGIN; SET LOCAL ROLE ${role}; ${statement}; COMMIT`),/permission denied/);
   }
  }
  await assert.rejects(sql("SET ROLE anon; SELECT public.catalog_private_food_v1('{}')"),/permission denied/);
  await assert.rejects(sql("SET ROLE service_role; SELECT public.catalog_import_batch_v1('{}')"),/permission denied/);
  assert.ok(Number(await asUser("SELECT count(*) FROM public.foods WHERE source IN ('core','brand')"))>0);
  await assert.rejects(sql('TRUNCATE public.foods CASCADE'),/REGISTERED_IDENTITY_TRUNCATE_FORBIDDEN|IMMUTABLE/);
 });
 await t.test('Stage C importer requires trusted attestation, not is_admin or service-role alone',async()=>{
  const request=batch([row(9100,'shared-9100')]);
  await assert.rejects(importCall(request,id(3)),/VERIFIED_ADMIN_REQUIRED/);
  assert.equal((await importCall(request)).rowsApplied,1);
  await assert.rejects(privateCall(create('shared-9100'),id(3)),/FOOD_CONFLICT/);
  await assert.rejects(importCall({...request,actorId:id(3)}),/EXACT_FIELDS_REQUIRED/);
  await assert.rejects(importCall(batch([{...row(9101,'private-A-updated'),foodStableId:null}],'UPSERT_NORMALIZED')),/FOOD_CONFLICT/);
 });
 await t.test('Stage C batch late failure rolls back every row; duplicate/bound validation',async()=>{
  await assert.rejects(importCall(batch([row(9110,'batch-first'),{...row(9111,'private-A-updated'),foodStableId:null}])),/FOOD_CONFLICT/);
  assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id IN (${q(id(9110))},${q(id(9111))})`),'0');
  assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id=${q(id(9100))}`),'1','previous committed batch is NOT rolled back with later batch');
  await assert.rejects(importCall(batch([row(9110,'same'),row(9110,'other')])),/DUPLICATE_BATCH_TARGET/);
  await assert.rejects(importCall(batch(Array(201).fill(row(9110,'same')))),/BATCH_BOUND_INVALID/);
 });
 await t.test('Stage C controlled opposite-order concurrent batches use gate and preserve identities',async()=>{
  const rows=[row(9120,'bulk-9120'),row(9121,'bulk-9121')];await importCall(batch(rows));
  const results=await Promise.all([importCall(batch(rows.map(r=>({...r,payload:{...r.payload,name:r.payload.name+' A'}})),'UPSERT_ID')),
   importCall(batch([...rows].reverse().map(r=>({...r,payload:{...r.payload,name:r.payload.name+' B'}})),'UPSERT_ID'),id(2))]);
  assert.equal(results[0].rowsApplied,2);assert.equal(results[1].rowsApplied,2);
  assert.equal(await sql(`SELECT count(DISTINCT name) FROM public.foods WHERE id IN (${q(id(9120))},${q(id(9121))})`),'2');
  const actualName=await sql(`SELECT name FROM public.foods WHERE id=${q(id(9120))}`);
  const normalized={...row(9122,actualName),foodStableId:'stage_c_9120'};const applied=await importCall(batch([normalized],'UPSERT_NORMALIZED'));
  assert.deepEqual(applied.targets,[{requestedFoodId:id(9122),foodId:id(9120)}]);
  assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id=${q(id(9122))}`),'0');
  assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE normalized_name=public.normalize_food_text(${q(actualName)})`),'1');
 });
 await t.test('Stage C controlled importer ABA keeps epoch monotonic and stable claim immutable',async()=>{
  const fid=id(9120),key='stage_c_9120';
  const bind=async()=>JSON.parse(await sql(`SELECT jsonb_build_object('epoch',coalesce((SELECT identity_epoch::text FROM potok_shared_food_eligibility.roots_v1 WHERE food_id=${q(fid)}),'0'),
   'fp',potok_shared_food_eligibility.fingerprint_v1(to_jsonb(f))) FROM public.foods f WHERE id=${q(fid)}`)) as {epoch:string;fp:string};
  const b=await bind();
  const input={contract:'potok-shared-food-eligibility-request-v1',foodId:fid,idempotencyReference:id(9200),expectedHead:null,catalogIdentityEpoch:b.epoch,identityFingerprint:b.fp,status:'PENDING',reason:'synthetic'};
  const pending=JSON.parse(await asUser(`SELECT public.shared_food_eligibility_decide_v1(${q(JSON.stringify(input))})`));
  await asUser(`SELECT public.shared_food_eligibility_decide_v1(${q(JSON.stringify({...input,status:'ELIGIBLE',idempotencyReference:id(9201),expectedHead:{decisionId:pending.decisionId,version:pending.version}}))})`);
  const original=await sql(`SELECT name FROM public.foods WHERE id=${q(fid)}`);
  const target={...row(9120,original),foodStableId:key};
  await importCall(batch([{...target,payload:{...target.payload,name:'ABA changed'}}],'UPSERT_ID'));
  await importCall(batch([{...target,payload:{...target.payload,name:original}}],'UPSERT_ID'));
  const after=await bind();assert.equal(after.fp,b.fp);assert.equal(after.epoch,'2');
  assert.equal(JSON.parse(await asUser(`SELECT public.shared_food_eligibility_current_v1(${q(fid)})`)).eligible,false);
  await assert.rejects(importCall(batch([{...row(9202,'reuse-claim'),foodStableId:key}])),/STABLE_KEY_ALREADY_CLAIMED/);
 });
 await t.test('Stage C private concurrent create collision commits one, aborts one, never adopts',async()=>{
  const results=await Promise.allSettled([privateCall(create('race-private')),privateCall(create('race-private'),id(3))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const failed=results.find(r=>r.status==='rejected');assert.ok(failed&&failed.status==='rejected');assert.match(String(failed.reason),/FOOD_CONFLICT/);
  assert.equal(await sql("SELECT count(*) FROM public.foods WHERE normalized_name='race private'"),'1');
 });
 await t.test('Stage C gate wait precedes first catalog row lock and rechecks live session',async()=>{
  const holder=session();try {
   await holder.send('BEGIN; SELECT potok_food_evidence.catalog_gate_v1()');
   const waiting=privateCall({contract:'potok-private-food-request-v1',kind:'UPDATE',foodId:a.food.id,expectedDigest:a.rowDigest,payload:payload('gate-wait-private')});
   let queued=false;const deadline=Date.now()+2000;
   while(Date.now()<deadline){if(await sql("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event='advisory' AND query LIKE '%catalog_private_food_v1%')")==='t'){queued=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}
   assert.equal(queued,true,'private wrapper must actually be waiting on gate');
   // Role/current SQL uses NOWAIT while private operation is queued at gate.
   assert.equal(await sql(`BEGIN; SELECT id FROM public.foods WHERE id=${q(a.food.id)} FOR UPDATE NOWAIT; COMMIT`),a.food.id);
   await holder.send('COMMIT');a=await waiting;
   await holder.send('BEGIN; SELECT potok_food_evidence.catalog_gate_v1()');
   const expired=assert.rejects(asUser(`SELECT public.catalog_private_food_v1(${q(JSON.stringify(create('expired-private')))})`,actor,{exp:Math.floor(Date.now()/1000)+1}),/JWT_EXPIRED/);
   await holder.send('SELECT pg_sleep(2); COMMIT');await expired;
   assert.equal(await sql("SELECT count(*) FROM public.foods WHERE normalized_name='expired private'"),'0');
  }finally{await holder.close();}
 });
 await t.test('Stage C private delete has owner CAS and READ COMMITTED guard',async()=>{
  const request={contract:'potok-private-food-request-v1',kind:'DELETE',foodId:a.food.id,expectedDigest:a.rowDigest};
  await assert.rejects(sql(`BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT potok_food_evidence.catalog_gate_v1(); COMMIT`),/READ_COMMITTED/);
  await privateCall(request);assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id=${q(a.food.id)}`),'0');
 });
}
