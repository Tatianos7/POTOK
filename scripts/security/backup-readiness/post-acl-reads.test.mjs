import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateReadInput,runExistingReadWorker,protectedSnapshotSQL,assertReadPreservation} from './post-acl-reads.mjs';
const users=[{id:'11111111-1111-4111-8111-111111111111',email:'potok-ab-0123456789abcdef01234567-a@example.test'},{id:'22222222-2222-4222-8222-222222222222',email:'potok-ab-0123456789abcdef01234567-b@example.test'}];
const input=()=>({users:structuredClone(users),selects:Array.from({length:81},(_,i)=>i===0?'user_profiles':'pad_'+i).flatMap((table_name,i)=>['anon','authenticated'].map(role=>({table_name,role,allowed:i%2===0})))});
function fixture(variant=''){
 const config=input(),capture={codes:new Map(),counts:new Map(),rejected:0,started:false,closed:false,async start(){this.started=true;},async close(){this.closed=true;}},calls=[];
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status});
 const request=async(raw,options)=>{const u=new URL(raw);calls.push({u,options});assert.equal(u.hostname,'127.0.0.1');assert.equal(options.redirect,'error');assert(options.signal);const auth=options.headers.Authorization;
  if(u.port==='13002'){
   const body=options.body?JSON.parse(options.body):null;
   if(u.pathname==='/otp'){assert.equal(body.create_user,false);assert(users.some(x=>x.email===body.email));capture.codes.set(body.email,'123456');capture.counts.set(body.email,1);return reply({});}
   if(u.pathname==='/verify'){assert.equal(body.token,'123456');assert.equal(body.type,'email');const user=users.find(x=>x.email===body.email),sub=variant==='wrong-user'?users[1].id:user.id;
    return reply({user:{...user,id:sub},access_token:'h.'+Buffer.from(JSON.stringify({sub,role:'authenticated'})).toString('base64url')+'.s'});}
   assert.equal(u.pathname,'/user');const sub=JSON.parse(Buffer.from(auth.split('.')[1],'base64url')).sub;return reply({id:sub});
  }
  assert.equal(u.port,'33001');assert.equal(options.method,'GET');assert.equal(options.headers['Accept-Profile'],'public');assert.equal(options.body,undefined);
  const sub=auth?JSON.parse(Buffer.from(auth.split('.')[1],'base64url')).sub:null;
  if(u.pathname==='/user_profiles'&&u.searchParams.has('id_user')){const id=u.searchParams.get('id_user').slice(3),own=id===sub;
   return reply(own?[{id_user:id,is_admin:variant==='admin',has_premium:false}]:variant==='foreign-leak'?[{id_user:id}]:[]);}
  const r=config.selects.find(r=>r.table_name===u.pathname.slice(1)&&r.role===(auth?'authenticated':'anon'));assert(r);assert.equal(u.searchParams.get('limit'),'0');
  if(!r.allowed){if(variant==='hidden-route')return reply({code:'PGRST205'},404);if(variant==='unexpected-allow')return reply([]);return reply({code:'42501'},auth?403:401);}
  return reply(variant==='unexpected-rows'?[{mustNotAppear:true}]:[]);
 };
 return {config,capture,calls,options:{captureFactory:()=>capture,request}};
}
test('existing identities use create_user false, real token path, own/foreign profiles and exact 243 GET observations',async()=>{
 const f=fixture();const result=await runExistingReadWorker(f.config,f.options);assert.equal(result.tableReadObservations,243);assert.equal(result.users,2);assert.equal(result.foreignProfilesDenied,2);assert.equal(result.dataApiWrites,false);assert.equal(result.releaseReady,false);assert.equal(result.uiAcceptance,false);
 assert.equal(f.calls.filter(c=>c.options.method==='POST').length,4);assert(f.calls.filter(c=>c.options.method==='POST').every(c=>c.u.port==='13002'&&['/otp','/verify'].includes(c.u.pathname)));assert.equal(f.calls.filter(c=>c.u.port==='33001').length,247);assert.equal(f.capture.codes.size,0);assert.equal(f.capture.closed,true);assert(!JSON.stringify(result).includes('123456'));assert(!JSON.stringify(result).includes(users[0].email));
});
test('foreign leak, wrong account, protected profile, hidden route, unexpected allow/data stop and close capture',async()=>{
 for(const variant of ['foreign-leak','wrong-user','admin','hidden-route','unexpected-allow','unexpected-rows']){const f=fixture(variant);await assert.rejects(runExistingReadWorker(f.config,f.options),/^Error: POST_ACL_READ_WORKER_STOPPED: [a-z0-9-]+$/);assert.equal(f.capture.closed,true);assert.equal(f.capture.codes.size,0);}
});
test('arbitrary identities, duplicate/partial permission scope and identifier injection stop before login',async()=>{
 for(const change of [c=>c.users[0].email='real@example.com',c=>c.users[1].id=c.users[0].id,c=>c.users[1].email=c.users[1].email.replace('01234567','ffffffff'),c=>c.selects.pop(),c=>c.selects[1]=c.selects[0],c=>c.selects[0].table_name='x?select=*',c=>c.selects[0].role='service_role']){const f=fixture();change(f.config);await assert.rejects(runExistingReadWorker(f.config,f.options));assert.equal(f.calls.length,0);assert.equal(f.capture.started,false);}
});
test('protected snapshot includes all public profiles/execution_reason and limits mutable exclusions to eight synthetic Auth scopes',()=>{
 const tables=Array.from({length:112},(_,i)=>i<8?{schema:'auth',name:['users','identities','sessions','refresh_tokens','one_time_tokens','flow_state','audit_log_entries','mfa_amr_claims'][i]}:{schema:'public',name:i===8?'user_profiles':'pad_'+i});
 const sql=protectedSnapshotSQL(tables,users);assert.equal((sql.match(/WHERE NOT coalesce/g)||[]).length,8);assert(sql.includes('payload->>\'actor_id\''));assert(sql.includes('session_id IN(SELECT id FROM auth.sessions'));assert(sql.includes('to_jsonb(t)::text'));assert(!sql.includes('-\'execution_reason\''));assert(!/\b(INSERT|UPDATE|DELETE|ALTER|GRANT|REVOKE|COMMIT|COPY)\b/.test(sql));assert(!sql.includes(users[0].email+'\n'));
 assert.throws(()=>protectedSnapshotSQL(tables.map((t,i)=>i===10?{schema:'private',name:'bad'}:t),users));assert.throws(()=>protectedSnapshotSQL(tables.slice(1),users));
});
test('new accounts, unrelated data/schema/permission/authority changes never count as preserved',()=>{
 const before={protected:{identitiesPresent:2,userIds:'fixed',protected:[{schema:'public',name:'user_profiles',rows:'12',hash:'unchanged'}],authMetadata:'fixed'},capture:{actor:'postgres',actorSuper:false,candidateNamespaces:3,authorityRows:0,aclSha256:'fixed',columnAclSha256:'fixed',shapeSha256:'fixed',rights:[{allowed:false}],tables:[['user_profiles','postgres',true]],clientRoles:[['anon',false,false]],replicationRole:'origin'}};
 assertReadPreservation(before,structuredClone(before));
 for(const mutate of [a=>a.protected.userIds='new-account',a=>a.protected.protected[0].hash='same-count-tamper',a=>a.protected.authMetadata='migration',a=>a.capture.authorityRows=1,a=>a.capture.rights[0].allowed=true,a=>a.capture.shapeSha256='changed',a=>a.capture.columnAclSha256='changed']){const after=structuredClone(before);mutate(after);assert.throws(()=>assertReadPreservation(before,after));}
});
test('controller refuses arbitrary apply/URL modes before Docker; no privileged worker channel or Data API write source',async()=>{
 const file=fileURLToPath(new URL('post-acl-reads.mjs',import.meta.url)),source=await readFile(file,'utf8');
 for(const args of [['--apply'],['--run-existing-private','https://example.invalid']]){const r=spawnSync(process.execPath,[file,...args],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/phase=admission/);assert(!r.stderr.includes('example.invalid'));}
 assert(source.includes("'--read-only','--cap-drop','ALL'"));assert(source.includes("'--user','node'"));assert(!source.includes("'--publish'"));assert(!source.includes("'--env-file'"));assert(!source.includes('create_user:true'));assert(!source.includes("method:'PATCH'"));
});
