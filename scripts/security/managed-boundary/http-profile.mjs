// Metadata-only GET/Accept-Profile probe. No user JWT, RPC, mutation or arbitrary origin.
import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export const origin='https://dtsdnhbcwpbfrhcazqkb.supabase.co';
export const excludedProfiles=['extensions','potok_control','potok_nutrition','potok_delivery'];
export function validatePublicInput(input) {
  assert.equal(input.url,origin);assert.equal(typeof input.key,'string');
  assert(input.key.length<4096&&input.key.length>20&&!/[\r\n]/.test(input.key));
  if(input.key.startsWith('sb_publishable_'))return;
  const pieces=input.key.split('.');assert.equal(pieces.length,3);
  const payload=JSON.parse(Buffer.from(pieces[1],'base64url').toString('utf8'));
  assert.equal(payload.role,'anon');assert.equal(payload.ref,'dtsdnhbcwpbfrhcazqkb');assert(!payload.sub);
}
export function parseProfileRejection(status,body,profile) {
  assert.equal(status,406);assert.equal(body?.code,'PGRST106');
  assert.equal(typeof body.message,'string');
  if(body.message==='Invalid schema: '+profile)return {rejected:true,reportedSchemas:null};
  const prefix='The schema must be one of the following: ';
  assert(body.message.startsWith(prefix));
  const schemas=body.message.slice(prefix.length).split(',').map(s=>s.trim());
  assert(schemas.length>0&&schemas.length<=100&&schemas.every(s=>/^[a-z_][a-z0-9_]*$/.test(s)));
  assert.equal(new Set(schemas).size,schemas.length);assert(!schemas.includes(profile));
  return {rejected:true,reportedSchemas:schemas.sort()};
}
export async function probe(input,fetcher=fetch) {
  validatePublicInput(input);
  const route=origin+'/rest/v1/__potok_schema_metadata_probe__?select=id&limit=0';
  const request=async profile=>{
    const response=await fetcher(route,{method:'GET',redirect:'error',headers:{apikey:input.key,'Accept-Profile':profile,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
    // Never print a body, header, key or unexpected server message.
    const bytes=await response.text();assert(bytes.length<16384);
    let body;try{body=JSON.parse(bytes);}catch{throw Error('Expected metadata JSON');}
    return {status:response.status,body};
  };
  const exclusions=[];let schemas=null;
  for(const profile of excludedProfiles){
    const rejected=await request(profile);
    if(rejected.status!==406||rejected.body?.code!=='PGRST106') {
      exclusions.push({profile,rejected:false,status:rejected.status,code:rejected.body?.code??null});continue;
    }
    const proof=parseProfileRejection(rejected.status,rejected.body,profile);
    if(proof.reportedSchemas){if(schemas)assert.deepEqual(proof.reportedSchemas,schemas);schemas=proof.reportedSchemas;}
    exclusions.push({profile,rejected:true,code:'PGRST106',status:406});
  }
  // A nonexistent resource and limit=0 cannot return application rows or invoke an RPC.
  const publicCheck=await request('public');
  const publicReachable=publicCheck?.status===404&&['PGRST205','42P01'].includes(publicCheck.body?.code);
  return {protocol:'potok-http-schema-observation-v1',observedAt:new Date().toISOString(),target:origin,
    method:'GET',roleContext:'public-key/anon; no user JWT',rowsRequested:0,schemas,exclusions,
    publicResourceCheck:publicCheck?{status:publicCheck.status,code:publicCheck.body?.code??null}:null,
    publicReachable,
    verdict:publicReachable&&exclusions.every(e=>e.rejected)?'OBSERVED_HTTP_SCHEMA_EXCLUSIONS':'NEEDS_REVIEW',
    releaseReady:false,note:'Only the four named exclusions and positive public route were tested. No complete schema list is inferred when the server omits it. Not a Management config export, permission/RLS proof, authenticated A/B acceptance or future exposure guarantee.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(['--read-public-profiles'])){console.error('HTTP_SCHEMA_PROBE_STOPPED: only stdin-based metadata mode is supported');process.exit(1);}
  const rl=createInterface({input:process.stdin,terminal:false});
  rl.once('line',async line=>{
    rl.close();
    try {
      const result=await probe(JSON.parse(line));
      console.log(JSON.stringify(result));process.exit(0);
    } catch {console.error('HTTP_SCHEMA_PROBE_STOPPED: no proof; input and response remain private');process.exit(1);}
  });
}
