import process from 'node:process';
import {Pool, type PoolClient} from 'pg';
import {readPrivateGenerationJsonV1} from './generationPrivateConfigurationV1';
import {generationStagingPgConfigV1,type GenerationNodePgSecretsV1} from './generationNodePgPoolV1';

/** Explicit operator-only Node.js 24 Staging connection probe.
 * No worker invocation, generation request, mutation, fallback credentials or retry.
 * Configuration has the SAME protected-file/owner/mode rules as the worker CLI.
 * No credentials, SQL errors, connection metadata, or user identities are logged.
 */
export const stagingNodeConnectionProbeContractV1='potok-generation-staging-node-connection-probe-v1' as const;
export type StagingNodeConnectionProbeResultV1={
  contract:typeof stagingNodeConnectionProbeContractV1;
  status:'PASS'|'FAIL';
  readerVerified:boolean;
  gatewayVerified:boolean;
  workerEnabled:false;
  writes:0;
};
const roleNames={reader:'potok_generation_reader_v1',gateway:'potok_generation_gateway_v1'} as const;
type Channel=keyof typeof roleNames;
type ProbeRow={role:string;db:string;tls:boolean;transaction_ro:string};
type ProbeClient=Pick<PoolClient,'query'|'release'>;
type ProbePool={connect:()=>Promise<ProbeClient>;end:()=>Promise<void>};
type PoolFactory=(channel:Channel,secrets:GenerationNodePgSecretsV1)=>ProbePool;
const result=(readerVerified:boolean,gatewayVerified:boolean):StagingNodeConnectionProbeResultV1=>Object.freeze({
 contract:stagingNodeConnectionProbeContractV1,status:readerVerified&&gatewayVerified?'PASS':'FAIL',
 readerVerified,gatewayVerified,workerEnabled:false,writes:0,
});
export function verifyGenerationConnectionProbeRowV1(row:unknown,channel:Channel):boolean{
  if(!row||typeof row!=='object'||Array.isArray(row))return false;
  const v=row as Record<string,unknown>;
  return Object.keys(v).length===4&&v.role===roleNames[channel]&&v.db==='postgres'&&
    v.tls===true&&v.transaction_ro==='on';
}
function exact(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_CONFIGURATION');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(v,k)))
  throw Error('INVALID_CONFIGURATION');
 return v;
}
function parseProtectedSecrets(value:unknown):GenerationNodePgSecretsV1 {
 const config=exact(value,['contract','secrets','optimizationPolicyRaw','metricPolicyRaw','comparison','limitsRaw']);
 if(config.contract!=='potok-staging-node-worker-config-v1')throw Error('INVALID_CONFIGURATION');
 const secrets=exact(config.secrets,['ca','readerPassword','gatewayPassword']);
 if(typeof secrets.ca!=='string'||typeof secrets.readerPassword!=='string'||typeof secrets.gatewayPassword!=='string')
   throw Error('INVALID_CONFIGURATION');
 return {ca:secrets.ca,readerPassword:secrets.readerPassword,gatewayPassword:secrets.gatewayPassword};
}
const makePool:PoolFactory=(channel,secrets)=>{
 const config=generationStagingPgConfigV1(channel,secrets);
 return new Pool({...config,max:1}) as ProbePool;
};
async function probeChannel(channel:Channel,secrets:GenerationNodePgSecretsV1,openPool:PoolFactory):Promise<boolean>{
 let pool:ProbePool|undefined,client:ProbeClient|undefined;
 try{
   pool=openPool(channel,secrets);
   client=await pool.connect();
   // BEGIN READ ONLY protects the probe even when inspecting gateway credentials.
   await client.query('BEGIN READ ONLY');
   const check=await client.query('SELECT current_user AS role, current_database() AS db, ssl.ssl AS tls, current_setting(\'transaction_read_only\') AS transaction_ro FROM pg_catalog.pg_stat_ssl ssl WHERE ssl.pid = pg_catalog.pg_backend_pid()');
   return check.rows?.length===1&&verifyGenerationConnectionProbeRowV1(check.rows[0],channel);
 }catch{return false;}
 finally{
   if(client){try{await client.query('ROLLBACK');}catch{/* never retry; closes below */}
     try{client.release(true);}catch{/* closed below */}}
   if(pool){try{await pool.end();}catch{/* report false via lifecycle when possible */}}
 }
}
/** Disabled by default even if a config path is passed. Cannot activate the worker. */
export async function runGenerationNodeConnectionPreflightV1(
  configPath:string,{enabled=false,openPool=makePool}:{enabled?:boolean;openPool?:PoolFactory}={}
):Promise<StagingNodeConnectionProbeResultV1>{
 if(!enabled||'Deno' in globalThis||process.versions.node.split('.')[0]!=='24')
   return result(false,false);
 let secrets:GenerationNodePgSecretsV1;
 try{secrets=parseProtectedSecrets(await readPrivateGenerationJsonV1(configPath));
   generationStagingPgConfigV1('reader',secrets);
   generationStagingPgConfigV1('gateway',secrets);
 }catch{return result(false,false);}
 const readerVerified=await probeChannel('reader',secrets,openPool);
 if(!readerVerified)return result(false,false);
 const gatewayVerified=await probeChannel('gateway',secrets,openPool);
 return result(readerVerified,gatewayVerified);
}
