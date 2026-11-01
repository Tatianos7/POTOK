import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const targetProjectId='ozidryfvhkcbtpnulakq';
const root=new URL('../../../',import.meta.url);
const paths=['generation_preparation_source_v1.sql','generation_producer_sources_v1.sql','generation_goal_preparation_source_v1.sql','generation_plan_readback_v2.sql'].map(p=>'docs/premium/drafts/'+p);
export function buildGenerationStagingPackageV1({manifest=JSON.parse(readFileSync(new URL('manifest.json',import.meta.url),'utf8')),
  read=path=>readFileSync(new URL(path,root))}={}){
  if(manifest.contract!=='potok-generation-staging-package-v1'||manifest.targetProjectId!==targetProjectId
    ||manifest.sourceCommit!=='8711dc1157dd70372b53e30627797c97a18cafd8'||!Array.isArray(manifest.sources)||manifest.sources.length!==paths.length)
    throw Error('GENERATION_PACKAGE_MANIFEST_MISMATCH');
  const bodies=manifest.sources.map((entry,i)=>{
    if(entry.path!==paths[i]||typeof entry.sha256!=='string'||!/^[0-9a-f]{64}$/.test(entry.sha256))throw Error('GENERATION_PACKAGE_ORDER_MISMATCH');
    const bytes=read(entry.path);
    if(!Buffer.isBuffer(bytes)||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('GENERATION_PACKAGE_SOURCE_DRIFT');
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    // Only remove the reviewed top-level envelope; preserve every inner definition/guard.
    const match=/^((?:--[^\n]*\n|\s)*?)BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/.exec(raw);
    if(!match)throw Error('GENERATION_PACKAGE_TRANSACTION_SHAPE');
    return `-- Pinned source: ${entry.path}\n${match[1]}${match[2]}\n`;
  });
  return Object.freeze({targetProjectId,sourceCommit:manifest.sourceCommit,sourceCount:paths.length,
    mayApply:false,mayActivate:false,
    rollbackSql:`-- REVIEW REHEARSAL ONLY. No connection or credentials. Caller must verify target independently.\n-- Target label: ${targetProjectId}; this label is not database identity proof.\nBEGIN;\n${bodies.join('\n')}\nROLLBACK;\n`});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.slice(2).some(a=>a!=='--rollback-sql'))throw Error('GENERATION_PACKAGE_UNSUPPORTED_OPERATION');
  const result=buildGenerationStagingPackageV1();
  console.log(process.argv.includes('--rollback-sql')?result.rollbackSql:JSON.stringify({...result,rollbackSql:undefined}));
}
