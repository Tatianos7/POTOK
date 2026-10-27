import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {probe,validatePublicInput,parseProfileRejection,origin,excludedProfiles} from './http-profile.mjs';
const input={url:origin,key:'sb_publishable_synthetic_fixture_only'};
const rejected=profile=>({code:'PGRST106',message:'Invalid schema: '+profile});
function fixture(overrides={}){
 const calls=[];
 const fetcher=async(url,options)=>{const profile=options.headers['Accept-Profile'];calls.push({url,options});const change=overrides[profile];
  const status=change?.status??(profile==='public'?404:406);
  const body=change?.body??(profile==='public'?{code:'PGRST205',message:'Synthetic missing metadata resource'}:rejected(profile));
  return new Response(JSON.stringify(body),{status});
 };return{calls,fetcher};
}
test('actual shortened PGRST106 proves only the requested exclusion, no invented list',()=>{assert.deepEqual(parseProfileRejection(406,rejected('extensions'),'extensions'),{rejected:true,reportedSchemas:null});});
test('legacy schema-list response is retained as evidence without contradicting the requested profile',()=>{assert.deepEqual(parseProfileRejection(406,{code:'PGRST106',message:'The schema must be one of the following: public, graphql_public'},'extensions').reportedSchemas,['graphql_public','public']);assert.throws(()=>parseProfileRejection(406,{code:'PGRST106',message:'The schema must be one of the following: extensions'},'extensions'));});
test('unrecognized messages, wrong status/code and wrong echoed profile never pass',()=>{for(const [status,body] of [[403,rejected('extensions')],[406,{code:'42501',message:'denied'}],[406,rejected('another')],[406,{code:'PGRST106',message:'unrecognized'}]])assert.throws(()=>parseProfileRejection(status,body,'extensions'));});
test('all metadata requests are GET to the exact origin, limit=0, no RPC or user JWT',async()=>{
 const f=fixture();const result=await probe(input,f.fetcher);assert.equal(result.verdict,'OBSERVED_HTTP_SCHEMA_EXCLUSIONS');assert.equal(result.schemas,null);assert.equal(result.releaseReady,false);assert.equal(result.rowsRequested,0);assert.equal(f.calls.length,5);
 assert.deepEqual(f.calls.map(c=>c.options.headers['Accept-Profile']),[...excludedProfiles,'public']);
 for(const c of f.calls){const u=new URL(c.url);assert.equal(u.origin,origin);assert.equal(u.pathname,'/rest/v1/__potok_schema_metadata_probe__');assert.equal(u.searchParams.get('limit'),'0');assert.equal(c.options.method,'GET');assert.equal(c.options.redirect,'error');assert.equal(c.options.body,undefined);assert.equal(c.options.headers.Authorization,undefined);}
 assert(!JSON.stringify(result).includes(input.key));
});
test('accepted internal profile is reported as review-needed, even if SQL grants would deny access',async()=>{for(const status of [200,403,404]){const f=fixture({potok_control:{status,body:status===200?[]:{code:status===403?'42501':'PGRST205'}}});const r=await probe(input,f.fetcher);assert.equal(r.verdict,'NEEDS_REVIEW');assert.equal(r.exclusions.find(e=>e.profile==='potok_control').rejected,false);}});
test('a globally broken route/key is not confused with a verified public/exclusion boundary',async()=>{const f=fixture({public:{status:401,body:{code:'401'}}});assert.equal((await probe(input,f.fetcher)).verdict,'NEEDS_REVIEW');await assert.rejects(()=>probe(input,async()=>{throw Error('synthetic network');}));});
test('arbitrary origin, service-role JWT, user JWT and cross-project key are refused before HTTP',async()=>{
 const jwt=payload=>'header.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.signature';
 for(const v of [{...input,url:'https://elsewhere.example'}, {...input,key:jwt({role:'service_role',ref:'dtsdnhbcwpbfrhcazqkb'})},{...input,key:jwt({role:'authenticated',sub:'synthetic-user',ref:'dtsdnhbcwpbfrhcazqkb'})},{...input,key:jwt({role:'anon',ref:'other'})}]) {assert.throws(()=>validatePublicInput(v));let calls=0;await assert.rejects(()=>probe(v,async()=>{calls++;}));assert.equal(calls,0);}
 validatePublicInput({...input,key:jwt({role:'anon',ref:'dtsdnhbcwpbfrhcazqkb'})});
});
test('malformed stdin never echoes input or prints an exception containing credentials',()=>{const marker='synthetic-private-marker-never-log';const r=spawnSync(process.execPath,['scripts/security/managed-boundary/http-profile.mjs','--read-public-profiles'],{input:'{'+marker+'\n',encoding:'utf8'});assert.equal(r.status,1);assert(!r.stdout.includes(marker));assert(!r.stderr.includes(marker));assert(r.stderr.includes('HTTP_SCHEMA_PROBE_STOPPED'));});
test('readonly trgm scan stays a readonly wrapper with no extension alteration or temporary tables',async()=>{const q=await readFile(new URL('trgm-readonly.sql',import.meta.url),'utf8');assert(q.startsWith('BEGIN READ ONLY;'));assert(q.trim().endsWith('ROLLBACK;'));assert(!/^\s*(?:ALTER|CREATE|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE|EXECUTE|COMMIT)\b/im.test(q));assert(q.includes('TRGM_SOURCE_PREFLIGHT_READ_ONLY_OK'));});
test('readonly block matches the already pinned release source, never the mutating rehearsal suffix',async()=>{
 const reviewed=await readFile('scripts/security/release-packet/forward.review.sql','utf8');
 const section=reviewed.slice(reviewed.indexOf('-- Reviewed candidate: trgm'),reviewed.indexOf('-- Reviewed follow-up: paywall'));
 assert(section.startsWith('-- Reviewed candidate: trgm'));
 const marker='DO $preflight$',end='$preflight$;';assert.equal(section.split(marker).length-1,1);
 const start=section.indexOf(marker),stop=section.indexOf(end,start)+end.length;
 const expected="BEGIN READ ONLY;\nSET LOCAL search_path=pg_catalog,pg_temp;\nSET LOCAL statement_timeout='15s';\n"+section.slice(start,stop)+"\nSELECT 'TRGM_SOURCE_PREFLIGHT_READ_ONLY_OK' AS result;\nROLLBACK;\n";
 assert.equal(await readFile('scripts/security/managed-boundary/trgm-readonly.sql','utf8'),expected);
});
