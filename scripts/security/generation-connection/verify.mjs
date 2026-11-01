import {spawnSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const stagingHost='db.ozidryfvhkcbtpnulakq.supabase.co';
export const roles=['potok_generation_reader_v1','potok_generation_gateway_v1'];
const labels=['session_identity','role_attributes','memberships','function_allowlist','table_access','ownership','schema_access','tls','timeouts','read_only_probe'];
export function classifyConnection(value,role){
  if(!value||value.contract!=='potok-generation-connection-observation-v1'||value.role!==role||!value.checks
    ||Object.keys(value.checks).length!==labels.length||!labels.every(k=>Object.hasOwn(value.checks,k))||value.mayActivate!==false)
    throw Error('GENERATION_CONNECTION_INVALID_OBSERVATION');
  const failedChecks=labels.filter(k=>value.checks[k]!==true);
  if(value.connectionChecksPassed!==(failedChecks.length===0))throw Error('GENERATION_CONNECTION_INVALID_OBSERVATION');
  return {role,connectionChecksPassed:failedChecks.length===0,failedChecks,mayActivate:false};
}
/** SELECT-only Staging direct-connection check. Password/CA files are selectors;
 * credential bytes and connection strings are never read, returned or logged. */
export function verifyGenerationConnections({passfile=process.env.POTOK_GENERATION_PGPASSFILE,ca=process.env.POTOK_GENERATION_CA,
  run=spawnSync,stat=statSync,path=process.env.PATH}={}){
  if(!passfile||!ca||!isAbsolute(passfile)||!isAbsolute(ca))throw Error('GENERATION_CONNECTION_FILES_REQUIRED');
  let secret,certificate;try{secret=stat(passfile);certificate=stat(ca);}catch{throw Error('GENERATION_CONNECTION_FILES_INVALID');}
  if(!secret.isFile()||!certificate.isFile()||(secret.mode&0o077)!==0||(secret.mode&0o400)===0)throw Error('GENERATION_CONNECTION_FILE_PERMISSIONS');
  const query=readFileSync(new URL('probe.readonly.sql',import.meta.url),'utf8');
  return roles.map(role=>{
    const result=run('psql',['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-h',stagingHost,'-p','5432','-U',role,'-d','postgres'],{
      input:query,encoding:'utf8',maxBuffer:64*1024,timeout:45000,
      env:{PATH:path,LANG:'C',PGPASSFILE:passfile,PGSSLROOTCERT:ca,PGSSLMODE:'verify-full',PGCONNECT_TIMEOUT:'5',
        PGOPTIONS:'-c default_transaction_read_only=on',PGAPPNAME:'potok-generation-connection-check'},
    });
    if(result.error||result.status!==0)throw Error('GENERATION_CONNECTION_PROBE_FAILED');
    let value;try{value=JSON.parse(result.stdout);}catch{throw Error('GENERATION_CONNECTION_INVALID_OBSERVATION');}
    return classifyConnection(value,role);
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==2)throw Error('GENERATION_CONNECTION_UNSUPPORTED_ARGUMENTS');
    const checks=verifyGenerationConnections();console.log(JSON.stringify({targetProjectId:'ozidryfvhkcbtpnulakq',checks,mayActivate:false}));
    if(checks.some(c=>!c.connectionChecksPassed))process.exitCode=1;
  }catch(error){console.error(error instanceof Error&&/^GENERATION_CONNECTION_[A-Z_]+$/.test(error.message)?error.message:'GENERATION_CONNECTION_PROBE_FAILED');process.exitCode=1;}
}
