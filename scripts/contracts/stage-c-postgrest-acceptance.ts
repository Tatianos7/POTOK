/** Real loopback PostgREST / signed JWT acceptance. Own-cluster callback only.
 * No remote URL, no credentials from environment, no runtime/importer wiring. */
import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {createHmac,randomBytes} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {actor,id} from '../../src/server/__tests__/foodEvidenceFixturesV1';
import {pgWireFaultProxy,type FaultMode} from './stage-c-pg-wire-faults';
import {transportOutcomeV1,reconcileFinalStateV1,type PostgrestErrorV1} from './stage-c-transport-outcome';
import {retryableCatalogFailureV1} from './catalogTransactionRetryV1';
interface Fixture {root:string;socket:string;port:string;sql:(s:string)=>Promise<string>;session:()=>{send:(s:string)=>Promise<void>;close:()=>Promise<void>}}
const q=(s:string)=>`'${s.replace(/'/g,"''")}'`;
const wait=async(check:()=>Promise<boolean>,label:string,ms=5000)=>{
 const deadline=Date.now()+ms;while(Date.now()<deadline){if(await check())return;await new Promise(r=>setTimeout(r,25));}assert.fail(`Barrier not reached: ${label}`);
};
interface Response {status:number;body:unknown}
interface Receipt {food:{id:string;canonical_food_id:string;source:string;created_by_user_id:string;fiber:number|null};rowDigest:string}
function pgError(r:Response,code:string):PostgrestErrorV1 {
 assert.ok(r.status>=400);assert.ok(r.body&&typeof r.body==='object');
 const value=r.body as PostgrestErrorV1;assert.equal(value.code,code);
 assert.deepEqual(Object.keys(value).sort(),['code','details','hint','message']);return value;
}
export async function stageCPostgrestAcceptance(t:TestContext,{root,socket,port,sql,session}:Fixture) {
 const version=spawnSync('postgrest',['--version'],{encoding:'utf8',env:{PATH:process.env.PATH??''}});
 assert.equal(version.status,0,'Required real PostgREST binary unavailable');assert.match(version.stdout,/13\.0\.7/);
 t.diagnostic(`PostgREST ${version.stdout.trim()}; PostgreSQL ${await sql('SHOW server_version')}; Node ${process.version}`);
 // AUTHENTICATOR is unprivileged, non-inheriting, cannot SET ROLE postgres/service_role.
 await sql(`CREATE ROLE stage_c_authenticator LOGIN NOINHERIT NOBYPASSRLS;
  GRANT anon,authenticated TO stage_c_authenticator;
  ALTER ROLE stage_c_authenticator SET statement_timeout='5s';
  ALTER ROLE stage_c_authenticator SET deadlock_timeout='100ms';
  CREATE SCHEMA stage_c_transport_test;
  REVOKE ALL ON SCHEMA stage_c_transport_test FROM PUBLIC,anon,authenticated,service_role;
  CREATE TABLE stage_c_transport_test.serialization_rows(id integer PRIMARY KEY,value integer NOT NULL);
  INSERT INTO stage_c_transport_test.serialization_rows VALUES(1,1),(2,1);
  ALTER TABLE stage_c_transport_test.serialization_rows ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA stage_c_transport_test TO authenticated;
  GRANT SELECT,UPDATE ON stage_c_transport_test.serialization_rows TO authenticated;
  CREATE POLICY only_owner_a ON stage_c_transport_test.serialization_rows TO authenticated USING(auth.uid()=${q(actor)}) WITH CHECK(auth.uid()=${q(actor)});
  -- Fixed typed TEST probe, not arbitrary SQL, and not catalog/evidence authority.
  CREATE FUNCTION public.stage_c_serialization_probe_v1(p_id integer) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER
   SET search_path=pg_catalog SET default_transaction_isolation='serializable' AS $probe$
   DECLARE total integer;BEGIN
    IF p_id NOT IN (1,2) OR p_id IS NULL THEN RAISE EXCEPTION 'TEST_ID_INVALID' USING ERRCODE='22023';END IF;
    SELECT sum(value) INTO total FROM stage_c_transport_test.serialization_rows;
    PERFORM pg_advisory_xact_lock_shared(71243);
    UPDATE stage_c_transport_test.serialization_rows SET value=0 WHERE id=p_id AND total>0;
    RETURN total;
   END $probe$;
  REVOKE ALL ON FUNCTION public.stage_c_serialization_probe_v1(integer) FROM PUBLIC,anon,service_role;
  GRANT EXECUTE ON FUNCTION public.stage_c_serialization_probe_v1(integer) TO authenticated;
  -- Fixed test trigger only. No request-driven set_config/arbitrary SQL RPC.
  CREATE FUNCTION stage_c_transport_test.observe_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $observe$
  BEGIN
   IF NEW.name='transport timeout probe' THEN PERFORM pg_sleep(10);END IF;
   IF NEW.name='transport deadlock probe' THEN
    PERFORM set_config('application_name','stage_c_deadlock_probe',true);
    PERFORM pg_advisory_xact_lock(71242);PERFORM pg_advisory_xact_lock(71241);
   END IF;
   RETURN NEW;
  END $observe$;
  REVOKE ALL ON FUNCTION stage_c_transport_test.observe_v1() FROM PUBLIC,anon,authenticated,service_role;
  CREATE TRIGGER z_stage_c_transport_observe BEFORE INSERT ON public.foods FOR EACH ROW EXECUTE FUNCTION stage_c_transport_test.observe_v1();`);
 const proxy=await pgWireFaultProxy(join(socket,`.s.PGSQL.${port}`));
 const secret=randomBytes(48).toString('base64url');
 const jwt=(user=actor,overrides:Record<string,unknown>={})=>{
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const claims=Buffer.from(JSON.stringify({role:'authenticated',sub:user,session_id:id(Number(user.slice(-12))+100),exp:Math.floor(Date.now()/1000)+3600,...overrides})).toString('base64url');
  const text=header+'.'+claims;return text+'.'+createHmac('sha256',secret).update(text).digest('base64url');
 };
 const reserve=net.createServer();await new Promise<void>(r=>reserve.listen(0,'127.0.0.1',r));const address=reserve.address();assert.ok(address&&typeof address==='object');const httpPort=address.port;await new Promise<void>(r=>reserve.close(()=>r()));
 const config=join(root,'postgrest.conf');await writeFile(config,`db-uri = "postgresql://stage_c_authenticator@127.0.0.1:${proxy.port}/postgres?sslmode=disable&gssencmode=disable&application_name=stage_c_postgrest"
 db-schemas = "public"
 db-anon-role = "anon"
 db-pool = 6
 db-prepared-statements = true
 server-host = "127.0.0.1"
 server-port = ${httpPort}
 log-level = "crit"
 db-tx-end = "commit"
 jwt-secret = "${secret}"
 `,{mode:0o600});
 const processEnv={PATH:process.env.PATH??'',LC_ALL:'C.UTF-8'};
 const pgrst=spawn('postgrest',[config],{env:processEnv,stdio:['ignore','ignore','ignore']});
 let exited=false;pgrst.on('exit',()=>{exited=true;});pgrst.on('error',()=>{exited=true;});
 const origin=`http://127.0.0.1:${httpPort}`;
 const request=async(path:string,token:string|null=jwt(),body?:unknown,method=body===undefined?'GET':'POST',base=origin,signal?:AbortSignal,headers:Record<string,string>={}):Promise<Response>=>{
  const r=await fetch(base+path,{method,headers:{...token?{Authorization:`Bearer ${token}`}:{},...body===undefined?{}:{'Content-Type':'application/json'},...headers},body:body===undefined?undefined:JSON.stringify(body),signal:signal??AbortSignal.timeout(10000)});
  return {status:r.status,body:await r.json() as unknown};
 };
 const payload=(name:string)=>({name,brand:null,calories:'10.00',protein:'1.00',fat:'2.00',carbs:'3.00',fiber:null});
 const create=(name:string)=>({contract:'potok-private-food-request-v1',kind:'CREATE',payload:payload(name)});
 const rpc=(input:object,token=jwt(),signal?:AbortSignal,base=origin)=>request('/rpc/catalog_private_food_v1',token,{p_request:JSON.stringify(input)},'POST',base,signal);
 const importer=(n:number,name:string)=>({contract:'potok-catalog-batch-request-v1',mode:'INSERT',rows:[{foodId:id(n),foodStableId:`transport_${n}`,source:'core',payload:payload(name)}]});
 const importRPC=(input:object,token=jwt())=>request('/rpc/catalog_import_batch_v1',token,{p_request:JSON.stringify(input)});
 const count=async(name:string)=>Number(await sql(`SELECT count(*) FROM public.foods WHERE name=${q(name)}`));
 const absentBackend=async(pid:number|null)=>pid!==null&&await sql(`SELECT NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=${pid})`)==='t';
 let privateA:Receipt;
 try {
  await wait(async()=>{if(exited)assert.fail('PostgREST exited before readiness');try{return (await request('/foods?select=id&limit=1',null)).status===200;}catch{return false;}},'PostgREST ready',10000);
  await t.test('transport real signed authenticated/anon JWT, ownership SELECT and atomic private self-root',async()=>{
   const r=await rpc(create('transport owner a'));assert.equal(r.status,200);privateA=r.body as Receipt;
   assert.equal(privateA.food.id,privateA.food.canonical_food_id);assert.equal(privateA.food.created_by_user_id,actor);assert.equal(privateA.food.source,'user');assert.equal(privateA.food.fiber,null);
   assert.deepEqual(transportOutcomeV1({kind:'HTTP_SUCCESS',bodyVerified:privateA.food.created_by_user_id===actor,rollbackPreference:false}),{status:'COMMITTED',retryAllowed:false});
   const path=`/foods?id=eq.${privateA.food.id}&select=id`;
   assert.equal((await request(path)).status,200);assert.deepEqual((await request(path,jwt(id(3)))).body,[]);assert.deepEqual((await request(path,null)).body,[]);
   assert.equal((await request('/foods?source=eq.core&select=id',null)).status,200);
   pgError(await request('/rpc/catalog_private_food_v1',null,{p_request:JSON.stringify(create('anon denied'))}),'42501');
   pgError(await rpc(create('signed anon denied'),jwt(actor,{role:'anon'})),'42501');
  });
  await t.test('transport signature tampering sub/role, unsigned, expired JWT and invalid role fail closed',async()=>{
   const token=jwt();const pieces=token.split('.');
   for(const change of [{sub:id(3)},{role:'postgres'}]){
    const claims=JSON.parse(Buffer.from(pieces[1],'base64url').toString('utf8'));
    const forged=pieces[0]+'.'+Buffer.from(JSON.stringify({...claims,...change})).toString('base64url')+'.'+pieces[2];
    assert.equal((await rpc(create('forged token'),forged)).status,401);
   }
   const none=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+pieces[1]+'.';
   assert.equal((await rpc(create('unsigned'),none)).status,401);
   assert.equal((await rpc(create('expired'),jwt(actor,{exp:Math.floor(Date.now()/1000)-120}))).status,401);
   for(const role of ['postgres','service_role','nonexistent_role']){const r=await rpc(create('role escalation'),jwt(actor,{role}));assert.ok(r.status>=400);}
  });
  await t.test('transport live session revoked/expired/user mismatch/anonymous users denied despite valid signature',async()=>{
   const sid=id(103);await sql(`DELETE FROM auth.sessions WHERE id=${q(sid)}`);
   pgError(await rpc(create('revoked session'),jwt(id(3))),'42501');
   await sql(`INSERT INTO auth.sessions VALUES(${q(sid)},${q(id(3))},clock_timestamp()-interval '1 second')`);
   pgError(await rpc(create('expired session'),jwt(id(3))),'42501');
   await sql(`UPDATE auth.sessions SET not_after=NULL WHERE id=${q(sid)}`);
   pgError(await rpc(create('session mismatch'),jwt(actor,{session_id:sid})),'42501');
   pgError(await rpc(create('anonymous user'),jwt(id(4))),'42501');
  });
  await t.test('transport importer uses real trusted attestation, no is_admin/service_role authority fallback',async()=>{
   const input=importer(9700,'transport shared root');
   pgError(await importRPC(input,jwt(id(3))),'42501');
   assert.equal((await importRPC(input)).status,200);assert.equal(await count('transport shared root'),1);
   const denied=await importRPC(importer(9701,'service attempt'),jwt(actor,{role:'service_role'}));assert.ok(denied.status>=400);assert.equal(await count('service attempt'),0);
  });
  await t.test('transport prospective ACL denies direct INSERT/UPDATE/DELETE, retains ordinary SELECT',async()=>{
   for(const token of [jwt(),jwt(id(3)),null]){
    pgError(await request('/foods',token,{id:id(9702),name:'bypass',source:'user',created_by_user_id:actor}),'42501');
    pgError(await request(`/foods?id=eq.${privateA.food.id}`,token,{name:'bypass'},'PATCH'),'42501');
    pgError(await request(`/foods?id=eq.${privateA.food.id}`,token,undefined,'DELETE'),'42501');
    assert.equal((await request('/foods?select=id&limit=1',token)).status,200);
   }
  });
  await t.test('transport does not expose arbitrary SQL, private helpers or test GUC bypass',async()=>{
   for(const path of ['/rpc/set_config','/rpc/raw_v1','/rpc/row_digest_v1','/rpc/grant_entitlement_v2','/rpc/observe_v1'])assert.ok((await request(path,jwt(),{name:'request.jwt.claims',value:'{}',is_local:true})).status>=400);
   assert.ok((await request('/foods',jwt(),undefined,'GET',origin,undefined,{'Accept-Profile':'auth'})).status>=400);
   pgError(await rpc({...create('guc spoof'),actorId:id(3),role:'postgres',settings:{'request.jwt.claims':{sub:id(3)}}}),'22023');
   const headerSpoof=await request(`/foods?id=eq.${privateA.food.id}&select=id`,jwt(id(3)),undefined,'GET',origin,undefined,{'request.jwt.claims':JSON.stringify({sub:actor,role:'authenticated'}),'Role':'postgres'});assert.deepEqual(headerSpoof.body,[]);
   const funcs=await sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'stage_c_%'");assert.equal(funcs,'1','only fixed serialization probe, never arbitrary SQL RPC');
  });
  await t.test('transport business conflict preserves code/details, full RPC batch rollback, never retry by text',async()=>{
   const r=await rpc({contract:'potok-private-food-request-v1',kind:'UPDATE',foodId:privateA.food.id,expectedDigest:'0'.repeat(64),payload:payload('stale conflict')});
   const error=pgError(r,'40001');assert.equal(error.details,'POTOK_BUSINESS_CONFLICT_V1');assert.equal('routine' in error,false);
   assert.equal(retryableCatalogFailureV1({code:error.code,detail:error.details??undefined,rollbackConfirmed:true}),false);
   assert.equal(transportOutcomeV1({kind:'HTTP_ERROR',error,rollbackConfirmed:true}).status,'ABORTED');
   const rows=[...importer(9703,'transport rollback first').rows,{...importer(9704,'transport owner a').rows[0],foodStableId:null}];
   pgError(await importRPC({...importer(9703,'unused'),rows}),'40001');assert.equal(await count('transport rollback first'),0);
  });
  await t.test('transport native engine deadlock exposes SQLSTATE but omits routine; HTTP adapter cannot safely retry',async()=>{
   const holder=session();try{
    await holder.send('BEGIN; SET LOCAL deadlock_timeout=\'10s\'; SELECT pg_advisory_xact_lock(71241)');
    const response=rpc(create('transport deadlock probe'));
    await wait(async()=>await sql("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='stage_c_deadlock_probe' AND wait_event='advisory')")==='t','real deadlock first edge');
    const second=holder.send('SELECT pg_advisory_xact_lock(71242)');
    const r=await response;const error=pgError(r,'40P01');await second;await holder.send('ROLLBACK');
    assert.equal('routine' in error,false);assert.equal(retryableCatalogFailureV1({code:error.code,rollbackConfirmed:true}),false);assert.equal(await count('transport deadlock probe'),0);
   }finally{await holder.close();}
  });
  await t.test('transport genuine SERIALIZABLE engine 40001 differs from business marker, but routine is unavailable',async()=>{
   const holder=session();try{
    await holder.send('BEGIN; SELECT pg_advisory_xact_lock(71243)');
    const responses=[request('/rpc/stage_c_serialization_probe_v1',jwt(),{p_id:1}),request('/rpc/stage_c_serialization_probe_v1',jwt(),{p_id:2})];
    await wait(async()=>Number(await sql("SELECT count(*) FROM pg_stat_activity WHERE usename='stage_c_authenticator' AND wait_event='advisory'"))===2,'two SSI snapshots');
    await holder.send('COMMIT');const rs=await Promise.all(responses);assert.equal(rs.filter(r=>r.status===200).length,1);
    const failed=rs.find(r=>r.status>=400);assert.ok(failed);const error=pgError(failed,'40001');assert.notEqual(error.details,'POTOK_BUSINESS_CONFLICT_V1');assert.equal('routine' in error,false);
    assert.equal(retryableCatalogFailureV1({code:error.code,detail:error.details??undefined,rollbackConfirmed:true}),false);
   }finally{await holder.close();}
  });
  await t.test('transport statement timeout/cancel returns 57014 and rolls back',async()=>{
   const r=await rpc(create('transport timeout probe'));const error=pgError(r,'57014');assert.equal(retryableCatalogFailureV1({code:error.code,rollbackConfirmed:true}),false);assert.equal(await count('transport timeout probe'),0);
  });
  await t.test('transport catalog gate precedes first root row lock; READ COMMITTED and single transaction observed',async()=>{
   const holder=session();try{
    await holder.send('BEGIN; SELECT potok_food_evidence.catalog_gate_v1()');
    const response=rpc({contract:'potok-private-food-request-v1',kind:'UPDATE',foodId:privateA.food.id,expectedDigest:privateA.rowDigest,payload:payload('transport gated update')});
    await wait(async()=>await sql("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='stage_c_authenticator' AND wait_event='advisory' AND query LIKE '%catalog_private_food_v1%')")==='t','RPC waiting at gate');
    await sql(`BEGIN; SELECT id FROM public.foods WHERE id=${q(privateA.food.id)} FOR UPDATE NOWAIT; COMMIT`);
    await holder.send('COMMIT');const r=await response;assert.equal(r.status,200);privateA=r.body as Receipt;
    // Actual RPC passed session_v1 / mutation RC guards. SQL result visibility at COMMIT tested separately.
   }finally{await holder.close();}
  });
  await t.test('transport SQL result before COMMIT is invisible and is never a commit acknowledgement',async()=>{
   const fault=proxy.arm('HOLD_COMMIT');let complete=false;
   const response=rpc(create('transport held commit')).then(r=>{complete=true;return r;});
   await Promise.race([fault.reached,new Promise((_,reject)=>setTimeout(()=>reject(new Error('COMMIT barrier missing')),5000))]);
   assert.ok(fault.events.includes('sql_result'));assert.ok(fault.events.includes('commit_held'));assert.equal(complete,false);assert.equal(await count('transport held commit'),0);
   fault.release();const r=await response;assert.equal(r.status,200);assert.equal(await count('transport held commit'),1);assert.ok(fault.events.includes('commit_completed'));
  });
  for(const mode of ['BEFORE_COMMIT','COMMIT_IN_FLIGHT','AFTER_SQL_RESULT'] as FaultMode[])await t.test(`transport protocol fault ${mode}: client UNKNOWN, no retry, independently observed final state`,async()=>{
   const name=`transport fault ${mode.toLowerCase()}`,fault=proxy.arm(mode);
   const response=rpc(create(name)).then(r=>r,()=>null);
   await Promise.race([fault.reached,new Promise((_,reject)=>setTimeout(()=>reject(new Error('fault barrier missing')),5000))]);
   const r=await response;assert.ok(r===null||r.status>=400);assert.deepEqual(transportOutcomeV1({kind:'DISCONNECT'}),{status:'UNKNOWN',retryAllowed:false});
   if(mode==='COMMIT_IN_FLIGHT'){assert.ok(fault.events.includes('commit_forwarded'));assert.ok(fault.events.includes('commit_completed'));await wait(async()=>await count(name)===1,'observed commit');}
   else {await wait(()=>absentBackend(fault.backendPid),'terminated backend / confirmed rollback');assert.equal(await count(name),0);}
   t.diagnostic(`${mode}: client UNKNOWN; independent observer ${mode==='COMMIT_IN_FLIGHT'?'COMMITTED':'ABORTED'}; events=${fault.events.join(',')}`);
  });
  await t.test('transport COMMIT succeeded but HTTP response lost: client UNKNOWN, observer committed',async()=>{
   let acceptedResolve!:()=>void;const accepted=new Promise<void>(r=>{acceptedResolve=r;});
   const sockets=new Set<net.Socket>();const lost=http.createServer(async(req,res)=>{
    try{
     const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));
     const r=await fetch(origin+(req.url??'/'),{method:req.method,headers:{'Content-Type':'application/json',Authorization:jwt()},body:Buffer.concat(chunks)});
     await r.text();assert.equal(r.status,200);acceptedResolve();res.destroy();
    }catch{res.destroy();}
   });lost.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
   await new Promise<void>(r=>lost.listen(0,'127.0.0.1',r));const addr=lost.address();assert.ok(addr&&typeof addr==='object');
   try{
    await assert.rejects(rpc(create('transport http response lost'),jwt(),undefined,`http://127.0.0.1:${addr.port}`));await Promise.race([accepted,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Upstream200 acknowledgement not observed')),5000))]);
    assert.equal(await count('transport http response lost'),1);assert.equal(transportOutcomeV1({kind:'DISCONNECT'}).status,'UNKNOWN');
   }finally{for(const s of sockets)s.destroy();await new Promise<void>(r=>lost.close(()=>r()));}
  });
  await t.test('transport timeout after server accepted gated request: UNKNOWN even when server later commits',async()=>{
   const holder=session(),controller=new AbortController();try{
    await holder.send('BEGIN; SELECT potok_food_evidence.catalog_gate_v1()');
    const response=rpc(create('transport client timeout'),jwt(),controller.signal).then(r=>r,()=>null);
    await wait(async()=>await sql("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='stage_c_authenticator' AND wait_event='advisory' AND query LIKE '%catalog_private_food_v1%')")==='t','accepted request before timeout');
    controller.abort();assert.equal(await response,null);assert.equal(transportOutcomeV1({kind:'DISCONNECT'}).status,'UNKNOWN');
    await holder.send('COMMIT');await wait(async()=>await sql("SELECT NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='stage_c_authenticator' AND state<>'idle' AND query LIKE '%catalog_private_food_v1%')")==='t','request no longer in flight');
    const n=await count('transport client timeout');assert.ok(n===0||n===1);t.diagnostic(`client timeout UNKNOWN, final-state rows=${n}; no retry`);
   }finally{controller.abort();await holder.close();}
  });
  await t.test('transport reconciliation exact food ID/key/digest is read-only state evidence, not operation proof',async()=>{
   const input=importer(9710,'transport reconciliation');assert.equal((await importRPC(input)).status,200);
   const expected=JSON.parse(await sql(`SELECT jsonb_build_object('foodId',id,'stableKey',stable_food_id,'digest',potok_catalog_writer.row_digest_v1(to_jsonb(f))) FROM public.foods f WHERE id=${q(id(9710))}`));
   const before=await sql('SELECT count(*) FROM public.foods');
   const match=await request(`/foods?id=eq.${id(9710)}&select=id,stable_food_id`);assert.equal(match.status,200);
   assert.equal(reconcileFinalStateV1(expected,expected).operationStatus,'UNKNOWN');assert.equal(reconcileFinalStateV1(expected,null).retryAllowed,false);
   assert.equal(await sql('SELECT count(*) FROM public.foods'),before);
   // CREATE ID is generated inside RPC and can be lost with response. No exact-ID
   // lookup/replay possible. Existing state is never promoted to a durable receipt.
  });
 }finally{
  await proxy.close();
  const closed=new Promise<void>(r=>{if(exited)r();else pgrst.once('exit',()=>r());});pgrst.kill('SIGTERM');
  const killTimer=setTimeout(()=>pgrst.kill('SIGKILL'),5000);try{await closed;}finally{clearTimeout(killTimer);}
 }
}
